// The only file that talks to the AI provider, so switching provider stays small.
// Models are set with secrets and can be changed without a redeploy of the prompts.
import { serviceClient } from './compat';

const INTERACTIONS_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const API_REVISION = '2026-05-20';

const textModel = () => process.env.AI_TEXT_MODEL ?? 'gemini-4-argon';
const imageModel = () => process.env.AI_IMAGE_MODEL ?? 'gemini-3.1-flash-lite-image';

const MAX_INLINE_BYTES = 15 * 1024 * 1024;

async function callGemini(body: Record<string, unknown>) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');

  const response = await fetch(INTERACTIONS_URL, {
    method: 'POST',
    headers: {
      'x-goog-api-key': key,
      'Content-Type': 'application/json',
      'Api-Revision': API_REVISION,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`AI request failed (${response.status}): ${data?.error?.message ?? 'unknown error'}`);
  }
  return data;
}

// Every output block, wherever this API revision places it.
function outputBlocks(data: any): any[] {
  const fromSteps = (data?.steps ?? [])
    .filter((step: any) => step?.type === 'model_output')
    .flatMap((step: any) => step?.content ?? []);
  return [...fromSteps, ...(data?.outputs ?? []), ...(data?.output ?? [])];
}

function outputText(data: any): string {
  if (typeof data?.output_text === 'string') return data.output_text;
  return outputBlocks(data)
    .filter(block => typeof block?.text === 'string')
    .map(block => block.text)
    .join('');
}

// file_urls come from the client, so only this project's public storage may be fetched.
async function imagePart(url: string) {
  const allowedPrefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/`;
  if (!url.startsWith(allowedPrefix)) throw new Error('Images must be uploaded to the app first');

  const response = await fetch(url);
  if (!response.ok) throw new Error('Could not read the uploaded image');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_INLINE_BYTES) throw new Error('That image is too large');

  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }
  return {
    type: 'image',
    data: btoa(binary),
    mime_type: response.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg',
  };
}

interface InvokeLLMOptions {
  prompt: string;
  response_json_schema?: Record<string, unknown>;
  file_urls?: string[];
  add_context_from_internet?: boolean;
  /** The web app's Base44 model names don't apply here; AI_TEXT_MODEL decides. */
  model?: string;
}

export async function invokeLLM({
  prompt,
  response_json_schema,
  file_urls,
  add_context_from_internet,
}: InvokeLLMOptions): Promise<any> {
  const images = await Promise.all((file_urls ?? []).map(imagePart));

  const data = await callGemini({
    model: textModel(),
    input: images.length ? [{ type: 'text', text: prompt }, ...images] : prompt,
    ...(add_context_from_internet ? { tools: [{ type: 'google_search' }] } : {}),
    ...(response_json_schema
      ? {
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: response_json_schema,
          },
        }
      : {}),
  });

  const text = outputText(data);
  if (!response_json_schema) return text;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The AI returned an unreadable answer. Please try again.');
  }
}

// Stores the image so the app gets a normal URL, like Base44's GenerateImage.
export async function generateImage({ prompt }: { prompt: string }): Promise<{ url: string }> {
  const data = await callGemini({
    model: imageModel(),
    input: [{ type: 'text', text: prompt }],
  });

  const block = [data?.output_image, ...outputBlocks(data)].find(
    item => item && typeof item.data === 'string',
  );
  if (!block) throw new Error('The AI did not return an image');

  const bytes = Uint8Array.from(atob(block.data), char => char.charCodeAt(0));
  const contentType = block.mime_type ?? 'image/png';
  const path = `generated/${crypto.randomUUID()}.${contentType.split('/')[1] ?? 'png'}`;

  const storage = serviceClient().storage.from('wardrobe');
  const { error } = await storage.upload(path, bytes, { contentType });
  if (error) throw new Error(error.message);
  return { url: storage.getPublicUrl(path).data.publicUrl };
}

const AUDIO_TYPES = new Set(['audio/mp4', 'audio/aac', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg']);
// Tried in order: the text model can be busy (503) on the free tier, so a lighter one backs it up.
const audioModels = () => [...new Set([process.env.AI_AUDIO_MODEL ?? textModel(), 'gemini-flash-lite-latest'])];

/** Speech to text for "Add by voice": works in Expo Go, which has no native speech module. */
export async function transcribeAudio({ data, mime_type }: { data: string; mime_type: string }): Promise<string> {
  if (!AUDIO_TYPES.has(mime_type)) throw new Error('Unsupported audio format');
  if ((data.length * 3) / 4 > MAX_INLINE_BYTES) throw new Error('That recording is too long');

  let lastError: unknown;
  for (const model of audioModels()) {
    try {
      const result = await callGemini({
        model,
        input: [
          {
            type: 'text',
            text:
              'Transcribe this short voice note exactly as spoken. It describes a clothing or accessory item, ' +
              'often with a fashion brand name (e.g. St Agni, Zara, COS, Arket), so spell brands the way the brand does. ' +
              'Reply with only the spoken words, no quotes and no full stop at the end. If nothing is said, reply with nothing.',
          },
          { type: 'audio', data, mime_type },
        ],
      });
      return outputText(result).trim().replace(/[.\s]+$/, '');
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
