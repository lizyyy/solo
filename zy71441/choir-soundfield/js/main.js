import { DataManager, VOCAL_PARTS, MIC_TYPES } from './data.js';
import { ChoirScene } from './scene.js';
import { HistoryPanel } from './history.js';
import { ErrorPanel } from './errors.js';

const dataManager = new DataManager();
let choirScene = null;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function showToast(message, type = 'info') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function renderFormationSelect() {
  const select = $('#formation-select');
  const currentId = dataManager.currentFormationId;
  select.innerHTML = '';
  for (const [id, f] of dataManager.formations) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = f.name;
    opt.selected = id === currentId;
    select.appendChild(opt);
  }
  const formation = dataManager.getCurrentFormation();
  if (formation) {
    $('#formation-name').value = formation.name;
  }
}

function renderMemberList() {
  const container = $('#member-list');
  const formation = dataManager.getCurrentFormation();
  if (!formation) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:4px;">请先创建站位方案</div>';
    return;
  }
  const members = [...formation.members.values()];
  if (members.length === 0) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:4px;">暂无成员，点击"导入数据"添加</div>';
    return;
  }
  container.innerHTML = members.map(m => {
    const part = VOCAL_PARTS[m.vocalPart] || VOCAL_PARTS.soprano;
    const selected = m.id === choirScene?.selectedId ? ' selected' : '';
    return `<div class="member-item${selected}" data-id="${m.id}" role="button" tabindex="0" aria-label="${m.name} ${part.label}">
      <span class="member-dot" style="background:${part.color}"></span>
      <span class="member-name">${m.name}</span>
      <span class="member-pos">(${m.position.x.toFixed(1)}, ${m.position.z.toFixed(1)})</span>
    </div>`;
  }).join('');

  container.querySelectorAll('.member-item').forEach(el => {
    el.addEventListener('click', () => {
      if (choirScene) {
        choirScene.selectedId = el.dataset.id;
        choirScene._emitSelection();
      }
      renderMemberList();
      renderMicList();
    });
  });
}

function renderMicList() {
  const container = $('#mic-list');
  const formation = dataManager.getCurrentFormation();
  if (!formation) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:4px;">请先创建站位方案</div>';
    return;
  }
  const mics = [...formation.microphones.values()];
  if (mics.length === 0) {
    container.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:4px;">暂无麦克风，点击"添加麦克风"</div>';
    return;
  }
  container.innerHTML = mics.map(mic => {
    const micType = MIC_TYPES[mic.type] || MIC_TYPES.cardioid;
    const selected = mic.id === choirScene?.selectedId ? ' selected' : '';
    return `<div class="mic-item${selected}" data-id="${mic.id}" role="button" tabindex="0" aria-label="${mic.name} ${micType.label}">
      <span class="mic-icon">${micType.icon}</span>
      <div class="mic-info">
        <div class="mic-name">${mic.name}</div>
        <div class="mic-detail">${micType.label} | (${mic.position.x.toFixed(1)}, ${mic.position.z.toFixed(1)})</div>
      </div>
    </div>`;
  }).join('');

  container.querySelectorAll('.mic-item').forEach(el => {
    el.addEventListener('click', () => {
      if (choirScene) {
        choirScene.selectedId = el.dataset.id;
        choirScene._emitSelection();
      }
      renderMemberList();
      renderMicList();
    });
  });
}

function renderAll() {
  renderFormationSelect();
  renderMemberList();
  renderMicList();
  const formation = dataManager.getCurrentFormation();
  if (choirScene && formation) {
    choirScene.updateFormation(formation);
  }
}

const historyPanel = new HistoryPanel($('#history-list'));
const errorPanel = new ErrorPanel($('#error-list'));

function renderHistory() {
  historyPanel.render(dataManager.getHistory());
}

function renderErrors() {
  errorPanel.render(dataManager.getErrors());
}

dataManager.addListener((event) => {
  switch (event.type) {
    case 'formation-created':
    case 'formation-deleted':
    case 'formation-switched':
    case 'data-loaded':
      renderAll();
      dataManager.runDiagnostics();
      renderErrors();
      break;
    case 'formation-renamed':
      renderFormationSelect();
      break;
    case 'member-added':
    case 'member-removed':
      renderMemberList();
      if (choirScene) choirScene.updateFormation(dataManager.getCurrentFormation());
      dataManager.runDiagnostics();
      renderErrors();
      break;
    case 'member-updated':
      renderMemberList();
      if (choirScene) choirScene.updateFormation(dataManager.getCurrentFormation());
      break;
    case 'mic-added':
    case 'mic-removed':
      renderMicList();
      if (choirScene) choirScene.updateFormation(dataManager.getCurrentFormation());
      dataManager.runDiagnostics();
      renderErrors();
      break;
    case 'mic-updated':
      renderMicList();
      if (choirScene) choirScene.updateFormation(dataManager.getCurrentFormation());
      break;
    case 'history-added':
      renderHistory();
      break;
    case 'history-cleared':
      renderHistory();
      break;
    case 'error-added':
    case 'diagnostics-complete':
      renderErrors();
      break;
  }
});

function initScene() {
  const canvas = $('#three-canvas');
  choirScene = new ChoirScene(canvas, (type, id, pos, isManual) => {
    const formation = dataManager.getCurrentFormation();
    if (!formation) return;
    if (type === 'member') {
      dataManager.updateMemberPosition(id, { x: pos.x, y: 0, z: pos.z }, isManual);
    } else if (type === 'mic') {
      dataManager.updateMicrophonePosition(id, { x: pos.x, y: 0, z: pos.z }, null, isManual);
    }
  });

  choirScene.onSelect = (id) => {
    renderMemberList();
    renderMicList();
  };
}

function initToolbar() {
  $('#btn-toggle-heatmap').addEventListener('click', function () {
    const active = !this.classList.contains('active');
    this.classList.toggle('active', active);
    if (choirScene) choirScene.toggleHeatmap(active);
  });

  $('#btn-toggle-mics').addEventListener('click', function () {
    const active = !this.classList.contains('active');
    this.classList.toggle('active', active);
    if (choirScene) choirScene.toggleMics(active);
  });

  $('#btn-toggle-labels').addEventListener('click', function () {
    const active = !this.classList.contains('active');
    this.classList.toggle('active', active);
    if (choirScene) choirScene.toggleLabels(active);
  });

  $('#btn-reset-camera').addEventListener('click', () => {
    if (choirScene) choirScene.resetCamera();
  });

  $('#btn-save-formation').addEventListener('click', () => {
    dataManager._saveToStorage();
    showToast('站位方案已保存', 'success');
  });
}

function initFormationControls() {
  const select = $('#formation-select');
  select.addEventListener('change', () => {
    dataManager.switchFormation(select.value);
  });

  $('#btn-new-formation').addEventListener('click', () => {
    const name = $('#formation-name').value.trim() || undefined;
    dataManager.createFormation(name);
    showToast('已创建新方案', 'success');
  });

  $('#btn-delete-formation').addEventListener('click', () => {
    if (dataManager.formations.size === 0) return;
    if (dataManager.deleteFormation(dataManager.currentFormationId)) {
      showToast('方案已删除', 'warning');
    }
  });

  $('#formation-name').addEventListener('change', () => {
    const name = $('#formation-name').value.trim();
    if (name && dataManager.currentFormationId) {
      dataManager.renameFormation(dataManager.currentFormationId, name);
    }
  });
}

function initImportControls() {
  $('#btn-import-members').addEventListener('click', () => {
    $('#file-members').click();
  });

  $('#file-members').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const arr = Array.isArray(data) ? data : data.members || [];
        const result = dataManager.importMembers(arr, file.name);
        showToast(`导入成员: 成功${result.added}条, 跳过${result.skipped}条`, result.errors.length > 0 ? 'warning' : 'success');
        renderAll();
        dataManager.runDiagnostics();
        renderErrors();
      } catch (err) {
        showToast(`导入失败: ${err.message}，请检查文件 ${file.name} 格式是否为有效JSON`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  $('#btn-import-mics').addEventListener('click', () => {
    $('#file-mics').click();
  });

  $('#file-mics').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const arr = Array.isArray(data) ? data : data.microphones || [];
        const result = dataManager.importMicrophones(arr, file.name);
        showToast(`导入麦克风: 成功${result.added}条, 跳过${result.skipped}条`, result.errors.length > 0 ? 'warning' : 'success');
        renderAll();
        dataManager.runDiagnostics();
        renderErrors();
      } catch (err) {
        showToast(`导入失败: ${err.message}，请检查文件 ${file.name} 格式是否为有效JSON`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  $('#btn-add-mic').addEventListener('click', () => {
    const type = $('#mic-type-select').value;
    dataManager.addMicrophone({
      name: undefined,
      type,
      position: { x: 0, y: 0, z: 2 },
      direction: { x: 0, y: 0, z: -1 }
    });
    renderAll();
    showToast('已添加麦克风', 'success');
  });

  $('#btn-add-member').addEventListener('click', () => {
    const name = $('#new-member-name').value.trim();
    const part = $('#new-member-part').value;
    dataManager.addMember({
      name: name || undefined,
      vocalPart: part,
      position: { x: 0, y: 0, z: 0 }
    });
    $('#new-member-name').value = '';
    renderAll();
    dataManager.runDiagnostics();
    renderErrors();
    showToast('已添加成员', 'success');
  });

  $('#btn-clear-history').addEventListener('click', () => {
    dataManager.clearHistory();
  });
}

function loadDemoData() {
  if (dataManager.formations.size > 0) return;

  const fmtId = dataManager.createFormation('标准四声部站位');

  const sopranoPositions = [
    { x: -2.5, z: -3 }, { x: -1.5, z: -3 }, { x: -0.5, z: -3 },
    { x: 0.5, z: -3 }, { x: 1.5, z: -3 }, { x: 2.5, z: -3 }
  ];
  const altoPositions = [
    { x: -2.5, z: -1.5 }, { x: -1.5, z: -1.5 }, { x: -0.5, z: -1.5 },
    { x: 0.5, z: -1.5 }, { x: 1.5, z: -1.5 }, { x: 2.5, z: -1.5 }
  ];
  const tenorPositions = [
    { x: -2.5, z: 0.5 }, { x: -1.5, z: 0.5 }, { x: -0.5, z: 0.5 },
    { x: 0.5, z: 0.5 }, { x: 1.5, z: 0.5 }, { x: 2.5, z: 0.5 }
  ];
  const bassPositions = [
    { x: -2.5, z: 2 }, { x: -1.5, z: 2 }, { x: -0.5, z: 2 },
    { x: 0.5, z: 2 }, { x: 1.5, z: 2 }, { x: 2.5, z: 2 }
  ];

  const names = {
    soprano: ['张雪', '李梅', '王芳', '赵丽', '孙兰', '周婷'],
    alto: ['陈静', '杨红', '吴秀', '郑芬', '朱琴', '何玲'],
    tenor: ['刘明', '黄强', '林浩', '徐伟', '马超', '高远'],
    bass: ['胡刚', '郭磊', '罗峰', '梁深', '宋波', '唐坚']
  };

  const parts = [
    { vocalPart: 'soprano', positions: sopranoPositions },
    { vocalPart: 'alto', positions: altoPositions },
    { vocalPart: 'tenor', positions: tenorPositions },
    { vocalPart: 'bass', positions: bassPositions }
  ];

  for (const part of parts) {
    part.positions.forEach((pos, i) => {
      dataManager.addMember({
        name: names[part.vocalPart][i],
        vocalPart: part.vocalPart,
        position: { x: pos.x, y: 0, z: pos.z }
      }, '示例数据');
    });
  }

  dataManager.addMicrophone({
    name: '主麦克风-左',
    type: 'cardioid',
    position: { x: -2, y: 0, z: 4 },
    direction: { x: 0.1, y: 0, z: -1 }
  }, '示例数据');

  dataManager.addMicrophone({
    name: '主麦克风-右',
    type: 'cardioid',
    position: { x: 2, y: 0, z: 4 },
    direction: { x: -0.1, y: 0, z: -1 }
  }, '示例数据');

  dataManager.addMicrophone({
    name: '环境麦',
    type: 'omni',
    position: { x: 0, y: 0, z: 5 },
    direction: { x: 0, y: 0, z: -1 }
  }, '示例数据');

  dataManager.runDiagnostics();
}

function init() {
  initScene();
  initToolbar();
  initFormationControls();
  initImportControls();

  const loaded = dataManager.loadFromStorage();
  if (!loaded) {
    loadDemoData();
  }

  renderAll();
  renderHistory();
  renderErrors();
}

init();
