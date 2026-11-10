import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';
import { transcribeAudio } from '../shared/ai';

// Body: { audio: base64 recording, mime_type }. Returns { text }.
const handler = async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    if (typeof body?.audio !== 'string' || body.audio.length < 100) {
      return Response.json({ error: 'A recording is required' }, { status: 400 });
    }
    const mimeType = body.mime_type || 'audio/mp4';
    // Shows up in the server terminal, to diagnose recordings that fail.
    console.log(`transcribeAudio: ${mimeType}, ${Math.round((body.audio.length * 3) / 4 / 1024)} KB`);
    const text = await transcribeAudio({ data: body.audio, mime_type: mimeType });
    return Response.json({ text });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
};

export default serve('transcribeAudio', handler);
