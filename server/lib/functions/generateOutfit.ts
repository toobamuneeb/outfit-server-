// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';
import { hydrateOutfitItems, isComplete, buildInventory } from '../shared/outfitUtils';

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const prompt = body.prompt;
    const feedback = (body.feedback || '').trim();
    const mustIncludeIds = body.must_include_ids || [];
    const refineDirection = (body.refine_direction || '').trim();
    const currentItemIds = body.current_item_ids || [];
    const mode = (body.mode || '').trim();
    if (!prompt || !prompt.trim()) {
      return Response.json({ error: 'A prompt is required' }, { status: 400 });
    }

    // Fetch the user's wardrobe items
    const items = await base44.entities.WardrobeItem.list('-updated_date', 200);
    if (!items || items.length === 0) {
      return Response.json({ error: 'Your wardrobe is empty. Add some items first!' }, { status: 400 });
    }

    // Build a style profile section so recommendations flatter the individual
    const profileParts = [];
    if (user.body_shape && user.body_shape !== 'prefer_not_to_say') {
      profileParts.push(`Body shape: ${user.body_shape} — choose silhouettes and proportions that flatter this shape.`);
    }
    if (user.color_season && user.color_season !== 'unsure') {
      profileParts.push(`Seasonal colour palette: ${user.color_season} — favour colours from this palette that light up the wearer.`);
    }
    if (user.style_vibe && user.style_vibe.length > 0) {
      profileParts.push(`Preferred style aesthetics: ${user.style_vibe.join(', ')}.`);
    }
    if (user.fit_preference && user.fit_preference !== 'mixed') {
      profileParts.push(`Preferred fit: ${user.fit_preference}.`);
    }
    if (user.style_icons && user.style_icons.trim()) {
      profileParts.push(`Style muses / icons to channel: ${user.style_icons.trim()}.`);
    }
    const profileGuidance = profileParts.length > 0
      ? `\nThe wearer's personal style profile (honour this so every look feels personally flattering, not generic):\n${profileParts.join('\n')}\n`
      : '';

    // Infer garment_type (top/bottom/one_piece) for each item so the LLM can
    // build complete outfits — critical for movement_wear/swimwear where a
    // top and bottom share the same category.
    // (inferGarmentType + buildInventory imported from shared/outfitUtils.ts)

    // Build a compact inventory for the LLM
    const inventory = buildInventory(items);

    // "Memory" — recent looks the stylist has already put together, so she can
    // reference them naturally and never repeat an outfit verbatim.
    const recent = await base44.entities.Outfit.list('-created_date', 6);
    const recentMemory = recent && recent.length > 0
      ? recent.map((o) => `- "${o.title}"${o.occasion ? ` (${o.occasion})` : ''}`).join('\n')
      : '';
    const memoryBlock = recentMemory
      ? `\nLooks you've already styled for them recently (reference these naturally if it fits — "remember that camel coat combo? let's remix it" — but never repeat an outfit verbatim):\n${recentMemory}\n`
      : '';

    // Feedback loop — what the client has told Frankie about recent looks, so
    // each round of recommendations gets sharper and more personally tuned.
    const feedbackMemory = recent
      .filter((o) => o.feedback && o.feedback !== 'Loved it')
      .map((o) => `- "${o.title}"${o.occasion ? ` (${o.occasion})` : ''}: ${o.feedback}`)
      .join('\n');
    const feedbackBlock = feedbackMemory
      ? `\nWhat your client has told you about recent looks — learn from this so every future look gets closer to their taste:\n${feedbackMemory}\n`
      : '';

    // "Must-include" pieces — the client has hand-picked these as their starting
    // point. Every outfit MUST contain all of them; Frankie fills in the rest.
    const mustIncludeItems = items.filter((it) => mustIncludeIds.includes(it.id));
    const mustIncludeBlock = mustIncludeItems.length > 0
      ? `\nThe client has chosen these pieces as their starting point — EVERY outfit MUST include ALL of them, then you build the rest of the look around them:\n${mustIncludeItems.map((it) => `- ${it.name}${it.brand ? ` (${it.brand})` : ''} — ${it.category}${it.color ? `, ${it.color}` : ''}${it.fit ? `, ${it.fit} fit` : ''} [id: ${it.id}]`).join('\n')}\nTreat these as non-negotiable. Work them into each outfit naturally and fill in whatever's missing (tops, shoes, bags, jewellery, sunglasses — whatever the look needs to feel complete).\n`
      : '';

    // Single-outfit refinement — the client is looking at one specific look
    // and wants it adjusted in a particular direction (chicer, more casual, etc.)
    const currentItems = items.filter((it) => currentItemIds.includes(it.id));
    const refineBlock = refineDirection
      ? `\nThe client is looking at one of your previous outfits and wants it adjusted:\nCurrent outfit pieces:\n${currentItems.map((it) => `- ${it.name} (${it.category}) [id: ${it.id}]`).join('\n')}\nDirection: ${refineDirection}\nCreate 1 outfit that addresses this direction — keep the pieces that work, swap out what doesn't. It should feel like a thoughtful evolution, not a completely different look.\n`
      : '';

    // Unexpected pairings — the client wants to be surprised with
    // fashion-forward, couture-magazine-level styling they'd never think
    // of themselves. Frankie goes full editorial.
    const unexpectedBlock = mode === 'unexpected_pairings'
      ? `\nThe client wants to be surprised. They're looking at their current look but they want something completely different — an UNEXPECTED PAIRING. Think couture magazine styling, fashion-editorial level. Create 1 outfit from their wardrobe that screams style — pairings they would NEVER think to put together themselves. Clash unexpected colours, mix dressy with casual, contrast textures in surprising ways, wear pieces in unconventional combinations. Think like a fashion editor styling a magazine shoot: the individual pieces are familiar but the COMBINATION is what makes it special and arresting. It must still be a complete, wearable outfit (top + bottom + shoes) made from real items in their wardrobe — but the way they're combined should feel fresh, bold, and unlike anything you've suggested before. Push the boundaries. Don't play it safe. Make them see their wardrobe in a completely new way.\nFor context, here's the look they're currently viewing:\n${currentItems.map((it) => `- ${it.name} (${it.category}) [id: ${it.id}]`).join('\n')}\nDon't just refine this — blow it apart and create something unexpected.\n`
      : '';

    const llmPrompt = `You are the stylist at Frankie. You're warm, witty, a little cheeky, and genuinely obsessed with helping your client look and feel incredible. You speak like a chic, supportive best friend who happens to have killer taste — never robotic, never generic, never a dry list of instructions. You hype them up, you notice the little things, and you make styling feel fun and personal.

Their wardrobe:

${JSON.stringify(inventory, null, 2)}
${profileGuidance}${memoryBlock}${feedbackBlock}${mustIncludeBlock}${refineBlock}${unexpectedBlock}
The request: "${prompt}"${feedback ? `\n\nRefinement directive for this round: ${feedback}` : ''}

${(refineDirection || mode === 'unexpected_pairings') ? `Create 1 outfit from this wardrobe. ${mode === 'unexpected_pairings' ? 'This should be an unexpected, fashion-forward pairing — couture-magazine styling the client would never think to put together themselves.' : "Refine the current look based on the client's direction — keep what works, change what doesn't."}` : `Create EXACTLY 3 distinct outfit options from this wardrobe that satisfy the request. Each should feel different in mood/vibe.`} Tailor every choice to the style profile above when provided. For each outfit:
1. Build a COMPLETE head-to-toe look — this is non-negotiable. EVERY outfit MUST include BOTH a top half AND a bottom half, plus shoes. A single top, a single bra, or a jacket with no pants is NOT an outfit — it is invalid and will be rejected.
   - Each wardrobe item has a "garment_type" field: "top", "bottom", "one_piece", or null (accessories/shoes/outerwear have null).
   - Bottom half = one item with garment_type "bottom" OR one with garment_type "one_piece" (dresses, co_ord, one-piece activewear/swimwear cover both halves).
   - Top half = one item with garment_type "top" OR one with garment_type "one_piece".
   - For activewear/active requests: pair a movement_wear item with garment_type "top" WITH a movement_wear item with garment_type "bottom" (leggings/shorts) — BOTH are required. A sports bra or crop top alone is NEVER a complete outfit.
   - Then add shoes. Then add a handbag if one suits the occasion. Then layer ONE piece of jewellery and ONE pair of sunglasses when the wardrobe has suitable options.
   - MINIMUM: 3 items per outfit (top + bottom + shoes). A one_piece + shoes (2 items) is the only exception. A 1-piece "outfit" is ALWAYS invalid.
2. ONE item per garment_type per outfit — at most one "top", one "bottom", one "one_piece" (a one_piece replaces both top and bottom). For accessories, shoes, and outerwear: one per category — one handbag, one pair of shoes, one pair of sunglasses, one piece of jewellery, one outerwear. This means a movement_wear top + movement_wear bottom is allowed (different garment_types), but two tops is not.
3. THE PIECES MUST ACTUALLY WORK TOGETHER. This is the most important rule. Before finalising any outfit, check it as a complete look: do the colours harmonise (not clash)? Do the proportions balance (relaxed with fitted, cropped with high-waisted, longline with slim)? Is the formality level consistent across all pieces (don't mix a formal piece with a gym piece)? Does the texture story make sense? If ANY combination feels off, swap pieces until the look reads as intentional and styled. Use the STYLE RESEARCH above as your guide — it contains the concrete colour, proportion, and formality rules for this wardrobe. A safe, harmonious outfit is always better than a bold, clashing one.
4. MATCH THE LUXURY LEVEL TO THE OCCASION. Consider the brand of each item when accessorising. Luxury designer pieces (Chanel, Hermès, Dior, Bottega, Louis Vuitton, Prada, Gucci, Celine, Saint Laurent, etc.) are for nights out, dinners, events, and special occasions — NOT for school drop-offs, the gym, casual errands, park dates, or active days. For everyday casual occasions (school run, coffee run, home day, active day, travel day), choose unbranded or low-key pieces from the wardrobe. A Chanel handbag at a school drop-off is a styling miss — save it for the dinner date instead.
5. Give the outfit a short evocative title (2-5 words).
6. Write a stylist note in Frankie's voice — warm, specific, a touch of wit, and always hyping them up. Reference why the pieces work for their body, colour palette, or fit when the profile is known. 1-2 sentences, first person ("I love how…", "this is going to look unreal on you").
7. Tag the occasion in a few words.
8. Write a "why I picked this" note (stylist_reasoning) — in 1-2 sentences, explain why these specific pieces answer the client's request. Reference the request and the key pieces. First person ("You wanted... so I..."). This teaches the client how to think about styling, not just what to wear.
9. Give 4-5 richly detailed styling tips on how to wear this look — this is HI FRANKIE's signature and what sets Frankie apart, so make each tip genuinely useful and instructive. Each tip is a concrete physical styling move followed by why it works or the effect it creates, written in Frankie's warm, expert voice. Format each tip as: "The move — the why/effect." For example: "Roll the sleeves once and push them up past your wrists — it breaks the stiffness of the cuff and draws the eye to your jewellery, so the shirt reads as styled, not uniform." or "Tuck just the front hem and leave the back loose — it defines your waist without the rigidity of a full tuck, giving the silhouette an easy, undone shape." or "Leave the bottom two buttons undone and let the hem fall open over the jeans — it lengthens the line of your leg and keeps the look from feeling buttoned-up." Be specific and physical: exactly where to roll, how high to tuck, which button to leave undone, how to angle the collar, where to sit a belt. Never generic ("add accessories", "make it your own" are useless). Vary the tips so each one teaches a different styling principle — proportion, layering, colour balancing, accessorising, texture play, or attitude/posture — so the client learns something from every look. CRITICAL: only reference items that are actually included in the outfit's item_ids — never describe a piece (like pants) in a styling tip if it isn't in the outfit.
10. Assign exactly one style_category to each outfit from this fixed list: "work", "casual", "party", "date", "summer", "school_dropoff", "travel", "active", "home", "special". Pick the one that best captures the outfit's primary real-world use case (what bucket would the client file this look under when they come back to re-wear it?).

Only use items that exist in the inventory above (reference them by id). If the request mentions weather, fit, or style constraints, honor them. If the wardrobe lacks a perfect item, work with what's available and note it gracefully — but every outfit MUST be built around real clothing (tops, bottoms, dresses, co_ord, or outerwear), never accessories alone.

${(refineDirection || mode === 'unexpected_pairings') ? '' : `After creating all 3 outfits, choose YOUR favourite — the one you'd actually recommend if they asked "which one would you pick?" Set frankie_pick.look_number to 1, 2, or 3, and write frankie_pick.reason in your voice — warm, opinionated, specific. Tell them why you'd choose this one over the others. Example: "I'd go with Look 2. It's polished enough for work, but the denim keeps it feeling like you." Don't be neutral — have an opinion.`}

Return JSON matching this schema:
{
  "outfits": [
    {
      "title": "string",
      "occasion": "string",
      "description": "string",
      "styling_tips": ["string"],
      "style_category": "string",
      "item_ids": ["string"]
    }
  ]
}`;

    const jsonSchema = {
      type: "object",
      properties: {
        outfits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              occasion: { type: "string" },
              description: { type: "string" },
              stylist_reasoning: { type: "string" },
              styling_tips: { type: "array", items: { type: "string" } },
              style_category: { type: "string" },
              item_ids: { type: "array", items: { type: "string" } }
            },
            required: ["title", "occasion", "description", "stylist_reasoning", "styling_tips", "style_category", "item_ids"]
          }
        },
        frankie_pick: {
          type: "object",
          properties: {
            look_number: { type: "integer" },
            reason: { type: "string" }
          }
        }
      },
      required: ["outfits"]
    };

    const itemMap = new Map(items.map(it => [it.id, it]));

    function hydrateOutfits(rawOutfits) {
      return (rawOutfits || []).map((o) => ({
        title: o.title,
        occasion: o.occasion,
        description: o.description,
        stylist_reasoning: o.stylist_reasoning || '',
        styling_tips: o.styling_tips || [],
        style_category: o.style_category || 'casual',
        items: hydrateOutfitItems(o.item_ids, itemMap),
      }));
    }

    let result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: llmPrompt,
      response_json_schema: jsonSchema,
      model: 'claude-sonnet-5',
    });
    let outfits = hydrateOutfits(result.outfits);

    // Retry once if any outfit came back incomplete (missing bottom half, etc.)
    if (!outfits.every(o => isComplete(o.items))) {
      const problems = outfits
        .map((o, i) => isComplete(o.items) ? null : `Outfit ${i+1} ("${o.title}") only has [${o.items.map(it => it.category).join(', ')}] — missing a bottom half. Rebuild with a complete top + bottom + shoes.`)
        .filter(Boolean);
      const retryPrompt = llmPrompt + `\n\nCORRECTION — your last attempt was incomplete:\n${problems.join('\n')}\n\nEvery outfit MUST contain a top half AND a bottom half AND shoes. For activewear: a movement_wear top + movement_wear bottom (leggings/shorts) + shoes. A single top or bra alone is NEVER a complete outfit. ${(refineDirection || mode === 'unexpected_pairings') ? 'Fix the outfit and return it.' : 'Fix all three outfits and return the full set.'}`;
      result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: retryPrompt,
        response_json_schema: jsonSchema,
        model: 'claude-sonnet-5',
      });
      outfits = hydrateOutfits(result.outfits);
    }

    return Response.json({ outfits, frankie_pick: result.frankie_pick || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default serve('generateOutfit', handler);
