// Records and replays tile click events

import { game } from "../../game";
import { IClickEvent } from "../../interfaces/IClickEvent";
import { IGameRecording } from "../../interfaces/IGameRecording";

export class PlayerRecorder {
	private events: IClickEvent[] = [];
	private startTime = 0;
	private _isRecording = false;
	private _isReplaying = false;
	private replaySchedules: number[] = [];

	get isRecording() {
		return this._isRecording;
	}

	get isReplaying() {
		return this._isReplaying;
	}

	startRecording() {
		this.events = [];
		this.startTime = game.clock.now();
		this._isRecording = true;
	}

	recordClick(targetTileIndex: number) {
		if (!this._isRecording) return;
		this.events.push({
			timestamp: game.clock.now() - this.startTime,
			targetTileIndex,
		});
	}

	stopRecording(): IGameRecording {
		this._isRecording = false;
		return { events: [...this.events] };
	}

	getRecording(): IGameRecording {
		return { events: [...this.events] };
	}

	startReplay(
		recording: IGameRecording,
		onClickTile: (tileIndex: number) => void,
	) {
		this.stopReplay();
		this._isReplaying = true;

		for (const event of recording.events) {
			const id = game.clock.schedule(() => {
				onClickTile(event.targetTileIndex);
			}, event.timestamp);
			this.replaySchedules.push(id);
		}

		// end replay after the last event + a buffer for movement to finish
		const lastTime =
			recording.events.length > 0
				? recording.events[recording.events.length - 1].timestamp
				: 0;
		const endId = game.clock.schedule(() => {
			this._isReplaying = false;
		}, lastTime + 5000);
		this.replaySchedules.push(endId);
	}

	stopReplay() {
		for (const id of this.replaySchedules) {
			game.clock.clearSchedule(id);
		}
		this.replaySchedules = [];
		this._isReplaying = false;
	}
}
