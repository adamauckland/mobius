import {
	ScreenElement,
	Text,
	Font,
	FontUnit,
	Color,
	vec,
	TextAlign,
	BaseAlign,
	Circle,
	Rectangle,
	GraphicsGroup,
	BoundingBox,
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
	dimOverlay: ScreenElement;
	rewindButton: ScreenElement;
	displayedScore: { value: number };
}

export function createHUD(): HUDRefs {
	// Dim overlay — sits between the game world and the HUD layer so that
	// HUD, buttons, and the Level Complete / Game Over labels stay visible.
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

	// Game timer
	const timerText = new Text({
		text: "0:00.0",
		font: new Font({
			size: 48,
			unit: FontUnit.Px,
			family: '"Sixtyfour", monospace',
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
			family: '"Sixtyfour", monospace',
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
			family: '"Sixtyfour", monospace',
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
			family: '"Sixtyfour", monospace',
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
				family: '"Sixtyfour", monospace',
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
			family: '"Sixtyfour", monospace',
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
			family: '"Sixtyfour", monospace',
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
			size: 100,
			unit: FontUnit.Px,
			family: '"Sixtyfour", monospace',
			color: Color.fromHex("#00e676"),
			textAlign: TextAlign.Center,
			baseAlign: BaseAlign.Middle,
			shadow: { blur: 16, offset: vec(6, 6), color: Color.Black },
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

	// Rewind button (bottom-right, circular)
	const REWIND_RADIUS = 36;
	const REWIND_MARGIN = 20;
	const rewindBgNormal = new Circle({
		radius: REWIND_RADIUS,
		color: Color.fromHex("#4488ff"),
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
	const arrowOffset = vec(1, 4);
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
	rewindButton.on("preupdate", () => {
		rewindButton.pos.x =
			game.screen.resolution.width - REWIND_MARGIN - REWIND_RADIUS;
		rewindButton.pos.y =
			game.screen.resolution.height - REWIND_MARGIN - REWIND_RADIUS;
	});
	rewindButton.on("pointerdown", () => {
		rewindButton.graphics.use(rewindPressedGfx);
		rewindButton.scale.x = 0.9;
		rewindButton.scale.y = 0.9;
	});
	rewindButton.on("pointerup", () => {
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

	return {
		timerText,
		scoreText,
		livesText,
		gameOverLabel,
		timesUpLabel,
		levelCompleteLabel,
		rewindButton,
		displayedScore: { value: 0 },
	};
}
