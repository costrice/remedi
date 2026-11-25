// ReMeDi project page: result grids with case switching, synchronized relit loops, and a synchronized magnifier.
(function () {
  'use strict';
  const C = window.CASES;
  const ROOT = 'static/results/';
  const ROWS = [
    { key: 'relit', label: 'Relit' },
    { key: 'C', label: 'Base color <i>C</i>' },
    { key: 'M', label: 'Metalness <i>M</i>' },
  ];

  // ---------- column layout of each set ----------
  function columns(set) {
    const meth = C.methods.map(m => ({ key: m.key, title: m.title, ours: m.key === 'ours' }));
    if (set === 'syn') return [{ key: 'input', title: 'Rendered input', input: true }, { key: 'GT', title: 'GT' }, ...meth];
    if (set === 'wild') return [{ key: 'input', title: 'In-the-wild input', input: true }, ...meth];
    return [{ key: 'input', title: 'Input image', input: true }, ...C.abl.map(a => ({ key: a.key, title: a.title, ours: a.key === 'ours' }))];
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function media(set, ckey, col, row) {
    const base = ROOT + set + '/' + (ckey ? ckey + '/' : '');
    if (col.input) return row === 'relit' ? img(base + 'input.webp') : null;     // the input sits in the first row only
    if (row === 'relit') {
      const v = document.createElement('video');
      v.src = base + col.key + '_relit.mp4';
      v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      return v;
    }
    return img(base + col.key + '_' + row + '.webp');
  }

  function img(src) {
    const i = new Image(); i.decoding = 'async'; i.draggable = false; i.src = src;
    return i;
  }

  // ---------- one grid ----------
  function build(block, set, ckey) {
    const grid = block.querySelector('.grid');
    const cols = columns(set);
    grid.innerHTML = '';
    grid.style.gridTemplateColumns = 'minmax(56px, 92px) repeat(' + cols.length + ', minmax(0, 1fr))';
    grid.appendChild(el('div'));
    cols.forEach(c => grid.appendChild(el('div', 'colhead' + (c.ours ? ' ours' : '') + (c.input ? ' input' : ''), c.title)));
    ROWS.forEach(r => {
      grid.appendChild(el('div', 'rowlab', r.label));
      cols.forEach(c => {
        const m = media(set, ckey, c, r.key);
        const cell = el('div', 'cell' + (c.ours ? ' ours' : '') + (m ? '' : ' empty'));
        if (m) cell.appendChild(m);
        grid.appendChild(cell);
      });
    });
    syncVideos(grid);
    attachZoom(grid);
  }

  // All loops of a case have the same length (36 frames at 12 fps); restart them together once all can play.
  function syncVideos(grid) {
    const vids = Array.from(grid.querySelectorAll('video'));
    let ready = 0;
    vids.forEach(v => {
      v.pause();
      const go = () => {
        if (++ready < vids.length) return;
        vids.forEach(x => { x.currentTime = 0; const p = x.play(); if (p) p.catch(() => {}); });
      };
      if (v.readyState >= 3) go(); else v.addEventListener('canplaythrough', go, { once: true });
    });
    // keep them in lockstep: follow the first one
    if (grid._sync) clearInterval(grid._sync);
    grid._sync = setInterval(() => {
      if (!document.body.contains(grid) || !vids.length) return;
      const t = vids[0].currentTime;
      vids.slice(1).forEach(v => { if (Math.abs(v.currentTime - t) > 0.12) v.currentTime = t; });
    }, 1000);
  }

  // Hover (or touch-drag) on any tile magnifies the same normalized position on every tile of the grid.
  function attachZoom(grid) {
    const cells = Array.from(grid.querySelectorAll('.cell:not(.empty)'));
    const set = (x, y) => {
      grid.style.setProperty('--zx', (x * 100).toFixed(2) + '%');
      grid.style.setProperty('--zy', (y * 100).toFixed(2) + '%');
      cells.forEach(c => {
        c.style.setProperty('--zx', (x * 100).toFixed(2) + '%');
        c.style.setProperty('--zy', (y * 100).toFixed(2) + '%');
      });
    };
    const pos = (e, cell) => {
      const r = cell.getBoundingClientRect();
      const p = e.touches ? e.touches[0] : e;
      return [Math.min(1, Math.max(0, (p.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (p.clientY - r.top) / r.height))];
    };
    cells.forEach(cell => {
      cell.addEventListener('mouseenter', e => { set(...pos(e, cell)); grid.classList.add('zoomed'); });
      cell.addEventListener('mousemove', e => set(...pos(e, cell)));
      cell.addEventListener('mouseleave', () => grid.classList.remove('zoomed'));
      cell.addEventListener('touchstart', e => { set(...pos(e, cell)); grid.classList.toggle('zoomed'); }, { passive: true });
      cell.addEventListener('touchmove', e => { if (grid.classList.contains('zoomed')) { set(...pos(e, cell)); e.preventDefault(); } }, { passive: false });
    });
  }

  // ---------- thumbnails ----------
  function thumbs(block, set, list) {
    const bar = block.querySelector('.thumbs');
    list.forEach((c, i) => {
      const b = el('button', 'thumb' + (i === 0 ? ' active' : ''));
      b.type = 'button'; b.title = c.title; b.setAttribute('role', 'tab'); b.setAttribute('aria-label', c.title);
      b.appendChild(img(ROOT + set + '/' + c.key + '/input.webp'));
      b.addEventListener('click', () => {
        bar.querySelectorAll('.thumb').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        build(block, set, c.key);
      });
      bar.appendChild(b);
    });
  }

  document.querySelectorAll('.result-block').forEach(block => {
    const set = block.dataset.set;
    if (set === 'abl') { build(block, 'abl', ''); return; }
    thumbs(block, set, C[set]);
    build(block, set, C[set][0].key);
  });

  // Only play loops that are on screen.
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(en => {
      en.target.querySelectorAll('video').forEach(v => {
        if (en.isIntersecting) { const p = v.play(); if (p) p.catch(() => {}); } else v.pause();
      });
    }), { rootMargin: '200px' });
    document.querySelectorAll('.grid').forEach(g => io.observe(g));
  }

  // ---------- BibTeX copy ----------
  const btn = document.querySelector('.copy');
  if (btn) btn.addEventListener('click', () => {
    const txt = document.getElementById('bibtex-code').innerText;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
      () => { btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = 'Copy'), 1500); },
      () => { btn.textContent = 'Select & copy'; });
  });
})();
