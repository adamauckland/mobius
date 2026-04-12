import { TileMap, vec } from "excalibur";
import { TileSheet, rlSS } from "@/resources/resources";
import {
	Tree,
	Void,
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
} from "@/tiles/tiledata";
import { deserializeMap, deserializeProject } from "@/levels/mapData";
import { type IMapData } from "@/interfaces/IMapData";
import { player } from "@/entities/Player/PlayerActor";
import { game } from "@/game";
import { model } from "@/model";
import { initPathfinding } from "@/ui/pathfinding";
import {
	activeEntry,
	setupClickHandler,
	replayAll,
	stopAndSpawnNext,
	setOnNewActivePlayer,
} from "@/entities/Player/playerManager";
import { initWorldObjectsTileMap } from "@/entities";
import { spawnParcelsAt } from "./entities/Parcel/Parcel";
import { spawnCollectablesAt } from "./entities/Collectable/collectables";
import { spawnRocksAt } from "./entities/Rock/rocks";
import {
	initBarriers,
	spawnBarriers,
	setupBarrierEvents,
} from "@/entities/Barrier/barriers";
import { gameEventBus } from "@/events/GameEventBus";
import { spawnMovingBlocksAt } from "@/entities/MovingPlatform/movingPlatform";
import { spawnCritterGroupsAt } from "@/entities/Critter/spawn";
import {
	spawnMonstersAt,
	setOnPlayerKilled,
} from "@/entities/Monster/monsters";
import { sfxDeath, sfxLevelComplete, sfxExitDoorOpen } from "@/audio/sounds";
import {
	spawnDeathExplosion,
	spawnExitDoorReveal,
} from "@/entities/Light/lightTrail";
import { getCritterCount } from "@/entities/Critter/state";
import { canCompleteLevel } from "@/rules/canCompleteLevel";
import { shouldHandlePlayerDeath, canRevive } from "@/rules/deathRules";
import {
	setOnAllCrittersCollected,
	resetAllCrittersCollectedFlag,
} from "@/entities/Critter/collection";
import { getFenceSprite } from "@/tiles/fenceSprites";
import {
	spawnTreeOverlays,
	spawnGateOverlays,
	spawnDropZoneOverlays,
	spawnExitDoorOverlays,
} from "@/tiles/tileOverlays";
import { createHUD } from "@/ui/hud";
import { runCountdown } from "@/ui/countdown";
import { resetGameTimer, setupGameLoop, startBonusCountdown } from "@/gameLoop";
import { initPackBrowser } from "@/ui/packBrowser";
import type { HUDRefs } from "@/ui/hud";
import type { Actor } from "excalibur";

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
	transitionLives.textContent =
		"\u2665".repeat(model.lives) + "\u2661".repeat(3 - model.lives);
	levelTransition.style.display = "flex";

	// Hide buttons and start screen so nothing peeks through
	continueButton.style.display = "none";
	restartButton.style.display = "none";

	// Persist state and reload
	localStorage.setItem("customProject", model.projectJson);
	localStorage.setItem("customProjectLevel", String(nextLevel));
	localStorage.setItem("projectLives", String(model.lives));
	localStorage.setItem(
		"levelTransition",
		JSON.stringify({
			level: nextLevel + 1,
			total: model.totalLevels,
			name: nextLevelName,
			lives: model.lives,
		}),
	);
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
		transitionLives.textContent =
			"\u2665".repeat(t.lives) + "\u2661".repeat(3 - t.lives);
		levelTransition.style.display = "flex";
		startScreen.style.display = "none";
	} catch {
		/* ignore parse errors */
	}
}

function hideStartScreen() {
	startScreen.style.display = "none";
}

function fadeLevelTransition() {
	if (!localStorage.getItem("levelTransition")) return;
	localStorage.removeItem("levelTransition");
	levelTransition.style.opacity = "0";
	setTimeout(() => {
		levelTransition.style.display = "none";
		levelTransition.style.opacity = "1";
	}, 400);
}

function createEditorButton() {
	const backBtn = document.createElement("button");
	backBtn.textContent = "EDITOR";
	backBtn.style.cssText = `
    position: fixed; left: 10px; bottom: 10px;
    font-family: "Sixtyfour", monospace; font-size: 14px; padding: 8px 16px;
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
}

function applyTileGraphic(tile: any, tileIndex: number) {
	const tileData = tiles[tileIndex];
	const sprite = TileSheet.getSprite(tileData.sprite[0], tileData.sprite[1]);

	if (tileData instanceof Tree) {
		tile.addGraphic(TileSheet.getSprite(0, 0));
		tile.solid = true;
	} else if (tileData instanceof Void) {
		tile.solid = true;
	} else if (tileData instanceof Barrier) {
		tile.addGraphic(TileSheet.getSprite(0, 0));
		tile.solid = true;
	} else if (tileData instanceof Fence) {
		tile.addGraphic(TileSheet.getSprite(0, 0));
		tile.solid = true;
		tile.addGraphic(getFenceSprite(tileIndex));
	} else if (tileData instanceof OneWayGate) {
		tile.addGraphic(TileSheet.getSprite(0, 0));
	} else if (tileData instanceof DropZone) {
		tile.addGraphic(TileSheet.getSprite(0, 0));
		tile.solid = true;
	} else if (tileData instanceof ExitDoor) {
		tile.addGraphic(TileSheet.getSprite(0, 0));
	} else {
		tile.addGraphic(sprite);
	}
	if (tileData instanceof Portal) {
		tile.addGraphic(rlSS.getSprite(31, 22));
	}
}

function createTilemap(): TileMap {
	const tilemap = new TileMap({
		rows: GRID_ROWS,
		columns: GRID_COLS,
		tileWidth: TILE_SIZE,
		tileHeight: TILE_SIZE,
	});
	let tileIndex = 0;
	for (let tile of tilemap.tiles) {
		applyTileGraphic(tile, tileIndex);
		tileIndex++;
	}
	return tilemap;
}

function movePlayerToStart() {
	if (customStartTile === null) return;
	const sx = (customStartTile % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
	const sy =
		Math.floor(customStartTile / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
	player.pos.x = sx;
	player.pos.y = sy;
	player.logicalTileIndex = customStartTile;
	player.currentMoveTileIndex = customStartTile;
}

function setupCamera() {
	game.currentScene.camera.zoom = 4;
	const cameraRadius =
		(Math.min(game.drawWidth, game.drawHeight) /
			game.currentScene.camera.zoom) *
		0.25;
	game.currentScene.camera.strategy.radiusAroundActor(player, cameraRadius);
}

function startRecording() {
	activeEntry().recorder.startRecording();
	gameEventBus.startRecording();
	model.isRecording = true;
}

function spawnEntities(customMapData: IMapData) {
	spawnRocksAt(customMapData.rocks);
	spawnParcelsAt(customMapData.parcels);
	spawnCollectablesAt(customMapData.collectables);
	spawnCritterGroupsAt(customMapData.critters);
	spawnMovingBlocksAt(customMapData.movingBlocks);
	spawnMonstersAt(customMapData.monsters);
}

function triggerLevelComplete(hud: HUDRefs) {
	if (model.gameOver) return;
	model.gameOver = true;
	sfxLevelComplete();
	hud.dimOverlay.graphics.isVisible = true;
	hud.levelCompleteLabel.graphics.isVisible = true;
	hud.levelCompleteLabel.scale.x = 0.3;
	hud.levelCompleteLabel.scale.y = 0.3;
	hud.levelCompleteLabel.actions.scaleTo(vec(1, 1), vec(3, 3));
	startBonusCountdown(hud);
	restartButton.style.display = "block";
	if (model.projectJson && model.currentLevel + 1 < model.totalLevels) {
		continueButton.style.display = "block";
	}
}

function revealExitDoors(doorActors: Actor[]) {
	for (const door of doorActors) {
		door.graphics.isVisible = true;
		door.scale.x = 0;
		door.scale.y = 0;
		door.actions.scaleTo(vec(1, 1), vec(3, 3));
		spawnExitDoorReveal(door.pos.clone());
	}
	sfxExitDoorOpen();
}

function hideExitDoors(doorActors: Actor[]) {
	for (const door of doorActors) {
		door.graphics.isVisible = false;
		door.actions.clearActions();
		door.scale.x = 1;
		door.scale.y = 1;
	}
	resetAllCrittersCollectedFlag();
}

function setupExitDoorGating(hud: HUDRefs, doorActors: Actor[]) {
	const hasCritters = getCritterCount().total > 0;

	if (hasCritters) {
		hideExitDoors(doorActors);
		setOnAllCrittersCollected(() => {
			if (doorActors.length > 0) {
				revealExitDoors(doorActors);
			} else {
				triggerLevelComplete(hud);
			}
		});
	}

	function wireExitDoor() {
		activeEntry().player.onReachedExitDoor = () => {
			const { total, collected } = getCritterCount();
			if (
				!canCompleteLevel({
					critterTotal: total,
					critterCollected: collected,
				})
			) {
				return;
			}
			triggerLevelComplete(hud);
		};
		if (hasCritters) {
			hideExitDoors(doorActors);
		}
	}
	wireExitDoor();
	setOnNewActivePlayer(wireExitDoor);

	return wireExitDoor;
}

function setupDeathHandler(hud: HUDRefs, wireExitDoor: () => void) {
	setOnPlayerKilled((killedPlayer) => {
		if (
			!shouldHandlePlayerDeath({
				killedPlayerIsActive: killedPlayer === activeEntry().player,
				gameOver: model.gameOver,
			})
		) {
			return;
		}

		model.lives--;
		hud.livesText.text = "\u2665".repeat(model.lives);
		sfxDeath();
		killedPlayer.graphics.isVisible = false;
		spawnDeathExplosion(killedPlayer.pos.clone());

		if (!canRevive({ livesRemaining: model.lives })) {
			showGameOver(hud);
			return;
		}

		game.clock.schedule(() => {
			replayAll();
			activeEntry().recorder.startRecording();
			model.isRecording = true;
			wireExitDoor();
		}, 2000);
	});
}

function showGameOver(hud: HUDRefs) {
	game.clock.schedule(() => {
		model.gameOver = true;
		hud.dimOverlay.graphics.isVisible = true;
		hud.gameOverLabel.graphics.isVisible = true;
		hud.gameOverLabel.scale.x = 0.3;
		hud.gameOverLabel.scale.y = 0.3;
		hud.gameOverLabel.actions.scaleTo(vec(1, 1), vec(3, 3));
		restartButton.style.display = "block";
	}, 2000);
}

function startGame(customMapData: IMapData) {
	loadWorld(customMapData);
	model.timeLimit = customMapData.timeLimit > 0 ? customMapData.timeLimit : 0;

	hideStartScreen();
	fadeLevelTransition();
	createEditorButton();

	const tilemap = createTilemap();
	spawnTreeOverlays();
	spawnGateOverlays();
	spawnDropZoneOverlays();
	const doorActors = spawnExitDoorOverlays();

	initPathfinding(tilemap);
	initWorldObjectsTileMap(tilemap);
	movePlayerToStart();

	game.add(tilemap);
	setupCamera();
	game.add(player);

	startRecording();
	initBarriers(tilemap);
	spawnBarriers();
	setupBarrierEvents();
	spawnEntities(customMapData);

	const hud = createHUD();
	const wireExitDoor = setupExitDoorGating(hud, doorActors);
	setupDeathHandler(hud, wireExitDoor);

	hud.rewindButton.on("pointerup", () => {
		if (model.gameOver) return;
		stopAndSpawnNext();
		wireExitDoor();
	});

	runCountdown(() => {
		resetGameTimer();
		setupClickHandler();
	});

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
