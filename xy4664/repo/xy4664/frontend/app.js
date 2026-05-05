const API_BASE = window.location.origin;

let currentCommentIssue = null;

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initUploadAreas();
  initButtons();
  loadStats();
});

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(targetTab).classList.add('active');

      if (targetTab === 'candidates') {
        loadCandidates();
      }
    });
  });
}

function initUploadAreas() {
  const uploadConfigs = [
    { area: 'uploadCandidates', input: 'fileCandidates', url: '/api/upload/candidates', result: 'resultCandidates' },
    { area: 'uploadInterviews', input: 'fileInterviews', url: '/api/upload/interviews', result: 'resultInterviews' },
    { area: 'uploadAudits', input: 'fileAudits', url: '/api/upload/audit-logs', result: 'resultAudits' },
    { area: 'uploadApprovals', input: 'fileApprovals', url: '/api/upload/offer-approvals', result: 'resultApprovals' }
  ];

  uploadConfigs.forEach(config => {
    const area = document.getElementById(config.area);
    const input = document.getElementById(config.input);
    const resultDiv = document.getElementById(config.result);

    area.addEventListener('click', () => input.click());

    area.addEventListener('dragover', (e) => {
      e.preventDefault();
      area.classList.add('dragover');
    });

    area.addEventListener('dragleave', () => {
      area.classList.remove('dragover');
    });

    area.addEventListener('drop', (e) => {
      e.preventDefault();
      area.classList.remove('dragover');
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files[0], config.url, resultDiv);
      }
    });

    input.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        handleFileUpload(e.target.files[0], config.url, resultDiv);
      }
    });
  });
}

async function handleFileUpload(file, url, resultDiv) {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE}${url}`, {
      method: 'POST',
      body: formData
    });

    const result = await response.json();
    
    if (response.ok && result.success) {
      resultDiv.className = 'upload-result success';
      resultDiv.innerHTML = `✅ 成功导入 ${result.imported}/${result.total} 条记录`;
      if (result.errors.length > 0) {
        resultDiv.innerHTML += `<br>⚠️ ${result.errors.length} 条记录导入失败`;
      }
      loadStats();
    } else {
      resultDiv.className = 'upload-result error';
      resultDiv.innerHTML = `❌ 导入失败: ${result.error || '未知错误'}`;
    }
  } catch (error) {
    resultDiv.className = 'upload-result error';
    resultDiv.innerHTML = `❌ 上传失败: ${error.message}`;
  }
}

function initButtons() {
  document.getElementById('btnRefreshStats').addEventListener('click', loadStats);
  
  document.getElementById('btnClearData').addEventListener('click', async () => {
    if (confirm('确定要清空所有数据吗？此操作不可恢复！')) {
      try {
        const response = await fetch(`${API_BASE}/api/data`, { method: 'DELETE' });
        const result = await response.json();
        if (response.ok) {
          alert('所有数据已清空');
          loadStats();
        } else {
          alert('清空失败: ' + result.error);
        }
      } catch (error) {
        alert('操作失败: ' + error.message);
      }
    }
  });

  document.getElementById('btnRunCheck').addEventListener('click', runConsistencyCheck);

  document.getElementById('btnRefreshCandidates').addEventListener('click', loadCandidates);

  document.getElementById('btnExportMarkdown').addEventListener('click', () => {
    window.location.href = `${API_BASE}/api/export/markdown`;
  });

  document.getElementById('btnExportJSON').addEventListener('click', () => {
    window.location.href = `${API_BASE}/api/export/json`;
  });

  document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('candidateModal').classList.remove('active');
  });

  document.getElementById('commentModalClose').addEventListener('click', () => {
    document.getElementById('commentModal').classList.remove('active');
    currentCommentIssue = null;
  });

  document.getElementById('commentCancel').addEventListener('click', () => {
    document.getElementById('commentModal').classList.remove('active');
    currentCommentIssue = null;
  });

  document.getElementById('commentSubmit').addEventListener('click', submitComment);

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
        if (modal.id === 'commentModal') {
          currentCommentIssue = null;
        }
      }
    });
  });
}

async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/api/stats`);
    const stats = await response.json();

    document.getElementById('statCandidates').textContent = stats.candidates;
    document.getElementById('statInterviews').textContent = stats.interviews;
    document.getElementById('statAudits').textContent = stats.auditLogs;
    document.getElementById('statApprovals').textContent = stats.offerApprovals;
  } catch (error) {
    console.error('加载统计失败:', error);
  }
}

async function runConsistencyCheck() {
  const container = document.getElementById('issuesList');
  const statsDiv = document.getElementById('issueStats');
  
  container.innerHTML = '<p class="empty-state">正在检测...</p>';
  statsDiv.innerHTML = '';

  try {
    const response = await fetch(`${API_BASE}/api/issues`);
    const issues = await response.json();

    if (issues.length === 0) {
      container.innerHTML = '<p class="empty-state">✅ 未发现一致性问题</p>';
      return;
    }

    const highCount = issues.filter(i => i.severity === 'high').length;
    const mediumCount = issues.filter(i => i.severity === 'medium').length;

    statsDiv.innerHTML = `
      <span class="issue-stat high">🔴 高严重: ${highCount}</span>
      <span class="issue-stat medium">🟡 中严重: ${mediumCount}</span>
    `;

    container.innerHTML = issues.map(issue => createIssueCard(issue)).join('');

    document.querySelectorAll('.issue-card .issue-header').forEach(header => {
      header.addEventListener('click', (e) => {
        if (!e.target.closest('.btn')) {
          const card = header.closest('.issue-card');
          card.classList.toggle('expanded');
        }
      });
    });

    document.querySelectorAll('.btn-comment').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const issueId = btn.dataset.issueId;
        const issue = issues.find(i => i.id === issueId);
        if (issue) {
          openCommentModal(issue);
        }
      });
    });
  } catch (error) {
    container.innerHTML = `<p class="empty-state">检测失败: ${error.message}</p>`;
  }
}

function createIssueCard(issue) {
  const typeNames = {
    'status_jump': '状态跳变',
    'rating_change_no_audit': '评分修改无日志',
    'report_inconsistency': '报告结论不一致',
    'rating_inconsistency': '评分不一致',
    'missing_approval': '缺少审批记录',
    'approval_without_audit': '审批无审计日志'
  };

  const displayType = typeNames[issue.type] || issue.type;
  const hasComments = issue.comments && issue.comments.length > 0;

  let commentsHtml = '';
  if (hasComments) {
    commentsHtml = `
      <div class="issue-comments">
        <h4>复核备注 (${issue.comments.length})</h4>
        ${issue.comments.map(c => `
          <div class="comment-item">
            <div class="comment-header">
              <span class="comment-author">${c.reviewer || '匿名'}</span>
              <span>${c.created_at}</span>
            </div>
            <div>${c.comment}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  let detailsHtml = '';
  if (issue.details) {
    const details = issue.details;
    detailsHtml = `
      <div class="issue-details">
        <h4>详细信息</h4>
        ${details.previousStatus ? `
          <div class="detail-item">
            <strong>前序状态:</strong> ${details.previousStatus} → <strong>当前状态:</strong> ${details.currentStatus}
          </div>
        ` : ''}
        ${details.oldValue !== undefined ? `
          <div class="detail-item">
            <strong>${details.fieldName}:</strong> ${details.oldValue} → ${details.newValue}
          </div>
          <div class="detail-item">
            <strong>轮次:</strong> ${details.roundName || '未知'}
          </div>
          <div class="detail-item">
            <strong>面试官:</strong> ${details.interviewer || '未知'}
          </div>
        ` : ''}
        ${details.feedbackStatus ? `
          <div class="detail-item">
            <strong>反馈状态:</strong> ${details.feedbackStatus}
          </div>
          <div class="detail-item">
            <strong>报告状态:</strong> ${details.reportStatus}
          </div>
        ` : ''}
        ${details.feedbackRating !== undefined ? `
          <div class="detail-item">
            <strong>反馈评分:</strong> ${details.feedbackRating}
          </div>
          <div class="detail-item">
            <strong>报告评分:</strong> ${details.reportRating}
          </div>
        ` : ''}
        ${details.approvalStatus ? `
          <div class="detail-item">
            <strong>审批状态:</strong> ${details.approvalStatus}
          </div>
        ` : ''}
      </div>
    `;
  }

  return `
    <div class="issue-card" data-issue-id="${issue.id}">
      <div class="issue-header">
        <div class="issue-title">
          <span class="severity-badge ${issue.severity}">${issue.severity === 'high' ? '高' : '中'}</span>
          <span class="issue-type">${displayType}</span>
        </div>
        <div class="issue-actions">
          <button class="btn btn-secondary btn-comment" data-issue-id="${issue.id}" style="padding: 6px 12px; font-size: 0.85rem;">
            备注
          </button>
          <button class="issue-toggle">▼</button>
        </div>
      </div>
      <div class="issue-body">
        <div class="issue-description">
          ${issue.description}
        </div>
        ${detailsHtml}
        ${commentsHtml}
      </div>
    </div>
  `;
}

function openCommentModal(issue) {
  currentCommentIssue = issue;
  document.getElementById('commentIssueDesc').textContent = issue.description;
  document.getElementById('commentText').value = '';
  document.getElementById('reviewerName').value = '';
  document.getElementById('commentModal').classList.add('active');
}

async function submitComment() {
  if (!currentCommentIssue) return;

  const comment = document.getElementById('commentText').value.trim();
  const reviewer = document.getElementById('reviewerName').value.trim();

  if (!comment) {
    alert('请输入备注内容');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/issues/${currentCommentIssue.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateId: currentCommentIssue.candidateId,
        comment: comment,
        reviewer: reviewer || undefined
      })
    });

    if (response.ok) {
      document.getElementById('commentModal').classList.remove('active');
      currentCommentIssue = null;
      runConsistencyCheck();
    } else {
      const result = await response.json();
      alert('提交失败: ' + result.error);
    }
  } catch (error) {
    alert('提交失败: ' + error.message);
  }
}

async function loadCandidates() {
  const container = document.getElementById('candidatesList');
  container.innerHTML = '<p class="empty-state">加载中...</p>';

  try {
    const response = await fetch(`${API_BASE}/api/candidates`);
    const candidates = await response.json();

    if (candidates.length === 0) {
      container.innerHTML = '<p class="empty-state">暂无候选人数据</p>';
      return;
    }

    container.innerHTML = candidates.map(candidate => {
      const statusClass = getStatusClass(candidate.status);
      return `
        <div class="candidate-card" data-candidate-id="${candidate.candidate_id}">
          <div class="candidate-info">
            <span class="candidate-name">${candidate.name}</span>
            <span class="candidate-meta">
              ${candidate.position ? `职位: ${candidate.position}` : ''}
              ${candidate.email ? ` | ${candidate.email}` : ''}
            </span>
          </div>
          ${candidate.status ? `<span class="candidate-status ${statusClass}">${candidate.status}</span>` : ''}
        </div>
      `;
    }).join('');

    document.querySelectorAll('.candidate-card').forEach(card => {
      card.addEventListener('click', () => {
        const candidateId = card.dataset.candidateId;
        showCandidateDetail(candidateId);
      });
    });
  } catch (error) {
    container.innerHTML = `<p class="empty-state">加载失败: ${error.message}</p>`;
  }
}

function getStatusClass(status) {
  if (!status) return 'status-default';
  const s = status.toLowerCase();
  if (s.includes('通过') || s.includes('pass')) return 'status-pass';
  if (s.includes('待定') || s.includes('pending')) return 'status-pending';
  if (s.includes('拒绝') || s.includes('reject')) return 'status-reject';
  return 'status-default';
}

async function showCandidateDetail(candidateId) {
  const modal = document.getElementById('candidateModal');
  const modalBody = document.getElementById('modalBody');
  const modalTitle = document.getElementById('modalTitle');

  modalBody.innerHTML = '<p>加载中...</p>';
  modal.classList.add('active');

  try {
    const response = await fetch(`${API_BASE}/api/candidates/${candidateId}`);
    const data = await response.json();

    modalTitle.textContent = data.candidate.name + ' - 详情';

    let html = '';

    html += `
      <div class="detail-section">
        <h4>基本信息</h4>
        <table class="detail-table">
          <tr><th>字段</th><th>值</th></tr>
          <tr><td>候选人ID</td><td>${data.candidate.candidate_id}</td></tr>
          <tr><td>姓名</td><td>${data.candidate.name}</td></tr>
          ${data.candidate.email ? `<tr><td>邮箱</td><td>${data.candidate.email}</td></tr>` : ''}
          ${data.candidate.phone ? `<tr><td>电话</td><td>${data.candidate.phone}</td></tr>` : ''}
          ${data.candidate.position ? `<tr><td>职位</td><td>${data.candidate.position}</td></tr>` : ''}
        </table>
      </div>
    `;

    if (data.feedbacks.length > 0) {
      html += `
        <div class="detail-section">
          <h4>面试反馈 (${data.feedbacks.length} 条)</h4>
          <table class="detail-table">
            <tr><th>轮次</th><th>面试官</th><th>日期</th><th>状态</th><th>评分</th><th>版本</th></tr>
            ${data.feedbacks.map(f => `
              <tr>
                <td>${f.round_name || '-'}</td>
                <td>${f.interviewer_name || '-'}</td>
                <td>${f.interview_date || f.created_at}</td>
                <td>${f.status || '-'}</td>
                <td>${f.overall_rating !== null ? f.overall_rating : '-'}</td>
                <td>${f.version}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `;
    }

    if (data.audits.length > 0) {
      html += `
        <div class="detail-section">
          <h4>审计日志 (${data.audits.length} 条)</h4>
          <table class="detail-table">
            <tr><th>操作</th><th>类型</th><th>字段</th><th>旧值</th><th>新值</th><th>操作人</th><th>时间</th></tr>
            ${data.audits.map(a => `
              <tr>
                <td>${a.action}</td>
                <td>${a.action_type || '-'}</td>
                <td>${a.field_name || '-'}</td>
                <td>${a.old_value !== null ? a.old_value : '-'}</td>
                <td>${a.new_value !== null ? a.new_value : '-'}</td>
                <td>${a.operator || '-'}</td>
                <td>${a.created_at}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `;
    }

    if (data.approvals.length > 0) {
      html += `
        <div class="detail-section">
          <h4>Offer审批 (${data.approvals.length} 条)</h4>
          <table class="detail-table">
            <tr><th>审批人</th><th>日期</th><th>状态</th><th>备注</th></tr>
            ${data.approvals.map(a => `
              <tr>
                <td>${a.approver || '-'}</td>
                <td>${a.approval_date || a.created_at}</td>
                <td>${a.approval_status || '-'}</td>
                <td>${a.comment || '-'}</td>
              </tr>
            `).join('')}
          </table>
        </div>
      `;
    }

    if (data.comments.length > 0) {
      html += `
        <div class="detail-section">
          <h4>复核备注 (${data.comments.length} 条)</h4>
          ${data.comments.map(c => `
            <div class="detail-item">
              <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                <span style="font-weight: 600; color: #667eea;">${c.reviewer || '匿名'}</span>
                <span style="color: #999; font-size: 0.85rem;">${c.created_at}</span>
              </div>
              <div>${c.comment}</div>
            </div>
          `).join('')}
        </div>
      `;
    }

    modalBody.innerHTML = html;
  } catch (error) {
    modalBody.innerHTML = `<p>加载失败: ${error.message}</p>`;
  }
}
