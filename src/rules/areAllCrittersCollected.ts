export interface CritterCountState {
	total: number;
	collected: number;
}

export function areAllCrittersCollected(state: CritterCountState): boolean {
	return state.total > 0 && state.collected >= state.total;
}
