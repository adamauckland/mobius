import "./style.css";
import { Loader } from "excalibur";
import { Resources } from "./resources";
import { game } from "./game";
import { model } from "./model";
import "./startScreen";
import { startCustomMap, startProjectLevel } from "./startScreen";
import { showEditor } from "./editor";

// Load resources, then handle custom map / editor mode / project play
const loader = new Loader();
loader.suppressPlayButton = true;
for (const resource of Object.values(Resources)) loader.addResource(resource);
game
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

    // Check if we should reopen the editor (from "Back to Editor" button)
    if (localStorage.getItem("editorMode") === "true") {
      localStorage.removeItem("editorMode");
      showEditor();
      return;
    }
  })
  .catch(console.error);
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
