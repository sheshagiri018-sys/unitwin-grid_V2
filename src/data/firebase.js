// ============================================================
// UNITWIN GRID V2 â€” Firebase Realtime Database Connector
// Modular Firebase v10 SDK â€” preserves existing DB paths
// Strict: only updates state, never overwrites with fake data
// ============================================================

import CONFIG from '../config/config.js';
import {
  setTransformerState, setSolarGeneration, setEVCharging,
  setAmbientData, setConnectivity, setMode, addAlert
} from '../core/state.js';

let _ref, _onValue, _getDatabase, _initializeApp, _getApps;
let _db = null;
let _unsubscribe = null;
let _staleTimer = null;
let _initialized = false;

// â”€â”€ Initialize Firebase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function initFirebase() {
  try {
    // Dynamic modular import to avoid bundler issues on GitHub Pages
    const appMod = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const dbMod  = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js');

    _initializeApp = appMod.initializeApp;
    _getApps       = appMod.getApps;
    _getDatabase   = dbMod.getDatabase;
    _ref           = dbMod.ref;
    _onValue       = dbMod.onValue;

    // Avoid duplicate initialization
    const app = _getApps().length > 0
      ? _getApps()[0]
      : _initializeApp(CONFIG.firebase);

    _db = _getDatabase(app);
    _initialized = true;

    console.log('[Firebase] Initialized successfully');
    setConnectivity({ database: true });
    addAlert('INFO', 'Firebase database connected', 'FIREBASE');
    return true;
  } catch (err) {
    console.warn('[Firebase] Initialization failed:', err);
    setConnectivity({ database: false });
    return false;
  }
}

// â”€â”€ Subscribe to Live Data Stream â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function subscribeToLiveData() {
  if (!_initialized || !_db) {
    console.warn('[Firebase] Not initialized â€” cannot subscribe');
    return false;
  }

  const rootRef = _ref(_db, CONFIG.firebase.paths.root);

  _unsubscribe = _onValue(rootRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      console.warn('[Firebase] Empty snapshot received');
      return;
    }

    // â”€â”€ Update transformer telemetry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (data.transformer) {
      const tx = data.transformer;
      setTransformerState({
        voltage:     parseFloat(tx.voltage)     ?? 12.0,
        current:     parseFloat(tx.current)     ?? 0.35,
        power:       parseFloat(tx.power)       ?? 4.2,
        temperature: parseFloat(tx.temperature) ?? 30.0,
        vibration:   parseFloat(tx.vibration)   ?? 0.1,
        loading:     parseFloat(tx.loading)     ?? 35.0,
        frequency:   parseFloat(tx.frequency)   ?? 50.0,
        powerFactor: parseFloat(tx.powerFactor) ?? 0.96,
        alarm:       tx.alarm === true,
        sources: {
          voltage:     'LIVE Â· ESP32',
          current:     'LIVE Â· ESP32',
          power:       'LIVE Â· ESP32',
          temperature: 'LIVE Â· DS18B20',
          vibration:   'LIVE Â· MPU6500'
        }
      });
    }

    // â”€â”€ Update solar telemetry â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (data.solar) {
      const sl = data.solar;
      setSolarGeneration({
        voltage: parseFloat(sl.voltage) ?? 0,
        current: parseFloat(sl.current) ?? 0,
        power:   parseFloat(sl.power)   ?? 0,
        status:  sl.status || 'ACTIVE',
        source:  'LIVE Â· INA219'
      });
    }

    // â”€â”€ Update ambient environment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (data.ambient) {
      setAmbientData({
        temperature: parseFloat(data.ambient.temperature) ?? 28,
        humidity:    parseFloat(data.ambient.humidity)    ?? 65,
        source:      'LIVE Â· DHT22'
      });
    }

    // â”€â”€ Update device/system status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (data.system) {
      const sys = data.system;
      const isOnline = sys.esp32 === true || sys.esp32 === 'CONNECTED';
      setConnectivity({
        esp32:        isOnline,
        sensorStream: isOnline,
        lastUpdate:   Date.now(),
        packets:      parseInt(sys.packets)  ?? 0,
        uptime:       parseInt(sys.uptime)   ?? 0
      });
    }

    // Switch app to LIVE mode
    setMode('LIVE');

    // Reset stale timer
    _resetStaleTimer();

  }, (error) => {
    console.error('[Firebase] Listener error:', error);
    setConnectivity({ esp32: false, database: false, sensorStream: false });
    addAlert('WARNING', 'Firebase connection lost. Falling back to simulation.', 'FIREBASE');
    setMode('SIMULATION');
  });

  console.log('[Firebase] Live subscription active');
  return true;
}

// â”€â”€ Data Freshness Watchdog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _resetStaleTimer() {
  if (_staleTimer) clearTimeout(_staleTimer);
  _staleTimer = setTimeout(() => {
    console.warn('[Firebase] Data stream stale â€” no update in 4s');
    setConnectivity({ esp32: false, sensorStream: false });
    addAlert('WARNING', 'Data stream stale. ESP32 may be offline.', 'FIREBASE');
    setMode('SIMULATION');
  }, CONFIG.firebase.staleThresholdMs);
}

// â”€â”€ Disconnect â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function disconnectFirebase() {
  if (_unsubscribe) {
    _unsubscribe();
    _unsubscribe = null;
  }
  if (_staleTimer) {
    clearTimeout(_staleTimer);
    _staleTimer = null;
  }
  setConnectivity({ esp32: false, database: false, sensorStream: false });
}
