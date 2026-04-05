import {
  TileMap,
  ScreenElement,
  Text,
  Font,
  FontUnit,
  Color,
  vec,
  Actor,
  TextAlign,
  BaseAlign,
  BoundingBox,
} from "excalibur";
import { TileSheet, rlSS } from "./resources";
import {
  Tree,
  Portal,
  Barrier,
  Fence,
  OneWayGate,
  DropZone,
  ExitDoor,
  tiles,
  TILE_SIZE,
  GRID_COLS,
  GRID_ROWS,
  generateWorld,
  loadWorld,
  customStartTile,
  COLLECTABLE_COUNT,
} from "./tiledata";
import { deserializeMap, type MapData } from "./mapData";
import { player } from "./chap";
import { game } from "./game";
import { model } from "./model";
import { initPathfinding } from "./pathfinding";
import { activeEntry, setupClickHandler, replayAll, timeRewind, setOnNewActivePlayer } from "./playerManager";
import { spawnRocks, spawnRocksAt, spawnCollectables, spawnCollectablesAt, spawnParcels, spawnParcelsAt, PARCEL_SPRITES, getScore } from "./worldObjects";
import { initBarriers, spawnBarriers } from "./barriers";
import { spawnMovingBlocks, spawnMovingBlocksAt, updateMovingBlocks } from "./movingBlocks";
import { spawnMonsters, spawnMonstersAt, updateMonsters, setOnPlayerKilled } from "./monsters";
import { sfxDeath, sfxLevelComplete } from "./sounds";
import { togglePause, onPauseChange } from "./main";
import { zFromY, Z_LAYER_TREE, Z_LAYER_PICKUP, Z_HUD, Z_COUNTDOWN } from "./zIndex";

// Seed management
const seedInput = document.getElementById("seed-input") as HTMLInputElement;
const btnNewSeed = document.getElementById("btn-new-seed")!;

function generateNewSeed() {
  return Math.floor(Math.random() * 100000);
}

// Load seed from sessionStorage, or generate a new one
const storedSeed = sessionStorage.getItem("mapSeed");
seedInput.value = storedSeed ?? String(generateNewSeed());

btnNewSeed.addEventListener("click", () => {
  seedInput.value = String(generateNewSeed());
});

// Wait for START button
const startScreen = document.getElementById("start-screen")!;
const btnStart = document.getElementById("btn-start")!;
const restartButton = document.getElementById("btn-restart") as HTMLButtonElement;
restartButton.addEventListener("click", () => {
  // Seed is already in sessionStorage — reload will reuse it
  location.reload();
});

let gameStarted = false;
let elapsedGameTime = 0;

export function resetGameTimer() {
  elapsedGameTime = 0;
  gameStarted = true;
}

// Auto-tile fence sprites from roguelike sheet (wooden fence at rows 23-24, cols 45-51)
function getFenceSprite(index: number) {
  const x = index % GRID_COLS;
  const y = Math.floor(index / GRID_COLS);

  const isFence = (dx: number, dy: number) => {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) return false;
    return tiles[nx + ny * GRID_COLS] instanceof Fence;
  };

  const up = isFence(0, -1);
  const down = isFence(0, 1);
  const left = isFence(-1, 0);
  const right = isFence(1, 0);

  // Wooden fence sprites from rlSS (col, row):
  // (47, 23) = vertical segment    (47, 24) = horizontal segment
  // (46, 23) = cross/junction      (46, 24) = T-up (left+right+down)
  // (48, 24) = left end cap        (49, 24) = right end cap
  // (49, 23) = T-right (up+down+left)  (50, 23) = bottom-left corner
  // (48, 23) = T-left (up+down+right)  (51, 23) = bottom-right corner

  if (up && down && left && right) return rlSS.getSprite(46, 23); // cross
  if (up && down && right) return rlSS.getSprite(48, 23); // T-right
  if (up && down && left) return rlSS.getSprite(49, 23); // T-left
  if (left && right && down) return rlSS.getSprite(46, 24); // T-down
  if (left && right && up) return rlSS.getSprite(50, 24); // T-up
  if (up && down) return rlSS.getSprite(47, 23); // vertical
  if (left && right) return rlSS.getSprite(47, 24); // horizontal
  if (down && right) return rlSS.getSprite(48, 24); // corner top-left
  if (down && left) return rlSS.getSprite(49, 24); // corner top-right
  if (up && right) return rlSS.getSprite(50, 23); // corner bottom-left
  if (up && left) return rlSS.getSprite(51, 23); // corner bottom-right
  if (up || down) return rlSS.getSprite(47, 23); // vertical end cap
  if (left || right) return rlSS.getSprite(47, 24); // horizontal end cap
  return rlSS.getSprite(46, 23); // isolated post
}

function startGame(customMapData?: MapData) {
  if (customMapData) {
    loadWorld(customMapData);
    // Apply custom time limit (0 = no limit)
    if (customMapData.timeLimit > 0) {
      model.timeLimit = customMapData.timeLimit;
    } else {
      model.timeLimit = 0;
    }
  } else {
    const seed = parseInt(seedInput.value, 10) || generateNewSeed();
    sessionStorage.setItem("mapSeed", String(seed));
    generateWorld(seed);
  }

  // Hide start screen
  startScreen.style.display = "none";

  // Show "Back to Editor" button for custom maps
  if (customMapData) {
    const backBtn = document.createElement("button");
    backBtn.textContent = "EDITOR";
    backBtn.style.cssText = `
      position: fixed; left: 10px; bottom: 10px;
      font-family: monospace; font-size: 14px; padding: 8px 16px;
      background: #34393c; color: #d0e3e9; border: 1px solid #5e676b;
      cursor: pointer; z-index: 300000; opacity: 0.7;
    `;
    backBtn.addEventListener("click", () => {
      sessionStorage.setItem("editorMode", "true");
      location.reload();
    });
    backBtn.addEventListener("mouseenter", () => { backBtn.style.opacity = "1"; });
    backBtn.addEventListener("mouseleave", () => { backBtn.style.opacity = "0.7"; });
    document.body.appendChild(backBtn);
  }

  // Create tilemap
  const tilemap = new TileMap({
    rows: GRID_ROWS,
    columns: GRID_COLS,
    tileWidth: TILE_SIZE,
    tileHeight: TILE_SIZE,
  });

  let tileIndex = 0;
  for (let tile of tilemap.tiles) {
    const sprite = TileSheet.getSprite(
      tiles[tileIndex].sprite[0],
      tiles[tileIndex].sprite[1],
    );
    if (tiles[tileIndex] instanceof Tree) {
      tile.addGraphic(TileSheet.getSprite(0, 0)); // ground under tree
      tile.solid = true;
      // tree sprite is drawn by the swaying Actor overlay, not the tilemap
    } else if (tiles[tileIndex] instanceof Barrier) {
      tile.addGraphic(TileSheet.getSprite(0, 0)); // ground under barrier
      tile.solid = true;
      // barrier sprite is drawn by a separate Actor overlay
    } else if (tiles[tileIndex] instanceof Fence) {
      tile.addGraphic(TileSheet.getSprite(0, 0)); // ground under fence
      tile.solid = true;
      tile.addGraphic(getFenceSprite(tileIndex));
    } else if (tiles[tileIndex] instanceof OneWayGate) {
      tile.addGraphic(TileSheet.getSprite(0, 0)); // ground under gate
    } else if (tiles[tileIndex] instanceof DropZone) {
      tile.addGraphic(TileSheet.getSprite(0, 0)); // ground under drop zone
    } else if (tiles[tileIndex] instanceof ExitDoor) {
      tile.addGraphic(TileSheet.getSprite(0, 0)); // ground under exit door
    } else {
      tile.addGraphic(sprite);
    }
    if (tiles[tileIndex] instanceof Portal) {
      tile.addGraphic(rlSS.getSprite(31, 22));
    }
    tileIndex++;
  }

  // Add swaying tree overlays
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] instanceof Tree) {
      const tx = i % GRID_COLS;
      const ty = Math.floor(i / GRID_COLS);
      const treeActor = new Actor({
        pos: vec(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE),
        width: TILE_SIZE,
        height: TILE_SIZE * 2,
        z: zFromY(ty * TILE_SIZE + TILE_SIZE, Z_LAYER_TREE),
        anchor: vec(0.5, 1),
      });
      const treeSprite = TileSheet.getSprite(3, 0);
      treeActor.graphics.use(treeSprite);
      treeActor.graphics.localBounds = new BoundingBox(-8, -32, 8, 0);
      treeActor.graphics.onPreDraw = () => {
        const stretch = 1 + Math.sin(game.clock.now() * 0.002) * 0.05;
        treeActor.scale.y = stretch;
      };
      game.add(treeActor);
    }
  }

  // Add one-way gate arrow overlays
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] instanceof OneWayGate) {
      const gate = tiles[i] as OneWayGate;
      const tx = i % GRID_COLS;
      const ty = Math.floor(i / GRID_COLS);
      const gateActor = new Actor({
        pos: vec(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2),
        width: TILE_SIZE,
        height: TILE_SIZE,
        z: zFromY(ty * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_PICKUP),
      });
      gateActor.graphics.use(rlSS.getSprite(29, 22));
      switch (gate.direction) {
        case 'right': gateActor.rotation = 0; break;
        case 'down': gateActor.rotation = Math.PI / 2; break;
        case 'left': gateActor.rotation = Math.PI; break;
        case 'up': gateActor.rotation = -Math.PI / 2; break;
      }
      game.add(gateActor);
    }
  }

  // Add drop zone overlays (target markers for parcels)
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] instanceof DropZone) {
      const tx = i % GRID_COLS;
      const ty = Math.floor(i / GRID_COLS);
      const dzActor = new Actor({
        pos: vec(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2),
        width: TILE_SIZE,
        height: TILE_SIZE,
        z: zFromY(ty * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_PICKUP),
      });
      const dz = tiles[i] as DropZone;
      const [sc, sr] = PARCEL_SPRITES[dz.id % PARCEL_SPRITES.length];
      dzActor.graphics.use(rlSS.getSprite(sc, sr));
      // Gentle pulse animation
      const phase = i * 0.5;
      dzActor.graphics.onPreDraw = () => {
        const pulse = 0.8 + Math.sin(game.clock.now() * 0.003 + phase) * 0.2;
        dzActor.scale.x = pulse;
        dzActor.scale.y = pulse;
      };
      game.add(dzActor);
    }
  }

  // Add exit door overlays
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] instanceof ExitDoor) {
      const tx = i % GRID_COLS;
      const ty = Math.floor(i / GRID_COLS);
      const doorActor = new Actor({
        pos: vec(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2),
        width: TILE_SIZE,
        height: TILE_SIZE,
        z: zFromY(ty * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_PICKUP),
      });
      doorActor.graphics.use(rlSS.getSprite(35, 0));
      game.add(doorActor);
    }
  }

  // Initialize pathfinding
  initPathfinding(tilemap);

  // Move player to custom start if set
  if (customStartTile !== null) {
    const sx = (customStartTile % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
    const sy = Math.floor(customStartTile / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
    player.pos.x = sx;
    player.pos.y = sy;
    player.logicalTileIndex = customStartTile;
    player.currentMoveTileIndex = customStartTile;
  }

  // Add scene elements
  game.add(tilemap);
  game.currentScene.camera.zoom = 4;
  const cameraRadius =
    (Math.min(game.drawWidth, game.drawHeight) /
      game.currentScene.camera.zoom) *
    0.25;
  game.currentScene.camera.strategy.radiusAroundActor(player, cameraRadius);
  game.add(player);

  // Start recording
  activeEntry().recorder.startRecording();
  model.isRecording = true;

  // Spawn barriers and switches
  initBarriers(tilemap);
  spawnBarriers();

  // Spawn entities from custom map or procedurally
  if (customMapData) {
    spawnRocksAt(customMapData.rocks);
    spawnParcelsAt(customMapData.parcels);
    spawnCollectablesAt(customMapData.collectables);
    spawnMovingBlocksAt(customMapData.movingBlocks);
    spawnMonstersAt(customMapData.monsters);
  } else {
    spawnRocks(5);
    spawnParcels();
    spawnCollectables(COLLECTABLE_COUNT);
    spawnMovingBlocks(3);
    spawnMonsters(5);
  }

  // Game timer
  const timerText = new Text({
    text: "0:00.0",
    font: new Font({
      size: 48,
      unit: FontUnit.Px,
      family: "monospace",
      color: Color.White,
      textAlign: TextAlign.Center,
      shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
    }),
  });
  const timerLabel = new ScreenElement({
    pos: vec(0, 10),
    z: Z_HUD,
  });
  timerLabel.graphics.use(timerText);
  timerLabel.on("preupdate", () => {
    timerLabel.pos.x = game.screen.resolution.width / 2;
  });
  game.add(timerLabel);

  // Score display
  const scoreText = new Text({
    text: "0",
    font: new Font({
      size: 32,
      unit: FontUnit.Px,
      family: "monospace",
      color: Color.White,
      textAlign: TextAlign.Right,
      shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
    }),
  });
  const scoreLabel = new ScreenElement({
    pos: vec(0, 10),
    z: Z_HUD,
  });
  scoreLabel.graphics.use(scoreText);
  scoreLabel.on("preupdate", () => {
    scoreLabel.pos.x = game.screen.resolution.width - 10;
  });
  game.add(scoreLabel);
  let displayedScore = 0;

  // Pause button (top-left)
  const pauseText = new Text({
    text: "II",
    font: new Font({
      size: 32,
      unit: FontUnit.Px,
      family: "monospace",
      color: Color.White,
      textAlign: TextAlign.Left,
      shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
    }),
  });
  const pauseButton = new ScreenElement({
    pos: vec(10, 10),
    z: Z_HUD,
    width: 40,
    height: 40,
  });
  pauseButton.graphics.use(pauseText);
  pauseButton.on("pointerup", () => togglePause());
  onPauseChange((isPaused) => {
    pauseText.text = isPaused ? ">" : "II";
  });
  game.add(pauseButton);

  // Lives display (top-left, below pause)
  const livesText = new Text({
    text: "♥♥♥",
    font: new Font({
      size: 32,
      unit: FontUnit.Px,
      family: "monospace",
      color: Color.Red,
      textAlign: TextAlign.Left,
      shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
    }),
  });
  const livesLabel = new ScreenElement({
    pos: vec(10, 45),
    z: Z_HUD,
  });
  livesLabel.graphics.use(livesText);
  game.add(livesLabel);

  // Game over overlay
  const gameOverText = new Text({
    text: "GAME OVER",
    font: new Font({
      size: 200,
      unit: FontUnit.Px,
      family: "monospace",
      color: Color.Red,
      textAlign: TextAlign.Center,
      baseAlign: BaseAlign.Middle,
      shadow: { blur: 4, offset: vec(2, 2), color: Color.Black },
    }),
  });
  const gameOverLabel = new ScreenElement({
    pos: vec(0, 0),
    z: Z_COUNTDOWN,
  });
  gameOverLabel.graphics.use(gameOverText);
  gameOverLabel.graphics.visible = false;
  gameOverLabel.on("preupdate", () => {
    gameOverLabel.pos.x = game.screen.resolution.width / 2;
    gameOverLabel.pos.y = game.screen.resolution.height / 2;
  });
  game.add(gameOverLabel);

  // Level complete overlay
  const levelCompleteText = new Text({
    text: "LEVEL COMPLETE",
    font: new Font({
      size: 200,
      unit: FontUnit.Px,
      family: "monospace",
      color: Color.fromHex("#00e676"),
      textAlign: TextAlign.Center,
      baseAlign: BaseAlign.Middle,
      shadow: { blur: 4, offset: vec(2, 2), color: Color.Black },
    }),
  });
  const levelCompleteLabel = new ScreenElement({
    pos: vec(0, 0),
    z: Z_COUNTDOWN,
  });
  levelCompleteLabel.graphics.use(levelCompleteText);
  levelCompleteLabel.graphics.visible = false;
  levelCompleteLabel.on("preupdate", () => {
    levelCompleteLabel.pos.x = game.screen.resolution.width / 2;
    levelCompleteLabel.pos.y = game.screen.resolution.height / 2;
  });
  game.add(levelCompleteLabel);

  // Exit door handler — wire up on the active player (and re-wire after rewind)
  function wireExitDoor() {
    activeEntry().player.onReachedExitDoor = () => {
      if (model.gameOver) return;
      model.gameOver = true;
      sfxLevelComplete();
      levelCompleteLabel.graphics.visible = true;
      levelCompleteLabel.scale.x = 0.3;
      levelCompleteLabel.scale.y = 0.3;
      levelCompleteLabel.actions.scaleTo(vec(1, 1), vec(3, 3));
      restartButton.style.display = "block";
    };
  }
  wireExitDoor();
  setOnNewActivePlayer(wireExitDoor);

  // Death handler
  setOnPlayerKilled((killedPlayer) => {
    // Only the active (recording) player can die
    if (killedPlayer !== activeEntry().player) return;
    if (model.gameOver) return;

    model.lives--;
    livesText.text = "♥".repeat(model.lives) + "♡".repeat(3 - model.lives);
    sfxDeath();

    if (model.lives <= 0) {
      model.gameOver = true;
      gameOverLabel.graphics.visible = true;
      gameOverLabel.scale.x = 0.3;
      gameOverLabel.scale.y = 0.3;
      gameOverLabel.actions.scaleTo(vec(1, 1), vec(3, 3));
      // Show restart button
      restartButton.style.display = "block";
      return;
    }

    // Rewind: reset player to start, reset timer, replay all previous recordings
    replayAll();
    activeEntry().recorder.startRecording();
    model.isRecording = true;
    wireExitDoor();
  });

  // Countdown before game starts
  const countdownFont = new Font({
    size: 200,
    unit: FontUnit.Px,
    family: "monospace",
    color: Color.White,
    textAlign: TextAlign.Center,
    baseAlign: BaseAlign.Middle,
    shadow: { blur: 4, offset: vec(2, 2), color: Color.Black },
  });
  const countdownText = new Text({ text: "3", font: countdownFont });
  const countdownLabel = new ScreenElement({
    pos: vec(0, 0),
    z: Z_COUNTDOWN,
  });
  countdownLabel.graphics.use(countdownText);
  countdownLabel.on("preupdate", () => {
    countdownLabel.pos.x = game.screen.resolution.width / 2;
    countdownLabel.pos.y = game.screen.resolution.height / 2;
  });
  game.add(countdownLabel);

  function popIn() {
    countdownLabel.scale.x = 0.3;
    countdownLabel.scale.y = 0.3;
    countdownLabel.actions.scaleTo(vec(1, 1), vec(3, 3));
  }
  popIn();

  let countdown = 3;
  for (let i = 1; i <= 3; i++) {
    game.clock.schedule(() => {
      countdown--;
      if (countdown > 0) {
        countdownText.text = String(countdown);
        popIn();
      } else {
        countdownText.text = "GO!";
        popIn();

        // Start the game clock and enable input immediately at "GO!"
        gameStarted = true;
        elapsedGameTime = 0;
        setupClickHandler();

        // Remove the "GO!" text after a short delay
        game.clock.schedule(() => countdownLabel.kill(), 500);
      }
    }, i * 1000);
  }

  game.on("postupdate", (evt) => {
    if (!gameStarted) return;
    if (model.gameOver) return;
    updateMovingBlocks(evt.elapsed);
    updateMonsters(evt.elapsed);
    elapsedGameTime += evt.elapsed;

    if (model.timeLimit > 0) {
      // Display remaining time (countdown)
      const remaining = Math.max(0, model.timeLimit - elapsedGameTime);
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      const tenths = Math.floor((remaining % 1000) / 100);
      timerText.text = `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;

      // Flash red when under 10 seconds
      if (remaining < 10000) {
        const flash = Math.sin(game.clock.now() * 0.01) > 0;
        (timerText.font as Font).color = flash ? Color.Red : Color.White;
      } else {
        (timerText.font as Font).color = Color.White;
      }

      // Time's up — trigger time rewind (erase everything, no ghosts)
      if (elapsedGameTime >= model.timeLimit) {
        timeRewind();
        activeEntry().recorder.startRecording();
        model.isRecording = true;
        wireExitDoor();
      }
    } else {
      // No time limit — show elapsed time counting up
      const elapsed = elapsedGameTime;
      const mins = Math.floor(elapsed / 60000);
      const secs = Math.floor((elapsed % 60000) / 1000);
      const tenths = Math.floor((elapsed % 1000) / 100);
      timerText.text = `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;
    }

    const targetScore = getScore();
    if (displayedScore < targetScore) {
      const gap = targetScore - displayedScore;
      displayedScore += Math.max(1, Math.ceil(gap * 0.1));
      if (displayedScore > targetScore) displayedScore = targetScore;
    }
    scoreText.text = `${displayedScore}`;
  });
}

btnStart.addEventListener("click", () => startGame());
seedInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startGame();
});

/** Called from main.ts after resources are loaded, to start a custom map. */
export function startCustomMap(json: string) {
  const custom = deserializeMap(json);
  startGame(custom);
}
