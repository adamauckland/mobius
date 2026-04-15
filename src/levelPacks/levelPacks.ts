import {
	collection,
	doc,
	getDoc,
	setDoc,
	updateDoc,
	getDocs,
	query,
	orderBy,
	limit,
	serverTimestamp,
} from "firebase/firestore";
import { db } from "@/levelPacks/firebase";
import type { IProjectData } from "@/interfaces/IProjectData";
import { serializeProject, deserializeProject } from "@/levels/mapData";
import { ILevelPack } from "@/interfaces/ILevelPack";
import { getCurrentUser } from "@/auth/auth";

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
	const user = getCurrentUser();
	if (!user) throw new Error("You must be signed in to publish a pack.");

	const id = generatePackId();
	const json = serializeProject(project);

	await setDoc(doc(db, PACKS_COLLECTION, id), {
		name,
		author,
		description,
		levelCount: project.levels.length,
		createdAt: serverTimestamp(),
		projectJson: json,
		ownerUid: user.uid,
		ownerEmail: user.email,
	});

	return id;
}

/** Update an existing level pack in place. */
export async function updatePack(
	id: string,
	project: IProjectData,
	name: string,
	description: string,
): Promise<void> {
	const user = getCurrentUser();
	if (!user) throw new Error("You must be signed in to update a pack.");

	const json = serializeProject(project);
	await updateDoc(doc(db, PACKS_COLLECTION, id), {
		name,
		description,
		levelCount: project.levels.length,
		projectJson: json,
		updatedAt: serverTimestamp(),
	});
}

/** Claim an unowned (legacy) level pack by stamping the current user as owner. */
export async function claimPack(id: string): Promise<void> {
	const user = getCurrentUser();
	if (!user) throw new Error("You must be signed in to claim a pack.");

	await updateDoc(doc(db, PACKS_COLLECTION, id), {
		ownerUid: user.uid,
		ownerEmail: user.email,
		claimedAt: serverTimestamp(),
	});
}

/** Load a level pack by its ID. Returns null if not found. */
export async function loadPack(id: string): Promise<ILevelPack | null> {
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
		ownerUid: data.ownerUid ?? "",
		ownerEmail: data.ownerEmail ?? "",
	};
}

/** Get the project data from a pack. */
export function getPackProject(pack: ILevelPack): IProjectData {
	return deserializeProject(pack.projectJson);
}

/** Browse recent level packs. */
export async function browsePacks(maxResults = 20): Promise<ILevelPack[]> {
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
			ownerUid: data.ownerUid ?? "",
			ownerEmail: data.ownerEmail ?? "",
		};
	});
}
