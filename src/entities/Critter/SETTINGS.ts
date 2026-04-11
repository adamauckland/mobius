import { Color } from "excalibur";

// --- Constants ---
export const CRITTER_SIZE = 8;
export const CRITTERS_PER_GROUP = 5;
export const CRITTER_COLOR = Color.fromHex("#44eeff");
export const SHADOW_COLOR = Color.fromRGB(0, 0, 0, 0.25);
export const SHADOW_RADIUS_X = 3;
export const SHADOW_RADIUS_Y = 1.5;
/** Half the player speed. Player moves 16px in 200ms = 80px/s. */
export const FLEE_SPEED = 1000; // px/s

/** Distance at which critters start fleeing from a player */
export const FLEE_RADIUS = 48; // px (3 tiles)

/** Separation: push apart when closer than this */
export const SEPARATION_RADIUS = 10; // px

export const SEPARATION_STRENGTH = 60; // px/s

/** Cohesion: pull toward group center */
export const COHESION_STRENGTH = 15; // px/s

/** Collection radius — player must be this close to collect */
export const COLLECT_RADIUS = 10; // px

/** Maximum velocity magnitude */
export const MAX_SPEED = 50; // px/s

/** Damping applied each frame so critters slow when not fleeing */
export const DAMPING = 0.92;
/** Visual bounce amplitude and frequency */
export const BOUNCE_AMPLITUDE = 1.5; // px

export const BOUNCE_FREQ_FLEE = 0.016; // radians per ms
export const BOUNCE_FREQ_IDLE = 0.008; // radians per ms

/** Velocity multiplier when bouncing off walls (idle critters) */
export const WALL_RESTITUTION = 0.5;

/** Speed at which a one-way gate pushes a critter (px/s) */
export const GATE_PUSH_SPEED = 400;
export const GATE_DIRECTION_VECTORS: Record<string, [number, number]> = {
	up: [0, -1],
	down: [0, 1],
	left: [-1, 0],
	right: [1, 0],
};

// --- Graphics ---
export const BLINK_HALF_DURATION = 40; // ms per half-open transition

export const BLINK_CLOSED_DURATION = 60; // ms eyes stay fully closed

export const BLINK_TOTAL_DURATION =
	BLINK_HALF_DURATION * 2 + BLINK_CLOSED_DURATION;
export const EYE_BASE_LEFT_X = -2;
export const EYE_BASE_RIGHT_X = 1;
export const EYE_BASE_Y = -1;
export const EYE_SHIFT_MAX = 1; // max px the eyes shift toward movement direction

export const IDLE_LOOK_DIRECTIONS = [-EYE_SHIFT_MAX, 0, EYE_SHIFT_MAX]; // left, center, right

export const IDLE_LOOK_MIN_MS = 800;
export const IDLE_LOOK_MAX_MS = 2500;
