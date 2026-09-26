// ============================================================
// UNITWIN GRID V2 — forecastEngine.js
// Prototype rule-based forecast engine.
// Uses linear extrapolation over recent history to project
// transformer loading and temperature trends.
//
// CLASSIFICATION: PROTOTYPE FORECAST (rule-based linear model)
// NOT AI/ML — do not claim machine learning capability.
// ============================================================

import { getState, setForecast, subscribe } from '../core/state.js';
import CONFIG from '../config/config.js';

// ── Constants ────────────────────────────────────────────────
const WINDOW_SIZE     = 12;   // samples used for regression (12 × 500ms = 6s)
const FORECAST_STEPS  = 12;   // steps ahead to project  (12 × 500ms = 6s ahead)
const POLL_INTERVAL   = 2000; // ms between forecast runs

let _intervalHandle = null;

// ── OLS linear regression ──────────────────────────────────
/**
 * Returns {slope, intercept} of a least-squares line through the values.
 * @param {number[]} values
 * @returns {{ slope: number, intercept: number }}
 */
function _olsRegression(values) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };

  let sumX = 0, sumY = 0, sumXX = 0, sumXY = 0;
  for (let i = 0; i < n; i++) {
    sumX  += i;
    sumY  += values[i];
    sumXX += i * i;
    sumXY += i * values[i];
  }

  const denom = n * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-9) return { slope: 0, intercept: sumY / n };

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

// ── Project a value N steps forward ──────────────────────────
function _project(values, steps) {
  const recent = values.slice(-WINDOW_SIZE);
  if (recent.length < 2) return recent[recent.length - 1] ?? null;
  const { slope, intercept } = _olsRegression(recent);
  const predicted = intercept + slope * (recent.length - 1 + steps);
  return predicted;
}

// ── Risk classification ────────────────────────────────────
function _classifyRisk(loading, temperature) {
  const critLoading  = CONFIG.transformer.loading.critical.min;  // 90
  const highLoading  = CONFIG.transformer.loading.high.min;      // 75
  const warnTemp     = CONFIG.transformer.warnTemperature;        // 45
  const alarmTemp    = CONFIG.transformer.alarmTemperature;       // 35

  if (loading >= critLoading || temperature >= 70) return 'CRITICAL';
  if (loading >= highLoading || temperature >= warnTemp) return 'HIGH';
  if (loading >= 50          || temperature >= alarmTemp) return 'MEDIUM';
  return 'LOW';
}

// ── Recommendation based on projected state ────────────────
function _recommend(projLoading, projTemp, currentLoading, risk) {
  if (risk === 'CRITICAL') {
    return 'URGENT: Projected overload imminent. Immediately reduce EV charging and non-essential loads to protect transformer.';
  }
  if (risk === 'HIGH') {
    if (projLoading > currentLoading + 10) {
      return 'Loading rising rapidly. Consider reducing flexible EV charging during this peak period to prevent thermal stress.';
    }
    return 'Elevated loading forecast. Monitor temperature trend and prepare to shed EV load if temperature exceeds 45 °C.';
  }
  if (risk === 'MEDIUM') {
    return 'Moderate load forecast. Solar generation helps offset demand. No immediate action required — continue monitoring.';
  }
  return 'All parameters within normal range. System operating efficiently.';
}

// ── Time-to-threshold estimation ─────────────────────────────
function _timeToThreshold(values, threshold, slope) {
  const current = values[values.length - 1];
  if (!current || Math.abs(slope) < 1e-6) return null;
  if (slope <= 0) return null; // trending down or flat — no threshold crossing
  const stepsNeeded = (threshold - current) / slope;
  if (stepsNeeded <= 0) return 0; // already at/above threshold
  const secondsNeeded = stepsNeeded * (CONFIG.simulation.updateIntervalMs / 1000);
  return Math.round(secondsNeeded);
}

// ── Core forecast run ─────────────────────────────────────────
function _runForecast() {
  const state   = getState();
  const history = state.dataHistory;

  // Need at least 4 data points to forecast meaningfully
  if (!history.loading?.length || history.loading.length < 4) {
    setForecast({
      loading:         null,
      temperature:     null,
      risk:            'UNKNOWN',
      timeToThreshold: null,
      recommendation:  'Insufficient data for forecast. Collecting measurements…',
      confidence:      0
    });
    return;
  }

  // Project loading and temperature FORECAST_STEPS ahead
  const projLoading = _project(history.loading, FORECAST_STEPS);
  const projTemp    = _project(history.temperature, FORECAST_STEPS);

  // Clamp projections to realistic ranges
  const clampedLoading = Math.max(0, Math.min(120, projLoading ?? state.transformer.loading));
  const clampedTemp    = Math.max(15, Math.min(85,  projTemp    ?? state.transformer.temperature));

  // OLS on loading to get slope for time-to-threshold
  const recentLoading     = history.loading.slice(-WINDOW_SIZE);
  const { slope: ldSlope } = _olsRegression(recentLoading);
  const critThresh        = CONFIG.transformer.loading.critical.min; // 90
  const timeToThreshold   = _timeToThreshold(recentLoading, critThresh, ldSlope);

  // Classify risk based on projected state
  const risk = _classifyRisk(clampedLoading, clampedTemp);

  // Confidence: high if history is long, low if short
  const confidence = Math.min(1.0, history.loading.length / 30);

  // Recommendation
  const recommendation = _recommend(
    clampedLoading, clampedTemp,
    state.transformer.loading, risk
  );

  setForecast({
    loading:         parseFloat(clampedLoading.toFixed(1)),
    temperature:     parseFloat(clampedTemp.toFixed(1)),
    risk,
    timeToThreshold,
    recommendation,
    confidence:      parseFloat(confidence.toFixed(2))
  });
}

// ── Public API ─────────────────────────────────────────────
/**
 * Start the forecast engine.
 * Runs a forecast every POLL_INTERVAL ms.
 * Also triggers after every transformer state update.
 */
export function initForecastEngine() {
  // Initial forecast
  _runForecast();

  // Poll on interval
  _intervalHandle = setInterval(_runForecast, POLL_INTERVAL);

  console.info('[ForecastEngine] Prototype forecast engine started (linear extrapolation, 2s interval).');
}

export function stopForecastEngine() {
  if (_intervalHandle !== null) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
    console.info('[ForecastEngine] Forecast engine stopped.');
  }
}
