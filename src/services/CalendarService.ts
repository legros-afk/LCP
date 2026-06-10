// Fetches the owner's calendar via the Worker's sanitized /api/events feed.
// No visitor authentication; no raw event details ever reach the browser —
// only { type, label, start, end } where label is generic ("Work", "Mealtime")
// or "<FirstName>'s birthday" for birthdays.

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
  summary: string; // sanitized label from the Worker
  type: CalEventType;
  start: Date;
  end: Date;
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

class CalendarService {
  private events: CalEvent[] = [];
  public isConnected = false;
  public isAvailable = true;
  public onFetch?: () => void;

  init(): void {
    this.fetchToday();
  }

  // Kept for API compatibility with the UI button — just refetches
  requestAccess(): void {
    this.fetchToday();
  }

  async fetchToday(): Promise<void> {
    try {
      const res = await fetch('/api/events');
      if (!res.ok) { this.isConnected = false; return; }
      const data = await res.json() as {
        events?: { id: string; type: CalEventType; label: string; start: string; end: string }[];
      };
      this.events = (data.events ?? []).map(e => ({
        id: e.id,
        summary: e.label,
        type: e.type,
        start: new Date(e.start),
        end:   new Date(e.end),
      }));
      this.isConnected = true;
      this.onFetch?.();
    } catch {
      this.isConnected = false;
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

export const calendarService = new CalendarService();
