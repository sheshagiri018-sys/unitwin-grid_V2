/**
 * trendAnalyzer.js
 * Rolling-window linear regression trend analyser for UNITWIN GRID V2.
 *
 * Polls temperature from dataHistory every 2 seconds, computes the slope of
 * the last 10 readings via ordinary least squares, and raises a trend alert
 * when the slope exceeds 0.2 Â°C / sample.
 */

import { getState, setIntelligence } from '../core/state.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Number of historical samples to include in the regression window. */
const WINDOW_SIZE = 10;

/** Alert slope threshold in Â°C per sample. */
const SLOPE_THRESHOLD = 0.2;

/** Polling interval in milliseconds. */
const POLL_INTERVAL_MS = 2_000;

/** Handle for clearInterval. */
let _intervalHandle = null;

// ---------------------------------------------------------------------------
// Linear regression (OLS slope)
// ---------------------------------------------------------------------------

/**
 * Compute the OLS linear regression slope for an array of y-values sampled
 * at uniform x intervals (x = 0, 1, 2, â€¦, n-1).
 *
 * Slope = (nÂ·Î£xy âˆ’ Î£xÂ·Î£y) / (nÂ·Î£xÂ² âˆ’ (Î£x)Â²)
 *
 * @param {number[]} values  Array of numeric y-values.
 * @returns {number}         Slope in units of y per sample.
 */
function _linearSlope(values) {
  const n = values.length;
  if (n < 2) return 0;

  let sumX  = 0;
  let sumY  = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX  += i;
    sumY  += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;

  return (n * sumXY - sumX * sumY) / denom;
}

// ---------------------------------------------------------------------------
// Polling function
// ---------------------------------------------------------------------------

/**
 * Pulled every POLL_INTERVAL_MS.  Reads the last WINDOW_SIZE temperature
 * samples from dataHistory, computes the regression slope, and updates
 * intelligence with a trendAlert string or null.
 */
function _analyse() {
  const state = getState();
  const history = state.dataHistory ?? {};
  const tempHistory = Array.isArray(history.temperature) ? history.temperature : [];

  // Take the most recent WINDOW_SIZE readings
  const window = tempHistory.slice(-WINDOW_SIZE);

  if (window.length < 2) {
    // Not enough data yet â€” clear any existing alert
    setIntelligence({ trendAlert: null });
    return;
  }

  const slope = _linearSlope(window);

  let trendAlert = null;

  if (slope > SLOPE_THRESHOLD) {
    trendAlert =
      `Temperature rising steadily (+${slope.toFixed(3)} Â°C/sample). ` +
      'Possible cause: increased load. Continue monitoring.';
  }

  setIntelligence({ trendAlert });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the trend analyser.  Starts a 2-second poll loop that inspects
 * the rolling temperature history and updates the intelligence store.
 *
 * Safe to call multiple times â€” any existing interval is cleared first.
 */
export function initTrendAnalyzer() {
  if (_intervalHandle !== null) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
  }

  _intervalHandle = setInterval(_analyse, POLL_INTERVAL_MS);
  console.info('[TrendAnalyzer] Trend analyser started (2 s poll, window = 10 samples).');
}

/**
 * Stop the trend analyser poll loop.
 */
export function stopTrendAnalyzer() {
  if (_intervalHandle !== null) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
    console.info('[TrendAnalyzer] Trend analyser stopped.');
  }
}
