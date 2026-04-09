import { Vector, Actor, Circle, Color, Polygon } from "excalibur";
import { PlayerActor, player } from "./PlayerActor";
import { playerWalkAnimation, playerImage } from "../../resources";
import { GameRecorder } from "../../interfaces/GameRecorder";
import {
	TILE_SIZE,
	GRID_COLS,
	GRID_ROWS,
	START_POS_X,
	START_POS_Y,
	START_TILE_INDEX,
	customStartTile,
} from "../../tiles/tiledata";
import { model } from "../../model";
import { game } from "../../game";
import { handleTileClick } from "../../ui/pathfinding";
import { resetRocks, resetParcels } from "../worldObjects";
import { resetMonsters } from "../monsters";
import { resetBarriers } from "../barriers";
import { resetGameTimer } from "../../gameLoop";
import { resetMovingBlocks } from "../movingBlocks";
import { zFromY, Z_LAYER_PLAYER, Z_RIPPLE } from "../../ui/zIndex";
import { spawnRewindPixels, REWIND_EFFECT_DURATION } from "../lightTrail";
import { IPlayerEntry } from "../../interfaces/IPlayerEntry";

let inputLockedUntil = 0;

export function lockInput(durationMs: number) {
	inputLockedUntil = game.clock.now() + durationMs;
}

// Wire first player's portal callback — only triggers if this player is the active (recording) one
player.onReachedPortal = () => {
	if (activeEntry().player === player) {
		stopAndSpawnNext();
		return true;
	}
	return false;
};

export const playerEntries: IPlayerEntry[] = [
	{ player, recorder: new GameRecorder(), recording: null },
];

// The active entry is always the last one in the array
export function activeEntry() {
	return playerEntries[playerEntries.length - 1];
}

// Arrow indicator hovering above the active player
let arrowActor: Actor | null = null;

export function spawnArrowIndicator() {
	if (arrowActor) return;

	arrowActor = new Actor({ z: 0 });
	const triangle = new Polygon({
		points: [new Vector(-5, 0), new Vector(5, 0), new Vector(0, 5)],
		color: Color.fromHex("#FFD700"),
	});
	arrowActor.graphics.use(triangle);
	arrowActor.on("postupdate", () => {
		const active = activeEntry();

		if (arrowActor) {
			arrowActor.graphics.isVisible = active.player.graphics.isVisible;
		}

		arrowActor!.pos.x = active.player.pos.x;
		arrowActor!.pos.y =
			active.player.pos.y - TILE_SIZE + Math.sin(game.clock.now() * 0.005) * 2;
		arrowActor!.z = zFromY(active.player.pos.y, Z_LAYER_PLAYER + 1);
	});
	game.add(arrowActor);
}

// Called whenever a new active player is created (after portal spawn)
let _onNewActivePlayer: (() => void) | null = null;
export function setOnNewActivePlayer(cb: (() => void) | null) {
	_onNewActivePlayer = cb;
}

// Resolve the actual start position (custom or default center)
function startPosX() {
	if (customStartTile !== null)
		return (customStartTile % GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
	return START_POS_X;
}

function startPosY() {
	if (customStartTile !== null)
		return Math.floor(customStartTile / GRID_COLS) * TILE_SIZE + TILE_SIZE / 2;
	return START_POS_Y;
}

function startTileIdx() {
	return customStartTile ?? START_TILE_INDEX;
}

// Reset all players to start and replay all recordings
export function replayAll() {
	model.isReplaying = true;
	resetRocks();
	resetParcels();
	resetBarriers();
	resetMovingBlocks();
	resetMonsters();
	resetGameTimer();
	for (const entry of playerEntries) {
		// Stop any in-progress replay
		entry.recorder.stopReplay();
		// Clear pending actions and movement
		entry.player.playerActionBuffer = [];
		entry.player.actions.clearActions();
		// Reset to start position
		entry.player.pos.x = startPosX();
		entry.player.pos.y = startPosY();
		entry.player.logicalTileIndex = startTileIdx();
		entry.player.currentMoveTileIndex = startTileIdx();
		entry.player.previousTileIndex = startTileIdx();
		entry.player.scale.x = 1;
		entry.player.scale.y = 1;
		entry.player.graphics.isVisible = true;
		entry.player.carriedRock = null;
		entry.player.carriedParcel = null;
		entry.player.ridingBlock = null;
		entry.player.onArriveAtTile = null;
		if (entry.recording) {
			entry.recorder.startReplay(entry.recording, (tileIndex) => {
				handleTileClick(tileIndex, entry.player);
			});
		}
	}
}

// Time rewind: reset the world AND erase all recordings/ghosts.
// Unlike replayAll(), nothing is replayed — everything since the last
// time rewind (or start) is permanently removed.
export function timeRewind() {
	model.isReplaying = true;
	resetRocks();
	resetParcels();
	resetBarriers();
	resetMovingBlocks();
	resetMonsters();
	resetGameTimer();

	// Stop any in-progress recording/replay for the active player
	const active = activeEntry();
	if (active.recorder.isRecording) {
		active.recorder.stopRecording();
	}
	active.recorder.stopReplay();

	// Kill and remove all extra spawned players (ghosts) from the scene
	for (let i = 0; i < playerEntries.length - 1; i++) {
		playerEntries[i].recorder.stopReplay();
		playerEntries[i].player.kill();
	}

	// Reset the first player (reuse the original) back to start
	const keeper = active.player;
	keeper.playerActionBuffer = [];
	keeper.actions.clearActions();
	keeper.pos.x = startPosX();
	keeper.pos.y = startPosY();
	keeper.logicalTileIndex = startTileIdx();
	keeper.currentMoveTileIndex = startTileIdx();
	keeper.previousTileIndex = startTileIdx();
	keeper.scale.x = 1;
	keeper.scale.y = 1;
	keeper.graphics.isVisible = true;
	keeper.carriedRock = null;
	keeper.carriedParcel = null;
	keeper.ridingBlock = null;
	keeper.onArriveAtTile = null;

	// Collapse entries to just this one player with no recording
	playerEntries.length = 0;
	playerEntries.push({
		player: keeper,
		recorder: new GameRecorder(),
		recording: null,
	});

	// Re-follow the surviving player
	const cameraRadius =
		(Math.min(game.drawWidth, game.drawHeight) /
			game.currentScene.camera.zoom) *
		0.25;
	game.currentScene.camera.strategy.radiusAroundActor(keeper, cameraRadius);

	model.isReplaying = false;
}

// Stop recording the active player, spawn a new one, replay all, and start recording the new one
export function stopAndSpawnNext() {
	const active = activeEntry();
	if (!active.recorder.isRecording) return;

	// Capture position before rewind for the pixel effect
	const oldPos = active.player.pos.clone();

	// Stop recording the active player and save its recording
	active.recording = active.recorder.stopRecording();
	model.isRecording = false;

	// Create a new player with the same sprites
	const newPlayer = new PlayerActor(
		{
			pos: new Vector(startPosX(), startPosY()),
			width: TILE_SIZE,
			height: TILE_SIZE,
		},
		playerWalkAnimation,
		playerImage,
	);
	newPlayer.onReachedPortal = () => {
		if (activeEntry().player === newPlayer) {
			stopAndSpawnNext();
			return true;
		}
		return false;
	};
	game.add(newPlayer);

	const newEntry: IPlayerEntry = {
		player: newPlayer,
		recorder: new GameRecorder(),
		recording: null,
	};
	playerEntries.push(newEntry);

	// Z-ordering is now handled dynamically by y-position in Player.onPostUpdate
	for (const entry of playerEntries) {
		entry.player.z = zFromY(entry.player.pos.y, Z_LAYER_PLAYER);
	}

	// Replay all previous players, start recording the new one
	replayAll();
	newEntry.recorder.startRecording();
	model.isRecording = true;

	// Rewind pixel effect: explode at old position, rebuild at start
	const startPos = new Vector(startPosX(), startPosY());
	newPlayer.graphics.isVisible = false;
	spawnRewindPixels(oldPos, startPos);
	game.clock.schedule(() => {
		newPlayer.graphics.isVisible = true;
		newPlayer.scale.x = 0.2;
		newPlayer.scale.y = 0.2;
		newPlayer.actions.scaleTo(new Vector(1, 1), new Vector(4, 4));
	}, REWIND_EFFECT_DURATION);

	// Follow the new player
	const cameraRadius =
		(Math.min(game.drawWidth, game.drawHeight) /
			game.currentScene.camera.zoom) *
		0.25;
	game.currentScene.camera.strategy.radiusAroundActor(newPlayer, cameraRadius);

	if (_onNewActivePlayer) _onNewActivePlayer();
}

function showTapRipple(worldPos: Vector) {
	const ripple = new Actor({
		pos: worldPos.clone(),
		z: Z_RIPPLE,
	});
	const circle = new Circle({ radius: 2, color: Color.fromHex("#ffffff80") });
	ripple.graphics.use(circle);
	game.add(ripple);
	ripple.actions
		.scaleTo(new Vector(1.5, 1.5), new Vector(40, 40))
		.callMethod(() => ripple.kill());
	ripple.actions.fade(0, 50);
}

function handlePointerDown(worldPos: Vector) {
	if (game.clock.now() < inputLockedUntil) return;
	const tile = game.currentScene.tileMaps[0].getTileByPoint(worldPos);
	if (!tile) return;
	if (tile.x < 0 || tile.x >= GRID_COLS || tile.y < 0 || tile.y >= GRID_ROWS)
		return;
	const targetTileIndex = tile.x + tile.y * GRID_COLS;

	const active = activeEntry();

	showTapRipple(worldPos);

	active.recorder.recordClick(targetTileIndex);
	handleTileClick(targetTileIndex, active.player);
}

export function setupClickHandler() {
	spawnArrowIndicator();
	game.input.pointers.primary.on("down", (evt) => {
		if (evt.worldPos == undefined) return;
		handlePointerDown(evt.worldPos);
	});
}
