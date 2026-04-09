import {
	collection,
	doc,
	getDoc,
	setDoc,
	getDocs,
	query,
	orderBy,
	limit,
	serverTimestamp,
	Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import type { IProjectData } from "./IProjectData";
import { serializeProject, deserializeProject } from "./mapData";

export interface LevelPack {
	id: string;
	name: string;
	author: string;
	description: string;
	levelCount: number;
	createdAt: Timestamp | null;
	projectJson: string;
}

const PACKS_COLLECTION = "levelPacks";

/** Generate a short shareable ID (8 chars) */
function generatePackId(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
	let id = "";
	for (let i = 0; i < 8; i++) {
		id += chars[Math.floor(Math.random() * chars.length)];
	}
	return id;
}

/** Publish a project as a shareable level pack. Returns the pack ID. */
export async function publishPack(
	project: IProjectData,
	name: string,
	author: string,
	description: string,
): Promise<string> {
	const id = generatePackId();
	const json = serializeProject(project);

	await setDoc(doc(db, PACKS_COLLECTION, id), {
		name,
		author,
		description,
		levelCount: project.levels.length,
		createdAt: serverTimestamp(),
		projectJson: json,
	});

	return id;
}

/** Load a level pack by its ID. Returns null if not found. */
export async function loadPack(id: string): Promise<LevelPack | null> {
	const snap = await getDoc(doc(db, PACKS_COLLECTION, id));
	if (!snap.exists()) return null;
	const data = snap.data();
	return {
		id: snap.id,
		name: data.name,
		author: data.author,
		description: data.description,
		levelCount: data.levelCount,
		createdAt: data.createdAt,
		projectJson: data.projectJson,
	};
}

/** Get the project data from a pack. */
export function getPackProject(pack: LevelPack): IProjectData {
	return deserializeProject(pack.projectJson);
}

/** Browse recent level packs. */
export async function browsePacks(maxResults = 20): Promise<LevelPack[]> {
	const q = query(
		collection(db, PACKS_COLLECTION),
		orderBy("createdAt", "desc"),
		limit(maxResults),
	);
	const snap = await getDocs(q);
	return snap.docs.map((d) => {
		const data = d.data();
		return {
			id: d.id,
			name: data.name,
			author: data.author,
			description: data.description,
			levelCount: data.levelCount,
			createdAt: data.createdAt,
			projectJson: data.projectJson,
		};
	});
}
