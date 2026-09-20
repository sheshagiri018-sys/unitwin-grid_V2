/**
 * charts.js â€” UNITWIN GRID V2
 * Chart.js line chart management for all dashboard and analytics pages.
 * Uses global window.Chart from CDN (no import needed).
 */

import { subscribe, getState } from '../core/state.js';

// ---------------------------------------------------------------------------
// Theme constants
// ---------------------------------------------------------------------------
const THEME = {
  background: '#0d1a2e',
  grid:       '#1a2a45',
  text:       '#7a9ab5',
  tick:       '#7a9ab5',
};

const MAX_POINTS = 120;

// ---------------------------------------------------------------------------
// Chart registry
// ---------------------------------------------------------------------------
/** @type {Map<string, import('chart.js').Chart>} */
const registry = new Map();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Build a standard dark-industrial Chart.js config for a single-series line chart.
 * @param {string}  label       Dataset label
 * @param {string}  color       Hex color string
 * @param {boolean} showXAxis   Whether to show the x-axis (false for mini charts)
 * @returns {object}            Chart.js config object
 */
function buildConfig(label, color, showXAxis = false) {
  return {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label,
          data: [],
          borderColor:     color,
          backgroundColor: 'transparent',
          borderWidth:     2,
          pointRadius:     0,
          pointHoverRadius: 3,
          tension: 0.35,
          fill: false,
        },
      ],
    },
    options: {
      responsive:  true,
      animation:   false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0d1a2e',
          borderColor:     '#1a2a45',
          borderWidth:     1,
          titleColor:      '#7a9ab5',
          bodyColor:       color,
        },
      },
      scales: {
        x: {
          display: showXAxis,
          ticks:  { color: THEME.tick, maxRotation: 0, maxTicksLimit: 6 },
          grid:   { color: THEME.grid },
          border: { color: THEME.grid },
        },
        y: {
          display: true,
          ticks:  { color: THEME.tick, maxTicksLimit: 5 },
          grid:   { color: THEME.grid },
          border: { color: THEME.grid },
        },
      },
    },
  };
}

/**
 * Create a Chart instance for the given canvas ID and register it.
 * Silently skips if the canvas element does not exist in the DOM.
 * @param {string}  canvasId
 * @param {string}  label
 * @param {string}  color
 * @param {boolean} showXAxis
 */
function createChart(canvasId, label, color, showXAxis = false) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Destroy any existing instance to avoid canvas-reuse errors
  if (registry.has(canvasId)) {
    registry.get(canvasId).destroy();
    registry.delete(canvasId);
  }

  // Background fill plugin (canvas background colour)
  const bgPlugin = {
    id: `bg_${canvasId}`,
    beforeDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      ctx.save();
      ctx.fillStyle = THEME.background;
      ctx.fillRect(0, 0, chart.width, chart.height);
      ctx.restore();
    },
  };

  const config = buildConfig(label, color, showXAxis);
  // Attach background plugin per-chart so it doesn't pollute the global registry
  const instance = new window.Chart(canvas, { ...config, plugins: [bgPlugin] });
  registry.set(canvasId, instance);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return current time as HH:MM:SS string (used as x-axis label). */
function nowLabel() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

/**
 * Push one data point into a registered chart, trimming to MAX_POINTS.
 * @param {string}         canvasId
 * @param {number|null}    value
 */
function pushPoint(canvasId, value) {
  const chart = registry.get(canvasId);
  if (!chart) return;

  chart.data.labels.push(nowLabel());
  chart.data.datasets[0].data.push(value != null ? Number(value) : null);

  if (chart.data.labels.length > MAX_POINTS) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise all Chart.js instances.
 * Safe to call multiple times â€” destroys previous instances first.
 */
export function initCharts() {
  if (!window.Chart) {
    console.warn('[charts] window.Chart not found â€” Chart.js CDN not loaded yet.');
    return;
  }

  // â”€â”€ Dashboard / monitoring mini charts (x-axis hidden) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  createChart('chartVoltage',   'Voltage (V)',      '#44aaff', false);
  createChart('chartCurrent',   'Current (A)',      '#00ddaa', false);
  createChart('chartPower',     'Power (W)',        '#ffcc44', false);
  createChart('chartTemp',      'Temperature (Â°C)', '#ff6644', false);
  createChart('chartLoading',   'Loading (%)',      '#00ccff', false);
  createChart('chartSolar',     'Solar (W)',        '#ffdd00', false);
  createChart('chartEV',        'EV Load (W)',      '#aa44ff', false);
  createChart('chartVibration', 'Vibration (g)',    '#ff8844', false);

  // â”€â”€ Analytics page charts (x-axis shown) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  createChart('chartAnalyticsVoltage',   'Voltage (V)',      '#44aaff', true);
  createChart('chartAnalyticsCurrent',   'Current (A)',      '#00ddaa', true);
  createChart('chartAnalyticsPower',     'Power (W)',        '#ffcc44', true);
  createChart('chartAnalyticsTemp',      'Temperature (Â°C)', '#ff6644', true);
  createChart('chartAnalyticsEV',        'EV Load (W)',      '#aa44ff', true);
  createChart('chartAnalyticsSolar',     'Solar (W)',        '#ffdd00', true);
  createChart('chartAnalyticsVibration', 'Vibration (g)',    '#ff8844', true);

  // Subscribe to state changes for live updates
  subscribe('*', (state) => updateCharts(state));
}

/**
 * Push the latest sensor/load values from state into all charts.
 * Called from the state subscription or directly.
 * @param {object} state  Full application state snapshot
 */
export function updateCharts(state) {
  if (!window.Chart) return;

  const s   = state.sensors || {};
  const lo  = state.loads   || {};
  const sol = state.solar   || {};

  // Mini dashboard charts
  pushPoint('chartVoltage',   s.voltage);
  pushPoint('chartCurrent',   s.current);
  pushPoint('chartPower',     s.power);
  pushPoint('chartTemp',      s.temperature);
  pushPoint('chartLoading',   state.loading?.percentage);
  pushPoint('chartSolar',     sol.power);
  pushPoint('chartEV',        lo.ev?.power);
  pushPoint('chartVibration', s.vibration);

  // Analytics charts â€” independent series, same values
  pushPoint('chartAnalyticsVoltage',   s.voltage);
  pushPoint('chartAnalyticsCurrent',   s.current);
  pushPoint('chartAnalyticsPower',     s.power);
  pushPoint('chartAnalyticsTemp',      s.temperature);
  pushPoint('chartAnalyticsEV',        lo.ev?.power);
  pushPoint('chartAnalyticsSolar',     sol.power);
  pushPoint('chartAnalyticsVibration', s.vibration);

  // Batch update â€” 'none' suppresses animation for live feed performance
  for (const [, chart] of registry) {
    chart.update('none');
  }
}

/**
 * Destroy all registered Chart instances (e.g., on full page teardown).
 */
export function destroyCharts() {
  for (const [id, chart] of registry) {
    chart.destroy();
    registry.delete(id);
  }
}
