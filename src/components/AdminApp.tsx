'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { type Profile, type Role, ROLE_LABEL } from '@/lib/types';
import { avColor, initials } from '@/lib/ui';
import { createUser, updateUserRole, deleteUser } from '@/app/(app)/admin/actions';

export default function AdminApp({ currentUserId }: { currentUserId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [users, setUsers] = useState<Profile[]>([]);
  const [adding, setAdding] = useState(false);
  const [tempPass, setTempPass] = useState<{ email: string; pass: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = useCallback((m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    if (data) setUsers(data as Profile[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeRole(id: string, role: Role) {
    const res = await updateUserRole(id, role);
    if (!res.ok) return flash(res.error);
    flash('Vloga posodobljena');
    load();
  }

  async function remove(u: Profile) {
    const res = await deleteUser(u.id);
    if (!res.ok) return flash(res.error);
    flash('Uporabnik odstranjen');
    load();
  }

  return (
    <div className="admin-wrap">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <Link href="/" className="btn-ghost">
          ‹ Koledar
        </Link>
        <div style={{ flex: 1 }} />
        <button className="btn-primary" onClick={() => setAdding(true)}>
          ＋ Dodaj uporabnika
        </button>
      </div>
      <h1>Uporabniki</h1>
      <p className="sub">
        Nove uporabnike dodajaš tukaj — javne registracije ni. Vsakemu dodeliš vlogo: administrator
        (vse + upravljanje uporabnikov), urejevalec (ureja koledar) ali gledalec (samo ogled).
      </p>

      {tempPass && (
        <div className="temp-pass">
          Uporabnik <b>{tempPass.email}</b> je ustvarjen. Začasno geslo:{' '}
          <code>{tempPass.pass}</code>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            Posreduj mu geslo — priporočljivo je, da ga ob prvi prijavi zamenja.
          </div>
        </div>
      )}

      <table className="table" style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Uporabnik</th>
            <th>E-pošta</th>
            <th>Vloga</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <span
                    className="avatar"
                    style={{ width: 28, height: 28, fontSize: 12, background: avColor(u.email) }}
                  >
                    {initials(u.full_name || u.email)}
                  </span>
                  <b style={{ fontSize: 14 }}>
                    {u.full_name || '—'}
                    {u.id === currentUserId ? ' (jaz)' : ''}
                  </b>
                </div>
              </td>
              <td style={{ color: 'var(--muted)' }}>{u.email}</td>
              <td>
                {u.id === currentUserId ? (
                  <span className={`role-chip role-${u.role}`}>{ROLE_LABEL[u.role]}</span>
                ) : (
                  <select
                    value={u.role}
                    onChange={(e) => changeRole(u.id, e.target.value as Role)}
                  >
                    <option value="admin">Administrator</option>
                    <option value="editor">Urejevalec</option>
                    <option value="viewer">Gledalec</option>
                  </select>
                )}
              </td>
              <td style={{ textAlign: 'right' }}>
                {u.id !== currentUserId && (
                  <button
                    className="btn-ghost"
                    style={{ color: 'var(--danger)', borderColor: '#f2c8c5' }}
                    onClick={() => remove(u)}
                  >
                    Odstrani
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {adding && (
        <AddUserModal
          onClose={() => setAdding(false)}
          onCreated={(email, pass) => {
            setAdding(false);
            setTempPass({ email, pass });
            load();
          }}
          onError={flash}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function AddUserModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: (email: string, pass: string) => void;
  onError: (msg: string) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!fullName.trim() || !email.trim()) return onError('Izpolni ime in e-pošto.');
    setBusy(true);
    const res = await createUser({ fullName, email, role });
    setBusy(false);
    if (!res.ok) return onError(res.error);
    onCreated(email.trim().toLowerCase(), res.tempPassword);
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Dodaj uporabnika</h2>
        <div className="field">
          <label>Ime in priimek</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="npr. Janez Kranjski"
            autoFocus
          />
        </div>
        <div className="field">
          <label>E-poštni naslov (katerakoli domena)</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ime@primer.com"
          />
        </div>
        <div className="field">
          <label>Vloga</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="admin">Administrator — vse pravice + upravljanje uporabnikov</option>
            <option value="editor">Urejevalec — lahko ureja koledar</option>
            <option value="viewer">Gledalec — samo ogled</option>
          </select>
        </div>
        <div className="modal-actions">
          <div />
          <div className="right">
            <button className="btn-ghost" onClick={onClose}>
              Prekliči
            </button>
            <button className="btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Ustvarjam…' : 'Ustvari'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
