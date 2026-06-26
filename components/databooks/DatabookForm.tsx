'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Input, Textarea } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import {
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  FISCAL_YEAR_OPTIONS,
  TYPE_OPTIONS,
} from '@/lib/constants';
import type { Databook, Employee } from '@/types';

const databookSchema = z.object({
  number: z.string().min(1, 'Numero obrigatorio'),
  entry_date: z.string().optional(),
  client_name: z.string().optional(),
  technical_status: z.string().optional(),
  company_name: z.string().optional(),
  responsible_name: z.string().optional(),
  general_status: z.enum(['Novo', 'Em andamento', 'Encerrado']),
  delivery_date: z.string().optional(),
  priority: z.enum(['Alta', 'Normal', 'Baixa']),
  type: z.string().optional(),
  fiscal_year: z.string().optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof databookSchema>;

interface DatabookFormProps {
  initialData?: Databook;
  mode: 'create' | 'edit';
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function DatabookForm({ initialData, mode, onSuccess, onCancel }: DatabookFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState('');
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Carrega lista de responsáveis cadastrados
  useEffect(() => {
    fetch('/api/employees')
      .then((r) => r.json())
      .then((json) => {
        if (json.data) setEmployees(json.data.filter((e: Employee) => e.active));
      })
      .catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(databookSchema),
    defaultValues: {
      number: initialData?.number ?? '',
      entry_date: initialData?.entry_date ?? '',
      client_name: initialData?.client_name ?? '',
      technical_status: initialData?.technical_status ?? '',
      company_name: initialData?.company_name ?? '',
      responsible_name: initialData?.responsible_name ?? '',
      general_status: initialData?.general_status ?? 'Novo',
      delivery_date: initialData?.delivery_date ?? '',
      priority: initialData?.priority ?? 'Normal',
      type: initialData?.type ?? '',
      fiscal_year: initialData?.fiscal_year ?? '',
      notes: initialData?.notes ?? '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setServerError('');

    const url = mode === 'create'
      ? '/api/databooks'
      : `/api/databooks/${initialData!.id}`;

    const method = mode === 'create' ? 'POST' : 'PATCH';

    // Limpa strings vazias para null antes de enviar
    const payload = Object.fromEntries(
      Object.entries(values).map(([k, v]) => [k, v === '' ? null : v])
    );

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok) {
      setServerError(json.error ?? 'Erro ao salvar databook');
      return;
    }

    if (onSuccess) {
      onSuccess();
    } else {
      router.push('/');
    }
    router.refresh();
  };

  const employeeOptions = employees.map((e) => ({ value: e.name, label: e.name }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.25rem',
        }}
      >
        <Input
          id="number"
          label="Numero do Databook"
          required
          placeholder="Ex: DB-2026-001"
          error={errors.number?.message}
          {...register('number')}
        />

        <Input
          id="entry_date"
          label="Data de Entrada"
          type="date"
          error={errors.entry_date?.message}
          {...register('entry_date')}
        />

        <Input
          id="client_name"
          label="Cliente"
          placeholder="Nome do cliente"
          {...register('client_name')}
        />

        <Input
          id="technical_status"
          label="UF / Status Tecnico"
          placeholder="Ex: SP, MG, NSSP, COLOR..."
          hint="Campo livre — UF do estado ou codigo tecnico"
          {...register('technical_status')}
        />

        <Input
          id="company_name"
          label="Empresa / Usina"
          placeholder="Nome da empresa ou usina"
          {...register('company_name')}
        />

        {employeeOptions.length > 0 ? (
          <Select
            id="responsible_name"
            label="Responsavel"
            options={employeeOptions}
            placeholder="Selecione..."
            {...register('responsible_name')}
          />
        ) : (
          <Input
            id="responsible_name"
            label="Responsavel"
            placeholder="Nome do responsavel"
            {...register('responsible_name')}
          />
        )}

        <Select
          id="general_status"
          label="Status Geral"
          required
          options={STATUS_OPTIONS}
          error={errors.general_status?.message}
          {...register('general_status')}
        />

        <Input
          id="delivery_date"
          label="Previsao / Entrega"
          type="date"
          {...register('delivery_date')}
        />

        <Select
          id="priority"
          label="Prioridade"
          required
          options={PRIORITY_OPTIONS}
          error={errors.priority?.message}
          {...register('priority')}
        />

        <Select
          id="type"
          label="Tipo"
          options={TYPE_OPTIONS.map((t) => ({ value: t, label: t }))}
          placeholder="Selecione..."
          {...register('type')}
        />

        <Select
          id="fiscal_year"
          label="Ano Fiscal (FY)"
          options={FISCAL_YEAR_OPTIONS.map((fy) => ({ value: fy, label: fy }))}
          placeholder="Selecione..."
          {...register('fiscal_year')}
        />
      </div>

      <div style={{ marginTop: '1.25rem' }}>
        <Textarea
          id="notes"
          label="Observacoes"
          placeholder="Informacoes adicionais sobre o databook..."
          {...register('notes')}
        />
      </div>

      {serverError && (
        <div className="alert alert-error" style={{ marginTop: '1rem' }}>
          {serverError}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          marginTop: '1.75rem',
          justifyContent: 'flex-end',
        }}
      >
        <Button
          type="button"
          variant="ghost"
          onClick={onCancel ? onCancel : () => router.push('/')}
          disabled={isSubmitting}
        >
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {mode === 'create' ? 'Cadastrar Databook' : 'Salvar Alteracoes'}
        </Button>
      </div>
    </form>
  );
}
