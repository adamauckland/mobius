import { Actor, Vector } from "excalibur";

export interface IMonster {
	actor: Actor;
	startPos: Vector;
	endPos: Vector;
	phase: number;
	speed: number;
}
