// for tilemap creation, create tiles with a sprite info and
// a collider setting for Graph parsing

export const GRID_COLS = 30;
export const GRID_ROWS = 30;

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

export let tiles: (Grass | Tree | Portal)[] = [];
export let portalTileIndex = -1;

// Call this with a seed to generate the world
export function generateWorld(seed: number) {
  seededRandom = mulberry32(seed);

  const total = GRID_COLS * GRID_ROWS;
  const result: (Grass | Tree | Portal)[] = [];
  for (let i = 0; i < total; i++) {
    if (i === 0) {
      result.push(new Grass());
    } else {
      result.push(seededRandom() < 0.15 ? new Tree() : new Grass());
    }
  }

  // Place a portal on a random grass tile (not the spawn)
  const grassIndices = result
    .map((t, i) => (t instanceof Grass && i !== 0 ? i : -1))
    .filter((i) => i !== -1);
  const portalIdx =
    grassIndices[Math.floor(seededRandom() * grassIndices.length)];
  result[portalIdx] = new Portal();

  tiles = result;
  portalTileIndex = portalIdx;
}
