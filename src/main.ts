import "@/style.css";
import { Loader } from "excalibur";
import { Resources } from "@/resources/resources";
import { game } from "@/game";
import { model } from "@/model";
import "@/gameSetup";
import { startCustomMap, startProjectLevel } from "@/gameSetup";
import { playMenuMusic } from "@/audio/music";

// Load resources, then handle custom map / editor mode / project play
const loader = new Loader();
loader.suppressPlayButton = true;
for (const resource of Object.values(Resources)) loader.addResource(resource);

// Ensure the Sixtyfour webfont is loaded before Excalibur rasterises any Text.
// Canvas text doesn't honour @font-face / font-display, so we explicitly register
// the FontFace via JS and await it before starting the game.
const sixtyfourFace = new FontFace(
	"Sixtyfour",
	'url("/fonts/Sixtyfour-Regular-VariableFont_BLED,SCAN.ttf") format("truetype")',
);

const fontReady = sixtyfourFace
	.load()
	.then((loaded) => {
		(document.fonts as unknown as { add(face: FontFace): void }).add(loaded);
	})
	.catch((err) => {
		console.warn("Failed to load Sixtyfour font:", err);
	});

fontReady.then(() =>
	game
		.start(loader)
		.then(() => {
			playMenuMusic();

			// Check if we should auto-start a project level (from editor "Test" or "Continue" button)
			const projectJson = localStorage.getItem("customProject");
			if (projectJson) {
				const levelStr = localStorage.getItem("customProjectLevel") || "0";
				localStorage.removeItem("customProject");
				localStorage.removeItem("customProjectLevel");
				try {
					startProjectLevel(projectJson, parseInt(levelStr, 10));
				} catch {
					console.error("Failed to load project level");
				}
				return;
			}

			// Legacy single-map support
			const customMapJson = localStorage.getItem("customMap");
			if (customMapJson) {
				localStorage.removeItem("customMap");
				try {
					startCustomMap(customMapJson);
				} catch {
					console.error("Failed to load custom map");
				}
				return;
			}

			// Check for ?pack=ID in URL — load a shared pack from Firebase
			const urlParams = new URLSearchParams(window.location.search);
			const packId = urlParams.get("pack");
			if (packId) {
				// Clear the URL param so reloads don't re-fetch
				window.history.replaceState({}, "", window.location.pathname);
				import("@/levelPacks/levelPacks").then(
					async ({ loadPack, getPackProject }) => {
						try {
							const pack = await loadPack(packId);
							if (!pack) {
								alert(`Level pack "${packId}" not found.`);
								return;
							}
							const proj = getPackProject(pack);
							const json = JSON.stringify(proj);
							// Persist as editor state so the in-game EDITOR button
							// resumes on this pack with full metadata.
							localStorage.setItem("editorProject", json);
							localStorage.setItem("editorLevel", "0");
							localStorage.setItem("editorPackId", pack.id);
							localStorage.setItem(
								"editorPackDescription",
								pack.description ?? "",
							);
							localStorage.setItem(
								"editorPackOwnerUid",
								pack.ownerUid ?? "",
							);
							startProjectLevel(json, 0);
						} catch (err) {
							alert("Failed to load pack: " + (err as Error).message);
						}
					},
				);
				return;
			}

			// Check if we should reopen the editor (from in-game EDITOR button)
			if (localStorage.getItem("editorMode") === "true") {
				localStorage.removeItem("editorMode");
				import("@/editor/editor").then(({ showEditor }) => showEditor());
				return;
			}
		})
		.catch(console.error),
);
model.showHUD = true;

// Auth bar on start screen
import("@/auth/auth").then(({ onAuthChange, signInWithGoogle, signOut }) => {
	const btnSignIn = document.getElementById(
		"btn-sign-in",
	) as HTMLButtonElement | null;
	const btnSignOut = document.getElementById(
		"btn-sign-out",
	) as HTMLButtonElement | null;
	const authUser = document.getElementById(
		"auth-user",
	) as HTMLSpanElement | null;
	if (!btnSignIn || !btnSignOut || !authUser) return;

	btnSignIn.addEventListener("click", async () => {
		btnSignIn.disabled = true;
		try {
			await signInWithGoogle();
		} catch (err) {
			alert("Sign-in failed: " + (err as Error).message);
		} finally {
			btnSignIn.disabled = false;
		}
	});

	btnSignOut.addEventListener("click", async () => {
		try {
			await signOut();
		} catch (err) {
			alert("Sign-out failed: " + (err as Error).message);
		}
	});

	// Sign-out button starts hidden; tapping the avatar toggles it.
	authUser.style.cursor = "pointer";
	authUser.addEventListener("click", () => {
		btnSignOut.style.display =
			btnSignOut.style.display === "none" ? "" : "none";
	});

	onAuthChange((user) => {
		btnSignOut.style.display = "none";
		if (user) {
			btnSignIn.style.display = "none";
			authUser.style.display = "inline-flex";
			authUser.style.alignItems = "center";
			authUser.style.gap = "8px";
			authUser.innerHTML = "";
			if (user.photoURL) {
				const img = document.createElement("img");
				img.src = user.photoURL;
				img.alt = user.displayName;
				img.title = user.email;
				img.referrerPolicy = "no-referrer";
				img.style.cssText =
					"width:28px;height:28px;border-radius:50%;border:1px solid #5e676b;";
				authUser.appendChild(img);
			} else {
				authUser.textContent = user.email;
			}
		} else {
			btnSignIn.style.display = "";
			authUser.style.display = "none";
			authUser.innerHTML = "";
		}
	});
});
