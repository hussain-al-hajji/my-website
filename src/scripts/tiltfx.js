// إمالة الجوال: يحرّك اللمعان مع حركة الجهاز. على iOS يُطلب الإذن عند أول لمسة على العنصر نفسه فقط.
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const subs = new Set();
let started = false;
const handle = (e) => {
  if (e.gamma == null || e.beta == null) return;
  const x = clamp(0.5 + e.gamma / 50), y = clamp(0.5 + (e.beta - 40) / 50);
  subs.forEach((f) => f(x, y));
};
const start = () => { if (!started) { started = true; addEventListener('deviceorientation', handle, { passive: true }); } };
export function onTilt(el, cb) {
  if (!el || !matchMedia('(pointer:coarse)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  subs.add(cb);
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    el.addEventListener('pointerdown', () => { DeviceOrientationEvent.requestPermission().then((r) => { if (r === 'granted') start(); }).catch(() => {}); }, { once: true });
  } else start();
}
