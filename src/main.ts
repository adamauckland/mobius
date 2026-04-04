import "./style.css";
import { Loader } from "excalibur";
import { Resources } from "./resources";
import { game } from "./game";
import { model } from "./model";
import "./startScreen";
import { startCustomMap } from "./startScreen";
import { showEditor } from "./editor";

// Load resources, then handle custom map / editor mode
const loader = new Loader();
loader.suppressPlayButton = true;
for (const resource of Object.values(Resources)) loader.addResource(resource);
game.start(loader).then(() => {
  // Check if we should auto-start a custom map (from editor "Test" button)
  const customMapJson = sessionStorage.getItem("customMap");
  if (customMapJson) {
    sessionStorage.removeItem("customMap");
    try {
      startCustomMap(customMapJson);
    } catch {
      console.error("Failed to load custom map");
    }
    return;
  }

  // Check if we should reopen the editor (from "Back to Editor" button)
  if (sessionStorage.getItem("editorMode") === "true") {
    sessionStorage.removeItem("editorMode");
    showEditor();
    return;
  }
}).catch(console.error);
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
