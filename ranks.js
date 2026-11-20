/* ranks.js — lógica pura (sin DOM): parseo del CSV de Hevy y cálculo de rangos.
   Funciona en el navegador (window.Ranks) y en Node (module.exports). */
const Ranks = (() => {
  'use strict';

  /* ---------- Rangos ---------- */
  // min = puntuación mínima (percentil estimado, 0-100) para alcanzar el rango
  const TIERS = [
    { id: 'bronce',    name: 'Bronce',    min: 0,  color: '#c9803f' },
    { id: 'plata',     name: 'Plata',     min: 40, color: '#b4bdcb' },
    { id: 'oro',       name: 'Oro',       min: 60, color: '#f2c230' },
    { id: 'platino',   name: 'Platino',   min: 80, color: '#38d6c4' },
    { id: 'diamante',  name: 'Diamante',  min: 90, color: '#4aa3ff' },
    { id: 'simetrico', name: 'Simétrico', min: 97, color: '#a66bff' },
    { id: 'top1',      name: 'Top 1%',    min: 99, color: '#ff5c8a' },
  ];

  // Ratio (1RM estimado / peso corporal) del press banca de un hombre → percentil estimado.
  // El resto de ejercicios escalan esta curva con su coeficiente "k".
  const ANCHORS = [[0, 0], [0.8, 40], [1.0, 60], [1.3, 80], [1.55, 90], [1.8, 97], [2.0, 99], [2.3, 100]];

  /* ---------- Músculos ---------- */
  const MUSCLES = {
    pecho: 'Pecho', espalda: 'Espalda', hombros: 'Hombros', biceps: 'Bíceps',
    triceps: 'Tríceps', antebrazo: 'Antebrazo', abdomen: 'Abdomen',
    cuadriceps: 'Cuádriceps', aductores: 'Aductores', isquios: 'Isquiotibiales',
    gluteos: 'Glúteos', gemelos: 'Gemelos',
  };
  const LOWER = new Set(['cuadriceps', 'aductores', 'isquios', 'gluteos', 'gemelos']);
  // Multiplicador de los umbrales para mujeres (fuerza relativa media más baja)
  const FEMALE_FACTOR = { upper: 0.62, lower: 0.8 };

  /* ---------- Ejercicios: nombre → [músculo, k, usaPesoCorporal] ----------
     k = nivel de dificultad relativo al press banca con barra (k = 1).
     Las mancuernas se cuentan por mancuerna (como las registra Hevy).
     Los valores de máquinas/poleas son aproximados: cada máquina es distinta. */
  const EX = {
    // Pecho
    'Bench Press (Barbell)': ['pecho', 1],
    'Incline Bench Press (Dumbbell)': ['pecho', 0.4],
    'Chest Press (Machine)': ['pecho', 0.95],
    'Butterfly (Pec Deck)': ['pecho', 1.0],
    'Dragonfly': ['pecho', 0.8],
    // Espalda
    'Lat Pulldown (Cable)': ['espalda', 0.95],
    'Lat Pulldown (Machine)': ['espalda', 0.95],
    'Seated Cable Row - Bar Grip': ['espalda', 0.95],
    'Seated Cable Row - Bar Wide Grip': ['espalda', 0.9],
    'Iso-Lateral Row (Machine)': ['espalda', 1.0],
    'Single Arm Cable Row': ['espalda', 0.5],
    'Rope Straight Arm Pulldown': ['espalda', 0.5],
    'Straight Arm Lat Pulldown (Cable)': ['espalda', 0.55],
    'Pendlay Row (Barbell)': ['espalda', 0.95],
    'Chin Up (Weighted)': ['espalda', 1.35, true],
    'Pull Up': ['espalda', 1.35, true],
    'Incline Bench Press (Barbell)': ['pecho', 0.85],
    'Chest Fly (Dumbbell)': ['pecho', 0.2],
    'Cable Fly Crossovers': ['pecho', 0.35],
    'Low Cable Fly Crossovers': ['pecho', 0.3],
    // Hombros
    'Shoulder Press (Dumbbell)': ['hombros', 0.32],
    'Seated Shoulder Press (Machine)': ['hombros', 0.7],
    'Lateral Raise (Cable)': ['hombros', 0.2],
    'Lateral Raise (Dumbbell)': ['hombros', 0.16],
    'Face Pull': ['hombros', 0.5],
    'Rear Delt Reverse Fly (Machine)': ['hombros', 0.7],
    'Reverse Fly Single Arm (Cable)': ['hombros', 0.2],
    // Bíceps
    'Preacher Curl (Machine)': ['biceps', 0.6],
    'Curl Martillo Cable Unilateral': ['biceps', 0.22],
    'Bayesian': ['biceps', 0.22],
    'Seated Incline Curl (Dumbbell)': ['biceps', 0.17],
    'Hammer Curl (Dumbbell)': ['biceps', 0.22],
    'Hammer Curl (Cable)': ['biceps', 0.4],
    'Bicep Curl (Barbell)': ['biceps', 0.5],
    'Bicep Curl (Dumbbell)': ['biceps', 0.22],
    'Bicep Curl (Cable)': ['biceps', 0.45],
    'Preacher Curl (Dumbbell)': ['biceps', 0.2],
    'Preacher Curl (Barbell)': ['biceps', 0.45],
    // Tríceps
    'Triceps Extension (Cable)': ['triceps', 0.6],
    'Triceps Pushdown': ['triceps', 0.75],
    'Triceps Rope Pushdown': ['triceps', 0.65],
    'Overhead Triceps Extension (Cable)': ['triceps', 0.6],
    'Single Arm Triceps Pushdown (Cable)': ['triceps', 0.25],
    'Triceps Kickback (Cable)': ['triceps', 0.15],
    'Bench Press - Close Grip (Barbell)': ['triceps', 0.8],
    'Skullcrusher (Barbell)': ['triceps', 0.5],
    // Antebrazo
    'Reverse Curl (Barbell)': ['antebrazo', 0.35],
    'Behind the Back Wrist Curl (Barbell)': ['antebrazo', 0.4],
    // Abdomen
    'Crunch (Machine)': ['abdomen', 0.8],
    'Decline Crunch (Weighted)': ['abdomen', 0.4],
    // Piernas
    'Squat (Barbell)': ['cuadriceps', 1.35],
    'Squat (Smith Machine)': ['cuadriceps', 1.4],
    'Leg Press (Machine)': ['cuadriceps', 3.0],
    'Leg Press Horizontal (Machine)': ['cuadriceps', 2.0],
    'Leg Extension (Machine)': ['cuadriceps', 1.1],
    'Seated Leg Curl (Machine)': ['isquios', 0.9],
    'Lying Leg Curl (Machine)': ['isquios', 0.85],
    'Deadlift (Barbell)': ['isquios', 1.7],
    'Hip Adduction (Machine)': ['aductores', 1.2],
    'Hip Thrust (Machine)': ['gluteos', 1.8],
    'Hip Thrust (Barbell)': ['gluteos', 1.7],
    'Calf Extension (Machine)': ['gemelos', 1.8],
    'Seated Calf Raise': ['gemelos', 1.0],
    'Standing Calf Raise (Smith)': ['gemelos', 1.4],
  };
  // Reglas para ejercicios que no están en la tabla (se evalúan en orden)
  const FALLBACK = [
    [/tr[ií]ceps/i, 'triceps', 0.6],
    [/leg curl/i, 'isquios', 0.6],
    [/curl/i, 'biceps', 0.3],
    [/calf|gemelo/i, 'gemelos', 1],
    [/lat pulldown|row\b|remo|jal[oó]n/i, 'espalda', 0.8],
    [/crunch/i, 'abdomen', 0.5],
    [/lateral raise|elevaci[oó]n lateral/i, 'hombros', 0.16],
  ];

  function lookup(name) {
    if (EX[name]) return { muscle: EX[name][0], k: EX[name][1], bw: !!EX[name][2], guessed: false };
    for (const [re, m, k] of FALLBACK) if (re.test(name)) {
      const adj = /dumbbell|mancuerna/i.test(name) ? 0.4 : /single|unilateral/i.test(name) ? 0.5 : 1;
      return { muscle: m, k: k * adj, bw: false, guessed: true };
    }
    return null;
  }

  /* ---------- Matemáticas de puntuación ---------- */
  function scoreFromRatio(r) {
    if (r <= 0) return 0;
    for (let i = 1; i < ANCHORS.length; i++) {
      const [r0, s0] = ANCHORS[i - 1], [r1, s1] = ANCHORS[i];
      if (r <= r1) return s0 + ((r - r0) / (r1 - r0)) * (s1 - s0);
    }
    return 100;
  }
  function ratioFromScore(s) {
    for (let i = 1; i < ANCHORS.length; i++) {
      const [r0, s0] = ANCHORS[i - 1], [r1, s1] = ANCHORS[i];
      if (s <= s1) return r0 + ((s - s0) / (s1 - s0)) * (r1 - r0);
    }
    return ANCHORS[ANCHORS.length - 1][0];
  }
  function tierIndex(score) {
    let idx = 0;
    TIERS.forEach((t, i) => { if (score >= t.min) idx = i; });
    return idx;
  }
  const e1rm = (load, reps) => (reps <= 1 ? load : load * (1 + Math.min(reps, 12) / 30)); // Epley, reps limitadas a 12

  /* ---------- CSV ---------- */
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    const head = rows.shift().map(h => h.trim());
    return rows.map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
  }

  const MONTHS = { ene: 0, jan: 0, feb: 1, mar: 2, abr: 3, apr: 3, may: 4, jun: 5, jul: 6, ago: 7, aug: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11, dec: 11 };
  function parseDate(s) {
    if (!s) return null;
    const m = /(\d{1,2})\s+([a-zñ]{3})[a-z]*\.?,?\s+(\d{4})/i.exec(s);
    if (m && MONTHS[m[2].toLowerCase()] !== undefined) return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1]).getTime();
    const d = Date.parse(s);
    return isNaN(d) ? null : d;
  }

  function loadHevy(text) {
    const rows = parseCSV(text);
    const need = ['exercise_title', 'weight_kg', 'reps'];
    if (!rows.length || need.some(c => !(c in rows[0]))) {
      throw new Error('No parece un export de Hevy: faltan las columnas exercise_title, weight_kg y reps.');
    }
    rows.forEach(r => { r._t = parseDate(r.start_time); });
    return rows;
  }

  /* ---------- Análisis ---------- */
  function analyse(rows, { bodyweight, sex = 'm', days = 0 }) {
    const times = rows.map(r => r._t).filter(Boolean);
    const last = times.length ? Math.max(...times) : null;
    const cutoff = days && last ? last - days * 864e5 : -Infinity;
    const best = new Map(); const unknown = new Map();
    let sets = 0;

    for (const r of rows) {
      if (days && r._t && r._t < cutoff) continue;
      if ((r.set_type || 'normal').toLowerCase() === 'warmup') continue;
      const name = (r.exercise_title || '').trim();
      const info = lookup(name); if (!info) { if (name) unknown.set(name, (unknown.get(name) || 0) + 1); continue; }
      const w = parseFloat(r.weight_kg) || 0, reps = parseFloat(r.reps) || 0;
      if (reps < 1 || reps > 30 || (!info.bw && w <= 0)) continue;
      const est = e1rm(info.bw ? bodyweight + w : w, reps);
      sets++;
      const b = best.get(name);
      if (!b || est > b.e1rm) best.set(name, { w, reps, e1rm: est, t: r._t, info });
    }

    const exercises = [];
    for (const [name, b] of best) {
      const { muscle, k, bw, guessed } = b.info;
      const f = sex === 'f' ? (LOWER.has(muscle) ? FEMALE_FACTOR.lower : FEMALE_FACTOR.upper) : 1;
      const scale = k * f * bodyweight;                    // e1RM (kg) equivalente a "ratio 1" de la curva
      const score = scoreFromRatio(b.e1rm / scale);
      const ti = tierIndex(score);
      let next = null;
      if (ti < TIERS.length - 1) {
        const target = ratioFromScore(TIERS[ti + 1].min) * scale;
        const repsT = Math.max(1, Math.min(b.reps, 12));
        const load = target / (repsT === 1 ? 1 : 1 + repsT / 30);
        next = { tier: TIERS[ti + 1], weight: Math.ceil((bw ? load - bodyweight : load) * 2) / 2, reps: repsT, e1rm: target };
      }
      exercises.push({ name, muscle, guessed, bw, best: b, score, tier: ti, next });
    }
    exercises.sort((a, c) => c.score - a.score);

    const muscles = {};
    for (const id of Object.keys(MUSCLES)) {
      const list = exercises.filter(e => e.muscle === id);
      if (!list.length) { muscles[id] = null; continue; }
      // Media ponderada de sus 3 mejores ejercicios (50/30/20) para que un solo ejercicio no decida el rango
      const W = [0.5, 0.3, 0.2].slice(0, Math.min(3, list.length));
      const score = W.reduce((a, w, i) => a + w * list[i].score, 0) / W.reduce((a, w) => a + w, 0);
      muscles[id] = { id, score, tier: tierIndex(score), top: list[0], list };
    }
    const scored = Object.values(muscles).filter(Boolean);
    const avg = scored.length ? scored.reduce((a, m) => a + m.score, 0) / scored.length : 0;
    const sd = scored.length > 1 ? Math.sqrt(scored.reduce((a, m) => a + (m.score - avg) ** 2, 0) / scored.length) : 0;
    const weakest = scored.length > 1 ? scored.reduce((a, m) => (m.score < a.score ? m : a)) : null;
    return {
      exercises, muscles, sets, unknown: [...unknown.entries()].sort((a, c) => c[1] - a[1]),
      overall: { score: avg, tier: tierIndex(avg), count: scored.length, total: Object.keys(MUSCLES).length },
      symmetry: scored.length > 1 ? Math.max(0, Math.round(100 - sd * 1.5)) : null,
      weakest, lastDate: last,
    };
  }

  return { TIERS, MUSCLES, EX, ANCHORS, parseCSV, loadHevy, analyse, scoreFromRatio, ratioFromScore, tierIndex };
})();
if (typeof module !== 'undefined') module.exports = Ranks;
