import { TileMap, vec } from "excalibur";
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
	loadWorld,
	customStartTile,
} from "./tiles/tiledata";
import {
	deserializeMap,
	deserializeProject,
	type MapData,
} from "./levels/mapData";
import { player } from "./entities/PlayerActor";
import { game } from "./game";
import { model } from "./model";
import { initPathfinding } from "./pathfinding";
import {
	activeEntry,
	setupClickHandler,
	replayAll,
	stopAndSpawnNext,
	setOnNewActivePlayer,
} from "./entities/playerManager";
import {
	spawnRocksAt,
	spawnCollectablesAt,
	spawnParcelsAt,
} from "./entities/worldObjects";
import { initBarriers, spawnBarriers } from "./entities/barriers";
import { spawnMovingBlocksAt } from "./entities/movingBlocks";
import { spawnMonstersAt, setOnPlayerKilled } from "./entities/monsters";
import { sfxDeath, sfxLevelComplete } from "./sounds";
import { spawnDeathExplosion } from "./entities/lightTrail";
import { getFenceSprite } from "./tiles/fenceSprites";
import {
	spawnTreeOverlays,
	spawnGateOverlays,
	spawnDropZoneOverlays,
	spawnExitDoorOverlays,
} from "./tiles/tileOverlays";
import { createHUD } from "./ui/hud";
import { runCountdown } from "./ui/countdown";
import { resetGameTimer, setupGameLoop, startBonusCountdown } from "./gameLoop";
import { initPackBrowser } from "./ui/packBrowser";

export { resetGameTimer };

const startScreen = document.getElementById("start-screen")!;
const restartButton = document.getElementById(
	"btn-restart",
) as HTMLButtonElement;
restartButton.addEventListener("click", () => {
	// For project mode: re-store the project so the reload picks it up
	if (model.projectJson) {
		localStorage.setItem("customProject", model.projectJson);
		localStorage.setItem("customProjectLevel", String(model.currentLevel));
		// Don't preserve lives on restart — reset to 3
	}
	location.reload();
});
const continueButton = document.getElementById(
	"btn-continue",
) as HTMLButtonElement;
const levelTransition = document.getElementById("level-transition")!;
const transitionSubtitle = document.getElementById("transition-subtitle")!;
const transitionTitle = document.getElementById("transition-title")!;
const transitionLives = document.getElementById("transition-lives")!;

continueButton.addEventListener("click", () => {
	if (!model.projectJson || model.currentLevel + 1 >= model.totalLevels) return;
	const nextLevel = model.currentLevel + 1;

	// Parse the project to get the next level's name
	const proj = deserializeProject(model.projectJson);
	const nextLevelName = proj.levels[nextLevel]?.name || "Untitled";

	// Show the transition overlay immediately (before reload)
	transitionSubtitle.textContent = `Level ${nextLevel + 1} of ${model.totalLevels}`;
	transitionTitle.textContent = nextLevelName;
	transitionLives.textContent = "\u2665".repeat(model.lives) + "\u2661".repeat(3 - model.lives);
	levelTransition.style.display = "flex";

	// Hide buttons and start screen so nothing peeks through
	continueButton.style.display = "none";
	restartButton.style.display = "none";

	// Persist state and reload
	localStorage.setItem("customProject", model.projectJson);
	localStorage.setItem("customProjectLevel", String(nextLevel));
	localStorage.setItem("projectLives", String(model.lives));
	localStorage.setItem("levelTransition", JSON.stringify({
		level: nextLevel + 1,
		total: model.totalLevels,
		name: nextLevelName,
		lives: model.lives,
	}));
	location.reload();
});

// On page load: if a level transition is in progress, show the overlay immediately
// so the start screen never flashes.
const savedTransition = localStorage.getItem("levelTransition");
if (savedTransition) {
	try {
		const t = JSON.parse(savedTransition);
		transitionSubtitle.textContent = `Level ${t.level} of ${t.total}`;
		transitionTitle.textContent = t.name;
		transitionLives.textContent = "\u2665".repeat(t.lives) + "\u2661".repeat(3 - t.lives);
		levelTransition.style.display = "flex";
		startScreen.style.display = "none";
	} catch { /* ignore parse errors */ }
}

function startGame(customMapData: MapData) {
	loadWorld(customMapData);
	if (customMapData.timeLimit > 0) {
		model.timeLimit = customMapData.timeLimit;
	} else {
		model.timeLimit = 0;
	}

	// Hide start screen
	startScreen.style.display = "none";

	// Fade out level transition overlay if visible
	if (localStorage.getItem("levelTransition")) {
		localStorage.removeItem("levelTransition");
		levelTransition.style.opacity = "0";
		setTimeout(() => { levelTransition.style.display = "none"; levelTransition.style.opacity = "1"; }, 400);
	}

	// Show "Back to Editor" button
	const backBtn = document.createElement("button");
	backBtn.textContent = "EDITOR";
	backBtn.style.cssText = `
    position: fixed; left: 10px; bottom: 10px;
    font-family: monospace; font-size: 14px; padding: 8px 16px;
    background: #34393c; color: #d0e3e9; border: 1px solid #5e676b;
    cursor: pointer; z-index: 300000; opacity: 0.7;
  `;
	backBtn.addEventListener("click", () => {
		localStorage.setItem("editorMode", "true");
		location.reload();
	});
	backBtn.addEventListener("mouseenter", () => {
		backBtn.style.opacity = "1";
	});
	backBtn.addEventListener("mouseleave", () => {
		backBtn.style.opacity = "0.7";
	});
	document.body.appendChild(backBtn);

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
		} else if (tiles[tileIndex] instanceof Barrier) {
			tile.addGraphic(TileSheet.getSprite(0, 0)); // ground under barrier
			tile.solid = true;
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

	// Spawn tile overlays
	spawnTreeOverlays();
	spawnGateOverlays();
	spawnDropZoneOverlays();
	spawnExitDoorOverlays();

	// Initialize pathfinding
	initPathfinding(tilemap);

	// Move player to custom start if set
	if (customStartTile !== null) {
		const sx = (customStartTile % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
		const sy =
			Math.floor(customStartTile / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
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

	// Spawn entities from map data
	spawnRocksAt(customMapData.rocks);
	spawnParcelsAt(customMapData.parcels);
	spawnCollectablesAt(customMapData.collectables);
	spawnMovingBlocksAt(customMapData.movingBlocks);
	spawnMonstersAt(customMapData.monsters);

	// Create HUD
	const hud = createHUD();

	// Exit door handler — wire up on the active player (and re-wire after rewind)
	function wireExitDoor() {
		activeEntry().player.onReachedExitDoor = () => {
			if (model.gameOver) return;
			model.gameOver = true;
			sfxLevelComplete();
			hud.levelCompleteLabel.graphics.isVisible = true;
			hud.levelCompleteLabel.scale.x = 0.3;
			hud.levelCompleteLabel.scale.y = 0.3;
			hud.levelCompleteLabel.actions.scaleTo(vec(1, 1), vec(3, 3));
			startBonusCountdown();
			restartButton.style.display = "block";
			// Show continue button if there are more levels
			if (model.projectJson && model.currentLevel + 1 < model.totalLevels) {
				continueButton.style.display = "block";
			}
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
		hud.livesText.text =
			"\u2665".repeat(model.lives) + "\u2661".repeat(3 - model.lives);
		sfxDeath();
		killedPlayer.graphics.isVisible = false;
		spawnDeathExplosion(killedPlayer.pos.clone());

		if (model.lives <= 0) {
			game.clock.schedule(() => {
				model.gameOver = true;
				hud.gameOverLabel.graphics.isVisible = true;
				hud.gameOverLabel.scale.x = 0.3;
				hud.gameOverLabel.scale.y = 0.3;
				hud.gameOverLabel.actions.scaleTo(vec(1, 1), vec(3, 3));
				restartButton.style.display = "block";
			}, 2000);
			return;
		}

		// Rewind: delay so the explosion plays out, then reset
		game.clock.schedule(() => {
			replayAll();
			activeEntry().recorder.startRecording();
			model.isRecording = true;
			wireExitDoor();
		}, 2000);
	});

	// Rewind button — triggers time rewind without blocking input
	hud.rewindButton.on("pointerup", () => {
		if (model.gameOver) return;
		stopAndSpawnNext();
		wireExitDoor();
	});

	// Countdown then start
	runCountdown(() => {
		resetGameTimer();
		setupClickHandler();
	});

	// Game loop
	setupGameLoop(hud, () => {
		restartButton.style.display = "block";
	});
}

// "Play Project" button on start screen — pick a .json file and play from level 1
const btnPlayProject = document.getElementById("btn-play-project");
if (btnPlayProject) {
	btnPlayProject.addEventListener("click", () => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json";
		input.onchange = () => {
			const file = input.files?.[0];
			if (!file) return;
			const reader = new FileReader();
			reader.onload = () => {
				try {
					const json = reader.result as string;
					startProjectLevel(json, 0);
				} catch {
					alert("Failed to load project file");
				}
			};
			reader.readAsText(file);
		};
		input.click();
	});
}

// "Browse Packs" button
initPackBrowser(startProjectLevel);

/** Called from main.ts after resources are loaded, to start a custom map. */
export function startCustomMap(json: string) {
	const custom = deserializeMap(json);
	startGame(custom);
}

/** Called from main.ts to start a specific level from a project. */
export function startProjectLevel(projectJson: string, levelIndex: number) {
	const proj = deserializeProject(projectJson);
	if (levelIndex < 0 || levelIndex >= proj.levels.length) levelIndex = 0;
	model.projectJson = projectJson;
	model.currentLevel = levelIndex;
	model.totalLevels = proj.levels.length;
	// Restore lives from localStorage if continuing from a previous level
	const savedLives = localStorage.getItem("projectLives");
	if (savedLives !== null) {
		model.lives = parseInt(savedLives, 10);
		localStorage.removeItem("projectLives");
	}
	startGame(proj.levels[levelIndex]);
}
