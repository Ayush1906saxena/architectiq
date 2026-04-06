import { AvatarPose } from "./AvatarAnimator";
import { MouthState } from "./LipSyncEngine";

// ── Color Palette (modern, warm, professional) ───────────────
const SKIN = "#E8B896";
const SKIN_SHADOW = "#D4A07E";
const SKIN_HIGHLIGHT = "#F5D4B8";
const HAIR = "#2D1F14";
const HAIR_HIGHLIGHT = "#4A3628";
const JACKET = "#2C3E50";
const JACKET_SHADOW = "#1A252F";
const JACKET_HIGHLIGHT = "#3D566E";
const SHIRT = "#ECF0F1";
const SHIRT_SHADOW = "#D5DBDB";
const GLASSES_FRAME = "#1C1C1E";
const GLASSES_LENS = "rgba(200, 215, 230, 0.15)";
const EYE_WHITE = "#FDFDFD";
const EYE_IRIS = "#5D4E37";
const EYE_PUPIL = "#1A1A1A";
const EYE_HIGHLIGHT = "rgba(255, 255, 255, 0.8)";
const MOUTH_INNER = "#8B3A3A";
const MOUTH_TONGUE = "#C27070";
const LIPS = "#C4796E";
const LIPS_SHADOW = "#A86058";
const TEETH = "#F5F0EB";
const BG_GLOW = "rgba(52, 152, 219, 0.06)";

export function drawPlaceholderAvatar(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pose: AvatarPose & { isBlinking: boolean },
  mouth: MouthState
) {
  ctx.clearRect(0, 0, width, height);

  const cx = width / 2;
  const baseY = height * 0.38;
  const scale = Math.min(width / 400, height / 500);

  // Subtle background glow behind character
  const bgGlow = ctx.createRadialGradient(cx, baseY - 40 * scale, 0, cx, baseY - 40 * scale, 180 * scale);
  bgGlow.addColorStop(0, BG_GLOW);
  bgGlow.addColorStop(1, "transparent");
  ctx.fillStyle = bgGlow;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(cx, baseY + pose.bodyOffsetY * scale);

  // Shadow under character
  drawShadow(ctx, scale);

  // Body
  drawBody(ctx, scale, pose);

  // Arms (behind body for crossed arms, or in front)
  drawArms(ctx, scale, pose);

  // Neck with shading
  drawNeck(ctx, scale);

  // Head
  drawHead(ctx, scale, pose, mouth);

  ctx.restore();
}

function drawShadow(ctx: CanvasRenderingContext2D, s: number) {
  const gradient = ctx.createRadialGradient(0, 100 * s, 0, 0, 100 * s, 70 * s);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.08)");
  gradient.addColorStop(1, "transparent");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 100 * s, 70 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBody(ctx: CanvasRenderingContext2D, s: number, pose: AvatarPose) {
  // Shoulders — wider, more natural
  ctx.save();

  // Jacket body with gradient
  const jacketGrad = ctx.createLinearGradient(-65 * s, -70 * s, 65 * s, 95 * s);
  jacketGrad.addColorStop(0, JACKET_HIGHLIGHT);
  jacketGrad.addColorStop(0.4, JACKET);
  jacketGrad.addColorStop(1, JACKET_SHADOW);

  ctx.fillStyle = jacketGrad;
  ctx.beginPath();
  ctx.moveTo(-68 * s, -60 * s);
  ctx.quadraticCurveTo(-72 * s, -30 * s, -60 * s, 95 * s);
  ctx.lineTo(60 * s, 95 * s);
  ctx.quadraticCurveTo(72 * s, -30 * s, 68 * s, -60 * s);
  ctx.quadraticCurveTo(40 * s, -75 * s, 0, -72 * s);
  ctx.quadraticCurveTo(-40 * s, -75 * s, -68 * s, -60 * s);
  ctx.closePath();
  ctx.fill();

  // Jacket shadow on sides
  ctx.fillStyle = JACKET_SHADOW;
  ctx.beginPath();
  ctx.moveTo(-68 * s, -60 * s);
  ctx.quadraticCurveTo(-72 * s, -30 * s, -60 * s, 95 * s);
  ctx.lineTo(-45 * s, 95 * s);
  ctx.quadraticCurveTo(-50 * s, -20 * s, -50 * s, -60 * s);
  ctx.closePath();
  ctx.fill();

  // Lapels
  ctx.fillStyle = JACKET_HIGHLIGHT;
  ctx.beginPath();
  ctx.moveTo(-28 * s, -72 * s);
  ctx.lineTo(-8 * s, 30 * s);
  ctx.lineTo(8 * s, 30 * s);
  ctx.lineTo(28 * s, -72 * s);
  ctx.closePath();
  ctx.fill();

  // Shirt / collar
  const shirtGrad = ctx.createLinearGradient(0, -72 * s, 0, -20 * s);
  shirtGrad.addColorStop(0, SHIRT);
  shirtGrad.addColorStop(1, SHIRT_SHADOW);
  ctx.fillStyle = shirtGrad;
  ctx.beginPath();
  ctx.moveTo(-18 * s, -72 * s);
  ctx.lineTo(-4 * s, -35 * s);
  ctx.lineTo(4 * s, -35 * s);
  ctx.lineTo(18 * s, -72 * s);
  ctx.closePath();
  ctx.fill();

  // Collar points
  ctx.fillStyle = SHIRT;
  ctx.beginPath();
  ctx.moveTo(-22 * s, -72 * s);
  ctx.lineTo(-30 * s, -58 * s);
  ctx.lineTo(-18 * s, -60 * s);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(22 * s, -72 * s);
  ctx.lineTo(30 * s, -58 * s);
  ctx.lineTo(18 * s, -60 * s);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawArms(ctx: CanvasRenderingContext2D, s: number, pose: AvatarPose) {
  const armLength = 95 * s;
  const shoulderWidth = 24 * s;

  // Left arm
  ctx.save();
  ctx.translate(-65 * s, -52 * s);
  ctx.rotate((pose.leftArmAngle * Math.PI) / 180);

  const leftArmGrad = ctx.createLinearGradient(-shoulderWidth / 2, 0, shoulderWidth / 2, armLength);
  leftArmGrad.addColorStop(0, JACKET);
  leftArmGrad.addColorStop(1, JACKET_SHADOW);
  ctx.fillStyle = leftArmGrad;
  ctx.beginPath();
  ctx.roundRect(-shoulderWidth / 2, 0, shoulderWidth, armLength, 10 * s);
  ctx.fill();

  // Hand with shading
  const handGrad = ctx.createRadialGradient(0, armLength, 0, 0, armLength, 12 * s);
  handGrad.addColorStop(0, SKIN_HIGHLIGHT);
  handGrad.addColorStop(1, SKIN_SHADOW);
  ctx.fillStyle = handGrad;
  ctx.beginPath();
  ctx.ellipse(0, armLength, 11 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Right arm
  ctx.save();
  ctx.translate(65 * s, -52 * s);
  ctx.rotate((pose.rightArmAngle * Math.PI) / 180);

  const rightArmGrad = ctx.createLinearGradient(-shoulderWidth / 2, 0, shoulderWidth / 2, armLength);
  rightArmGrad.addColorStop(0, JACKET);
  rightArmGrad.addColorStop(1, JACKET_SHADOW);
  ctx.fillStyle = rightArmGrad;
  ctx.beginPath();
  ctx.roundRect(-shoulderWidth / 2, 0, shoulderWidth, armLength, 10 * s);
  ctx.fill();

  const handGrad2 = ctx.createRadialGradient(0, armLength, 0, 0, armLength, 12 * s);
  handGrad2.addColorStop(0, SKIN_HIGHLIGHT);
  handGrad2.addColorStop(1, SKIN_SHADOW);
  ctx.fillStyle = handGrad2;
  ctx.beginPath();
  ctx.ellipse(0, armLength, 11 * s, 10 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawNeck(ctx: CanvasRenderingContext2D, s: number) {
  const neckGrad = ctx.createLinearGradient(-12 * s, -90 * s, 12 * s, -65 * s);
  neckGrad.addColorStop(0, SKIN_SHADOW);
  neckGrad.addColorStop(0.5, SKIN);
  neckGrad.addColorStop(1, SKIN_SHADOW);
  ctx.fillStyle = neckGrad;
  ctx.beginPath();
  ctx.moveTo(-14 * s, -68 * s);
  ctx.quadraticCurveTo(-16 * s, -80 * s, -12 * s, -90 * s);
  ctx.lineTo(12 * s, -90 * s);
  ctx.quadraticCurveTo(16 * s, -80 * s, 14 * s, -68 * s);
  ctx.closePath();
  ctx.fill();
}

function drawHead(
  ctx: CanvasRenderingContext2D,
  s: number,
  pose: AvatarPose & { isBlinking: boolean },
  mouth: MouthState
) {
  ctx.save();
  ctx.rotate((pose.headTilt * Math.PI) / 180);

  const headCY = -135 * s;
  const headRX = 56 * s;
  const headRY = 68 * s;

  // Ears
  drawEars(ctx, s, headCY);

  // Hair behind head
  ctx.fillStyle = HAIR;
  ctx.beginPath();
  ctx.ellipse(0, headCY - 8 * s, headRX + 8 * s, headRY + 8 * s, 0, Math.PI + 0.3, -0.3);
  ctx.fill();

  // Head shape with gradient
  const headGrad = ctx.createRadialGradient(
    -10 * s, headCY - 15 * s, 10 * s,
    0, headCY, headRY * 1.1
  );
  headGrad.addColorStop(0, SKIN_HIGHLIGHT);
  headGrad.addColorStop(0.6, SKIN);
  headGrad.addColorStop(1, SKIN_SHADOW);
  ctx.fillStyle = headGrad;
  ctx.beginPath();
  ctx.ellipse(0, headCY, headRX, headRY, 0, 0, Math.PI * 2);
  ctx.fill();

  // Jaw definition (subtle shadow)
  ctx.fillStyle = "rgba(0, 0, 0, 0.03)";
  ctx.beginPath();
  ctx.ellipse(0, headCY + 25 * s, headRX - 5 * s, 35 * s, 0, 0.2, Math.PI - 0.2);
  ctx.fill();

  // Hair on top with texture
  drawHair(ctx, s, headCY, headRX);

  // Eyes
  const eyeY = headCY - 6 * s;
  const eyeSpacing = 23 * s;
  drawEyes(ctx, s, eyeY, eyeSpacing, pose);

  // Eyebrows
  drawEyebrows(ctx, s, eyeY, eyeSpacing, pose);

  // Glasses
  drawGlasses(ctx, s, eyeY, eyeSpacing);

  // Nose
  drawNose(ctx, s, eyeY);

  // Mouth
  const mouthY = headCY + 28 * s;
  drawMouth(ctx, s, mouthY, mouth);

  ctx.restore();
}

function drawEars(ctx: CanvasRenderingContext2D, s: number, headCY: number) {
  const earGrad = ctx.createRadialGradient(-56 * s, headCY, 2 * s, -56 * s, headCY, 14 * s);
  earGrad.addColorStop(0, SKIN);
  earGrad.addColorStop(1, SKIN_SHADOW);

  // Left ear
  ctx.fillStyle = earGrad;
  ctx.beginPath();
  ctx.ellipse(-55 * s, headCY, 9 * s, 14 * s, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Right ear
  const earGrad2 = ctx.createRadialGradient(56 * s, headCY, 2 * s, 56 * s, headCY, 14 * s);
  earGrad2.addColorStop(0, SKIN);
  earGrad2.addColorStop(1, SKIN_SHADOW);
  ctx.fillStyle = earGrad2;
  ctx.beginPath();
  ctx.ellipse(55 * s, headCY, 9 * s, 14 * s, 0.1, 0, Math.PI * 2);
  ctx.fill();
}

function drawHair(ctx: CanvasRenderingContext2D, s: number, headCY: number, headRX: number) {
  // Main hair volume
  const hairGrad = ctx.createLinearGradient(0, headCY - 75 * s, 0, headCY - 30 * s);
  hairGrad.addColorStop(0, HAIR);
  hairGrad.addColorStop(0.7, HAIR);
  hairGrad.addColorStop(1, HAIR_HIGHLIGHT);
  ctx.fillStyle = hairGrad;
  ctx.beginPath();
  ctx.ellipse(0, headCY - headRX * 0.52, headRX * 1.06, 28 * s, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair highlight streak
  ctx.fillStyle = "rgba(90, 70, 50, 0.3)";
  ctx.beginPath();
  ctx.ellipse(-15 * s, headCY - headRX * 0.7, 18 * s, 8 * s, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Side part line
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(-20 * s, headCY - headRX * 0.9);
  ctx.quadraticCurveTo(-25 * s, headCY - headRX * 0.5, -40 * s, headCY - 20 * s);
  ctx.stroke();
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  s: number,
  eyeY: number,
  eyeSpacing: number,
  pose: AvatarPose & { isBlinking: boolean }
) {
  const eyeOffX = pose.eyeLookX * 3 * s;
  const eyeOffY = pose.eyeLookY * 2 * s;

  if (pose.isBlinking) {
    // Closed eyes — curved lines
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-eyeSpacing - 9 * s, eyeY);
    ctx.quadraticCurveTo(-eyeSpacing, eyeY + 3 * s, -eyeSpacing + 9 * s, eyeY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyeSpacing - 9 * s, eyeY);
    ctx.quadraticCurveTo(eyeSpacing, eyeY + 3 * s, eyeSpacing + 9 * s, eyeY);
    ctx.stroke();

    // Eyelashes hint
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(-eyeSpacing - 9 * s, eyeY);
    ctx.lineTo(-eyeSpacing - 11 * s, eyeY - 2 * s);
    ctx.moveTo(eyeSpacing + 9 * s, eyeY);
    ctx.lineTo(eyeSpacing + 11 * s, eyeY - 2 * s);
    ctx.stroke();
    return;
  }

  for (const side of [-1, 1]) {
    const ex = eyeSpacing * side;

    // Eye shadow (upper lid crease)
    ctx.fillStyle = "rgba(0, 0, 0, 0.04)";
    ctx.beginPath();
    ctx.ellipse(ex, eyeY - 2 * s, 13 * s, 10 * s, 0, Math.PI + 0.3, -0.3);
    ctx.fill();

    // Eye white
    ctx.fillStyle = EYE_WHITE;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 11 * s, 7.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye white shadow (upper)
    const eyeShadow = ctx.createLinearGradient(ex, eyeY - 8 * s, ex, eyeY);
    eyeShadow.addColorStop(0, "rgba(0, 0, 0, 0.06)");
    eyeShadow.addColorStop(1, "transparent");
    ctx.fillStyle = eyeShadow;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 11 * s, 7.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Iris
    ctx.fillStyle = EYE_IRIS;
    ctx.beginPath();
    ctx.arc(ex + eyeOffX, eyeY + eyeOffY, 5.5 * s, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = EYE_PUPIL;
    ctx.beginPath();
    ctx.arc(ex + eyeOffX, eyeY + eyeOffY, 2.8 * s, 0, Math.PI * 2);
    ctx.fill();

    // Iris ring detail
    ctx.strokeStyle = "rgba(60, 45, 30, 0.3)";
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.arc(ex + eyeOffX, eyeY + eyeOffY, 4.5 * s, 0, Math.PI * 2);
    ctx.stroke();

    // Eye highlight (catch light)
    ctx.fillStyle = EYE_HIGHLIGHT;
    ctx.beginPath();
    ctx.arc(ex + eyeOffX + 2 * s, eyeY + eyeOffY - 2 * s, 1.8 * s, 0, Math.PI * 2);
    ctx.fill();

    // Secondary smaller highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.beginPath();
    ctx.arc(ex + eyeOffX - 1.5 * s, eyeY + eyeOffY + 1.5 * s, 0.8 * s, 0, Math.PI * 2);
    ctx.fill();

    // Upper eyelid line
    ctx.strokeStyle = "rgba(80, 60, 40, 0.4)";
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.ellipse(ex, eyeY, 11 * s, 7.5 * s, 0, Math.PI + 0.15, -0.15);
    ctx.stroke();
  }
}

function drawEyebrows(
  ctx: CanvasRenderingContext2D,
  s: number,
  eyeY: number,
  eyeSpacing: number,
  pose: AvatarPose
) {
  const browY = eyeY - 16 * s;
  const browLift = pose.browOffset * 5 * s;

  ctx.strokeStyle = HAIR;
  ctx.lineWidth = 3.5 * s;
  ctx.lineCap = "round";

  // Left brow — tapers
  ctx.beginPath();
  ctx.moveTo(-eyeSpacing - 12 * s, browY - browLift + 1 * s);
  ctx.quadraticCurveTo(
    -eyeSpacing, browY - browLift - 5 * s,
    -eyeSpacing + 11 * s, browY - browLift + 2 * s
  );
  ctx.stroke();

  // Right brow
  ctx.beginPath();
  ctx.moveTo(eyeSpacing - 11 * s, browY - browLift + 2 * s);
  ctx.quadraticCurveTo(
    eyeSpacing, browY - browLift - 5 * s,
    eyeSpacing + 12 * s, browY - browLift + 1 * s
  );
  ctx.stroke();
}

function drawGlasses(
  ctx: CanvasRenderingContext2D,
  s: number,
  eyeY: number,
  eyeSpacing: number
) {
  // Lens tint
  ctx.fillStyle = GLASSES_LENS;
  ctx.beginPath();
  ctx.roundRect(-eyeSpacing - 15 * s, eyeY - 11 * s, 30 * s, 22 * s, 7 * s);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(eyeSpacing - 15 * s, eyeY - 11 * s, 30 * s, 22 * s, 7 * s);
  ctx.fill();

  // Frame
  ctx.strokeStyle = GLASSES_FRAME;
  ctx.lineWidth = 2.5 * s;

  ctx.beginPath();
  ctx.roundRect(-eyeSpacing - 15 * s, eyeY - 11 * s, 30 * s, 22 * s, 7 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(eyeSpacing - 15 * s, eyeY - 11 * s, 30 * s, 22 * s, 7 * s);
  ctx.stroke();

  // Bridge
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(-eyeSpacing + 15 * s, eyeY);
  ctx.quadraticCurveTo(0, eyeY - 3 * s, eyeSpacing - 15 * s, eyeY);
  ctx.stroke();

  // Temple arms (going toward ears)
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(-eyeSpacing - 15 * s, eyeY - 5 * s);
  ctx.lineTo(-eyeSpacing - 22 * s, eyeY - 3 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(eyeSpacing + 15 * s, eyeY - 5 * s);
  ctx.lineTo(eyeSpacing + 22 * s, eyeY - 3 * s);
  ctx.stroke();
}

function drawNose(ctx: CanvasRenderingContext2D, s: number, eyeY: number) {
  // Nose bridge shadow
  ctx.strokeStyle = "rgba(180, 140, 110, 0.25)";
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(1 * s, eyeY + 6 * s);
  ctx.lineTo(2 * s, eyeY + 16 * s);
  ctx.stroke();

  // Nose tip
  ctx.strokeStyle = "rgba(180, 140, 110, 0.5)";
  ctx.lineWidth = 2 * s;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(2 * s, eyeY + 16 * s);
  ctx.quadraticCurveTo(6 * s, eyeY + 22 * s, 1 * s, eyeY + 22 * s);
  ctx.stroke();

  // Nostril hint
  ctx.fillStyle = "rgba(180, 140, 110, 0.2)";
  ctx.beginPath();
  ctx.ellipse(-3 * s, eyeY + 21 * s, 3 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(5 * s, eyeY + 21 * s, 3 * s, 1.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMouth(
  ctx: CanvasRenderingContext2D,
  s: number,
  mouthY: number,
  mouth: MouthState
) {
  const mouthW = 18 * s;
  const openness = mouth.openness;

  if (openness < 0.05) {
    // Closed — natural resting expression with lip shape
    // Upper lip
    ctx.fillStyle = LIPS;
    ctx.beginPath();
    ctx.moveTo(-mouthW, mouthY);
    ctx.quadraticCurveTo(-mouthW * 0.5, mouthY - 2 * s, 0, mouthY - 3 * s);
    ctx.quadraticCurveTo(mouthW * 0.5, mouthY - 2 * s, mouthW, mouthY);
    ctx.quadraticCurveTo(mouthW * 0.5, mouthY + 1 * s, 0, mouthY + 1.5 * s);
    ctx.quadraticCurveTo(-mouthW * 0.5, mouthY + 1 * s, -mouthW, mouthY);
    ctx.fill();

    // Lower lip hint
    ctx.fillStyle = LIPS_SHADOW;
    ctx.beginPath();
    ctx.moveTo(-mouthW * 0.7, mouthY + 1.5 * s);
    ctx.quadraticCurveTo(0, mouthY + 5 * s, mouthW * 0.7, mouthY + 1.5 * s);
    ctx.quadraticCurveTo(0, mouthY + 3 * s, -mouthW * 0.7, mouthY + 1.5 * s);
    ctx.fill();

    // Lip line
    ctx.strokeStyle = LIPS_SHADOW;
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(-mouthW + 2 * s, mouthY);
    ctx.quadraticCurveTo(0, mouthY + 2 * s, mouthW - 2 * s, mouthY);
    ctx.stroke();
  } else {
    // Open mouth — with teeth and tongue
    const mouthH = openness * 16 * s;

    // Mouth cavity (dark interior)
    ctx.fillStyle = MOUTH_INNER;
    ctx.beginPath();
    ctx.ellipse(0, mouthY + 2 * s, mouthW, mouthH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tongue (visible when wide open)
    if (openness > 0.3) {
      ctx.fillStyle = MOUTH_TONGUE;
      ctx.beginPath();
      ctx.ellipse(0, mouthY + mouthH * 0.4, mouthW * 0.6, mouthH * 0.4, 0, 0, Math.PI);
      ctx.fill();
    }

    // Top teeth (visible when open enough)
    if (openness > 0.15) {
      ctx.fillStyle = TEETH;
      ctx.beginPath();
      ctx.rect(-mouthW * 0.65, mouthY - mouthH * 0.1, mouthW * 1.3, Math.min(mouthH * 0.35, 5 * s));
      ctx.fill();
    }

    // Upper lip
    ctx.fillStyle = LIPS;
    ctx.beginPath();
    ctx.moveTo(-mouthW - 2 * s, mouthY - mouthH * 0.2);
    ctx.quadraticCurveTo(-mouthW * 0.5, mouthY - mouthH - 2 * s, 0, mouthY - mouthH - 3 * s);
    ctx.quadraticCurveTo(mouthW * 0.5, mouthY - mouthH - 2 * s, mouthW + 2 * s, mouthY - mouthH * 0.2);
    ctx.quadraticCurveTo(mouthW * 0.5, mouthY - mouthH * 0.5, 0, mouthY - mouthH * 0.3);
    ctx.quadraticCurveTo(-mouthW * 0.5, mouthY - mouthH * 0.5, -mouthW - 2 * s, mouthY - mouthH * 0.2);
    ctx.fill();

    // Lower lip
    ctx.fillStyle = LIPS;
    ctx.beginPath();
    ctx.moveTo(-mouthW, mouthY + mouthH * 0.6);
    ctx.quadraticCurveTo(0, mouthY + mouthH + 5 * s, mouthW, mouthY + mouthH * 0.6);
    ctx.quadraticCurveTo(0, mouthY + mouthH * 0.3, -mouthW, mouthY + mouthH * 0.6);
    ctx.fill();

    // Lower lip highlight
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.beginPath();
    ctx.ellipse(0, mouthY + mouthH + 1 * s, mouthW * 0.5, 2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}
