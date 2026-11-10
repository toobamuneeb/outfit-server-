// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';

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

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      model: 'claude_sonnet_4_6',
      file_urls: [imageUrl],
      prompt: `You are an expert fashion stylist and apparel analyst. You are looking at a photo of a SINGLE clothing or accessory item that a user has added to their digital wardrobe. Your job is to identify the item with maximum precision so it can be matched to the exact product online.

First, carefully describe to yourself what you see in the image (garment type, color, details). Then identify the item. Getting the garment TYPE and COLOR exactly right is the most important part of this task.

## Garment type — be precise:
- A "button-up shirt" / "button-down shirt" has a full front button placket and a collar. It is NOT a t-shirt.
- A "t-shirt" is a pullover with NO buttons, typically short or long sleeves, crew or V neckline.
- A "polo shirt" has a collar and a short 2-3 button placket.
- A "singlet top" / "tank top" is sleeveless with shoulder straps.
- A "blouse" is a feminine top, often with feminine details (ruffles, ties, delicate fabric).
- A "blazer" is a tailored jacket with lapels. A "cardigan" is a knitted open-front layer.
- "Jeans" are denim trousers. "Trousers" are tailored pants. "Shorts" end above the knee.

## Color — be accurate:
- Identify the ACTUAL fabric color of the garment, ignoring shadows, highlights, ambient lighting, and background.
- A shirt that is blue is BLUE — do not call it grey because the photo is dark, underexposed, or has cool lighting.
- Look at the most evenly-lit area of the fabric to judge the true color.
- Use precise shade names: "Light blue", "Navy", "Sky blue", "Periwinkle", "Oxford blue" rather than just "blue" when you can tell the shade.

## What to return:

1. **name** — A precise, descriptive product name. Be specific about the garment type, neckline/silhouette, fabric texture, and any notable details. Examples of GOOD names:
   - "White ribbed cotton singlet top with scoop neckline"
   - "Black leather crossbody bag with gold buckle"
   - "Camel wool oversized blazer with notch lapels"
   - "Light wash straight-leg denim jeans"
   Examples of BAD names (too vague):
   - "White top"
   - "Black bag"
   Include the brand at the start ONLY if a logo, label, or tag is clearly visible and legible in the image (e.g. "St Agni white ribbed singlet top"). If you cannot read a brand, do NOT guess one.

2. **brand** — The brand name ONLY if clearly identifiable from a visible logo, label, hangtag, or recognizable design signature. If you are not confident, return an empty string. Never guess or fabricate a brand.

3. **category** — Exactly one of: tops, bottoms, dresses, outerwear, shoes, bags, jewellery, sunglasses, accessories, swimwear, movement_wear

4. **garment_type** — What body part this item covers. Exactly one of: "top", "bottom", "one_piece". This is critical for movement_wear and swimwear items which share a category but can be either a top or a bottom.
   - "top" = covers the upper body (t-shirts, blouses, crop tops, tanks, sports bras, singlets, bodysuits)
   - "bottom" = covers the lower body (pants, jeans, shorts, skirts, leggings, track pants, joggers)
   - "one_piece" = covers both in a single garment (dresses, co_ord sets, jumpsuits, one-piece swimsuits, overalls)
   - For shoes, bags, jewellery, sunglasses, outerwear, and accessories: return "one_piece" as a default (it won't be used for outfit building).

5. **color** — The primary color, named as precisely as you can determine from the photo. Use specific shade names where possible:
   - Instead of "white": "White", "Off-white", "Cream", or "Ivory" depending on the actual shade
   - Instead of "brown": "Camel", "Tan", "Chocolate", "Caramel", or "Cognac"
   - Instead of "blue": "Navy", "Cobalt", "Sky blue", "Denim blue", or "Periwinkle"
   - Instead of "pink": "Blush", "Rose", "Fuchsia", or "Coral"
   - Instead of "green": "Olive", "Sage", "Emerald", "Forest", or "Khaki"
   If the item has a pattern or is multi-colored, name the dominant color and note the pattern (e.g. "Black and white striped", "Floral print on cream").

5. **fit** — The fit or silhouette if applicable: "fitted", "slim", "relaxed", "loose", "oversized", "tailored", "straight", "wide-leg", "flare", "cropped", "longline". Return an empty string for bags, shoes, jewellery, sunglasses, and accessories where fit doesn't apply.

## Critical rules:
- Describe ONLY what you can actually see in the image. Do not invent details.
- Be precise about color — look carefully at the actual shade, not a general approximation.
- If the photo is unclear or the item is ambiguous, still give your best assessment based on what is visible.
- The name should be detailed enough that someone could search for this exact item online and find it.`,
      response_json_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          brand: { type: 'string' },
          category: { type: 'string' },
          garment_type: { type: 'string' },
          color: { type: 'string' },
          fit: { type: 'string' }
        },
        required: ['name', 'brand', 'category', 'garment_type', 'color', 'fit']
      }
    });

    // Validate category against allowed enum
    const allowedCategories = ['tops', 'bottoms', 'dresses', 'outerwear', 'shoes', 'bags', 'jewellery', 'sunglasses', 'accessories', 'swimwear', 'movement_wear'];
    const category = allowedCategories.includes(result.category) ? result.category : 'accessories';

    // Only keep garment_type for clothing categories where it matters
    const clothingCategories = ['tops', 'bottoms', 'dresses', 'co_ord', 'movement_wear', 'swimwear'];
    const validGarmentTypes = ['top', 'bottom', 'one_piece'];
    const garment_type = clothingCategories.includes(category) && validGarmentTypes.includes(result.garment_type)
      ? result.garment_type
      : undefined;

    return Response.json({
      name: result.name,
      brand: result.brand || '',
      category,
      garment_type,
      color: result.color || '',
      fit: result.fit || ''
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default serve('analyzeWardrobePhoto', handler);
