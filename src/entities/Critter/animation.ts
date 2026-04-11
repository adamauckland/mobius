import { Actor } from "excalibur";
import { game } from "../../game";
import {
	IDLE_LOOK_MIN_MS,
	IDLE_LOOK_MAX_MS,
	BLINK_HALF_DURATION,
	BLINK_CLOSED_DURATION,
	BLINK_TOTAL_DURATION,
	EYE_SHIFT_MAX,
	IDLE_LOOK_DIRECTIONS,
	EYE_BASE_LEFT_X,
	EYE_BASE_RIGHT_X,
	BOUNCE_FREQ_FLEE,
	BOUNCE_FREQ_IDLE,
	BOUNCE_AMPLITUDE,
} from "./SETTINGS";
import { createCritterGraphics } from "./graphics";
import { ICritter } from "./types/ICritter";

/** Attach blink/bounce/eye-shift animation to a critter's actor. */

export function attachCritterAnimation(actor: Actor, critter: ICritter) {
	const gfx = createCritterGraphics();
	actor.graphics.use(gfx.open);
	const phase = Math.random() * Math.PI * 2;
	let nextBlink = game.clock.now() + 1000 + Math.random() * 3000;
	let blinkStart = 0; // 0 = not blinking

	// Idle look-around state
	let idleLookShift = 0;
	let idleLookTarget = 0;
	let nextIdleLook =
		game.clock.now() +
		IDLE_LOOK_MIN_MS +
		Math.random() * (IDLE_LOOK_MAX_MS - IDLE_LOOK_MIN_MS);

	actor.graphics.onPreDraw = () => {
		const now = game.clock.now();
		const speed = Math.sqrt(
			critter.velocity.x * critter.velocity.x +
				critter.velocity.y * critter.velocity.y,
		);
		const facingAway = speed > 1 && critter.velocity.y < 0;
		// Start a new blink
		if (blinkStart === 0 && now >= nextBlink) {
			blinkStart = now;
		}
		// Determine blink phase: half-open -> closed -> half-open -> open
		let eyeState: "open" | "half" | "closed" = "open";
		if (blinkStart > 0) {
			const elapsed = now - blinkStart;
			if (elapsed < BLINK_HALF_DURATION) {
				eyeState = "half";
			} else if (elapsed < BLINK_HALF_DURATION + BLINK_CLOSED_DURATION) {
				eyeState = "closed";
			} else if (elapsed < BLINK_TOTAL_DURATION) {
				eyeState = "half";
			} else {
				// Blink finished
				blinkStart = 0;
				nextBlink = now + 1000 + Math.random() * 3000;
				eyeState = "open";
			}
		}
		if (facingAway) eyeState = "closed";
		if (eyeState === "closed") {
			actor.graphics.use(gfx.closed);
		} else if (eyeState === "half") {
			actor.graphics.use(gfx.halfOpen);
		} else {
			actor.graphics.use(gfx.open);
		}
		// Eye shift: follow movement when moving, look around when idle
		let shift: number;
		if (speed > 1) {
			shift = (critter.velocity.x / speed) * EYE_SHIFT_MAX;
			// Reset idle timer while moving
			nextIdleLook =
				now +
				IDLE_LOOK_MIN_MS +
				Math.random() * (IDLE_LOOK_MAX_MS - IDLE_LOOK_MIN_MS);
			idleLookShift = 0;
			idleLookTarget = 0;
		} else {
			// Pick a new random look direction on timer
			if (now >= nextIdleLook) {
				idleLookTarget =
					IDLE_LOOK_DIRECTIONS[
						Math.floor(Math.random() * IDLE_LOOK_DIRECTIONS.length)
					];
				nextIdleLook =
					now +
					IDLE_LOOK_MIN_MS +
					Math.random() * (IDLE_LOOK_MAX_MS - IDLE_LOOK_MIN_MS);
			}
			// Smoothly lerp toward the target
			idleLookShift += (idleLookTarget - idleLookShift) * 0.08;
			shift = idleLookShift;
		}
		gfx.leftEyeOffset.x = EYE_BASE_LEFT_X + shift;
		gfx.rightEyeOffset.x = EYE_BASE_RIGHT_X + shift;
		gfx.leftEyeHalfOffset.x = EYE_BASE_LEFT_X + shift;
		gfx.rightEyeHalfOffset.x = EYE_BASE_RIGHT_X + shift;
		if (critter.onGate) {
			actor.graphics.offset.y = 0;
		} else if (speed > 1) {
			const bounceFreq = critter.fleeing ? BOUNCE_FREQ_FLEE : BOUNCE_FREQ_IDLE;
			actor.graphics.offset.y =
				-Math.abs(Math.sin(now * bounceFreq + phase)) * BOUNCE_AMPLITUDE;
		} else {
			actor.graphics.offset.y = 0;
		}
	};
}
