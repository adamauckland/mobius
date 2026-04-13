import { game } from "@/game";
import { ScreenElement, Rectangle, Color, vec } from "excalibur";
import { Z_HUD } from "../zIndex";

export function createDimOverlay(): ScreenElement {
	const dimRect = new Rectangle({
		width: game.screen.resolution.width,
		height: game.screen.resolution.height,
		color: Color.fromRGB(0, 0, 0, 0.6),
	});
	const dimOverlay = new ScreenElement({
		pos: vec(0, 0),
		z: Z_HUD - 1,
		anchor: vec(0, 0),
	});
	dimOverlay.graphics.use(dimRect);
	dimOverlay.graphics.visible = false;
	dimOverlay.on("preupdate", () => {
		dimRect.width = game.screen.resolution.width;
		dimRect.height = game.screen.resolution.height;
	});
	game.add(dimOverlay);
	return dimOverlay;
}
