import { Actor, vec, BoundingBox } from "excalibur";
import { TileSheet, rlSS } from "@/resources/resources";
import {
	tiles,
	Tree,
	OneWayGate,
	DropZone,
	ExitDoor,
	GRID_COLS,
	TILE_SIZE,
} from "@/tiles/tiledata";
import { game } from "@/game";
import { zFromY, Z_LAYER_TREE, Z_PLAYER_BACKGROUND_MOVER } from "@/ui/zIndex";
import { DROPZONE_SPRITES } from "@/entities/Parcel/Parcel";

export function spawnTreeOverlays() {
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
}

export function spawnGateOverlays() {
	for (let i = 0; i < tiles.length; i++) {
		if (tiles[i] instanceof OneWayGate) {
			const gate = tiles[i] as OneWayGate;
			const tx = i % GRID_COLS;
			const ty = Math.floor(i / GRID_COLS);
			const gateActor = new Actor({
				pos: vec(
					tx * TILE_SIZE + TILE_SIZE / 2,
					ty * TILE_SIZE + TILE_SIZE / 2,
				),
				width: TILE_SIZE,
				height: TILE_SIZE,
				z: zFromY(ty * TILE_SIZE + TILE_SIZE / 2, Z_PLAYER_BACKGROUND_MOVER),
			});
			gateActor.graphics.use(rlSS.getSprite(29, 22));
			switch (gate.direction) {
				case "right":
					gateActor.rotation = 0;
					break;
				case "down":
					gateActor.rotation = Math.PI / 2;
					break;
				case "left":
					gateActor.rotation = Math.PI;
					break;
				case "up":
					gateActor.rotation = -Math.PI / 2;
					break;
			}
			game.add(gateActor);
		}
	}
}

export function spawnDropZoneOverlays() {
	for (let i = 0; i < tiles.length; i++) {
		if (tiles[i] instanceof DropZone) {
			const tx = i % GRID_COLS;
			const ty = Math.floor(i / GRID_COLS);
			const dzActor = new Actor({
				pos: vec(
					tx * TILE_SIZE + TILE_SIZE / 2,
					ty * TILE_SIZE + TILE_SIZE / 2,
				),
				width: TILE_SIZE,
				height: TILE_SIZE,
				z: zFromY(ty * TILE_SIZE + TILE_SIZE / 2, Z_PLAYER_BACKGROUND_MOVER),
			});
			const dz = tiles[i] as DropZone;
			const [sc, sr] = DROPZONE_SPRITES[dz.id % DROPZONE_SPRITES.length];
			dzActor.graphics.use(rlSS.getSprite(sc, sr));
			dzActor.graphics.opacity = 0.7;
			const phase = i * 0.5;
			dzActor.graphics.onPreDraw = () => {
				const pulse = 0.8 + Math.sin(game.clock.now() * 0.003 + phase) * 0.2;
				dzActor.scale.x = pulse;
				dzActor.scale.y = pulse;
			};
			game.add(dzActor);
		}
	}
}

export function spawnExitDoorOverlays(): Actor[] {
	const actors: Actor[] = [];
	for (let i = 0; i < tiles.length; i++) {
		if (tiles[i] instanceof ExitDoor) {
			const tx = i % GRID_COLS;
			const ty = Math.floor(i / GRID_COLS);
			const doorActor = new Actor({
				pos: vec(
					tx * TILE_SIZE + TILE_SIZE / 2,
					ty * TILE_SIZE + TILE_SIZE / 2,
				),
				width: TILE_SIZE,
				height: TILE_SIZE,
				z: zFromY(ty * TILE_SIZE + TILE_SIZE / 2, Z_PLAYER_BACKGROUND_MOVER),
			});
			doorActor.graphics.use(rlSS.getSprite(35, 0));
			game.add(doorActor);
			actors.push(doorActor);
		}
	}
	return actors;
}
