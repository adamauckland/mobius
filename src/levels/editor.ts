import tilesImgUrl from "../assets/tiles.png";
import roguelikeImgUrl from "../assets/roguelike.png";
import {
	type MapData,
	type ProjectData,
	codeToTile,
	tileToCode,
	createEmptyMap,
	serializeProject,
	deserializeProject,
} from "./mapData";
import { GRID_COLS, GRID_ROWS, TILE_SIZE } from "../tiles/tiledata";
import { publishPack } from "./levelPacks";

// ---------------------------------------------------------------------------
// Sprite helpers – draw directly from loaded PNGs
// ---------------------------------------------------------------------------

const tilesImg = new Image();
tilesImg.src = tilesImgUrl;
const rlImg = new Image();
rlImg.src = roguelikeImgUrl;

function drawTileSprite(
	ctx: CanvasRenderingContext2D,
	col: number,
	row: number,
	dx: number,
	dy: number,
	size: number,
) {
	ctx.drawImage(tilesImg, col * 16, row * 16, 16, 16, dx, dy, size, size);
}

function drawRL(
	ctx: CanvasRenderingContext2D,
	col: number,
	row: number,
	dx: number,
	dy: number,
	size: number,
) {
	ctx.drawImage(rlImg, col * 17, row * 17, 16, 16, dx, dy, size, size);
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

type ToolId =
	| "grass"
	| "tree"
	| "portal"
	| "barrier"
	| "switch"
	| "fence"
	| "gate"
	| "dropZone"
	| "exitDoor"
	| "start"
	| "rock"
	| "collectable"
	| "parcel"
	| "monster"
	| "movingBlock"
	| "eraser";

interface ToolDef {
	id: ToolId;
	label: string;
	color: string;
	category: "tile" | "entity";
	key?: string;
}

const TOOLS: ToolDef[] = [
	{ id: "grass", label: "Grass", color: "#4a7c47", category: "tile", key: "1" },
	{ id: "tree", label: "Tree", color: "#2d5a1e", category: "tile", key: "2" },
	{
		id: "portal",
		label: "Portal",
		color: "#7b48a8",
		category: "tile",
		key: "3",
	},
	{
		id: "barrier",
		label: "Barrier",
		color: "#c0392b",
		category: "tile",
		key: "4",
	},
	{
		id: "switch",
		label: "Switch",
		color: "#f39c12",
		category: "tile",
		key: "5",
	},
	{ id: "fence", label: "Fence", color: "#8b6914", category: "tile", key: "6" },
	{ id: "gate", label: "Gate", color: "#3498db", category: "tile", key: "7" },
	{
		id: "dropZone",
		label: "DropZone",
		color: "#e91e63",
		category: "tile",
		key: "8",
	},
	{
		id: "exitDoor",
		label: "Exit Door",
		color: "#00e676",
		category: "tile",
		key: "9",
	},
	{
		id: "start",
		label: "Start",
		color: "#ffffff",
		category: "entity",
		key: "q",
	},
	{ id: "rock", label: "Rock", color: "#7f8c8d", category: "entity", key: "w" },
	{
		id: "collectable",
		label: "Gem",
		color: "#f1c40f",
		category: "entity",
		key: "e",
	},
	{
		id: "parcel",
		label: "Parcel",
		color: "#e67e22",
		category: "entity",
		key: "r",
	},
	{
		id: "monster",
		label: "Monster",
		color: "#e74c3c",
		category: "entity",
		key: "t",
	},
	{
		id: "movingBlock",
		label: "Platform",
		color: "#1abc9c",
		category: "entity",
		key: "y",
	},
	{
		id: "eraser",
		label: "Eraser",
		color: "#555",
		category: "entity",
		key: "x",
	},
];

// Parcel sprite coords [col, row] into the roguelike sheet
const PARCEL_SPRITES: [number, number][] = [
	[45, 10],
	[41, 9],
	[43, 8],
];

// Drop zone sprite coords – distinct from parcels so they read as destinations
const DROPZONE_SPRITES: [number, number][] = [
	[45, 7],
	[41, 11],
	[43, 13],
];

const DIRECTIONS = ["up", "down", "left", "right"] as const;

// ---------------------------------------------------------------------------
// Editor state
// ---------------------------------------------------------------------------

interface PatrolPlacement {
	tool: "monster" | "movingBlock";
	startTile: number;
}

let project: ProjectData = { levels: [createEmptyMap(GRID_COLS, GRID_ROWS)] };
let currentLevelIndex = 0;
let mapData: MapData = project.levels[0];
let levelIndicator: HTMLSpanElement;
let selectedTool: ToolId = "grass";
let groupId = 0;
let direction: (typeof DIRECTIONS)[number] = "right";
let entityId = 0;
let patrolPlacement: PatrolPlacement | null = null;

// Camera
let camX = 0;
let camY = 0;
let zoom = 1;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 4;

// Canvas & DOM
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let container: HTMLDivElement;
let toolbar: HTMLDivElement;
let statusBar: HTMLDivElement;
let nameInput: HTMLInputElement;
let timeLimitInput: HTMLInputElement;
let imagesReady = false;
let animFrame = 0;

// Mouse state
let mouseDown = false;
let middleDown = false;
let rightDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
let hoveredTile = -1;

// ---------------------------------------------------------------------------
// Coordinate helpers
// ---------------------------------------------------------------------------

function screenToWorld(sx: number, sy: number): [number, number] {
	const rect = canvas.getBoundingClientRect();
	const cx = sx - rect.left;
	const cy = sy - rect.top;
	const wx = (cx - canvas.width / 2) / zoom + camX;
	const wy = (cy - canvas.height / 2) / zoom + camY;
	return [wx, wy];
}

function worldToTile(wx: number, wy: number): number {
	const tx = Math.floor(wx / TILE_SIZE);
	const ty = Math.floor(wy / TILE_SIZE);
	if (tx < 0 || tx >= mapData.cols || ty < 0 || ty >= mapData.rows) return -1;
	return tx + ty * mapData.cols;
}

function tileX(idx: number) {
	return idx % mapData.cols;
}
function tileY(idx: number) {
	return Math.floor(idx / mapData.cols);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function render() {
	animFrame = requestAnimationFrame(render);
	if (!imagesReady) return;

	const w = canvas.width;
	const h = canvas.height;
	ctx.clearRect(0, 0, w, h);
	ctx.fillStyle = "#1a1a2e";
	ctx.fillRect(0, 0, w, h);

	ctx.save();
	ctx.translate(w / 2, h / 2);
	ctx.scale(zoom, zoom);
	ctx.translate(-camX, -camY);

	const ts = TILE_SIZE;

	// Draw tiles
	for (let i = 0; i < mapData.tiles.length; i++) {
		const tx = tileX(i);
		const ty = tileY(i);
		const dx = tx * ts;
		const dy = ty * ts;
		const info = codeToTile(mapData.tiles[i]);

		// Grass base
		drawTileSprite(ctx, 0, 0, dx, dy, ts);

		switch (info.type) {
			case "tree":
				drawTileSprite(ctx, 3, 0, dx, dy, ts);
				break;
			case "portal":
				drawRL(ctx, 31, 22, dx, dy, ts);
				break;
			case "barrier":
				drawRL(ctx, 33, 3, dx, dy, ts);
				// Group label
				ctx.fillStyle = "#fff";
				ctx.font = `${ts * 0.5}px monospace`;
				ctx.fillText(String(info.groupId), dx + 1, dy + ts - 1);
				break;
			case "switch":
				drawRL(ctx, 42, 16, dx, dy, ts);
				ctx.fillStyle = "#fff";
				ctx.font = `${ts * 0.5}px monospace`;
				ctx.fillText(String(info.groupId), dx + 1, dy + ts - 1);
				break;
			case "fence":
				drawFenceSprite(ctx, i, dx, dy, ts);
				break;
			case "oneWayGate":
				drawGateSprite(ctx, info.direction, dx, dy, ts);
				break;
			case "dropZone": {
				const [sc, sr] = DROPZONE_SPRITES[info.id % DROPZONE_SPRITES.length];
				drawRL(ctx, sc, sr, dx, dy, ts);
				ctx.strokeStyle = "#e91e63";
				ctx.lineWidth = 1;
				ctx.strokeRect(dx + 0.5, dy + 0.5, ts - 1, ts - 1);
				break;
			}
			case "exitDoor":
				drawRL(ctx, 35, 0, dx, dy, ts); // door sprite from roguelike sheet
				break;
		}
	}

	// Grid lines
	ctx.strokeStyle = "rgba(255,255,255,0.08)";
	ctx.lineWidth = 0.5;
	for (let x = 0; x <= mapData.cols; x++) {
		ctx.beginPath();
		ctx.moveTo(x * ts, 0);
		ctx.lineTo(x * ts, mapData.rows * ts);
		ctx.stroke();
	}
	for (let y = 0; y <= mapData.rows; y++) {
		ctx.beginPath();
		ctx.moveTo(0, y * ts);
		ctx.lineTo(mapData.cols * ts, y * ts);
		ctx.stroke();
	}

	// Start position marker
	{
		const sx = tileX(mapData.startTile) * ts;
		const sy = tileY(mapData.startTile) * ts;
		ctx.strokeStyle = "#00ff00";
		ctx.lineWidth = 1.5;
		ctx.strokeRect(sx + 1, sy + 1, ts - 2, ts - 2);
		ctx.fillStyle = "#00ff00";
		ctx.font = `${ts * 0.45}px monospace`;
		ctx.textAlign = "center";
		ctx.fillText("S", sx + ts / 2, sy + ts * 0.7);
		ctx.textAlign = "start";
	}

	// Draw entities
	for (const idx of mapData.rocks) {
		const dx = tileX(idx) * ts;
		const dy = tileY(idx) * ts;
		drawRL(ctx, 30, 11, dx, dy, ts);
	}
	for (const idx of mapData.collectables) {
		const dx = tileX(idx) * ts;
		const dy = tileY(idx) * ts;
		drawRL(ctx, 45, 10, dx, dy, ts);
	}
	for (const p of mapData.parcels) {
		const dx = tileX(p.tile) * ts;
		const dy = tileY(p.tile) * ts;
		const [sc, sr] = PARCEL_SPRITES[p.id % PARCEL_SPRITES.length];
		drawRL(ctx, sc, sr, dx, dy, ts);
		ctx.strokeStyle = "#e67e22";
		ctx.lineWidth = 1;
		ctx.strokeRect(dx + 0.5, dy + 0.5, ts - 1, ts - 1);
	}

	// Monsters - draw patrol path line + sprite at start
	for (const m of mapData.monsters) {
		const sx = tileX(m.start) * ts + ts / 2;
		const sy = tileY(m.start) * ts + ts / 2;
		const ex = tileX(m.end) * ts + ts / 2;
		const ey = tileY(m.end) * ts + ts / 2;
		ctx.strokeStyle = "rgba(231,76,60,0.6)";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(sx, sy);
		ctx.lineTo(ex, ey);
		ctx.stroke();
		// dots at endpoints
		ctx.fillStyle = "#e74c3c";
		ctx.beginPath();
		ctx.arc(ex, ey, 3, 0, Math.PI * 2);
		ctx.fill();
		drawRL(ctx, 26, 0, tileX(m.start) * ts, tileY(m.start) * ts, ts);
	}

	// Moving blocks - draw patrol path line + sprite at start
	for (const mb of mapData.movingBlocks) {
		const sx = tileX(mb.start) * ts + ts / 2;
		const sy = tileY(mb.start) * ts + ts / 2;
		const ex = tileX(mb.end) * ts + ts / 2;
		const ey = tileY(mb.end) * ts + ts / 2;
		ctx.strokeStyle = "rgba(26,188,156,0.6)";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(sx, sy);
		ctx.lineTo(ex, ey);
		ctx.stroke();
		ctx.fillStyle = "#1abc9c";
		ctx.beginPath();
		ctx.arc(ex, ey, 3, 0, Math.PI * 2);
		ctx.fill();
		drawRL(ctx, 4, 0, tileX(mb.start) * ts, tileY(mb.start) * ts, ts);
	}

	// Patrol placement preview
	if (patrolPlacement && hoveredTile >= 0) {
		const sx = tileX(patrolPlacement.startTile) * ts + ts / 2;
		const sy = tileY(patrolPlacement.startTile) * ts + ts / 2;
		const ex = tileX(hoveredTile) * ts + ts / 2;
		const ey = tileY(hoveredTile) * ts + ts / 2;
		const col =
			patrolPlacement.tool === "monster"
				? "rgba(231,76,60,0.4)"
				: "rgba(26,188,156,0.4)";
		ctx.strokeStyle = col;
		ctx.lineWidth = 2;
		ctx.setLineDash([4, 4]);
		ctx.beginPath();
		ctx.moveTo(sx, sy);
		ctx.lineTo(ex, ey);
		ctx.stroke();
		ctx.setLineDash([]);
	}

	// Hover highlight
	if (hoveredTile >= 0) {
		const hx = tileX(hoveredTile) * ts;
		const hy = tileY(hoveredTile) * ts;
		ctx.strokeStyle = "rgba(255,255,255,0.5)";
		ctx.lineWidth = 1;
		ctx.strokeRect(hx + 0.5, hy + 0.5, ts - 1, ts - 1);
	}

	ctx.restore();
}

// Fence auto-tiling (matches game logic)
function drawFenceSprite(
	ctx: CanvasRenderingContext2D,
	index: number,
	dx: number,
	dy: number,
	size: number,
) {
	const x = index % mapData.cols;
	const y = Math.floor(index / mapData.cols);
	const isFence = (ddx: number, ddy: number) => {
		const nx = x + ddx;
		const ny = y + ddy;
		if (nx < 0 || nx >= mapData.cols || ny < 0 || ny >= mapData.rows)
			return false;
		return codeToTile(mapData.tiles[nx + ny * mapData.cols]).type === "fence";
	};
	const up = isFence(0, -1);
	const down = isFence(0, 1);
	const left = isFence(-1, 0);
	const right = isFence(1, 0);

	let col = 46,
		row = 23; // default: isolated post
	if (up && down && left && right) {
		col = 46;
		row = 24;
	} else if (up && down && right) {
		col = 48;
		row = 23;
	} else if (up && down && left) {
		col = 49;
		row = 23;
	} else if (left && right && down) {
		col = 46;
		row = 24;
	} else if (left && right && up) {
		col = 50;
		row = 24;
	} else if (up && down) {
		col = 47;
		row = 23;
	} else if (left && right) {
		col = 47;
		row = 24;
	} else if (down && right) {
		col = 48;
		row = 24;
	} else if (down && left) {
		col = 49;
		row = 24;
	} else if (up && right) {
		col = 50;
		row = 23;
	} else if (up && left) {
		col = 51;
		row = 23;
	} else if (up || down) {
		col = 47;
		row = 23;
	} else if (left || right) {
		col = 47;
		row = 24;
	}

	drawRL(ctx, col, row, dx, dy, size);
}

function drawGateSprite(
	ctx: CanvasRenderingContext2D,
	dir: string,
	dx: number,
	dy: number,
	size: number,
) {
	ctx.save();
	ctx.translate(dx + size / 2, dy + size / 2);
	switch (dir) {
		case "right":
			break;
		case "down":
			ctx.rotate(Math.PI / 2);
			break;
		case "left":
			ctx.rotate(Math.PI);
			break;
		case "up":
			ctx.rotate(-Math.PI / 2);
			break;
	}
	drawRL(ctx, 29, 22, -size / 2, -size / 2, size);
	ctx.restore();
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

function applyTool(tileIdx: number) {
	if (tileIdx < 0) return;

	// Patrol tools use two-click placement
	if (selectedTool === "monster" || selectedTool === "movingBlock") {
		if (!patrolPlacement) {
			patrolPlacement = { tool: selectedTool, startTile: tileIdx };
			updateStatus(`Click end point for ${selectedTool} patrol`);
		} else {
			const list =
				patrolPlacement.tool === "monster"
					? mapData.monsters
					: mapData.movingBlocks;
			list.push({ start: patrolPlacement.startTile, end: tileIdx });
			patrolPlacement = null;
			updateStatus("");
		}
		return;
	}

	patrolPlacement = null;

	switch (selectedTool) {
		case "grass":
			mapData.tiles[tileIdx] = tileToCode({ type: "grass" });
			break;
		case "tree":
			mapData.tiles[tileIdx] = tileToCode({ type: "tree" });
			break;
		case "portal":
			mapData.tiles[tileIdx] = tileToCode({ type: "portal" });
			break;
		case "barrier":
			mapData.tiles[tileIdx] = tileToCode({ type: "barrier", groupId });
			break;
		case "switch":
			mapData.tiles[tileIdx] = tileToCode({ type: "switch", groupId });
			break;
		case "fence":
			mapData.tiles[tileIdx] = tileToCode({ type: "fence" });
			break;
		case "gate":
			mapData.tiles[tileIdx] = tileToCode({ type: "oneWayGate", direction });
			break;
		case "dropZone":
			mapData.tiles[tileIdx] = tileToCode({ type: "dropZone", id: entityId });
			break;
		case "exitDoor":
			mapData.tiles[tileIdx] = tileToCode({ type: "exitDoor" });
			break;
		case "start":
			mapData.startTile = tileIdx;
			break;
		case "rock":
			if (!mapData.rocks.includes(tileIdx)) mapData.rocks.push(tileIdx);
			break;
		case "collectable":
			if (!mapData.collectables.includes(tileIdx))
				mapData.collectables.push(tileIdx);
			break;
		case "parcel":
			if (!mapData.parcels.find((p: { tile: number }) => p.tile === tileIdx)) {
				mapData.parcels.push({ id: entityId, tile: tileIdx });
			}
			break;
		case "eraser":
			eraseAt(tileIdx);
			break;
	}
}

function eraseAt(tileIdx: number) {
	// Remove entities at this tile
	mapData.rocks = mapData.rocks.filter((r: number) => r !== tileIdx);
	mapData.collectables = mapData.collectables.filter(
		(c: number) => c !== tileIdx,
	);
	mapData.parcels = mapData.parcels.filter(
		(p: { tile: number }) => p.tile !== tileIdx,
	);
	mapData.monsters = mapData.monsters.filter(
		(m: { start: number; end: number }) =>
			m.start !== tileIdx && m.end !== tileIdx,
	);
	mapData.movingBlocks = mapData.movingBlocks.filter(
		(mb: { start: number; end: number }) =>
			mb.start !== tileIdx && mb.end !== tileIdx,
	);
	// Set tile to grass
	mapData.tiles[tileIdx] = "g";
}

function onMouseDown(e: MouseEvent) {
	if (e.button === 1) {
		// Middle click: pan
		middleDown = true;
		lastMouseX = e.clientX;
		lastMouseY = e.clientY;
		e.preventDefault();
		return;
	}
	if (e.button === 2) {
		// Right click: erase
		rightDown = true;
		const [wx, wy] = screenToWorld(e.clientX, e.clientY);
		const idx = worldToTile(wx, wy);
		if (idx >= 0) eraseAt(idx);
		e.preventDefault();
		return;
	}
	if (e.button === 0) {
		mouseDown = true;
		const [wx, wy] = screenToWorld(e.clientX, e.clientY);
		const idx = worldToTile(wx, wy);
		applyTool(idx);
	}
}

function onMouseMove(e: MouseEvent) {
	const [wx, wy] = screenToWorld(e.clientX, e.clientY);
	hoveredTile = worldToTile(wx, wy);

	if (middleDown) {
		camX -= (e.clientX - lastMouseX) / zoom;
		camY -= (e.clientY - lastMouseY) / zoom;
		lastMouseX = e.clientX;
		lastMouseY = e.clientY;
		return;
	}

	// Drag-paint for paintable tools
	const paintable = ["grass", "tree", "fence", "barrier", "eraser"];
	if (mouseDown && paintable.includes(selectedTool) && hoveredTile >= 0) {
		if (selectedTool === "eraser") {
			eraseAt(hoveredTile);
		} else {
			applyTool(hoveredTile);
		}
	}
	if (rightDown && hoveredTile >= 0) {
		eraseAt(hoveredTile);
	}

	// Update status with tile info
	if (hoveredTile >= 0) {
		const info = codeToTile(mapData.tiles[hoveredTile]);
		const tx = tileX(hoveredTile);
		const ty = tileY(hoveredTile);
		const entities: string[] = [];
		if (mapData.rocks.includes(hoveredTile)) entities.push("Rock");
		if (mapData.collectables.includes(hoveredTile)) entities.push("Gem");
		if (mapData.parcels.find((p: { tile: number }) => p.tile === hoveredTile))
			entities.push("Parcel");
		if (
			mapData.monsters.find((m: { start: number }) => m.start === hoveredTile)
		)
			entities.push("Monster");
		if (
			mapData.movingBlocks.find(
				(m: { start: number }) => m.start === hoveredTile,
			)
		)
			entities.push("Platform");
		if (hoveredTile === mapData.startTile) entities.push("Start");
		const entStr = entities.length ? ` | ${entities.join(", ")}` : "";
		updateStatus(`(${tx}, ${ty}) ${info.type}${entStr}`);
	}
}

function onMouseUp(e: MouseEvent) {
	if (e.button === 0) mouseDown = false;
	if (e.button === 1) middleDown = false;
	if (e.button === 2) rightDown = false;
}

function onWheel(e: WheelEvent) {
	e.preventDefault();
	const factor = e.deltaY > 0 ? 0.9 : 1.1;
	zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor));
}

function onKeyDown(e: KeyboardEvent) {
	// Don't capture when editor is hidden or typing in name input
	if (container && container.style.display === "none") return;
	if (document.activeElement === nameInput) return;

	// Tool hotkeys
	for (const tool of TOOLS) {
		if (tool.key && e.key === tool.key) {
			selectTool(tool.id);
			return;
		}
	}

	// Group ID
	if (e.key === "[") {
		groupId = Math.max(0, groupId - 1);
		updatePropertyUI();
	}
	if (e.key === "]") {
		groupId = Math.min(29, groupId + 1);
		updatePropertyUI();
	}
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

function selectTool(id: ToolId) {
	selectedTool = id;
	patrolPlacement = null;
	// Update button highlights
	const buttons = toolbar.querySelectorAll<HTMLButtonElement>(".tool-btn");
	buttons.forEach((btn) => {
		btn.classList.toggle("active", btn.dataset.tool === id);
	});
	updatePropertyUI();
}

function updatePropertyUI() {
	const propsDiv = document.getElementById("editor-props")!;
	let html = "";

	if (selectedTool === "barrier" || selectedTool === "switch") {
		html += `<div class="prop-row"><label>Group:</label>`;
		for (let i = 0; i < 30; i++) {
			html += `<button class="prop-btn ${groupId === i ? "active" : ""}" onclick="window._edSetGroup(${i})">${i}</button>`;
		}
		html += `</div>`;
	}

	if (selectedTool === "gate") {
		html += `<div class="prop-row"><label>Dir:</label>`;
		const arrows: Record<string, string> = {
			up: "\u2191",
			down: "\u2193",
			left: "\u2190",
			right: "\u2192",
		};
		for (const d of DIRECTIONS) {
			html += `<button class="prop-btn ${direction === d ? "active" : ""}" onclick="window._edSetDir('${d}')">${arrows[d]}</button>`;
		}
		html += `</div>`;
	}

	if (selectedTool === "dropZone" || selectedTool === "parcel") {
		html += `<div class="prop-row"><label>ID:</label>`;
		for (let i = 0; i < 3; i++) {
			html += `<button class="prop-btn ${entityId === i ? "active" : ""}" onclick="window._edSetId(${i})">${i}</button>`;
		}
		html += `</div>`;
	}

	if (selectedTool === "monster" || selectedTool === "movingBlock") {
		html += `<div class="prop-row"><span style="font-size:11px;color:#929fa4;">Click start, then click end</span></div>`;
	}

	propsDiv.innerHTML = html;
}

function updateStatus(msg: string) {
	if (statusBar) statusBar.textContent = msg;
}

// Global callbacks for inline onclick handlers
(window as any)._edSetGroup = (g: number) => {
	groupId = g;
	updatePropertyUI();
};
(window as any)._edSetDir = (d: string) => {
	direction = d as any;
	updatePropertyUI();
};
(window as any)._edSetId = (id: number) => {
	entityId = id;
	updatePropertyUI();
};

// ---------------------------------------------------------------------------
// Level navigation
// ---------------------------------------------------------------------------

function syncMapFromUI() {
	mapData.name = nameInput.value || "Untitled";
	mapData.timeLimit = (parseFloat(timeLimitInput.value) || 0) * 1000;
}

function syncUIFromMap() {
	nameInput.value = mapData.name;
	timeLimitInput.value = String(mapData.timeLimit / 1000);
	updateLevelIndicator();
	centerCamera();
}

function switchToLevel(index: number) {
	syncMapFromUI();
	project.levels[currentLevelIndex] = mapData;
	currentLevelIndex = index;
	mapData = project.levels[currentLevelIndex];
	syncUIFromMap();
}

function prevLevel() {
	if (currentLevelIndex > 0) switchToLevel(currentLevelIndex - 1);
}

function nextLevel() {
	syncMapFromUI();
	project.levels[currentLevelIndex] = mapData;
	if (currentLevelIndex >= project.levels.length - 1) {
		// Add a new level
		project.levels.push(createEmptyMap(GRID_COLS, GRID_ROWS));
	}
	switchToLevel(currentLevelIndex + 1);
}

function deleteLevel() {
	if (project.levels.length <= 1) return;
	if (!confirm(`Delete level ${currentLevelIndex + 1}?`)) return;
	project.levels.splice(currentLevelIndex, 1);
	if (currentLevelIndex >= project.levels.length) {
		currentLevelIndex = project.levels.length - 1;
	}
	mapData = project.levels[currentLevelIndex];
	syncUIFromMap();
}

function updateLevelIndicator() {
	if (levelIndicator != null) {
		levelIndicator.textContent = `Level ${currentLevelIndex + 1} / ${project.levels.length}`;
	}
}

// ---------------------------------------------------------------------------
// Save / Load
// ---------------------------------------------------------------------------

function saveProject() {
	syncMapFromUI();
	project.levels[currentLevelIndex] = mapData;
	const json = serializeProject(project);
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	const projectName = mapData.name.replace(/\s+/g, "_");
	a.download = `${projectName}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

function loadProject() {
	const input = document.createElement("input");
	input.type = "file";
	input.accept = ".json";
	input.onchange = () => {
		const file = input.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = () => {
			try {
				const loaded = deserializeProject(reader.result as string);
				if (loaded.levels.length === 0) {
					alert("Invalid project file");
					return;
				}
				// Validate/pad each level
				for (const level of loaded.levels) {
					const expected = level.cols * level.rows;
					while (level.tiles.length < expected) level.tiles.push("g");
					if (level.tiles.length > expected) level.tiles.length = expected;
				}
				project = loaded;
				currentLevelIndex = 0;
				mapData = project.levels[0];
				syncUIFromMap();
			} catch {
				alert("Failed to parse project file");
			}
		};
		reader.readAsText(file);
	};
	input.click();
}

function testMap() {
	syncMapFromUI();
	project.levels[currentLevelIndex] = mapData;
	// Store the full project and which level to test
	localStorage.setItem("customProject", serializeProject(project));
	localStorage.setItem("customProjectLevel", String(currentLevelIndex));
	localStorage.setItem("editorProject", serializeProject(project));
	localStorage.setItem("editorLevel", String(currentLevelIndex));
	location.reload();
}

function playFromStart() {
	syncMapFromUI();
	project.levels[currentLevelIndex] = mapData;
	// Start at level 0 with fresh lives
	localStorage.setItem("customProject", serializeProject(project));
	localStorage.setItem("customProjectLevel", "0");
	localStorage.setItem("editorProject", serializeProject(project));
	localStorage.setItem("editorLevel", String(currentLevelIndex));
	location.reload();
}

function backToMenu() {
	syncMapFromUI();
	project.levels[currentLevelIndex] = mapData;
	localStorage.setItem("editorProject", serializeProject(project));
	localStorage.setItem("editorLevel", String(currentLevelIndex));
	container.style.display = "none";
	cancelAnimationFrame(animFrame);
	document.getElementById("start-screen")!.style.display = "flex";
}

async function publishProject() {
	syncMapFromUI();
	project.levels[currentLevelIndex] = mapData;

	const name = mapData.name || "Untitled";
	const author = prompt("Your name (shown to other players):", "") ?? "";
	if (!author) return;
	const description = prompt("Short description of this level pack:", "") ?? "";

	const publishBtn = container.querySelector(
		"#ed-publish",
	) as HTMLButtonElement;
	publishBtn.textContent = "Sharing...";
	publishBtn.disabled = true;

	try {
		const packId = await publishPack(project, name, author, description);
		const shareUrl = `${location.origin}${location.pathname}?pack=${packId}`;

		// Copy to clipboard
		try {
			await navigator.clipboard.writeText(shareUrl);
			alert(
				`Published! Share this link (copied to clipboard):\n\n${shareUrl}\n\nPack ID: ${packId}`,
			);
		} catch {
			alert(`Published! Share this link:\n\n${shareUrl}\n\nPack ID: ${packId}`);
		}
	} catch (err) {
		alert("Failed to publish: " + (err as Error).message);
	} finally {
		publishBtn.textContent = "Share";
		publishBtn.disabled = false;
	}
}

function newMap() {
	if (!confirm("Create a new empty project? Unsaved changes will be lost."))
		return;
	project = { levels: [createEmptyMap(GRID_COLS, GRID_ROWS)] };
	currentLevelIndex = 0;
	mapData = project.levels[0];
	syncUIFromMap();
}

function centerCamera() {
	camX = (mapData.cols * TILE_SIZE) / 2;
	camY = (mapData.rows * TILE_SIZE) / 2;
	// Fit the grid in view
	const canvasW = canvas.width;
	const canvasH = canvas.height;
	const mapW = mapData.cols * TILE_SIZE;
	const mapH = mapData.rows * TILE_SIZE;
	zoom = Math.min(canvasW / mapW, canvasH / mapH) * 0.9;
	zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
}

// ---------------------------------------------------------------------------
// Build DOM
// ---------------------------------------------------------------------------

function buildEditorUI() {
	container = document.createElement("div");
	container.id = "editor-container";
	container.innerHTML = `
    <div id="editor-header">
      <input id="editor-name" type="text" value="Untitled" placeholder="Map name" />
      <label style="font-size:12px;color:#929fa4;display:flex;align-items:center;gap:4px;">
        Time limit (s)
        <input id="editor-timelimit" type="number" min="0" step="5" value="60"
          style="width:60px;font-family:monospace;font-size:14px;padding:4px 6px;background:#34393c;color:#d0e3e9;border:1px solid #5e676b;" />
      </label>
      <div style="display:flex;align-items:center;gap:4px;">
        <button id="ed-prev-level" class="ed-lvl-btn">&lt;</button>
        <span id="ed-level-indicator" style="font-size:12px;color:#929fa4;min-width:90px;text-align:center;">Level 1 / 1</span>
        <button id="ed-next-level" class="ed-lvl-btn">&gt;</button>
        <button id="ed-del-level" class="ed-lvl-btn" style="margin-left:2px;color:#e74c3c;">✕</button>
      </div>
      <div id="editor-buttons">
        <button id="ed-new">New</button>
        <button id="ed-save">Save</button>
        <button id="ed-load">Load</button>
        <button id="ed-test">Test</button>
        <button id="ed-play" style="background:#2e7d32;color:#fff;">Play</button>
        <button id="ed-publish" style="background:#1565c0;color:#fff;">Share</button>
        <button id="ed-back">Back</button>
      </div>
    </div>
    <div id="editor-body">
      <div id="editor-toolbar"></div>
      <canvas id="editor-canvas"></canvas>
    </div>
    <div id="editor-footer">
      <div id="editor-props"></div>
      <div id="editor-status"></div>
    </div>
  `;

	// Inject styles
	const style = document.createElement("style");
	style.textContent = `
    #editor-container {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      display: flex; flex-direction: column;
      background: #131617; color: #d0e3e9; font-family: monospace; z-index: 2000;
    }
    #editor-header {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 12px; background: #1e2225; border-bottom: 1px solid #34393c;
    }
    #editor-name {
      font-family: monospace; font-size: 16px; padding: 4px 8px;
      background: #34393c; color: #d0e3e9; border: 1px solid #5e676b;
      width: 200px;
    }
    #editor-buttons { display: flex; gap: 6px; margin-left: auto; }
    #editor-buttons button {
      font-family: monospace; font-size: 14px; padding: 6px 16px;
      background: #5e676b; color: #d0e3e9; border: none; cursor: pointer;
    }
    #editor-buttons button:hover { background: #929fa4; color: #131617; }
    #editor-body { display: flex; flex: 1; overflow: hidden; }
    #editor-toolbar {
      width: 110px; background: #1e2225; border-right: 1px solid #34393c;
      display: flex; flex-direction: column; gap: 2px;
    }
    .tool-section {
      font-size: 9px; color: #5e676b; text-transform: uppercase;
      padding: 4px 2px 2px; margin-top: 4px;
    }
    .tool-btn {
      display: flex; align-items: center; gap: 4px;
      padding: 4px 6px; border: none; cursor: pointer;
      font-family: monospace; font-size: 11px;
      background: transparent; color: #929fa4;
      border-left: 3px solid transparent;
      text-align: left; width: 100%;
    }
    .tool-btn:hover { background: #2a2f33; color: #d0e3e9; }
    .tool-btn.active { background: #2a2f33; color: #fff; }
    .tool-btn .swatch {
      width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0;
    }
    .tool-btn .hotkey {
      font-size: 9px; color: #5e676b; margin-left: auto;
    }
    #editor-canvas { flex: 1; display: block; }
    #editor-footer {
      display: flex; align-items: center; gap: 16px;
      padding: 6px 12px; background: #1e2225; border-top: 1px solid #34393c;
      min-height: 32px;
    }
    #editor-props { display: flex; gap: 8px; align-items: center; }
    .prop-row { display: flex; gap: 4px; align-items: center; }
    .prop-row label { font-size: 12px; color: #929fa4; }
    .prop-btn {
      font-family: monospace; font-size: 13px; padding: 2px 8px;
      background: #34393c; color: #d0e3e9; border: 1px solid #5e676b;
      cursor: pointer; min-width: 24px; text-align: center;
    }
    .prop-btn.active { background: #5e676b; color: #fff; border-color: #929fa4; }
    .prop-btn:hover { background: #5e676b; }
    #editor-status { font-size: 11px; color: #5e676b; margin-left: auto; }
    .ed-lvl-btn {
      font-family: monospace; font-size: 14px; padding: 4px 8px;
      background: #34393c; color: #d0e3e9; border: 1px solid #5e676b;
      cursor: pointer; min-width: 24px; text-align: center;
    }
    .ed-lvl-btn:hover { background: #5e676b; }
  `;
	document.head.appendChild(style);
	document.body.appendChild(container);

	// Build toolbar buttons
	toolbar = container.querySelector("#editor-toolbar")!;
	let lastCategory = "";
	for (const tool of TOOLS) {
		if (tool.category !== lastCategory) {
			const section = document.createElement("div");
			section.className = "tool-section";
			section.textContent = tool.category === "tile" ? "Tiles" : "Entities";
			toolbar.appendChild(section);
			lastCategory = tool.category;
		}
		const btn = document.createElement("button");
		btn.className = `tool-btn ${tool.id === selectedTool ? "active" : ""}`;
		btn.dataset.tool = tool.id;
		btn.innerHTML = `<span class="swatch" style="background:${tool.color}"></span>${tool.label}<span class="hotkey">${tool.key || ""}</span>`;
		btn.addEventListener("click", () => selectTool(tool.id));
		toolbar.appendChild(btn);
	}

	// Canvas
	canvas = container.querySelector("#editor-canvas")!;
	ctx = canvas.getContext("2d")!;
	ctx.imageSmoothingEnabled = false;

	// Other refs
	nameInput = container.querySelector("#editor-name")!;
	timeLimitInput = container.querySelector("#editor-timelimit")!;
	statusBar = container.querySelector("#editor-status")!;

	// Wire buttons
	container.querySelector("#ed-new")!.addEventListener("click", newMap);
	container.querySelector("#ed-save")!.addEventListener("click", saveProject);
	container.querySelector("#ed-load")!.addEventListener("click", loadProject);
	container.querySelector("#ed-test")!.addEventListener("click", testMap);
	container.querySelector("#ed-play")!.addEventListener("click", playFromStart);
	container
		.querySelector("#ed-publish")!
		.addEventListener("click", publishProject);
	container.querySelector("#ed-back")!.addEventListener("click", backToMenu);

	// Level navigation
	levelIndicator = container.querySelector("#ed-level-indicator")!;
	container
		.querySelector("#ed-prev-level")!
		.addEventListener("click", prevLevel);
	container
		.querySelector("#ed-next-level")!
		.addEventListener("click", nextLevel);
	container
		.querySelector("#ed-del-level")!
		.addEventListener("click", deleteLevel);

	// Canvas events
	canvas.addEventListener("mousedown", onMouseDown);
	canvas.addEventListener("mousemove", onMouseMove);
	document.addEventListener("mouseup", onMouseUp);
	canvas.addEventListener("wheel", onWheel, { passive: false });
	canvas.addEventListener("contextmenu", (e) => e.preventDefault());
	document.addEventListener("keydown", onKeyDown);

	// Resize
	function resizeCanvas() {
		const rect = canvas.parentElement!.getBoundingClientRect();
		const tbWidth = toolbar.getBoundingClientRect().width;
		canvas.width = rect.width - tbWidth;
		canvas.height = rect.height;
		ctx.imageSmoothingEnabled = false;
	}
	window.addEventListener("resize", resizeCanvas);
	resizeCanvas();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

let initialized = false;

export function showEditor() {
	if (!initialized) {
		initialized = true;
		buildEditorUI();

		// Wait for images
		let loaded = 0;
		const onLoad = () => {
			loaded++;
			if (loaded >= 2) imagesReady = true;
		};
		if (tilesImg.complete) loaded++;
		else tilesImg.addEventListener("load", onLoad);
		if (rlImg.complete) loaded++;
		else rlImg.addEventListener("load", onLoad);
		if (loaded >= 2) imagesReady = true;
	}

	// Load saved editor project if available
	const savedProject = localStorage.getItem("editorProject");
	if (savedProject) {
		try {
			project = deserializeProject(savedProject);
			currentLevelIndex = parseInt(
				localStorage.getItem("editorLevel") || "0",
				10,
			);
			if (currentLevelIndex >= project.levels.length) currentLevelIndex = 0;
		} catch {
			project = { levels: [createEmptyMap(GRID_COLS, GRID_ROWS)] };
			currentLevelIndex = 0;
		}
	} else {
		project = { levels: [createEmptyMap(GRID_COLS, GRID_ROWS)] };
		currentLevelIndex = 0;
	}
	mapData = project.levels[currentLevelIndex];
	syncUIFromMap();

	container.style.display = "flex";
	document.getElementById("start-screen")!.style.display = "none";

	// Resize canvas after display
	const rect = canvas.parentElement!.getBoundingClientRect();
	const tbWidth = toolbar.getBoundingClientRect().width;
	canvas.width = rect.width - tbWidth;
	canvas.height = rect.height;
	ctx.imageSmoothingEnabled = false;

	centerCamera();
	updatePropertyUI();
	cancelAnimationFrame(animFrame);
	render();
}
