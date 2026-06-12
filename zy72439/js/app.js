let currentSong = null;
let currentStep = 0;

document.addEventListener('DOMContentLoaded', function() {
  initDemoData();
  renderSongsList();
  bindEvents();
});

function bindEvents() {
  document.getElementById('nextStepBtn').addEventListener('click', handleNextStep);
  document.getElementById('resetBtn').addEventListener('click', resetDemo);
  document.getElementById('runAllBtn').addEventListener('click', runAllSongs);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const scenario = this.dataset.scenario;
      filterSongs(scenario);
    });
  });
}

function renderSongsList() {
  const container = document.getElementById('songsList');
  container.innerHTML = '';

  demoData.songs.forEach((song, index) => {
    const tagMap = {
      'smooth': { class: 'tag-smooth', text: '顺利记录' },
      'group': { class: 'tag-group', text: '群内临时替补' },
      'supplement': { class: 'tag-supplement', text: '留言补录' }
    };
    const tag = tagMap[song.isDemoType];

    const div = document.createElement('div');
    div.className = 'song-item' + (currentSong && currentSong.id === song.id ? ' active' : '');
    div.dataset.index = index;
    div.innerHTML = `
      <div class="song-id">${song.id}</div>
      <div class="song-name">${song.name}</div>
      <span class="song-tag ${tag.class}">${tag.text}</span>
    `;
    div.addEventListener('click', () => selectSong(index));
    container.appendChild(div);
  });
}

function filterSongs(scenario) {
  const items = document.querySelectorAll('.song-item');
  items.forEach(item => {
    const index = parseInt(item.dataset.index);
    const song = demoData.songs[index];
    if (scenario === 'all' || song.isDemoType === scenario) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

function selectSong(index) {
  currentSong = demoData.songs[index];
  currentStep = 0;
  renderSongsList();
  renderSongDetail();
  updateStepIndicator();
  renderHistory();
}

function renderSongDetail() {
  if (!currentSong) return;

  document.getElementById('currentSongName').textContent = `${currentSong.name} (${currentSong.id})`;
  
  const statusBadge = document.getElementById('currentStatus');
  const statusClassMap = {
    '待处理': 'status-pending',
    '正常': 'status-normal',
    '待票务复核': 'status-review',
    '留言补录': 'status-supplemented',
    '已人工修正': 'status-revised',
    '已重跑': 'status-rerun'
  };
  statusBadge.className = 'status-badge ' + (statusClassMap[currentSong.status] || 'status-pending');
  statusBadge.textContent = currentSong.status;

  let authHtml = `
    <strong>授权期限：</strong>${currentSong.authorizedStart} 至 ${currentSong.authorizedEnd}<br>
  `;
  
  if (currentSong.originalPageNumber !== undefined && currentSong.originalPageNumber !== currentSong.pageNumber) {
    authHtml += `
      <strong>初始登记页码：</strong><span style="text-decoration: line-through; color:#999;">第 ${currentSong.originalPageNumber} 页</span><br>
      <strong>当前有效页码：</strong><span style="color:#52c41a; font-weight:600;">第 ${currentSong.pageNumber} 页</span><br>
      <span style="color:#1890ff; font-size:12px;">（已按${currentSong.isDemoType === 'supplement' ? '调音师留言' : '票务复核'}修正）</span>
    `;
  } else {
    authHtml += `<strong>登记页码：</strong>第 ${currentSong.pageNumber} 页`;
    if (currentSong.pageNumber !== currentSong.correctPageNumber) {
      authHtml += `<br><span style="color:#fa8c16"><strong>正确页码：</strong>第 ${currentSong.correctPageNumber} 页（待复核）</span>`;
    }
  }
  
  document.getElementById('authInfo').innerHTML = authHtml;

  document.getElementById('noteInfo').textContent = currentSong.engineerNote;

  const groupCard = document.getElementById('groupCard');
  if (currentSong.groupMessage) {
    groupCard.style.display = '';
    document.getElementById('groupInfo').textContent = currentSong.groupMessage;
  } else {
    groupCard.style.display = 'none';
  }

  updateRevenueTable();
}

function updateRevenueTable() {
  if (!currentSong) return;
  
  const revenue = calculateRevenue(currentSong);
  document.getElementById('composerPercent').textContent = currentSong.revenueSplit.composer + '%';
  document.getElementById('composerAmount').textContent = revenue.composer.toLocaleString();
  document.getElementById('lyricistPercent').textContent = currentSong.revenueSplit.lyricist + '%';
  document.getElementById('lyricistAmount').textContent = revenue.lyricist.toLocaleString();
  document.getElementById('publisherPercent').textContent = currentSong.revenueSplit.publisher + '%';
  document.getElementById('publisherAmount').textContent = revenue.publisher.toLocaleString();
  document.getElementById('totalAmount').textContent = revenue.total.toLocaleString();
}

function updateStepIndicator() {
  for (let i = 1; i <= 3; i++) {
    const stepEl = document.getElementById('step' + i);
    stepEl.classList.remove('active', 'completed');
    
    if (i < currentStep) {
      stepEl.classList.add('completed');
    } else if (i === currentStep) {
      stepEl.classList.add('active');
    }
  }

  const lines = document.querySelectorAll('.step-line');
  lines.forEach((line, index) => {
    if (index + 1 < currentStep) {
      line.classList.add('completed');
    } else {
      line.classList.remove('completed');
    }
  });

  const btn = document.getElementById('nextStepBtn');
  if (!currentSong) {
    btn.disabled = true;
    btn.textContent = '请先选择曲目';
  } else if (isSongCompleted(currentSong)) {
    btn.disabled = true;
    btn.textContent = '流程已完成';
  } else {
    btn.disabled = false;
    btn.textContent = getNextStepLabel();
  }
}

function getNextStepLabel() {
  if (!currentSong) return '下一步';
  
  if (currentSong.isDemoType === 'smooth') {
    if (currentStep === 0) return '第一步：导入授权期限页';
    if (currentStep === 1) return '第二步：核对调音师留言';
    if (currentStep === 2) return '第三步：更新分账明细';
  }
  
  if (currentSong.isDemoType === 'group') {
    if (currentStep === 0) return '第一步：导入授权期限页';
    if (currentStep === 1) return '第二步：核对调音师留言（发现群通知）';
    if (currentStep === 2) return '第三步：转票务同事复核';
    if (currentStep === 3) return '第四步：人工修正页码';
    if (currentStep === 4) return '第五步：更新分账并重跑';
  }
  
  if (currentSong.isDemoType === 'supplement') {
    if (currentStep === 0) return '第一步：导入授权期限页';
    if (currentStep === 1) return '第二步：核对调音师留言（发现补记）';
    if (currentStep === 2) return '第三步：按留言修正并更新分账';
  }
  
  return '下一步';
}

function handleNextStep() {
  if (!currentSong) return;
  
  if (currentSong.isDemoType === 'smooth') {
    handleSmoothFlow();
  } else if (currentSong.isDemoType === 'group') {
    handleGroupFlow();
  } else if (currentSong.isDemoType === 'supplement') {
    handleSupplementFlow();
  }
  
  renderSongDetail();
  updateStepIndicator();
  renderHistory();
}

function handleSmoothFlow() {
  if (currentStep === 0) {
    step1_ImportAuthorization(currentSong);
    currentStep = 1;
  } else if (currentStep === 1) {
    step2_CheckEngineerNote(currentSong);
    currentStep = 2;
  } else if (currentStep === 2) {
    step4_UpdateRevenueSplit(currentSong);
    currentStep = 3;
  }
}

function handleGroupFlow() {
  if (currentStep === 0) {
    step1_ImportAuthorization(currentSong);
    currentStep = 1;
  } else if (currentStep === 1) {
    step2_CheckEngineerNote(currentSong);
    currentStep = 2;
  } else if (currentStep === 2) {
    currentStep = 3;
  } else if (currentStep === 3) {
    step3_ReviewByTicketing(currentSong);
    currentStep = 4;
  } else if (currentStep === 4) {
    step4_UpdateRevenueSplit(currentSong);
    step5_ReRun(currentSong);
    currentStep = 5;
  }
}

function handleSupplementFlow() {
  if (currentStep === 0) {
    step1_ImportAuthorization(currentSong);
    currentStep = 1;
  } else if (currentStep === 1) {
    step2_CheckEngineerNote(currentSong);
    currentStep = 2;
  } else if (currentStep === 2) {
    step4_UpdateRevenueSplit(currentSong);
    currentStep = 3;
  }
}

function isSongCompleted(song) {
  if (song.isDemoType === 'smooth') return currentStep >= 3;
  if (song.isDemoType === 'group') return currentStep >= 5;
  if (song.isDemoType === 'supplement') return currentStep >= 3;
  return false;
}

function renderHistory() {
  const container = document.getElementById('historyList');
  
  if (demoData.auditLogs.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无操作记录，点击"下一步"开始演示流程</div>';
    return;
  }

  container.innerHTML = '';
  demoData.auditLogs.forEach(log => {
    const div = document.createElement('div');
    div.className = 'history-item ' + getSongById(log.songId).isDemoType;
    div.innerHTML = `
      <div class="history-header">
        <span class="history-song">${log.songName} (${log.songId})</span>
        <span class="history-time">${log.timestamp}</span>
      </div>
      <div class="history-action">${log.action}</div>
      <div class="history-note">${log.note}</div>
      <div class="history-operator">操作人：${log.operator}</div>
    `;
    container.appendChild(div);
  });
}

function getSongById(id) {
  return demoData.songs.find(s => s.id === id);
}

function resetDemo() {
  initDemoData();
  currentSong = null;
  currentStep = 0;
  renderSongsList();
  document.getElementById('currentSongName').textContent = '选择曲目开始演示';
  document.getElementById('currentStatus').textContent = '';
  document.getElementById('currentStatus').className = 'status-badge';
  document.getElementById('authInfo').textContent = '-';
  document.getElementById('noteInfo').textContent = '-';
  document.getElementById('groupCard').style.display = 'none';
  document.getElementById('composerPercent').textContent = '-';
  document.getElementById('composerAmount').textContent = '-';
  document.getElementById('lyricistPercent').textContent = '-';
  document.getElementById('lyricistAmount').textContent = '-';
  document.getElementById('publisherPercent').textContent = '-';
  document.getElementById('publisherAmount').textContent = '-';
  document.getElementById('totalAmount').textContent = '-';
  updateStepIndicator();
  renderHistory();
}

async function runAllSongs() {
  resetDemo();
  
  for (let i = 0; i < demoData.songs.length; i++) {
    selectSong(i);
    await sleep(500);
    
    while (!isSongCompleted(currentSong)) {
      handleNextStep();
      renderSongDetail();
      updateStepIndicator();
      renderHistory();
      await sleep(800);
    }
  }
  
  currentSong = null;
  renderSongsList();
  document.getElementById('currentSongName').textContent = '所有曲目流程已跑完！';
  updateStepIndicator();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
