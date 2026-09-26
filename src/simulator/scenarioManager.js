import { SCENARIOS as ENGINE_SCENARIOS, setSimulationScenario, setSimulationSolar, setSimulationHousehold, setSimulationEVLevel } from '../data/simulationEngine.js';
import { setScenario, addAlert } from '../core/state.js';
import { moveTo } from '../twin/cameraManager.js';

export const SCENARIOS = ENGINE_SCENARIOS;

const CAMERA_VIEW_MAP = {
  NORMAL: 'overview', EV_CHARGING: 'ev', SOLAR_EV: 'energyFlow',
  HIGH_DEMAND: 'transformer', OVERLOAD: 'transformer', NO_SOLAR: 'overview',
  TEMP_RISE: 'transformer', VIB_ANOMALY: 'transformer'
};

export function activateScenario(name) {
  const preset = ENGINE_SCENARIOS[name];
  if (!preset) { console.warn('[ScenarioMgr] Unknown scenario:', name); return; }
  setSimulationScenario(name);
  setSimulationSolar(preset.solarOn);
  setSimulationHousehold(preset.householdOn);
  setSimulationEVLevel(preset.evLevel);
  // setScenario already called inside setSimulationScenario now
  // FIX: use positional args
  addAlert('INFO', `Scenario activated: ${preset.label} — ${preset.description}`, 'SCENARIO');
  const cameraView = CAMERA_VIEW_MAP[name] || 'overview';
  try { moveTo(cameraView); } catch(e) {}
}
