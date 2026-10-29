import { gsap, ScrollTrigger } from '../core/motion.js';

/** Reading progress bar and table-of-contents highlighting. */
export function init() {
  const bar = document.querySelector('[data-reading-bar]');
  const prose = document.querySelector('.prose');
  if (bar && prose) {
    ScrollTrigger.create({ trigger: prose, start: 'top 30%', end: 'bottom bottom', onUpdate: (self) => gsap.set(bar, { scaleX: self.progress }) });
  }
  const links = [...document.querySelectorAll('[data-toc] a')];
  links.forEach((link) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    ScrollTrigger.create({
      trigger: target,
      start: 'top 40%',
      endTrigger: links[links.indexOf(link) + 1] ? document.querySelector(links[links.indexOf(link) + 1].getAttribute('href')) : prose,
      end: links[links.indexOf(link) + 1] ? 'top 40%' : 'bottom 40%',
      onToggle: (self) => self.isActive && links.forEach((l) => l.classList.toggle('is-active', l === link)),
    });
  });
}
