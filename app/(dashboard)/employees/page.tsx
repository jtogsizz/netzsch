/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { Employee } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { Plus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newName, setNewName] = useState('');
  const [formError, setFormError] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/employees')
      .then((r) => r.json())
      .then((json) => setEmployees(json.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) { setFormError('Nome e obrigatorio'); return; }
    setSaving(true);
    setFormError('');
    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName }),
    });
    const json = await res.json();
    if (!res.ok) { setFormError(json.error ?? 'Erro ao salvar'); }
    else { setAddOpen(false); setNewName(''); load(); }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editTarget || !editTarget.name.trim()) return;
    setSaving(true);
    await fetch(`/api/employees/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editTarget.name, active: editTarget.active }),
    });
    setSaving(false);
    setEditTarget(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/employees/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Responsaveis</h1>
          <p className="page-subtitle">Gerencia a lista de funcionarios responsaveis pelos databooks</p>
        </div>
        <Button size="sm" onClick={() => { setNewName(''); setFormError(''); setAddOpen(true); }}>
          <Plus size={15} />
          Adicionar Responsavel
        </Button>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <h2>Lista de Responsaveis</h2>
          <span style={{ fontSize: '0.8125rem', color: '#6c757d' }}>
            {employees.length} cadastrado{employees.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <PageLoader />
        ) : employees.length === 0 ? (
          <div className="empty-state">
            <p>Nenhum responsavel cadastrado.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Status</th>
                <th>Cadastrado em</th>
                <th style={{ width: 100 }}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id}>
                  <td style={{ fontWeight: 500 }}>{emp.name}</td>
                  <td>
                    {emp.active ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#047857' }}>
                        <CheckCircle size={15} /> Ativo
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#6c757d' }}>
                        <XCircle size={15} /> Inativo
                      </span>
                    )}
                  </td>
                  <td style={{ color: '#6c757d', fontSize: '0.8125rem' }}>
                    {formatDateTime(emp.created_at)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <Button variant="ghost" size="sm" onClick={() => setEditTarget({ ...emp })}>
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(emp)}
                        style={{ color: '#dc3545' }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal adicionar */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Adicionar Responsavel"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdd} loading={saving}>Adicionar</Button>
          </>
        }
      >
        <Input
          id="new_employee_name"
          label="Nome do Responsavel"
          required
          placeholder="Nome completo"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          error={formError}
          autoFocus
        />
      </Modal>

      {/* Modal editar */}
      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Editar Responsavel"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button onClick={handleEdit} loading={saving}>Salvar</Button>
          </>
        }
      >
        {editTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input
              id="edit_employee_name"
              label="Nome"
              required
              value={editTarget.name}
              onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="checkbox"
                id="edit_employee_active"
                checked={editTarget.active}
                onChange={(e) => setEditTarget({ ...editTarget, active: e.target.checked })}
              />
              <label htmlFor="edit_employee_active" style={{ fontSize: '0.875rem', cursor: 'pointer' }}>
                Responsavel ativo (aparece no formulario de databook)
              </label>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal confirmar exclusao */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remover Responsavel"
        message={`Remover "${deleteTarget?.name}" da lista? Databooks existentes nao serao afetados.`}
        confirmLabel="Remover"
        loading={deleting}
      />
    </div>
  );
}
