"use client";

import { useRef, useEffect, useCallback } from "react";
import { AvatarAnimator } from "./AvatarAnimator";
import { LipSyncEngine } from "./LipSyncEngine";
import { drawPlaceholderAvatar } from "./PlaceholderAvatar";

interface AvatarCanvasProps {
  avatarState: string;
  amplitudeRef: React.MutableRefObject<number>;
  className?: string;
}

export default function AvatarCanvas({
  avatarState,
  amplitudeRef,
  className = "",
}: AvatarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animatorRef = useRef(new AvatarAnimator());
  const lipSyncRef = useRef(new LipSyncEngine());
  const lastTimeRef = useRef(performance.now());
  const frameIdRef = useRef(0);
  const prevStateRef = useRef(avatarState);

  // Trigger avatar state transition
  useEffect(() => {
    if (avatarState !== prevStateRef.current) {
      animatorRef.current.transitionTo(avatarState);
      prevStateRef.current = avatarState;
    }
  }, [avatarState]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    const delta = now - lastTimeRef.current;
    lastTimeRef.current = now;

    // Update animator
    const pose = animatorRef.current.update(now, delta);

    // Update lip sync from amplitude ref
    const mouthState = lipSyncRef.current.update(amplitudeRef.current);

    // Draw
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    if (
      canvas.width !== displayWidth * dpr ||
      canvas.height !== displayHeight * dpr
    ) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      ctx.scale(dpr, dpr);
    }

    drawPlaceholderAvatar(ctx, displayWidth, displayHeight, pose, mouthState);

    frameIdRef.current = requestAnimationFrame(render);
  }, [amplitudeRef]);

  useEffect(() => {
    frameIdRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frameIdRef.current);
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full ${className}`}
      style={{ imageRendering: "auto" }}
    />
  );
}
