import { PlayerActor } from "../entities/Player/PlayerActor";
import { PlayerRecorder } from "../entities/Player/PlayerRecorder";
import type { IGameRecording } from "../interfaces/IGameRecording";

export interface IPlayerEntry {
	player: PlayerActor;
	recorder: PlayerRecorder;
	recording: IGameRecording | null;
}
