import { Actor, Vector } from "excalibur";

// --- Types ---

export interface ICritter {
	actor: Actor;
	shadow: Actor;
	position: Vector; // sub-pixel position (not tile-locked)
	velocity: Vector;
	groupIndex: number; // which group this critter belongs to
	collected: boolean;
	onGate: boolean;
	fleeing: boolean;
}
