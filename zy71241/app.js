// ==========================================
// 3D打印农场调度 - 前端应用逻辑
// ==========================================

let engine = new SchedulingEngine();
let scoring = new ScoringEngine(engine);
let currentReport = null;

// ========== Tab 切换 ==========
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const tabName = tab.dataset.tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    if (tabName === 'dashboard') updateDashboard();
    if (tabName === 'setup') updateSetupPage();
    if (tabName === 'orders') updateOrdersPage();
    if (tabName === 'schedule') updateSchedulePage();
    if (tabName === 'execute') updateExecutePage();
  });
});

// ========== 通用工具函数 ==========
function updateCurrentTime() {
  document.getElementById('currentTime').textContent = 
    `当前时间: ${engine.currentTime.toLocaleString('zh-CN')}`;
}

function showValidationResult(elementId, validation) {
  const el = document.getElementById(elementId);
  if (validation.valid && validation.warnings.length === 0) {
    el.innerHTML = '<div class="alert alert-success">✓ 验证通过</div>';
  } else {
    let html = '';
    if (!validation.valid) {
      html += '<div class="alert alert-error">';
      html += '<strong>❌ 缺少必填字段:</strong><br>';
      validation.missingFields.forEach(f => {
        html += `• ${f.field}: ${f.description}<br>`;
      });
      html += '</div>';
    }
    if (validation.warnings.length > 0) {
      html += '<div class="alert alert-warning">';
      html += '<strong>⚠️ 警告:</strong><br>';
      validation.warnings.forEach(w => {
        html += `• ${w}<br>`;
      });
      html += '</div>';
    }
    el.innerHTML = html;
  }
}

function showMessage(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.textContent = message;
  document.body.insertBefore(el, document.body.firstChild);
  setTimeout(() => el.remove(), 3000);
}

// ========== 控制台更新 ==========
function updateDashboard() {
  updateCurrentTime();
  
  document.getElementById('printerCount').textContent = engine.printers.size;
  document.getElementById('printerIdle').textContent = 
    Array.from(engine.printers.values()).filter(p => p.isAvailable()).length;
  document.getElementById('printerBusy').textContent = 
    Array.from(engine.printers.values()).filter(p => !p.isAvailable()).length;
  
  document.getElementById('materialCount').textContent = engine.materials.size;
  document.getElementById('materialInstalled').textContent = 
    Array.from(engine.materials.values()).filter(m => m.currentPrinterId).length;
  document.getElementById('materialLow').textContent = 
    Array.from(engine.materials.values()).filter(m => m.getRemainingPercentage() < 20).length;
  
  document.getElementById('nozzleCount').textContent = engine.nozzles.size;
  document.getElementById('nozzleInstalled').textContent = 
    Array.from(engine.nozzles.values()).filter(n => n.currentPrinterId).length;
  document.getElementById('nozzleReplace').textContent = 
    Array.from(engine.nozzles.values()).filter(n => n.needsReplacement()).length;
  
  document.getElementById('orderCount').textContent = engine.orders.size;
  document.getElementById('orderDone').textContent = 
    Array.from(engine.orders.values()).filter(o => o.status === OrderStatus.COMPLETED).length;
  document.getElementById('orderDoing').textContent = 
    Array.from(engine.orders.values()).filter(o => 
      o.status === OrderStatus.PRINTING || o.status === OrderStatus.SCHEDULED).length;
  
  updateIssuesList();
  updateReviewList();
  updateEventLog();
}

function updateIssuesList() {
  const el = document.getElementById('issuesList');
  if (engine.issues.length === 0) {
    el.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">暂无问题记录</p>';
    return;
  }
  
  el.innerHTML = engine.issues.slice().reverse().map(issue => `
    <div class="issue ${issue.severity}">
      <strong>${issue.getTypeName()}</strong>
      <span style="float: right; color: #64748b; font-size: 12px;">${issue.timestamp.toLocaleString()}</span>
      <p style="margin: 5px 0 0 0; color: #334155;">${issue.reason}</p>
      <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">影响对象: ${JSON.stringify(issue.affectedObjects)}</p>
    </div>
  `).join('');
}

function updateReviewList() {
  const el = document.getElementById('reviewList');
  const items = scoring.collectPendingReviewItems();
  if (items.length === 0) {
    el.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">暂无待复核项目</p>';
    return;
  }
  
  el.innerHTML = items.map((item, idx) => `
    <div class="review-item">
      <strong>${idx + 1}. ${item.type === 'order' ? '订单' : item.type === 'fault' ? '故障' : item.type === 'nozzle_maintenance' ? '喷嘴维护' : '未解决问题'}</strong>
      ${item.id ? `<span style="margin-left: 10px;">ID: ${item.id}</span>` : ''}
      ${item.name ? `<span style="margin-left: 10px;">名称: ${item.name}</span>` : ''}
      ${item.faultType ? `<span style="margin-left: 10px;">故障: ${item.faultType}</span>` : ''}
      ${item.notes && item.notes.length > 0 ? `
        <p style="margin: 8px 0 0 0;">备注:</p>
        ${item.notes.map(n => `<p style="margin: 2px 0 0 20px; color: #64748b;">• ${n}</p>`).join('')}
      ` : ''}
    </div>
  `).join('');
}

function updateEventLog() {
  const el = document.getElementById('eventLog');
  if (engine.eventLog.length === 0) {
    el.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">暂无事件记录</p>';
    return;
  }
  
  el.innerHTML = engine.eventLog.slice().reverse().map(event => `
    <div style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
      <span style="color: #64748b;">${event.timestamp.toLocaleTimeString()}</span>
      <strong style="margin-left: 10px;">${event.type}</strong>
      <span style="margin-left: 10px; color: #475569;">${JSON.stringify(event.details)}</span>
    </div>
  `).join('');
}

// ========== 设备配置页面 ==========
function addPrinter() {
  const data = {
    id: document.getElementById('printerId').value,
    name: document.getElementById('printerName').value,
    supportedMaterials: document.getElementById('printerMaterials').value.split(',').map(s => s.trim()),
    maxNozzleSize: document.getElementById('printerNozzleMax').value
  };
  
  const result = engine.addPrinter(data);
  showValidationResult('printerValidation', result.validation);
  
  if (result.success) {
    showMessage(`打印机 ${data.name} 已添加`, 'success');
    document.getElementById('printerId').value = '';
    document.getElementById('printerName').value = '';
  }
  
  updateSetupPage();
}

function addMaterial() {
  const data = {
    id: document.getElementById('materialId').value,
    materialType: document.getElementById('materialType').value,
    color: document.getElementById('materialColor').value,
    totalLength: parseFloat(document.getElementById('materialLength').value)
  };
  
  const result = engine.addMaterial(data);
  showValidationResult('materialValidation', result.validation);
  
  if (result.success) {
    showMessage(`材料 ${data.id} 已添加`, 'success');
    document.getElementById('materialId').value = '';
    document.getElementById('materialColor').value = '';
    document.getElementById('materialLength').value = '';
  }
  
  updateSetupPage();
}

function addNozzle() {
  const data = {
    id: document.getElementById('nozzleId').value,
    size: document.getElementById('nozzleSize').value,
    material: document.getElementById('nozzleMaterial').value
  };
  
  const result = engine.addNozzle(data);
  showValidationResult('nozzleValidation', result.validation);
  
  if (result.success) {
    showMessage(`喷嘴 ${data.id} 已添加`, 'success');
    document.getElementById('nozzleId').value = '';
  }
  
  updateSetupPage();
}

function installMaterial() {
  const printerId = document.getElementById('installPrinterForMaterial').value;
  const materialId = document.getElementById('installMaterial').value;
  
  if (!printerId || !materialId) {
    showMessage('请选择打印机和材料', 'warning');
    return;
  }
  
  const result = engine.installMaterial(printerId, materialId);
  if (result.success) {
    showMessage('材料安装成功', 'success');
  } else {
    showMessage(result.issue.reason || '安装失败', 'error');
  }
  
  updateSetupPage();
}

function installNozzle() {
  const printerId = document.getElementById('installPrinterForNozzle').value;
  const nozzleId = document.getElementById('installNozzle').value;
  
  if (!printerId || !nozzleId) {
    showMessage('请选择打印机和喷嘴', 'warning');
    return;
  }
  
  const result = engine.installNozzle(printerId, nozzleId);
  if (result.success) {
    showMessage('喷嘴安装成功', 'success');
  } else {
    showMessage(result.issue.reason || '安装失败', 'error');
  }
  
  updateSetupPage();
}

function updateSetupPage() {
  const printersList = document.getElementById('printersList');
  if (engine.printers.size === 0) {
    printersList.innerHTML = '<p style="color: #94a3b8; text-align: center;">暂无打印机</p>';
  } else {
    printersList.innerHTML = Array.from(engine.printers.values()).map(p => `
      <div style="padding: 10px; background: white; border-radius: 6px; margin-bottom: 8px;">
        <strong>${p.id} - ${p.name}</strong>
        <p style="margin: 4px 0; font-size: 12px; color: #64748b;">
          支持材料: ${p.supportedMaterials.join(', ')}<br>
          最大喷嘴: ${p.maxNozzleSize}<br>
          状态: ${p.getStatus()}<br>
          材料: ${p.currentMaterial || '未安装'} | 喷嘴: ${p.currentNozzle || '未安装'}
        </p>
      </div>
    `).join('');
  }
  
  const materialsList = document.getElementById('materialsList');
  if (engine.materials.size === 0) {
    materialsList.innerHTML = '<p style="color: #94a3b8; text-align: center;">暂无材料</p>';
  } else {
    materialsList.innerHTML = Array.from(engine.materials.values()).map(m => `
      <div style="padding: 10px; background: white; border-radius: 6px; margin-bottom: 8px;">
        <strong>${m.id}</strong>
        <span class="status-badge" style="background: #${m.color === '白色' ? 'f1f5f9; color: #334155' : 'e0e7ff; color: #4338ca'};">
          ${m.materialType} - ${m.color}
        </span>
        <p style="margin: 4px 0; font-size: 12px; color: #64748b;">
          剩余: ${m.getRemainingPercentage()}% (${m.remainingLength}/${m.totalLength}mm)<br>
          状态: ${m.currentPrinterId ? `已安装到 ${m.currentPrinterId}` : '未安装'}
        </p>
      </div>
    `).join('');
  }
  
  const nozzlesList = document.getElementById('nozzlesList');
  if (engine.nozzles.size === 0) {
    nozzlesList.innerHTML = '<p style="color: #94a3b8; text-align: center;">暂无喷嘴</p>';
  } else {
    nozzlesList.innerHTML = Array.from(engine.nozzles.values()).map(n => {
      const wearColor = n.getWearPercentage() > 80 ? '#ef4444' : n.getWearPercentage() > 50 ? '#f59e0b' : '#22c55e';
      return `
        <div style="padding: 10px; background: white; border-radius: 6px; margin-bottom: 8px;">
          <strong>${n.id}</strong>
          <span class="status-badge" style="background: #dbeafe; color: #1e40af;">${n.size}</span>
          <span class="status-badge" style="background: #f3e8ff; color: #7c3aed;">${n.material}</span>
          <p style="margin: 4px 0; font-size: 12px; color: #64748b;">
            磨损: <span style="color: ${wearColor}; font-weight: bold;">${n.getWearPercentage()}%</span> | 
            堵塞次数: ${n.clogCount} | 
            状态: ${n.currentPrinterId ? `已安装到 ${n.currentPrinterId}` : '未安装'}<br>
            ${n.needsReplacement() ? '<span style="color: #ef4444;">⚠️ 需要更换</span>' : ''}
          </p>
        </div>
      `;
    }).join('');
  }
  
  updatePrinterSelectors();
  updateMaterialSelectors();
  updateNozzleSelectors();
  updateCurrentTime();
}

function updatePrinterSelectors() {
  const selects = ['installPrinterForMaterial', 'installPrinterForNozzle', 'faultPrinter', 'schedulePrinter'];
  selects.forEach(selId => {
    const sel = document.getElementById(selId);
    const currentValue = sel.value;
    sel.innerHTML = '<option value="">请选择打印机</option>' +
      Array.from(engine.printers.values()).map(p => 
        `<option value="${p.id}">${p.id} - ${p.name}</option>`
      ).join('');
    sel.value = currentValue;
  });
}

function updateMaterialSelectors() {
  const sel = document.getElementById('installMaterial');
  const currentValue = sel.value;
  sel.innerHTML = '<option value="">请选择材料</option>' +
    Array.from(engine.materials.values())
      .filter(m => !m.currentPrinterId)
      .map(m => `<option value="${m.id}">${m.id} - ${m.materialType} - ${m.color}</option>`)
      .join('');
  sel.value = currentValue;
}

function updateNozzleSelectors() {
  const sel = document.getElementById('installNozzle');
  const currentValue = sel.value;
  sel.innerHTML = '<option value="">请选择喷嘴</option>' +
    Array.from(engine.nozzles.values())
      .filter(n => !n.currentPrinterId)
      .map(n => `<option value="${n.id}">${n.id} - ${n.size} - ${n.material}</option>`)
      .join('');
  sel.value = currentValue;
}

// ========== 订单管理页面 ==========
function addOrder() {
  const data = {
    id: document.getElementById('orderId').value,
    name: document.getElementById('orderName').value,
    requiredMaterial: document.getElementById('orderMaterial').value,
    requiredNozzleSize: document.getElementById('orderNozzle').value,
    printLength: parseFloat(document.getElementById('orderLength').value),
    estimatedHours: parseFloat(document.getElementById('orderHours').value),
    deadline: document.getElementById('orderDeadline').value,
    priority: parseInt(document.getElementById('orderPriority').value)
  };
  
  const result = engine.addOrder(data);
  showValidationResult('orderValidation', result.validation);
  
  if (result.success) {
    showMessage(`订单 ${data.name} 已添加`, 'success');
    document.getElementById('orderId').value = '';
    document.getElementById('orderName').value = '';
    document.getElementById('orderLength').value = '';
    document.getElementById('orderHours').value = '';
    document.getElementById('orderDeadline').value = '';
  }
  
  updateOrdersPage();
}

function addFault() {
  const data = {
    id: document.getElementById('faultId').value,
    type: document.getElementById('faultType').value,
    printerId: document.getElementById('faultPrinter').value
  };
  
  const result = engine.addFaultEvent(data);
  showValidationResult('faultValidation', result.validation);
  
  if (result.success) {
    showMessage(`故障 ${data.id} 已记录`, 'success');
    document.getElementById('faultId').value = '';
  }
  
  updateOrdersPage();
}

function updateOrdersPage() {
  const ordersList = document.getElementById('ordersList');
  if (engine.orders.size === 0) {
    ordersList.innerHTML = '<p style="color: #94a3b8; text-align: center;">暂无订单</p>';
  } else {
    ordersList.innerHTML = Array.from(engine.orders.values()).map(o => {
      const statusClass = `status-${o.status}`;
      const isUrgent = o.deadline && o.isUrgent(engine.currentTime);
      return `
        <div style="padding: 10px; background: white; border-radius: 6px; margin-bottom: 8px;">
          <strong>${o.id} - ${o.name}</strong>
          <span class="status-badge ${statusClass}">${o.status}</span>
          ${isUrgent ? '<span class="status-badge" style="background: #fee2e2; color: #991b1b;">紧急</span>' : ''}
          ${o.reviewStatus === ReviewStatus.PENDING_REVIEW ? '<span class="status-badge" style="background: #fef3c7; color: #92400e;">待复核</span>' : ''}
          <p style="margin: 4px 0; font-size: 12px; color: #64748b;">
            材料: ${o.requiredMaterial} | 喷嘴: ${o.requiredNozzleSize}<br>
            长度: ${o.printLength}mm | 预计: ${o.estimatedHours}h<br>
            ${o.deadline ? `截止: ${o.deadline.toLocaleString()}` : '无截止日期'}<br>
            ${o.assignedPrinterId ? `打印机: ${o.assignedPrinterId}` : '未分配'}
            ${o.issues.length > 0 ? `<br><span style="color: #ef4444;">问题: ${o.issues.length} 个</span>` : ''}
          </p>
        </div>
      `;
    }).join('');
  }
  
  const faultsList = document.getElementById('faultsList');
  if (engine.faultEvents.length === 0) {
    faultsList.innerHTML = '<p style="color: #94a3b8; text-align: center;">暂无故障记录</p>';
  } else {
    faultsList.innerHTML = engine.faultEvents.slice().reverse().map(f => {
      const severityClass = `badge-${f.getSeverity()}`;
      return `
        <div style="padding: 10px; background: white; border-radius: 6px; margin-bottom: 8px;">
          <strong>${f.id}</strong>
          <span class="status-badge" style="background: #fee2e2; color: #991b1b;">${f.getTypeName()}</span>
          <span class="badge ${severityClass}">${f.getSeverity()}</span>
          <p style="margin: 4px 0; font-size: 12px; color: #64748b;">
            打印机: ${f.printerId} | 时间: ${f.timestamp.toLocaleString()}<br>
            状态: ${f.resolved ? '已解决' : '未解决'}
            ${!f.resolved ? `<button class="btn btn-success" style="padding: 2px 8px; font-size: 11px; margin-left: 10px;" onclick="resolveFault('${f.id}')">解决</button>` : ''}
            ${f.affectedOrders.length > 0 ? `<br>影响订单: ${f.affectedOrders.join(', ')}` : ''}
          </p>
        </div>
      `;
    }).join('');
  }
  
  updatePrinterSelectors();
  updateCurrentTime();
}

function resolveFault(faultId) {
  const result = engine.resolveFault(faultId, '已人工处理');
  if (result.success) {
    showMessage('故障已解决', 'success');
  }
  updateOrdersPage();
}

// ========== 调度安排页面 ==========
function checkFeasibility() {
  const orderId = document.getElementById('scheduleOrder').value;
  const printerId = document.getElementById('schedulePrinter').value;
  
  if (!orderId || !printerId) {
    showMessage('请选择订单和打印机', 'warning');
    return;
  }
  
  const result = engine.checkSchedulingFeasibility(orderId, printerId);
  const el = document.getElementById('feasibilityResult');
  
  if (result.feasible && result.issues.length === 0) {
    el.innerHTML = '<div class="alert alert-success">✅ 调度可行！没有发现任何问题。</div>';
  } else if (result.feasible) {
    el.innerHTML = '<div class="alert alert-warning">⚠️ 调度可行，但存在以下警告：</div>' +
      result.issues.map(i => `
        <div class="issue ${i.severity}">
          <strong>${i.getTypeName()}</strong>
          <p>${i.reason}</p>
        </div>
      `).join('');
  } else {
    el.innerHTML = '<div class="alert alert-error">❌ 调度不可行，存在以下错误：</div>' +
      result.issues.map(i => `
        <div class="issue ${i.severity}">
          <strong>${i.getTypeName()}</strong>
          <p>${i.reason}</p>
          <p style="font-size: 12px; color: #64748b;">影响对象: ${JSON.stringify(i.affectedObjects)}</p>
        </div>
      `).join('');
  }
}

function scheduleOrder() {
  const orderId = document.getElementById('scheduleOrder').value;
  const printerId = document.getElementById('schedulePrinter').value;
  
  if (!orderId || !printerId) {
    showMessage('请选择订单和打印机', 'warning');
    return;
  }
  
  const result = engine.scheduleOrder(orderId, printerId);
  
  if (result.success) {
    showMessage('订单调度成功', 'success');
    if (result.warnings.length > 0) {
      showMessage(`注意：有 ${result.warnings.length} 个警告需要关注`, 'warning');
    }
  } else {
    showMessage(result.message || '调度失败', 'error');
  }
  
  document.getElementById('feasibilityResult').innerHTML = '';
  updateSchedulePage();
}

function updateSchedulePage() {
  const orderSel = document.getElementById('scheduleOrder');
  const currentOrder = orderSel.value;
  orderSel.innerHTML = '<option value="">请选择订单</option>' +
    Array.from(engine.orders.values())
      .filter(o => o.status === OrderStatus.PENDING)
      .map(o => `<option value="${o.id}">${o.id} - ${o.name} (${o.requiredMaterial}, ${o.requiredNozzleSize})</option>`)
      .join('');
  orderSel.value = currentOrder;
  
  const printerSel = document.getElementById('schedulePrinter');
  const currentPrinter = printerSel.value;
  printerSel.innerHTML = '<option value="">请选择打印机</option>' +
    Array.from(engine.printers.values()).map(p => {
      const status = p.isAvailable() ? '空闲' : '忙碌';
      const material = p.currentMaterial ? engine.materials.get(p.currentMaterial) : null;
      const nozzle = p.currentNozzle ? engine.nozzles.get(p.currentNozzle) : null;
      return `<option value="${p.id}">${p.id} - ${p.name} [${status}] ${material ? `材料:${material.materialType}` : '无材料'} ${nozzle ? `喷嘴:${nozzle.size}` : '无喷嘴'}</option>`;
    }).join('');
  printerSel.value = currentPrinter;
  
  const tasksEl = document.getElementById('scheduledTasks');
  const scheduled = Array.from(engine.scheduledTasks.values());
  if (scheduled.length === 0) {
    tasksEl.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">暂无已调度任务</p>';
  } else {
    tasksEl.innerHTML = scheduled.map(task => {
      const order = engine.orders.get(task.orderId);
      const printer = engine.printers.get(task.printerId);
      return `
        <div style="padding: 12px; background: #f8fafc; border-radius: 8px; margin-bottom: 10px;">
          <strong>${order.id} - ${order.name}</strong>
          <span class="status-badge status-${order.status}">${order.status}</span>
          <p style="margin: 6px 0; font-size: 13px;">
            打印机: ${printer.name}<br>
            开始时间: ${task.startTime.toLocaleString()}<br>
            预计完成: ${task.estimatedEndTime.toLocaleString()}<br>
            进度: ${task.progress.toFixed(0)}%
          </p>
          ${task.progress > 0 ? `
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${task.progress}%"></div>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }
  
  updateCurrentTime();
}

// ========== 执行打印页面 ==========
function advanceTime() {
  const hours = parseFloat(document.getElementById('advanceHours').value) || 1;
  engine.advanceTime(hours);
  
  engine.scheduledTasks.forEach((task, orderId) => {
    const order = engine.orders.get(orderId);
    if (order.status === OrderStatus.PRINTING) {
      const result = engine.simulatePrintProgress(orderId, hours);
      if (!result.success && result.issue) {
        showMessage(`发生问题: ${result.issue}`, 'error');
      }
    }
  });
  
  scoring.recordState();
  updateExecutePage();
  showMessage(`时间已推进 ${hours} 小时`, 'info');
}

function resetTime() {
  engine.setCurrentTime(new Date());
  updateExecutePage();
  showMessage('时间已重置', 'info');
}

function startPrinting() {
  const orderId = document.getElementById('printOrder').value;
  if (!orderId) {
    showMessage('请选择订单', 'warning');
    return;
  }
  
  const result = engine.startPrinting(orderId);
  if (result.success) {
    showMessage('开始打印', 'success');
    scoring.recordState();
  } else {
    showMessage(result.message || '启动失败', 'error');
  }
  
  updateExecutePage();
}

function updateExecutePage() {
  const printSel = document.getElementById('printOrder');
  const current = printSel.value;
  printSel.innerHTML = '<option value="">请选择订单</option>' +
    Array.from(engine.orders.values())
      .filter(o => o.status === OrderStatus.SCHEDULED)
      .map(o => `<option value="${o.id}">${o.id} - ${o.name}</option>`)
      .join('');
  printSel.value = current;
  
  const progressEl = document.getElementById('printingProgress');
  const printing = Array.from(engine.orders.values()).filter(o => o.status === OrderStatus.PRINTING);
  if (printing.length === 0) {
    progressEl.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">暂无进行中的打印任务</p>';
  } else {
    progressEl.innerHTML = printing.map(o => {
      const task = engine.scheduledTasks.get(o.id);
      const printer = engine.printers.get(o.assignedPrinterId);
      return `
        <div style="padding: 12px; background: #f0fdf4; border-radius: 8px; margin-bottom: 10px; border: 2px solid #22c55e;">
          <strong>${o.id} - ${o.name}</strong>
          <span class="status-badge status-printing">打印中</span>
          <p style="margin: 6px 0; font-size: 13px;">
            打印机: ${printer.name}<br>
            已用时: ${o.actualHours.toFixed(1)}h / 预计: ${o.estimatedHours}h<br>
            材料消耗: ${o.materialUsed.toFixed(0)}mm / ${o.printLength}mm
          </p>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${task.progress}%"></div>
          </div>
          <p style="text-align: right; color: #64748b; font-size: 12px;">${task.progress.toFixed(0)}%</p>
        </div>
      `;
    }).join('');
  }
  
  const faultsEl = document.getElementById('pendingFaults');
  const pending = engine.faultEvents.filter(f => !f.resolved);
  if (pending.length === 0) {
    faultsEl.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">暂无待处理故障</p>';
  } else {
    faultsEl.innerHTML = pending.map(f => `
      <div style="padding: 12px; background: #fef2f2; border-radius: 8px; margin-bottom: 10px; border: 2px solid #ef4444;">
        <strong>${f.getTypeName()}</strong>
        <span class="badge badge-${f.getSeverity()}">${f.getSeverity()}</span>
        <p style="margin: 6px 0; font-size: 13px;">
          打印机: ${f.printerId}<br>
          发生时间: ${f.timestamp.toLocaleString()}<br>
          预计停机: ${f.getEstimatedDowntime()} 分钟<br>
          影响订单: ${f.affectedOrders.length > 0 ? f.affectedOrders.join(', ') : '无'}
        </p>
        <button class="btn btn-success" onclick="resolveFault('${f.id}')">✓ 标记为已解决</button>
      </div>
    `).join('');
  }
  
  updateCurrentTime();
}

// ========== 评分报告页面 ==========
function generateReport() {
  currentReport = scoring.calculateScore();
  displayReport(currentReport);
  showMessage('报告已生成', 'success');
}

function displayReport(report) {
  const percent = Math.round((report.totalScore / report.maxScore) * 100);
  const color = percent >= 80 ? '#22c55e' : percent >= 60 ? '#eab308' : '#ef4444';
  
  document.getElementById('scoreValue').textContent = `${report.totalScore} / ${report.maxScore}`;
  document.getElementById('scoreValue').style.color = color;
  document.getElementById('scorePercent').textContent = `${percent}% 完成度`;
  
  const breakdown = report.scoreBreakdown;
  document.getElementById('scoreBreakdown').innerHTML = `
    <table>
      <tr><th>项目</th><th>得分</th><th>满分</th><th>说明</th></tr>
      <tr><td>准时交付</td><td>${breakdown.onTimeCompletion}</td><td>${ScoringConfig.onTimeCompletion}</td><td>按截止日期完成订单</td></tr>
      <tr><td>材料利用</td><td>${breakdown.materialEfficiency}</td><td>${ScoringConfig.materialEfficiency}</td><td>材料剩余量比例</td></tr>
      <tr><td>质量控制</td><td>${breakdown.noQualityIssues}</td><td>${ScoringConfig.noQualityIssues}</td><td>无严重质量问题</td></tr>
      <tr><td>设备利用率</td><td>${breakdown.printerUtilization}</td><td>${ScoringConfig.printerUtilization}</td><td>打印机忙碌比例</td></tr>
      <tr><td>正确配置</td><td>${breakdown.properSetup}</td><td>${ScoringConfig.properSetup}</td><td>打印机正确安装材料和喷嘴</td></tr>
      ${breakdown.penalties && breakdown.penalties.total > 0 ? 
        `<tr style="color: #ef4444;"><td>总扣分</td><td>-${breakdown.penalties.total}</td><td>-</td><td>各类问题惩罚</td></tr>` : ''}
    </table>
  `;
  
  document.getElementById('reportIssues').innerHTML = report.issues.length === 0 
    ? '<p style="color: #94a3b8; text-align: center; padding: 20px;">无问题记录</p>'
    : report.issues.map(i => `
        <div class="issue ${i.severity}">
          <strong>${i.getTypeName()}</strong>
          <span style="float: right; color: #64748b;">${i.timestamp.toLocaleString()}</span>
          <p style="margin: 5px 0 0 0;">${i.reason}</p>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #64748b;">影响: ${JSON.stringify(i.affectedObjects)}</p>
        </div>
      `).join('');
  
  document.getElementById('reportReview').innerHTML = report.pendingReviewItems.length === 0
    ? '<p style="color: #94a3b8; text-align: center; padding: 20px;">无待复核项目</p>'
    : report.pendingReviewItems.map((item, idx) => `
        <div class="review-item">
          <strong>${idx + 1}. ${item.type}</strong>
          ${item.id ? ` ID: ${item.id}` : ''}
          ${item.name ? ` 名称: ${item.name}` : ''}
          ${item.notes ? `<br>备注: ${item.notes.join('; ')}` : ''}
        </div>
      `).join('');
  
  document.getElementById('reportLessons').innerHTML = report.lessonsLearned.map(l => `
    <div class="lesson">
      <span class="badge badge-${l.severity}">${l.category}</span>
      <p style="margin: 8px 0 0 0;">${l.lesson}</p>
    </div>
  `).join('');
  
  document.getElementById('reportMaterials').innerHTML = `
    <table>
      <tr><th>材料ID</th><th>类型</th><th>颜色</th><th>已用(mm)</th><th>剩余(mm)</th><th>剩余%</th></tr>
      ${Object.entries(report.materialUsage).map(([id, m]) => `
        <tr>
          <td>${id}</td>
          <td>${m.type}</td>
          <td>${m.color}</td>
          <td>${m.used}</td>
          <td>${m.remaining}</td>
          <td><strong style="color: ${m.percentage > 20 ? '#22c55e' : '#ef4444'};">${m.percentage}%</strong></td>
        </tr>
      `).join('')}
    </table>
  `;
  
  document.getElementById('reportPrinters').innerHTML = `
    <table>
      <tr><th>打印机ID</th><th>名称</th><th>状态</th><th>总打印时长</th><th>故障次数</th><th>材料</th><th>喷嘴</th></tr>
      ${Object.entries(report.printerUtilization).map(([id, p]) => `
        <tr>
          <td>${id}</td>
          <td>${p.name}</td>
          <td>${p.status}</td>
          <td>${p.totalPrintHours.toFixed(1)}h</td>
          <td>${p.failureCount}</td>
          <td>${p.hasMaterial ? '✓' : '✗'}</td>
          <td>${p.hasNozzle ? '✓' : '✗'}</td>
        </tr>
      `).join('')}
    </table>
  `;
}

function exportReport(format) {
  if (!currentReport) {
    generateReport();
  }
  
  const result = ReportExporter.downloadReport(currentReport, format);
  showMessage(`报告已导出: ${result.filename}`, 'success');
  console.log('导出内容:', result.content);
}

// ========== 评分回放页面 ==========
function recordState() {
  scoring.recordState();
  updateReplayPage();
  showMessage('状态已记录', 'success');
}

function resetReplay() {
  scoring.resetReplay();
  updateReplayPage();
  showMessage('回放记录已清空', 'info');
}

function prevReplay() {
  if (scoring.currentReplayIndex > 0) {
    showReplayState(scoring.currentReplayIndex - 1);
  }
}

function nextReplay() {
  if (scoring.currentReplayIndex < scoring.replayHistory.length - 1) {
    showReplayState(scoring.currentReplayIndex + 1);
  }
}

function showReplayState(index) {
  const state = scoring.getReplayState(index);
  if (!state) return;
  
  updateReplayTimeline();
  
  const el = document.getElementById('replayContent');
  el.innerHTML = `
    <div class="card">
      <h3>📅 ${state.timestamp.toLocaleString()}</h3>
      <p>订单数: ${state.orderCount} | 活跃任务: ${state.activeTasks} | 问题数: ${state.issueCount}</p>
    </div>
    
    <h2 class="section-title">订单状态</h2>
    ${state.orders.map(o => `
      <div style="padding: 10px; background: #f8fafc; border-radius: 6px; margin-bottom: 8px;">
        <strong>${o.id} - ${o.name}</strong>
        <span class="status-badge status-${o.status}">${o.status}</span>
        <span style="margin-left: 10px; color: #64748b;">进度: ${o.progress.toFixed(0)}% | 问题: ${o.issues}</span>
      </div>
    `).join('')}
    
    <h2 class="section-title">打印机状态</h2>
    ${state.printers.map(p => `
      <div style="padding: 10px; background: #f8fafc; border-radius: 6px; margin-bottom: 8px;">
        <strong>${p.id} - ${p.name}</strong>
        <span style="margin-left: 10px; color: #64748b;">状态: ${p.status}${p.currentTask ? ` | 任务: ${p.currentTask}` : ''}</span>
      </div>
    `).join('')}
    
    ${state.issues.length > 0 ? `
      <h2 class="section-title">问题记录</h2>
      ${state.issues.map(i => `
        <div class="issue ${i.severity}">
          <strong>${i.type}</strong>
          <p>${i.reason}</p>
        </div>
      `).join('')}
    ` : ''}
  `;
}

function updateReplayTimeline() {
  const el = document.getElementById('replayTimeline');
  const timeline = scoring.getReplayTimeline();
  
  if (timeline.length === 0) {
    el.innerHTML = '<p style="color: #94a3b8; text-align: center; width: 100%; padding: 20px;">暂无回放记录，点击"记录当前状态"开始</p>';
    return;
  }
  
  el.innerHTML = timeline.map((point, idx) => `
    <div class="timeline-point ${idx === scoring.currentReplayIndex ? 'active' : ''} ${point.issueCount > 0 ? 'has-issue' : ''}"
         onclick="showReplayState(${idx})"
         title="${point.timestamp.toLocaleString()} - ${point.activeTasks}个任务, ${point.issueCount}个问题">
      ${idx + 1}
    </div>
  `).join('');
}

function updateReplayPage() {
  updateReplayTimeline();
  updateCurrentTime();
}

// ========== 初始化 ==========
function initDemoData() {
  engine.addPrinter({
    id: 'PRT-001',
    name: '创想三维 K1',
    supportedMaterials: ['PLA', 'ABS', 'PETG'],
    maxNozzleSize: '0.8mm',
    baseSpeed: 1.2
  });
  
  engine.addPrinter({
    id: 'PRT-002',
    name: 'Prusa MK4',
    supportedMaterials: ['PLA', 'PETG', 'TPU'],
    maxNozzleSize: '0.6mm',
    baseSpeed: 1.0
  });
  
  engine.addMaterial({
    id: 'MAT-001',
    materialType: 'PLA',
    color: '白色',
    totalLength: 10000
  });
  
  engine.addMaterial({
    id: 'MAT-002',
    materialType: 'PETG',
    color: '黑色',
    totalLength: 8000
  });
  
  engine.addMaterial({
    id: 'MAT-003',
    materialType: 'ABS',
    color: '灰色',
    totalLength: 5000
  });
  
  engine.addNozzle({
    id: 'NOZ-001',
    size: '0.4mm',
    material: 'brass'
  });
  
  engine.addNozzle({
    id: 'NOZ-002',
    size: '0.6mm',
    material: 'hardened_steel'
  });
  
  engine.addNozzle({
    id: 'NOZ-003',
    size: '0.4mm',
    material: 'steel'
  });
  
  const now = new Date();
  engine.addOrder({
    id: 'ORD-001',
    name: '外壳打印',
    requiredMaterial: 'PLA',
    requiredNozzleSize: '0.4mm',
    printLength: 2000,
    estimatedHours: 3,
    deadline: new Date(now.getTime() + 8 * 60 * 60 * 1000),
    priority: 3
  });
  
  engine.addOrder({
    id: 'ORD-002',
    name: '齿轮组件',
    requiredMaterial: 'PETG',
    requiredNozzleSize: '0.6mm',
    printLength: 3000,
    estimatedHours: 5,
    deadline: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    priority: 4
  });
  
  engine.addOrder({
    id: 'ORD-003',
    name: '支架底座',
    requiredMaterial: 'ABS',
    requiredNozzleSize: '0.4mm',
    printLength: 1500,
    estimatedHours: 2,
    deadline: new Date(now.getTime() + 4 * 60 * 60 * 1000),
    priority: 5
  });
  
  engine.installMaterial('PRT-001', 'MAT-001');
  engine.installNozzle('PRT-001', 'NOZ-001');
  
  engine.installMaterial('PRT-002', 'MAT-002');
  engine.installNozzle('PRT-002', 'NOZ-002');
  
  scoring.recordState();
  updateDashboard();
}

document.addEventListener('DOMContentLoaded', () => {
  initDemoData();
  updateDashboard();
});
