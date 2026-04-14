import {
	Actor,
	CollisionType,
	Color,
	Font,
	FontUnit,
	GraphicsGroup,
	Rectangle,
	Text,
	TextAlign,
	BaseAlign,
	Vector,
	vec,
} from "excalibur";
import { game } from "@/game";
import { GRID_COLS, TILE_SIZE } from "@/tiles/tiledata";
import { Z_RIPPLE } from "@/ui/zIndex";

const PANEL_PADDING_X = 6;
const PANEL_PADDING_Y = 4;
const FONT_SIZE = 6;
const PANEL_COLOR = Color.fromRGB(0, 0, 0, 0.75);
const BORDER_COLOR = Color.fromHex("#ffee88");
const TEXT_COLOR = Color.White;

const signs: Actor[] = [];

function createSignFont(): Font {
	return new Font({
		size: FONT_SIZE,
		unit: FontUnit.Px,
		family: '"Sixtyfour", monospace',
		color: TEXT_COLOR,
		textAlign: TextAlign.Center,
		baseAlign: BaseAlign.Middle,
		shadow: { blur: 1, offset: vec(1, 1), color: Color.Black },
	});
}

function measureWidestLine(text: string, font: Font): number {
	let widest = 0;
	for (const line of text.split("\n")) {
		const probe = new Text({ text: line, font });
		if (probe.width > widest) widest = probe.width;
	}
	return widest;
}

function tileCenter(tileIndex: number): Vector {
	const tx = tileIndex % GRID_COLS;
	const ty = Math.floor(tileIndex / GRID_COLS);
	return new Vector(
		tx * TILE_SIZE + TILE_SIZE / 2,
		ty * TILE_SIZE + TILE_SIZE / 2,
	);
}

function buildPanelGraphic(text: string): GraphicsGroup {
	const font = createSignFont();
	const label = new Text({ text, font });
	const widestLine = measureWidestLine(text, font);
	const width = Math.max(label.width, widestLine) + PANEL_PADDING_X * 2;
	const height = label.height + PANEL_PADDING_Y * 2;
	const background = new Rectangle({
		width,
		height,
		color: PANEL_COLOR,
		strokeColor: BORDER_COLOR,
		lineWidth: 1,
	});

	return new GraphicsGroup({
		members: [
			{ graphic: background, offset: vec(-width / 2, -height / 2) },
			{ graphic: label, offset: vec(0, 0) },
		],
	});
}

export function spawnInstructionSign(text: string, tileIndex: number) {
	const center = tileCenter(tileIndex);
	const sign = new Actor({
		pos: center,
		z: Z_RIPPLE,
		collisionType: CollisionType.PreventCollision,
	});
	sign.graphics.use(buildPanelGraphic(text));
	game.add(sign);
	signs.push(sign);
}

export function clearInstructionSigns() {
	for (const sign of signs) sign.kill();
	signs.length = 0;
}
