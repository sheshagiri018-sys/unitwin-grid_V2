/**
 * ruleEngine.js
 * Cause-and-effect rule evaluation engine for UNITWIN GRID V2.
 *
 * Subscribes to all state changes, evaluates threshold rules, generates
 * actionable intelligence, and raises de-duplicated alerts with a
 * 30-second cooldown window.
 */

import CONFIG from '../config/config.js';
import { subscribe, setIntelligence, addAlert } from '../core/state.js';

// ---------------------------------------------------------------------------
// Alert de-duplication
// ---------------------------------------------------------------------------

/**
 * Tracks the last time (ms) each alert key was fired.
 * Key format: `<severity>:<message-slug>`
 * @type {Map<string, number>}
 */
const _alertCooldowns = new Map();

/** Cooldown period in milliseconds (30 seconds). */
const ALERT_COOLDOWN_MS = 30_000;

/**
 * Fire an alert only if the same key has not been raised within the
 * ALERT_COOLDOWN_MS window.
 *
 * @param {'INFO'|'WARNING'|'CRITICAL'} severity
 * @param {string} message
 * @param {string} source
 */
function _fireAlert(severity, message, source) {
  const key = `${severity}:${message}`;
  const now = Date.now();
  const lastFired = _alertCooldowns.get(key) ?? 0;

  if (now - lastFired >= ALERT_COOLDOWN_MS) {
    _alertCooldowns.set(key, now);
    addAlert({ severity, message, source, timestamp: now });
  }
}

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate all threshold rules against the current state snapshot and
 * build the intelligence payload.
 *
 * @param {object} state  Full application state snapshot from the store.
 */
function _evaluateRules(state) {
  const transformer = state.transformer ?? {};
  const ev          = state.ev          ?? {};
  const solar       = state.solar       ?? {};
  const household   = state.household   ?? {};

  const loading     = transformer.loading     ?? 0;
  const temperature = transformer.temperature ?? 28;
  const voltage     = transformer.voltage     ?? 12;
  const vibration   = transformer.vibration   ?? 0;
  const evPowerKW   = ev.powerKW ?? 0;
  const ratedPowerKW = CONFIG.transformer?.ratedPower ?? 12;

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------
  let loadingState;
  let recommendation;

  if (loading >= 90) {
    loadingState    = 'OVERLOAD';
    recommendation  = 'Immediately reduce load. Critical transformer overload.';
    _fireAlert(
      'CRITICAL',
      `Transformer overload detected: ${loading.toFixed(1)}% loading.`,
      'RuleEngine'
    );
  } else if (loading >= 75) {
    loadingState   = 'HIGH LOAD';
    recommendation = 'Consider reducing EV or household load.';
  } else if (loading >= 50) {
    loadingState   = 'MODERATE';
    recommendation = 'Loading within acceptable range. Continue monitoring.';
  } else {
    loadingState   = 'NORMAL';
    recommendation = 'All parameters nominal. No action required.';
  }

  // ------------------------------------------------------------------
  // Thermal state
  // ------------------------------------------------------------------
  const alarmTemp  = CONFIG.transformer?.alarmTemperature  ?? 80;
  const warningTemp = CONFIG.transformer?.warningTemperature ?? 65;

  let thermalState;

  if (temperature >= alarmTemp) {
    thermalState = 'ALARM';
    _fireAlert(
      'WARNING',
      `Transformer temperature alarm: ${temperature.toFixed(1)} Â°C (limit ${alarmTemp} Â°C).`,
      'RuleEngine'
    );
  } else if (temperature >= warningTemp) {
    thermalState = 'WARNING';
    _fireAlert(
      'WARNING',
      `Elevated transformer temperature: ${temperature.toFixed(1)} Â°C.`,
      'RuleEngine'
    );
  } else {
    thermalState = 'NORMAL';
  }

  // ------------------------------------------------------------------
  // Vibration state
  // ------------------------------------------------------------------
  let vibrationState;

  if (vibration > 0.5) {
    vibrationState = 'ELEVATED';
    _fireAlert(
      'WARNING',
      `Elevated vibration detected: ${vibration.toFixed(3)} mm/s RMS.`,
      'RuleEngine'
    );
  } else if (vibration > 0.3) {
    vibrationState = 'MODERATE';
  } else {
    vibrationState = 'NORMAL';
  }

  // ------------------------------------------------------------------
  // Causeâ€“effect analysis
  // ------------------------------------------------------------------
  const causeEffect = [];

  if (evPowerKW > 0) {
    const evImpact = parseFloat(((evPowerKW / ratedPowerKW) * 100).toFixed(1));
    causeEffect.push({
      cause: `EV charging (${evPowerKW.toFixed(1)} kW)`,
      effect: `+${evImpact}% transformer loading, elevated temperature and vibration.`,
    });
  }

  if (solar.on && solar.powerKW > 0) {
    const solarRelief = parseFloat(((solar.powerKW * 0.3 / ratedPowerKW) * 100).toFixed(1));
    causeEffect.push({
      cause: `Solar generation (${solar.powerKW?.toFixed(1)} kW)`,
      effect: `âˆ’${solarRelief}% effective transformer loading via local offset.`,
    });
  }

  if (loading >= 75) {
    causeEffect.push({
      cause: `High cumulative demand (${loading.toFixed(1)}%)`,
      effect: 'Accelerated insulation ageing, thermal stress, reduced lifespan.',
    });
  }

  if (vibrationState === 'ELEVATED') {
    causeEffect.push({
      cause: 'Elevated mechanical vibration',
      effect: 'Risk of winding loosening, contact wear, premature failure.',
    });
  }

  if (thermalState === 'ALARM') {
    causeEffect.push({
      cause: `Temperature alarm (${temperature.toFixed(1)} Â°C)`,
      effect: 'Oil degradation accelerated. Immediate inspection required.',
    });
  }

  // ------------------------------------------------------------------
  // Publish intelligence
  // ------------------------------------------------------------------
  setIntelligence({
    loadingState,
    thermalState,
    vibrationState,
    recommendation,
    causeEffect,
    voltage: parseFloat(voltage.toFixed(3)),
    loading: parseFloat(loading.toFixed(1)),
    temperature: parseFloat(temperature.toFixed(2)),
    vibration: parseFloat(vibration.toFixed(4)),
    timestamp: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the rule engine.
 * Subscribes to all state changes and evaluates rules on every update.
 */
export function initRuleEngine() {
  subscribe('*', (state) => {
    _evaluateRules(state);
  });

  console.info('[RuleEngine] Rule engine initialised (30 s alert cooldown).');
}
