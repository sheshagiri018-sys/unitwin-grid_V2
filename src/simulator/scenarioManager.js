/**
 * scenarioManager.js
 * High-level scenario orchestrator for UNITWIN GRID V2.
 *
 * Bridges the simulation engine, global state store, and camera system so
 * that a single activateScenario() call applies physics presets, updates UI
 * state, fires an informational alert, and positions the 3-D camera.
 */

import {
  setSimulationScenario,
  setSimulationEVLevel,
  setSimulationSolar,
  setSimulationHousehold,
  SCENARIOS as _ENGINE_SCENARIOS,
} from '../data/simulationEngine.js';

import { setScenario, addAlert } from '../core/state.js';

import { moveTo } from '../twin/cameraManager.js';

// ---------------------------------------------------------------------------
// Re-export SCENARIOS so consumers can import from one place
// ---------------------------------------------------------------------------

export { _ENGINE_SCENARIOS as SCENARIOS };

// ---------------------------------------------------------------------------
// Camera view map
// ---------------------------------------------------------------------------

/**
 * Maps each scenario name to the named camera position defined in
 * cameraManager.  Views not listed fall back to 'overview'.
 * @type {Record<string, string>}
 */
const CAMERA_VIEW_MAP = {
  NORMAL:      'overview',
  EV_CHARGING: 'ev',
  SOLAR_EV:    'energyFlow',
  HIGH_DEMAND: 'transformer',
  OVERLOAD:    'transformer',
  NO_SOLAR:    'overview',
  TEMP_RISE:   'transformer',
  VIB_ANOMALY: 'transformer',
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Activate a named scenario across all subsystems simultaneously.
 *
 * Steps performed:
 * 1. Apply physics preset to the simulation engine.
 * 2. Push scenario name into global UI state.
 * 3. Raise an INFO alert describing the scenario.
 * 4. Animate the camera to the contextually appropriate viewpoint.
 *
 * @param {string} name  Key of SCENARIOS (e.g. 'OVERLOAD', 'SOLAR_EV').
 */
export function activateScenario(name) {
  const preset = _ENGINE_SCENARIOS[name];

  if (!preset) {
    console.warn(`[ScenarioManager] Unknown scenario: "${name}". Activation skipped.`);
    return;
  }

  // 1. Apply physics
  setSimulationScenario(name);
  setSimulationSolar(preset.solarOn);
  setSimulationHousehold(preset.householdOn);
  setSimulationEVLevel(preset.evLevel);

  // 2. Update global state
  setScenario(name);

  // 3. Raise informational alert
  addAlert({
    severity: 'INFO',
    message: `Scenario activated: ${preset.label} â€” ${preset.description}`,
    source: 'ScenarioManager',
    timestamp: Date.now(),
  });

  // 4. Move camera
  const cameraView = CAMERA_VIEW_MAP[name] ?? 'overview';
  moveTo(cameraView);

  console.info(
    `[ScenarioManager] Activated "${name}" â†’ camera view "${cameraView}".`
  );
}
