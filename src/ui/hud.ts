import {
	ScreenElement,
	Text,
	Font,
	FontUnit,
	Color,
	vec,
	TextAlign,
	BaseAlign,
} from "excalibur";
import { game } from "../game";
import { model } from "../model";
import { Z_HUD, Z_COUNTDOWN } from "../zIndex";
import { togglePause, onPauseChange } from "../main";

export interface HUDRefs {
	timerText: Text;
	scoreText: Text;
	livesText: Text;
	gameOverLabel: ScreenElement;
	timesUpLabel: ScreenElement;
	levelCompleteLabel: ScreenElement;
	displayedScore: { value: number };
}

export function createHUD(): HUDRefs {
	// Game timer
	const timerText = new Text({
		text: "0:00.0",
		font: new Font({
			size: 48,
			unit: FontUnit.Px,
			family: "monospace",
			color: Color.White,
			textAlign: TextAlign.Center,
			shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
		}),
	});
	const timerLabel = new ScreenElement({
		pos: vec(0, 10),
		z: Z_HUD,
	});
	timerLabel.graphics.use(timerText);
	timerLabel.on("preupdate", () => {
		timerLabel.pos.x = game.screen.resolution.width / 2;
	});
	game.add(timerLabel);

	// Score display
	const scoreText = new Text({
		text: "0",
		font: new Font({
			size: 32,
			unit: FontUnit.Px,
			family: "monospace",
			color: Color.White,
			textAlign: TextAlign.Right,
			shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
		}),
	});
	const scoreLabel = new ScreenElement({
		pos: vec(0, 10),
		z: Z_HUD,
	});
	scoreLabel.graphics.use(scoreText);
	scoreLabel.on("preupdate", () => {
		scoreLabel.pos.x = game.screen.resolution.width - 10;
	});
	game.add(scoreLabel);

	// Pause button (top-left)
	const pauseText = new Text({
		text: "II",
		font: new Font({
			size: 32,
			unit: FontUnit.Px,
			family: "monospace",
			color: Color.White,
			textAlign: TextAlign.Left,
			shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
		}),
	});
	const pauseButton = new ScreenElement({
		pos: vec(10, 10),
		z: Z_HUD,
		width: 40,
		height: 40,
	});
	pauseButton.graphics.use(pauseText);
	pauseButton.on("pointerup", () => togglePause());
	onPauseChange((isPaused) => {
		pauseText.text = isPaused ? ">" : "II";
	});
	game.add(pauseButton);

	// Lives display (top-left, below pause)
	const livesText = new Text({
		text:
			"\u2665".repeat(model.lives) +
			"\u2661".repeat(Math.max(0, 3 - model.lives)),
		font: new Font({
			size: 32,
			unit: FontUnit.Px,
			family: "monospace",
			color: Color.Red,
			textAlign: TextAlign.Left,
			shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
		}),
	});
	const livesLabel = new ScreenElement({
		pos: vec(10, 45),
		z: Z_HUD,
	});
	livesLabel.graphics.use(livesText);
	game.add(livesLabel);

	// Level indicator (top-left, below lives) — only shown for multi-level projects
	if (model.totalLevels > 1) {
		const levelText = new Text({
			text: `Level ${model.currentLevel + 1}/${model.totalLevels}`,
			font: new Font({
				size: 24,
				unit: FontUnit.Px,
				family: "monospace",
				color: Color.White,
				textAlign: TextAlign.Left,
				shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
			}),
		});
		const levelLabel = new ScreenElement({
			pos: vec(10, 78),
			z: Z_HUD,
		});
		levelLabel.graphics.use(levelText);
		game.add(levelLabel);
	}

	// Game over overlay
	const gameOverText = new Text({
		text: "GAME OVER",
		font: new Font({
			size: 200,
			unit: FontUnit.Px,
			family: "monospace",
			color: Color.Red,
			textAlign: TextAlign.Center,
			baseAlign: BaseAlign.Middle,
			shadow: { blur: 4, offset: vec(2, 2), color: Color.Black },
		}),
	});
	const gameOverLabel = new ScreenElement({
		pos: vec(0, 0),
		z: Z_COUNTDOWN,
	});
	gameOverLabel.graphics.use(gameOverText);
	gameOverLabel.graphics.visible = false;
	gameOverLabel.on("preupdate", () => {
		gameOverLabel.pos.x = game.screen.resolution.width / 2;
		gameOverLabel.pos.y = game.screen.resolution.height / 2;
	});
	game.add(gameOverLabel);

	// Time's up penalty overlay
	const timesUpText = new Text({
		text: "TIME'S UP",
		font: new Font({
			size: 200,
			unit: FontUnit.Px,
			family: "monospace",
			color: Color.fromHex("#ff6600"),
			textAlign: TextAlign.Center,
			baseAlign: BaseAlign.Middle,
			shadow: { blur: 4, offset: vec(2, 2), color: Color.Black },
		}),
	});
	const timesUpLabel = new ScreenElement({
		pos: vec(0, 0),
		z: Z_COUNTDOWN,
	});
	timesUpLabel.graphics.use(timesUpText);
	timesUpLabel.graphics.visible = false;
	timesUpLabel.on("preupdate", () => {
		timesUpLabel.pos.x = game.screen.resolution.width / 2;
		timesUpLabel.pos.y = game.screen.resolution.height / 2;
	});
	game.add(timesUpLabel);

	// Level complete overlay
	const levelCompleteText = new Text({
		text: "LEVEL COMPLETE",
		font: new Font({
			size: 200,
			unit: FontUnit.Px,
			family: "monospace",
			color: Color.fromHex("#00e676"),
			textAlign: TextAlign.Center,
			baseAlign: BaseAlign.Middle,
			shadow: { blur: 4, offset: vec(2, 2), color: Color.Black },
		}),
	});
	const levelCompleteLabel = new ScreenElement({
		pos: vec(0, 0),
		z: Z_COUNTDOWN,
	});
	levelCompleteLabel.graphics.use(levelCompleteText);
	levelCompleteLabel.graphics.visible = false;
	levelCompleteLabel.on("preupdate", () => {
		levelCompleteLabel.pos.x = game.screen.resolution.width / 2;
		levelCompleteLabel.pos.y = game.screen.resolution.height / 2;
	});
	game.add(levelCompleteLabel);

	return {
		timerText,
		scoreText,
		livesText,
		gameOverLabel,
		timesUpLabel,
		levelCompleteLabel,
		displayedScore: { value: 0 },
	};
}
