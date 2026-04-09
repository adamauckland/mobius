import { PlayerActor } from "../entities/Player/PlayerActor";
import { GameRecorder } from "../interfaces/GameRecorder";
import type { IGameRecording } from "../interfaces/IGameRecording";

export interface IPlayerEntry {
	player: PlayerActor;
	recorder: GameRecorder;
	recording: IGameRecording | null;
}
