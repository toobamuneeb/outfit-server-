// @ts-nocheck: web app code, kept as written
import { serve } from '../shared/policy';
import { createClientFromRequest } from '../shared/compat';
import { geocode, getTodayWeather, weatherDescription } from '../shared/weather';
import { hydrateOutfitItems, isComplete, buildInventory } from '../shared/outfitUtils';
import { fetchTodayIcsEvents } from '../shared/ics';

const handler = async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const differentToday = (body.different_today || '').trim();
    const feedback = (body.feedback || '').trim();

    // Compute today in the USER'S timezone, not the server's UTC. The server
    // runs in UTC, so new Date().getDay() would return yesterday during an
    // Australian morning — and Frankie would write notes about the wrong day.
    const tz = user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const _now = new Date();
    // Display parts: weekday + day + month name (e.g. "Tuesday", "15", "September")
    const _dispParts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long' }).formatToParts(_now);
    const _disp = (t) => (_dispParts.find(p => p.type === t) || {}).value || '';
    const todayName = _disp('weekday');
    const todayKey = (todayName || '').toLowerCase();
    const todayDateStr = `${_disp('day')} ${_disp('month')}`;
    // Numeric parts for date arithmetic + offset (24h)
    const _numParts = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(_now);
    const _g = (t) => parseInt((_numParts.find(p => p.type === t) || {}).value, 10);
    const localYMD = `${_g('year')}-${String(_g('month')).padStart(2, '0')}-${String(_g('day')).padStart(2, '0')}`;
    // Offset (minutes) of the user's timezone from UTC right now — robust
    // regardless of the server's own timezone.
    const offsetMin = Math.round((Date.UTC(_g('year'), _g('month') - 1, _g('day'), _g('hour'), _g('minute'), _g('second')) - _now.getTime()) / 60000);
    const [ly, lm, ld] = localYMD.split('-').map(Number);
    const todayStart = new Date(Date.UTC(ly, lm - 1, ld, 0, 0, 0) - offsetMin * 60000);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // 1. Get today's calendar events (Google Calendar, if connected)
    let events = [];
    let calendarConnected = false;
    try {
      const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection('6aa74e7d8ba042affa150d66');
      if (accessToken) {
        calendarConnected = true;
        const calRes = await fetch(
          'https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=' +
            todayStart.toISOString() + '&timeMax=' + todayEnd.toISOString() +
            '&singleEvents=true&orderBy=startTime&maxResults=20',
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (calRes.ok) {
          const data = await calRes.json();
          events = (data.items || []).map(e => ({
            title: e.summary || 'Untitled',
            start: e.start.dateTime || e.start.date,
            end: e.end?.dateTime || e.end?.date,
          }));
        }
      }
    } catch (e) {
      // Calendar not connected — fall back to weekly rhythm
    }

    // 1b. Apple Calendar (iCloud shared ICS feed) — for users who linked
    //     Apple instead of Google. Only used if Google didn't return events.
    if (events.length === 0 && user.apple_calendar_ics_url) {
      try {
        const icsEvents = await fetchTodayIcsEvents(
          user.apple_calendar_ics_url,
          user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
        );
        if (icsEvents.length > 0) {
          events = icsEvents;
          calendarConnected = true;
        }
      } catch (e) {
        // ICS fetch failed — continue without it
      }
    }

    // 2. Get weather
    const location = user.location;
    let weatherStr = '';
    if (location) {
      try {
        const coords = await geocode(location);
        const todayWeather = await getTodayWeather(coords);
        const curTemp = todayWeather.current_temp != null ? ` Currently ${Math.round(todayWeather.current_temp)}\u00b0C.` : '';
        weatherStr = `${todayWeather.temp_min}\u2013${todayWeather.temp_max}\u00b0C, ${weatherDescription(todayWeather.code)}, ${todayWeather.precip}% rain${curTemp}${todayWeather._fallback ? ' (est.)' : ''}`;
      } catch (e) {
        // Weather unavailable — continue without it
      }
    }

    // 3. Get wardrobe
    const items = await base44.entities.WardrobeItem.list('-updated_date', 200);
    if (!items || items.length === 0) {
      return Response.json({ error: 'Your wardrobe is empty. Add some pieces first!' }, { status: 400 });
    }

    // 4. Get recent outfits (memory + wear history)
    const recentOutfits = await base44.entities.Outfit.list('-created_date', 20);
    const wornItemIds = new Set();
    recentOutfits.forEach(o => {
      (o.items || []).forEach(i => { if (i.item_id) wornItemIds.add(i.item_id); });
    });

    // 5. Build inventory with wear history
    const inventory = buildInventory(items, wornItemIds);

    // 6. Determine today's typical day from the weekly rhythm (timezone-aware)
    const weeklyRhythm = user.weekly_rhythm || {};
    const todaysRhythm = weeklyRhythm[todayKey] || user.typical_day || '';

    const rhythmBlock = todaysRhythm.trim()
      ? `\nTheir usual ${todayName}: ${todaysRhythm}\n`
      : '';

    // 7. Style profile
    const profileParts = [];
    if (user.style_vibe && user.style_vibe.length > 0) {
      profileParts.push(`Preferred style aesthetics: ${user.style_vibe.join(', ')}.`);
    }
    if (user.fit_preference && user.fit_preference !== 'mixed') {
      profileParts.push(`Preferred fit: ${user.fit_preference}.`);
    }
    if (user.style_icons && user.style_icons.trim()) {
      profileParts.push(`Style muses / icons: ${user.style_icons.trim()}.`);
    }
    if (user.location_climate && user.location_climate.length > 0) {
      profileParts.push(`Where they live / climate: ${user.location_climate.join(', ')}.`);
    }
    if (user.outfit_feel && user.outfit_feel.length > 0) {
      profileParts.push(`How they want outfits to feel: ${user.outfit_feel.join(', ')}.`);
    }
    if (user.frankie_should_know && user.frankie_should_know.length > 0) {
      profileParts.push(`Things to keep in mind: ${user.frankie_should_know.join('; ')}.`);
    }
    if (user.your_rules && user.your_rules.trim()) {
      profileParts.push(`Their hard rules: ${user.your_rules.trim()}.`);
    }
    if (user.repeat_tolerance) {
      const repeatMap = {
        repeat_favourites: "doesn't mind repeating favourite looks",
        little_variety: 'likes a little variety',
        keep_fresh: 'wants things kept feeling fresh',
      };
      profileParts.push(`Outfit repeat tolerance: ${repeatMap[user.repeat_tolerance] || user.repeat_tolerance}.`);
    }
    if (typeof user.adventurous === 'number') {
      const adv = user.adventurous;
      const advLabel = adv < 25 ? 'plays it safe' : adv < 60 ? 'likes a little adventure' : adv < 85 ? 'is adventurous' : 'is fully experimental';
      profileParts.push(`How adventurous to be: ${advLabel} (${adv}/100).`);
    }
    const profileGuidance = profileParts.length > 0
      ? `\nThe wearer's personal style profile:\n${profileParts.join('\n')}\n`
      : '';

    const weatherBlock = weatherStr
      ? `\nTODAY'S WEATHER: ${weatherStr}\n`
      : '';

    const memoryBlock = recentOutfits.length > 0
      ? `\nRecent looks (don't repeat verbatim \u2014 reference naturally if it fits):\n${recentOutfits.slice(0, 6).map(o => `- "${o.title}"${o.occasion ? ` (${o.occasion})` : ''}`).join('\n')}\n`
      : '';

    const unwornItems = inventory.filter(it => !it.worn_recently);
    const unwornBlock = unwornItems.length > 0
      ? `\nPieces they haven't worn recently (prioritise these to refresh their rotation):\n${unwornItems.map(it => `- ${it.name}`).join('\n')}\n`
      : '';

    const hasEvents = events.length > 0;

    let eventBlock = '';
    if (hasEvents) {
      eventBlock = `\nTODAY'S CALENDAR:\n${events.map(e => {
        const time = e.start.includes('T') ? e.start.split('T')[1].slice(0, 5) : 'all-day';
        return `${time} \u2014 ${e.title}`;
      }).join('\n')}\n`;
    }

    const differentBlock = differentToday
      ? `\nTHE CLIENT SAYS TODAY IS DIFFERENT:\n"${differentToday}"\nThis overrides their usual day \u2014 dress them for what they've described, not their typical ${todayName}.\n`
      : '';

    const feedbackBlock = feedback
      ? `\nTHE CLIENT WASN'T FEELING THE LAST SET OF LOOKS. Their one-word feedback: "${feedback}". Take this on board \u2014 adjust the mood, dressiness, or how experimental the new set is, while still dressing them for their day. Don't repeat the same combinations.\n`
      : '';

    const itemMap = new Map(items.map(it => [it.id, it]));

    const basePrompt = `You are the stylist at Frankie. You're warm, witty, a little cheeky, and genuinely obsessed with helping your client look and feel incredible. You speak like a chic, supportive best friend who happens to have killer taste \u2014 never robotic, never generic. You hype them up, you notice the little things, and you make styling feel fun and personal.

It's ${todayName}, ${todayDateStr}. They just opened the app and tapped "What have I got today?" \u2014 they want you to dress them for the day ahead.

${weatherBlock}${eventBlock}${rhythmBlock}${differentBlock}${feedbackBlock}${profileGuidance}${memoryBlock}${unwornBlock}

Their wardrobe:
${JSON.stringify(inventory, null, 2)}
`;

    const jsonSchema = {
      type: 'object',
      properties: {
        timeline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              time: { type: 'string', description: 'HH:MM format, e.g. 09:00' },
              activity: { type: 'string', description: 'Short label, e.g. Work, Lunch, Dinner' },
            },
            required: ['time', 'activity'],
          },
        },
        day_note: {
          type: 'string',
          description: "Frankie's opening line for the day \u2014 warm, first person, references the weather or the day ahead.",
        },
        outfits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              occasion: { type: 'string' },
              description: { type: 'string', description: 'Stylist note in Frankie\u2019s warm, witty first-person voice' },
              stylist_reasoning: { type: 'string', description: 'Why this outfit works for the day ahead \u2014 reference the day\u2019s activities, weather, and how it carries through. First person.' },
              styling_tips: { type: 'array', items: { type: 'string' }, description: '3-5 specific, actionable styling moves for this look' },
              weather_contingency: { type: 'string', description: 'A practical swap if the weather shifts \u2014 e.g. "If it rains, swap the sandals for your white sneakers." First person, 1 sentence. Empty string if the weather is stable and no contingency is needed.' },
              style_category: { type: 'string' },
              item_ids: { type: 'array', items: { type: 'string' } },
              easy_transition: {
                type: 'object',
                description: 'Only include when the day genuinely shifts to a different activity needing a change of clothes or extra pieces (work\u2192workout, coffee\u2192beach, desk\u2192drinks). Omit/null when the day is one continuous activity.',
                properties: {
                  note: { type: 'string', description: 'What to pack and why \u2014 warm, practical, first person. e.g. "Pack your activewear set and sneakers to change into after your 2pm meetings."' },
                  item_ids: { type: 'array', items: { type: 'string' }, description: 'Real wardrobe item IDs for the transition pieces to pack' },
                },
              },
            },
            required: ['title', 'occasion', 'description', 'stylist_reasoning', 'styling_tips', 'weather_contingency', 'style_category', 'item_ids'],
          },
        },
        frankie_pick: {
          type: 'object',
          properties: {
            look_number: { type: 'integer' },
            reason: { type: 'string' },
          },
        },
      },
      required: ['timeline', 'day_note', 'outfits'],
    };

    const prompt = `${basePrompt}
${differentToday
  ? `Today is different from their usual ${todayName} \u2014 they've told you what's on. Create 3 distinct outfit options based on what they've described, the weather, and their wardrobe.`
  : `Create 3 distinct outfit options for their ${hasEvents ? 'day \u2014 use the calendar events as context layered on top of their usual day' : 'usual day'} \u2014 each should feel different in mood/vibe but all appropriate for their typical activities and today's weather.`}

Each outfit must be a COMPLETE head-to-toe look: a top half AND a bottom half AND shoes. A single top or bra alone is NEVER a complete outfit.

For each outfit, include a weather_contingency \u2014 a practical swap if the weather shifts. For example: "If it rains, swap the sandals for your white sneakers" or "If it heats up, lose the blazer and roll your sleeves." Only include a contingency when the weather actually warrants one (rain, heat, cold, wind). Use an empty string if the weather is stable and mild. Reference real items from their wardrobe in the contingency when possible.

For each outfit, include an easy_transition ONLY when the day genuinely shifts to a different activity that needs a change of clothes or extra pieces \u2014 e.g. work meetings followed by a workout (pack activewear + sneakers), a coffee date then a beach walk (pack flip flops, a hat, sunglasses), desk-to-drinks (pack a heel or lip swap). When included, set easy_transition.note to a warm, practical first-person line about what to pack and why, and set easy_transition.item_ids to the real wardrobe item IDs for those pieces. If the day is one continuous activity with no real transition, omit easy_transition entirely (null).

For each outfit, give 3-5 specific, actionable styling_tips \u2014 the little moves that elevate the look and teach the client how to think about styling. Be concrete and reference the actual pieces: how to tuck or half-tuck a shirt, roll sleeves or hems, the layering order, proportions to play with (e.g. a cropped top over a high-rise trouser), which accessories to add or strip back, how to transition the look from desk to drinks, and a quick hair or makeup suggestion when it suits. Avoid generic advice \u2014 make each tip specific to the pieces in the outfit.

Also provide a day timeline \u2014 the key moments in their day with times and brief labels. ${hasEvents ? 'Use the calendar events to build this.' : todaysRhythm.trim() ? 'Build this from their usual day description.' : 'Infer a reasonable day.'} Keep it to 3-5 key moments. Format: [{time: "09:00", activity: "Work"}, ...].

Write a day_note \u2014 your opening line to them this morning. Warm, first person, reference the weather or what's on. 1-2 sentences.

After creating all 3 outfits, choose YOUR favourite \u2014 the one you'd actually recommend if they asked "which one would you pick?" Set frankie_pick.look_number to 1, 2, or 3, and write frankie_pick.reason in your voice \u2014 warm, opinionated, specific. Don't be neutral \u2014 have an opinion.

Return JSON with: timeline (array), day_note (string), outfits (array with exactly 3 outfits), frankie_pick ({look_number, reason}).`;

    let result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: jsonSchema,
    });

    let outfits = (result.outfits || []).map((o) => ({
      ...o,
      items: hydrateOutfitItems(o.item_ids, itemMap),
      easy_transition: o.easy_transition && Array.isArray(o.easy_transition.item_ids) && o.easy_transition.item_ids.length > 0
        ? { note: o.easy_transition.note || '', items: hydrateOutfitItems(o.easy_transition.item_ids, itemMap) }
        : null,
    }));

    // Retry once if any outfit came back incomplete
    if (!outfits.every(o => isComplete(o.items))) {
      const problems = outfits
        .map((o, i) => isComplete(o.items) ? null : `Outfit ${i+1} ("${o.title}") only has [${o.items.map(it => it.category).join(', ')}] \u2014 missing a top or bottom half. Rebuild with a complete top + bottom + shoes.`)
        .filter(Boolean);
      const retryPrompt = prompt + `\n\nCORRECTION \u2014 your last attempt was incomplete:\n${problems.join('\n')}\n\nEvery outfit MUST contain a top half AND a bottom half AND shoes. Fix and return the full set.`;
      result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: retryPrompt,
        response_json_schema: jsonSchema,
      });
      outfits = (result.outfits || []).map((o) => ({
        ...o,
        items: hydrateOutfitItems(o.item_ids, itemMap),
        easy_transition: o.easy_transition && Array.isArray(o.easy_transition.item_ids) && o.easy_transition.item_ids.length > 0
          ? { note: o.easy_transition.note || '', items: hydrateOutfitItems(o.easy_transition.item_ids, itemMap) }
          : null,
      }));
    }

    return Response.json({
      timeline: result.timeline || [],
      day_note: result.day_note || '',
      outfits,
      frankie_pick: result.frankie_pick || null,
      weather: weatherStr,
      calendar_connected: calendarConnected,
      has_events: hasEvents,
      different_today: differentToday,
      feedback,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export default serve('getTodaysEdit', handler);
