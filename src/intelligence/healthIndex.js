/**
 * healthIndex.js
 * Computes a composite transformer health score from four weighted factors:
 * loading, temperature, voltage, and vibration.
 *
 * Subscribes to all state changes ('*') and updates health index state
 * after every telemetry push from the simulation engine.
 */

import CONFIG from '../config/config.js';
import { subscribe, setHealthIndex } from '../core/state.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamp v to [lo, hi].
 * @param {number} v
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// Health computation
// ---------------------------------------------------------------------------

/**
 * Compute the four-factor health score from the latest transformer telemetry.
 *
 * Factor formulas (each returns a value in [0, 100] before weighting):
 *   Loading factor   : 100 âˆ’ clamp((loading âˆ’ 50) / 50, 0, 1) Ã— 40
 *   Temperature factor: 100 âˆ’ clamp((temp âˆ’ 30) / 40, 0, 1) Ã— 40
 *   Voltage factor   : 100 âˆ’ clamp((12.5 âˆ’ voltage) / 2, 0, 1) Ã— 30
 *   Vibration factor : 100 âˆ’ clamp(vibration / 0.5, 0, 1) Ã— 30
 *
 * @param {{loading:number, temperature:number, voltage:number, vibration:number}} telemetry
 * @returns {{score:number, label:string, factors:{loading:number,temperature:number,voltage:number,vibration:number}}}
 */
function computeHealth({ loading = 0, temperature = 28, voltage = 12, vibration = 0 }) {
  // Individual raw factor scores [0â€“100]
  const loadingFactor    = 100 - clamp((loading - 50) / 50, 0, 1) * 40;
  const temperatureFactor = 100 - clamp((temperature - 30) / 40, 0, 1) * 40;
  const voltageFactor    = 100 - clamp((12.5 - voltage) / 2, 0, 1) * 30;
  const vibrationFactor  = 100 - clamp(vibration / 0.5, 0, 1) * 30;

  // Retrieve weights from CONFIG, falling back to equal weighting
  const weights = CONFIG.health?.weights ?? {
    loading: 0.35,
    temperature: 0.30,
    voltage: 0.20,
    vibration: 0.15,
  };

  // Weighted composite score
  const score =
    loadingFactor    * (weights.loading     ?? 0.35) +
    temperatureFactor * (weights.temperature ?? 0.30) +
    voltageFactor    * (weights.voltage     ?? 0.20) +
    vibrationFactor  * (weights.vibration   ?? 0.15);

  // Health label thresholds
  let label;
  if (score >= 85) {
    label = 'HEALTHY';
  } else if (score >= 70) {
    label = 'FAIR';
  } else if (score >= 50) {
    label = 'DEGRADED';
  } else {
    label = 'CRITICAL';
  }

  return {
    score: parseFloat(score.toFixed(2)),
    label,
    factors: {
      loading:     parseFloat(loadingFactor.toFixed(2)),
      temperature: parseFloat(temperatureFactor.toFixed(2)),
      voltage:     parseFloat(voltageFactor.toFixed(2)),
      vibration:   parseFloat(vibrationFactor.toFixed(2)),
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the health index engine.
 * Subscribes to all state updates and recomputes health on every change.
 */
export function initHealthEngine() {
  subscribe('*', (state) => {
    const transformer = state.transformer ?? {};

    const { loading = 0, temperature = 28, voltage = 12, vibration = 0 } = transformer;

    const result = computeHealth({ loading, temperature, voltage, vibration });

    setHealthIndex({
      score: result.score,
      label: result.label,
      factors: result.factors,
      timestamp: Date.now(),
    });
  });

  console.info('[HealthEngine] Health index engine initialised.');
}
