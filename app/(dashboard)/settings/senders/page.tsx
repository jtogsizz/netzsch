/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { PageLoader } from '@/components/ui/LoadingSpinner';
import type { EmailSender } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { Plus, Pencil, Trash2, CheckCircle, XCircle, Mail, ShieldCheck } from 'lucide-react';

export default function EmailSendersPage() {
  const [senders, setSenders] = useState<EmailSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmailSender | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailSender | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/email-senders')
      .then((r) => r.json())
      .then((json) => setSenders(json.data ?? []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newEmail.trim()) { setFormError('Email é obrigatório'); return; }
    setSaving(true);
    setFormError('');
    const res = await fetch('/api/email-senders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, name: newName }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFormError(json.error ?? 'Erro ao salvar');
    } else {
      setAddOpen(false);
      setNewEmail('');
      setNewName('');
      load();
    }
    setSaving(false);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    if (!editTarget.email.trim()) { return; }
    setSaving(true);
    const res = await fetch(`/api/email-senders/${editTarget.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: editTarget.email, name: editTarget.name }),
    });
    const json = await res.json();
    if (!res.ok) {
      setFormError(json.error ?? 'Erro ao salvar');
      setSaving(false);
      return;
    }
    setSaving(false);
    setEditTarget(null);
    setFormError('');
    load();
  };

  const handleToggleActive = async (sender: EmailSender) => {
    setTogglingId(sender.id);
    await fetch(`/api/email-senders/${sender.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !sender.active }),
    });
    setTogglingId(null);
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/email-senders/${deleteTarget.id}`, { method: 'DELETE' });
    setDeleting(false);
    setDeleteTarget(null);
    load();
  };

  const activeCount = senders.filter((s) => s.active).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Remetentes Autorizados</h1>
          <p className="page-subtitle">
            Apenas emails desta lista podem criar databooks via inbound email
            &nbsp;—&nbsp;
            <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
              databook@prenaarok.resend.app
            </span>
          </p>
        </div>
        <Button
          size="sm"
          id="btn-add-sender"
          onClick={() => { setNewEmail(''); setNewName(''); setFormError(''); setAddOpen(true); }}
        >
          <Plus size={15} />
          Adicionar Remetente
        </Button>
      </div>

      {/* Painel de status do inbound */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '0.625rem 0.875rem',
          background: '#f0f9f3',
          border: '1px solid #b2f2bb',
          borderRadius: '3px',
          marginBottom: '1rem',
          fontSize: '0.8125rem',
          color: '#1a4a3a',
        }}
      >
        <ShieldCheck size={15} style={{ color: '#2b8a3e', flexShrink: 0 }} />
        <span>
          <strong>{activeCount}</strong> remetente{activeCount !== 1 ? 's' : ''} ativo{activeCount !== 1 ? 's' : ''}.&nbsp;
          Emails de remetentes não autorizados são bloqueados automaticamente e registrados nos logs.
        </span>
      </div>

      <div className="section-card">
        <div className="section-card-header">
          <h2>Lista de Remetentes</h2>
          <span style={{ fontSize: '0.8125rem', color: '#6c757d' }}>
            {senders.length} cadastrado{senders.length !== 1 ? 's' : ''}
          </span>
        </div>

        {loading ? (
          <PageLoader />
        ) : senders.length === 0 ? (
          <div className="empty-state">
            <Mail size={36} style={{ opacity: 0.3 }} />
            <p style={{ fontWeight: 500 }}>Nenhum remetente cadastrado</p>
            <p style={{ fontSize: '0.875rem' }}>
              Adicione o email dos funcionários autorizados a criar databooks por email.
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email autorizado</th>
                <th>Status</th>
                <th>Cadastrado em</th>
                <th style={{ width: 110 }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {senders.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 500 }}>{s.name || <span style={{ color: '#adb5bd' }}>—</span>}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{s.email}</td>
                  <td>
                    {s.active ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#047857' }}>
                        <CheckCircle size={14} /> Ativo
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#6c757d' }}>
                        <XCircle size={14} /> Inativo
                      </span>
                    )}
                  </td>
                  <td style={{ color: '#6c757d', fontSize: '0.8125rem' }}>
                    {formatDateTime(s.created_at)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setFormError(''); setEditTarget({ ...s }); }}
                        title="Editar"
                        aria-label={`Editar ${s.email}`}
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(s)}
                        disabled={togglingId === s.id}
                        title={s.active ? 'Desativar' : 'Ativar'}
                        aria-label={s.active ? `Desativar ${s.email}` : `Ativar ${s.email}`}
                        style={{ color: s.active ? '#b25e00' : '#047857' }}
                      >
                        {s.active ? <XCircle size={13} /> : <CheckCircle size={13} />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(s)}
                        title="Remover"
                        aria-label={`Remover ${s.email}`}
                        style={{ color: '#dc3545' }}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal — Adicionar */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Adicionar Remetente Autorizado"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button id="btn-confirm-add-sender" onClick={handleAdd} loading={saving}>Adicionar</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Input
            id="new_sender_name"
            label="Nome (opcional)"
            placeholder="Ex.: João Silva"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input
            id="new_sender_email"
            label="Email autorizado"
            required
            type="email"
            placeholder="funcionario@empresa.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            error={formError}
            autoFocus
          />
          <p style={{ fontSize: '0.8125rem', color: '#6c757d', margin: 0 }}>
            Este email poderá criar databooks encaminhando mensagens para{' '}
            <span style={{ fontFamily: 'monospace' }}>databook@prenaarok.resend.app</span>.
          </p>
        </div>
      </Modal>

      {/* Modal — Editar */}
      <Modal
        open={!!editTarget}
        onClose={() => { setEditTarget(null); setFormError(''); }}
        title="Editar Remetente"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setEditTarget(null); setFormError(''); }}>Cancelar</Button>
            <Button onClick={handleEdit} loading={saving}>Salvar</Button>
          </>
        }
      >
        {editTarget && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Input
              id="edit_sender_name"
              label="Nome"
              placeholder="Ex.: João Silva"
              value={editTarget.name ?? ''}
              onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })}
            />
            <Input
              id="edit_sender_email"
              label="Email autorizado"
              required
              type="email"
              value={editTarget.email}
              onChange={(e) => setEditTarget({ ...editTarget, email: e.target.value })}
              error={formError}
            />
          </div>
        )}
      </Modal>

      {/* Modal — Confirmar exclusão */}
      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remover Remetente"
        message={`Remover "${deleteTarget?.email}" da whitelist? Emails futuros deste endereço serão bloqueados.`}
        confirmLabel="Remover"
        loading={deleting}
      />
    </div>
  );
}
