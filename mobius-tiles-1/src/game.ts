import { Engine, DisplayMode } from "excalibur";

export const game = new Engine({
  width: 800,
  height: 600,
  canvasElementId: "cnv",
  displayMode: DisplayMode.FitScreen,
  pixelArt: true,
});
