const API_BASE = '';
let currentReportData = null;

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadDashboard();
  loadProducts();
  loadSelects();
});

function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      
      item.classList.add('active');
      const page = item.dataset.page;
      document.getElementById(`page-${page}`).classList.add('active');
      
      switch(page) {
        case 'dashboard': loadDashboard(); break;
        case 'products': loadProducts(); break;
        case 'sales': loadSalesPage(); break;
        case 'waste': loadWastePage(); break;
        case 'tasting': loadTastingPage(); break;
        case 'review': loadReviewPage(); break;
        case 'dailyclose': loadDailyClosePage(); break;
      }
    });
  });
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function getStatusBadge(status) {
  const badges = {
    pending: '<span class="badge badge-pending">待审核</span>',
    approved: '<span class="badge badge-approved">已通过</span>',
    rejected: '<span class="badge badge-rejected">已拒绝</span>'
  };
  return badges[status] || status;
}

function formatTime(time) {
  return new Date(time).toLocaleString('zh-CN');
}

async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard`);
    const data = await res.json();
    
    const statusEl = document.getElementById('dashboard-status');
    statusEl.className = `status-badge ${data.is_closed ? 'status-closed' : 'status-open'}`;
    statusEl.textContent = data.is_closed ? '🔒 今日已日结' : '🟢 营业中';
    
    document.getElementById('stat-sales-count').textContent = data.today_sales.count;
    document.getElementById('stat-sales-amount').textContent = data.today_sales.total.toFixed(2);
    document.getElementById('stat-tasting').textContent = data.today_tasting.total;
    document.getElementById('stat-pending').textContent = data.pending_review.sales_count + data.pending_review.waste_count;
    
    const pendingBadge = document.getElementById('pending-badge');
    pendingBadge.textContent = data.pending_review.sales_count + data.pending_review.waste_count;
    pendingBadge.style.display = data.pending_review.sales_count + data.pending_review.waste_count > 0 ? 'block' : 'none';
    
    const materialsList = document.getElementById('materials-list');
    if (data.materials.length === 0) {
      materialsList.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div>暂无原料数据</div>';
    } else {
      materialsList.innerHTML = data.materials.map(m => `
        <div class="material-item ${m.is_low ? 'low' : ''}">
          <div>
            <span class="material-name">${m.name}</span>
            ${m.is_low ? '<span class="badge badge-low">库存不足</span>' : ''}
          </div>
          <span class="material-stock">${m.current_stock} ${m.unit} / 警戒: ${m.warning_threshold} ${m.unit}</span>
        </div>
      `).join('');
    }
    
    renderWasteChart(data.today_waste);
    loadAnomalyList();
  } catch (err) {
    console.error(err);
  }
}

function renderWasteChart(wasteData) {
  const container = document.getElementById('waste-chart');
  
  if (!wasteData || wasteData.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div>今日暂无损耗数据</div>';
    return;
  }
  
  const total = wasteData.reduce((sum, w) => sum + w.total, 0);
  const colors = ['#e94560', '#ff6b6b', '#ffa502', '#ff7f50', '#cd5c5c'];
  
  let legendHtml = '<div class="pie-legend">';
  wasteData.forEach((w, i) => {
    const percent = ((w.total / total) * 100).toFixed(1);
    legendHtml += `
      <div class="pie-legend-item">
        <div class="pie-color" style="background: ${colors[i % colors.length]}"></div>
        ${w.reason}: ${w.total} (${percent}%)
      </div>
    `;
  });
  legendHtml += '</div>';
  
  container.innerHTML = `
    <div style="text-align: center; margin-bottom: 16px;">
      <strong>总损耗量：${total}</strong>
    </div>
    ${legendHtml}
  `;
}

async function loadAnomalyList() {
  try {
    const [salesRes, wasteRes] = await Promise.all([
      fetch(`${API_BASE}/api/sales?status=pending`),
      fetch(`${API_BASE}/api/waste?status=pending`)
    ]);
    const sales = await salesRes.json();
    const waste = await wasteRes.json();
    
    const container = document.getElementById('anomaly-list');
    const anomalies = [
      ...sales.map(s => ({ ...s, type: '销售', reason: `订单: ${s.order_no}` })),
      ...waste.map(w => ({ ...w, type: w.record_type === 'tasting' ? '试饮' : '报废', reason: w.reason }))
    ];
    
    if (anomalies.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">✅</div>暂无异常记录</div>';
      return;
    }
    
    container.innerHTML = `
      <table class="table">
        <thead>
          <tr>
            <th>类型</th>
            <th>内容</th>
            <th>数量</th>
            <th>原因/订单</th>
            <th>时间</th>
            <th>状态</th>
          </tr>
        </thead>
        <tbody>
          ${anomalies.map(a => `
            <tr>
              <td>${a.type}</td>
              <td>${a.product_name || a.material_name}</td>
              <td>${a.quantity}</td>
              <td>${a.reason}</td>
              <td>${formatTime(a.sale_time || a.waste_time)}</td>
              <td>${getStatusBadge(a.review_status)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error(err);
  }
}

async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    const products = await res.json();
    
    const tbody = document.getElementById('products-table');
    tbody.innerHTML = products.map(p => `
      <tr>
        <td><strong>${p.name}</strong></td>
        <td>¥${p.price}</td>
        <td>${p.recipe_text || '暂无配方'}</td>
        <td>
          <button class="btn btn-secondary" onclick="viewRecipe(${p.id})">查看配方</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

async function viewRecipe(productId) {
  try {
    const res = await fetch(`${API_BASE}/api/products/${productId}/recipe`);
    const recipe = await res.json();
    
    const modal = document.getElementById('report-modal');
    const content = document.getElementById('report-content');
    
    if (recipe.length === 0) {
      content.innerHTML = '<div class="empty-state">该饮品暂无配方</div>';
    } else {
      content.innerHTML = `
        <h4 style="margin-bottom: 16px;">配方明细</h4>
        <table class="table">
          <thead>
            <tr>
              <th>原料</th>
              <th>用量</th>
              <th>当前库存</th>
            </tr>
          </thead>
          <tbody>
            ${recipe.map(r => `
              <tr>
                <td>${r.material_name}</td>
                <td>${r.quantity} ${r.unit}</td>
                <td>${r.current_stock} ${r.unit}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    
    modal.classList.add('active');
    currentReportData = null;
  } catch (err) {
    console.error(err);
  }
}

async function loadSelects() {
  try {
    const [productsRes, materialsRes] = await Promise.all([
      fetch(`${API_BASE}/api/products`),
      fetch(`${API_BASE}/api/materials`)
    ]);
    const products = await productsRes.json();
    const materials = await materialsRes.json();
    
    const productSelect = document.getElementById('sale-product');
    productSelect.innerHTML = '<option value="">请选择</option>' + products.map(p => 
      `<option value="${p.id}">${p.name} (¥${p.price})</option>`
    ).join('');
    
    const materialOptions = materials.map(m => 
      `<option value="${m.id}" data-stock="${m.current_stock}" data-unit="${m.unit}">${m.name} (剩余: ${m.current_stock} ${m.unit})</option>`
    ).join('');
    
    document.getElementById('waste-material').innerHTML = '<option value="">请选择</option>' + materialOptions;
    document.getElementById('tasting-material').innerHTML = '<option value="">请选择</option>' + materialOptions;
  } catch (err) {
    console.error(err);
  }
}

async function loadSalesPage() {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard`);
    const data = await res.json();
    
    const statusEl = document.getElementById('sales-status');
    statusEl.className = `status-badge ${data.is_closed ? 'status-closed' : 'status-open'}`;
    statusEl.textContent = data.is_closed ? '🔒 今日已日结' : '🟢 营业中';
    
    document.getElementById('btn-add-sale').disabled = data.is_closed;
    
    const today = new Date().toISOString().split('T')[0];
    const salesRes = await fetch(`${API_BASE}/api/sales?date=${today}`);
    const sales = await salesRes.json();
    
    const tbody = document.getElementById('sales-table');
    if (sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">今日暂无销售记录</td></tr>';
    } else {
      tbody.innerHTML = sales.map(s => `
        <tr>
          <td>${s.order_no}</td>
          <td>${s.product_name}</td>
          <td>${s.quantity}</td>
          <td>¥${(s.price * s.quantity).toFixed(2)}</td>
          <td>${formatTime(s.sale_time)}</td>
          <td>${getStatusBadge(s.review_status)}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('sale-product').addEventListener('change', async function() {
  const productId = this.value;
  const preview = document.getElementById('sale-recipe-preview');
  const list = document.getElementById('sale-recipe-list');
  
  if (!productId) {
    preview.style.display = 'none';
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/products/${productId}/recipe`);
    const recipe = await res.json();
    
    if (recipe.length > 0) {
      list.innerHTML = recipe.map(r => `
        <div class="recipe-item">
          ${r.material_name}: ${r.quantity} ${r.unit} (当前库存: ${r.current_stock} ${r.unit})
        </div>
      `).join('');
      preview.style.display = 'block';
    }
  } catch (err) {
    console.error(err);
  }
});

document.getElementById('btn-add-sale').addEventListener('click', async () => {
  const orderNo = document.getElementById('sale-order-no').value.trim();
  const productId = document.getElementById('sale-product').value;
  const quantity = parseInt(document.getElementById('sale-quantity').value);
  const isPending = document.getElementById('sale-pending').checked;
  
  if (!orderNo || !productId || !quantity) {
    showToast('请填写完整信息', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/sales`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_no: orderNo, product_id: parseInt(productId), quantity, is_pending_review: isPending })
    });
    
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      document.getElementById('sale-order-no').value = '';
      document.getElementById('sale-product').value = '';
      document.getElementById('sale-quantity').value = '1';
      document.getElementById('sale-pending').checked = false;
      document.getElementById('sale-recipe-preview').style.display = 'none';
      loadSalesPage();
      loadDashboard();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast('提交失败', 'error');
  }
});

async function loadWastePage() {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard`);
    const data = await res.json();
    
    const statusEl = document.getElementById('waste-status');
    statusEl.className = `status-badge ${data.is_closed ? 'status-closed' : 'status-open'}`;
    statusEl.textContent = data.is_closed ? '🔒 今日已日结' : '🟢 营业中';
    
    document.getElementById('btn-add-waste').disabled = data.is_closed;
    
    const today = new Date().toISOString().split('T')[0];
    const wasteRes = await fetch(`${API_BASE}/api/waste?date=${today}&record_type=waste`);
    const waste = await wasteRes.json();
    
    const tbody = document.getElementById('waste-table');
    if (waste.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-state">今日暂无报废记录</td></tr>';
    } else {
      tbody.innerHTML = waste.map(w => `
        <tr>
          <td>${w.material_name}</td>
          <td>${w.quantity} ${w.unit}</td>
          <td>${w.reason}</td>
          <td>${formatTime(w.waste_time)}</td>
          <td>${getStatusBadge(w.review_status)}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('btn-add-waste').addEventListener('click', async () => {
  const materialId = document.getElementById('waste-material').value;
  const quantity = parseFloat(document.getElementById('waste-quantity').value);
  const reason = document.getElementById('waste-reason').value;
  const isPending = document.getElementById('waste-pending').checked;
  
  if (!materialId || !quantity || !reason) {
    showToast('请填写完整信息', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/waste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ material_id: parseInt(materialId), quantity, reason, record_type: 'waste', is_pending_review: isPending })
    });
    
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      if (data.warning) {
        setTimeout(() => showToast(data.warning, 'warning'), 500);
      }
      document.getElementById('waste-quantity').value = '';
      document.getElementById('waste-reason').value = '';
      document.getElementById('waste-pending').checked = false;
      loadSelects();
      loadWastePage();
      loadDashboard();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast('提交失败', 'error');
  }
});

async function loadTastingPage() {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard`);
    const data = await res.json();
    
    const statusEl = document.getElementById('tasting-status');
    statusEl.className = `status-badge ${data.is_closed ? 'status-closed' : 'status-open'}`;
    statusEl.textContent = data.is_closed ? '🔒 今日已日结' : '🟢 营业中';
    
    document.getElementById('btn-add-tasting').disabled = data.is_closed;
    
    const today = new Date().toISOString().split('T')[0];
    const tastingRes = await fetch(`${API_BASE}/api/waste?date=${today}&record_type=tasting`);
    const tasting = await tastingRes.json();
    
    const tbody = document.getElementById('tasting-table');
    if (tasting.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-state">今日暂无试饮记录</td></tr>';
    } else {
      tbody.innerHTML = tasting.map(t => `
        <tr>
          <td>${t.material_name}</td>
          <td>${t.quantity} ${t.unit}</td>
          <td>${formatTime(t.waste_time)}</td>
          <td>${getStatusBadge(t.review_status)}</td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('btn-add-tasting').addEventListener('click', async () => {
  const materialId = document.getElementById('tasting-material').value;
  const quantity = parseFloat(document.getElementById('tasting-quantity').value);
  
  if (!materialId || !quantity) {
    showToast('请填写完整信息', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/api/waste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ material_id: parseInt(materialId), quantity, reason: '试饮', record_type: 'tasting', is_pending_review: false })
    });
    
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      if (data.warning) {
        setTimeout(() => showToast(data.warning, 'warning'), 500);
      }
      document.getElementById('tasting-quantity').value = '';
      loadSelects();
      loadTastingPage();
      loadDashboard();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast('提交失败', 'error');
  }
});

async function loadReviewPage() {
  try {
    const res = await fetch(`${API_BASE}/api/pending-review`);
    const data = await res.json();
    
    const salesBody = document.getElementById('pending-sales-body');
    if (data.sales.length === 0) {
      salesBody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无待审核销售记录</td></tr>';
    } else {
      salesBody.innerHTML = data.sales.map(s => `
        <tr>
          <td>${s.order_no}</td>
          <td>${s.product_name}</td>
          <td>${s.quantity}</td>
          <td>¥${(s.price * s.quantity).toFixed(2)}</td>
          <td>${formatTime(s.sale_time)}</td>
          <td class="action-buttons">
            <button class="btn btn-success" onclick="reviewItem('sale', ${s.id}, 'approve')">通过</button>
            <button class="btn btn-danger" onclick="reviewItem('sale', ${s.id}, 'reject')">拒绝</button>
          </td>
        </tr>
      `).join('');
    }
    
    const wasteBody = document.getElementById('pending-waste-body');
    if (data.waste.length === 0) {
      wasteBody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无待审核损耗记录</td></tr>';
    } else {
      wasteBody.innerHTML = data.waste.map(w => `
        <tr>
          <td>${w.record_type === 'tasting' ? '试饮' : '报废'}</td>
          <td>${w.material_name}</td>
          <td>${w.quantity} ${w.unit}</td>
          <td>${w.reason}</td>
          <td>${formatTime(w.waste_time)}</td>
          <td class="action-buttons">
            <button class="btn btn-success" onclick="reviewItem('waste', ${w.id}, 'approve')">通过</button>
            <button class="btn btn-danger" onclick="reviewItem('waste', ${w.id}, 'reject')">拒绝</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

async function reviewItem(type, id, action) {
  if (!confirm(`确定要${action === 'approve' ? '通过' : '拒绝'}这条记录吗？`)) return;
  
  try {
    const res = await fetch(`${API_BASE}/api/review/${type}/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reviewer: '管理员' })
    });
    
    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      loadReviewPage();
      loadDashboard();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast('操作失败', 'error');
  }
}

async function loadDailyClosePage() {
  try {
    const res = await fetch(`${API_BASE}/api/dashboard`);
    const data = await res.json();
    
    const statusEl = document.getElementById('daily-status');
    statusEl.className = `status-badge ${data.is_closed ? 'status-closed' : 'status-open'}`;
    statusEl.textContent = data.is_closed ? '🔒 今日已日结' : '🟢 营业中';
    
    document.getElementById('btn-daily-close').disabled = data.is_closed;
    
    const closesRes = await fetch(`${API_BASE}/api/daily-closes`);
    const closes = await closesRes.json();
    
    const tbody = document.getElementById('daily-close-table');
    if (closes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无日结记录</td></tr>';
    } else {
      tbody.innerHTML = closes.map(c => `
        <tr>
          <td>${c.close_date}</td>
          <td>¥${c.total_sales.toFixed(2)}</td>
          <td>${c.total_waste}</td>
          <td>${c.total_tasting}</td>
          <td>${formatTime(c.created_at)}</td>
          <td>
            <button class="btn btn-secondary" onclick="viewDailyReport(${c.id})">查看清单</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('btn-daily-close').addEventListener('click', async () => {
  if (!confirm('确定要执行今日日结吗？日结后将无法修改今日的记录。')) return;
  
  try {
    const res = await fetch(`${API_BASE}/api/daily-close`, { method: 'POST' });
    const data = await res.json();
    
    if (res.ok) {
      showToast('日结完成！', 'success');
      loadDailyClosePage();
      loadDashboard();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast('日结失败', 'error');
  }
});

async function viewDailyReport(id) {
  try {
    const res = await fetch(`${API_BASE}/api/daily-close/${id}/report`);
    currentReportData = await res.json();
    
    const content = document.getElementById('report-content');
    const dc = currentReportData.daily_close;
    
    content.innerHTML = `
      <div style="margin-bottom: 24px;">
        <h4>📅 日结日期：${dc.close_date}</h4>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px;">
          <div class="stat-card" style="margin: 0; padding: 16px;">
            <div class="stat-value" style="font-size: 24px;">¥${dc.total_sales.toFixed(2)}</div>
            <div class="stat-label">销售总额</div>
          </div>
          <div class="stat-card" style="margin: 0; padding: 16px;">
            <div class="stat-value" style="font-size: 24px;">${dc.total_waste}</div>
            <div class="stat-label">报废总量</div>
          </div>
          <div class="stat-card" style="margin: 0; padding: 16px;">
            <div class="stat-value" style="font-size: 24px;">${dc.total_tasting}</div>
            <div class="stat-label">试饮总量</div>
          </div>
        </div>
      </div>
      
      <div class="card" style="box-shadow: none; border: 1px solid #eee;">
        <div class="card-title">📦 库存快照（日结后）</div>
        <table class="table">
          <thead>
            <tr><th>原料</th><th>单位</th><th>库存</th></tr>
          </thead>
          <tbody>
            ${currentReportData.snapshots.map(s => `
              <tr>
                <td>${s.material_name}</td>
                <td>${s.unit}</td>
                <td>${s.stock_after}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="card" style="box-shadow: none; border: 1px solid #eee;">
        <div class="card-title">💰 销售明细</div>
        ${currentReportData.sales.length === 0 ? 
          '<div class="empty-state">当日无销售记录</div>' :
          `<table class="table">
            <thead>
              <tr><th>订单号</th><th>饮品</th><th>数量</th><th>金额</th><th>时间</th></tr>
            </thead>
            <tbody>
              ${currentReportData.sales.map(s => `
                <tr>
                  <td>${s.order_no}</td>
                  <td>${s.product_name}</td>
                  <td>${s.quantity}</td>
                  <td>¥${(s.price * s.quantity).toFixed(2)}</td>
                  <td>${formatTime(s.sale_time)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>`
        }
      </div>
      
      <div class="card" style="box-shadow: none; border: 1px solid #eee;">
        <div class="card-title">🗑️ 损耗明细</div>
        ${currentReportData.waste.length === 0 ? 
          '<div class="empty-state">当日无损耗记录</div>' :
          `<table class="table">
            <thead>
              <tr><th>类型</th><th>原料</th><th>数量</th><th>原因</th><th>时间</th></tr>
            </thead>
            <tbody>
              ${currentReportData.waste.map(w => `
                <tr>
                  <td>${w.record_type === 'tasting' ? '试饮' : '报废'}</td>
                  <td>${w.material_name}</td>
                  <td>${w.quantity} ${w.unit}</td>
                  <td>${w.reason}</td>
                  <td>${formatTime(w.waste_time)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>`
        }
      </div>
    `;
    
    document.getElementById('report-modal').classList.add('active');
  } catch (err) {
    console.error(err);
    showToast('加载失败', 'error');
  }
}

function closeModal() {
  document.getElementById('report-modal').classList.remove('active');
  currentReportData = null;
}

function exportReport() {
  if (!currentReportData) return;
  
  let csv = '\uFEFF';
  csv += '=== 日结清单 ===\n';
  csv += `日期,${currentReportData.daily_close.close_date}\n`;
  csv += `销售总额,${currentReportData.daily_close.total_sales}\n`;
  csv += `报废总量,${currentReportData.daily_close.total_waste}\n`;
  csv += `试饮总量,${currentReportData.daily_close.total_tasting}\n\n`;
  
  csv += '=== 库存快照 ===\n';
  csv += '原料,单位,库存\n';
  currentReportData.snapshots.forEach(s => {
    csv += `${s.material_name},${s.unit},${s.stock_after}\n`;
  });
  csv += '\n';
  
  csv += '=== 销售明细 ===\n';
  csv += '订单号,饮品,数量,金额,时间\n';
  currentReportData.sales.forEach(s => {
    csv += `${s.order_no},${s.product_name},${s.quantity},${(s.price * s.quantity).toFixed(2)},${s.sale_time}\n`;
  });
  csv += '\n';
  
  csv += '=== 损耗明细 ===\n';
  csv += '类型,原料,数量,原因,时间\n';
  currentReportData.waste.forEach(w => {
    const type = w.record_type === 'tasting' ? '试饮' : '报废';
    csv += `${type},${w.material_name},${w.quantity} ${w.unit},${w.reason},${w.waste_time}\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `日结清单_${currentReportData.daily_close.close_date}.csv`;
  link.click();
  
  showToast('导出成功', 'success');
}

document.getElementById('report-modal').addEventListener('click', (e) => {
  if (e.target.id === 'report-modal') closeModal();
});
