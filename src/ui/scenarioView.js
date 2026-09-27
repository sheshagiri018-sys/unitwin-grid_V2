/**
 * scenarioView.js — UNITWIN GRID V2
 * Drives the Scenarios & Demo page: scenario buttons, EV/solar/household controls, demo sequence.
 */

import { activateScenario } from '../simulator/scenarioManager.js';
import { setSimulationEVLevel, setSimulationSolar, setSimulationHousehold } from '../data/simulationEngine.js';
import { subscribe, addAlert, resetState } from '../core/state.js';
import {
  startDemo,
  stopDemo,
  pauseDemo,
  resumeDemo,
  skipDemo,
  isRunning,
  isPaused,
} from './demoController.js';

function el(id) { return document.getElementById(id); }

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text ?? '—';
}

function initScenarioButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-scenario]');
    if (!btn) return;

    const scenario = btn.dataset.scenario;
    activateScenario(scenario);
    addAlert('INFO', `Scenario activated: ${scenario}`);

    const group = btn.closest('[data-scenario-group]') ?? document.querySelector('.scenario-grid') ?? btn.parentElement;
    if (group) {
      group.querySelectorAll('[data-scenario]').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
    }
  });
}

function initEVLevelButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ev-level]');
    if (!btn) return;

    const level = btn.dataset.evLevel;
    if (level) {
      setSimulationEVLevel(level);
      addAlert('INFO', `EV charge level set to ${level.toUpperCase()}.`);
    }

    const group = btn.closest('[data-ev-group]') ?? btn.parentElement;
    if (group) {
      group.querySelectorAll('[data-ev-level]').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
    }
  });
}

function initSolarToggle() {
  const toggle = el('solarToggle');
  if (!toggle) return;
  toggle.addEventListener('change', () => {
    setSimulationSolar(toggle.checked);
    addAlert('INFO', `Solar generation ${toggle.checked ? 'enabled' : 'disabled'}.`);
  });
}

function initHouseholdToggle() {
  const toggle = el('householdToggle');
  if (!toggle) return;
  toggle.addEventListener('change', () => {
    setSimulationHousehold(toggle.checked);
    addAlert('INFO', `Household load ${toggle.checked ? 'enabled' : 'disabled'}.`);
  });
}

function updateDemoButtonStates() {
  const pauseBtn = el('demoPauseBtn');
  if (pauseBtn) {
    pauseBtn.textContent = isPaused() ? 'Resume' : 'Pause';
  }
  const pauseBtn2 = el('demoPauseBtn2');
  if (pauseBtn2) {
    pauseBtn2.textContent = isPaused() ? '▶ RESUME' : '⏸ PAUSE';
  }

  const startBtn  = el('demoStartBtn');
  const startBtn2 = el('demoStartBtn2');
  const running   = isRunning();
  if (startBtn)  startBtn.disabled  = running;
  if (startBtn2) startBtn2.disabled = running;
}

function initDemoControls() {
  ['demoStartBtn', 'demoStartBtn2'].forEach((btnId) => {
    const btn = el(btnId);
    if (!btn) return;
    btn.addEventListener('click', () => {
      startDemo(() => {
        addAlert('INFO', 'Demo sequence completed.');
        updateDemoButtonStates();
      });
      updateDemoButtonStates();
    });
  });

  const stopBtn = el('demoStopBtn');
  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      stopDemo();
      updateDemoButtonStates();
    });
  }

  ['demoPauseBtn', 'demoPauseBtn2'].forEach((btnId) => {
    const pauseBtn = el(btnId);
    if (!pauseBtn) return;
    pauseBtn.addEventListener('click', () => {
      if (isPaused()) {
        resumeDemo();
      } else {
        pauseDemo();
      }
      updateDemoButtonStates();
    });
  });

  ['demoSkipBtn', 'demoSkipBtn2'].forEach((btnId) => {
    const skipBtn = el(btnId);
    if (!skipBtn) return;
    skipBtn.addEventListener('click', () => {
      skipDemo();
      updateDemoButtonStates();
    });
  });
}

function initResetSystemBtn() {
  const btn = el('resetSystemBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    resetState();
    activateScenario('NORMAL');
    addAlert('INFO', 'System reset and NORMAL scenario activated.');
  });
}

function applyState(state) {
  const tx   = state.transformer || {};
  const hlth = state.health      || {};

  setText('scenLoadingPct', tx.loading     != null ? tx.loading.toFixed(1) + '%'     : '—');
  setText('scenTemp',       tx.temperature != null ? tx.temperature.toFixed(1) + ' °C' : '—');
  setText('scenVib',        tx.vibration   != null ? tx.vibration.toFixed(3) + ' g'   : '—');
  setText('scenHealth',     hlth.score      != null ? hlth.score.toFixed(0) + '%'     : '—');

  const scenStateEl = el('scenState');
  if (scenStateEl && tx.state) {
    scenStateEl.textContent = tx.state;
    scenStateEl.className = 'state-badge ' + (
      tx.state === 'CRITICAL' ? 'state-critical' :
      tx.state === 'WARNING'  ? 'state-warning'  : 'state-normal'
    );
  }
}

export function initScenarioView() {
  initScenarioButtons();
  initEVLevelButtons();
  initSolarToggle();
  initHouseholdToggle();
  initDemoControls();
  initResetSystemBtn();

  subscribe('*', (state) => applyState(state));
}
