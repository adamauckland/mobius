import { Timestamp } from "firebase/firestore";

export interface ILevelPack {
	id: string;
	name: string;
	author: string;
	description: string;
	levelCount: number;
	createdAt: Timestamp | null;
	projectJson: string;
}
