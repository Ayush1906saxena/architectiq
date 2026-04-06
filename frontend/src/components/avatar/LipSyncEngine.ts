export type MouthShape = "closed" | "small" | "medium" | "wide";

export interface MouthState {
  shape: MouthShape;
  openness: number; // 0 to 1
}

export class LipSyncEngine {
  private smoothedAmplitude = 0;
  private readonly smoothingFactor = 0.35;

  update(rawAmplitude: number): MouthState {
    this.smoothedAmplitude =
      this.smoothedAmplitude * (1 - this.smoothingFactor) +
      rawAmplitude * this.smoothingFactor;

    const a = this.smoothedAmplitude;

    if (a < 0.03) return { shape: "closed", openness: 0 };
    if (a < 0.1) return { shape: "small", openness: 0.25 };
    if (a < 0.25) return { shape: "medium", openness: 0.55 };
    return { shape: "wide", openness: Math.min(1, a * 2) };
  }

  reset() {
    this.smoothedAmplitude = 0;
  }
}
