import { createClient } from '@supabase/supabase-js';
import { serviceClient } from '../shared/compat';

// Deleting the auth user cascades to every table through its foreign key.
export default async function handler(req: Request): Promise<Response> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const auth = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { data } = await auth.auth.getUser(token);
  if (!data.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { error } = await serviceClient().auth.admin.deleteUser(data.user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ status: 'deleted', user_id: data.user.id });
}
