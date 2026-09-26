/**
 * dashboardView.js — UNITWIN GRID V2
 * Subscribes to all state changes and updates all dashboard DOM elements.
 * Fixed field paths: state.transformer, state.solar, state.ev, state.household, state.health, state.predicted
 */

import { subscribe } from '../core/state.js';

function el(id) { return document.getElementById(id); }

export function animateNumber(node, value, decimals = 2) {
  if (!node) return;
  const start = parseFloat(node.textContent) || 0;
  const end   = Number(value);
  const t0    = performance.now();
  function step(ts) {
    const p    = Math.min((ts - t0) / 300, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    node.textContent = (start + (end - start) * ease).toFixed(decimals);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

export function setSourceTag(node, mode) {
  if (!node) return;
  node.className = 'src-tag ' + (mode === 'LIVE' ? 'src-live' : 'src-simulation');
  node.textContent = mode;
}

function applyState(state) {
  try {
    const tx      = state.transformer || {};
    const solar   = state.solar       || {};
    const ev      = state.ev          || {};
    const hh      = state.household   || {};
    const health  = state.health      || {};
    const intel   = state.intelligence|| {};
    const pred    = state.predicted   || {};
    const conn    = state.connectivity|| {};

    // ── Transformer telemetry ────────────────────────────────
    if (el('txVoltage')   && tx.voltage   != null) el('txVoltage').textContent   = tx.voltage.toFixed(2)   + ' V';
    if (el('txCurrent')   && tx.current   != null) el('txCurrent').textContent   = tx.current.toFixed(3)   + ' A';
    if (el('txPower')     && tx.power     != null) el('txPower').textContent     = tx.power.toFixed(2)     + ' kW';
    if (el('txTemp')      && tx.temperature!= null) el('txTemp').textContent     = tx.temperature.toFixed(1)+ ' \xb0C';
    if (el('txVibration') && tx.vibration != null) el('txVibration').textContent = tx.vibration.toFixed(3) + ' mm/s';
    if (el('txFreq')      && tx.frequency != null) el('txFreq').textContent      = tx.frequency.toFixed(1) + ' Hz';
    if (el('txPF')        && tx.powerFactor!= null) el('txPF').textContent       = tx.powerFactor.toFixed(2);

    const txStateEl = el('txState');
    if (txStateEl && tx.state) {
      txStateEl.textContent = tx.state;
      txStateEl.className = 'state-badge ' + (
        tx.state === 'CRITICAL' ? 'state-critical' :
        tx.state === 'WARNING'  ? 'state-warning'  : 'state-normal'
      );
    }
    if (el('txSource')) el('txSource').textContent = (tx.sources?.voltage) || state.mode || '\u2014';

    // ── Loading arc/ring (r=52, circumference=326.73) ────────
    const loadPct   = tx.loading || 0;
    const ARC_CIRC  = 326.73;
    const arcOffset = ARC_CIRC - (Math.min(100, Math.max(0, loadPct)) / 100) * ARC_CIRC;
    const arcEl     = el('loadingArc');
    if (arcEl) {
      arcEl.style.strokeDashoffset = arcOffset.toFixed(2);
      arcEl.style.stroke = loadPct >= 90 ? '#ff4455' :
                           loadPct >= 75 ? '#ff6600' :
                           loadPct >= 50 ? '#ffaa00' : '#00d68f';
    }
    if (el('loadingPct'))   el('loadingPct').textContent   = loadPct.toFixed(1) + '%';
    if (el('loadingValue')) el('loadingValue').textContent = loadPct.toFixed(1) + '%';
    if (el('loadingState')) el('loadingState').textContent = intel.state || '\u2014';
    if (el('loadingPct2'))  el('loadingPct2').textContent  = loadPct.toFixed(1) + '%';
    const lsb = el('loadingStateBadge');
    if (lsb) {
      lsb.textContent = intel.state || '\u2014';
      lsb.className = 'state-badge ' + (loadPct>=90?'state-critical':loadPct>=75?'state-warning':'state-normal');
    }

    // ── Bottom sparkline value labels ────────────────────────
    if (el('sensorTxVoltage')) el('sensorTxVoltage').textContent = (tx.voltage ?? 0).toFixed(2);
    if (el('sensorTxCurrent')) el('sensorTxCurrent').textContent = (tx.current ?? 0).toFixed(3);
    if (el('sensorTxPower'))   el('sensorTxPower').textContent   = (tx.power   ?? 0).toFixed(2);
    if (el('sensorTxTemp'))    el('sensorTxTemp').textContent    = (tx.temperature ?? 0).toFixed(1);
    if (el('sensorLoading'))   el('sensorLoading').textContent   = (tx.loading ?? 0).toFixed(1);

    // ── Solar ────────────────────────────────────────────────
    const solarW   = solar.power || 0;
    const solarKW  = solarW / 1000;
    const solarPct = Math.min(100, Math.max(0, (solarW / 1200) * 100));
    if (el('solarStatus'))  el('solarStatus').textContent  = solar.status || '\u2014';
    if (el('solarState'))   el('solarState').textContent   = solar.status || '\u2014';
    if (el('solarPower'))   el('solarPower').textContent   = solarKW.toFixed(3) + ' kW';
    if (el('solarVoltage')) el('solarVoltage').textContent = (solar.voltage ?? 0).toFixed(2) + ' V';
    if (el('solarCurrent')) el('solarCurrent').textContent = (solar.current ?? 0).toFixed(3) + ' A';
    if (el('solarBar'))     el('solarBar').style.width     = solarPct.toFixed(1) + '%';

    // ── EV ───────────────────────────────────────────────────
    const evBadge = el('evStatusBadge');
    if (evBadge) {
      evBadge.textContent = ev.status || '\u2014';
      evBadge.className   = ev.status === 'CHARGING' ? 'status-pill pill-active' : 'status-pill pill-idle';
    }
    if (el('evPower')) el('evPower').textContent = (ev.power ?? 0).toFixed(2) + ' kW';
    if (el('evMode'))  el('evMode').textContent  = ev.mode || ev.level || '\u2014';
    const batt = typeof ev.battery === 'number' ? ev.battery : 62;
    if (el('battBar')) el('battBar').style.width = Math.min(100, batt).toFixed(0) + '%';
    if (el('battPct')) el('battPct').textContent = batt + '%';

    // ── Household ────────────────────────────────────────────
    const hhBadge = el('hhStatusBadge');
    if (hhBadge) hhBadge.textContent = hh.status || 'ON';
    if (el('hhPower')) el('hhPower').textContent = (hh.power ?? 0).toFixed(2) + ' kW';

    // ── Energy flow diagram (page-energyflow) ────────────────
    if (el('flowSolarW'))  el('flowSolarW').textContent  = solarKW.toFixed(3) + ' kW';
    if (el('flowTxLoad'))  el('flowTxLoad').textContent  = 'Loading: ' + loadPct.toFixed(1) + '%';
    if (el('flowHHW'))     el('flowHHW').textContent     = (hh.power ?? 0).toFixed(2) + ' kW';
    if (el('flowEVW'))     el('flowEVW').textContent     = (ev.power ?? 0).toFixed(2) + ' kW';

    // ── Health ring (id='healthScoreRing', r=44, circ=276.46) ─
    const hScore  = health.score || 0;
    const H_CIRC  = 276.46;
    const hOffset = H_CIRC - (Math.min(100, Math.max(0, hScore)) / 100) * H_CIRC;
    const hRing   = el('healthScoreRing') || el('healthRing');
    if (hRing) {
      hRing.style.strokeDashoffset = hOffset.toFixed(2);
      hRing.style.stroke = hScore>=85?'#00d68f':hScore>=70?'#ffaa00':hScore>=50?'#ff6600':'#ff4455';
    }
    if (el('healthScore')) el('healthScore').textContent = hScore.toFixed(0);
    if (el('healthLabel')) el('healthLabel').textContent = health.label || '\u2014';

    // Factor bars
    const FACTORS = [
      ['factor_loading',     'factorLabel_loading',     health.factors?.loading],
      ['factor_temperature', 'factorLabel_temperature', health.factors?.temperature],
      ['factor_voltage',     'factorLabel_voltage',     health.factors?.voltage],
      ['factor_vibration',   'factorLabel_vibration',   health.factors?.vibration]
    ];
    FACTORS.forEach(([barId, lblId, f]) => {
      const bar = el(barId); const lbl = el(lblId);
      if (bar && f) {
        bar.style.width = Math.min(100, f.score||0).toFixed(1) + '%';
        bar.style.background = (f.score||0)>=85?'var(--accent-green)':(f.score||0)>=70?'var(--accent-amber)':'var(--accent-red)';
      }
      if (lbl && f) lbl.textContent = f.label || '\u2014';
    });

    // ── Intelligence ─────────────────────────────────────────
    if (el('intelState'))           el('intelState').textContent           = intel.state           || '\u2014';
    if (el('intelThermal'))         el('intelThermal').textContent         = intel.thermal         || '\u2014';
    if (el('intelVibration'))       el('intelVibration').textContent       = intel.vibration       || '\u2014';
    if (el('intelEVImpact'))        el('intelEVImpact').textContent        = intel.evImpact        || '\u2014';
    if (el('intelRec'))             el('intelRec').textContent             = intel.recommendation  || '\u2014';
    if (el('intelRecommendation'))  el('intelRecommendation').textContent  = intel.recommendation  || '\u2014';
    const causeList = el('causeEffectList');
    if (causeList && Array.isArray(intel.causeEffect)) {
      causeList.innerHTML = intel.causeEffect.length === 0
        ? '<li style="color:var(--text-dim);font-size:0.7rem;">No active cause-effect factors.</li>'
        : intel.causeEffect.map(item =>
            `<li><span style="color:var(--accent-amber);">${item.cause ?? item}</span>` +
            (item.effect ? `<br><span style="color:var(--text-dim);font-size:0.68rem;">&#x2192; ${item.effect}</span>` : '') +
            `</li>`).join('');
    }

    // ── Monitoring page sensors ───────────────────────────────
    if (el('sensorTxTemp2'))       el('sensorTxTemp2').textContent       = (tx.temperature??0).toFixed(1);
    if (el('sensorVibration2'))    el('sensorVibration2').textContent    = (tx.vibration??0).toFixed(3);
    if (el('sensorSolarVoltage2')) el('sensorSolarVoltage2').textContent = (solar.voltage??0).toFixed(2);
    if (el('sensorSolarCurrent2')) el('sensorSolarCurrent2').textContent = (solar.current??0).toFixed(3);
    if (el('sensorSolarPower2'))   el('sensorSolarPower2').textContent   = solarW.toFixed(2);
    if (el('sensorAmbTemp2'))      el('sensorAmbTemp2').textContent      = (state.ambient?.temperature??0).toFixed(1);
    if (el('sensorHumidity2'))     el('sensorHumidity2').textContent     = (state.ambient?.humidity??0).toFixed(0);
    if (el('sensorTxVoltage2'))    el('sensorTxVoltage2').textContent    = (tx.voltage??0).toFixed(2);
    if (el('sensorTxCurrent2'))    el('sensorTxCurrent2').textContent    = (tx.current??0).toFixed(3);
    if (el('sensorTxPower2'))      el('sensorTxPower2').textContent      = (tx.power??0).toFixed(2);
    if (el('sensorEVLoad2'))       el('sensorEVLoad2').textContent       = (ev.power??0).toFixed(2);
    if (el('sensorHHLoad2'))       el('sensorHHLoad2').textContent       = (hh.power??0).toFixed(2);

    // ── Forecast / Prediction panel ───────────────────────────
    if (el('predictLoading'))      el('predictLoading').textContent      = pred.loading!=null      ? pred.loading.toFixed(1)+'%'     : '\u2014';
    if (el('predictTemp'))         el('predictTemp').textContent         = pred.temperature!=null  ? pred.temperature.toFixed(1)+' \xb0C' : '\u2014';
    if (el('predictRec'))          el('predictRec').textContent          = pred.recommendation     || 'Collecting measurements\u2026';
    if (el('predictRecommendation')) el('predictRecommendation').textContent = pred.recommendation || '';
    if (el('predictTimeThreshold')) {
      const ttt = pred.timeToThreshold;
      if (ttt == null)  el('predictTimeThreshold').textContent = '\u2014';
      else if (ttt===0) el('predictTimeThreshold').textContent = 'NOW';
      else {
        const m = Math.floor(ttt/60), s = ttt % 60;
        el('predictTimeThreshold').textContent = m>0 ? `${m}m ${s}s` : `${s}s`;
      }
    }
    const riskBadge = el('predictRiskBadge');
    if (riskBadge) {
      const risk = pred.risk || 'UNKNOWN';
      riskBadge.textContent = risk;
      riskBadge.className = 'forecast-risk-badge state-badge ' + (
        risk==='CRITICAL' ? 'state-critical risk-critical' :
        risk==='HIGH'     ? 'state-warning  risk-high'     :
        risk==='MEDIUM'   ? 'state-moderate risk-medium'   : 'state-normal risk-low'
      );
    }

    // ── Connectivity indicators ───────────────────────────────
    const dot = (id, val) => { const n=el(id); if(n) n.className='conn-dot '+(val?'conn-on':'conn-off'); };
    dot('connESP32',    conn.esp32);
    dot('connDatabase', conn.database);
    dot('connSensor',   conn.sensorStream);
    dot('connTwin',     conn.twinSync ?? true);
    dot('connESP32b',   conn.esp32);
    dot('connDatabaseb',conn.database);
    dot('connSensorb',  conn.sensorStream);
    dot('connTwinb',    conn.twinSync ?? true);
    if (conn.lastUpdate) {
      const d = new Date(conn.lastUpdate);
      if (!isNaN(d.getTime())) {
        const str = [d.getHours(), d.getMinutes(), d.getSeconds()].map(n=>String(n).padStart(2,'0')).join(':');
        if (el('lastUpdate'))  el('lastUpdate').textContent  = str;
        if (el('lastUpdateb')) el('lastUpdateb').textContent = str;
      }
    }

    // ── Mode indicator ────────────────────────────────────────
    const modeEl = el('modeIndicator');
    if (modeEl) {
      modeEl.innerHTML = state.mode === 'LIVE'
        ? '<span class="mode-live">\u25c9 LIVE</span>'
        : '<span class="mode-sim">\u25c9 SIMULATION</span>';
    }
    const monitorBadge = el('monitoringModeBadge');
    if (monitorBadge) {
      monitorBadge.textContent = state.mode === 'LIVE' ? '\u25c9 LIVE' : '\u25c9 SIMULATION';
      monitorBadge.className   = 'status-pill ' + (state.mode==='LIVE'?'pill-active':'pill-idle');
    }

  } catch (err) {
    console.error('[dashboardView] State apply error:', err);
  }
}

export function initDashboardView() {
  subscribe('*', applyState);
}
