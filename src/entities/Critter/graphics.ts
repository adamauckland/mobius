import { Actor, CollisionType, Vector, Circle } from "excalibur";
import { zFromY, Z_LAYER_SHADOW } from "@/ui/zIndex";
import {
	CRITTER_SIZE,
	SHADOW_RADIUS_X,
	SHADOW_RADIUS_Y,
	SHADOW_COLOR,
} from "@/entities/Critter/SETTINGS";
import { Color, vec, GraphicsGroup } from "excalibur";
import { EYE_BASE_LEFT_X, EYE_BASE_Y, EYE_BASE_RIGHT_X } from "@/entities/Critter/SETTINGS";
import { CRITTER_COLOR } from "@/entities/Critter/SETTINGS";
import { ICritterGraphics } from "@/entities/Critter/types/ICritterGraphics";

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

/** Create a small elliptical drop-shadow actor. */
export function createShadowActor(px: number, py: number): Actor {
	const shadow = new Actor({
		pos: new Vector(px, py + CRITTER_SIZE / 2),
		width: SHADOW_RADIUS_X * 2,
		height: SHADOW_RADIUS_Y * 2,
		z: zFromY(py, Z_LAYER_SHADOW),
		collisionType: CollisionType.PreventCollision,
	});

	const shadowCircle = new Circle({
		radius: SHADOW_RADIUS_X,
		color: SHADOW_COLOR,
	});

	shadow.graphics.use(shadowCircle);

	shadow.graphics.offset.y = -CRITTER_SIZE - CRITTER_SIZE; // -SHADOW_RADIUS_Y;
	shadow.graphics.offset.x = -CRITTER_SIZE / 2;

	shadow.scale.y = SHADOW_RADIUS_Y / SHADOW_RADIUS_X;

	return shadow;
}
