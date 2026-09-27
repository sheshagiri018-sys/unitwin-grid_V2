/**
 * monitoringView.js — UNITWIN GRID V2
 * Drives all DOM updates on the Live Monitoring page.
 * Tracks per-sensor min / max / running average and updates stat elements.
 */

import { subscribe } from '../core/state.js';

function el(id) { return document.getElementById(id); }

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text ?? '—';
}

/**
 * Apply LIVE / SIMULATION source-tag styling to an element.
 */
function setSourceTag(node, mode) {
  if (!node) return;
  const isLive = mode === 'LIVE';
  node.classList.toggle('src-live', isLive);
  node.classList.toggle('src-simulation', !isLive);
  node.textContent = isLive ? 'LIVE' : 'SIMULATION';
}

const statsMap = new Map();

function trackStats(key, value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return statsMap.get(key) ?? { min: 0, max: 0, sum: 0, count: 0 };
  }

  let s = statsMap.get(key);
  if (!s) {
    s = { min: value, max: value, sum: value, count: 1 };
  } else {
    s.min = Math.min(s.min, value);
    s.max = Math.max(s.max, value);
    s.sum += value;
    s.count += 1;
  }
  statsMap.set(key, s);
  return s;
}

function updateStatElements(prefix, stats, decimals = 2) {
  setText(`${prefix}Min`, stats.min.toFixed(decimals));
  setText(`${prefix}Max`, stats.max.toFixed(decimals));
  setText(`${prefix}Avg`, (stats.sum / stats.count).toFixed(decimals));
}

function applyState(state) {
  const tx = state.transformer || {};
  const sol = state.solar || {};
  const ev = state.ev || {};
  const hh = state.household || {};
  const amb = state.ambient || {};

  // Transformer Surface Temp & Stats
  if (tx.temperature != null) {
    setText('sensorTxTemp2', tx.temperature.toFixed(1));
    const stats = trackStats('statTemp', tx.temperature);
    updateStatElements('statTemp', stats, 1);
  }

  // Vibration & Stats
  if (tx.vibration != null) {
    setText('sensorVibration2', tx.vibration.toFixed(3));
    const stats = trackStats('statVib', tx.vibration);
    setText('statVibMin', stats.min.toFixed(3));
    setText('statVibMax', stats.max.toFixed(3));
  }

  // Solar PV
  if (sol.voltage != null) setText('sensorSolarVoltage2', sol.voltage.toFixed(2));
  if (sol.current != null) setText('sensorSolarCurrent2', sol.current.toFixed(3));
  if (sol.power != null) setText('sensorSolarPower2', sol.power.toFixed(2));

  // Ambient DHT22
  if (amb.temperature != null) setText('sensorAmbTemp2', amb.temperature.toFixed(1));
  if (amb.humidity != null) setText('sensorHumidity2', Math.round(amb.humidity));

  // Transformer Electrical
  if (tx.voltage != null) setText('sensorTxVoltage2', tx.voltage.toFixed(2));
  if (tx.current != null) setText('sensorTxCurrent2', tx.current.toFixed(3));
  if (tx.power != null) {
    // tx.power is in kW in state, convert or display appropriately
    const powerW = tx.power >= 10 ? (tx.power * 1000).toFixed(0) : (tx.power).toFixed(2);
    setText('sensorTxPower2', powerW);
  }

  // EV & Household Loads
  if (ev.power != null) {
    const evDisplay = ev.power >= 1 ? (ev.power).toFixed(2) : (ev.power * 1000).toFixed(1);
    setText('sensorEVLoad2', evDisplay);
  }
  if (hh.power != null) {
    setText('sensorHHLoad2', hh.power.toFixed(2));
  }

  // Loading
  if (tx.loading != null) {
    setText('loadingPct2', tx.loading.toFixed(1) + '%');
  }

  // Source tags
  const mode = state.mode || 'SIMULATION';
  document.querySelectorAll('[data-source-tag]').forEach((node) => {
    setSourceTag(node, mode);
  });

  const monitorSourceEls = [
    el('srcTemp'),
    el('srcVib'),
    el('srcSolarV'),
    el('srcSolarI'),
    el('srcAmbT'),
    el('srcAmbH')
  ];
  monitorSourceEls.forEach((node) => setSourceTag(node, mode));

  const badge = el('monitoringModeBadge');
  if (badge) {
    const isLive = mode === 'LIVE';
    badge.textContent = isLive ? '◉ LIVE' : '◉ SIMULATION';
    badge.className = 'status-pill ' + (isLive ? 'pill-active' : 'pill-idle');
  }
}

export function initMonitoringView() {
  subscribe('*', (state) => applyState(state));
}
