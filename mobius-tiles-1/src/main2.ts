import "./style.css";
import {
  TileMap,
  Loader,
  ScreenElement,
  Text,
  Font,
  FontUnit,
  Color,
  vec,
  Actor,
  TextAlign,
  BaseAlign,
} from "excalibur";
import { Resources, TileSheet, rlSS } from "./resources";
import {
  Tree,
  Portal,
  tiles,
  GRID_COLS,
  GRID_ROWS,
  generateWorld,
  COLLECTABLE_COUNT,
} from "./tiledata";
import { player } from "./chap";
import { game } from "./game";
import { model } from "./model";
import { initPathfinding } from "./pathfinding";
import { activeEntry, setupClickHandler } from "./playerManager";
import { spawnRocks, spawnCollectables, getScore } from "./worldObjects";
import { Z_TREES, Z_HUD, Z_COUNTDOWN } from "./zIndex";

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

function startGame() {
  const seed = parseInt(seedInput.value, 10) || generateNewSeed();
  sessionStorage.setItem("mapSeed", String(seed));

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
      tile.addGraphic(TileSheet.getSprite(0, 0)); // ground under tree
      tile.solid = true;
      // tree sprite is drawn by the swaying Actor overlay, not the tilemap
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
        pos: vec(tx * 16 + 8, ty * 16 + 16),
        width: 16,
        height: 16,
        z: Z_TREES,
        anchor: vec(0.5, 1),
      });
      const treeSprite = TileSheet.getSprite(3, 0);
      treeActor.graphics.use(treeSprite);
      treeActor.graphics.onPreDraw = () => {
        const stretch = 1 + Math.sin(Date.now() * 0.002) * 0.05;
        treeActor.scale.y = stretch;
      };
      game.add(treeActor);
    }
  }

  // Initialize pathfinding
  initPathfinding(tilemap);

  // Add scene elements
  game.add(tilemap);
  game.currentScene.camera.zoom = 2;
  const cameraRadius =
    (Math.min(game.drawWidth, game.drawHeight) /
      game.currentScene.camera.zoom) *
    0.25;
  game.currentScene.camera.strategy.radiusAroundActor(player, cameraRadius);
  game.add(player);

  // Start recording
  activeEntry().recorder.startRecording();
  model.isRecording = true;

  // Spawn rocks
  spawnRocks(5);
  spawnCollectables(COLLECTABLE_COUNT);

  // Game timer
  const timerText = new Text({
    text: "0:00.0",
    font: new Font({
      size: 32,
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
      size: 24,
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
  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      countdownText.text = String(countdown);
      popIn();
    } else {
      clearInterval(countdownInterval);
      countdownText.text = "GO!";
      popIn();

      // Start the game clock and enable input immediately at "GO!"
      gameStartTime = performance.now();
      setupClickHandler();

      // Remove the "GO!" text after a short delay
      setTimeout(() => countdownLabel.kill(), 500);
    }
  }, 1000);

  game.on("postupdate", () => {
    if (gameStartTime === 0) return;
    const elapsed = performance.now() - gameStartTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    const tenths = Math.floor((elapsed % 1000) / 100);
    timerText.text = `${mins}:${secs.toString().padStart(2, "0")}.${tenths}`;
    const targetScore = getScore();
    if (displayedScore < targetScore) displayedScore++;
    scoreText.text = `${displayedScore}`;
  });
}

let gameStartTime = 0;

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
