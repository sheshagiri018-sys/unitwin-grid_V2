/**
 * deviceHealthView.js â€” UNITWIN GRID V2
 * Drives the Device Health page: ESP32 / WiFi / Firebase connectivity status.
 */

import { subscribe } from '../core/state.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(id) { return document.getElementById(id); }

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text ?? 'â€”';
}

/**
 * Set a status badge to ONLINE (green) or OFFLINE (red).
 * @param {string}  id
 * @param {boolean} online
 * @param {string}  [onlineText='ONLINE']
 * @param {string}  [offlineText='OFFLINE']
 */
function setStatusBadge(id, online, onlineText = 'ONLINE', offlineText = 'OFFLINE') {
  const node = el(id);
  if (!node) return;
  node.textContent = online ? onlineText : offlineText;
  node.className   = `badge ${online ? 'badge--success' : 'badge--danger'}`;
}

/**
 * Format a duration (seconds) as HH:MM:SS.
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatUptime(totalSeconds) {
  if (totalSeconds == null || isNaN(totalSeconds) || totalSeconds < 0) return '00:00:00';
  const s = Math.floor(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [
    String(h).padStart(2, '0'),
    String(m).padStart(2, '0'),
    String(sec).padStart(2, '0'),
  ].join(':');
}

// ---------------------------------------------------------------------------
// Main state â†’ DOM application
// ---------------------------------------------------------------------------

function applyState(state) {
  const conn  = state.connectivity || {};
  const dev   = state.device       || {};

  const esp32Online    = !!conn.esp32;
  const dbOnline       = !!conn.database;
  const wifiOnline     = conn.wifi != null ? !!conn.wifi : esp32Online;
  const firebaseOnline = dbOnline;

  // â”€â”€ ESP32 status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setStatusBadge('devESP32Status', esp32Online);

  // â”€â”€ WiFi status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setStatusBadge('devWifiStatus', wifiOnline);

  // â”€â”€ RSSI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const rssi = dev.rssi ?? conn.rssi;
  setText('devRSSI', rssi != null ? rssi + ' dBm' : 'â€”');

  // â”€â”€ Uptime â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const uptimeSec = dev.uptimeSeconds ?? conn.uptimeSeconds ?? 0;
  setText('devUptime', formatUptime(uptimeSec));

  // â”€â”€ Packet count â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const packets = dev.packetCount ?? conn.packetCount;
  setText('devPackets', packets != null ? packets.toLocaleString() : 'â€”');

  // â”€â”€ Last packet timestamp â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const lastPkt = dev.lastPacket ?? conn.lastPacket ?? state.lastUpdate;
  if (lastPkt) {
    const d = new Date(lastPkt);
    const ts = [
      String(d.getHours()).padStart(2, '0'),
      String(d.getMinutes()).padStart(2, '0'),
      String(d.getSeconds()).padStart(2, '0'),
    ].join(':');
    setText('devLastPacket', ts);
  } else {
    setText('devLastPacket', 'â€”');
  }

  // â”€â”€ Firebase / DB status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setStatusBadge('devFirebaseStatus', firebaseOnline);

  // â”€â”€ Data freshness â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const refTime = state.lastUpdate ? new Date(state.lastUpdate) : null;
  if (refTime) {
    const ageMs = Date.now() - refTime.getTime();
    setText('devDataFreshness', ageMs.toLocaleString() + ' ms ago');
  } else {
    setText('devDataFreshness', 'â€”');
  }

  // â”€â”€ Sensor / twin connectivity (optional elements) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  setStatusBadge('devSensorStatus', !!conn.sensor);
  setStatusBadge('devTwinStatus',   !!conn.twin);
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

/**
 * Initialise the Device Health view.
 */
export function initDeviceHealthView() {
  subscribe('*', (state) => applyState(state));
}
