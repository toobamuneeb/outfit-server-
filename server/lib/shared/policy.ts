// Server-side Free vs Premium rules. The web app only checks these in the browser,
// which anyone calling the functions directly could skip.
import { createClient } from '@supabase/supabase-js';
import { serviceClient } from './compat';

type Handler = (req: Request) => Promise<Response>;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PREMIUM_ONLY = new Set([
  'generateTravelCapsule',
  'recreateLook',
  'suggestDeclutter',
  'analyzeWardrobeGaps',
  'evaluatePotentialPurchase',
]);

// Free limits from the Go Premium table. "refine" isn't limited by the web app's UI
// but costs the same AI call, so it has a generous cap instead of none.
const FREE_LIMITS: Record<string, number> = { session: 1, rethink: 1, refine: 5 };

// Subscriptions aren't live yet, so every user gets every feature with no free limits.
// Set this to true when subscriptions launch, together with ALL_FEATURES_UNLOCKED in the app.
const LIMITS_ENABLED = false;

// Stops a runaway client from running up the AI bill, on any plan.
const DAILY_AI_CALLS = { free: 100, premium: 500 };

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });

function limitKind(name: string, body: any): string | null {
  if (name === 'getTodaysEdit') {
    return body?.rethink || body?.feedback || body?.different_today ? 'rethink' : 'session';
  }
  if (name === 'generateOutfit') {
    const isVariant =
      body?.rethink || body?.refine_direction || body?.mode || body?.feedback || body?.must_include_ids?.length;
    return isVariant ? 'refine' : 'session';
  }
  return null;
}

const LIMIT_MESSAGES: Record<string, string> = {
  session: "You've had your styling session for today. Come back tomorrow for another.",
  rethink: 'Your free daily edit gives you one rethink. Join HI FRANKIE for unlimited edits, every day.',
  refine: "You've reached today's free limit. Join HI FRANKIE for unlimited styling.",
};

// The user's own calendar day, so limits reset at their midnight.
function localDay(timezone?: string | null) {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone ?? 'UTC' }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function serve(name: string, handler: Handler) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const auth = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await auth.auth.getUser(token);
    if (!data.user) return json({ error: 'Unauthorized' }, 401);
    const userId = data.user.id;

    const db = serviceClient();
    const { data: isPremium, error: planError } = await db.rpc('is_premium', { p_user: userId });
    if (planError) {
      console.error(`${name} failed (plan check):`, planError.message);
      return json({ error: planError.message }, 500);
    }

    const unlocked = isPremium || !LIMITS_ENABLED;

    if (PREMIUM_ONLY.has(name) && !unlocked) {
      return json({ error: 'This is a Premium feature.', code: 'premium_required' }, 403);
    }

    const { data: profile } = await db.from('profiles').select('timezone').eq('id', userId).maybeSingle();
    const day = localDay(profile?.timezone);
    const body = await req.clone().json().catch(() => ({}));

    const consume = async (kind: string, limit: number) => {
      const { data: allowed, error } = await db.rpc('consume_usage', {
        p_user: userId,
        p_day: day,
        p_kind: kind,
        p_limit: limit,
      });
      if (error) throw new Error(error.message);
      return allowed === true;
    };

    const consumed: string[] = [];
    try {
      const callLimit = unlocked ? DAILY_AI_CALLS.premium : DAILY_AI_CALLS.free;
      if (!(await consume('ai_call', callLimit))) {
        return json({ error: "You've reached today's limit. Please try again tomorrow.", code: 'limit_reached' }, 429);
      }
      consumed.push('ai_call');

      const kind = unlocked ? null : limitKind(name, body);
      if (kind) {
        if (!(await consume(kind, FREE_LIMITS[kind]))) {
          return json({ error: LIMIT_MESSAGES[kind], code: 'limit_reached', kind }, 429);
        }
        consumed.push(kind);
      }

      const response = await handler(req);
      // Print why a request failed, so the server terminal shows more than "500".
      if (response.status >= 500) {
        const detail = await response.clone().json().catch(() => null);
        console.error(`${name} failed:`, detail?.error ?? `status ${response.status}`);
      }
      // A failed request shouldn't cost the user their daily session.
      if (response.status >= 400) {
        await Promise.all(
          consumed.map(k => db.rpc('refund_usage', { p_user: userId, p_day: day, p_kind: k })),
        );
      }
      for (const [key, value] of Object.entries(CORS_HEADERS)) response.headers.set(key, value);
      return response;
    } catch (error) {
      console.error(`${name} failed:`, (error as Error).message);
      await Promise.all(
        consumed.map(k => db.rpc('refund_usage', { p_user: userId, p_day: day, p_kind: k })),
      );
      return json({ error: (error as Error).message }, 500);
    }
  };
}
