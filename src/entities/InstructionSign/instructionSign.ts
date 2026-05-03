import {
	ScreenElement,
	CollisionType,
	Color,
	Font,
	FontUnit,
	GraphicsGroup,
	Rectangle,
	Text,
	TextAlign,
	BaseAlign,
	vec,
} from "excalibur";
import { game } from "@/game";
import { Z_HUD } from "@/ui/zIndex";

const PANEL_PADDING_X = 6;
const PANEL_PADDING_Y = 4;
const FONT_SIZE = 6;
const PANEL_COLOR = Color.fromRGB(0, 0, 0, 0.75);
const BORDER_COLOR = Color.fromHex("#ffee88");
const TEXT_COLOR = Color.White;
const PANEL_MARGIN = 8;

const signs: ScreenElement[] = [];

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

function measureLineWidth(line: string, font: Font): number {
	const probe = new Text({ text: line, font });
	return probe.width;
}

function wrapText(text: string, font: Font, maxWidth: number): string {
	const lines: string[] = [];
	for (const rawLine of text.split("\n")) {
		const words = rawLine.split(" ");
		let currentLine = "";
		for (const word of words) {
			const testLine = currentLine ? `${currentLine} ${word}` : word;
			if (measureLineWidth(testLine, font) > maxWidth && currentLine) {
				lines.push(currentLine);
				currentLine = word;
			} else {
				currentLine = testLine;
			}
		}
		if (currentLine) lines.push(currentLine);
	}
	return lines.join("\n");
}

function measureWidestLine(text: string, font: Font): number {
	let widest = 0;
	for (const line of text.split("\n")) {
		const w = measureLineWidth(line, font);
		if (w > widest) widest = w;
	}
	return widest;
}

function buildPanelGraphic(text: string, maxWidth: number): GraphicsGroup {
	const font = createSignFont();
	const wrapped = wrapText(text, font, maxWidth - PANEL_PADDING_X * 2);
	const label = new Text({ text: wrapped, font });
	const widestLine = measureWidestLine(wrapped, font);
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

const HOLD_MS = 4000;
const DRIFT_VELOCITY_Y = -12;
const FADE_MS = 3000;

export function spawnInstructionSign(text: string, _tileIndex: number) {
	const screenWidth = game.screen.resolution.width;
	const screenHeight = game.screen.resolution.height;
	const maxPanelWidth = screenWidth - PANEL_MARGIN * 2;

	const sign = new ScreenElement({
		pos: vec(screenWidth / 2, screenHeight / 2),
		z: Z_HUD - 2,
		collisionType: CollisionType.PreventCollision,
	});
	sign.graphics.use(buildPanelGraphic(text, maxPanelWidth));
	game.add(sign);
	signs.push(sign);

	sign.actions.delay(HOLD_MS).callMethod(() => {
		sign.vel = vec(0, DRIFT_VELOCITY_Y);
		sign.actions.fade(0, FADE_MS).callMethod(() => sign.kill());
	});
}

export function clearInstructionSigns() {
	for (const sign of signs) sign.kill();
	signs.length = 0;
}
