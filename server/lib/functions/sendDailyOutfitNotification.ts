// @ts-nocheck: web app code, kept as written
import { createClientFromRequest } from '../shared/compat';
import { geocode, getTodayWeather, weatherDescription } from '../shared/weather';
import { hydrateOutfitItems, isComplete, buildInventory } from '../shared/outfitUtils';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Current hour in the user's local timezone (0-23), or -1 if it can't be resolved.
function localHour(timezone) {
  try {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(new Date());
    return parseInt(s, 10);
  } catch { return -1; }
}

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);

    // Auth: a scheduled workflow runs as the app owner (admin). External
    // automated callers can use the x-cron-secret header or body cron_secret.
    let caller = null;
    let isAdmin = false;
    try {
      caller = await base44.auth.me();
      isAdmin = caller && caller.role === 'admin';
    } catch { /* no user context — workflow or unauthenticated external call */ }

    const cronToken = process.env.DAILY_CRON_TOKEN;
    const headerToken = req.headers.get('x-cron-secret');
    let body = {};
    let bodyToken;
    try { body = await req.json(); bodyToken = body?.cron_secret; } catch { /* no JSON body */ }
    const hasCronToken = cronToken && (headerToken === cronToken || bodyToken === cronToken);

    if (!isAdmin && !hasCronToken) {
      return Response.json({ error: 'Unauthorized — admin session or valid cron token required' }, { status: 401 });
    }

    // forceUserId lets an admin trigger a test send to themselves outside the 6am window.
    const forceUserId = body?.user_id;

    const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const today = new Date();
    const todayKey = DAY_KEYS[today.getDay()];
    const todayName = today.toLocaleDateString('en-AU', { weekday: 'long' });

    // Who gets an email this run: opted in, set up, and currently in their 6am
    // local hour (unless a specific user is forced for a manual test).
    const eligible = users.filter((u) => {
      if (!u.daily_notification_enabled) return false;
      if (!u.location || !u.timezone) return false;
      if (forceUserId) return u.id === forceUserId;
      return localHour(u.timezone) === 6;
    });

    if (eligible.length === 0) {
      return Response.json({ message: 'No users due for their 6am morning edit right now.', sent: 0 });
    }

    const results = [];
    const weatherCache = {};

    for (const u of eligible) {
      try {
        // 1. Weather (cached by rounded coords so users in one city share a call)
        let weatherStr = '';
        try {
          const coords = await geocode(u.location);
          const cacheKey = `${coords.latitude.toFixed(1)},${coords.longitude.toFixed(1)}`;
          let todayWeather = weatherCache[cacheKey];
          if (!todayWeather) {
            todayWeather = await getTodayWeather(coords);
            if (todayWeather) weatherCache[cacheKey] = todayWeather;
          }
          if (todayWeather) {
            weatherStr = `${todayWeather.temp_min}\u2013${todayWeather.temp_max}\u00b0C, ${weatherDescription(todayWeather.code)}, ${todayWeather.precip}% rain${todayWeather._fallback ? ' (est.)' : ''}`;
          }
        } catch { /* weather unavailable — continue without it */ }

        // 2. Wardrobe
        const items = await base44.asServiceRole.entities.WardrobeItem.filter(
          { created_by_id: u.id }, '-updated_date', 200
        );
        if (!items || items.length === 0) {
          results.push({ email: u.email, status: 'skipped', reason: 'Empty wardrobe' });
          continue;
        }
        const itemMap = new Map(items.map((it) => [it.id, it]));
        const inventory = buildInventory(items);

        // 3. Today's usual rhythm
        const weeklyRhythm = u.weekly_rhythm || {};
        const todaysRhythm = weeklyRhythm[todayKey] || u.typical_day || '';
        const rhythmBlock = todaysRhythm.trim()
          ? `\nTheir usual ${todayName}: ${todaysRhythm}\n`
          : '';

        // 4. Style profile
        const profileParts = [];
        if (u.style_vibe && u.style_vibe.length > 0) profileParts.push(`Preferred style aesthetics: ${u.style_vibe.join(', ')}.`);
        if (u.fit_preference && u.fit_preference !== 'mixed') profileParts.push(`Preferred fit: ${u.fit_preference}.`);
        if (u.location_climate && u.location_climate.length > 0) profileParts.push(`Where they live / climate: ${u.location_climate.join(', ')}.`);
        if (u.outfit_feel && u.outfit_feel.length > 0) profileParts.push(`How they want outfits to feel: ${u.outfit_feel.join(', ')}.`);
        if (u.frankie_should_know && u.frankie_should_know.length > 0) profileParts.push(`Things to keep in mind: ${u.frankie_should_know.join('; ')}.`);
        if (u.your_rules && u.your_rules.trim()) profileParts.push(`Their hard rules: ${u.your_rules.trim()}.`);
        if (u.repeat_tolerance) {
          const repeatMap = {
            repeat_favourites: "doesn't mind repeating favourite looks",
            little_variety: 'likes a little variety',
            keep_fresh: 'wants things kept feeling fresh',
          };
          profileParts.push(`Outfit repeat tolerance: ${repeatMap[u.repeat_tolerance] || u.repeat_tolerance}.`);
        }
        if (typeof u.adventurous === 'number') {
          const adv = u.adventurous;
          const advLabel = adv < 25 ? 'plays it safe' : adv < 60 ? 'likes a little adventure' : adv < 85 ? 'is adventurous' : 'is fully experimental';
          profileParts.push(`How adventurous to be: ${advLabel} (${adv}/100).`);
        }
        const profileGuidance = profileParts.length > 0
          ? `\nThe wearer's personal style profile:\n${profileParts.join('\n')}\n`
          : '';

        const weatherBlock = weatherStr ? `\nTODAY'S WEATHER: ${weatherStr}\n` : '';

        const basePrompt = `You are the stylist at Frankie. You're warm, witty, a little cheeky, and genuinely obsessed with helping your client look and feel incredible. You speak like a chic, supportive best friend with killer taste \u2014 never robotic, never generic.

It's ${todayName}, ${today.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}. You're sending their morning email \u2014 a first look at three outfit options for the day ahead.

${weatherBlock}${rhythmBlock}${profileGuidance}
Their wardrobe:
${JSON.stringify(inventory, null, 2)}
`;

        const jsonSchema = {
          type: 'object',
          properties: {
            day_note: { type: 'string', description: "Frankie's opening line for the morning email \u2014 warm, first person, references the weather or the day ahead. 1-2 sentences." },
            outfits: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  occasion: { type: 'string' },
                  description: { type: 'string', description: 'Stylist note in Frankie\u2019s warm, witty first-person voice \u2014 1-2 sentences.' },
                  stylist_reasoning: { type: 'string', description: 'Why Frankie chose these pieces for this look \u2014 teaches the client how to think about styling. 1-2 sentences.' },
                  styling_tips: { type: 'array', items: { type: 'string' }, description: '2-3 concrete styling moves for this look (e.g. how to layer, tuck, roll, accessorize).' },
                  item_ids: { type: 'array', items: { type: 'string' } },
                },
                required: ['title', 'occasion', 'description', 'stylist_reasoning', 'styling_tips', 'item_ids'],
              },
            },
            frankie_pick: {
              type: 'object',
              properties: { look_number: { type: 'integer' }, reason: { type: 'string' } },
            },
          },
          required: ['day_note', 'outfits', 'frankie_pick'],
        };

        const prompt = `${basePrompt}
Create 3 distinct outfit options for their usual day \u2014 each should feel different in mood/vibe but all appropriate for their typical activities and today's weather.

CRITICAL: the pieces in each outfit must actually work together. Colours must harmonise (not clash), proportions must balance (relaxed with fitted, cropped with high-waisted), and formality must be consistent across all pieces. A safe, harmonious outfit is always better than a bold, clashing one.

Each outfit must be a COMPLETE head-to-toe look: a top half AND a bottom half AND shoes. A single top or bra alone is NEVER a complete outfit.

For each outfit, write a stylist_reasoning (why these pieces work together) and 2-3 styling_tips (concrete moves: how to layer, tuck, roll, accessorize, switch pieces for a different vibe).

Write a day_note \u2014 your opening line for the morning email. Warm, first person, reference the weather or what's on. 1-2 sentences.

After creating all 3 outfits, choose YOUR favourite \u2014 the one you'd actually recommend if they asked "which one would you pick?" Set frankie_pick.look_number to 1, 2, or 3, and write frankie_pick.reason in your voice \u2014 warm, opinionated, specific. Have an opinion.

Return JSON with: day_note (string), outfits (array with exactly 3 outfits), frankie_pick ({look_number, reason}).`;

        let result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: jsonSchema,
          model: 'claude-sonnet-5',
        });

        let outfits = (result.outfits || []).map((o) => ({
          ...o,
          items: hydrateOutfitItems(o.item_ids, itemMap),
        }));

        // Retry once if any outfit came back incomplete
        if (!outfits.every((o) => isComplete(o.items))) {
          const problems = outfits
            .map((o, i) => isComplete(o.items) ? null : `Outfit ${i + 1} ("${o.title}") only has [${o.items.map((it) => it.category).join(', ')}] \u2014 missing a top or bottom half. Rebuild with a complete top + bottom + shoes.`)
            .filter(Boolean);
          result = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: prompt + `\n\nCORRECTION \u2014 your last attempt was incomplete:\n${problems.join('\n')}\n\nEvery outfit MUST contain a top half AND a bottom half AND shoes. Fix and return the full set.`,
            response_json_schema: jsonSchema,
            model: 'claude-sonnet-5',
          });
          outfits = (result.outfits || []).map((o) => ({
            ...o,
            items: hydrateOutfitItems(o.item_ids, itemMap),
          }));
        }

        const dayNote = result.day_note || '';
        const frankiePick = result.frankie_pick || null;
        const pickNum = frankiePick?.look_number;

        // Build the email — black-and-white outfit cards matching the app, with
        // Frankie's pick shown as a black header bar (not an inverted card).
        const B = '#000000';
        const W = '#FFFFFF';
        const outfitBlocks = outfits.map((o, i) => {
          const isPick = pickNum === (i + 1);
          const items = o.items || [];
          const tips = o.styling_tips || [];

          // Item grid — chunk into rows of 3.
          let itemRows = '';
          for (let r = 0; r < items.length; r += 3) {
            const row = items.slice(r, r + 3).map((it, idx) => {
              const realIdx = r + idx;
              const initial = (it.name || '?')[0].toUpperCase();
              const img = it.image_url
                ? `<img src="${it.image_url}" style="width:100%;aspect-ratio:1/1;object-fit:cover;display:block;">`
                : `<div style="width:100%;aspect-ratio:1/1;background:#F2F2F2;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#000;opacity:0.18;">${initial}</div>`;
              return `<td style="vertical-align:top;padding:4px;width:33.33%;">
                <div style="border:1px solid ${B};overflow:hidden;">${img}</div>
                <p style="font-size:14px;font-weight:900;color:${B};margin:5px 0 0;line-height:1;text-align:center;">${realIdx + 1}</p>
                <p style="font-size:7px;letter-spacing:0.08em;text-transform:uppercase;font-weight:700;color:${B};margin:2px 0 0;line-height:1.2;text-align:center;">${(it.category || '').replace(/_/g, ' ')}</p>
                <p style="font-size:8px;color:${B};opacity:0.5;margin:3px 0 0;line-height:1.25;text-align:center;">${it.name || ''}</p>
              </td>`;
            }).join('');
            // pad row to 3 cells so columns stay aligned
            const padCount = 3 - items.slice(r, r + 3).length;
            const pad = padCount > 0 ? `<td style="padding:4px;width:33.33%;"></td>`.repeat(padCount) : '';
            itemRows += `<tr>${row}${pad}</tr>`;
          }
          const itemGrid = `<table style="width:100%;border-collapse:collapse;">${itemRows}</table>`;

          // Numbered styling tips.
          const tipsHtml = tips.length > 0
            ? tips.map((tip, t) => `<tr>
                <td style="vertical-align:top;padding:0 8px 10px 0;width:30px;">
                  <p style="font-size:22px;font-weight:900;color:${B};margin:0;line-height:1;">${t + 1}</p>
                </td>
                <td style="vertical-align:top;padding:0 0 10px 0;">
                  <p style="font-size:12px;color:${B};opacity:0.8;line-height:1.5;margin:2px 0 0;font-weight:500;">${tip}</p>
                </td>
              </tr>`).join('')
            : `<p style="font-size:12px;color:${B};opacity:0.6;line-height:1.5;margin:0;font-style:italic;">${o.description || ''}</p>`;
          const tipsCount = tips.length > 0 ? `${tips.length} moves` : "Frankie's notes";

          return `<div style="border:2px solid ${B};background:${W};margin-bottom:14px;">
            ${isPick ? `<div style="background:${B};padding:8px 14px;text-align:center;">
              <p style="font-size:10px;letter-spacing:2px;color:${W};margin:0;font-weight:700;">FRANKIE SUGGESTS</p>
            </div>` : ''}
            <table style="width:100%;border-collapse:collapse;border-bottom:2px solid ${B};">
              <tr>
                <td style="background:${B};padding:10px 16px;text-align:center;vertical-align:middle;width:64px;border-right:2px solid ${B};">
                  <p style="font-size:36px;font-weight:900;color:${W};margin:0;line-height:1;">${i + 1}</p>
                </td>
                <td style="padding:10px 14px;vertical-align:middle;">
                  <p style="font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:${B};opacity:0.5;margin:0 0 3px;font-weight:700;">Look ${i + 1} of ${outfits.length}</p>
                  <p style="font-size:16px;font-weight:900;color:${B};margin:0;line-height:1.15;text-transform:uppercase;letter-spacing:0.05em;">${o.title}</p>
                </td>
              </tr>
            </table>
            <div style="padding:12px 14px 8px;">${itemGrid}</div>
            ${o.stylist_reasoning ? `<div style="border-top:1px solid ${B};padding:10px 14px;background:#FAFAFA;">
              <p style="font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:${B};opacity:0.5;margin:0 0 4px;font-weight:700;">Why Frankie Picked It</p>
              <p style="font-size:12px;color:${B};opacity:0.8;margin:0;line-height:1.5;font-style:italic;font-weight:500;">&ldquo;${o.stylist_reasoning}&rdquo;</p>
            </div>` : ''}
            <div style="border-top:2px solid ${B};">
              <div style="background:${B};padding:8px 14px;display:flex;justify-content:space-between;align-items:center;">
                <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:${W};margin:0;font-weight:900;">How to Style It</p>
                <p style="font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:${W};opacity:0.6;margin:0;font-weight:700;">${tipsCount}</p>
              </div>
              <div style="padding:14px;">
                <table style="width:100%;border-collapse:collapse;">${tips.length > 0 ? tipsHtml : ''}</table>
                ${tips.length === 0 ? tipsHtml : ''}
              </div>
            </div>
          </div>`;
        }).join('');

        const pickReason = frankiePick?.reason
          ? `<div style="border:2px solid ${B};background:${W};padding:12px 14px;margin-bottom:14px;">
              <p style="font-size:8px;letter-spacing:0.2em;text-transform:uppercase;color:${B};opacity:0.5;margin:0 0 4px;font-weight:700;">FRANKIE SUGGESTS</p>
              <p style="font-size:12px;color:${B};opacity:0.8;line-height:1.5;margin:0;font-style:italic;font-weight:500;">${frankiePick.reason}</p>
            </div>`
          : '';

        const emailBody = `<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;background:${W};padding:28px 22px;">
  <div style="border-bottom:3px solid ${B};padding-bottom:14px;margin-bottom:20px;">
    <p style="font-weight:900;font-size:14px;letter-spacing:2px;color:${B};margin:0;">HI FRANKIE</p>
    <p style="font-size:10px;letter-spacing:1.5px;color:${B};opacity:0.5;margin-top:4px;">YOUR MORNING EDIT \u2014 ${todayName.toUpperCase()}</p>
  </div>
  ${weatherStr ? `<p style="font-size:12px;color:${B};opacity:0.6;margin:0 0 12px;">Today's weather: ${weatherStr}</p>` : ''}
  <p style="font-size:14px;color:${B};line-height:1.6;margin:0 0 18px;">${dayNote}</p>
  ${outfitBlocks}
  ${pickReason}
  <a href="https://stylescrap-daily-edit.base44.app/todays-edit" style="display:block;border:3px solid ${B};background:${B};color:${W};padding:16px;text-align:center;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.5px;margin-bottom:14px;">Open the app \u2014 edit these looks or start fresh &rarr;</a>
  <p style="font-size:13px;color:${B};opacity:0.7;margin:0 0 4px;font-style:italic;">xx Frankie</p>
  <p style="font-size:11px;color:${B};opacity:0.4;margin:0;">Your resident stylist at Frankie</p>
</div>`;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email,
          from_name: 'HI FRANKIE',
          subject: `Your Morning Edit \u2014 3 looks for ${todayName}`,
          body: emailBody,
        });

        results.push({ email: u.email, status: 'sent', outfits: outfits.length });
      } catch (err) {
        results.push({ email: u.email, status: 'error', error: err.message });
      }
    }

    return Response.json({ sent: results.filter((r) => r.status === 'sent').length, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default handler;
