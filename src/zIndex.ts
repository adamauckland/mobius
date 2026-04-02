// Z-index layering constants for all game entities
// Lower values render behind higher values

// Multiply y by LAYER_SCALE to leave room for intra-tile ordering.
// Within a tile, layers are offset 0–4.
const LAYER_SCALE = 10;

// Intra-tile layer offsets (background/grass is the tilemap itself at z=0)
export const Z_LAYER_TREE = 1;
export const Z_LAYER_PICKUP = 2;
export const Z_LAYER_PLAYER = 3;
export const Z_LAYER_ROCK = 4;

export function zFromY(y: number, layer: number) {
  return y * LAYER_SCALE + layer;
}

export const Z_RIPPLE = 50000;
export const Z_HUD = 100000;
export const Z_COUNTDOWN = 200000;
