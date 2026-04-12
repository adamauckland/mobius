import { ILevelCompletionState } from "./ILevelCompletionState";

export function canCompleteLevel(state: ILevelCompletionState): boolean {
	if (state.critterTotal > 0 && state.critterCollected < state.critterTotal) {
		return false;
	}
	return true;
}
