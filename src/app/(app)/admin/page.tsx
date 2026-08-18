import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import AdminApp from '@/components/AdminApp';

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!profile || profile.role !== 'admin') redirect('/');

  return <AdminApp currentUserId={user.id} />;
}
