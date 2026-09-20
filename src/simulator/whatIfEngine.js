/**
 * whatIfEngine.js
 * Instant what-if projection engine for UNITWIN GRID V2.
 *
 * Given hypothetical load inputs, computes projected electrical, thermal,
 * health, and risk outcomes without mutating any live state.  All
 * calculations are pure functions â€” safe to call from UI sliders or modals.
 */

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
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute projected transformer metrics for a given set of hypothetical inputs.
 *
 * @param {object} params
 * @param {number} [params.evPower=0]          EV charger demand in kW.
 * @param {number} [params.solarPower=0]       Solar generation in kW.
 * @param {number} [params.householdPower=2.4] Household demand in kW.
 *
 * @returns {{
 *   totalPower:      number,  // Net transformer load in kW
 *   current:         number,  // Estimated current in kA (at 12 kV bus)
 *   loading:         number,  // Transformer loading percentage
 *   projectedTemp:   number,  // Projected oil temperature in Â°C
 *   projectedHealth: number,  // Composite health score [0â€“100]
 *   risk:            'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'
 * }}
 */
export function computeWhatIf({
  evPower       = 0,
  solarPower    = 0,
  householdPower = 2.4,
} = {}) {
  // ------------------------------------------------------------------
  // 1. Net active power the transformer must supply (kW)
  //    Solar offsets ~30 % of demand (the rest flows to export / grid).
  // ------------------------------------------------------------------
  let totalPower = householdPower + evPower - solarPower * 0.3;

  // Floor to a small positive number; the transformer always serves some
  // auxiliary load even when solar fully offsets demand.
  if (totalPower < 0) {
    totalPower = 0.5;
  }

  // ------------------------------------------------------------------
  // 2. Electrical quantities (secondary bus assumed at 12 kV)
  // ------------------------------------------------------------------
  const RATED_VOLTAGE_KV  = 12;
  const RATED_POWER_KW    = 12;   // Transformer nameplate capacity

  const current = totalPower / RATED_VOLTAGE_KV;  // kA
  const loading  = (totalPower  / RATED_POWER_KW) * 100;   // %

  // ------------------------------------------------------------------
  // 3. Thermal projection
  //    Simple linear approximation: base ambient 28 Â°C + loading contribution.
  //    Coefficient 0.12 Â°C per % loading derived from steady-state thermal model.
  // ------------------------------------------------------------------
  const projectedTemp = 28 + loading * 0.12;

  // ------------------------------------------------------------------
  // 4. Composite health score [0â€“100]
  //    Penalties applied for excess loading and elevated temperature.
  // ------------------------------------------------------------------
  const loadingPenalty = clamp(loading  - 30, 0, 70) * 0.5;
  const tempPenalty    = clamp(projectedTemp - 30, 0, 20) * 0.4;
  const projectedHealth = clamp(100 - loadingPenalty - tempPenalty, 0, 100);

  // ------------------------------------------------------------------
  // 5. Risk level
  // ------------------------------------------------------------------
  let risk;
  if (loading >= 90) {
    risk = 'CRITICAL';
  } else if (loading >= 75) {
    risk = 'HIGH';
  } else if (loading >= 50) {
    risk = 'MEDIUM';
  } else {
    risk = 'LOW';
  }

  return {
    totalPower:      parseFloat(totalPower.toFixed(3)),
    current:         parseFloat(current.toFixed(4)),
    loading:         parseFloat(loading.toFixed(2)),
    projectedTemp:   parseFloat(projectedTemp.toFixed(2)),
    projectedHealth: parseFloat(projectedHealth.toFixed(2)),
    risk,
  };
}
