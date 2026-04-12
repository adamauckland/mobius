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

export interface HUDRefs {
	timerText: Text;
	scoreText: Text;
	livesText: Text;
	gameOverLabel: ScreenElement;
	timesUpLabel: ScreenElement;
	levelCompleteLabel: ScreenElement;
	dimOverlay: ScreenElement;
	rewindButton: ScreenElement;
	setRewindUrgent: (urgent: boolean) => void;
	setTimerMeter: (fraction: number) => void;
	setTimerMeterVisible: (visible: boolean) => void;
	displayedScore: { value: number };
}

function createHUDFont(
	size: number,
	textAlign: TextAlign,
	color: Color = Color.White,
): Font {
	return new Font({
		size,
		unit: FontUnit.Px,
		family: '"Sixtyfour", monospace',
		color,
		textAlign,
		shadow: { blur: 2, offset: vec(1, 1), color: Color.Black },
	});
}

function createOverlayFont(
	size: number,
	color: Color,
	lineHeight?: number,
	shadowBlur = 4,
): Font {
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

function createScoreDisplay(): Text {
	const scoreText = new Text({
		text: "0",
		font: createHUDFont(48, TextAlign.Center),
	});
	const scoreLabel = new ScreenElement({
		pos: vec(0, 10),
		z: Z_HUD,
	});
	scoreLabel.graphics.use(scoreText);
	scoreLabel.on("preupdate", () => {
		scoreLabel.pos.x = game.screen.resolution.width / 2;
	});
	game.add(scoreLabel);
	return scoreText;
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

function createCenteredOverlay(
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

interface RewindButtonHandle {
	element: ScreenElement;
	setUrgent: (urgent: boolean) => void;
}

const REWIND_BLUE = Color.fromHex("#4488ff");
const REWIND_RED = Color.fromHex("#ff3344");
const REWIND_RADIUS = 36;
const REWIND_MARGIN = 20;

function createRewindButton(): RewindButtonHandle {
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
	return { element: rewindButton, setUrgent };
}

const TIMER_METER_WIDTH = 5;
const TIMER_METER_TOP_Y = 70;
const TIMER_METER_BOTTOM_GAP = 10;
const TIMER_INDICATOR_HEIGHT = 2;
const TIMER_INDICATOR_OVERHANG = 4;

interface TimerMeterHandle {
	setFraction: (fraction: number) => void;
	setVisible: (visible: boolean) => void;
}

function createTimerMeter(): TimerMeterHandle {
	const bgRect = new Rectangle({
		width: TIMER_METER_WIDTH,
		height: 1,
		color: Color.fromHex("#5e676b"),
	});
	const bgElement = new ScreenElement({
		pos: vec(0, 0),
		z: Z_HUD,
		anchor: vec(0.5, 0),
	});
	bgElement.graphics.use(bgRect);

	const indicatorRect = new Rectangle({
		width: TIMER_METER_WIDTH + TIMER_INDICATOR_OVERHANG * 2,
		height: TIMER_INDICATOR_HEIGHT,
		color: Color.White,
	});
	const indicatorElement = new ScreenElement({
		pos: vec(0, 0),
		z: Z_HUD + 1,
		anchor: vec(0.5, 0.5),
	});
	indicatorElement.graphics.use(indicatorRect);

	let fraction = 1;
	let visible = false;

	bgElement.on("preupdate", () => {
		const x = game.screen.resolution.width - REWIND_MARGIN - REWIND_RADIUS;
		const top = TIMER_METER_TOP_Y;
		const bottom =
			game.screen.resolution.height -
			REWIND_MARGIN -
			REWIND_RADIUS * 2 -
			TIMER_METER_BOTTOM_GAP;
		const height = Math.max(0, bottom - top);

		bgRect.height = height;
		bgElement.pos.x = x;
		bgElement.pos.y = top;
		bgElement.graphics.isVisible = visible;

		const clamped = Math.max(0, Math.min(1, fraction));
		indicatorElement.pos.x = x;
		indicatorElement.pos.y = top + (1 - clamped) * height;
		indicatorElement.graphics.isVisible = visible;
	});

	game.add(bgElement);
	game.add(indicatorElement);

	return {
		setFraction: (f) => {
			fraction = f;
			visible = true;
		},
		setVisible: (v) => {
			visible = v;
		},
	};
}

export function createHUD(): HUDRefs {
	const dimOverlay = createDimOverlay();
	const timerText = createTimerDisplay();
	const scoreText = createScoreDisplay();
	const livesText = createLivesDisplay();

	const gameOverLabel = createCenteredOverlay("TIME UP", Color.Red, 100);
	const timesUpLabel = createCenteredOverlay(
		"TIME'S UP",
		Color.fromHex("#ff6600"),
		200,
	);
	const levelCompleteLabel = createCenteredOverlay(
		"LEVEL\nCOMPLETE",
		Color.fromHex("#00e676"),
		100,
		120,
		16,
	);
	const rewind = createRewindButton();
	const timerMeter = createTimerMeter();

	return {
		timerText,
		scoreText,
		livesText,
		gameOverLabel,
		timesUpLabel,
		levelCompleteLabel,
		dimOverlay,
		rewindButton: rewind.element,
		setRewindUrgent: rewind.setUrgent,
		setTimerMeter: timerMeter.setFraction,
		setTimerMeterVisible: timerMeter.setVisible,
		displayedScore: { value: 0 },
	};
}
