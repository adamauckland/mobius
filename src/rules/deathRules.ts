export interface DeathHandleState {
	killedPlayerIsActive: boolean;
	gameOver: boolean;
}

export function shouldHandlePlayerDeath(state: DeathHandleState): boolean {
	return state.killedPlayerIsActive && !state.gameOver;
}

export interface ReviveState {
	livesRemaining: number;
}

export function canRevive(state: ReviveState): boolean {
	return state.livesRemaining > 0;
}
