// CIDesign — menu no celular, ano no rodapé e o segredo do Matrix.
(function () {
  'use strict';

  /* ── Menu no celular ─────────────────────────────────────── */
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.site-nav');
  if (toggle && nav) {
    const fechar = () => { toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('is-open'); };
    toggle.addEventListener('click', () => {
      const aberto = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!aberto));
      nav.classList.toggle('is-open', !aberto);
    });
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', fechar));
  }

  const ano = document.getElementById('current-year');
  if (ano) ano.textContent = new Date().getFullYear();

  /* ── Segredo: Matrix ─────────────────────────────────────────
     Liga com "iddqd" (modo deus do Doom), com o código Konami
     (↑↑↓↓←→←→BA) ou com um clique no título do Recreio.
     Esc ou o mesmo código desligam. O efeito só é baixado na
     primeira vez que alguém o descobre. */
  const SCRIPT = (function () {
    const s = document.currentScript;
    return s && s.src ? s.src.replace(/main\.js(\?.*)?$/, 'matrix-bg.js') : 'js/matrix-bg.js';
  })();
  const toast = document.querySelector('.toast');
  let toastTimer;

  function avisar(texto) {
    if (!toast) return;
    toast.textContent = texto;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
  }

  function flash() {
    const f = document.createElement('div');
    f.className = 'flash';
    document.body.appendChild(f);
    f.addEventListener('animationend', () => f.remove());
    setTimeout(() => f.remove(), 900);
  }

  function ligar() {
    if (window.MatrixBg) return;
    flash();
    document.body.classList.add('matrix');
    const s = document.createElement('script');
    s.src = SCRIPT;
    s.onerror = () => document.body.classList.remove('matrix');
    document.body.appendChild(s);
    avisar('Modo deus ativado. Esc para sair.');
  }

  function desligar() {
    if (!window.MatrixBg) return;
    window.MatrixBg.destroy();
    document.body.classList.remove('matrix');
    avisar('De volta ao mundo real.');
  }

  const alternar = () => (window.MatrixBg ? desligar() : ligar());

  const CODIGOS = [
    ['i', 'd', 'd', 'q', 'd'],
    ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'],
  ];
  let buffer = [];

  document.addEventListener('keydown', e => {
    const alvo = e.target;
    if (alvo && (alvo.isContentEditable || /^(input|textarea|select)$/i.test(alvo.tagName))) return;
    const tecla = (e.key || '').toLowerCase();
    if (tecla === 'escape') { desligar(); return; }
    buffer.push(tecla);
    if (buffer.length > 10) buffer = buffer.slice(-10);
    const casou = CODIGOS.some(c => c.every((k, i) => buffer[buffer.length - c.length + i] === k));
    if (casou) { buffer = []; alternar(); }
  });

  const recreio = document.querySelector('[data-easter="recreio"]');
  if (recreio) recreio.addEventListener('click', alternar);
})();
