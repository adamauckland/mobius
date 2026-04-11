import { Actor } from "excalibur";
import { game } from "@/game";
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
} from "@/entities/Critter/SETTINGS";
import { createCritterGraphics } from "@/entities/Critter/graphics";
import type { ICritterGraphics } from "@/entities/Critter/types/ICritterGraphics";
import { ICritter } from "@/entities/Critter/types/ICritter";

interface BlinkState {
	nextBlink: number;
	blinkStart: number;
}

interface IdleLookState {
	shift: number;
	target: number;
	nextLook: number;
}

function randomIdleLookDelay(now: number): number {
	return now + IDLE_LOOK_MIN_MS + Math.random() * (IDLE_LOOK_MAX_MS - IDLE_LOOK_MIN_MS);
}

function getBlinkEyeState(blink: BlinkState, now: number): "open" | "half" | "closed" {
	if (blink.blinkStart === 0) {
		if (now >= blink.nextBlink) {
			blink.blinkStart = now;
		}
		return "open";
	}
	const elapsed = now - blink.blinkStart;
	if (elapsed < BLINK_HALF_DURATION) return "half";
	if (elapsed < BLINK_HALF_DURATION + BLINK_CLOSED_DURATION) return "closed";
	if (elapsed < BLINK_TOTAL_DURATION) return "half";
	// Blink finished
	blink.blinkStart = 0;
	blink.nextBlink = now + 1000 + Math.random() * 3000;
	return "open";
}

function applyEyeGraphic(actor: Actor, gfx: ICritterGraphics, eyeState: "open" | "half" | "closed") {
	if (eyeState === "closed") {
		actor.graphics.use(gfx.closed);
	} else if (eyeState === "half") {
		actor.graphics.use(gfx.halfOpen);
	} else {
		actor.graphics.use(gfx.open);
	}
}

function computeEyeShift(critter: ICritter, speed: number, idle: IdleLookState, now: number): number {
	if (speed > 1) {
		idle.nextLook = randomIdleLookDelay(now);
		idle.shift = 0;
		idle.target = 0;
		return (critter.velocity.x / speed) * EYE_SHIFT_MAX;
	}
	if (now >= idle.nextLook) {
		idle.target = IDLE_LOOK_DIRECTIONS[Math.floor(Math.random() * IDLE_LOOK_DIRECTIONS.length)];
		idle.nextLook = randomIdleLookDelay(now);
	}
	idle.shift += (idle.target - idle.shift) * 0.08;
	return idle.shift;
}

function applyEyeShift(gfx: ICritterGraphics, shift: number) {
	gfx.leftEyeOffset.x = EYE_BASE_LEFT_X + shift;
	gfx.rightEyeOffset.x = EYE_BASE_RIGHT_X + shift;
	gfx.leftEyeHalfOffset.x = EYE_BASE_LEFT_X + shift;
	gfx.rightEyeHalfOffset.x = EYE_BASE_RIGHT_X + shift;
}

function computeBounceOffset(critter: ICritter, speed: number, now: number, phase: number): number {
	if (critter.onGate) return 0;
	if (speed <= 1) return 0;
	const bounceFreq = critter.fleeing ? BOUNCE_FREQ_FLEE : BOUNCE_FREQ_IDLE;
	return -Math.abs(Math.sin(now * bounceFreq + phase)) * BOUNCE_AMPLITUDE;
}

/** Attach blink/bounce/eye-shift animation to a critter's actor. */
export function attachCritterAnimation(actor: Actor, critter: ICritter) {
	const gfx = createCritterGraphics();
	actor.graphics.use(gfx.open);
	const phase = Math.random() * Math.PI * 2;
	const blink: BlinkState = {
		nextBlink: game.clock.now() + 1000 + Math.random() * 3000,
		blinkStart: 0,
	};
	const idle: IdleLookState = {
		shift: 0,
		target: 0,
		nextLook: randomIdleLookDelay(game.clock.now()),
	};

	actor.graphics.onPreDraw = () => {
		const now = game.clock.now();
		const speed = Math.sqrt(
			critter.velocity.x * critter.velocity.x +
				critter.velocity.y * critter.velocity.y,
		);
		const facingAway = speed > 1 && critter.velocity.y < 0;

		let eyeState = getBlinkEyeState(blink, now);
		if (facingAway) eyeState = "closed";
		applyEyeGraphic(actor, gfx, eyeState);

		const shift = computeEyeShift(critter, speed, idle, now);
		applyEyeShift(gfx, shift);

		actor.graphics.offset.y = computeBounceOffset(critter, speed, now, phase);
	};
}
