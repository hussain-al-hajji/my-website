// مواسم الموقع: تُحسب من التاريخ الهجري (أم القرى) والتواريخ الثابتة. ?season=... للمعاينة.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let txt = null;
try { txt = JSON.parse(document.getElementById('seasons-data')?.textContent || 'null'); } catch (e) {}
if (txt && txt.enabled !== false) {
  const q = new URLSearchParams(location.search).get('season');
  const hijri = () => {
    try {
      const p = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { month: 'numeric', day: 'numeric' }).formatToParts(new Date());
      return [+p.find((x) => x.type === 'month').value, +p.find((x) => x.type === 'day').value];
    } catch (e) { return [0, 0]; }
  };
  const detect = () => {
    const [hm, hd] = hijri(), d = new Date(), m = d.getMonth() + 1, day = d.getDate();
    if (hm === 9) return 'ramadan';
    if (hm === 10 && hd <= 3) return 'fitr';
    if (hm === 12 && hd >= 9 && hd <= 13) return 'adha';
    if (m === 9 && day >= 21 && day <= 25) return 'national';
    if (m === 2 && day >= 20 && day <= 24) return 'founding';
    return '';
  };
  const s = ['ramadan', 'fitr', 'adha', 'national', 'founding'].includes(q) ? q : detect();
  if (s) {
    const root = document.documentElement; root.dataset.season = s;
    const msg = txt[s];
    let seen = false; try { seen = sessionStorage.getItem('ss-' + s) === '1'; } catch (e) {}
    if (msg && (!seen || q)) {
      const pill = document.createElement('div'); pill.className = 'season-pill'; pill.setAttribute('role', 'status'); pill.textContent = msg;
      document.body.appendChild(pill);
      requestAnimationFrame(() => pill.classList.add('on'));
      setTimeout(() => { pill.classList.remove('on'); setTimeout(() => pill.remove(), 800); }, 7000);
      try { sessionStorage.setItem('ss-' + s, '1'); } catch (e) {}
    }
    if (s === 'ramadan') {
      const w = document.createElement('div'); w.className = 'lanterns'; w.setAttribute('aria-hidden', 'true');
      const n = innerWidth < 600 ? 3 : 5;
      for (let i = 0; i < n; i++) {
        const l = document.createElement('span'); l.style.setProperty('--i', i); l.style.setProperty('--h', `calc(var(--bar) + ${46 + (i % 3) * 18}px)`);
        l.innerHTML = '<i></i><b></b>'; w.appendChild(l);
      }
      document.body.appendChild(w);
    }
    if ((s === 'fitr' || s === 'adha') && !reduce) {
      const c = document.createElement('canvas'); c.className = 'confetti'; c.setAttribute('aria-hidden', 'true'); document.body.appendChild(c);
      const x = c.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1);
      c.width = innerWidth * dpr; c.height = innerHeight * dpr;
      const cols = ['#e2b257', '#835410', '#0b6b4f', '#f4efe6', '#c48e44'];
      const ps = Array.from({ length: 90 }, () => ({ x: Math.random() * c.width, y: -Math.random() * c.height * 0.6, vx: (Math.random() - 0.5) * 1.6 * dpr, vy: (1.5 + Math.random() * 2.4) * dpr, r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.2, w: (5 + Math.random() * 6) * dpr, h: (3 + Math.random() * 4) * dpr, c: cols[Math.random() * cols.length | 0] }));
      const t0 = performance.now();
      const tick = (t) => {
        x.clearRect(0, 0, c.width, c.height);
        ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore(); });
        if (t - t0 < 6000 && ps.some((p) => p.y < c.height + 20)) requestAnimationFrame(tick); else c.remove();
      };
      requestAnimationFrame(tick);
    }
  }
}
