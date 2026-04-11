import { IClickEvent } from "@/interfaces/IClickEvent";
import type { IGameEvent } from "@/events/GameEvents";

export interface IGameRecording {
	events: IClickEvent[];
	gameEvents: IGameEvent[];
}
