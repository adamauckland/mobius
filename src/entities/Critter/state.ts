import { ICritterGroup } from "./types/ICritterGroup";

export const critterGroups: ICritterGroup[] = [];

export function getCritterGroups(): ICritterGroup[] {
	return critterGroups;
}

export function clearCritters() {
	critterGroups.length = 0;
}

export function getCritterCount(): { total: number; collected: number } {
	let total = 0;
	let collected = 0;
	for (const group of critterGroups) {
		for (const c of group.critters) {
			total++;
			if (c.collected) collected++;
		}
	}
	return { total, collected };
}
