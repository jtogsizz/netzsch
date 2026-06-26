'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const supabase = createClient();

    // A validação real acontece no servidor Supabase — a senha nunca é comparada no frontend
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      // Mensagem genérica para não revelar se o email existe ou não
      setError('Credenciais inválidas. Verifique o e-mail e a senha.');
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-brand">NETZSCH</div>
          <div className="login-subtitle">Sistema Interno de Databooks</div>
        </div>

        <form onSubmit={handleLogin} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Input
              id="email"
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sistema@netzsch.internal"
              autoComplete="email"
              required
            />

            <Input
              id="password"
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />

            {error && (
              <div className="alert alert-error" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {error}
              </div>
            )}

            <Button
              type="submit"
              loading={loading}
              style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
            >
              Entrar
            </Button>
          </div>
        </form>

        <p
          style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            fontSize: '0.75rem',
            color: '#adb5bd',
          }}
        >
          Acesso restrito a funcionarios NETZSCH
        </p>
      </div>
    </div>
  );
}
