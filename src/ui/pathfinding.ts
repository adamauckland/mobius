import {
	ExcaliburAStar,
	ExcaliburGraph,
	GraphTileMap,
	aStarNode,
	GraphNode,
} from "@excaliburjs/plugin-pathfinding";
import { TileMap } from "excalibur";
import {
	DropZone,
	tiles,
	TILE_SIZE,
	GRID_COLS,
	GRID_ROWS,
} from "@/tiles/tiledata";
import { PlayerActor } from "@/entities/Player/PlayerActor";
import { model } from "@/model";
import {
	getParcelAtTile,
	pickUpParcel,
	dropParcel,
} from "@/entities/Parcel/Parcel";
import { getRockAtTile, pickUpRock, dropRock } from "@/entities/Rock/rocks";
import { game } from "@/game";
import { dismountBlock } from "@/entities/MovingPlatform/movingPlatform";
import { canPickUpItem, canDropItemAtTile } from "@/rules/carryRules";

// create graph for dijkstra — deferred until initPathfinding so tiles are populated
let myDijkstraGraph = new ExcaliburGraph();
let myGraphTileMap: GraphTileMap;

let myGraph: ExcaliburAStar;
let storedTilemap: TileMap;

export function initPathfinding(tilemap: TileMap) {
	storedTilemap = tilemap;
	myGraph = new ExcaliburAStar(tilemap);
	// Build the Dijkstra graph now that tiles are populated
	myGraphTileMap = {
		name: "myGraph",
		tiles: [...tiles],
		rows: GRID_ROWS,
		cols: GRID_COLS,
	};
	myDijkstraGraph = new ExcaliburGraph();
	myDijkstraGraph.addTileMap(myGraphTileMap, true);
}

/** Rebuild both pathfinding graphs after barrier tiles change. */
export function rebuildPathfinding() {
	myGraphTileMap = {
		name: "myGraph",
		tiles: [...tiles],
		rows: GRID_ROWS,
		cols: GRID_COLS,
	};
	resetDijkstraGraph();
	if (storedTilemap) {
		myGraph = new ExcaliburAStar(storedTilemap);
	}
}

export function resetDijkstraGraph() {
	myDijkstraGraph.resetGraph();
	if (model.inputDiagonal) {
		myDijkstraGraph.addTileMap(myGraphTileMap, true);
	} else {
		myDijkstraGraph.addTileMap(myGraphTileMap);
	}
}

function showWarning() {
	model.showWarning = true;
	model.warningColor = "red";
	game.clock.schedule(() => {
		model.showWarning = false;
		model.warningColor = "white";
	}, 2000);
}

/** Returns the tile index the player is currently on (or moving toward). */
function getPlayerTileIndex(player: PlayerActor): number {
	if (player.actions.getQueue().hasNext()) {
		return player.currentMoveTileIndex;
	}
	const tx = Math.floor(player.pos.x / TILE_SIZE);
	const ty = Math.floor(player.pos.y / TILE_SIZE);
	return tx + ty * GRID_COLS;
}

/** Returns true if the tile is impassable. */
function isTileBlocked(tileIndex: number): boolean {
	const tile = tiles[tileIndex];
	if (!tile) return true;
	return tile.collider === true;
}

/**
 * BFS outward from `startIndex` to find the nearest passable tile.
 * Returns the tile index, or null if none found.
 */
export function findNearestPassableTile(startIndex: number): number | null {
	const visited = new Set<number>();
	const queue: number[] = [startIndex];
	visited.add(startIndex);

	while (queue.length > 0) {
		const idx = queue.shift()!;
		if (idx !== startIndex && !isTileBlocked(idx)) return idx;

		const x = idx % GRID_COLS;
		const y = Math.floor(idx / GRID_COLS);
		for (const [dx, dy] of [
			[0, -1],
			[0, 1],
			[-1, 0],
			[1, 0],
		] as const) {
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
			const nIdx = nx + ny * GRID_COLS;
			if (visited.has(nIdx)) continue;
			visited.add(nIdx);
			queue.push(nIdx);
		}
	}
	return null;
}

/**
 * BFS from `playerIndex` through passable tiles only. Returns the visited
 * tile whose Manhattan distance to `targetIndex` is smallest — i.e. the
 * reachable tile nearest the (possibly unreachable) target. Returns null
 * if the player is somehow boxed in with no neighbours considered.
 */
export function findReachableTileNearTarget(
	playerIndex: number,
	targetIndex: number,
): number | null {
	const targetX = targetIndex % GRID_COLS;
	const targetY = Math.floor(targetIndex / GRID_COLS);
	const visited = new Set<number>();
	const queue: number[] = [playerIndex];
	visited.add(playerIndex);

	let bestIndex: number | null = playerIndex;
	let bestDist =
		Math.abs((playerIndex % GRID_COLS) - targetX) +
		Math.abs(Math.floor(playerIndex / GRID_COLS) - targetY);

	while (queue.length > 0) {
		const idx = queue.shift()!;
		const x = idx % GRID_COLS;
		const y = Math.floor(idx / GRID_COLS);
		for (const [dx, dy] of [
			[0, -1],
			[0, 1],
			[-1, 0],
			[1, 0],
		] as const) {
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
			const nIdx = nx + ny * GRID_COLS;
			if (visited.has(nIdx)) continue;
			visited.add(nIdx);
			if (isTileBlocked(nIdx)) continue;
			const dist = Math.abs(nx - targetX) + Math.abs(ny - targetY);
			if (dist < bestDist) {
				bestDist = dist;
				bestIndex = nIdx;
			}
			queue.push(nIdx);
		}
	}
	return bestIndex;
}

/** If clicking own tile while carrying something, drop it. Returns true if an item was dropped. */
function tryDropCarriedItem(
	targetTileIndex: number,
	player: PlayerActor,
): boolean {
	const dropState = {
		targetTileIndex,
		playerTileIndex: getPlayerTileIndex(player),
		carryingRock: !!player.carriedRock,
		carryingParcel: !!player.carriedParcel,
	};
	if (!canDropItemAtTile(dropState)) return false;

	if (player.carriedRock) {
		dropRock(player);
		return true;
	}
	if (player.carriedParcel) {
		dropParcel(player);
		return true;
	}
	return false;
}

/** Set up an arrival callback to pick up a rock or parcel at the target tile. */
function setArrivalPickup(targetTileIndex: number, player: PlayerActor) {
	player.onArriveAtTile = null;

	const carryStateNow = () => ({
		carryingRock: !!player.carriedRock,
		carryingParcel: !!player.carriedParcel,
	});
	if (!canPickUpItem(carryStateNow())) return;

	const rock = getRockAtTile(targetTileIndex);
	if (rock) {
		player.onArriveAtTile = () => {
			if (!rock.carriedBy && canPickUpItem(carryStateNow())) {
				pickUpRock(rock, player);
			}
		};
		return;
	}

	const parcel = getParcelAtTile(targetTileIndex);
	if (parcel) {
		player.onArriveAtTile = () => {
			if (!parcel.carriedBy && canPickUpItem(carryStateNow())) {
				pickUpParcel(parcel, player);
			}
		};
	}
}

/** Run the selected pathfinding algorithm and return { path, startingIndex }. */
function findPath(
	playerTileIndex: number,
	targetTileIndex: number,
): { path: GraphNode[] | aStarNode[]; startingIndex: number } {
	const letDiag = !!model.inputDiagonal;

	if (model.inputAlgo?.value == "dijkstra") {
		const path = myDijkstraGraph.shortestPath(
			myDijkstraGraph.nodes.get(`${playerTileIndex}`)!,
			myDijkstraGraph.nodes.get(`${targetTileIndex}`)!,
		);
		model.algoDuration = myDijkstraGraph.duration.toFixed(3);
		model.movesRemaining = path.length - 1;
		if (path.length == 1) {
			model.warningText = "UNREACHABLE TILE";
			showWarning();
		}
		return { path, startingIndex: 1 };
	}

	const path = myGraph.astar(
		myGraph.getNodeByIndex(playerTileIndex),
		myGraph.getNodeByIndex(targetTileIndex),
		letDiag,
	);
	model.algoDuration = myGraph.duration.toFixed(3);
	model.movesRemaining = path.length;
	if (path.length == 0) {
		model.warningText = "UNREACHABLE TILE";
		showWarning();
	}
	return { path, startingIndex: 0 };
}

/** Push path nodes into the player's action buffer and update logical destination. */
function queuePath(
	player: PlayerActor,
	path: GraphNode[] | aStarNode[],
	startingIndex: number,
) {
	for (let i = startingIndex; i < path.length; i++) {
		player.playerActionBuffer.push(parseInt(path[i].id.toString()));
	}
	if (path.length > 0) {
		player.logicalTileIndex = parseInt(path[path.length - 1].id.toString());
	}
}

function isMatchingDropZoneForPlayer(
	tileIndex: number,
	player: PlayerActor,
): boolean {
	const tile = tiles[tileIndex];
	return (
		tile instanceof DropZone &&
		!tile.fulfilled &&
		player.carriedParcel != null &&
		tile.id === player.carriedParcel.id
	);
}

function resolveBlockedTarget(
	playerTileIndex: number,
	targetTileIndex: number,
): number | null {
	const nearest = findReachableTileNearTarget(
		playerTileIndex,
		targetTileIndex,
	);
	if (nearest === null || nearest === playerTileIndex) return null;
	return nearest;
}

/** Temporarily mark a drop zone as walkable, run a callback, then restore. */
function withDropZoneWalkable(tileIndex: number, callback: () => void) {
	const targetTile = tiles[tileIndex];
	if (!(targetTile instanceof DropZone)) return callback();
	const tilemapTile = storedTilemap.tiles[tileIndex];
	const prevSolid = tilemapTile.solid;
	const prevCollider = targetTile.collider;
	tilemapTile.solid = false;
	targetTile.collider = false;
	rebuildPathfinding();
	callback();
	tilemapTile.solid = prevSolid;
	targetTile.collider = prevCollider;
	rebuildPathfinding();
}

function tryDismount(player: PlayerActor): boolean {
	if (!player.ridingBlock) return true;
	if (!dismountBlock(player)) {
		model.warningText = "CAN'T DISMOUNT HERE — WAIT FOR OPEN GROUND";
		showWarning();
		return false;
	}
	return true;
}

function isValidTileIndex(index: number): boolean {
	const totalTiles = GRID_COLS * GRID_ROWS;
	return index >= 0 && index < totalTiles;
}

// Process a click on a target tile index: run pathfinding and queue movement
export function handleTileClick(
	targetTileIndex: number,
	targetPlayer: PlayerActor,
) {
	model.targetTileIndex = targetTileIndex;

	if (!tryDismount(targetPlayer)) return;
	if (!isValidTileIndex(targetTileIndex)) return;

	const isMatchingDZ = isMatchingDropZoneForPlayer(
		targetTileIndex,
		targetPlayer,
	);

	const playerTileIndex = getPlayerTileIndex(targetPlayer);

	if (!isMatchingDZ && isTileBlocked(targetTileIndex)) {
		const resolved = resolveBlockedTarget(playerTileIndex, targetTileIndex);
		if (resolved === null) return;
		targetTileIndex = resolved;
	}

	if (tryDropCarriedItem(targetTileIndex, targetPlayer)) return;

	setArrivalPickup(targetTileIndex, targetPlayer);

	targetPlayer.playerActionBuffer = [];

	if (!isValidTileIndex(playerTileIndex)) return;
	if (!isValidTileIndex(targetTileIndex)) return;
	if (playerTileIndex === targetTileIndex) return;

	const runPathfinding = () => {
		const { path, startingIndex } = findPath(playerTileIndex, targetTileIndex);
		queuePath(targetPlayer, path, startingIndex);
	};

	if (isMatchingDZ) {
		withDropZoneWalkable(targetTileIndex, runPathfinding);
	} else {
		runPathfinding();
	}
}
