// Pointer-driven pieces: cursor-following previews, day/night compare, film modal, accordions.
import { gsap, ScrollTrigger, isTouch, prefersReducedMotion, startScroll, stopScroll } from '../core/motion.js';

const mediaUrl = (key, width = 640) => `/media/${key}-${width}.webp`;

/** Rows with data-hover-img reveal a floating preview that trails the pointer. */
export function initHoverFollow() {
  if (isTouch) return;
  document.querySelectorAll('[data-hover-follow]').forEach((box) => {
    const section = box.closest('section') ?? document;
    const img = box.querySelector('img');
    gsap.set(box, { xPercent: -50, yPercent: -50, scale: 0.6 });
    const rows = section.querySelectorAll('[data-hover-img]');
    const xTo = gsap.quickTo(box, 'x', { duration: 0.7, ease: 'power3' });
    const yTo = gsap.quickTo(box, 'y', { duration: 0.7, ease: 'power3' });
    const rotTo = gsap.quickTo(box, 'rotate', { duration: 0.9, ease: 'power3' });
    let lastX = 0;
    rows.forEach((row) => {
      row.addEventListener('pointerenter', () => {
        img.src = mediaUrl(row.dataset.hoverImg);
        gsap.to(box, { opacity: 1, scale: 1, duration: 0.6, ease: 'expo.out' });
      });
      row.addEventListener('pointerleave', () => gsap.to(box, { opacity: 0, scale: 0.6, duration: 0.5, ease: 'expo.out' }));
      row.addEventListener('pointermove', (e) => {
        xTo(e.clientX);
        yTo(e.clientY);
        rotTo(gsap.utils.clamp(-12, 12, (e.clientX - lastX) * 0.6));
        lastX = e.clientX;
      });
    });
  });
}

/** Day/night slider: range input drives a CSS variable; sweeps once when it scrolls into view. */
export function initCompare() {
  document.querySelectorAll('[data-compare]').forEach((el) => {
    const range = el.querySelector('[data-compare-range]');
    const state = { pos: 50 };
    const apply = () => el.style.setProperty('--pos', `${state.pos}%`);
    range.addEventListener('input', () => {
      gsap.killTweensOf(state);
      state.pos = Number(range.value);
      apply();
    });
    if (prefersReducedMotion) return;
    ScrollTrigger.create({
      trigger: el,
      start: 'top 60%',
      once: true,
      onEnter: () =>
        gsap
          .timeline({ onUpdate: apply, onComplete: () => (range.value = String(Math.round(state.pos))) })
          .to(state, { pos: 82, duration: 1.4, ease: 'power3.inOut' }, 0.4)
          .to(state, { pos: 18, duration: 1.6, ease: 'power3.inOut' })
          .to(state, { pos: 50, duration: 1.2, ease: 'power3.inOut' }),
    });
  });
}

/** YouTube films open in a privacy-enhanced modal; thumbnails fall back if maxres is missing. */
export function initFilms() {
  document.querySelectorAll('[data-yt-thumb]').forEach((img) => {
    const fallback = () => {
      if (!img.src.includes('maxresdefault')) return;
      img.src = img.src.replace('maxresdefault', 'hqdefault');
    };
    img.addEventListener('error', fallback, { once: true });
    if (img.complete && img.naturalWidth === 120) fallback();
    img.addEventListener('load', () => img.naturalWidth === 120 && fallback());
  });

  const modal = document.querySelector('[data-vmodal]');
  if (!modal) return;
  const frame = modal.querySelector('[data-vm-frame]');
  const title = modal.querySelector('[data-vm-title]');
  let opener = null;

  const close = () => {
    modal.classList.remove('is-open');
    setTimeout(() => {
      frame.innerHTML = '';
      modal.hidden = true;
    }, 450);
    startScroll();
    opener?.focus({ preventScroll: true });
  };

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-film]');
    if (!trigger) return;
    e.preventDefault();
    opener = trigger;
    const id = encodeURIComponent(trigger.dataset.film);
    title.textContent = trigger.dataset.filmTitle || '';
    frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1" title="${title.textContent.replace(/"/g, '&quot;')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('is-open'));
    stopScroll();
    modal.querySelector('[data-vm-close]').focus({ preventScroll: true });
  });
  modal.querySelector('[data-vm-close]').addEventListener('click', close);
  modal.addEventListener('click', (e) => e.target === modal && close());
  document.addEventListener('keydown', (e) => e.key === 'Escape' && modal.classList.contains('is-open') && close());
}

/** Accessible accordion with animated height. */
export function initAccordions() {
  document.querySelectorAll('[data-accordion]').forEach((acc) => {
    acc.querySelectorAll('.accordion__item').forEach((item, i) => {
      const btn = item.querySelector('.accordion__btn');
      const panel = item.querySelector('.accordion__panel');
      const id = `acc-${Math.random().toString(36).slice(2, 8)}-${i}`;
      panel.id = id;
      btn.setAttribute('aria-controls', id);
      btn.setAttribute('aria-expanded', 'false');
      const set = (open) => {
        item.classList.toggle('is-open', open);
        btn.setAttribute('aria-expanded', String(open));
        gsap.to(panel, { height: open ? 'auto' : 0, duration: 0.7, ease: 'expo.out', onComplete: () => ScrollTrigger.refresh() });
      };
      btn.addEventListener('click', () => {
        const willOpen = !item.classList.contains('is-open');
        acc.querySelectorAll('.accordion__item.is-open').forEach((other) => other !== item && other.querySelector('.accordion__btn').click());
        set(willOpen);
      });
      if (item.hasAttribute('data-open')) set(true);
    });
  });
}
