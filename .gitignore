'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Role } from '@/lib/types';

export type ActionResult<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

// Preveri, da je klicatelj prijavljen ADMIN (dvojna zaščita poleg RLS).
async function requireAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Neavtenticiran dostop.');
  const { data: me } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!me || me.role !== 'admin') throw new Error('Za to dejanje moraš biti administrator.');
  return user;
}

function genPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = new Uint32Array(12);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 12; i++) out += chars[bytes[i] % chars.length];
  return out;
}

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Geslo mora imeti vsaj 8 znakov.';
  return null;
}

export async function createUser(input: {
  email: string;
  fullName: string;
  role: Role;
  password?: string;
}): Promise<ActionResult<{ tempPassword: string }>> {
  try {
    await requireAdmin();
    const email = input.email.trim().toLowerCase();
    const fullName = input.fullName.trim();
    if (!fullName) return { ok: false, error: 'Vnesi ime in priimek.' };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return { ok: false, error: 'Neveljaven e-poštni naslov.' };

    const customPassword = input.password?.trim();
    if (customPassword) {
      const pwErr = validatePassword(customPassword);
      if (pwErr) return { ok: false, error: pwErr };
    }

    const admin = createAdminClient();
    const tempPassword = customPassword || genPassword();
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !created?.user) {
      return { ok: false, error: error?.message || 'Napaka pri ustvarjanju uporabnika.' };
    }
    const { error: pErr } = await admin.from('profiles').insert({
      id: created.user.id,
      email,
      full_name: fullName,
      role: input.role,
    });
    if (pErr) {
      // povrni: če profil ni uspel, izbriši tudi auth uporabnika
      await admin.auth.admin.deleteUser(created.user.id);
      return { ok: false, error: pErr.message };
    }
    return { ok: true, tempPassword };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Napaka.' };
  }
}

export async function updateUserRole(id: string, role: Role): Promise<ActionResult> {
  try {
    await requireAdmin();
    const admin = createAdminClient();
    const { error } = await admin.from('profiles').update({ role }).eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Napaka.' };
  }
}

export async function setUserPassword(id: string, password: string): Promise<ActionResult> {
  try {
    await requireAdmin();
    const pwErr = validatePassword(password);
    if (pwErr) return { ok: false, error: pwErr };
    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Napaka.' };
  }
}

export async function deleteUser(id: string): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    if (me.id === id) return { ok: false, error: 'Samega sebe ne moreš odstraniti.' };
    const admin = createAdminClient();
    // brisanje auth uporabnika; profil se pobriše samodejno (ON DELETE CASCADE)
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Napaka.' };
  }
}
