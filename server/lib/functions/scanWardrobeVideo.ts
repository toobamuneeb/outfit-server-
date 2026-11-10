// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';

const ALLOWED_CATEGORIES = ['tops', 'bottoms', 'dresses', 'co_ord', 'outerwear', 'shoes', 'bags', 'jewellery', 'sunglasses', 'accessories', 'swimwear', 'movement_wear'];
const CLOTHING_CATEGORIES = ['tops', 'bottoms', 'dresses', 'co_ord', 'movement_wear', 'swimwear'];
const VALID_GARMENT_TYPES = ['top', 'bottom', 'one_piece'];
const MAX_FRAMES = 20;
const MAX_ITEMS = 15;
const IMAGE_CONCURRENCY = 4;

// Run async image generation with a bounded number of in-flight calls so a
// burst of detected items can't overwhelm the integration or blow the
// function's wall-clock budget. One slow/failing image never blocks the others.
async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      try { results[idx] = await fn(items[idx], idx); }
      catch (e) { results[idx] = items[idx]; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const frameUrls = Array.isArray(body.frame_urls) ? body.frame_urls : [];
    if (frameUrls.length === 0) {
      return Response.json({ error: 'No video frames were provided' }, { status: 400 });
    }
    const frames = frameUrls
      .map((u) => (typeof u === 'string' ? u.trim() : ''))
      .filter(Boolean)
      .slice(0, MAX_FRAMES);

    if (frames.length === 0) {
      return Response.json({ error: 'No video frames were provided' }, { status: 400 });
    }

    // Vision LLM scans every sampled frame and identifies the DISTINCT clothing
    // items across the whole video (the same piece often appears in several
    // frames -- it must be listed once, not once per frame). Automatic model
    // selection supports file_urls and avoids hardcoding a model ID.
    const detectionResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      file_urls: frames,
      prompt: `You are an expert fashion stylist watching a video of someone's wardrobe. You are given ${frames.length} frames sampled from that video -- a panning shot of a clothing rack, open closet, shelves, or laid-out clothes. Treat them as one continuous view of the same wardrobe.

Identify as many DISTINCT clothing and accessory items as you can across ALL the frames combined.

For each distinct item return:
- name: A simple, generic name (e.g. "White button-up shirt", "Blue jeans", "Black blazer", "Tan tote bag"). Do NOT invent brands -- you cannot see them.
- category: Exactly one of: tops, bottoms, dresses, co_ord, outerwear, shoes, bags, jewellery, sunglasses, accessories, swimwear, movement_wear
- color: The primary color, named precisely (e.g. "White", "Navy", "Camel", "Black", "Light blue", "Olive")
- garment_type: "top", "bottom", or "one_piece" for clothing items; null for shoes, bags, jewellery, sunglasses, and accessories

Rules:
- DEDUPLICATE. The same garment appears in multiple frames as the camera moves -- list it ONCE. Only list a new item when it is genuinely a different piece.
- Only include items you can clearly see. If something is mostly hidden, folded so you can't tell what it is, or ambiguous, SKIP it -- do not guess.
- Keep names simple and generic -- "White t-shirt", not "White organic cotton crew neck tee with ribbed hem".
- Quality over quantity. It is better to miss an item than to invent one that isn't there.
- Maximum ${MAX_ITEMS} items.

Return JSON matching this schema.`,
      response_json_schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                category: { type: 'string' },
                color: { type: 'string' },
                garment_type: { type: 'string' },
              },
              required: ['name', 'category', 'color'],
            },
          },
        },
        required: ['items'],
      },
    });

    const detectedItems = (detectionResult.items || [])
      .filter((it) => it.name && it.category)
      .slice(0, MAX_ITEMS)
      .map((it) => {
        const category = ALLOWED_CATEGORIES.includes(it.category) ? it.category : 'accessories';
        const garment_type =
          CLOTHING_CATEGORIES.includes(category) && VALID_GARMENT_TYPES.includes(it.garment_type)
            ? it.garment_type
            : undefined;
        return {
          name: String(it.name).trim(),
          category,
          color: String(it.color || '').trim(),
          garment_type,
          image_url: '',
        };
      });

    if (detectedItems.length === 0) {
      return Response.json({
        error: "I couldn't identify any items in that video. Try a slower, steadier pan with better light, or film individual pieces.",
      }, { status: 400 });
    }

    // Generate a clean product image for each detected item with bounded
    // concurrency so the request stays fast and reliable even when many
    // pieces are detected. A failed generation leaves the item imageless
    // rather than failing the whole upload.
    const itemsWithImages = await mapWithConcurrency(detectedItems, IMAGE_CONCURRENCY, async (item) => {
      try {
        const imgResult = await base44.asServiceRole.integrations.Core.GenerateImage({
          prompt: `A clean e-commerce catalog product photograph of a ${item.color} ${item.name} on a plain pure white background, centered, evenly lit, no model, no mannequin, no props, flat lay style, high quality fashion product photography, simple and minimal`,
        });
        return { ...item, image_url: imgResult.url || '' };
      } catch (e) {
        console.error('scanWardrobeVideo: image gen failed for', item.name, e?.message);
        return { ...item, image_url: '' };
      }
    });

    return Response.json({ items: itemsWithImages, frames_used: frames.length });
  } catch (error) {
    console.error('scanWardrobeVideo error:', error?.message);
    return Response.json({ error: error.message || 'Something went wrong scanning your video' }, { status: 500 });
  }
}

export default serve('scanWardrobeVideo', handler);
