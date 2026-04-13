import { game } from "@/game";
import { Color, ScreenElement, Text, vec } from "excalibur";
import { Z_COUNTDOWN } from "../zIndex";
import { createOverlayFont } from "./fonts";

export function overlay(
	text: string,
	color: Color,
	fontSize: number,
	lineHeight?: number,
	shadowBlur = 4,
): ScreenElement {
	const textGfx = new Text({
		text,
		font: createOverlayFont(fontSize, color, lineHeight, shadowBlur),
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
