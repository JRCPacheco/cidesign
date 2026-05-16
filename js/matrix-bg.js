/**
 * matrix-bg.js — Modo C: Chuva de Código (Matrix Azul)
 *
 * Efeito de colunas de caracteres caindo no estilo Matrix, mas com a
 * paleta de azuis do design system cidesign.net.br.
 *
 * - Colunas com head brilhante + corpo + cauda com fade gradual
 * - 20% de desfoque via filter: blur() no canvas
 * - Mouse/touch: hover aumenta brilho, click dispara aceleração radial
 * - prefers-reduced-motion, visibilitychange e touch suportados
 * - Expõe window.MatrixBg.destroy() para o bg-controller.js
 */
(function () {
  'use strict';

  /* ── Paleta de cores (consistente com wave-bg.js / ripple-bg.js) ── */
  const C_BG       = '#03070F';  // fundo: quase preto-azul (= C_DEEP)
  const C_TAIL     = '#081437';  // cauda: profundidade (= C_MID)
  const C_BODY     = '#123076';  // corpo: azul médio (= C_HIGH)
  const C_HEAD     = '#4D90FE';  // cabeça: azul elétrico brilhante
  const C_GLOW     = '#80B4FF';  // glow: tom mais claro para o bloom

  /* ── Set de caracteres ─────────────────────────────────────────── */
  // Hiragana completo
  const CHARS_HIRAGANA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ';
  // Katakana completo
  const CHARS_KATAKANA = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンガギグゲゴザジズゼゾダヂヅデドバビブベボパピプペポ';
  // Kanji selecionados (visualmente ricos e densos)
  const CHARS_KANJI    = '日月火水木金土年時分秒人山川海空雨風花草木石田心手目口耳足力刀弓矢文字雲雷光影夢幻生死愛憎善悪美醜強弱速遅高低明暗';
  const CHAR_SET       = (CHARS_HIRAGANA + CHARS_KATAKANA + CHARS_KANJI).split('');

  /* ── Parâmetros de animação ────────────────────────────────────── */
  const FONT_SIZE        = 16;          // px — tamanho do caractere (maior para kanji)
  const COL_WIDTH        = 18;          // px — largura compatível com glifos japoneses full-width
  const SPEED_MIN        = 80;          // px/s — coluna mais lenta
  const SPEED_MAX        = 220;         // px/s — coluna mais rápida
  const TRAIL_MIN        = 40;          // chars na trilha (mínimo) — 5× mais longa
  const TRAIL_MAX        = 100;         // chars na trilha (máximo) — 5× mais longa
  const CHAR_CHANGE_RATE = 0.06;        // prob. de trocar um char por frame
  const BLUR_AMOUNT      = '1px';       // ≈ 5% de desfoque visual
  const ACCEL_FACTOR     = 2.5;         // multiplicador de velocidade no click
  const ACCEL_DURATION   = 1500;        // ms de aceleração após click
  const ACCEL_RADIUS     = 180;         // px de raio da explosão no click
  const GLOW_DURATION    = 300;         // ms de glow extra no hover

  /* ── Canvas ────────────────────────────────────────────────────── */
  const canvas = document.createElement('canvas');
  canvas.id = 'matrix-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  // O desfoque é aplicado diretamente no canvas via CSS filter
  canvas.style.filter = `blur(${BLUR_AMOUNT})`;
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');

  /* ── Estado das colunas ────────────────────────────────────────── */
  let columns = [];     // array de objetos { x, y, speed, trail, chars, accelUntil, glowUntil }
  let numCols = 0;

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randChar() {
    return CHAR_SET[Math.floor(Math.random() * CHAR_SET.length)];
  }

  function createColumn(x, startOffscreen) {
    const trailLen = randInt(TRAIL_MIN, TRAIL_MAX);
    const speed    = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
    // Se startOffscreen, começa acima da tela para entrada escalonada
    const startY   = startOffscreen
      ? -trailLen * FONT_SIZE - Math.random() * canvas.height
      : Math.random() * canvas.height;

    const chars = [];
    for (let i = 0; i < trailLen; i++) {
      chars.push(randChar());
    }

    return { x, y: startY, speed, trail: trailLen, chars, accelUntil: 0, glowUntil: 0 };
  }

  function initColumns() {
    numCols = Math.floor(canvas.width / COL_WIDTH);
    columns = [];
    for (let i = 0; i < numCols; i++) {
      const x = i * COL_WIDTH + (COL_WIDTH - FONT_SIZE) / 2;
      columns.push(createColumn(x, true));
    }
  }

  /* ── Resize (debounced) ─────────────────────────────────────────── */
  let resizeTimer = null;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    initColumns();
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  }

  window.addEventListener('resize', onResize);
  resize();

  /* ── Interatividade: Mouse hover ────────────────────────────────── */
  let mouseX = -1, mouseY = -1;

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;

    // Destaca a coluna mais próxima do cursor
    for (const col of columns) {
      if (Math.abs(col.x - mouseX) < COL_WIDTH * 1.5) {
        col.glowUntil = performance.now() + GLOW_DURATION;
      }
    }
  }

  /* ── Interatividade: Click / Touch — explosão radial ────────────── */
  function triggerExplosion(cx, cy) {
    const now = performance.now();
    for (const col of columns) {
      const dx   = col.x - cx;
      const dy   = col.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < ACCEL_RADIUS) {
        // Aceleração inversamente proporcional à distância
        const factor = 1 + (ACCEL_FACTOR - 1) * (1 - dist / ACCEL_RADIUS);
        col._accelFactor = factor;
        col.accelUntil   = now + ACCEL_DURATION * (1 - dist / ACCEL_RADIUS * 0.5);
        col.glowUntil    = now + GLOW_DURATION * 2;
      }
    }
  }

  function onClick(e) {
    triggerExplosion(e.clientX, e.clientY);
  }

  function onTouchStart(e) {
    const t = e.touches[0];
    if (t) triggerExplosion(t.clientX, t.clientY);
  }

  function onTouchMove(e) {
    const t = e.touches[0];
    if (t) {
      mouseX = t.clientX;
      mouseY = t.clientY;
    }
  }

  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener('click',     onClick,     { passive: true });
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove',  onTouchMove,  { passive: true });

  /* ── Simulação ──────────────────────────────────────────────────── */
  function simulate(dt, now) {
    for (const col of columns) {
      // Velocidade com aceleração temporária
      let speed = col.speed;
      if (now < col.accelUntil && col._accelFactor) {
        // Lerp suave de retorno
        const t = (col.accelUntil - now) / ACCEL_DURATION;
        speed  *= 1 + (col._accelFactor - 1) * t;
      }

      col.y += speed * dt;

      // Troca aleatória de caracteres no corpo
      for (let i = 0; i < col.chars.length; i++) {
        if (Math.random() < CHAR_CHANGE_RATE) {
          col.chars[i] = randChar();
        }
      }

      // Reseta a coluna quando sai totalmente da tela
      if (col.y - col.trail * FONT_SIZE > canvas.height) {
        col.y          = -FONT_SIZE;
        col.speed      = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
        col.trail      = randInt(TRAIL_MIN, TRAIL_MAX);
        col.accelUntil = 0;
        col._accelFactor = 1;
        // Regenera chars para o novo comprimento
        col.chars = [];
        for (let i = 0; i < col.trail; i++) col.chars.push(randChar());
      }
    }
  }

  /* ── Renderização ───────────────────────────────────────────────── */
  function render(now) {
    const W = canvas.width;
    const H = canvas.height;

    // Limpa com fundo opaco da paleta
    ctx.fillStyle = C_BG;
    ctx.fillRect(0, 0, W, H);

    ctx.font = `bold ${FONT_SIZE}px 'Noto Sans JP', 'Yu Gothic', 'MS Gothic', 'Hiragino Kaku Gothic Pro', sans-serif`;
    ctx.textAlign = 'center';

    for (const col of columns) {
      const isGlowing = now < col.glowUntil;
      const trail     = col.trail;

      for (let i = 0; i < trail; i++) {
        // i = 0 → cabeça (mais baixo na tela), i = trail-1 → ponta da cauda (mais alto)
        const charY = col.y - i * FONT_SIZE;

        // Ignora caracteres fora da tela
        if (charY < -FONT_SIZE || charY > H + FONT_SIZE) continue;

        const char = col.chars[i] || randChar();

        if (i === 0) {
          /* ── Cabeça: brilhante com glow ── */
          ctx.shadowBlur  = isGlowing ? 18 : 10;
          ctx.shadowColor = isGlowing ? C_GLOW : C_HEAD;
          ctx.fillStyle   = isGlowing ? '#FFFFFF' : C_GLOW;
          ctx.globalAlpha = 1.0;
        } else {
          /* ── Corpo + cauda: gradiente de opacidade ── */
          ctx.shadowBlur  = 0;
          ctx.shadowColor = 'transparent';

          // t: 0 (logo após a cabeça) → 1 (fim da cauda)
          const t = i / (trail - 1);

          if (t < 0.35) {
            // Corpo superior — azul médio vibrante
            ctx.fillStyle   = C_BODY;
            ctx.globalAlpha = 0.85 - t * 1.2;
          } else if (t < 0.70) {
            // Corpo inferior — transição para azul escuro
            ctx.fillStyle   = C_TAIL;
            ctx.globalAlpha = 0.45 - (t - 0.35) * 0.9;
          } else {
            // Cauda — quase invisível
            ctx.fillStyle   = C_TAIL;
            ctx.globalAlpha = Math.max(0, 0.12 - (t - 0.70) * 0.4);
          }
        }

        ctx.fillText(char, col.x, charY);
      }
    }

    // Reset global alpha e shadow para não vazar para outros elementos
    ctx.globalAlpha = 1.0;
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';
  }

  /* ── Loop principal ─────────────────────────────────────────────── */
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let rafId    = null;
  let lastTime = null;

  function loop(timestamp) {
    const now = timestamp || performance.now();
    const dt  = lastTime !== null ? Math.min((now - lastTime) / 1000, 0.05) : 0;
    lastTime  = now;

    if (!prefersReducedMotion.matches) {
      simulate(dt, now);
    }

    render(now);

    if (!prefersReducedMotion.matches) {
      rafId = requestAnimationFrame(loop);
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      lastTime = null;
    } else {
      rafId = requestAnimationFrame(loop);
    }
  }

  document.addEventListener('visibilitychange', onVisibilityChange);

  prefersReducedMotion.addEventListener('change', () => {
    cancelAnimationFrame(rafId);
    lastTime = null;
    rafId = requestAnimationFrame(loop);
  });

  rafId = requestAnimationFrame(loop);

  /* ── API pública ────────────────────────────────────────────────── */
  window.MatrixBg = {
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove',   onMouseMove);
      window.removeEventListener('click',       onClick);
      window.removeEventListener('touchstart',  onTouchStart);
      window.removeEventListener('touchmove',   onTouchMove);
      window.removeEventListener('resize',      onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      clearTimeout(resizeTimer);
      canvas.remove();
      delete window.MatrixBg;
    },
  };
})();
