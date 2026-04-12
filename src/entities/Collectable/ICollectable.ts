import { Actor } from "excalibur";

// --- Collectables ---

export interface ICollectable {
	actor: Actor;
	tileIndex: number;
	collected: boolean;
}
