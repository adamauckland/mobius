import { PlayerActor } from "@/entities/Player/PlayerActor";
import { PlayerRecorder } from "@/entities/Player/PlayerRecorder";
import type { IGameRecording } from "@/interfaces/IGameRecording";

export interface IPlayerEntry {
	player: PlayerActor;
	recorder: PlayerRecorder;
	recording: IGameRecording | null;
	/** The tile index where this player was spawned (used to reset on rewind). */
	spawnTileIndex: number;
}
