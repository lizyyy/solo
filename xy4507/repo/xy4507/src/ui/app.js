const app = {
  currentView: 'list',
  currentOrderId: null,
  filters: {},
  orders: [],

  async init() {
    this.loadOrders();
    this.loadRiskStats();
  },

  async loadOrders() {
    try {
      const orders = await window.electronAPI.getOrders(this.filters);
      this.orders = orders;
      this.renderOrders();
    } catch (error) {
      console.error('加载订单失败:', error);
      this.showToast('加载订单失败', 'error');
    }
  },

  async loadRiskStats() {
    try {
      const stats = await window.electronAPI.getRiskStatistics();
      this.updateRiskStats(stats);
    } catch (error) {
      console.error('加载统计数据失败:', error);
    }
  },

  updateRiskStats(stats) {
    const highRisks = stats.filter(s => s.risk_level === 'high' && s.status === 'pending').reduce((sum, s) => sum + s.count, 0);
    const mediumRisks = stats.filter(s => s.risk_level === 'medium' && s.status === 'pending').reduce((sum, s) => sum + s.count, 0);
    const lowRisks = stats.filter(s => s.risk_level === 'low' && s.status === 'pending').reduce((sum, s) => sum + s.count, 0);

    const statCards = document.querySelectorAll('.stat-card');
    if (statCards[0]) statCards[0].querySelector('.stat-value').textContent = this.orders.length;
    if (statCards[1]) statCards[1].querySelector('.stat-value').textContent = highRisks;
    if (statCards[2]) statCards[2].querySelector('.stat-value').textContent = mediumRisks;
    if (statCards[3]) statCards[3].querySelector('.stat-value').textContent = lowRisks;
  },

  renderOrders() {
    const container = document.getElementById('orderList');
    
    if (this.orders.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">暂无订单数据</div>
          <div class="empty-state-hint">点击"新建订单"或"导入数据"开始使用</div>
        </div>
      `;
      return;
    }

    if (this.currentView === 'list') {
      container.className = 'order-list list-view';
      container.innerHTML = this.orders.map(order => this.renderOrderListItem(order)).join('');
    } else {
      container.className = 'order-list card-view';
      container.innerHTML = this.orders.map(order => this.renderOrderCardItem(order)).join('');
    }
  },

  renderOrderListItem(order) {
    const hasRisk = order.pending_risks > 0;
    const hasHighRisk = order.high_risks > 0;
    
    let riskClass = '';
    if (hasHighRisk) riskClass = 'has-risk';
    else if (hasRisk) riskClass = 'has-medium-risk';

    const riskBadges = this.renderRiskBadges(order);

    return `
      <div class="order-item ${riskClass}" onclick="app.showOrderDetail(${order.id})">
        <div class="order-info">
          <span class="order-info-label">订单号</span>
          <span class="order-info-value">${order.order_number}</span>
        </div>
        <div class="order-info">
          <span class="order-info-label">患者姓名</span>
          <span class="order-info-value">${order.patient_name}</span>
        </div>
        <div class="order-info">
          <span class="order-info-label">下单日期</span>
          <span class="order-info-value">${order.order_date}</span>
        </div>
        <div class="order-info">
          <span class="order-info-label">预计取镜</span>
          <span class="order-info-value">${order.pickup_date}</span>
        </div>
        <div class="order-status ${order.status}">
          ${this.getStatusText(order.status)}
        </div>
        <div class="risk-badges">
          ${riskBadges}
        </div>
      </div>
    `;
  },

  renderOrderCardItem(order) {
    const hasRisk = order.pending_risks > 0;
    const hasHighRisk = order.high_risks > 0;
    
    let riskClass = '';
    if (hasHighRisk) riskClass = 'has-risk';
    else if (hasRisk) riskClass = 'has-medium-risk';

    const riskBadges = this.renderRiskBadges(order);

    return `
      <div class="order-item ${riskClass}" onclick="app.showOrderDetail(${order.id})">
        <div class="order-header">
          <div>
            <div class="order-number">${order.order_number}</div>
            <div class="order-patient">${order.patient_name}</div>
          </div>
          <div class="order-status ${order.status}">
            ${this.getStatusText(order.status)}
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div class="order-info">
            <span class="order-info-label">下单日期</span>
            <span class="order-info-value">${order.order_date}</span>
          </div>
          <div class="order-info">
            <span class="order-info-label">预计取镜</span>
            <span class="order-info-value">${order.pickup_date}</span>
          </div>
        </div>
        ${riskBadges ? `<div class="risk-badges">${riskBadges}</div>` : ''}
      </div>
    `;
  },

  renderRiskBadges(order) {
    const badges = [];
    
    if (order.high_risks > 0) {
      badges.push(`<span class="risk-badge high">🔴 ${order.high_risks} 高风险</span>`);
    }
    if (order.pending_risks > order.high_risks) {
      badges.push(`<span class="risk-badge medium">🟡 ${order.pending_risks - order.high_risks} 待处理</span>`);
    }
    
    return badges.join('');
  },

  getStatusText(status) {
    const statusMap = {
      'pending': '处理中',
      'completed': '已完成',
      'delivered': '已交付'
    };
    return statusMap[status] || status;
  },

  setView(view) {
    this.currentView = view;
    
    const viewBtns = document.querySelectorAll('.view-btn');
    viewBtns.forEach(btn => btn.classList.remove('active'));
    viewBtns[view === 'list' ? 0 : 1].classList.add('active');
    
    this.renderOrders();
  },

  applyFilters() {
    const status = document.getElementById('filterStatus').value;
    const hasRisk = document.getElementById('filterRisk').value;
    const startDate = document.getElementById('filterStartDate').value;
    const endDate = document.getElementById('filterEndDate').value;

    this.filters = {};
    if (status) this.filters.status = status;
    if (hasRisk) this.filters.hasRisk = hasRisk;
    if (startDate) this.filters.startDate = startDate;
    if (endDate) this.filters.endDate = endDate;

    this.loadOrders();
  },

  resetFilters() {
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterRisk').value = '';
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    
    this.filters = {};
    this.loadOrders();
  },

  async searchOrders(keyword) {
    if (!keyword.trim()) {
      this.loadOrders();
      return;
    }

    try {
      const orders = await window.electronAPI.searchOrders(keyword);
      this.orders = orders;
      this.renderOrders();
    } catch (error) {
      console.error('搜索失败:', error);
      this.showToast('搜索失败', 'error');
    }
  },

  showCreateOrderModal() {
    this.resetForm();
    
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('orderDate').value = today;
    
    const pickupDate = new Date();
    pickupDate.setDate(pickupDate.getDate() + 5);
    document.getElementById('pickupDate').value = pickupDate.toISOString().slice(0, 10);

    document.getElementById('createOrderModal').classList.add('active');
  },

  setPrescTab(eye) {
    const tabs = document.querySelectorAll('.presc-tab');
    const panels = document.querySelectorAll('.presc-panel');

    tabs.forEach(tab => tab.classList.remove('active'));
    panels.forEach(panel => panel.classList.add('hidden'));

    tabs[eye === 'left' ? 0 : 1].classList.add('active');
    panels[eye === 'left' ? 0 : 1].classList.remove('hidden');
  },

  resetForm() {
    const form = document.getElementById('orderForm');
    if (form) form.reset();
    
    document.getElementById('leftSphere').value = '';
    document.getElementById('leftCylinder').value = '';
    document.getElementById('leftAxis').value = '';
    document.getElementById('leftAdd').value = '';
    document.getElementById('leftPd').value = '';
    document.getElementById('leftPh').value = '';
    
    document.getElementById('rightSphere').value = '';
    document.getElementById('rightCylinder').value = '';
    document.getElementById('rightAxis').value = '';
    document.getElementById('rightAdd').value = '';
    document.getElementById('rightPd').value = '';
    document.getElementById('rightPh').value = '';
  },

  parseNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    const num = parseFloat(value);
    return isNaN(num) ? null : num;
  },

  async saveOrder() {
    const orderNumber = document.getElementById('orderNumber').value.trim();
    const patientName = document.getElementById('patientName').value.trim();

    if (!orderNumber || !patientName) {
      this.showToast('请填写订单号和患者姓名', 'warning');
      return;
    }

    const prescriptions = [];
    
    const leftSphere = this.parseNumber(document.getElementById('leftSphere').value);
    const leftCylinder = this.parseNumber(document.getElementById('leftCylinder').value);
    if (leftSphere !== null || leftCylinder !== null) {
      prescriptions.push({
        eye_type: 'left',
        sphere: leftSphere,
        cylinder: leftCylinder,
        axis: this.parseNumber(document.getElementById('leftAxis').value),
        add_power: this.parseNumber(document.getElementById('leftAdd').value),
        pd: this.parseNumber(document.getElementById('leftPd').value),
        ph: this.parseNumber(document.getElementById('leftPh').value)
      });
    }

    const rightSphere = this.parseNumber(document.getElementById('rightSphere').value);
    const rightCylinder = this.parseNumber(document.getElementById('rightCylinder').value);
    if (rightSphere !== null || rightCylinder !== null) {
      prescriptions.push({
        eye_type: 'right',
        sphere: rightSphere,
        cylinder: rightCylinder,
        axis: this.parseNumber(document.getElementById('rightAxis').value),
        add_power: this.parseNumber(document.getElementById('rightAdd').value),
        pd: this.parseNumber(document.getElementById('rightPd').value),
        ph: this.parseNumber(document.getElementById('rightPh').value)
      });
    }

    const orderData = {
      order_number: orderNumber,
      patient_name: patientName,
      phone: document.getElementById('phone').value.trim() || null,
      order_date: document.getElementById('orderDate').value,
      pickup_date: document.getElementById('pickupDate').value,
      prescriptions,
      frames: {
        frame_brand: document.getElementById('frameBrand').value.trim() || null,
        frame_model: document.getElementById('frameModel').value.trim() || null,
        frame_width: this.parseNumber(document.getElementById('frameWidth').value),
        bridge_width: this.parseNumber(document.getElementById('frameBridgeWidth').value),
        temple_length: this.parseNumber(document.getElementById('frameTempleLength').value),
        lens_width: this.parseNumber(document.getElementById('frameLensWidth').value)
      },
      lenses: []
    };

    const leftLensBrand = document.getElementById('leftLensBrand').value.trim();
    const leftLensType = document.getElementById('leftLensType').value;
    const leftLensDiameter = this.parseNumber(document.getElementById('leftLensDiameter').value);
    if (leftLensBrand || leftLensType || leftLensDiameter) {
      orderData.lenses.push({
        eye_type: 'left',
        lens_brand: leftLensBrand || null,
        lens_type: leftLensType || null,
        lens_diameter: leftLensDiameter
      });
    }

    const rightLensBrand = document.getElementById('rightLensBrand').value.trim();
    const rightLensType = document.getElementById('rightLensType').value;
    const rightLensDiameter = this.parseNumber(document.getElementById('rightLensDiameter').value);
    if (rightLensBrand || rightLensType || rightLensDiameter) {
      orderData.lenses.push({
        eye_type: 'right',
        lens_brand: rightLensBrand || null,
        lens_type: rightLensType || null,
        lens_diameter: rightLensDiameter
      });
    }

    const grindingDate = document.getElementById('grindingDate').value;
    const grindingMachine = document.getElementById('grindingMachine').value.trim();
    if (grindingDate || grindingMachine) {
      orderData.grinding_log = {
        grinding_date: grindingDate || null,
        grinding_machine: grindingMachine || null,
        operator: document.getElementById('grindingOperator').value.trim() || null,
        lens_size_w: this.parseNumber(document.getElementById('lensSizeW').value),
        lens_size_h: this.parseNumber(document.getElementById('lensSizeH').value),
        edge_thickness: this.parseNumber(document.getElementById('edgeThickness').value),
        remarks: document.getElementById('grindingRemarks').value.trim() || null
      };
    }

    const qcDate = document.getElementById('qcDate').value;
    const qcChecker = document.getElementById('qcChecker').value.trim();
    if (qcDate || qcChecker) {
      orderData.quality_check = {
        check_date: qcDate || null,
        checker: qcChecker || null,
        visual_acuity_left: document.getElementById('qcVaLeft').value.trim() || null,
        visual_acuity_right: document.getElementById('qcVaRight').value.trim() || null,
        axis_verification: document.getElementById('qcAxisVerification').value || null,
        overall_result: document.getElementById('qcResult').value || null,
        remarks: document.getElementById('qcRemarks').value.trim() || null
      };
    }

    try {
      await window.electronAPI.createOrder(orderData);
      this.showToast('订单创建成功', 'success');
      this.closeModal('createOrderModal');
      this.loadOrders();
      this.loadRiskStats();
    } catch (error) {
      console.error('创建订单失败:', error);
      this.showToast('创建订单失败: ' + error.message, 'error');
    }
  },

  async showOrderDetail(orderId) {
    this.currentOrderId = orderId;
    const modal = document.getElementById('orderDetailModal');
    const content = document.getElementById('orderDetailContent');
    
    modal.classList.add('active');
    
    content.innerHTML = `
      <div class="loading-state">
        <div class="spinner"></div>
        <p>加载中...</p>
      </div>
    `;

    try {
      const [order, risks, notes] = await Promise.all([
        window.electronAPI.getOrderById(orderId),
        window.electronAPI.getOrderRisks(orderId),
        window.electronAPI.getNotes(orderId)
      ]);

      document.getElementById('detailOrderTitle').textContent = `订单详情 - ${order.order_number}`;
      content.innerHTML = this.renderOrderDetail(order, risks, notes);
    } catch (error) {
      console.error('加载订单详情失败:', error);
      content.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">❌</div>
          <div class="empty-state-text">加载失败</div>
          <div class="empty-state-hint">${error.message}</div>
        </div>
      `;
    }
  },

  renderOrderDetail(order, risks, notes) {
    const riskTypeNames = {
      axis_error: '轴位抄错风险',
      lens_diameter: '镜片直径风险',
      eye_swap: '左右眼装反风险',
      pickup_time: '取镜时间风险'
    };

    const riskLevelNames = {
      high: '高风险',
      medium: '中风险',
      low: '低风险'
    };

    const riskStatusNames = {
      pending: '待处理',
      confirmed: '已确认',
      dismissed: '已驳回',
      resolved: '已解决'
    };

    let html = `
      <div class="detail-section">
        <h3>📋 基本信息</h3>
        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">订单号</span>
            <span class="detail-value">${order.order_number}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">患者姓名</span>
            <span class="detail-value">${order.patient_name}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">联系电话</span>
            <span class="detail-value">${order.phone || '-'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">下单日期</span>
            <span class="detail-value">${order.order_date}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">预计取镜</span>
            <span class="detail-value">${order.pickup_date}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">订单状态</span>
            <span class="detail-value">${this.getStatusText(order.status)}</span>
          </div>
        </div>
      </div>
    `;

    if (order.prescriptions && order.prescriptions.length > 0) {
      html += `
        <div class="detail-section">
          <h3>👁️ 处方信息</h3>
          <div class="detail-grid two-col">
      `;
      
      for (const presc of order.prescriptions) {
        const eyeName = presc.eye_type === 'left' ? '左眼 (OS)' : '右眼 (OD)';
        html += `
          <div style="background-color: var(--bg-secondary); padding: 16px; border-radius: var(--radius-md);">
            <h4 style="margin-bottom: 12px; color: var(--primary-color);">${eyeName}</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">球镜 (S)</span>
                <span class="detail-value">${this.formatDiopter(presc.sphere)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">柱镜 (C)</span>
                <span class="detail-value">${this.formatDiopter(presc.cylinder)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">轴位 (A)</span>
                <span class="detail-value">${presc.axis !== null ? presc.axis + '°' : '-'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">下加光 (ADD)</span>
                <span class="detail-value">${this.formatDiopter(presc.add_power)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">瞳距 (PD)</span>
                <span class="detail-value">${presc.pd !== null ? presc.pd + 'mm' : '-'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">瞳高 (PH)</span>
                <span class="detail-value">${presc.ph !== null ? presc.ph + 'mm' : '-'}</span>
              </div>
            </div>
          </div>
        `;
      }
      
      html += `</div></div>`;
    }

    if (order.frames) {
      html += `
        <div class="detail-section">
          <h3>👓 镜架信息</h3>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="detail-label">品牌</span>
              <span class="detail-value">${order.frames.frame_brand || '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">型号</span>
              <span class="detail-value">${order.frames.frame_model || '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">镜片宽度</span>
              <span class="detail-value">${order.frames.lens_width !== null ? order.frames.lens_width + 'mm' : '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">镜框宽度</span>
              <span class="detail-value">${order.frames.frame_width !== null ? order.frames.frame_width + 'mm' : '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">鼻梁宽度</span>
              <span class="detail-value">${order.frames.bridge_width !== null ? order.frames.bridge_width + 'mm' : '-'}</span>
            </div>
            <div class="detail-item">
              <span class="detail-label">镜腿长度</span>
              <span class="detail-value">${order.frames.temple_length !== null ? order.frames.temple_length + 'mm' : '-'}</span>
            </div>
          </div>
        </div>
      `;
    }

    if (order.lenses && order.lenses.length > 0) {
      html += `
        <div class="detail-section">
          <h3>🔍 镜片信息</h3>
          <div class="detail-grid two-col">
      `;
      
      for (const lens of order.lenses) {
        const eyeName = lens.eye_type === 'left' ? '左眼 (OS)' : '右眼 (OD)';
        html += `
          <div style="background-color: var(--bg-secondary); padding: 16px; border-radius: var(--radius-md);">
            <h4 style="margin-bottom: 12px; color: var(--primary-color);">${eyeName}</h4>
            <div class="detail-grid">
              <div class="detail-item">
                <span class="detail-label">品牌</span>
                <span class="detail-value">${lens.lens_brand || '-'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">类型</span>
                <span class="detail-value">${lens.lens_type || '-'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">直径</span>
                <span class="detail-value">${lens.lens_diameter !== null ? lens.lens_diameter + 'mm' : '-'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">基弧</span>
                <span class="detail-value">${lens.base_curve !== null ? lens.base_curve : '-'}</span>
              </div>
            </div>
          </div>
        `;
      }
      
      html += `</div></div>`;
    }

    if (risks && risks.length > 0) {
      html += `
        <div class="risks-section">
          <h3>⚠️ 风险检测结果 (${risks.length}项)</h3>
      `;
      
      for (const risk of risks) {
        let evidenceHtml = '';
        let hintHtml = '';
        
        if (risk.evidence) {
          try {
            const evidence = JSON.parse(risk.evidence);
            const keys = Object.keys(evidence).filter(k => k !== 'hint');
            if (keys.length > 0) {
              evidenceHtml = keys.map(k => `<div><strong>${k}:</strong> ${evidence[k]}</div>`).join('');
            }
            if (evidence.hint) {
              hintHtml = `<div class="risk-evidence-hint">💡 ${evidence.hint}</div>`;
            }
          } catch (e) {
            evidenceHtml = risk.evidence;
          }
        }

        html += `
          <div class="risk-item ${risk.risk_level} ${risk.status}" id="risk-${risk.id}">
            <div class="risk-header">
              <div class="risk-title">
                <span class="risk-level ${risk.risk_level}">${riskLevelNames[risk.risk_level]}</span>
                <span class="risk-type">${riskTypeNames[risk.risk_type] || risk.risk_type}</span>
              </div>
              <span class="risk-status ${risk.status}">${riskStatusNames[risk.status]}</span>
            </div>
            <div class="risk-description">${risk.description}</div>
            ${evidenceHtml ? `<div class="risk-evidence">${evidenceHtml}${hintHtml}</div>` : ''}
            ${risk.reviewer_remark ? `<div style="margin-top: 8px; padding: 8px; background-color: var(--bg-primary); border-radius: var(--radius-sm); font-size: 13px; color: var(--text-secondary);">
              📝 复核备注: ${risk.reviewer_remark}
            </div>` : ''}
            <div class="risk-actions">
              <input type="text" id="risk-remark-${risk.id}" placeholder="输入复核备注（可选）">
              <button class="btn btn-success btn-small" onclick="app.updateRiskStatus(${risk.id}, 'resolved')">
                ✓ 已解决
              </button>
              <button class="btn btn-secondary btn-small" onclick="app.updateRiskStatus(${risk.id}, 'dismissed')">
                ✗ 驳回
              </button>
              <button class="btn btn-danger btn-small" onclick="app.updateRiskStatus(${risk.id}, 'confirmed')">
                ! 确认风险
              </button>
            </div>
          </div>
        `;
      }
      
      html += `</div>`;
    }

    html += `
      <div class="notes-section">
        <h3>📝 备注记录</h3>
    `;

    if (notes && notes.length > 0) {
      for (const note of notes) {
        const noteTime = new Date(note.created_at).toLocaleString('zh-CN');
        html += `
          <div class="note-item">
            <div class="note-time">${noteTime}</div>
            <div class="note-content">${note.content}</div>
          </div>
        `;
      }
    } else {
      html += `<div style="color: var(--text-light); padding: 16px;">暂无备注</div>`;
    }

    html += `
        <div class="add-note">
          <input type="text" id="newNoteInput" placeholder="输入新备注...">
          <button class="btn btn-primary" onclick="app.addNote()">添加备注</button>
        </div>
      </div>
    `;

    return html;
  },

  formatDiopter(value) {
    if (value === null || value === undefined) return '-';
    const num = Number(value);
    if (isNaN(num)) return '-';
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(2)}D`;
  },

  async updateRiskStatus(riskId, status) {
    const remarkInput = document.getElementById(`risk-remark-${riskId}`);
    const remark = remarkInput ? remarkInput.value.trim() : '';

    try {
      await window.electronAPI.updateRiskStatus(riskId, status, remark);
      this.showToast('风险状态已更新', 'success');
      this.refreshOrderDetail();
      this.loadRiskStats();
    } catch (error) {
      console.error('更新风险状态失败:', error);
      this.showToast('更新失败: ' + error.message, 'error');
    }
  },

  async addNote() {
    const input = document.getElementById('newNoteInput');
    const content = input ? input.value.trim() : '';

    if (!content) {
      this.showToast('请输入备注内容', 'warning');
      return;
    }

    try {
      await window.electronAPI.addNote(this.currentOrderId, content);
      this.showToast('备注已添加', 'success');
      this.refreshOrderDetail();
    } catch (error) {
      console.error('添加备注失败:', error);
      this.showToast('添加失败: ' + error.message, 'error');
    }
  },

  async refreshOrderDetail() {
    if (this.currentOrderId) {
      await this.showOrderDetail(this.currentOrderId);
    }
  },

  async exportCurrentOrderMarkdown() {
    if (!this.currentOrderId) return;

    try {
      const result = await window.electronAPI.exportMarkdown(this.currentOrderId);
      if (result.success) {
        this.showToast(`交接单已导出到: ${result.path}`, 'success');
      }
    } catch (error) {
      console.error('导出失败:', error);
      this.showToast('导出失败: ' + error.message, 'error');
    }
  },

  async importData() {
    try {
      const result = await window.electronAPI.importExcel();
      
      if (result.success) {
        this.showToast(result.message, 'success');
        this.loadOrders();
        this.loadRiskStats();
      } else {
        if (result.message !== '取消选择') {
          this.showToast(result.message, 'error');
        }
      }
    } catch (error) {
      console.error('导入失败:', error);
      this.showToast('导入失败: ' + error.message, 'error');
    }
  },

  async exportAllData() {
    try {
      const result = await window.electronAPI.exportJSON();
      
      if (result.success) {
        this.showToast(`审计明细已导出到: ${result.path}`, 'success');
      }
    } catch (error) {
      console.error('导出失败:', error);
      this.showToast('导出失败: ' + error.message, 'error');
    }
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
    }
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="toast-icon ${type}">${icons[type]}</span>
      <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
      });
    }
  });
});
