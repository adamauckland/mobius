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
