class App {
  constructor() {
    this.apiBase = '';
    this.currentPage = 'dashboard';
    this.currentExperimentId = null;
    this.policies = [];
    this.traces = [];
    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadDashboard();
  }

  setupEventListeners() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.navigateTo(btn.dataset.page));
    });

    document.getElementById('btn-create-experiment')?.addEventListener('click', () => this.showCreateExperimentModal());
    document.getElementById('btn-create-policy')?.addEventListener('click', () => this.showCreatePolicyModal());
    document.getElementById('btn-import-trace')?.addEventListener('click', () => this.showImportTraceModal());
    document.getElementById('btn-back-to-experiments')?.addEventListener('click', () => this.navigateTo('experiments'));
    document.getElementById('btn-export-md')?.addEventListener('click', () => this.exportReport('markdown'));
    document.getElementById('btn-export-json')?.addEventListener('click', () => this.exportReport('json'));

    document.getElementById('modal-close')?.addEventListener('click', () => this.closeModal());
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') this.closeModal();
    });
  }

  navigateTo(page) {
    this.currentPage = page;
    
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.page === page);
    });

    document.querySelectorAll('.page').forEach(p => {
      p.classList.toggle('active', p.id === `page-${page}`);
    });

    switch (page) {
      case 'dashboard':
        this.loadDashboard();
        break;
      case 'experiments':
        this.loadExperiments();
        break;
      case 'policies':
        this.loadPolicies();
        break;
      case 'traces':
        this.loadTraces();
        break;
    }
  }

  async api(endpoint, options = {}) {
    const response = await fetch(this.apiBase + endpoint, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    return response.json();
  }

  async loadDashboard() {
    try {
      const response = await this.api('/api/stats');
      if (response.success) {
        this.renderDashboardStats(response.data.counts);
        this.renderRecentExperiments(response.data.recentExperiments);
      }
    } catch (error) {
      console.error('加载仪表盘失败:', error);
    }
  }

  renderDashboardStats(counts) {
    const container = document.getElementById('dashboard-stats');
    container.innerHTML = `
      <div class="stat-card primary">
        <div class="label">实验总数</div>
        <div class="value">${counts.experiments}</div>
      </div>
      <div class="stat-card success">
        <div class="label">策略配置</div>
        <div class="value">${counts.policies}</div>
      </div>
      <div class="stat-card warning">
        <div class="label">流量追踪</div>
        <div class="value">${counts.traces}</div>
      </div>
      <div class="stat-card danger">
        <div class="label">判定记录</div>
        <div class="value">${counts.decisionLogs}</div>
      </div>
    `;
  }

  renderRecentExperiments(experiments) {
    const container = document.getElementById('recent-experiments');
    if (!experiments || experiments.length === 0) {
      container.innerHTML = '<p class="empty">暂无实验</p>';
      return;
    }

    container.innerHTML = experiments.map(exp => `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${exp.name}</div>
            <div class="card-meta">
              <span>状态: <span class="badge badge-${this.getStatusBadge(exp.status)}">${this.getStatusText(exp.status)}</span></span>
              <span>创建时间: ${new Date(exp.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <div class="card-actions">
            ${exp.status === 'completed' ? `<button class="btn btn-info" onclick="app.viewExperimentResult('${exp.id}')">查看结果</button>` : ''}
            ${exp.status === 'draft' ? `<button class="btn btn-success" onclick="app.runExperiment('${exp.id}')">运行</button>` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  async loadExperiments() {
    try {
      const response = await this.api('/api/experiments?limit=50');
      if (response.success) {
        this.renderExperiments(response.data);
      }
    } catch (error) {
      console.error('加载实验列表失败:', error);
    }
  }

  renderExperiments(experiments) {
    const container = document.getElementById('experiments-list');
    if (!experiments || experiments.length === 0) {
      container.innerHTML = '<p class="empty">暂无实验，点击"新建实验"创建</p>';
      return;
    }

    container.innerHTML = experiments.map(exp => `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${exp.name}</div>
            ${exp.description ? `<div style="color: #718096; font-size: 0.9rem; margin-top: 0.25rem;">${exp.description}</div>` : ''}
            <div class="card-meta">
              <span>状态: <span class="badge badge-${this.getStatusBadge(exp.status)}">${this.getStatusText(exp.status)}</span></span>
              <span>创建时间: ${new Date(exp.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <div class="card-actions">
            ${exp.status === 'completed' ? `<button class="btn btn-info" onclick="app.viewExperimentResult('${exp.id}')">查看结果</button>` : ''}
            ${exp.status === 'draft' ? `<button class="btn btn-success" onclick="app.runExperiment('${exp.id}')">运行</button>` : ''}
            ${exp.status === 'draft' ? `<button class="btn" onclick="app.editExperiment('${exp.id}')">编辑</button>` : ''}
            <button class="btn btn-danger" onclick="app.deleteExperiment('${exp.id}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  async loadPolicies() {
    try {
      const response = await this.api('/api/policies?limit=50');
      if (response.success) {
        this.policies = response.data;
        this.renderPolicies(this.policies);
      }
    } catch (error) {
      console.error('加载策略列表失败:', error);
    }
  }

  renderPolicies(policies) {
    const container = document.getElementById('policies-list');
    if (!policies || policies.length === 0) {
      container.innerHTML = '<p class="empty">暂无策略，点击"新建策略"创建</p>';
      return;
    }

    container.innerHTML = policies.map(policy => `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${policy.name}</div>
            ${policy.description ? `<div style="color: #718096; font-size: 0.9rem; margin-top: 0.25rem;">${policy.description}</div>` : ''}
            <div class="card-meta">
              <span class="badge badge-${this.getTypeBadge(policy.type)}">${this.getTypeText(policy.type)}${policy.rateLimitType ? ` / ${this.getRateLimitTypeText(policy.rateLimitType)}` : ''}</span>
              <span>${policy.isActive ? '<span class="badge badge-success">已启用</span>' : '<span class="badge badge-secondary">已禁用</span>'}</span>
            </div>
          </div>
          <div class="card-actions">
            <button class="btn" onclick="app.viewPolicy('${policy.id}')">详情</button>
            <button class="btn" onclick="app.editPolicy('${policy.id}')">编辑</button>
            <button class="btn btn-danger" onclick="app.deletePolicy('${policy.id}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  async loadTraces() {
    try {
      const response = await this.api('/api/traces?limit=50');
      if (response.success) {
        this.traces = response.data;
        this.renderTraces(this.traces);
      }
    } catch (error) {
      console.error('加载流量追踪列表失败:', error);
    }
  }

  renderTraces(traces) {
    const container = document.getElementById('traces-list');
    if (!traces || traces.length === 0) {
      container.innerHTML = '<p class="empty">暂无流量追踪，点击"导入流量"添加</p>';
      return;
    }

    container.innerHTML = traces.map(trace => `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${trace.name}</div>
            ${trace.description ? `<div style="color: #718096; font-size: 0.9rem; margin-top: 0.25rem;">${trace.description}</div>` : ''}
            <div class="card-meta">
              <span>请求数: <strong>${trace.requestCount}</strong></span>
              <span>来源: ${this.getSourceText(trace.source)}</span>
              <span>创建时间: ${new Date(trace.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <div class="card-actions">
            <button class="btn" onclick="app.viewTrace('${trace.id}')">详情</button>
            <button class="btn btn-danger" onclick="app.deleteTrace('${trace.id}')">删除</button>
          </div>
        </div>
      </div>
    `).join('');
  }

  async showCreateExperimentModal() {
    await Promise.all([
      this.loadPolicies(),
      this.loadTraces()
    ]);

    const policiesHtml = this.policies.length > 0 
      ? this.policies.map(p => `
          <div class="checkbox-item">
            <input type="checkbox" id="policy-${p.id}" value="${p.id}" class="policy-checkbox">
            <label for="policy-${p.id}">${p.name} (${this.getTypeText(p.type)})</label>
          </div>
        `).join('')
      : '<p style="color: #718096;">暂无策略，请先创建策略</p>';

    const tracesHtml = this.traces.length > 0
      ? this.traces.map(t => `<option value="${t.id}">${t.name} (${t.requestCount} 个请求)</option>`).join('')
      : '<option value="">暂无流量追踪</option>';

    const content = `
      <div class="form-group">
        <label class="form-label">实验名称 *</label>
        <input type="text" class="form-input" id="exp-name" placeholder="例如：高并发流量测试">
      </div>
      <div class="form-group">
        <label class="form-label">实验描述</label>
        <textarea class="form-textarea" id="exp-description" placeholder="描述实验目的..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">选择策略 *</label>
        <div class="checkbox-group" id="policy-checkboxes">
          ${policiesHtml}
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">选择流量追踪 *</label>
        <select class="form-select" id="exp-trace">
          <option value="">请选择流量追踪</option>
          ${tracesHtml}
        </select>
      </div>
    `;

    this.showModal('新建实验', content, [
      { text: '取消', class: '', action: () => this.closeModal() },
      { text: '创建', class: 'btn-primary', action: () => this.createExperiment() }
    ]);
  }

  async createExperiment() {
    const name = document.getElementById('exp-name').value.trim();
    const description = document.getElementById('exp-description').value.trim();
    const traceId = document.getElementById('exp-trace').value;
    const policyIds = Array.from(document.querySelectorAll('.policy-checkbox:checked')).map(cb => cb.value);

    if (!name) {
      alert('请输入实验名称');
      return;
    }
    if (policyIds.length === 0) {
      alert('请至少选择一个策略');
      return;
    }
    if (!traceId) {
      alert('请选择流量追踪');
      return;
    }

    try {
      const response = await this.api('/api/experiments', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          config: {
            policyIds,
            trafficTraceId: traceId
          }
        })
      });

      if (response.success) {
        this.closeModal();
        this.loadExperiments();
      } else {
        alert('创建失败: ' + response.message);
      }
    } catch (error) {
      alert('创建失败: ' + error.message);
    }
  }

  async runExperiment(id) {
    if (!confirm('确定要运行此实验吗？')) return;

    try {
      const response = await this.api(`/api/experiments/${id}/run`, {
        method: 'POST'
      });

      if (response.success) {
        alert('实验已启动，请稍后查看结果');
        this.loadExperiments();
      } else {
        alert('启动失败: ' + response.message);
      }
    } catch (error) {
      alert('启动失败: ' + error.message);
    }
  }

  async viewExperimentResult(id) {
    this.currentExperimentId = id;
    this.navigateTo('experiment-result');

    try {
      const response = await this.api(`/api/experiments/${id}/result`);
      if (response.success) {
        this.renderExperimentResult(response.data);
      }
    } catch (error) {
      console.error('加载实验结果失败:', error);
    }
  }

  renderExperimentResult(data) {
    const { experiment, stats, timeline, decisionLogs } = data;

    document.getElementById('result-title').textContent = `实验结果: ${experiment.name}`;

    const maxCount = Math.max(stats.allow, stats.queue, stats.reject, stats.fallback, 1);

    const container = document.getElementById('experiment-result-content');
    container.innerHTML = `
      <div class="section">
        <h3>基本信息</h3>
        <div class="card-meta">
          <span>状态: <span class="badge badge-${this.getStatusBadge(experiment.status)}">${this.getStatusText(experiment.status)}</span></span>
          <span>开始时间: ${experiment.startTime ? new Date(experiment.startTime).toLocaleString() : '-'}</span>
          <span>结束时间: ${experiment.endTime ? new Date(experiment.endTime).toLocaleString() : '-'}</span>
        </div>
      </div>

      <div class="result-stats">
        <div class="result-stat allow">
          <div class="number">${stats.allow}</div>
          <div class="label">放行请求</div>
        </div>
        <div class="result-stat queue">
          <div class="number">${stats.queue}</div>
          <div class="label">排队请求</div>
        </div>
        <div class="result-stat reject">
          <div class="number">${stats.reject}</div>
          <div class="label">拒绝请求</div>
        </div>
        <div class="result-stat fallback">
          <div class="number">${stats.fallback}</div>
          <div class="label">降级请求</div>
        </div>
      </div>

      <div class="chart-container">
        <div class="chart-title">请求分布</div>
        <div class="bar-chart">
          <div class="bar-chart-item">
            <div class="bar-chart-bar" style="height: ${(stats.allow / maxCount * 100)}%; background: #48bb78;"></div>
            <div class="bar-chart-label">放行</div>
            <div class="bar-chart-value">${stats.allow}</div>
          </div>
          <div class="bar-chart-item">
            <div class="bar-chart-bar" style="height: ${(stats.queue / maxCount * 100)}%; background: #ed8936;"></div>
            <div class="bar-chart-label">排队</div>
            <div class="bar-chart-value">${stats.queue}</div>
          </div>
          <div class="bar-chart-item">
            <div class="bar-chart-bar" style="height: ${(stats.reject / maxCount * 100)}%; background: #f56565;"></div>
            <div class="bar-chart-label">拒绝</div>
            <div class="bar-chart-value">${stats.reject}</div>
          </div>
          <div class="bar-chart-item">
            <div class="bar-chart-bar" style="height: ${(stats.fallback / maxCount * 100)}%; background: #4299e1;"></div>
            <div class="bar-chart-label">降级</div>
            <div class="bar-chart-value">${stats.fallback}</div>
          </div>
        </div>
      </div>

      <div class="section">
        <h3>统计指标</h3>
        <div class="card-meta">
          <span>总请求数: <strong>${stats.totalRequests}</strong></span>
          <span>错误率: <strong>${(stats.errorRate * 100).toFixed(2)}%</strong></span>
          <span>平均延迟: <strong>${stats.averageLatency}ms</strong></span>
        </div>
      </div>

      <div class="section">
        <h3>请求时间线 (最近50条)</h3>
        <div class="timeline">
          ${(timeline.slice(0, 50) || []).map(item => `
            <div class="timeline-item">
              <div class="timeline-time">${new Date(item.timestamp).toLocaleTimeString()}</div>
              <div class="timeline-content">
                <div class="timeline-action">
                  <span class="badge badge-${this.getActionBadge(item.action)}">${this.getActionText(item.action)}</span>
                  ${item.policyType ? `<span class="badge badge-secondary">${this.getTypeText(item.policyType)}</span>` : ''}
                </div>
                <div class="timeline-reason">${item.reason}</div>
              </div>
            </div>
          `).join('') || '<p class="empty">暂无数据</p>'}
        </div>
      </div>
    `;
  }

  async deleteExperiment(id) {
    if (!confirm('确定要删除此实验吗？')) return;

    try {
      const response = await this.api(`/api/experiments/${id}`, {
        method: 'DELETE'
      });

      if (response.success) {
        this.loadExperiments();
      } else {
        alert('删除失败: ' + response.message);
      }
    } catch (error) {
      alert('删除失败: ' + error.message);
    }
  }

  async showCreatePolicyModal() {
    const content = `
      <div class="form-group">
        <label class="form-label">策略名称 *</label>
        <input type="text" class="form-input" id="policy-name" placeholder="例如：API限流策略">
      </div>
      <div class="form-group">
        <label class="form-label">策略描述</label>
        <textarea class="form-textarea" id="policy-description" placeholder="描述策略用途..."></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">策略类型 *</label>
          <select class="form-select" id="policy-type" onchange="app.onPolicyTypeChange()">
            <option value="">请选择类型</option>
            <option value="rate_limit">限流策略</option>
            <option value="circuit_breaker">熔断策略</option>
            <option value="overload_protection">过载保护</option>
          </select>
        </div>
        <div class="form-group" id="rate-limit-type-group" style="display: none;">
          <label class="form-label">限流类型</label>
          <select class="form-select" id="policy-rate-limit-type" onchange="app.onRateLimitTypeChange()">
            <option value="token_bucket">令牌桶</option>
            <option value="leaky_bucket">漏桶</option>
            <option value="sliding_window">滑动窗口</option>
          </select>
        </div>
      </div>
      <div id="policy-config-container">
        <p style="color: #718096;">请先选择策略类型</p>
      </div>
    `;

    this.showModal('新建策略', content, [
      { text: '取消', class: '', action: () => this.closeModal() },
      { text: '创建', class: 'btn-primary', action: () => this.createPolicy() }
    ]);
  }

  onPolicyTypeChange() {
    const type = document.getElementById('policy-type').value;
    const rateLimitGroup = document.getElementById('rate-limit-type-group');
    const configContainer = document.getElementById('policy-config-container');

    if (type === 'rate_limit') {
      rateLimitGroup.style.display = 'block';
      this.onRateLimitTypeChange();
    } else {
      rateLimitGroup.style.display = 'none';
      this.renderPolicyConfig(type);
    }
  }

  onRateLimitTypeChange() {
    const rateLimitType = document.getElementById('policy-rate-limit-type').value;
    this.renderPolicyConfig('rate_limit', rateLimitType);
  }

  renderPolicyConfig(type, rateLimitType = null) {
    const container = document.getElementById('policy-config-container');
    let html = '';

    switch (type) {
      case 'rate_limit':
        switch (rateLimitType) {
          case 'token_bucket':
            html = `
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">桶容量</label>
                  <input type="number" class="form-input" id="config-capacity" value="100" min="1">
                </div>
                <div class="form-group">
                  <label class="form-label">令牌速率 (每秒)</label>
                  <input type="number" class="form-input" id="config-rate" value="10" min="1">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">初始令牌数</label>
                  <input type="number" class="form-input" id="config-initialTokens" value="100" min="0">
                </div>
                <div class="form-group">
                  <label class="form-label">最大队列大小</label>
                  <input type="number" class="form-input" id="config-maxQueueSize" value="50" min="0">
                </div>
              </div>
              <div class="form-group">
                <div class="checkbox-item">
                  <input type="checkbox" id="config-queueEnabled" checked>
                  <label for="config-queueEnabled">启用队列</label>
                </div>
              </div>
            `;
            break;
          case 'leaky_bucket':
            html = `
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">桶容量</label>
                  <input type="number" class="form-input" id="config-capacity" value="100" min="1">
                </div>
                <div class="form-group">
                  <label class="form-label">漏水速率 (每秒)</label>
                  <input type="number" class="form-input" id="config-rate" value="10" min="1">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">最大队列大小</label>
                <input type="number" class="form-input" id="config-maxQueueSize" value="50" min="0">
              </div>
              <div class="form-group">
                <div class="checkbox-item">
                  <input type="checkbox" id="config-queueEnabled" checked>
                  <label for="config-queueEnabled">启用队列</label>
                </div>
              </div>
            `;
            break;
          case 'sliding_window':
            html = `
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">窗口大小 (秒)</label>
                  <input type="number" class="form-input" id="config-windowSize" value="60" min="1">
                </div>
                <div class="form-group">
                  <label class="form-label">最大请求数</label>
                  <input type="number" class="form-input" id="config-maxRequests" value="100" min="1">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">最大队列大小</label>
                <input type="number" class="form-input" id="config-maxQueueSize" value="50" min="0">
              </div>
              <div class="form-group">
                <div class="checkbox-item">
                  <input type="checkbox" id="config-queueEnabled" checked>
                  <label for="config-queueEnabled">启用队列</label>
                </div>
              </div>
            `;
            break;
        }
        break;

      case 'circuit_breaker':
        html = `
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">失败阈值 (0-1)</label>
              <input type="number" class="form-input" id="config-failureThreshold" value="0.5" min="0" max="1" step="0.1">
            </div>
            <div class="form-group">
              <label class="form-label">最小请求数</label>
              <input type="number" class="form-input" id="config-minimumRequests" value="10" min="1">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">半开探测请求数</label>
              <input type="number" class="form-input" id="config-halfOpenRequestLimit" value="3" min="1">
            </div>
            <div class="form-group">
              <label class="form-label">重置超时 (毫秒)</label>
              <input type="number" class="form-input" id="config-resetTimeout" value="60000" min="1000">
            </div>
          </div>
          <div class="form-group">
            <div class="checkbox-item">
              <input type="checkbox" id="config-fallbackEnabled" checked>
              <label for="config-fallbackEnabled">启用降级</label>
            </div>
          </div>
        `;
        break;

      case 'overload_protection':
        html = `
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">最大并发数</label>
              <input type="number" class="form-input" id="config-maxConcurrency" value="100" min="1">
            </div>
            <div class="form-group">
              <label class="form-label">最大队列大小</label>
              <input type="number" class="form-input" id="config-maxQueueSize" value="50" min="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">队列超时 (毫秒)</label>
              <input type="number" class="form-input" id="config-queueTimeout" value="5000" min="0">
            </div>
            <div class="form-group">
              <label class="form-label">目标延迟 (毫秒)</label>
              <input type="number" class="form-input" id="config-targetLatency" value="500" min="1">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <div class="checkbox-item">
                <input type="checkbox" id="config-fallbackEnabled" checked>
                <label for="config-fallbackEnabled">启用降级</label>
              </div>
            </div>
            <div class="form-group">
              <div class="checkbox-item">
                <input type="checkbox" id="config-adaptiveEnabled">
                <label for="config-adaptiveEnabled">自适应调整</label>
              </div>
            </div>
          </div>
        `;
        break;
    }

    container.innerHTML = html || '<p style="color: #718096;">请选择策略类型</p>';
  }

  collectPolicyConfig(type, rateLimitType = null) {
    const config = {};

    switch (type) {
      case 'rate_limit':
        switch (rateLimitType) {
          case 'token_bucket':
            config.capacity = parseInt(document.getElementById('config-capacity')?.value) || 100;
            config.rate = parseInt(document.getElementById('config-rate')?.value) || 10;
            config.initialTokens = parseInt(document.getElementById('config-initialTokens')?.value) || 100;
            config.queueEnabled = document.getElementById('config-queueEnabled')?.checked ?? true;
            config.maxQueueSize = parseInt(document.getElementById('config-maxQueueSize')?.value) || 50;
            break;
          case 'leaky_bucket':
            config.capacity = parseInt(document.getElementById('config-capacity')?.value) || 100;
            config.rate = parseInt(document.getElementById('config-rate')?.value) || 10;
            config.queueEnabled = document.getElementById('config-queueEnabled')?.checked ?? true;
            config.maxQueueSize = parseInt(document.getElementById('config-maxQueueSize')?.value) || 50;
            break;
          case 'sliding_window':
            config.windowSize = parseInt(document.getElementById('config-windowSize')?.value) || 60;
            config.maxRequests = parseInt(document.getElementById('config-maxRequests')?.value) || 100;
            config.queueEnabled = document.getElementById('config-queueEnabled')?.checked ?? true;
            config.maxQueueSize = parseInt(document.getElementById('config-maxQueueSize')?.value) || 50;
            break;
        }
        break;

      case 'circuit_breaker':
        config.failureThreshold = parseFloat(document.getElementById('config-failureThreshold')?.value) || 0.5;
        config.minimumRequests = parseInt(document.getElementById('config-minimumRequests')?.value) || 10;
        config.halfOpenRequestLimit = parseInt(document.getElementById('config-halfOpenRequestLimit')?.value) || 3;
        config.resetTimeout = parseInt(document.getElementById('config-resetTimeout')?.value) || 60000;
        config.fallbackEnabled = document.getElementById('config-fallbackEnabled')?.checked ?? true;
        break;

      case 'overload_protection':
        config.maxConcurrency = parseInt(document.getElementById('config-maxConcurrency')?.value) || 100;
        config.maxQueueSize = parseInt(document.getElementById('config-maxQueueSize')?.value) || 50;
        config.queueTimeout = parseInt(document.getElementById('config-queueTimeout')?.value) || 5000;
        config.fallbackEnabled = document.getElementById('config-fallbackEnabled')?.checked ?? true;
        config.adaptiveEnabled = document.getElementById('config-adaptiveEnabled')?.checked ?? false;
        config.targetLatency = parseInt(document.getElementById('config-targetLatency')?.value) || 500;
        config.minConcurrency = 10;
        break;
    }

    return config;
  }

  async createPolicy() {
    const name = document.getElementById('policy-name').value.trim();
    const description = document.getElementById('policy-description').value.trim();
    const type = document.getElementById('policy-type').value;
    const rateLimitType = type === 'rate_limit' ? document.getElementById('policy-rate-limit-type').value : null;

    if (!name) {
      alert('请输入策略名称');
      return;
    }
    if (!type) {
      alert('请选择策略类型');
      return;
    }

    const config = this.collectPolicyConfig(type, rateLimitType);

    try {
      const response = await this.api('/api/policies', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          type,
          rateLimitType,
          config,
          isActive: true
        })
      });

      if (response.success) {
        this.closeModal();
        this.loadPolicies();
      } else {
        alert('创建失败: ' + response.message);
      }
    } catch (error) {
      alert('创建失败: ' + error.message);
    }
  }

  async deletePolicy(id) {
    if (!confirm('确定要删除此策略吗？')) return;

    try {
      const response = await this.api(`/api/policies/${id}`, {
        method: 'DELETE'
      });

      if (response.success) {
        this.loadPolicies();
      } else {
        alert('删除失败: ' + response.message);
      }
    } catch (error) {
      alert('删除失败: ' + error.message);
    }
  }

  async showImportTraceModal() {
    const content = `
      <div class="form-group">
        <label class="form-label">流量名称 *</label>
        <input type="text" class="form-input" id="trace-name" placeholder="例如：双11流量峰值">
      </div>
      <div class="form-group">
        <label class="form-label">描述</label>
        <textarea class="form-textarea" id="trace-description" placeholder="描述流量特征..."></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">格式</label>
        <select class="form-select" id="trace-format">
          <option value="json">JSON</option>
          <option value="csv">CSV</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">流量数据 *</label>
        <textarea class="form-textarea" id="trace-data" style="min-height: 200px;" placeholder='[
  {"requestId": "req_001", "url": "/api/users", "method": "GET", "latency": 50, "responseInfo": {"statusCode": 200}},
  {"requestId": "req_002", "url": "/api/orders", "method": "POST", "latency": 120, "responseInfo": {"statusCode": 200}}
]'></textarea>
      </div>
      <div style="font-size: 0.8rem; color: #718096;">
        支持的字段: requestId, url, method, headers, body, query, latency, responseInfo.statusCode
      </div>
    `;

    this.showModal('导入流量', content, [
      { text: '取消', class: '', action: () => this.closeModal() },
      { text: '导入', class: 'btn-primary', action: () => this.importTrace() }
    ]);
  }

  async importTrace() {
    const name = document.getElementById('trace-name').value.trim();
    const description = document.getElementById('trace-description').value.trim();
    const format = document.getElementById('trace-format').value;
    const dataText = document.getElementById('trace-data').value.trim();

    if (!name) {
      alert('请输入流量名称');
      return;
    }
    if (!dataText) {
      alert('请输入流量数据');
      return;
    }

    try {
      const response = await this.api('/api/traces/import', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          format,
          content: dataText
        })
      });

      if (response.success) {
        this.closeModal();
        this.loadTraces();
      } else {
        alert('导入失败: ' + response.message);
      }
    } catch (error) {
      alert('导入失败: ' + error.message);
    }
  }

  async deleteTrace(id) {
    if (!confirm('确定要删除此流量追踪吗？')) return;

    try {
      const response = await this.api(`/api/traces/${id}`, {
        method: 'DELETE'
      });

      if (response.success) {
        this.loadTraces();
      } else {
        alert('删除失败: ' + response.message);
      }
    } catch (error) {
      alert('删除失败: ' + error.message);
    }
  }

  async viewPolicy(id) {
    try {
      const response = await this.api(`/api/policies/${id}`);
      if (response.success) {
        const policy = response.data;
        const content = `
          <div class="policy-info">
            <strong>策略类型:</strong> ${this.getTypeText(policy.type)}
            ${policy.rateLimitType ? ` / ${this.getRateLimitTypeText(policy.rateLimitType)}` : ''}
          </div>
          <div class="policy-info">
            <strong>状态:</strong> ${policy.isActive ? '已启用' : '已禁用'}
          </div>
          ${policy.description ? `<div class="policy-info"><strong>描述:</strong> ${policy.description}</div>` : ''}
          <div class="policy-info">
            <strong>配置详情:</strong>
            <pre>${JSON.stringify(policy.config, null, 2)}</pre>
          </div>
        `;
        this.showModal(`策略详情: ${policy.name}`, content, [
          { text: '关闭', class: '', action: () => this.closeModal() }
        ]);
      }
    } catch (error) {
      alert('获取策略详情失败: ' + error.message);
    }
  }

  async viewTrace(id) {
    try {
      const response = await this.api(`/api/traces/${id}`);
      if (response.success) {
        const trace = response.data;
        const previewData = trace.data ? JSON.stringify(trace.data.slice(0, 5), null, 2) : '[]';
        
        const content = `
          <div class="policy-info">
            <strong>请求数:</strong> ${trace.requestCount}
          </div>
          <div class="policy-info">
            <strong>来源:</strong> ${this.getSourceText(trace.source)}
          </div>
          ${trace.description ? `<div class="policy-info"><strong>描述:</strong> ${trace.description}</div>` : ''}
          <div class="policy-info">
            <strong>数据预览 (前5条):</strong>
            <pre style="max-height: 300px; overflow-y: auto;">${previewData}</pre>
          </div>
        `;
        this.showModal(`流量详情: ${trace.name}`, content, [
          { text: '关闭', class: '', action: () => this.closeModal() }
        ]);
      }
    } catch (error) {
      alert('获取流量详情失败: ' + error.message);
    }
  }

  async exportReport(format) {
    if (!this.currentExperimentId) {
      alert('请先选择实验');
      return;
    }

    try {
      window.open(`${this.apiBase}/api/experiments/${this.currentExperimentId}/export/${format}`, '_blank');
    } catch (error) {
      alert('导出失败: ' + error.message);
    }
  }

  showModal(title, body, actions = []) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    
    const footer = document.getElementById('modal-footer');
    footer.innerHTML = actions.map(a => `
      <button class="btn ${a.class}" onclick="app.handleModalAction(${actions.indexOf(a)})">${a.text}</button>
    `).join('');

    this.modalActions = actions;
    document.getElementById('modal-overlay').classList.remove('hidden');
  }

  handleModalAction(index) {
    if (this.modalActions && this.modalActions[index]) {
      this.modalActions[index].action();
    }
  }

  closeModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
  }

  getStatusBadge(status) {
    const map = {
      draft: 'secondary',
      running: 'warning',
      completed: 'success',
      failed: 'danger'
    };
    return map[status] || 'secondary';
  }

  getStatusText(status) {
    const map = {
      draft: '草稿',
      running: '运行中',
      completed: '已完成',
      failed: '失败'
    };
    return map[status] || status;
  }

  getTypeBadge(type) {
    const map = {
      rate_limit: 'info',
      circuit_breaker: 'warning',
      fallback: 'secondary',
      overload_protection: 'danger'
    };
    return map[type] || 'secondary';
  }

  getTypeText(type) {
    const map = {
      rate_limit: '限流',
      circuit_breaker: '熔断',
      fallback: '降级',
      overload_protection: '过载保护'
    };
    return map[type] || type;
  }

  getRateLimitTypeText(type) {
    const map = {
      token_bucket: '令牌桶',
      leaky_bucket: '漏桶',
      sliding_window: '滑动窗口'
    };
    return map[type] || type;
  }

  getSourceText(source) {
    const map = {
      file: '文件导入',
      manual: '手动创建',
      api: 'API',
      import: '导入'
    };
    return map[source] || source;
  }

  getActionBadge(action) {
    const map = {
      allow: 'success',
      queue: 'warning',
      reject: 'danger',
      fallback: 'info'
    };
    return map[action] || 'secondary';
  }

  getActionText(action) {
    const map = {
      allow: '放行',
      queue: '排队',
      reject: '拒绝',
      fallback: '降级'
    };
    return map[action] || action;
  }

  editExperiment(id) {
    alert('编辑功能敬请期待');
  }

  editPolicy(id) {
    alert('编辑功能敬请期待');
  }
}

const app = new App();
