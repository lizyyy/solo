let currentSession = null;
let currentSteps = [];

function showToast(message, duration = 3000) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    
    if (btn.dataset.tab === 'history') {
      loadMaterials();
    } else if (btn.dataset.tab === 'videos') {
      loadVideos();
    } else if (btn.dataset.tab === 'settings') {
      loadStepsEditor();
    }
  });
});

async function loadSteps() {
  try {
    const res = await fetch('/api/steps');
    const data = await res.json();
    currentSteps = data.steps || [];
  } catch (e) {
    console.error('加载步骤失败', e);
  }
}

function renderStepsList() {
  const container = document.getElementById('stepsList');
  if (!container) return;
  
  const completedIds = currentSession ? currentSession.completedSteps.map(s => s.stepId) : [];
  const currentStepIndex = completedIds.length;
  
  container.innerHTML = currentSteps.map((step, index) => {
    const isCompleted = completedIds.includes(step.id);
    const isCurrent = index === currentStepIndex;
    
    let className = 'step-item';
    if (isCompleted) className += ' completed';
    if (isCurrent && !isCompleted) className += ' current';
    
    return `
      <div class="${className}">
        <div class="step-number">${index + 1}</div>
        <div class="step-content">
          <div class="step-name">${step.name}</div>
          <div class="step-desc">${step.description || ''}</div>
        </div>
        <div class="step-actions">
          ${!isCompleted || isCurrent ? `
            <button class="btn btn-small btn-primary" onclick="completeStep('${step.id}')">
              ${isCompleted ? '重做' : '完成'}
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function completeStep(stepId) {
  if (!currentSession) return;
  
  try {
    const res = await fetch(`/api/sessions/${currentSession.id}/complete-step`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stepId, notes: '' })
    });
    const data = await res.json();
    
    if (data.success) {
      currentSession = data.session;
      renderStepsList();
      renderNotes();
      hideError();
      showToast(data.message || '步骤已完成');
    } else {
      showError(data.error);
    }
  } catch (e) {
    showToast('操作失败，请重试');
  }
}

function showError(error) {
  const alert = document.getElementById('errorAlert');
  document.getElementById('errorMessage').textContent = error.message;
  document.getElementById('errorSuggestion').textContent = '💡 ' + error.suggestion;
  alert.classList.remove('hidden');
}

function hideError() {
  document.getElementById('errorAlert').classList.add('hidden');
}

function showVideoChanges(changes) {
  if (!changes || changes.length === 0) return;
  
  const alert = document.getElementById('videoAlert');
  const container = document.getElementById('videoChanges');
  
  container.innerHTML = changes.map(c => `<p>• ${c}</p>`).join('');
  alert.classList.remove('hidden');
}

document.getElementById('startSession').addEventListener('click', async () => {
  const batchNumber = document.getElementById('batchNumber').value.trim();
  const materialName = document.getElementById('materialName').value.trim();
  const teacherName = document.getElementById('teacherName').value.trim();
  const className = document.getElementById('className').value.trim();
  
  if (!batchNumber || !materialName || !teacherName || !className) {
    showToast('请填写完整信息');
    return;
  }
  
  try {
    const materialRes = await fetch('/api/materials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchNumber, materialName })
    });
    const materialData = await materialRes.json();
    showToast(materialData.message);
    
    const sessionRes = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchNumber, teacherName, className })
    });
    const sessionData = await sessionRes.json();
    
    if (sessionData.success) {
      currentSession = sessionData.session;
      document.getElementById('sessionArea').classList.remove('hidden');
      document.getElementById('sessionInfo').textContent = `${teacherName} - ${className}`;
      await loadSteps();
      renderStepsList();
      renderNotes();
    } else {
      showToast(sessionData.error?.message || '创建课程失败');
    }
  } catch (e) {
    showToast('操作失败，请重试');
  }
});

document.getElementById('addNote').addEventListener('click', async () => {
  const content = document.getElementById('noteContent').value.trim();
  if (!content || !currentSession) return;
  
  try {
    const res = await fetch(`/api/sessions/${currentSession.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    
    if (data.success) {
      document.getElementById('noteContent').value = '';
      currentSession.notes.push({
        id: Date.now(),
        content,
        createdAt: new Date().toISOString()
      });
      renderNotes();
      showToast('笔记已添加');
    }
  } catch (e) {
    showToast('添加失败');
  }
});

function renderNotes() {
  const container = document.getElementById('notesList');
  if (!container || !currentSession) return;
  
  container.innerHTML = currentSession.notes.map(note => `
    <div class="note-item">
      <div>${note.content}</div>
      <div class="note-time">${formatDate(note.createdAt)}</div>
    </div>
  `).join('');
}

document.getElementById('endSession').addEventListener('click', async () => {
  if (!currentSession) return;
  if (!confirm('确定要结束这节课吗？')) return;
  
  try {
    const res = await fetch(`/api/sessions/${currentSession.id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    
    if (data.success) {
      showToast('课程已结束');
      currentSession = null;
      document.getElementById('sessionArea').classList.add('hidden');
      document.querySelectorAll('#teach input, #teach textarea').forEach(el => el.value = '');
    }
  } catch (e) {
    showToast('操作失败');
  }
});

document.getElementById('exportRecord').addEventListener('click', () => {
  if (!currentSession) return;
  window.open(`/api/export/session/${currentSession.id}`, '_blank');
});

document.getElementById('exportChecklist').addEventListener('click', () => {
  if (!currentSession) return;
  window.open(`/api/export/checklist/${currentSession.id}`, '_blank');
});

document.getElementById('uploadVideo').addEventListener('click', async () => {
  const name = document.getElementById('videoName').value.trim();
  const duration = parseInt(document.getElementById('videoDuration').value) || 0;
  const stepsText = document.getElementById('videoSteps').value.trim();
  const partsText = document.getElementById('videoParts').value.trim();
  const uploadedBy = document.getElementById('uploadedBy').value.trim();
  
  if (!name || !uploadedBy) {
    showToast('请填写视频名称和上传人');
    return;
  }
  
  const stepDescriptions = stepsText.split('\n').filter(s => s.trim());
  const requiredParts = partsText.split('\n').filter(s => s.trim());
  
  try {
    const res = await fetch('/api/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoInfo: {
          name,
          duration,
          fileSize: 0,
          stepDescriptions,
          requiredParts
        },
        uploadedBy
      })
    });
    const data = await res.json();
    
    if (data.success) {
      showToast(data.message);
      if (data.changeSummary && data.changeSummary.length > 0) {
        showVideoChanges(data.changeSummary);
      }
      loadVideos();
      document.querySelectorAll('#videos input, #videos textarea').forEach(el => el.value = '');
    }
  } catch (e) {
    showToast('上传失败');
  }
});

async function loadVideos() {
  try {
    const res = await fetch('/api/videos');
    const data = await res.json();
    
    const container = document.getElementById('videoList');
    container.innerHTML = data.videos.map(video => `
      <div class="video-item">
        <div class="video-info">
          <h4>${video.name}</h4>
          <p>共 ${video.versionCount} 个版本，最新版本 v${video.latestVersion.versionNumber}</p>
          <p>上传者：${video.latestVersion.uploadedBy} · ${formatDate(video.latestVersion.uploadedAt)}</p>
        </div>
        <button class="btn btn-small btn-secondary" onclick="viewVideoHistory('${video.videoId}')">查看历史</button>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

async function viewVideoHistory(videoId) {
  try {
    const res = await fetch(`/api/videos/${videoId}/history`);
    const data = await res.json();
    
    if (data.success) {
      const versionInfo = data.versions.map(v => 
        `v${v.versionNumber} - ${v.uploadedBy} - ${formatDate(v.uploadedAt)}`
      ).join('\n');
      alert(`版本历史：\n${versionInfo}`);
    }
  } catch (e) {
    showToast('加载失败');
  }
}

async function loadMaterials() {
  try {
    const res = await fetch('/api/materials');
    const data = await res.json();
    
    const container = document.getElementById('materialsList');
    container.innerHTML = data.materials.map(m => `
      <div class="material-item">
        <div class="material-info">
          <h4>${m.batchNumber}</h4>
          <p>${m.materialName}</p>
          <p>开课次数：${m.sessionIds.length} 次</p>
        </div>
        <div>
          <button class="btn btn-small btn-primary" onclick="viewBatchHistory('${m.batchNumber}')">查看记录</button>
          <button class="btn btn-small btn-secondary" onclick="exportBatchHistory('${m.batchNumber}')">导出</button>
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

document.getElementById('searchHistory').addEventListener('click', () => {
  const batchNumber = document.getElementById('historyBatchNumber').value.trim();
  if (batchNumber) {
    viewBatchHistory(batchNumber);
  }
});

async function viewBatchHistory(batchNumber) {
  try {
    const res = await fetch(`/api/materials/${batchNumber}/history`);
    const data = await res.json();
    
    const container = document.getElementById('historyResults');
    
    if (data.history.length === 0) {
      container.innerHTML = '<p>暂无记录</p>';
      return;
    }
    
    container.innerHTML = `
      <h3 style="margin: 20px 0 15px;">批次 ${batchNumber} 的历史记录</h3>
      ${data.history.map((session, index) => `
        <div class="history-item">
          <h4>第 ${data.history.length - index} 次课程</h4>
          <p>老师：${session.teacherName} · 班级：${session.className}</p>
          <p>时间：${formatDate(session.startTime)} ~ ${session.endTime ? formatDate(session.endTime) : '进行中'}</p>
          <p>完成步骤：${session.completedSteps.length} 步</p>
          <p>遇到问题：${session.errors.length} 个</p>
        </div>
      `).join('')}
    `;
  } catch (e) {
    showToast('查询失败');
  }
}

function exportBatchHistory(batchNumber) {
  window.open(`/api/export/batch/${batchNumber}`, '_blank');
}

async function loadStepsEditor() {
  await loadSteps();
  const container = document.getElementById('stepsEditor');
  
  if (currentSteps.length === 0) {
    currentSteps = [
      { id: 'step1', name: '检查电源连接', description: '确认所有电源线连接正确' },
      { id: 'step2', name: '初始化机械臂', description: '打开控制器，等待机械臂归位' },
      { id: 'step3', name: '检查零件清单', description: '核对所有零件是否齐全' },
      { id: 'step4', name: '开始基础操作演示', description: '演示机械臂基本移动' },
      { id: 'step5', name: '学生实操练习', description: '指导学生进行实际操作' }
    ];
  }
  
  renderStepsEditor();
}

function renderStepsEditor() {
  const container = document.getElementById('stepsEditor');
  container.innerHTML = currentSteps.map((step, index) => `
    <div class="step-editor-item">
      <span style="width: 30px; font-weight: 600;">${index + 1}</span>
      <input type="text" placeholder="步骤名称" value="${step.name}" 
             onchange="updateStep(${index}, 'name', this.value)">
      <input type="text" placeholder="步骤描述" value="${step.description || ''}"
             onchange="updateStep(${index}, 'description', this.value)">
      <button class="btn btn-small btn-danger" onclick="removeStep(${index})">删除</button>
    </div>
  `).join('');
}

function updateStep(index, field, value) {
  currentSteps[index][field] = value;
}

document.getElementById('addStep').addEventListener('click', () => {
  const newId = 'step' + (currentSteps.length + 1) + '_' + Date.now();
  currentSteps.push({ id: newId, name: '', description: '' });
  renderStepsEditor();
});

function removeStep(index) {
  currentSteps.splice(index, 1);
  renderStepsEditor();
}

document.getElementById('saveSteps').addEventListener('click', async () => {
  const validSteps = currentSteps.filter(s => s.name.trim());
  if (validSteps.length === 0) {
    showToast('请至少添加一个步骤');
    return;
  }
  
  try {
    const res = await fetch('/api/steps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps: validSteps })
    });
    const data = await res.json();
    showToast(data.message || '保存成功');
  } catch (e) {
    showToast('保存失败');
  }
});

async function init() {
  await loadSteps();
}

init();
