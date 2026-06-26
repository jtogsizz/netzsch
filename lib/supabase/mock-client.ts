/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, prefer-const */
// Mock Supabase client for local development when environment variables are placeholders.
import type { Databook, Employee, AuditLog } from '@/types';

// Helper to check cookies in document (client side)
function getClientCookie(name: string): string | null {
  if (typeof window === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export class MockQueryBuilder {
  private tableName: string;
  private isServer: boolean;
  private cookieStore: any;
  
  // Query chain states
  private filters: ((item: any) => boolean)[] = [];
  private sortField: string | null = null;
  private sortAscending: boolean = true;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private limitCount: number | null = null;
  
  // Actions
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private actionData: any = null;
  private isSingle: boolean = false;
  private isMaybeSingle: boolean = false;

  constructor(tableName: string, cookieStore?: any) {
    this.tableName = tableName;
    this.cookieStore = cookieStore;
    this.isServer = typeof window === 'undefined';
  }

  private getDb(): any {
    if (this.isServer) {
      try {
        const fs = eval('require')('fs');
        const path = eval('require')('path');
        const dbFile = path.join(process.cwd(), 'lib', 'supabase', 'mock_db.json');
        if (!fs.existsSync(dbFile)) {
          return { employees: [], databooks: [], audit_logs: [] };
        }
        const content = fs.readFileSync(dbFile, 'utf8');
        return JSON.parse(content);
      } catch (error) {
        console.error('Error reading mock DB:', error);
        return { employees: [], databooks: [], audit_logs: [] };
      }
    }
    return null;
  }

  private saveDb(db: any) {
    if (this.isServer) {
      try {
        const fs = eval('require')('fs');
        const path = eval('require')('path');
        const dbFile = path.join(process.cwd(), 'lib', 'supabase', 'mock_db.json');
        fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), 'utf8');
      } catch (error) {
        console.error('Error writing mock DB:', error);
      }
    }
  }

  select(columns?: string, options?: { count?: string; head?: boolean }) {
    this.action = 'select';
    return this;
  }

  insert(data: any) {
    this.action = 'insert';
    this.actionData = data;
    return this;
  }

  update(data: any) {
    this.action = 'update';
    this.actionData = data;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  neq(column: string, value: any) {
    this.filters.push((item) => item[column] !== value);
    return this;
  }

  not(column: string, operator: string, value: any) {
    if (operator === 'is' && value === null) {
      this.filters.push((item) => item[column] !== null && item[column] !== undefined);
    }
    return this;
  }

  gte(column: string, value: any) {
    this.filters.push((item) => {
      if (!item[column]) return false;
      return item[column] >= value;
    });
    return this;
  }

  lte(column: string, value: any) {
    this.filters.push((item) => {
      if (!item[column]) return false;
      return item[column] <= value;
    });
    return this;
  }

  lt(column: string, value: any) {
    this.filters.push((item) => {
      if (!item[column]) return false;
      return item[column] < value;
    });
    return this;
  }

  is(column: string, value: any) {
    this.filters.push((item) => item[column] === value);
    return this;
  }

  in(column: string, values: any[]) {
    this.filters.push((item) => values.includes(item[column]));
    return this;
  }

  or(filterString: string) {
    // Ex: number.ilike.%test%,client_name.ilike.%test%
    const terms = filterString.split(',');
    this.filters.push((item) => {
      return terms.some((term) => {
        const parts = term.split('.');
        const col = parts[0];
        const op = parts[1];
        const val = parts[2]?.replace(/%/g, '') || '';
        if (op === 'ilike') {
          const itemVal = String(item[col] || '').toLowerCase();
          return itemVal.includes(val.toLowerCase());
        }
        return false;
      });
    });
    return this;
  }

  ilike(column: string, pattern: string) {
    const val = pattern.replace(/%/g, '').toLowerCase();
    this.filters.push((item) => {
      const itemVal = String(item[column] || '').toLowerCase();
      return itemVal.includes(val);
    });
    return this;
  }

  filter(column: string, operator: string, value: any) {
    const colName = column.split('::')[0];
    if (operator === 'like' || operator === 'ilike') {
      const isCaseInsensitive = operator === 'ilike';
      const valStr = String(value ?? '');
      let regexPattern = '';
      for (let i = 0; i < valStr.length; i++) {
        const char = valStr[i];
        if (char === '*') {
          regexPattern += '.*';
        } else if (char === '?') {
          regexPattern += '.';
        } else if ('[\\^$.|?*+()'.includes(char)) {
          regexPattern += '\\' + char;
        } else {
          regexPattern += char;
        }
      }
      const regex = new RegExp(`^${regexPattern}$`, isCaseInsensitive ? 'i' : '');
      this.filters.push((item) => {
        const itemVal = item[colName] === null || item[colName] === undefined ? '' : String(item[colName]);
        return regex.test(itemVal);
      });
    } else if (operator === 'eq') {
      this.filters.push((item) => {
        const itemVal = item[colName] === null || item[colName] === undefined ? '' : String(item[colName]);
        return itemVal === String(value);
      });
    } else {
      this.filters.push((item) => {
        const itemVal = item[colName] === null || item[colName] === undefined ? '' : String(item[colName]);
        return itemVal === String(value);
      });
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.sortField = column;
    this.sortAscending = options?.ascending !== false;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingle = true;
    return this;
  }

  async execute() {
    let rawData: any[] = [];

    if (this.isServer) {
      const db = this.getDb();
      rawData = db[this.tableName] || [];
    } else {
      // Client side fetch
      try {
        const res = await fetch(`/api/mock-db?table=${this.tableName}`);
        rawData = await res.json();
      } catch (e) {
        rawData = [];
      }
    }

    if (this.action === 'insert') {
      const db = this.getDb();
      const tableData = db[this.tableName] || [];
      const newItems = Array.isArray(this.actionData) ? this.actionData : [this.actionData];
      const insertedItems = newItems.map((item) => ({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...item,
      }));
      db[this.tableName] = [...tableData, ...insertedItems];
      this.saveDb(db);
      return { data: Array.isArray(this.actionData) ? insertedItems : insertedItems[0], count: insertedItems.length, error: null };
    }

    if (this.action === 'update') {
      const db = this.getDb();
      const tableData = db[this.tableName] || [];
      let updatedData = [...tableData];
      let matchedCount = 0;
      let updatedItems: any[] = [];

      updatedData = updatedData.map((item) => {
        // Check if item matches current filters
        const matches = this.filters.every((fn: any) => fn(item));
        if (matches) {
          matchedCount++;
          const updated = {
            ...item,
            ...this.actionData,
            updated_at: new Date().toISOString(),
          };
          updatedItems.push(updated);
          return updated;
        }
        return item;
      });

      db[this.tableName] = updatedData;
      this.saveDb(db);
      return { data: this.isSingle || this.isMaybeSingle ? updatedItems[0] : updatedItems, count: matchedCount, error: null };
    }

    if (this.action === 'delete') {
      const db = this.getDb();
      const tableData = db[this.tableName] || [];
      const remaining: any[] = [];
      const deleted: any[] = [];

      tableData.forEach((item: any) => {
        const matches = this.filters.every((fn: any) => fn(item));
        if (matches) {
          deleted.push(item);
        } else {
          remaining.push(item);
        }
      });

      db[this.tableName] = remaining;
      this.saveDb(db);
      return { data: deleted, count: deleted.length, error: null };
    }

    // Default 'select' operation
    let result = [...rawData];

    // Apply filters
    for (const filterFn of this.filters) {
      result = result.filter(filterFn);
    }

    const totalCount = result.length;

    // Apply sorting
    if (this.sortField) {
      const field = this.sortField;
      const asc = this.sortAscending;
      result.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        if (valA < valB) return asc ? -1 : 1;
        if (valA > valB) return asc ? 1 : -1;
        return 0;
      });
    }

    // Apply range / limit
    if (this.rangeFrom !== null && this.rangeTo !== null) {
      result = result.slice(this.rangeFrom, this.rangeTo + 1);
    } else if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    if (this.isSingle) {
      return { data: result[0] || null, count: result.length, error: result[0] ? null : { message: 'Not found' } };
    }

    if (this.isMaybeSingle) {
      return { data: result[0] || null, count: result.length, error: null };
    }

    return { data: result, count: totalCount, error: null };
  }

  // Await support
  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | undefined | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null
  ): Promise<any | TResult> {
    return this.execute().catch(onrejected);
  }

}

export function createMockSupabaseClient(cookieStore?: any) {
  const isServer = typeof window === 'undefined';

  const checkHasSession = () => {
    if (isServer) {
      if (!cookieStore) return false;
      // Em Next.js, cookieStore pode ser o cookieStore retornado por cookies()
      try {
        const cookie = cookieStore.get('sb-mock-session');
        return cookie?.value === 'true';
      } catch {
        return false;
      }
    } else {
      return getClientCookie('sb-mock-session') === 'true';
    }
  };

  return {
    auth: {
      async signInWithPassword({ email, password }: any) {
        if (email === 'sistema@netzsch.internal' && password === 'netzsch@2026') {
          if (!isServer) {
            document.cookie = 'sb-mock-session=true; path=/; max-age=86400';
          }
          return {
            data: {
              user: {
                id: 'mock-user-id',
                email: 'sistema@netzsch.internal',
                role: 'admin',
              },
              session: {
                access_token: 'mock-access-token',
                user: { id: 'mock-user-id', email: 'sistema@netzsch.internal' },
              },
            },
            error: null,
          };
        }
        return {
          data: { user: null, session: null },
          error: { message: 'Credenciais inválidas. Verifique o e-mail e a senha.' },
        };
      },

      async signOut() {
        if (!isServer) {
          document.cookie = 'sb-mock-session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }
        return { error: null };
      },

      async getUser() {
        const hasSession = checkHasSession();
        if (hasSession) {
          return {
            data: {
              user: {
                id: 'mock-user-id',
                email: 'sistema@netzsch.internal',
                role: 'admin',
              },
            },
            error: null,
          };
        }
        return { data: { user: null }, error: null };
      },
    },

    from(tableName: string) {
      return new MockQueryBuilder(tableName, cookieStore);
    },

    storage: {
      from(bucket: string) {
        return {
          async list(path: string) {
            if (typeof window === 'undefined') return { data: [], error: null };
            const stored = localStorage.getItem(`mock_storage_${bucket}_${path}`);
            return { data: stored ? JSON.parse(stored) : [], error: null };
          },
          async upload(filePath: string, file: File, options?: any) {
            if (typeof window === 'undefined') return { data: null, error: null };
            const pathParts = filePath.split('/');
            const path = pathParts[0];
            const name = pathParts.slice(1).join('/');
            
            const stored = localStorage.getItem(`mock_storage_${bucket}_${path}`);
            const items = stored ? JSON.parse(stored) : [];
            
            const newItem = {
              name,
              id: crypto.randomUUID(),
              updated_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              last_modified: file.lastModified,
              metadata: {
                size: file.size,
                mimetype: file.type,
              }
            };
            
            // Remove existing with same name if any
            const filteredItems = items.filter((item: any) => item.name !== name);
            filteredItems.push(newItem);
            
            localStorage.setItem(`mock_storage_${bucket}_${path}`, JSON.stringify(filteredItems));
            return { data: { path: filePath }, error: null };
          },
          async remove(filePaths: string[]) {
            if (typeof window === 'undefined') return { data: null, error: null };
            filePaths.forEach(filePath => {
              const pathParts = filePath.split('/');
              const path = pathParts[0];
              const name = pathParts.slice(1).join('/');
              
              const stored = localStorage.getItem(`mock_storage_${bucket}_${path}`);
              if (stored) {
                let items = JSON.parse(stored);
                items = items.filter((item: any) => item.name !== name);
                localStorage.setItem(`mock_storage_${bucket}_${path}`, JSON.stringify(items));
              }
            });
            return { data: [], error: null };
          },
          async download(filePath: string) {
            const blob = new Blob(["conteudo ficticio de teste"], { type: "text/plain" });
            return { data: blob, error: null };
          },
          getPublicUrl(filePath: string) {
            return { data: { publicUrl: `https://mock-storage.supabase.co/${bucket}/${filePath}` } };
          }
        };
      }
    }
  };
}
