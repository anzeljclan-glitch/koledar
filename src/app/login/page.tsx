'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErr('Napačna e-pošta ali geslo.');
      setBusy(false);
      return;
    }
    router.push('/');
    router.refresh();
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={onSubmit}>
        <h1>
          <span className="logo" style={{ width: 34, height: 34 }}>
            📅
          </span>{' '}
          Skupni koledar
        </h1>
        <p className="sub">Prijavi se za dostop do koledarja.</p>
        {err && <div className="form-err">{err}</div>}
        <div className="field">
          <label>E-pošta</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ime@primer.com"
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label>Geslo</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>
        <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={busy}>
          {busy ? 'Prijavljanje…' : 'Prijava'}
        </button>
        <p className="sub" style={{ marginTop: 16, marginBottom: 0, fontSize: 12 }}>
          Nimaš računa? Nove uporabnike dodaja samo administrator.
        </p>
      </form>
    </div>
  );
}
