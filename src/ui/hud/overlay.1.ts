import { game } from "@/game";
import { Color, ScreenElement, Text, vec } from "excalibur";
import { Z_COUNTDOWN } from "../zIndex";
import { createOverlayFont } from "./fonts";

const REFERENCE_WIDTH = 800;

function responsiveFontSize(fontSize: number): {
	size: number;
	lineHeightScale: number;
} {
	const screenW = game.screen.resolution.width || window.innerWidth;
	const scale = Math.min(1, screenW / REFERENCE_WIDTH);
	return { size: fontSize * scale, lineHeightScale: scale };
}

export function overlay(
	text: string,
	color: Color,
	fontSize: number,
	lineHeight?: number,
	shadowBlur = 4,
): ScreenElement {
	const { size, lineHeightScale } = responsiveFontSize(fontSize);
	const scaledLineHeight =
		lineHeight !== undefined ? lineHeight * lineHeightScale : undefined;
	const textGfx = new Text({
		text,
		font: createOverlayFont(size, color, scaledLineHeight, shadowBlur),
	});
	const label = new ScreenElement({
		pos: vec(0, 0),
		z: Z_COUNTDOWN,
	});
	label.graphics.use(textGfx);
	label.graphics.visible = false;
	label.on("preupdate", () => {
		label.pos.x = game.screen.resolution.width / 2;
		label.pos.y = game.screen.resolution.height / 2;
	});
	game.add(label);
	return label;
}
