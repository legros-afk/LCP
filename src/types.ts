export interface Needs {
  hunger: number;     // 0–100
  happiness: number;  // 0–100
  energy: number;     // 0–100
  hygiene: number;    // 0–100
}

export type BehaviorState =
  | 'idle'
  | 'walking'
  | 'eating'
  | 'sleeping'
  | 'watching_tv'
  | 'using_computer'
  | 'reading'
  | 'showering'
  | 'cooking'
  | 'greeting_player'
  | 'chatting';

export type Floor = 'lower' | 'upper';

export interface FurnitureItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  floor: Floor;
  action: BehaviorState | null;
  label: string;
}

export interface GameTimeData {
  hour: number;
  minute: number;
  totalMinutes: number;
}

export interface ChatResponse {
  trigger: string[];
  response: string;
  moodBoost: number;
}
