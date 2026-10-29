import { gsap, prefersReducedMotion, scrollTo } from '../core/motion.js';

/** Inner-page heroes: slow settle on entry, parallax + drifting display word on scroll. */
export function initPageHero(ready) {
  const hero = document.querySelector('.page-hero, .studio-hero');
  if (!hero || prefersReducedMotion) return;
  const media = hero.querySelector('[data-page-hero-media] img');
  const mega = hero.querySelector('[data-page-hero-mega]');
  if (media) {
    gsap.set(media, { scale: 1.18 });
    ready.then(() => gsap.to(media, { scale: 1.04, duration: 2.6, ease: 'expo.out' }));
    gsap.to(media, { yPercent: 14, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  }
  if (mega) {
    gsap.from(mega, { xPercent: 12, opacity: 0, duration: 2, ease: 'expo.out', delay: 0.3 });
    gsap.to(mega, { xPercent: -14, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
  }
}

/** Video hero: playback progress line, cinematic "frame-in" as it scrolls away. */
export function initHero() {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const video = hero.querySelector('[data-hero-video]');
  const progress = hero.querySelector('[data-hero-progress]');
  const frame = hero.querySelector('[data-hero-frame]');
  const content = hero.querySelector('[data-hero-content]');

  if (video && progress) {
    video.addEventListener('timeupdate', () => {
      if (video.duration) gsap.set(progress, { scaleX: video.currentTime / video.duration });
    });
    if (prefersReducedMotion) video.pause();
  }

  hero.querySelectorAll('[data-scroll-to]').forEach((btn) => btn.addEventListener('click', () => scrollTo(btn.dataset.scrollTo)));

  if (prefersReducedMotion) return;
  gsap.to(video, { scale: 1, duration: 2.6, ease: 'expo.out' });

  gsap
    .timeline({ scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } })
    .to(frame, { clipPath: 'inset(4% 3% 10% 3% round 14px)', ease: 'none' }, 0)
    .to(content, { yPercent: -18, opacity: 0, ease: 'none' }, 0)
    .to(video, { yPercent: 12, ease: 'none' }, 0);
}
