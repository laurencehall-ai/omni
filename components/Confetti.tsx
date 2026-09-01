"use client";

// ─── Confetti ─────────────────────────────────────────────────────────────────
// Canvas-based confetti animation, shown when the admin validates a routing.
// Renders 180 particles that fall with gravity, rotate, and fade out.
// Calls onDone() when all particles have fully faded so the parent can unmount it.

import { useEffect, useRef } from "react";

// Each particle's mutable physics state — updated every animation frame
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number; // Velocity in x and y directions
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  shape: "rect" | "circle";
  alpha: number; // Opacity, fades to 0 after ~90 frames
}

const COLORS = [
  "#0070d2",
  "#00b4d8",
  "#f72585",
  "#4cc9f0",
  "#7209b7",
  "#ffd60a",
  "#06d6a0",
  "#ff6b35",
];

export default function Confetti({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Match canvas pixel size to viewport so particles cover the full screen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Spawn all particles above the viewport (negative y) with random offsets
    const particles: Particle[] = Array.from({ length: 180 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 8,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      shape: Math.random() > 0.4 ? "rect" : "circle",
      alpha: 1,
    }));

    let frame: number;
    let elapsed = 0;

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      elapsed++;

      let alive = 0; // Track how many particles are still visible
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.07; // Gravity — accelerates downward each frame
        p.rotation += p.rotationSpeed;
        if (elapsed > 90) p.alpha = Math.max(0, p.alpha - 0.012); // Start fading after 90 frames
        if (p.alpha > 0 && p.y < canvas.height + 20) alive++;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (alive > 0) {
        frame = requestAnimationFrame(draw);
      } else {
        onDone(); // All particles gone — signal parent to unmount the canvas
      }
    }

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [onDone]);

  // fixed + pointer-events-none so the canvas sits over everything but doesn't block clicks
  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
    />
  );
}
