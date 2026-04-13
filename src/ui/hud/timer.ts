import { game } from "@/game";
import {
	Text,
	Font,
	FontUnit,
	Color,
	TextAlign,
	vec,
	ScreenElement,
} from "excalibur";
import { Z_HUD } from "../zIndex";

export function createTimerDisplay(): Text {
	const timerText = new Text({
		text: "0:00.0",
		font: new Font({
			size: 32,
			unit: FontUnit.Px,
			family: '"Sixtyfour", monospace',
			color: Color.White,
			textAlign: TextAlign.Right,
			shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
		}),
	});
	const timerLabel = new ScreenElement({
		pos: vec(0, 10),
		z: Z_HUD,
	});
	timerLabel.graphics.use(timerText);
	timerLabel.on("preupdate", () => {
		timerLabel.pos.x = game.screen.resolution.width - 10;
	});
	game.add(timerLabel);
	return timerText;
}
