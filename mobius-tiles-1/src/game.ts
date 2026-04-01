import { Engine, DisplayMode } from "excalibur";

export const game = new Engine({
  canvasElementId: "cnv",
  displayMode: DisplayMode.FillScreen,
  pixelArt: true,
  suppressHiDPIScaling: false,
});
