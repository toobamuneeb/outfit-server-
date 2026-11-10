// Keeps the Base44 function files (and their prompts) unchanged by giving them the
// same client shape, backed by Supabase and the AI provider in ./ai.ts.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import nodemailer, { type Transporter } from 'nodemailer';
import { generateImage, invokeLLM } from './ai';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TABLES: Record<string, string> = {
  WardrobeItem: 'wardrobe_items',
  Outfit: 'outfits',
  ScheduledOutfit: 'scheduled_outfits',
  WardrobeGap: 'wardrobe_gaps',
  Subscription: 'subscriptions',
  User: 'profiles',
};

const COLUMN_ALIASES: Record<string, string> = {
  created_date: 'created_at',
  updated_date: 'updated_at',
  created_by_id: 'user_id',
};

const column = (name: string) => COLUMN_ALIASES[name] ?? name;

// Base44 rows expose created_date; the functions read it (e.g. declutter age).
const toRow = (row: any) =>
  row ? { ...row, created_date: row.created_at, updated_date: row.updated_at } : row;

function entity(db: SupabaseClient, name: string) {
  const table = TABLES[name];

  const select = (query: Record<string, unknown>, sort?: string, limit?: number) => {
    let request = db.from(table).select('*');
    for (const [key, value] of Object.entries(query)) request = request.eq(column(key), value);
    if (sort) {
      const descending = sort.startsWith('-');
      request = request.order(column(sort.replace(/^-/, '')), { ascending: !descending });
    }
    return limit ? request.limit(limit) : request;
  };

  const rows = async (request: PromiseLike<{ data: any; error: any }>) => {
    const { data, error } = await request;
    if (error) throw new Error(error.message);
    return (data ?? []).map(toRow);
  };

  return {
    list: (sort?: string, limit?: number) => rows(select({}, sort, limit)),
    filter: (query: Record<string, unknown>, sort?: string, limit?: number) =>
      rows(select(query, sort, limit)),
    create: async (values: Record<string, unknown>) => {
      const { data, error } = await db.from(table).insert(values).select().single();
      if (error) throw new Error(error.message);
      return toRow(data);
    },
    update: async (id: string, values: Record<string, unknown>) => {
      const { data, error } = await db.from(table).update(values).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return toRow(data);
    },
    delete: async (id: string) => {
      const { error } = await db.from(table).delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
  };
}

function entities(db: SupabaseClient) {
  return Object.fromEntries(Object.keys(TABLES).map(name => [name, entity(db, name)])) as Record<
    string,
    ReturnType<typeof entity>
  >;
}

export const serviceClient = () =>
  createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// Sends through SMTP (Gmail by default). For Gmail, SMTP_PASS is an app password,
// and EMAIL_FROM must be that Gmail address or one of its verified aliases.
let transporter: Transporter | null = null;

async function sendEmail({ to, subject, body, from_name }: Record<string, string>) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) throw new Error('SMTP_USER and SMTP_PASS must be set to send email');
  const port = Number(process.env.SMTP_PORT || 465);
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  const from = process.env.EMAIL_FROM || user;
  await transporter.sendMail({
    from: from_name ? { name: from_name, address: from } : from,
    to,
    subject,
    html: body,
  });
}

export function createClientFromRequest(req: Request) {
  const authorization = req.headers.get('Authorization') ?? '';
  const userDb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const service = serviceClient();

  return {
    auth: {
      // Null when the caller isn't signed in; functions answer 401 themselves.
      me: async () => {
        const token = authorization.replace(/^Bearer\s+/i, '');
        if (!token) return null;
        const { data } = await userDb.auth.getUser(token);
        if (!data.user) return null;
        const { data: profile } = await userDb
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();
        return { ...profile, id: data.user.id, email: data.user.email, role: 'user' };
      },
    },
    entities: entities(userDb),
    asServiceRole: {
      entities: entities(service),
      integrations: {
        Core: {
          InvokeLLM: invokeLLM,
          GenerateImage: generateImage,
          SendEmail: sendEmail,
        },
      },
      connectors: {
        // Google Calendar needs its own OAuth setup. Until then the functions fall
        // back to the Apple calendar link and the user's weekly rhythm.
        getCurrentAppUserConnection: () => {
          throw new Error('Google Calendar is not connected');
        },
      },
    },
  };
}
