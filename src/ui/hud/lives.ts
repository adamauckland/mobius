import { game } from "@/game";
import { model } from "@/model";
import { Text, TextAlign, Color, ScreenElement, vec } from "excalibur";
import { Z_HUD } from "../zIndex";
import { createHUDFont } from "./fonts";

export function createLivesDisplay(): Text {
	// Black "♥♥♥" backdrop
	const livesBackdropText = new Text({
		text: "\u2665".repeat(3),
		font: createHUDFont(32, TextAlign.Left, Color.Black),
	});

	const livesBackdropLabel = new ScreenElement({
		pos: vec(-1010, 45),
		z: Z_HUD,
	});

	livesBackdropLabel.graphics.use(livesBackdropText);
	game.add(livesBackdropLabel);

	// Red overlay showing current lives
	const livesText = new Text({
		text: "\u2665".repeat(model.lives),
		font: createHUDFont(32, TextAlign.Left, Color.Red),
	});

	const livesLabel = new ScreenElement({
		pos: vec(-1010, 45),
		z: Z_HUD,
	});

	livesLabel.graphics.use(livesText);
	game.add(livesLabel);
	return livesText;
}
