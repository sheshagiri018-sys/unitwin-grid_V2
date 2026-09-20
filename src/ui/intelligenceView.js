/**
 * intelligenceView.js â€” UNITWIN GRID V2
 * Drives the Intelligence Engine page DOM updates.
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

function setStyle(id, prop, value) {
  const node = el(id);
  if (node) node.style[prop] = value;
}

/**
 * Basic HTML escaping.
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
// Cause-effect chain renderer
// ---------------------------------------------------------------------------

/**
 * Build a styled div chain in #causeEffectChainB.
 * @param {string[]} chain
 */
function renderCauseEffectChain(chain) {
  const container = el('causeEffectChainB');
  if (!container) return;

  if (!Array.isArray(chain) || chain.length === 0) {
    container.innerHTML = '<span class="chain-empty">No active causal relationships.</span>';
    return;
  }

  const html = chain.map((item, idx) => {
    const isLast = idx === chain.length - 1;
    return `<div class="chain-item chain-item--${idx === 0 ? 'cause' : isLast ? 'effect' : 'mid'}">${esc(item)}</div>`
      + (isLast ? '' : '<div class="chain-arrow">â–¼</div>');
  }).join('');

  container.innerHTML = html;
}

// ---------------------------------------------------------------------------
// Trend alert panel
// ---------------------------------------------------------------------------

/**
 * Show or hide the trend alert panel and set its text.
 * @param {string|null} alertText
 */
function renderTrendAlert(alertText) {
  const panel = el('trendAlertPanel');
  if (!panel) return;

  if (alertText && alertText.trim().length > 0) {
    panel.style.display = '';
    panel.textContent   = alertText;
  } else {
    panel.style.display = 'none';
  }
}

// ---------------------------------------------------------------------------
// Health factors (shared with dashboard)
// ---------------------------------------------------------------------------

/**
 * Update intelligence factor bars.
 * @param {{ loading?: number, temperature?: number, voltage?: number, vibration?: number }} factors
 */
function renderFactors(factors) {
  const map = {
    factor_loadingB:     factors.loading,
    factor_temperatureB: factors.temperature,
    factor_voltageB:     factors.voltage,
    factor_vibrationB:   factors.vibration,
  };
  for (const [id, val] of Object.entries(map)) {
    setStyle(id, 'width', Math.min(100, Math.max(0, val ?? 0)).toFixed(1) + '%');
  }
}

// ---------------------------------------------------------------------------
// Main state â†’ DOM application
// ---------------------------------------------------------------------------

function applyState(state) {
  const intel = state.intelligence || {};
  const hlth  = state.health       || {};

  // â”€â”€ Intelligence text fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setText('intelStateB',     intel.state          ?? 'â€”');
  setText('intelEVImpactB',  intel.evImpact       ?? 'â€”');
  setText('intelThermalB',   intel.thermal        ?? 'â€”');
  setText('intelVibrationB', intel.vibration      ?? 'â€”');
  setText('intelRecB',       intel.recommendation ?? 'â€”');

  // â”€â”€ Cause-effect chain â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  renderCauseEffectChain(intel.causeEffect);

  // â”€â”€ Trend alert panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  renderTrendAlert(intel.trendAlert ?? null);

  // â”€â”€ Forecast section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const forecast = intel.forecast || {};
  setText('forecastCurrent',   forecast.current   != null ? forecast.current.toFixed(1)   + ' A' : 'â€”');
  setText('forecastPredicted', forecast.predicted != null ? forecast.predicted.toFixed(1) + ' A' : 'â€”');
  setText('forecastTrend',     forecast.trend     ?? 'â€”');

  // â”€â”€ Health factors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  renderFactors(intel.factors || {});

  // Health score (optional â€” may be present on this page too)
  const score = hlth.score ?? 100;
  setText('healthScoreB',  score.toFixed(0));
  setText('healthLabelB',  hlth.label ?? 'Good');
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise the Intelligence Engine view.
 */
export function initIntelligenceView() {
  subscribe('*', (state) => applyState(state));
}
