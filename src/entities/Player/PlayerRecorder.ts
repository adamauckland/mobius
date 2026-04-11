// Records and replays tile click events

import { game } from "@/game";
import { IClickEvent } from "@/interfaces/IClickEvent";

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

	stopRecording(): IClickEvent[] {
		this._isRecording = false;
		return [...this.events];
	}

	getRecording(): IClickEvent[] {
		return [...this.events];
	}

	startReplay(
		events: IClickEvent[],
		onClickTile: (tileIndex: number) => void,
	) {
		this.stopReplay();
		this._isReplaying = true;

		for (const event of events) {
			const id = game.clock.schedule(() => {
				onClickTile(event.targetTileIndex);
			}, event.timestamp);
			this.replaySchedules.push(id);
		}

		// end replay after the last event + a buffer for movement to finish
		const lastTime =
			events.length > 0
				? events[events.length - 1].timestamp
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
