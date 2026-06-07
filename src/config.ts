export const W = 800;
export const H = 600;

// House geometry
export const WALL = 15;          // outer wall thickness
export const DIVIDER = 10;       // room divider thickness
export const FLOOR_SEP_TOP = 255;
export const FLOOR_SEP_BOT = 285;
export const FLOOR_H = FLOOR_SEP_BOT - FLOOR_SEP_TOP; // 30px floor separator

export const LOWER_Y_TOP = FLOOR_SEP_BOT;    // 285
export const LOWER_Y_BOT = 490;
export const UPPER_Y_TOP = WALL + 15;        // 30
export const UPPER_Y_BOT = FLOOR_SEP_TOP;    // 255

export const LEFT_ROOM_RIGHT = 395;
export const RIGHT_ROOM_LEFT = LEFT_ROOM_RIGHT + DIVIDER;  // 405

// Walk Y positions (character feet)
export const LOWER_WALK_Y = LOWER_Y_BOT - 10;  // 480
export const UPPER_WALK_Y = UPPER_Y_BOT - 10;  // 245

// Stairs zone
export const STAIRS_X = (LEFT_ROOM_RIGHT + RIGHT_ROOM_LEFT) / 2;  // 400
export const STAIRS_TOP_Y = FLOOR_SEP_TOP;   // 255
export const STAIRS_BOT_Y = FLOOR_SEP_BOT;  // 285

// Character
export const CHAR_SPEED = 90; // px/s
export const CHAR_W = 14;
export const CHAR_H = 28;

// UI panel
export const UI_Y = 510;
export const UI_H = H - UI_Y;  // 90

// Game time: 1 real second = 2 game minutes
export const GAME_MINUTES_PER_SECOND = 2;
export const GAME_START_HOUR = 8;

// Colors
export const COLORS = {
  exteriorBg:    0x0d1117,
  wallOuter:     0x6b5a3e,
  wallInner:     0xd4a76a,
  floorBoard:    0x8b6914,
  floorDark:     0x5c4a1e,
  ceilLight:     0xc8a878,
  windowFrame:   0x6b5a3e,
  windowGlass:   0x1a3a5c,
  windowGlassNight: 0x0d1a2e,
  stairsColor:   0x8b6914,

  // Living room
  sofa:          0x7c3030,
  sofaCushion:   0x9c4040,
  tv:            0x2a2a2a,
  tvScreen:      0x4466aa,
  tvScreenOff:   0x111111,
  bookshelf:     0x5d4037,
  bookA:         0xc0392b,
  bookB:         0x2980b9,
  bookC:         0x27ae60,
  bookD:         0xf39c12,

  // Kitchen
  counter:       0xbcaaa4,
  stove:         0x424242,
  stoveHot:      0xff5722,
  fridge:        0xeceff1,
  fridgeLine:    0xbdbdbd,
  table:         0x795548,
  chair:         0x6d4c41,
  sink:          0x9e9e9e,
  sinkBasin:     0x78909c,

  // Bedroom
  bed:           0x1a237e,
  bedSheet:      0xe8eaf6,
  bedPillow:     0xfafafa,
  deskWood:      0x5d4037,
  monitor:       0x212121,
  monitorScreen: 0x003366,
  lamp:          0xffd54f,
  lampPost:      0x9e9e9e,

  // Bathroom
  tile:          0x80cbc4,
  tileGrout:     0x546e7a,
  shower:        0x29b6f6,
  showerWall:    0x4fc3f7,
  bathroomSink:  0xf5f5f5,
  bathroomSinkB: 0x9e9e9e,
  toilet:        0xfafafa,
  toiletSeat:    0xe0e0e0,
  mirror:        0x80deea,

  // Character
  skin:          0xd4a574,
  hair:          0x3e2723,
  shirt:         0x3f51b5,
  pants:         0x37474f,
  shoes:         0x212121,
  shirtPajama:   0x7986cb,

  // UI
  uiBg:          0x0a0e14,
  uiBorder:      0x2a3a4a,
  barBg:         0x1a2a3a,
  hungerBar:     0xe67e22,
  happinessBar:  0xf1c40f,
  energyBar:     0x2ecc71,
  hygieneBar:    0x3498db,
  barLow:        0xe74c3c,
  btnBg:         0x1a2a3a,
  btnHover:      0x2a3a4a,
  btnText:       0xe8d5b7,
  timeColor:     0xe8d5b7,
  thoughtBubble: 0xfff9c4,
  speechBubble:  0xffffff,
};
