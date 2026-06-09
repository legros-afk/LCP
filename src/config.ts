export const W = 800;
export const H = 600;

// House geometry
export const WALL = 15;
export const DIVIDER = 10;
export const FLOOR_SEP_TOP = 255;
export const FLOOR_SEP_BOT = 285;

export const LOWER_Y_TOP = FLOOR_SEP_BOT;    // 285
export const LOWER_Y_BOT = 492;
export const UPPER_Y_TOP = 28;
export const UPPER_Y_BOT = FLOOR_SEP_TOP;    // 255

export const LEFT_ROOM_RIGHT = 395;
export const RIGHT_ROOM_LEFT = LEFT_ROOM_RIGHT + DIVIDER;

export const LOWER_WALK_Y = LOWER_Y_BOT - 8;
export const UPPER_WALK_Y = UPPER_Y_BOT - 8;

export const STAIRS_X = (LEFT_ROOM_RIGHT + RIGHT_ROOM_LEFT) / 2;
export const STAIRS_TOP_Y = FLOOR_SEP_TOP;
export const STAIRS_BOT_Y = FLOOR_SEP_BOT;

// Character — pixel art at 3× scale
export const PX = 3;
export const CHAR_W = 10 * PX;   // 30 screen px
export const CHAR_H = 18 * PX;   // 54 screen px
export const CHAR_SPEED = 85;

// UI
export const UI_Y = 490;
export const UI_H = H - UI_Y;

// Time: use real clock — no acceleration constant needed

// ─── EGA-inspired palette ────────────────────────────────────────────────────

export const C = {
  // Night exterior
  nightDeep:     0x000022,
  nightMid:      0x00003a,
  nightSky:      0x000055,
  nightStar:     0xffffff,
  moonYellow:    0xffffaa,

  // House exterior shell
  brickDark:     0x552200,
  brick:         0x7a3d1a,
  brickLight:    0x9a5530,
  roofDark:      0x331100,
  roof:          0x552200,

  // Window glow
  windowFrame:   0x442200,
  windowGlass:   0x335577,
  windowGlassDark: 0x112233,
  windowGlow:    0xcc8833,
  windowGlowOuter: 0x553300,

  // Floors / beams
  beamDark:      0x221100,
  beam:          0x442200,
  floorDark:     0x331a00,
  floorMid:      0x552a00,
  floorLight:    0x7a4400,
  plankLine:     0x221100,

  // Walls — lower panel (wainscoting)
  wainscotDark:  0x3a2200,
  wainscot:      0x5a3a1a,
  wainscotLight: 0x7a5530,
  rail:          0x8b6940,

  // Walls — upper plaster
  plasterDark:   0x8b7355,
  plaster:       0xbb9966,
  plasterLight:  0xddb880,
  ceiling:       0xe8cc99,

  // Bedroom walls (cooler, moonlit)
  bedroomWall:   0x223355,
  bedroomLight:  0x334466,
  bedroomCeil:   0x445577,
  moonlight:     0x8899cc,

  // Bathroom tiles
  tileDark:      0x224455,
  tile:          0x336677,
  tileLight:     0x4488aa,
  tileGrout:     0x112233,
  tileWhite:     0xaaccdd,

  // Character
  skin:          0xcc9966,
  skinShadow:    0xaa7744,
  hair:          0x3e1f0a,
  hairLight:     0x5a3322,
  shirtBlue:     0x2244aa,
  shirtBlueLt:   0x4466cc,
  shirtPajama:   0x6677bb,
  shirtPajamaLt: 0x8899dd,
  pants:         0x223344,
  pantsLt:       0x334455,
  shoes:         0x110a00,
  outline:       0x000000,

  // Living room furniture
  sofaDark:      0x5a1a0a,
  sofa:          0x8b2a1a,
  sofaLight:     0xaa4433,
  sofaCushion:   0xcc5533,
  tvCase:        0x221100,
  tvScreen:      0x1a3355,
  tvScreenOn:    0x2255aa,
  tvGlowOn:      0x4477cc,
  shelfWood:     0x442200,
  bookRed:       0xaa0000,
  bookGold:      0xcc9900,
  bookGreen:     0x006633,
  bookBlue:      0x0044aa,
  bookWhite:     0xccbbaa,
  rugRed:        0x881100,
  rugPattern:    0xaa3311,
  lampBase:      0x776655,
  lampShade:     0xcc9944,
  lampGlow:      0xffcc66,

  // Kitchen
  counterDark:   0x3a2a1a,
  counter:       0x5a4a3a,
  counterLight:  0x7a6a5a,
  countertop:    0x998877,
  tileCk1:       0xddccbb,
  tileCk2:       0x221100,
  stoveDark:     0x111111,
  stove:         0x222222,
  stoveBurner:   0xff4400,
  fridgeBody:    0xddddcc,
  fridgeLine:    0xaaaaaa,
  tableOak:      0x7a5533,
  tableOakLt:    0x996644,
  chairOak:      0x663322,
  potCopper:     0xcc7722,

  // Bedroom furniture
  bedFrame:      0x1a1a55,
  bedFrameLt:    0x2a2a77,
  bedSheet:      0x8899cc,
  bedSheetLt:    0xaabbdd,
  bedPillow:     0xddeeff,
  headboard:     0x111133,
  deskWood:      0x442200,
  monitorCase:   0x111111,
  monitorScreen: 0x001133,
  monitorGlow:   0x0044cc,
  keyboardGrey:  0x554444,

  // Bathroom
  bathroomWall:  0x447788,
  porcelain:     0xeeeeff,
  porcelainSh:   0xbbbccc,
  chrome:        0xaabbcc,
  mirrorGlass:   0x99ccdd,
  showerGlass:   0x336688,
  showerTile:    0x224455,

  // UI
  uiBg:          0x000a14,
  uiBorder:      0x1a3344,
  barBg:         0x0a1a24,
  hungerBar:     0xcc6600,
  happinessBar:  0xccaa00,
  energyBar:     0x22aa44,
  hygieneBar:    0x2266aa,
  barLow:        0xcc2200,
  btnBg:         0x0a1a24,
  btnHover:      0x1a2a34,
  uiText:        0xbbccdd,
  uiTextDim:     0x556677,
  calBtnOk:      0x224422,
  calBtnOkHover: 0x336633,
};
