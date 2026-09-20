// ============================================================
// UNITWIN GRID V2 — Application Bootloader & Lifecycle Orchestrator
// Initializes all systems in the correct order
// ============================================================

import CONFIG from './config/config.js';

// ── Core ──────────────────────────────────────────────────────
import { subscribe, addAlert, setMode, getState } from './core/state.js';

// ── Data ──────────────────────────────────────────────────────
import { initSimulation, setSimulationScenario } from './data/simulationEngine.js';
import { initFirebase, subscribeToLiveData }      from './data/firebase.js';

// ── Intelligence ──────────────────────────────────────────────
import { initHealthEngine }   from './intelligence/healthIndex.js';
import { initRuleEngine }     from './intelligence/ruleEngine.js';
import { initTrendAnalyzer }  from './intelligence/trendAnalyzer.js';

// ── UI ────────────────────────────────────────────────────────
import { initNavigation, navigateTo } from './ui/navigation.js';
import { initDashboardView }   from './ui/dashboardView.js';
import { initMonitoringView }  from './ui/monitoringView.js';
import { initEnergyFlowView }  from './ui/energyFlowView.js';
import { initAnalyticsView }   from './ui/analyticsView.js';
import { initIntelligenceView }from './ui/intelligenceView.js';
import { initDeviceHealthView }from './ui/deviceHealthView.js';
import { initAlertsView }      from './ui/alertsView.js';
import { initSettingsView }    from './ui/settingsView.js';
import { initScenarioView }    from './ui/scenarioView.js';

// ── Analytics ─────────────────────────────────────────────────
import { initCharts }  from './analytics/charts.js';

// ── 3D Twin ───────────────────────────────────────────────────
import { initScene }           from './twin/scene.js';
import { buildTransformer }    from './twin/transformer.js';
import { buildSolarArray }     from './twin/solarArray.js';
import { buildEVCharger }      from './twin/evCharger.js';
import { buildHousehold }      from './twin/household.js';
import { buildEnergyFlow }     from './twin/energyFlow.js';
import { buildSensorHotspots, setSensorHotspotsVisible } from './twin/sensorHotspots.js';
import { initInspector }       from './twin/inspector.js';
import { toggleExplodedView }  from './twin/explodedView.js';
import { moveTo, setCameraLabel } from './twin/cameraManager.js';
import { setTwinViewMode }     from './core/state.js';

// ── Simulator ─────────────────────────────────────────────────
import { activateScenario } from './simulator/scenarioManager.js';
import { computeWhatIf }    from './simulator/whatIfEngine.js';

// ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'loadStep1', label: 'Initializing 3D visualization engine'  },
  { id: 'loadStep2', label: 'Building transformer digital twin'       },
  { id: 'loadStep3', label: 'Connecting to Firebase Realtime Database'},
  { id: 'loadStep4', label: 'Activating sensor data stream'          },
  { id: 'loadStep5', label: 'Synchronizing digital twin'             }
];

function _setLoadStep(idx) {
  for (let i = 0; i <= idx; i++) {
    const el = document.getElementById(STEPS[i].id);
    if (el) el.classList.add('done');
  }
}

function _dismissLoadingScreen() {
  const ls = document.getElementById('loadingScreen');
  if (!ls) return;
  ls.style.transition = 'opacity 0.6s ease';
  ls.style.opacity = '0';
  setTimeout(() => {
    ls.style.display = 'none';
    ls.style.pointerEvents = 'none';
  }, 650);
}

// ── Wire up all interactive DOM controls ──────────────────────
function _initDOMControls() {
  // Camera preset buttons
  document.querySelectorAll('[data-camera]').forEach(btn => {
    btn.addEventListener('click', () => {
      moveTo(btn.dataset.camera);
    });
  });

  // View mode buttons (all view mode selectors)
  document.querySelectorAll('[data-view-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.viewMode;
      document.querySelectorAll('[data-view-mode]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll(`[data-view-mode="${mode}"]`).forEach(b => b.classList.add('active'));
      setTwinViewMode(mode);
      // Sensor hotspots only visible in SENSOR mode
      setSensorHotspotsVisible(mode === 'SENSOR');
    });
  });

  // Exploded view button
  const explodedBtn = document.getElementById('explodedViewBtn');
  if (explodedBtn) {
    explodedBtn.addEventListener('click', () => {
      const isExploded = toggleExplodedView();
      explodedBtn.textContent = isExploded ? '🔧 REASSEMBLE' : '💥 EXPLODED';
      explodedBtn.classList.toggle('active', isExploded);
    });
  }

  // Header demo button
  const demoBtn = document.getElementById('demoStartBtn');
  if (demoBtn) {
    demoBtn.addEventListener('click', () => navigateTo('scenarios'));
  }

  // System reset
  const resetBtn = document.getElementById('resetSystemBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activateScenario('NORMAL');
      addAlert('INFO', 'System reset to normal operation', 'SYSTEM');
    });
  }

  // Generate report button
  const reportBtn = document.getElementById('generateReportBtn');
  if (reportBtn) {
    reportBtn.addEventListener('click', _generateReport);
  }

  // What-If sliders
  const wiEV    = document.getElementById('wiEV');
  const wiSolar = document.getElementById('wiSolar');
  const wiHH    = document.getElementById('wiHH');
  function _updateWhatIf() {
    if (!wiEV || !wiSolar || !wiHH) return;
    const ev = parseFloat(wiEV.value);
    const solar = parseFloat(wiSolar.value);
    const hh = parseFloat(wiHH.value);
    document.getElementById('wiEVLabel').textContent    = ev.toFixed(1) + ' W';
    document.getElementById('wiSolarLabel').textContent = solar.toFixed(2) + ' W';
    document.getElementById('wiHHLabel').textContent    = hh.toFixed(1) + ' W';
    const proj = computeWhatIf({ evPower: ev, solarPower: solar, householdPower: hh });
    document.getElementById('wiTotalPower').textContent = proj.totalPower.toFixed(2) + ' W';
    document.getElementById('wiLoading').textContent    = proj.loading.toFixed(1) + '%';
    document.getElementById('wiTemp').textContent       = proj.projectedTemp.toFixed(1) + ' °C';
    document.getElementById('wiHealth').textContent     = proj.projectedHealth.toFixed(0) + '%';
    const riskEl = document.getElementById('wiRisk');
    riskEl.textContent = proj.risk;
    riskEl.className = 'state-badge ' + (proj.risk === 'CRITICAL' ? 'state-critical' : proj.risk === 'HIGH' ? 'state-warning' : 'state-normal');
  }
  [wiEV, wiSolar, wiHH].forEach(el => { if (el) el.addEventListener('input', _updateWhatIf); });
  _updateWhatIf();

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ignore if focused on input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const key = e.key.toLowerCase();
    const shortcuts = { d: 'dashboard', a: 'analytics', s: 'scenarios', e: 'energyflow',
                        w: 'whatif', m: 'monitoring', i: 'intelligence', r: 'alerts' };
    if (shortcuts[key]) { navigateTo(shortcuts[key]); }
    if (key === 'x') { toggleExplodedView(); }
    if (key === 'escape') {
      const hud = document.getElementById('inspectorHUD');
      if (hud) hud.style.display = 'none';
    }
  });
}

// ── Report generator ──────────────────────────────────────────
function _generateReport() {
  const state = getState();
  const tx = state.transformer;
  const now = new Date().toLocaleString();
  const reportContent = document.getElementById('reportContent');
  if (!reportContent) return;

  reportContent.innerHTML = `
    <div style="font-family:var(--font-mono);font-size:0.78rem;line-height:2;color:var(--text-secondary);">
      <div style="color:var(--accent-cyan);font-size:1.1rem;font-weight:700;margin-bottom:1rem;">
        UNITWIN GRID V2 — Engineering Report
      </div>
      <div style="color:var(--text-dim);margin-bottom:1rem;">Generated: ${now} &nbsp;·&nbsp; Mode: ${state.mode}</div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:4px 0;color:var(--text-dim);">Transformer Voltage</td><td style="color:var(--text-primary);">${tx.voltage.toFixed(2)} V</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Transformer Current</td><td style="color:var(--text-primary);">${tx.current.toFixed(3)} A</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Active Power</td><td style="color:var(--accent-cyan);">${tx.power.toFixed(2)} W</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Surface Temperature</td><td style="color:${tx.temperature >= 35 ? 'var(--accent-red)' : 'var(--text-primary)'};">${tx.temperature.toFixed(1)} °C</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Vibration (RMS)</td><td style="color:var(--text-primary);">${tx.vibration.toFixed(3)} g</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Loading</td><td style="color:var(--accent-cyan);">${tx.loading.toFixed(1)}%</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Solar Generation</td><td style="color:var(--solar-color);">${state.solar.power.toFixed(2)} W</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">EV Load</td><td style="color:var(--ev-color);">${state.ev.power.toFixed(2)} W</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Household Load</td><td style="color:var(--hh-color);">${state.household.power.toFixed(2)} W</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Health Index</td><td style="color:var(--accent-green);">${state.health.score}% — ${state.health.label}</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Ambient Temperature</td><td style="color:var(--text-primary);">${state.ambient.temperature.toFixed(1)} °C</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Humidity</td><td style="color:var(--text-primary);">${state.ambient.humidity.toFixed(0)}%</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">TX Alarm (≥35°C)</td><td style="color:${tx.alarm ? 'var(--accent-red)' : 'var(--accent-green)'};">${tx.alarm ? 'TRIGGERED' : 'NORMAL'}</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Active Alerts</td><td style="color:var(--text-primary);">${state.alerts.filter(a => a.status === 'ACTIVE').length}</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Recommendation</td><td style="color:var(--text-secondary);max-width:300px;">${state.intelligence.recommendation}</td></tr>
      </table>
      <div style="margin-top:1rem;border-top:1px solid var(--border);padding-top:0.75rem;color:var(--text-dim);font-size:0.65rem;">
        DISCLAIMER: This is a prototype monitoring system built for academic purposes.<br>
        All data is for demonstration and learning. NOT for use in actual power system operations.
      </div>
    </div>`;
}

// ── Boot sequence ──────────────────────────────────────────────
async function boot() {
  console.log(`[UNITWIN GRID V2] Booting — ${CONFIG.project.name} ${CONFIG.project.version}`);

  // ── Step 1: Navigation & UI views ──────────────────────────
  initNavigation();
  initDashboardView();
  initMonitoringView();
  initEnergyFlowView();
  initAnalyticsView();
  initIntelligenceView();
  initDeviceHealthView();
  initAlertsView();
  initSettingsView();
  initScenarioView();
  _setLoadStep(0);

  // ── Step 2: 3D Scene ────────────────────────────────────────
  const container = document.getElementById('threeContainer');
  if (container) {
    initScene(container);
    buildTransformer();
    buildSolarArray();
    buildEVCharger();
    buildHousehold();
    buildEnergyFlow();
    buildSensorHotspots();
    setSensorHotspotsVisible(false);  // hidden until SENSOR mode
    initInspector();
    setCameraLabel('overview');
    _setLoadStep(1);
  }

  // ── Step 3: Charts ──────────────────────────────────────────
  try { initCharts(); } catch(e) { console.warn('[boot] Charts init warning:', e); }

  // ── Step 4: Intelligence engines ────────────────────────────
  initHealthEngine();
  initRuleEngine();
  initTrendAnalyzer();

  // ── Step 5: Start simulation ─────────────────────────────────
  initSimulation();
  setSimulationScenario('NORMAL');
  setMode('SIMULATION');
  _setLoadStep(2);

  // ── Step 6: Wire DOM controls ────────────────────────────────
  _initDOMControls();

  // ── Step 7: Try Firebase (async, non-blocking) ───────────────
  _setLoadStep(3);
  try {
    const ok = await initFirebase();
    if (ok) {
      subscribeToLiveData();
      addAlert('INFO', 'Firebase connected. Waiting for ESP32 data stream.', 'FIREBASE');
    } else {
      addAlert('INFO', 'Firebase unavailable. Running in simulation mode.', 'SYSTEM');
    }
  } catch (e) {
    console.warn('[boot] Firebase init failed:', e);
    addAlert('INFO', 'Running in offline simulation mode.', 'SYSTEM');
  }
  _setLoadStep(4);

  // ── Step 8: Subscribe to state for header UI updates ──────────
  subscribe('connectivity', (state) => {
    const c = state.connectivity;
    const _dot = (id, on) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.className = 'conn-dot ' + (on ? 'conn-on' : 'conn-off');
    };
    _dot('connESP32',   c.esp32);
    _dot('connDatabase', c.database);
    _dot('connSensor',   c.sensorStream);
    _dot('connTwin',     true);
    _dot('connESP32b',   c.esp32);
    _dot('connDatabaseb',c.database);
    _dot('connSensorb',  c.sensorStream);
    _dot('connTwinb',    true);
    if (c.lastUpdate) {
      const str = new Date(c.lastUpdate).toLocaleTimeString();
      const el1 = document.getElementById('lastUpdate');
      const el2 = document.getElementById('lastUpdateb');
      if (el1) el1.textContent = str;
      if (el2) el2.textContent = str;
    }
  });

  subscribe('*', (state) => {
    const modeEl = document.getElementById('modeIndicator');
    if (modeEl) {
      modeEl.innerHTML = state.mode === 'LIVE'
        ? '<span class="mode-live">◉ LIVE</span>'
        : '<span class="mode-sim">◉ SIMULATION</span>';
    }
  });

  // ── Step 9: Done — dismiss loading screen ──────────────────
  _setLoadStep(5);
  setTimeout(_dismissLoadingScreen, 800);

  console.log('[UNITWIN GRID V2] Boot complete');
}

// Start
boot().catch(err => {
  console.error('[UNITWIN GRID V2] Boot error:', err);
  _dismissLoadingScreen();
});
