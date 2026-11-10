// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const imageUrl = (body.image_url || '').trim();
    if (!imageUrl) {
      return Response.json({ error: 'Please upload a photo of the outfit you want to recreate.' }, { status: 400 });
    }

    // 1. Load the user's wardrobe
    const wardrobe = await base44.entities.WardrobeItem.list('-created_date', 200);
    if (!wardrobe || wardrobe.length === 0) {
      return Response.json({ error: 'Your wardrobe is empty. Add some pieces first so I can recreate the look from your own closet.' }, { status: 400 });
    }

    const inventory = wardrobe.map(it => ({
      id: it.id,
      name: it.name,
      brand: it.brand || '',
      category: it.category,
      color: it.color || '',
      fit: it.fit || '',
      style_tags: it.style_tags || [],
    }));

    // 2. Vision LLM — analyze the styling formula AND match against wardrobe in one pass.
    //    The key instruction: don't hunt for identical items. Read the FORMULA
    //    (relaxed tailoring + clean basics + polished accessories), then find the
    //    closest equivalent in the user's closet for each role.
    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      file_urls: [imageUrl],
      prompt: `You are the stylist at Frankie. Your client has uploaded a photo of an outfit they love (from Pinterest, Instagram, a magazine, the street). They want you to RECREATE it from their own wardrobe.

Here's the important part: you are NOT trying to find identical clothes. You are reading the STYLING FORMULA — the silhouette, the mood, the role each piece plays — then translating it into what your client already owns. A real stylist doesn't need the exact jacket; they need the same relaxed structure.

STEP 1 — Read the look:
Look at the photo and break the outfit down into its component ROLES (the jobs each piece does). For example: "oversized blazer", "clean white tee", "relaxed straight-leg jeans", "pointed shoe", "structured bag". Usually 4-7 roles. Also capture the overall styling formula in a few words — e.g. "Relaxed tailoring · clean basics · polished accessories".

STEP 2 — Match to their wardrobe:
For each role, search their wardrobe for the closest equivalent. You're matching by ROLE and VIBE, not by exact item. If their blazer is a different color or cut but gives the same relaxed structure, that's a match. Note honestly how close it is.

For each role, return:
- role: the role name (e.g. "Oversized blazer", "White tee", "Straight-leg jeans")
- matched: true if you found a good equivalent in their wardrobe, false if not
- item_id: the wardrobe item id if matched (must be a real id from the inventory), null if not
- item_name: the wardrobe item name if matched, null if not
- note: a short first-person Frankie note explaining the match. If matched: why their piece gives the same effect (e.g. "You don't have the exact jacket, but your charcoal blazer gives you the same relaxed structure."). If not matched: what's missing and how much it matters.

STEP 3 — Score it:
Calculate a "how close can we get" percentage (0-100) based on how many roles you matched and how good the matches are. Be honest — 92% means almost everything, 60% means key pieces are missing.

THEIR WARDROBE:
${JSON.stringify(inventory, null, 2)}

Return JSON matching this schema. Speak as Frankie throughout — warm, witty, first-person, like a chic best friend with killer taste.`,
      response_json_schema: {
        type: 'object',
        properties: {
          the_look: { type: 'string', description: 'The styling formula in a few words, e.g. "Relaxed tailoring · clean basics · polished accessories"' },
          look_description: { type: 'string', description: '1-2 sentences in Frankie\'s voice describing the vibe of the uploaded look' },
          match_percentage: { type: 'number', description: '0-100, how close their wardrobe can get' },
          percentage_note: { type: 'string', description: 'Short Frankie note on the score, e.g. "You have almost everything."' },
          roles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string' },
                matched: { type: 'boolean' },
                item_id: { type: 'string' },
                item_name: { type: 'string' },
                note: { type: 'string' },
              },
              required: ['role', 'matched', 'note'],
            },
          },
          stylists_note: { type: 'string', description: 'A short first-person Frankie note on how to wear their version — the finishing touch that makes it theirs.' },
        },
        required: ['the_look', 'look_description', 'match_percentage', 'percentage_note', 'roles', 'stylists_note'],
      },
    });

    // 3. Hydrate matched items with images + build the pieces list for image gen
    const itemMap = new Map(wardrobe.map(it => [it.id, it]));
    const matchedPieces = [];
    const roles = (analysis.roles || []).map(r => {
      let image_url = '';
      if (r.matched && r.item_id) {
        const w = itemMap.get(r.item_id);
        if (w) {
          image_url = w.image_url || '';
          matchedPieces.push({ name: w.name, category: w.category, color: w.color || '', fit: w.fit || '' });
        }
      }
      return { ...r, image_url };
    });

    // 4. Generate "YOUR VERSION" — a model shot wearing the matched pieces.
    //    Only do this if we matched at least 2 pieces (a real outfit).
    let yourVersionUrl = '';
    if (matchedPieces.length >= 2) {
      const piecesText = matchedPieces.map(p => {
        const parts = [p.color ? `${p.color} ${p.name}` : p.name];
        if (p.category) parts.push(`(${p.category})`);
        return parts.join(' ');
      }).join(', ');

      try {
        const imgResult = await base44.asServiceRole.integrations.Core.GenerateImage({
          prompt: `Full-body editorial fashion photograph of a stylish model wearing: ${piecesText}. The overall mood is "${analysis.the_look}". Recreating a look the client loved — same styling formula, their own pieces. Golden-hour natural light, candid street-style photography, shot on 35mm film, shallow depth of field, high-fashion magazine aesthetic, natural skin, minimal styling, head to toe visible, relaxed confident pose. Absolutely no text, no words, no letters, no logos, no brand names, no watermarks, no captions, no signage of any kind anywhere in the image.`
        });
        yourVersionUrl = imgResult.url || '';
      } catch (e) {
        console.log('Your Version image generation failed:', e.message);
      }
    }

    return Response.json({
      the_look: analysis.the_look,
      look_description: analysis.look_description,
      match_percentage: analysis.match_percentage,
      percentage_note: analysis.percentage_note,
      roles,
      stylists_note: analysis.stylists_note,
      your_version_url: yourVersionUrl,
    });
  } catch (error) {
    console.error('recreateLook error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default serve('recreateLook', handler);
