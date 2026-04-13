import { game } from "@/game";
import { Text, TextAlign, ScreenElement, vec } from "excalibur";
import { Z_HUD } from "../zIndex";
import { createHUDFont } from "./fonts";

export function createScoreDisplay(): Text {
	const scoreText = new Text({
		text: "0",
		font: createHUDFont(48, TextAlign.Center),
	});
	const scoreLabel = new ScreenElement({
		pos: vec(-1000, 10),
		z: Z_HUD,
	});
	scoreLabel.graphics.use(scoreText);
	scoreLabel.on("preupdate", () => {
		//	scoreLabel.pos.x = game.screen.resolution.width / 2;
	});

	game.add(scoreLabel);
	return scoreText;
}
