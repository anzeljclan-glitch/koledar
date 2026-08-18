'use client';

import { createContext, useContext } from 'react';
import type { Profile } from '@/lib/types';

const ProfileContext = createContext<Profile | null>(null);

export function AppProviders({
  profile,
  children,
}: {
  profile: Profile;
  children: React.ReactNode;
}) {
  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}

export function useProfile(): Profile {
  const p = useContext(ProfileContext);
  if (!p) throw new Error('useProfile mora biti znotraj <AppProviders>');
  return p;
}
