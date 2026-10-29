import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Flip } from 'gsap/Flip';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText, Flip);
gsap.defaults({ ease: 'power3.out', duration: 1 });

export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;

/** @type {Lenis | null} */
export let lenis = null;

export function initSmoothScroll() {
  if (prefersReducedMotion) return null;
  lenis = new Lenis({ duration: 1.15, easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)), smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  if (import.meta.env.DEV) window.__lenis = lenis;
  return lenis;
}

/**
 * Scroll to a target (element, selector or y offset) through Lenis when active.
 * @param {HTMLElement | string | number} target
 */
export function scrollTo(target, options = {}) {
  if (lenis) {
    lenis.scrollTo(target, { offset: 0, duration: 1.4, ...options });
    return;
  }
  const y = typeof target === 'number' ? target : (typeof target === 'string' ? document.querySelector(target) : target)?.getBoundingClientRect().top + window.scrollY;
  window.scrollTo({ top: y ?? 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
}

export function stopScroll() {
  lenis?.stop();
  document.documentElement.style.overflow = 'hidden';
}

export function startScroll() {
  lenis?.start();
  document.documentElement.style.overflow = '';
}

export { gsap, ScrollTrigger, SplitText, Flip };
