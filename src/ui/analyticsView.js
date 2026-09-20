/**
 * analyticsView.js â€” UNITWIN GRID V2
 * Drives the Analytics page: time filter, correlation panel, statistics, CSV export.
 */

import { subscribe, getState } from '../core/state.js';
import { analyzeCorrelations } from '../analytics/correlationEngine.js';
import { exportCSV } from '../analytics/csvExporter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(id) { return document.getElementById(id); }
function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text ?? 'â€”';
}

/**
 * Escape a string for safe HTML injection.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Time filter state
// ---------------------------------------------------------------------------

/** The currently selected number of history points to display. */
let _filterPoints = 60; // default: LIVE (last 60 pts)

/** Map from data-time-filter attribute value â†’ number of history points */
const FILTER_MAP = {
  LIVE: 60,
  '1M':  120,
  '5M':  300,
  '15M': 900,
  '1H':  3600,
  ALL:   Infinity,
};

// ---------------------------------------------------------------------------
// Time filter buttons
// ---------------------------------------------------------------------------

function initTimeFilters() {
  document.querySelectorAll('[data-time-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.timeFilter;
      _filterPoints = FILTER_MAP[key] ?? 60;

      // Update active class
      document.querySelectorAll('[data-time-filter]').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );

      // Re-render with filtered data
      applyState(getState());
    });
  });
}

// ---------------------------------------------------------------------------
// Correlation panel
// ---------------------------------------------------------------------------

/**
 * Render the correlation results table into #correlationPanel.
 * @param {object} state
 */
function renderCorrelationPanel(state) {
  const panel = el('correlationPanel');
  if (!panel) return;

  const results = analyzeCorrelations(state);

  if (results.length === 0) {
    panel.innerHTML = '<p class="corr-empty">Insufficient data for correlation analysis.</p>';
    return;
  }

  const rows = results.map(({ pair, r, label }) => {
    const rAbs    = Math.abs(r);
    const barPct  = (rAbs * 100).toFixed(1);
    const barColor = r >= 0.4 ? '#00ddaa' : r <= -0.4 ? '#ff6644' : '#7a9ab5';

    return `
      <div class="corr-row">
        <div class="corr-pair">${esc(pair)}</div>
        <div class="corr-bar-wrap">
          <div class="corr-bar" style="width:${barPct}%;background:${barColor};"></div>
        </div>
        <div class="corr-r">${r >= 0 ? '+' : ''}${r.toFixed(4)}</div>
        <div class="corr-label">${esc(label)}</div>
      </div>`;
  });

  panel.innerHTML = `<div class="corr-table">${rows.join('')}</div>`;
}

// ---------------------------------------------------------------------------
// Statistical summary
// ---------------------------------------------------------------------------

/**
 * Compute and display min / max / avg / peak from filtered dataHistory.
 * @param {object[]} history  Filtered history array
 * @param {string}   key      Dot-notation key path into each entry
 * @returns {{ min: number, max: number, avg: number, peak: number }}
 */
function computeStats(history, key) {
  const keys = key.split('.');
  const vals = history.reduce((acc, entry) => {
    let v = entry;
    for (const k of keys) { if (v == null) { v = null; break; } v = v[k]; }
    if (typeof v === 'number') acc.push(v);
    return acc;
  }, []);

  if (vals.length === 0) return { min: 0, max: 0, avg: 0, peak: 0 };
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const avg  = vals.reduce((a, v) => a + v, 0) / vals.length;
  const peak = Math.max(...vals.map(Math.abs));
  return { min, max, avg, peak };
}

/**
 * Update the four stat DOM elements using the current history & filter.
 * @param {object[]} history
 */
function updateStats(history) {
  // Default: show power stats in the summary
  const stats = computeStats(history, 'sensors.power');
  setText('statsMin',  stats.min.toFixed(1) + ' W');
  setText('statsMax',  stats.max.toFixed(1) + ' W');
  setText('statsAvg',  stats.avg.toFixed(1) + ' W');
  setText('statsPeak', stats.peak.toFixed(1) + ' W');
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function initExportBtn() {
  const btn = el('exportCSVBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    exportCSV(getState());
  });
}

// ---------------------------------------------------------------------------
// Main state â†’ DOM application
// ---------------------------------------------------------------------------

function applyState(state) {
  const history = Array.isArray(state.dataHistory) ? state.dataHistory : [];
  const limit   = isFinite(_filterPoints) ? _filterPoints : history.length;
  const filtered = history.slice(-limit);

  // Statistics summary
  updateStats(filtered);

  // Correlation analysis
  renderCorrelationPanel(state);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise the Analytics view.
 */
export function initAnalyticsView() {
  initTimeFilters();
  initExportBtn();
  subscribe('*', (state) => applyState(state));
}
