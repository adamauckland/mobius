import { ICollectable } from "./ICollectable";

export const collectables: ICollectable[] = [];
export let score = 0;

export function getScore() {
	return score;
}

export function addScore(points: number) {
	score += points;
}
