import type { Needs, BehaviorState, FurnitureItem, GameTimeData } from '../types';
import { getMostCriticalNeed } from './NeedsSystem';

export interface AITarget {
  furniture: FurnitureItem;
  behavior: BehaviorState;
  duration: number;  // ms to spend at target (-1 = until interrupted)
}

const DAILY_SCHEDULE: { hour: number; behavior: BehaviorState; furnitureId: string }[] = [
  { hour: 7,  behavior: 'showering',       furnitureId: 'shower'  },
  { hour: 8,  behavior: 'cooking',         furnitureId: 'stove'   },
  { hour: 8,  behavior: 'eating',          furnitureId: 'table'   },
  { hour: 10, behavior: 'using_computer',  furnitureId: 'computer'},
  { hour: 12, behavior: 'cooking',         furnitureId: 'stove'   },
  { hour: 12, behavior: 'eating',          furnitureId: 'table'   },
  { hour: 14, behavior: 'reading',         furnitureId: 'bookshelf'},
  { hour: 16, behavior: 'watching_tv',     furnitureId: 'tv'      },
  { hour: 18, behavior: 'cooking',         furnitureId: 'stove'   },
  { hour: 18, behavior: 'eating',          furnitureId: 'table'   },
  { hour: 20, behavior: 'using_computer',  furnitureId: 'computer'},
  { hour: 22, behavior: 'sleeping',        furnitureId: 'bed'     },
];

const NEED_TARGETS: Record<string, string> = {
  hunger:    'table',
  energy:    'bed',
  hygiene:   'shower',
  happiness: 'tv',
};

const BEHAVIOR_DURATIONS: Record<BehaviorState, number> = {
  idle:            3000,
  walking:         0,
  eating:          12000,
  sleeping:        -1,
  watching_tv:     20000,
  using_computer:  18000,
  reading:         15000,
  showering:       10000,
  cooking:         8000,
  greeting_player: 3000,
  chatting:        5000,
};

export class BehaviorAI {
  private furniture: Map<string, FurnitureItem>;
  private lastScheduleHour = -1;
  private currentTarget: AITarget | null = null;
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
  ): AITarget | null {
    // Player interaction takes immediate priority
    if (playerInteraction) {
      const f = this.furniture.get('sofa') ?? this.furniture.values().next().value!;
      return {
        furniture: f,
        behavior: playerInteraction,
        duration: BEHAVIOR_DURATIONS[playerInteraction],
      };
    }

    // If currently doing something with time left, stay put
    if (atTarget && currentBehavior !== 'idle' && this.currentTarget) {
      return null;
    }

    // Critical needs override everything
    const critical = getMostCriticalNeed(needs);
    if (critical) {
      const fid = NEED_TARGETS[critical];
      const f = this.furniture.get(fid);
      if (f) {
        let behavior: BehaviorState = 'idle';
        if (critical === 'hunger')   behavior = fid === 'table' ? 'eating' : 'cooking';
        if (critical === 'energy')   behavior = 'sleeping';
        if (critical === 'hygiene')  behavior = 'showering';
        if (critical === 'happiness') behavior = 'watching_tv';
        this.currentTarget = { furniture: f, behavior, duration: BEHAVIOR_DURATIONS[behavior] };
        return this.currentTarget;
      }
    }

    // Follow daily schedule (fire once per hour slot)
    const hour = gameTime.hour;
    if (hour !== this.lastScheduleHour) {
      const scheduled = DAILY_SCHEDULE.filter(s => s.hour === hour);
      if (scheduled.length > 0) {
        this.lastScheduleHour = hour;
        const entry = scheduled[0];
        const f = this.furniture.get(entry.furnitureId);
        if (f) {
          this.currentTarget = {
            furniture: f,
            behavior: entry.behavior,
            duration: BEHAVIOR_DURATIONS[entry.behavior],
          };
          return this.currentTarget;
        }
      }
    }

    // Idle wandering
    this.idleTimer -= 16;
    if (this.idleTimer <= 0) {
      this.idleTimer = 5000 + Math.random() * 8000;
      const items = [...this.furniture.values()];
      const pick = items[Math.floor(Math.random() * items.length)];
      const behavior = pick.action ?? 'idle';
      this.currentTarget = {
        furniture: pick,
        behavior,
        duration: BEHAVIOR_DURATIONS[behavior] ?? 4000,
      };
      return this.currentTarget;
    }

    return null;
  }

  clearTarget(): void {
    this.currentTarget = null;
  }
}
