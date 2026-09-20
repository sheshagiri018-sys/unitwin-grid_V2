/**
 * dashboardView.js â€” UNITWIN GRID V2
 * Drives all DOM updates on the main Dashboard page.
 */

import { subscribe } from '../core/state.js';

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function el(id) { return document.getElementById(id); }

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text ?? 'â€”';
}

function setStyle(id, prop, value) {
  const node = el(id);
  if (node) node.style[prop] = value;
}

// ---------------------------------------------------------------------------
// animateNumber â€” smoothly transitions displayed number over 300 ms
// ---------------------------------------------------------------------------

/**
 * Animate a numeric display from its current rendered value to target.
 * @param {HTMLElement|null} node
 * @param {number} value
 * @param {number} [decimals=2]
 */
export function animateNumber(node, value, decimals = 2) {
  if (!node) return;
  const start    = parseFloat(node.textContent) || 0;
  const end      = Number(value);
  const duration = 300;
  const t0       = performance.now();

  function step(ts) {
    const progress = Math.min((ts - t0) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // cubic ease-out
    node.textContent = (start + (end - start) * ease).toFixed(decimals);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ---------------------------------------------------------------------------
// setSourceTag â€” toggle live / simulation badge
// ---------------------------------------------------------------------------

/**
 * Apply src-live or src-simulation class and label text to an element.
 * @param {HTMLElement|null} node
 * @param {'LIVE'|'SIMULATION'|string} mode
 */
export function setSourceTag(node, mode) {
  if (!node) return;
  const isLive = mode === 'LIVE';
  node.classList.toggle('src-live',       isLive);
  node.classList.toggle('src-simulation', !isLive);
  node.textContent = isLive ? 'LIVE' : 'SIM';
}

// ---------------------------------------------------------------------------
// Connectivity dot helper
// ---------------------------------------------------------------------------

function setConnDot(id, connected) {
  const node = el(id);
  if (!node) return;
  node.classList.toggle('conn-dot--online',  !!connected);
  node.classList.toggle('conn-dot--offline', !connected);
}

// ---------------------------------------------------------------------------
// Time formatter
// ---------------------------------------------------------------------------

function fmtTime(date) {
  return [
    String(date.getHours()).padStart(2, '0'),
    String(date.getMinutes()).padStart(2, '0'),
    String(date.getSeconds()).padStart(2, '0'),
  ].join(':');
}

// ---------------------------------------------------------------------------
// Main state â†’ DOM application
// ---------------------------------------------------------------------------

function applyState(state) {
  const s      = state.sensors       || {};
  const lo     = state.loads         || {};
  const sol    = state.solar         || {};
  const ev     = lo.ev               || {};
  const hh     = lo.household        || {};
  const batt   = lo.battery          || {};
  const hlth   = state.health        || {};
  const load   = state.loading       || {};
  const intel  = state.intelligence  || {};
  const conn   = state.connectivity  || {};
  const cfg    = state.config        || {};

  // â”€â”€ Primary transformer sensors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  animateNumber(el('txVoltage'),   s.voltage,      1);
  animateNumber(el('txCurrent'),   s.current,      2);
  animateNumber(el('txPower'),     s.power,        0);
  animateNumber(el('txTemp'),      s.temperature,  1);
  animateNumber(el('txVibration'), s.vibration,    3);
  animateNumber(el('txFreq'),      s.frequency,    2);
  animateNumber(el('txPF'),        s.powerFactor,  3);

  // Transformer state badge
  const stateNode = el('txState');
  if (stateNode) {
    stateNode.textContent = state.transformerState ?? 'â€”';
    stateNode.className   = 'badge badge--' +
      (state.transformerState ?? 'unknown').toLowerCase().replace(/\s+/g, '-');
  }

  // â”€â”€ Summary badges â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const badgeLoad  = el('txBadgeLoad');
  const badgeSolar = el('txBadgeSolar');
  const badgeEV    = el('txBadgeEV');

  if (badgeLoad)  badgeLoad.textContent  = load.percentage != null ? load.percentage.toFixed(1) + ' %' : 'â€”';
  if (badgeSolar) badgeSolar.textContent = sol.power       != null ? sol.power.toFixed(0)        + ' W' : 'â€”';
  if (badgeEV)    badgeEV.textContent    = ev.power        != null ? ev.power.toFixed(0)         + ' W' : 'â€”';

  // â”€â”€ Solar panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setText('solarPower',   sol.power   != null ? sol.power.toFixed(0)   + ' W' : 'â€”');
  setText('solarVoltage', sol.voltage != null ? sol.voltage.toFixed(1) + ' V' : 'â€”');
  setText('solarCurrent', sol.current != null ? sol.current.toFixed(2) + ' A' : 'â€”');
  setText('solarStatus',  sol.status ?? 'â€”');

  const solarCapacity = cfg.solarCapacity || 5000;
  const solarPct      = Math.min(100, Math.max(0, ((sol.power || 0) / solarCapacity) * 100));
  setStyle('solarBar', 'width', solarPct.toFixed(1) + '%');

  // â”€â”€ EV panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setText('evPower', ev.power != null ? ev.power.toFixed(0) + ' W' : 'â€”');

  const evBadge = el('evStatusBadge');
  if (evBadge) {
    evBadge.textContent = ev.status ?? 'â€”';
    evBadge.className   = 'badge badge--' + (ev.status ?? 'offline').toLowerCase();
  }

  const battPct = batt.percentage ?? 0;
  setText('battPct', battPct.toFixed(0) + ' %');
  setStyle('battBar', 'width', Math.min(100, battPct).toFixed(1) + '%');

  // â”€â”€ Household panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setText('hhPower', hh.power != null ? hh.power.toFixed(0) + ' W' : 'â€”');

  const hhBadge = el('hhStatusBadge');
  if (hhBadge) {
    hhBadge.textContent = hh.status ?? 'â€”';
    hhBadge.className   = 'badge badge--' + (hh.status ?? 'offline').toLowerCase();
  }

  // â”€â”€ Health score ring â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const score = hlth.score ?? 100;
  setText('healthScore', score.toFixed(0));
  setText('healthLabel', hlth.label ?? 'Good');

  // SVG circle circumference for r=45 â†’ C = 2Ï€Ã—45 â‰ˆ 282.7
  const CIRC   = 282.7;
  const offset = CIRC - (Math.min(100, Math.max(0, score)) / 100) * CIRC;
  const ringNode = el('healthScoreRing');
  if (ringNode) {
    ringNode.style.strokeDasharray  = `${CIRC}`;
    ringNode.style.strokeDashoffset = offset.toFixed(2);
  }

  // â”€â”€ Loading percentage / arc â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadPct = load.percentage ?? 0;
  setText('loadingPct',   loadPct.toFixed(1) + '%');
  setText('loadingState', load.state ?? 'â€”');

  const arcNode = el('loadingArc');
  if (arcNode) {
    const ARC_LEN = 220;
    arcNode.style.strokeDasharray = `${((loadPct / 100) * ARC_LEN).toFixed(2)} ${ARC_LEN}`;
  }

  // â”€â”€ Intelligence factor bars â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const factors = intel.factors || {};
  const factorIds = {
    factor_loading:     factors.loading,
    factor_temperature: factors.temperature,
    factor_voltage:     factors.voltage,
    factor_vibration:   factors.vibration,
  };
  for (const [id, val] of Object.entries(factorIds)) {
    setStyle(id, 'width', Math.min(100, Math.max(0, val ?? 0)).toFixed(1) + '%');
  }

  // â”€â”€ Intelligence text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setText('intelState',     intel.state             ?? 'â€”');
  setText('intelEVImpact',  intel.evImpact          ?? 'â€”');
  setText('intelThermal',   intel.thermal           ?? 'â€”');
  setText('intelVibration', intel.vibration         ?? 'â€”');
  setText('intelRec',       intel.recommendation    ?? 'â€”');

  // â”€â”€ Connectivity dots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setConnDot('connESP32',    conn.esp32);
  setConnDot('connDatabase', conn.database);
  setConnDot('connSensor',   conn.sensor);
  setConnDot('connTwin',     conn.twin);

  // â”€â”€ Last update / mode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const ts = state.lastUpdate ? new Date(state.lastUpdate) : new Date();
  setText('lastUpdate', fmtTime(ts));

  const modeNode = el('modeIndicator');
  if (modeNode) {
    modeNode.textContent = state.mode ?? 'SIMULATION';
    modeNode.className   = 'mode-indicator mode--' + (state.mode ?? 'simulation').toLowerCase();
  }

  // â”€â”€ Source tags (any element with data-source-tag attribute) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  document.querySelectorAll('[data-source-tag]').forEach((node) => {
    setSourceTag(node, state.mode);
  });

  // â”€â”€ Bottom status bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setText('sensorTxVoltage', s.voltage      != null ? s.voltage.toFixed(1)      + ' V'  : 'â€”');
  setText('sensorTxCurrent', s.current      != null ? s.current.toFixed(2)      + ' A'  : 'â€”');
  setText('sensorTxPower',   s.power        != null ? s.power.toFixed(0)        + ' W'  : 'â€”');
  setText('sensorTxTemp',    s.temperature  != null ? s.temperature.toFixed(1)  + ' Â°C' : 'â€”');
  setText('sensorLoading',   loadPct.toFixed(1) + '%');
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise the Dashboard view.
 * Subscribes to all state changes and renders on every update.
 */
export function initDashboardView() {
  subscribe('*', (state) => applyState(state));
}
