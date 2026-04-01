import { Vector } from "excalibur";
import { Player, player } from "./chap";
import { plrWalk, plrImage } from "./resources";
import { GameRecorder, type GameRecording } from "./recorder";
import { GRID_COLS, GRID_ROWS, START_POS_X, START_POS_Y, START_TILE_INDEX } from "./tiledata";
import { model } from "./model";
import { game } from "./game";
import { handleTileClick } from "./pathfinding";
import { resetRocks } from "./worldObjects";
import { resetGameTimer } from "./main2";

export interface PlayerEntry {
  player: Player;
  recorder: GameRecorder;
  recording: GameRecording | null;
}

// Wire first player's portal callback — only triggers if this player is the active (recording) one
player.onReachedPortal = () => {
  if (activeEntry().player === player) { stopAndSpawnNext(); return true; }
  return false;
};

export const entries: PlayerEntry[] = [
  { player, recorder: new GameRecorder(), recording: null },
];

// The active entry is always the last one in the array
export function activeEntry() {
  return entries[entries.length - 1];
}

// Reset all players to start and replay all recordings
export function replayAll() {
  model.isReplaying = true;
  resetRocks();
  resetGameTimer();
  for (const entry of entries) {
    // Stop any in-progress replay
    entry.recorder.stopReplay();
    // Clear pending actions and movement
    entry.player.playerActionBuffer = [];
    entry.player.actions.clearActions();
    // Reset to start position
    entry.player.pos.x = START_POS_X;
    entry.player.pos.y = START_POS_Y;
    entry.player.logicalTileIndex = START_TILE_INDEX;
    entry.player.currentMoveTileIndex = START_TILE_INDEX;
    entry.player.previousTileIndex = START_TILE_INDEX;
    entry.player.scale.x = 1;
    entry.player.scale.y = 1;
    entry.player.graphics.visible = true;
    entry.player.carriedRock = null;
    entry.player.onArriveAtTile = null;
    if (entry.recording) {
      entry.recorder.startReplay(entry.recording, (tileIndex) => {
        handleTileClick(tileIndex, entry.player);
      });
    }
  }
}

// Stop recording the active player, spawn a new one, replay all, and start recording the new one
export function stopAndSpawnNext() {
  const active = activeEntry();
  if (!active.recorder.isRecording) return;

  // Stop recording the active player and save its recording
  active.recording = active.recorder.stopRecording();
  model.isRecording = false;

  // Create a new player with the same sprites
  const newPlayer = new Player(
    { pos: new Vector(START_POS_X, START_POS_Y), width: 16, height: 16 },
    plrWalk,
    plrImage,
  );
  newPlayer.onReachedPortal = () => {
    if (activeEntry().player === newPlayer) { stopAndSpawnNext(); return true; }
    return false;
  };
  game.add(newPlayer);

  const newEntry: PlayerEntry = {
    player: newPlayer,
    recorder: new GameRecorder(),
    recording: null,
  };
  entries.push(newEntry);

  // Set z-ordering: oldest player lowest, newest on top (all above rocks at z:1)
  for (let i = 0; i < entries.length; i++) {
    entries[i].player.z = 2 + i;
  }

  // Replay all previous players, start recording the new one
  replayAll();
  newEntry.recorder.startRecording();
  model.isRecording = true;

  // Follow the new player
  game.currentScene.camera.strategy.radiusAroundActor(newPlayer, 100);

}

export function setupClickHandler() {
  game.input.pointers.primary.on("down", (evt) => {
    if (evt.worldPos == undefined) return;

    const tile = game.currentScene.tileMaps[0].getTileByPoint(evt.worldPos);
    if (!tile) return;
    if (tile.x < 0 || tile.x >= GRID_COLS || tile.y < 0 || tile.y >= GRID_ROWS) return;
    const targetTileIndex = tile.x + tile.y * GRID_COLS;

    const active = activeEntry();

    active.recorder.recordClick(targetTileIndex);
    handleTileClick(targetTileIndex, active.player);
  });
}
