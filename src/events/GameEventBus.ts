import { game } from "../game";
import type { GameEventMap, IGameEvent } from "./GameEvents";

type Handler<T> = (data: T) => void;

/**
 * Central event bus for game-state-changing events.
 *
 * - `emit()` dispatches to listeners AND records when recording is active.
 * - `dispatch()` dispatches to listeners only (never records).
 *    Use for cascade events (e.g. switch handler emitting barrier:open)
 *    and for replaying recorded events.
 *
 * During a rewind cycle, recorded events are scheduled via `replayEvents()`
 * which uses `dispatch()` internally — so replayed events trigger handlers
 * but are not re-recorded.
 */
class GameEventBus {
	private listeners = new Map<string, Set<Handler<unknown>>>();
	private recording: IGameEvent[] = [];
	private _isRecording = false;
	private startTime = 0;
	private replaySchedules: number[] = [];

	/** Subscribe to an event type. */
	on<K extends keyof GameEventMap>(
		type: K,
		handler: Handler<GameEventMap[K]>,
	): void {
		if (!this.listeners.has(type)) {
			this.listeners.set(type, new Set());
		}
		this.listeners.get(type)!.add(handler as Handler<unknown>);
	}

	/** Unsubscribe from an event type. */
	off<K extends keyof GameEventMap>(
		type: K,
		handler: Handler<GameEventMap[K]>,
	): void {
		this.listeners.get(type)?.delete(handler as Handler<unknown>);
	}

	/** Dispatch to listeners AND record if recording is active. */
	emit<K extends keyof GameEventMap>(
		type: K,
		data: GameEventMap[K],
	): void {
		if (this._isRecording) {
			this.recording.push({
				timestamp: game.clock.now() - this.startTime,
				type,
				data,
			});
		}
		this.dispatchToListeners(type, data);
	}

	/** Dispatch to listeners only — never records. */
	dispatch<K extends keyof GameEventMap>(
		type: K,
		data: GameEventMap[K],
	): void {
		this.dispatchToListeners(type, data);
	}

	private dispatchToListeners(type: string, data: unknown): void {
		const handlers = this.listeners.get(type);
		if (!handlers) return;
		for (const handler of handlers) {
			handler(data);
		}
	}

	/** Begin recording emitted events. */
	startRecording(): void {
		this.recording = [];
		this.startTime = game.clock.now();
		this._isRecording = true;
	}

	/** Stop recording and return the recorded events. */
	stopRecording(): IGameEvent[] {
		this._isRecording = false;
		return [...this.recording];
	}

	get isRecording(): boolean {
		return this._isRecording;
	}

	/** Schedule recorded events for replay via game.clock.schedule. */
	replayEvents(events: IGameEvent[]): void {
		for (const event of events) {
			const id = game.clock.schedule(() => {
				this.dispatch(
					event.type as keyof GameEventMap,
					event.data as GameEventMap[keyof GameEventMap],
				);
			}, event.timestamp);
			this.replaySchedules.push(id);
		}
	}

	/** Cancel all scheduled replay events. */
	stopReplay(): void {
		for (const id of this.replaySchedules) {
			game.clock.clearSchedule(id);
		}
		this.replaySchedules = [];
	}

	/** Stop recording and replay, clear recorded events. Listeners are preserved. */
	reset(): void {
		this._isRecording = false;
		this.recording = [];
		this.stopReplay();
	}
}

export const gameEventBus = new GameEventBus();
