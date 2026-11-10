// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';
import { inferGarmentType, hydrateOutfitItems, buildInventory } from '../shared/outfitUtils';

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const itemName = (body.name || '').trim();
    const itemCategory = (body.category || '').trim();
    const itemColor = (body.color || '').trim();
    const itemBrand = (body.brand || '').trim();

    if (!itemName) {
      return Response.json({ error: 'Describe the item you are considering' }, { status: 400 });
    }

    // Build the proposed item as a virtual wardrobe entry
    const proposedItem = {
      id: 'PROPOSED_ITEM',
      name: itemName,
      category: itemCategory || 'accessories',
      color: itemColor,
      brand: itemBrand,
    };
    proposedItem.garment_type = inferGarmentType(proposedItem) ||
      (itemCategory === 'tops' ? 'top' : itemCategory === 'bottoms' ? 'bottom' : itemCategory === 'dresses' || itemCategory === 'co_ord' ? 'one_piece' : null);

    const items = await base44.entities.WardrobeItem.list('-updated_date', 200);
    if (!items || items.length === 0) {
      return Response.json({ error: 'Your wardrobe is empty. Add some items first!' }, { status: 400 });
    }

    // Build inventory including the proposed item
    const realInventory = buildInventory(items);
    const proposedEntry = {
      id: 'PROPOSED_ITEM',
      name: proposedItem.name,
      brand: proposedItem.brand || '',
      category: proposedItem.category,
      garment_type: proposedItem.garment_type,
      color: proposedItem.color || '',
      fit: '',
      style_tags: [],
      season: 'all',
      is_proposed: true,
    };
    const fullInventory = [...realInventory, proposedEntry];

    // Item map for hydration (proposed item + real items)
    const itemMap = new Map(items.map(it => [it.id, it]));
    itemMap.set('PROPOSED_ITEM', { ...proposedItem, id: 'PROPOSED_ITEM' });

    // Profile context
    const profileParts = [];
    if (user.style_vibe && user.style_vibe.length > 0) profileParts.push(`Style: ${user.style_vibe.join(', ')}`);
    if (user.color_season && user.color_season !== 'unsure') profileParts.push(`Colour palette: ${user.color_season}`);
    if (user.fit_preference && user.fit_preference !== 'mixed') profileParts.push(`Fit: ${user.fit_preference}`);
    if (user.typical_day) profileParts.push(`Typical day: ${user.typical_day}`);
    const profileBlock = profileParts.length > 0
      ? `\nStyle profile:\n${profileParts.join('\n')}\n`
      : '';

    const llmPrompt = `You are the stylist at Frankie. Your client is considering buying a new piece and wants your honest opinion BEFORE they spend money.

Your philosophy: Buy less. Buy better. Wear more. You are NOT a shopping enabler — you're a trusted advisor. Sometimes the best advice is "don't buy it." You build trust by being honest, not by encouraging spending.

The proposed purchase:
- Name: ${proposedItem.name}
- Category: ${proposedItem.category}
- Colour: ${proposedItem.color || 'unspecified'}
- Brand: ${proposedItem.brand || 'unspecified'}

${profileBlock}
Their existing wardrobe (the proposed item is marked is_proposed: true at the end of the list):
${JSON.stringify(fullInventory, null, 2)}

Do two things:

1. EVALUATE the purchase honestly:
   - wardrobe_value (0-10): how much value it adds to THIS specific wardrobe. A 9+ means it fills a genuine gap and works with many pieces. Below 5 means it's redundant or niche.
   - versatility_count: how many existing pieces it could realistically pair with (count them from the inventory).
   - wear_potential: list the occasions/settings it suits (e.g. "work", "weekends", "evenings", "school run").
   - outfit_impact: how many NEW outfit combinations it unlocks that they can't create now.
   - verdict: one of "buy_it" (genuine gap, high impact), "consider_it" (useful but not essential), "dont_buy_it" (they already own something similar or it's redundant), "wait" (nice but not a priority right now).
   - reasoning: 2-3 sentences in your voice, first person. Be direct. If they already own something similar, name it. If it's a genuine gap, say why. If it's a waste of money, tell them straight. Example: "Don't buy it. You already have a black blazer from Zara you've only worn twice — this would just collect dust." or "Worth it. You've got plenty of tops and trousers but nothing that bridges casual and polished — this fills that gap perfectly."

2. Create 4-6 sample outfits using the proposed item + their existing wardrobe. Show them what this piece UNLOCKS. Each outfit must be complete (top + bottom + shoes, or one_piece + shoes). Use real item IDs from the inventory plus "PROPOSED_ITEM" for the new piece. EVERY outfit MUST include "PROPOSED_ITEM" in its item_ids. If the proposed item is a top, pair it with a bottom + shoes. If it's a bottom, pair with a top + shoes. If it's a dress/one_piece, pair with shoes. If it's outerwear, layer it over a top + bottom + shoes. If it's shoes or an accessory, build a full outfit around it.

Return JSON matching this schema.`;

    const jsonSchema = {
      type: "object",
      properties: {
        evaluation: {
          type: "object",
          properties: {
            wardrobe_value: { type: "number" },
            versatility_count: { type: "number" },
            wear_potential: { type: "array", items: { type: "string" } },
            outfit_impact: { type: "number" },
            verdict: { type: "string" },
            reasoning: { type: "string" }
          },
          required: ["wardrobe_value", "versatility_count", "wear_potential", "outfit_impact", "verdict", "reasoning"]
        },
        outfits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              occasion: { type: "string" },
              description: { type: "string" },
              styling_tips: { type: "array", items: { type: "string" } },
              item_ids: { type: "array", items: { type: "string" } }
            },
            required: ["title", "occasion", "description", "item_ids"]
          }
        }
      },
      required: ["evaluation", "outfits"]
    };

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: llmPrompt,
      response_json_schema: jsonSchema
    });

    // Hydrate outfits — mark the proposed item so the UI can badge it
    const outfits = (result.outfits || []).map(o => ({
      title: o.title,
      occasion: o.occasion,
      description: o.description,
      styling_tips: o.styling_tips || [],
      items: hydrateOutfitItems(o.item_ids, itemMap).map(it =>
        it.item_id === 'PROPOSED_ITEM' ? { ...it, is_proposed: true } : it
      ),
    }));

    return Response.json({
      proposed_item: { name: proposedItem.name, category: proposedItem.category, color: proposedItem.color, brand: proposedItem.brand },
      evaluation: result.evaluation,
      outfits,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default serve('evaluatePotentialPurchase', handler);
