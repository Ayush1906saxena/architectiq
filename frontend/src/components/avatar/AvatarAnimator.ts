export interface AvatarPose {
  bodyOffsetY: number;
  leftArmAngle: number;
  rightArmAngle: number;
  eyeLookX: number;
  eyeLookY: number;
  browOffset: number; // -1 (furrowed) to 1 (raised)
  headTilt: number;
}

const POSES: Record<string, AvatarPose> = {
  idle_neutral: {
    bodyOffsetY: 0,
    leftArmAngle: 0,
    rightArmAngle: 0,
    eyeLookX: 0,
    eyeLookY: 0,
    browOffset: 0,
    headTilt: 0,
  },
  teach_explain: {
    bodyOffsetY: -2,
    leftArmAngle: -25,
    rightArmAngle: 15,
    eyeLookX: 0,
    eyeLookY: 0,
    browOffset: 0.2,
    headTilt: 3,
  },
  teach_point: {
    bodyOffsetY: -2,
    leftArmAngle: 0,
    rightArmAngle: -60,
    eyeLookX: 0.5,
    eyeLookY: 0,
    browOffset: 0.1,
    headTilt: -5,
  },
  emotion_excited: {
    bodyOffsetY: -5,
    leftArmAngle: -30,
    rightArmAngle: -30,
    eyeLookX: 0,
    eyeLookY: -0.2,
    browOffset: 0.6,
    headTilt: 0,
  },
  emotion_concerned: {
    bodyOffsetY: 2,
    leftArmAngle: 5,
    rightArmAngle: 5,
    eyeLookX: 0,
    eyeLookY: 0.1,
    browOffset: -0.5,
    headTilt: -3,
  },
  emotion_serious: {
    bodyOffsetY: 0,
    leftArmAngle: 0,
    rightArmAngle: 0,
    eyeLookX: 0,
    eyeLookY: 0,
    browOffset: -0.3,
    headTilt: 0,
  },
  interact_question: {
    bodyOffsetY: -3,
    leftArmAngle: -10,
    rightArmAngle: -35,
    eyeLookX: 0,
    eyeLookY: -0.1,
    browOffset: 0.5,
    headTilt: 5,
  },
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPose(from: AvatarPose, to: AvatarPose, t: number): AvatarPose {
  return {
    bodyOffsetY: lerp(from.bodyOffsetY, to.bodyOffsetY, t),
    leftArmAngle: lerp(from.leftArmAngle, to.leftArmAngle, t),
    rightArmAngle: lerp(from.rightArmAngle, to.rightArmAngle, t),
    eyeLookX: lerp(from.eyeLookX, to.eyeLookX, t),
    eyeLookY: lerp(from.eyeLookY, to.eyeLookY, t),
    browOffset: lerp(from.browOffset, to.browOffset, t),
    headTilt: lerp(from.headTilt, to.headTilt, t),
  };
}

// Ease-out cubic
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export class AvatarAnimator {
  private currentPose: AvatarPose;
  private targetPose: AvatarPose;
  private transitionStartPose: AvatarPose;
  private transitionProgress = 1;
  private transitionDuration = 400; // ms
  private transitionStartTime = 0;

  // Idle animation
  private breathPhase = 0;
  private blinkTimer = 0;
  private blinkDuration = 150; // ms
  private isBlinking = false;
  private nextBlinkAt: number;

  // Gesture oscillation
  private gesturePhase = 0;

  constructor() {
    this.currentPose = { ...POSES.idle_neutral };
    this.targetPose = { ...POSES.idle_neutral };
    this.transitionStartPose = { ...POSES.idle_neutral };
    this.nextBlinkAt = 2000 + Math.random() * 3000;
  }

  transitionTo(stateName: string) {
    const pose = POSES[stateName] || POSES.idle_neutral;
    this.transitionStartPose = { ...this.currentPose };
    this.targetPose = pose;
    this.transitionProgress = 0;
    this.transitionStartTime = performance.now();
  }

  update(now: number, deltaMs: number): AvatarPose & { isBlinking: boolean } {
    // Advance transition
    if (this.transitionProgress < 1) {
      const elapsed = now - this.transitionStartTime;
      this.transitionProgress = Math.min(1, elapsed / this.transitionDuration);
      const easedT = easeOut(this.transitionProgress);
      this.currentPose = lerpPose(
        this.transitionStartPose,
        this.targetPose,
        easedT
      );
    }

    // Breathing animation
    this.breathPhase += deltaMs * 0.002;
    const breathOffset = Math.sin(this.breathPhase) * 1.5;

    // Blink logic
    this.blinkTimer += deltaMs;
    if (!this.isBlinking && this.blinkTimer >= this.nextBlinkAt) {
      this.isBlinking = true;
      this.blinkTimer = 0;
    }
    if (this.isBlinking && this.blinkTimer >= this.blinkDuration) {
      this.isBlinking = false;
      this.blinkTimer = 0;
      this.nextBlinkAt = 2000 + Math.random() * 4000;
    }

    // Gesture oscillation (subtle arm movement when teaching)
    this.gesturePhase += deltaMs * 0.003;
    const gestureOffset = Math.sin(this.gesturePhase) * 5;

    return {
      ...this.currentPose,
      bodyOffsetY: this.currentPose.bodyOffsetY + breathOffset,
      leftArmAngle: this.currentPose.leftArmAngle + gestureOffset * 0.5,
      rightArmAngle: this.currentPose.rightArmAngle + gestureOffset * 0.3,
      isBlinking: this.isBlinking,
    };
  }
}
