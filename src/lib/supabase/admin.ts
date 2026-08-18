import 'server-only';
import { createClient } from '@supabase/supabase-js';

// SAMO STREŽNIK. Uporablja service-role ključ, ki obide RLS.
// Uporablja se izključno v strežniških akcijah, kjer smo že preverili,
// da je klicatelj administrator (glej src/app/(app)/admin/actions.ts).
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
