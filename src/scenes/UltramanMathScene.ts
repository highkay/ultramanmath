import Phaser from "phaser";
import {
  DIFFICULTIES,
  EFFECTS,
  HEROES,
  MONSTERS,
  type Difficulty,
  type DifficultyId,
  type Effect,
  type Hero,
  type Monster,
  type Pose,
  findDifficulty,
  findEffect,
  findHero,
  poseRow
} from "../game/data";
import { generateProblem, type Problem } from "../game/math";
import { type SaveData, loadSave, persistSave, resetSave } from "../game/storage";

type BattleMode = "story" | "challenge";

interface BattleConfig {
  mode: BattleMode;
  heroId: string;
  monsterId: string;
  difficultyId: DifficultyId;
}

interface BattleRuntime {
  config: BattleConfig;
  hero: Hero;
  monster: Monster;
  difficulty: Difficulty;
  effect: Effect;
  heroHp: number;
  monsterHp: number;
  monsterScaledHp: number;
  heroSprite: Phaser.GameObjects.Image;
  monsterSprite: Phaser.GameObjects.Image;
  heroHpBar: Phaser.GameObjects.Rectangle;
  monsterHpBar: Phaser.GameObjects.Rectangle;
  questionText: Phaser.GameObjects.Text;
  answerText: Phaser.GameObjects.Text;
  timerBar: Phaser.GameObjects.Rectangle;
  timerBarGlow: Phaser.GameObjects.Rectangle;
  timerBarLead: Phaser.GameObjects.Arc;
  comboStars: Phaser.GameObjects.Star[];
  comboStarGlows: Phaser.GameObjects.Star[];
  statusText: Phaser.GameObjects.Text;
  problem: Problem;
  typed: string;
  streak: number;
  accepting: boolean;
  problemStart: number;
}

interface FrameAnchor {
  x: number;
  y: number;
}

interface AlphaBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  count: number;
  sumX: number;
}

interface FrameMetrics {
  anchor: FrameAnchor;
  visualHeight: number;
}

interface FrameExtraction {
  canvas: HTMLCanvasElement;
  metrics: FrameMetrics;
}

interface AlphaComponent extends AlphaBounds {
  pixels: number[];
}

interface BeamPoint {
  x: number;
  y: number;
}

type MusicKey = "themeMusic" | "battleMusic";
type SfxKey =
  | "clickSfx"
  | "confirmSfx"
  | "hitSfx"
  | "blastSfx"
  | "winSfx"
  | "failSfx"
  | "heroAttackVoice"
  | "heroSpecialVoice"
  | "heroHurtVoice"
  | "heroWinVoice"
  | "monsterAttackVoice"
  | "monsterDefeatVoice"
  | "monsterWinVoice";

const WIDTH = 960;
const HEIGHT = 540;
const HERO_COLUMNS = 6;
const MONSTER_COLUMNS = 5;
const POSE_ROWS = 4;
const HERO_ATLAS_KEY = "heroesAtlas";
const UI_KIT_KEY = "uiKit";
const MONSTER_ATLAS_KEYS: Record<Monster["sheet"], string> = {
  monsters1: "monsters1Atlas",
  monsters2: "monsters2Atlas",
  monsters3: "monsters3Atlas",
  monsters4: "monsters4Atlas"
};
const DIFFICULTY_ORDER: DifficultyId[] = ["normal", "brave", "legend", "ultimate"];
const HERO_IMPACT_DELAY = 560;
const MONSTER_IMPACT_DELAY = 500;
const NEXT_AFTER_ATTACK_DELAY = 1120;
const SPECIAL_IMPACT_DELAY = 1180;
const NEXT_AFTER_SPECIAL_DELAY = 2450;
const NEXT_AFTER_MONSTER_ATTACK_DELAY = 980;
const DEFEAT_RESULT_DELAY = 1700;
const SPECIAL_DEFEAT_RESULT_DELAY = 2600;
const MUTE_STORAGE_KEY = "ultramanmath-muted";
const BATTLE_TIMER_WIDTH = 300;
const BATTLE_TIMER_LEFT = WIDTH / 2 - BATTLE_TIMER_WIDTH / 2;
const BATTLE_TIMER_Y = 286;

export class UltramanMathScene extends Phaser.Scene {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private save!: SaveData;
  private selectedHeroId = "ultraman";
  private selectedDifficultyId: DifficultyId = "normal";
  private selectedMonsterId = MONSTERS[0].id;
  private battle?: BattleRuntime;
  private parallaxObjects: Phaser.GameObjects.GameObject[] = [];
  private currentMusic?: Phaser.Sound.BaseSound;
  private currentMusicKey?: MusicKey;
  private pendingMusicKey?: MusicKey;
  private waitingForAudioUnlock = false;
  private muted = false;

  constructor() {
    super("ultramanmath");
  }

  preload(): void {
    this.load.image("backgrounds", "/assets/generated/battle-backgrounds.png");
    this.load.image(UI_KIT_KEY, "/assets/generated/ui/ui-kit.png");
    this.load.image(HERO_ATLAS_KEY, "/assets/generated/transparent/heroes-clean.png");
    this.load.image(MONSTER_ATLAS_KEYS.monsters1, "/assets/generated/transparent/monsters-01-clean.png");
    this.load.image(MONSTER_ATLAS_KEYS.monsters2, "/assets/generated/transparent/monsters-02-clean.png");
    this.load.image(MONSTER_ATLAS_KEYS.monsters3, "/assets/generated/transparent/monsters-03-clean.png");
    this.load.image(MONSTER_ATLAS_KEYS.monsters4, "/assets/generated/transparent/monsters-04-clean.png");
    this.load.audio("themeMusic", "/assets/audio/theme.mp3");
    this.load.audio("battleMusic", "/assets/audio/battle.mp3");
    this.load.audio("clickSfx", "/assets/audio/click.mp3");
    this.load.audio("confirmSfx", "/assets/audio/confirm.mp3");
    this.load.audio("hitSfx", "/assets/audio/hit.mp3");
    this.load.audio("blastSfx", "/assets/audio/blast.mp3");
    this.load.audio("winSfx", "/assets/audio/win.mp3");
    this.load.audio("failSfx", "/assets/audio/fail.mp3");
    this.load.audio("heroAttackVoice", "/assets/audio/voices/voice-hero-attack.mp3");
    this.load.audio("heroSpecialVoice", "/assets/audio/voices/voice-hero-special.mp3");
    this.load.audio("heroHurtVoice", "/assets/audio/voices/voice-hero-hurt.mp3");
    this.load.audio("heroWinVoice", "/assets/audio/voices/voice-hero-win.mp3");
    this.load.audio("monsterAttackVoice", "/assets/audio/voices/voice-monster-attack.mp3");
    this.load.audio("monsterDefeatVoice", "/assets/audio/voices/voice-monster-defeat.mp3");
    this.load.audio("monsterWinVoice", "/assets/audio/voices/voice-monster-win.mp3");
  }

  create(): void {
    this.buildCharacterTextures();
    this.registerUiFrames();
    this.save = loadSave();
    this.muted = window.localStorage.getItem(MUTE_STORAGE_KEY) === "1";
    this.selectedHeroId = this.save.unlockedHeroes[0] ?? "ultraman";
    this.selectedDifficultyId = this.save.unlockedDifficulties[0] ?? "normal";
    this.showHome();
  }

  update(time: number): void {
    for (const [index, item] of this.parallaxObjects.entries()) {
      if ("x" in item && typeof item.x === "number") {
        item.x = (item.x - (index + 1) * 0.08) % WIDTH;
      }
    }

    if (!this.battle || !this.battle.accepting) return;
    const elapsed = (time - this.battle.problemStart) / 1000;
    const remaining = Phaser.Math.Clamp(1 - elapsed / this.battle.problem.timeLimit, 0, 1);
    this.updateTimerBar(remaining);
    if (remaining <= 0) {
      this.failProblem("超时");
    }
  }

  private clearScreen(): void {
    this.battle = undefined;
    this.parallaxObjects = [];
    for (const object of this.objects) object.destroy();
    this.objects = [];
    this.tweens.killAll();
    this.time.removeAllEvents();
  }

  private addObject<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.objects.push(object);
    return object;
  }

  private showHome(): void {
    this.clearScreen();
    this.drawMenuBackground();
    this.title("奥特曼算术战斗", 82);
    this.label(`光之能量  ${this.save.energy}`, 790, 40, 28, "#ffe071");

    this.button(260, 190, 260, 78, "故事模式", () => this.showStory(), 34, 0x1478d4);
    this.button(500, 190, 260, 78, "挑战模式", () => this.showChallengeHero(), 34, 0xe0633f);
    this.button(260, 300, 260, 78, "商店", () => this.showShop("heroes"), 34, 0x21a878);
    this.button(500, 300, 260, 78, "设置", () => this.showSettings(), 34, 0x7456d8);

    this.label("点数字，答对就自动发射光线", WIDTH / 2, 455, 30, "#ffffff");
  }

  private showStory(): void {
    this.clearScreen();
    this.drawMenuBackground();
    this.header("故事模式", () => this.showHome());

    this.label("选择奥特曼", 304, 104, 24, "#d8f2ff");
    this.drawHeroGrid(48, 126, (hero) => {
      this.selectedHeroId = hero.id;
      this.showStory();
    });

    this.label("难度", 770, 104, 24, "#d8f2ff");
    this.drawDifficultyButtons(654, 126, (difficulty) => {
      this.selectedDifficultyId = difficulty.id;
      this.showStory();
    });

    const difficulty = findDifficulty(this.selectedDifficultyId);
    const progress = this.save.storyProgress[this.selectedDifficultyId] ?? 0;
    const monster = MONSTERS[Math.min(progress, MONSTERS.length - 1)];
    const finished = progress >= MONSTERS.length;

    this.panel(626, 360, 296, 88, 0x071827, 0.86);
    this.label(finished ? "本难度已通关" : `第 ${monster.stage} 关`, 774, 384, 22, "#ffe071");
    this.label(finished ? "挑战更高难度" : monster.name, 774, 420, 28, "#ffffff");

    if (!finished) {
      this.button(650, 462, 248, 56, "开始战斗", () => {
        this.startBattle({
          mode: "story",
          heroId: this.selectedHeroId,
          monsterId: monster.id,
          difficultyId: this.selectedDifficultyId
        });
      }, 30, 0xffb02e);
    }
  }

  private showChallengeHero(): void {
    this.clearScreen();
    this.drawMenuBackground();
    this.header("选择奥特曼", () => this.showHome());
    this.drawHeroGrid(90, 130, (hero) => {
      this.selectedHeroId = hero.id;
      this.showChallengeMonster();
    }, true);
  }

  private showChallengeMonster(): void {
    this.clearScreen();
    this.drawMenuBackground();
    this.header("选择怪兽", () => this.showChallengeHero());

    const startX = 70;
    const startY = 100;
    const gapX = 176;
    const gapY = 78;
    MONSTERS.forEach((monster, index) => {
      const x = startX + (index % 5) * gapX;
      const y = startY + Math.floor(index / 5) * gapY;
      const unlocked = monster.stage <= Math.max(1, this.save.storyProgress.normal + 1);
      this.button(x, y, 152, 54, unlocked ? monster.name : `第${monster.stage}关`, () => {
        if (!unlocked) return;
        this.selectedMonsterId = monster.id;
        this.showChallengeDifficulty();
      }, 19, unlocked ? 0x1f6eb3 : 0x526070);
    });
  }

  private showChallengeDifficulty(): void {
    this.clearScreen();
    this.drawMenuBackground();
    this.header("选择难度", () => this.showChallengeMonster());
    const monster = MONSTERS.find((item) => item.id === this.selectedMonsterId) ?? MONSTERS[0];
    this.label(`${findHero(this.selectedHeroId).name}  VS  ${monster.name}`, WIDTH / 2, 145, 32, "#fff4bf");

    this.drawDifficultyButtons(190, 215, (difficulty) => {
      this.startBattle({
        mode: "challenge",
        heroId: this.selectedHeroId,
        monsterId: monster.id,
        difficultyId: difficulty.id
      });
    }, true);
  }

  private showShop(tab: "heroes" | "effects"): void {
    this.clearScreen();
    this.drawMenuBackground();
    this.header("商店", () => this.showHome());
    this.label(`光之能量  ${this.save.energy}`, 760, 86, 28, "#ffe071");
    this.button(95, 92, 180, 54, "奥特曼", () => this.showShop("heroes"), 25, tab === "heroes" ? 0xffb02e : 0x245674);
    this.button(290, 92, 180, 54, "光线", () => this.showShop("effects"), 25, tab === "effects" ? 0xffb02e : 0x245674);

    if (tab === "heroes") {
      HEROES.forEach((hero, index) => {
        const x = 54 + (index % 3) * 306;
        const y = 158 + Math.floor(index / 3) * 148;
        const owned = this.save.unlockedHeroes.includes(hero.id);
        this.panel(x, y, 286, 138, owned ? 0x102b3e : 0x1b2530, 0.9);
        this.addObject(this.add.image(x + 48, y + 128, this.heroTextureKey(hero, "stand")).setOrigin(0.5, 1).setScale(0.34));
        this.label(hero.name, x + 168, y + 24, 23, "#ffffff");
        this.drawStatStars(x + 102, y + 50, "攻", this.heroStatStars(hero, "attack"), owned);
        this.drawStatStars(x + 102, y + 72, "防", this.heroStatStars(hero, "defense"), owned);
        this.drawStatStars(x + 102, y + 94, "血", this.heroStatStars(hero, "hp"), owned);
        const label = owned ? "已拥有" : `${hero.cost} 兑换`;
        this.button(x + 174, y + 104, 108, 32, label, () => this.buyHero(hero), 16, owned ? 0x526070 : 0x21a878);
      });
    } else {
      EFFECTS.forEach((effect, index) => {
        const x = 82 + (index % 5) * 178;
        const y = 190 + Math.floor(index / 5) * 130;
        const owned = this.save.unlockedEffects.includes(effect.id);
        const selected = this.save.selectedEffect === effect.id;
        this.panel(x, y, 150, 110, selected ? 0x314a18 : 0x102b3e, 0.92);
        this.addObject(this.add.circle(x + 75, y + 32, 18, effect.color));
        this.label(effect.name, x + 75, y + 64, 18, "#ffffff");
        this.button(x + 20, y + 78, 110, 36, owned ? (selected ? "使用中" : "使用") : `${effect.cost}`, () => this.buyOrSelectEffect(effect), 17, owned ? 0x526070 : 0x21a878);
      });
    }
  }

  private showSettings(): void {
    this.clearScreen();
    this.drawMenuBackground();
    this.header("设置", () => this.showHome());
    this.label("存档只保存在这台手机/浏览器", WIDTH / 2, 160, 30, "#ffffff");
    this.button(330, 240, 300, 70, "重置存档", () => {
      this.save = resetSave();
      this.showHome();
    }, 30, 0xb63a3a);
  }

  private startBattle(config: BattleConfig): void {
    this.clearScreen();
    const hero = findHero(config.heroId);
    const monster = MONSTERS.find((item) => item.id === config.monsterId) ?? MONSTERS[0];
    const difficulty = findDifficulty(config.difficultyId);
    const effect = findEffect(this.save.selectedEffect);

    this.drawBattleBackground(monster);
    const monsterScaledHp = Math.round(monster.hp * difficulty.hpMultiplier);
    const heroSprite = this.addObject(this.add.image(210, 494, this.heroTextureKey(hero, "stand")).setOrigin(0.5, 1).setScale(1.36));
    heroSprite.setFlipX(true);
    const monsterSprite = this.addObject(this.add.image(750, 471, this.monsterTextureKey(monster, "stand")).setOrigin(0.5, 1).setScale(1.22));
    monsterSprite.setFlipX(true);
    this.startBreathing(heroSprite, 7, 1250);
    this.startBreathing(monsterSprite, 5, 1420);

    const heroHpBar = this.healthBar(92, 78, 310, 22, 0x54d76b);
    const monsterHpBar = this.healthBar(560, 78, 310, 22, 0xff665d);
    const questionText = this.label("", WIDTH / 2, 156, 78, "#ffffff");
    const answerText = this.label("", WIDTH / 2, 236, 52, "#ffe071");
    this.addObject(this.add.rectangle(WIDTH / 2, BATTLE_TIMER_Y, BATTLE_TIMER_WIDTH + 28, 24, 0x03101d, 0.86)).setStrokeStyle(2, 0xa7f0ff, 0.56);
    this.addObject(this.add.rectangle(BATTLE_TIMER_LEFT, BATTLE_TIMER_Y, BATTLE_TIMER_WIDTH, 12, 0x020811, 0.94).setOrigin(0, 0.5));
    const timerBarGlow = this.addObject(this.add.rectangle(BATTLE_TIMER_LEFT, BATTLE_TIMER_Y, BATTLE_TIMER_WIDTH, 22, 0x5fd4ff, 0.24).setOrigin(0, 0.5));
    timerBarGlow.setBlendMode(Phaser.BlendModes.ADD);
    const timerBar = this.addObject(this.add.rectangle(BATTLE_TIMER_LEFT, BATTLE_TIMER_Y, BATTLE_TIMER_WIDTH, 12, 0x5fd4ff, 0.96).setOrigin(0, 0.5));
    const timerBarLead = this.addObject(this.add.circle(BATTLE_TIMER_LEFT + BATTLE_TIMER_WIDTH, BATTLE_TIMER_Y, 8, 0xffffff, 0.94));
    timerBarLead.setStrokeStyle(3, 0x5fd4ff, 0.82);
    timerBarLead.setBlendMode(Phaser.BlendModes.ADD);
    for (let index = 1; index < 5; index += 1) {
      this.addObject(this.add.rectangle(BATTLE_TIMER_LEFT + index * (BATTLE_TIMER_WIDTH / 5), BATTLE_TIMER_Y, 2, 16, 0xffffff, 0.2));
    }
    const { stars: comboStars, glows: comboStarGlows } = this.createComboStars(WIDTH / 2, 326);
    const statusText = this.label("", WIDTH / 2, 360, 28, "#ffffff");

    this.battle = {
      config,
      hero,
      monster,
      difficulty,
      effect,
      heroHp: hero.hp,
      monsterHp: monsterScaledHp,
      monsterScaledHp,
      heroSprite,
      monsterSprite,
      heroHpBar,
      monsterHpBar,
      questionText,
      answerText,
      timerBar,
      timerBarGlow,
      timerBarLead,
      comboStars,
      comboStarGlows,
      statusText,
      problem: generateProblem(monster, difficulty),
      typed: "",
      streak: 0,
      accepting: false,
      problemStart: 0
    };

    this.label(hero.name, 210, 38, 24, "#d8f2ff");
    this.label(monster.name, 750, 38, 24, "#ffd6cf");
    this.label(difficulty.label, WIDTH / 2, 42, 28, "#ffe071");
    this.drawNumberPad();
    this.nextProblem();
  }

  private nextProblem(): void {
    if (!this.battle) return;
    this.battle.problem = generateProblem(this.battle.monster, this.battle.difficulty);
    this.battle.typed = "";
    this.battle.accepting = true;
    this.battle.problemStart = this.time.now;
    this.battle.questionText.text = this.battle.problem.expression;
    this.battle.answerText.text = this.answerSlots();
    this.battle.statusText.text = "";
    this.updateComboStars(this.battle.streak);
    this.updateTimerBar(1);
    this.setPose("hero", "stand");
    this.setPose("monster", "stand");
  }

  private updateTimerBar(remaining: number): void {
    if (!this.battle) return;
    const width = BATTLE_TIMER_WIDTH * remaining;
    const dangerPulse = remaining < 0.22 ? 0.18 + Math.sin(this.time.now * 0.026) * 0.12 : 0;
    const color = remaining > 0.46 ? 0x5fd4ff : remaining > 0.22 ? 0xffd24f : 0xff5b4b;
    this.battle.timerBar.width = width;
    this.battle.timerBarGlow.width = width;
    this.battle.timerBar.setFillStyle(color, remaining > 0 ? 0.98 : 0);
    this.battle.timerBarGlow.setFillStyle(color, remaining > 0 ? 0.24 + dangerPulse : 0);
    this.battle.timerBarLead.x = BATTLE_TIMER_LEFT + width;
    this.battle.timerBarLead.setVisible(remaining > 0);
    this.battle.timerBarLead.setFillStyle(remaining < 0.22 ? 0xfff2a0 : 0xffffff, 0.94);
    this.battle.timerBarLead.setStrokeStyle(3, color, 0.86);
  }

  private createComboStars(centerX: number, y: number): { stars: Phaser.GameObjects.Star[]; glows: Phaser.GameObjects.Star[] } {
    const stars: Phaser.GameObjects.Star[] = [];
    const glows: Phaser.GameObjects.Star[] = [];
    for (let index = 0; index < 3; index += 1) {
      const x = centerX + (index - 1) * 44;
      const glow = this.addObject(this.add.star(x, y, 5, 9, 24, 0xfff2a0, 0.1));
      glow.setBlendMode(Phaser.BlendModes.ADD);
      glow.setScale(0.88);
      const star = this.addObject(this.add.star(x, y, 5, 8, 18, 0x25334c, 0.62));
      star.setStrokeStyle(2, 0xaed8ff, 0.38);
      stars.push(star);
      glows.push(glow);
    }
    return { stars, glows };
  }

  private updateComboStars(count: number, animate = false): void {
    if (!this.battle) return;
    this.battle.comboStars.forEach((star, index) => {
      const glow = this.battle?.comboStarGlows[index];
      if (!glow) return;
      const filled = index < count;
      star.setFillStyle(filled ? 0xffdf54 : 0x25334c, filled ? 0.98 : 0.62);
      star.setStrokeStyle(filled ? 3 : 2, filled ? 0xffffff : 0xaed8ff, filled ? 0.86 : 0.38);
      star.setScale(filled ? 1 : 0.86);
      glow.setAlpha(filled ? 0.54 : 0.1);
      glow.setScale(filled ? 1.1 : 0.88);

      const shouldPop = animate && filled && (count >= 3 || index === count - 1);
      if (shouldPop) {
        this.tweens.killTweensOf([star, glow]);
        star.setScale(0.72);
        glow.setScale(0.9);
        this.tweens.add({
          targets: star,
          scale: 1.2,
          duration: 140,
          delay: index * 70,
          yoyo: true,
          ease: "Back.easeOut"
        });
        this.tweens.add({
          targets: glow,
          alpha: 0.88,
          scale: 1.75,
          duration: 190,
          delay: index * 70,
          yoyo: true,
          ease: "Sine.easeOut"
        });
      }
    });
  }

  private drawNumberPad(): void {
    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    const w = 82;
    const gap = 12;
    const startX = (WIDTH - keys.length * w - (keys.length - 1) * gap) / 2;
    keys.forEach((key, index) => {
      this.button(startX + index * (w + gap), 438, w, 78, key, () => this.pressDigit(key), 38, 0x123f75);
    });
  }

  private pressDigit(key: string): void {
    if (!this.battle || !this.battle.accepting) return;
    this.battle.typed += key;
    this.battle.answerText.text = this.answerSlots();
    const expectedLength = String(this.battle.problem.answer).length;
    if (this.battle.typed.length >= expectedLength) {
      const value = Number(this.battle.typed);
      if (value === this.battle.problem.answer) {
        this.solveProblem();
      } else {
        this.failProblem("答错");
      }
    }
  }

  private solveProblem(): void {
    if (!this.battle || !this.battle.accepting) return;
    this.battle.accepting = false;
    const nextStreak = this.battle.streak + 1;
    const special = nextStreak >= 3;
    this.updateComboStars(special ? 3 : nextStreak, true);
    this.battle.streak = special ? 0 : nextStreak;
    this.heroAttack(special);
  }

  private failProblem(reason: string): void {
    if (!this.battle || !this.battle.accepting) return;
    this.battle.accepting = false;
    this.battle.streak = 0;
    this.updateComboStars(0, true);
    this.battle.statusText.text = reason;
    this.monsterAttack();
  }

  private heroAttack(special: boolean): void {
    if (!this.battle) return;
    const damage = this.heroDamage(special);
    this.setPose("hero", special ? "special" : "attack");
    this.battle.statusText.text = special ? this.heroSkillName(this.battle.hero) : "发射！";
    this.playSfx(special ? "blastSfx" : "confirmSfx", special ? 0.75 : 0.48);
    this.playSfx(special ? "heroSpecialVoice" : "heroAttackVoice", special ? 0.82 : 0.64);
    if (special) {
      this.specialMontage(this.heroSkillName(this.battle.hero), this.battle.effect.color);
    }
    this.flashBeam(300, 352, 684, 344, this.battle.effect.color, special);
    this.tweens.add({
      targets: this.battle.heroSprite,
      x: 238,
      yoyo: true,
      duration: 190,
      ease: "Quad.easeOut"
    });
    this.time.delayedCall(special ? SPECIAL_IMPACT_DELAY : HERO_IMPACT_DELAY, () => {
      if (!this.battle) return;
      this.playSfx("hitSfx", special ? 0.78 : 0.58);
      this.setPose("monster", "hurt");
      this.battle.monsterHp = Math.max(0, this.battle.monsterHp - damage);
      this.updateHpBars();
      this.cameraShake(special ? 0.012 : 0.006);
      if (this.battle.monsterHp <= 0) {
        const defeatedMonster = this.battle.monsterSprite;
        this.tweens.killTweensOf(defeatedMonster);
        this.playSfx("monsterDefeatVoice", special ? 0.72 : 0.62);
        this.monsterExplosion(defeatedMonster.x, defeatedMonster.y - 150, special);
        this.tweens.add({
          targets: defeatedMonster,
          alpha: 0,
          scaleX: defeatedMonster.scaleX * 1.12,
          scaleY: defeatedMonster.scaleY * 1.12,
          y: defeatedMonster.y + 18,
          duration: special ? 980 : 760,
          ease: "Quad.easeIn"
        });
        this.time.delayedCall(special ? SPECIAL_DEFEAT_RESULT_DELAY : DEFEAT_RESULT_DELAY, () => this.finishBattle(true));
      } else {
        this.time.delayedCall(special ? NEXT_AFTER_SPECIAL_DELAY : NEXT_AFTER_ATTACK_DELAY, () => this.nextProblem());
      }
    });
  }

  private monsterAttack(): void {
    if (!this.battle) return;
    const damage = this.monsterDamage();
    this.setPose("monster", "attack");
    this.playSfx("monsterAttackVoice", 0.66);
    this.monsterStrikeEffect(658, 286, 315, 288);
    this.tweens.add({
      targets: this.battle.monsterSprite,
      x: 718,
      yoyo: true,
      duration: 190,
      ease: "Quad.easeOut"
    });
    this.time.delayedCall(MONSTER_IMPACT_DELAY, () => {
      if (!this.battle) return;
      this.playSfx("hitSfx", 0.55);
      this.setPose("hero", "hurt");
      this.battle.heroHp = Math.max(0, this.battle.heroHp - damage);
      this.updateHpBars();
      if (this.battle.heroHp > 0) this.playSfx("heroHurtVoice", 0.54);
      this.cameraShake(0.008);
      if (this.battle.heroHp <= 0) {
        this.time.delayedCall(760, () => this.finishBattle(false));
      } else {
        this.time.delayedCall(NEXT_AFTER_MONSTER_ATTACK_DELAY, () => this.nextProblem());
      }
    });
  }

  private finishBattle(won: boolean): void {
    if (!this.battle) return;
    const config = this.battle.config;
    const reward = won ? this.rewardFor(this.battle.monster, this.battle.difficulty) : 0;

    if (won) {
      this.save.energy += reward;
      if (config.mode === "story") {
        const oldProgress = this.save.storyProgress[config.difficultyId] ?? 0;
        const nextProgress = Math.max(oldProgress, this.battle.monster.stage);
        this.save.storyProgress[config.difficultyId] = Math.min(MONSTERS.length, nextProgress);
        if (nextProgress >= MONSTERS.length) this.unlockNextDifficulty(config.difficultyId);
      }
      persistSave(this.save);
    }

    this.playSfx(won ? "winSfx" : "failSfx", 0.72);
    this.playSfx(won ? "heroWinVoice" : "monsterWinVoice", won ? 0.7 : 0.62);
    this.clearScreen();
    this.drawMenuBackground();

    this.panel(150, 102, 660, 330, 0x071827, 0.86);
    const resultArt = this.addObject(this.add.image(WIDTH / 2, 154, UI_KIT_KEY, won ? "result-win" : "result-lose").setDisplaySize(520, 210).setAlpha(0.38));
    resultArt.setDepth(4);
    resultArt.setBlendMode(Phaser.BlendModes.ADD);
    const titleText = won ? "胜利" : "再试一次";
    this.impactText(titleText, WIDTH / 2, 152, won ? 78 : 64, won ? "#fff1a0" : "#ffffff", 2100, 8);
    this.label(titleText, WIDTH / 2, 160, won ? 74 : 58, won ? "#ffe071" : "#ffffff").setDepth(9);
    if (won) {
      this.label(`获得 ${reward} 光之能量`, WIDTH / 2, 280, 34, "#ffe071").setDepth(9);
      this.label("继续向下一关出发", WIDTH / 2, 330, 26, "#d8f2ff").setDepth(9);
    } else {
      this.label("换个简单题再试试", WIDTH / 2, 286, 32, "#ffffff").setDepth(9);
      this.label("答对就能马上反击", WIDTH / 2, 336, 24, "#d8f2ff").setDepth(9);
    }
    this.button(205, 450, 250, 64, won ? "继续" : "重试", () => {
      if (won) {
        config.mode === "story" ? this.showStory() : this.showChallengeMonster();
      } else {
        this.startBattle(config);
      }
    }, 30, 0xffb02e);
    this.button(505, 450, 250, 64, "回主页", () => this.showHome(), 30, 0x1478d4);
  }

  private unlockNextDifficulty(id: DifficultyId): void {
    const index = DIFFICULTY_ORDER.indexOf(id);
    const next = DIFFICULTY_ORDER[index + 1];
    if (next && !this.save.unlockedDifficulties.includes(next)) {
      this.save.unlockedDifficulties.push(next);
    }
  }

  private drawHeroGrid(x: number, y: number, onPick: (hero: Hero) => void, wide = false): void {
    const columns = wide ? 3 : 2;
    const cardW = wide ? 270 : 242;
    const cardH = wide ? 120 : 116;
    const gapX = wide ? 286 : 262;
    const gapY = wide ? 132 : 126;
    const imageX = wide ? 50 : 50;
    const textX = wide ? 162 : 152;
    HEROES.forEach((hero, index) => {
      const owned = this.save.unlockedHeroes.includes(hero.id);
      const col = index % columns;
      const row = Math.floor(index / columns);
      const cardX = x + col * gapX;
      const cardY = y + row * gapY;
      const selected = this.selectedHeroId === hero.id;
      this.panel(cardX, cardY, cardW, cardH, selected ? 0x314a18 : owned ? 0x102b3e : 0x1b2530, 0.92);
      this.addObject(this.add.image(cardX + imageX, cardY + cardH - 8, this.heroTextureKey(hero, "stand")).setOrigin(0.5, 1).setScale(wide ? 0.4 : 0.38));
      this.label(owned ? hero.name : "未解锁", cardX + textX, cardY + 28, wide ? 23 : 21, "#ffffff");
      this.drawStatStars(cardX + textX - 64, cardY + 54, "攻", this.heroStatStars(hero, "attack"), owned);
      this.drawStatStars(cardX + textX - 64, cardY + 78, "防", this.heroStatStars(hero, "defense"), owned);
      this.drawStatStars(cardX + textX - 64, cardY + 102, "血", this.heroStatStars(hero, "hp"), owned);
      this.hit(cardX, cardY, cardW, cardH, () => {
        if (owned) onPick(hero);
      });
    });
  }

  private heroStatStars(hero: Hero, stat: "hp" | "attack" | "defense"): number {
    const values = HEROES.map((item) => item[stat]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max === min) return 3;
    return Phaser.Math.Clamp(Math.round(1 + ((hero[stat] - min) / (max - min)) * 4), 1, 5);
  }

  private drawStatStars(x: number, y: number, label: string, rating: number, enabled: boolean): void {
    this.addObject(this.add.text(x, y, label, {
      fontFamily: "Microsoft YaHei, PingFang SC, sans-serif",
      fontSize: "16px",
      fontStyle: "bold",
      color: enabled ? "#d8f2ff" : "#84919d",
      align: "center",
      fixedWidth: 22,
      stroke: "#07121f",
      strokeThickness: 2
    }).setOrigin(0, 0.5));

    for (let index = 0; index < 5; index += 1) {
      this.drawStarIcon(x + 31 + index * 19, y, 17, index < rating, enabled);
    }
  }

  private drawStarIcon(x: number, y: number, size: number, active: boolean, enabled: boolean): void {
    const star = this.addObject(this.add.graphics());
    const alpha = enabled ? (active ? 0.96 : 0.28) : 0.2;
    const fill = active && enabled ? 0xffd24f : 0x65717d;
    const stroke = active && enabled ? 0xffffff : 0x9aa7b2;
    if (active && enabled) {
      star.setBlendMode(Phaser.BlendModes.ADD);
      star.fillStyle(0xffd24f, 0.2);
      star.fillCircle(x, y, size * 0.62);
    }

    const outer = size * 0.5;
    const inner = size * 0.22;
    const points: { x: number; y: number }[] = [];
    for (let index = 0; index < 10; index += 1) {
      const angle = -Math.PI / 2 + (index * Math.PI) / 5;
      const radius = index % 2 === 0 ? outer : inner;
      points.push({
        x: x + Math.cos(angle) * radius,
        y: y + Math.sin(angle) * radius
      });
    }

    star.fillStyle(fill, alpha);
    star.lineStyle(1.4, stroke, enabled ? (active ? 0.64 : 0.24) : 0.18);
    star.beginPath();
    star.moveTo(points[0].x, points[0].y);
    for (const point of points.slice(1)) {
      star.lineTo(point.x, point.y);
    }
    star.closePath();
    star.fillPath();
    star.strokePath();
  }

  private drawDifficultyButtons(x: number, y: number, onPick: (difficulty: Difficulty) => void, wide = false): void {
    DIFFICULTIES.forEach((difficulty, index) => {
      const unlocked = this.save.unlockedDifficulties.includes(difficulty.id);
      const selected = this.selectedDifficultyId === difficulty.id;
      const buttonX = x + (wide ? index * 178 : 0);
      const buttonY = y + (wide ? 0 : index * 58);
      this.button(buttonX, buttonY, wide ? 158 : 220, wide ? 58 : 48, unlocked ? difficulty.label : "未解锁", () => {
        if (!unlocked) return;
        this.selectedDifficultyId = difficulty.id;
        onPick(difficulty);
      }, wide ? 24 : 23, selected ? 0xffb02e : unlocked ? 0x245674 : 0x526070);
    });
  }

  private buyHero(hero: Hero): void {
    if (this.save.unlockedHeroes.includes(hero.id)) return;
    if (this.save.energy < hero.cost) return;
    this.save.energy -= hero.cost;
    this.save.unlockedHeroes.push(hero.id);
    persistSave(this.save);
    this.showShop("heroes");
  }

  private buyOrSelectEffect(effect: Effect): void {
    const owned = this.save.unlockedEffects.includes(effect.id);
    if (!owned) {
      if (this.save.energy < effect.cost) return;
      this.save.energy -= effect.cost;
      this.save.unlockedEffects.push(effect.id);
    }
    this.save.selectedEffect = effect.id;
    persistSave(this.save);
    this.showShop("effects");
  }

  private setPose(side: "hero" | "monster", pose: "stand" | "attack" | "special" | "hurt"): void {
    if (!this.battle) return;
    if (side === "hero") {
      this.battle.heroSprite.setTexture(this.heroTextureKey(this.battle.hero, pose));
    } else {
      this.battle.monsterSprite.setTexture(this.monsterTextureKey(this.battle.monster, pose));
    }
  }

  private buildCharacterTextures(): void {
    this.sliceAtlas(HERO_ATLAS_KEY, "hero", HERO_COLUMNS, POSE_ROWS);
    (Object.keys(MONSTER_ATLAS_KEYS) as Monster["sheet"][]).forEach((sheet) => {
      this.sliceAtlas(MONSTER_ATLAS_KEYS[sheet], sheet, MONSTER_COLUMNS, POSE_ROWS);
    });
  }

  private registerUiFrames(): void {
    const texture = this.textures.get(UI_KIT_KEY);
    const add = (name: string, x: number, y: number, w: number, h: number) => {
      texture.add(name, 0, x, y, w, h);
    };

    add("title-frame", 52, 28, 920, 330);
    add("button-red", 46, 394, 215, 76);
    add("button-blue", 288, 394, 215, 76);
    add("button-green", 530, 394, 215, 76);
    add("button-gold", 772, 394, 215, 76);
    add("digit-1", 64, 520, 112, 108);
    add("digit-2", 185, 520, 112, 108);
    add("digit-3", 306, 520, 112, 108);
    add("digit-4", 427, 520, 112, 108);
    add("digit-5", 548, 520, 112, 108);
    add("digit-6", 64, 642, 112, 108);
    add("digit-7", 185, 642, 112, 108);
    add("digit-8", 306, 642, 112, 108);
    add("digit-9", 427, 642, 112, 108);
    add("digit-0", 548, 642, 112, 108);
    add("energy-crystal", 785, 525, 190, 220);
    add("result-win", 46, 766, 455, 260);
    add("result-lose", 525, 766, 455, 260);
    add("slash-red", 58, 1080, 200, 94);
    add("slash-blue", 286, 1080, 200, 94);
    add("slash-gold", 526, 1080, 200, 94);
    add("slash-purple", 760, 1080, 200, 94);
    add("spark-gold", 56, 1202, 80, 70);
    add("spark-blue", 148, 1202, 80, 70);
    add("spark-red", 236, 1202, 80, 70);
    add("ring-blue", 740, 1190, 90, 90);
    add("ring-gold", 835, 1190, 90, 90);
    add("ring-red", 932, 1190, 90, 90);
    add("click-gold", 56, 1322, 140, 165);
    add("click-blue", 255, 1322, 140, 165);
    add("click-red", 455, 1322, 140, 165);
    add("click-green", 655, 1322, 140, 165);
    add("click-purple", 835, 1322, 140, 165);
  }

  private sliceAtlas(atlasKey: string, outputPrefix: string, columns: number, rows: number): void {
    const source = this.textures.get(atlasKey).getSourceImage() as CanvasImageSource;
    const { width, height } = this.sourceSize(source);
    const cellWidth = Math.ceil(width / columns);
    const cellHeight = Math.ceil(height / rows);
    const outputWidth = cellWidth + 64;
    const outputHeight = cellHeight + 64;
    const groundX = outputWidth / 2;
    const groundY = outputHeight - 12;
    const frameExtractions = new Map<string, FrameExtraction>();

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const bounds = this.sourceCellBounds(width, height, columns, rows, column, row);
        const extraction = this.extractFrame(source, bounds.x, bounds.y, bounds.width, bounds.height, cellWidth, cellHeight);
        frameExtractions.set(this.frameTextureKey(outputPrefix, row, column), extraction);
      }
    }

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const key = this.frameTextureKey(outputPrefix, row, column);
        if (this.textures.exists(key)) this.textures.remove(key);
        const extraction = frameExtractions.get(key);
        const metrics = extraction?.metrics ?? { anchor: { x: cellWidth / 2, y: cellHeight }, visualHeight: cellHeight };
        const dx = Math.round(groundX - metrics.anchor.x);
        const dy = Math.round(groundY - metrics.anchor.y);
        const canvasTexture = this.textures.createCanvas(key, outputWidth, outputHeight);
        if (!canvasTexture) continue;
        const context = canvasTexture.getContext();
        context.clearRect(0, 0, outputWidth, outputHeight);
        if (extraction) context.drawImage(extraction.canvas, dx, dy);
        canvasTexture.refresh();
      }
    }
  }

  private sourceCellBounds(
    sourceWidth: number,
    sourceHeight: number,
    columns: number,
    rows: number,
    column: number,
    row: number
  ): { x: number; y: number; width: number; height: number } {
    const x = Math.round((column * sourceWidth) / columns);
    const y = Math.round((row * sourceHeight) / rows);
    const right = Math.round(((column + 1) * sourceWidth) / columns);
    const bottom = Math.round(((row + 1) * sourceHeight) / rows);
    return { x, y, width: right - x, height: bottom - y };
  }

  private extractFrame(
    source: CanvasImageSource,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    outputWidth: number,
    outputHeight: number
  ): FrameExtraction {
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) {
      return {
        canvas,
        metrics: { anchor: { x: outputWidth / 2, y: outputHeight }, visualHeight: outputHeight }
      };
    }

    context.clearRect(0, 0, outputWidth, outputHeight);
    context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
    const imageData = this.keepPrimaryFrameComponents(context.getImageData(0, 0, outputWidth, outputHeight), outputWidth, outputHeight);
    context.putImageData(imageData, 0, 0);
    const full = this.alphaBounds(imageData, outputWidth, outputHeight, 0, 0, outputWidth);
    if (!full) {
      return {
        canvas,
        metrics: { anchor: { x: outputWidth / 2, y: outputHeight }, visualHeight: outputHeight }
      };
    }

    const lower = this.alphaBounds(imageData, outputWidth, outputHeight, Math.floor(outputHeight * 0.46), 0, outputWidth);
    const body = lower && lower.count > full.count * 0.12 ? lower : full;
    const bodyCenterX = body.sumX / body.count;

    return {
      canvas,
      metrics: {
        anchor: {
          x: bodyCenterX,
          y: full.bottom
        },
        visualHeight: Math.max(48, full.bottom - full.top)
      }
    };
  }

  private keepPrimaryFrameComponents(imageData: ImageData, width: number, height: number): ImageData {
    const components = this.findAlphaComponents(imageData, width, height);
    if (components.length <= 1) return imageData;

    components.sort((a, b) => b.count - a.count);
    const primary = components[0];
    const keepMask = new Uint8Array(width * height);

    for (const component of components) {
      const verticallyOverlapsPrimary = component.bottom > primary.top + 8 && component.top < primary.bottom - 8;
      const edgeOrphan = component.top <= 4 && component.bottom < height * 0.38;
      const horizontalGap =
        component.left > primary.right ? component.left - primary.right : primary.left > component.right ? primary.left - component.right : 0;
      const touchesSideEdge = component.left <= 4 || component.right >= width - 4;
      const sideSpillover = touchesSideEdge && horizontalGap > width * 0.18 && component.count < primary.count * 0.08;
      const largeEnough = component.count >= primary.count * 0.08;
      const closeEnough = component.count >= primary.count * 0.04 && verticallyOverlapsPrimary;
      if (component === primary || (!edgeOrphan && !sideSpillover && (largeEnough || closeEnough))) {
        for (const pixel of component.pixels) keepMask[pixel] = 1;
      }
    }

    const data = imageData.data;
    for (let pixel = 0; pixel < width * height; pixel += 1) {
      if (keepMask[pixel]) continue;
      const index = pixel * 4;
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = 0;
    }
    return imageData;
  }

  private findAlphaComponents(imageData: ImageData, width: number, height: number): AlphaComponent[] {
    const data = imageData.data;
    const visited = new Uint8Array(width * height);
    const components: AlphaComponent[] = [];

    for (let start = 0; start < width * height; start += 1) {
      if (visited[start] || data[start * 4 + 3] <= 32) continue;

      const stack = [start];
      const pixels: number[] = [];
      let left = width;
      let right = -1;
      let top = height;
      let bottom = -1;
      let count = 0;
      let sumX = 0;

      visited[start] = 1;
      while (stack.length > 0) {
        const pixel = stack.pop() ?? 0;
        const x = pixel % width;
        const y = Math.floor(pixel / width);
        pixels.push(pixel);
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        count += 1;
        sumX += x;

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const nextY = y + offsetY;
          if (nextY < 0 || nextY >= height) continue;
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) continue;
            const nextX = x + offsetX;
            if (nextX < 0 || nextX >= width) continue;
            const next = nextY * width + nextX;
            if (visited[next] || data[next * 4 + 3] <= 32) continue;
            visited[next] = 1;
            stack.push(next);
          }
        }
      }

      components.push({ left, right: right + 1, top, bottom: bottom + 1, count, sumX, pixels });
    }

    return components;
  }

  private alphaBounds(
    imageData: ImageData,
    width: number,
    height: number,
    minY: number,
    minX: number,
    maxX: number
  ): AlphaBounds | undefined {
    let left = width;
    let right = -1;
    let top = height;
    let bottom = -1;
    let count = 0;
    let sumX = 0;
    const data = imageData.data;

    for (let y = minY; y < height; y += 1) {
      for (let x = minX; x < maxX; x += 1) {
        const alpha = data[(y * width + x) * 4 + 3];
        if (alpha <= 48) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
        count += 1;
        sumX += x;
      }
    }

    if (count === 0) return undefined;
    return { left, right: right + 1, top, bottom: bottom + 1, count, sumX };
  }

  private sourceSize(source: CanvasImageSource): { width: number; height: number } {
    if ("naturalWidth" in source && source.naturalWidth > 0) {
      return { width: source.naturalWidth, height: source.naturalHeight };
    }
    if ("videoWidth" in source && source.videoWidth > 0) {
      return { width: source.videoWidth, height: source.videoHeight };
    }
    return {
      width: Number((source as HTMLCanvasElement).width),
      height: Number((source as HTMLCanvasElement).height)
    };
  }

  private heroTextureKey(hero: Hero, pose: Pose): string {
    return this.frameTextureKey("hero", poseRow(pose), hero.column);
  }

  private monsterTextureKey(monster: Monster, pose: Pose): string {
    return this.frameTextureKey(monster.sheet, poseRow(pose), monster.column);
  }

  private frameTextureKey(prefix: string, row: number, column: number): string {
    return `${prefix}-${row}-${column}`;
  }

  private heroDamage(special: boolean): number {
    if (!this.battle) return 0;
    const defense = Math.round(this.battle.monster.defense * this.battle.difficulty.defenseMultiplier);
    const base = Math.max(8, this.battle.hero.attack - defense);
    return special ? Math.round(base * 3) : base;
  }

  private monsterDamage(): number {
    if (!this.battle) return 0;
    const attack = Math.round(this.battle.monster.attack * this.battle.difficulty.attackMultiplier);
    return Math.max(5, attack - this.battle.hero.defense);
  }

  private rewardFor(monster: Monster, difficulty: Difficulty): number {
    return Math.round((20 + monster.stage * 4) * difficulty.rewardMultiplier);
  }

  private updateHpBars(): void {
    if (!this.battle) return;
    this.battle.heroHpBar.width = 310 * (this.battle.heroHp / this.battle.hero.hp);
    this.battle.monsterHpBar.width = 310 * (this.battle.monsterHp / this.battle.monsterScaledHp);
  }

  private answerSlots(): string {
    if (!this.battle) return "";
    const expected = String(this.battle.problem.answer).length;
    const chars = this.battle.typed.padEnd(expected, "○").split("");
    return chars.join(" ");
  }

  private drawBackgroundPanel(sceneIndex: number, alpha: number): Phaser.GameObjects.Image {
    const texture = this.textures.get("backgrounds").getSourceImage() as HTMLImageElement;
    const panelWidth = texture.width / 3;
    const panelCenter = (sceneIndex + 0.5) * panelWidth;
    const scale = Math.max(WIDTH / panelWidth, HEIGHT / texture.height);
    const imageX = WIDTH / 2 + (texture.width / 2 - panelCenter) * scale;
    return this.addObject(this.add.image(imageX, HEIGHT / 2, "backgrounds").setScale(scale).setAlpha(alpha));
  }

  private drawMenuBackground(): void {
    this.playMusic("themeMusic");
    this.addObject(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x07121f));
    this.drawBackgroundPanel(0, 0.9);
    this.addObject(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x07121f, 0.18));
    const crystal = this.addObject(this.add.image(870, 410, UI_KIT_KEY, "energy-crystal").setDisplaySize(120, 140).setAlpha(0.55));
    this.tweens.add({
      targets: crystal,
      y: 398,
      alpha: 0.78,
      yoyo: true,
      repeat: -1,
      duration: 1500,
      ease: "Sine.easeInOut"
    });
    this.drawMuteButton();
    this.time.delayedCall(0, () => this.transitionIn("menu"));
  }

  private drawBattleBackground(monster: Monster): void {
    this.playMusic("battleMusic");
    const sceneIndex = monster.scene === "city" ? 0 : monster.scene === "forest" ? 1 : 2;
    this.drawBackgroundPanel(sceneIndex, 1);
    this.addObject(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x06111f, 0.12));

    const far = this.addObject(this.add.rectangle(WIDTH / 2, 410, WIDTH, 48, 0xffffff, 0.08));
    const near = this.addObject(this.add.rectangle(WIDTH / 2, 504, WIDTH, 46, 0x050a10, 0.46));
    const sparkLine = this.addObject(this.add.rectangle(WIDTH / 2, 382, WIDTH, 8, 0x7fd8ff, 0.1));
    this.parallaxObjects.push(far, sparkLine, near);
    this.drawMuteButton();
    this.time.delayedCall(0, () => this.transitionIn("battle"));
  }

  private flashBeam(x1: number, y1: number, x2: number, y2: number, color: number, special: boolean): void {
    const length = Phaser.Math.Distance.Between(x1, y1, x2, y2);
    const angle = Phaser.Math.Angle.Between(x1, y1, x2, y2);
    const colors = this.effectPalette(color);
    const depth = special ? 136 : 62;
    const normal = angle + Math.PI / 2;
    const centerX = (x1 + x2) / 2;
    const centerY = (y1 + y2) / 2;
    const fading: Phaser.GameObjects.Rectangle[] = [];
    const addBeamRect = (offset: number, width: number, beamColor: number, alpha: number, itemDepth: number) => {
      const segment = this.addObject(this.add.rectangle(
        centerX + Math.cos(normal) * offset,
        centerY + Math.sin(normal) * offset,
        length * (special ? 1.08 : 1),
        width,
        beamColor,
        alpha
      ));
      segment.setRotation(angle);
      segment.setDepth(itemDepth);
      segment.setBlendMode(Phaser.BlendModes.ADD);
      fading.push(segment);
      return segment;
    };

    addBeamRect(0, special ? 92 : 44, color, special ? 0.16 : 0.2, depth - 2);
    addBeamRect(0, special ? 58 : 30, colors[0], special ? 0.3 : 0.24, depth - 1);
    addBeamRect(0, special ? 26 : 15, color, 0.86, depth);
    addBeamRect(0, special ? 8 : 5, 0xffffff, special ? 0.98 : 0.84, depth + 1);
    if (special) {
      addBeamRect(-23, 10, colors[1], 0.46, depth);
      addBeamRect(23, 10, colors[2] ?? colors[0], 0.38, depth);
      this.emitBeamSpiral({ x: x1, y: y1 }, { x: x2, y: y2 }, colors, depth + 3);
      this.emitCrossSparkles({ x: x1, y: y1 }, { x: x2, y: y2 }, colors, true, depth + 4);
      this.emitRadialBurst(x1, y1, colors, true, depth + 3);
      this.emitRadialBurst(x2, y2, colors, true, depth + 4);
      this.flashRing(x1, y1, color, 38, 1.9, depth + 2);
      this.flashRing(x1, y1, colors[1], 58, 2.25, depth + 2);
      this.flashRing(x2, y2, color, 58, 2.3, depth + 2);
      this.flashRing(x2, y2, colors[2] ?? 0xffffff, 84, 2.9, depth + 2);
    } else {
      this.emitCrossSparkles({ x: x1, y: y1 }, { x: x2, y: y2 }, colors, false, depth + 2);
      this.emitRadialBurst(x2, y2, colors, false, depth + 2);
      this.flashRing(x1, y1, color, 24, 1.42, depth + 1);
      this.flashRing(x2, y2, color, 34, 1.58, depth + 1);
    }
    this.emitBeamParticles({ x: x1, y: y1 }, { x: x2, y: y2 }, colors, special, depth + 2);
    if (special) {
      this.impactText("绝招", WIDTH / 2, 94, 62, "#ffe071", 2100, depth + 5);
    }
    this.tweens.add({
      targets: fading,
      alpha: 0,
      duration: special ? 2350 : 1220,
      onComplete: () => {
        for (const item of fading) item.destroy();
      }
    });
  }

  private emitBeamParticles(start: BeamPoint, end: BeamPoint, colors: number[], special: boolean, depth = 64): void {
    const count = special ? 70 : 28;
    const spread = special ? 54 : 26;
    const angle = Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y);
    const normal = angle + Math.PI / 2;

    for (let index = 0; index < count; index += 1) {
      const t = (index + Phaser.Math.FloatBetween(0.08, 0.92)) / count;
      const baseX = Phaser.Math.Linear(start.x, end.x, t);
      const baseY = Phaser.Math.Linear(start.y, end.y, t);
      const offset = Phaser.Math.FloatBetween(-spread, spread);
      const drift = Phaser.Math.FloatBetween(special ? 18 : 8, special ? 52 : 24);
      const color = colors[index % colors.length];
      const particle = this.addObject(this.add.circle(
        baseX + Math.cos(normal) * offset,
        baseY + Math.sin(normal) * offset,
        Phaser.Math.FloatBetween(special ? 3 : 2, special ? 8 : 5),
        color,
        special ? 0.82 : 0.68
      ));
      particle.setDepth(depth);
      particle.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: particle,
        x: particle.x + Math.cos(angle) * drift,
        y: particle.y + Math.sin(angle) * drift + Phaser.Math.FloatBetween(-10, 10),
        scale: 0,
        alpha: 0,
        duration: Phaser.Math.Between(special ? 900 : 560, special ? 1900 : 1250),
        ease: "Quad.easeOut",
        onComplete: () => particle.destroy()
      });
    }
  }

  private emitBeamSpiral(start: BeamPoint, end: BeamPoint, colors: number[], depth: number): void {
    const count = 56;
    const angle = Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y);
    const normal = angle + Math.PI / 2;
    for (let index = 0; index < count; index += 1) {
      const t = index / (count - 1);
      const baseX = Phaser.Math.Linear(start.x, end.x, t);
      const baseY = Phaser.Math.Linear(start.y, end.y, t);
      const radius = 18 + Math.sin(t * Math.PI) * 34;
      for (const phase of [0, Math.PI]) {
        const offset = Math.sin(t * Math.PI * 7 + phase) * radius;
        const color = colors[(index + (phase === 0 ? 0 : 1)) % colors.length];
        const particle = this.addObject(this.add.circle(
          baseX + Math.cos(normal) * offset,
          baseY + Math.sin(normal) * offset,
          Phaser.Math.FloatBetween(2.5, 6.5),
          color,
          0.86
        ));
        particle.setDepth(depth);
        particle.setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({
          targets: particle,
          x: particle.x + Math.cos(angle) * Phaser.Math.Between(30, 78) + Math.cos(normal) * offset * 0.22,
          y: particle.y + Math.sin(angle) * Phaser.Math.Between(30, 78) + Math.sin(normal) * offset * 0.22,
          scale: 0,
          alpha: 0,
          delay: index * 9,
          duration: Phaser.Math.Between(980, 1850),
          ease: "Quad.easeOut",
          onComplete: () => particle.destroy()
        });
      }
    }
  }

  private emitCrossSparkles(start: BeamPoint, end: BeamPoint, colors: number[], special: boolean, depth: number): void {
    const count = special ? 16 : 7;
    const angle = Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y);
    const normal = angle + Math.PI / 2;
    for (let index = 0; index < count; index += 1) {
      const t = (index + 0.5) / count;
      const offset = Phaser.Math.FloatBetween(special ? -58 : -26, special ? 58 : 26);
      this.crossSparkle(
        Phaser.Math.Linear(start.x, end.x, t) + Math.cos(normal) * offset,
        Phaser.Math.Linear(start.y, end.y, t) + Math.sin(normal) * offset,
        colors[index % colors.length],
        Phaser.Math.Between(special ? 14 : 9, special ? 28 : 17),
        Phaser.Math.Between(special ? 1050 : 620, special ? 1900 : 1150),
        depth,
        angle + Phaser.Math.FloatBetween(-0.8, 0.8)
      );
    }
    this.crossSparkle(end.x, end.y, 0xffffff, special ? 46 : 28, special ? 1650 : 980, depth + 1, angle);
  }

  private crossSparkle(x: number, y: number, color: number, size: number, duration: number, depth: number, rotation: number): void {
    const rays = [
      this.addObject(this.add.rectangle(x, y, size * 1.75, Math.max(2, size * 0.16), color, 0.78)),
      this.addObject(this.add.rectangle(x, y, size * 1.75, Math.max(2, size * 0.16), color, 0.68)),
      this.addObject(this.add.rectangle(x, y, size * 1.05, Math.max(2, size * 0.13), 0xffffff, 0.84)),
      this.addObject(this.add.rectangle(x, y, size * 1.05, Math.max(2, size * 0.13), 0xffffff, 0.72))
    ];
    const rotations = [rotation, rotation + Math.PI / 2, rotation + Math.PI / 4, rotation - Math.PI / 4];
    rays.forEach((ray, index) => {
      ray.setRotation(rotations[index]);
      ray.setDepth(depth);
      ray.setBlendMode(Phaser.BlendModes.ADD);
    });
    this.tweens.add({
      targets: rays,
      alpha: 0,
      scaleX: 1.7,
      scaleY: 0.55,
      duration,
      ease: "Quad.easeOut",
      onComplete: () => {
        for (const ray of rays) ray.destroy();
      }
    });
  }

  private emitRadialBurst(x: number, y: number, colors: number[], special: boolean, depth: number): void {
    const count = special ? 30 : 14;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Phaser.Math.FloatBetween(-0.16, 0.16);
      const distance = Phaser.Math.Between(special ? 44 : 24, special ? 138 : 72);
      const ray = this.addObject(this.add.rectangle(
        x,
        y,
        Phaser.Math.Between(special ? 18 : 10, special ? 42 : 24),
        Phaser.Math.Between(3, special ? 7 : 5),
        colors[index % colors.length],
        special ? 0.82 : 0.66
      ));
      ray.setRotation(angle);
      ray.setDepth(depth);
      ray.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: ray,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        scaleX: 0.2,
        alpha: 0,
        duration: Phaser.Math.Between(special ? 780 : 460, special ? 1600 : 960),
        ease: "Quad.easeOut",
        onComplete: () => ray.destroy()
      });
    }
  }

  private monsterStrikeEffect(x1: number, y1: number, x2: number, y2: number): void {
    const angle = Phaser.Math.Angle.Between(x1, y1, x2, y2);
    const length = Phaser.Math.Distance.Between(x1, y1, x2, y2);
    const normal = angle + Math.PI / 2;

    for (let index = 0; index < 3; index += 1) {
      const offset = (index - 1) * 18;
      const slash = this.addObject(this.add.rectangle(
        (x1 + x2) / 2 + Math.cos(normal) * offset,
        (y1 + y2) / 2 + Math.sin(normal) * offset,
        length * Phaser.Math.FloatBetween(0.72, 0.9),
        index === 1 ? 12 : 8,
        index === 1 ? 0xfff0a0 : 0xff4b38,
        index === 1 ? 0.7 : 0.48
      ));
      slash.setRotation(angle + Phaser.Math.DegToRad(Phaser.Math.Between(-3, 3)));
      this.tweens.add({
        targets: slash,
        alpha: 0,
        scaleX: 0.78,
        duration: 820,
        ease: "Quad.easeOut",
        onComplete: () => slash.destroy()
      });
    }

    this.flashRing(x2, y2, 0xff5b4b, 28, 1.55);
  }

  private flashRing(x: number, y: number, color: number, radius: number, scale: number, depth = 72): void {
    const ring = this.addObject(this.add.circle(x, y, radius, color, 0));
    ring.setDepth(depth);
    ring.setStrokeStyle(4, color, 0.76);
    this.tweens.add({
      targets: ring,
      scale,
      alpha: 0,
      duration: 900,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  private effectPalette(color: number): number[] {
    if (color !== 0xffffff) return [color, 0xffffff];
    return [0x5fd4ff, 0xffd24f, 0xff5b4b, 0xc078ff, 0x7dffb2];
  }

  private playMusic(key: MusicKey): void {
    this.pendingMusicKey = key;
    if (this.muted) return;
    if (this.currentMusicKey === key && this.currentMusic?.isPlaying) return;

    const soundManager = this.sound as Phaser.Sound.BaseSoundManager & { locked?: boolean };
    if (soundManager.locked) {
      if (!this.waitingForAudioUnlock) {
        this.waitingForAudioUnlock = true;
        soundManager.once("unlocked", () => {
          this.waitingForAudioUnlock = false;
          if (this.pendingMusicKey) this.playMusic(this.pendingMusicKey);
        });
      }
      return;
    }

    this.currentMusic?.stop();
    this.currentMusic?.destroy();
    const music = this.sound.add(key, {
      loop: true,
      volume: key === "battleMusic" ? 0.38 : 0.32
    });
    this.currentMusic = music;
    this.currentMusicKey = key;
    music.play();
  }

  private unlockAudio(): void {
    const soundManager = this.sound as Phaser.Sound.BaseSoundManager & { locked?: boolean };
    if (!this.muted && !soundManager.locked && this.pendingMusicKey) {
      this.playMusic(this.pendingMusicKey);
    }
  }

  private playSfx(key: SfxKey, volume = 0.6): void {
    if (this.muted) return;
    const soundManager = this.sound as Phaser.Sound.BaseSoundManager & { locked?: boolean };
    if (soundManager.locked) return;
    this.sound.play(key, { volume });
  }

  private toggleMute(label: Phaser.GameObjects.Text): void {
    this.muted = !this.muted;
    window.localStorage.setItem(MUTE_STORAGE_KEY, this.muted ? "1" : "0");
    label.setText(this.muted ? "静" : "声");
    if (this.muted) {
      this.currentMusic?.stop();
      this.currentMusic?.destroy();
      this.currentMusic = undefined;
      this.currentMusicKey = undefined;
    } else if (this.pendingMusicKey) {
      this.playMusic(this.pendingMusicKey);
      this.playSfx("confirmSfx", 0.45);
    }
  }

  private drawMuteButton(): void {
    const centerX = WIDTH - 48;
    const centerY = 42;
    const size = 64;
    const x = centerX - size / 2;
    const y = centerY - size / 2;
    const backing = this.addObject(this.add.circle(centerX, centerY, 31, this.muted ? 0x62420b : 0x0b416a, 0.82));
    backing.setDepth(120);
    backing.setStrokeStyle(5, this.muted ? 0xffd24f : 0x5fd4ff, 0.95);
    const button = this.addObject(this.add.circle(centerX, centerY, 23, this.muted ? 0x8b5d10 : 0x10649a, 0.95));
    button.setDepth(121);
    button.setBlendMode(Phaser.BlendModes.ADD);
    const shine = this.addObject(this.add.circle(centerX - 8, centerY - 9, 6, 0xffffff, 0.28));
    shine.setDepth(122);
    const label = this.addObject(this.add.text(centerX, centerY, this.muted ? "静" : "声", {
      fontFamily: "Microsoft YaHei, PingFang SC, sans-serif",
      fontSize: "24px",
      fontStyle: "bold",
      color: "#ffffff",
      align: "center",
      fixedWidth: 44,
      stroke: "#06304d",
      strokeThickness: 3,
      shadow: {
        offsetX: 0,
        offsetY: 2,
        color: "#000000",
        blur: 4,
        stroke: true,
        fill: true
      }
    }).setOrigin(0.5));
    label.setDepth(123);

    const zone = this.addObject(this.add.zone(x, y, size, size).setOrigin(0, 0));
    zone.setDepth(124);
    zone.setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => {
      this.unlockAudio();
      this.playSfx("clickSfx", 0.42);
      this.clickBurst(centerX, centerY, this.muted ? 0xffb02e : 0x1478d4);
      this.tweens.add({ targets: [backing, button, shine], scale: 0.92, duration: 80, ease: "Quad.easeOut" });
      this.tweens.add({ targets: label, scale: 0.92, duration: 80, ease: "Quad.easeOut" });
    });
    zone.on("pointerup", () => {
      this.tweens.add({ targets: [backing, button, shine], scale: 1, duration: 110, ease: "Back.easeOut" });
      this.tweens.add({ targets: label, scale: 1, duration: 110, ease: "Back.easeOut" });
      this.toggleMute(label);
      backing.setFillStyle(this.muted ? 0x62420b : 0x0b416a, 0.82);
      backing.setStrokeStyle(5, this.muted ? 0xffd24f : 0x5fd4ff, 0.95);
      button.setFillStyle(this.muted ? 0x8b5d10 : 0x10649a, 0.95);
    });
    zone.on("pointerout", () => {
      this.tweens.add({ targets: [backing, button, shine], scale: 1, duration: 90, ease: "Quad.easeOut" });
      this.tweens.add({ targets: label, scale: 1, duration: 90, ease: "Quad.easeOut" });
    });
  }

  private startBreathing(sprite: Phaser.GameObjects.Image, amount: number, duration: number): void {
    this.tweens.add({
      targets: sprite,
      y: sprite.y - amount,
      scaleY: sprite.scaleY * 1.015,
      yoyo: true,
      repeat: -1,
      duration,
      ease: "Sine.easeInOut"
    });
  }

  private heroSkillName(hero: Hero): string {
    const names: Record<string, string> = {
      ultraman: "斯派修姆光线",
      tiga: "哉佩利敖光线",
      zero: "集束光线",
      mebius: "梦比姆射线",
      orb: "欧布至高光线",
      z: "泽斯蒂姆光线"
    };
    return names[hero.id] ?? "必杀光线";
  }

  private specialMontage(text: string, color: number): void {
    if (!this.battle) return;
    const overlay = this.addObject(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x020814, 0));
    overlay.setDepth(130);
    const flash = this.addObject(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, color, 0));
    flash.setDepth(131);
    flash.setBlendMode(Phaser.BlendModes.ADD);

    const bands: Phaser.GameObjects.Rectangle[] = [];
    for (let index = 0; index < 7; index += 1) {
      const band = this.addObject(this.add.rectangle(-420 + index * 90, -60 + index * 96, WIDTH + 520, index % 2 === 0 ? 64 : 88, color, 0));
      band.setDepth(132);
      band.setRotation(-0.36);
      band.setBlendMode(Phaser.BlendModes.ADD);
      bands.push(band);
    }

    const hero = this.addObject(this.add.image(250, HEIGHT + 34, this.heroTextureKey(this.battle.hero, "special")).setOrigin(0.5, 1));
    hero.setDepth(133);
    hero.setFlipX(true);
    hero.setScale(2.25);
    hero.setAlpha(0);
    hero.setTint(color);
    hero.setBlendMode(Phaser.BlendModes.ADD);

    const titleScrim = this.addObject(this.add.rectangle(WIDTH / 2, 156, WIDTH, 150, 0x020814, 0));
    titleScrim.setDepth(134);
    const titleGlow = this.addObject(this.add.text(WIDTH / 2, 156, text, {
      fontFamily: "Microsoft YaHei, PingFang SC, sans-serif",
      fontSize: "68px",
      fontStyle: "bold",
      color: "#ffe071",
      align: "center",
      fixedWidth: 900,
      stroke: "#ff3b2f",
      strokeThickness: 14,
      shadow: {
        offsetX: 0,
        offsetY: 0,
        color: "#fff0a8",
        blur: 24,
        stroke: true,
        fill: true
      }
    }).setOrigin(0.5).setAlpha(0));
    titleGlow.setDepth(135);
    titleGlow.setBlendMode(Phaser.BlendModes.ADD);
    titleGlow.setScale(0.72);
    const title = this.addObject(this.add.text(WIDTH / 2, 156, text, {
      fontFamily: "Microsoft YaHei, PingFang SC, sans-serif",
      fontSize: "68px",
      fontStyle: "bold",
      color: "#fff8c7",
      align: "center",
      fixedWidth: 900,
      stroke: "#27060b",
      strokeThickness: 10
    }).setOrigin(0.5).setAlpha(0));
    title.setDepth(136);
    title.setScale(0.72);

    this.tweens.add({ targets: overlay, alpha: 0.82, duration: 360, ease: "Quad.easeOut" });
    this.tweens.add({ targets: flash, alpha: 0.24, duration: 330, yoyo: true, repeat: 4, ease: "Sine.easeInOut" });
    this.tweens.add({ targets: titleScrim, alpha: 0.7, duration: 320, ease: "Quad.easeOut" });
    this.tweens.add({ targets: [titleGlow, title], alpha: 1, scale: 1, duration: 320, ease: "Back.easeOut" });
    bands.forEach((band, index) => {
      this.tweens.add({
        targets: band,
        alpha: index % 2 === 0 ? 0.72 : 0.5,
        x: band.x + WIDTH + 720,
        duration: 2300,
        delay: index * 60,
        ease: "Cubic.easeOut"
      });
    });
    this.tweens.add({ targets: hero, alpha: 0.8, x: 372, duration: 900, yoyo: true, hold: 1420, ease: "Quad.easeOut" });
    this.time.delayedCall(2920, () => {
      this.tweens.add({
        targets: [overlay, flash, hero, titleScrim, titleGlow, title, ...bands],
        alpha: 0,
        duration: 680,
        ease: "Quad.easeIn",
        onComplete: () => {
          overlay.destroy();
          flash.destroy();
          hero.destroy();
          titleScrim.destroy();
          titleGlow.destroy();
          title.destroy();
          bands.forEach((band) => band.destroy());
        }
      });
    });
  }

  private impactText(text: string, x: number, y: number, size: number, color: string, duration: number, depth = 70): void {
    const label = this.addObject(this.add.text(x, y, text, {
      fontFamily: "Microsoft YaHei, PingFang SC, sans-serif",
      fontSize: `${size}px`,
      fontStyle: "bold",
      color,
      align: "center",
      fixedWidth: 760,
      stroke: "#2f0606",
      strokeThickness: Math.max(5, Math.round(size * 0.14)),
      shadow: {
        offsetX: 0,
        offsetY: 5,
        color: "#ff3b2f",
        blur: 14,
        stroke: true,
        fill: true
      }
    }).setOrigin(0.5));
    label.setDepth(depth);
    label.setBlendMode(Phaser.BlendModes.ADD);
    label.setScale(0.45);
    this.tweens.add({
      targets: label,
      scale: 1.18,
      duration: 220,
      ease: "Back.easeOut"
    });
    this.tweens.add({
      targets: label,
      alpha: 0,
      y: y - 16,
      delay: Math.max(240, duration - 540),
      duration: 540,
      ease: "Quad.easeIn",
      onComplete: () => label.destroy()
    });
  }

  private monsterExplosion(x: number, y: number, special: boolean): void {
    this.playSfx("blastSfx", special ? 0.95 : 0.75);
    const count = special ? 54 : 34;
    const flash = this.addObject(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0xfff2a0, special ? 0.28 : 0.18));
    flash.setDepth(134);
    flash.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: special ? 760 : 520,
      ease: "Quad.easeOut",
      onComplete: () => flash.destroy()
    });
    this.flashRing(x, y, 0xffd24f, special ? 76 : 52, special ? 3.1 : 2.35, 136);
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + Phaser.Math.FloatBetween(-0.18, 0.18);
      const distance = Phaser.Math.Between(special ? 95 : 58, special ? 245 : 160);
      const color = [0xfff2a0, 0xff8b3d, 0xffffff, 0xff3b2f][index % 4];
      const particle = this.addObject(this.add.circle(x, y, Phaser.Math.Between(5, special ? 13 : 10), color, 0.92));
      particle.setDepth(137);
      particle.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        scale: 0,
        alpha: 0,
        duration: Phaser.Math.Between(800, special ? 1650 : 1180),
        ease: "Quad.easeOut",
        onComplete: () => particle.destroy()
      });
    }

    for (let index = 0; index < 8; index += 1) {
      const smoke = this.addObject(this.add.circle(
        x + Phaser.Math.Between(-34, 34),
        y + Phaser.Math.Between(-22, 30),
        Phaser.Math.Between(14, special ? 34 : 26),
        0x1b1a18,
        0.42
      ));
      smoke.setDepth(136);
      this.tweens.add({
        targets: smoke,
        x: smoke.x + Phaser.Math.Between(-60, 60),
        y: smoke.y + Phaser.Math.Between(-56, 26),
        scale: 1.9,
        alpha: 0,
        duration: Phaser.Math.Between(900, special ? 1700 : 1250),
        ease: "Sine.easeOut",
        onComplete: () => smoke.destroy()
      });
    }
    this.cameraShake(special ? 0.018 : 0.012);
  }

  private transitionIn(kind: "menu" | "battle"): void {
    const colors = kind === "battle" ? [0xffd24f, 0xff5b4b, 0xffffff] : [0x5fd4ff, 0x7456d8, 0xffffff];
    const cover = this.addObject(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, 0x020814, 0.86));
    cover.setDepth(200);
    const flash = this.addObject(this.add.rectangle(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT, colors[0], 0.2));
    flash.setDepth(201);
    flash.setBlendMode(Phaser.BlendModes.ADD);

    for (let index = 0; index < 7; index += 1) {
      const band = this.addObject(this.add.rectangle(-420 + index * 90, -80 + index * 94, WIDTH + 520, index % 2 === 0 ? 72 : 96, colors[index % colors.length], 0));
      band.setDepth(202);
      band.setRotation(-0.34);
      band.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: band,
        x: band.x + WIDTH + 720,
        alpha: index % 2 === 0 ? 0.78 : 0.52,
        duration: 760 + index * 35,
        delay: index * 34,
        ease: "Cubic.easeOut",
        onComplete: () => band.destroy()
      });
    }

    this.tweens.add({ targets: cover, alpha: 0, delay: 240, duration: 620, ease: "Quad.easeOut", onComplete: () => cover.destroy() });
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 760,
      ease: "Sine.easeOut",
      onComplete: () => flash.destroy()
    });
  }

  private clickBurst(x: number, y: number, color: number): void {
    const frame = color === 0xffb02e ? "click-gold" : color === 0xe0633f ? "click-red" : color === 0x21a878 ? "click-green" : "click-blue";
    const burst = this.addObject(this.add.image(x, y, UI_KIT_KEY, frame).setDisplaySize(82, 96).setAlpha(0.82));
    burst.setDepth(75);
    burst.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: burst,
      scale: 1.35,
      alpha: 0,
      duration: 380,
      ease: "Quad.easeOut",
      onComplete: () => burst.destroy()
    });
  }

  private cameraShake(amount: number): void {
    this.cameras.main.shake(130, amount);
  }

  private healthBar(x: number, y: number, width: number, height: number, color: number): Phaser.GameObjects.Rectangle {
    this.addObject(this.add.rectangle(x - 4, y - 4, width + 8, height + 8, 0x07121f, 0.76).setOrigin(0, 0));
    return this.addObject(this.add.rectangle(x, y, width, height, color).setOrigin(0, 0));
  }

  private button(x: number, y: number, w: number, h: number, text: string, onClick: () => void, fontSize: number, color: number): void {
    const frame = this.buttonFrame(text, color);
    const isDigit = /^\d$/.test(text);
    const centerX = x + w / 2;
    const centerY = y + h / 2;
    const sideSlice = Math.max(22, Math.min(52, Math.floor(w * 0.26)));
    const topSlice = Math.max(16, Math.min(24, Math.floor(h * 0.3)));
    const button = this.addObject(this.add.nineslice(centerX, centerY, UI_KIT_KEY, frame, w, h, sideSlice, sideSlice, topSlice, topSlice));
    button.setAlpha(color === 0x526070 ? 0.58 : 0.98);

    const labelFontSize = isDigit ? Math.max(44, fontSize + 8) : fontSize;
    const label = this.addObject(this.add.text(centerX, centerY, text, {
      fontFamily: "Microsoft YaHei, PingFang SC, sans-serif",
      fontSize: `${labelFontSize}px`,
      fontStyle: "bold",
      color: "#ffffff",
      align: "center",
      fixedWidth: isDigit ? w : w - 12,
      stroke: "#06304d",
      strokeThickness: Math.max(2, Math.round(labelFontSize * 0.12)),
      shadow: {
        offsetX: 0,
        offsetY: 2,
        color: "#000000",
        blur: 4,
        stroke: true,
        fill: true
      }
    }).setOrigin(0.5));
    label.setAlpha(color === 0x526070 ? 0.68 : 1);

    const zone = this.addObject(this.add.zone(x, y, w, h).setOrigin(0, 0));
    zone.setInteractive({ useHandCursor: true });
    const baseScaleX = button.scaleX;
    const baseScaleY = button.scaleY;
    zone.on("pointerdown", () => {
      this.unlockAudio();
      this.playSfx("clickSfx", 0.48);
      this.clickBurst(centerX, centerY, color);
      this.tweens.add({ targets: button, scaleX: baseScaleX * 0.92, scaleY: baseScaleY * 0.92, duration: 80, ease: "Quad.easeOut" });
      this.tweens.add({ targets: label, scale: 0.92, duration: 80, ease: "Quad.easeOut" });
    });
    zone.on("pointerup", () => {
      this.tweens.add({ targets: button, scaleX: baseScaleX, scaleY: baseScaleY, duration: 110, ease: "Back.easeOut" });
      this.tweens.add({ targets: label, scale: 1, duration: 110, ease: "Back.easeOut" });
      onClick();
    });
    zone.on("pointerout", () => {
      this.tweens.add({ targets: button, scaleX: baseScaleX, scaleY: baseScaleY, duration: 90, ease: "Quad.easeOut" });
      this.tweens.add({ targets: label, scale: 1, duration: 90, ease: "Quad.easeOut" });
    });
  }

  private panel(x: number, y: number, w: number, h: number, color: number, alpha: number): void {
    const rect = this.addObject(this.add.rectangle(x, y, w, h, color, alpha).setOrigin(0, 0));
    rect.setStrokeStyle(2, 0xffffff, 0.18);
    this.addObject(this.add.rectangle(x + 3, y + 3, w - 6, h - 6, 0x5fd4ff, 0.04).setOrigin(0, 0));
  }

  private hit(x: number, y: number, w: number, h: number, onClick: () => void): void {
    const zone = this.addObject(this.add.zone(x, y, w, h).setOrigin(0, 0));
    zone.setInteractive({ useHandCursor: true });
    zone.on("pointerdown", () => {
      this.unlockAudio();
      this.playSfx("clickSfx", 0.42);
      this.clickBurst(x + w / 2, y + h / 2, 0x1478d4);
    });
    zone.on("pointerup", onClick);
  }

  private header(text: string, back: () => void): void {
    this.label(text, WIDTH / 2, 48, 36, "#ffffff");
    this.button(28, 24, 120, 48, "返回", back, 22, 0x245674);
  }

  private title(text: string, y: number): Phaser.GameObjects.Text {
    const frame = this.addObject(this.add.image(WIDTH / 2, y + 8, UI_KIT_KEY, "title-frame").setDisplaySize(720, 156).setAlpha(0.9));
    frame.setBlendMode(Phaser.BlendModes.ADD);
    const title = this.label(text, WIDTH / 2, y, 58, "#ffffff");
    title.setDepth(frame.depth + 1);
    return title;
  }

  private label(text: string, x: number, y: number, size: number, color: string): Phaser.GameObjects.Text {
    const fixedWidth = size <= 18 ? 185 : size <= 23 ? 280 : size <= 30 ? 430 : 760;
    return this.addObject(this.add.text(x, y, text, {
      fontFamily: "Microsoft YaHei, PingFang SC, sans-serif",
      fontSize: `${size}px`,
      fontStyle: "bold",
      color,
      align: "center",
      fixedWidth,
      stroke: "#07121f",
      strokeThickness: Math.max(2, Math.round(size * 0.1)),
      shadow: {
        offsetX: 0,
        offsetY: Math.max(1, Math.round(size * 0.08)),
        color: "#000000",
        blur: Math.max(2, Math.round(size * 0.18)),
        stroke: true,
        fill: true
      }
    }).setOrigin(0.5));
  }

  private buttonFrame(text: string, color: number): string {
    if (/^\d$/.test(text)) return "button-blue";
    if (color === 0xe0633f || color === 0xb63a3a) return "button-red";
    if (color === 0x21a878) return "button-green";
    if (color === 0xffb02e) return "button-gold";
    return "button-blue";
  }
}
