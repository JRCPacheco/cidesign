/**
 * ripple-bg.js — Modo B: Oceano Visto de Cima
 *
 * Simulação física de ondas 2D (equação de onda discreta) com renderização
 * pseudo-3D via normal mapping + iluminação Phong direta em pixel grid.
 *
 * - Mouse/touch cria ondulações proporcionais à velocidade do movimento
 * - Pseudo-3D: gradiente de altura → normal de superfície → difusa + especular
 * - Roda em grade reduzida (1/SCALE) e escala para a tela com bilinear
 * - prefers-reduced-motion, visibilitychange e touch suportados
 * - Expõe window.RippleBg.destroy() para o bg-controller.js
 */
(function () {
  'use strict';

  /* ── Canvas principal (tela cheia, fixo) ────────────────────── */
  const canvas = document.createElement('canvas');
  canvas.id = 'ripple-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  const ctx = canvas.getContext('2d');

  /* ── Canvas off-screen (grade de simulação) ─────────────────── */
  const offCanvas = document.createElement('canvas');
  const offCtx    = offCanvas.getContext('2d');

  /* ── Parâmetros da simulação ─────────────────────────────────── */
  const SCALE    = 4;      // resolução = tela / SCALE (ex: 1920/4 = 480)
  const DAMPING  = 0.982;  // dissipação de energia por frame (>1 = instável)
  const G_SCALE  = 0.32;   // intensidade do gradiente → efeito 3D

  /* ── Iluminação (Phong) ─────────────────────────────────────── */
  // Vetor de luz vindo de cima-esquerda, pre-normalizado
  const _lx = 0.30, _ly = -0.55, _lz = 1.0;
  const _ll = Math.sqrt(_lx * _lx + _ly * _ly + _lz * _lz);
  const LIGHT = [_lx / _ll, _ly / _ll, _lz / _ll];
  const SHININESS = 38;

  /* ── Paleta de cores (consistente com o design system) ─────── */
  //               R    G    B
  const C_DEEP = [  3,   7,  18 ]; // água calma/profunda   (~#03070) — quase preto-azul
  const C_MID  = [  8,  20,  55 ]; // nível médio           (#081437)
  const C_HIGH = [ 18,  48, 118 ]; // cristas das ondas     (#123076)
  const C_SPEC = [255, 208,  85 ]; // especular — tom dourado (#FFD055)

  /* ── Buffers de simulação ───────────────────────────────────── */
  let simW = 1, simH = 1;
  let buf0; // frame atual
  let buf1; // frame anterior
  let imgData; // ImageData reutilizado a cada frame

  function initBuffers() {
    simW = Math.ceil(canvas.width  / SCALE);
    simH = Math.ceil(canvas.height / SCALE);
    buf0 = new Float32Array(simW * simH);
    buf1 = new Float32Array(simW * simH);
    offCanvas.width  = simW;
    offCanvas.height = simH;
    imgData = offCtx.createImageData(simW, simH);
    // Pré-preenche o canal alpha (sempre 255, nunca muda)
    for (let i = 3; i < imgData.data.length; i += 4) {
      imgData.data[i] = 255;
    }
  }

  /* ── Resize (debounced) ─────────────────────────────────────── */
  let resizeTimer = null;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    initBuffers();
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  }

  window.addEventListener('resize', onResize);
  resize();

  /* ── Perturbação (mouse / touch) ────────────────────────────── */
  let prevX = -1, prevY = -1;

  function disturb(cx, cy, radiusPx, force) {
    const sx = Math.floor(cx / SCALE);
    const sy = Math.floor(cy / SCALE);
    const r  = Math.ceil(radiusPx / SCALE);

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > r) continue;
        const nx = sx + dx, ny = sy + dy;
        if (nx < 1 || nx >= simW - 1 || ny < 1 || ny >= simH - 1) continue;
        // Falloff quadrático para bordas suaves
        const f = (1 - d / r) * (1 - d / r);
        buf0[ny * simW + nx] += force * f;
      }
    }
  }

  function onMouseMove(e) {
    if (prevX >= 0) {
      const dx    = e.clientX - prevX;
      const dy    = e.clientY - prevY;
      const speed = Math.sqrt(dx * dx + dy * dy);
      if (speed > 1.5) {
        // Força proporcional à velocidade, limitada para não explodir a simulação
        disturb(e.clientX, e.clientY, 20, Math.min(speed * 0.3, 55));
      }
    }
    prevX = e.clientX;
    prevY = e.clientY;
  }

  function onTouchMove(e) {
    const t = e.touches[0];
    if (t) disturb(t.clientX, t.clientY, 26, 50);
  }

  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('touchmove',  onTouchMove,  { passive: true });

  /* ── Equação de onda ────────────────────────────────────────── */
  function simulate() {
    const W = simW, H = simH;

    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i   = y * W + x;
        // buf1 = frame anterior (será atualizado abaixo após swap)
        // Equação: new = (Σ 4 vizinhos / 2) - current  →  dissipa com damping
        const val = (
          buf1[i - 1] + buf1[i + 1] +
          buf1[i - W] + buf1[i + W]
        ) * 0.5 - buf0[i];
        buf0[i] = val * DAMPING;
      }
    }

    // Ping-pong: troca os buffers para o próximo frame
    const tmp = buf0;
    buf0 = buf1;
    buf1 = tmp;
  }

  /* ── Renderização por pixel (Phong pseudo-3D) ──────────────── */
  function renderPixels() {
    const W  = simW, H = simH;
    const b  = buf1; // buffer recém computado
    const px = imgData.data;

    const lx = LIGHT[0], ly = LIGHT[1], lz = LIGHT[2];

    for (let y = 1; y < H - 1; y++) {
      const row = y * W;
      for (let x = 1; x < W - 1; x++) {
        const i = row + x;

        // Gradiente de superfície → vetor normal perturbado
        const gdx = (b[i + 1] - b[i - 1]) * G_SCALE;
        const gdy = (b[i + W] - b[i - W]) * G_SCALE;
        const len = Math.sqrt(gdx * gdx + gdy * gdy + 1.0);
        const nx  = -gdx / len;
        const ny  = -gdy / len;
        const nz  =  1.0 / len;

        // Difusa: N · L
        const ndotl = Math.max(0.0, nx * lx + ny * ly + nz * lz);

        // Especular Phong: (R · V)^n  — V = [0,0,1] → só componente Z de R
        const rz   = 2.0 * ndotl * nz - lz;
        const spec = Math.pow(Math.max(0.0, rz), SHININESS);

        // Altura → claridade: apenas cristas positivas iluminam a superfície.
        // h=0 (calma) → t=0 (escuro). Sem altura negativa contribuir para brilho.
        const h   = b[i];
        const ht  = Math.max(0.0, Math.min(1.0, h / 26.0));

        // Difusa reduzida (0.22) para que superfície calma permaneça muito escura.
        // Cristas (ht > 0) são iluminadas pela componente ht * 0.78.
        const mix = Math.min(1.0, ndotl * 0.22 + ht * 0.78);

        // Interpola do escuro ao alto, depois adiciona especular dourado
        const sv = spec * 0.72;
        const pi = i * 4;
        px[pi]     = Math.min(255, (C_DEEP[0] + (C_HIGH[0] - C_DEEP[0]) * mix + C_SPEC[0] * sv) | 0);
        px[pi + 1] = Math.min(255, (C_DEEP[1] + (C_HIGH[1] - C_DEEP[1]) * mix + C_SPEC[1] * sv) | 0);
        px[pi + 2] = Math.min(255, (C_DEEP[2] + (C_HIGH[2] - C_DEEP[2]) * mix + C_SPEC[2] * sv) | 0);
        // [pi+3] = 255 já setado em initBuffers()
      }
    }

    offCtx.putImageData(imgData, 0, 0);

    // Escala para a tela completa com interpolação bilinear
    ctx.imageSmoothingEnabled  = true;
    ctx.imageSmoothingQuality  = 'medium';
    ctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height);
  }

  /* ── Loop principal ─────────────────────────────────────────── */
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rafId = null;

  function render() {
    simulate();
    renderPixels();
    if (!prefersReducedMotion.matches) {
      rafId = requestAnimationFrame(render);
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
    } else {
      rafId = requestAnimationFrame(render);
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);

  rafId = requestAnimationFrame(render);

  /* ── API pública ────────────────────────────────────────────── */
  window.RippleBg = {
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove',  onTouchMove);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(resizeTimer);
      canvas.remove();
      delete window.RippleBg;
    },
  };
})();
