/**
 * intelligenceView.js — UNITWIN GRID V2
 * Drives the Intelligence Engine page DOM updates.
 */

import { subscribe } from '../core/state.js';

function el(id) { return document.getElementById(id); }

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text ?? '—';
}

function renderCauseEffectChain(chain) {
  const container = el('causeEffectChainB');
  if (!container) return;

  if (!Array.isArray(chain) || chain.length === 0) {
    container.innerHTML = '<span style="color:var(--text-dim);font-size:0.75rem;">No active causal anomalies detected. Grid in equilibrium.</span>';
    return;
  }

  container.innerHTML = chain.map((item) => {
    const cause = item.cause ?? item;
    const effect = item.effect ? `<div style="font-size:0.68rem;color:var(--text-dim);margin-top:2px;">↳ ${item.effect}</div>` : '';
    return `
      <div style="background:var(--bg-panel);border:1px solid var(--border);border-left:3px solid var(--accent-amber);border-radius:var(--radius);padding:0.4rem 0.6rem;font-size:0.75rem;">
        <div style="font-weight:600;color:var(--accent-amber);">${cause}</div>
        ${effect}
      </div>
    `;
  }).join('');
}

function renderTrendAlert(trendAlert) {
  const panel = el('trendAlertPanel');
  const textEl = el('trendAlertText');
  if (!panel || !textEl) return;

  if (trendAlert) {
    textEl.textContent = trendAlert;
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

function applyState(state) {
  const intel = state.intelligence || {};
  const pred = state.predicted || {};
  const tx = state.transformer || {};

  // Intelligence text fields
  setText('intelStateB', intel.state ?? 'NORMAL LOAD');
  setText('intelEVImpactB', intel.evImpact ?? '0%');
  setText('intelThermalB', intel.thermal ?? 'NORMAL');
  setText('intelVibrationB', intel.vibration ?? 'NORMAL');
  setText('intelRecB', intel.recommendation ?? 'System operating normally.');

  // Cause-effect chain
  renderCauseEffectChain(intel.causeEffect);

  // Trend alert panel
  renderTrendAlert(intel.trendAlert ?? null);

  // Forecast section (reads from state.transformer & state.predicted)
  if (tx.loading != null) setText('forecastCurrent', tx.loading.toFixed(1) + '%');
  if (pred.loading != null) setText('forecastPredicted', pred.loading.toFixed(1) + '%');
  else setText('forecastPredicted', '—');

  setText('forecastTrend', pred.risk ? pred.risk : 'STABLE');
  if (pred.temperature != null) {
    setText('forecastTempTrend', pred.temperature.toFixed(1) + ' °C');
  } else {
    setText('forecastTempTrend', 'STABLE');
  }
}

export function initIntelligenceView() {
  subscribe('*', (state) => applyState(state));
}
