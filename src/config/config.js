// ============================================================
// UNITWIN GRID V2 — Central Configuration
// Physical prototype specs, sensor pin assignments, thresholds
// Firebase credentials, and display settings
// ============================================================

export const CONFIG = {

  // ── Project Identity ──────────────────────────────────────
  project: {
    name:     'UNITWIN GRID',
    version:  'V2.0',
    subtitle: 'Adaptive Digital Twin · Transformer Monitoring & Smart Grid',
    build:    'PROTOTYPE'
  },

  // ── Physical Prototype Specs ──────────────────────────────
  transformer: {
    ratedVA:        12,       // VA  (12V × 1A)
    ratedVoltage:   12,       // V  secondary DC bus
    ratedCurrent:   1.0,      // A
    maxTemperature: 85,       // °C absolute critical
    warnTemperature: 45,      // °C warning threshold
    alarmTemperature: 35,     // °C prototype alert threshold (LED triggers)
    nominalTemp:    30,       // °C ambient nominal
    loading: {
      normal:   { min: 0,  max: 50 },
      moderate: { min: 50, max: 75 },
      high:     { min: 75, max: 90 },
      critical: { min: 90, max: 100 }
    }
  },

  // ── Solar Panel ────────────────────────────────────────────
  solar: {
    ratedVoltage:  6,         // V
    ratedPower:    1.2,       // W  (6V × ~200mA small panel)
    maxCurrent:    0.3        // A
  },

  // ── EV Load Emulator (12V DC fan) ─────────────────────────
  ev: {
    label: 'EV LOAD EMULATOR',
    levels: {
      off:    { power: 0.0, label: 'OFF' },
      low:    { power: 1.2, label: 'LOW' },
      medium: { power: 3.0, label: 'MEDIUM' },
      high:   { power: 5.5, label: 'HIGH' }
    }
  },

  // ── Household Base Load ────────────────────────────────────
  household: {
    basePower: 2.4            // W  typical lamp/resistive load
  },

  // ── Health Index Weights (must total 1.0) ─────────────────
  health: {
    weights: {
      loading:     0.35,
      temperature: 0.30,
      voltage:     0.20,
      vibration:   0.15
    },
    thresholds: {
      loading:     { good: 75,  warn: 90  },
      temperature: { good: 45,  warn: 70  },
      voltage:     { good: 11,  warn: 10  },
      vibration:   { good: 0.3, warn: 0.6 }
    }
  },

  // ── Sensor Pin Assignments (Actual Hardware) ──────────────
  sensors: {
    INA219:   { type: 'DC_POWER',  bus: 'I2C_1', sda: 26, scl: 27, addr: '0x40', unit: 'W', purpose: 'Solar PV monitoring' },
    DS18B20:  { type: 'TEMP',      bus: '1-Wire', pin: 25,          unit: '°C', purpose: 'Transformer surface temperature' },
    MPU6500:  { type: 'VIBRATION', bus: 'I2C_0', sda: 21, scl: 22, addr: '0x68', unit: 'g', purpose: 'Transformer vibration analysis' },
    DHT22:    { type: 'AMBIENT',   bus: 'Digital', pin: 4,          unit: '°C/%', purpose: 'Ambient temperature & humidity' },
    SSD1306:  { type: 'DISPLAY',   bus: 'I2C_0', sda: 21, scl: 22, addr: '0x3C', purpose: 'OLED status display' },
    GREEN_LED:{ type: 'OUTPUT',    pin: 18,       purpose: 'Normal operation status indicator' },
    RED_LED:  { type: 'OUTPUT',    pin: 19,       purpose: 'Thermal overheat alert blinker' },
    // Future hardware (not yet connected):
    ZMPT101B: { type: 'AC_VOLTAGE', bus: 'ADS1115_CH1', unit: 'V',  purpose: 'Transformer AC voltage measurement', status: 'STANDBY' },
    ACS712:   { type: 'AC_CURRENT', bus: 'ADS1115_CH0', unit: 'A',  purpose: 'Transformer AC current measurement', status: 'STANDBY' },
    ADS1115:  { type: 'ADC',        bus: 'I2C_0', addr: '0x48',    purpose: '16-bit analog-to-digital converter', status: 'STANDBY' }
  },

  // ── Firebase Realtime Database ─────────────────────────────
  firebase: {
    apiKey:            'AIzaSyA08ULAtLYt_xJb6Wc-TBA8NHATIhHRgSw',
    authDomain:        'unitwin-grid.firebaseapp.com',
    databaseURL:       'https://unitwin-grid-default-rtdb.firebaseio.com',
    projectId:         'unitwin-grid',
    storageBucket:     'unitwin-grid.firebasestorage.app',
    messagingSenderId: '869635011784',
    appId:             '1:869635011784:web:480da0abc06fee11aa61fd',
    // DB path structure (matches ESP32 firmware payload)
    paths: {
      root:        'unitwin',
      transformer: 'unitwin/transformer',
      solar:       'unitwin/solar',
      ambient:     'unitwin/ambient',
      system:      'unitwin/system'
    },
    staleThresholdMs: 4000  // flag data stale if no update within 4 seconds
  },

  // ── 3D Scene Settings ──────────────────────────────────────
  scene: {
    backgroundColor: 0x060c18,
    fogColor:        0x080e1e,
    fogNear:         35,
    fogFar:          130,
    gridSize:        80,
    gridDivisions:   40,
    shadowMapSize:   2048
  },

  // ── Energy Flow Particles ──────────────────────────────────
  energyFlow: {
    particleCount: 90,
    baseSpeed:     0.007,
    speedScale:    0.003,
    minOpacity:    0.35,
    maxOpacity:    1.0
  },

  // ── Simulation ─────────────────────────────────────────────
  simulation: {
    updateIntervalMs:  500,
    noiseAmplitude:    0.04,  // ±4% realistic sensor noise
    thermalTimeConst:  120    // seconds — thermal rise lag
  },

  // ── Performance Modes ──────────────────────────────────────
  performance: {
    mode: 'AUTO',   // AUTO | HIGH | PERFORMANCE
    shadowsEnabled:     true,
    particlesEnabled:   true,
    postProcessing:     false,
    maxParticles:       90,
    chartMaxPoints:     120
  }
};

export default CONFIG;
