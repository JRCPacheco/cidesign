/**
 * wave-bg.js — Modo A: Ondas Laterais
 *
 * Efeito de fundo com ondas sinusoidais em camadas que reagem ao mouse.
 * Expõe window.WaveBg.destroy() para o bg-controller.js poder desmontar o efeito.
 */
(function () {
  'use strict';

  /* ── Canvas ──────────────────────────────────────────────────── */
  const canvas = document.createElement('canvas');
  canvas.id = 'wave-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');

  /* ── Configuração das ondas ─────────────────────────────────── */
  const WAVES = [
    { speed: 0.00028, amplitude: 55, yFactor: 0.82, color: 'rgba(8, 20, 45, 0.98)',    lineWidth: 0   },
    { speed: 0.00042, amplitude: 42, yFactor: 0.87, color: 'rgba(12, 28, 60, 0.92)',   lineWidth: 0   },
    { speed: 0.00065, amplitude: 30, yFactor: 0.91, color: 'rgba(18, 38, 80, 0.82)',   lineWidth: 0   },
    { speed: 0.00095, amplitude: 20, yFactor: 0.95, color: 'rgba(28, 52, 102, 0.55)',  lineWidth: 1.2 },
    { speed: 0.00140, amplitude: 12, yFactor: 0.98, color: 'rgba(45, 75, 140, 0.22)',  lineWidth: 0.8 },
  ];

  /* ── Rastreamento do mouse com lerp ──────────────────────────── */
  let targetMX = 0.5, targetMY = 0.5;
  let currentMX = 0.5, currentMY = 0.5;
  const LERP_FACTOR = 0.04;

  /* Refs nomeadas para removeEventListener limpo */
  function onMouseMove(e) {
    targetMX = e.clientX / canvas.width;
    targetMY = e.clientY / canvas.height;
  }

  function onTouchMove(e) {
    const t = e.touches[0];
    if (t) {
      targetMX = t.clientX / canvas.width;
      targetMY = t.clientY / canvas.height;
    }
  }

  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });

  /* ── Resize (debounced) ─────────────────────────────────────── */
  let resizeTimer = null;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 100);
  }

  window.addEventListener('resize', onResize);
  resize();

  /* ── Redução de movimento ───────────────────────────────────── */
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ── Desenho de cada onda ───────────────────────────────────── */
  function drawWave(wave, t) {
    const W = canvas.width;
    const H = canvas.height;

    const mouseInfluenceY  = (currentMY - 0.5) * H * 0.06;
    const mouseAmpBoost    = 1 + (1 - Math.abs(currentMX - 0.5) * 2) * 0.28;
    const mouseSpeedOffset = (currentMX - 0.5) * 0.4;

    const baseY = H * wave.yFactor + mouseInfluenceY;
    const amp   = wave.amplitude * mouseAmpBoost;
    const phase = t * wave.speed + mouseSpeedOffset;
    const freq  = (2 * Math.PI) / (W * 0.6);

    ctx.beginPath();
    ctx.moveTo(0, H);

    for (let x = 0; x <= W; x += 3) {
      const y = baseY
        + Math.sin(x * freq + phase) * amp
        + Math.sin(x * freq * 1.7 + phase * 0.8) * amp * 0.35
        + Math.sin(x * freq * 0.4 + phase * 1.3) * amp * 0.2;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = wave.color;
    ctx.fill();

    if (wave.lineWidth > 0) {
      ctx.strokeStyle = wave.color;
      ctx.lineWidth   = wave.lineWidth;
      ctx.stroke();
    }
  }

  /* ── Loop de animação ───────────────────────────────────────── */
  let rafId = null;

  function render(timestamp) {
    if (prefersReducedMotion.matches) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      WAVES.forEach((w) => drawWave(w, 0));
      return;
    }

    currentMX += (targetMX - currentMX) * LERP_FACTOR;
    currentMY += (targetMY - currentMY) * LERP_FACTOR;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    WAVES.forEach((w) => drawWave(w, timestamp));
    rafId = requestAnimationFrame(render);
  }

  function onVisibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else {
      rafId = requestAnimationFrame(render);
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);

  prefersReducedMotion.addEventListener('change', () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(render);
  });

  rafId = requestAnimationFrame(render);

  /* ── API pública ────────────────────────────────────────────── */
  window.WaveBg = {
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(resizeTimer);
      canvas.remove();
      delete window.WaveBg;
    },
  };
})();
