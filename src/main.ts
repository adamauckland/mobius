import "./style.css";
import { Loader } from "excalibur";
import { Resources } from "./resources";
import { game } from "./game";
import { model } from "./model";
import "./gameSetup";
import { startCustomMap, startProjectLevel } from "./gameSetup";
import { showEditor } from "./levels/editor";

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

fontReady.then(() => game
	.start(loader)
	.then(() => {
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
			import("./levels/levelPacks").then(
				async ({ loadPack, getPackProject }) => {
					try {
						const pack = await loadPack(packId);
						if (!pack) {
							alert(`Level pack "${packId}" not found.`);
							return;
						}
						const proj = getPackProject(pack);
						const json = JSON.stringify(proj);
						startProjectLevel(json, 0);
					} catch (err) {
						alert("Failed to load pack: " + (err as Error).message);
					}
				},
			);
			return;
		}

		// Check if we should reopen the editor (from "Back to Editor" button)
		if (localStorage.getItem("editorMode") === "true") {
			localStorage.removeItem("editorMode");
			showEditor();
			return;
		}
	})
	.catch(console.error));
model.showHUD = true;

// Pause state and toggle — shared between Escape key and HUD button
export let paused = false;
let onPauseChanged: ((paused: boolean) => void) | null = null;

export function onPauseChange(cb: (paused: boolean) => void) {
	onPauseChanged = cb;
}

export function togglePause() {
	paused = !paused;
	if (paused) {
		game.clock.stop();
	} else {
		game.clock.start();
	}
	onPauseChanged?.(paused);
}

document.addEventListener("keydown", (e) => {
	if (e.key === "Escape") togglePause();
});

// Editor button on start screen
const btnEditor = document.getElementById("btn-editor");
if (btnEditor) {
	btnEditor.addEventListener("click", () => showEditor());
}
