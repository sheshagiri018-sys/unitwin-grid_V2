/**
 * healthIndex.js
 * Computes a composite transformer health score from four weighted factors:
 * loading, temperature, voltage, and vibration.
 *
 * FIX: Subscribes to 'transformer' ONLY (not '*') to prevent infinite loop.
 * (subscribe('*') + setHealthIndex() → emits health → fires '*' again → infinite recursion)
 */

import CONFIG from '../config/config.js';
import { subscribe, setHealthIndex } from '../core/state.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// Health computation
// ---------------------------------------------------------------------------

function computeHealth({ loading = 0, temperature = 28, voltage = 12, vibration = 0 }) {
  // Individual raw factor scores [0-100]
  const loadingFactor     = 100 - clamp((loading     - 50)  / 50,  0, 1) * 40;
  const temperatureFactor = 100 - clamp((temperature - 30)  / 40,  0, 1) * 40;
  const voltageFactor     = 100 - clamp((12.5 - voltage)    / 2,   0, 1) * 30;
  const vibrationFactor   = 100 - clamp(vibration           / 0.5, 0, 1) * 30;

  const weights = CONFIG.health?.weights ?? {
    loading: 0.35, temperature: 0.30, voltage: 0.20, vibration: 0.15
  };

  const score =
    loadingFactor     * (weights.loading      ?? 0.35) +
    temperatureFactor * (weights.temperature  ?? 0.30) +
    voltageFactor     * (weights.voltage      ?? 0.20) +
    vibrationFactor   * (weights.vibration    ?? 0.15);

  let label;
  if      (score >= 85) label = 'HEALTHY';
  else if (score >= 70) label = 'FAIR';
  else if (score >= 50) label = 'DEGRADED';
  else                  label = 'CRITICAL';

  return {
    score: parseFloat(score.toFixed(2)),
    label,
    factors: {
      loading:     { score: parseFloat(loadingFactor.toFixed(2)),     label: loadingFactor     >= 85 ? 'GOOD' : loadingFactor     >= 70 ? 'FAIR' : 'POOR' },
      temperature: { score: parseFloat(temperatureFactor.toFixed(2)), label: temperatureFactor >= 85 ? 'GOOD' : temperatureFactor >= 70 ? 'FAIR' : 'POOR' },
      voltage:     { score: parseFloat(voltageFactor.toFixed(2)),     label: voltageFactor     >= 85 ? 'GOOD' : voltageFactor     >= 70 ? 'FAIR' : 'POOR' },
      vibration:   { score: parseFloat(vibrationFactor.toFixed(2)),   label: vibrationFactor  >= 85 ? 'GOOD' : vibrationFactor   >= 70 ? 'FAIR' : 'POOR' }
    }
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the health index engine.
 * FIX: Subscribes to 'transformer' only — NOT '*' — to prevent infinite loop.
 * setHealthIndex() emits ['health'] which would re-fire '*' listeners endlessly.
 */
export function initHealthEngine() {
  subscribe('transformer', (state) => {
    const tx = state.transformer ?? {};
    const { loading = 0, temperature = 28, voltage = 12, vibration = 0 } = tx;
    const result = computeHealth({ loading, temperature, voltage, vibration });
    setHealthIndex({ score: result.score, label: result.label, factors: result.factors, timestamp: Date.now() });
  });

  console.info('[HealthEngine] Health index engine initialised (subscribing to transformer only).');
}
