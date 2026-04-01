// for tilemap creation, create tiles with a sprite info and
// a collider setting for Graph parsing

export const GRID_COLS = 100;
export const GRID_ROWS = 100;
export const COLLECTABLE_COUNT = 20;

// Seeded PRNG (mulberry32) — same seed always produces the same map
function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export let seededRandom: () => number;

const grassTileIndices = [
  { value: 2, weight: 1 },
  { value: 1, weight: 3 },
  { value: 0, weight: 6 },
];

function weightedRandom<T>(options: { value: T; weight: number }[]): T {
  const total = options.reduce((sum, o) => sum + o.weight, 0);
  let r = seededRandom() * total;
  for (const o of options) {
    if ((r -= o.weight) <= 0) return o.value;
  }
  return options[options.length - 1].value; // fallback
}

export class Grass {
  sprite: number[];
  collider: boolean = false;
  constructor() {
    this.sprite = [weightedRandom(grassTileIndices), 0];
  }
}

export class Tree {
  sprite = [3, 0];
  collider: boolean = true;
}

export class Portal {
  sprite = [0, 0]; // base grass sprite, overlay added separately
  collider: boolean = false;
}

export class Barrier {
  sprite = [0, 0]; // grass base, overlay added as separate Actor
  collider: boolean = true;
  groupId: number;
  constructor(groupId: number) {
    this.groupId = groupId;
  }
}

export class Switch {
  sprite = [0, 0]; // grass base, overlay added as separate Actor
  collider: boolean = false;
  groupId: number;
  activated: boolean = false;
  constructor(groupId: number) {
    this.groupId = groupId;
  }
}

export let tiles: (Grass | Tree | Portal | Barrier | Switch)[] = [];
export let portalTileIndices: number[] = [];

// Start position — center of the map (pixel coordinates)
export const START_TILE_X = Math.floor(GRID_COLS / 2);
export const START_TILE_Y = Math.floor(GRID_ROWS / 2);
export const START_POS_X = START_TILE_X * 16 + 8;
export const START_POS_Y = START_TILE_Y * 16 + 8;
export const START_TILE_INDEX = START_TILE_X + START_TILE_Y * GRID_COLS;

// Call this with a seed to generate the world
export function generateWorld(seed: number) {
  seededRandom = mulberry32(seed);

  const total = GRID_COLS * GRID_ROWS;
  const result: (Grass | Tree | Portal)[] = [];
  for (let i = 0; i < total; i++) {
    if (i === START_TILE_INDEX) {
      result.push(new Grass());
    } else {
      result.push(seededRandom() < 0.15 ? new Tree() : new Grass());
    }
  }

  // Place 4 portals on random grass tiles (not the spawn)
  const grassIndices = result
    .map((t, i) => (t instanceof Grass && i !== START_TILE_INDEX ? i : -1))
    .filter((i) => i !== -1);
  const portalIndices: number[] = [];
  for (let p = 0; p < 4; p++) {
    if (grassIndices.length === 0) break;
    const pick = Math.floor(seededRandom() * grassIndices.length);
    const portalIdx = grassIndices.splice(pick, 1)[0];
    result[portalIdx] = new Portal();
    portalIndices.push(portalIdx);
  }

  // Place barrier groups with corresponding switches
  const BARRIER_GROUP_COUNT = 3;
  for (let g = 0; g < BARRIER_GROUP_COUNT; g++) {
    // Find grass tiles to place barriers on
    const barrierCandidates = result
      .map((t, i) => (t instanceof Grass && i !== START_TILE_INDEX ? i : -1))
      .filter((i) => i !== -1);

    if (barrierCandidates.length === 0) break;

    const startIdx =
      barrierCandidates[
        Math.floor(seededRandom() * barrierCandidates.length)
      ];
    const startX = startIdx % GRID_COLS;
    const startY = Math.floor(startIdx / GRID_COLS);

    // Choose direction and length
    const horizontal = seededRandom() < 0.5;
    const length = 3 + Math.floor(seededRandom() * 3); // 3–5 tiles

    let placed = 0;
    for (let j = 0; j < length; j++) {
      const bx = horizontal ? startX + j : startX;
      const by = horizontal ? startY : startY + j;
      if (bx >= GRID_COLS || by >= GRID_ROWS) break;
      const bi = bx + by * GRID_COLS;
      if (bi === START_TILE_INDEX) continue;
      if (result[bi] instanceof Grass) {
        result[bi] = new Barrier(g);
        placed++;
      }
    }

    if (placed === 0) continue;

    // Place a switch on a random grass tile for this group
    const switchCandidates = result
      .map((t, i) => (t instanceof Grass && i !== START_TILE_INDEX ? i : -1))
      .filter((i) => i !== -1);

    if (switchCandidates.length > 0) {
      const switchIdx =
        switchCandidates[
          Math.floor(seededRandom() * switchCandidates.length)
        ];
      result[switchIdx] = new Switch(g);
    }
  }

  tiles = result;
  portalTileIndices = portalIndices;
}
