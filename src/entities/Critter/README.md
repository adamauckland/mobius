# Critter Module

## Variable Shorthands

| Variable | Meaning |
|----------|---------|
| `dx` | Delta X — horizontal distance between two points |
| `dy` | Delta Y — vertical distance between two points |
| `dt` | Delta Time — elapsed time in seconds since last frame |
| `ax` | Acceleration X — combined horizontal acceleration |
| `ay` | Acceleration Y — combined vertical acceleration |
| `tx` | Tile X — tile column index in the grid |
| `ty` | Tile Y — tile row index in the grid |
| `cx` | Center X — center coordinate of a tile or spawn point |
| `cy` | Center Y — center coordinate of a tile or spawn point |
| `cdx` | Critter Delta X — horizontal distance from critter to player center (used when distance is near zero) |
| `cdy` | Critter Delta Y — vertical distance from critter to player center (used when distance is near zero) |
| `cdist` | Critter Distance — distance from critter to player center |
| `dcx` | Delta Cohesion X — horizontal distance from critter to group center |
| `dcy` | Delta Cohesion Y — vertical distance from critter to group center |
| `dcDist` | Delta Cohesion Distance — distance from critter to group center |
| `gdx` | Gate Direction X — unit vector X component for a one-way gate's push direction |
| `gdy` | Gate Direction Y — unit vector Y component for a one-way gate's push direction |
| `dist` | Distance — Euclidean distance between two points |
| `prevX` | Previous X — critter's X position before this frame's movement |
| `prevY` | Previous Y — critter's Y position before this frame's movement |
| `nearX` | Nearest X — closest X point on the player's bounding box to the critter |
| `nearY` | Nearest Y — closest Y point on the player's bounding box to the critter |
| `closestX` | Closest X — closest X point on a player's bounding box during collection checks |
| `closestY` | Closest Y — closest Y point on a player's bounding box during collection checks |
| `tileIdx` | Tile Index — flat index into the tile array (`tx + ty * GRID_COLS`) |
| `halfSize` | Half Size — half the critter sprite size, used for boundary clamping |
| `maxX` | Max X — maximum allowed X position within world bounds |
| `maxY` | Max Y — maximum allowed Y position within world bounds |
| `ppos` | Player Position — a player's position vector from the positions array |
| `sep` | Separation — acceleration result from separation steering behavior |
| `coh` | Cohesion — acceleration result from cohesion steering behavior |
| `flee` | Flee — acceleration result from flee steering behavior |
| `strength` | Strength — scaled force magnitude that decreases with distance |
| `px` | Position X — spawn X coordinate for an individual critter |
| `py` | Position Y — spawn Y coordinate for an individual critter |
