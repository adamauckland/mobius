import { game } from "@/game";
import {
	Color,
	Circle,
	Text,
	Font,
	FontUnit,
	TextAlign,
	BaseAlign,
	vec,
	GraphicsGroup,
	ScreenElement,
	BoundingBox,
} from "excalibur";
import { Z_HUD } from "../zIndex";
import { IRewindButtonHandle } from "./IRewindButtonHandle";

const REWIND_BLUE = Color.fromHex("#4488ff");
const REWIND_RED = Color.fromHex("#ff3344");
export const REWIND_RADIUS = 36;
export const REWIND_MARGIN = 20;

export function createRewindButton(): IRewindButtonHandle {
	const rewindBgNormal = new Circle({
		radius: REWIND_RADIUS,
		color: REWIND_BLUE,
	});
	const rewindBgPressed = new Circle({
		radius: REWIND_RADIUS,
		color: Color.fromHex("#2255bb"),
	});
	const rewindArrow = new Text({
		text: "\u21BA",
		font: new Font({
			size: 44,
			unit: FontUnit.Px,
			family: '"Sixtyfour", monospace',
			color: Color.White,
			textAlign: TextAlign.Center,
			baseAlign: BaseAlign.Middle,
			shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
		}),
	});
	const bgOffset = vec(-REWIND_RADIUS, -REWIND_RADIUS);
	const arrowOffset = vec(0, 0);
	const rewindNormalGfx = new GraphicsGroup({
		members: [
			{ graphic: rewindBgNormal, offset: bgOffset },
			{ graphic: rewindArrow, offset: arrowOffset },
		],
	});
	const rewindPressedGfx = new GraphicsGroup({
		members: [
			{ graphic: rewindBgPressed, offset: bgOffset },
			{ graphic: rewindArrow, offset: arrowOffset },
		],
	});
	const rewindButton = new ScreenElement({
		pos: vec(0, 0),
		z: Z_HUD,
	});
	rewindButton.graphics.use(rewindNormalGfx);
	rewindButton.pointer.useGraphicsBounds = false;
	rewindButton.pointer.localBounds = new BoundingBox(
		-REWIND_RADIUS,
		-REWIND_RADIUS,
		REWIND_RADIUS,
		REWIND_RADIUS,
	);
	let urgent = false;
	rewindButton.on("preupdate", () => {
		rewindButton.pos.x =
			game.screen.resolution.width - REWIND_MARGIN - REWIND_RADIUS;
		rewindButton.pos.y =
			game.screen.resolution.height - REWIND_MARGIN - REWIND_RADIUS;
		if (urgent) {
			const onRed = Math.sin(game.clock.now() * 0.02) > 0;
			rewindBgNormal.color = onRed ? REWIND_RED : REWIND_BLUE;
		} else if (rewindBgNormal.color !== REWIND_BLUE) {
			rewindBgNormal.color = REWIND_BLUE;
		}
	});
	const setUrgent = (next: boolean) => {
		urgent = next;
	};
	rewindButton.on("pointerdown", (evt) => {
		evt.cancel();
		rewindButton.graphics.use(rewindPressedGfx);
		rewindButton.scale.x = 0.9;
		rewindButton.scale.y = 0.9;
	});
	rewindButton.on("pointerup", (evt) => {
		evt.cancel();
		rewindButton.graphics.use(rewindNormalGfx);
		rewindButton.scale.x = 1;
		rewindButton.scale.y = 1;
	});
	rewindButton.on("pointerleave", () => {
		rewindButton.graphics.use(rewindNormalGfx);
		rewindButton.scale.x = 1;
		rewindButton.scale.y = 1;
	});
	game.add(rewindButton);
	return { element: rewindButton, setUrgent };
}
