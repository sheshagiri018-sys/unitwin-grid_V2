// ============================================================
// UNITWIN GRID V2 — Application Bootloader & Lifecycle Orchestrator
// Initializes all systems in the correct order.
// ============================================================

import CONFIG from './config/config.js';

// ── Core ──────────────────────────────────────────────────────
import {
  subscribe, addAlert, setMode, getState, setForecast
} from './core/state.js';

// ── Data ──────────────────────────────────────────────────────
import { initSimulation, setSimulationScenario,
         setSimulationEVLevel, setSimulationSolar,
         setSimulationHousehold } from './data/simulationEngine.js';
import { initFirebase, subscribeToLiveData } from './data/firebase.js';

// ── Intelligence ──────────────────────────────────────────────
import { initHealthEngine }    from './intelligence/healthIndex.js';
import { initRuleEngine }      from './intelligence/ruleEngine.js';
import { initTrendAnalyzer }   from './intelligence/trendAnalyzer.js';
import { initForecastEngine }  from './intelligence/forecastEngine.js';

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
import { initCharts } from './analytics/charts.js';

// ── 3D Twin ───────────────────────────────────────────────────
import { initScene }              from './twin/scene.js';
import { buildTransformer }       from './twin/transformer.js';
import { buildSolarArray }        from './twin/solarArray.js';
import { buildEVCharger }         from './twin/evCharger.js';
import { buildHousehold }         from './twin/household.js';
import { buildEnergyFlow }        from './twin/energyFlow.js';
import { buildSensorHotspots, setSensorHotspotsVisible } from './twin/sensorHotspots.js';
import { initInspector }          from './twin/inspector.js';
import { toggleExplodedView }     from './twin/explodedView.js';
import { moveTo, setCameraLabel } from './twin/cameraManager.js';
import { setTwinViewMode }        from './core/state.js';

// ── Simulator ─────────────────────────────────────────────────
import { activateScenario } from './simulator/scenarioManager.js';
import { computeWhatIf }    from './simulator/whatIfEngine.js';

// ──────────────────────────────────────────────────────────────
// NOTE: environment.js is loaded dynamically INSIDE boot() to avoid
// top-level await which would block the entire module from loading.
// ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'loadStep1', label: 'Initializing 3D visualization engine'   },
  { id: 'loadStep2', label: 'Building transformer digital twin'        },
  { id: 'loadStep3', label: 'Connecting to Firebase Realtime Database' },
  { id: 'loadStep4', label: 'Activating sensor data stream'           },
  { id: 'loadStep5', label: 'Synchronizing digital twin'              }
];

function _setLoadStep(idx) {
  const max = Math.min(idx, STEPS.length - 1);
  for (let i = 0; i <= max; i++) {
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

  // ── Camera preset buttons ────────────────────────────────
  document.querySelectorAll('[data-camera]').forEach(btn => {
    btn.addEventListener('click', () => moveTo(btn.dataset.camera));
  });

  // ── View mode buttons ─────────────────────────────────────
  document.querySelectorAll('[data-view-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.viewMode;
      document.querySelectorAll('[data-view-mode]').forEach(b => b.classList.remove('active'));
      document.querySelectorAll(`[data-view-mode="${mode}"]`).forEach(b => b.classList.add('active'));
      setTwinViewMode(mode);
      setSensorHotspotsVisible(mode === 'SENSOR');
      // Auto-trigger EXPLODED view when clicking EXPLODE button
      if (mode === 'EXPLODED') {
        const btn2 = document.getElementById('explodedViewBtn');
        if (btn2 && btn2.textContent.includes('💥')) btn2.click();
      }
    });
  });

  // ── Exploded view button ──────────────────────────────────
  const explodedBtn = document.getElementById('explodedViewBtn');
  if (explodedBtn) {
    explodedBtn.addEventListener('click', () => {
      const isExploded = toggleExplodedView();
      explodedBtn.textContent = isExploded ? '🔧 REASSEMBLE' : '💥 EXPLODED';
      explodedBtn.classList.toggle('active', isExploded);
    });
  }

  // ── Header demo button ────────────────────────────────────
  const demoBtn = document.getElementById('demoStartBtn');
  if (demoBtn) demoBtn.addEventListener('click', () => navigateTo('scenarios'));

  // ── System reset ──────────────────────────────────────────
  const resetBtn = document.getElementById('resetSystemBtn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activateScenario('NORMAL');
      addAlert('INFO', 'System reset to normal operation.', 'SYSTEM');
    });
  }

  // ── Report generator ─────────────────────────────────────
  const reportBtn = document.getElementById('generateReportBtn');
  if (reportBtn) reportBtn.addEventListener('click', _generateReport);

  // ── Quick scenario buttons (dashboard left panel) ─────────
  document.querySelectorAll('[data-scenario]').forEach(btn => {
    btn.addEventListener('click', () => {
      const scenario = btn.dataset.scenario;
      activateScenario(scenario);
      document.querySelectorAll('[data-scenario]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Flash banner
      _showScenarioBanner(scenario);
    });
  });

  // ── Scenario page buttons ─────────────────────────────────
  document.querySelectorAll('[data-activate-scenario]').forEach(btn => {
    btn.addEventListener('click', () => {
      const scenario = btn.dataset.activateScenario;
      activateScenario(scenario);
      document.querySelectorAll('[data-activate-scenario]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _showScenarioBanner(scenario);
    });
  });

  // ── What-If sliders ───────────────────────────────────────
  // Sliders represent kW (not W). Labels show kW.
  const wiEV    = document.getElementById('wiEV');
  const wiSolar = document.getElementById('wiSolar');
  const wiHH    = document.getElementById('wiHH');

  function _updateWhatIf() {
    if (!wiEV || !wiSolar || !wiHH) return;
    const evKW    = parseFloat(wiEV.value);
    const solarKW = parseFloat(wiSolar.value);
    const hhKW    = parseFloat(wiHH.value);

    // Update display labels
    const evLabel    = document.getElementById('wiEVLabel');
    const solarLabel = document.getElementById('wiSolarLabel');
    const hhLabel    = document.getElementById('wiHHLabel');
    if (evLabel)    evLabel.textContent    = evKW.toFixed(1) + ' kW';
    if (solarLabel) solarLabel.textContent = solarKW.toFixed(2) + ' kW';
    if (hhLabel)    hhLabel.textContent    = hhKW.toFixed(1) + ' kW';

    // Compute projection (whatIfEngine expects kW)
    const proj = computeWhatIf({ evPower: evKW, solarPower: solarKW, householdPower: hhKW });

    // Update output fields
    const totalPowerEl = document.getElementById('wiTotalPower');
    const loadingEl    = document.getElementById('wiLoading');
    const tempEl       = document.getElementById('wiTemp');
    const healthEl     = document.getElementById('wiHealth');
    const riskEl       = document.getElementById('wiRisk');

    if (totalPowerEl) totalPowerEl.textContent = proj.totalPower.toFixed(2) + ' kW';
    if (loadingEl)    loadingEl.textContent    = proj.loading.toFixed(1) + '%';
    if (tempEl)       tempEl.textContent       = proj.projectedTemp.toFixed(1) + ' °C';
    if (healthEl)     healthEl.textContent     = proj.projectedHealth.toFixed(0) + '%';
    if (riskEl) {
      riskEl.textContent = proj.risk;
      riskEl.className   = 'state-badge ' + (
        proj.risk === 'CRITICAL' ? 'state-critical' :
        proj.risk === 'HIGH'     ? 'state-warning'  : 'state-normal'
      );
    }

    // Wire EV slider to simulation engine for live 3D feedback
    const evLevels = [
      { max: 0.1, level: 'off' },
      { max: 4.0, level: 'low' },
      { max: 8.0, level: 'medium' },
      { max: Infinity, level: 'high' }
    ];
    const evLevelEntry = evLevels.find(l => evKW <= l.max) || evLevels[evLevels.length - 1];
    setSimulationEVLevel(evLevelEntry.level);
    setSimulationSolar(solarKW > 0.1);
    setSimulationHousehold(hhKW > 0.1);
  }

  [wiEV, wiSolar, wiHH].forEach(el => {
    if (el) el.addEventListener('input', _updateWhatIf);
  });
  _updateWhatIf();

  // ── Settings: data mode toggle ────────────────────────────
  const liveToggle = document.getElementById('liveModeToggle');
  if (liveToggle) {
    liveToggle.addEventListener('change', async () => {
      if (liveToggle.checked) {
        setMode('LIVE');
        addAlert('INFO', 'Switched to LIVE Firebase mode. Waiting for ESP32 data.', 'SETTINGS');
        try {
          await initFirebase();
          subscribeToLiveData();
        } catch (e) {
          addAlert('WARNING', 'Firebase connection failed. Reverting to simulation.', 'SETTINGS');
          setMode('SIMULATION');
          liveToggle.checked = false;
        }
      } else {
        setMode('SIMULATION');
        addAlert('INFO', 'Switched to SIMULATION mode.', 'SETTINGS');
        initSimulation();
      }
    });
  }

  // ── Keyboard shortcuts ─────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const key = e.key.toLowerCase();
    const shortcuts = {
      d: 'dashboard', a: 'analytics', s: 'scenarios',
      e: 'energyflow', w: 'whatif', m: 'monitoring',
      i: 'intelligence', r: 'alerts', h: 'devicehealth'
    };
    if (shortcuts[key]) navigateTo(shortcuts[key]);
    if (key === 'x') {
      const isExploded = toggleExplodedView();
      const btn = document.getElementById('explodedViewBtn');
      if (btn) {
        btn.textContent = isExploded ? '🔧 REASSEMBLE' : '💥 EXPLODED';
        btn.classList.toggle('active', isExploded);
      }
    }
    if (key === 'escape') {
      const hud = document.getElementById('inspectorHUD');
      if (hud) hud.style.display = 'none';
    }
    if (key === 't') {
      // Toggle thermal view
      const currentMode = getState().twin.viewMode;
      const nextMode = currentMode === 'THERMAL' ? 'STANDARD' : 'THERMAL';
      setTwinViewMode(nextMode);
      document.querySelectorAll('[data-view-mode]').forEach(b => {
        b.classList.toggle('active', b.dataset.viewMode === nextMode);
      });
    }
  });
}

// ── Scenario banner flash ──────────────────────────────────────
function _showScenarioBanner(scenarioName) {
  // Find or create banner element
  let banner = document.getElementById('scenarioBanner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'scenarioBanner';
    banner.style.cssText = `
      position:fixed;top:64px;left:50%;transform:translateX(-50%);
      background:rgba(0,30,50,0.95);border:1px solid var(--accent-cyan);
      color:var(--accent-cyan);font-family:var(--font-mono);font-size:0.75rem;
      padding:0.5rem 1.4rem;border-radius:4px;z-index:999;
      opacity:0;transition:opacity 0.3s ease;pointer-events:none;
      letter-spacing:0.08em;
    `;
    document.body.appendChild(banner);
  }
  banner.textContent = `▶ SCENARIO: ${scenarioName.replace(/_/g, ' ')}`;
  banner.style.opacity = '1';
  clearTimeout(banner._hideTimer);
  banner._hideTimer = setTimeout(() => { banner.style.opacity = '0'; }, 2200);
}

// ── Report generator ──────────────────────────────────────────
function _generateReport() {
  const state = getState();
  const tx    = state.transformer;
  const now   = new Date().toLocaleString();
  const reportContent = document.getElementById('reportContent');
  if (!reportContent) return;

  const pred = state.predicted;
  const predSection = pred && pred.loading !== null ? `
    <tr><td colspan="2" style="padding:12px 0 4px;color:var(--accent-cyan);font-weight:600;">PROTOTYPE FORECAST (Linear Extrapolation)</td></tr>
    <tr><td style="padding:4px 0;color:var(--text-dim);">Predicted Loading</td><td style="color:var(--text-primary);">${pred.loading?.toFixed(1) ?? '—'}%</td></tr>
    <tr><td style="padding:4px 0;color:var(--text-dim);">Predicted Temperature</td><td style="color:var(--text-primary);">${pred.temperature?.toFixed(1) ?? '—'} °C</td></tr>
    <tr><td style="padding:4px 0;color:var(--text-dim);">Forecast Risk</td><td style="color:var(--accent-${pred.risk==='CRITICAL'?'red':pred.risk==='HIGH'?'amber':'green'});">${pred.risk}</td></tr>
    <tr><td style="padding:4px 0;color:var(--text-dim);">Recommendation</td><td style="color:var(--text-secondary);max-width:300px;">${pred.recommendation ?? '—'}</td></tr>
  ` : '';

  reportContent.innerHTML = `
    <div style="font-family:var(--font-mono);font-size:0.78rem;line-height:2;color:var(--text-secondary);">
      <div style="color:var(--accent-cyan);font-size:1.1rem;font-weight:700;margin-bottom:1rem;">
        UNITWIN GRID V2 — Engineering Session Report
      </div>
      <div style="color:var(--text-dim);margin-bottom:1rem;">
        Generated: ${now} &nbsp;·&nbsp; Mode: <span style="color:${state.mode==='LIVE'?'#00ff44':'#44aaff'}">${state.mode}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td colspan="2" style="padding:8px 0 4px;color:var(--accent-cyan);font-weight:600;">ELECTRICAL</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Voltage</td><td style="color:var(--text-primary);">${tx.voltage.toFixed(2)} V</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Current</td><td style="color:var(--text-primary);">${tx.current.toFixed(3)} A</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Active Power</td><td style="color:var(--accent-cyan);">${tx.power.toFixed(2)} kW</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Loading</td><td style="color:var(--accent-cyan);">${tx.loading.toFixed(1)}%</td></tr>
        <tr><td colspan="2" style="padding:8px 0 4px;color:var(--accent-cyan);font-weight:600;">THERMAL & MECHANICAL</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Surface Temperature</td><td style="color:${tx.temperature >= 35 ? 'var(--accent-red)' : 'var(--text-primary)'};">${tx.temperature.toFixed(1)} °C</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Vibration (RMS)</td><td style="color:var(--text-primary);">${tx.vibration.toFixed(3)} mm/s</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">TX Alarm (≥35°C)</td><td style="color:${tx.alarm ? 'var(--accent-red)' : 'var(--accent-green)'};">${tx.alarm ? 'TRIGGERED' : 'NORMAL'}</td></tr>
        <tr><td colspan="2" style="padding:8px 0 4px;color:var(--accent-cyan);font-weight:600;">ENERGY SOURCES</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Solar Generation</td><td style="color:#ffee00;">${(state.solar.power / 1000).toFixed(3)} kW (${state.solar.status})</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">EV Load</td><td style="color:#aa44ff;">${state.ev.power.toFixed(2)} kW (${state.ev.status})</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Household Load</td><td style="color:#44ff88;">${state.household.power.toFixed(2)} kW</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Ambient Temperature</td><td style="color:var(--text-primary);">${state.ambient.temperature.toFixed(1)} °C</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Humidity</td><td style="color:var(--text-primary);">${state.ambient.humidity.toFixed(0)}%</td></tr>
        <tr><td colspan="2" style="padding:8px 0 4px;color:var(--accent-cyan);font-weight:600;">HEALTH INDEX (PROTOTYPE)</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Health Score</td><td style="color:var(--accent-green);">${state.health.score}% — ${state.health.label}</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Intelligence State</td><td style="color:var(--text-primary);">${state.intelligence.state ?? '—'}</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Active Alerts</td><td style="color:var(--text-primary);">${state.alerts.filter(a => a.status === 'ACTIVE').length}</td></tr>
        <tr><td style="padding:4px 0;color:var(--text-dim);">Recommendation</td><td style="color:var(--text-secondary);max-width:300px;">${state.intelligence.recommendation ?? '—'}</td></tr>
        ${predSection}
      </table>
      <div style="margin-top:1rem;border-top:1px solid var(--border);padding-top:0.75rem;color:var(--text-dim);font-size:0.65rem;">
        DISCLAIMER: This is a prototype monitoring system built for academic/research purposes.<br>
        Data is for demonstration only. NOT for use in actual power system operations.<br>
        Forecast is linear extrapolation — not validated ML or AI.
      </div>
    </div>`;
}

// ── Boot sequence ──────────────────────────────────────────────
async function boot() {
  console.log(`[UNITWIN GRID V2] Booting — ${CONFIG.project.name} ${CONFIG.project.version}`);

  // ── Step 1: Navigation & UI views ───────────────────────
  initNavigation();
  try { initDashboardView(); }    catch(e) { console.warn('dashboardView:', e); }
  try { initMonitoringView(); }   catch(e) { console.warn('monitoringView:', e); }
  try { initEnergyFlowView(); }   catch(e) { console.warn('energyFlowView:', e); }
  try { initAnalyticsView(); }    catch(e) { console.warn('analyticsView:', e); }
  try { initIntelligenceView(); } catch(e) { console.warn('intelligenceView:', e); }
  try { initDeviceHealthView(); } catch(e) { console.warn('deviceHealthView:', e); }
  try { initAlertsView(); }       catch(e) { console.warn('alertsView:', e); }
  try { initSettingsView(); }     catch(e) { console.warn('settingsView:', e); }
  try { initScenarioView(); }     catch(e) { console.warn('scenarioView:', e); }
  _setLoadStep(0);

  // ── Step 2: 3D Scene ────────────────────────────────────
  const container = document.getElementById('threeContainer');
  if (container) {
    initScene(container);
    try { buildTransformer(); }    catch(e) { console.warn('transformer:', e); }
    try { buildSolarArray(); }     catch(e) { console.warn('solarArray:', e); }
    try { buildEVCharger(); }      catch(e) { console.warn('evCharger:', e); }
    try { buildHousehold(); }      catch(e) { console.warn('household:', e); }

    // Load environment dynamically inside boot() — safe to use await here
    try {
      const envModule = await import('./twin/environment.js');
      if (envModule.buildEnvironment) envModule.buildEnvironment();
    } catch(e) { console.info('[boot] environment.js skipped:', e.message); }

    try { buildEnergyFlow(); }     catch(e) { console.warn('energyFlow:', e); }
    try { buildSensorHotspots(); } catch(e) { console.warn('sensorHotspots:', e); }
    setSensorHotspotsVisible(false);
    try { initInspector(); }       catch(e) { console.warn('inspector:', e); }
    setCameraLabel('overview');
    _setLoadStep(1);
  }

  // ── Step 3: Charts ──────────────────────────────────────
  try { initCharts(); } catch(e) { console.warn('[boot] Charts:', e); }

  // ── Step 4: Intelligence engines ────────────────────────
  try { initHealthEngine(); }    catch(e) { console.warn('healthEngine:', e); }
  try { initRuleEngine(); }      catch(e) { console.warn('ruleEngine:', e); }
  try { initTrendAnalyzer(); }   catch(e) { console.warn('trendAnalyzer:', e); }
  try { initForecastEngine(); }  catch(e) { console.warn('forecastEngine:', e); }

  // ── Step 5: Start simulation ─────────────────────────────
  initSimulation();
  setMode('SIMULATION');
  _setLoadStep(2);

  // ── Step 6: Wire DOM controls ────────────────────────────
  _initDOMControls();

  // ── Step 7: Subscribe to state for header UI updates ─────
  subscribe('connectivity', (state) => {
    const c = state.connectivity;
    const _dot = (id, on) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.className = 'conn-dot ' + (on ? 'conn-on' : 'conn-off');
    };
    _dot('connESP32',    c.esp32);
    _dot('connDatabase', c.database);
    _dot('connSensor',   c.sensorStream);
    _dot('connTwin',     true);
    if (c.lastUpdate) {
      const str = new Date(c.lastUpdate).toLocaleTimeString();
      const el = document.getElementById('lastUpdate');
      if (el) el.textContent = str;
    }
  });

  subscribe('*', (state) => {
    const modeEl = document.getElementById('modeIndicator');
    if (modeEl) {
      modeEl.innerHTML = state.mode === 'LIVE'
        ? '<span class="mode-live">◉ LIVE</span>'
        : '<span class="mode-sim">◉ SIMULATION</span>';
    }
    // Update 3D overlay badges
    const loadBadge = document.getElementById('txBadgeLoad');
    if (loadBadge) loadBadge.textContent = (state.transformer.loading ?? 0).toFixed(1) + '%';
    const solarBadge = document.getElementById('txBadgeSolar');
    if (solarBadge) solarBadge.textContent = (state.solar.power / 1000).toFixed(3) + ' kW';
    const evBadge = document.getElementById('txBadgeEV');
    if (evBadge) evBadge.textContent = state.ev.status;
    // Alert badge in nav
    const alertBadge = document.getElementById('alertBadge');
    if (alertBadge) {
      const active = state.alerts.filter(a => a.status === 'ACTIVE').length;
      alertBadge.textContent = active > 0 ? `(${active})` : '';
    }
  });

  // ── Step 8: Try Firebase (async, non-blocking) ───────────
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
    console.warn('[boot] Firebase:', e);
    addAlert('INFO', 'Running in offline simulation mode.', 'SYSTEM');
  }
  _setLoadStep(4);

  // ── Step 9: Done ─────────────────────────────────────────
  setTimeout(_dismissLoadingScreen, 800);
  console.log('[UNITWIN GRID V2] Boot complete ✓');
}

// Start
boot().catch(err => {
  console.error('[UNITWIN GRID V2] Boot error:', err);
  _dismissLoadingScreen();
});
