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
    // FIX: positional args
    addAlert(severity, message, source);
  }
}

// ---------------------------------------------------------------------------
// Rule evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate all threshold rules against the current state snapshot and
 * build the intelligence payload.
 *
 * @param {object} currentState  Full application state snapshot from the store.
 */
function _evaluateRules(currentState) {
  const transformer = currentState.transformer ?? {};
  const ev          = currentState.ev          ?? {};
  const solar       = currentState.solar       ?? {};

  const loading     = transformer.loading     ?? 0;
  const temperature = transformer.temperature ?? 28;
  const voltage     = transformer.voltage     ?? 12;
  const vibration   = transformer.vibration   ?? 0;
  
  // FIX: map EV power and solar power correctly from state
  const evPowerKW   = ev.power ?? 0;
  const ratedPowerKW = CONFIG.transformer?.ratedPower ?? 12;

  // ------------------------------------------------------------------
  // Loading state
  // ------------------------------------------------------------------
  let state;
  let recommendation;

  if (loading >= 90) {
    state    = 'OVERLOAD';
    recommendation  = 'Immediately reduce load. Critical transformer overload.';
    _fireAlert(
      'CRITICAL',
      `Transformer overload detected: ${loading.toFixed(1)}% loading.`,
      'RuleEngine'
    );
  } else if (loading >= 75) {
    state   = 'HIGH LOAD';
    recommendation = 'Consider reducing EV or household load.';
  } else if (loading >= 50) {
    state   = 'MODERATE';
    recommendation = 'Loading within acceptable range. Continue monitoring.';
  } else {
    state   = 'NORMAL';
    recommendation = 'All parameters nominal. No action required.';
  }

  // ------------------------------------------------------------------
  // Thermal state
  // ------------------------------------------------------------------
  const alarmTemp  = CONFIG.transformer?.alarmTemperature  ?? 80;
  // FIX: use warnTemperature (45) per instructions
  const warningTemp = CONFIG.transformer?.warnTemperature ?? 45;

  let thermal;

  if (temperature >= alarmTemp) {
    thermal = 'ALARM';
    _fireAlert(
      'WARNING',
      `Transformer temperature alarm: ${temperature.toFixed(1)} °C (limit ${alarmTemp} °C).`,
      'RuleEngine'
    );
  } else if (temperature >= warningTemp) {
    thermal = 'WARNING';
    _fireAlert(
      'WARNING',
      `Elevated transformer temperature: ${temperature.toFixed(1)} °C.`,
      'RuleEngine'
    );
  } else {
    thermal = 'NORMAL';
  }

  // ------------------------------------------------------------------
  // Vibration state
  // ------------------------------------------------------------------
  let vibrationStatus;

  if (vibration > 0.5) {
    vibrationStatus = 'ELEVATED';
    _fireAlert(
      'WARNING',
      `Elevated vibration detected: ${vibration.toFixed(3)} mm/s RMS.`,
      'RuleEngine'
    );
  } else if (vibration > 0.3) {
    vibrationStatus = 'MODERATE';
  } else {
    vibrationStatus = 'NORMAL';
  }

  // ------------------------------------------------------------------
  // Cause–effect analysis
  // ------------------------------------------------------------------
  const causeEffect = [];
  let evImpactStr = '+0%';

  if (evPowerKW > 0) {
    // FIX: EV impact calculation
    const evImpact = parseFloat(((evPowerKW / ratedPowerKW) * 100).toFixed(1));
    evImpactStr = `+${evImpact}%`;
    causeEffect.push({
      cause: `EV charging (${evPowerKW.toFixed(1)} kW)`,
      effect: `+${evImpact}% transformer loading, elevated temperature and vibration.`,
    });
  }

  // FIX: solar.on -> solar.status === 'ACTIVE' and solar.powerKW -> solar.power / 1000
  const solarPowerKW = (solar.power || 0) / 1000;
  if (solar.status === 'ACTIVE' && solarPowerKW > 0) {
    const solarRelief = parseFloat(((solarPowerKW * 0.3 / ratedPowerKW) * 100).toFixed(1));
    causeEffect.push({
      cause: `Solar generation (${solarPowerKW.toFixed(1)} kW)`,
      effect: `−${solarRelief}% effective transformer loading via local offset.`,
    });
  }

  if (loading >= 75) {
    causeEffect.push({
      cause: `High cumulative demand (${loading.toFixed(1)}%)`,
      effect: 'Accelerated insulation ageing, thermal stress, reduced lifespan.',
    });
  }

  if (vibrationStatus === 'ELEVATED') {
    causeEffect.push({
      cause: 'Elevated mechanical vibration',
      effect: 'Risk of winding loosening, contact wear, premature failure.',
    });
  }

  if (thermal === 'ALARM') {
    causeEffect.push({
      cause: `Temperature alarm (${temperature.toFixed(1)} °C)`,
      effect: 'Oil degradation accelerated. Immediate inspection required.',
    });
  }

  // ------------------------------------------------------------------
  // Publish intelligence
  // ------------------------------------------------------------------
  // FIX: correct field names matching state schema
  setIntelligence({
    state: state,
    thermal: thermal,
    vibration: vibrationStatus,
    evImpact: evImpactStr,
    recommendation: recommendation,
    causeEffect: causeEffect,
    trendAlert: null,
    timestamp: Date.now()
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the rule engine.
 * FIX: Subscribes to 'transformer' ONLY — NOT '*' — to prevent infinite loop.
 * setIntelligence() emits ['intelligence'] which would re-fire '*' listeners endlessly.
 */
export function initRuleEngine() {
  subscribe('transformer', (state) => {
    _evaluateRules(state);
  });

  console.info('[RuleEngine] Rule engine initialised (subscribing to transformer only, 30s cooldown).');
}
