// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';
import { geocode, getWeather, weatherDescription } from '../shared/weather';

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const destination = (body.destination || '').trim();
    const duration = Math.min(Math.max(parseInt(body.duration) || 3, 1), 14);
    const travelDate = (body.travel_date || '').trim();
    const activities = Array.isArray(body.activities) ? body.activities : [];

    const ACTIVITY_LABELS = {
      movement: 'Movement wear (gym, yoga, runs, active outings)',
      swim: 'Swim & beachwear (pool, beach, resort)',
      evening: 'Evening / dressy outfits (dinners, nights out, cocktails)',
      work: 'Work / business attire (meetings, calls, office)',
      formal: 'Formal event wear (wedding, gala, black-tie)',
      outdoor: 'Outdoor adventure gear (hiking, rain, rugged terrain)',
    };
    const activityLines = activities
      .filter((a) => ACTIVITY_LABELS[a])
      .map((a) => `- ${ACTIVITY_LABELS[a]}`);
    const activitiesSection = activityLines.length
      ? `\n\nTRIP ACTIVITIES (the client has flagged these — make sure the capsule covers them, pulling from the matching wardrobe categories where available):\n${activityLines.join('\n')}`
      : '';

    if (!destination) {
      return Response.json({ error: 'A destination is required' }, { status: 400 });
    }

    // 1. Get weather for the destination (from the travel date if provided)
    let weatherDays = [];
    let climateSummary = 'Weather unavailable — pack for versatility';
    try {
      const coords = await geocode(destination);
      const weather = await getWeather(coords, duration, travelDate || undefined);

      weatherDays = Object.entries(weather).map(([date, w]) => ({
        date,
        temp_max: w.temp_max,
        temp_min: w.temp_min,
        precip: w.precip,
        conditions: weatherDescription(w.code),
      }));

      // Summarize the climate
      if (weatherDays.length > 0) {
        const temps = weatherDays.map(d => d.temp_max);
        const minTemps = weatherDays.map(d => d.temp_min);
        const avgHigh = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length);
        const avgLow = Math.round(minTemps.reduce((a, b) => a + b, 0) / minTemps.length);
        const maxPrecip = Math.max(...weatherDays.map(d => d.precip));
        climateSummary = `${avgLow}\u2013${avgHigh}\u00b0C, ${maxPrecip > 40 ? 'high rain chance' : maxPrecip > 20 ? 'some rain possible' : 'mostly dry'}`;
      }
    } catch (weatherErr) {
      console.log('Weather lookup failed, continuing without forecast:', weatherErr.message);
    }

    // 2. Get wardrobe
    const wardrobe = await base44.entities.WardrobeItem.list('-created_date', 200);
    if (!wardrobe || wardrobe.length === 0) {
      return Response.json({ error: 'Your wardrobe is empty. Add some pieces first!' }, { status: 400 });
    }

    const inventory = wardrobe.map(it => ({
      id: it.id,
      name: it.name,
      brand: it.brand || '',
      category: it.category,
      color: it.color || '',
      fit: it.fit || '',
      style_tags: it.style_tags || [],
      season: it.season || 'all',
    }));

    // 3. Generate capsule wardrobe via LLM
    const tripWindow = travelDate
      ? `departing on ${travelDate} for ${duration} days`
      : `for ${duration} days`;
    const prompt = `You are the stylist at Frankie. You're warm, witty, a little cheeky, and genuinely obsessed with helping your client look and feel incredible. You speak like a chic, supportive best friend with killer taste — never robotic, never generic. You hype them up and make styling feel fun and personal. They're going to ${destination} ${tripWindow}.

WEATHER FORECAST:
${JSON.stringify(weatherDays, null, 2)}

CLIMATE SUMMARY: ${climateSummary}
${activitiesSection}

THEIR WARDROBE:
${JSON.stringify(inventory, null, 2)}

Create a capsule wardrobe packing list from their existing pieces that will work for the entire trip. The capsule should:
1. Cover all ${duration} days with versatile, mix-and-match pieces appropriate for the forecasted weather.
2. Include enough tops/bottoms/dresses to rotate, plus outerwear if needed for the temperatures, shoes, and accessories.
3. Be practical for travel — prefer pieces that layer well and can be re-worn in different combinations.
4. Group items into logical packing categories.
5. If the client flagged specific trip activities, make sure the capsule includes suitable pieces from the matching wardrobe categories (movement_wear, swimwear, etc.) — only if the wardrobe has them. Note any flagged activities the wardrobe can't cover in the packing notes.

Return JSON matching this schema:
{
  "capsule_title": "string (a creative editorial name for this capsule)",
  "climate_summary": "string (brief, e.g. 'Mild spring days, cool evenings')",
  "packing_notes": "string (2-3 sentences in Frankie's warm, witty first-person voice with styling advice for this trip's weather)",
  "categories": [
    {
      "category": "string (e.g. 'Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Accessories')",
      "items": [{ "item_id": "string", "name": "string", "category": "string" }]
    }
  ],
  "daily_outfits": [
    {
      "day": number,
      "outfit_title": "string",
      "weather_note": "string (brief, the forecast for that day)",
      "item_ids": ["string"]
    }
  ]
}

Each daily outfit must be a COMPLETE head-to-toe look: a main clothing piece (top + bottom, a dress, or a co-ord) PLUS shoes PLUS a handbag, PLUS jewellery and sunglasses whenever the wardrobe has suitable options. Only omit an accessory category if the wardrobe genuinely has nothing that works for that outfit — never skip them just because they feel optional.

Only use items that exist in the wardrobe (reference by id). If the wardrobe lacks something ideal, work with what's available. Return only valid JSON.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          capsule_title: { type: 'string' },
          climate_summary: { type: 'string' },
          packing_notes: { type: 'string' },
          categories: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                items: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      item_id: { type: 'string' },
                      name: { type: 'string' },
                      category: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
          daily_outfits: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'number' },
                outfit_title: { type: 'string' },
                weather_note: { type: 'string' },
                item_ids: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        required: ['capsule_title', 'climate_summary', 'packing_notes', 'categories', 'daily_outfits'],
      },
    });

    // Hydrate items with images
    const itemMap = new Map(wardrobe.map(it => [it.id, it]));
    const hydrate = (ids) => (ids || [])
      .map(id => itemMap.get(id))
      .filter(Boolean)
      .map(it => ({ item_id: it.id, name: it.name, category: it.category, image_url: it.image_url, brand: it.brand }));

    const categories = (result.categories || []).map(c => ({
      ...c,
      items: (c.items || []).map(item => {
        const w = itemMap.get(item.item_id);
        return { ...item, image_url: w?.image_url || '' };
      }),
    }));

    const dailyOutfits = (result.daily_outfits || []).map(d => ({
      ...d,
      items: hydrate(d.item_ids),
    }));

    return Response.json({
      capsule_title: result.capsule_title,
      climate_summary: result.climate_summary,
      packing_notes: result.packing_notes,
      categories,
      daily_outfits: dailyOutfits,
      weather_forecast: weatherDays,
      computed_climate: climateSummary,
      destination,
      duration,
      travel_date: travelDate || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default serve('generateTravelCapsule', handler);
