export interface CarryState {
	carryingRock: boolean;
	carryingParcel: boolean;
}

export function canPickUpItem(state: CarryState): boolean {
	return !state.carryingRock && !state.carryingParcel;
}

export interface DropAtTileState extends CarryState {
	targetTileIndex: number;
	playerTileIndex: number;
}

export function canDropItemAtTile(state: DropAtTileState): boolean {
	if (state.targetTileIndex !== state.playerTileIndex) return false;
	return state.carryingRock || state.carryingParcel;
}
