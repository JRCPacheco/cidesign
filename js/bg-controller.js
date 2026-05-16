/**
 * bg-controller.js — Controlador de Modo de Fundo
 *
 * Gerencia qual efeito de fundo está ativo (ondas laterais ou ripple de cima),
 * persiste a escolha em localStorage e injeta o seletor visual na página.
 *
 * Modos:
 *   'wave'   → wave-bg.js   (ondas laterais, padrão)
 *   'ripple' → ripple-bg.js (oceano visto de cima, pseudo-3D)
 *   'matrix' → matrix-bg.js (chuva de código azul — estilo Matrix)
 */
(function () {
  'use strict';

  const LS_KEY       = 'cidesign.bgMode';
  const DEFAULT_MODE = 'wave';
  const VALID_MODES  = ['wave', 'ripple', 'matrix'];

  // Captura o diretório base do script enquanto document.currentScript ainda é válido
  const SCRIPT_BASE = (function () {
    const s = document.currentScript;
    if (s && s.src) {
      return s.src.substring(0, s.src.lastIndexOf('/') + 1);
    }
    return 'js/';
  })();

  /* ── Persistência ─────────────────────────────────────────── */
  function readMode() {
    try {
      const v = localStorage.getItem(LS_KEY);
      return VALID_MODES.includes(v) ? v : DEFAULT_MODE;
    } catch (_) {
      return DEFAULT_MODE;
    }
  }

  function saveMode(m) {
    try { localStorage.setItem(LS_KEY, m); } catch (_) {}
  }

  let currentMode = readMode();

  /* ── CSS do switcher (e dos canvas) ──────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    /* Canvas de fundo — todos os modos */
    #wave-canvas,
    #ripple-canvas,
    #matrix-canvas {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
      will-change: contents;
      transition: opacity 550ms ease;
    }

    /* Matrix: cursor pointer para interação de clique */
    #matrix-canvas {
      pointer-events: auto;
      cursor: crosshair;
    }

    /* Fade-out ao trocar de modo */
    .bg-canvas-out {
      opacity: 0 !important;
      pointer-events: none;
    }

    /* ── Switcher ─────────────────────────────────────────── */
    #bg-switcher {
      position: fixed;
      bottom: 1.6rem;
      right: 1.6rem;
      z-index: 200;
      display: flex;
      align-items: center;
      border-radius: 14px;
      background: rgba(5, 14, 30, 0.80);
      backdrop-filter: blur(22px) saturate(140%);
      box-shadow:
        0 8px 28px rgba(1, 6, 18, 0.42),
        inset 0 1px 0 rgba(255, 255, 255, 0.07),
        inset 0 0 0 1px rgba(77, 121, 191, 0.18);
      opacity: 0.70;
      transition: opacity 200ms ease, box-shadow 200ms ease;
      overflow: hidden;
    }

    #bg-switcher:hover {
      opacity: 1;
      box-shadow:
        0 12px 36px rgba(1, 6, 18, 0.52),
        inset 0 1px 0 rgba(255, 255, 255, 0.10),
        inset 0 0 0 1px rgba(255, 204, 41, 0.24);
    }

    .bgsw-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      background: none;
      border: none;
      cursor: pointer;
      color: #5a718f;
      transition: color 160ms ease, background 160ms ease;
    }

    .bgsw-btn:focus-visible {
      outline: 2px solid rgba(255, 204, 41, 0.75);
      outline-offset: -2px;
      border-radius: 12px;
    }

    /* Modo ativo — destaque dourado */
    .bgsw-btn.active {
      color: #ffcc29;
      background: rgba(255, 204, 41, 0.09);
    }

    .bgsw-btn:not(.active):hover {
      color: #bcc8e4;
      background: rgba(255, 255, 255, 0.04);
    }

    /* Tooltip nativo aprimorado via CSS (visível no hover) */
    .bgsw-btn[title] { position: relative; }

    .bgsw-divider {
      width: 1px;
      height: 22px;
      background: rgba(77, 121, 191, 0.22);
      flex-shrink: 0;
    }
  `;
  document.head.appendChild(style);

  /* ── Carregamento dinâmico de scripts ────────────────────── */
  function loadScript(filename) {
    return new Promise((resolve, reject) => {
      const s   = document.createElement('script');
      s.src     = SCRIPT_BASE + filename;
      s.onload  = resolve;
      s.onerror = () => reject(new Error(`bg-controller: falha ao carregar ${filename}`));
      document.body.appendChild(s);
    });
  }

  function scriptFile(mode) {
    if (mode === 'ripple') return 'ripple-bg.js';
    if (mode === 'matrix') return 'matrix-bg.js';
    return 'wave-bg.js';
  }

  /* ── Construção do switcher ──────────────────────────────── */
  function buildSwitcher() {
    const el = document.createElement('div');
    el.id = 'bg-switcher';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Modo de fundo animado');

    // Ícone A — ondas laterais (linha sinusoidal dupla)
    const svgWave = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
      <path d="M2 11 C5.5 8, 8.5 8, 12 11 S18.5 14, 22 11"/>
      <path d="M2 16 C5.5 13, 8.5 13, 12 16 S18.5 19, 22 16" opacity="0.5"/>
    </svg>`;

    // Ícone B — ripple (círculos concêntricos)
    const svgRipple = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="2"/>
      <circle cx="12" cy="12" r="5.5" opacity="0.65"/>
      <circle cx="12" cy="12" r="9.5" opacity="0.30"/>
    </svg>`;

    // Ícone C — matrix (colunas verticais com setas de queda)
    const svgMatrix = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="6"  y1="2"  x2="6"  y2="14"/>
      <line x1="12" y1="5"  x2="12" y2="19"/>
      <line x1="18" y1="1"  x2="18" y2="11"/>
      <polyline points="4,11 6,14 8,11" opacity="0.85"/>
      <polyline points="10,16 12,19 14,16" opacity="0.85"/>
      <polyline points="16,8 18,11 20,8" opacity="0.85"/>
    </svg>`;

    el.innerHTML = `
      <button class="bgsw-btn ${currentMode === 'wave' ? 'active' : ''}"
              id="bgsw-wave"
              aria-pressed="${currentMode === 'wave'}"
              title="Ondas laterais">
        ${svgWave}
      </button>
      <div class="bgsw-divider" aria-hidden="true"></div>
      <button class="bgsw-btn ${currentMode === 'ripple' ? 'active' : ''}"
              id="bgsw-ripple"
              aria-pressed="${currentMode === 'ripple'}"
              title="Oceano (vista de cima)">
        ${svgRipple}
      </button>
      <div class="bgsw-divider" aria-hidden="true"></div>
      <button class="bgsw-btn ${currentMode === 'matrix' ? 'active' : ''}"
              id="bgsw-matrix"
              aria-pressed="${currentMode === 'matrix'}"
              title="Matrix (chuva de código)">
        ${svgMatrix}
      </button>
    `;

    document.body.appendChild(el);
    return el;
  }

  function updateButtons(newMode) {
    ['wave', 'ripple', 'matrix'].forEach((m) => {
      const btn = document.getElementById(`bgsw-${m}`);
      if (!btn) return;
      const isActive = m === newMode;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  /* ── Troca de modo ───────────────────────────────────────── */
  async function switchMode(newMode) {
    if (newMode === currentMode) return;

    // 1. Fade-out do canvas ativo
    const canvasIdMap = { wave: 'wave-canvas', ripple: 'ripple-canvas', matrix: 'matrix-canvas' };
    const oldCanvas   = document.getElementById(canvasIdMap[currentMode]);
    if (oldCanvas) {
      oldCanvas.classList.add('bg-canvas-out');
      await new Promise((r) => setTimeout(r, 520));
    }

    // 2. Destrói o modo atual (libera memória / listeners)
    if (currentMode === 'wave'   && window.WaveBg)   window.WaveBg.destroy();
    if (currentMode === 'ripple' && window.RippleBg) window.RippleBg.destroy();
    if (currentMode === 'matrix' && window.MatrixBg) window.MatrixBg.destroy();

    // 3. Atualiza estado
    currentMode = newMode;
    saveMode(newMode);
    updateButtons(newMode);

    // 4. Carrega e inicializa o novo modo
    try {
      await loadScript(scriptFile(newMode));
    } catch (err) {
      console.warn(err.message);
    }
  }

  /* ── Bootstrap ───────────────────────────────────────────── */
  async function init() {
    // Carrega o modo salvo
    try {
      await loadScript(scriptFile(currentMode));
    } catch (err) {
      console.warn(err.message);
    }

    // Injeta e conecta o switcher
    const sw = buildSwitcher();
    sw.querySelector('#bgsw-wave').addEventListener('click',   () => switchMode('wave'));
    sw.querySelector('#bgsw-ripple').addEventListener('click', () => switchMode('ripple'));
    sw.querySelector('#bgsw-matrix').addEventListener('click', () => switchMode('matrix'));
  }

  // Aguarda o DOM (seguro para uso com defer ou carregamento tardio)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
