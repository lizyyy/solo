import { AppState } from './state.js';
import { DataParser } from './parser.js';
import { RuleValidator } from './validator.js';
import { Exporter } from './exporter.js';
import { Viewer3D } from './viewer.js';

const state = new AppState();
let viewer = null;

async function loadSampleData() {
  const trayRes = await fetch('/sample_data/tray.json');
  const trayText = await trayRes.text();
  const trayResult = DataParser.parseTrayJSON(trayText);
  
  const instrumentsRes = await fetch('/sample_data/instruments.csv');
  const instrumentsText = await instrumentsRes.text();
  const instrumentsResult = DataParser.parseInstrumentsCSV(instrumentsText);
  
  const rulesRes = await fetch('/sample_data/rules.yaml');
  const rulesText = await rulesRes.text();
  const rulesResult = DataParser.parseRulesYAML(rulesText);
  
  if (trayResult.success && instrumentsResult.success && rulesResult.success) {
    const instruments = instrumentsResult.data;
    let xOffset = -200;
    let yOffset = -100;
    instruments.forEach((inst, i) => {
      inst.position.x = xOffset + (i % 3) * 150;
      inst.position.y = yOffset + Math.floor(i / 3) * 120;
      inst.position.z = 0;
    });
    
    state.setTray(trayResult.data);
    state.setInstruments(instruments);
    state.setRules(rulesResult.data);
    
    if (viewer) {
      viewer.setTray(trayResult.data);
      viewer.setInstruments(instruments);
    }
  } else {
    alert('加载示例数据失败: ' + [...trayResult.errors, ...instrumentsResult.errors, ...rulesResult.errors].join(', '));
  }
}

function setupFileInputs() {
  document.getElementById('tray-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const text = await file.text();
      const result = DataParser.parseTrayJSON(text);
      if (result.success) {
        state.setTray(result.data);
        viewer.setTray(result.data);
      } else {
        alert(result.errors.join('\n'));
      }
    }
  });
  
  document.getElementById('instruments-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const text = await file.text();
      const result = DataParser.parseInstrumentsCSV(text);
      if (result.success) {
        state.setInstruments(result.data);
        viewer.setInstruments(result.data);
      } else {
        alert(result.errors.join('\n'));
      }
    }
  });
  
  document.getElementById('rules-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const text = await file.text();
      const result = DataParser.parseRulesYAML(text);
      if (result.success) {
        state.setRules(result.data);
      } else {
        alert(result.errors.join('\n'));
      }
    }
  });
}

function setupButtons() {
  document.getElementById('load-tray-sample').addEventListener('click', async () => {
    const res = await fetch('/sample_data/tray.json');
    const text = await res.text();
    const result = DataParser.parseTrayJSON(text);
    if (result.success) {
      state.setTray(result.data);
      viewer.setTray(result.data);
    }
  });
  
  document.getElementById('load-instruments-sample').addEventListener('click', async () => {
    const res = await fetch('/sample_data/instruments.csv');
    const text = await res.text();
    const result = DataParser.parseInstrumentsCSV(text);
    if (result.success) {
      const instruments = result.data;
      let xOffset = -200;
      let yOffset = -100;
      instruments.forEach((inst, i) => {
        inst.position.x = xOffset + (i % 3) * 150;
        inst.position.y = yOffset + Math.floor(i / 3) * 120;
        inst.position.z = 0;
      });
      state.setInstruments(instruments);
      viewer.setInstruments(instruments);
    }
  });
  
  document.getElementById('load-rules-sample').addEventListener('click', async () => {
    const res = await fetch('/sample_data/rules.yaml');
    const text = await res.text();
    const result = DataParser.parseRulesYAML(text);
    if (result.success) {
      state.setRules(result.data);
    }
  });
  
  document.getElementById('load-all').addEventListener('click', loadSampleData);
  
  document.getElementById('reset-view').addEventListener('click', () => {
    viewer.resetView();
  });
  
  document.getElementById('validate').addEventListener('click', () => {
    if (state.tray && state.instruments.length > 0 && state.rules) {
      const warnings = RuleValidator.validate(state.instruments, state.tray, state.rules);
      state.setWarnings(warnings);
      updateWarningsUI(warnings);
    } else {
      alert('请先加载托盘、器械和规则数据');
    }
  });
  
  document.getElementById('export-plan').addEventListener('click', () => {
    if (state.tray && state.instruments.length > 0) {
      const content = Exporter.exportLoadPlan(state.tray, state.instruments, state.warnings);
      Exporter.downloadFile(content, 'load_plan.json', 'application/json');
    }
  });
  
  document.getElementById('export-report').addEventListener('click', () => {
    if (state.tray && state.instruments.length > 0) {
      const content = Exporter.exportRiskReport(state.tray, state.instruments, state.warnings);
      Exporter.downloadFile(content, 'risk_report.md', 'text/markdown');
    }
  });
}

function updateWarningsUI(warnings) {
  const container = document.getElementById('warnings');
  const list = document.getElementById('warnings-list');
  
  if (warnings.length > 0) {
    container.style.display = 'block';
    list.innerHTML = warnings.map(w => `
      <div class="warning-item ${w.type === 'ERROR' ? 'error' : ''}">
        ${w.message}
      </div>
    `).join('');
  } else {
    container.style.display = 'none';
  }
}

function updateSelectedInfo(inst) {
  const container = document.getElementById('selected-info');
  const details = document.getElementById('selected-details');
  
  if (inst) {
    container.style.display = 'block';
    details.innerHTML = `
      <p><strong>编号:</strong> ${inst.id}</p>
      <p><strong>名称:</strong> ${inst.name}</p>
      <p><strong>类型:</strong> ${inst.type}</p>
      <p><strong>尺寸:</strong> ${inst.width} × ${inst.depth} × ${inst.height} mm</p>
      <p><strong>位置:</strong> (${inst.position.x.toFixed(1)}, ${inst.position.y.toFixed(1)}, ${inst.position.z.toFixed(1)})</p>
    `;
  } else {
    container.style.display = 'none';
  }
}

function init() {
  const container = document.getElementById('canvas-container');
  viewer = new Viewer3D(container);
  viewer.state = state;
  
  setupFileInputs();
  setupButtons();
  
  state.subscribe((s) => {
    if (s.selectedInstrumentId) {
      const inst = s.instruments.find(i => i.id === s.selectedInstrumentId);
      viewer.setSelectedInstrument(s.selectedInstrumentId);
      updateSelectedInfo(inst);
    } else {
      viewer.setSelectedInstrument(null);
      updateSelectedInfo(null);
    }
  });
  
  loadSampleData();
}

init();
