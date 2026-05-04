class BandRehearsalReviewApp {
  constructor() {
    this.currentProjectId = null;
    this.currentProjectData = null;
    this.currentAnalysis = null;
    this.currentFilters = {};
    this.currentPage = 'projects';
    this.trendChart = null;
    this.errorTypeChart = null;
    this.validationData = null;
    this.currentAnnotationItemId = null;
    this.currentAnnotationMarker = 'none';
    
    this.init();
  }

  init() {
    this.bindNavigation();
    this.bindEvents();
    this.loadProjects();
  }

  bindNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const page = btn.dataset.page;
        this.navigateTo(page);
      });
    });
  }

  navigateTo(page) {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });

    document.querySelectorAll('.page').forEach(p => {
      p.classList.remove('active');
    });
    document.getElementById(`page-${page}`).classList.add('active');

    this.currentPage = page;

    if (this.currentProjectId) {
      switch (page) {
        case 'dashboard':
          this.loadAnalysis();
          break;
        case 'compare':
          this.loadComparePage();
          break;
        case 'practice':
          this.loadPracticeList();
          break;
        case 'export':
          this.loadExportPage();
          break;
      }
    }
  }

  bindEvents() {
    document.getElementById('currentProjectSelect').addEventListener('change', (e) => {
      if (e.target.value) {
        this.selectProject(e.target.value);
      }
    });

    document.getElementById('validateBtn').addEventListener('click', () => this.validateFiles());
    document.getElementById('importBtn').addEventListener('click', () => this.importFiles());

    const fileInputs = ['sessionsFile', 'setlistFile', 'takesFile', 'pitchBeatFile'];
    fileInputs.forEach(id => {
      document.getElementById(id).addEventListener('change', (e) => {
        const statusId = id.replace('File', 'Status');
        const status = document.getElementById(statusId);
        if (e.target.files.length > 0) {
          status.textContent = e.target.files[0].name;
          status.classList.add('valid');
          status.classList.remove('invalid');
        } else {
          status.textContent = '未选择';
          status.classList.remove('valid', 'invalid');
        }
      });
    });

    document.getElementById('applyFilters').addEventListener('click', () => this.applyFilters());
    document.getElementById('resetFilters').addEventListener('click', () => this.resetFilters());

    document.getElementById('compareBtn').addEventListener('click', () => this.runComparison());

    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });
    document.getElementById('saveAnnotation').addEventListener('click', () => this.saveAnnotation());

    document.querySelectorAll('.mark-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mark-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentAnnotationMarker = btn.dataset.type;
      });
    });

    document.querySelectorAll('.format-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.previewReport(btn.dataset.format);
      });
    });
  }

  async loadProjects() {
    try {
      const response = await fetch('/api/projects');
      const result = await response.json();
      
      if (result.success) {
        this.renderProjects(result.data);
        this.updateProjectSelector(result.data);
      }
    } catch (error) {
      this.showToast('加载项目失败', 'error');
      console.error(error);
    }
  }

  renderProjects(projects) {
    const grid = document.getElementById('projectsGrid');
    
    if (projects.length === 0) {
      grid.innerHTML = `
        <div class="project-card" style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
          <p>暂无项目</p>
          <p style="margin-top: 1rem; color: var(--text-secondary);">点击"导入数据"创建新项目，或加载示例数据</p>
          <button class="btn btn-primary" style="margin-top: 1rem;" onclick="app.useSampleData()">使用示例数据</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = projects.map(p => `
      <div class="project-card ${p.isSample ? 'sample' : ''}" data-id="${p.id}">
        ${p.isSample ? '<span style="position: absolute; top: 0.5rem; right: 0.5rem; background: var(--primary-color); color: white; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">示例</span>' : ''}
        <h3>${p.name}</h3>
        <p>创建时间: ${new Date(p.createdAt).toLocaleString()}</p>
        <p>更新时间: ${new Date(p.updatedAt).toLocaleString()}</p>
        <div class="project-actions">
          <button class="btn btn-primary" onclick="app.selectProject('${p.id}')">打开</button>
          ${!p.isSample ? `<button class="btn btn-secondary" onclick="event.stopPropagation(); app.deleteProject('${p.id}')">删除</button>` : ''}
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.project-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.selectProject(card.dataset.id);
        }
      });
    });
  }

  updateProjectSelector(projects) {
    const select = document.getElementById('currentProjectSelect');
    select.innerHTML = `
      <option value="">选择项目</option>
      ${projects.map(p => `
        <option value="${p.id}" ${p.id === this.currentProjectId ? 'selected' : ''}>
          ${p.name}${p.isSample ? ' (示例)' : ''}
        </option>
      `).join('')}
    `;
  }

  async useSampleData() {
    await this.selectProject('sample');
  }

  async selectProject(projectId) {
    this.currentProjectId = projectId;
    
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const result = await response.json();
      
      if (result.success) {
        this.currentProjectData = result.data;
        document.getElementById('projectSelector').style.display = 'flex';
        document.getElementById('currentProjectSelect').value = projectId;
        
        this.showToast(`已加载项目: ${result.data.name}`, 'success');
        this.navigateTo('dashboard');
      }
    } catch (error) {
      this.showToast('加载项目失败', 'error');
      console.error(error);
    }
  }

  async deleteProject(projectId) {
    if (!confirm('确定要删除这个项目吗？此操作不可撤销。')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      const result = await response.json();
      
      if (result.success) {
        this.showToast('项目已删除', 'success');
        if (this.currentProjectId === projectId) {
          this.currentProjectId = null;
          this.currentProjectData = null;
          document.getElementById('projectSelector').style.display = 'none';
          this.navigateTo('projects');
        }
        this.loadProjects();
      }
    } catch (error) {
      this.showToast('删除失败', 'error');
      console.error(error);
    }
  }

  async validateFiles() {
    const formData = new FormData();
    const fileMap = {
      sessionsFile: 'sessions',
      setlistFile: 'setlist',
      takesFile: 'takes',
      pitchBeatFile: 'pitchBeat'
    };

    let hasFiles = false;
    Object.entries(fileMap).forEach(([inputId, formField]) => {
      const input = document.getElementById(inputId);
      if (input.files.length > 0) {
        formData.append(formField, input.files[0]);
        hasFiles = true;
      }
    });

    if (!hasFiles) {
      this.showToast('请至少选择一个文件', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/validate', {
        method: 'POST',
        body: formData
      });
      const result = await response.json();
      
      if (result.success) {
        this.validationData = result.data;
        this.renderValidationResults(result.data.validation);
        
        if (result.data.validation.overall.valid) {
          document.getElementById('importBtn').disabled = false;
        } else {
          document.getElementById('importBtn').disabled = true;
        }
      }
    } catch (error) {
      this.showToast('校验失败', 'error');
      console.error(error);
    }
  }

  renderValidationResults(validation) {
    const container = document.getElementById('validationContent');
    const resultsDiv = document.getElementById('validationResults');
    resultsDiv.style.display = 'block';

    let html = `
      <div class="validation-item ${validation.overall.valid ? 'success' : 'error'}">
        <strong>总体结果:</strong> ${validation.overall.valid ? '通过' : '失败'}
        <br>错误: ${validation.overall.totalErrors}, 警告: ${validation.overall.totalWarnings}
      </div>
    `;

    const tables = [
      { key: 'sessions', name: 'sessions (排练场次)' },
      { key: 'setlist', name: 'setlist (歌曲列表)' },
      { key: 'takes', name: 'takes (Take记录)' },
      { key: 'pitchBeat', name: 'pitch-beat (音高节拍)' }
    ];

    tables.forEach(({ key, name }) => {
      const result = validation[key];
      if (!result) return;

      html += `<h4 style="margin-top: 1rem;">${name}</h4>`;
      
      if (result.errors && result.errors.length > 0) {
        html += `<div style="margin-bottom: 0.5rem;"><strong>错误:</strong></div>`;
        result.errors.forEach(err => {
          html += `<div class="validation-item error">${err.message}</div>`;
        });
      }

      if (result.warnings && result.warnings.length > 0) {
        html += `<div style="margin-bottom: 0.5rem;"><strong>警告:</strong></div>`;
        result.warnings.forEach(warn => {
          html += `<div class="validation-item warning">${warn.message}</div>`;
        });
      }

      if ((!result.errors || result.errors.length === 0) && 
          (!result.warnings || result.warnings.length === 0)) {
        html += `<div class="validation-item success">校验通过</div>`;
      }
    });

    container.innerHTML = html;
  }

  async importFiles() {
    if (!this.validationData) {
      this.showToast('请先校验数据', 'warning');
      return;
    }

    const projectName = prompt('请输入项目名称:', `排练数据_${new Date().toLocaleDateString()}`);
    if (!projectName) return;

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          data: this.validationData.parsedData
        })
      });
      const result = await response.json();
      
      if (result.success) {
        this.showToast('项目创建成功', 'success');
        this.validationData = null;
        document.getElementById('importBtn').disabled = true;
        document.getElementById('validationResults').style.display = 'none';
        
        ['sessionsFile', 'setlistFile', 'takesFile', 'pitchBeatFile'].forEach(id => {
          document.getElementById(id).value = '';
          const statusId = id.replace('File', 'Status');
          document.getElementById(statusId).textContent = '未选择';
          document.getElementById(statusId).classList.remove('valid', 'invalid');
        });

        this.loadProjects();
        this.selectProject(result.data.id);
      }
    } catch (error) {
      this.showToast('创建项目失败', 'error');
      console.error(error);
    }
  }

  async loadAnalysis() {
    if (!this.currentProjectId) return;

    try {
      const queryString = this.buildFilterQuery();
      const response = await fetch(`/api/projects/${this.currentProjectId}/analysis${queryString}`);
      const result = await response.json();
      
      if (result.success) {
        this.currentAnalysis = result.data;
        this.renderDashboard(result.data);
      }
    } catch (error) {
      this.showToast('加载分析数据失败', 'error');
      console.error(error);
    }
  }

  buildFilterQuery() {
    const params = [];
    const filters = [
      { id: 'filterSessions', key: 'sessionIds' },
      { id: 'filterSongs', key: 'songIds' },
      { id: 'filterSections', key: 'sections' },
      { id: 'filterMusicians', key: 'musicians' },
      { id: 'filterInstruments', key: 'instruments' },
      { id: 'filterErrorTypes', key: 'errorTypes' }
    ];

    filters.forEach(({ id, key }) => {
      const select = document.getElementById(id);
      const selected = Array.from(select.selectedOptions).map(o => o.value);
      if (selected.length > 0) {
        params.push(`${key}=${selected.join(',')}`);
      }
    });

    return params.length > 0 ? `?${params.join('&')}` : '';
  }

  renderDashboard(analysis) {
    this.renderSummary(analysis.summary);
    this.renderHeatmap(analysis.sectionHeatmap);
    this.renderRanking(analysis.musicianRanking);
    this.renderTrendChart(analysis.trendData);
    this.renderErrorTypeChart(analysis.summary);
    this.renderFilters(analysis.availableFilters);
    this.renderDataTable(analysis);
  }

  renderSummary(summary) {
    document.getElementById('totalErrors').textContent = summary.totalErrors;
    document.getElementById('pitchErrors').textContent = summary.pitchErrors;
    document.getElementById('beatErrors').textContent = summary.beatErrors;
    document.getElementById('severeErrors').textContent = summary.severeTotal;
  }

  renderHeatmap(heatmapData) {
    const container = document.getElementById('sectionHeatmap');
    container.innerHTML = heatmapData.map(item => {
      const intensity = item.intensity;
      const r = Math.round(255 - intensity * 100);
      const g = Math.round(255 - intensity * 150);
      const b = 255;
      return `
        <div class="heatmap-item" style="background: rgb(${r}, ${g}, ${b});" data-section="${item.section}">
          <div class="section">${item.section}</div>
          <div class="count">${item.count}</div>
          <div class="percent">${item.percentage}%</div>
        </div>
      `;
    }).join('');
  }

  renderRanking(ranking) {
    const container = document.getElementById('musicianRanking');
    container.innerHTML = ranking.map((m, idx) => `
      <div class="ranking-item">
        <div class="rank">${idx + 1}</div>
        <div class="info">
          <div class="name">${m.musician}</div>
          <div class="details">${m.instruments.join(', ')}</div>
        </div>
        <div class="stats">
          <div class="total">${m.totalErrors}</div>
          <div class="breakdown">音准: ${m.pitchErrors} | 节奏: ${m.beatErrors}</div>
        </div>
      </div>
    `).join('');
  }

  renderTrendChart(trendData) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    if (this.trendChart) {
      this.trendChart.destroy();
    }

    this.trendChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: trendData.map(d => d.sessionId),
        datasets: [
          {
            label: '总错误数',
            data: trendData.map(d => d.totalErrors),
            borderColor: '#4f46e5',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            fill: true,
            tension: 0.3
          },
          {
            label: '音准问题',
            data: trendData.map(d => d.pitchErrors),
            borderColor: '#f5576c',
            backgroundColor: 'transparent',
            tension: 0.3
          },
          {
            label: '节奏问题',
            data: trendData.map(d => d.beatErrors),
            borderColor: '#4facfe',
            backgroundColor: 'transparent',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  renderErrorTypeChart(summary) {
    const ctx = document.getElementById('errorTypeChart').getContext('2d');
    
    if (this.errorTypeChart) {
      this.errorTypeChart.destroy();
    }

    this.errorTypeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['音准问题', '节奏问题'],
        datasets: [{
          data: [summary.pitchErrors, summary.beatErrors],
          backgroundColor: ['#f5576c', '#4facfe'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right'
          }
        }
      }
    });
  }

  renderFilters(filters) {
    const selectMap = {
      filterSessions: filters.sessions,
      filterSections: filters.sections,
      filterMusicians: filters.musicians,
      filterInstruments: filters.instruments
    };

    Object.entries(selectMap).forEach(([id, options]) => {
      const select = document.getElementById(id);
      const currentValues = Array.from(select.selectedOptions).map(o => o.value);
      
      select.innerHTML = options.map(opt => `
        <option value="${opt}" ${currentValues.includes(opt) ? 'selected' : ''}>${opt}</option>
      `).join('');
    });

    const songsSelect = document.getElementById('filterSongs');
    const currentSongs = Array.from(songsSelect.selectedOptions).map(o => o.value);
    songsSelect.innerHTML = filters.songs.map(s => `
      <option value="${s.id}" ${currentSongs.includes(s.id) ? 'selected' : ''}>${s.name}</option>
    `).join('');

    const errorSelect = document.getElementById('filterErrorTypes');
    const currentErrors = Array.from(errorSelect.selectedOptions).map(o => o.value);
    errorSelect.innerHTML = filters.errorTypes.map(e => `
      <option value="${e.type}" ${currentErrors.includes(e.type) ? 'selected' : ''}>${e.name}</option>
    `).join('');
  }

  renderDataTable(analysis) {
    const tbody = document.getElementById('dataTableBody');
    
    if (!this.currentProjectData || !this.currentProjectData.data.pitchBeat) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align: center;">暂无数据</td></tr>';
      return;
    }

    const data = this.currentProjectData.data.pitchBeat;
    const songMap = {};
    if (this.currentProjectData.data.setlist) {
      this.currentProjectData.data.setlist.forEach(s => {
        songMap[s.song_id] = s.song_name;
      });
    }

    const errorTypeNames = {
      pitch_high: '音偏高',
      pitch_low: '音偏低',
      beat_early: '抢拍',
      beat_late: '拖拍',
      timing: '节奏问题',
      other: '其他'
    };

    const markers = analysis.annotations?.markers || {};
    const notes = analysis.annotations?.notes || {};

    const rows = data.slice(0, 50).map((d, idx) => {
      const itemId = `${d.session_id}_${d.song_id}_${d.take_id}_${d.time}_${idx}`;
      const marker = markers[itemId];
      const note = notes[itemId];
      
      const pitchClass = d.pitch_cents > 0 ? 'pitch-high' : (d.pitch_cents < 0 ? 'pitch-low' : '');
      const beatClass = d.beat_ms > 0 ? 'beat-late' : (d.beat_ms < 0 ? 'beat-early' : '');

      let markBadge = '';
      if (marker?.type && marker.type !== 'none') {
        const badgeClass = marker.type.replace('_', '-');
        const markNames = {
          false_positive: '误检',
          need_practice: '需重点练',
          fixed: '已修正'
        };
        markBadge = `<span class="mark-badge ${badgeClass}">${markNames[marker.type] || marker.type}</span>`;
      }

      const notePreview = note ? `<span class="note-preview" title="${note.text}">${note.text.substring(0, 20)}...</span>` : '-';

      return `
        <tr>
          <td>${d.session_id}</td>
          <td>${songMap[d.song_id] || d.song_id}</td>
          <td>${d.section || '-'}</td>
          <td>${d.musician || '-'}</td>
          <td>${d.instrument || '-'}</td>
          <td>${d.time}s</td>
          <td class="${pitchClass}">${d.pitch_cents ? d.pitch_cents + ' cents' : '-'}</td>
          <td class="${beatClass}">${d.beat_ms ? d.beat_ms + ' ms' : '-'}</td>
          <td>${errorTypeNames[d.error_type] || d.error_type}</td>
          <td>${markBadge || '-'}</td>
          <td>${notePreview}</td>
          <td><button class="btn btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="app.openAnnotation('${itemId}')">编辑</button></td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rows;
  }

  applyFilters() {
    this.loadAnalysis();
  }

  resetFilters() {
    const selects = ['filterSessions', 'filterSongs', 'filterSections', 'filterMusicians', 'filterInstruments', 'filterErrorTypes'];
    selects.forEach(id => {
      const select = document.getElementById(id);
      Array.from(select.options).forEach(opt => opt.selected = false);
    });
    this.loadAnalysis();
  }

  async loadComparePage() {
    if (!this.currentProjectId) return;

    try {
      const response = await fetch(`/api/projects/${this.currentProjectId}/filters`);
      const result = await response.json();
      
      if (result.success) {
        const sessions = result.data.sessions;
        const select1 = document.getElementById('compareSession1');
        const select2 = document.getElementById('compareSession2');
        
        const options = sessions.map(s => `<option value="${s}">${s}</option>`).join('');
        select1.innerHTML = `<option value="">选择场次</option>${options}`;
        select2.innerHTML = `<option value="">选择场次</option>${options}`;
      }
    } catch (error) {
      this.showToast('加载对比页面失败', 'error');
      console.error(error);
    }
  }

  async runComparison() {
    const session1 = document.getElementById('compareSession1').value;
    const session2 = document.getElementById('compareSession2').value;

    if (!session1 || !session2) {
      this.showToast('请选择两个场次进行对比', 'warning');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${this.currentProjectId}/compare?session1=${session1}&session2=${session2}`);
      const result = await response.json();
      
      if (result.success) {
        this.renderComparison(result.data);
      }
    } catch (error) {
      this.showToast('对比分析失败', 'error');
      console.error(error);
    }
  }

  renderComparison(comparison) {
    document.getElementById('compareResults').style.display = 'block';

    const cardsHtml = `
      <div class="compare-card ${comparison.improvements.totalErrors <= 0 ? 'improved' : 'worsened'}">
        <div class="label">总错误数</div>
        <div class="value">${comparison.session2.summary.totalErrors}</div>
        <div class="change ${comparison.improvements.totalErrors <= 0 ? 'improved' : 'worsened'}">
          ${comparison.improvements.totalErrors <= 0 ? '↓' : '↑'} ${Math.abs(comparison.improvements.totalErrors)}
        </div>
      </div>
      <div class="compare-card ${comparison.improvements.pitchErrors <= 0 ? 'improved' : 'worsened'}">
        <div class="label">音准问题</div>
        <div class="value">${comparison.session2.summary.pitchErrors}</div>
        <div class="change ${comparison.improvements.pitchErrors <= 0 ? 'improved' : 'worsened'}">
          ${comparison.improvements.pitchErrors <= 0 ? '↓' : '↑'} ${Math.abs(comparison.improvements.pitchErrors)}
        </div>
      </div>
      <div class="compare-card ${comparison.improvements.beatErrors <= 0 ? 'improved' : 'worsened'}">
        <div class="label">节奏问题</div>
        <div class="value">${comparison.session2.summary.beatErrors}</div>
        <div class="change ${comparison.improvements.beatErrors <= 0 ? 'improved' : 'worsened'}">
          ${comparison.improvements.beatErrors <= 0 ? '↓' : '↑'} ${Math.abs(comparison.improvements.beatErrors)}
        </div>
      </div>
    `;
    document.getElementById('compareCards').innerHTML = cardsHtml;

    const sectionsHtml = comparison.sectionComparison.map(s => `
      <div class="compare-list-item">
        <div class="name">${s.section}</div>
        <div class="values">
          <span>${comparison.session1.id}: ${s.count1}</span>
          <span>→</span>
          <span>${comparison.session2.id}: ${s.count2}</span>
          <span class="change ${s.change <= 0 ? 'improved' : 'worsened'}">
            ${s.change <= 0 ? '改善' : '恶化'} (${s.change > 0 ? '+' : ''}${s.change})
          </span>
        </div>
      </div>
    `).join('');
    document.getElementById('sectionComparison').innerHTML = sectionsHtml || '<p>无数据</p>';

    const musiciansHtml = comparison.musicianComparison.map(m => `
      <div class="compare-list-item">
        <div class="name">${m.musician}</div>
        <div class="values">
          <span>${comparison.session1.id}: ${m.count1}</span>
          <span>→</span>
          <span>${comparison.session2.id}: ${m.count2}</span>
          <span class="change ${m.change <= 0 ? 'improved' : 'worsened'}">
            ${m.change <= 0 ? '改善' : '恶化'} (${m.change > 0 ? '+' : ''}${m.change})
          </span>
        </div>
      </div>
    `).join('');
    document.getElementById('musicianComparison').innerHTML = musiciansHtml || '<p>无数据</p>';

    const recurringHtml = comparison.recurringIssues.map(i => `
      <div class="recurring-item">
        <div class="title">${i.songName} - ${i.section} (${i.musician} - ${i.errorTypeName})</div>
        <div class="details">
          ${comparison.session1.id}: ${i.count1} 次 → ${comparison.session2.id}: ${i.count2} 次
        </div>
      </div>
    `).join('');
    document.getElementById('recurringIssues').innerHTML = recurringHtml || '<p>无反复出现的问题</p>';
  }

  async loadPracticeList() {
    if (!this.currentProjectId) return;

    try {
      const response = await fetch(`/api/projects/${this.currentProjectId}/analysis`);
      const result = await response.json();
      
      if (result.success) {
        this.renderPracticeList(result.data.practiceList);
      }
    } catch (error) {
      this.showToast('加载练习清单失败', 'error');
      console.error(error);
    }
  }

  renderPracticeList(practiceList) {
    const container = document.getElementById('practiceListContainer');
    
    const severityLabels = {
      critical: { label: '紧急', class: 'critical' },
      high: { label: '高', class: 'high' },
      medium: { label: '中', class: 'medium' },
      low: { label: '低', class: 'low' }
    };

    container.innerHTML = practiceList.map((item, idx) => {
      const severity = severityLabels[item.severity] || severityLabels.low;
      return `
        <div class="practice-item ${severity.class}">
          <div class="practice-header">
            <h3>${idx + 1}. ${item.songName} - ${item.section}</h3>
            <span class="severity-badge ${severity.class}">${severity.label}</span>
          </div>
          <div class="practice-meta">
            <span>问题次数: <strong>${item.count}</strong></span>
            <span>主要问题: <strong>${item.primaryError.name}</strong></span>
            ${item.primaryMusician ? `<span>主要成员: <strong>${item.primaryMusician}</strong></span>` : ''}
          </div>
          <div class="practice-suggestions">
            <h4>建议练习方法</h4>
            <ul>
              ${item.suggestions.map(s => `<li>${s.text}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }).join('');
  }

  loadExportPage() {
    document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('previewContent').innerHTML = '<p class="text-muted">选择格式后预览报告内容</p>';
  }

  async previewReport(format) {
    if (!this.currentProjectId) {
      this.showToast('请先选择项目', 'warning');
      return;
    }

    try {
      const response = await fetch(`/api/projects/${this.currentProjectId}/export/${format}`);
      
      if (format === 'html') {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.click();
        URL.revokeObjectURL(url);
        document.getElementById('previewContent').innerHTML = '<p class="text-muted">HTML 报告已在新窗口打开</p>';
      } else {
        const content = await response.text();
        document.getElementById('previewContent').textContent = content.substring(0, 5000) + (content.length > 5000 ? '\n... (内容已截断)' : '');
      }
      
      const currentBtn = document.querySelector(`.format-btn[data-format="${format}"]`);
      if (currentBtn) {
        const a = document.createElement('a');
        a.href = `/api/projects/${this.currentProjectId}/export/${format}`;
        a.download = true;
        a.click();
      }
    } catch (error) {
      this.showToast('预览报告失败', 'error');
      console.error(error);
    }
  }

  openAnnotation(itemId) {
    this.currentAnnotationItemId = itemId;
    this.currentAnnotationMarker = 'none';
    
    const markers = this.currentAnalysis?.annotations?.markers || {};
    const notes = this.currentAnalysis?.annotations?.notes || {};
    
    const existingMarker = markers[itemId];
    if (existingMarker && existingMarker.type) {
      this.currentAnnotationMarker = existingMarker.type;
    }
    
    document.querySelectorAll('.mark-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === this.currentAnnotationMarker);
    });

    const existingNote = notes[itemId];
    document.getElementById('noteText').value = existingNote?.text || '';

    document.getElementById('annotationModal').classList.add('active');
  }

  closeModal() {
    document.getElementById('annotationModal').classList.remove('active');
    this.currentAnnotationItemId = null;
  }

  async saveAnnotation() {
    if (!this.currentAnnotationItemId) return;

    try {
      const markerResponse = await fetch(`/api/projects/${this.currentProjectId}/annotations/marker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: this.currentAnnotationItemId,
          markerType: this.currentAnnotationMarker
        })
      });

      const noteText = document.getElementById('noteText').value;
      const noteResponse = await fetch(`/api/projects/${this.currentProjectId}/annotations/note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: this.currentAnnotationItemId,
          text: noteText
        })
      });

      if (markerResponse.ok && noteResponse.ok) {
        this.showToast('保存成功', 'success');
        this.closeModal();
        this.loadAnalysis();
      }
    } catch (error) {
      this.showToast('保存失败', 'error');
      console.error(error);
    }
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠'
    };

    toast.innerHTML = `
      <span class="icon">${icons[type] || '✓'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new BandRehearsalReviewApp();
});
