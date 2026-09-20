/**
 * monitoringView.js â€” UNITWIN GRID V2
 * Drives all DOM updates on the Live Monitoring page.
 * Tracks per-sensor min / max / running average and updates stat elements.
 */

import { subscribe } from '../core/state.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(id) { return document.getElementById(id); }

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text ?? 'â€”';
}

/**
 * Apply LIVE / SIMULATION source-tag styling to an element.
 * @param {HTMLElement|null} node
 * @param {string} mode  'LIVE' | 'SIMULATION'
 */
function setSourceTag(node, mode) {
  if (!node) return;
  const isLive = mode === 'LIVE';
  node.classList.toggle('src-live',       isLive);
  node.classList.toggle('src-simulation', !isLive);
  node.textContent = isLive ? 'LIVE' : 'SIM';
}

// ---------------------------------------------------------------------------
// Per-sensor statistics tracker
// ---------------------------------------------------------------------------

/**
 * Tracking record for a single sensor channel.
 * @typedef {{ min: number, max: number, sum: number, count: number }} SensorStats
 */

/** @type {Map<string, SensorStats>} */
const statsMap = new Map();

/**
 * Update running stats for a named sensor and return the current stats.
 * @param {string} key    Logical sensor name (e.g. 'voltage')
 * @param {number} value
 * @returns {SensorStats}
 */
function trackStats(key, value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return statsMap.get(key) ?? { min: 0, max: 0, sum: 0, count: 0 };
  }

  let s = statsMap.get(key);
  if (!s) {
    s = { min: value, max: value, sum: value, count: 1 };
  } else {
    s.min   = Math.min(s.min, value);
    s.max   = Math.max(s.max, value);
    s.sum  += value;
    s.count += 1;
  }
  statsMap.set(key, s);
  return s;
}

/**
 * Write min / max / avg to optional DOM elements.
 * Element IDs follow the pattern: `{prefix}Min`, `{prefix}Max`, `{prefix}Avg`.
 * @param {string} prefix  e.g. 'voltage2'
 * @param {SensorStats} stats
 * @param {number} [decimals=2]
 */
function updateStatElements(prefix, stats, decimals = 2) {
  setText(`${prefix}Min`, stats.min.toFixed(decimals));
  setText(`${prefix}Max`, stats.max.toFixed(decimals));
  setText(`${prefix}Avg`, (stats.sum / stats.count).toFixed(decimals));
}

// ---------------------------------------------------------------------------
// Main state â†’ DOM application
// ---------------------------------------------------------------------------

function applyState(state) {
  const s   = state.sensors  || {};
  const lo  = state.loads    || {};
  const sol = state.solar    || {};
  const ev  = lo.ev          || {};
  const hh  = lo.household   || {};
  const load = state.loading || {};
  const env  = state.environment || {};

  // â”€â”€ Sensor card values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  /** Helper to set a card value and update stats. */
  function setCard(elId, statKey, value, unit = '', decimals = 2) {
    const display = value != null ? value.toFixed(decimals) + (unit ? ' ' + unit : '') : 'â€”';
    setText(elId, display);
    if (value != null) {
      const stats = trackStats(statKey, value);
      updateStatElements(statKey, stats, decimals);
    }
  }

  setCard('sensorTxVoltage2',  'voltage',     s.voltage,        'V',   1);
  setCard('sensorTxCurrent2',  'current',     s.current,        'A',   2);
  setCard('sensorTxPower2',    'power',       s.power,          'W',   0);
  setCard('sensorTxTemp2',     'temperature', s.temperature,    'Â°C',  1);
  setCard('sensorVibration2',  'vibration',   s.vibration,      'g',   3);
  setCard('sensorSolarPower2', 'solar',       sol.power,        'W',   0);
  setCard('sensorEVLoad2',     'evLoad',      ev.power,         'W',   0);
  setCard('sensorHHLoad2',     'hhLoad',      hh.power,         'W',   0);
  setCard('sensorAmbTemp2',    'ambTemp',     env.ambientTemp,  'Â°C',  1);
  setCard('sensorHumidity2',   'humidity',    env.humidity,     '%',   1);
  setText('loadingPct2', load.percentage != null ? load.percentage.toFixed(1) + '%' : 'â€”');

  // â”€â”€ Source tags â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  document.querySelectorAll('[data-source-tag]').forEach((node) => {
    setSourceTag(node, state.mode);
  });

  // Also update any explicitly named source-tag elements on the monitoring page
  const monitorSourceEls = [
    el('monSrcVoltage'),
    el('monSrcCurrent'),
    el('monSrcPower'),
    el('monSrcTemp'),
    el('monSrcVibration'),
    el('monSrcSolar'),
    el('monSrcEV'),
    el('monSrcHH'),
  ];
  monitorSourceEls.forEach((node) => setSourceTag(node, state.mode));
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise the Monitoring view.
 * Subscribes to all state changes and renders on every update.
 */
export function initMonitoringView() {
  subscribe('*', (state) => applyState(state));
}
