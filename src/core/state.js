// ============================================================
// UNITWIN GRID V2 — Centralized Reactive State Engine
// Single source of truth for ALL application components
// Strict data provenance: LIVE vs SIMULATION always tracked
// ============================================================

import CONFIG from '../config/config.js';

// ── Initial State ─────────────────────────────────────────────
const _defaultState = {
  mode: 'SIMULATION',   // 'LIVE' | 'SIMULATION'

  transformer: {
    voltage:     12.10,
    current:     0.350,
    power:       4.24,
    temperature: 32.4,
    vibration:   0.120,
    loading:     35.3,
    frequency:   50.0,
    powerFactor: 0.95,
    state:       'NORMAL',   // NORMAL | WARNING | CRITICAL | OFFLINE
    alarm:       false,
    sources: {
      voltage:     'SIMULATION',
      current:     'SIMULATION',
      power:       'SIMULATION',
      temperature: 'SIMULATION',
      vibration:   'SIMULATION'
    }
  },

  solar: {
    voltage: 5.80,
    current: 0.180,
    power:   1.04,
    status:  'ACTIVE',
    source:  'SIMULATION'
  },

  ambient: {
    temperature: 28.5,
    humidity:    65.0,
    source:      'SIMULATION'
  },

  ev: {
    status:  'IDLE',
    power:   0.0,
    current: 0.0,
    battery: 62,
    level:   'off',
    mode:    'EMULATOR',
    source:  'SIMULATION'
  },

  household: {
    status: 'ON',
    power:  2.40,
    source: 'SIMULATION'
  },

  health: {
    score:   94,
    label:   'HEALTHY',
    factors: {
      loading:     { score: 90, label: 'GOOD' },
      temperature: { score: 95, label: 'GOOD' },
      voltage:     { score: 100, label: 'GOOD' },
      vibration:   { score: 88, label: 'GOOD' }
    }
  },

  intelligence: {
    state:          'NORMAL LOAD',
    evImpact:       '+0%',
    thermal:        'NORMAL',
    vibration:      'NORMAL',
    recommendation: 'System operating within normal parameters.',
    trendAlert:     null,
    causeEffect:    []
  },

  connectivity: {
    esp32:        false,
    database:     false,
    sensorStream: false,
    twinSync:     true,
    lastUpdate:   null,
    rssi:         null,
    packets:      0,
    uptime:       0
  },

  scenario: 'NORMAL',

  alerts: [],

  dataHistory: {
    voltage:     [],
    current:     [],
    power:       [],
    temperature: [],
    vibration:   [],
    loading:     [],
    solar:       [],
    ev:          [],
    timestamps:  []
  },

  twin: {
    viewMode:     'STANDARD',   // STANDARD | THERMAL | ENERGY | SENSOR | EXPLODED
    selectedPart: null,
    camera:       'overview'
  }
};

// Deep clone default state as working state
let _state = JSON.parse(JSON.stringify(_defaultState));
const _listeners = new Map();

// ── Subscribe ─────────────────────────────────────────────────
export function subscribe(key, callback) {
  if (!_listeners.has(key)) _listeners.set(key, []);
  _listeners.get(key).push(callback);
  callback(_state);
  return () => {
    const arr = _listeners.get(key);
    if (arr) {
      const i = arr.indexOf(callback);
      if (i > -1) arr.splice(i, 1);
    }
  };
}

// ── Emit to listeners ─────────────────────────────────────────
function _emit(keys) {
  const notify = new Set(['*', ...keys]);
  notify.forEach(k => {
    (_listeners.get(k) || []).forEach(cb => cb(_state));
  });
}

// ── Patch state helper ─────────────────────────────────────────
function _patch(section, data) {
  if (typeof data === 'object' && !Array.isArray(data)) {
    _state[section] = { ..._state[section], ...data };
  } else {
    _state[section] = data;
  }
}

// ── History recording ──────────────────────────────────────────
const MAX_HISTORY = CONFIG.performance.chartMaxPoints;
function _recordHistory() {
  const h = _state.dataHistory;
  const tx = _state.transformer;
  const now = Date.now();

  h.timestamps.push(now);
  h.voltage.push(tx.voltage);
  h.current.push(tx.current);
  h.power.push(tx.power);
  h.temperature.push(tx.temperature);
  h.vibration.push(tx.vibration);
  h.loading.push(tx.loading);
  h.solar.push(_state.solar.power);
  h.ev.push(_state.ev.power);

  // Trim to max length
  if (h.timestamps.length > MAX_HISTORY) {
    Object.keys(h).forEach(k => { h[k] = h[k].slice(-MAX_HISTORY); });
  }
}

// ── Transformer State Update ───────────────────────────────────
export function setTransformerState(data) {
  _patch('transformer', data);
  _computeTransformerDerived();
  _recordHistory();
  _emit(['transformer', 'health', 'intelligence']);
}

function _computeTransformerDerived() {
  const tx = _state.transformer;
  const loading = tx.loading;
  const temp = tx.temperature;

  // State classification
  if (loading >= 90 || temp >= 70) tx.state = 'CRITICAL';
  else if (loading >= 75 || temp >= 45) tx.state = 'WARNING';
  else tx.state = 'NORMAL';

  // Thermal alarm (matches hardware: LED alarm at 35°C)
  tx.alarm = temp >= CONFIG.transformer.alarmTemperature;
}

// ── Solar Update ───────────────────────────────────────────────
export function setSolarGeneration(data) {
  _patch('solar', data);
  _emit(['solar']);
}

// ── EV Update ──────────────────────────────────────────────────
export function setEVCharging(data) {
  _patch('ev', data);
  _emit(['ev']);
}

// ── Household Load Update ──────────────────────────────────────
export function setHouseholdLoad(data) {
  _patch('household', data);
  _emit(['household']);
}

// ── Ambient / Environment Update ──────────────────────────────
export function setAmbientData(data) {
  _patch('ambient', data);
  _emit(['ambient']);
}

// ── Connectivity ───────────────────────────────────────────────
export function setConnectivity(data) {
  _patch('connectivity', data);
  _emit(['connectivity']);
}

// ── Health Index Update ────────────────────────────────────────
export function setHealthIndex(data) {
  _patch('health', data);
  _emit(['health']);
}

// ── Intelligence Update ────────────────────────────────────────
export function setIntelligence(data) {
  _patch('intelligence', data);
  _emit(['intelligence']);
}

// ── Twin View Mode ─────────────────────────────────────────────
export function setTwinViewMode(mode) {
  _state.twin.viewMode = mode;
  _emit(['twin']);
}

export function setTwinSelectedPart(part) {
  _state.twin.selectedPart = part;
  _emit(['twin']);
}

// ── Alerts ─────────────────────────────────────────────────────
let _alertIdCounter = 0;
export function addAlert(severity, message, source = 'SYSTEM') {
  const alert = {
    id:        ++_alertIdCounter,
    severity,
    message,
    source,
    timestamp: Date.now(),
    status:    'ACTIVE'
  };
  _state.alerts = [alert, ..._state.alerts].slice(0, 100);
  _emit(['alerts']);
  return alert.id;
}

export function acknowledgeAlert(id) {
  _state.alerts = _state.alerts.map(a =>
    a.id === id ? { ...a, status: 'ACKNOWLEDGED' } : a
  );
  _emit(['alerts']);
}

export function resolveAlert(id) {
  _state.alerts = _state.alerts.map(a =>
    a.id === id ? { ...a, status: 'RESOLVED' } : a
  );
  _emit(['alerts']);
}

export function clearAlerts() {
  _state.alerts = [];
  _emit(['alerts']);
}

// ── Data Mode ──────────────────────────────────────────────────
export function setMode(mode) {
  _state.mode = mode;
  _emit(['*']);
}

// ── Scenario ───────────────────────────────────────────────────
export function setScenario(name) {
  _state.scenario = name;
  _emit(['scenario']);
}

// ── Full State Read ────────────────────────────────────────────
export function getState() {
  return _state;
}

export function resetState() {
  _state = JSON.parse(JSON.stringify(_defaultState));
  _emit(['*']);
}
