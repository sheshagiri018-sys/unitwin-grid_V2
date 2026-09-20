/**
 * simulationEngine.js
 * Physics-based cause-and-effect simulation engine for UNITWIN GRID V2.
 * Drives all real-time telemetry via setInterval with sensor noise and
 * smooth thermal lag modelling.
 */

import CONFIG from '../config/config.js';
import {
  setTransformerState,
  setSolarGeneration,
  setEVCharging,
  setHouseholdLoad,
  setAmbientData,
  setScenario,
  addAlert,
} from '../core/state.js';

// ---------------------------------------------------------------------------
// Scenario definitions
// ---------------------------------------------------------------------------

/**
 * Each scenario describes a named operating condition for the transformer grid.
 * @type {Record<string, {label:string, solarOn:boolean, solarPowerW:number,
 *   householdOn:boolean, evLevel:string, description:string}>}
 */
export const SCENARIOS = {
  NORMAL: {
    label: 'Normal Operation',
    solarOn: true,
    solarPowerW: 3500,
    householdOn: true,
    evLevel: 'off',
    description:
      'Stable grid operation. Solar panels active, household loads nominal, no EV charging.',
  },
  EV_CHARGING: {
    label: 'EV Charging',
    solarOn: true,
    solarPowerW: 3500,
    householdOn: true,
    evLevel: 'medium',
    description:
      'EV charging at medium rate added to normal household load. Monitor transformer temperature.',
  },
  SOLAR_EV: {
    label: 'Solar + EV Peak',
    solarOn: true,
    solarPowerW: 6000,
    householdOn: true,
    evLevel: 'high',
    description:
      'Peak solar generation combined with high-rate EV charging. Demonstrating energy flow balance.',
  },
  HIGH_DEMAND: {
    label: 'High Demand',
    solarOn: false,
    solarPowerW: 0,
    householdOn: true,
    evLevel: 'high',
    description:
      'No solar contribution, high household and EV demand. Transformer under significant load.',
  },
  OVERLOAD: {
    label: 'Overload Condition',
    solarOn: false,
    solarPowerW: 0,
    householdOn: true,
    evLevel: 'high',
    description:
      'Critical overload scenario. Immediate load shedding recommended to protect transformer.',
  },
  NO_SOLAR: {
    label: 'No Solar',
    solarOn: false,
    solarPowerW: 0,
    householdOn: true,
    evLevel: 'low',
    description:
      'Solar generation offline (night / cloud cover). Grid feeds all loads from utility supply.',
  },
  TEMP_RISE: {
    label: 'Temperature Rise',
    solarOn: true,
    solarPowerW: 2000,
    householdOn: true,
    evLevel: 'medium',
    description:
      'Ambient temperature spike causing transformer thermal stress. Load unchanged.',
  },
  VIB_ANOMALY: {
    label: 'Vibration Anomaly',
    solarOn: true,
    solarPowerW: 3000,
    householdOn: true,
    evLevel: 'low',
    description:
      'Unusual mechanical vibration detected on transformer housing. Investigate mounting hardware.',
  },
};

// ---------------------------------------------------------------------------
// EV power map (kW delivered to transformer)
// ---------------------------------------------------------------------------
const EV_POWER_KW = {
  off: 0,
  low: 3.3,
  medium: 7.2,
  high: 11.0,
};

// ---------------------------------------------------------------------------
// Internal simulation state
// ---------------------------------------------------------------------------
const _sim = {
  solarOn: true,
  solarPowerW: 3500,
  householdOn: true,
  evLevel: 'off',
  scenario: 'NORMAL',

  /** Current (smoothed) temperature of transformer oil [Â°C] */
  tempActual: 28,

  /** Target temperature driven by current loading [Â°C] */
  tempTarget: 28,

  /**
   * Vibration base amplitude in mm/s; elevated by EV level and anomaly mode.
   * @type {number}
   */
  vibBase: 0.05,

  /** Increments every _tick call. */
  tick: 0,
};

/** Handle returned by setInterval, used by stopSimulation(). */
let _intervalHandle = null;

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Returns a random noise multiplier centred on 1.0 with Â±maxPct% deviation.
 * @param {number} maxPct  e.g. 0.04 for Â±4 %
 * @returns {number}
 */
function _noise(maxPct = 0.04) {
  return 1 + (Math.random() * 2 - 1) * maxPct;
}

/**
 * Clamp a value between lo and hi.
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function _clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// Core tick
// ---------------------------------------------------------------------------

/**
 * Called every 500 ms by setInterval.  Computes all derived electrical and
 * thermal quantities and pushes them into the shared state store.
 */
function _tick() {
  _sim.tick += 1;

  // ------------------------------------------------------------------
  // 1. Load power components (kW)
  // ------------------------------------------------------------------
  const householdPowerKW = _sim.householdOn
    ? (CONFIG.simulation?.householdPowerKW ?? 2.4) * _noise()
    : 0;

  const evPowerKW = EV_POWER_KW[_sim.evLevel] ?? 0;

  const solarPowerKW = _sim.solarOn
    ? (_sim.solarPowerW / 1000) * _noise(0.03)
    : 0;

  // Net demand the transformer must supply (solar offsets load)
  const netDemandKW = Math.max(0, householdPowerKW + evPowerKW - solarPowerKW * 0.3);

  // ------------------------------------------------------------------
  // 2. Electrical quantities
  // ------------------------------------------------------------------
  // Transformer secondary nominal voltage 12 kV (or as configured).
  // Vibration from EV switching creates a small voltage ripple.
  const ratedVoltageKV = CONFIG.transformer?.ratedVoltage ?? 12;

  const vibNoise = (_sim.evLevel !== 'off' ? 0.015 : 0.005) * (Math.random() * 2 - 1);
  const voltage = (ratedVoltageKV + vibNoise) * _noise(0.01);

  // Current in kA derived from P = V Ã— I
  const current = voltage > 0 ? netDemandKW / voltage : 0;

  // Power kW (sanity cross-check, should match netDemandKW closely)
  const power = voltage * current;

  // Loading percentage: rated capacity from CONFIG or default 12 kW
  const ratedPowerKW = CONFIG.transformer?.ratedPower ?? 12;
  const loading = _clamp((power / ratedPowerKW) * 100, 0, 120);

  // ------------------------------------------------------------------
  // 3. Thermal simulation (first-order low-pass, Ï„ â‰ˆ 120 ticks)
  // ------------------------------------------------------------------
  const ambientTemp = CONFIG.simulation?.ambientTemp ?? 28;
  const thermalCoeff = CONFIG.transformer?.thermalCoefficient ?? 0.6;

  // Target temperature rises with loading squared (resistive heating)
  _sim.tempTarget = ambientTemp + loading * thermalCoeff * _noise(0.02);

  // Smooth approach to target with time constant â‰ˆ 120 ticks
  const tau = 120;
  _sim.tempActual =
    _sim.tempActual + (1 / tau) * (_sim.tempTarget - _sim.tempActual);

  const temperature = _sim.tempActual * _noise(0.01);

  // ------------------------------------------------------------------
  // 4. Vibration (mm/s RMS)
  // ------------------------------------------------------------------
  // Base vibration is small; EV charging switching introduces harmonics.
  const evVibContrib =
    _sim.evLevel === 'high'
      ? 0.28
      : _sim.evLevel === 'medium'
      ? 0.16
      : _sim.evLevel === 'low'
      ? 0.06
      : 0;

  // In VIB_ANOMALY scenario the base is elevated
  const vibBase =
    _sim.scenario === 'VIB_ANOMALY' ? 0.38 : _sim.vibBase;

  const vibration = _clamp(
    (vibBase + evVibContrib) * _noise(0.12),
    0,
    2
  );

  // ------------------------------------------------------------------
  // 5. Push to state
  // ------------------------------------------------------------------
  setTransformerState({
    voltage: parseFloat(voltage.toFixed(3)),
    current: parseFloat(current.toFixed(3)),
    power: parseFloat(power.toFixed(3)),
    loading: parseFloat(loading.toFixed(1)),
    temperature: parseFloat(temperature.toFixed(2)),
    vibration: parseFloat(vibration.toFixed(4)),
    timestamp: Date.now(),
  });

  setSolarGeneration({
    on: _sim.solarOn,
    powerW: parseFloat((solarPowerKW * 1000).toFixed(1)),
    powerKW: parseFloat(solarPowerKW.toFixed(3)),
    timestamp: Date.now(),
  });

  setEVCharging({
    level: _sim.evLevel,
    powerKW: parseFloat(evPowerKW.toFixed(3)),
    active: _sim.evLevel !== 'off',
    timestamp: Date.now(),
  });

  setHouseholdLoad({
    on: _sim.householdOn,
    powerKW: parseFloat(householdPowerKW.toFixed(3)),
    timestamp: Date.now(),
  });

  setAmbientData({
    temperature: parseFloat(ambientTemp.toFixed(1)),
    humidity: 55 + (Math.random() * 10 - 5),
    timestamp: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the simulation engine and begin ticking at 500 ms intervals.
 * Safe to call multiple times â€” existing interval is cleared first.
 */
export function initSimulation() {
  stopSimulation();
  // Apply default scenario so state is consistent from the first tick
  setSimulationScenario('NORMAL');
  _intervalHandle = setInterval(_tick, 500);
  console.info('[SimEngine] Simulation started (500 ms tick).');
}

/**
 * Apply a named scenario preset to the simulation engine.
 * @param {string} name  Key of SCENARIOS
 */
export function setSimulationScenario(name) {
  const preset = SCENARIOS[name];
  if (!preset) {
    console.warn(`[SimEngine] Unknown scenario: "${name}". Ignoring.`);
    return;
  }
  _sim.scenario = name;
  _sim.solarOn = preset.solarOn;
  _sim.solarPowerW = preset.solarPowerW;
  _sim.householdOn = preset.householdOn;
  _sim.evLevel = preset.evLevel;

  // Reset thermal target on scenario switch to avoid stale warm-up state
  if (name === 'OVERLOAD' || name === 'HIGH_DEMAND') {
    _sim.tempTarget = Math.max(_sim.tempTarget, 60);
  }

  console.info(`[SimEngine] Scenario applied: ${name} â€” ${preset.label}`);
}

/**
 * Override the EV charging level without switching the whole scenario.
 * @param {'off'|'low'|'medium'|'high'} level
 */
export function setSimulationEVLevel(level) {
  if (!Object.prototype.hasOwnProperty.call(EV_POWER_KW, level)) {
    console.warn(`[SimEngine] Unknown EV level: "${level}". Must be off|low|medium|high.`);
    return;
  }
  _sim.evLevel = level;
  console.info(`[SimEngine] EV level set to: ${level}`);
}

/**
 * Toggle solar panel generation on or off.
 * @param {boolean} on
 */
export function setSimulationSolar(on) {
  _sim.solarOn = Boolean(on);
  console.info(`[SimEngine] Solar generation: ${_sim.solarOn ? 'ON' : 'OFF'}`);
}

/**
 * Toggle household load on or off.
 * @param {boolean} on
 */
export function setSimulationHousehold(on) {
  _sim.householdOn = Boolean(on);
  console.info(`[SimEngine] Household load: ${_sim.householdOn ? 'ON' : 'OFF'}`);
}

/**
 * Stop the simulation tick loop.  State is preserved for inspection.
 */
export function stopSimulation() {
  if (_intervalHandle !== null) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
    console.info('[SimEngine] Simulation stopped.');
  }
}
