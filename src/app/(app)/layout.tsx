import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AppProviders } from '@/components/AppProviders';
import type { Profile } from '@/lib/types';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>Ni profila</h1>
          <p className="sub">
            Tvoj račun še nima profila v tem koledarju. Obrni se na administratorja, da te doda.
          </p>
        </div>
      </div>
    );
  }

  return <AppProviders profile={profile as Profile}>{children}</AppProviders>;
}
