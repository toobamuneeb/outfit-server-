// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const outfit = body.outfit;
    if (!outfit || !outfit.items || outfit.items.length === 0) {
      return Response.json({ error: 'Outfit with items is required' }, { status: 400 });
    }

    // Build a vivid description of each piece for the image model
    const pieceDescriptions = (outfit.items || []).map((it) => {
      const parts = [it.name];
      if (it.category) parts.push(`(${it.category})`);
      return parts.join(' ');
    });
    const piecesText = pieceDescriptions.join(', ');

    const occasion = outfit.occasion || 'everyday chic';
    const title = outfit.title || 'the look';

    const imagePrompt = `Full-body editorial fashion photograph of a stylish model walking confidently outdoors, wearing: ${piecesText}. The overall mood is "${title}" for ${occasion}. ${outfit.description ? `Stylist direction: ${outfit.description}` : ''} Golden-hour natural light, candid street-style photography, shot on 35mm film, shallow depth of field, high-fashion magazine aesthetic, natural skin, minimal styling, head to toe visible, relaxed confident pose. No text, no watermark.`;

    const result = await base44.asServiceRole.integrations.Core.GenerateImage({
      prompt: imagePrompt
    });

    return Response.json({ url: result.url });
  } catch (error) {
    console.error('generateModelShot error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default serve('generateModelShot', handler);
