/**
 * charts.js — UNITWIN GRID V2
 * Creates and manages all Chart.js sparkline and analytics charts.
 * Subscribes to transformer/solar/ev state changes only (NOT '*' would cause loop).
 *
 * Canvas IDs from index.html (verified):
 * Dashboard sparklines: chartVoltage, chartCurrent, chartPower, chartTemp, chartLoading
 * Analytics: chartAnalyticsVoltage, chartAnalyticsCurrent, chartAnalyticsPower,
 *            chartAnalyticsTemp, chartAnalyticsEV, chartAnalyticsSolar, chartAnalyticsVibration
 */

import { subscribe } from '../core/state.js';

const MAX_POINTS = 60;
const _charts = new Map();

/** Create a Chart.js line chart on a canvas element. Returns null if canvas not found. */
function _makeChart(canvasId, label, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return null;

  // Destroy previous instance if any
  if (_charts.has(canvasId)) {
    try { _charts.get(canvasId).destroy(); } catch(_) {}
  }

  const chart = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label,
        data: [],
        borderColor: color,
        backgroundColor: 'transparent',
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.4,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: false }
      }
    }
  });

  _charts.set(canvasId, chart);
  return chart;
}

function _nowLabel() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':');
}

function _push(canvasId, value) {
  const chart = _charts.get(canvasId);
  if (!chart || value == null) return;
  const label = _nowLabel();
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(typeof value === 'number' ? parseFloat(value.toFixed(4)) : null);
  if (chart.data.labels.length > MAX_POINTS) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update('none');
}

/** Called on every state update — pushes new data point to all charts. */
function _onStateUpdate(state) {
  const tx    = state.transformer || {};
  const solar = state.solar       || {};
  const ev    = state.ev          || {};

  // Dashboard sparklines (canvas IDs matching index.html exactly)
  _push('chartVoltage', tx.voltage);
  _push('chartCurrent', tx.current);
  _push('chartPower',   tx.power);
  _push('chartTemp',    tx.temperature);
  _push('chartLoading', tx.loading);

  // Analytics page charts
  _push('chartAnalyticsVoltage',   tx.voltage);
  _push('chartAnalyticsCurrent',   tx.current);
  _push('chartAnalyticsPower',     tx.power);
  _push('chartAnalyticsTemp',      tx.temperature);
  _push('chartAnalyticsVibration', tx.vibration);
  _push('chartAnalyticsEV',        ev.power);
  _push('chartAnalyticsSolar',     solar.power);
}

export function initCharts() {
  if (!window.Chart) {
    console.warn('[charts] window.Chart not available — is Chart.js CDN loaded?');
    return;
  }

  // ── Dashboard sparklines ─────────────────────────────────────
  _makeChart('chartVoltage', 'Voltage (V)',      '#4488ff');
  _makeChart('chartCurrent', 'Current (A)',      '#44ffaa');
  _makeChart('chartPower',   'Power (kW)',       '#ffaa44');
  _makeChart('chartTemp',    'Temperature (°C)', '#ff4444');
  _makeChart('chartLoading', 'Loading (%)',      '#ffdd00');

  // ── Analytics page charts ────────────────────────────────────
  _makeChart('chartAnalyticsVoltage',   'Voltage (V)',      '#4488ff');
  _makeChart('chartAnalyticsCurrent',   'Current (A)',      '#44ffaa');
  _makeChart('chartAnalyticsPower',     'Power (kW)',       '#ffaa44');
  _makeChart('chartAnalyticsTemp',      'Temperature (°C)', '#ff6644');
  _makeChart('chartAnalyticsVibration', 'Vibration (mm/s)', '#aa44ff');
  _makeChart('chartAnalyticsEV',        'EV Load (kW)',     '#aa55ff');
  _makeChart('chartAnalyticsSolar',     'Solar (W)',        '#ffdd00');

  // Subscribe to transformer state only — charts only read state, never write it
  // (subscribing to '*' is safe here since we don't call any state setters)
  subscribe('transformer', _onStateUpdate);
  subscribe('solar',       _onStateUpdate);
  subscribe('ev',          _onStateUpdate);

  console.info('[charts] Charts initialized. Waiting for first data point...');
}

export function updateCharts(state) {
  _onStateUpdate(state);
}

export function destroyCharts() {
  for (const [, chart] of _charts) {
    try { chart.destroy(); } catch(_) {}
  }
  _charts.clear();
}
