/* app.js — interfaz. Depende de ranks.js (window.Ranks). */
(() => {
  'use strict';
  const { TIERS, MUSCLES, loadHevy, analyse } = Ranks;
  const $ = (s, el = document) => el.querySelector(s);
  const fmt = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const state = { rows: null, result: null, selected: null, view: 'front' };

  /* ---------- Figura (mitad derecha; la izquierda se espeja) ---------- */
  const SHOULDER = 'M174 86C192 82 210 92 216 112C218 124 214 134 208 140C200 128 190 118 176 112Z';
  const ARM = 'M208 140C216 128 222 120 224 114C230 130 232 160 230 184C224 192 216 192 210 186C206 170 204 154 208 140Z';
  const FOREARM = 'M212 192C220 196 228 194 232 188C240 214 246 240 244 262C238 266 232 264 230 260C222 240 214 216 212 192Z';
  const BASE = [
    'M139 62h22v22h-22Z',                                  // cuello
    'M151 84L176 90L196 120L194 200L198 216H151Z',          // torso
    'M236 262C246 262 252 274 250 288C246 298 238 298 234 288Z', // mano
    'M156 344C168 340 184 342 192 350L190 364H160Z',        // rodilla
    'M160 482C172 486 186 486 190 496C192 510 184 522 170 522C158 522 154 508 158 494Z' // pie
  ];
  const VIEWS = {
    front: [
      ['pecho', 'M151 92L174 87C186 94 192 108 190 120C184 132 166 136 151 134Z'],
      ['abdomen', 'M152 138C166 140 180 138 186 136C188 160 186 186 182 202C174 210 162 212 152 212Z'],
      ['biceps', ARM],
      ['antebrazo', FOREARM],
      ['hombros', SHOULDER],
      ['cuadriceps', 'M155 216C172 214 188 220 194 236C198 276 194 316 188 344C180 352 164 352 158 344C154 304 154 256 155 216Z'],
      ['aductores', 'M155 228L170 240C170 282 168 316 160 338C156 300 155 260 155 228Z'],
      ['gemelos', 'M161 362C176 358 188 362 190 372C190 410 186 450 180 484C172 490 164 488 162 482C158 440 158 400 161 362Z'],
    ],
    back: [
      ['espalda', 'M151 82L172 88C188 96 196 118 198 150C192 176 174 194 151 198Z'],
      ['triceps', ARM],
      ['antebrazo', FOREARM],
      ['hombros', SHOULDER],
      ['gluteos', 'M151 202C172 198 194 206 196 230C194 252 172 260 151 256Z'],
      ['isquios', 'M155 262C172 262 190 258 194 270C197 300 194 322 188 344C180 352 164 352 158 344C154 316 154 290 155 262Z'],
      ['gemelos', 'M161 360C176 356 188 360 190 372C192 404 188 440 180 476C172 482 164 480 162 474C158 432 156 396 161 360Z'],
    ],
  };

  function bodySVG(view) {
    const half = BASE.map(d => `<path class="base" d="${d}"/>`).join('') +
      VIEWS[view].map(([m, d]) => `<path class="m" data-m="${m}" d="${d}"><title>${MUSCLES[m]}</title></path>`).join('');
    const head = '<ellipse class="base" cx="150" cy="36" rx="21" ry="27"/>';
    return `${head}<g>${half}</g><g transform="translate(300 0) scale(-1 1)">${half}</g>`;
  }

  const gem = (c, size = 22) =>
    `<svg class="gem" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="--c:${c}">` +
    `<path d="M12 2 21 8.5 12 22 3 8.5Z" fill="${c}"/><path d="M3 8.5h18L12 22Z" fill="#000" opacity=".2"/>` +
    `<path d="M12 2 8 8.5h8Z" fill="#fff" opacity=".4"/></svg>`;

  const topLabel = s => (s >= 99 ? 'Top 1%' : `Top ${Math.max(1, Math.round(100 - s))}%`);

  /* ---------- Render ---------- */
  function render() {
    const r = state.result; if (!r) return;
    $('#result').hidden = false;

    // Figura
    const svg = $('#body');
    svg.innerHTML = bodySVG(state.view);
    svg.querySelectorAll('.m').forEach(el => {
      const m = r.muscles[el.dataset.m];
      if (m) { el.classList.add('has'); el.style.fill = TIERS[m.tier].color; el.style.setProperty('--c', TIERS[m.tier].color); }
      el.querySelector('title').textContent = m ? `${MUSCLES[el.dataset.m]}: ${TIERS[m.tier].name}` : `${MUSCLES[el.dataset.m]}: sin datos`;
      if (el.dataset.m === state.selected) el.classList.add('sel');
    });

    // Resumen general
    const o = r.overall, t = TIERS[o.tier];
    $('#overall').style.setProperty('--c', t.color);
    $('#overall').innerHTML = `${gem(t.color, 64)}
      <div class="tier">${t.name}</div>
      <div class="pct">Rango general · ${topLabel(o.score)} (percentil estimado ${fmt.format(o.score)})</div>
      <div class="chips">
        <span class="chip">Simetría <b>${r.symmetry ?? '–'}${r.symmetry != null ? '/100' : ''}</b></span>
        <span class="chip">Músculos con datos <b>${o.count}/${o.total}</b></span>
        ${r.weakest ? `<span class="chip">Punto débil <b>${MUSCLES[r.weakest.id]}</b></span>` : ''}
      </div>`;

    // Lista de músculos
    $('#muscles').innerHTML = Object.keys(MUSCLES).map(id => {
      const m = r.muscles[id], tc = m ? TIERS[m.tier].color : null;
      return `<li><button type="button" data-m="${id}" class="${id === state.selected ? 'sel' : ''}" style="${tc ? `--c:${tc}` : ''}">
        ${m ? gem(tc, 20) : '<span></span>'}
        <span class="name">${MUSCLES[id]}</span>
        <span class="bar"><i style="width:${m ? Math.max(3, m.score) : 0}%"></i></span>
        <span class="rk">${m ? TIERS[m.tier].name : 'Sin datos'}</span></button></li>`;
    }).join('');

    // Leyenda de rangos
    $('#legend').innerHTML = TIERS.map((tr, i) => `<li class="${i === o.tier ? 'cur' : ''}" style="--c:${tr.color}">
      ${gem(tr.color, 30)}<strong>${tr.name}</strong><span>${tr.min === 0 ? 'Inicio' : 'Top ' + (100 - tr.min) + '%'}</span></li>`).join('');

    renderDetail();
    renderTable();
  }

  function renderDetail() {
    const r = state.result, id = state.selected, box = $('#detail');
    if (!id) {
      box.innerHTML = `<h2>Toca un músculo</h2><p>Pulsa en la figura o en la lista para ver qué ejercicios lo puntúan y cuánto te falta para el siguiente rango.</p>`;
      return;
    }
    const m = r.muscles[id];
    if (!m) {
      box.innerHTML = `<h2>${MUSCLES[id]}</h2><p>No hay series válidas para este músculo en el periodo elegido. Prueba con "Todo el historial" o entrena alguno de sus ejercicios.</p>`;
      return;
    }
    const t = TIERS[m.tier];
    box.innerHTML = `<h2 style="color:${t.color}">${MUSCLES[id]} · ${t.name}</h2>
      <p>La puntuación del músculo es la media ponderada (50/30/20) de sus tres mejores ejercicios.</p>
      <ul class="exlist">${m.list.map(e => {
        const et = TIERS[e.tier];
        const n = e.next
          ? `Para ${e.next.tier.name}: ≈ ${fmt.format(e.next.weight)} kg${e.bw ? ' de lastre' : ''} × ${e.next.reps}`
          : 'Rango máximo alcanzado';
        return `<li style="--c:${et.color}"><span class="en">${esc(e.name)}</span><span class="rk">${et.name}</span>
          <span class="sub">Mejor serie ${fmt.format(e.best.w)} kg × ${e.best.reps} · ${n}${e.guessed ? ' · ejercicio no catalogado, estimación aproximada' : ''}</span></li>`;
      }).join('')}</ul>`;
  }

  function renderTable() {
    const r = state.result;
    $('#exCount').textContent = r.exercises.length;
    $('#exTable tbody').innerHTML = r.exercises.map(e => {
      const t = TIERS[e.tier];
      return `<tr style="--c:${t.color}"><td>${esc(e.name)}</td><td>${MUSCLES[e.muscle]}</td>
        <td>${fmt.format(e.best.w)} kg × ${e.best.reps}</td><td>${fmt.format(e.best.e1rm)} kg</td>
        <td><span class="dot"></span>${t.name}</td></tr>`;
    }).join('');
    $('#unknown').textContent = r.unknown.length
      ? `Ejercicios sin catalogar (no puntúan): ${r.unknown.slice(0, 12).map(([n]) => n).join(', ')}${r.unknown.length > 12 ? '…' : ''}. Puedes añadirlos en ranks.js.`
      : '';
  }

  /* ---------- Cálculo ---------- */
  function showError(msg) {
    const el = $('#error'); el.hidden = !msg; el.textContent = msg || '';
  }
  function recompute() {
    if (!state.rows) return;
    const bw = parseFloat($('#bw').value);
    if (!(bw >= 30 && bw <= 250)) { showError('Indica un peso corporal entre 30 y 250 kg.'); return; }
    showError('');
    const sex = document.querySelector('input[name=sex]:checked').value;
    state.result = analyse(state.rows, { bodyweight: bw, sex, days: +$('#period').value });
    if (!state.result.exercises.length) {
      $('#result').hidden = true;
      showError('No he encontrado series puntuables en el periodo elegido. Prueba con "Todo el historial".');
      return;
    }
    try { localStorage.setItem('ranks-prefs', JSON.stringify({ bw, sex })); } catch (_) { /* sin almacenamiento */ }
    render();
  }

  function useCSV(text, label) {
    try { state.rows = loadHevy(text); } catch (e) { state.rows = null; $('#result').hidden = true; showError(e.message); return; }
    $('#drop').classList.add('loaded');
    $('#dropTitle').textContent = label;
    $('#dropHint').textContent = `${state.rows.length.toLocaleString('es-ES')} filas leídas. Puedes cambiar el archivo cuando quieras.`;
    recompute();
  }

  /* ---------- Datos de ejemplo ---------- */
  function demoCSV() {
    // Cada vez se genera un perfil distinto: nivel global, nivel por ejercicio, progresión y ejercicios elegidos al azar.
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
    const lifts = [
      ['Bench Press (Barbell)', 82, 6], ['Squat (Barbell)', 110, 6], ['Lat Pulldown (Cable)', 75, 10], ['Shoulder Press (Dumbbell)', 26, 8],
      ['Bicep Curl (Barbell)', 35, 10], ['Triceps Pushdown', 40, 10], ['Seated Leg Curl (Machine)', 65, 10], ['Calf Extension (Machine)', 120, 12],
      ['Leg Press (Machine)', 220, 10], ['Seated Cable Row - Bar Grip', 70, 10], ['Hip Thrust (Barbell)', 110, 8], ['Crunch (Machine)', 45, 12],
      ['Incline Bench Press (Dumbbell)', 30, 8], ['Butterfly (Pec Deck)', 70, 12], ['Lateral Raise (Cable)', 12, 12], ['Hip Adduction (Machine)', 90, 12],
      ['Leg Extension (Machine)', 80, 12], ['Deadlift (Barbell)', 130, 5], ['Preacher Curl (Machine)', 40, 10], ['Triceps Extension (Cable)', 30, 10],
    ];
    const level = rnd(0.55, 1.5);                 // nivel general del "atleta" de ejemplo
    const weeks = Math.floor(rnd(8, 40));         // duración del historial
    const chosen = pick(lifts, Math.floor(rnd(9, lifts.length + 1)))
      .map(([n, w, r]) => [n, Math.round(w * level * rnd(0.6, 1.4) * 2) / 2, r]);
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const out = ['title,start_time,exercise_title,set_index,set_type,weight_kg,reps'];
    for (let wk = 0; wk < weeks; wk++) {
      const day = 1 + (wk * 7) % 28, mon = months[Math.floor(wk / 4) % 12], yr = 2025 + Math.floor(wk / 48);
      chosen.forEach(([n, w, r]) => {
        const wt = Math.round((w * (1 + wk * 0.006) + rnd(-1.5, 1.5)) * 2) / 2;
        for (let s = 0; s < 3; s++) out.push(`Demo,"${day} ${mon} ${yr}, 10:00","${n}",${s},normal,${Math.max(2.5, wt)},${Math.max(3, r - s + Math.round(rnd(-1, 1)))}`);
      });
    }
    return out.join('\n');
  }

  /* ---------- Eventos ---------- */
  $('#file').addEventListener('change', async e => {
    const f = e.target.files[0]; if (f) useCSV(await f.text(), f.name);
  });
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', async e => { const f = e.dataTransfer.files[0]; if (f) useCSV(await f.text(), f.name); });
  $('#demo').addEventListener('click', () => useCSV(demoCSV(), 'Datos de ejemplo'));
  ['#bw', '#period'].forEach(s => $(s).addEventListener('input', recompute));
  document.querySelectorAll('input[name=sex]').forEach(i => i.addEventListener('change', recompute));

  document.querySelectorAll('.viewtoggle button').forEach(b => b.addEventListener('click', () => {
    state.view = b.dataset.view;
    document.querySelectorAll('.viewtoggle button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    render();
  }));
  function select(id) {
    state.selected = state.selected === id ? null : id; render();
  }
  $('#body').addEventListener('click', e => { const m = e.target.closest('.m'); if (m) select(m.dataset.m); });
  $('#muscles').addEventListener('click', e => { const b = e.target.closest('button'); if (b) select(b.dataset.m); });

  // Preferencias guardadas
  try {
    const p = JSON.parse(localStorage.getItem('ranks-prefs') || 'null');
    if (p) { $('#bw').value = p.bw; (p.sex === 'f' ? $('#sexF') : $('#sexM')).checked = true; }
  } catch (_) { /* ignorar */ }
})();
