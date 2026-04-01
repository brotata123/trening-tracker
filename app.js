// ============================================================
//  TRENING TRACKER — app.js
//  Logika aplikacji: Firebase, treningi, plany, statystyki
// ============================================================

'use strict';

// ---- Baza ćwiczeń ----
const EXERCISES = [
  { group: 'Klatka piersiowa', items: [
    'Klatka - Wyciskanie sztangi na ławce poziomej',
    'Klatka - Wyciskanie hantli na ławce (poziom)',
    'Klatka - Wyciskanie hantli na ławce (skos dodatni)',
    'Klatka - Rozpiętki z hantlami na ławce',
    'Klatka - Przenoszenie hantla za głowę leżąc'
  ]},
  { group: 'Plecy', items: [
    'Plecy - Podciąganie się na drążku',
    'Plecy - Przyciąganie drążka wyciągu górnego do klatki',
    'Plecy - Przyciąganie uchwytu wyciągu dolnego (Wioślarz)',
    'Plecy - Wiosłowanie sztangą w opadzie tułowia',
    'Plecy - Wiosłowanie hantlem jednorącz w oparciu o ławkę',
    'Plecy - Martwy ciąg ze sztangą',
    'Plecy - Prostowanie ramion na wyciągu (narciarz)',
    'Plecy - Szruksy ze sztangą'
  ]},
  { group: 'Barki', items: [
    'Barki - Wyciskanie żołnierskie sztangi (OHP)',
    'Barki - Wyciskanie hantli siedząc',
    'Barki - Wznosy hantli bokiem',
    'Barki - Wznosy hantli w przód',
    'Barki - Facepulls (wyciąg górny)',
    'Barki - Podciąganie sztangi wzdłuż tułowia'
  ]},
  { group: 'Nogi i Pośladki', items: [
    'Nogi - Przysiady ze sztangą na plecach',
    'Nogi - Przysiady bułgarskie',
    'Nogi - Martwy ciąg na prostych nogach (RDL)',
    'Nogi - Wykroki z hantlami',
    'Nogi - Wznosy bioder ze sztangą',
    'Nogi - Wspięcia na palce stojąc',
    'Nogi - Wyprosty nóg na wyciągu'
  ]},
  { group: 'Biceps', items: [
    'Biceps - Uginanie ramion ze sztangą stojąc',
    'Biceps - Uginanie ramion z hantlami',
    'Biceps - Uginanie ramion na wyciągu dolnym'
  ]},
  { group: 'Triceps', items: [
    'Triceps - Wyciskanie francuskie sztangi/hantli',
    'Triceps - Prostowanie ramion na wyciągu górnym',
    'Triceps - Wyciskanie sztangi w wąskim chwycie'
  ]},
  { group: 'Brzuch', items: [
    'Brzuch - Allahy',
    'Brzuch - Unoszenie nóg leżąc na ławce',
    'Brzuch - Russian Twist z hantlem'
  ]}
];

function buildExerciseOptions(selected = '') {
  const opts = EXERCISES.map(g => `
    <optgroup label="${escHtml(g.group)}">
      ${g.items.map(i => `<option value="${escHtml(i)}"${i === selected ? ' selected' : ''}>${escHtml(i)}</option>`).join('')}
    </optgroup>`).join('');
  return `<option value="">— wybierz ćwiczenie —</option>${opts}`;
}

// ---- Typy treningów ----
const WORKOUT_TYPES = {
  silownia: { label: 'Siłownia', icon: '🏋️', color: '#5b7fff' },
  rower:    { label: 'Rower',    icon: '🚴', color: '#f59e0b' },
  inne:     { label: 'Inne',     icon: '⚡',  color: '#9ca3af' }
};

// ---- Stan aplikacji ----
const state = {
  view: 'dashboard',
  userId: null,
  calendarYear:  new Date().getFullYear(),
  calendarMonth: new Date().getMonth(),  // 0–11
  allWorkouts:   [],
  plans:         [],
  currentWorkout: null,
  restTimer: {
    active:   false,
    duration: 90,
    remaining: 90,
    timerId:  null
  },
  statsMonth: new Date().getMonth(),
  statsYear:  new Date().getFullYear(),
  charts: {}
};

// ---- Firebase ----
let db = null;

// ============================================================
//  INICJALIZACJA
// ============================================================
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  // Service Worker (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  // User ID — prosty identyfikator w localStorage (single-user)
  state.userId = localStorage.getItem('trening_userId');
  if (!state.userId) {
    state.userId = 'user_' + Date.now();
    localStorage.setItem('trening_userId', state.userId);
  }

  // Firebase init
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    db = firebase.firestore();
    db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  } catch (e) {
    console.error('Firebase init error:', e);
    showToast('Błąd połączenia z Firebase. Sprawdź firebase-config.js');
    return;
  }

  // Wczytaj dane
  await Promise.all([loadWorkouts(), loadPlans()]);

  // Dolna nawigacja
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  // FAB — nowy trening
  document.getElementById('fab').addEventListener('click', () => startNewWorkout());

  // Nawigacja kalendarza
  document.getElementById('cal-prev').addEventListener('click', prevMonth);
  document.getElementById('cal-next').addEventListener('click', nextMonth);

  // Nawigacja statystyk
  document.getElementById('stats-prev').addEventListener('click', prevStatMonth);
  document.getElementById('stats-next').addEventListener('click', nextStatMonth);

  // Log — zmiana typu treningu
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => setWorkoutType(btn.dataset.type));
  });

  // Log — zapis treningu
  document.getElementById('btn-save-workout').addEventListener('click', saveWorkout);
  document.getElementById('btn-add-exercise').addEventListener('click', addExercise);

  // Rest timer — edycja czasu
  document.getElementById('rest-duration-btn').addEventListener('click', editRestDuration);

  // Plans — nowy plan
  document.getElementById('btn-new-plan').addEventListener('click', showCreatePlan);

  // Modal plan — przyciski
  document.getElementById('btn-save-plan').addEventListener('click', savePlan);
  document.getElementById('btn-cancel-plan').addEventListener('click', closePlanModal);
  document.getElementById('btn-add-plan-exercise').addEventListener('click', addPlanExercise);
  document.querySelectorAll('.plan-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.plan-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (state.editingPlan) state.editingPlan.type = btn.dataset.type;
    });
  });

  // Modal detail — zamknij
  document.getElementById('modal-detail').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeDetailModal();
  });
  document.getElementById('modal-plan').addEventListener('click', e => {
    if (e.target === e.currentTarget) closePlanModal();
  });
  document.getElementById('modal-history').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeHistoryModal();
  });

  // Stats — wykres siły (wybór ćwiczenia)
  document.getElementById('stats-exercise-select').addEventListener('change', renderStrengthChart);

  // Pokaż dashboard
  showView('dashboard');
}

// ============================================================
//  NAWIGACJA
// ============================================================
function showView(viewName) {
  state.view = viewName;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + viewName).classList.add('active');
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  switch (viewName) {
    case 'dashboard': renderDashboard(); break;
    case 'log':       renderLog();       break;
    case 'plans':     renderPlans();     break;
    case 'stats':     buildExerciseSelect(); renderStats(); break;
  }
}

// ============================================================
//  WCZYTYWANIE DANYCH
// ============================================================
async function loadWorkouts() {
  try {
    const snap = await db.collection(`users/${state.userId}/workouts`)
      .orderBy('date', 'desc')
      .get();
    state.allWorkouts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('loadWorkouts error:', e);
  }
}

async function loadPlans() {
  try {
    const snap = await db.collection(`users/${state.userId}/plans`)
      .orderBy('name')
      .get();
    state.plans = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('loadPlans error:', e);
  }
}

// ============================================================
//  DASHBOARD
// ============================================================
function renderDashboard() {
  renderCalendar();
  renderLastWorkouts();
}

function renderCalendar() {
  const year  = state.calendarYear;
  const month = state.calendarMonth;
  const MONTHS = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
                  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];

  document.getElementById('cal-title').textContent = `${MONTHS[month]} ${year}`;

  const firstDay    = new Date(year, month, 1).getDay();  // 0=Nd
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today       = new Date();

  // Grupuj treningi po dacie
  const byDate = {};
  state.allWorkouts.forEach(w => {
    if (!byDate[w.date]) byDate[w.date] = [];
    byDate[w.date].push(w);
  });

  const grid = document.getElementById('cal-grid');
  // Zachowaj nagłówki (pierwsze 7 dzieci)
  const headers = Array.from(grid.children).slice(0, 7);
  grid.innerHTML = '';
  headers.forEach(h => grid.appendChild(h));

  // Puste komórki przed 1. dniem (Nd=0 → przesunięcie)
  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(mkEl('div', 'cal-cell empty'));
  }

  // Dni miesiąca
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    const dayWorkouts = byDate[dateStr] || [];
    const cell = mkEl('div', 'cal-cell');

    const isToday = d === today.getDate() &&
                    month === today.getMonth() &&
                    year === today.getFullYear();
    if (isToday) cell.classList.add('today');

    if (dayWorkouts.length > 0) {
      cell.classList.add('has-workout');
      const color = WORKOUT_TYPES[dayWorkouts[0].type]?.color || '#5b7fff';
      cell.style.setProperty('--dot-color', color);
      cell.addEventListener('click', () => showWorkoutDetail(dayWorkouts[0].id));
    } else {
      cell.classList.add('clickable-day');
      cell.addEventListener('click', () => startNewWorkoutOnDate(dateStr));
    }

    cell.textContent = d;
    grid.appendChild(cell);
  }
}

function renderLastWorkouts() {
  const list  = document.getElementById('last-workouts');
  const last3 = state.allWorkouts.slice(0, 3);

  if (last3.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div style="font-size:2.5rem">💪</div>
        <div>Brak treningów</div>
        <div class="empty-sub">Kliknij [+] i zacznij pierwszy trening!</div>
      </div>`;
    return;
  }

  list.innerHTML = last3.map(w => {
    const type    = WORKOUT_TYPES[w.type] || WORKOUT_TYPES.inne;
    const dateObj = new Date(w.date + 'T00:00:00');
    const day     = dateObj.getDate();
    const mon     = ['STY','LUT','MAR','KWI','MAJ','CZE',
                     'LIP','SIE','WRZ','PAŹ','LIS','GRU'][dateObj.getMonth()];
    const isCardio = w.type === 'rower';
    const stat = isCardio
      ? `<span class="stat-big">${w.distance || 0}</span><span class="stat-unit"> km · ${w.duration || '--:--'}</span>`
      : `<span class="stat-big">${(w.totalVolume || 0).toLocaleString('pl')}</span><span class="stat-unit"> kg</span>`;

    return `
      <div class="workout-card" onclick="showWorkoutDetail('${w.id}')">
        <div class="workout-card-date">
          <div class="wc-day">${day}</div>
          <div class="wc-mon">${mon}</div>
        </div>
        <div class="workout-card-info">
          <div class="wc-type" style="color:${type.color}">
            ${type.icon} ${type.label.toUpperCase()}${w.name ? ' · ' + w.name : ''}
          </div>
          <div class="wc-stat">${stat}</div>
        </div>
        <div class="wc-bg-icon" style="color:${type.color}">${type.icon}</div>
      </div>`;
  }).join('');
}

function prevMonth() {
  if (--state.calendarMonth < 0) { state.calendarMonth = 11; state.calendarYear--; }
  renderCalendar();
}
function nextMonth() {
  if (++state.calendarMonth > 11) { state.calendarMonth = 0; state.calendarYear++; }
  renderCalendar();
}

// ============================================================
//  LOGOWANIE TRENINGU
// ============================================================
function startNewWorkoutOnDate(dateStr) {
  startNewWorkout(null, dateStr);
}

function startNewWorkout(plan = null, date = null) {
  const today = date || new Date().toISOString().split('T')[0];
  state.currentWorkout = {
    id:         null,
    date:       today,
    type:       plan?.type || 'silownia',
    name:       plan?.name || '',
    exercises:  plan
      ? plan.exercises.map(e => ({
          id:   genId(),
          name: e.name,
          sets: Array.from({ length: e.defaultSets || 3 }, () => ({
            id:     genId(),
            weight: e.defaultWeight || '',
            reps:   e.defaultReps   || '',
            done:   false
          }))
        }))
      : [],
    distance:    '',
    duration:    '',
    heartRate:   '',
    totalVolume: 0,
    fromPlan:    plan?.id || null
  };
  showView('log');
}

function renderLog() {
  if (!state.currentWorkout) { startNewWorkout(); return; }
  const w = state.currentWorkout;

  document.getElementById('log-date').value  = w.date;
  document.getElementById('log-name').value  = w.name;

  // Aktywny typ
  document.querySelectorAll('.type-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.type === w.type)
  );

  const isCardio = w.type === 'rower';
  document.getElementById('section-gym').style.display    = isCardio ? 'none'  : 'block';
  document.getElementById('section-cardio').style.display = isCardio ? 'block' : 'none';

  if (isCardio) {
    document.getElementById('log-distance').value  = w.distance;
    document.getElementById('log-duration').value  = w.duration;
    document.getElementById('log-heartrate').value = w.heartRate;
  } else {
    renderExercises();
    calculateVolume();
  }
}

function setWorkoutType(type) {
  if (!state.currentWorkout) return;
  state.currentWorkout.type = type;
  renderLog();
}

// ---- Ćwiczenia ----
function renderExercises() {
  const w   = state.currentWorkout;
  const con = document.getElementById('exercises-list');
  con.innerHTML = w.exercises.map((ex, exIdx) => `
    <div class="exercise-block" id="ex-${ex.id}">
      <div class="exercise-header">
        <select class="ex-name-select" onchange="updateExerciseName('${ex.id}', this.value)">
          ${buildExerciseOptions(ex.name)}
        </select>
        <button class="btn-icon-sm" onclick="showExerciseHistory('${escHtml(ex.name)}')">📈</button>
        <button class="btn-icon-sm danger" onclick="removeExercise('${ex.id}')">✕</button>
      </div>
      <div class="sets-table">
        <div class="sets-header">
          <span>#</span><span>KG</span><span>POWT.</span><span>✔</span>
        </div>
        ${ex.sets.map((s, si) => `
          <div class="set-row${s.done ? ' done' : ''}" id="set-${s.id}">
            <span class="set-num">${si + 1}</span>
            <input class="set-input" type="number" inputmode="decimal"
                   value="${s.weight}" placeholder="0"
                   onchange="updateSet('${ex.id}','${s.id}','weight',this.value)">
            <input class="set-input" type="number" inputmode="numeric"
                   value="${s.reps}" placeholder="0"
                   onchange="updateSet('${ex.id}','${s.id}','reps',this.value)">
            <button class="set-check${s.done ? ' checked' : ''}"
                    onclick="toggleSet('${ex.id}','${s.id}')">✔</button>
          </div>`).join('')}
      </div>
      <div class="sets-actions">
        <button class="btn-small" onclick="copyLastSets('${ex.id}')">📋 Kopiuj z historii</button>
        <button class="btn-small" onclick="addSet('${ex.id}')">+ Seria</button>
        <button class="btn-small danger" onclick="removeSet('${ex.id}')">− Seria</button>
      </div>
    </div>`).join('');
}

function addExercise() {
  state.currentWorkout.exercises.push({
    id: genId(), name: '',
    sets: [{ id: genId(), weight: '', reps: '', done: false }]
  });
  renderExercises();
  // Focus na nowe pole nazwy
  const inputs = document.querySelectorAll('.ex-name-input');
  if (inputs.length) inputs[inputs.length - 1].focus();
}

function removeExercise(exId) {
  state.currentWorkout.exercises = state.currentWorkout.exercises.filter(e => e.id !== exId);
  renderExercises();
}

function updateExerciseName(exId, name) {
  const ex = findEx(exId);
  if (ex) ex.name = name;
}

function addSet(exId) {
  const ex = findEx(exId);
  if (!ex) return;
  const last = ex.sets[ex.sets.length - 1];
  ex.sets.push({ id: genId(), weight: last?.weight || '', reps: last?.reps || '', done: false });
  renderExercises();
}

function removeSet(exId) {
  const ex = findEx(exId);
  if (!ex || ex.sets.length <= 1) return;
  ex.sets.pop();
  renderExercises();
  calculateVolume();
}

function updateSet(exId, setId, field, value) {
  const ex  = findEx(exId);
  const set = ex?.sets.find(s => s.id === setId);
  if (!set) return;
  set[field] = parseFloat(value) || '';
  autoSaveWorkout();
}

function toggleSet(exId, setId) {
  const ex  = findEx(exId);
  const set = ex?.sets.find(s => s.id === setId);
  if (!set) return;
  set.done = !set.done;

  const row = document.getElementById('set-' + setId);
  if (row) {
    row.classList.toggle('done', set.done);
    row.querySelector('.set-check').classList.toggle('checked', set.done);
  }

  if (set.done) startRestTimer(state.restTimer.duration);
  calculateVolume();
  autoSaveWorkout();
}

function copyLastSets(exId) {
  const ex = findEx(exId);
  if (!ex) return;
  for (const w of state.allWorkouts) {
    if (w.id === state.currentWorkout.id) continue;
    const histEx = (w.exercises || []).find(e => e.name === ex.name);
    if (histEx?.sets?.length) {
      ex.sets.forEach((s, i) => {
        if (!s.done) {
          const src = histEx.sets[i] || histEx.sets[histEx.sets.length - 1];
          s.weight = src.weight;
          s.reps   = src.reps;
        }
      });
      renderExercises();
      showToast('Załadowano dane z poprzedniego treningu 📋');
      return;
    }
  }
  showToast('Brak historii dla tego ćwiczenia');
}

function calculateVolume() {
  const w = state.currentWorkout;
  let total = 0;
  (w.exercises || []).forEach(ex =>
    (ex.sets || []).forEach(s => {
      if (s.done && s.weight && s.reps) total += parseFloat(s.weight) * parseFloat(s.reps);
    })
  );
  w.totalVolume = Math.round(total);
  const el = document.getElementById('current-volume');
  if (el) el.textContent = total.toLocaleString('pl') + ' kg';
}

// ---- Rest Timer ----
function startRestTimer(duration) {
  if (state.restTimer.timerId) clearInterval(state.restTimer.timerId);
  state.restTimer.active    = true;
  state.restTimer.duration  = duration;
  state.restTimer.remaining = duration;

  document.getElementById('rest-timer-bar').classList.add('active');
  updateRestTimerUI();

  state.restTimer.timerId = setInterval(() => {
    state.restTimer.remaining--;
    updateRestTimerUI();
    if (state.restTimer.remaining <= 0) {
      clearInterval(state.restTimer.timerId);
      state.restTimer.timerId = null;
      state.restTimer.active  = false;
      if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);
      document.getElementById('rest-label').textContent = '✅ Gotowy!';
      setTimeout(() => {
        document.getElementById('rest-timer-bar').classList.remove('active');
        document.getElementById('rest-label').textContent = 'Odpoczynek…';
      }, 2500);
    }
  }, 1000);
}

function updateRestTimerUI() {
  const r   = state.restTimer;
  const min = Math.floor(r.remaining / 60);
  const sec = r.remaining % 60;
  document.getElementById('rest-remaining').textContent = `${pad(min)}:${pad(sec)}`;
  document.getElementById('rest-total').textContent     = `/ ${pad(Math.floor(r.duration/60))}:${pad(r.duration%60)}`;
  const pct = ((r.duration - r.remaining) / r.duration) * 100;
  document.getElementById('rest-progress').style.width  = pct + '%';
}

function editRestDuration() {
  const val = prompt('Czas odpoczynku (sekundy):', state.restTimer.duration);
  const n   = parseInt(val);
  if (n > 0) {
    state.restTimer.duration = n;
    if (state.restTimer.active) startRestTimer(n);
    showToast(`Czas odpoczynku: ${n}s`);
  }
}

// ---- Zapis treningu ----
async function saveWorkout() {
  const w = state.currentWorkout;
  if (!w) return;

  w.date = document.getElementById('log-date').value;
  w.name = document.getElementById('log-name').value.trim();

  const isCardio = w.type === 'rower';
  if (isCardio) {
    w.distance  = parseFloat(document.getElementById('log-distance').value) || 0;
    w.duration  = document.getElementById('log-duration').value || '';
    w.heartRate = parseInt(document.getElementById('log-heartrate').value) || 0;
  }
  calculateVolume();

  const data = {
    date:        w.date,
    type:        w.type,
    name:        w.name,
    exercises:   w.exercises   || [],
    distance:    w.distance    || null,
    duration:    w.duration    || null,
    heartRate:   w.heartRate   || null,
    totalVolume: w.totalVolume || 0,
    fromPlan:    w.fromPlan    || null,
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp()
  };

  try {
    if (w.id) {
      await db.collection(`users/${state.userId}/workouts`).doc(w.id).update(data);
    } else {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      const ref = await db.collection(`users/${state.userId}/workouts`).add(data);
      w.id = ref.id;
    }
    showToast('Trening zapisany! 💪');
    await loadWorkouts();
    showView('dashboard');
  } catch (e) {
    console.error('Save error:', e);
    showToast('Błąd zapisu. Sprawdź połączenie.');
  }
}

let autoSaveTimeout = null;
async function autoSaveWorkout() {
  if (!state.currentWorkout) return;
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(async () => {
    const w = state.currentWorkout;
    const data = {
      date: w.date, type: w.type, name: w.name,
      exercises: w.exercises, totalVolume: w.totalVolume || 0,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    try {
      if (w.id) {
        await db.collection(`users/${state.userId}/workouts`).doc(w.id).update(data);
      } else {
        data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        const ref = await db.collection(`users/${state.userId}/workouts`).add(data);
        w.id = ref.id;
      }
    } catch (e) { /* silent */ }
  }, 1500);
}

// ============================================================
//  PLANY TRENINGOWE
// ============================================================
function renderPlans() {
  const con = document.getElementById('plans-list');
  if (state.plans.length === 0) {
    con.innerHTML = `
      <div class="empty-state">
        <div style="font-size:2.5rem">📋</div>
        <div>Brak planów treningowych</div>
        <div class="empty-sub">Stwórz swój pierwszy plan!</div>
      </div>`;
    return;
  }

  con.innerHTML = state.plans.map(plan => {
    const type = WORKOUT_TYPES[plan.type] || WORKOUT_TYPES.inne;
    const lastSess = plan.lastSession
      ? formatDate(plan.lastSession.toDate ? plan.lastSession.toDate() : new Date(plan.lastSession))
      : 'Nowy plan';
    const isNew = !plan.lastSession;
    return `
      <div class="plan-card">
        <div class="plan-card-top">
          <div class="plan-icon" style="background:${type.color}22; color:${type.color}">
            ${type.icon}
          </div>
          <span class="plan-badge ${isNew ? 'badge-new' : ''}">${isNew ? 'Nowy plan' : 'Ostatnio: ' + lastSess}</span>
        </div>
        <div class="plan-name">${escHtml(plan.name)}</div>
        <div class="plan-meta">
          ${type.label} · ${(plan.exercises||[]).length} ćwiczeń · ~${plan.estimatedDuration || '?'} min
        </div>
        <div class="plan-actions">
          <button class="btn-secondary" onclick="editPlan('${plan.id}')">✏️ Edytuj</button>
          <button class="btn-primary" onclick="startFromPlan('${plan.id}')">▶ Rozpocznij</button>
        </div>
      </div>`;
  }).join('');
}

async function startFromPlan(planId) {
  const plan = state.plans.find(p => p.id === planId);
  if (!plan) return;
  try {
    await db.collection(`users/${state.userId}/plans`).doc(planId).update({
      lastSession: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) { /* silent */ }
  startNewWorkout(plan);
}

// ---- Edytor planu ----
function showCreatePlan() {
  state.editingPlan = { id: null, name: '', type: 'silownia', estimatedDuration: 45, exercises: [] };
  renderPlanEditor();
  document.getElementById('modal-plan').classList.add('active');
}

function editPlan(planId) {
  const plan = state.plans.find(p => p.id === planId);
  if (!plan) return;
  state.editingPlan = JSON.parse(JSON.stringify(plan));
  renderPlanEditor();
  document.getElementById('modal-plan').classList.add('active');
}

function renderPlanEditor() {
  const p = state.editingPlan;
  document.getElementById('plan-name-input').value     = p.name;
  document.getElementById('plan-duration-input').value = p.estimatedDuration;
  document.querySelectorAll('.plan-type-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.type === p.type)
  );
  renderPlanExercises();
  document.getElementById('modal-plan-title').textContent = p.id ? 'Edytuj plan' : 'Nowy plan';
  // Pokaż przycisk usuń tylko przy edycji
  const delBtn = document.getElementById('btn-delete-plan');
  delBtn.style.display = p.id ? 'block' : 'none';
  delBtn.onclick = () => deletePlan(p.id);
}

function renderPlanExercises() {
  const p   = state.editingPlan;
  const con = document.getElementById('plan-exercises-list');
  con.innerHTML = (p.exercises || []).map((ex, i) => `
    <div class="plan-ex-row">
      <span class="plan-ex-num">${i + 1}</span>
      <select class="plan-ex-name" onchange="updatePlanEx(${i},'name',this.value)">
        ${buildExerciseOptions(ex.name)}
      </select>
      <input class="plan-ex-small" type="number" value="${ex.defaultSets}" placeholder="S"
             oninput="updatePlanEx(${i},'defaultSets',+this.value)" title="Serie">
      <span class="plan-ex-x">×</span>
      <input class="plan-ex-small" type="number" value="${ex.defaultReps}" placeholder="P"
             oninput="updatePlanEx(${i},'defaultReps',+this.value)" title="Powtórzenia">
      <button class="btn-icon-sm danger" onclick="removePlanEx(${i})">✕</button>
    </div>`).join('');
}

function updatePlanEx(idx, field, value) {
  if (state.editingPlan?.exercises[idx]) state.editingPlan.exercises[idx][field] = value;
}

function addPlanExercise() {
  state.editingPlan.exercises.push({ name: '', defaultSets: 3, defaultReps: 10, defaultWeight: 0 });
  renderPlanExercises();
}

function removePlanEx(idx) {
  state.editingPlan.exercises.splice(idx, 1);
  renderPlanExercises();
}

async function savePlan() {
  const p   = state.editingPlan;
  p.name    = document.getElementById('plan-name-input').value.trim();
  p.estimatedDuration = parseInt(document.getElementById('plan-duration-input').value) || 45;
  p.type    = document.querySelector('.plan-type-btn.active')?.dataset.type || 'silownia';

  if (!p.name) { showToast('Podaj nazwę planu'); return; }

  const data = { name: p.name, type: p.type, estimatedDuration: p.estimatedDuration, exercises: p.exercises };
  try {
    if (p.id) {
      await db.collection(`users/${state.userId}/plans`).doc(p.id).update(data);
    } else {
      await db.collection(`users/${state.userId}/plans`).add(data);
    }
    closePlanModal();
    await loadPlans();
    renderPlans();
    showToast('Plan zapisany! ✅');
  } catch (e) {
    console.error(e);
    showToast('Błąd zapisu planu');
  }
}

async function deletePlan(planId) {
  if (!confirm('Usunąć ten plan?')) return;
  await db.collection(`users/${state.userId}/plans`).doc(planId).delete();
  closePlanModal();
  await loadPlans();
  renderPlans();
  showToast('Plan usunięty');
}

function closePlanModal() {
  document.getElementById('modal-plan').classList.remove('active');
  state.editingPlan = null;
}

// ============================================================
//  STATYSTYKI
// ============================================================
function prevStatMonth() {
  if (--state.statsMonth < 0) { state.statsMonth = 11; state.statsYear--; }
  renderStats();
}
function nextStatMonth() {
  if (++state.statsMonth > 11) { state.statsMonth = 0; state.statsYear++; }
  renderStats();
}

function buildExerciseSelect() {
  const names = new Set();
  state.allWorkouts.forEach(w => (w.exercises || []).forEach(e => { if (e.name) names.add(e.name); }));
  const sel = document.getElementById('stats-exercise-select');
  const prev = sel.value;
  sel.innerHTML = '<option value="">— wybierz ćwiczenie —</option>' +
    [...names].map(n => `<option value="${escHtml(n)}" ${n === prev ? 'selected' : ''}>${escHtml(n)}</option>`).join('');
}

function renderStats() {
  const MONTHS = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
                  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
  const y = state.statsYear, m = state.statsMonth;

  const monthW = state.allWorkouts.filter(w => {
    const d = new Date(w.date + 'T00:00:00');
    return d.getFullYear() === y && d.getMonth() === m;
  });

  const totalVolume   = monthW.filter(w => ['silownia','inne'].includes(w.type))
                              .reduce((s, w) => s + (w.totalVolume || 0), 0);
  const totalDistance = monthW.filter(w => w.type === 'rower')
                              .reduce((s, w) => s + (w.distance || 0), 0);
  const totalCount    = monthW.length;

  document.getElementById('stats-month-name').textContent  = `${MONTHS[m]} ${y}`;
  document.getElementById('stats-volume').textContent      = totalVolume.toLocaleString('pl') + ' kg';
  document.getElementById('stats-distance').textContent    = totalDistance.toFixed(1) + ' km';
  document.getElementById('stats-count').textContent       = totalCount;

  renderStrengthChart();
  renderVolumeChart();
  renderActivityChart(monthW);
}

function renderStrengthChart() {
  const name = document.getElementById('stats-exercise-select').value;
  const con  = document.getElementById('chart-strength-wrap');
  const ctx  = document.getElementById('chart-strength').getContext('2d');

  if (!name) {
    con.style.opacity = '0.3';
    if (state.charts.strength) { state.charts.strength.destroy(); state.charts.strength = null; }
    return;
  }
  con.style.opacity = '1';

  const data = [];
  [...state.allWorkouts].reverse().forEach(w => {
    const ex = (w.exercises || []).find(e => e.name === name);
    if (ex) {
      const maxW = Math.max(0, ...(ex.sets || []).filter(s => s.done).map(s => +s.weight || 0));
      if (maxW > 0) data.push({ date: w.date, weight: maxW });
    }
  });
  const pts = data.slice(-12);

  if (state.charts.strength) state.charts.strength.destroy();
  state.charts.strength = new Chart(ctx, {
    type: 'line',
    data: {
      labels: pts.map(d => d.date.slice(5)),
      datasets: [{
        label: 'Max ciężar (kg)',
        data:  pts.map(d => d.weight),
        borderColor:     '#5b7fff',
        backgroundColor: 'rgba(91,127,255,0.12)',
        tension: 0.35, pointRadius: 5,
        pointBackgroundColor: '#5b7fff', fill: true
      }]
    },
    options: chartOpts('kg')
  });
}

function renderVolumeChart() {
  const ctx  = document.getElementById('chart-volume').getContext('2d');
  const now  = new Date();
  const weeks = [];
  for (let i = 3; i >= 0; i--) {
    const ws = new Date(now); ws.setDate(now.getDate() - now.getDay() - i * 7 + 1);
    const we = new Date(ws);  we.setDate(ws.getDate() + 6);
    const vol = state.allWorkouts
      .filter(w => { const d = new Date(w.date + 'T00:00:00'); return d >= ws && d <= we; })
      .reduce((s, w) => s + (w.totalVolume || 0), 0);
    weeks.push({ label: `T${4 - i}`, vol });
  }

  if (state.charts.volume) state.charts.volume.destroy();
  state.charts.volume = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: weeks.map(w => w.label),
      datasets: [{
        label: 'Objętość (kg)',
        data:  weeks.map(w => w.vol),
        backgroundColor: weeks.map((_, i) => i === weeks.length - 1 ? '#5b7fff' : 'rgba(91,127,255,0.3)'),
        borderRadius: 8
      }]
    },
    options: chartOpts('kg')
  });
}

function renderActivityChart(monthWorkouts) {
  const ctx = document.getElementById('chart-activity').getContext('2d');
  const counts = {};
  monthWorkouts.forEach(w => { counts[w.type] = (counts[w.type] || 0) + 1; });

  if (state.charts.activity) state.charts.activity.destroy();

  if (Object.keys(counts).length === 0) {
    // Pusty donut
    state.charts.activity = new Chart(ctx, {
      type: 'doughnut',
      data: { labels: ['Brak danych'], datasets: [{ data: [1], backgroundColor: ['#2a2a45'], borderWidth: 0 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8888aa' } } } }
    });
    return;
  }

  state.charts.activity = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels:   Object.keys(counts).map(t => WORKOUT_TYPES[t]?.label || t),
      datasets: [{
        data:            Object.values(counts),
        backgroundColor: Object.keys(counts).map(t => WORKOUT_TYPES[t]?.color || '#9ca3af'),
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { color: '#fff', padding: 14, font: { size: 12 } } } }
    }
  });
}

function chartOpts(unit) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#8888aa', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#8888aa' }, grid: { color: 'rgba(255,255,255,0.04)' } },
      y: {
        ticks: { color: '#8888aa', callback: v => v + ' ' + unit },
        grid: { color: 'rgba(255,255,255,0.04)' }
      }
    }
  };
}

// ============================================================
//  DETAIL MODAL — szczegóły treningu
// ============================================================
async function showWorkoutDetail(workoutId) {
  const w    = state.allWorkouts.find(x => x.id === workoutId);
  if (!w) return;
  const type = WORKOUT_TYPES[w.type] || WORKOUT_TYPES.inne;
  const con  = document.getElementById('modal-detail-content');

  let html = `
    <div class="detail-header">
      <span class="detail-type-badge" style="color:${type.color};background:${type.color}22">
        ${type.icon} ${type.label}
      </span>
      <span class="detail-date">${formatDate(new Date(w.date + 'T00:00:00'))}</span>
    </div>
    <h2 class="detail-title">${escHtml(w.name || type.label)}</h2>`;

  const isCardio = w.type === 'rower';
  if (!isCardio) {
    html += `<div class="detail-volume">Całkowita objętość: <strong>${(w.totalVolume||0).toLocaleString('pl')} kg</strong></div>`;
    (w.exercises || []).forEach(ex => {
      html += `
        <div class="detail-exercise">
          <div class="detail-ex-name">${escHtml(ex.name)}</div>
          <div class="detail-sets">
            ${(ex.sets || []).map((s, i) => `<span class="detail-set-chip">${i+1}: ${s.weight}kg × ${s.reps}</span>`).join('')}
          </div>
        </div>`;
    });
  } else {
    html += `
      <div class="detail-cardio-stats">
        <div class="dc-stat"><span class="dc-val">${w.distance || 0}</span><span class="dc-lbl">km</span></div>
        <div class="dc-stat"><span class="dc-val">${w.duration || '--:--'}</span><span class="dc-lbl">czas</span></div>
        ${w.heartRate ? `<div class="dc-stat"><span class="dc-val">${w.heartRate}</span><span class="dc-lbl">bpm</span></div>` : ''}
      </div>`;
  }

  html += `
    <div class="detail-footer-actions">
      <button class="btn-secondary" onclick="editWorkout('${w.id}')">✏️ Edytuj</button>
      <button class="btn-danger"    onclick="deleteWorkout('${w.id}')">🗑 Usuń</button>
    </div>`;

  con.innerHTML = html;
  document.getElementById('modal-detail').classList.add('active');
}

function editWorkout(workoutId) {
  const w = state.allWorkouts.find(x => x.id === workoutId);
  if (!w) return;
  state.currentWorkout = JSON.parse(JSON.stringify(w));
  closeDetailModal();
  showView('log');
}

async function deleteWorkout(workoutId) {
  if (!confirm('Usunąć ten trening?')) return;
  await db.collection(`users/${state.userId}/workouts`).doc(workoutId).delete();
  closeDetailModal();
  await loadWorkouts();
  renderDashboard();
  showToast('Trening usunięty');
}

function closeDetailModal() {
  document.getElementById('modal-detail').classList.remove('active');
}

// ============================================================
//  HISTORIA ĆWICZENIA
// ============================================================
function showExerciseHistory(name) {
  if (!name) { showToast('Najpierw podaj nazwę ćwiczenia'); return; }
  const history = [];
  state.allWorkouts.forEach(w => {
    const ex = (w.exercises || []).find(e => e.name === name);
    if (ex) history.push({ date: w.date, sets: ex.sets });
  });

  const con = document.getElementById('modal-history-content');
  con.innerHTML = `<h3 style="margin-bottom:1rem">📈 ${escHtml(name)}</h3>` +
    (history.length === 0 ? '<div class="empty-state">Brak historii</div>' :
    history.slice(0, 10).map(h => `
      <div class="history-entry">
        <div class="history-date">${formatDate(new Date(h.date + 'T00:00:00'))}</div>
        <div class="history-sets">
          ${(h.sets || []).map((s, i) => `<span class="detail-set-chip">${i+1}: ${s.weight}kg × ${s.reps}</span>`).join('')}
        </div>
      </div>`).join(''));

  document.getElementById('modal-history').classList.add('active');
}

function closeHistoryModal() {
  document.getElementById('modal-history').classList.remove('active');
}

// ============================================================
//  HELPERS
// ============================================================
function findEx(exId) {
  return state.currentWorkout?.exercises.find(e => e.id === exId);
}

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatDate(date) {
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function mkEl(tag, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  return el;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('visible'), 3000);
}
