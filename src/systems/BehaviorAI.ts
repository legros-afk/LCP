import type { Needs, BehaviorState, FurnitureItem, GameTimeData } from '../types';
import type { CalEvent } from '../services/CalendarService';
import { getMostCriticalNeed } from './NeedsSystem';

export interface AITarget {
  furniture: FurnitureItem;
  behavior: BehaviorState;
  duration: number;
  thought?: string;
}

// Real-time daily schedule — fires once when the hour changes
const REAL_SCHEDULE: { hour: number; behavior: BehaviorState; furnitureId: string; thought?: string }[] = [
  { hour: 7,  behavior: 'showering',       furnitureId: 'shower',       thought: 'Morning shower...' },
  { hour: 8,  behavior: 'cooking',         furnitureId: 'stove',        thought: 'What\'s for breakfast?' },
  { hour: 8,  behavior: 'eating',          furnitureId: 'table',        thought: 'Mmm, breakfast 🍳' },
  { hour: 9,  behavior: 'exercising',      furnitureId: 'exercise_mat', thought: 'Morning workout! 💪' },
  { hour: 10, behavior: 'using_computer',  furnitureId: 'computer',     thought: 'Let\'s see what\'s online...' },
  { hour: 12, behavior: 'cooking',         furnitureId: 'stove',        thought: 'Time to cook lunch!' },
  { hour: 12, behavior: 'eating',          furnitureId: 'table',        thought: 'Lunch time 🥘' },
  { hour: 14, behavior: 'reading',         furnitureId: 'bookshelf',    thought: 'A bit of reading...' },
  { hour: 16, behavior: 'watching_tv',     furnitureId: 'tv',           thought: 'Afternoon TV 📺' },
  { hour: 18, behavior: 'cooking',         furnitureId: 'stove',        thought: 'Dinner time!' },
  { hour: 18, behavior: 'eating',          furnitureId: 'table',        thought: 'Dinner! 🍽' },
  { hour: 19, behavior: 'playing_music',   furnitureId: 'radio',        thought: '♪ Music time 🎵' },
  { hour: 20, behavior: 'using_computer',  furnitureId: 'computer',     thought: 'Evening browsing...' },
  { hour: 22, behavior: 'sleeping',        furnitureId: 'bed',          thought: 'Good night 💤' },
  { hour: 23, behavior: 'sleeping',        furnitureId: 'bed' },
  { hour:  0, behavior: 'sleeping',        furnitureId: 'bed' },
  { hour:  1, behavior: 'sleeping',        furnitureId: 'bed' },
  { hour:  2, behavior: 'sleeping',        furnitureId: 'bed' },
  { hour:  3, behavior: 'sleeping',        furnitureId: 'bed' },
  { hour:  4, behavior: 'sleeping',        furnitureId: 'bed' },
  { hour:  5, behavior: 'sleeping',        furnitureId: 'bed' },
  { hour:  6, behavior: 'sleeping',        furnitureId: 'bed',          thought: 'Just five more minutes...' },
];

const NEED_TARGETS: Record<string, { id: string; behavior: BehaviorState; thought: string }> = {
  hunger:    { id: 'table',   behavior: 'eating',          thought: 'So hungry...' },
  energy:    { id: 'bed',     behavior: 'sleeping',        thought: 'Need to sleep now...' },
  hygiene:   { id: 'shower',  behavior: 'showering',       thought: 'I should shower...' },
  happiness: { id: 'tv',      behavior: 'watching_tv',     thought: 'I need some fun!' },
};

const CALENDAR_BEHAVIORS: Record<string, { id: string; behavior: BehaviorState; thought: string }> = {
  work:     { id: 'computer', behavior: 'using_computer', thought: '' },
  meal:     { id: 'table',    behavior: 'eating',         thought: '' },
  social:   { id: 'sofa',     behavior: 'watching_tv',    thought: '' },
  birthday: { id: 'table',    behavior: 'eating',         thought: '' },
};

const BEHAVIOR_DURATIONS: Record<BehaviorState, number> = {
  idle:            3000,
  walking:         0,
  eating:          14000,
  sleeping:        -1,
  watching_tv:     22000,
  using_computer:  20000,
  reading:         16000,
  showering:       11000,
  cooking:         9000,
  greeting_player: 3000,
  chatting:        5000,
  exercising:      15000,
  playing_music:   20000,
};

export class BehaviorAI {
  private furniture: Map<string, FurnitureItem>;
  private lastHour = -1;
  private idleTimer = 0;

  constructor(furniture: FurnitureItem[]) {
    this.furniture = new Map(furniture.map(f => [f.id, f]));
  }

  getNextTarget(
    needs: Needs,
    gameTime: GameTimeData,
    currentBehavior: BehaviorState,
    atTarget: boolean,
    playerInteraction: BehaviorState | null,
    activeCalEvent: CalEvent | null,
  ): AITarget | null {
    if (playerInteraction) {
      return this.makeTarget('sofa', playerInteraction, BEHAVIOR_DURATIONS[playerInteraction]);
    }

    if (atTarget && currentBehavior !== 'idle') return null;

    // Calendar event takes priority over schedule
    if (activeCalEvent) {
      const mapping = CALENDAR_BEHAVIORS[activeCalEvent.type];
      if (mapping) {
        const thought = this.calendarThought(activeCalEvent);
        return this.makeTarget(mapping.id, mapping.behavior, BEHAVIOR_DURATIONS[mapping.behavior], thought);
      }
    }

    // Critical needs
    const critical = getMostCriticalNeed(needs);
    if (critical) {
      const t = NEED_TARGETS[critical];
      if (t) return this.makeTarget(t.id, t.behavior, BEHAVIOR_DURATIONS[t.behavior], t.thought);
    }

    // Real-time schedule
    const hour = gameTime.hour;
    if (hour !== this.lastHour) {
      this.lastHour = hour;
      const entry = REAL_SCHEDULE.find(s => s.hour === hour);
      if (entry) {
        return this.makeTarget(entry.furnitureId, entry.behavior, BEHAVIOR_DURATIONS[entry.behavior], entry.thought);
      }
    }

    // Idle wandering
    this.idleTimer -= 16;
    if (this.idleTimer <= 0) {
      this.idleTimer = 6000 + Math.random() * 10000;
      const items = [...this.furniture.values()].filter(f => f.action !== null);
      const pick = items[Math.floor(Math.random() * items.length)];
      const beh = pick.action ?? 'idle';
      return this.makeTarget(pick.id, beh, BEHAVIOR_DURATIONS[beh] ?? 5000);
    }
    return null;
  }

  private makeTarget(fid: string, behavior: BehaviorState, duration: number, thought?: string): AITarget | null {
    const f = this.furniture.get(fid);
    if (!f) return null;
    return { furniture: f, behavior, duration: duration < 0 ? 999999 : duration, thought };
  }

  private calendarThought(event: CalEvent): string {
    switch (event.type) {
      case 'work':     return `📅 ${event.summary}`;
      case 'meal':     return `🍴 ${event.summary}`;
      case 'social':   return `🎉 ${event.summary}`;
      case 'birthday': return `🎂 ${event.summary}!`;
      default:         return event.summary;
    }
  }
}
