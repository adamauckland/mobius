import { game } from "@/game";
import { Rectangle, Color, ScreenElement, vec } from "excalibur";
import { Z_HUD } from "../zIndex";
import { ITimerMeterHandle } from "./ITimerMeterHandle";
import { REWIND_MARGIN, REWIND_RADIUS } from "./rewind";

const TIMER_METER_WIDTH = 5;
const TIMER_METER_TOP_Y = 70;
const TIMER_METER_BOTTOM_GAP = 10;
const TIMER_INDICATOR_HEIGHT = 2;
const TIMER_INDICATOR_OVERHANG = 4;

export function createTimerMeter(): ITimerMeterHandle {
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
