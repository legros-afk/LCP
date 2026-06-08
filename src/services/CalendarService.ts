export type CalEventType = 'work' | 'meal' | 'social' | 'birthday' | 'other';

export interface CalEvent {
  id: string;
  summary: string;
  type: CalEventType;
  start: Date;
  end: Date;
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

function classifyEvent(summary: string): CalEventType {
  const s = summary.toLowerCase();
  if (/birth|bday|anniversaire/.test(s)) return 'birthday';
  if (/lunch|dinner|breakfast|eat|repas|déjeuner|dîner/.test(s)) return 'meal';
  if (/party|drinks|apéro|sortie|social|friend|fête/.test(s)) return 'social';
  if (/meet|call|standup|sync|review|interview|work|réunion|entretien/.test(s)) return 'work';
  return 'other';
}

class CalendarService {
  private token: string | null = null;
  private events: CalEvent[] = [];
  private tokenClient: google.accounts.oauth2.TokenClient | null = null;
  public isConnected = false;
  public isAvailable = !!CLIENT_ID;

  init(): void {
    if (!this.isAvailable) return;
    // @ts-expect-error — loaded at runtime
    this.tokenClient = window.google?.accounts?.oauth2?.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (resp: { access_token?: string; error?: string }) => {
        if (resp.access_token) {
          this.token = resp.access_token;
          this.isConnected = true;
          this.fetchToday();
        }
      },
    });
  }

  requestAccess(): void {
    this.tokenClient?.requestAccessToken();
  }

  async fetchToday(): Promise<void> {
    if (!this.token) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();

    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
        `?timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${this.token}` } },
      );
      if (!res.ok) { this.token = null; this.isConnected = false; return; }
      const data = await res.json() as { items?: { id: string; summary?: string; start: { dateTime?: string; date?: string }; end: { dateTime?: string; date?: string } }[] };
      this.events = (data.items ?? []).map(item => ({
        id: item.id,
        summary: item.summary ?? '(no title)',
        type: classifyEvent(item.summary ?? ''),
        start: new Date(item.start.dateTime ?? item.start.date ?? ''),
        end:   new Date(item.end.dateTime   ?? item.end.date   ?? ''),
      }));
    } catch {
      // silently ignore network errors
    }
  }

  getActiveEvent(): CalEvent | null {
    const now = new Date();
    return this.events.find(e => e.start <= now && e.end > now) ?? null;
  }

  getNextEvent(): CalEvent | null {
    const now = new Date();
    return this.events.find(e => e.start > now) ?? null;
  }

  getEvents(): CalEvent[] { return this.events; }
}

// google type stub so TS doesn't complain
declare namespace google.accounts.oauth2 {
  interface TokenClient { requestAccessToken(): void }
  function initTokenClient(cfg: object): TokenClient;
}

export const calendarService = new CalendarService();
