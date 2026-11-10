// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';
import { validatePublicUrl, safeFetchText } from '../shared/ssrf';

const ALLOWED_CATEGORIES = [
  'tops', 'bottoms', 'dresses', 'co_ord', 'outerwear',
  'shoes', 'bags', 'jewellery', 'sunglasses', 'accessories',
  'swimwear', 'movement_wear'
];

// Pull all <script type="application/ld+json"> blocks and try to find a Product.
function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      blocks.push(parsed);
    } catch {}
  }
  // Flatten arrays / @graph
  const flat = [];
  for (const b of blocks) {
    if (Array.isArray(b)) flat.push(...b);
    else if (b && typeof b === 'object' && Array.isArray(b['@graph'])) flat.push(...b['@graph']);
    else flat.push(b);
  }
  return flat.find((n) => n && (n['@type'] === 'Product' || (Array.isArray(n['@type']) && n['@type'].includes('Product'))));
}

function extractMeta(html, prop) {
  // Tries property= and name= variants, plus og: prefix
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].trim() : '';
}

function collectImages(images) {
  const out = [];
  if (!images) return out;
  if (typeof images === 'string') { out.push(images); return out; }
  if (Array.isArray(images)) {
    for (const i of images) {
      if (typeof i === 'string') out.push(i);
      else if (i && i.url) out.push(i.url);
    }
    return out;
  }
  if (images.url) { out.push(images.url); return out; }
  return out;
}

// Pick the cleanest product shot from the candidates — prefer flat-lay /
// on-white / cutout URLs and deprioritise model / campaign / lifestyle photos.
function pickBestImage(candidates) {
  if (!candidates || candidates.length === 0) return '';
  if (candidates.length === 1) return candidates[0];
  const score = (url) => {
    const u = url.toLowerCase();
    let s = 0;
    if (/product|flat|front|still|ghost|on-white|white-bg|cutout|hero/.test(u)) s += 2;
    if (/model|on-model|look|campaign|lifestyle|street|editorial|video/.test(u)) s -= 2;
    if (/\.(jpg|jpeg|png)(\?|$)/.test(u)) s += 0.5;
    return s;
  };
  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

function brandName(brand) {
  if (!brand) return '';
  if (typeof brand === 'string') return brand;
  if (brand.name) return brand.name;
  return '';
}

// SSRF protection (validatePublicUrl, safeFetchText) is imported above from
// ../../shared/ssrf.ts and shared with the ICS calendar feed fetch.

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const url = body.url;
    if (!url || !url.trim()) {
      return Response.json({ error: 'A product URL is required' }, { status: 400 });
    }

    // SSRF guard: only allow http(s) URLs pointing at public hosts — never
    // internal/private/loopback/link-local addresses or cloud metadata endpoints.
    const safeUrl = await validatePublicUrl(url.trim());
    if (!safeUrl) {
      return Response.json({ error: 'Only public http(s) product URLs are allowed' }, { status: 400 });
    }

    // 1. Fetch the actual page so we read the EXACT product, not a web-search guess.
    //    Redirects are followed manually with each target re-validated against
    //    the SSRF guard (DNS resolution + private-IP block).
    let html = '';
    let fetchedOk = false;
    try {
      const result = await safeFetchText(safeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });
      if (result.ok) {
        html = result.text;
        fetchedOk = true;
      }
    } catch (fetchErr) {
      console.error('Direct fetch failed:', fetchErr.message);
    }

    // 2. Parse structured product data straight from the page.
    let scraped = { name: '', brand: '', color: '', image_url: '', image_candidates: [] };
    if (fetchedOk && html) {
      const ld = extractJsonLd(html);
      if (ld) {
        scraped.name = ld.name || '';
        scraped.brand = brandName(ld.brand);
        scraped.color = ld.color || '';
        scraped.image_candidates = collectImages(ld.image);
      }
      // Open Graph + meta fallbacks for anything missing
      if (!scraped.name) scraped.name = extractMeta(html, 'og:title') || extractTitle(html);
      if (!scraped.brand) scraped.brand = extractMeta(html, 'og:site_name') || extractMeta(html, 'product:brand');
      if (!scraped.color) scraped.color = extractMeta(html, 'product:color');
      const ogImage = extractMeta(html, 'og:image');
      if (ogImage && !scraped.image_candidates.includes(ogImage)) scraped.image_candidates.push(ogImage);
      scraped.image_url = pickBestImage(scraped.image_candidates);
    }

    // 3. Use the LLM only to NORMALIZE what we scraped (map category, clean up
    //    name/brand, infer color if missing) — no web search, so no drift to a
    //    different product.
    const llmInput = {
      fromUrl: url,
      scrapedName: scraped.name,
      scrapedBrand: scraped.brand,
      scrapedColor: scraped.color,
      pageTitle: fetchedOk ? extractTitle(html) : '',
      ogDescription: fetchedOk ? extractMeta(html, 'og:description') : '',
    };

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `A user pasted a fashion product link. The page has already been scraped — here is the raw structured data taken directly from that page (do NOT search the web, do NOT substitute a different product; work only from this data):

${JSON.stringify(llmInput, null, 2)}

Return the exact product being sold on that page:
1. name — the item name exactly as the brand/retailer lists it (clean up suffixes like " | Brand Official Site" if present in the page title).
2. brand — the brand name exactly as the brand spells it.
3. category — ONE of: ${ALLOWED_CATEGORIES.join(', ')}. Map from the item type (e.g. "dress" → dresses, "trouser/skirt/jean" → bottoms, "bag" → bags, "necklace/ring/earring" → jewellery, "sunglasses" → sunglasses, "coat/jacket" → outerwear, "two-piece set" → co_ord).
4. color — the primary color. Infer from the name/description if not explicit.

If the scraped data is empty or ambiguous, still return your best read of THIS page's product — never a different product.`,
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          brand: { type: 'string' },
          category: { type: 'string' },
          color: { type: 'string' }
        },
        required: ['name', 'brand', 'category', 'color']
      }
    });

    // Validate category against the allowed list
    let category = ALLOWED_CATEGORIES.includes(result.category) ? result.category : 'accessories';

    // Prefer the image scraped directly from the page (JSON-LD / og:image) —
    // it's the exact product photo. Fall back to AI generation only if we
    // couldn't scrape one.
    let finalImageUrl = scraped.image_url || '';
    if (!finalImageUrl) {
      try {
        const genQuery = (result.brand && result.brand.trim())
          ? `${result.brand.trim()} ${result.name || ''}`
          : (result.name || 'fashion item');
        const gen = await base44.asServiceRole.integrations.Core.GenerateImage({
          prompt: `Clean e-commerce product photo of a single clothing item on a plain white background, studio lighting, centered, no model, no text overlay. Item: ${genQuery}. Color: ${result.color || 'unspecified'}. High quality, flat lay style, minimalist.`
        });
        finalImageUrl = gen?.url || '';
      } catch (genErr) {
        console.error('Image generation fallback failed:', genErr);
      }
    }

    return Response.json({
      name: result.name || scraped.name || '',
      brand: result.brand || scraped.brand || '',
      category,
      color: result.color || scraped.color || '',
      image_url: finalImageUrl,
      image_candidates: scraped.image_candidates || []
    });
  } catch (error) {
    console.error('lookupProductByUrl error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default serve('lookupProductByUrl', handler);
