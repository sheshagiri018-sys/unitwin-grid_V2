/**
 * alertsView.js â€” UNITWIN GRID V2
 * Renders the Alerts page: alert list with severity badges, actions, sidebar badge.
 */

import { subscribe, acknowledgeAlert, resolveAlert, clearAlerts } from '../core/state.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(id) { return document.getElementById(id); }

/**
 * Map severity to a CSS class suffix.
 * @param {'INFO'|'WARNING'|'CRITICAL'|string} severity
 * @returns {string}
 */
function severityClass(severity) {
  switch ((severity ?? '').toUpperCase()) {
    case 'INFO':     return 'info';
    case 'WARNING':  return 'warning';
    case 'CRITICAL': return 'critical';
    default:         return 'info';
  }
}

/**
 * Format a timestamp (ISO string or ms epoch) as HH:MM:SS.
 * @param {string|number} ts
 * @returns {string}
 */
function formatTime(ts) {
  if (!ts) return 'â€”';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return 'â€”';
  return [
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join(':');
}

/**
 * Basic HTML escaping.
 * @param {string} str
 * @returns {string}
 */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Alert card renderer
// ---------------------------------------------------------------------------

/**
 * Render a single alert object as an HTML card string.
 * @param {object} alert
 * @returns {string}
 */
function renderAlertCard(alert) {
  const sevCls   = severityClass(alert.severity);
  const statCls  = (alert.status ?? 'active').toLowerCase();
  const isActive = alert.status !== 'resolved';

  const ackBtn = alert.status !== 'acknowledged' && alert.status !== 'resolved'
    ? `<button class="btn btn--sm btn--outline" data-alert-action="ack" data-alert-id="${esc(alert.id)}">Acknowledge</button>`
    : '';
  const resolveBtn = alert.status !== 'resolved'
    ? `<button class="btn btn--sm btn--danger-outline" data-alert-action="resolve" data-alert-id="${esc(alert.id)}">Resolve</button>`
    : '';

  return `
  <div class="alert-card alert-card--${sevCls} ${isActive ? '' : 'alert-card--inactive'}" data-alert-id="${esc(alert.id)}">
    <div class="alert-card__header">
      <span class="badge badge--${sevCls}">${esc(alert.severity ?? 'INFO')}</span>
      <span class="alert-card__time">${formatTime(alert.timestamp)}</span>
      <span class="badge badge--${statCls} alert-card__status">${esc(alert.status ?? 'active')}</span>
    </div>
    <div class="alert-card__message">${esc(alert.message ?? '')}</div>
    <div class="alert-card__meta">
      <span class="alert-card__source">Source: ${esc(alert.source ?? 'System')}</span>
    </div>
    <div class="alert-card__actions">
      ${ackBtn}
      ${resolveBtn}
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Render list
// ---------------------------------------------------------------------------

/** @type {object[]} */
let _currentAlerts = [];

function renderAlertList(alerts) {
  const list = el('alertsList');
  if (!list) return;

  if (!alerts || alerts.length === 0) {
    list.innerHTML = '<div class="alerts-empty">No alerts. System is nominal.</div>';
    return;
  }

  // Sort: CRITICAL first, then WARNING, then INFO; active before resolved
  const sorted = [...alerts].sort((a, b) => {
    const order = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    const statusOrder = { active: 0, acknowledged: 1, resolved: 2 };
    const so = (statusOrder[a.status ?? 'active'] ?? 0) - (statusOrder[b.status ?? 'active'] ?? 0);
    if (so !== 0) return so;
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  list.innerHTML = sorted.map(renderAlertCard).join('');
}

// ---------------------------------------------------------------------------
// Sidebar badge
// ---------------------------------------------------------------------------

function updateAlertBadge(alerts) {
  const badge = el('alertBadge');
  if (!badge) return;
  const active = (alerts ?? []).filter((a) => a.status !== 'resolved').length;
  badge.textContent   = active > 0 ? String(active) : '';
  badge.style.display = active > 0 ? '' : 'none';
}

// ---------------------------------------------------------------------------
// Delegated action buttons
// ---------------------------------------------------------------------------

function initActionDelegation() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-alert-action]');
    if (!btn) return;

    const action  = btn.dataset.alertAction;
    const alertId = btn.dataset.alertId;
    if (!alertId) return;

    if (action === 'ack')     acknowledgeAlert(alertId);
    if (action === 'resolve') resolveAlert(alertId);
  });
}

// ---------------------------------------------------------------------------
// Clear all button
// ---------------------------------------------------------------------------

function initClearBtn() {
  const btn = el('clearAlertsBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    clearAlerts();
  });
}

// ---------------------------------------------------------------------------
// State subscription
// ---------------------------------------------------------------------------

function applyState(state) {
  const alerts = state.alerts ?? [];
  _currentAlerts = alerts;
  renderAlertList(alerts);
  updateAlertBadge(alerts);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise the Alerts view.
 */
export function initAlertsView() {
  initActionDelegation();
  initClearBtn();
  subscribe('*', (state) => applyState(state));
}
