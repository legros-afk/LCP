// Cloudflare Worker: serves the built game assets plus /api/events,
// a sanitized read-only feed of the owner's Google Calendar.
//
// Secrets (set via `wrangler secret put`):
//   GOOGLE_CLIENT_ID      — OAuth web client id
//   GOOGLE_CLIENT_SECRET  — OAuth client secret
//   GOOGLE_REFRESH_TOKEN  — refresh token for the owner's account
//
// Visitors never authenticate. Raw event titles, attendees, and locations
// never leave this Worker — only { type, start, end, label } where label
// is a generic name, or "<FirstName>'s birthday" for birthday events.

interface Env {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REFRESH_TOKEN: string;
  ASSETS: { fetch(req: Request): Promise<Response> };
}

type CalEventType =
  | 'work' | 'meal' | 'social' | 'birthday'
  | 'exercise' | 'health' | 'travel' | 'entertainment' | 'other';

const GENERIC_LABELS: Record<CalEventType, string> = {
  work:          'Work',
  meal:          'Mealtime',
  social:        'Social plans',
  birthday:      'A birthday',
  exercise:      'Exercise',
  health:        'An appointment',
  travel:        'Travel',
  entertainment: 'Entertainment',
  other:         'Busy',
};

function classifyEvent(summary: string): CalEventType {
  const s = summary.toLowerCase();
  if (/birth|bday|anniversaire/.test(s))                                  return 'birthday';
  if (/gym|workout|run|jog|yoga|fitness|sport|exercise|pilates|swim/.test(s)) return 'exercise';
  if (/doctor|dentist|physio|médecin|médical|checkup|appointment|hospital|clinic/.test(s)) return 'health';
  if (/flight|travel|trip|holiday|vacation|airport|hotel|train|voyage|vacances/.test(s)) return 'travel';
  if (/cinema|movie|film|concert|theatre|theater|show|gig|spectacle/.test(s)) return 'entertainment';
  if (/lunch|dinner|breakfast|eat|repas|déjeuner|dîner|restaurant|brunch/.test(s)) return 'meal';
  if (/party|drinks|apéro|sortie|friend|fête|soirée|gathering|hangout/.test(s)) return 'social';
  if (/meet|call|standup|sync|review|interview|work|réunion|entretien|sprint|demo/.test(s)) return 'work';
  return 'other';
}

// First name only — strips birthday words and possessives, takes the first word
function extractFirstName(summary: string): string {
  const cleaned = summary
    .replace(/\b(?:happy\s+)?birth(?:day)?\b/gi, '')
    .replace(/\banniversaire(?:\s+de)?\b/gi, '')
    .replace(/\bbday\b/gi, '')
    .replace(/['’]s\b/gi, '')
    .replace(/[:!\-–—.,]/g, ' ')
    .replace(/\b(?:de|of|the|my|le|la)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const first = cleaned.split(' ')[0] ?? '';
  if (!first) return 'Someone';
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

// Module-scope token cache — survives across requests within an isolate
let cachedAccessToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(env: Env): Promise<string | null> {
  if (cachedAccessToken && Date.now() < tokenExpiry - 60_000) return cachedAccessToken;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) return null;
  const data = await res.json() as { access_token?: string; expires_in?: number };
  if (!data.access_token) return null;
  cachedAccessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in ?? 3600) * 1000;
  return cachedAccessToken;
}

async function handleEvents(env: Env): Promise<Response> {
  const token = await getAccessToken(env);
  if (!token) {
    return Response.json({ events: [], error: 'calendar_unavailable' }, { status: 502 });
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
    `?timeMin=${encodeURIComponent(start)}&timeMax=${encodeURIComponent(end)}` +
    `&singleEvents=true&orderBy=startTime&maxResults=50`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    return Response.json({ events: [], error: 'calendar_unavailable' }, { status: 502 });
  }

  const data = await res.json() as {
    items?: {
      summary?: string;
      start: { dateTime?: string; date?: string };
      end:   { dateTime?: string; date?: string };
    }[];
  };

  // Sanitize: type + times + generic label only. Raw titles stay here.
  const events = (data.items ?? []).map((item, i) => {
    const type = classifyEvent(item.summary ?? '');
    const label = type === 'birthday'
      ? `${extractFirstName(item.summary ?? '')}'s birthday`
      : GENERIC_LABELS[type];
    return {
      id: `ev${i}`,
      type,
      label,
      start: item.start.dateTime ?? item.start.date ?? '',
      end:   item.end.dateTime   ?? item.end.date   ?? '',
    };
  });

  return Response.json({ events }, {
    headers: { 'Cache-Control': 'public, max-age=300' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/events') {
      return handleEvents(env);
    }
    return env.ASSETS.fetch(request);
  },
};
