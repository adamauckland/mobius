import { Circle, Color, vec, GraphicsGroup } from "excalibur";
import {
	EYE_BASE_LEFT_X,
	EYE_BASE_Y,
	EYE_BASE_RIGHT_X,
} from "./CRITTER_LOOK_SETTINGS";
import { CRITTER_SIZE, CRITTER_COLOR } from "./CRITTER_SETTINGS";
import { ICritterGraphics } from "./ICritterGraphics";

/** Build eyes-open, half-open, and closed graphics for a critter. */
export function createCritterGraphics(): ICritterGraphics {
	const body = new Circle({ radius: CRITTER_SIZE / 2, color: CRITTER_COLOR });
	const eye = new Circle({ radius: 1, color: Color.Black });
	const halfEye = new Circle({ radius: 0.5, color: Color.Black });
	const leftEyeOffset = vec(EYE_BASE_LEFT_X, EYE_BASE_Y);
	const rightEyeOffset = vec(EYE_BASE_RIGHT_X, EYE_BASE_Y);
	const leftEyeHalfOffset = vec(EYE_BASE_LEFT_X, EYE_BASE_Y + 1);
	const rightEyeHalfOffset = vec(EYE_BASE_RIGHT_X, EYE_BASE_Y + 1);
	const bodyOffset = vec(-CRITTER_SIZE / 2, -CRITTER_SIZE / 2);
	const open = new GraphicsGroup({
		members: [
			{ graphic: body, offset: bodyOffset },
			{ graphic: eye, offset: leftEyeOffset },
			{ graphic: eye, offset: rightEyeOffset },
		],
	});
	const halfOpen = new GraphicsGroup({
		members: [
			{ graphic: body, offset: bodyOffset },
			{ graphic: halfEye, offset: leftEyeHalfOffset },
			{ graphic: halfEye, offset: rightEyeHalfOffset },
		],
	});
	const closed = new GraphicsGroup({
		members: [{ graphic: body, offset: bodyOffset }],
	});
	return {
		open,
		halfOpen,
		closed,
		leftEyeOffset,
		rightEyeOffset,
		leftEyeHalfOffset,
		rightEyeHalfOffset,
	};
}
