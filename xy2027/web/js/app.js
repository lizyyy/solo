const app = {
  currentPage: 'index',
  timerInterval: null,
  
  countdown: { time: 1500, duration: 25, running: false, paused: false, currentSession: null },
  stopwatch: { time: 0, running: false, laps: [], currentSession: null },
  pomodoro: { phase: 'work', workDuration: 25, breakDuration: 5, time: 1500, running: false, cycle: 1, completed: 0, currentSession: null },
  
  userInfo: { id: 'user_current', userName: '缝纫爱好者', avatar: '' },

  init() {
    initSampleData();
    this.bindEvents();
    this.loadIndexData();
  },

  bindEvents() {
    document.querySelectorAll('.tab-bar-item').forEach(item => {
      item.addEventListener('click', () => this.navigateTo(item.dataset.page));
    });

    document.querySelectorAll('.action-item, .inventory-item, .stat-card').forEach(item => {
      if (item.dataset.page) item.addEventListener('click', () => this.navigateTo(item.dataset.page));
    });

    document.querySelectorAll('.tab-item[data-tab]').forEach(item => {
      item.addEventListener('click', () => this.switchTimerTab(item.dataset.tab));
    });

    document.querySelectorAll('.tab-item[data-dashboard-tab]').forEach(item => {
      item.addEventListener('click', () => this.switchDashboardTab(item.dataset.dashboard-tab));
    });

    document.getElementById('modal-close').addEventListener('click', () => this.closeModal());
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') this.closeModal();
    });
    document.getElementById('detail-modal-close').addEventListener('click', () => this.closeDetailModal());
    document.getElementById('detail-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'detail-modal-overlay') this.closeDetailModal();
    });

    document.getElementById('add-fabric-btn').addEventListener('click', () => this.showAddFabricModal());
    document.getElementById('add-pattern-btn').addEventListener('click', () => this.showAddPatternModal());
    document.getElementById('add-materials-btn').addEventListener('click', () => this.showAddMaterialsModal());
    document.getElementById('add-tools-btn').addEventListener('click', () => this.showAddToolsModal());
    document.getElementById('add-post-btn').addEventListener('click', () => this.showAddPostModal());

    document.getElementById('countdown-toggle').addEventListener('click', () => this.toggleCountdown());
    document.getElementById('countdown-reset').addEventListener('click', () => this.resetCountdown());
    document.getElementById('countdown-duration').addEventListener('change', (e) => {
      this.countdown.duration = parseInt(e.target.value);
      this.countdown.time = this.countdown.duration * 60;
      document.getElementById('countdown-display').textContent = formatCountdownDisplay(this.countdown.time);
    });

    document.getElementById('stopwatch-toggle').addEventListener('click', () => this.toggleStopwatch());
    document.getElementById('stopwatch-stop').addEventListener('click', () => this.stopStopwatch());
    document.getElementById('stopwatch-lap').addEventListener('click', () => this.lapStopwatch());

    document.getElementById('pomodoro-toggle').addEventListener('click', () => this.togglePomodoro());
    document.getElementById('pomodoro-reset').addEventListener('click', () => this.resetPomodoro());
  },

  navigateTo(page) {
    if (this.currentPage === page) return;
    
    document.querySelectorAll('.tab-bar-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });
    
    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });
    
    this.currentPage = page;
    this.loadPageData(page);
  },

  loadPageData(page) {
    switch(page) {
      case 'index': this.loadIndexData(); break;
      case 'fabric': this.loadFabricList(); break;
      case 'pattern': this.loadPatternList(); break;
      case 'materials': this.loadMaterialsList(); break;
      case 'tools': this.loadToolsList(); break;
      case 'timer': this.loadTimerHistory(); break;
      case 'community': this.loadCommunityPosts(); break;
      case 'dashboard': this.loadDashboardData(); break;
    }
  },

  loadIndexData() {
    const fabrics = getStorageData(STORAGE_KEYS.FABRICS);
    const patterns = getStorageData(STORAGE_KEYS.PATTERNS);
    const materials = getStorageData(STORAGE_KEYS.MATERIALS);
    const tools = getStorageData(STORAGE_KEYS.TOOLS);
    const sessions = getStorageData(STORAGE_KEYS.SEWING_SESSIONS);

    let totalTime = 0;
    sessions.forEach(s => { if (s.completed && s.actualDuration) totalTime += s.actualDuration; });

    let totalInvestment = 0;
    fabrics.forEach(f => totalInvestment += f.totalValue || 0);
    patterns.forEach(p => totalInvestment += p.price || 0);
    materials.forEach(m => totalInvestment += m.totalValue || 0);
    tools.forEach(t => totalInvestment += t.price || 0);

    const hour = new Date().getHours();
    let greeting = '你好';
    if (hour < 6) greeting = '夜深了，注意休息';
    else if (hour < 9) greeting = '早上好';
    else if (hour < 12) greeting = '上午好';
    else if (hour < 14) greeting = '中午好';
    else if (hour < 17) greeting = '下午好';
    else if (hour < 19) greeting = '傍晚好';
    else greeting = '晚上好';

    document.getElementById('greeting').textContent = greeting;
    document.getElementById('total-time').textContent = formatTime(totalTime);
    document.getElementById('total-investment').textContent = '¥' + formatPrice(totalInvestment);
    document.getElementById('fabrics-count').textContent = fabrics.length;
    document.getElementById('patterns-count').textContent = patterns.length;
    document.getElementById('materials-count').textContent = materials.length;
    document.getElementById('tools-count').textContent = tools.length;
  },

  loadFabricList(keyword = '') {
    const fabrics = getStorageData(STORAGE_KEYS.FABRICS);
    const filtered = keyword ? fabrics.filter(f => 
      f.name.toLowerCase().includes(keyword.toLowerCase()) ||
      f.type.toLowerCase().includes(keyword.toLowerCase())
    ) : fabrics;

    const listEl = document.getElementById('fabric-list');
    
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">�</span><span class="empty-text">暂无面料记录</span></div>`;
      return;
    }

    listEl.innerHTML = filtered.map(fabric => `
      <div class="list-item" data-id="${fabric.id}">
        <div class="list-item-header">
          <div class="list-item-title">${fabric.name}</div>
          <div class="list-item-tag tag-info">${fabric.type}</div>
        </div>
        <div class="list-item-content">
          <div class="list-item-info">
            <div class="list-item-row"><span class="list-item-label">颜色:</span><span class="list-item-value">${fabric.color}</span></div>
            <div class="list-item-row"><span class="list-item-label">数量:</span><span class="list-item-value">${fabric.quantity}${fabric.unit}</span></div>
            <div class="list-item-row"><span class="list-item-label">单价:</span><span class="list-item-value">¥${formatPrice(fabric.price)}/${fabric.unit}</span></div>
          </div>
          <div class="list-item-right"><div class="list-item-price">¥${formatPrice(fabric.totalValue)}</div></div>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => this.showFabricDetail(item.dataset.id));
    });

    const searchInput = document.getElementById('fabric-search');
    if (!searchInput.dataset.bound) {
      searchInput.dataset.bound = 'true';
      searchInput.addEventListener('input', (e) => this.loadFabricList(e.target.value));
    }
  },

  loadPatternList(keyword = '') {
    const patterns = getStorageData(STORAGE_KEYS.PATTERNS);
    const filtered = keyword ? patterns.filter(p => 
      p.name.toLowerCase().includes(keyword.toLowerCase())
    ) : patterns;

    const listEl = document.getElementById('pattern-list');
    
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">📐</span><span class="empty-text">暂无纸样记录</span></div>`;
      return;
    }

    listEl.innerHTML = filtered.map(pattern => {
      let statusClass = 'tag-warning';
      if (pattern.status === '已完成') statusClass = 'tag-success';
      else if (pattern.status === '进行中') statusClass = 'tag-info';

      return `
        <div class="list-item" data-id="${pattern.id}">
          <div class="list-item-header">
            <div class="list-item-title">${pattern.name}</div>
            <div class="list-item-tag ${statusClass}">${pattern.status}</div>
          </div>
          <div class="list-item-content">
            <div class="list-item-info">
              <div class="list-item-row"><span class="list-item-label">类型:</span><span class="list-item-value">${pattern.type}</span></div>
              <div class="list-item-row"><span class="list-item-label">难度:</span><span class="list-item-value">${pattern.difficulty}</span></div>
            </div>
            <div class="list-item-right">${pattern.price ? `<div class="list-item-price">¥${formatPrice(pattern.price)}</div>` : ''}</div>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => this.showPatternDetail(item.dataset.id));
    });

    const searchInput = document.getElementById('pattern-search');
    if (!searchInput.dataset.bound) {
      searchInput.dataset.bound = 'true';
      searchInput.addEventListener('input', (e) => this.loadPatternList(e.target.value));
    }
  },

  loadMaterialsList(keyword = '') {
    const materials = getStorageData(STORAGE_KEYS.MATERIALS);
    const filtered = keyword ? materials.filter(m => 
      m.name.toLowerCase().includes(keyword.toLowerCase())
    ) : materials;

    const listEl = document.getElementById('materials-list');
    
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">🔗</span><span class="empty-text">暂无辅料记录</span></div>`;
      return;
    }

    listEl.innerHTML = filtered.map(material => {
      const isLowStock = material.quantity <= (material.minimumStock || 5);
      return `
        <div class="list-item" data-id="${material.id}">
          <div class="list-item-header">
            <div class="list-item-title">${material.name}</div>
            <div class="list-item-tag tag-info">${material.type}</div>
          </div>
          <div class="list-item-content">
            <div class="list-item-info">
              <div class="list-item-row">
                <span class="list-item-label">库存:</span>
                <span class="list-item-value ${isLowStock ? 'low-stock' : ''}">${material.quantity}${material.unit}</span>
                ${isLowStock ? '<span style="font-size:11px;color:#dc3545;margin-left:8px;">库存不足</span>' : ''}
              </div>
              ${material.brand ? `<div class="list-item-row"><span class="list-item-label">品牌:</span><span class="list-item-value">${material.brand}</span></div>` : ''}
            </div>
            <div class="list-item-right"><div class="list-item-price">¥${formatPrice(material.totalValue)}</div></div>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => this.showMaterialDetail(item.dataset.id));
    });

    const searchInput = document.getElementById('materials-search');
    if (!searchInput.dataset.bound) {
      searchInput.dataset.bound = 'true';
      searchInput.addEventListener('input', (e) => this.loadMaterialsList(e.target.value));
    }
  },

  loadToolsList(keyword = '') {
    const tools = getStorageData(STORAGE_KEYS.TOOLS);
    const filtered = keyword ? tools.filter(t => 
      t.name.toLowerCase().includes(keyword.toLowerCase())
    ) : tools;

    const listEl = document.getElementById('tools-list');
    
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">🔧</span><span class="empty-text">暂无工具记录</span></div>`;
      return;
    }

    listEl.innerHTML = filtered.map(tool => {
      let statusClass = 'tag-success';
      if (tool.status === '维修中') statusClass = 'tag-warning';
      else if (tool.status === '待维护' || tool.status === '损坏') statusClass = 'tag-danger';

      let icon = '🔧';
      if (tool.type === '缝纫机') icon = '<svg width="20" height="20" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="32" width="48" height="20" rx="4" fill="#FFD93D"/><rect x="28" y="8" width="16" height="28" rx="4" fill="#FFD93D"/><rect x="24" y="28" width="24" height="8" rx="2" fill="#FFD93D"/><circle cx="36" cy="16" r="8" fill="#FF6B6B"/><circle cx="36" cy="16" r="3" fill="#EE5A5A"/><rect x="34" y="32" width="4" height="6" fill="#333"/><circle cx="36" cy="42" r="2" fill="#333"/><rect x="12" y="36" width="16" height="4" rx="2" fill="#666"/></svg>';
      else if (tool.type === '剪刀') icon = '✂️';

      return `
        <div class="list-item" data-id="${tool.id}">
          <div class="list-item-header">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:24px;">${icon}</span>
              <div>
                <div class="list-item-title">${tool.name}</div>
                ${tool.brand ? `<div style="font-size:12px;color:#999;">${tool.brand}${tool.model ? ' ' + tool.model : ''}</div>` : ''}
              </div>
            </div>
            <div class="list-item-tag ${statusClass}">${tool.status}</div>
          </div>
          <div class="list-item-content">
            <div class="list-item-info">
              <div class="list-item-row"><span class="list-item-label">类型:</span><span class="list-item-value">${tool.type}</span></div>
              ${tool.purchaseDate ? `<div class="list-item-row"><span class="list-item-label">购入:</span><span class="list-item-value">${tool.purchaseDate}</span></div>` : ''}
            </div>
            <div class="list-item-right">${tool.price ? `<div class="list-item-price">¥${formatPrice(tool.price)}</div>` : ''}</div>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => this.showToolDetail(item.dataset.id));
    });

    const searchInput = document.getElementById('tools-search');
    if (!searchInput.dataset.bound) {
      searchInput.dataset.bound = 'true';
      searchInput.addEventListener('input', (e) => this.loadToolsList(e.target.value));
    }
  },

  loadCommunityPosts() {
    const posts = getStorageData(STORAGE_KEYS.COMMUNITY_POSTS).sort((a, b) => b.createTime - a.createTime);
    const listEl = document.getElementById('community-posts');
    
    if (posts.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">📝</span><span class="empty-text">暂无帖子</span></div>`;
      return;
    }

    listEl.innerHTML = posts.map(post => `
      <div class="post-card" data-id="${post.id}">
        <div class="post-header">
          <div class="post-avatar"><span>${post.userName.charAt(0)}</span></div>
          <div class="post-author-info">
            <div class="post-author">${post.userName}</div>
            <div class="post-time">${formatRelativeTime(post.createTime)}</div>
          </div>
        </div>
        <div class="post-content">
          <div class="post-title">${post.title}</div>
          <div class="post-text">${post.content.replace(/\n/g, '<br>')}</div>
        </div>
        ${post.tags && post.tags.length > 0 ? `<div class="post-tags">${post.tags.map(tag => `<span class="post-tag">#${tag}</span>`).join('')}</div>` : ''}
        ${post.commentsList && post.commentsList.length > 0 ? `
          <div class="post-comments-preview">
            ${post.commentsList.slice(0, 2).map(c => `
              <div class="comment-preview">
                <span class="comment-author">${c.author}:</span>
                <span class="comment-text">${c.content}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        <div class="post-footer">
          <div class="post-action ${post.isLiked ? 'liked' : ''}" data-action="like" data-id="${post.id}">
            <span class="post-action-icon">${post.isLiked ? '❤️' : '🤍'}</span>
            <span class="post-action-count">${post.likes}</span>
          </div>
          <div class="post-action" data-action="comment" data-id="${post.id}">
            <span class="post-action-icon">💬</span>
            <span class="post-action-count">${post.comments}</span>
          </div>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.post-card').forEach(card => {
      let clickTimer = null;
      
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="like"]')) {
          this.togglePostLike(card.dataset.id);
          return;
        }
        if (e.target.closest('[data-action="comment"]')) {
          this.showCommentModal(card.dataset.id);
          return;
        }
        
        if (clickTimer) {
          clearTimeout(clickTimer);
          clickTimer = null;
          this.showPostDetail(card.dataset.id);
        } else {
          clickTimer = setTimeout(() => {
            clickTimer = null;
          }, 300);
        }
      });
    });
  },

  loadTimerHistory() {
    const history = getStorageData(STORAGE_KEYS.SEWING_SESSIONS)
      .filter(s => s.completed)
      .sort((a, b) => b.startTime - a.startTime);

    const container = document.getElementById('timer-history');
    
    if (history.length === 0) {
      container.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span><span class="empty-text">暂无计时记录</span></div>`;
      return;
    }

    const typeLabels = { pomodoro: '番茄钟', stopwatch: '正计时', countdown: '倒计时' };
    const typeColors = { pomodoro: '#e74c3c', stopwatch: '#3498DB', countdown: '#ffc107' };

    container.innerHTML = history.map(session => `
      <div class="list-item">
        <div class="list-item-header">
          <div class="list-item-title">${session.projectName || '未命名项目'}</div>
          <div class="list-item-tag" style="background: ${typeColors[session.type]}20; color: ${typeColors[session.type]}">${typeLabels[session.type]}</div>
        </div>
        <div class="list-item-content">
          <div class="list-item-info">
            <div class="list-item-row"><span class="list-item-label">用时:</span><span class="list-item-value">${formatDuration(session.actualDuration)}</span></div>
            <div class="list-item-row"><span class="list-item-label">时间:</span><span class="list-item-value">${formatDateTime(session.startTime)}</span></div>
          </div>
        </div>
      </div>
    `).join('');
  },

  loadDashboardData() {
    const fabrics = getStorageData(STORAGE_KEYS.FABRICS);
    const patterns = getStorageData(STORAGE_KEYS.PATTERNS);
    const materials = getStorageData(STORAGE_KEYS.MATERIALS);
    const tools = getStorageData(STORAGE_KEYS.TOOLS);
    const sessions = getStorageData(STORAGE_KEYS.SEWING_SESSIONS).filter(s => s.completed);
    const posts = getStorageData(STORAGE_KEYS.COMMUNITY_POSTS);

    let totalInvestment = 0;
    fabrics.forEach(f => totalInvestment += f.totalValue || 0);
    patterns.forEach(p => totalInvestment += p.price || 0);
    materials.forEach(m => totalInvestment += m.totalValue || 0);
    tools.forEach(t => totalInvestment += t.price || 0);

    let totalTime = 0;
    sessions.forEach(s => totalTime += s.actualDuration || 0);

    document.getElementById('dash-fabrics').textContent = fabrics.length;
    document.getElementById('dash-patterns').textContent = patterns.length;
    document.getElementById('dash-materials').textContent = materials.length;
    document.getElementById('dash-tools').textContent = tools.length;
    document.getElementById('dash-investment').textContent = '¥' + formatPrice(totalInvestment);
    document.getElementById('dash-sessions').textContent = sessions.length;
    document.getElementById('dash-time').textContent = formatTime(totalTime);
    document.getElementById('dash-posts').textContent = posts.length;

    this.loadPurchaseList();
    this.loadSessionList();
  },

  loadPurchaseList() {
    const purchases = getStorageData(STORAGE_KEYS.PURCHASES).sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));
    const listEl = document.getElementById('purchases-list');
    
    if (purchases.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">📋</span><span class="empty-text">暂无购买记录</span></div>`;
      return;
    }

    const typeLabels = { fabric: '面料', pattern: '纸样', material: '辅料', tool: '工具' };
    const typeColors = { fabric: '#FF6B6B', pattern: '#d4a574', material: '#4ECDC4', tool: '#9B59B6' };

    listEl.innerHTML = purchases.map(p => `
      <div class="list-item">
        <div class="list-item-header">
          <div class="list-item-title">${p.name}</div>
          <div class="list-item-tag" style="background: ${typeColors[p.itemType]}20; color: ${typeColors[p.itemType]}">${typeLabels[p.itemType]}</div>
        </div>
        <div class="list-item-content">
          <div class="list-item-info">
            <div class="list-item-row"><span class="list-item-label">数量:</span><span class="list-item-value">${p.quantity}${p.unit}</span></div>
            <div class="list-item-row"><span class="list-item-label">日期:</span><span class="list-item-value">${p.purchaseDate}</span></div>
          </div>
          <div class="list-item-right"><div class="list-item-price">¥${formatPrice(p.totalAmount)}</div></div>
        </div>
      </div>
    `).join('');
  },

  loadSessionList() {
    const sessions = getStorageData(STORAGE_KEYS.SEWING_SESSIONS)
      .filter(s => s.completed)
      .sort((a, b) => b.startTime - a.startTime);

    const listEl = document.getElementById('sessions-list');
    
    if (sessions.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><span class="empty-icon">⏱️</span><span class="empty-text">暂无缝纫记录</span></div>`;
      return;
    }

    const typeLabels = { pomodoro: '番茄钟', stopwatch: '正计时', countdown: '倒计时' };
    const typeColors = { pomodoro: '#e74c3c', stopwatch: '#3498DB', countdown: '#ffc107' };

    listEl.innerHTML = sessions.map(s => `
      <div class="list-item">
        <div class="list-item-header">
          <div class="list-item-title">${s.projectName || '未命名项目'}</div>
          <div class="list-item-tag" style="background: ${typeColors[s.type]}20; color: ${typeColors[s.type]}">${typeLabels[s.type]}</div>
        </div>
        <div class="list-item-content">
          <div class="list-item-info">
            <div class="list-item-row"><span class="list-item-label">开始:</span><span class="list-item-value">${formatDateTime(s.startTime)}</span></div>
          </div>
          <div class="list-item-right"><div class="list-item-price">${formatDuration(s.actualDuration)}</div></div>
        </div>
      </div>
    `).join('');
  },

  switchTimerTab(tab) {
    document.querySelectorAll('.tab-item[data-tab]').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tab);
    });
    document.querySelectorAll('.timer-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tab}`);
    });
  },

  switchDashboardTab(tab) {
    document.querySelectorAll('.tab-item[data-dashboard-tab]').forEach(item => {
      item.classList.toggle('active', item.dataset.dashboard-tab === tab);
    });
    document.querySelectorAll('.dashboard-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `dashboard-${tab}`);
    });
  },

  toggleCountdown() {
    if (this.countdown.running) {
      this.pauseCountdown();
    } else if (this.countdown.paused) {
      this.resumeCountdown();
    } else {
      this.showCountdownProjectModal();
    }
  },

  showCountdownProjectModal() {
    this.showModal('开始计时', `
      <div class="form-group">
        <label class="form-label">项目名称（选填）</label>
        <input type="text" class="form-input" id="countdown-project-input" placeholder="请输入项目名称">
      </div>
    `, [
      { text: '取消', class: 'btn-outline', action: () => this.closeModal() },
      { text: '开始计时', class: 'btn-primary', action: () => this.startCountdown() }
    ]);
  },

  startCountdown() {
    const projectInput = document.getElementById('countdown-project-input');
    const projectName = projectInput ? projectInput.value.trim() || '未命名项目' : '未命名项目';

    this.countdown.currentSession = {
      id: generateId(),
      projectName: projectName,
      type: 'countdown',
      duration: this.countdown.time,
      startTime: Date.now(),
      actualDuration: 0,
      completed: false,
      createTime: Date.now()
    };

    this.countdown.running = true;
    this.countdown.paused = false;
    this.updateCountdownUI();
    this.closeModal();

    this.timerInterval = setInterval(() => {
      this.countdown.time--;
      document.getElementById('countdown-display').textContent = formatCountdownDisplay(this.countdown.time);
      if (this.countdown.time <= 0) this.completeCountdown();
    }, 1000);
  },

  pauseCountdown() {
    this.countdown.running = false;
    this.countdown.paused = true;
    this.updateCountdownUI();
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  },

  resumeCountdown() {
    this.countdown.running = true;
    this.countdown.paused = false;
    this.updateCountdownUI();
    this.timerInterval = setInterval(() => {
      this.countdown.time--;
      document.getElementById('countdown-display').textContent = formatCountdownDisplay(this.countdown.time);
      if (this.countdown.time <= 0) this.completeCountdown();
    }, 1000);
  },

  resetCountdown() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    this.countdown.time = this.countdown.duration * 60;
    this.countdown.running = false;
    this.countdown.paused = false;
    this.countdown.currentSession = null;
    this.updateCountdownUI();
    document.getElementById('countdown-display').textContent = formatCountdownDisplay(this.countdown.time);
  },

  updateCountdownUI() {
    const btn = document.getElementById('countdown-toggle');
    if (this.countdown.running) {
      btn.classList.add('pause');
      btn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">暂停</span>';
    } else {
      btn.classList.remove('pause');
      btn.innerHTML = `<span class="btn-icon">${this.countdown.paused ? '▶️' : '▶️'}</span><span class="btn-text">${this.countdown.paused ? '继续' : '开始'}</span>`;
    }
  },

  completeCountdown() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }

    if (this.countdown.currentSession) {
      this.countdown.currentSession.actualDuration = this.countdown.currentSession.duration;
      this.countdown.currentSession.endTime = Date.now();
      this.countdown.currentSession.completed = true;

      const sessions = getStorageData(STORAGE_KEYS.SEWING_SESSIONS);
      sessions.push(this.countdown.currentSession);
      setStorageData(STORAGE_KEYS.SEWING_SESSIONS, sessions);
    }

    this.showToast('计时完成！');
    this.resetCountdown();
  },

  toggleStopwatch() {
    if (this.stopwatch.running) {
      this.pauseStopwatch();
    } else if (this.stopwatch.time > 0) {
      this.resumeStopwatch();
    } else {
      this.showStopwatchProjectModal();
    }
  },

  showStopwatchProjectModal() {
    this.showModal('开始计时', `
      <div class="form-group">
        <label class="form-label">项目名称（选填）</label>
        <input type="text" class="form-input" id="stopwatch-project-input" placeholder="请输入项目名称">
      </div>
    `, [
      { text: '取消', class: 'btn-outline', action: () => this.closeModal() },
      { text: '开始计时', class: 'btn-primary', action: () => this.startStopwatch() }
    ]);
  },

  startStopwatch() {
    const projectInput = document.getElementById('stopwatch-project-input');
    const projectName = projectInput ? projectInput.value.trim() || '未命名项目' : '未命名项目';

    this.stopwatch.currentSession = {
      id: generateId(),
      projectName: projectName,
      type: 'stopwatch',
      duration: 0,
      startTime: Date.now(),
      actualDuration: 0,
      completed: false,
      createTime: Date.now()
    };

    this.stopwatch.running = true;
    this.updateStopwatchUI();
    this.closeModal();

    this.timerInterval = setInterval(() => {
      this.stopwatch.time++;
      document.getElementById('stopwatch-display').textContent = formatStopwatchDisplay(this.stopwatch.time);
    }, 1000);
  },

  pauseStopwatch() {
    this.stopwatch.running = false;
    this.updateStopwatchUI();
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  },

  resumeStopwatch() {
    this.stopwatch.running = true;
    this.updateStopwatchUI();
    this.timerInterval = setInterval(() => {
      this.stopwatch.time++;
      document.getElementById('stopwatch-display').textContent = formatStopwatchDisplay(this.stopwatch.time);
    }, 1000);
  },

  stopStopwatch() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }

    if (this.stopwatch.currentSession && this.stopwatch.time > 0) {
      this.stopwatch.currentSession.actualDuration = this.stopwatch.time;
      this.stopwatch.currentSession.endTime = Date.now();
      this.stopwatch.currentSession.completed = true;

      const sessions = getStorageData(STORAGE_KEYS.SEWING_SESSIONS);
      sessions.push(this.stopwatch.currentSession);
      setStorageData(STORAGE_KEYS.SEWING_SESSIONS, sessions);

      this.showToast('记录已保存');
    }

    this.stopwatch.time = 0;
    this.stopwatch.running = false;
    this.stopwatch.laps = [];
    this.stopwatch.currentSession = null;
    this.updateStopwatchUI();
    document.getElementById('stopwatch-display').textContent = '00:00:00';
    document.getElementById('laps-container').innerHTML = '';
  },

  lapStopwatch() {
    if (!this.stopwatch.running) return;
    this.stopwatch.laps.unshift({ index: this.stopwatch.laps.length + 1, time: this.stopwatch.time, display: formatStopwatchDisplay(this.stopwatch.time) });
    const container = document.getElementById('laps-container');
    container.innerHTML = this.stopwatch.laps.map(lap => `
      <div class="lap-item"><span class="lap-index">#${lap.index}</span><span class="lap-time">${lap.display}</span></div>
    `).join('');
  },

  updateStopwatchUI() {
    const btn = document.getElementById('stopwatch-toggle');
    if (this.stopwatch.running) {
      btn.classList.add('pause');
      btn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">暂停</span>';
    } else {
      btn.classList.remove('pause');
      btn.innerHTML = '<span class="btn-icon">▶️</span><span class="btn-text">开始</span>';
    }
  },

  togglePomodoro() {
    if (this.pomodoro.running) {
      this.pausePomodoro();
    } else {
      this.showPomodoroProjectModal();
    }
  },

  showPomodoroProjectModal() {
    this.showModal('开始番茄钟', `
      <div class="form-group">
        <label class="form-label">任务名称（选填）</label>
        <input type="text" class="form-input" id="pomodoro-project-input" placeholder="请输入任务名称">
      </div>
    `, [
      { text: '取消', class: 'btn-outline', action: () => this.closeModal() },
      { text: '开始番茄钟', class: 'btn-primary', action: () => this.startPomodoro() }
    ]);
  },

  startPomodoro() {
    const projectInput = document.getElementById('pomodoro-project-input');
    const projectName = projectInput ? projectInput.value.trim() || '番茄钟任务' : '番茄钟任务';

    this.pomodoro.currentSession = {
      id: generateId(),
      projectName: projectName,
      type: 'pomodoro',
      duration: this.pomodoro.time,
      startTime: Date.now(),
      actualDuration: 0,
      completed: false,
      pomodoroPhase: this.pomodoro.phase,
      pomodoroCycle: this.pomodoro.cycle,
      createTime: Date.now()
    };

    this.pomodoro.running = true;
    this.updatePomodoroUI();
    this.closeModal();

    this.timerInterval = setInterval(() => {
      this.pomodoro.time--;
      document.getElementById('pomodoro-display').textContent = formatCountdownDisplay(this.pomodoro.time);
      if (this.pomodoro.time <= 0) this.completePomodoroPhase();
    }, 1000);
  },

  pausePomodoro() {
    this.pomodoro.running = false;
    this.updatePomodoroUI();
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
  },

  resetPomodoro() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }
    this.pomodoro.phase = 'work';
    this.pomodoro.time = this.pomodoro.workDuration * 60;
    this.pomodoro.running = false;
    this.pomodoro.cycle = 1;
    this.pomodoro.completed = 0;
    this.pomodoro.currentSession = null;
    this.updatePomodoroUI();
    document.getElementById('pomodoro-display').textContent = formatCountdownDisplay(this.pomodoro.time);
  },

  completePomodoroPhase() {
    if (this.timerInterval) { clearInterval(this.timerInterval); this.timerInterval = null; }

    const isWorkPhase = this.pomodoro.phase === 'work';
    
    if (isWorkPhase) {
      this.pomodoro.completed++;
      this.pomodoro.phase = 'break';
      this.pomodoro.time = this.pomodoro.breakDuration * 60;
      
      this.showModal('工作时间结束', `
        <div style="text-align:center;padding:20px;">
          <div style="font-size:48px;margin-bottom:16px;">☕</div>
          <div style="font-size:18px;font-weight:600;margin-bottom:8px;">第 ${this.pomodoro.cycle} 个番茄钟完成！</div>
          <div style="color:#666;">休息 ${this.pomodoro.breakDuration} 分钟吧～</div>
        </div>
      `, [
        { text: '开始休息', class: 'btn-success', action: () => {
          this.closeModal();
          this.pomodoro.running = true;
          this.updatePomodoroUI();
          this.timerInterval = setInterval(() => {
            this.pomodoro.time--;
            document.getElementById('pomodoro-display').textContent = formatCountdownDisplay(this.pomodoro.time);
            if (this.pomodoro.time <= 0) this.completePomodoroPhase();
          }, 1000);
        }}
      ]);
    } else {
      this.pomodoro.cycle++;
      this.pomodoro.phase = 'work';
      this.pomodoro.time = this.pomodoro.workDuration * 60;
      
      this.showModal('休息时间结束', `
        <div style="text-align:center;padding:20px;">
          <div style="font-size:48px;margin-bottom:16px;">🍅</div>
          <div style="font-size:18px;font-weight:600;margin-bottom:8px;">开始第 ${this.pomodoro.cycle} 个番茄钟？</div>
          <div style="color:#666;">工作 ${this.pomodoro.workDuration} 分钟</div>
        </div>
      `, [
        { text: '取消', class: 'btn-outline', action: () => { this.closeModal(); this.updatePomodoroUI(); }},
        { text: '开始', class: 'btn-primary', action: () => {
          this.closeModal();
          this.pomodoro.running = true;
          this.updatePomodoroUI();
          this.timerInterval = setInterval(() => {
            this.pomodoro.time--;
            document.getElementById('pomodoro-display').textContent = formatCountdownDisplay(this.pomodoro.time);
            if (this.pomodoro.time <= 0) this.completePomodoroPhase();
          }, 1000);
        }}
      ]);
    }

    this.updatePomodoroUI();
  },

  updatePomodoroUI() {
    const btn = document.getElementById('pomodoro-toggle');
    const phaseBadge = document.getElementById('pomodoro-phase');
    const phaseLabel = document.getElementById('pomodoro-label');
    const cycleEl = document.getElementById('pomodoro-cycle');
    const completedEl = document.getElementById('pomodoro-completed');

    if (this.pomodoro.phase === 'work') {
      phaseBadge.textContent = '工作中';
      phaseBadge.className = 'status-badge work';
      phaseLabel.textContent = '专注工作';
    } else {
      phaseBadge.textContent = '休息中';
      phaseBadge.className = 'status-badge break';
      phaseLabel.textContent = '放松休息';
    }

    cycleEl.textContent = this.pomodoro.cycle;
    completedEl.textContent = this.pomodoro.completed;

    if (this.pomodoro.running) {
      btn.classList.add('pause');
      btn.innerHTML = '<span class="btn-icon">⏸️</span><span class="btn-text">暂停</span>';
    } else {
      btn.classList.remove('pause');
      btn.innerHTML = '<span class="btn-icon">🍅</span><span class="btn-text">开始番茄钟</span>';
    }
  },

  showModal(title, content, actions = []) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    
    const footer = document.getElementById('modal-footer');
    footer.innerHTML = actions.map((action, index) => 
      `<button class="btn ${action.class}" data-action="${index}">${action.text}</button>`
    ).join('');

    footer.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const actionIndex = parseInt(btn.dataset.action);
        if (actions[actionIndex] && actions[actionIndex].action) actions[actionIndex].action();
      });
    });

    document.getElementById('modal-overlay').classList.remove('hidden');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  },

  showDetailModal(title, content, actions = []) {
    document.getElementById('detail-modal-title').textContent = title;
    document.getElementById('detail-modal-body').innerHTML = content;
    
    const footer = document.getElementById('detail-modal-footer');
    footer.innerHTML = actions.map((action, index) => 
      `<button class="btn ${action.class}" data-action="${index}">${action.text}</button>`
    ).join('');

    footer.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const actionIndex = parseInt(btn.dataset.action);
        if (actions[actionIndex] && actions[actionIndex].action) actions[actionIndex].action();
      });
    });

    document.getElementById('detail-modal-overlay').classList.remove('hidden');
  },

  closeDetailModal() {
    document.getElementById('detail-modal-overlay').classList.add('hidden');
  },

  showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 2000);
  },

  showAddFabricModal() {
    this.showModal('添加面料', `
      <div class="form-group"><label class="form-label">面料名称 *</label><input type="text" class="form-input" id="add-fabric-name" placeholder="请输入面料名称"></div>
      <div class="form-row">
        <div class="form-group" style="flex:1;"><label class="form-label">类型</label>
          <select class="form-select" id="add-fabric-type">
            <option value="纯棉">纯棉</option><option value="牛仔">牛仔</option><option value="丝绸">丝绸</option>
            <option value="麻">麻</option><option value="化纤">化纤</option><option value="针织">针织</option><option value="其他">其他</option>
          </select>
        </div>
        <div class="form-group" style="flex:1;"><label class="form-label">颜色</label><input type="text" class="form-input" id="add-fabric-color" placeholder="颜色"></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1;"><label class="form-label">数量(米) *</label><input type="number" class="form-input" id="add-fabric-quantity" placeholder="数量" step="1" min="1"></div>
        <div class="form-group" style="flex:1;"><label class="form-label">单价(元/米) *</label><input type="number" class="form-input" id="add-fabric-price" placeholder="单价" step="0.01" min="0"></div>
      </div>
      <div class="form-group"><label class="form-label">供应商</label><input type="text" class="form-input" id="add-fabric-supplier" placeholder="供应商"></div>
    `, [
      { text: '取消', class: 'btn-outline', action: () => this.closeModal() },
      { text: '确认添加', class: 'btn-primary', action: () => this.addFabric() }
    ]);
  },

  addFabric() {
    const name = document.getElementById('add-fabric-name').value.trim();
    const type = document.getElementById('add-fabric-type').value;
    const color = document.getElementById('add-fabric-color').value.trim() || '未指定';
    const quantity = parseInt(document.getElementById('add-fabric-quantity').value);
    const price = parseFloat(document.getElementById('add-fabric-price').value);
    const supplier = document.getElementById('add-fabric-supplier').value.trim() || '未指定';

    if (!name || isNaN(quantity) || quantity <= 0 || isNaN(price) || price < 0) {
      this.showToast('请填写必填项');
      return;
    }

    const fabrics = getStorageData(STORAGE_KEYS.FABRICS);
    fabrics.push({
      id: generateId(),
      name, type, color, quantity, unit: '米', price,
      totalValue: quantity * price,
      purchaseDate: formatDate(new Date()),
      supplier, width: 0, thickness: '中厚',
      purpose: '', notes: '', image: '',
      createTime: Date.now(), updateTime: Date.now()
    });
    setStorageData(STORAGE_KEYS.FABRICS, fabrics);

    this.closeModal();
    this.showToast('添加成功');
    this.loadFabricList();
  },

  showAddPatternModal() {
    this.showModal('添加纸样', `
      <div class="form-group"><label class="form-label">纸样名称 *</label><input type="text" class="form-input" id="add-pattern-name" placeholder="请输入纸样名称"></div>
      <div class="form-row">
        <div class="form-group" style="flex:1;"><label class="form-label">类型</label>
          <select class="form-select" id="add-pattern-type">
            <option value="上衣">上衣</option><option value="裤子">裤子</option><option value="连衣裙">连衣裙</option>
            <option value="外套">外套</option><option value="裙子">裙子</option><option value="其他">其他</option>
          </select>
        </div>
        <div class="form-group" style="flex:1;"><label class="form-label">难度</label>
          <select class="form-select" id="add-pattern-difficulty">
            <option value="简单">简单</option><option value="中等">中等</option><option value="困难">困难</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">状态</label>
        <select class="form-select" id="add-pattern-status">
          <option value="待开始">待开始</option><option value="进行中">进行中</option><option value="已完成">已完成</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">价格(元)</label><input type="number" class="form-input" id="add-pattern-price" placeholder="价格" step="0.01"></div>
    `, [
      { text: '取消', class: 'btn-outline', action: () => this.closeModal() },
      { text: '确认添加', class: 'btn-primary', action: () => this.addPattern() }
    ]);
  },

  addPattern() {
    const name = document.getElementById('add-pattern-name').value.trim();
    const type = document.getElementById('add-pattern-type').value;
    const difficulty = document.getElementById('add-pattern-difficulty').value;
    const status = document.getElementById('add-pattern-status').value;
    const price = parseFloat(document.getElementById('add-pattern-price').value) || 0;

    if (!name) {
      this.showToast('请填写纸样名称');
      return;
    }

    const patterns = getStorageData(STORAGE_KEYS.PATTERNS);
    patterns.push({
      id: generateId(),
      name, type, difficulty, status, price,
      sizes: [], fabricType: '', fabricQuantity: 0,
      purchaseDate: formatDate(new Date()), source: '',
      completedProjects: 0, notes: '', image: '',
      createTime: Date.now(), updateTime: Date.now()
    });
    setStorageData(STORAGE_KEYS.PATTERNS, patterns);

    this.closeModal();
    this.showToast('添加成功');
    this.loadPatternList();
  },

  showAddMaterialsModal() {
    this.showModal('添加辅料', `
      <div class="form-group"><label class="form-label">辅料名称 *</label><input type="text" class="form-input" id="add-material-name" placeholder="请输入辅料名称"></div>
      <div class="form-row">
        <div class="form-group" style="flex:1;"><label class="form-label">类型</label>
          <select class="form-select" id="add-material-type">
            <option value="缝纫线">缝纫线</option><option value="拉链">拉链</option><option value="纽扣">纽扣</option>
            <option value="松紧带">松紧带</option><option value="衬布">衬布</option><option value="其他">其他</option>
          </select>
        </div>
        <div class="form-group" style="flex:1;"><label class="form-label">颜色</label><input type="text" class="form-input" id="add-material-color" placeholder="颜色"></div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1;"><label class="form-label">数量 *</label><input type="number" class="form-input" id="add-material-quantity" placeholder="数量" step="1"></div>
        <div class="form-group" style="flex:1;"><label class="form-label">单价(元) *</label><input type="number" class="form-input" id="add-material-price" placeholder="单价" step="0.01"></div>
      </div>
      <div class="form-group"><label class="form-label">最低库存</label><input type="number" class="form-input" id="add-material-minstock" placeholder="最低库存" step="1" value="5"></div>
    `, [
      { text: '取消', class: 'btn-outline', action: () => this.closeModal() },
      { text: '确认添加', class: 'btn-primary', action: () => this.addMaterial() }
    ]);
  },

  addMaterial() {
    const name = document.getElementById('add-material-name').value.trim();
    const type = document.getElementById('add-material-type').value;
    const color = document.getElementById('add-material-color').value.trim() || '未指定';
    const quantity = parseInt(document.getElementById('add-material-quantity').value);
    const price = parseFloat(document.getElementById('add-material-price').value);
    const minStock = parseInt(document.getElementById('add-material-minstock').value) || 5;

    if (!name || isNaN(quantity) || quantity <= 0 || isNaN(price) || price < 0) {
      this.showToast('请填写必填项');
      return;
    }

    const materials = getStorageData(STORAGE_KEYS.MATERIALS);
    materials.push({
      id: generateId(),
      name, type, color, quantity, unit: '件', price,
      totalValue: quantity * price,
      purchaseDate: formatDate(new Date()),
      supplier: '', minimumStock: minStock,
      brand: '', notes: '', image: '',
      createTime: Date.now(), updateTime: Date.now()
    });
    setStorageData(STORAGE_KEYS.MATERIALS, materials);

    this.closeModal();
    this.showToast('添加成功');
    this.loadMaterialsList();
  },

  showAddToolsModal() {
    this.showModal('添加工具', `
      <div class="form-group"><label class="form-label">工具名称 *</label><input type="text" class="form-input" id="add-tool-name" placeholder="请输入工具名称"></div>
      <div class="form-row">
        <div class="form-group" style="flex:1;"><label class="form-label">类型</label>
          <select class="form-select" id="add-tool-type">
            <option value="缝纫机">缝纫机</option><option value="剪刀">剪刀</option><option value="测量工具">测量工具</option>
            <option value="定位工具">定位工具</option><option value="其他">其他</option>
          </select>
        </div>
        <div class="form-group" style="flex:1;"><label class="form-label">状态</label>
          <select class="form-select" id="add-tool-status">
            <option value="正常">正常</option><option value="维修中">维修中</option><option value="待维护">待维护</option><option value="损坏">损坏</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">品牌</label><input type="text" class="form-input" id="add-tool-brand" placeholder="品牌"></div>
      <div class="form-group"><label class="form-label">价格(元)</label><input type="number" class="form-input" id="add-tool-price" placeholder="价格" step="0.01"></div>
    `, [
      { text: '取消', class: 'btn-outline', action: () => this.closeModal() },
      { text: '确认添加', class: 'btn-primary', action: () => this.addTool() }
    ]);
  },

  addTool() {
    const name = document.getElementById('add-tool-name').value.trim();
    const type = document.getElementById('add-tool-type').value;
    const status = document.getElementById('add-tool-status').value;
    const brand = document.getElementById('add-tool-brand').value.trim();
    const price = parseFloat(document.getElementById('add-tool-price').value) || 0;

    if (!name) {
      this.showToast('请填写工具名称');
      return;
    }

    const tools = getStorageData(STORAGE_KEYS.TOOLS);
    tools.push({
      id: generateId(),
      name, type, status, brand, price,
      model: '', purchaseDate: formatDate(new Date()),
      supplier: '', lastMaintenance: '', nextMaintenance: '',
      warrantyExpiry: '', notes: '', image: '',
      createTime: Date.now(), updateTime: Date.now()
    });
    setStorageData(STORAGE_KEYS.TOOLS, tools);

    this.closeModal();
    this.showToast('添加成功');
    this.loadToolsList();
  },

  showAddPostModal() {
    this.showModal('发布帖子', `
      <div class="form-group"><label class="form-label">标题 *</label><input type="text" class="form-input" id="add-post-title" placeholder="请输入标题"></div>
      <div class="form-group"><label class="form-label">内容 *</label><textarea class="form-textarea" id="add-post-content" placeholder="分享你的缝纫作品和心得..."></textarea></div>
      <div class="form-group"><label class="form-label">标签（用逗号分隔）</label><input type="text" class="form-input" id="add-post-tags" placeholder="例如：T恤,新手作品"></div>
    `, [
      { text: '取消', class: 'btn-outline', action: () => this.closeModal() },
      { text: '发布', class: 'btn-primary', action: () => this.addPost() }
    ]);
  },

  addPost() {
    const title = document.getElementById('add-post-title').value.trim();
    const content = document.getElementById('add-post-content').value.trim();
    const tagsInput = document.getElementById('add-post-tags').value.trim();

    if (!title || !content) {
      this.showToast('请填写标题和内容');
      return;
    }

    const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(t => t) : [];

    const posts = getStorageData(STORAGE_KEYS.COMMUNITY_POSTS);
    posts.unshift({
      id: generateId(),
      userId: this.userInfo.id,
      userName: this.userInfo.userName,
      avatar: '', title, content, images: [], tags,
      likes: 0, comments: 0, isLiked: false,
      createTime: Date.now(), commentsList: []
    });
    setStorageData(STORAGE_KEYS.COMMUNITY_POSTS, posts);

    this.closeModal();
    this.showToast('发布成功');
    this.loadCommunityPosts();
  },

  showFabricDetail(id) {
    const fabrics = getStorageData(STORAGE_KEYS.FABRICS);
    const fabric = fabrics.find(f => f.id === id);
    if (!fabric) return;

    const content = `
      <div class="detail-section">
        <div class="detail-title">基本信息</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">名称</span><span class="detail-value">${fabric.name}</span></div>
          <div class="detail-item"><span class="detail-label">类型</span><span class="detail-value">${fabric.type}</span></div>
          <div class="detail-item"><span class="detail-label">颜色</span><span class="detail-value">${fabric.color}</span></div>
          <div class="detail-item"><span class="detail-label">厚度</span><span class="detail-value">${fabric.thickness || '-'}</span></div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-title">库存信息</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">当前数量</span><span class="detail-value">${fabric.quantity}${fabric.unit}</span></div>
          <div class="detail-item"><span class="detail-label">单价</span><span class="detail-value">¥${formatPrice(fabric.price)}/${fabric.unit}</span></div>
          <div class="detail-item"><span class="detail-label">总价值</span><span class="detail-value">¥${formatPrice(fabric.totalValue)}</span></div>
        </div>
      </div>
    `;

    this.showDetailModal('面料详情', content, [
      { text: '使用面料', class: 'btn-secondary', action: () => this.useFabric(id) },
      { text: '删除', class: 'btn-danger', action: () => this.deleteFabric(id) }
    ]);
  },

  useFabric(id) {
    this.closeDetailModal();
    this.showModal('使用面料', `
      <div class="form-group">
        <label class="form-label">请输入使用数量</label>
        <input type="number" class="form-input" id="use-quantity-input" placeholder="请输入使用数量" step="0.1" min="0">
      </div>
    `, [
      { text: '取消', class: 'btn-outline', action: () => this.closeModal() },
      { text: '确认使用', class: 'btn-primary', action: () => {
        const input = document.getElementById('use-quantity-input');
        const quantity = parseFloat(input.value);
        if (isNaN(quantity) || quantity <= 0) {
          this.showToast('请输入有效数量');
          return;
        }

        const fabrics = getStorageData(STORAGE_KEYS.FABRICS);
        const fabric = fabrics.find(f => f.id === id);
        if (!fabric || quantity > fabric.quantity) {
          this.showToast('库存不足');
          return;
        }

        const updated = fabrics.map(f => {
          if (f.id === id) {
            const newQty = f.quantity - quantity;
            return { ...f, quantity: newQty, totalValue: newQty * f.price, updateTime: Date.now() };
          }
          return f;
        });

        setStorageData(STORAGE_KEYS.FABRICS, updated);
        this.showToast(`已使用 ${quantity}${fabric.unit}`);
        this.closeModal();
        this.loadFabricList();
      }}
    ]);
  },

  deleteFabric(id) {
    if (!confirm('确定要删除这个面料记录吗？')) return;
    const fabrics = getStorageData(STORAGE_KEYS.FABRICS);
    const updated = fabrics.filter(f => f.id !== id);
    setStorageData(STORAGE_KEYS.FABRICS, updated);
    this.closeDetailModal();
    this.showToast('删除成功');
    this.loadFabricList();
  },

  showPatternDetail(id) {
    const patterns = getStorageData(STORAGE_KEYS.PATTERNS);
    const pattern = patterns.find(p => p.id === id);
    if (!pattern) return;

    const content = `
      <div class="detail-section">
        <div class="detail-title">基本信息</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">名称</span><span class="detail-value">${pattern.name}</span></div>
          <div class="detail-item"><span class="detail-label">类型</span><span class="detail-value">${pattern.type}</span></div>
          <div class="detail-item"><span class="detail-label">难度</span><span class="detail-value">${pattern.difficulty}</span></div>
          <div class="detail-item"><span class="detail-label">状态</span><span class="detail-value">${pattern.status}</span></div>
        </div>
      </div>
    `;

    const actions = [];
    if (pattern.status !== '待开始') actions.push({ text: '设为待开始', class: 'btn-secondary', action: () => this.updatePatternStatus(id, '待开始') });
    if (pattern.status !== '进行中') actions.push({ text: '开始制作', class: 'btn-info', action: () => this.updatePatternStatus(id, '进行中') });
    if (pattern.status !== '已完成') actions.push({ text: '完成', class: 'btn-success', action: () => this.updatePatternStatus(id, '已完成') });
    actions.push({ text: '删除', class: 'btn-danger', action: () => this.deletePattern(id) });

    this.showDetailModal('纸样详情', content, actions);
  },

  updatePatternStatus(id, status) {
    const patterns = getStorageData(STORAGE_KEYS.PATTERNS);
    const updated = patterns.map(p => p.id === id ? { ...p, status, updateTime: Date.now() } : p);
    setStorageData(STORAGE_KEYS.PATTERNS, updated);
    this.closeDetailModal();
    this.showToast('状态已更新');
    this.loadPatternList();
  },

  deletePattern(id) {
    if (!confirm('确定要删除这个纸样记录吗？')) return;
    const patterns = getStorageData(STORAGE_KEYS.PATTERNS);
    const updated = patterns.filter(p => p.id !== id);
    setStorageData(STORAGE_KEYS.PATTERNS, updated);
    this.closeDetailModal();
    this.showToast('删除成功');
    this.loadPatternList();
  },

  showMaterialDetail(id) {
    const materials = getStorageData(STORAGE_KEYS.MATERIALS);
    const material = materials.find(m => m.id === id);
    if (!material) return;

    const isLowStock = material.quantity <= (material.minimumStock || 5);

    const content = `
      <div class="detail-section">
        <div class="detail-title">基本信息</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">名称</span><span class="detail-value">${material.name}</span></div>
          <div class="detail-item"><span class="detail-label">类型</span><span class="detail-value">${material.type}</span></div>
          ${material.color ? `<div class="detail-item"><span class="detail-label">颜色</span><span class="detail-value">${material.color}</span></div>` : ''}
          ${material.brand ? `<div class="detail-item"><span class="detail-label">品牌</span><span class="detail-value">${material.brand}</span></div>` : ''}
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-title">库存信息</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">当前数量</span><span class="detail-value ${isLowStock ? 'low-stock' : ''}">${material.quantity}${material.unit}</span></div>
          <div class="detail-item"><span class="detail-label">最低库存</span><span class="detail-value">${material.minimumStock || 5}${material.unit}</span></div>
          <div class="detail-item"><span class="detail-label">单价</span><span class="detail-value">¥${formatPrice(material.price)}</span></div>
          <div class="detail-item"><span class="detail-label">总价值</span><span class="detail-value">¥${formatPrice(material.totalValue)}</span></div>
        </div>
      </div>
    `;

    this.showDetailModal('辅料详情', content, [
      { text: '使用辅料', class: 'btn-secondary', action: () => this.useMaterial(id) },
      { text: '删除', class: 'btn-danger', action: () => this.deleteMaterial(id) }
    ]);
  },

  useMaterial(id) {
    this.closeDetailModal();
    this.showModal('使用辅料', `
      <div class="form-group">
        <label class="form-label">请输入使用数量</label>
        <input type="number" class="form-input" id="use-material-quantity" placeholder="请输入使用数量" step="1" min="1">
      </div>
    `, [
      { text: '取消', class: 'btn-outline', action: () => this.closeModal() },
      { text: '确认使用', class: 'btn-primary', action: () => {
        const input = document.getElementById('use-material-quantity');
        const quantity = parseInt(input.value);
        if (isNaN(quantity) || quantity <= 0) {
          this.showToast('请输入有效数量');
          return;
        }

        const materials = getStorageData(STORAGE_KEYS.MATERIALS);
        const material = materials.find(m => m.id === id);
        if (!material || quantity > material.quantity) {
          this.showToast('库存不足');
          return;
        }

        const updated = materials.map(m => {
          if (m.id === id) {
            const newQty = m.quantity - quantity;
            return { ...m, quantity: newQty, totalValue: newQty * m.price, updateTime: Date.now() };
          }
          return m;
        });

        setStorageData(STORAGE_KEYS.MATERIALS, updated);
        this.showToast(`已使用 ${quantity}${material.unit}`);
        this.closeModal();
        this.loadMaterialsList();
      }}
    ]);
  },

  deleteMaterial(id) {
    if (!confirm('确定要删除这个辅料记录吗？')) return;
    const materials = getStorageData(STORAGE_KEYS.MATERIALS);
    const updated = materials.filter(m => m.id !== id);
    setStorageData(STORAGE_KEYS.MATERIALS, updated);
    this.closeDetailModal();
    this.showToast('删除成功');
    this.loadMaterialsList();
  },

  showToolDetail(id) {
    const tools = getStorageData(STORAGE_KEYS.TOOLS);
    const tool = tools.find(t => t.id === id);
    if (!tool) return;

    const content = `
      <div class="detail-section">
        <div class="detail-title">基本信息</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">名称</span><span class="detail-value">${tool.name}</span></div>
          <div class="detail-item"><span class="detail-label">类型</span><span class="detail-value">${tool.type}</span></div>
          ${tool.brand ? `<div class="detail-item"><span class="detail-label">品牌</span><span class="detail-value">${tool.brand}</span></div>` : ''}
          <div class="detail-item"><span class="detail-label">状态</span><span class="detail-value">${tool.status}</span></div>
        </div>
      </div>
      ${tool.price ? `
      <div class="detail-section">
        <div class="detail-title">价格信息</div>
        <div class="detail-grid">
          <div class="detail-item"><span class="detail-label">购入价格</span><span class="detail-value">¥${formatPrice(tool.price)}</span></div>
          ${tool.purchaseDate ? `<div class="detail-item"><span class="detail-label">购入日期</span><span class="detail-value">${tool.purchaseDate}</span></div>` : ''}
        </div>
      </div>` : ''}
    `;

    const actions = [];
    if (tool.status !== '正常') actions.push({ text: '设为正常', class: 'btn-success', action: () => this.updateToolStatus(id, '正常') });
    if (tool.status !== '维修中') actions.push({ text: '送修', class: 'btn-warning', action: () => this.updateToolStatus(id, '维修中') });
    if (tool.status !== '待维护') actions.push({ text: '待维护', class: 'btn-secondary', action: () => this.updateToolStatus(id, '待维护') });
    actions.push({ text: '删除', class: 'btn-danger', action: () => this.deleteTool(id) });

    this.showDetailModal('工具详情', content, actions);
  },

  updateToolStatus(id, status) {
    const tools = getStorageData(STORAGE_KEYS.TOOLS);
    const updated = tools.map(t => t.id === id ? { ...t, status, updateTime: Date.now() } : t);
    setStorageData(STORAGE_KEYS.TOOLS, updated);
    this.closeDetailModal();
    this.showToast('状态已更新');
    this.loadToolsList();
  },

  deleteTool(id) {
    if (!confirm('确定要删除这个工具记录吗？')) return;
    const tools = getStorageData(STORAGE_KEYS.TOOLS);
    const updated = tools.filter(t => t.id !== id);
    setStorageData(STORAGE_KEYS.TOOLS, updated);
    this.closeDetailModal();
    this.showToast('删除成功');
    this.loadToolsList();
  },

  togglePostLike(id) {
    const posts = getStorageData(STORAGE_KEYS.COMMUNITY_POSTS);
    const updated = posts.map(p => {
      if (p.id === id) {
        return {
          ...p,
          isLiked: !p.isLiked,
          likes: p.isLiked ? p.likes - 1 : p.likes + 1,
          updateTime: Date.now()
        };
      }
      return p;
    });
    setStorageData(STORAGE_KEYS.COMMUNITY_POSTS, updated);
    this.loadCommunityPosts();
  },

  showCommentModal(postId) {
    this.currentCommentPostId = postId;
    this.showModal('发表评论', `
      <div class="form-group">
        <label class="form-label">评论内容</label>
        <textarea class="form-textarea" id="comment-content" placeholder="写下你的评论..."></textarea>
      </div>
    `, [
      { text: '取消', class: 'btn-outline', action: () => this.closeModal() },
      { text: '发送', class: 'btn-primary', action: () => this.addComment() }
    ]);
  },

  addComment() {
    const content = document.getElementById('comment-content').value.trim();
    if (!content) {
      this.showToast('请输入评论内容');
      return;
    }

    const posts = getStorageData(STORAGE_KEYS.COMMUNITY_POSTS);
    const updated = posts.map(p => {
      if (p.id === this.currentCommentPostId) {
        const commentsList = p.commentsList || [];
        commentsList.push({
          id: generateId(),
          author: this.userInfo.userName,
          content: content,
          createTime: Date.now()
        });
        return {
          ...p,
          comments: commentsList.length,
          commentsList: commentsList,
          updateTime: Date.now()
        };
      }
      return p;
    });
    setStorageData(STORAGE_KEYS.COMMUNITY_POSTS, updated);
    this.closeModal();
    this.showToast('评论成功');
    this.loadCommunityPosts();
  },

  showPostDetail(postId) {
    const posts = getStorageData(STORAGE_KEYS.COMMUNITY_POSTS);
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const commentsHtml = post.commentsList && post.commentsList.length > 0 
      ? post.commentsList.map(c => `
          <div class="comment-item">
            <div class="comment-header">
              <span class="comment-author">${c.author}</span>
              <span class="comment-time">${formatRelativeTime(c.createTime)}</span>
            </div>
            <div class="comment-text">${c.content}</div>
          </div>
        `).join('')
      : '<div style="text-align:center;color:#999;padding:20px;">暂无评论</div>';

    this.showDetailModal('帖子详情', `
      <div class="detail-section">
        <div class="post-detail-header">
          <div class="post-avatar" style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;margin-right:12px;">
            <span>${post.userName.charAt(0)}</span>
          </div>
          <div>
            <div style="font-weight:600;">${post.userName}</div>
            <div style="font-size:12px;color:#999;">${formatRelativeTime(post.createTime)}</div>
          </div>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-title" style="font-size:18px;font-weight:600;margin-bottom:12px;">${post.title}</div>
        <div style="color:#555;line-height:1.8;">${post.content.replace(/\n/g, '<br>')}</div>
        ${post.tags && post.tags.length > 0 ? `
          <div class="post-tags" style="margin-top:16px;">
            ${post.tags.map(tag => `<span class="post-tag" style="display:inline-block;padding:4px 10px;background:#f0f0f0;border-radius:12px;font-size:12px;color:#666;margin-right:6px;margin-bottom:6px;">#${tag}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      <div class="detail-section">
        <div class="detail-title">全部评论 (${post.comments || 0})</div>
        ${commentsHtml}
      </div>
    `, [
      { text: '关闭', class: 'btn-outline', action: () => this.closeDetailModal() }
    ]);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});