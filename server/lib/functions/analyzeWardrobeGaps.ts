// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';
import { inferGarmentType, buildInventory } from '../shared/outfitUtils';

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const items = await base44.entities.WardrobeItem.list('-updated_date', 200);
    if (!items || items.length === 0) {
      return Response.json({ error: 'Your wardrobe is empty. Add some items first!' }, { status: 400 });
    }

    // Wear history — which items have been worn (is_the_one or saved outfits)
    const outfits = await base44.entities.Outfit.list('-created_date', 100);
    const wornItemIds = new Set();
    const categoryUsage = {};
    outfits.forEach(o => {
      if (o.is_the_one || o.saved) {
        (o.items || []).forEach(it => {
          wornItemIds.add(it.item_id);
          categoryUsage[it.category] = (categoryUsage[it.category] || 0) + 1;
        });
      }
    });

    // Category distribution
    const categoryCounts = {};
    items.forEach(it => {
      categoryCounts[it.category] = (categoryCounts[it.category] || 0) + 1;
    });

    const inventory = buildInventory(items, wornItemIds);

    // Build profile context
    const profileParts = [];
    if (user.style_vibe && user.style_vibe.length > 0) profileParts.push(`Preferred style: ${user.style_vibe.join(', ')}`);
    if (user.typical_day) profileParts.push(`Typical day: ${user.typical_day}`);
    if (user.color_season && user.color_season !== 'unsure') profileParts.push(`Colour palette: ${user.color_season}`);
    if (user.fit_preference && user.fit_preference !== 'mixed') profileParts.push(`Preferred fit: ${user.fit_preference}`);
    if (user.body_shape && user.body_shape !== 'prefer_not_to_say') profileParts.push(`Body shape: ${user.body_shape}`);
    const profileBlock = profileParts.length > 0
      ? `\nThe wearer's lifestyle & style profile:\n${profileParts.join('\n')}\n`
      : '';

    // Wear history block
    const wearEntries = Object.entries(categoryUsage);
    const wearBlock = wearEntries.length > 0
      ? `\nWear history — how often each category appears in saved/worn outfits:\n${wearEntries.map(([cat, count]) => `- ${cat}: ${count} times`).join('\n')}\n`
      : '\nNo outfits have been saved or worn yet — base the analysis on the inventory alone.\n';

    // Category distribution
    const distBlock = `\nWardrobe category distribution:\n${Object.entries(categoryCounts).map(([cat, count]) => `- ${cat}: ${count} items`).join('\n')}\n`;

    // Unworn items — pieces in the wardrobe that haven't appeared in any outfit
    const unworn = items.filter(it => !wornItemIds.has(it.id));
    const unwornBlock = unworn.length > 0
      ? `\nUnworn pieces (${unworn.length} items never used in a saved outfit — these may be underutilised or redundant):\n${unworn.slice(0, 20).map(it => `- ${it.name} (${it.category})${it.color ? ', ' + it.color : ''}`).join('\n')}\n`
      : '';

    const llmPrompt = `You are the stylist at Frankie. You're analysing a client's wardrobe to identify genuine gaps — pieces that are missing and would make their existing wardrobe work harder.

Your philosophy: Buy less. Buy better. Wear more. You are NOT trying to make them shop. You're trying to help them see what's genuinely missing vs what they already have enough of. Sometimes the most useful thing is telling them they don't need anything.

${profileBlock}${distBlock}${wearBlock}${unwornBlock}
The full wardrobe inventory (worn_recently: true means it's been used in a saved/worn outfit):
${JSON.stringify(inventory, null, 2)}

Analyse this wardrobe and identify 3-5 genuine gaps. For each gap:
1. Consider what they OWN (category distribution), what they WEAR (wear history), their LIFESTYLE (typical day), their STYLE (preferred vibes/colours), and the OCCASIONS they dress for.
2. Identify pieces that would repeatedly unlock new outfit combinations — not duplicates of what they already have.
3. Be honest: if they already have enough of a category, don't recommend more of it. If a category is thin or missing entirely, flag it.
4. Estimate how many NEW outfits this piece could unlock (outfit_impact) — be realistic, not generous.
5. Set priority: "high" (genuinely limiting their wardrobe right now), "medium" (would meaningfully help), "nice_to_have" (could be fun but not essential).
6. Each gap should be a TYPE of piece (e.g. "A versatile neutral blazer", "Comfortable black flats"), not a specific brand or product.

Also write a summary (2-3 sentences) in your voice — warm, honest, first person, about the overall state of their wardrobe and what would help most. Reference specific observations (e.g. "You've got 12 tops but only 2 pairs of shoes…").

Return JSON matching this schema.`;

    const jsonSchema = {
      type: "object",
      properties: {
        summary: { type: "string" },
        gaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              category: { type: "string" },
              reasoning: { type: "string" },
              outfit_impact: { type: "number" },
              priority: { type: "string" }
            },
            required: ["name", "category", "reasoning", "outfit_impact", "priority"]
          }
        }
      },
      required: ["summary", "gaps"]
    };

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: llmPrompt,
      response_json_schema: jsonSchema
    });

    // Cache the result — delete any existing analysis, create a new one
    const existing = await base44.entities.WardrobeGap.list('-created_date', 1);
    for (const rec of existing) {
      await base44.entities.WardrobeGap.delete(rec.id);
    }
    await base44.entities.WardrobeGap.create({
      summary: result.summary,
      gaps: result.gaps || []
    });

    return Response.json({ summary: result.summary, gaps: result.gaps || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default serve('analyzeWardrobeGaps', handler);
