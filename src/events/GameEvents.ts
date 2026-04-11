/**
 * Defines all game event types that flow through the GameEventBus.
 * Events are recorded with timestamps and replayed during time rewind.
 */

/** Map of event type names to their payload shapes. */
export interface GameEventMap {
	"switch:activate": { tileIndex: number };
	"barrier:open": { groupId: number };
}

/** A single recorded game event with its timecode. */
export interface IGameEvent {
	timestamp: number; // ms since recording started
	type: keyof GameEventMap;
	data: GameEventMap[keyof GameEventMap];
}
