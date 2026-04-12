export interface LevelCompletionState {
	critterTotal: number;
	critterCollected: number;
}

export function canCompleteLevel(state: LevelCompletionState): boolean {
	if (state.critterTotal > 0 && state.critterCollected < state.critterTotal) {
		return false;
	}
	return true;
}
