// Canvas drawing for Whiteboard. Data: scenes.json (see docs/spec.md).
window.wb = (() => {
  const SPEED = 1, PAUSE = 1200; // points per frame, ms between steps
  let scenes = [], canvas, ctx, strokes = [], stepEnds = [], total = 0, cursor = 0, pauseUntil = 0, raf = 0;

  function colors() {
    const cs = getComputedStyle(document.documentElement);
    return [cs.getPropertyValue('--board').trim(), cs.getPropertyValue('--ink').trim()];
  }

  function fit() {
    if (!canvas) return;
    const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
    canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d);
    render();
  }

  function render() {
    if (!ctx) return;
    const [board, ink] = colors();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = board; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(canvas.width / 1000, 0, 0, canvas.height / 700, 0, 0);
    ctx.lineCap = ctx.lineJoin = 'round';
    ctx.strokeStyle = ctx.fillStyle = ink;
    let left = cursor;
    for (const s of strokes) {
      const p = s.p, n = p.length / 2, m = Math.min(left, n);
      left -= m;
      if (m >= 2) {
        ctx.beginPath(); ctx.moveTo(p[0], p[1]);
        for (let i = 1; i < m; i++) ctx.lineTo(p[2 * i], p[2 * i + 1]);
        ctx.lineWidth = s.w;
        if (s.f && m >= n) { ctx.closePath(); ctx.fill(); }
        ctx.stroke();
      }
      if (left <= 0) break;
    }
  }

  function tick(t) {
    raf = 0;
    if (cursor >= total) return;
    if (t >= pauseUntil) {
      const next = Math.min(cursor + SPEED, total);
      const end = stepEnds.find(e => e > cursor && e <= next);
      cursor = end ?? next;
      if (end !== undefined && end < total) pauseUntil = t + PAUSE;
      render();
    }
    raf = requestAnimationFrame(tick);
  }

  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render);
  addEventListener('resize', fit);

  return {
    async load(url) {
      scenes = await (await fetch(url)).json();
      for (const s of scenes) for (const st of s.steps.flat()) // points are stored as deltas
        for (let i = 2, p = st.p; i < p.length; i++) p[i] += p[i - 2];
      return scenes.map(s => ({ id: s.id, rank: s.rank, es: s.es, en: s.en, wrong: s.wrong }));
    },
    play(el, index) {
      stop();
      if (canvas !== el) { canvas = el; ctx = el.getContext('2d'); new ResizeObserver(fit).observe(el); }
      strokes = scenes[index].steps.flat();
      stepEnds = []; total = 0;
      for (const step of scenes[index].steps) { for (const s of step) total += s.p.length / 2; stepEnds.push(total); }
      cursor = 0; pauseUntil = 0;
      fit();
      raf = requestAnimationFrame(tick);
    },
    progress() { return total ? cursor / total : 1; },
    stop,
    finish() { stop(); cursor = total; render(); },
    setTheme(t) {
      if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
      render();
    },
    isDark() {
      const t = document.documentElement.dataset.theme;
      return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    }
  };
})();
