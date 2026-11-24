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
    const canvas = document.querySelector('#progressChart'); if (!canvas || hist.length < 2) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || 400, H = canvas.clientHeight || 200;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const pad = { l: 36, r: 12, t: 12, b: 24 };
    const w = W - pad.l - pad.r, h = H - pad.t - pad.b;
    // Tier threshold lines
    ctx.setLineDash([4, 4]); ctx.lineWidth = 0.5;
    for (const tier of TIERS) {
      if (tier.min <= 0) continue;
      const y = pad.t + h - (tier.min / 100) * h;
      ctx.strokeStyle = tier.color + '44'; ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + w, y); ctx.stroke();
      ctx.fillStyle = tier.color + '88'; ctx.font = '9px Inter,sans-serif'; ctx.fillText(tier.name, 2, y + 3);
    }
    ctx.setLineDash([]);
    // Data line
    ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    hist.forEach((h, i) => {
      const x = pad.l + (i / (hist.length - 1)) * w;
      const y = pad.t + h - (h.global / 100) * (H - pad.t - pad.b);
      const tierIdx = Ranks.tierIndex(h.global);
      ctx.strokeStyle = TIERS[tierIdx].color;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    // Dots
    hist.forEach((h, i) => {
      const x = pad.l + (i / (hist.length - 1)) * w;
      const y = pad.t + (H - pad.t - pad.b) - (h.global / 100) * (H - pad.t - pad.b);
      const tierIdx = Ranks.tierIndex(h.global);
      ctx.fillStyle = TIERS[tierIdx].color;
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
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

  /* ---------- Figura (mitad derecha; la izquierda se espeja) ---------- */
  const P = pts => 'M' + pts.map(p => p.join(' ')).join('L') + 'Z';
  const SHOULDER = P([[156, 77], [172, 78], [184, 90], [186, 110], [176, 118], [167, 102], [160, 90]]);
  const ARM = P([[177, 120], [187, 114], [195, 132], [196, 158], [186, 162], [178, 142]]);
  const FORE = P([[186, 166], [196, 162], [207, 198], [211, 228], [202, 230], [190, 198]]);
  const BASE = [
    [[121, 64], [154, 76], [178, 96], [180, 116], [172, 162], [168, 224], [121, 224]],   // torso
    [[121, 46], [132, 48], [136, 66], [121, 68]],                                          // cuello
    [[199, 232], [211, 229], [216, 248], [208, 254], [200, 244]],                          // mano
    [[133, 328], [161, 328], [159, 352], [135, 352]],                                      // rodilla
    [[132, 352], [140, 352], [145, 454], [136, 454]],                                      // tibia
    [[136, 456], [152, 456], [160, 478], [132, 478]],                                      // pie
  ].map(P);
  const THIGH = [ // 3 bandas del muslo
    [[124, 222], [138, 222], [141, 328], [132, 328]],
    [[138, 222], [152, 222], [150, 328], [141, 328]],
    [[152, 222], [167, 226], [160, 328], [150, 328]],
  ].map(P);
  const VIEWS = {
    front: [
      ['espalda', P([[122, 66], [136, 69], [152, 79], [122, 78]])],
      ['pecho', P([[122, 81], [153, 82], [159, 97], [154, 112], [122, 114]])],
      ['abdomen', P([[122, 117], [137, 117], [137, 131], [122, 131]])],
      ['abdomen', P([[122, 134], [137, 134], [137, 148], [122, 148]])],
      ['abdomen', P([[122, 151], [137, 151], [137, 165], [122, 165]])],
      ['abdomen', P([[122, 168], [140, 168], [122, 200]])],
      ['abdomen', P([[140, 118], [151, 116], [156, 138], [150, 164], [140, 166]])],
      ['biceps', ARM], ['antebrazo', FORE], ['hombros', SHOULDER],
      ['aductores', THIGH[0]], ['cuadriceps', THIGH[1]], ['cuadriceps', THIGH[2]],
      ['gemelos', P([[140, 352], [158, 354], [164, 386], [158, 430], [150, 454], [144, 454], [141, 404]])],
    ],
    back: [
      ['espalda', P([[122, 66], [137, 69], [153, 79], [122, 98]])],
      ['espalda', P([[122, 102], [154, 86], [162, 100], [158, 130], [142, 152], [122, 154]])],
      ['espalda', P([[122, 158], [142, 156], [146, 172], [122, 178]])],
      ['triceps', ARM], ['antebrazo', FORE], ['hombros', SHOULDER],
      ['gluteos', P([[122, 182], [150, 178], [164, 194], [162, 216], [144, 224], [122, 220]])],
      ['isquios', THIGH[0]], ['isquios', THIGH[1]], ['isquios', THIGH[2]],
      ['gemelos', P([[137, 352], [160, 354], [165, 390], [158, 432], [150, 454], [142, 454], [138, 404]])],
    ],
  };
  function bodySVG(view) {
    const half = BASE.map(d => `<path class="base" d="${d}"/>`).join('') +
      VIEWS[view].map(([m, d]) => `<path class="m" data-m="${m}" d="${d}"/>`).join('');
    return `<ellipse class="head" cx="120" cy="27" rx="16" ry="21"/><g>${half}</g><g transform="translate(240 0) scale(-1 1)">${half}</g>`;
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
