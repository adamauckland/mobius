import { Actor } from "excalibur";
import { PlayerActor } from "@/entities/Player/PlayerActor";

export interface IRock {
	actor: Actor;
	originTileIndex: number;
	tileIndex: number;
	carriedBy: PlayerActor | null;
}
