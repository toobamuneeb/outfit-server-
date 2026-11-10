// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';

const ALLOWED_CATEGORIES = ['tops', 'bottoms', 'dresses', 'co_ord', 'outerwear', 'shoes', 'bags', 'jewellery', 'sunglasses', 'accessories', 'swimwear', 'movement_wear'];
const CLOTHING_CATEGORIES = ['tops', 'bottoms', 'dresses', 'co_ord', 'movement_wear', 'swimwear'];
const VALID_GARMENT_TYPES = ['top', 'bottom', 'one_piece'];
const MAX_ITEMS = 12;

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const imageUrl = body.image_url;
    if (!imageUrl || !imageUrl.trim()) {
      return Response.json({ error: 'An image URL is required' }, { status: 400 });
    }

    // Step 1: Vision LLM detects all clothing items in the photo
    const detectionResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      file_urls: [imageUrl],
      prompt: `You are an expert fashion stylist looking at a photo of someone's wardrobe — a clothing rack, shelf, flat-lay, open closet, or laid-out clothes. Your job is to identify as many individual clothing and accessory items as possible.

For each item you can see, return:
- name: A simple, generic name (e.g. "White button-up shirt", "Blue jeans", "Black blazer", "Tan tote bag"). Do NOT include brands — you cannot see them.
- category: Exactly one of: tops, bottoms, dresses, co_ord, outerwear, shoes, bags, jewellery, sunglasses, accessories, swimwear, movement_wear
- color: The primary color, named precisely (e.g. "White", "Navy", "Camel", "Black", "Light blue", "Olive")
- garment_type: "top", "bottom", or "one_piece" for clothing items; null for shoes, bags, jewellery, sunglasses, and accessories

Rules:
- Identify each DISTINCT item separately. If there is a white shirt and a blue shirt, list both.
- Only include items you can clearly see. If something is mostly hidden, folded so you can't tell what it is, or ambiguous, SKIP it — do not guess.
- Keep names simple and generic — "White t-shirt", not "White organic cotton crew neck tee with ribbed hem".
- Aim for thoroughness but accuracy — quality over quantity. It is better to miss an item than to invent one that isn't there.
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
                garment_type: { type: 'string' }
              },
              required: ['name', 'category', 'color']
            }
          }
        },
        required: ['items']
      }
    });

    // Sanitize and cap the detected items
    const detectedItems = (detectionResult.items || [])
      .filter(it => it.name && it.category)
      .slice(0, MAX_ITEMS)
      .map(it => {
        const category = ALLOWED_CATEGORIES.includes(it.category) ? it.category : 'accessories';
        const garment_type = CLOTHING_CATEGORIES.includes(category) && VALID_GARMENT_TYPES.includes(it.garment_type)
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
      return Response.json({ error: 'I couldn\'t identify any items in that photo. Try a clearer photo with your clothes laid out or hanging on a rack.' }, { status: 400 });
    }

    // Step 2: Generate a clean product image for each detected item (in parallel)
    const itemsWithImages = await Promise.all(
      detectedItems.map(async (item) => {
        try {
          const imgResult = await base44.asServiceRole.integrations.Core.GenerateImage({
            prompt: `A clean e-commerce catalog product photograph of a ${item.color} ${item.name} on a plain pure white background, centered, evenly lit, no model, no mannequin, no props, flat lay style, high quality fashion product photography, simple and minimal`
          });
          return { ...item, image_url: imgResult.url || '' };
        } catch (e) {
          return { ...item, image_url: '' };
        }
      })
    );

    return Response.json({ items: itemsWithImages });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default serve('scanWardrobePhoto', handler);
