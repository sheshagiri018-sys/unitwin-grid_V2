/**
 * demoController.js â€” UNITWIN GRID V2
 * 90-second scripted demo sequence with pause / resume / skip / stop.
 */

import { activateScenario } from '../simulator/scenarioManager.js';
import { moveTo }           from '../twin/cameraManager.js';
import { addAlert, setMode, setTwinViewMode } from '../core/state.js';

// ---------------------------------------------------------------------------
// Demo timeline definition
// ---------------------------------------------------------------------------

/**
 * @typedef {{ startSec: number, endSec: number, caption: string, desc: string, action: function }} DemoStep
 */

/** @type {DemoStep[]} */
const STEPS = [
  {
    startSec: 0,
    endSec:   8,
    caption:  'UNITWIN GRID â€” System Initialization',
    desc:     'Booting digital twin and establishing sensor links.',
    action:   () => {
      moveTo('overview');
    },
  },
  {
    startSec: 8,
    endSec:   20,
    caption:  'Normal Operation â€” Solar + Household Load',
    desc:     'System running within nominal parameters. Solar generation active.',
    action:   () => {
      activateScenario('NORMAL');
    },
  },
  {
    startSec: 20,
    endSec:   35,
    caption:  'Solar Generation Active',
    desc:     'Peak solar output â€” transformer offloading grid draw.',
    action:   () => {
      activateScenario('SOLAR_EV');
      moveTo('solar');
    },
  },
  {
    startSec: 35,
    endSec:   50,
    caption:  'EV Charging Started â€” Load Increasing',
    desc:     'EV charger connected. Transformer loading rising.',
    action:   () => {
      activateScenario('EV_CHARGING');
      moveTo('ev');
    },
  },
  {
    startSec: 50,
    endSec:   65,
    caption:  'Thermal Analysis â€” Temperature Rising',
    desc:     'Thermal view active. Intelligence monitoring core temperature.',
    action:   () => {
      setTwinViewMode('THERMAL');
    },
  },
  {
    startSec: 65,
    endSec:   78,
    caption:  'Intelligence Detecting Anomaly',
    desc:     'High-demand scenario â€” vibration and temperature alerts triggered.',
    action:   () => {
      activateScenario('HIGH_DEMAND');
      moveTo('transformer');
      addAlert('WARNING', 'Demo: High demand anomaly detected by intelligence engine.');
    },
  },
  {
    startSec: 78,
    endSec:   90,
    caption:  'System Stabilizing',
    desc:     'Load shedding applied. Returning to normal operation.',
    action:   () => {
      activateScenario('NORMAL');
      setTwinViewMode('STANDARD');
      moveTo('overview');
    },
  },
];

const TOTAL_DURATION_SEC = 90;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _running      = false;
let _paused       = false;
let _startTime    = 0;       // performance.now() when demo started (or resumed)
let _elapsed      = 0;       // seconds elapsed before last pause
let _rafId        = null;    // requestAnimationFrame handle
let _stepsDone    = new Set(); // step indices whose action has been fired
let _onComplete   = null;    // callback

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function el(id) { return document.getElementById(id); }

function setCaption(text) {
  const node = el('demoCaption');
  if (node) node.textContent = text;
}

function setStepDesc(text) {
  const node = el('demoStepDesc');
  if (node) node.textContent = text;
}

function setTimeLabel(elapsed, total) {
  const node = el('demoTimeLabel');
  if (node) {
    const rem = Math.max(0, total - elapsed);
    node.textContent = `${Math.floor(elapsed)}s / ${total}s  (${Math.ceil(rem)}s remaining)`;
  }
}

function setProgressBar(pct) {
  const bar = el('demoProgressBar');
  if (bar) bar.style.width = Math.min(100, Math.max(0, pct)).toFixed(2) + '%';
}

// ---------------------------------------------------------------------------
// Tick loop
// ---------------------------------------------------------------------------

function tick(ts) {
  if (!_running || _paused) return;

  const elapsed = _elapsed + (performance.now() - _startTime) / 1000;

  // Update progress UI
  const pct = (elapsed / TOTAL_DURATION_SEC) * 100;
  setProgressBar(pct);
  setTimeLabel(elapsed, TOTAL_DURATION_SEC);

  // Fire step actions exactly once when their start time is reached
  STEPS.forEach((step, idx) => {
    if (!_stepsDone.has(idx) && elapsed >= step.startSec) {
      _stepsDone.add(idx);
      setCaption(step.caption);
      setStepDesc(step.desc);
      try { step.action(); } catch (e) { console.error(`[demo] Step ${idx} error:`, e); }
    }
  });

  // Check completion
  if (elapsed >= TOTAL_DURATION_SEC) {
    _finishDemo();
    return;
  }

  _rafId = requestAnimationFrame(tick);
}

// ---------------------------------------------------------------------------
// Finish / cleanup
// ---------------------------------------------------------------------------

function _finishDemo() {
  _running  = false;
  _paused   = false;
  _elapsed  = 0;
  _stepsDone.clear();
  setProgressBar(100);
  setCaption('Demo Complete');
  setStepDesc('');
  setTimeLabel(TOTAL_DURATION_SEC, TOTAL_DURATION_SEC);
  if (typeof _onComplete === 'function') {
    _onComplete();
    _onComplete = null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the demo sequence.
 * @param {function} [onComplete]  Optional callback when demo finishes.
 */
export function startDemo(onComplete) {
  if (_running) stopDemo();

  _onComplete = onComplete ?? null;
  _running    = true;
  _paused     = false;
  _elapsed    = 0;
  _startTime  = performance.now();
  _stepsDone.clear();

  setCaption('Initializingâ€¦');
  setStepDesc('');
  setProgressBar(0);
  setTimeLabel(0, TOTAL_DURATION_SEC);

  _rafId = requestAnimationFrame(tick);
}

/**
 * Stop the demo and reset all state.
 */
export function stopDemo() {
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  _running  = false;
  _paused   = false;
  _elapsed  = 0;
  _stepsDone.clear();
  _onComplete = null;

  setCaption('Demo stopped.');
  setStepDesc('');
  setProgressBar(0);
  setTimeLabel(0, TOTAL_DURATION_SEC);
}

/**
 * Pause the demo (preserves elapsed time).
 */
export function pauseDemo() {
  if (!_running || _paused) return;
  _elapsed += (performance.now() - _startTime) / 1000;
  _paused  = true;
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
}

/**
 * Resume a paused demo.
 */
export function resumeDemo() {
  if (!_running || !_paused) return;
  _paused    = false;
  _startTime = performance.now();
  _rafId     = requestAnimationFrame(tick);
}

/**
 * Skip to the next step immediately.
 */
export function skipDemo() {
  if (!_running) return;

  // Find the next unfired step
  const nextIdx = STEPS.findIndex((_, i) => !_stepsDone.has(i));
  if (nextIdx === -1) {
    _finishDemo();
    return;
  }

  // Jump elapsed to that step's start time
  _elapsed   = STEPS[nextIdx].startSec;
  _startTime = performance.now();

  if (_paused) {
    // Just update UI without running
    setProgressBar((_elapsed / TOTAL_DURATION_SEC) * 100);
    setTimeLabel(_elapsed, TOTAL_DURATION_SEC);
    // Fire the action
    const step = STEPS[nextIdx];
    _stepsDone.add(nextIdx);
    setCaption(step.caption);
    setStepDesc(step.desc);
    try { step.action(); } catch (e) { console.error(e); }
  }
}

/** @returns {boolean} Whether the demo is currently running. */
export function isRunning() { return _running; }

/** @returns {boolean} Whether the demo is currently paused. */
export function isPaused()  { return _paused; }
