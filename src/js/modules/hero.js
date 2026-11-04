import { gsap, prefersReducedMotion, scrollTo } from '../core/motion.js';
import { heroCoverEnd } from '../core/layers.js';

/** Inner-page heroes: slow settle on entry, then a gentle push-in while the page covers the hero. */
export function initPageHero(ready) {
  const hero = document.querySelector('.page-hero, .studio-hero');
  if (!hero || prefersReducedMotion) return;
  const media = hero.querySelector('[data-page-hero-media] img');
  if (media) {
    gsap.set(media, { scale: 1.18 });
    ready.then(() => gsap.to(media, { scale: 1.04, duration: 2.6, ease: 'expo.out' }));
    const wrap = hero.querySelector('[data-page-hero-media]');
    gsap.fromTo(wrap, { scale: 1 }, { scale: 1.06, ease: 'none', scrollTrigger: { start: 0, end: heroCoverEnd(hero), scrub: true, invalidateOnRefresh: true } });
  }
}

/** Video hero: playback progress line and a slow push-in while the page covers it (see core/layers.js). */
export function initHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const video = hero.querySelector('[data-hero-video]');
  const progress = hero.querySelector('[data-hero-progress]');

  if (video && progress) {
    video.addEventListener('timeupdate', () => {
      if (video.duration) gsap.set(progress, { scaleX: video.currentTime / video.duration });
    });
    if (prefersReducedMotion) video.pause();
  }

  hero.querySelectorAll('[data-scroll-to]').forEach((btn) => btn.addEventListener('click', () => scrollTo(btn.dataset.scrollTo)));

  if (prefersReducedMotion) return;
  gsap.to(video, { scale: 1, duration: 2.6, ease: 'expo.out' });
  const frame = hero.querySelector('[data-hero-frame]');
  gsap.fromTo(frame, { scale: 1 }, { scale: 1.06, ease: 'none', scrollTrigger: { start: 0, end: heroCoverEnd(hero), scrub: true, invalidateOnRefresh: true } });
}
