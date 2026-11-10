// @ts-nocheck: web app code, kept as written
// Fetches an iCloud (or any) shared ICS calendar feed and returns today's
// events in the same { title, start, end } shape as the Google Calendar
// integration, so the daily edit can consume either source interchangeably.

function pad(n: number): string { return String(n).padStart(2, '0'); }

// Today's date as YYYYMMDD in the user's timezone.
function todayYMD(timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
    return `${get('year')}${get('month')}${get('day')}`;
  } catch {
    const d = new Date();
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  }
}

interface ParsedDate { date: string; time: string | null; allDay: boolean; utc: boolean; }

function parseICSDate(value: string, params: Record<string, string>): ParsedDate {
  if (params.VALUE === 'DATE' || (value.length === 8 && !value.includes('T'))) {
    return { date: value, time: null, allDay: true, utc: false };
  }
  const utc = value.endsWith('Z');
  const clean = utc ? value.slice(0, -1) : value;
  const date = clean.slice(0, 8);
  const time = clean.includes('T') ? clean.split('T')[1].slice(0, 4) : null;
  return { date, time, allDay: false, utc };
}

// Convert a parsed ICS date to { date, time } in the user's timezone.
function toLocal(parsed: ParsedDate, timezone: string): { date: string; time: string | null } {
  if (parsed.allDay) return { date: parsed.date, time: null };
  if (!parsed.utc) {
    // Local / TZID time — the raw components are what the user entered.
    return { date: parsed.date, time: parsed.time };
  }
  try {
    const y = parsed.date.slice(0, 4), m = parsed.date.slice(4, 6), d = parsed.date.slice(6, 8);
    const hh = parsed.time ? parsed.time.slice(0, 2) : '00';
    const mm = parsed.time ? parsed.time.slice(2, 4) : '00';
    const dt = new Date(`${y}-${m}-${d}T${hh}:${mm}:00Z`);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(dt);
    const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
    return { date: `${get('year')}${get('month')}${get('day')}`, time: `${get('hour')}${get('minute')}` };
  } catch {
    return { date: parsed.date, time: parsed.time };
  }
}

function formatStart(date: string, time: string | null): string {
  const y = date.slice(0, 4), m = date.slice(4, 6), d = date.slice(6, 8);
  if (!time) return `${y}-${m}-${d}`;
  return `${y}-${m}-${d}T${time.slice(0, 2)}:${time.slice(2, 4)}`;
}

export interface CalendarEvent { title: string; start: string; end: string; }

export function parseIcsForToday(icsText: string, timezone: string): CalendarEvent[] {
  const today = todayYMD(timezone);
  const rawLines = icsText.split(/\r?\n/);
  // Unfold continuation lines (a line starting with space/tab continues the previous).
  const lines: string[] = [];
  for (const line of rawLines) {
    if (/^[ \t]/.test(line) && lines.length) lines[lines.length - 1] += line.slice(1);
    else lines.push(line);
  }
  const events: any[] = [];
  let inEvent = false;
  let cur: any = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { inEvent = true; cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); inEvent = false; cur = null; continue; }
    if (!inEvent || !cur) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const namePart = line.slice(0, colonIdx);
    const value = line.slice(colonIdx + 1);
    const semiIdx = namePart.indexOf(';');
    const name = (semiIdx === -1 ? namePart : namePart.slice(0, semiIdx)).toUpperCase();
    const params: Record<string, string> = {};
    if (semiIdx !== -1) {
      for (const p of namePart.slice(semiIdx + 1).split(';')) {
        const [k, v] = p.split('=');
        if (k) params[k.toUpperCase()] = v;
      }
    }
    if (name === 'SUMMARY') cur.title = value;
    else if (name === 'DTSTART') cur.startParsed = parseICSDate(value, params);
    else if (name === 'DTEND') cur.endParsed = parseICSDate(value, params);
  }
  const out: CalendarEvent[] = [];
  for (const e of events) {
    if (!e.startParsed || !e.title) continue;
    const local = toLocal(e.startParsed, timezone);
    if (local.date !== today) continue;
    const endLocal = e.endParsed ? toLocal(e.endParsed, timezone) : null;
    out.push({
      title: e.title,
      start: formatStart(local.date, local.time),
      end: endLocal ? formatStart(endLocal.date, endLocal.time) : '',
    });
  }
  out.sort((a, b) => (a.start.includes('T') ? a.start : '0').localeCompare(b.start.includes('T') ? b.start : '0'));
  return out;
}

export async function fetchTodayIcsEvents(icsUrl: string, timezone: string): Promise<CalendarEvent[]> {
  const { validatePublicUrl, safeFetchText } = await import('./ssrf.ts');
  // SSRF guard: only allow http(s) URLs pointing at public hosts -- never
  // internal/private/loopback/link-local addresses or cloud metadata endpoints.
  const safeUrl = await validatePublicUrl(icsUrl);
  if (!safeUrl) throw new Error('Only public http(s) calendar URLs are allowed');
  const result = await safeFetchText(safeUrl, {
    headers: { Accept: 'text/calendar' },
  });
  if (!result.ok) throw new Error('ICS fetch failed');
  return parseIcsForToday(result.text, timezone);
}

// --- Outbound ICS generation (for the iOS calendar subscription feed) ---

function escapeICS(text: string): string {
  return (text || '')
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function incrementTime(time: string, minutesToAdd: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutesToAdd;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return String(newH).padStart(2, '0') + String(newM).padStart(2, '0');
}

export function generateICS(outfits: any[]): string {
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//In.Robe//Outfit Calendar//EN\r\nCALSCALE:GREGORIAN\r\n';
  for (const o of outfits) {
    const dateStr = (o.date || '').replace(/-/g, '');
    const time = o.reminder_time || '08:00';
    const timeStr = time.replace(':', '');
    const endTimeStr = incrementTime(time, 15);
    ics += 'BEGIN:VEVENT\r\n';
    ics += `UID:${o.id}@inrobe.app\r\n`;
    ics += `DTSTART:${dateStr}T${timeStr}00\r\n`;
    ics += `DTEND:${dateStr}T${endTimeStr}00\r\n`;
    ics += `SUMMARY:In.Robe — ${escapeICS(o.outfit_title || 'Outfit')}\r\n`;
    ics += `DESCRIPTION:${escapeICS(o.outfit_description || '')}\r\n`;
    ics += 'BEGIN:VALARM\r\nTRIGGER:-PT0M\r\nACTION:DISPLAY\r\n';
    ics += `DESCRIPTION:${escapeICS('What to wear: ' + (o.outfit_title || 'Outfit'))}\r\n`;
    ics += 'END:VALARM\r\n';
    ics += 'END:VEVENT\r\n';
  }
  ics += 'END:VCALENDAR\r\n';
  return ics;
}