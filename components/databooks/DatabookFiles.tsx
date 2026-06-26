'use client';

import { useState, useEffect, useCallback } from 'react';
import { File, Upload, Trash2, Download, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

interface DatabookFilesProps {
  databookId: string;
}

interface StorageFile {
  name: string;
  id: string;
  created_at: string;
  updated_at: string;
  metadata?: {
    size?: number;
    mimetype?: string;
  };
}

interface SupabaseStorageItem {
  name: string;
  id?: string;
  created_at?: string;
  updated_at?: string;
  metadata?: {
    size?: number;
    mimetype?: string;
  };
}

const ALLOWED_EXTENSIONS = [
  'pdf', 'dwg', 'dxf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'zip', 'png', 'jpg', 'jpeg', 'webp'
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export function DatabookFiles({ databookId }: DatabookFilesProps) {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from('databooks')
        .list(databookId);

      if (error) {
        throw error;
      }

      // Filtrar placeholders comuns do Supabase Storage ou itens nulos
      const items = (data as unknown as SupabaseStorageItem[]) || [];
      const fileList = items
        .filter((f: SupabaseStorageItem) => f.name !== '.emptyFolderPlaceholder' && f.name !== '')
        .map((f: SupabaseStorageItem) => ({
          name: f.name,
          id: f.id || String(Math.random()),
          created_at: f.created_at || new Date().toISOString(),
          updated_at: f.updated_at || new Date().toISOString(),
          metadata: f.metadata
            ? {
                size: f.metadata.size,
                mimetype: f.metadata.mimetype,
              }
            : undefined,
        }));

      setFiles(fileList);
    } catch (err: unknown) {
      console.error('Erro ao listar arquivos do storage:', err);
      // Mantém a lista vazia em caso de falha silenciosa para evitar travamentos
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [databookId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFiles();
  }, [fetchFiles]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const validateAndUploadFiles = async (selectedFiles: FileList | File[]) => {
    setErrorMsg(null);
    const filesToUpload = Array.from(selectedFiles);
    
    if (filesToUpload.length === 0) return;

    // Validações preliminares
    for (const file of filesToUpload) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
        setErrorMsg(`Formato de arquivo não permitido: .${ext || 'desconhecido'}. Apenas PDF, DWG, DXF, DOC/X, XLS/X, CSV, ZIP e Imagens são aceitos.`);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setErrorMsg(`O arquivo "${file.name}" excede o limite máximo permitido de 50 MB.`);
        return;
      }
    }

    setUploading(true);
    try {
      const supabase = createClient();
      
      for (const file of filesToUpload) {
        // Envia para a subpasta databookId/
        const { error } = await supabase.storage
          .from('databooks')
          .upload(`${databookId}/${file.name}`, file, {
            upsert: true,
          });

        if (error) throw error;
      }

      await fetchFiles();
    } catch (err: unknown) {
      console.error('Erro no upload de arquivos:', err);
      const message = err instanceof Error ? err.message : 'Erro ao realizar upload dos arquivos.';
      setErrorMsg(message);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await validateAndUploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await validateAndUploadFiles(e.target.files);
    }
  };

  const handleDelete = async (fileName: string) => {
    if (!confirm(`Deseja realmente excluir permanentemente o arquivo "${fileName}"?`)) {
      return;
    }

    setErrorMsg(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.storage
        .from('databooks')
        .remove([`${databookId}/${fileName}`]);

      if (error) throw error;
      await fetchFiles();
    } catch (err: unknown) {
      console.error('Erro ao excluir arquivo:', err);
      const message = err instanceof Error ? err.message : 'Erro ao excluir o arquivo.';
      setErrorMsg(message);
    }
  };

  const handleDownload = async (fileName: string) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from('databooks')
        .download(`${databookId}/${fileName}`);

      if (error) throw error;

      const url = window.URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err: unknown) {
      console.error('Erro ao fazer download do arquivo:', err);
      alert('Não foi possível fazer download do arquivo selecionado.');
    }
  };

  const formatBytes = (bytes?: number, decimals = 1) => {
    if (bytes === undefined || bytes === null) return '0 Bytes';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '0.875rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--text-primary)' }}>
          Arquivos anexados
        </h3>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
          Adicione qualquer arquivo relacionado ao Databook.
        </p>
      </div>

      {/* Drag & Drop zone */}
      <div
        className={`drag-drop-zone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        style={{
          border: '1px dashed var(--border)',
          borderRadius: 3,
          padding: '1.75rem',
          textAlign: 'center',
          background: dragActive ? 'var(--brand-50)' : '#fcfcfc',
          transition: 'all 0.15s',
          marginBottom: '1rem',
          position: 'relative',
        }}
      >
        <input
          type="file"
          id="file-upload"
          multiple
          onChange={handleFileInput}
          style={{ display: 'none' }}
          accept=".pdf,.dwg,.dxf,.doc,.docx,.xls,.xlsx,.csv,.zip,.png,.jpg,.jpeg,.webp"
          disabled={uploading}
        />
        <label
          htmlFor="file-upload"
          style={{
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {uploading ? (
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--brand-700)', marginBottom: '0.5rem' }} />
          ) : (
            <Upload size={24} style={{ color: 'var(--brand-700)', marginBottom: '0.5rem' }} />
          )}
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, margin: '0 0 0.5rem', color: 'var(--text-primary)' }}>
            Arraste e solte arquivos aqui para fazer upload
          </p>
          <div
            className="btn btn-secondary btn-xs"
            style={{
              marginBottom: '0.5rem',
              pointerEvents: 'none',
              borderRadius: 3,
              opacity: uploading ? 0.6 : 1,
            }}
          >
            Selecionar arquivos
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
            PDF, DWG, DXF, DOC/X, XLS/X, CSV, ZIP, Imagens (Máx. 50 MB por arquivo)
          </p>
        </label>
      </div>

      {errorMsg && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.5rem',
            padding: '0.625rem 0.875rem',
            background: '#fff5f5',
            border: '1px solid #ffcccc',
            borderRadius: 3,
            color: '#c53030',
            fontSize: '0.8125rem',
            marginBottom: '1rem',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Lista / Grade de Arquivos */}
      <div>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            <Loader2 size={20} className="animate-spin" style={{ marginRight: '0.5rem' }} />
            <span style={{ fontSize: '0.8125rem' }}>Carregando anexos...</span>
          </div>
        ) : files.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '2rem',
              color: 'var(--text-muted)',
              fontSize: '0.8125rem',
              border: '1px solid var(--border)',
              borderRadius: 3,
              background: '#fafafa',
            }}
          >
            Nenhum arquivo anexado.
          </div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f5f5f5', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Nome do arquivo</th>
                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--text-secondary)', width: '100px' }}>Tamanho</th>
                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--text-secondary)', width: '160px' }}>Data de Upload</th>
                  <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--text-secondary)', width: '90px', textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr
                    key={file.id}
                    className="hover-row"
                    style={{ borderBottom: '1px solid var(--border)', background: '#fff' }}
                  >
                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <File size={16} style={{ color: 'var(--brand-700)', flexShrink: 0 }} />
                        <span style={{ wordBreak: 'break-all' }}>{file.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)' }}>
                      {formatBytes(file.metadata?.size)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)' }}>
                      {formatDate(file.created_at)}
                    </td>
                    <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleDownload(file.name)}
                          style={{
                            padding: '0.25rem',
                            height: 'auto',
                            minWidth: 'auto',
                            borderRadius: 3,
                          }}
                          title="Download"
                        >
                          <Download size={14} />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(file.name)}
                          style={{
                            padding: '0.25rem',
                            height: 'auto',
                            minWidth: 'auto',
                            borderRadius: 3,
                          }}
                          title="Excluir"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
