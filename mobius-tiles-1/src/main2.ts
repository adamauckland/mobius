import "./style.css";
import { TileMap, Loader, ScreenElement, Text, Font, FontUnit, Color, vec, Actor } from "excalibur";
import { Resources, TileSheet, rlSS } from "./resources";
import { Tree, Portal, tiles, GRID_COLS, GRID_ROWS, generateWorld, seededRandom } from "./tiledata";
import { player } from "./chap";
import { game } from "./game";
import { model } from "./model";
import { initPathfinding } from "./pathfinding";
import { activeEntry, setupClickHandler } from "./playerManager";
import { spawnRocks } from "./worldObjects";

// Pre-fill seed input with a random number
const seedInput = document.getElementById("seed-input") as HTMLInputElement;
const defaultSeed = Math.floor(Math.random() * 100000);
seedInput.value = String(defaultSeed);

// Wait for START button
const startScreen = document.getElementById("start-screen")!;
const btnStart = document.getElementById("btn-start")!;

function startGame() {
  const seed = parseInt(seedInput.value, 10) || defaultSeed;

  // Generate world from seed
  generateWorld(seed);

  // Hide start screen
  startScreen.style.display = "none";

  // Create tilemap
  const tilemap = new TileMap({
    rows: GRID_ROWS,
    columns: GRID_COLS,
    tileWidth: 16,
    tileHeight: 16,
  });

  let tileIndex = 0;
  for (let tile of tilemap.tiles) {
    const sprite = TileSheet.getSprite(
      tiles[tileIndex].sprite[0],
      tiles[tileIndex].sprite[1],
    );
    if (tiles[tileIndex] instanceof Tree) {
      tile.addGraphic(TileSheet.getSprite(0, 0));
      tile.solid = true;
    }
    tile.addGraphic(sprite);
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
        pos: vec(tx * 16 + 8, ty * 16 + 8),
        width: 16,
        height: 16,
      });
      const treeSprite = TileSheet.getSprite(3, 0);
      treeActor.graphics.use(treeSprite);
      const phase = seededRandom() * Math.PI * 2;
      treeActor.graphics.onPreDraw = () => {
        treeActor.graphics.offset.x = Math.sin(Date.now() * 0.001 + phase) * 0.5;
      };
      game.add(treeActor);
    }
  }

  // Initialize pathfinding
  initPathfinding(tilemap);

  // Add scene elements
  game.add(tilemap);
  game.currentScene.camera.strategy.radiusAroundActor(player, 100);
  game.currentScene.camera.zoom = 2;
  game.add(player);

  // Start recording
  activeEntry().recorder.startRecording();
  model.isRecording = true;

  // Spawn rocks
  spawnRocks(5);

  // Game timer
  const timerText = new Text({
    text: "0:00.0",
    font: new Font({
      size: 16,
      unit: FontUnit.Px,
      family: "monospace",
      color: Color.White,
      shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
    }),
  });
  const timerLabel = new ScreenElement({
    pos: vec(10, 10),
    z: 100,
  });
  timerLabel.graphics.use(timerText);
  game.add(timerLabel);

  gameStartTime = performance.now();

  game.on("postupdate", () => {
    const elapsed = performance.now() - gameStartTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    const tenths = Math.floor((elapsed % 1000) / 100);
    timerText.text = `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;
  });

  // Wire up click handler
  setupClickHandler();
}

let gameStartTime = performance.now();

export function resetGameTimer() {
  gameStartTime = performance.now();
}

// Load resources, then wait for START
const loader = new Loader();
loader.suppressPlayButton = true;
for (const resource of Object.values(Resources)) loader.addResource(resource);
await game.start(loader);
model.showHUD = true;

btnStart.addEventListener("click", startGame);
seedInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") startGame();
});
