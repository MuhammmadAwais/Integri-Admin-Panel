import React, { useEffect, useRef } from "react";
import { useSelector } from "react-redux";

const ParticleBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDark = useSelector((state: any) => state.theme?.isDark);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let particles: Particle[] = [];
    let animationFrameId: number;
    let mouse = { x: -9999, y: -9999 }; // Initialize off-screen

    // --- CONFIGURATION ---
    const config = {
      // Restored count and speed for cool patterns
      particleCount: Math.min(window.innerWidth * 0.1, 150),
      connectionDist: 140,
      mouseDist: 180, // Distance for mouse interaction
      speed: 0.5, // Faster, more dynamic movement
      colors: {
        dark: {
          particle: "rgba(255, 255, 255, 0.6)", // Slightly transparent white
          line: "rgba(255, 255, 255, 0.12)", // Very faint lines
        },
        light: {
          // KEY FIX: Much lighter, subtle slate color for light mode
          particle: "rgba(148, 163, 184, 0.5)", // Slate-400 at 50% opacity
          line: "rgba(148, 163, 184, 0.08)", // Almost invisible lines
        },
      },
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      baseX: number;
      baseY: number;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.baseX = this.x;
        this.baseY = this.y;
        this.vx = (Math.random() - 0.5) * config.speed;
        this.vy = (Math.random() - 0.5) * config.speed;
        // KEY FIX: Smaller size (0.5px to 2px)
        this.size = Math.random() * 1.5 + 0.5;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off edges
        if (this.x < 0 || this.x > canvas!.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas!.height) this.vy *= -1;

        // Mouse Interaction (Gentle Repulsion/Wiggle)
        const dx = mouse.x - this.x;
        const dy = mouse.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < config.mouseDist) {
          const forceDirectionX = dx / distance;
          const forceDirectionY = dy / distance;
          const force = (config.mouseDist - distance) / config.mouseDist;

          // Gentle push away from mouse
          const directionX = forceDirectionX * force * 1;
          const directionY = forceDirectionY * force * 1;

          this.x -= directionX;
          this.y -= directionY;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? config.colors.dark.particle
          : config.colors.light.particle;
        ctx.fill();
      }
    }

    const init = () => {
      particles = [];
      for (let i = 0; i < config.particleCount; i++) {
        particles.push(new Particle());
      }
    };

    const drawConnections = () => {
      if (!ctx) return;
      for (let a = 0; a < particles.length; a++) {
        for (let b = a; b < particles.length; b++) {
          const dx = particles[a].x - particles[b].x;
          const dy = particles[a].y - particles[b].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < config.connectionDist) {
            const opacity = 1 - distance / config.connectionDist;
            // Dynamic opacity calculation
            const colorBase = isDark
              ? config.colors.dark.line
              : config.colors.light.line;
            // Extract the rgba values to inject calculated opacity
            // This assumes the format is "rgba(r, g, b, a)" in config
            // We replace the last value with our calculated opacity * base opacity
            const finalOpacity = opacity * (isDark ? 0.2 : 0.4);

            ctx.strokeStyle = colorBase.replace(
              /[\d.]+\)$/g,
              `${finalOpacity})`
            );
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[a].x, particles[a].y);
            ctx.lineTo(particles[b].x, particles[b].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        p.update();
        p.draw();
      });

      drawConnections();
      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseleave", handleMouseLeave);

    resize();
    init();
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseleave", handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isDark]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        transition: "opacity 0.5s ease",
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0
      }}
    />
  );
};

export default ParticleBackground;
