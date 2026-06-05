import type { DifficultyId } from "./data";

const STORAGE_KEY = "ultramanmath-save-v1";

export interface SaveData {
  energy: number;
  unlockedHeroes: string[];
  unlockedEffects: string[];
  selectedEffect: string;
  unlockedDifficulties: DifficultyId[];
  storyProgress: Record<DifficultyId, number>;
}

export const defaultSave: SaveData = {
  energy: 0,
  unlockedHeroes: ["ultraman"],
  unlockedEffects: ["blue"],
  selectedEffect: "blue",
  unlockedDifficulties: ["normal"],
  storyProgress: {
    normal: 0,
    brave: 0,
    legend: 0,
    ultimate: 0
  }
};

export function loadSave(): SaveData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultSave);
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...structuredClone(defaultSave),
      ...parsed,
      storyProgress: {
        ...defaultSave.storyProgress,
        ...(parsed.storyProgress ?? {})
      }
    };
  } catch {
    return structuredClone(defaultSave);
  }
}

export function persistSave(save: SaveData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

export function resetSave(): SaveData {
  const save = structuredClone(defaultSave);
  persistSave(save);
  return save;
}
