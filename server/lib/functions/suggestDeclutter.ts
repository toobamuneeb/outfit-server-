// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const items = await base44.entities.WardrobeItem.list('-created_date', 200);
    if (!items || items.length === 0) {
      return Response.json({ error: 'Your wardrobe is empty — add some pieces first!' }, { status: 400 });
    }

    // Count how many times each item has been styled across all generated looks.
    const outfits = await base44.entities.Outfit.list('-created_date', 200);
    const wearCount = new Map();
    for (const o of outfits || []) {
      for (const it of (o.items || [])) {
        if (it.item_id) wearCount.set(it.item_id, (wearCount.get(it.item_id) || 0) + 1);
      }
    }

    const now = Date.now();
    const enriched = items.map((it) => ({
      id: it.id,
      name: it.name,
      brand: it.brand || '',
      category: it.category,
      color: it.color || '',
      fit: it.fit || '',
      style_tags: it.style_tags || [],
      season: it.season || 'all',
      image_url: it.image_url || '',
      wear_count: wearCount.get(it.id) || 0,
      age_days: it.created_date ? Math.floor((now - new Date(it.created_date).getTime()) / 86400000) : 0
    }));

    // Under-loved candidates: rarely or never styled.
    const candidates = enriched
      .filter((it) => it.wear_count <= 1)
      .sort((a, b) => a.wear_count - b.wear_count || b.age_days - a.age_days)
      .slice(0, 12);

    if (candidates.length === 0) {
      return Response.json({
        suggestions: [],
        message: "Every piece in your closet has been loved recently — nothing to edit right now."
      });
    }

    const llmPrompt = `You are the stylist at Frankie. You're warm, witty, a little cheeky, and genuinely invested in helping your client build a closet they actually wear. You speak like a chic, supportive best friend — never robotic, never preachy, never judgmental.

Here are the under-loved pieces in their closet — items that have rarely or never been styled:

${JSON.stringify(candidates, null, 2)}

For each piece, choose ONE recommendation:
- "remix" — it still has potential. Give a concrete, specific idea for how to wear it next (a real styling move, not "try pairing it with something").
- "keep" — it's versatile, sentimental, or seasonal and just needs a nudge — not the chopping block.
- "let_go" — it's genuinely gathering dust and it's time to part ways gracefully.

Rules:
- NEVER call a piece "out of trend", "unfashionable", "dated", or "old". The edit is about UNDERUSE and remix potential, never about trends or taste.
- Be kind and specific. Hype them up. First person, Frankie's voice ("honestly…", "I reckon…", "let's give this one another spin").
- 1-2 sentences per note. Warm, real, a touch of wit.
- The remix_idea is only required for "remix"; for "keep" and "let_go" return an empty string.

Return JSON matching this schema, one entry per candidate:
{
  "suggestions": [
    { "item_id": "string", "recommendation": "remix"|"keep"|"let_go", "note": "string", "remix_idea": "string" }
  ]
}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: llmPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          suggestions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                item_id: { type: "string" },
                recommendation: { type: "string", enum: ["remix", "keep", "let_go"] },
                note: { type: "string" },
                remix_idea: { type: "string" }
              },
              required: ["item_id", "recommendation", "note", "remix_idea"]
            }
          }
        },
        required: ["suggestions"]
      }
    });

    const itemMap = new Map(items.map((it) => [it.id, it]));
    const suggestions = (result.suggestions || [])
      .map((s) => {
        const it = itemMap.get(s.item_id);
        if (!it) return null;
        return {
          item_id: it.id,
          name: it.name,
          brand: it.brand || '',
          category: it.category,
          color: it.color || '',
          image_url: it.image_url || '',
          wear_count: wearCount.get(it.id) || 0,
          age_days: it.created_date ? Math.floor((now - new Date(it.created_date).getTime()) / 86400000) : 0,
          recommendation: s.recommendation,
          note: s.note,
          remix_idea: s.remix_idea || ''
        };
      })
      .filter(Boolean);

    return Response.json({ suggestions });
  } catch (error) {
    console.error('suggestDeclutter error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default serve('suggestDeclutter', handler);
