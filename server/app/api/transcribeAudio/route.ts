import handler from '@/lib/functions/transcribeAudio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const POST = (req: Request) => handler(req);
