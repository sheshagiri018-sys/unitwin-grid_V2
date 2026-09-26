import CONFIG from '../config/config.js';
import { setTransformerState, setSolarGeneration, setEVCharging, setHouseholdLoad, setAmbientData, setScenario, addAlert } from '../core/state.js';

export const SCENARIOS = {
  NORMAL: { label:'Normal Operation', solarOn:true, solarPowerW:3500, householdOn:true, evLevel:'off', description:'Stable grid operation.' },
  EV_CHARGING: { label:'EV Charging', solarOn:true, solarPowerW:3500, householdOn:true, evLevel:'medium', description:'EV charging at medium rate.' },
  SOLAR_EV: { label:'Solar + EV Peak', solarOn:true, solarPowerW:6000, householdOn:true, evLevel:'high', description:'Peak solar + high EV.' },
  HIGH_DEMAND: { label:'High Demand', solarOn:false, solarPowerW:0, householdOn:true, evLevel:'high', description:'No solar, high demand.' },
  OVERLOAD: { label:'Overload Condition', solarOn:false, solarPowerW:0, householdOn:true, evLevel:'high', description:'Critical overload.' },
  NO_SOLAR: { label:'No Solar', solarOn:false, solarPowerW:0, householdOn:true, evLevel:'low', description:'Night/cloud cover.' },
  TEMP_RISE: { label:'Temperature Rise', solarOn:true, solarPowerW:2000, householdOn:true, evLevel:'medium', description:'Thermal stress.' },
  VIB_ANOMALY: { label:'Vibration Anomaly', solarOn:true, solarPowerW:3000, householdOn:true, evLevel:'low', description:'Unusual vibration.' }
};

const EV_POWER_KW = { off:0, low:3.3, medium:7.2, high:11.0 };
const _sim = { solarOn:true, solarPowerW:3500, householdOn:true, evLevel:'off', scenario:'NORMAL', tempActual:28, tempTarget:28, vibBase:0.05, tick:0 };
let _intervalHandle = null;

function _noise(maxPct=0.04) { return 1+(Math.random()*2-1)*maxPct; }
function _clamp(v,lo,hi) { return Math.max(lo,Math.min(hi,v)); }

function _tick() {
  _sim.tick += 1;
  const householdPowerKW = _sim.householdOn ? 2.4 * _noise() : 0;
  const evPowerKW = EV_POWER_KW[_sim.evLevel] ?? 0;
  const solarPowerKW = _sim.solarOn ? (_sim.solarPowerW/1000)*_noise(0.03) : 0;
  const netDemandKW = Math.max(0, householdPowerKW + evPowerKW - solarPowerKW*0.3);
  const vibNoise = (_sim.evLevel!=='off'?0.015:0.005)*(Math.random()*2-1);
  const voltage = (12 + vibNoise)*_noise(0.01);
  const current = voltage > 0 ? netDemandKW/voltage : 0;
  const power = voltage*current;
  const loading = _clamp((power/12)*100,0,120);
  const ambientTemp = 28;
  const thermalCoeff = 0.6;
  _sim.tempTarget = ambientTemp + loading*thermalCoeff*_noise(0.02);
  _sim.tempActual = _sim.tempActual + (1/120)*(_sim.tempTarget - _sim.tempActual);
  const temperature = _sim.tempActual*_noise(0.01);
  const evVibContrib = _sim.evLevel==='high'?0.28:_sim.evLevel==='medium'?0.16:_sim.evLevel==='low'?0.06:0;
  const vibBase = _sim.scenario==='VIB_ANOMALY'?0.38:_sim.vibBase;
  const vibration = _clamp((vibBase+evVibContrib)*_noise(0.12),0,2);
  
  // PUSH TO STATE — with correct field names
  setTransformerState({ voltage:parseFloat(voltage.toFixed(3)), current:parseFloat(current.toFixed(3)), power:parseFloat(power.toFixed(3)), loading:parseFloat(loading.toFixed(1)), temperature:parseFloat(temperature.toFixed(2)), vibration:parseFloat(vibration.toFixed(4)), timestamp:Date.now() });
  
  // FIX: push correct field names for solar state
  const solarVoltageSim = (CONFIG.solar?.ratedVoltage || 5.8) * _noise(0.02);
  const solarCurrentSim = solarPowerKW > 0 ? (solarPowerKW*1000)/solarVoltageSim*_noise(0.02) : 0;
  setSolarGeneration({ voltage:parseFloat(solarVoltageSim.toFixed(2)), current:parseFloat(solarCurrentSim.toFixed(3)), power:parseFloat((solarPowerKW*1000).toFixed(1)), status:_sim.solarOn?'ACTIVE':'OFFLINE', source:'SIMULATION' });
  
  // FIX: push correct field names for ev state
  setEVCharging({ level:_sim.evLevel, power:parseFloat(evPowerKW.toFixed(3)), current:parseFloat((evPowerKW/12).toFixed(3)), status:evPowerKW>0?'CHARGING':'IDLE', source:'SIMULATION' });
  
  // FIX: push correct field names for household state
  setHouseholdLoad({ status:_sim.householdOn?'ON':'OFF', power:parseFloat(householdPowerKW.toFixed(3)), source:'SIMULATION' });
  
  setAmbientData({ temperature:parseFloat(ambientTemp.toFixed(1)), humidity:55+(Math.random()*10-5), source:'SIMULATION' });
}

export function initSimulation() { stopSimulation(); setSimulationScenario('NORMAL'); _intervalHandle=setInterval(_tick,500); console.info('[SimEngine] Simulation started.'); }
export function setSimulationScenario(name) {
  const preset=SCENARIOS[name];
  if(!preset){console.warn('[SimEngine] Unknown scenario:',name);return;}
  _sim.scenario=name; _sim.solarOn=preset.solarOn; _sim.solarPowerW=preset.solarPowerW; _sim.householdOn=preset.householdOn; _sim.evLevel=preset.evLevel;
  if(name==='OVERLOAD'||name==='HIGH_DEMAND'){_sim.tempTarget=Math.max(_sim.tempTarget,60);}
  setScenario(name); // FIX: update global scenario state
  console.info('[SimEngine] Scenario applied:',name);
}
export function setSimulationEVLevel(level){_sim.evLevel=level;}
export function setSimulationSolar(on){_sim.solarOn=Boolean(on);}
export function setSimulationHousehold(on){_sim.householdOn=Boolean(on);}
export function stopSimulation(){if(_intervalHandle!==null){clearInterval(_intervalHandle);_intervalHandle=null;}}
