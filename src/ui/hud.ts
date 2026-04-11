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
import { game } from "@/game";
import { model } from "@/model";
import { Z_HUD, Z_COUNTDOWN } from "@/ui/zIndex";
import { togglePause, onPauseChange } from "@/main";

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

function createHUDFont(size: number, textAlign: TextAlign, color: Color = Color.White): Font {
	return new Font({
		size,
		unit: FontUnit.Px,
		family: '"Sixtyfour", monospace',
		color,
		textAlign,
		shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
	});
}

function createOverlayFont(size: number, color: Color, lineHeight?: number, shadowBlur = 4): Font {
	return new Font({
		size,
		unit: FontUnit.Px,
		lineHeight: lineHeight,
		family: '"Sixtyfour", monospace',
		color,
		textAlign: TextAlign.Center,
		baseAlign: BaseAlign.Middle,
		shadow: { blur: shadowBlur, offset: vec(2, 2), color: Color.Black },
	});
}

function createDimOverlay(): ScreenElement {
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

function createTimerDisplay(): Text {
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
	return timerText;
}

function createScoreDisplay(): Text {
	const scoreText = new Text({
		text: "0",
		font: createHUDFont(32, TextAlign.Right),
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
	return scoreText;
}

function createPauseButton() {
	const pauseText = new Text({
		text: "II",
		font: createHUDFont(32, TextAlign.Left),
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
}

function createLivesDisplay(): Text {
	// Black "♥♥♥" backdrop
	const livesBackdropText = new Text({
		text: "\u2665".repeat(3),
		font: createHUDFont(32, TextAlign.Left, Color.Black),
	});
	const livesBackdropLabel = new ScreenElement({
		pos: vec(10, 45),
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
		pos: vec(10, 45),
		z: Z_HUD,
	});
	livesLabel.graphics.use(livesText);
	game.add(livesLabel);
	return livesText;
}

function createLevelIndicator() {
	if (model.totalLevels <= 1) return;
	const levelText = new Text({
		text: `Level ${model.currentLevel + 1}/${model.totalLevels}`,
		font: createHUDFont(24, TextAlign.Left),
	});
	const levelLabel = new ScreenElement({
		pos: vec(10, 78),
		z: Z_HUD,
	});
	levelLabel.graphics.use(levelText);
	game.add(levelLabel);
}

function createCenteredOverlay(text: string, color: Color, fontSize: number, lineHeight?: number, shadowBlur = 4): ScreenElement {
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

function createRewindButton(): ScreenElement {
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
	return rewindButton;
}

export function createHUD(): HUDRefs {
	const dimOverlay = createDimOverlay();
	const timerText = createTimerDisplay();
	const scoreText = createScoreDisplay();
	createPauseButton();
	const livesText = createLivesDisplay();
	createLevelIndicator();
	const gameOverLabel = createCenteredOverlay("GAME OVER", Color.Red, 100);
	const timesUpLabel = createCenteredOverlay("TIME'S UP", Color.fromHex("#ff6600"), 200);
	const levelCompleteLabel = createCenteredOverlay("LEVEL\nCOMPLETE", Color.fromHex("#00e676"), 100, 120, 16);
	const rewindButton = createRewindButton();

	return {
		timerText,
		scoreText,
		livesText,
		gameOverLabel,
		timesUpLabel,
		levelCompleteLabel,
		dimOverlay,
		rewindButton,
		displayedScore: { value: 0 },
	};
}
