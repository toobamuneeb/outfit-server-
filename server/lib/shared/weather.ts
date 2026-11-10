// @ts-nocheck: web app code, kept as written
// Weather for an Australia-only app. Primary source is the Australian Bureau
// of Meteorology (BOM) JSON API (api.weather.bom.gov.au), which gives the
// official forecasts + live observations the BOM app itself uses — far more
// accurate for Australian suburbs than the global open-meteo model. If BOM
// can't resolve a location or a requested date is outside BOM's ~7-day
// forecast window, we fall back to open-meteo (forecast + historical archive)
// so the flow never breaks.

const BOM_BASE = 'https://api.weather.bom.gov.au/v1';

async function fetchWithRetry(url, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok) return await res.json();
      if (res.status === 429 && attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      console.error(`Weather API ${res.status}: ${await res.text().catch(() => '')}`);
      return null;
    } catch (err) {
      console.error(`Weather fetch error (attempt ${attempt + 1}):`, err.message);
      if (attempt < retries - 1) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return null;
}

const AU_STATE_BY_CODE = {
  NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland',
  SA: 'South Australia', WA: 'Western Australia', TAS: 'Tasmania',
  ACT: 'Australian Capital Territory', NT: 'Northern Territory',
};

// BOM icon_descriptor → WMO weather code, so weatherDescription() (which keys
// off WMO codes) keeps working without changing any callers.
const BOM_DESCRIPTOR_TO_CODE = {
  clear: 0, sunny: 0, mostly_sunny: 1, partly_cloudy: 2, cloudy: 3,
  fog: 45, frost: 45, hazy: 2, smoke: 2, dusty: 2, dust: 2,
  shower: 80, showers: 80, rain: 63, drizzle: 51, light_rain: 61,
  snow: 73, hail: 95, storm: 95, thunderstorm: 95, thunder: 95,
  wind: 2, windy: 2,
};

function bomLocalDate(dateStr, tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(dateStr));
  } catch {
    // BOM encodes the day as local-midnight expressed in UTC (~14:00Z for AEST).
    // Shift forward 10h as a rough fallback to recover the local calendar date.
    const d = new Date(dateStr);
    d.setUTCHours(d.getUTCHours() + 10);
    return d.toISOString().slice(0, 10);
  }
}

function todayLocalDate(tz) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

// --- Geocode -------------------------------------------------------------
// Resolve a free-text Australian location to { latitude, longitude, geohash,
// timezone, name, state }. Uses BOM search (Australia-only, suburb accurate),
// then the BOM location-info endpoint for precise coords + timezone. Falls
// back to open-meteo geocoding if BOM can't resolve it.
export async function geocode(location) {
  if (location && typeof location === 'string') {
    const trimmed = location.trim();
    try {
      // BOM search matches on the place-name token, not a full address — so
      // feed it the first comma segment (the suburb) and disambiguate by
      // postcode/state if the user included them.
      const name = (trimmed.split(',')[0] || trimmed).trim();
      if (name.length >= 3) {
        const data = await fetchWithRetry(`${BOM_BASE}/locations?search=${encodeURIComponent(name)}`);
        let matches = data?.data || [];
        if (matches.length) {
          const parts = trimmed.split(',').map((p) => p.trim());
          const postcode = parts.find((p) => /^\d{4}$/.test(p));
          const stateCode = parts.find((p) => AU_STATE_BY_CODE[p]);
          if (postcode) {
            const f = matches.filter((m) => m.postcode === postcode);
            if (f.length) matches = f;
          } else if (stateCode) {
            const f = matches.filter((m) => m.state === stateCode);
            if (f.length) matches = f;
          }
          const best = matches[0];
          const info = await fetchWithRetry(`${BOM_BASE}/locations/${best.geohash}`);
          const id = info?.data;
          if (id && typeof id.latitude === 'number') {
            return {
              latitude: id.latitude,
              longitude: id.longitude,
              geohash: id.geohash || best.geohash,
              timezone: id.timezone || 'Australia/Sydney',
              name: id.name || best.name,
              state: id.state || best.state,
            };
          }
          // Search hit but location info failed — we still have a usable
          // geohash for forecasts; coords fall back to open-meteo below.
          const fallback = await openMeteoGeocode(trimmed);
          return { ...fallback, geohash: best.geohash, timezone: 'Australia/Sydney', name: best.name, state: best.state };
        }
      }
    } catch (err) {
      console.error('BOM geocode failed:', err.message);
    }
  }
  return openMeteoGeocode(location);
}

async function openMeteoGeocode(location) {
  const search = async (name) => {
    const data = await fetchWithRetry(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=20&language=en&format=json`);
    return (data && data.results) || [];
  };
  let results = await search(location);
  if (results.length === 0 && location && location.includes(',')) {
    const parts = location.split(',').map((p) => p.trim());
    if (parts[0]) results = await search(parts[0]);
    const stateCode = parts.find((p) => AU_STATE_BY_CODE[p]);
    if (stateCode) {
      const stateName = AU_STATE_BY_CODE[stateCode];
      const filtered = results.filter((r) => r.country_code === 'AU' && r.admin1 === stateName);
      if (filtered.length) results = filtered;
    } else if (parts.some((p) => p === 'Australia')) {
      const filtered = results.filter((r) => r.country_code === 'AU');
      if (filtered.length) results = filtered;
    }
  }
  if (results.length === 0) return { latitude: -33.87, longitude: 151.21 };
  const best = results.slice().sort((a, b) => (b.population || 0) - (a.population || 0))[0];
  return { latitude: best.latitude, longitude: best.longitude };
}

// --- Multi-day forecast -------------------------------------------------
export async function getWeather(coords, days = 7, startDate) {
  const lat = coords?.latitude;
  const lon = coords?.longitude;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = startDate ? new Date(startDate) : today;
  start.setHours(0, 0, 0, 0);

  // BOM only covers ~7 days ahead and has no past data. Only use it when the
  // whole requested window is within that range; otherwise fall through to
  // open-meteo (which handles past dates via the archive and up to 16 days).
  const startIsFutureOrToday = start.getTime() >= today.getTime();
  const withinBomWindow = (start.getTime() - today.getTime()) <= 6 * 86400000;
  if (coords?.geohash && startIsFutureOrToday && withinBomWindow) {
    const bom = await bomDailyMap(coords);
    if (bom) {
      // Verify every requested day is covered; if BOM came up short (edge of
      // the window), fall back to open-meteo for the full range.
      const end = new Date(start);
      end.setDate(end.getDate() + Math.max(days - 1, 0));
      const fmt = (dt) => dt.toISOString().slice(0, 10);
      let allCovered = true;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (!bom[fmt(d)]) { allCovered = false; break; }
      }
      if (allCovered) return bom;
    }
  }
  return openMeteoWeather(lat, lon, days, startDate);
}

async function bomDailyMap(coords) {
  try {
    const fc = await fetchWithRetry(`${BOM_BASE}/locations/${coords.geohash}/forecasts/daily`);
    if (!fc?.data?.length) return null;
    const tz = coords.timezone || 'Australia/Sydney';
    const map = {};
    for (const entry of fc.data) {
      const d = bomLocalDate(entry.date, tz);
      map[d] = {
        temp_max: entry.temp_max ?? null,
        temp_min: entry.temp_min ?? null,
        precip: entry.rain?.chance ?? 0,
        code: BOM_DESCRIPTOR_TO_CODE[entry.icon_descriptor] ?? 1,
      };
    }
    return map;
  } catch (err) {
    console.error('BOM daily forecast failed:', err.message);
    return null;
  }
}

async function openMeteoWeather(lat, lon, days = 7, startDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let url;
  let isArchive = false;

  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((start - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0 || diffDays > 14) {
      isArchive = true;
      const archiveStart = new Date(start);
      if (diffDays > 14) archiveStart.setFullYear(archiveStart.getFullYear() - 1);
      const archiveEnd = new Date(archiveStart);
      archiveEnd.setDate(archiveEnd.getDate() + Math.max(days - 1, 0));
      const fmt = (dt) => dt.toISOString().slice(0, 10);
      url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${fmt(archiveStart)}&end_date=${fmt(archiveEnd)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto`;
    } else {
      const end = new Date(start);
      end.setDate(end.getDate() + Math.max(days - 1, 0));
      const fmt = (dt) => dt.toISOString().slice(0, 10);
      url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=auto&start_date=${fmt(start)}&end_date=${fmt(end)}`;
    }
  } else {
    url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=auto&forecast_days=${days}`;
  }

  let data = await fetchWithRetry(url);

  if (!data && !isArchive) {
    const fmt = (dt) => dt.toISOString().slice(0, 10);
    let archiveStart = new Date(startDate ? startDate : today);
    archiveStart.setHours(0, 0, 0, 0);
    archiveStart.setFullYear(archiveStart.getFullYear() - 1);
    const archiveEnd = new Date(archiveStart);
    archiveEnd.setDate(archiveEnd.getDate() + Math.max(days - 1, 0));
    const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${fmt(archiveStart)}&end_date=${fmt(archiveEnd)}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto`;
    data = await fetchWithRetry(archiveUrl);
    isArchive = true;
  }

  if (!data) return {};
  const weather = {};
  const d = data.daily;
  if (d) {
    for (let i = 0; i < d.time.length; i++) {
      let precip;
      if (isArchive) {
        const mm = d.precipitation_sum?.[i] || 0;
        precip = mm === 0 ? 0 : mm < 1 ? 20 : mm < 5 ? 50 : 80;
      } else {
        precip = d.precipitation_probability_max?.[i] || 0;
      }
      weather[d.time[i]] = {
        temp_max: d.temperature_2m_max[i],
        temp_min: d.temperature_2m_min[i],
        precip,
        code: d.weathercode[i],
      };
    }
  }
  return weather;
}

// --- Today's weather -----------------------------------------------------
export async function getTodayWeather(coords) {
  if (coords?.geohash) {
    try {
      const tz = coords.timezone || 'Australia/Sydney';
      const fc = await fetchWithRetry(`${BOM_BASE}/locations/${coords.geohash}/forecasts/daily`);
      if (fc?.data?.length) {
        const todayKey = todayLocalDate(tz);
        const today = fc.data.find((e) => bomLocalDate(e.date, tz) === todayKey) || fc.data[0];
        // Live observation (needs a 6-char geohash). Best-effort — if there's
        // no nearby station we still have the forecast's "now" reading.
        const obs = await fetchWithRetry(`${BOM_BASE}/locations/${String(coords.geohash).slice(0, 6)}/observations`);
        const o = obs?.data || {};
        return {
          temp_max: today.temp_max ?? today.now?.temp_now ?? null,
          temp_min: today.temp_min ?? today.now?.temp_later ?? null,
          precip: today.rain?.chance ?? 0,
          code: BOM_DESCRIPTOR_TO_CODE[today.icon_descriptor] ?? 1,
          current_temp: o.temp ?? today.now?.temp_now,
          humidity: o.humidity,
          wind: o.wind?.speed_kilometre,
          short_text: today.short_text,
          _fallback: false,
          _source: 'bom',
        };
      }
    } catch (err) {
      console.error('BOM today weather failed:', err.message);
    }
  }
  return openMeteoToday(coords?.latitude, coords?.longitude);
}

async function openMeteoToday(lat, lon) {
  const today = new Date();
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,precipitation,relative_humidity_2m,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode&timezone=auto&forecast_days=1`;
  let data = await fetchWithRetry(url);

  if (data?.daily?.time?.length) {
    const d = data.daily;
    const cur = data.current || {};
    return {
      temp_max: d.temperature_2m_max[0],
      temp_min: d.temperature_2m_min[0],
      precip: d.precipitation_probability_max?.[0] || 0,
      code: (typeof cur.weather_code === 'number') ? cur.weather_code : d.weathercode[0],
      current_temp: cur.temperature_2m,
      humidity: cur.relative_humidity_2m,
      wind: cur.wind_speed_10m,
      _fallback: false,
    };
  }

  const tz = data?.timezone || 'auto';
  const localYMD = new Intl.DateTimeFormat('en-CA', { timeZone: tz === 'auto' ? undefined : tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);
  const ly = new Date(localYMD + 'T00:00:00Z');
  ly.setFullYear(ly.getFullYear() - 1);
  const lyStr = ly.toISOString().slice(0, 10);
  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${lyStr}&end_date=${lyStr}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&timezone=auto`;
  const archiveData = await fetchWithRetry(archiveUrl);
  if (archiveData?.daily?.time?.length) {
    const mm = archiveData.daily.precipitation_sum?.[0] || 0;
    return {
      temp_max: archiveData.daily.temperature_2m_max[0],
      temp_min: archiveData.daily.temperature_2m_min[0],
      precip: mm === 0 ? 0 : mm < 1 ? 20 : mm < 5 ? 50 : 80,
      code: archiveData.daily.weathercode[0],
      _fallback: true,
    };
  }

  const month = today.getMonth();
  const isWarm = lat < 0 ? (month >= 9 || month <= 2) : (month >= 3 && month <= 8);
  return {
    temp_min: isWarm ? 18 : 8,
    temp_max: isWarm ? 28 : 16,
    precip: 20,
    code: isWarm ? 1 : 3,
    _fallback: true,
  };
}

export function weatherDescription(code) {
  const map = {
    0: 'clear sky', 1: 'mainly clear', 2: 'partly cloudy', 3: 'overcast',
    45: 'fog', 48: 'fog', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
    61: 'light rain', 63: 'rain', 65: 'heavy rain', 71: 'light snow', 73: 'snow', 75: 'heavy snow',
    80: 'rain showers', 81: 'rain showers', 82: 'heavy rain showers',
    95: 'thunderstorm', 96: 'thunderstorm', 99: 'thunderstorm',
  };
  return map[code] || 'mild';
}