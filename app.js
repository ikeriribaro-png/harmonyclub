/* app.js — interfaz. Depende de ranks.js (window.Ranks). */
(() => {
  'use strict';
  const { TIERS, MUSCLES, LOWER, loadHevy, analyse, summary, e1rm, scoreFromRatio, ratioFromScore, tierIndex, formatDate, exportSummary } = Ranks;
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const n1 = x => x.toFixed(1);

  const state = { rows: null, result: null, v: {}, selected: null, view: 'front', guide: {}, sim: {} };

  /* ---------- Notificaciones Toast ---------- */
  function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = 'toast' + (type !== 'info' ? ' ' + type : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; }, 2500);
    setTimeout(() => t.remove(), 3000);
  }

  /* ---------- Historial ---------- */
  function saveHistory() {
    if (!state.result) return;
    const bw = bodyweight();
    const entry = Ranks.exportSummary ? Ranks.exportSummary(state.result, bw) : null;
    if (!entry) return;
    let hist = []; try { hist = JSON.parse(localStorage.getItem('ranks-history') || '[]'); } catch(_) {}
    hist.push(entry);
    if (hist.length > 50) hist = hist.slice(-50);
    try { localStorage.setItem('ranks-history', JSON.stringify(hist)); } catch(_) {}
  }
  function renderHistory() {
    const el = document.querySelector('#historyList'); if (!el) return;
    const histSec = document.querySelector('#history');
    let hist = []; try { hist = JSON.parse(localStorage.getItem('ranks-history') || '[]'); } catch(_) {}
    if (!hist.length) { if (histSec) histSec.hidden = true; return; }
    if (histSec) histSec.hidden = false;
    el.innerHTML = hist.slice().reverse().slice(0, 10).map(h => {
      const d = Ranks.formatDate ? Ranks.formatDate(h.date) : new Date(h.date).toLocaleDateString();
      return '<div class="history-item"><span class="date">' + esc(d) + '</span><span class="rank" style="color:' + (TIERS.find(t=>t.name===h.globalTier)||TIERS[0]).color + '">' + esc(h.globalTier) + ' · ' + h.global + '</span><span>Sim: ' + (h.symmetry != null ? h.symmetry + '%' : '–') + '</span></div>';
    }).join('');
    renderProgressChart(hist);
  }
  function renderProgressChart(hist) {
    const canvas = document.querySelector('#progressChart'); if (!canvas) return;
    if (hist.length < 2) { canvas.style.display = 'none'; return; }
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || 400, H = canvas.clientHeight || 180;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const pad = { l: 36, r: 12, t: 12, b: 24 };
    const w = W - pad.l - pad.r, plotH = H - pad.t - pad.b;
    // Tier threshold lines
    ctx.setLineDash([4, 4]); ctx.lineWidth = 0.5;
    for (const tier of TIERS) {
      if (tier.min <= 0) continue;
      const y = pad.t + plotH - (tier.min / 100) * plotH;
      ctx.strokeStyle = tier.color + '44'; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + w, y); ctx.stroke();
      ctx.fillStyle = tier.color + '88'; ctx.font = '9px Inter,sans-serif'; ctx.fillText(tier.name, 2, y + 3);
    }
    ctx.setLineDash([]);
    // Data line
    ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = '#38b6ff';
    ctx.beginPath();
    hist.forEach((item, i) => {
      const x = pad.l + (i / (hist.length - 1)) * w;
      const y = pad.t + plotH - (item.global / 100) * plotH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Dots
    hist.forEach((item, i) => {
      const x = pad.l + (i / (hist.length - 1)) * w;
      const y = pad.t + plotH - (item.global / 100) * plotH;
      const tierIdx = Ranks.tierIndex(item.global);
      ctx.fillStyle = TIERS[tierIdx].color;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#0b1020'; ctx.lineWidth = 1.5; ctx.stroke();
    });
  }

  /* ---------- Medallas ---------- */
  const SHAPES = {
    bronce: 'M12 2 20.5 5v7.2c0 4.6-3.6 7.8-8.5 9.8-4.9-2-8.5-5.2-8.5-9.8V5Z',
    plata: 'M12 1.5 22.5 12 12 22.5 1.5 12Z',
    oro: 'M12 2 22 9.4 18.2 21H5.8L2 9.4Z',
    rubi: 'M8 2h8l6 6v8l-6 6H8l-6-6V8Z',
    esmeralda: 'M12 1.8 21.2 7v10L12 22.2 2.8 17V7Z',
    diamante: 'M6.8 3h10.4L22 9.2 12 21.5 2 9.2Z',
    maestro: 'M2.5 19 1.8 7.5 7 11.5 12 3.5l5 8 5.2-4-.7 11.5Z',
    top1: 'M12 1.8a10.2 10.2 0 1 0 0 20.4 10.2 10.2 0 0 0 0-20.4Z',
  };
  const STAR = 'M12 6.6l1.6 3.8 3.8 1.6-3.8 1.6L12 17.4l-1.6-3.8L6.6 12l3.8-1.6Z';
  const gem = (tierId, size = 28) => {
    const t = TIERS.find(x => x.id === tierId) || TIERS[0];
    return `<svg class="gem" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
      <path d="${SHAPES[t.id]}" fill="${t.color}" stroke="rgba(255,255,255,.6)" stroke-width="1" stroke-linejoin="round"/>
      <path d="${SHAPES[t.id]}" fill="#000" opacity=".16" transform="translate(0 7) scale(1 .42) translate(0 -2)" style="clip-path:inset(0)"/>
      ${t.id === 'maestro' ? '' : `<path d="${STAR}" fill="#fff" opacity=".92"/>`}</svg>`;
  };
  const tierLabel = i => (TIERS[i].id === 'top1' ? 'TOP 1%' : `${TIERS[i].name.toUpperCase()} (${TIERS[i].top}%)`);

  /* ---------- Figura Anatómica Esculpida (mitad derecha; la izquierda se espeja) ---------- */
  const SHOULDER_FRONT = 'M 154 74 C 168 73 186 84 188 98 C 189 108 183 118 174 122 C 167 114 162 102 157 88 Z';
  const SHOULDER_BACK  = 'M 154 72 C 170 73 188 84 188 100 C 188 112 181 120 173 122 C 166 112 161 98 156 84 Z';

  const BICEPS = 'M 170 120 C 173 133 175 146 177 158 C 182 161 187 159 189 155 C 196 142 196 128 188 118 C 182 117 175 118 170 120 Z';
  const TRICEPS = 'M 170 119 C 173 132 175 148 178 160 C 184 163 189 160 190 156 C 198 140 197 125 188 116 C 181 116 175 117 170 119 Z';

  const FOREARM = 'M 180 162 C 193 166 206 182 208 202 C 209 216 206 226 202 230 L 194 227 C 189 216 182 188 179 162 Z';

  const BASE = [
    // Torso interior / caja torácica
    'M 121 64 C 136 65 154 75 160 88 C 166 102 165 120 162 144 C 158 172 154 200 152 224 L 121 224 Z',
    // Cuello
    'M 121 46 C 127 47 132 50 134 65 L 121 66 Z',
    // Mano
    'M 201 232 C 206 234 212 238 214 246 C 215 252 210 256 205 256 C 200 254 196 248 193 238 C 196 234 199 232 201 232 Z',
    // Rótula / articulación rodilla
    'M 132 331 C 144 331 155 331 156 348 C 156 352 132 352 132 348 Z',
    // Tibia
    'M 131 353 L 138 353 C 139 390 139 428 135 454 L 129 454 Z',
    // Pie
    'M 133 456 C 144 456 154 456 157 463 C 159 470 156 476 146 478 L 128 478 C 126 474 128 464 133 456 Z',
  ];

  const VIEWS = {
    front: [
      ['espalda', 'M 121.5 56 C 128 58 138 64 152 72 L 140 73 C 130 67 124 63 121.5 63 Z'],
      ['pecho', 'M 121.5 73 C 134 72 146 72 154 75 C 160 82 162 92 160 99 C 157 110 142 116 121.5 116 Z'],
      ['abdomen', 'M 121.5 118 L 138 118 C 140 125 139 130 138 134 L 121.5 134 Z'],
      ['abdomen', 'M 121.5 137 L 138 137 C 140 144 139 149 138 153 L 121.5 153 Z'],
      ['abdomen', 'M 121.5 156 L 138 156 C 140 164 139 171 137 176 L 121.5 176 Z'],
      ['abdomen', 'M 121.5 179 L 136 179 C 132 192 126 202 121.5 208 Z'],
      ['abdomen', 'M 141 120 C 151 118 157 128 156 138 C 154 150 149 164 141 174 C 143 158 143 138 141 120 Z'],
      ['biceps', BICEPS],
      ['antebrazo', FOREARM],
      ['hombros', SHOULDER_FRONT],
      ['aductores', 'M 122 224 C 130 224 134 238 134 256 C 134 274 130 292 122 302 Z'],
      ['cuadriceps', 'M 136 222 C 156 224 173 242 172 274 C 171 296 164 318 155 330 L 143 330 C 145 304 144 260 136 222 Z'],
      ['cuadriceps', 'M 132 296 C 140 296 143 312 142 330 L 131 330 C 129 320 129 306 132 296 Z'],
      ['gemelos', 'M 139 353 C 152 355 168 372 168 396 C 168 418 156 442 144 454 L 138 454 C 140 424 140 384 139 353 Z'],
    ],
    back: [
      ['espalda', 'M 121.5 52 C 130 55 142 63 155 72 L 142 92 C 134 85 127 82 121.5 82 Z'],
      ['espalda', 'M 121.5 84 C 128 84 138 90 140 98 L 121.5 138 Z'],
      ['espalda', 'M 158 88 C 168 100 170 120 162 146 C 150 160 138 168 121.5 172 L 121.5 142 C 134 138 144 122 142 98 Z'],
      ['triceps', TRICEPS],
      ['antebrazo', FOREARM],
      ['hombros', SHOULDER_BACK],
      ['gluteos', 'M 121.5 175 C 134 172 150 174 162 184 C 170 196 168 214 158 225 C 146 229 132 227 121.5 224 Z'],
      ['isquios', 'M 143 226 C 155 228 170 248 168 278 C 166 304 158 322 152 330 L 140 330 C 144 300 144 260 143 226 Z'],
      ['isquios', 'M 122 225 C 134 226 141 240 141 264 C 141 288 136 312 128 330 L 122 330 Z'],
      ['gemelos', 'M 139 353 C 152 355 168 372 168 396 C 168 418 156 442 144 454 L 138 454 C 140 424 140 384 139 353 Z'],
    ],
  };

  function bodySVG(view) {
    const half = BASE.map(d => `<path class="base" d="${d}"/>`).join('') +
      VIEWS[view].map(([m, d]) => `<path class="m" data-m="${m}" d="${d}"/>`).join('');
    const headPath = view === 'front'
      ? 'M 120 7 C 132 7 137.5 15 137.5 26 C 137.5 35 131 43 125 47 L 120 48 L 115 47 C 109 43 102.5 35 102.5 26 C 102.5 15 108 7 120 7 Z'
      : 'M 120 7 C 133 7 138 16 138 27 C 138 37 132 46 126 48 L 120 49 L 114 48 C 108 46 102 37 102 27 C 102 16 107 7 120 7 Z';
    const pedestal = '<ellipse cx="120" cy="477" rx="55" ry="5" class="pod-glow"/><ellipse cx="120" cy="477" rx="35" ry="3" class="pod-inner"/>';
    return `${pedestal}<path class="head" d="${headPath}"/><g>${half}</g><g transform="translate(240 0) scale(-1 1)">${half}</g>`;
  }

  /* ---------- Vistas derivadas (ejercicio guía + simulación) ---------- */
  const bodyweight = () => parseFloat($('#bw').value);

  function muscleView(id) {
    const m = state.result.muscles[id]; if (!m) return null;
    const ex = m.list.find(e => e.name === state.guide[id]) || m.top;
    const sim = state.sim[id];
    const w = sim ? sim.w : ex.best.w, reps = sim ? sim.reps : ex.best.reps;
    const e1 = sim ? e1rm(ex.bw ? bodyweight() + w : w, reps) : ex.best.e1rm;
    const score = scoreFromRatio(e1 / ex.scale), tier = tierIndex(score);
    let next = null, frac = 1;
    if (tier < TIERS.length - 1) {
      const target = ratioFromScore(TIERS[tier + 1].min) * ex.scale;
      next = { tier: tier + 1, delta: Math.max(0, target - e1) };
      frac = (score - TIERS[tier].min) / (TIERS[tier + 1].min - TIERS[tier].min);
    }
    return { id, m, ex, w, reps, e1, ratio: e1 / bodyweight(), score, tier, next, frac: Math.min(1, Math.max(0, frac)), simulated: !!sim };
  }
  function computeViews() {
    state.v = {};
    for (const id of Object.keys(MUSCLES)) state.v[id] = state.result ? muscleView(id) : null;
    const items = Object.values(state.v).filter(Boolean).map(v => ({ id: v.id, score: v.score }));
    state.sum = summary(items);
  }

  /* ---------- Render ---------- */
  function renderGems() {
    const cur = state.result ? state.sum.overall.tier : -1;
    $('#gems').innerHTML = TIERS.map((t, i) =>
      `<li class="${i === cur ? 'cur' : ''}" style="--c:${t.color}">${gem(t.id, 28)}<span>${t.id === 'top1' ? 'TOP 1%' : t.top + '%'}</span></li>`).join('');
  }

  function renderBody() {
    const svg = $('#body');
    svg.innerHTML = bodySVG(state.view);
    svg.querySelectorAll('.m').forEach(el => {
      const id = el.dataset.m, v = state.v[id];
      if (v) { el.style.fill = TIERS[v.tier].color; el.style.setProperty('--c', TIERS[v.tier].color); }
      if (id === state.selected) el.classList.add('sel');
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      t.textContent = v ? `${MUSCLES[id]}: ${TIERS[v.tier].name}` : `${MUSCLES[id]}: sin datos`;
      el.appendChild(t);
    });
  }

  function callout(el, title, tierIdx, sub, cap) {
    const t = TIERS[tierIdx];
    el.style.setProperty('--c', t.color);
    el.innerHTML = `<b>${title}</b><div class="row">${gem(t.id, 34)}<i></i></div><span>${esc(sub)}</span><em>${cap}</em>`;
  }

  function renderCallouts() {
    const items = Object.values(state.v).filter(Boolean);
    const s = state.sum;
    if (items.length < 2) { ['TL', 'TR', 'BL', 'BR'].forEach(k => { $('#co' + k).innerHTML = ''; }); return; }
    const sym = s.symmetry;
    if (sym >= 85) callout($('#coTL'), 'SIMÉTRICO', 7, `Simetría ${sym}/100`, 'Físico equilibrado');
    else if (sym >= 70) callout($('#coTL'), 'EQUILIBRADO', 4, `Simetría ${sym}/100`, 'Algún músculo rezagado');
    else callout($('#coTL'), 'ASIMÉTRICO', 2, `Simetría ${sym}/100`, 'Grandes diferencias');
    const strong = state.v[s.strongest.id], weak = state.v[s.weakest.id];
    callout($('#coTR'), TIERS[strong.tier].name.toUpperCase(), strong.tier, MUSCLES[strong.id], 'Más fuerte');
    callout($('#coBL'), TIERS[weak.tier].name.toUpperCase(), weak.tier, MUSCLES[weak.id], 'Punto débil');
    const close = items.filter(v => v.next && v.id !== weak.id).sort((a, b) => a.next.delta / a.e1 - b.next.delta / b.e1)[0] || items[0];
    callout($('#coBR'), TIERS[close.tier].name.toUpperCase(), close.tier, MUSCLES[close.id], 'Cerca de subir');
  }

  function renderBadges() {
    const vs = Object.values(state.v).filter(Boolean), out = [];
    if (state.sum.symmetry >= 85) out.push('<span class="badge blue">Simétrico</span>');
    const up = vs.filter(v => !LOWER.has(v.id)), lo = vs.filter(v => LOWER.has(v.id));
    if (up.length && lo.length) {
      const d = up.reduce((a, v) => a + v.score, 0) / up.length - lo.reduce((a, v) => a + v.score, 0) / lo.length;
      if (d >= 5) out.push('<span class="badge gold">Torso &gt; Pierna</span>');
      else if (d <= -5) out.push('<span class="badge gold">Pierna &gt; Torso</span>');
    }
    const tops = vs.filter(v => v.tier === 7).length;
    if (tops) out.push(`<span class="badge purple">Top 1%${tops > 1 ? ' ×' + tops : ''}</span>`);
    $('#badges').innerHTML = out.join('');
  }

  function renderBreakdown() {
    $('#gridM').innerHTML = Object.keys(MUSCLES).map(id => {
      const v = state.v[id], c = v ? TIERS[v.tier].color : '';
      return `<button type="button" class="mbtn ${id === state.selected ? 'sel' : ''}" data-m="${id}" style="--c:${c}">
        ${v ? gem(TIERS[v.tier].id, 26) : '<svg class="gem" width="26" height="26" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="#2c3342"/></svg>'}
        <span><b>${MUSCLES[id]}</b><small>${v ? `${TIERS[v.tier].name} · ${v.ratio.toFixed(2)}x` : 'Sin datos'}</small></span></button>`;
    }).join('');
  }

  function renderDetail(fillInputs) {
    const id = state.selected, v = state.v[id];
    $('#dBody').hidden = !v; $('#dEmpty').hidden = !!v;
    if (!v) {
      $('#dEmpty').textContent = `${MUSCLES[id]}: no hay series válidas en el periodo elegido. Prueba con "Todo el historial" o entrena alguno de sus ejercicios.`;
      return;
    }
    const t = TIERS[v.tier], card = $('#detail');
    card.style.setProperty('--c', t.color);
    card.style.setProperty('--c2', v.next ? TIERS[v.next.tier].color : t.color);
    $('#dGem').innerHTML = gem(t.id, 52);
    $('#dPill').textContent = tierLabel(v.tier);
    $('#dName').textContent = MUSCLES[id];
    $('#dE1').textContent = `${n1(v.e1)} kg`;
    $('#dRatio').textContent = `${v.ratio.toFixed(2)}x BW`;
    $('#dTier').textContent = tierLabel(v.tier).replace(/^(\S+)/, s => s[0] + s.slice(1).toLowerCase());
    $('#dNext').textContent = v.next ? `Faltan +${n1(v.next.delta)} kg e1RM para ${TIERS[v.next.tier].name}` : 'Rango máximo alcanzado';
    $('#dBar').style.width = `${Math.round(v.frac * 100)}%`;
    $('#lblW').textContent = v.ex.bw ? 'Lastre añadido (kg)' : 'Carga levantada (kg)';
    $('#dNote').textContent = v.simulated
      ? `Simulación. Tu mejor serie real: ${n1(v.ex.best.w)} kg × ${v.ex.best.reps}.`
      : `Mejor serie real${v.ex.bw ? ' (lastre sobre tu peso corporal)' : ''}. Cambia los valores para simular.${v.ex.guessed ? ' Ejercicio no catalogado: estimación aproximada.' : ''}`;
    $('#simReset').hidden = !v.simulated;

    if (fillInputs) {
      const sel = $('#dGuide');
      sel.innerHTML = v.m.list.map(e => `<option value="${esc(e.name)}" ${e.name === v.ex.name ? 'selected' : ''}>${esc(e.name)}</option>`).join('');
      sel.disabled = v.m.list.length < 2;
      $('#simW').value = v.w; $('#simR').value = v.reps;
    }
  }

  function renderTable() {
    const r = state.result;
    $('#allEx').hidden = !r; if (!r) return;
    $('#exCount').textContent = r.exercises.length;
    $('#exTable tbody').innerHTML = r.exercises.map(e => {
      const t = TIERS[e.tier];
      return `<tr style="--c:${t.color}"><td>${esc(e.name)}</td><td>${MUSCLES[e.muscle]}</td>
        <td>${n1(e.best.w)} kg × ${e.best.reps}</td><td>${n1(e.best.e1rm)} kg</td><td><span class="dot"></span>${t.name}</td></tr>`;
    }).join('');
    $('#unknown').textContent = r.unknown.length
      ? `Ejercicios sin catalogar (no puntúan): ${r.unknown.slice(0, 12).map(([n]) => n).join(', ')}${r.unknown.length > 12 ? '…' : ''}. Puedes añadirlos en ranks.js.` : '';
  }

  function renderAll(fillInputs = true) {
    const has = !!state.result;
    $('#app').classList.toggle('empty', !has);
    $('#welcome').hidden = has; $('#detail').hidden = !has; $('#breakdown').hidden = !has;
    const bw = bodyweight();
    $('#bwPill').textContent = `BW: ${n1(isFinite(bw) ? bw : 0)} kg`;
    computeViews();
    renderGems();
    const pill = $('#globalPill');
    if (!has) {
      pill.classList.remove('on'); pill.textContent = 'GLOBAL: –';
      $('#symVal').textContent = '–'; $('#badges').innerHTML = '';
      renderBody(); renderCallouts(); renderTable();
      return;
    }
    const o = state.sum.overall;
    pill.classList.add('on'); pill.style.setProperty('--c', TIERS[o.tier].color);
    pill.textContent = `GLOBAL: ${TIERS[o.tier].name}`;
    $('#symVal').textContent = state.sum.symmetry != null ? state.sum.symmetry + '%' : '–';
    renderBody(); renderCallouts(); renderBadges(); renderBreakdown(); renderDetail(fillInputs); renderTable();
  }

  /* ---------- Cálculo ---------- */
  function showError(msg) { const el = $('#error'); el.hidden = !msg; el.textContent = msg || ''; }

  function recompute() {
    if (!state.rows) return;
    const bw = bodyweight();
    if (!(bw >= 30 && bw <= 250)) { showError('Indica un peso corporal entre 30 y 250 kg.'); return; }
    showError('');
    const sex = $('#sex').value;
    state.result = analyse(state.rows, { bodyweight: bw, sex, days: +$('#period').value });
    state.sim = {};
    if (!state.result.exercises.length) {
      state.result = null; showError('No he encontrado series puntuables en el periodo elegido. Prueba con "Todo el historial".');
      renderAll(); return;
    }
    for (const id of Object.keys(state.guide)) {
      const m = state.result.muscles[id];
      if (!m || !m.list.some(e => e.name === state.guide[id])) delete state.guide[id];
    }
    if (!state.selected || !state.result.muscles[state.selected]) {
      state.selected = Object.keys(MUSCLES).find(id => state.result.muscles[id]) || 'pecho';
    }
    try { localStorage.setItem('ranks-prefs', JSON.stringify({ bw, sex })); } catch (_) { /* sin almacenamiento */ }
    renderAll();
  }

  function useCSV(text) {
    try { state.rows = loadHevy(text); } catch (e) { state.rows = null; state.result = null; showError(e.message); renderAll(); return; }
    state.guide = {}; state.selected = null;
    recompute();
    saveHistory();
    renderHistory();
    showToast('CSV importado: ' + (state.result ? state.result.exercises.length + ' ejercicios, ' + state.result.sets + ' series' : 'sin datos'), state.result ? 'success' : 'error');
  }

  /* ---------- Datos de ejemplo (distintos cada vez) ---------- */
  function demoCSV() {
    const rnd = (a, b) => a + Math.random() * (b - a);
    const pick = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);
    const lifts = [
      ['Bench Press (Barbell)', 82, 6], ['Squat (Barbell)', 110, 6], ['Lat Pulldown (Cable)', 75, 10], ['Shoulder Press (Dumbbell)', 26, 8],
      ['Bicep Curl (Barbell)', 35, 10], ['Triceps Pushdown', 40, 10], ['Seated Leg Curl (Machine)', 65, 10], ['Calf Extension (Machine)', 120, 12],
      ['Leg Press (Machine)', 220, 10], ['Seated Cable Row - Bar Grip', 70, 10], ['Hip Thrust (Barbell)', 110, 8], ['Crunch (Machine)', 45, 12],
      ['Incline Bench Press (Dumbbell)', 30, 8], ['Butterfly (Pec Deck)', 70, 12], ['Lateral Raise (Cable)', 12, 12], ['Hip Adduction (Machine)', 90, 12],
      ['Leg Extension (Machine)', 80, 12], ['Deadlift (Barbell)', 130, 5], ['Preacher Curl (Machine)', 40, 10], ['Triceps Extension (Cable)', 30, 10],
      ['Behind the Back Wrist Curl (Barbell)', 30, 12],
    ];
    const level = rnd(0.55, 1.5), weeks = Math.floor(rnd(8, 40));
    const chosen = pick(lifts, Math.floor(rnd(11, lifts.length + 1))).map(([n, w, r]) => [n, Math.round(w * level * rnd(0.6, 1.4) * 2) / 2, r]);
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
  async function readFile(f) { if (f) useCSV(await f.text()); }
  $('#file').addEventListener('change', async e => { await readFile(e.target.files[0]); e.target.value = ''; });
  $('#demo').addEventListener('click', () => useCSV(demoCSV()));

  let depth = 0; const veil = $('#veil');
  addEventListener('dragenter', e => { e.preventDefault(); depth++; veil.classList.add('on'); });
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('dragleave', () => { if (--depth <= 0) { depth = 0; veil.classList.remove('on'); } });
  addEventListener('drop', e => { e.preventDefault(); depth = 0; veil.classList.remove('on'); readFile(e.dataTransfer.files[0]); });

  ['#bw', '#period', '#sex'].forEach(s => $(s).addEventListener('input', () => { state.rows ? recompute() : renderAll(); }));

  document.querySelectorAll('.toggle button').forEach(b => b.addEventListener('click', () => {
    state.view = b.dataset.view;
    document.querySelectorAll('.toggle button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    renderBody();
  }));

  function select(id) {
    state.selected = id;
    if (window.innerWidth <= 1020) { const det = document.querySelector('#detail'); if (det) det.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
    renderAll(true);
  }
  $('#body').addEventListener('click', e => { const m = e.target.closest('.m'); if (m && state.result) select(m.dataset.m); });
  $('#gridM').addEventListener('click', e => { const b = e.target.closest('.mbtn'); if (b) select(b.dataset.m); });

  $('#dGuide').addEventListener('change', e => { state.guide[state.selected] = e.target.value; delete state.sim[state.selected]; renderAll(true); });
  function onSim() {
    const w = parseFloat($('#simW').value), reps = Math.round(parseFloat($('#simR').value));
    if (!(w >= 0) || !(reps >= 1 && reps <= 30)) return;
    state.sim[state.selected] = { w, reps }; renderAll(false);
  }
  ['#simW', '#simR'].forEach(s => $(s).addEventListener('input', onSim));
  $('#simReset').addEventListener('click', () => { delete state.sim[state.selected]; renderAll(true); });

  const clearBtn = document.querySelector('#clearHistory');
  if (clearBtn) clearBtn.addEventListener('click', () => { try { localStorage.removeItem('ranks-history'); } catch(_) {} renderHistory(); showToast('Historial borrado'); });

  const exportBtn = document.querySelector('#exportImg');
  if (exportBtn) exportBtn.addEventListener('click', () => {
    if (!state.result) { showToast('Importa un CSV primero', 'error'); return; }
    const s = state.sum, bw = bodyweight();
    let text = '🏋️ Symmetry Rank Engine\n';
    text += '━━━━━━━━━━━━━━━━━━━━━━\n';
    text += 'Global: ' + TIERS[s.overall.tier].name + ' (' + Math.round(s.overall.score) + '/100)\n';
    text += 'Simetría: ' + (s.symmetry != null ? s.symmetry + '%' : '–') + '\n';
    text += 'BW: ' + bodyweight() + ' kg\n';
    text += '━━━━━━━━━━━━━━━━━━━━━━\n';
    for (const id of Object.keys(MUSCLES)) {
      const v = state.v[id];
      if (v) text += MUSCLES[id] + ': ' + TIERS[v.tier].name + ' (' + Math.round(v.score) + ')\n';
    }
    navigator.clipboard.writeText(text).then(() => showToast('Resumen copiado al portapapeles ✓', 'success')).catch(() => showToast('No se pudo copiar', 'error'));
  });

  document.addEventListener('keydown', e => {
    if (!state.result) return;
    const keys = Object.keys(MUSCLES);
    const idx = keys.indexOf(state.selected);
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); select(keys[(idx + 1) % keys.length]); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); select(keys[(idx - 1 + keys.length) % keys.length]); }
    else if (e.key === 'Escape') { state.selected = null; renderAll(true); }
  });

  /* ---------- SVG Tooltip ---------- */
  const tooltip = document.createElement('div');
  tooltip.className = 'svg-tooltip';
  tooltip.style.display = 'none';
  document.body.appendChild(tooltip);
  document.querySelector('#body').addEventListener('mousemove', e => {
    const m = e.target.closest('.m');
    if (!m || !state.result) { tooltip.style.display = 'none'; return; }
    const id = m.dataset.m, v = state.v[id];
    tooltip.style.display = 'block';
    tooltip.style.left = (e.clientX + 12) + 'px';
    tooltip.style.top = (e.clientY - 10) + 'px';
    tooltip.innerHTML = '<b>' + MUSCLES[id] + '</b><br>' + (v ? TIERS[v.tier].name + ' · ' + Math.round(v.score) + '/100' : 'Sin datos');
  });
  document.querySelector('#body').addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

  try {
    const p = JSON.parse(localStorage.getItem('ranks-prefs') || 'null');
    if (p) { $('#bw').value = p.bw; $('#sex').value = p.sex === 'f' ? 'f' : 'm'; }
  } catch (_) { /* ignorar */ }

  renderAll();
  renderHistory();
})();
