export type SceneId = "city" | "forest" | "space";
export type DifficultyId = "normal" | "brave" | "legend" | "ultimate";
export type Pose = "stand" | "attack" | "special" | "hurt";

export interface Hero {
  id: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  cost: number;
  column: number;
  intro: string;
}

export interface Monster {
  id: string;
  name: string;
  hp: number;
  attack: number;
  defense: number;
  stage: number;
  mathBand: number;
  scene: SceneId;
  sheet: "monsters1" | "monsters2" | "monsters3" | "monsters4";
  column: number;
}

export interface Difficulty {
  id: DifficultyId;
  label: string;
  internalLabel: string;
  hpMultiplier: number;
  attackMultiplier: number;
  defenseMultiplier: number;
  rewardMultiplier: number;
  timeBonus: number;
  extraTerms: number;
}

export interface Effect {
  id: string;
  name: string;
  color: number;
  cost: number;
}

export const HEROES: Hero[] = [
  { id: "ultraman", name: "初代奥特曼", hp: 150, attack: 30, defense: 10, cost: 0, column: 0, intro: "均衡" },
  { id: "tiga", name: "迪迦奥特曼", hp: 160, attack: 31, defense: 13, cost: 120, column: 1, intro: "稳健" },
  { id: "zero", name: "赛罗奥特曼", hp: 135, attack: 39, defense: 8, cost: 220, column: 2, intro: "高攻" },
  { id: "mebius", name: "梦比优斯奥特曼", hp: 165, attack: 29, defense: 14, cost: 300, column: 3, intro: "耐久" },
  { id: "orb", name: "欧布奥特曼", hp: 145, attack: 35, defense: 11, cost: 420, column: 4, intro: "爆发" },
  { id: "z", name: "泽塔奥特曼", hp: 155, attack: 42, defense: 12, cost: 560, column: 5, intro: "终盘" }
];

export const MONSTERS: Monster[] = [
  { id: "baltan", name: "巴尔坦星人", hp: 70, attack: 8, defense: 2, stage: 1, mathBand: 1, scene: "city", sheet: "monsters1", column: 0 },
  { id: "dada", name: "达达", hp: 82, attack: 9, defense: 2, stage: 2, mathBand: 1, scene: "city", sheet: "monsters1", column: 1 },
  { id: "redking", name: "雷德王", hp: 96, attack: 11, defense: 3, stage: 3, mathBand: 2, scene: "forest", sheet: "monsters1", column: 2 },
  { id: "eleking", name: "艾雷王", hp: 106, attack: 12, defense: 3, stage: 4, mathBand: 2, scene: "forest", sheet: "monsters1", column: 3 },
  { id: "gomora", name: "哥莫拉", hp: 122, attack: 14, defense: 4, stage: 5, mathBand: 3, scene: "forest", sheet: "monsters1", column: 4 },
  { id: "golza", name: "哥尔赞", hp: 138, attack: 15, defense: 5, stage: 6, mathBand: 3, scene: "city", sheet: "monsters2", column: 0 },
  { id: "melba", name: "美尔巴", hp: 152, attack: 17, defense: 5, stage: 7, mathBand: 4, scene: "forest", sheet: "monsters2", column: 1 },
  { id: "kyrieloid", name: "基里艾洛德人", hp: 166, attack: 18, defense: 6, stage: 8, mathBand: 4, scene: "city", sheet: "monsters2", column: 2 },
  { id: "kingjoe", name: "金古桥", hp: 184, attack: 20, defense: 8, stage: 9, mathBand: 5, scene: "city", sheet: "monsters2", column: 3 },
  { id: "bemstar", name: "贝蒙斯坦", hp: 198, attack: 21, defense: 8, stage: 10, mathBand: 5, scene: "space", sheet: "monsters2", column: 4 },
  { id: "bullton", name: "布鲁顿", hp: 214, attack: 23, defense: 9, stage: 11, mathBand: 6, scene: "space", sheet: "monsters3", column: 0 },
  { id: "pandon", name: "庞敦", hp: 230, attack: 24, defense: 10, stage: 12, mathBand: 6, scene: "city", sheet: "monsters3", column: 1 },
  { id: "zetton", name: "杰顿", hp: 246, attack: 27, defense: 12, stage: 13, mathBand: 7, scene: "space", sheet: "monsters3", column: 2 },
  { id: "tyrant", name: "泰兰特", hp: 264, attack: 29, defense: 13, stage: 14, mathBand: 7, scene: "forest", sheet: "monsters3", column: 3 },
  { id: "hipporit", name: "希波利特星人", hp: 280, attack: 30, defense: 14, stage: 15, mathBand: 7, scene: "city", sheet: "monsters3", column: 4 },
  { id: "empera", name: "安培拉星人", hp: 300, attack: 33, defense: 16, stage: 16, mathBand: 8, scene: "space", sheet: "monsters4", column: 0 },
  { id: "gatanothor", name: "加坦杰厄", hp: 318, attack: 35, defense: 17, stage: 17, mathBand: 8, scene: "space", sheet: "monsters4", column: 1 },
  { id: "darklops", name: "黑暗洛普斯赛罗", hp: 332, attack: 37, defense: 18, stage: 18, mathBand: 8, scene: "city", sheet: "monsters4", column: 2 },
  { id: "greeza", name: "格利扎", hp: 344, attack: 39, defense: 19, stage: 19, mathBand: 8, scene: "space", sheet: "monsters4", column: 3 },
  { id: "leugocyte", name: "鲁格赛特", hp: 360, attack: 41, defense: 20, stage: 20, mathBand: 8, scene: "space", sheet: "monsters4", column: 4 }
];

export const DIFFICULTIES: Difficulty[] = [
  { id: "normal", label: "普通", internalLabel: "普通", hpMultiplier: 1, attackMultiplier: 1, defenseMultiplier: 1, rewardMultiplier: 1, timeBonus: 0.8, extraTerms: 0 },
  { id: "brave", label: "勇敢", internalLabel: "困难", hpMultiplier: 1.25, attackMultiplier: 1.2, defenseMultiplier: 1.1, rewardMultiplier: 1.5, timeBonus: -0.4, extraTerms: 0 },
  { id: "legend", label: "传说", internalLabel: "噩梦", hpMultiplier: 1.6, attackMultiplier: 1.45, defenseMultiplier: 1.25, rewardMultiplier: 2.2, timeBonus: -1.1, extraTerms: 1 },
  { id: "ultimate", label: "终极", internalLabel: "地狱", hpMultiplier: 2, attackMultiplier: 1.8, defenseMultiplier: 1.45, rewardMultiplier: 3.2, timeBonus: -1.8, extraTerms: 1 }
];

export const EFFECTS: Effect[] = [
  { id: "blue", name: "蓝色光线", color: 0x5fd4ff, cost: 0 },
  { id: "gold", name: "金色光线", color: 0xffd24f, cost: 80 },
  { id: "red", name: "红色光线", color: 0xff5b4b, cost: 140 },
  { id: "violet", name: "紫色光线", color: 0xc078ff, cost: 220 },
  { id: "rainbow", name: "彩虹光线", color: 0xffffff, cost: 360 }
];

export function findHero(id: string): Hero {
  const hero = HEROES.find((item) => item.id === id);
  if (!hero) throw new Error(`Unknown hero: ${id}`);
  return hero;
}

export function findMonster(id: string): Monster {
  const monster = MONSTERS.find((item) => item.id === id);
  if (!monster) throw new Error(`Unknown monster: ${id}`);
  return monster;
}

export function findDifficulty(id: DifficultyId): Difficulty {
  const difficulty = DIFFICULTIES.find((item) => item.id === id);
  if (!difficulty) throw new Error(`Unknown difficulty: ${id}`);
  return difficulty;
}

export function findEffect(id: string): Effect {
  const effect = EFFECTS.find((item) => item.id === id);
  if (!effect) throw new Error(`Unknown effect: ${id}`);
  return effect;
}

export function poseRow(pose: Pose): number {
  switch (pose) {
    case "stand":
      return 0;
    case "attack":
      return 1;
    case "special":
      return 2;
    case "hurt":
      return 3;
  }
}
