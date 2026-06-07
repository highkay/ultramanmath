import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

function pruneSourceAssets(): Plugin {
  return {
    name: "prune-source-assets",
    apply: "build",
    closeBundle: async () => {
      const generatedRoot = resolve(__dirname, "dist/assets/generated");
      const sourceOnlyPaths = [
        "chroma-source",
        "monsters-01-atlas.png",
        "monsters-02-atlas.png",
        "monsters-03-atlas.png",
        "monsters-04-atlas.png",
        "ultra-heroes-atlas.png"
      ];

      await Promise.all(
        sourceOnlyPaths.map((assetPath) => rm(resolve(generatedRoot, assetPath), { recursive: true, force: true }))
      );
    }
  };
}

export default defineConfig({
  plugins: [pruneSourceAssets()]
});
