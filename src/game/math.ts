import type { Difficulty, Monster } from "./data";

export interface Problem {
  expression: string;
  answer: number;
  timeLimit: number;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addTermPart(parts: number[], maxValue: number): void {
  const next = randomInt(1, Math.max(2, Math.floor(maxValue / 3)));
  parts.push(next);
}

function buildAddSubtract(maxValue: number, terms: number, allowCarry: boolean): { expression: string; answer: number } {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const values = [randomInt(1, maxValue)];
    while (values.length < terms) values.push(randomInt(1, Math.max(2, Math.floor(maxValue / 2))));

    let total = values[0];
    const expressionParts = [String(values[0])];

    for (let i = 1; i < values.length; i += 1) {
      const canSubtract = total - values[i] >= 0;
      const op = canSubtract && Math.random() > 0.48 ? "-" : "+";
      if (op === "+") {
        total += values[i];
      } else {
        total -= values[i];
      }
      expressionParts.push(op, String(values[i]));
    }

    if (total >= 0 && total <= maxValue && (allowCarry || total < 20)) {
      return { expression: expressionParts.join(" "), answer: total };
    }
  }

  const parts = [randomInt(1, Math.max(2, Math.floor(maxValue / 2)))];
  while (parts.length < terms) addTermPart(parts, maxValue);
  const answer = parts.reduce((sum, item) => sum + item, 0);
  return { expression: parts.join(" + "), answer };
}

function termCountFor(monster: Monster, difficulty: Difficulty): number {
  const lateBandBonus = difficulty.id === "normal" ? 0 : monster.mathBand >= 6 ? 1 : 0;
  return Math.min(4, 2 + difficulty.extraTerms + lateBandBonus);
}

function maxValueForBand(band: number): number {
  if (band <= 1) return 5;
  if (band <= 3) return 10;
  if (band <= 6) return 20;
  if (band <= 7) return 50;
  return 100;
}

export function generateProblem(monster: Monster, difficulty: Difficulty): Problem {
  const band = monster.mathBand;
  const terms = termCountFor(monster, difficulty);
  const maxValue = maxValueForBand(band);
  const allowCarry = band >= 5;

  if (band >= 8 && Math.random() > 0.35) {
    const tensA = randomInt(1, 8) * 10;
    const tensB = Math.random() > 0.5 ? randomInt(1, 8) * 10 : randomInt(1, 9);
    const subtract = Math.random() > 0.55 && tensA >= tensB;
    const answer = subtract ? tensA - tensB : tensA + tensB;
    if (answer >= 0 && answer <= maxValue) {
      return {
        expression: `${tensA} ${subtract ? "-" : "+"} ${tensB}`,
        answer,
        timeLimit: getTimeLimit(monster, difficulty)
      };
    }
  }

  const problem = buildAddSubtract(maxValue, terms, allowCarry);
  return {
    ...problem,
    timeLimit: getTimeLimit(monster, difficulty)
  };
}

export function getTimeLimit(monster: Monster, difficulty: Difficulty): number {
  const stagePressure = Math.min(2.3, monster.stage * 0.12);
  return Math.max(3.2, 8.4 - stagePressure + difficulty.timeBonus);
}
