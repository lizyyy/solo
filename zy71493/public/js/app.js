const API_BASE = '/api';

let currentAnomalyId = null;
let currentCorrection = null;
let questionsCache = [];

const typeLabels = {
  interval: '音程',
  chord: '和弦',
  rhythm: '节奏',
  other: '其他'
};

const anomalyTypeLabels = {
  enharmonic_judge: '等音误判',
  type_misclassify: '题型错归',
  duplicate_unmerged: '重复练习未合并',
  other: '其他'
};

const statusLabels = {
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已驳回',
  resolved: '已解决'
};

const sourceLabels = {
  normal: '正常',
  makeup: '补录',
  withdrawn: '撤回',
  duplicate: '重复'
};

const opLabels = {
  submit: '正常提交',
  makeup: '补录',
  withdraw: '撤回',
  update: '修改',
  retry: '重复练习',
  duplicate: '重复提交'
};

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

async function apiCall(url, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  if (data) {
    options.body = JSON.stringify(data);
  }
  try {
    const response = await fetch(API_BASE + url, options);
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || '请求失败');
    }
    return result;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

async function loadAllData() {
  await Promise.all([
    loadStats(),
    loadErrors(),
    loadAnomalies(),
    loadHistory(),
    loadCorrections(),
    loadAnswers(),
    loadQuestions()
  ]);
}

async function loadStats() {
  try {
    const [errorStats, anomalyStats] = await Promise.all([
      apiCall('/errors/stats'),
      apiCall('/anomalies/stats')
    ]);

    document.getElementById('totalErrors').textContent = errorStats.summary?.total_errors || 0;
    document.getElementById('unresolvedErrors').textContent = errorStats.summary?.total_errors - (errorStats.summary?.total_resolved || 0);
    document.getElementById('pendingAnomalies').textContent = anomalyStats.summary?.pending || 0;

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const monthly = await apiCall(`/corrections/monthly-review?year=${year}&month=${month}`);
    document.getElementById('monthlyCorrections').textContent = monthly.summary?.total_corrections || 0;
  } catch (err) {
    console.error('加载统计数据失败:', err);
  }
}

async function loadErrors() {
  const typeFilter = document.getElementById('errorTypeFilter').value;
  const resolvedFilter = document.getElementById('errorResolvedFilter').value;

  let url = '/errors';
  const params = [];
  if (typeFilter) params.push(`type=${typeFilter}`);
  if (resolvedFilter !== '') params.push(`resolved=${resolvedFilter}`);
  if (params.length) url += '?' + params.join('&');

  const errors = await apiCall(url);
  const tbody = document.getElementById('errorsTableBody');

  if (errors.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-state">暂无错题记录</td></tr>`;
    return;
  }

  tbody.innerHTML = errors.map(e => `
    <tr>
      <td>${e.id}</td>
      <td><span class="badge badge-${e.error_type}">${typeLabels[e.error_type]}</span></td>
      <td>${e.title || '-'}</td>
      <td>${e.error_category}</td>
      <td>${e.student_answer || '-'}</td>
      <td>${e.standard_answer || '-'}</td>
      <td>${e.practice_count}</td>
      <td>${formatDate(e.last_practice_time)}</td>
      <td>${e.is_resolved ? '<span class="badge badge-resolved">已解决</span>' : '<span class="badge badge-pending">未解决</span>'}</td>
      <td><span class="remark-text" title="${escapeHtml(e.remark || '')}">${escapeHtml(e.remark || '-')}</span></td>
      <td>
        ${e.audio_file ? `<span class="audio-player" onclick="playAudio('${e.audio_file}')">▶ 播放</span>` : ''}
        ${!e.is_resolved ? `<button class="btn btn-success btn-sm" onclick="resolveError(${e.id})">标记解决</button>` : ''}
        <button class="btn btn-warning btn-sm" onclick="editError(${e.id})">编辑</button>
        <button class="btn btn-secondary btn-sm" onclick="viewHistory(${e.question_id})">历史</button>
      </td>
    </tr>
  `).join('');
}

async function loadAnomalies() {
  const typeFilter = document.getElementById('anomalyTypeFilter').value;
  const statusFilter = document.getElementById('anomalyStatusFilter').value;

  let url = '/anomalies';
  const params = [];
  if (typeFilter) params.push(`type=${typeFilter}`);
  if (statusFilter) params.push(`status=${statusFilter}`);
  if (params.length) url += '?' + params.join('&');

  const anomalies = await apiCall(url);
  const tbody = document.getElementById('anomaliesTableBody');

  if (anomalies.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">暂无异常记录</td></tr>`;
    return;
  }

  tbody.innerHTML = anomalies.map(a => `
    <tr>
      <td>${a.id}</td>
      <td><span class="badge badge-${a.type}">${anomalyTypeLabels[a.type]}</span></td>
      <td><span class="badge badge-${a.status}">${statusLabels[a.status]}</span></td>
      <td>${a.title || '-'}</td>
      <td>${escapeHtml(a.description)}</td>
      <td><span class="remark-text" title="${escapeHtml(a.detail || '')}">${escapeHtml(a.detail || '-')}</span></td>
      <td>${formatDate(a.created_at)}</td>
      <td>${a.handled_by || '-'}</td>
      <td>
        ${a.status === 'pending' ? `
          <button class="btn btn-success btn-sm" onclick="handleAnomaly(${a.id})">处理</button>
        ` : `
          <button class="btn btn-secondary btn-sm" onclick="viewHistory(${a.question_id})">详情</button>
        `}
      </td>
    </tr>
  `).join('');
}

async function loadHistory() {
  const opFilter = document.getElementById('historyOpFilter').value;
  const search = document.getElementById('historySearch').value;

  let url = '/history';
  const params = [];
  if (opFilter) params.push(`operation_type=${opFilter}`);
  if (params.length) url += '?' + params.join('&');

  let history = await apiCall(url);

  if (search) {
    const searchLower = search.toLowerCase();
    history = history.filter(h =>
      h.title?.toLowerCase().includes(searchLower) ||
      h.student_answer?.toLowerCase().includes(searchLower)
    );
  }

  const tbody = document.getElementById('historyTableBody');

  if (history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="empty-state">暂无练习历史</td></tr>`;
    return;
  }

  tbody.innerHTML = history.map(h => `
    <tr>
      <td>${formatDate(h.operation_time)}</td>
      <td><span class="badge badge-${h.operation_type}">${opLabels[h.operation_type] || h.operation_type}</span></td>
      <td>${h.title || '-'}</td>
      <td>${h.student_answer || '-'}</td>
      <td>${h.is_correct === 1 ? '<span class="badge badge-correct">正确</span>' : h.is_correct === 0 ? '<span class="badge badge-incorrect">错误</span>' : '-'}</td>
      <td>${h.before_data ? `<div class="diff-json">${formatJson(h.before_data)}</div>` : '-'}</td>
      <td>${h.after_data ? `<div class="diff-json">${formatJson(h.after_data)}</div>` : '-'}</td>
      <td><span class="remark-text" title="${escapeHtml(h.remark || '')}">${escapeHtml(h.remark || '-')}</span></td>
    </tr>
  `).join('');
}

async function loadHistoryStats() {
  const panel = document.getElementById('historyStats');
  const stats = await apiCall('/history/stats');

  panel.innerHTML = `
    <h4 style="margin-bottom: 12px;">操作统计</h4>
    <div class="stats-grid">
      ${stats.by_operation.map(s => `
        <div class="stats-card">
          <div class="stats-card-title">${opLabels[s.operation_type] || s.operation_type}</div>
          <div class="stats-card-value">${s.count}</div>
        </div>
      `).join('')}
    </div>
  `;
  panel.classList.remove('hidden');
}

async function loadCorrections() {
  const tableFilter = document.getElementById('correctionTableFilter').value;

  let url = '/corrections';
  if (tableFilter) url += `?target_table=${tableFilter}`;

  const corrections = await apiCall(url);
  const tbody = document.getElementById('correctionsTableBody');

  if (corrections.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">暂无修正记录</td></tr>`;
    return;
  }

  tbody.innerHTML = corrections.map(c => `
    <tr>
      <td>${formatDate(c.corrected_at)}</td>
      <td>${formatTableName(c.target_table)}</td>
      <td>${c.target_id}</td>
      <td>${c.field_name}</td>
      <td><span class="old-value">${escapeHtml(c.old_value === null ? 'NULL' : String(c.old_value))}</span></td>
      <td><span class="new-value">${escapeHtml(c.new_value === null ? 'NULL' : String(c.new_value))}</span></td>
      <td><span class="remark-text" title="${escapeHtml(c.reason || '')}">${escapeHtml(c.reason || '-')}</span></td>
      <td>${c.operator || '-'}</td>
      <td>
        <button class="btn btn-warning btn-sm" onclick="revertCorrection(${c.id})">回滚</button>
      </td>
    </tr>
  `).join('');
}

async function loadMonthlyReview() {
  const panel = document.getElementById('monthlyReview');
  const review = await apiCall('/corrections/monthly-review');

  panel.innerHTML = `
    <h4 style="margin-bottom: 12px;">${review.period} 复盘</h4>
    <div class="stats-grid">
      <div class="stats-card">
        <div class="stats-card-title">总修正次数</div>
        <div class="stats-card-value">${review.summary.total_corrections}</div>
      </div>
      <div class="stats-card">
        <div class="stats-card-title">涉及操作人</div>
        <div class="stats-card-value">${review.summary.unique_operators}</div>
      </div>
    </div>
    <h5 style="margin: 16px 0 8px;">按字段统计</h5>
    <table class="data-table" style="font-size: 12px;">
      <thead>
        <tr>
          <th>表</th>
          <th>字段</th>
          <th>修正次数</th>
          <th>影响记录数</th>
          <th>常见原因</th>
        </tr>
      </thead>
      <tbody>
        ${review.summary.by_field.map(f => `
          <tr>
            <td>${formatTableName(f.target_table)}</td>
            <td>${f.field_name}</td>
            <td>${f.correction_count}</td>
            <td>${f.affected_records}</td>
            <td><span class="remark-text">${escapeHtml(f.reasons || '-')}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  panel.classList.remove('hidden');
}

async function loadAnswers() {
  const sourceFilter = document.getElementById('answerSourceFilter').value;

  let url = '/answers';
  if (sourceFilter) url += `?source=${sourceFilter}`;

  const answers = await apiCall(url);
  const tbody = document.getElementById('answersTableBody');

  if (answers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty-state">暂无答题记录</td></tr>`;
    return;
  }

  tbody.innerHTML = answers.map(a => `
    <tr>
      <td>${a.id}</td>
      <td><span class="badge badge-${a.question_type}">${typeLabels[a.question_type]}</span></td>
      <td>${a.title || '-'}</td>
      <td>${a.student_answer === null ? '<span class="badge badge-missing">缺失</span>' : escapeHtml(a.student_answer)}</td>
      <td>${a.standard_answer || '-'}</td>
      <td>${a.is_correct === 1 ? '<span class="badge badge-correct">正确</span>' : a.is_correct === 0 ? '<span class="badge badge-incorrect">错误</span>' : '-'}</td>
      <td><span class="badge badge-${a.answer_source}">${sourceLabels[a.answer_source]}</span></td>
      <td>${formatDate(a.submit_time)}</td>
      <td>${a.is_missing_fields ? '<span class="badge badge-missing">是</span>' : '否'}</td>
      <td><span class="remark-text" title="${escapeHtml(a.remark || '')}">${escapeHtml(a.remark || '-')}</span></td>
      <td>
        ${a.audio_file ? `<span class="audio-player" onclick="playAudio('${a.audio_file}')">▶ 播放</span>` : ''}
        ${a.answer_source !== 'withdrawn' ? `
          <button class="btn btn-warning btn-sm" onclick="editAnswer(${a.id})">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="withdrawAnswer(${a.id})">撤回</button>
        ` : ''}
        <button class="btn btn-secondary btn-sm" onclick="viewHistory(${a.question_id})">历史</button>
      </td>
    </tr>
  `).join('');
}

async function loadQuestions() {
  const typeFilter = document.getElementById('questionTypeFilter').value;

  let url = '/questions';
  if (typeFilter) url += `?type=${typeFilter}`;

  const questions = await apiCall(url);
  questionsCache = questions;
  const tbody = document.getElementById('questionsTableBody');

  if (questions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-state">暂无题目</td></tr>`;
    return;
  }

  tbody.innerHTML = questions.map(q => `
    <tr>
      <td>${q.id}</td>
      <td><span class="badge badge-${q.question_type}">${typeLabels[q.question_type]}</span></td>
      <td>${escapeHtml(q.title)}</td>
      <td>${q.audio_file ? `<span class="audio-player" onclick="playAudio('${q.audio_file}')">▶ ${escapeHtml(q.audio_file)}</span>` : '-'}</td>
      <td>${escapeHtml(q.standard_answer)}</td>
      <td>${q.difficulty === 'easy' ? '简单' : q.difficulty === 'hard' ? '困难' : '中等'}</td>
      <td>${escapeHtml(q.tags || '-')}</td>
      <td>${formatDate(q.created_at)}</td>
      <td>
        <button class="btn btn-warning btn-sm" onclick="editQuestion(${q.id})">编辑</button>
      </td>
    </tr>
  `).join('');

  const answerQuestionSelect = document.getElementById('answerQuestionId');
  answerQuestionSelect.innerHTML = '<option value="">请选择题目</option>' +
    questions.map(q => `<option value="${q.id}">${q.id} - ${escapeHtml(q.title)} (${typeLabels[q.question_type]})</option>`).join('');
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatTableName(table) {
  const names = {
    answer_records: '答题记录',
    error_records: '错题记录',
    anomalies: '异常记录',
    questions: '题目'
  };
  return names[table] || table;
}

function formatJson(obj) {
  if (typeof obj === 'string') {
    try {
      obj = JSON.parse(obj);
    } catch(e) {
      return obj;
    }
  }
  return JSON.stringify(obj, null, 1);
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function playAudio(filename) {
  const audio = new Audio(`/audio/${filename}`);
  audio.play().catch(err => {
    showToast(`播放失败: ${err.message}`, 'error');
  });
}

function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  document.getElementById(modalId).querySelector('form')?.reset();
}

function openAnswerModal() {
  document.getElementById('answerModalTitle').textContent = '新增答题记录';
  document.getElementById('answerId').value = '';
  document.getElementById('answerStudentAnswer').value = '';
  document.getElementById('answerSource').value = 'normal';
  document.getElementById('answerRemark').value = '';
  document.getElementById('answerCorrectionReason').value = '';
  document.getElementById('answerCorrectionReason').parentElement.style.display = 'none';
  openModal('answerModal');
}

async function editAnswer(id) {
  const answers = await apiCall('/answers');
  const answer = answers.find(a => a.id === id);
  if (!answer) return;

  document.getElementById('answerModalTitle').textContent = '编辑答题记录';
  document.getElementById('answerId').value = answer.id;
  document.getElementById('answerQuestionId').value = answer.question_id;
  document.getElementById('answerStudentAnswer').value = answer.student_answer || '';
  document.getElementById('answerSource').value = answer.answer_source;
  document.getElementById('answerRemark').value = answer.remark || '';
  document.getElementById('answerCorrectionReason').value = '';
  document.getElementById('answerCorrectionReason').parentElement.style.display = 'block';
  openModal('answerModal');
}

async function saveAnswer() {
  const id = document.getElementById('answerId').value;
  const questionId = document.getElementById('answerQuestionId').value;
  const studentAnswer = document.getElementById('answerStudentAnswer').value;
  const source = document.getElementById('answerSource').value;
  const remark = document.getElementById('answerRemark').value;
  const correctionReason = document.getElementById('answerCorrectionReason').value;

  if (!questionId) {
    showToast('请选择题目', 'error');
    return;
  }

  if (id && !correctionReason) {
    showToast('请填写修改理由', 'error');
    return;
  }

  const data = {
    question_id: parseInt(questionId),
    student_answer: studentAnswer || null,
    answer_source: source,
    remark: remark || null,
    correction_reason: correctionReason || null
  };

  if (id) {
    await apiCall(`/answers/${id}`, 'PUT', data);
    showToast('更新成功');
  } else {
    const result = await apiCall('/answers', 'POST', data);
    if (result.is_missing_fields) {
      showToast(result.message, 'warning');
    } else {
      showToast(result.message);
    }
  }

  closeModal('answerModal');
  loadAllData();
}

async function withdrawAnswer(id) {
  if (!confirm('确定要撤回这条答题记录吗？这将同时关联标记错题为已解决。')) return;

  const reason = prompt('请输入撤回理由：', '记录有误，撤回');
  if (reason === null) return;

  await apiCall(`/answers/${id}/withdraw`, 'POST', { reason });
  showToast('撤回成功');
  loadAllData();
}

function openQuestionModal() {
  document.getElementById('questionModalTitle').textContent = '新增题目';
  document.getElementById('questionId').value = '';
  document.getElementById('questionType').value = 'interval';
  document.getElementById('questionTitle').value = '';
  document.getElementById('questionAudioFile').value = '';
  document.getElementById('questionStandardAnswer').value = '';
  document.getElementById('questionDescription').value = '';
  document.getElementById('questionDifficulty').value = 'medium';
  document.getElementById('questionTags').value = '';
  openModal('questionModal');
}

async function editQuestion(id) {
  const question = questionsCache.find(q => q.id === id);
  if (!question) return;

  document.getElementById('questionModalTitle').textContent = '编辑题目';
  document.getElementById('questionId').value = question.id;
  document.getElementById('questionType').value = question.question_type;
  document.getElementById('questionTitle').value = question.title;
  document.getElementById('questionAudioFile').value = question.audio_file || '';
  document.getElementById('questionStandardAnswer').value = question.standard_answer;
  document.getElementById('questionDescription').value = question.description || '';
  document.getElementById('questionDifficulty').value = question.difficulty;
  document.getElementById('questionTags').value = question.tags || '';
  openModal('questionModal');
}

async function saveQuestion() {
  const id = document.getElementById('questionId').value;
  const type = document.getElementById('questionType').value;
  const title = document.getElementById('questionTitle').value;
  const audioFile = document.getElementById('questionAudioFile').value;
  const standardAnswer = document.getElementById('questionStandardAnswer').value;
  const description = document.getElementById('questionDescription').value;
  const difficulty = document.getElementById('questionDifficulty').value;
  const tags = document.getElementById('questionTags').value;

  if (!title || !standardAnswer) {
    showToast('请填写标题和标准答案', 'error');
    return;
  }

  const data = {
    question_type: type,
    title,
    audio_file: audioFile || null,
    standard_answer: standardAnswer,
    description: description || null,
    difficulty,
    tags: tags || null,
    correction_reason: id ? '更新题目信息' : null
  };

  if (id) {
    await apiCall(`/questions/${id}`, 'PUT', data);
    showToast('更新成功');
  } else {
    await apiCall('/questions', 'POST', data);
    showToast('创建成功');
  }

  closeModal('questionModal');
  loadAllData();
}

async function resolveError(id) {
  const note = prompt('请输入解决说明：', '学生已掌握');
  if (note === null) return;

  await apiCall(`/errors/${id}/resolve`, 'POST', { resolved_note: note });
  showToast('标记成功');
  loadAllData();
}

async function editError(id) {
  const errors = await apiCall('/errors');
  const error = errors.find(e => e.id === id);
  if (!error) return;

  const newRemark = prompt('修改备注：', error.remark || '');
  if (newRemark === null) return;

  const reason = prompt('修改理由：', '更新备注信息');
  if (reason === null) return;

  await apiCall(`/errors/${id}`, 'PUT', {
    remark: newRemark,
    correction_reason: reason
  });
  showToast('更新成功');
  loadAllData();
}

async function viewHistory(questionId) {
  document.querySelector('.nav-btn[data-tab="history"]').click();
  document.getElementById('historySearch').value = '';
  await loadHistory();
  showToast(`已显示题目ID: ${questionId} 的所有历史记录`, 'success');
}

async function handleAnomaly(id) {
  currentAnomalyId = id;
  const anomalies = await apiCall('/anomalies');
  const anomaly = anomalies.find(a => a.id === id);
  if (!anomaly) return;

  document.getElementById('anomalyDetails').innerHTML = `
    <div class="detail-row">
      <span class="detail-label">类型：</span>
      <span class="detail-value"><span class="badge badge-${anomaly.type}">${anomalyTypeLabels[anomaly.type]}</span></span>
    </div>
    <div class="detail-row">
      <span class="detail-label">题目：</span>
      <span class="detail-value">${anomaly.title || '-'}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">描述：</span>
      <span class="detail-value">${anomaly.description}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">详情：</span>
      <span class="detail-value">${anomaly.detail || '-'}</span>
    </div>
    ${anomaly.student_answer ? `
    <div class="detail-row">
      <span class="detail-label">学生答案：</span>
      <span class="detail-value old-value">${anomaly.student_answer}</span>
    </div>
    ` : ''}
    ${anomaly.q_standard_answer ? `
    <div class="detail-row">
      <span class="detail-label">标准答案：</span>
      <span class="detail-value new-value">${anomaly.q_standard_answer}</span>
    </div>
    ` : ''}
    ${anomaly.related_answer_ids && Array.isArray(anomaly.related_answer_ids) ? `
    <div class="detail-row">
      <span class="detail-label">关联答题ID：</span>
      <span class="detail-value">${anomaly.related_answer_ids.join(', ')}</span>
    </div>
    ` : ''}
  `;

  document.getElementById('mergeOptions').style.display = anomaly.type === 'duplicate_unmerged' ? 'block' : 'none';
  document.getElementById('anomalyAction').value = 'confirm';
  document.getElementById('anomalyHandleNote').value = '';
  document.getElementById('mergeErrorIds').value = anomaly.related_answer_ids ? anomaly.related_answer_ids.join(',') : '';

  openModal('anomalyModal');
}

async function confirmAnomalyAction() {
  if (!currentAnomalyId) return;

  const action = document.getElementById('anomalyAction').value;
  const handleNote = document.getElementById('anomalyHandleNote').value;
  const mergeIdsStr = document.getElementById('mergeErrorIds').value;
  const mergeErrorIds = mergeIdsStr ? mergeIdsStr.split(',').map(Number) : [];

  let endpoint = `/anomalies/${currentAnomalyId}`;
  let method = 'PUT';
  let data = {
    status: action === 'confirm' ? 'confirmed' : action === 'reject' ? 'rejected' : 'resolved',
    handle_note: handleNote
  };

  if (action === 'confirm') {
    endpoint = `/anomalies/${currentAnomalyId}/confirm`;
    method = 'POST';
  } else if (action === 'reject') {
    endpoint = `/anomalies/${currentAnomalyId}/reject`;
    method = 'POST';
  } else if (action === 'resolve') {
    endpoint = `/anomalies/${currentAnomalyId}/resolve`;
    method = 'POST';
    if (mergeErrorIds.length >= 2) {
      data.merge_error_ids = mergeErrorIds;
    }
  }

  await apiCall(endpoint, method, data);
  showToast('处理成功');
  closeModal('anomalyModal');
  currentAnomalyId = null;
  loadAllData();
}

async function revertCorrection(correctionId) {
  if (!confirm('确定要回滚这条修正记录吗？这将把字段值恢复到旧值。')) return;

  const reason = prompt('请输入回滚理由：', '回滚到之前的状态');
  if (reason === null) return;

  await apiCall('/corrections/revert', 'POST', {
    correction_id: correctionId,
    reason
  });
  showToast('回滚成功');
  loadAllData();
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.dataset.tab;
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });

  document.getElementById('errorTypeFilter').addEventListener('change', loadErrors);
  document.getElementById('errorResolvedFilter').addEventListener('change', loadErrors);
  document.getElementById('anomalyTypeFilter').addEventListener('change', loadAnomalies);
  document.getElementById('anomalyStatusFilter').addEventListener('change', loadAnomalies);
  document.getElementById('historyOpFilter').addEventListener('change', loadHistory);
  document.getElementById('historySearch').addEventListener('input', loadHistory);
  document.getElementById('correctionTableFilter').addEventListener('change', loadCorrections);
  document.getElementById('answerSourceFilter').addEventListener('change', loadAnswers);
  document.getElementById('questionTypeFilter').addEventListener('change', loadQuestions);

  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const modal = e.target.closest('.modal');
      if (modal) modal.classList.remove('active');
    });
  });

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  loadAllData();

  setInterval(loadStats, 30000);
});
