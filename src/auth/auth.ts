import {
	onAuthStateChanged,
	signInWithPopup,
	signOut as fbSignOut,
	type User,
} from "firebase/auth";
import { auth, googleProvider } from "@/levelPacks/firebase";

export interface AuthUser {
	uid: string;
	email: string;
	displayName: string;
	photoURL: string | null;
}

function toAuthUser(user: User | null): AuthUser | null {
	if (!user || !user.email) return null;
	return {
		uid: user.uid,
		email: user.email,
		displayName: user.displayName ?? user.email,
		photoURL: user.photoURL,
	};
}

export function getCurrentUser(): AuthUser | null {
	return toAuthUser(auth.currentUser);
}

export function onAuthChange(cb: (user: AuthUser | null) => void): () => void {
	return onAuthStateChanged(auth, (u) => cb(toAuthUser(u)));
}

export async function signInWithGoogle(): Promise<AuthUser | null> {
	const result = await signInWithPopup(auth, googleProvider);
	return toAuthUser(result.user);
}

export async function signOut(): Promise<void> {
	await fbSignOut(auth);
}
