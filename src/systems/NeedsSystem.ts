import type { Needs, BehaviorState } from '../types';

// Decay rates: points lost per real second
const DECAY: Record<keyof Needs, number> = {
  hunger:    1 / 60,      // 100 in ~100 minutes
  happiness: 1 / 90,
  energy:    1 / 50,      // depleted in ~83 min while awake
  hygiene:   1 / 120,
};

// Recovery rates while performing an action
const RECOVERY: Partial<Record<BehaviorState, Partial<Needs>>> = {
  eating:          { hunger: 15 / 60 },   // fills hunger fast
  cooking:         { hunger: 5 / 60 },    // slight fill while cooking
  sleeping:        { energy: 20 / 60, hunger: -(0.5 / 60) },
  showering:       { hygiene: 25 / 60 },
  watching_tv:     { happiness: 5 / 60 },
  using_computer:  { happiness: 4 / 60 },
  reading:         { happiness: 3 / 60 },
  greeting_player: { happiness: 10 / 60 },
  chatting:        { happiness: 8 / 60 },
};

export function tickNeeds(needs: Needs, behavior: BehaviorState, dt: number): void {
  const secDelta = dt / 1000;

  // Base decay (energy doesn't decay while sleeping)
  needs.hunger    = clamp(needs.hunger    - DECAY.hunger    * secDelta);
  needs.happiness = clamp(needs.happiness - DECAY.happiness * secDelta);
  needs.hygiene   = clamp(needs.hygiene   - DECAY.hygiene   * secDelta);

  if (behavior !== 'sleeping') {
    needs.energy = clamp(needs.energy - DECAY.energy * secDelta);
  }

  // Low hygiene/hunger drags down happiness
  if (needs.hygiene < 20) needs.happiness = clamp(needs.happiness - 0.01 * secDelta);
  if (needs.hunger  < 15) needs.happiness = clamp(needs.happiness - 0.02 * secDelta);

  // Apply recovery for current behavior
  const rec = RECOVERY[behavior];
  if (rec) {
    for (const key of Object.keys(rec) as (keyof Needs)[]) {
      const rate = rec[key] as number;
      needs[key] = clamp(needs[key] + rate * secDelta);
    }
  }
}

export function applyPlayerFeed(needs: Needs): void {
  needs.hunger    = clamp(needs.hunger    + 35);
  needs.happiness = clamp(needs.happiness + 10);
}

export function applyPlayerChat(needs: Needs): void {
  needs.happiness = clamp(needs.happiness + 20);
}

export function applyPlayerBell(needs: Needs): void {
  needs.happiness = clamp(needs.happiness + 8);
}

export function getMostCriticalNeed(needs: Needs): keyof Needs | null {
  const THRESHOLDS: Record<keyof Needs, number> = {
    energy:    20,
    hunger:    20,
    hygiene:   15,
    happiness: 10,
  };
  let worst: keyof Needs | null = null;
  let worstVal = Infinity;
  for (const key of Object.keys(THRESHOLDS) as (keyof Needs)[]) {
    if (needs[key] < THRESHOLDS[key] && needs[key] < worstVal) {
      worst = key;
      worstVal = needs[key];
    }
  }
  return worst;
}

function clamp(v: number): number {
  return Math.max(0, Math.min(100, v));
}
