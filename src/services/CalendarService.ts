export type CalEventType =
  | 'work'
  | 'meal'
  | 'social'
  | 'birthday'
  | 'exercise'
  | 'health'
  | 'travel'
  | 'entertainment'
  | 'other';

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

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

class CalendarService {
  private token: string | null = null;
  private events: CalEvent[] = [];
  private tokenClient: google.accounts.oauth2.TokenClient | null = null;
  public isConnected = false;
  public isAvailable = !!CLIENT_ID;
  public onFetch?: () => void;

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

  // Fetch today + next 6 days so upcoming birthdays are visible
  async fetchToday(): Promise<void> {
    if (!this.token) return;
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();

    try {
      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events` +
        `?timeMin=${start}&timeMax=${end}&singleEvents=true&orderBy=startTime&maxResults=50`,
        { headers: { Authorization: `Bearer ${this.token}` } },
      );
      if (!res.ok) { this.token = null; this.isConnected = false; return; }
      const data = await res.json() as {
        items?: {
          id: string;
          summary?: string;
          start: { dateTime?: string; date?: string };
          end:   { dateTime?: string; date?: string };
        }[];
      };
      this.events = (data.items ?? []).map(item => ({
        id: item.id,
        summary: item.summary ?? '(no title)',
        type: classifyEvent(item.summary ?? ''),
        start: new Date(item.start.dateTime ?? item.start.date ?? ''),
        end:   new Date(item.end.dateTime   ?? item.end.date   ?? ''),
      }));
      this.onFetch?.();
    } catch {
      // silently ignore network errors
    }
  }

  // Events happening right now
  getActiveEvent(): CalEvent | null {
    const now = new Date();
    return this.events.find(e => e.start <= now && e.end > now) ?? null;
  }

  // Next event later today
  getNextEvent(): CalEvent | null {
    const now = new Date();
    return this.events.find(e => e.start > now) ?? null;
  }

  // Birthday events whose start date is today
  getBirthdaysToday(): CalEvent[] {
    const today = dateStr(new Date());
    return this.events.filter(e => e.type === 'birthday' && dateStr(e.start) === today);
  }

  // Birthday events in the next 1–6 days (not today)
  getUpcomingBirthdays(): Array<CalEvent & { daysAway: number }> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrow = new Date(todayStart.getTime() + 86_400_000);
    const cutoff   = new Date(todayStart.getTime() + 7 * 86_400_000);

    return this.events
      .filter(e => e.type === 'birthday' && e.start >= tomorrow && e.start < cutoff)
      .map(e => {
        const startDay = new Date(e.start);
        startDay.setHours(0, 0, 0, 0);
        const daysAway = Math.round((startDay.getTime() - todayStart.getTime()) / 86_400_000);
        return { ...e, daysAway };
      })
      .sort((a, b) => a.daysAway - b.daysAway);
  }

  getEvents(): CalEvent[] { return this.events; }
}

// google type stub so TS doesn't complain
declare namespace google.accounts.oauth2 {
  interface TokenClient { requestAccessToken(): void }
  function initTokenClient(cfg: object): TokenClient;
}

export const calendarService = new CalendarService();
