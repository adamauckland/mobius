import "./style.css";
import { Loader } from "excalibur";
import { Resources } from "./resources";
import { game } from "./game";
import { model } from "./model";
import "./startScreen";

// Load resources, then wait for START
const loader = new Loader();
loader.suppressPlayButton = true;
for (const resource of Object.values(Resources)) loader.addResource(resource);
game.start(loader).catch(console.error);
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
