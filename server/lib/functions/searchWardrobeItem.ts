// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const query = body.query;
    const brand = body.brand;
    if (!query || !query.trim()) {
      return Response.json({ error: 'A search query is required' }, { status: 400 });
    }

    // Combine brand + item name so the web search targets the exact branded product
    const fullQuery = brand && brand.trim() ? `${brand.trim()} ${query.trim()}` : query.trim();

    // Use LLM with web context to find the branded item's details and a product image URL
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `A user wants to add this clothing/fashion item to their digital wardrobe. Your job is to find the EXACT real product that matches, so the user gets the correct item and color.

Brand: "${brand || 'unspecified'}"
Item name: "${query}"

Search the web for the EXACT product. The match must satisfy ALL of these:
- The brand name matches exactly (correct spelling and capitalization).
- The item type matches (e.g. "singlet top" not "t-shirt", "crossbody bag" not "tote bag").
- The color matches the one described in the item name.

Do NOT return an approximate or similar-but-different product. If the brand is "St Agni" and the item is a "white ribbed cotton singlet top", find the actual St Agni white singlet top — not a random white top from a different brand, and not a different color.

Return:
1. name — the item name exactly as listed by the brand/retailer
2. brand — the brand name exactly as the brand spells it
3. category — one of: tops, bottoms, dresses, outerwear, shoes, bags, jewellery, sunglasses, accessories, swimwear, movement_wear
4. garment_type — what body part this item covers: "top" (upper body: shirts, tops, crop tops, tanks, sports bras), "bottom" (lower body: pants, jeans, shorts, skirts, leggings), or "one_piece" (both in one garment: dresses, co_ord sets, jumpsuits, one-piece swimwear). For shoes, bags, jewellery, sunglasses, outerwear, and accessories, return "one_piece" as a default.
5. color — the primary color of the matched product
5. image_url — a direct, publicly accessible image URL of the EXACT product (from the brand's site or an authorized retailer). Must be a direct link to the image file. Do not return a homepage URL or a page that happens to contain images. STRONGLY PREFER a product-only photo (flat-lay or ghost-mannequin on a plain background) over a photo of a model wearing the item — no person. If only model-on photos exist, still return the best direct image.

If you cannot find a reliable exact match with high confidence, leave image_url empty (we will generate an image instead) and still return the best name/brand/category/color you can determine. Never return an image URL for a different product than the one described.`,
      add_context_from_internet: true,
      model: 'gemini_3_1_pro',
      response_json_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          brand: { type: "string" },
          category: { type: "string" },
          garment_type: { type: "string" },
          color: { type: "string" },
          image_url: { type: "string" }
        },
        required: ["name", "brand", "category", "garment_type", "color", "image_url"]
      }
    });

    // If the web search found a direct product photo, use it. Otherwise,
    // generate a clean product-style image so the wardrobe item always has a
    // photo (matching the clean look the user expects).
    let finalImageUrl = result.image_url || '';
    if (!finalImageUrl) {
      try {
        const genQuery = brand && brand.trim()
          ? `${brand.trim()} ${result.name || query}`
          : (result.name || query);
        const gen = await base44.asServiceRole.integrations.Core.GenerateImage({
          prompt: `Clean e-commerce product photo of a single clothing item on a plain white background, studio lighting, centered, no model, no text overlay. Item: ${genQuery}. Color: ${result.color || 'unspecified'}. High quality, flat lay style, minimalist.`
        });
        finalImageUrl = gen?.url || '';
      } catch (genErr) {
        console.error('Image generation fallback failed:', genErr);
      }
    }

    // Only keep garment_type for clothing categories where it matters
    const clothingCategories = ['tops', 'bottoms', 'dresses', 'co_ord', 'movement_wear', 'swimwear'];
    const validGarmentTypes = ['top', 'bottom', 'one_piece'];
    const garment_type = clothingCategories.includes(result.category) && validGarmentTypes.includes(result.garment_type)
      ? result.garment_type
      : undefined;

    return Response.json({
      name: result.name,
      brand: result.brand,
      category: result.category,
      garment_type,
      color: result.color,
      image_url: finalImageUrl
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default serve('searchWardrobeItem', handler);
