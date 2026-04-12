export interface PortalEntryState {
	isActivePlayer: boolean;
}

export function canEnterPortal(state: PortalEntryState): boolean {
	return state.isActivePlayer;
}
