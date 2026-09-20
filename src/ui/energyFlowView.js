/**
 * energyFlowView.js â€” UNITWIN GRID V2
 * Drives the Energy Flow page: flow values and cause-effect chain rendering.
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

// ---------------------------------------------------------------------------
// Cause-effect chain renderer
// ---------------------------------------------------------------------------

/**
 * Render the intelligence cause-effect chain into #causeEffectChain.
 * @param {string[]} chain  Array of cause/effect description strings
 */
function renderCauseEffectChain(chain) {
  const container = el('causeEffectChain');
  if (!container) return;

  if (!Array.isArray(chain) || chain.length === 0) {
    container.innerHTML = '<span class="chain-empty">No active cause-effect relationships detected.</span>';
    return;
  }

  const fragments = chain.map((item, idx) => {
    const isLast  = idx === chain.length - 1;
    const itemDiv = `<div class="chain-item">${escapeHTML(item)}</div>`;
    const arrow   = isLast ? '' : '<div class="chain-arrow">â–¼</div>';
    return itemDiv + arrow;
  });

  container.innerHTML = fragments.join('');
}

/**
 * Basic HTML escaping to prevent XSS from state strings.
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Flow status badge helper
// ---------------------------------------------------------------------------

/**
 * Update a flow status badge element.
 * @param {string} id
 * @param {string} status  e.g. 'Active', 'Idle', 'Fault'
 */
function setFlowStatus(id, status) {
  const node = el(id);
  if (!node) return;
  node.textContent = status ?? 'â€”';
  const cls = (status ?? '').toLowerCase();
  node.className = `flow-status flow-status--${cls.replace(/\s+/g, '-')}`;
}

// ---------------------------------------------------------------------------
// Main state â†’ DOM application
// ---------------------------------------------------------------------------

function applyState(state) {
  const sol   = state.solar        || {};
  const lo    = state.loads        || {};
  const ev    = lo.ev              || {};
  const hh    = lo.household       || {};
  const intel = state.intelligence || {};
  const flow  = state.energyFlow   || {};

  // â”€â”€ Flow values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setText('flowSolarW', sol.power  != null ? sol.power.toFixed(0)  + ' W' : 'â€”');
  setText('flowTxLoad', state.loading?.percentage != null
    ? state.loading.percentage.toFixed(1) + '%' : 'â€”');
  setText('flowHHW',    hh.power   != null ? hh.power.toFixed(0)   + ' W' : 'â€”');
  setText('flowEVW',    ev.power   != null ? ev.power.toFixed(0)   + ' W' : 'â€”');

  // flowPower1â€“4 and flowStatus1â€“4
  // These represent up to 4 flow segments in the SVG diagram.
  // Values are drawn from state.energyFlow if present, otherwise sensors.
  const flowPowers = flow.powers || [
    sol.power,
    (state.sensors || {}).power,
    hh.power,
    ev.power,
  ];
  const flowStatuses = flow.statuses || [
    sol.status   || 'Idle',
    state.transformerState || 'Normal',
    hh.status    || 'Idle',
    ev.status    || 'Idle',
  ];

  for (let i = 1; i <= 4; i++) {
    const pVal = flowPowers[i - 1];
    setText(`flowPower${i}`, pVal != null ? Number(pVal).toFixed(0) + ' W' : 'â€”');
    setFlowStatus(`flowStatus${i}`, flowStatuses[i - 1]);
  }

  // â”€â”€ Cause-effect chain â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  renderCauseEffectChain(intel.causeEffect);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise the Energy Flow view.
 */
export function initEnergyFlowView() {
  subscribe('*', (state) => applyState(state));
}
