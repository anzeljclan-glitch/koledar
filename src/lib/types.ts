export type Role = 'admin' | 'editor' | 'viewer';
export type RepeatFreq = 'none' | 'daily' | 'weekly' | 'monthly';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface EventRow {
  id: string;
  title: string;
  description: string;
  start_at: string; // ISO timestamptz
  end_at: string;   // ISO timestamptz
  color: string;
  repeat_freq: RepeatFreq;
  repeat_until: string | null; // YYYY-MM-DD
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  editor: 'Urejevalec',
  viewer: 'Gledalec',
};

export function canEdit(role: Role | undefined): boolean {
  return role === 'admin' || role === 'editor';
}
export function isAdmin(role: Role | undefined): boolean {
  return role === 'admin';
}
