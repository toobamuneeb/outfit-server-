// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch outfits the user actually wore and loved
    const outfits = await base44.entities.Outfit.filter({ is_the_one: true }, '-created_date', 100);
    if (!outfits || outfits.length < 3) {
      return Response.json({ needs_more: true, count: outfits?.length || 0 });
    }

    // Build context from the worn outfits
    const outfitSummaries = outfits.map((o, idx) => {
      const items = (o.items || []).map((it) => `${it.name} (${it.category})`).join(', ');
      return `Look ${idx + 1}: "${o.title}" — ${o.occasion || 'no occasion'}${o.style_category ? ` [${o.style_category}]` : ''}. Pieces: ${items}.`;
    }).join('\n');

    const llmPrompt = `You are the stylist at Frankie. Your client has been wearing the outfits you styled for them, and they've marked these specific looks as "the one" — the outfits they actually wore and loved. Your job is to read between the lines and tell them what their choices reveal about their personal style DNA.

Here are the outfits they actually wore:
${outfitSummaries}

Analyze these choices and identify the patterns. What do they gravitate toward? Return a style DNA profile:

1. style_types: 1-3 style archetypes that capture their aesthetic (e.g. "Minimalist", "Feminine", "Sporty", "Classic", "Boho", "Edgy", "Preppy", "Romantic", "Elevated Casual"). Pick from common fashion vocabulary.
2. colors: their go-to colour palette — the 3-5 colours that show up most across their worn looks.
3. go_to_moods: the vibes/feelings they dress for most (e.g. "effortless", "put-together", "relaxed", "bold").
4. go_to_activities: the occasions/activities they dress for most (e.g. "work", "school drop-off", "brunch", "date night").
5. summary: a 2-3 sentence style reading in Frankie's warm, witty voice — like a stylist friend telling them what they've noticed about their taste. Make it feel personal and insightful, not generic. Reference specific pieces or patterns from their choices.

Return JSON matching this schema:
{
  "style_types": ["string"],
  "colors": ["string"],
  "go_to_moods": ["string"],
  "go_to_activities": ["string"],
  "summary": "string"
}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: llmPrompt,
      response_json_schema: {
        type: "object",
        properties: {
          style_types: { type: "array", items: { type: "string" } },
          colors: { type: "array", items: { type: "string" } },
          go_to_moods: { type: "array", items: { type: "string" } },
          go_to_activities: { type: "array", items: { type: "string" } },
          summary: { type: "string" }
        },
        required: ["style_types", "colors", "go_to_moods", "go_to_activities", "summary"]
      }
    });

    return Response.json({ ...result, outfit_count: outfits.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default serve('analyzeStyleDNA', handler);
