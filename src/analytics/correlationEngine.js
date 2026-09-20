/**
 * correlationEngine.js â€” UNITWIN GRID V2
 * Pearson correlation coefficient computation and labeling for analytics panel.
 */

// ---------------------------------------------------------------------------
// Core math
// ---------------------------------------------------------------------------

/**
 * Compute Pearson correlation coefficient between two numeric arrays.
 * Returns NaN if arrays are empty, lengths differ, or variance is zero.
 * @param {number[]} xArr
 * @param {number[]} yArr
 * @returns {number}  r in [-1, 1]
 */
export function computeCorrelation(xArr, yArr) {
  if (!Array.isArray(xArr) || !Array.isArray(yArr)) return NaN;
  const n = Math.min(xArr.length, yArr.length);
  if (n < 2) return NaN;

  const xs = xArr.slice(0, n);
  const ys = yArr.slice(0, n);

  const meanX = xs.reduce((a, v) => a + v, 0) / n;
  const meanY = ys.reduce((a, v) => a + v, 0) / n;

  let cov = 0, varX = 0, varY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    cov  += dx * dy;
    varX += dx * dx;
    varY += dy * dy;
  }

  if (varX === 0 || varY === 0) return NaN;

  // Clamp to [-1, 1] to avoid floating-point drift
  return Math.max(-1, Math.min(1, cov / Math.sqrt(varX * varY)));
}

// ---------------------------------------------------------------------------
// Labeling
// ---------------------------------------------------------------------------

/**
 * Convert a Pearson r value to a human-readable label.
 * @param {number} r
 * @returns {string}
 */
export function getCorrelationLabel(r) {
  if (isNaN(r)) return 'Insufficient Data';
  const abs = Math.abs(r);

  if (r >= 0) {
    if (abs >= 0.70) return 'Strong Positive';
    if (abs >= 0.40) return 'Moderate';
    if (abs >= 0.10) return 'Weak';
    return 'None';
  }

  // Negative branch
  if (abs >= 0.70) return 'Strong Negative';
  if (abs >= 0.40) return 'Moderate Negative';
  if (abs >= 0.10) return 'Weak Negative';
  return 'None';
}

// ---------------------------------------------------------------------------
// Series extraction
// ---------------------------------------------------------------------------

/**
 * Extract a numeric array from dataHistory by dot-notation key path.
 * e.g. 'loads.ev.power' â†’ entry.loads.ev.power
 * @param {object[]} history
 * @param {string}   keyPath
 * @returns {number[]}
 */
function extractSeries(history, keyPath) {
  const keys = keyPath.split('.');
  return history.reduce((acc, entry) => {
    let val = entry;
    for (const k of keys) {
      if (val == null) { val = null; break; }
      val = val[k];
    }
    if (typeof val === 'number') acc.push(val);
    return acc;
  }, []);
}

// ---------------------------------------------------------------------------
// High-level analysis
// ---------------------------------------------------------------------------

/**
 * Analyse four key variable pairs from state.dataHistory.
 * @param {object} state  Full application state snapshot
 * @returns {{ pair: string, r: number, label: string }[]}
 */
export function analyzeCorrelations(state) {
  const history = Array.isArray(state.dataHistory) ? state.dataHistory : [];

  const pairs = [
    { pair: 'EV Load vs Loading %',       xPath: 'loads.ev.power',       yPath: 'loading.percentage'  },
    { pair: 'Loading % vs Temperature',   xPath: 'loading.percentage',   yPath: 'sensors.temperature' },
    { pair: 'Solar Output vs Loading %',  xPath: 'solar.power',          yPath: 'loading.percentage'  },
    { pair: 'Vibration vs Current',       xPath: 'sensors.vibration',    yPath: 'sensors.current'     },
  ];

  return pairs.map(({ pair, xPath, yPath }) => {
    const xArr   = extractSeries(history, xPath);
    const yArr   = extractSeries(history, yPath);
    const minLen = Math.min(xArr.length, yArr.length);
    const r      = computeCorrelation(xArr.slice(-minLen), yArr.slice(-minLen));
    const rSafe  = isNaN(r) ? 0 : parseFloat(r.toFixed(4));
    return { pair, r: rSafe, label: getCorrelationLabel(r) };
  });
}
