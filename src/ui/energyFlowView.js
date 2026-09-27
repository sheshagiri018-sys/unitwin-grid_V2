/**
 * energyFlowView.js — UNITWIN GRID V2
 * Drives the Energy Flow page: flow values and cause-effect chain rendering.
 */

import { subscribe } from '../core/state.js';

function el(id) { return document.getElementById(id); }

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text ?? '—';
}

function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCauseEffectChain(chain) {
  const container = el('causeEffectChain');
  if (!container) return;

  if (!Array.isArray(chain) || chain.length === 0) {
    container.innerHTML = '<span style="color:var(--text-dim);font-size:0.75rem;">No active causal imbalances detected.</span>';
    return;
  }

  const fragments = chain.map((item, idx) => {
    const isLast  = idx === chain.length - 1;
    const causeText = item.cause ?? item;
    const effectText = item.effect ? ` → ${item.effect}` : '';
    const itemDiv = `
      <div style="background:var(--bg-panel);border:1px solid var(--border);border-left:3px solid var(--accent-cyan);border-radius:var(--radius);padding:0.35rem 0.5rem;font-size:0.75rem;">
        <span style="color:var(--text-primary);font-weight:600;">${escapeHTML(causeText)}</span>
        <span style="color:var(--text-dim);">${escapeHTML(effectText)}</span>
      </div>`;
    const arrow = isLast ? '' : '<div style="text-align:center;color:var(--text-dim);font-size:0.7rem;line-height:1;">▼</div>';
    return itemDiv + arrow;
  });

  container.innerHTML = fragments.join('');
}

function setFlowStatus(id, status) {
  const node = el(id);
  if (!node) return;
  node.textContent = status ?? '—';
  const s = (status ?? '').toUpperCase();
  node.className = 'status-pill ' + (
    s === 'ACTIVE' || s === 'CHARGING' || s === 'NORMAL' ? 'pill-active' :
    s === 'IDLE' || s === 'OFF' ? 'pill-idle' : 'pill-warn'
  );
}

function applyState(state) {
  const tx    = state.transformer || {};
  const sol   = state.solar       || {};
  const ev    = state.ev          || {};
  const hh    = state.household   || {};
  const intel = state.intelligence|| {};

  // Flow values on main path diagram
  const solKW = (sol.power || 0) / 1000;
  setText('flowSolarW', sol.power != null ? `${sol.power.toFixed(0)} W` : '—');
  setText('flowTxLoad', tx.loading != null ? `Loading: ${tx.loading.toFixed(1)}%` : '—');
  setText('flowHHW', hh.power != null ? `${(hh.power * 1000).toFixed(0)} W` : '—');
  setText('flowEVW', ev.power != null ? `${(ev.power * 1000).toFixed(0)} W` : '—');

  // 4 Cards: Solar -> Grid, Grid -> Transformer, Transformer -> House, Transformer -> EV
  // Solar -> Grid
  setText('flowPower1', sol.power != null ? `${sol.power.toFixed(1)} W` : '—');
  setFlowStatus('flowStatus1', sol.status || 'OFFLINE');

  // Grid -> Transformer
  const txPowerW = tx.power != null ? (tx.power >= 10 ? (tx.power * 1000).toFixed(0) : (tx.power).toFixed(1)) : '—';
  setText('flowPower2', txPowerW !== '—' ? `${txPowerW} W` : '—');
  setFlowStatus('flowStatus2', tx.state || 'NORMAL');

  // Transformer -> House
  setText('flowPower3', hh.power != null ? `${(hh.power * 1000).toFixed(0)} W` : '—');
  setFlowStatus('flowStatus3', hh.status || 'ON');

  // Transformer -> EV
  setText('flowPower4', ev.power != null ? `${(ev.power * 1000).toFixed(0)} W` : '—');
  setFlowStatus('flowStatus4', ev.status || 'IDLE');

  // Cause-effect chain
  renderCauseEffectChain(intel.causeEffect);
}

export function initEnergyFlowView() {
  subscribe('*', (state) => applyState(state));
}
