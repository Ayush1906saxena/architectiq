/**
 * SM-2 Spaced Repetition Algorithm
 * quality: 0-5 (0 = complete blackout, 5 = perfect recall)
 */
export interface SM2Input {
  quality: number;
  easinessFactor: number;
  interval: number;
  repetitions: number;
}

export interface SM2Output {
  easinessFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: Date;
}

export function calculateSM2(input: SM2Input): SM2Output {
  let { easinessFactor, interval, repetitions } = input;
  const { quality } = input;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easinessFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  easinessFactor =
    easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  easinessFactor = Math.max(1.3, easinessFactor);

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + interval);

  return { easinessFactor, interval, repetitions, nextReviewDate };
}

export function qualityFromQuizResult(
  isCorrect: boolean,
  timeTakenMs: number,
  difficulty: number
): number {
  if (!isCorrect) return difficulty <= 2 ? 1 : 2;
  if (timeTakenMs < 5000) return 5; // Quick correct
  if (timeTakenMs < 15000) return 4; // Normal correct
  return 3; // Slow but correct
}
