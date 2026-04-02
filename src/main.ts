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
