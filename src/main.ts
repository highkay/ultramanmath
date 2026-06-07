import Phaser from "phaser";
import "./styles.css";
import { UltramanMathScene } from "./scenes/UltramanMathScene";

type ImageExtension = "webp" | "png";

interface WakeLockHandle extends EventTarget {
  readonly released: boolean;
  release(): Promise<void>;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

declare global {
  interface Window {
    __ultramanmathGame?: Phaser.Game;
    __ultramanmathPreferredImageExt?: ImageExtension;
  }
}

const root = document.getElementById("app");

if (!root) {
  throw new Error("Missing #app root");
}

const guard = document.createElement("div");
guard.className = "portrait-guard";
guard.textContent = "请横屏开始战斗";
document.body.appendChild(guard);

const supportsWebp = (): boolean => {
  const canvas = document.createElement("canvas");
  return canvas.toDataURL("image/webp").startsWith("data:image/webp");
};

const setViewportHeight = (): void => {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
};

window.__ultramanmathPreferredImageExt = supportsWebp() ? "webp" : "png";
setViewportHeight();

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

const refreshGameScale = (): void => {
  window.requestAnimationFrame(() => game.scale.refresh());
};

const refreshViewport = (): void => {
  setViewportHeight();
  refreshGameScale();
};

const requestFullscreen = async (): Promise<void> => {
  if (document.fullscreenElement) return;
  const element = document.documentElement as FullscreenElement;
  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen({ navigationUI: "hide" });
    } else if (element.webkitRequestFullscreen) {
      await element.webkitRequestFullscreen();
    }
  } catch {
    // Mobile browsers only allow fullscreen from trusted gestures; retry on the next tap.
  }
};

const lockLandscape = async (): Promise<void> => {
  const orientation = screen.orientation as (ScreenOrientation & {
    lock?: (orientation: "landscape") => Promise<void>;
  }) | undefined;
  try {
    await orientation?.lock?.("landscape");
  } catch {
    // Orientation lock support varies across mobile browsers.
  }
};

let wakeLock: WakeLockHandle | undefined;
const requestWakeLock = async (): Promise<void> => {
  if (document.visibilityState !== "visible" || wakeLock?.released === false) return;
  const wakeLockApi = (navigator as Navigator & {
    wakeLock?: { request: (type: "screen") => Promise<WakeLockHandle> };
  }).wakeLock;
  try {
    wakeLock = await wakeLockApi?.request("screen");
    wakeLock?.addEventListener("release", () => {
      wakeLock = undefined;
    }, { once: true });
  } catch {
    // Keep the game playable when Wake Lock is unavailable.
  }
};

const enterImmersiveMode = (): void => {
  void requestFullscreen().then(lockLandscape).then(requestWakeLock).finally(refreshGameScale);
};

window.addEventListener("resize", refreshViewport);
window.visualViewport?.addEventListener("resize", refreshViewport);
window.addEventListener("orientationchange", () => {
  window.setTimeout(refreshViewport, 260);
});
document.addEventListener("fullscreenchange", refreshGameScale);
document.addEventListener("webkitfullscreenchange", refreshGameScale);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    refreshViewport();
    void requestWakeLock();
  }
});
document.addEventListener("pointerup", enterImmersiveMode, { capture: true });
document.addEventListener("touchend", enterImmersiveMode, { capture: true, passive: true });

if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) {
  window.__ultramanmathGame = game;
}
