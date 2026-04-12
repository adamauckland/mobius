# Mobius

A tile-based puzzle game built with [Excalibur.js](https://excaliburjs.com/) and TypeScript. Players navigate a grid, solve puzzles with rocks, parcels, barriers, and moving platforms, and race against a timer. A unique time-loop mechanic records your actions and replays them as "ghosts" when you enter a portal or run out of time.

## Running

```bash
npm install
npm run dev
```

## Code Execution Path

### 1. Boot

```
index.html
  └─ <script type="module" src="/src/main.ts">
       └─ game.ts          create Excalibur Engine (canvas, pixelArt, FillScreen)
       └─ resources.ts      register sprites & spritesheets with Loader
       └─ game.start(loader) load assets, then decide what to launch ↓
```

### 2. Launch Decision (`main.ts` `.then()`)

After resources load, `main.ts` checks these in order and takes the first match:

| Priority | Condition                    | Action                                                 |
| -------- | ---------------------------- | ------------------------------------------------------ |
| 1        | `localStorage.customProject` | `startProjectLevel(json, level)`                       |
| 2        | `localStorage.customMap`     | `startCustomMap(json)`                                 |
| 3        | URL `?pack=ID`               | Fetch from Firebase → `startProjectLevel()`            |
| 4        | `localStorage.editorMode`    | `showEditor()`                                         |
| 5        | None                         | Show start screen (PLAY PROJECT, BROWSE PACKS, EDITOR) |

### 3. Level Setup (`gameSetup.ts` → `startGame()`)

Once a `MapData` is resolved, `startGame()` runs this sequence:

```
loadWorld(mapData)                    parse tiles into global tiles[] array
  ↓
Set model.timeLimit                   from map data (0 = no limit)
  ↓
Create TileMap                        50x50 grid, 16px tiles
Add visual overlays                   trees (swaying), fences (auto-tiled),
                                      gates (rotated arrows), drop zones (pulsing),
                                      exit doors, portals
  ↓
initPathfinding(tilemap)              build A* and Dijkstra graphs
  ↓
Add player to scene                   camera follows with radius strategy
Start recording                       activeEntry().recorder.startRecording()
  ↓
Spawn entities                        rocks, parcels, collectables,
                                      moving blocks, monsters
  ↓
Create HUD                            timer (top-center), score (top-right),
                                      pause button (top-left), lives, level indicator
  ↓
Create overlays                       Time Up (red), LEVEL COMPLETE (green)
  ↓
Wire callbacks                        wireExitDoor(), setOnPlayerKilled()
  ↓
Countdown                             3 → 2 → 1 → GO! (500ms intervals)
  ↓
GO!                                   gameStarted = true
                                      setupClickHandler() — input enabled
```

### 4. Game Loop (`gameLoop.ts` → `setupGameLoop()`)

Runs every frame after the countdown finishes:

```
if (!gameStarted || model.gameOver) return

updateMovingBlocks(elapsed)           oscillate platforms, carry riders
updateMonsters(elapsed)               patrol monsters, check collisions
elapsedGameTime += elapsed

if timeLimit > 0:
  display remaining time (countdown)
  if < 10s: flash timer red, play heartbeat
  if time's up:
    stopAndSpawnNext()                portal-style rewind (ghosts preserved)
    lockInput(3000)                   3-second penalty
else:
  display elapsed time (count up)

animate score display                 smooth increment toward target
```

### 5. Player Input Flow

```
Pointer down event
  ↓
handlePointerDown()                   playerManager.ts
  ├─ if input locked → ignore         (penalty timer or block dismount)
  ├─ get tile from world position
  ├─ show tap ripple
  ├─ recorder.recordClick(tileIndex)  save for ghost replay
  └─ handleTileClick()                pathfinding.ts
       ├─ validate target tile
       ├─ if riding block → dismount
       ├─ A* pathfinding
       ├─ queue moves in playerActionBuffer
       └─ on arrival: auto-pickup rocks/parcels, activate switches
```

### 6. Player Movement & Tile Arrival (`chap.ts`)

```
Player.onPostUpdate()
  ├─ process playerActionBuffer       move tile-by-tile with easing
  ├─ auto-mount moving blocks         if idle near a platform
  └─ on arrive at tile:
       ├─ try collect items            coins, gems
       ├─ try activate switches        toggle barrier groups
       ├─ check portal                 → onReachedPortal callback
       ├─ check exit door              → onReachedExitDoor callback
       └─ check one-way gates          push in allowed direction only
```

## Game Events

### Portal Reached → `stopAndSpawnNext()`

```
Stop recording current player, save recording
Create new Player at start position
Push new entry to entries[]
replayAll():
  ├─ reset world (rocks, parcels, barriers, blocks, monsters, timer)
  └─ for each previous entry with a recording:
       start replay (scheduled clicks via game.clock)
Start recording new player
Camera follows new player
wireExitDoor() via onNewActivePlayer callback
```

### Player Killed by Monster

```
model.lives--
Update hearts display
sfxDeath()
if lives <= 0:
  model.gameOver = true
  show Time Up overlay + RESTART button
else:
  replayAll()                         reset world, replay ghosts
  start recording active player
  wireExitDoor()
```

### Time's Up

```
stopAndSpawnNext()                    same as portal (ghosts preserved)
lockInput(3000)                       3-second input penalty
```

### Level Complete (Exit Door)

```
model.gameOver = true
sfxLevelComplete()
Show LEVEL COMPLETE overlay
Show RESTART button
Show CONTINUE button (if more levels in project)
```

### Restart / Continue

```
RESTART:  save project to localStorage, reset lives → location.reload()
CONTINUE: save project + next level + lives → location.reload()
          main.ts picks up from localStorage on reload
```

## Recording & Replay System

The core time-loop mechanic uses `GameRecorder` (`recorder.ts`):

- **Recording**: each click is stored as `{ timestamp, tileIndex }` relative to recording start
- **Replay**: clicks are scheduled via `game.clock.schedule()` so they pause when the game pauses
- **Ghost players**: previous recordings replay as autonomous "ghosts" that interact with the world (push rocks, activate switches, carry parcels)
- **Entries array**: `playerManager.ts` maintains `entries[]` — the last entry is always the human-controlled player, all others are replaying ghosts

## Module Map

| Module                      | Purpose                                               |
| --------------------------- | ----------------------------------------------------- |
| `main.ts`                   | Entry point, resource loading, launch decision, pause |
| `game.ts`                   | Excalibur Engine singleton                            |
| `model.ts`                  | Global game state (lives, timer, flags)               |
| `resources.ts`              | Sprites, spritesheets, animations                     |
| `gameSetup.ts`              | Level setup, event wiring, start screen               |
| `gameLoop.ts`               | Post-update loop — timer, score, time-up handling     |
| `pathfinding.ts`            | A\*/Dijkstra routing, click-to-move                   |
| `sounds.ts`                 | Web Audio API synthesized sound effects               |
| `zIndex.ts`                 | Depth-sorting layers                                  |
| `firebase.ts`               | Firestore initialization                              |
| **entities/**               |                                                       |
| `entities/chap.ts`          | Player class — movement, tile arrival, inventory      |
| `entities/player.ts`        | Base Player actor (template)                          |
| `entities/playerManager.ts` | Multi-player entries, portal/rewind, input lock       |
| `entities/recorder.ts`      | Click recording and scheduled replay                  |
| `entities/worldObjects.ts`  | Rocks, parcels, collectables, score tracking          |
| `entities/barriers.ts`      | Barrier gates and switch toggles                      |
| `entities/movingBlocks.ts`  | Oscillating platforms, rider management               |
| `entities/monsters.ts`      | Enemy patrols and collision detection                 |
| `entities/lightTrail.ts`    | Particle effects for pickups                          |
| **tiles/**                  |                                                       |
| `tiles/tiledata.ts`         | Tile types, world generation, grid constants          |
| `tiles/tileOverlays.ts`     | Tree, gate, drop zone, exit door overlays             |
| `tiles/fenceSprites.ts`     | Auto-tiled fence sprite selection                     |
| **levels/**                 |                                                       |
| `levels/mapData.ts`         | Map/project serialization and deserialization         |
| `levels/levelPacks.ts`      | Firebase level pack publishing and browsing           |
| `levels/editor.ts`          | Level editor UI and tools                             |
| `levels/level.ts`           | Scene subclass for level lifecycle                    |
| **ui/**                     |                                                       |
| `ui/hud.ts`                 | HUD creation (timer, score, lives, overlays)          |
| `ui/countdown.ts`           | 3-2-1-GO countdown sequence                           |
| `ui/packBrowser.ts`         | Firebase pack browsing UI                             |

## Deleting a Level Pack

Level packs are stored in Firestore and the app has no in-game delete UI. The
security rules in [firestore.rules](firestore.rules) also block client-side
deletes (`allow update, delete: if false`), so packs must be removed manually
from the Firebase console by a project owner.

1. Find the pack ID. It's the 8-character code in the share URL
   (`?pack=ID`) or visible in the pack browser.
2. Open the [Firebase console](https://console.firebase.google.com/) and
   select the Mobius project.
3. In the left sidebar choose **Build → Firestore Database**.
4. Open the `levelPacks` collection.
5. Locate the document whose ID matches the pack ID from step 1. The
   `name` and `author` fields can help confirm you have the right one.
6. Click the document, then use the three-dot (⋮) menu at the top of the
   document panel and choose **Delete document**.
7. Confirm the deletion. The pack is gone immediately — anyone still
   holding the share link will get a "not found" response from
   `loadPack()` in [src/levels/levelPacks.ts:62](src/levels/levelPacks.ts#L62).

Note: the Firestore rules deny deletes from client SDKs, but the Firebase
console acts with admin privileges and bypasses them. You must be signed
in to the console with an account that has access to the project.

Tests:

Pick up rock
Pick up parcel
Drop parcel on dropzone
Parcel attracts to dropzone

Moving platform catches player
Moving platform pushes player

Player picks up gold

Portal time travels

Switch opens gate
Gate blocks player

Exit door finishes level
