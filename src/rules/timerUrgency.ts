export const LOW_TIME_THRESHOLD_MS = 10000;

export function isLowTime(remainingMs: number): boolean {
	return remainingMs > 0 && remainingMs < LOW_TIME_THRESHOLD_MS;
}
