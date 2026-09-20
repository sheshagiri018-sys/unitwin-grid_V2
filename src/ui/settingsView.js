/**
 * settingsView.js â€” UNITWIN GRID V2
 * Drives the Settings page: mode toggle, Firebase init, reset, threshold config.
 */

import { setMode, getState, resetState, addAlert } from '../core/state.js';
import { initFirebase, subscribeToLiveData } from '../data/firebase.js';

// ---------------------------------------------------------------------------
// App version â€” update as needed
// ---------------------------------------------------------------------------
const APP_VERSION = '2.0.0';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(id) { return document.getElementById(id); }

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text ?? 'â€”';
}

// ---------------------------------------------------------------------------
// Mode toggle (LIVE â†” SIMULATION)
// ---------------------------------------------------------------------------

/** Active live-data unsubscribe function (if any). */
let _unsubLive = null;

function initModeToggle() {
  const toggle = el('modeToggle');
  if (!toggle) return;

  // Reflect current state on load
  const state = getState();
  toggle.checked = state.mode === 'LIVE';

  toggle.addEventListener('change', async () => {
    if (toggle.checked) {
      // Switch to LIVE mode
      try {
        await initFirebase();
        _unsubLive = subscribeToLiveData();
        setMode('LIVE');
        setText('settingsFirebaseStatus', 'Connected');
        addAlert('INFO', 'Switched to LIVE mode â€” Firebase connected.');
      } catch (err) {
        console.error('[settings] Firebase init failed:', err);
        toggle.checked = false;
        setText('settingsFirebaseStatus', 'Connection Failed');
        addAlert('WARNING', `LIVE mode failed: ${err.message}`);
      }
    } else {
      // Switch to SIMULATION mode
      if (typeof _unsubLive === 'function') {
        _unsubLive();
        _unsubLive = null;
      }
      setMode('SIMULATION');
      setText('settingsFirebaseStatus', 'Disconnected');
      addAlert('INFO', 'Switched to SIMULATION mode.');
    }

    // Reflect new mode text
    setText('settingsMode', getState().mode);
  });
}

// ---------------------------------------------------------------------------
// Reset button
// ---------------------------------------------------------------------------

function initResetBtn() {
  const btn = el('resetBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    resetState();
    addAlert('INFO', 'System reset performed.');
  });
}

// ---------------------------------------------------------------------------
// Threshold form
// ---------------------------------------------------------------------------

/**
 * Bind threshold input elements to CONFIG live updates.
 * Expects input elements with data-config-key attributes.
 * e.g. <input data-config-key="thresholds.maxVoltage" type="number" />
 */
function initThresholdForm() {
  const form = el('thresholdForm');
  if (!form) return;

  // Populate with current config values on load
  const state = getState();
  const config = state.config || {};

  form.querySelectorAll('[data-config-key]').forEach((input) => {
    const keyPath = input.dataset.configKey;
    const keys    = keyPath.split('.');
    let val = config;
    for (const k of keys) {
      if (val == null) { val = null; break; }
      val = val[k];
    }
    if (val != null) input.value = val;
  });

  // Live update CONFIG on every change
  form.addEventListener('change', (e) => {
    const input   = e.target.closest('[data-config-key]');
    if (!input) return;
    const keyPath = input.dataset.configKey;
    const value   = input.type === 'number' ? parseFloat(input.value) : input.value;
    _setNestedConfig(keyPath, value);
  });
}

/**
 * Set a dot-notation path on the mutable CONFIG object in state.
 * This relies on state.config being a mutable reference.
 * @param {string} keyPath  e.g. 'thresholds.maxVoltage'
 * @param {*}      value
 */
function _setNestedConfig(keyPath, value) {
  const state  = getState();
  const config = state.config;
  if (!config) return;

  const keys = keyPath.split('.');
  let obj    = config;
  for (let i = 0; i < keys.length - 1; i++) {
    if (obj[keys[i]] == null) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
}

// ---------------------------------------------------------------------------
// Status fields population
// ---------------------------------------------------------------------------

function populateStatus() {
  const state = getState();

  setText('settingsFirebaseStatus', state.mode === 'LIVE' ? 'Connected' : 'Disconnected');
  setText('settingsMode',           state.mode ?? 'SIMULATION');
  setText('settingsVersion',        APP_VERSION);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise the Settings view.
 */
export function initSettingsView() {
  initModeToggle();
  initResetBtn();
  initThresholdForm();
  populateStatus();
}
