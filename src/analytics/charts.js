/**
 * charts.js â€” UNITWIN GRID V2
 */

import { subscribe } from '../core/state.js';

const MAX_POINTS = 60;
const chartsRegistry = new Map();

function _makeChart(canvasId, label, color, yLabel='') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  if (chartsRegistry.has(canvasId)) {
    chartsRegistry.get(canvasId).destroy();
  }

  const chart = new window.Chart(canvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: label,
        data: [],
        borderColor: color,
        borderWidth: 1.5,
        pointRadius: 0,
        tension: 0.4,
        fill: false
      }]
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: { display: false },
        y: { 
          display: true,
          title: {
            display: !!yLabel,
            text: yLabel
          }
        }
      }
    }
  });

  chartsRegistry.set(canvasId, chart);
  return chart;
}

function nowLabel() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function initCharts() {
  if (!window.Chart) {
    console.warn('[charts] window.Chart not found.');
    return;
  }

  // Dashboard sparkline charts (small, bottom of screen)
  _makeChart('chart-voltage', 'Voltage (V)', '#4488ff');
  _makeChart('chart-current', 'Current (A)', '#44ffaa');
  _makeChart('chart-power', 'Power (kW)', '#ffaa44');
  _makeChart('chart-temp', 'Temperature (Â°C)', '#ff4444');
  _makeChart('chart-vibration', 'Vibration (mm/s)', '#aa44ff');
  _makeChart('chart-loading', 'Loading (%)', '#ffdd00');
  _makeChart('chart-solar', 'Solar (W)', '#ffee00');
  _makeChart('chart-ev', 'EV (kW)', '#aa44ff');

  // Analytics page charts (larger)
  _makeChart('chartVoltage', 'Voltage (V)', '#4488ff');
  _makeChart('chartCurrent', 'Current (A)', '#44ffaa');
  _makeChart('chartPower', 'Power (kW)', '#ffaa44');
  _makeChart('chartTemp', 'Temperature (Â°C)', '#ff4444');
  _makeChart('chartVibration', 'Vibration (mm/s)', '#aa44ff');
  _makeChart('chartLoading', 'Loading (%)', '#ffdd00');
  _makeChart('chartSolar', 'Solar (W)', '#ffee00');

  subscribe('*', updateCharts);
}

export function updateCharts(state) {
  if (!window.Chart) return;

  const transformer = state.transformer || {};
  const solar = state.solar || {};
  const ev = state.ev || {};

  const timeLabel = nowLabel();

  const updates = [
    // Dashboard
    { id: 'chart-voltage', val: transformer.voltage },
    { id: 'chart-current', val: transformer.current },
    { id: 'chart-power', val: transformer.power },
    { id: 'chart-temp', val: transformer.temperature },
    { id: 'chart-vibration', val: transformer.vibration },
    { id: 'chart-loading', val: transformer.loading },
    { id: 'chart-solar', val: solar.power },
    { id: 'chart-ev', val: ev.power },
    
    // Analytics
    { id: 'chartVoltage', val: transformer.voltage },
    { id: 'chartCurrent', val: transformer.current },
    { id: 'chartPower', val: transformer.power },
    { id: 'chartTemp', val: transformer.temperature },
    { id: 'chartVibration', val: transformer.vibration },
    { id: 'chartLoading', val: transformer.loading },
    { id: 'chartSolar', val: solar.power }
  ];

  updates.forEach(u => {
    const chart = chartsRegistry.get(u.id);
    if (!chart) return;
    
    chart.data.labels.push(timeLabel);
    chart.data.datasets[0].data.push(u.val != null ? u.val : null);
    
    if (chart.data.labels.length > MAX_POINTS) {
      chart.data.labels.shift();
      chart.data.datasets[0].data.shift();
    }
    
    chart.update('none');
  });
}

export function destroyCharts() {
  for (const [id, chart] of chartsRegistry) {
    chart.destroy();
  }
  chartsRegistry.clear();
}
