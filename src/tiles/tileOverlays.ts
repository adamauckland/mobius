import { Actor, vec, BoundingBox } from "excalibur";
import { TileSheet, rlSS } from "../resources";
import {
	tiles,
	Tree,
	OneWayGate,
	DropZone,
	ExitDoor,
	GRID_COLS,
	TILE_SIZE,
} from "./tiledata";
import { game } from "../game";
import { zFromY, Z_LAYER_TREE, Z_LAYER_PICKUP } from "../zIndex";
import { PARCEL_SPRITES } from "../entities/worldObjects";

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
				z: zFromY(ty * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_PICKUP),
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
				z: zFromY(ty * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_PICKUP),
			});
			const dz = tiles[i] as DropZone;
			const [sc, sr] = PARCEL_SPRITES[dz.id % PARCEL_SPRITES.length];
			dzActor.graphics.use(rlSS.getSprite(sc, sr));
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

export function spawnExitDoorOverlays() {
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
				z: zFromY(ty * TILE_SIZE + TILE_SIZE / 2, Z_LAYER_PICKUP),
			});
			doorActor.graphics.use(rlSS.getSprite(35, 0));
			game.add(doorActor);
		}
	}
}
