import type { Difficulty, Monster } from "./data";

export interface Problem {
  expression: string;
  answer: number;
  timeLimit: number;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addTermParts(parts: number[], maxValue: number): number[] {
  const next = randomInt(1, Math.max(2, Math.floor(maxValue / 3)));
  return [...parts, next];
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
  while (parts.length < terms) addTermParts(parts, maxValue);
  const answer = parts.reduce((sum, item) => sum + item, 0);
  return { expression: parts.join(" + "), answer };
}

export function generateProblem(monster: Monster, difficulty: Difficulty): Problem {
  const band = monster.mathBand;
  const terms = Math.min(4, 2 + (band >= 3 ? 1 : 0) + (band >= 6 ? 1 : 0) + difficulty.extraTerms);
  let maxValue = 10;
  let allowCarry = false;

  if (band <= 1) maxValue = 5;
  else if (band <= 3) maxValue = 10;
  else if (band <= 6) maxValue = 20;
  else maxValue = 100;

  if (band >= 5) allowCarry = true;

  if (band >= 7 && Math.random() > 0.35) {
    const tensA = randomInt(1, 8) * 10;
    const tensB = Math.random() > 0.5 ? randomInt(1, 8) * 10 : randomInt(1, 9);
    const subtract = Math.random() > 0.55 && tensA >= tensB;
    const answer = subtract ? tensA - tensB : tensA + tensB;
    if (answer >= 0 && answer <= 100) {
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
