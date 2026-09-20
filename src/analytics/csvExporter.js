/**
 * csvExporter.js
 * Telemetry CSV export utility for UNITWIN GRID V2.
 *
 * Reads the complete dataHistory from the state store and triggers a
 * browser file download of a formatted CSV containing all recorded
 * transformer telemetry samples.
 */

import { getState } from '../core/state.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Filename offered to the browser download dialog. */
const DOWNLOAD_FILENAME = 'unitwin-telemetry.csv';

/** Ordered list of column definitions. */
const COLUMNS = [
  { header: 'Timestamp',   key: 'timestamp'   },
  { header: 'Voltage',     key: 'voltage'     },
  { header: 'Current',     key: 'current'     },
  { header: 'Power',       key: 'power'       },
  { header: 'Temperature', key: 'temperature' },
  { header: 'Vibration',   key: 'vibration'   },
  { header: 'Loading',     key: 'loading'     },
  { header: 'Solar',       key: 'solar'       },
  { header: 'EV',          key: 'ev'          },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Escape a single CSV field value.  Wraps in double-quotes and escapes any
 * embedded double-quote characters per RFC 4180.
 *
 * @param {unknown} value
 * @returns {string}
 */
function _escapeField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // If field contains comma, newline, or double-quote â†’ wrap in quotes
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert a Unix millisecond timestamp to an ISO-8601 string.
 * @param {number} ms
 * @returns {string}
 */
function _isoTimestamp(ms) {
  if (!ms || isNaN(ms)) return '';
  return new Date(ms).toISOString();
}

// ---------------------------------------------------------------------------
// Build CSV
// ---------------------------------------------------------------------------

/**
 * Construct the CSV string from state dataHistory.
 *
 * The dataHistory object is expected to have parallel arrays keyed by metric
 * name, where each array element represents one sample. An optional
 * `timestamps` array provides per-sample Unix ms timestamps.
 *
 * @param {object} dataHistory  State dataHistory object.
 * @returns {string}            Complete RFC 4180 CSV string.
 */
function _buildCSV(dataHistory) {
  if (!dataHistory || typeof dataHistory !== 'object') {
    // Return header-only CSV if history is empty
    return COLUMNS.map((c) => c.header).join(',') + '\r\n';
  }

  // Determine the number of rows from the longest available array
  const arrays = {
    timestamp:   dataHistory.timestamps   ?? [],
    voltage:     dataHistory.voltage      ?? [],
    current:     dataHistory.current      ?? [],
    power:       dataHistory.power        ?? [],
    temperature: dataHistory.temperature  ?? [],
    vibration:   dataHistory.vibration    ?? [],
    loading:     dataHistory.loading      ?? [],
    solar:       dataHistory.solar        ?? [],
    ev:          dataHistory.ev           ?? [],
  };

  const rowCount = Math.max(...Object.values(arrays).map((a) => a.length));

  if (rowCount === 0) {
    return COLUMNS.map((c) => c.header).join(',') + '\r\n';
  }

  // Header row
  const lines = [COLUMNS.map((c) => c.header).join(',')];

  // Data rows
  for (let i = 0; i < rowCount; i++) {
    const row = COLUMNS.map((col) => {
      if (col.key === 'timestamp') {
        return _escapeField(_isoTimestamp(arrays.timestamp[i]));
      }
      return _escapeField(arrays[col.key][i]);
    });
    lines.push(row.join(','));
  }

  return lines.join('\r\n') + '\r\n';
}

// ---------------------------------------------------------------------------
// Download trigger
// ---------------------------------------------------------------------------

/**
 * Programmatically trigger a file download in the browser.
 *
 * @param {string} csvString  The complete CSV content.
 * @param {string} filename   Suggested filename for the download dialog.
 */
function _triggerDownload(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);

  const anchor     = document.createElement('a');
  anchor.href      = url;
  anchor.download  = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  // Clean up â€” delay slightly to allow the download to initiate
  setTimeout(() => {
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }, 150);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export all recorded telemetry as a CSV file and trigger a browser download.
 *
 * Columns: Timestamp, Voltage, Current, Power, Temperature, Vibration,
 *          Loading, Solar, EV.
 *
 * @returns {number}  Number of data rows exported (0 if history empty).
 */
export function exportCSV() {
  const state = getState();
  const dataHistory = state.dataHistory ?? {};

  const csvString = _buildCSV(dataHistory);

  _triggerDownload(csvString, DOWNLOAD_FILENAME);

  // Compute and log row count for caller feedback
  const rowCount = Math.max(
    ...[
      dataHistory.timestamps,
      dataHistory.voltage,
      dataHistory.temperature,
    ]
      .filter(Array.isArray)
      .map((a) => a.length),
    0
  );

  console.info(`[CSVExporter] Exported ${rowCount} rows to "${DOWNLOAD_FILENAME}".`);
  return rowCount;
}
