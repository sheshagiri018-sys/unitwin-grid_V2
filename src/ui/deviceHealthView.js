/**
 * deviceHealthView.js — UNITWIN GRID V2
 * Drives the Device Health page: ESP32 / WiFi / Firebase connectivity status.
 */

import { subscribe } from '../core/state.js';

function el(id) { return document.getElementById(id); }

function setText(id, text) {
  const node = el(id);
  if (node) node.textContent = text ?? '—';
}

function setDeviceStatusBadge(id, online, onlineText = 'ONLINE', offlineText = 'OFFLINE') {
  const node = el(id);
  if (!node) return;
  node.textContent = online ? onlineText : offlineText;
  node.className = `device-stat-value ${online ? 'device-online' : 'device-offline'}`;
}

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

function applyState(state) {
  const conn = state.connectivity || {};

  const esp32Online = !!conn.esp32;
  const dbOnline    = !!conn.database;

  // ESP32 status
  setDeviceStatusBadge('devESP32Status', esp32Online);

  // Uptime
  setText('devUptime', formatUptime(conn.uptime || 0));

  // Packets
  setText('devPackets', (conn.packets || 0).toLocaleString());

  // Last Packet
  if (conn.lastUpdate) {
    const d = new Date(conn.lastUpdate);
    const ts = [
      String(d.getHours()).padStart(2, '0'),
      String(d.getMinutes()).padStart(2, '0'),
      String(d.getSeconds()).padStart(2, '0'),
    ].join(':');
    setText('devLastPacket', ts);

    const ageMs = Math.max(0, Date.now() - d.getTime());
    setText('devDataFreshness', ageMs.toLocaleString() + ' ms ago');
  } else {
    setText('devLastPacket', '—');
    setText('devDataFreshness', '—');
  }

  // Firebase status
  setDeviceStatusBadge('devFirebaseStatus', dbOnline, 'CONNECTED', 'DISCONNECTED');

  // System Mode
  setText('devDataMode', state.mode || 'SIMULATION');
}

export function initDeviceHealthView() {
  subscribe('*', (state) => applyState(state));
}
