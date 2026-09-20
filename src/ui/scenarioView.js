/**
 * scenarioView.js â€” UNITWIN GRID V2
 * Drives the Scenarios & Demo page: scenario buttons, EV/solar/household controls, demo sequence.
 */

import { activateScenario }                                          from '../simulator/scenarioManager.js';
import { setSimulationEVLevel, setSimulationSolar, setSimulationHousehold } from '../data/simulationEngine.js';
import { subscribe, addAlert, resetState }                          from '../core/state.js';
import {
  startDemo,
  stopDemo,
  pauseDemo,
  resumeDemo,
  skipDemo,
  isRunning,
  isPaused,
} from './demoController.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(id) { return document.getElementById(id); }

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text ?? 'â€”';
}

// ---------------------------------------------------------------------------
// Scenario buttons â€” [data-scenario]
// ---------------------------------------------------------------------------

function initScenarioButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-scenario]');
    if (!btn) return;

    const scenario = btn.dataset.scenario;
    activateScenario(scenario);
    addAlert('INFO', `Scenario activated: ${scenario}`);

    // Highlight active button within the group
    const group = btn.closest('[data-scenario-group]') ?? document.querySelector('.scenario-grid');
    if (group) {
      group.querySelectorAll('[data-scenario]').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
    }
  });
}

// ---------------------------------------------------------------------------
// EV level buttons â€” [data-ev-level]
// ---------------------------------------------------------------------------

function initEVLevelButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ev-level]');
    if (!btn) return;

    const level = parseInt(btn.dataset.evLevel, 10);
    if (!isNaN(level)) {
      setSimulationEVLevel(level);
      addAlert('INFO', `EV charge level set to ${level} kW.`);
    }

    // Highlight
    const group = btn.closest('[data-ev-group]') ?? btn.parentElement;
    if (group) {
      group.querySelectorAll('[data-ev-level]').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
    }
  });
}

// ---------------------------------------------------------------------------
// Solar toggle â€” #solarToggle
// ---------------------------------------------------------------------------

function initSolarToggle() {
  const toggle = el('solarToggle');
  if (!toggle) return;
  toggle.addEventListener('change', () => {
    setSimulationSolar(toggle.checked);
    addAlert('INFO', `Solar generation ${toggle.checked ? 'enabled' : 'disabled'}.`);
  });
}

// ---------------------------------------------------------------------------
// Household toggle â€” #householdToggle
// ---------------------------------------------------------------------------

function initHouseholdToggle() {
  const toggle = el('householdToggle');
  if (!toggle) return;
  toggle.addEventListener('change', () => {
    setSimulationHousehold(toggle.checked);
    addAlert('INFO', `Household load ${toggle.checked ? 'enabled' : 'disabled'}.`);
  });
}

// ---------------------------------------------------------------------------
// Demo controls
// ---------------------------------------------------------------------------

/**
 * Update the demo button states (play/pause labels etc.) to reflect current status.
 */
function updateDemoButtonStates() {
  const pauseBtn = el('demoPauseBtn');
  if (pauseBtn) {
    pauseBtn.textContent = isPaused() ? 'Resume' : 'Pause';
  }
  const startBtn  = el('demoStartBtn');
  const startBtn2 = el('demoStartBtn2');
  const running   = isRunning();
  if (startBtn)  startBtn.disabled  = running;
  if (startBtn2) startBtn2.disabled = running;
}

function initDemoControls() {
  // Start buttons (may exist in multiple locations)
  ['demoStartBtn', 'demoStartBtn2'].forEach((btnId) => {
    const btn = el(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      startDemo(() => {
        // Demo complete callback
        addAlert('INFO', 'Demo sequence completed.');
        updateDemoButtonStates();
      });
      updateDemoButtonStates();
    });
  });

  // Stop button
  const stopBtn = el('demoStopBtn');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      stopDemo();
      updateDemoButtonStates();
    });
  }

  // Pause / resume toggle
  const pauseBtn = el('demoPauseBtn');
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      if (isPaused()) {
        resumeDemo();
      } else {
        pauseDemo();
      }
      updateDemoButtonStates();
    });
  }

  // Skip step
  const skipBtn = el('demoSkipBtn');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      skipDemo();
      updateDemoButtonStates();
    });
  }
}

// ---------------------------------------------------------------------------
// System reset button
// ---------------------------------------------------------------------------

function initResetSystemBtn() {
  const btn = el('resetSystemBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    resetState();
    activateScenario('NORMAL');
    addAlert('INFO', 'System reset and NORMAL scenario activated.');
  });
}

// ---------------------------------------------------------------------------
// Live state display
// ---------------------------------------------------------------------------

function applyState(state) {
  const load  = state.loading       || {};
  const s     = state.sensors       || {};
  const hlth  = state.health        || {};

  setText('scenLoadingPct', load.percentage != null ? load.percentage.toFixed(1) + '%' : 'â€”');
  setText('scenTemp',       s.temperature   != null ? s.temperature.toFixed(1) + ' Â°C' : 'â€”');
  setText('scenVib',        s.vibration     != null ? s.vibration.toFixed(3) + ' g'    : 'â€”');
  setText('scenHealth',     hlth.score      != null ? hlth.score.toFixed(0)             : 'â€”');
  setText('scenState',      state.transformerState ?? 'â€”');
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise the Scenarios & Demo view.
 */
export function initScenarioView() {
  initScenarioButtons();
  initEVLevelButtons();
  initSolarToggle();
  initHouseholdToggle();
  initDemoControls();
  initResetSystemBtn();

  subscribe('*', (state) => applyState(state));
}
