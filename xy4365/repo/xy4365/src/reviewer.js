const { v4: uuidv4 } = require('uuid');
const express = require('express');
const path = require('path');

class Reviewer {
  constructor(db, inspector) {
    this.db = db;
    this.inspector = inspector;
    this.app = null;
    this.server = null;
  }

  // 复核违规记录（改判）
  reviewViolation(violationId, updates, reviewedBy = 'admin') {
    const violation = this.db.get(
      `SELECT * FROM violations WHERE violation_id = ?`,
      [violationId]
    );

    if (!violation) {
      throw new Error(`未找到违规记录: ${violationId}`);
    }

    // 记录复核历史
    const reviewRecord = {
      review_id: this.generateId(),
      violation_id: violationId,
      original_violation_type: violation.violation_type,
      new_violation_type: updates.violation_type || violation.violation_type,
      original_severity: violation.severity,
      new_severity: updates.severity || violation.severity,
      original_status: violation.status,
      new_status: updates.status || violation.status,
      review_notes: updates.notes || '',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString()
    };

    this.saveReview(reviewRecord);

    // 更新违规记录
    const updateFields = [];
    const updateValues = [];

    if (updates.violation_type) {
      updateFields.push('violation_type = ?');
      updateValues.push(updates.violation_type);
    }
    if (updates.severity) {
      updateFields.push('severity = ?');
      updateValues.push(updates.severity);
    }
    if (updates.status) {
      updateFields.push('status = ?');
      updateValues.push(updates.status);
    }
    if (updates.notes) {
      updateFields.push('review_notes = ?');
      updateValues.push(updates.notes);
    }
    
    updateFields.push('reviewed_by = ?');
    updateValues.push(reviewedBy);
    updateFields.push('reviewed_at = ?');
    updateValues.push(new Date().toISOString());

    updateValues.push(violationId);

    this.db.run(
      `UPDATE violations SET ${updateFields.join(', ')} WHERE violation_id = ?`,
      updateValues
    );

    return {
      success: true,
      review: reviewRecord
    };
  }

  // 保存复核记录
  saveReview(review) {
    this.db.run(`
      INSERT INTO reviews 
      (review_id, violation_id, original_violation_type, new_violation_type,
       original_severity, new_severity, original_status, new_status,
       review_notes, reviewed_by, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      review.review_id,
      review.violation_id,
      review.original_violation_type,
      review.new_violation_type,
      review.original_severity,
      review.new_severity,
      review.original_status,
      review.new_status,
      review.review_notes,
      review.reviewed_by,
      review.reviewed_at
    ]);
  }

  // 重新计算所有检查
  recalculate() {
    // 清除现有违规记录
    this.inspector.clearViolations();
    
    // 重新运行所有检查
    return this.inspector.runAllChecks();
  }

  // 获取待复核的违规记录
  getPendingViolations() {
    return this.db.all(`
      SELECT v.*, 
             (SELECT COUNT(*) FROM reviews r WHERE r.violation_id = v.violation_id) as review_count
      FROM violations v 
      WHERE v.status = 'pending'
      ORDER BY v.timestamp DESC
    `);
  }

  // 获取所有违规记录（带复核历史）
  getAllViolationsWithReviews() {
    const violations = this.db.all(`
      SELECT v.*, 
             (SELECT COUNT(*) FROM reviews r WHERE r.violation_id = v.violation_id) as review_count
      FROM violations v
      ORDER BY v.timestamp DESC
    `);

    for (const v of violations) {
      v.reviews = this.db.all(
        `SELECT * FROM reviews WHERE violation_id = ? ORDER BY reviewed_at DESC`,
        [v.violation_id]
      );
    }

    return violations;
  }

  // 生成唯一ID
  generateId() {
    return uuidv4();
  }

  // 启动本地复核Web界面
  startWebServer(port = 3000) {
    if (this.server) {
      throw new Error('Web服务器已在运行中');
    }

    this.app = express();
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // API 路由
    this.setupApiRoutes();

    // 静态页面
    this.app.get('/', (req, res) => {
      res.send(this.renderDashboard());
    });

    this.server = this.app.listen(port, () => {
      console.log(`复核界面已启动: http://localhost:${port}`);
    });

    return this.server;
  }

  // 停止Web服务器
  stopWebServer() {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.app = null;
      console.log('Web服务器已停止');
    }
  }

  // 设置API路由
  setupApiRoutes() {
    // 获取待复核列表
    this.app.get('/api/violations/pending', (req, res) => {
      try {
        const violations = this.getPendingViolations();
        res.json({ success: true, data: violations });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 获取所有违规记录
    this.app.get('/api/violations/all', (req, res) => {
      try {
        const violations = this.getAllViolationsWithReviews();
        res.json({ success: true, data: violations });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 复核单个违规记录
    this.app.post('/api/violations/:id/review', (req, res) => {
      try {
        const { id } = req.params;
        const { status, severity, violation_type, notes, reviewed_by } = req.body;
        
        const updates = {};
        if (status) updates.status = status;
        if (severity) updates.severity = severity;
        if (violation_type) updates.violation_type = violation_type;
        if (notes) updates.notes = notes;

        const result = this.reviewViolation(id, updates, reviewed_by || 'admin');
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 重新计算检查
    this.app.post('/api/recalculate', (req, res) => {
      try {
        const result = this.recalculate();
        res.json({ success: true, data: result });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // 获取统计信息
    this.app.get('/api/stats', (req, res) => {
      try {
        const stats = {
          total: this.db.get(`SELECT COUNT(*) as count FROM violations`).count,
          pending: this.db.get(`SELECT COUNT(*) as count FROM violations WHERE status = 'pending'`).count,
          confirmed: this.db.get(`SELECT COUNT(*) as count FROM violations WHERE status = 'confirmed'`).count,
          dismissed: this.db.get(`SELECT COUNT(*) as count FROM violations WHERE status = 'dismissed'`).count,
          high: this.db.get(`SELECT COUNT(*) as count FROM violations WHERE severity = 'high'`).count,
          medium: this.db.get(`SELECT COUNT(*) as count FROM violations WHERE severity = 'medium'`).count,
          low: this.db.get(`SELECT COUNT(*) as count FROM violations WHERE severity = 'low'`).count
        };
        res.json({ success: true, data: stats });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  }

  // 渲染仪表板页面
  renderDashboard() {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>激光切割机违规复核系统</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #2c3e50; margin-bottom: 20px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
    .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .stat-card h3 { font-size: 14px; color: #7f8c8d; margin-bottom: 10px; }
    .stat-card .value { font-size: 32px; font-weight: bold; }
    .stat-card.pending .value { color: #f39c12; }
    .stat-card.high .value { color: #e74c3c; }
    .stat-card.medium .value { color: #f39c12; }
    .stat-card.confirmed .value { color: #27ae60; }
    .actions { margin-bottom: 20px; display: flex; gap: 10px; flex-wrap: wrap; }
    .btn { padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; transition: all 0.3s; }
    .btn-primary { background: #3498db; color: white; }
    .btn-primary:hover { background: #2980b9; }
    .btn-success { background: #27ae60; color: white; }
    .btn-success:hover { background: #219a52; }
    .btn-danger { background: #e74c3c; color: white; }
    .btn-danger:hover { background: #c0392b; }
    .btn-secondary { background: #95a5a6; color: white; }
    .btn-secondary:hover { background: #7f8c8d; }
    .tabs { display: flex; gap: 5px; margin-bottom: 20px; border-bottom: 2px solid #e0e0e0; }
    .tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }
    .tab.active { border-bottom-color: #3498db; color: #3498db; font-weight: bold; }
    .violation-list { background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden; }
    .violation-item { padding: 20px; border-bottom: 1px solid #eee; }
    .violation-item:last-child { border-bottom: none; }
    .violation-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .violation-title { font-size: 16px; font-weight: bold; }
    .severity-badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .severity-high { background: #fee; color: #c0392b; }
    .severity-medium { background: #fff3cd; color: #856404; }
    .severity-low { background: #d4edda; color: #155724; }
    .status-badge { padding: 4px 10px; border-radius: 20px; font-size: 12px; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-confirmed { background: #d4edda; color: #155724; }
    .status-dismissed { background: #f8f9fa; color: #6c757d; }
    .violation-meta { display: flex; gap: 20px; font-size: 13px; color: #666; margin-bottom: 10px; }
    .violation-desc { color: #555; margin-bottom: 15px; }
    .review-section { background: #f8f9fa; padding: 15px; border-radius: 5px; }
    .review-section h4 { margin-bottom: 10px; font-size: 14px; }
    .review-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .review-form { display: flex; flex-direction: column; gap: 10px; }
    .form-row { display: flex; gap: 15px; flex-wrap: wrap; }
    .form-group { display: flex; flex-direction: column; gap: 5px; }
    .form-group label { font-size: 12px; font-weight: bold; color: #555; }
    .form-group select, .form-group input, .form-group textarea { padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; }
    .form-group textarea { min-height: 60px; resize: vertical; }
    .review-history { margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd; }
    .review-history h4 { font-size: 13px; color: #666; margin-bottom: 10px; }
    .review-item { font-size: 12px; color: #777; padding: 8px 0; border-bottom: 1px solid #eee; }
    .review-item:last-child { border-bottom: none; }
    .empty-state { text-align: center; padding: 60px 20px; color: #999; }
    .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); justify-content: center; align-items: center; z-index: 1000; }
    .modal.active { display: flex; }
    .modal-content { background: white; padding: 30px; border-radius: 8px; max-width: 500px; width: 90%; }
    .modal-content h3 { margin-bottom: 20px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>激光切割机违规复核系统</h1>
    
    <div class="stats" id="stats-container">
    </div>

    <div class="actions">
      <button class="btn btn-primary" onclick="refreshStats()">刷新数据</button>
      <button class="btn btn-success" onclick="recalculate()">重新计算检查</button>
    </div>

    <div class="tabs">
      <div class="tab active" onclick="switchTab('pending')">待复核 <span id="pending-count">(0)</span></div>
      <div class="tab" onclick="switchTab('all')">全部记录</div>
    </div>

    <div id="pending-tab" class="tab-content">
      <div class="violation-list" id="pending-list">
        <div class="empty-state">加载中...</div>
      </div>
    </div>

    <div id="all-tab" class="tab-content" style="display: none;">
      <div class="violation-list" id="all-list">
        <div class="empty-state">加载中...</div>
      </div>
    </div>
  </div>

  <div id="success-modal" class="modal">
    <div class="modal-content">
      <h3>操作成功</h3>
      <p id="success-message">记录已更新</p>
      <div class="modal-actions">
        <button class="btn btn-primary" onclick="closeModal('success-modal')">确定</button>
      </div>
    </div>
  </div>

  <div id="confirm-modal" class="modal">
    <div class="modal-content">
      <h3 id="confirm-title">确认操作</h3>
      <p id="confirm-message">确定要执行此操作吗？</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal('confirm-modal')">取消</button>
        <button class="btn btn-primary" id="confirm-btn">确定</button>
      </div>
    </div>
  </div>

  <script>
    let currentTab = 'pending';

    async function fetchApi(url, options = {}) {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      return response.json();
    }

    async function refreshStats() {
      const result = await fetchApi('/api/stats');
      if (result.success) {
        renderStats(result.data);
      }
    }

    function renderStats(stats) {
      document.getElementById('stats-container').innerHTML = \`
        <div class="stat-card pending">
          <h3>待复核</h3>
          <div class="value">\${stats.pending}</div>
        </div>
        <div class="stat-card confirmed">
          <h3>已确认</h3>
          <div class="value">\${stats.confirmed}</div>
        </div>
        <div class="stat-card">
          <h3>已驳回</h3>
          <div class="value">\${stats.dismissed}</div>
        </div>
        <div class="stat-card high">
          <h3>高危</h3>
          <div class="value">\${stats.high}</div>
        </div>
        <div class="stat-card medium">
          <h3>中危</h3>
          <div class="value">\${stats.medium}</div>
        </div>
        <div class="stat-card">
          <h3>总计</h3>
          <div class="value">\${stats.total}</div>
        </div>
      \`;
      
      document.getElementById('pending-count').textContent = \`(\${stats.pending})\`;
    }

    async function loadPendingViolations() {
      const result = await fetchApi('/api/violations/pending');
      if (result.success) {
        renderViolationList('pending-list', result.data, true);
      }
    }

    async function loadAllViolations() {
      const result = await fetchApi('/api/violations/all');
      if (result.success) {
        renderViolationList('all-list', result.data, false);
      }
    }

    function renderViolationList(containerId, violations, showActions) {
      const container = document.getElementById(containerId);
      
      if (violations.length === 0) {
        container.innerHTML = \`<div class="empty-state">暂无违规记录</div>\`;
        return;
      }

      const severityLabels = { 'high': '高危', 'medium': '中危', 'low': '低危' };
      const statusLabels = { 'pending': '待复核', 'confirmed': '已确认', 'dismissed': '已驳回' };

      container.innerHTML = violations.map(v => \`
        <div class="violation-item" data-id="\${v.violation_id}">
          <div class="violation-header">
            <div>
              <span class="violation-title">\${getViolationTypeName(v.violation_type)}</span>
              <span class="severity-badge severity-\${v.severity}">\${severityLabels[v.severity] || v.severity}</span>
              <span class="status-badge status-\${v.status}">\${statusLabels[v.status] || v.status}</span>
            </div>
            <div style="font-size: 12px; color: #999;">\${formatDate(v.timestamp)}</div>
          </div>
          <div class="violation-meta">
            <span>机器: \${v.machine_id || '-'}</span>
            <span>用户: \${v.user_id || '-'}</span>
            <span>相关记录: \${v.related_record_type || '-'} / \${v.related_record_id || '-'}</span>
          </div>
          <div class="violation-desc">\${v.description}</div>
          
          \${showActions || v.status === 'pending' ? \`
            <div class="review-section">
              <h4>复核操作</h4>
              <div class="review-form">
                <div class="form-row">
                  <div class="form-group">
                    <label>状态</label>
                    <select id="status-\${v.violation_id}">
                      <option value="pending" \${v.status === 'pending' ? 'selected' : ''}>待复核</option>
                      <option value="confirmed" \${v.status === 'confirmed' ? 'selected' : ''}>确认违规</option>
                      <option value="dismissed" \${v.status === 'dismissed' ? 'selected' : ''}>驳回</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label>严重程度</label>
                    <select id="severity-\${v.violation_id}">
                      <option value="high" \${v.severity === 'high' ? 'selected' : ''}>高危</option>
                      <option value="medium" \${v.severity === 'medium' ? 'selected' : ''}>中危</option>
                      <option value="low" \${v.severity === 'low' ? 'selected' : ''}>低危</option>
                    </select>
                  </div>
                </div>
                <div class="form-group">
                  <label>复核备注</label>
                  <textarea id="notes-\${v.violation_id}" placeholder="输入复核备注..."></textarea>
                </div>
                <div class="review-actions">
                  <button class="btn btn-primary" onclick="submitReview('\${v.violation_id}')">提交复核</button>
                  <button class="btn btn-success" onclick="quickConfirm('\${v.violation_id}')">快速确认</button>
                  <button class="btn btn-danger" onclick="quickDismiss('\${v.violation_id}')">快速驳回</button>
                </div>
              </div>
            </div>
          \` : ''}
          
          \${v.reviews && v.reviews.length > 0 ? \`
            <div class="review-history">
              <h4>复核历史</h4>
              \${v.reviews.map(r => \`
                <div class="review-item">
                  <span style="font-weight: bold;">\${r.reviewed_by}</span> @ \${formatDate(r.reviewed_at)}: 
                  状态 \${r.original_status} → \${r.new_status}, 
                  严重程度 \${r.original_severity} → \${r.new_severity}
                  \${r.review_notes ? \`<br>备注: \${r.review_notes}\` : ''}
                </div>
              \`).join('')}
            </div>
          \` : ''}
        </div>
      \`).join('');
    }

    function getViolationTypeName(type) {
      const types = {
        'FORBIDDEN_MATERIAL': '使用禁切材料',
        'THICKNESS_POWER_MISMATCH': '厚度功率不匹配',
        'MAINTENANCE_CONFLICT': '维护时段冲突',
        'CONTINUOUS_TIMEOUT': '连续开机超时',
        'UNTRAINED_USER': '未培训人员操作'
      };
      return types[type] || type;
    }

    function formatDate(isoString) {
      if (!isoString) return '-';
      const date = new Date(isoString);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    async function submitReview(violationId) {
      const status = document.getElementById('status-' + violationId).value;
      const severity = document.getElementById('severity-' + violationId).value;
      const notes = document.getElementById('notes-' + violationId).value;

      const result = await fetchApi('/api/violations/' + violationId + '/review', {
        method: 'POST',
        body: JSON.stringify({ status, severity, notes, reviewed_by: 'admin' })
      });

      if (result.success) {
        showSuccess('复核已提交');
        refreshAll();
      } else {
        alert('操作失败: ' + result.error);
      }
    }

    async function quickConfirm(violationId) {
      const result = await fetchApi('/api/violations/' + violationId + '/review', {
        method: 'POST',
        body: JSON.stringify({ status: 'confirmed', reviewed_by: 'admin' })
      });

      if (result.success) {
        showSuccess('已确认违规');
        refreshAll();
      } else {
        alert('操作失败: ' + result.error);
      }
    }

    async function quickDismiss(violationId) {
      const result = await fetchApi('/api/violations/' + violationId + '/review', {
        method: 'POST',
        body: JSON.stringify({ status: 'dismissed', reviewed_by: 'admin' })
      });

      if (result.success) {
        showSuccess('已驳回');
        refreshAll();
      } else {
        alert('操作失败: ' + result.error);
      }
    }

    async function recalculate() {
      showConfirm('确认重新计算', '确定要重新运行所有检查吗？这将清除当前的违规记录并重新计算。', async () => {
        const result = await fetchApi('/api/recalculate', {
          method: 'POST'
        });

        if (result.success) {
          showSuccess('重新计算完成，共发现 ' + result.data.total + ' 条违规记录');
          refreshAll();
        } else {
          alert('操作失败: ' + result.error);
        }
      });
    }

    function switchTab(tab) {
      currentTab = tab;
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
      
      if (tab === 'pending') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('pending-tab').style.display = 'block';
        loadPendingViolations();
      } else {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('all-tab').style.display = 'block';
        loadAllViolations();
      }
    }

    function refreshAll() {
      refreshStats();
      if (currentTab === 'pending') {
        loadPendingViolations();
      } else {
        loadAllViolations();
      }
    }

    function showSuccess(message) {
      document.getElementById('success-message').textContent = message;
      document.getElementById('success-modal').classList.add('active');
    }

    function showConfirm(title, message, onConfirm) {
      document.getElementById('confirm-title').textContent = title;
      document.getElementById('confirm-message').textContent = message;
      document.getElementById('confirm-btn').onclick = () => {
        closeModal('confirm-modal');
        onConfirm();
      };
      document.getElementById('confirm-modal').classList.add('active');
    }

    function closeModal(modalId) {
      document.getElementById(modalId).classList.remove('active');
    }

    // 初始化
    refreshStats();
    loadPendingViolations();
  </script>
</body>
</html>
    `;
  }
}

module.exports = Reviewer;
