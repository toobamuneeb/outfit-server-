import handler from '@/lib/functions/searchWardrobeItem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Raise this if your Vercel plan allows longer requests (AI image and video work can be slow).
export const maxDuration = 60;

export const POST = (req: Request) => handler(req);
