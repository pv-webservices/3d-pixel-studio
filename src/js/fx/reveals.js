// Declarative scroll effects driven by data-attributes, so pages stay plain HTML.
import { gsap, ScrollTrigger, SplitText, prefersReducedMotion } from '../core/motion.js';

const inHero = (el) => Boolean(el.closest('[data-hero]'));

/** Line-by-line masked text reveal. Hero copy waits for the entrance; the rest plays on scroll. */
function splitReveals(ready) {
  document.querySelectorAll('[data-split]').forEach((el) => {
    gsap.set(el, { visibility: 'visible' });
    if (prefersReducedMotion) return;
    const split = SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line-inner' });
    const tween = gsap.from(split.lines, {
      yPercent: 115,
      rotate: 2.5,
      transformOrigin: '0% 0%',
      duration: 1.3,
      stagger: 0.09,
      ease: 'expo.out',
      paused: true,
    });
    if (inHero(el)) ready.then(() => gsap.delayedCall(Number(el.dataset.delay) || 0, () => tween.play()));
    else ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => tween.play() });
  });
}

function fades(ready) {
  document.querySelectorAll('[data-fade]').forEach((el) => {
    if (prefersReducedMotion) return gsap.set(el, { opacity: 1 });
    const tween = gsap.fromTo(el, { opacity: 0, y: 36 }, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', paused: true });
    if (inHero(el)) ready.then(() => gsap.delayedCall((Number(el.dataset.delay) || 0) + 0.25, () => tween.play()));
    else ScrollTrigger.create({ trigger: el, start: 'top 92%', once: true, onEnter: () => tween.play() });
  });

  document.querySelectorAll('[data-stagger]').forEach((group) => {
    const items = group.children;
    if (prefersReducedMotion) return;
    gsap.set(items, { opacity: 0, y: 40 });
    ScrollTrigger.create({
      trigger: group,
      start: 'top 85%',
      once: true,
      onEnter: () => gsap.to(items, { opacity: 1, y: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out' }),
    });
  });
}

/** Curtain-style image reveals plus inner parallax. */
function imageReveals() {
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (prefersReducedMotion) return;
    const img = el.querySelector('img, video');
    const from = { up: 'inset(100% 0% 0% 0%)', left: 'inset(0% 100% 0% 0%)', right: 'inset(0% 0% 0% 100%)', center: 'inset(18% 18% 18% 18%)' }[el.dataset.reveal || 'up'];
    gsap
      .timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true } })
      .fromTo(el, { clipPath: from }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut' })
      .from(img, { scale: 1.35, duration: 2, ease: 'expo.out' }, '<0.15');
  });

  document.querySelectorAll('[data-parallax]').forEach((el) => {
    if (prefersReducedMotion) return;
    const target = el.querySelector('img, video') ?? el;
    const amount = Number(el.dataset.parallax) || 9;
    gsap.fromTo(target, { yPercent: -amount }, { yPercent: amount, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } });
  });

  document.querySelectorAll('[data-speed]').forEach((el) => {
    if (prefersReducedMotion) return;
    const speed = Number(el.dataset.speed);
    gsap.to(el, { y: () => -speed * window.innerHeight * 0.25, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true } });
  });
}

function counters() {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const end = Number(el.dataset.count);
    const format = (v) => Math.round(v).toLocaleString('en-IN');
    if (prefersReducedMotion) {
      el.textContent = format(end);
      return;
    }
    const state = { v: 0 };
    el.textContent = '0';
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () => gsap.to(state, { v: end, duration: 2.4, ease: 'expo.out', onUpdate: () => (el.textContent = format(state.v)) }),
    });
  });
}

function lines() {
  document.querySelectorAll('[data-line]').forEach((el) => {
    if (prefersReducedMotion) return;
    gsap.fromTo(el, { scaleX: 0 }, { scaleX: 1, duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: el, start: 'top 92%', once: true } });
  });
}

/** Words light up as the paragraph scrolls through the viewport. */
function scrubWords() {
  document.querySelectorAll('[data-scrub-words]').forEach((el) => {
    if (prefersReducedMotion) return;
    const split = SplitText.create(el, { type: 'words', wordsClass: 'scrub-word' });
    gsap.fromTo(
      split.words,
      { opacity: 0.14 },
      { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true } },
    );
  });
}

/** Infinite marquees that speed up and reverse with scroll velocity. */
function marquees() {
  document.querySelectorAll('[data-marquee]').forEach((el) => {
    const track = el.querySelector('.marquee__track');
    if (!track) return;
    const items = [...track.children];
    for (let guard = 0; track.offsetWidth < window.innerWidth * 1.2 && guard < 8; guard++) {
      items.forEach((item) => track.appendChild(item.cloneNode(true)));
    }
    const clone = track.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    el.appendChild(clone);
    if (prefersReducedMotion) return;
    const direction = el.dataset.marquee === 'right' ? 1 : -1;
    const speed = Number(el.dataset.marqueeSpeed) || 40;
    const tracks = [track, clone];
    let x = 0;
    let boost = 0;
    let width = track.offsetWidth;
    new ResizeObserver(() => (width = track.offsetWidth)).observe(track);
    ScrollTrigger.create({
      trigger: el,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => (boost = gsap.utils.clamp(-6, 6, self.getVelocity() / 300)),
    });
    gsap.ticker.add((_, delta) => {
      boost *= 0.94;
      const dir = direction * (boost < -0.5 ? -1 : 1);
      x += (dir * speed * (1 + Math.abs(boost)) * delta) / 1000;
      x = gsap.utils.wrap(-width, 0, x);
      gsap.set(tracks, { x });
    });
  });
}

function footer() {
  const mega = document.querySelector('[data-footer-mega]');
  if (!mega || prefersReducedMotion) return;
  gsap.from(mega.querySelectorAll('span'), {
    yPercent: 125,
    duration: 1.4,
    stagger: 0.12,
    ease: 'expo.out',
    scrollTrigger: { trigger: mega, start: 'top 95%', once: true },
  });

  const ctaMedia = document.querySelector('[data-cta-media] img');
  if (ctaMedia) {
    gsap.fromTo(ctaMedia, { scale: 1.25 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: ctaMedia.closest('.cta'), start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }
}

/** @param {Promise<void>} ready resolves when the preloader/transition has finished */
export function initReveals(ready) {
  splitReveals(ready);
  fades(ready);
  imageReveals();
  counters();
  lines();
  scrubWords();
  marquees();
  footer();
}
