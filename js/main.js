// App screenshot carousel — infinite forward loop
(function () {
  const carousel = document.querySelector("#appCarousel");
  const track = document.querySelector("#carouselTrack");
  const dotsEl = document.querySelector("#carouselDots");
  const appNameEl = document.querySelector("#carouselAppName");
  const prevBtn = document.querySelector("#carouselPrev");
  const nextBtn = document.querySelector("#carouselNext");
  if (!track || !dotsEl) return;

  const realSlides = Array.from(track.querySelectorAll(".carousel-slide"));
  const totalReal = realSlides.length;

  // Clone all slides and append — enables seamless forward loop
  realSlides.forEach(s => track.appendChild(s.cloneNode(true)));

  const allSlides = Array.from(track.querySelectorAll(".carousel-slide"));
  let current = 0;
  let timer;

  allSlides.forEach(slide => {
    const img = slide.querySelector("img");
    if (img) img.addEventListener("error", () => { img.style.visibility = "hidden"; });
  });

  // Build dots for real slides only
  realSlides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.className = "carousel-dot" + (i === 0 ? " is-active" : "");
    dot.setAttribute("aria-label", "Slide " + (i + 1));
    dot.addEventListener("click", () => { goTo(i); resetAuto(); });
    dotsEl.appendChild(dot);
  });

  function computeOffset(idx) {
    const slideW = allSlides[0].offsetWidth;
    const gap = parseFloat(getComputedStyle(track).gap) || 20;
    const vpW = track.parentElement.offsetWidth;
    return idx * (slideW + gap) - (vpW / 2 - slideW / 2);
  }

  function updateMeta(realIdx) {
    dotsEl.querySelectorAll(".carousel-dot").forEach((d, i) => {
      d.classList.toggle("is-active", i === realIdx);
    });
    if (appNameEl) appNameEl.textContent = realSlides[realIdx].dataset.app || "";
  }

  function setPos(idx, animate) {
    track.style.transition = animate
      ? "transform 420ms cubic-bezier(0.4, 0, 0.2, 1)"
      : "none";
    track.style.transform = "translateX(" + (-computeOffset(idx)) + "px)";
  }

  function goTo(index, animate = true) {
    current = index;
    setPos(current, animate);
    updateMeta(current % totalReal);
  }

  // After reaching cloned zone, silently reset to real position
  track.addEventListener("transitionend", () => {
    if (current >= totalReal) {
      current = current % totalReal;
      setPos(current, false);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        track.style.transition = "transform 420ms cubic-bezier(0.4, 0, 0.2, 1)";
      }));
    }
  });

  function startAuto() { timer = setInterval(() => goTo(current + 1), 3500); }
  function resetAuto() { clearInterval(timer); startAuto(); }

  if (nextBtn) nextBtn.addEventListener("click", () => { goTo(current + 1); resetAuto(); });
  if (prevBtn) prevBtn.addEventListener("click", () => {
    goTo(current - 1 < 0 ? totalReal - 1 : current - 1);
    resetAuto();
  });

  const viewport = track.parentElement;
  viewport.addEventListener("mouseenter", () => clearInterval(timer));
  viewport.addEventListener("mouseleave", startAuto);

  // Wait for full layout before positioning — avoids wrong offsetWidth on DOMContentLoaded
  window.addEventListener("load", () => {
    goTo(0, false);
    if (carousel) carousel.classList.add("is-ready");
    startAuto();
  });

  // Recalculate on resize
  window.addEventListener("resize", () => setPos(current, false));
}());

const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const yearTarget = document.querySelector("#current-year");

if (yearTarget) {
  yearTarget.textContent = new Date().getFullYear();
}

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const expanded = navToggle.getAttribute("aria-expanded") === "true";
    navToggle.setAttribute("aria-expanded", String(!expanded));
    siteNav.classList.toggle("is-open", !expanded);
  });

  siteNav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navToggle.setAttribute("aria-expanded", "false");
      siteNav.classList.remove("is-open");
    });
  });
}
