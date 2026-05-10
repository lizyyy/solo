const API_BASE = '/api';
let currentClasses = [];
let currentStudents = [];

function statusText(status) {
  const map = { pending: '待缴费', partial: '部分缴费', paid: '已结清' };
  return map[status] || status;
}

function formatMoney(num) {
  return '¥' + (num || 0).toFixed(2);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return dateStr.split('T')[0];
}

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.getElementById(sectionId).classList.remove('hidden');
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  event.target.classList.add('active');

  loadSectionData(sectionId);
}

async function loadSectionData(sectionId) {
  switch(sectionId) {
    case 'dashboard': await loadDashboard(); break;
    case 'bills': await loadBills(); break;
    case 'students': await loadStudents(); break;
    case 'classes': await loadClasses(); break;
    case 'payments': await loadPayments(); break;
    case 'arrears': await loadArrears(); break;
    case 'leaves': await loadLeaves(); break;
    case 'approvals': await loadApprovals(); break;
  }
}

async function initDateSelectors() {
  const now = new Date();
  const years = [now.getFullYear(), now.getFullYear() - 1];
  
  ['dashboardYear', 'billsYear', 'arrearsYear'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = years.map(y => `<option value="${y}">${y}年</option>`).join('');
    }
  });

  ['dashboardMonth', 'billsMonth', 'arrearsMonth'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const months = Array.from({length: 12}, (_, i) => i + 1);
      el.innerHTML = months.map(m => `<option value="${m}">${m}月</option>`).join('');
      el.value = now.getMonth() + 1;
    }
  });
}

async function loadClassesForSelect() {
  const res = await fetch(`${API_BASE}/classes`);
  currentClasses = await res.json();
  
  ['billsClass', 'studentsClass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const options = currentClasses.map(c => 
        `<option value="${c.id}">${c.name} (${c.level})</option>`
      ).join('');
      el.innerHTML = '<option value="">全部班级</option>' + options;
    }
  });
}

async function loadDashboard() {
  const year = document.getElementById('dashboardYear').value;
  const month = document.getElementById('dashboardMonth').value;
  
  const res = await fetch(`${API_BASE}/dashboard/stats?year=${year}&month=${month}`);
  const stats = await res.json();

  const paidRate = stats.totalBills > 0 
    ? ((stats.paidBills / stats.totalBills) * 100).toFixed(1) 
    : 0;

  document.getElementById('dashboardContent').innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div class="text-3xl font-bold text-blue-600">${stats.totalStudents}</div>
        <div class="text-sm text-blue-500">在读学生</div>
      </div>
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="text-3xl font-bold text-green-600">${stats.paidBills}/${stats.totalBills}</div>
        <div class="text-sm text-green-500">已结清账单 (${paidRate}%)</div>
      </div>
      <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div class="text-3xl font-bold text-yellow-600">${stats.partialBills}</div>
        <div class="text-sm text-yellow-500">部分缴费</div>
      </div>
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="text-3xl font-bold text-red-600">${stats.pendingBills}</div>
        <div class="text-sm text-red-500">待缴费</div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-4">
      <div class="bg-gray-50 border rounded-lg p-4">
        <div class="text-sm text-gray-500 mb-1">本月应缴总额</div>
        <div class="text-2xl font-bold text-gray-700">${formatMoney(stats.totalAmount)}</div>
      </div>
      <div class="bg-green-50 border border-green-200 rounded-lg p-4">
        <div class="text-sm text-green-600 mb-1">本月已收</div>
        <div class="text-2xl font-bold text-green-600">${formatMoney(stats.paidAmount)}</div>
      </div>
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <div class="text-sm text-red-600 mb-1">待收金额</div>
        <div class="text-2xl font-bold text-red-600">${formatMoney(stats.remainingAmount)}</div>
      </div>
    </div>
  `;
}

async function loadBills() {
  const year = document.getElementById('billsYear').value;
  const month = document.getElementById('billsMonth').value;
  const status = document.getElementById('billsStatus').value;
  const classId = document.getElementById('billsClass').value;

  let url = `${API_BASE}/bills?year=${year}&month=${month}`;
  if (status) url += `&status=${status}`;
  if (classId) url += `&class_id=${classId}`;

  const res = await fetch(url);
  const bills = await res.json();

  if (bills.length === 0) {
    document.getElementById('billsContent').innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <div class="text-4xl mb-2">📭</div>
        <p>暂无账单数据，请点击"生成账单"按钮</p>
      </div>
    `;
    return;
  }

  const rows = bills.map(bill => {
    const statusBg = `bg-${bill.status}`;
    const statusBorder = `border-${bill.status}`;
    const statusColor = `status-${bill.status}`;
    const modifiedBadge = bill.is_manual_modified 
      ? '<span class="bg-purple-100 text-purple-600 text-xs px-2 py-0.5 rounded ml-2">人工改判</span>' 
      : '';

    return `
      <tr class="hover:bg-gray-50">
        <td class="px-4 py-3">${bill.student_name}</td>
        <td class="px-4 py-3">${bill.class_name} (${bill.class_level})</td>
        <td class="px-4 py-3">${bill.billing_year}年${bill.billing_month}月</td>
        <td class="px-4 py-3">
          <div class="flex items-center gap-1">
            <span>出勤: ${bill.attendance_days}</span>
            <span class="text-gray-400">|</span>
            <span class="text-orange-500">请假: ${bill.leave_days}</span>
          </div>
        </td>
        <td class="px-4 py-3 text-right font-mono">${formatMoney(bill.total_amount)}</td>
        <td class="px-4 py-3 text-right font-mono">${formatMoney(bill.paid_amount)}</td>
        <td class="px-4 py-3 text-right font-mono ${bill.remaining_amount > 0 ? 'text-red-500' : 'text-green-500'}">${formatMoney(bill.remaining_amount)}</td>
        <td class="px-4 py-3">
          <span class="${statusColor} font-medium">${statusText(bill.status)}</span>
          ${modifiedBadge}
        </td>
        <td class="px-4 py-3">
          <div class="flex gap-2">
            <button onclick="showBillDetail(${bill.id})" class="text-blue-500 hover:underline">详情</button>
            ${bill.status !== 'paid' ? `
              <button onclick="showPayModal(${bill.id}, ${bill.remaining_amount})" class="text-green-500 hover:underline">缴费</button>
              <button onclick="showModifyBillModal(${bill.id}, ${bill.total_amount})" class="text-orange-500 hover:underline">改判</button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('billsContent').innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-medium">学生姓名</th>
            <th class="text-left px-4 py-3 font-medium">班级</th>
            <th class="text-left px-4 py-3 font-medium">账期</th>
            <th class="text-left px-4 py-3 font-medium">出勤情况</th>
            <th class="text-right px-4 py-3 font-medium">应缴</th>
            <th class="text-right px-4 py-3 font-medium">已缴</th>
            <th class="text-right px-4 py-3 font-medium">未缴</th>
            <th class="text-left px-4 py-3 font-medium">状态</th>
            <th class="text-left px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function generateBills() {
  const year = document.getElementById('billsYear').value;
  const month = document.getElementById('billsMonth').value;

  if (!confirm(`确定生成 ${year}年${month}月 的账单吗？`)) return;

  const res = await fetch(`${API_BASE}/bills/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year: parseInt(year), month: parseInt(month) })
  });
  const result = await res.json();

  alert(`生成完成！成功创建 ${result.count} 条账单`);
  loadBills();
}

function exportBills() {
  const year = document.getElementById('billsYear').value;
  const month = document.getElementById('billsMonth').value;
  const classId = document.getElementById('billsClass').value;

  let url = `${API_BASE}/export/bills?year=${year}&month=${month}`;
  if (classId) url += `&class_id=${classId}`;
  
  window.open(url, '_blank');
}

async function showBillDetail(billId) {
  const res = await fetch(`${API_BASE}/bills/${billId}`);
  const data = await res.json();
  const { bill, payments, history } = data;

  const paymentsHtml = payments.length > 0 
    ? payments.map(p => `
        <tr>
          <td class="px-3 py-2">${formatDate(p.payment_date)}</td>
          <td class="px-3 py-2 font-mono">${formatMoney(p.amount)}</td>
          <td class="px-3 py-2">${p.payment_method || '-'}</td>
          <td class="px-3 py-2">${p.operator || '-'}</td>
          <td class="px-3 py-2">${p.notes || '-'}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="5" class="px-3 py-4 text-center text-gray-500">暂无付款记录</td></tr>';

  const historyHtml = history.length > 0
    ? history.map(h => {
        const before = JSON.parse(h.before_data);
        const after = JSON.parse(h.after_data);
        return `
          <div class="border rounded p-3 mb-2">
            <div class="flex justify-between items-center mb-2">
              <span class="font-medium">${h.operator}</span>
              <span class="text-sm text-gray-500">${formatDate(h.created_at)}</span>
            </div>
            <div class="text-sm bg-yellow-50 p-2 rounded mb-2">
              <span class="font-medium text-yellow-700">改判原因：</span>${h.reason}
            </div>
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div class="bg-red-50 p-2 rounded">
                <div class="text-red-600 font-medium mb-1">改判前</div>
                <div>总额: ${formatMoney(before.total_amount)}</div>
                <div>已缴: ${formatMoney(before.paid_amount)}</div>
                <div>未缴: ${formatMoney(before.remaining_amount)}</div>
                <div>状态: ${statusText(before.status)}</div>
              </div>
              <div class="bg-green-50 p-2 rounded">
                <div class="text-green-600 font-medium mb-1">改判后</div>
                <div>总额: ${formatMoney(after.total_amount)}</div>
                <div>已缴: ${formatMoney(after.paid_amount)}</div>
                <div>未缴: ${formatMoney(after.remaining_amount)}</div>
                <div>状态: ${statusText(after.status)}</div>
              </div>
            </div>
          </div>
        `;
      }).join('')
    : '<div class="text-gray-500 text-center py-4">暂无修改记录</div>';

  showModal(`
    <h3 class="text-lg font-bold mb-4">📋 账单详情</h3>
    
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="bg-gray-50 rounded p-3">
        <div class="text-sm text-gray-500">学生</div>
        <div class="font-bold">${bill.student_name}</div>
      </div>
      <div class="bg-gray-50 rounded p-3">
        <div class="text-sm text-gray-500">班级</div>
        <div class="font-bold">${bill.class_name}</div>
      </div>
      <div class="bg-gray-50 rounded p-3">
        <div class="text-sm text-gray-500">账期</div>
        <div class="font-bold">${bill.billing_year}年${bill.billing_month}月</div>
      </div>
      <div class="bg-gray-50 rounded p-3">
        <div class="text-sm text-gray-500">状态</div>
        <div class="font-bold status-${bill.status}">${statusText(bill.status)}</div>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-3 mb-4">
      <div class="bg-blue-50 rounded p-3 text-center">
        <div class="text-2xl font-bold text-blue-600">${bill.days_in_month}</div>
        <div class="text-xs text-blue-500">本月天数</div>
      </div>
      <div class="bg-green-50 rounded p-3 text-center">
        <div class="text-2xl font-bold text-green-600">${bill.attendance_days}</div>
        <div class="text-xs text-green-500">出勤天数</div>
      </div>
      <div class="bg-orange-50 rounded p-3 text-center">
        <div class="text-2xl font-bold text-orange-600">${bill.leave_days}</div>
        <div class="text-xs text-orange-500">请假天数</div>
      </div>
      <div class="bg-red-50 rounded p-3 text-center">
        <div class="text-2xl font-bold text-red-600">${bill.transfer_days || '-'}</div>
        <div class="text-xs text-red-500">${bill.is_mid_month_transfer ? '实际就读' : '无调整'}</div>
      </div>
    </div>

    <div class="bg-gray-50 rounded-lg p-4 mb-4">
      <h4 class="font-medium mb-2">💰 计费公式</h4>
      <div class="formula-box bg-white p-3 rounded border text-sm">${bill.formula}</div>
    </div>

    <div class="grid grid-cols-3 gap-3 mb-4">
      <div class="border rounded p-3 text-center">
        <div class="text-sm text-gray-500">应缴总额</div>
        <div class="text-xl font-bold">${formatMoney(bill.total_amount)}</div>
      </div>
      <div class="border border-green-300 rounded p-3 text-center">
        <div class="text-sm text-green-600">已缴金额</div>
        <div class="text-xl font-bold text-green-600">${formatMoney(bill.paid_amount)}</div>
      </div>
      <div class="border ${bill.remaining_amount > 0 ? 'border-red-300 bg-red-50' : 'border-green-300 bg-green-50'} rounded p-3 text-center">
        <div class="text-sm ${bill.remaining_amount > 0 ? 'text-red-600' : 'text-green-600'}">未缴金额</div>
        <div class="text-xl font-bold ${bill.remaining_amount > 0 ? 'text-red-600' : 'text-green-600'}">${formatMoney(bill.remaining_amount)}</div>
      </div>
    </div>

    <div class="mb-4">
      <h4 class="font-medium mb-2">💳 付款记录</h4>
      <table class="w-full text-sm border">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-3 py-2">时间</th>
            <th class="text-left px-3 py-2">金额</th>
            <th class="text-left px-3 py-2">方式</th>
            <th class="text-left px-3 py-2">经办人</th>
            <th class="text-left px-3 py-2">备注</th>
          </tr>
        </thead>
        <tbody>${paymentsHtml}</tbody>
      </table>
    </div>

    <div>
      <h4 class="font-medium mb-2">📝 修改历史</h4>
      ${historyHtml}
    </div>

    <div class="flex justify-end gap-2 mt-6 pt-4 border-t">
      <button onclick="closeModal()" class="px-4 py-2 border rounded hover:bg-gray-100">关闭</button>
      ${bill.status !== 'paid' ? `
        <button onclick="showPayModal(${bill.id}, ${bill.remaining_amount}); closeModal();" 
          class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">缴费</button>
      ` : ''}
    </div>
  `);
}

function showPayModal(billId, remainingAmount) {
  showModal(`
    <h3 class="text-lg font-bold mb-4">💳 账单缴费</h3>
    <div class="mb-4 p-3 bg-yellow-50 rounded">
      <div class="text-sm text-yellow-700">待缴金额</div>
      <div class="text-2xl font-bold text-yellow-600">${formatMoney(remainingAmount)}</div>
    </div>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">付款金额 <span class="text-red-500">*</span></label>
        <input type="number" id="payAmount" value="${remainingAmount}" step="0.01" 
          class="w-full border rounded px-3 py-2" min="0.01" max="${remainingAmount}">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">付款方式</label>
        <select id="payMethod" class="w-full border rounded px-3 py-2">
          <option value="现金">现金</option>
          <option value="微信">微信</option>
          <option value="支付宝">支付宝</option>
          <option value="银行转账">银行转账</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">经办人</label>
        <input type="text" id="payOperator" placeholder="请输入经办人姓名" class="w-full border rounded px-3 py-2">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">备注</label>
        <input type="text" id="payNotes" placeholder="可选" class="w-full border rounded px-3 py-2">
      </div>
    </div>

    <div class="flex justify-end gap-2 mt-6 pt-4 border-t">
      <button onclick="closeModal()" class="px-4 py-2 border rounded hover:bg-gray-100">取消</button>
      <button onclick="submitPayment(${billId})" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">确认缴费</button>
    </div>
  `);
}

async function submitPayment(billId) {
  const amount = parseFloat(document.getElementById('payAmount').value);
  const method = document.getElementById('payMethod').value;
  const operator = document.getElementById('payOperator').value || '系统';
  const notes = document.getElementById('payNotes').value;

  const res = await fetch(`${API_BASE}/bills/${billId}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, payment_method: method, operator, notes })
  });

  const result = await res.json();
  if (!result.success) {
    alert(result.message);
    return;
  }

  alert(`缴费成功！金额: ${formatMoney(result.paidAmount)}`);
  closeModal();
  loadBills();
}

function showModifyBillModal(billId, currentAmount) {
  showModal(`
    <h3 class="text-lg font-bold mb-4">✏️ 人工改判</h3>
    <div class="mb-4 p-3 bg-blue-50 rounded">
      <div class="text-sm text-blue-700">当前应缴金额</div>
      <div class="text-2xl font-bold text-blue-600">${formatMoney(currentAmount)}</div>
    </div>
    <div class="text-sm text-gray-500 mb-4 p-2 bg-yellow-50 rounded">
      ⚠️ 改判会记录历史，需填写改判原因
    </div>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">改判后金额 <span class="text-red-500">*</span></label>
        <input type="number" id="modifyAmount" value="${currentAmount}" step="0.01" 
          class="w-full border rounded px-3 py-2" min="0">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">改判原因 <span class="text-red-500">*</span></label>
        <textarea id="modifyReason" rows="3" placeholder="请说明改判原因..." 
          class="w-full border rounded px-3 py-2"></textarea>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">经办人</label>
        <input type="text" id="modifyOperator" placeholder="请输入经办人姓名" class="w-full border rounded px-3 py-2">
      </div>
    </div>

    <div class="flex justify-end gap-2 mt-6 pt-4 border-t">
      <button onclick="closeModal()" class="px-4 py-2 border rounded hover:bg-gray-100">取消</button>
      <button onclick="submitModifyBill(${billId})" class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600">确认改判</button>
    </div>
  `);
}

async function submitModifyBill(billId) {
  const newAmount = parseFloat(document.getElementById('modifyAmount').value);
  const reason = document.getElementById('modifyReason').value.trim();
  const operator = document.getElementById('modifyOperator').value || '系统';

  if (!reason) {
    alert('请填写改判原因');
    return;
  }

  if (!confirm('确认改判？此操作会记录历史并影响未缴金额。')) return;

  const res = await fetch(`${API_BASE}/bills/${billId}/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      new_total_amount: newAmount, 
      reason, 
      operator 
    })
  });

  const result = await res.json();
  if (!result.success) {
    alert(result.message);
    return;
  }

  alert(`改判成功！\n改判前: ${formatMoney(result.oldAmount)}\n改判后: ${formatMoney(result.newAmount)}\n差额: ${formatMoney(result.amountDiff)}`);
  closeModal();
  loadBills();
}

async function loadStudents() {
  await loadClassesForSelect();
  const classId = document.getElementById('studentsClass').value;
  const status = document.getElementById('studentsStatus').value;

  let url = `${API_BASE}/students`;
  const params = [];
  if (classId) params.push(`class_id=${classId}`);
  if (status) params.push(`status=${status}`);
  if (params.length) url += '?' + params.join('&');

  const res = await fetch(url);
  currentStudents = await res.json();

  if (currentStudents.length === 0) {
    document.getElementById('studentsContent').innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <div class="text-4xl mb-2">👶</div>
        <p>暂无学生数据</p>
      </div>
    `;
    return;
  }

  const rows = currentStudents.map(s => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 font-medium">${s.name}</td>
      <td class="px-4 py-3">${s.gender || '-'}</td>
      <td class="px-4 py-3">${formatDate(s.birthday)}</td>
      <td class="px-4 py-3">${s.class_name || '-'}</td>
      <td class="px-4 py-3">${s.guardian_name || '-'}</td>
      <td class="px-4 py-3">${s.guardian_phone || '-'}</td>
      <td class="px-4 py-3">
        <span class="${s.status === 'active' ? 'text-green-600' : 'text-gray-500'}">
          ${s.status === 'active' ? '在读' : '已退园'}
        </span>
      </td>
      <td class="px-4 py-3">
        <div class="flex gap-2">
          <button onclick="showStudentDetail(${s.id})" class="text-blue-500 hover:underline">详情</button>
          ${s.status === 'active' ? `
            <button onclick="showWithdrawModal(${s.id}, '${s.name}')" class="text-red-500 hover:underline">退园</button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');

  document.getElementById('studentsContent').innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-medium">姓名</th>
            <th class="text-left px-4 py-3 font-medium">性别</th>
            <th class="text-left px-4 py-3 font-medium">生日</th>
            <th class="text-left px-4 py-3 font-medium">班级</th>
            <th class="text-left px-4 py-3 font-medium">家长</th>
            <th class="text-left px-4 py-3 font-medium">电话</th>
            <th class="text-left px-4 py-3 font-medium">状态</th>
            <th class="text-left px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function showStudentDetail(studentId) {
  const res = await fetch(`${API_BASE}/students/${studentId}`);
  const data = await res.json();
  const { student, bills, leaves, payments } = data;

  const billsHtml = bills.length > 0 
    ? bills.map(b => `
        <tr>
          <td class="px-3 py-2">${b.billing_year}年${b.billing_month}月</td>
          <td class="px-3 py-2 font-mono">${formatMoney(b.total_amount)}</td>
          <td class="px-3 py-2 font-mono">${formatMoney(b.paid_amount)}</td>
          <td class="px-3 py-2 font-mono ${b.remaining_amount > 0 ? 'text-red-500' : 'text-green-500'}">${formatMoney(b.remaining_amount)}</td>
          <td class="px-3 py-2 status-${b.status}">${statusText(b.status)}</td>
          <td class="px-3 py-2">
            <button onclick="closeModal(); showBillDetail(${b.id})" class="text-blue-500 hover:underline">查看</button>
          </td>
        </tr>
      `).join('')
    : '<tr><td colspan="6" class="px-3 py-4 text-center text-gray-500">暂无账单</td></tr>';

  const leavesHtml = leaves.length > 0
    ? leaves.map(l => `
        <tr>
          <td class="px-3 py-2">${l.leave_type}</td>
          <td class="px-3 py-2">${formatDate(l.start_date)} ~ ${formatDate(l.end_date)}</td>
          <td class="px-3 py-2">${l.days}天</td>
          <td class="px-3 py-2">${l.reason || '-'}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="4" class="px-3 py-4 text-center text-gray-500">暂无请假记录</td></tr>';

  showModal(`
    <h3 class="text-lg font-bold mb-4">👶 学生详情</h3>
    
    <div class="grid grid-cols-2 gap-4 mb-4">
      <div class="bg-gray-50 rounded p-3">
        <div class="text-sm text-gray-500">姓名</div>
        <div class="font-bold">${student.name}</div>
      </div>
      <div class="bg-gray-50 rounded p-3">
        <div class="text-sm text-gray-500">班级</div>
        <div class="font-bold">${student.class_name || '-'}</div>
      </div>
      <div class="bg-gray-50 rounded p-3">
        <div class="text-sm text-gray-500">家长</div>
        <div class="font-bold">${student.guardian_name || '-'}</div>
      </div>
      <div class="bg-gray-50 rounded p-3">
        <div class="text-sm text-gray-500">电话</div>
        <div class="font-bold">${student.guardian_phone || '-'}</div>
      </div>
      <div class="bg-gray-50 rounded p-3">
        <div class="text-sm text-gray-500">入学日期</div>
        <div class="font-bold">${formatDate(student.enrollment_date)}</div>
      </div>
      <div class="bg-gray-50 rounded p-3">
        <div class="text-sm text-gray-500">状态</div>
        <div class="font-bold ${student.status === 'active' ? 'text-green-600' : 'text-gray-500'}">
          ${student.status === 'active' ? '在读' : '已退园'}
        </div>
      </div>
    </div>

    <div class="mb-4">
      <h4 class="font-medium mb-2">📋 账单记录</h4>
      <div class="overflow-x-auto">
        <table class="w-full text-sm border">
          <thead class="bg-gray-50">
            <tr>
              <th class="text-left px-3 py-2">账期</th>
              <th class="text-left px-3 py-2">应缴</th>
              <th class="text-left px-3 py-2">已缴</th>
              <th class="text-left px-3 py-2">未缴</th>
              <th class="text-left px-3 py-2">状态</th>
              <th class="text-left px-3 py-2">操作</th>
            </tr>
          </thead>
          <tbody>${billsHtml}</tbody>
        </table>
      </div>
    </div>

    <div class="mb-4">
      <h4 class="font-medium mb-2">📅 请假记录</h4>
      <div class="overflow-x-auto">
        <table class="w-full text-sm border">
          <thead class="bg-gray-50">
            <tr>
              <th class="text-left px-3 py-2">类型</th>
              <th class="text-left px-3 py-2">时间</th>
              <th class="text-left px-3 py-2">天数</th>
              <th class="text-left px-3 py-2">原因</th>
            </tr>
          </thead>
          <tbody>${leavesHtml}</tbody>
        </table>
      </div>
    </div>

    <div class="flex justify-between items-center mt-6 pt-4 border-t">
      <button onclick="closeModal(); showSection('bills')" 
        class="text-blue-500 hover:underline">查看账单列表 →</button>
      <div class="flex gap-2">
        <button onclick="exportStudent(${studentId})" class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">导出Excel</button>
        <button onclick="closeModal()" class="px-4 py-2 border rounded hover:bg-gray-100">关闭</button>
      </div>
    </div>
  `);
}

function exportStudent(studentId) {
  window.open(`${API_BASE}/export/student/${studentId}`, '_blank');
}

function showAddStudentModal() {
  const classOptions = currentClasses.map(c => 
    `<option value="${c.id}">${c.name} (${c.level})</option>`
  ).join('');

  showModal(`
    <h3 class="text-lg font-bold mb-4">➕ 添加学生</h3>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">姓名 <span class="text-red-500">*</span></label>
        <input type="text" id="newStudentName" class="w-full border rounded px-3 py-2" placeholder="请输入学生姓名">
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">性别</label>
          <select id="newStudentGender" class="w-full border rounded px-3 py-2">
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">生日</label>
          <input type="date" id="newStudentBirthday" class="w-full border rounded px-3 py-2">
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">班级 <span class="text-red-500">*</span></label>
        <select id="newStudentClass" class="w-full border rounded px-3 py-2">
          ${classOptions}
        </select>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">家长姓名</label>
          <input type="text" id="newStudentGuardian" class="w-full border rounded px-3 py-2" placeholder="监护人姓名">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">联系电话</label>
          <input type="tel" id="newStudentPhone" class="w-full border rounded px-3 py-2" placeholder="联系电话">
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">入学日期</label>
        <input type="date" id="newStudentEnroll" class="w-full border rounded px-3 py-2">
      </div>
    </div>

    <div class="flex justify-end gap-2 mt-6 pt-4 border-t">
      <button onclick="closeModal()" class="px-4 py-2 border rounded hover:bg-gray-100">取消</button>
      <button onclick="submitAddStudent()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">添加</button>
    </div>
  `);
}

async function submitAddStudent() {
  const name = document.getElementById('newStudentName').value.trim();
  if (!name) {
    alert('请输入学生姓名');
    return;
  }

  const student = {
    name,
    gender: document.getElementById('newStudentGender').value,
    birthday: document.getElementById('newStudentBirthday').value,
    class_id: parseInt(document.getElementById('newStudentClass').value),
    guardian_name: document.getElementById('newStudentGuardian').value,
    guardian_phone: document.getElementById('newStudentPhone').value,
    enrollment_date: document.getElementById('newStudentEnroll').value
  };

  await fetch(`${API_BASE}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(student)
  });

  alert('学生添加成功！');
  closeModal();
  loadStudents();
}

function showWithdrawModal(studentId, studentName) {
  showModal(`
    <h3 class="text-lg font-bold mb-4">👋 学生退园</h3>
    <div class="mb-4 p-3 bg-red-50 rounded text-red-700">
      确认办理 <strong>${studentName}</strong> 的退园手续？
    </div>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">退园日期 <span class="text-red-500">*</span></label>
        <input type="date" id="withdrawDate" class="w-full border rounded px-3 py-2">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">退园原因</label>
        <textarea id="withdrawReason" rows="3" class="w-full border rounded px-3 py-2" placeholder="请说明退园原因..."></textarea>
      </div>
    </div>

    <div class="flex justify-end gap-2 mt-6 pt-4 border-t">
      <button onclick="closeModal()" class="px-4 py-2 border rounded hover:bg-gray-100">取消</button>
      <button onclick="submitWithdraw(${studentId})" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">确认退园</button>
    </div>
  `);
}

async function submitWithdraw(studentId) {
  const date = document.getElementById('withdrawDate').value;
  const reason = document.getElementById('withdrawReason').value;

  if (!date) {
    alert('请选择退园日期');
    return;
  }

  await fetch(`${API_BASE}/students/${studentId}/withdraw`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ withdrawal_date: date, reason })
  });

  alert('退园手续已办理！系统将按天结算当月费用。');
  closeModal();
  loadStudents();
}

async function loadClasses() {
  const res = await fetch(`${API_BASE}/classes`);
  const classes = await res.json();

  if (classes.length === 0) {
    document.getElementById('classesContent').innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <div class="text-4xl mb-2">🏠</div>
        <p>暂无班级数据</p>
      </div>
    `;
    return;
  }

  const cards = classes.map(c => `
    <div class="border rounded-lg p-4 hover:shadow-md transition">
      <div class="flex justify-between items-start mb-3">
        <div>
          <h4 class="text-lg font-bold">${c.name}</h4>
          <div class="text-sm text-gray-500">${c.level}</div>
        </div>
        <span class="bg-blue-100 text-blue-600 px-2 py-1 rounded text-sm">${c.student_count}人</span>
      </div>
      <div class="grid grid-cols-2 gap-2 text-sm">
        <div class="bg-gray-50 p-2 rounded">
          <div class="text-gray-500">月学费</div>
          <div class="font-bold">${formatMoney(c.monthly_tuition)}</div>
        </div>
        <div class="bg-gray-50 p-2 rounded">
          <div class="text-gray-500">日餐费</div>
          <div class="font-bold">${formatMoney(c.daily_meal_fee)}</div>
        </div>
      </div>
    </div>
  `).join('');

  document.getElementById('classesContent').innerHTML = `
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${cards}
    </div>
  `;
}

function showAddClassModal() {
  showModal(`
    <h3 class="text-lg font-bold mb-4">➕ 添加班级</h3>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">班级名称 <span class="text-red-500">*</span></label>
        <input type="text" id="newClassName" class="w-full border rounded px-3 py-2" placeholder="如：小一班">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">年级 <span class="text-red-500">*</span></label>
        <select id="newClassLevel" class="w-full border rounded px-3 py-2">
          <option value="小班">小班</option>
          <option value="中班">中班</option>
          <option value="大班">大班</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">月学费（元） <span class="text-red-500">*</span></label>
        <input type="number" id="newClassTuition" class="w-full border rounded px-3 py-2" placeholder="2000">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">日餐费（元） <span class="text-red-500">*</span></label>
        <input type="number" id="newClassMeal" class="w-full border rounded px-3 py-2" placeholder="25">
      </div>
    </div>

    <div class="flex justify-end gap-2 mt-6 pt-4 border-t">
      <button onclick="closeModal()" class="px-4 py-2 border rounded hover:bg-gray-100">取消</button>
      <button onclick="submitAddClass()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">添加</button>
    </div>
  `);
}

async function submitAddClass() {
  const name = document.getElementById('newClassName').value.trim();
  const level = document.getElementById('newClassLevel').value;
  const tuition = parseFloat(document.getElementById('newClassTuition').value);
  const meal = parseFloat(document.getElementById('newClassMeal').value);

  if (!name || isNaN(tuition) || isNaN(meal)) {
    alert('请填写完整信息');
    return;
  }

  await fetch(`${API_BASE}/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, level, monthly_tuition: tuition, daily_meal_fee: meal })
  });

  alert('班级添加成功！');
  closeModal();
  loadClasses();
  loadClassesForSelect();
}

async function loadPayments() {
  const res = await fetch(`${API_BASE}/payments`);
  const payments = await res.json();

  if (payments.length === 0) {
    document.getElementById('paymentsContent').innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <div class="text-4xl mb-2">💰</div>
        <p>暂无付款记录</p>
      </div>
    `;
    return;
  }

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  const rows = payments.map(p => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3">${formatDate(p.payment_date)}</td>
      <td class="px-4 py-3 font-medium">${p.student_name}</td>
      <td class="px-4 py-3">${p.billing_year}年${p.billing_month}月</td>
      <td class="px-4 py-3 font-mono text-green-600">${formatMoney(p.amount)}</td>
      <td class="px-4 py-3">${p.payment_method || '-'}</td>
      <td class="px-4 py-3">${p.operator || '-'}</td>
      <td class="px-4 py-3">${p.notes || '-'}</td>
    </tr>
  `).join('');

  document.getElementById('paymentsContent').innerHTML = `
    <div class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
      <div class="flex justify-between items-center">
        <div class="text-green-700">总收款金额</div>
        <div class="text-2xl font-bold text-green-600">${formatMoney(total)}</div>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-medium">付款时间</th>
            <th class="text-left px-4 py-3 font-medium">学生</th>
            <th class="text-left px-4 py-3 font-medium">账期</th>
            <th class="text-left px-4 py-3 font-medium">金额</th>
            <th class="text-left px-4 py-3 font-medium">方式</th>
            <th class="text-left px-4 py-3 font-medium">经办人</th>
            <th class="text-left px-4 py-3 font-medium">备注</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function loadArrears() {
  const year = document.getElementById('arrearsYear').value;
  const month = document.getElementById('arrearsMonth').value;

  const res = await fetch(`${API_BASE}/arrears?year=${year}&month=${month}`);
  const arrears = await res.json();

  if (arrears.length === 0) {
    document.getElementById('arrearsContent').innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <div class="text-4xl mb-2">🎉</div>
        <p>太棒了！当前没有欠费记录</p>
      </div>
    `;
    return;
  }

  const total = arrears.reduce((sum, a) => sum + a.remaining_amount, 0);

  const rows = arrears.map(a => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 font-medium">${a.student_name}</td>
      <td class="px-4 py-3">${a.class_name}</td>
      <td class="px-4 py-3">${a.billing_year}年${a.billing_month}月</td>
      <td class="px-4 py-3 font-mono">${formatMoney(a.total_amount)}</td>
      <td class="px-4 py-3 font-mono">${formatMoney(a.paid_amount)}</td>
      <td class="px-4 py-3 font-mono text-red-600 font-bold">${formatMoney(a.remaining_amount)}</td>
      <td class="px-4 py-3">${a.guardian_phone || '-'}</td>
      <td class="px-4 py-3">
        <span class="status-${a.status}">${statusText(a.status)}</span>
      </td>
    </tr>
  `).join('');

  document.getElementById('arrearsContent').innerHTML = `
    <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <div class="flex justify-between items-center">
        <div>
          <div class="text-red-700 font-medium">欠费汇总</div>
          <div class="text-sm text-red-600">共 ${arrears.length} 条待处理</div>
        </div>
        <div class="text-2xl font-bold text-red-600">${formatMoney(total)}</div>
      </div>
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-medium">学生</th>
            <th class="text-left px-4 py-3 font-medium">班级</th>
            <th class="text-left px-4 py-3 font-medium">账期</th>
            <th class="text-left px-4 py-3 font-medium">应缴</th>
            <th class="text-left px-4 py-3 font-medium">已缴</th>
            <th class="text-left px-4 py-3 font-medium">欠费</th>
            <th class="text-left px-4 py-3 font-medium">联系电话</th>
            <th class="text-left px-4 py-3 font-medium">状态</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function loadLeaves() {
  const res = await fetch(`${API_BASE}/leaves`);
  const leaves = await res.json();

  if (leaves.length === 0) {
    document.getElementById('leavesContent').innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <div class="text-4xl mb-2">📅</div>
        <p>暂无请假记录</p>
      </div>
    `;
    return;
  }

  const rows = leaves.map(l => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 font-medium">${l.student_name}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 rounded text-sm ${l.leave_type === '病假' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}">${l.leave_type}</span>
      </td>
      <td class="px-4 py-3">${formatDate(l.start_date)}</td>
      <td class="px-4 py-3">${formatDate(l.end_date)}</td>
      <td class="px-4 py-3 font-bold text-orange-500">${l.days}天</td>
      <td class="px-4 py-3">${l.reason || '-'}</td>
    </tr>
  `).join('');

  document.getElementById('leavesContent').innerHTML = `
    <div class="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
      💡 请假天数会自动减免餐费，请假审批通过后可生成/更新账单
    </div>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-medium">学生</th>
            <th class="text-left px-4 py-3 font-medium">类型</th>
            <th class="text-left px-4 py-3 font-medium">开始</th>
            <th class="text-left px-4 py-3 font-medium">结束</th>
            <th class="text-left px-4 py-3 font-medium">天数</th>
            <th class="text-left px-4 py-3 font-medium">原因</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function showAddLeaveModal() {
  const studentOptions = currentStudents
    .filter(s => s.status === 'active')
    .map(s => `<option value="${s.id}">${s.name} (${s.class_name})</option>`)
    .join('');

  showModal(`
    <h3 class="text-lg font-bold mb-4">➕ 请假登记</h3>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">学生 <span class="text-red-500">*</span></label>
        <select id="newLeaveStudent" class="w-full border rounded px-3 py-2">
          ${studentOptions}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">请假类型 <span class="text-red-500">*</span></label>
        <select id="newLeaveType" class="w-full border rounded px-3 py-2">
          <option value="事假">事假</option>
          <option value="病假">病假</option>
          <option value="其他">其他</option>
        </select>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium mb-1">开始日期 <span class="text-red-500">*</span></label>
          <input type="date" id="newLeaveStart" class="w-full border rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">结束日期 <span class="text-red-500">*</span></label>
          <input type="date" id="newLeaveEnd" class="w-full border rounded px-3 py-2">
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">请假天数</label>
        <input type="number" id="newLeaveDays" class="w-full border rounded px-3 py-2" placeholder="自动计算，可手动调整">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">请假原因</label>
        <textarea id="newLeaveReason" rows="2" class="w-full border rounded px-3 py-2"></textarea>
      </div>
    </div>

    <div class="flex justify-end gap-2 mt-6 pt-4 border-t">
      <button onclick="closeModal()" class="px-4 py-2 border rounded hover:bg-gray-100">取消</button>
      <button onclick="submitAddLeave()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">提交</button>
    </div>
  `);
}

async function submitAddLeave() {
  const studentId = parseInt(document.getElementById('newLeaveStudent').value);
  const type = document.getElementById('newLeaveType').value;
  const start = document.getElementById('newLeaveStart').value;
  const end = document.getElementById('newLeaveEnd').value;
  let days = parseInt(document.getElementById('newLeaveDays').value);
  const reason = document.getElementById('newLeaveReason').value;

  if (!start || !end) {
    alert('请选择请假日期');
    return;
  }

  if (!days || isNaN(days)) {
    days = Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;
  }

  await fetch(`${API_BASE}/leaves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      student_id: studentId, 
      leave_type: type,
      start_date: start,
      end_date: end,
      days,
      reason
    })
  });

  alert('请假登记成功！请重新生成账单以应用减免。');
  closeModal();
  loadLeaves();
}

async function loadApprovals() {
  const status = document.getElementById('approvalsStatus').value;
  let url = `${API_BASE}/approvals`;
  if (status) url += `?status=${status}`;

  const res = await fetch(url);
  const approvals = await res.json();

  if (approvals.length === 0) {
    document.getElementById('approvalsContent').innerHTML = `
      <div class="text-center py-12 text-gray-500">
        <div class="text-4xl mb-2">✅</div>
        <p>暂无减免审批</p>
      </div>
    `;
    return;
  }

  const statusMap = { pending: '待审批', approved: '已通过', rejected: '已拒绝' };
  const statusColor = { pending: 'bg-yellow-100 text-yellow-600', approved: 'bg-green-100 text-green-600', rejected: 'bg-red-100 text-red-600' };

  const rows = approvals.map(a => `
    <tr class="hover:bg-gray-50">
      <td class="px-4 py-3 font-medium">${a.student_name}</td>
      <td class="px-4 py-3">${a.reduction_type}</td>
      <td class="px-4 py-3 font-mono text-green-600">${formatMoney(a.reduction_amount)}</td>
      <td class="px-4 py-3">${a.reason}</td>
      <td class="px-4 py-3">${a.applied_by || '-'}</td>
      <td class="px-4 py-3">
        <span class="px-2 py-1 rounded text-sm ${statusColor[a.status]}">${statusMap[a.status]}</span>
      </td>
      <td class="px-4 py-3">
        ${a.status === 'pending' ? `
          <div class="flex gap-2">
            <button onclick="approveReduction(${a.id})" class="text-green-500 hover:underline">通过</button>
            <button onclick="rejectReduction(${a.id})" class="text-red-500 hover:underline">拒绝</button>
          </div>
        ` : '-'}
      </td>
    </tr>
  `).join('');

  document.getElementById('approvalsContent').innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-gray-50">
          <tr>
            <th class="text-left px-4 py-3 font-medium">学生</th>
            <th class="text-left px-4 py-3 font-medium">减免类型</th>
            <th class="text-left px-4 py-3 font-medium">减免金额</th>
            <th class="text-left px-4 py-3 font-medium">原因</th>
            <th class="text-left px-4 py-3 font-medium">申请人</th>
            <th class="text-left px-4 py-3 font-medium">状态</th>
            <th class="text-left px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function showAddApprovalModal() {
  const studentOptions = currentStudents
    .filter(s => s.status === 'active')
    .map(s => `<option value="${s.id}">${s.name}</option>`)
    .join('');

  showModal(`
    <h3 class="text-lg font-bold mb-4">➕ 申请减免</h3>
    
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">学生 <span class="text-red-500">*</span></label>
        <select id="newApprovalStudent" class="w-full border rounded px-3 py-2">
          ${studentOptions}
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">减免类型 <span class="text-red-500">*</span></label>
        <select id="newApprovalType" class="w-full border rounded px-3 py-2">
          <option value="困难减免">困难减免</option>
          <option value="特殊照顾">特殊照顾</option>
          <option value="多子女优惠">多子女优惠</option>
          <option value="其他">其他</option>
        </select>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">减免金额（元） <span class="text-red-500">*</span></label>
        <input type="number" id="newApprovalAmount" class="w-full border rounded px-3 py-2" placeholder="请输入金额">
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">申请原因 <span class="text-red-500">*</span></label>
        <textarea id="newApprovalReason" rows="3" class="w-full border rounded px-3 py-2"></textarea>
      </div>
      <div>
        <label class="block text-sm font-medium mb-1">申请人</label>
        <input type="text" id="newApprovalApplicant" class="w-full border rounded px-3 py-2">
      </div>
    </div>

    <div class="flex justify-end gap-2 mt-6 pt-4 border-t">
      <button onclick="closeModal()" class="px-4 py-2 border rounded hover:bg-gray-100">取消</button>
      <button onclick="submitAddApproval()" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">提交申请</button>
    </div>
  `);
}

async function submitAddApproval() {
  const studentId = parseInt(document.getElementById('newApprovalStudent').value);
  const type = document.getElementById('newApprovalType').value;
  const amount = parseFloat(document.getElementById('newApprovalAmount').value);
  const reason = document.getElementById('newApprovalReason').value;
  const applicant = document.getElementById('newApprovalApplicant').value;

  if (!reason || isNaN(amount)) {
    alert('请填写完整信息');
    return;
  }

  await fetch(`${API_BASE}/approvals`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      student_id: studentId,
      reduction_type: type,
      reduction_amount: amount,
      reason,
      applied_by: applicant
    })
  });

  alert('减免申请已提交，等待审批。');
  closeModal();
  loadApprovals();
}

async function approveReduction(id) {
  if (!confirm('确认通过该减免申请？')) return;
  
  await fetch(`${API_BASE}/approvals/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved_by: '管理员' })
  });

  alert('已通过');
  loadApprovals();
}

async function rejectReduction(id) {
  if (!confirm('确认拒绝该减免申请？')) return;
  
  await fetch(`${API_BASE}/approvals/${id}/reject`, { method: 'POST' });

  alert('已拒绝');
  loadApprovals();
}

function showModal(content) {
  document.getElementById('modalContainer').innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center modal-overlay" onclick="if(event.target === this) closeModal()">
      <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div class="p-6">${content}</div>
      </div>
    </div>
  `;
}

function closeModal() {
  document.getElementById('modalContainer').innerHTML = '';
}

async function demoScenario(type) {
  const demoMap = {
    normal: { student: 1, name: '张小明', desc: '正常缴费示例：完整月份，无请假' },
    leave: { student: 2, name: '李小红', desc: '请假减免示例：请假4天，减免餐费 ¥100' },
    transfer: { student: 3, name: '王小强', desc: '插班示例：需先设置插班日期（月中入学）' },
    withdraw: { student: 6, name: '周小美', desc: '退园退款示例：已退园，按实际天数结算' }
  };

  const demo = demoMap[type];

  if (type === 'transfer') {
    alert(`${demo.desc}\n\n请先在"学生管理"中添加一个月中插班的学生（入学日期设为12月15日），然后生成账单查看效果。`);
    return;
  }

  showModal(`
    <h3 class="text-lg font-bold mb-4">🧪 ${demo.name} - ${type === 'normal' ? '正常缴费' : type === 'leave' ? '请假减免' : '退园退款'}</h3>
    
    <div class="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
      <p class="text-blue-700">${demo.desc}</p>
    </div>

    <div class="bg-gray-50 rounded p-4 mb-4">
      <h4 class="font-medium mb-2">📋 操作步骤</h4>
      <ol class="list-decimal list-inside space-y-2 text-sm">
        <li>点击下面的"查看学生详情"按钮查看学生信息</li>
        <li>切换到"账单列表"页面</li>
        <li>选择 2024年12月，点击"生成账单"</li>
        <li>查看生成的账单，点击"详情"查看计费公式</li>
      </ol>
    </div>

    <div class="flex justify-end gap-2">
      <button onclick="closeModal()" class="px-4 py-2 border rounded hover:bg-gray-100">关闭</button>
      <button onclick="closeModal(); showStudentDetail(${demo.student})" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">查看学生详情</button>
    </div>
  `);
}

async function init() {
  await initDateSelectors();
  await loadClassesForSelect();
  await loadStudents();
  await loadDashboard();
}

init();
