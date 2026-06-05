import Phaser from "phaser";
import "./styles.css";
import { UltramanMathScene } from "./scenes/UltramanMathScene";

const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app root");
}

const guard = document.createElement("div");
guard.className = "portrait-guard";
guard.textContent = "请横屏开始战斗";
document.body.appendChild(guard);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: root,
  width: 960,
  height: 540,
  backgroundColor: "#06111f",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540
  },
  input: {
    activePointers: 3
  },
  render: {
    pixelArt: false,
    antialias: true
  },
  scene: [UltramanMathScene]
});

if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) {
  (window as Window & { __ultramanmathGame?: Phaser.Game }).__ultramanmathGame = game;
}
