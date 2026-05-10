const API_BASE = '';

let appState = {
  selectedGoals: [],
  borrowingHistory: [],
  books: [],
  parentGoals: [],
  demoScenarios: [],
  rules: [],
  lastResult: null
};

async function initApp() {
  await Promise.all([
    loadParentGoals(),
    loadBooks(),
    loadDemoScenarios(),
    loadRules()
  ]);
  
  bindEvents();
  loadHistory();
}

async function loadParentGoals() {
  const res = await fetch(`${API_BASE}/api/meta/parent-goals`);
  appState.parentGoals = await res.json();
  renderParentGoals();
}

async function loadBooks() {
  const res = await fetch(`${API_BASE}/api/books`);
  const data = await res.json();
  appState.books = data.books;
  renderBookSelect();
}

async function loadDemoScenarios() {
  const res = await fetch(`${API_BASE}/api/demo/scenarios`);
  const data = await res.json();
  appState.demoScenarios = data.scenarios;
  renderDemoScenarios();
}

async function loadRules() {
  const res = await fetch(`${API_BASE}/api/rules/verification`);
  const data = await res.json();
  appState.rules = data.rules;
  renderRules();
}

async function loadHistory() {
  const res = await fetch(`${API_BASE}/api/history`);
  const data = await res.json();
  renderHistoryList(data.records);
}

function renderParentGoals() {
  const container = document.getElementById('parentGoals');
  container.innerHTML = appState.parentGoals.map(goal => `
    <label class="checkbox-item" data-goal="${goal.id}">
      <input type="checkbox" value="${goal.id}" style="display:none">
      ${goal.name}
    </label>
  `).join('');
  
  container.querySelectorAll('.checkbox-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const id = item.dataset.goal;
      if (appState.selectedGoals.includes(id)) {
        appState.selectedGoals = appState.selectedGoals.filter(g => g !== id);
        item.classList.remove('selected');
      } else {
        if (appState.selectedGoals.length < 3) {
          appState.selectedGoals.push(id);
          item.classList.add('selected');
        }
      }
    });
  });
}

function renderBookSelect() {
  const select = document.getElementById('historyBookSelect');
  select.innerHTML = '<option value="">请选择书籍</option>' +
    appState.books.map(book => 
      `<option value="${book.id}">${book.title} (${book.author})</option>`
    ).join('');
}

function renderBorrowingHistory() {
  const container = document.getElementById('borrowingHistory');
  
  if (appState.borrowingHistory.length === 0) {
    container.innerHTML = '<div class="empty-hint">暂无借阅记录</div>';
    return;
  }
  
  container.innerHTML = appState.borrowingHistory.map((record, index) => {
    const book = appState.books.find(b => b.id === record.bookId);
    const stars = record.rating ? '★'.repeat(record.rating) : '未评分';
    return `
      <div class="history-item">
        <div class="history-info">
          <div class="history-title">${book ? book.title : record.bookId}</div>
          <div class="history-meta">${record.borrowDate} · <span class="history-rating">${stars}</span></div>
        </div>
        <button class="remove-history" data-index="${index}">×</button>
      </div>
    `;
  }).join('');
  
  container.querySelectorAll('.remove-history').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(btn.dataset.index);
      appState.borrowingHistory.splice(index, 1);
      renderBorrowingHistory();
    });
  });
}

function renderDemoScenarios() {
  const container = document.getElementById('demoList');
  container.innerHTML = appState.demoScenarios.map(scenario => {
    const isDirtyDemo = scenario.id === 'demo_5';
    const cardClass = isDirtyDemo ? 'demo-card' : 'demo-card';
    return `
      <div class="${cardClass}" data-scenario="${scenario.id}">
        <h3>${scenario.name}</h3>
        <p>${scenario.description}</p>
        <div class="demo-actions">
          <button class="btn btn-secondary" onclick="previewScenario('${scenario.id}')">查看输入</button>
          <button class="btn btn-primary" onclick="runDemoScenario('${scenario.id}')">运行演示</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderRules() {
  const container = document.getElementById('rulesList');
  container.innerHTML = appState.rules.map(rule => `
    <div class="rule-card">
      <div class="rule-header">
        <div>
          <span class="rule-id">${rule.ruleId}</span>
          <span class="rule-name">${rule.ruleName}</span>
        </div>
        <span class="rule-status pending" id="rule-status-${rule.ruleId}">待验证</span>
      </div>
      <div class="rule-description">${rule.description}</div>
      <div class="rule-test-cases">
        ${rule.testCases.map((tc, idx) => `
          <div class="test-case">
            <span>测试用例 ${idx + 1}: ${JSON.stringify(tc).slice(0, 60)}...</span>
            <span class="test-case-result" id="tc-${rule.ruleId}-${idx}">待执行</span>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

function renderHistoryList(records) {
  const container = document.getElementById('historyList');
  
  if (records.length === 0) {
    container.innerHTML = '<div class="empty-hint">暂无推荐历史</div>';
    return;
  }
  
  container.innerHTML = records.map(record => `
    <div class="history-record">
      <div class="record-header">
        <span class="record-id">${record.id}</span>
        <span class="record-status ${record.status}">${record.status === 'completed' ? '成功' : '失败'}</span>
      </div>
      <div class="record-input">
        年龄: ${record.input.childAge} | 
        目标: ${(record.input.parentGoals || []).join(', ') || '无'} | 
        借阅记录: ${record.input.borrowingHistoryCount}条
      </div>
      <div class="record-meta">
        ${new Date(record.timestamp).toLocaleString('zh-CN')} | 
        问题数: ${record.issuesCount}
        ${record.blockedAt ? ` | 卡点: ${record.blockedAt}` : ''}
      </div>
    </div>
  `).join('');
}

function bindEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      switchTab(tab);
    });
  });
  
  document.getElementById('generateBtn').addEventListener('click', generateRecommendation);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  
  document.getElementById('addHistoryBtn').addEventListener('click', openHistoryModal);
  document.querySelector('.modal-close').addEventListener('click', closeHistoryModal);
  document.getElementById('cancelHistoryBtn').addEventListener('click', closeHistoryModal);
  document.getElementById('saveHistoryBtn').addEventListener('click', saveHistoryRecord);
  
  document.getElementById('toggleTraceBtn').addEventListener('click', toggleTrace);
  
  document.getElementById('runAllRulesBtn').addEventListener('click', runAllRules);
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`${tabName}-tab`).classList.add('active');
  
  if (tabName === 'history') {
    loadHistory();
  }
}

function openHistoryModal() {
  document.getElementById('historyModal').classList.remove('hidden');
  document.getElementById('historyDate').valueAsDate = new Date();
}

function closeHistoryModal() {
  document.getElementById('historyModal').classList.add('hidden');
  document.getElementById('historyBookSelect').value = '';
  document.getElementById('historyRating').value = '';
}

function saveHistoryRecord() {
  const bookId = document.getElementById('historyBookSelect').value;
  const borrowDate = document.getElementById('historyDate').value;
  const rating = document.getElementById('historyRating').value;
  
  if (!bookId || !borrowDate) {
    alert('请选择书籍和借阅日期');
    return;
  }
  
  const record = { bookId, borrowDate };
  if (rating) record.rating = parseInt(rating);
  
  appState.borrowingHistory.push(record);
  renderBorrowingHistory();
  closeHistoryModal();
}

function clearAll() {
  document.getElementById('childAge').value = '';
  appState.selectedGoals = [];
  appState.borrowingHistory = [];
  
  document.querySelectorAll('.checkbox-item.selected').forEach(el => {
    el.classList.remove('selected');
  });
  
  renderBorrowingHistory();
  resetPipelineStatus();
  hideAllSections();
}

function resetPipelineStatus() {
  document.querySelectorAll('.pipeline-step').forEach(step => {
    step.classList.remove('active', 'completed', 'blocked');
    const status = step.querySelector('.step-status');
    status.className = 'step-status pending';
    status.textContent = '待执行';
  });
}

function updateStepStatus(stepName, status) {
  const step = document.querySelector(`[data-step="${stepName}"]`);
  if (!step) return;
  
  step.classList.remove('active', 'completed', 'blocked');
  const statusEl = step.querySelector('.step-status');
  statusEl.className = 'step-status';
  
  const statusMap = {
    'in_progress': { class: 'active', text: '处理中...', statusClass: 'in_progress' },
    'completed': { class: 'completed', text: '已完成', statusClass: 'completed' },
    'blocked': { class: 'blocked', text: '被阻断', statusClass: 'blocked' },
    'error': { class: 'blocked', text: '错误', statusClass: 'blocked' }
  };
  
  const s = statusMap[status] || statusMap['in_progress'];
  step.classList.add(s.class);
  statusEl.classList.add(s.statusClass);
  statusEl.textContent = s.text;
}

function hideAllSections() {
  document.getElementById('issuesSection').classList.add('hidden');
  document.getElementById('suggestionsSection').classList.add('hidden');
  document.getElementById('recommendationsSection').classList.add('hidden');
  document.getElementById('traceSection').classList.add('hidden');
}

async function generateRecommendation() {
  const childAge = parseFloat(document.getElementById('childAge').value);
  const parentGoals = appState.selectedGoals.map(id => {
    const goal = appState.parentGoals.find(g => g.id === id);
    return goal ? goal.name : id;
  });
  const borrowingHistory = appState.borrowingHistory;
  
  resetPipelineStatus();
  hideAllSections();
  
  updateStepStatus('input_validation', 'in_progress');
  await sleep(300);
  
  try {
    const res = await fetch(`${API_BASE}/api/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ childAge, parentGoals, borrowingHistory })
    });
    
    const state = await res.json();
    appState.lastResult = state;
    renderResult(state);
    
  } catch (err) {
    console.error(err);
    alert('推荐生成失败，请检查网络连接');
  }
}

function renderResult(state) {
  for (const [stepName, stage] of Object.entries(state.stages)) {
    if (stage.status === 'completed') {
      updateStepStatus(stepName, 'completed');
    }
  }
  
  if (state.blockedAt) {
    updateStepStatus(state.blockedAt, 'blocked');
  }
  
  if (state.issues && state.issues.length > 0) {
    renderIssues(state.issues);
  }
  
  if (state.suggestions && state.suggestions.length > 0) {
    renderSuggestions(state.suggestions);
  }
  
  if (state.finalRecommendations) {
    renderRecommendations(state.finalRecommendations);
  }
  
  if (state.trace && state.trace.length > 0) {
    renderTrace(state.trace);
  }
  
  loadHistory();
}

function renderIssues(issues) {
  const section = document.getElementById('issuesSection');
  const container = document.getElementById('issuesList');
  
  container.innerHTML = issues.map(issue => `
    <div class="issue-item ${issue.type}">
      <div class="issue-header">
        <span>${issue.message}</span>
        <span class="issue-code">${issue.code}</span>
      </div>
      <div class="issue-source">来源: ${issue.source}</div>
      ${issue.suggestion ? `<div class="issue-suggestion">💡 ${issue.suggestion}</div>` : ''}
    </div>
  `).join('');
  
  section.classList.remove('hidden');
}

function renderSuggestions(suggestions) {
  const section = document.getElementById('suggestionsSection');
  const container = document.getElementById('suggestionsList');
  
  container.innerHTML = suggestions.map(suggestion => `
    <div class="suggestion-item">
      <div class="suggestion-priority">${suggestion.priority}</div>
      <div><strong>${suggestion.title}</strong></div>
      <div>${suggestion.message}</div>
      ${suggestion.action ? `<div class="suggestion-action">→ ${suggestion.action}</div>` : ''}
    </div>
  `).join('');
  
  section.classList.remove('hidden');
}

function renderRecommendations(recs) {
  const section = document.getElementById('recommendationsSection');
  
  document.getElementById('recommendationsSummary').innerHTML = `
    <div class="summary-row">
      <span class="summary-label">年龄分层</span>
      <span class="summary-value">${recs.summary.ageTier}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">家长目标</span>
      <span class="summary-value">${recs.summary.parentGoals.join('、') || '未设置'}</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">借阅历史</span>
      <span class="summary-value">${recs.summary.borrowingHistoryCount}条记录</span>
    </div>
    <div class="summary-row">
      <span class="summary-label">推荐书籍</span>
      <span class="summary-value">${recs.recommendedBooks}本 / ${recs.summary.totalBooks}本</span>
    </div>
  `;
  
  document.getElementById('themeGroups').innerHTML = recs.themeGroups.map(group => `
    <div class="theme-group">
      <span class="theme-name">${group.theme}</span>
      <span class="theme-count">${group.books.length}本</span>
    </div>
  `).join('');
  
  document.getElementById('recommendationsList').innerHTML = recs.recommendations.map(book => `
    <div class="book-card">
      <div class="book-header">
        <div class="book-title">${book.title}</div>
        <div class="book-score">${book.finalScore}</div>
      </div>
      <div class="book-author">${book.author}</div>
      <div class="book-themes">
        ${book.themes.map(t => `<span class="book-theme">${t}</span>`).join('')}
      </div>
      <div class="book-score-breakdown">
        <div class="score-row">
          <span>年龄匹配:</span>
          <span>${book.scoreBreakdown.ageMatch}</span>
        </div>
        <div class="score-row">
          <span>目标加权:</span>
          <span>${book.scoreBreakdown.goalBoost}</span>
        </div>
        <div class="score-row">
          <span>历史加权:</span>
          <span>${book.scoreBreakdown.historyBoost}</span>
        </div>
      </div>
      <div class="book-why">
        <div class="book-why-title">推荐理由</div>
        <ul class="book-why-list">
          ${book.whyRecommended.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    </div>
  `).join('');
  
  section.classList.remove('hidden');
}

function renderTrace(trace) {
  const section = document.getElementById('traceSection');
  const container = document.getElementById('traceContent');
  
  const groupedTrace = {};
  trace.forEach(t => {
    const step = t.step || 'other';
    if (!groupedTrace[step]) groupedTrace[step] = [];
    groupedTrace[step].push(t);
  });
  
  container.innerHTML = Object.entries(groupedTrace).map(([step, items]) => `
    <div class="trace-step">
      <div class="trace-step-header">
        <span>步骤: ${step}</span>
        <span class="trace-step-status ${items[0].status || 'skipped'}">${items.length}条记录</span>
      </div>
      <div class="trace-step-details">
        ${items.slice(0, 5).map(item => `
          <div style="margin-bottom: 8px; padding: 8px; background: white; border-radius: 4px;">
            ${item.bookTitle ? `<strong>${item.bookTitle}</strong> - ` : ''}
            ${item.status || item.reason || ''}
            ${item.message ? `<br><span style="color: #666;">${item.message}</span>` : ''}
          </div>
        `).join('')}
        ${items.length > 5 ? `<div style="color: #999; font-size: 11px;">...还有 ${items.length - 5} 条</div>` : ''}
      </div>
    </div>
  `).join('');
  
  section.classList.remove('hidden');
}

function toggleTrace() {
  const content = document.getElementById('traceContent');
  const btn = document.getElementById('toggleTraceBtn');
  
  if (content.classList.contains('hidden')) {
    content.classList.remove('hidden');
    btn.textContent = '收起详情';
  } else {
    content.classList.add('hidden');
    btn.textContent = '展开详情';
  }
}

async function previewScenario(id) {
  const res = await fetch(`${API_BASE}/api/demo/scenarios/${id}`);
  const scenario = await res.json();
  
  alert(`场景: ${scenario.name}\n\n输入参数:\n${JSON.stringify(scenario.input, null, 2)}`);
}

async function runDemoScenario(id) {
  const res = await fetch(`${API_BASE}/api/demo/run/${id}`, { method: 'POST' });
  const data = await res.json();
  
  document.getElementById('childAge').value = data.scenario.input.childAge;
  appState.selectedGoals = [];
  appState.borrowingHistory = data.scenario.input.borrowingHistory || [];
  
  document.querySelectorAll('.checkbox-item').forEach(el => {
    el.classList.remove('selected');
  });
  
  if (data.scenario.input.parentGoals) {
    data.scenario.input.parentGoals.forEach(goalName => {
      const goal = appState.parentGoals.find(g => g.name === goalName);
      if (goal) {
        appState.selectedGoals.push(goal.id);
        const el = document.querySelector(`[data-goal="${goal.id}"]`);
        if (el) el.classList.add('selected');
      }
    });
  }
  
  renderBorrowingHistory();
  switchTab('recommend');
  
  appState.lastResult = data.result;
  renderResult(data.result);
}

async function runAllRules() {
  const testCases = [];
  
  appState.rules.forEach(rule => {
    rule.testCases.forEach(tc => {
      if (rule.ruleId === 'RULE_AGE_01') {
        testCases.push({ type: 'age', ...tc, ruleId: rule.ruleId });
      } else if (rule.ruleId === 'RULE_GOAL_01') {
        testCases.push({ type: 'goal', ...tc, ruleId: rule.ruleId });
      } else if (rule.ruleId === 'RULE_DATA_01') {
        testCases.push({ type: 'dirty_data', ...tc, ruleId: rule.ruleId });
      }
    });
  });
  
  const res = await fetch(`${API_BASE}/api/rules/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ testCases })
  });
  
  const data = await res.json();
  
  const summary = document.getElementById('rulesSummary');
  summary.innerHTML = `
    <div class="rules-summary-row">
      <span>总测试用例:</span>
      <span>${data.summary.total}</span>
    </div>
    <div class="rules-summary-row">
      <span>通过:</span>
      <span style="color: #28a745;">${data.summary.passed}</span>
    </div>
    <div class="rules-summary-row">
      <span>失败:</span>
      <span style="color: #dc3545;">${data.summary.failed}</span>
    </div>
    <div class="rules-summary-row">
      <span>通过率:</span>
      <span class="pass-rate">${data.summary.passRate}</span>
    </div>
  `;
  summary.classList.remove('hidden');
  
  const ruleResults = {};
  data.results.forEach((result, idx) => {
    if (!ruleResults[result.ruleId]) {
      ruleResults[result.ruleId] = { passed: 0, total: 0, results: [] };
    }
    ruleResults[result.ruleId].total++;
    if (result.passed) ruleResults[result.ruleId].passed++;
    ruleResults[result.ruleId].results.push(result);
  });
  
  for (const [ruleId, r] of Object.entries(ruleResults)) {
    const statusEl = document.getElementById(`rule-status-${ruleId}`);
    const allPassed = r.passed === r.total;
    statusEl.className = `rule-status ${allPassed ? 'passed' : 'failed'}`;
    statusEl.textContent = `${r.passed}/${r.total} 通过`;
    
    r.results.forEach((result, idx) => {
      const tcEl = document.getElementById(`tc-${ruleId}-${idx}`);
      if (tcEl) {
        tcEl.textContent = result.passed ? '✓ 通过' : '✗ 失败';
        tcEl.style.color = result.passed ? '#28a745' : '#dc3545';
        tcEl.title = result.message;
      }
    });
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

document.addEventListener('DOMContentLoaded', initApp);
