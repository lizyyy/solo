// API基础URL
const API_BASE = '';

// 全局变量
let students = [];
let seats = [];
let balances = [];

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initTabs();
    initDateInputs();
    loadAllData();
    initForms();
});

// 初始化标签页切换
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetTab = this.dataset.tab;

            // 更新按钮状态
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // 更新内容显示
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');

            // 加载对应数据
            switch(targetTab) {
                case 'board':
                    loadBoard();
                    break;
                case 'balances':
                    loadBalances();
                    break;
                case 'records':
                    loadRecords();
                    break;
                case 'reservation':
                    loadReservations();
                    break;
                case 'students':
                    loadStudents();
                    break;
                case 'seats':
                    loadSeats();
                    break;
            }
        });
    });
}

// 初始化日期输入框
function initDateInputs() {
    const today = new Date().toISOString().split('T')[0];
    
    // 设置默认日期为今天
    const boardDate = document.getElementById('board-date');
    if (boardDate) {
        boardDate.value = today;
    }
}

// 加载所有基础数据
async function loadAllData() {
    try {
        await Promise.all([
            loadStudentsList(),
            loadSeatsList(),
            loadBalancesList()
        ]);
        
        // 加载今日座位板
        loadBoard();
    } catch (error) {
        showToast('加载数据失败', 'error');
        console.error(error);
    }
}

// 加载学员列表
async function loadStudentsList() {
    try {
        const response = await fetch(`${API_BASE}/api/students`);
        if (response.ok) {
            students = await response.json();
        }
    } catch (error) {
        console.error('加载学员列表失败:', error);
    }
}

// 加载座位列表
async function loadSeatsList() {
    try {
        const response = await fetch(`${API_BASE}/api/seats`);
        if (response.ok) {
            seats = await response.json();
        }
    } catch (error) {
        console.error('加载座位列表失败:', error);
    }
}

// 加载余额列表
async function loadBalancesList() {
    try {
        const response = await fetch(`${API_BASE}/api/student-balances`);
        if (response.ok) {
            balances = await response.json();
        }
    } catch (error) {
        console.error('加载余额列表失败:', error);
    }
}

// ========== 今日座位板 ==========

async function loadBoard() {
    const dateInput = document.getElementById('board-date');
    const date = dateInput ? dateInput.value : '';
    
    let url = `${API_BASE}/api/today-board`;
    if (date) {
        url += `?date=${date}`;
    }
    
    try {
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            renderBoard(data);
        } else {
            showToast('加载座位板失败', 'error');
        }
    } catch (error) {
        showToast('网络错误', 'error');
        console.error(error);
    }
}

function renderBoard(data) {
    const container = document.getElementById('board-container');
    if (!container) return;

    if (!data.board || data.board.length === 0) {
        container.innerHTML = '<div class="empty-state"><h4>暂无座位数据</h4><p>请先添加座位</p></div>';
        return;
    }

    let html = '';
    data.board.forEach(seat => {
        html += `
            <div class="seat-card">
                <div class="seat-header">
                    <div>
                        <span class="seat-name">${seat.name}</span>
                        ${seat.location ? `<span class="seat-location"> - ${seat.location}</span>` : ''}
                    </div>
                </div>
        `;

        if (seat.reservations && seat.reservations.length > 0) {
            seat.reservations.forEach(res => {
                html += `
                    <div class="reservation-item">
                        <div class="student-name">${res.student_name}</div>
                        <div class="time-info">
                            <span>${res.start_time} - ${res.end_time}</span>
                            <span>${res.duration_hours}小时</span>
                        </div>
                    </div>
                `;
            });
        } else {
            html += `<div class="no-reservation">当前无预约</div>`;
        }

        html += `</div>`;
    });

    container.innerHTML = html;
}

// ========== 学员余额 ==========

async function loadBalances() {
    try {
        await loadBalancesList();
        renderBalances();
    } catch (error) {
        showToast('加载余额数据失败', 'error');
        console.error(error);
    }
}

function renderBalances() {
    const tbody = document.getElementById('balances-body');
    if (!tbody) return;

    if (balances.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">暂无学员余额数据</td></tr>';
        return;
    }

    let html = '';
    balances.forEach(balance => {
        const remainingClass = balance.remaining_hours > 5 ? 'balance-positive' : 
                              balance.remaining_hours > 0 ? 'balance-low' : 'balance-zero';
        const makeupClass = balance.makeup_hours > 0 ? 'balance-positive' : 'balance-zero';
        
        html += `
            <tr>
                <td>${balance.student_id}</td>
                <td>${balance.student_name}</td>
                <td>${balance.phone || '-'}</td>
                <td>${balance.total_hours}</td>
                <td>${balance.used_hours}</td>
                <td class="${remainingClass}">${balance.remaining_hours}</td>
                <td class="${makeupClass}">${balance.makeup_hours}</td>
                <td>${formatDateTime(balance.updated_at)}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ========== 请假补签流水 ==========

async function loadRecords(filterDate = null) {
    const dateInput = document.getElementById('records-date');
    let date = filterDate !== null ? filterDate : (dateInput ? dateInput.value : '');
    
    let url = `${API_BASE}/api/leave-records`;
    if (date) {
        url += `?date=${date}`;
    }
    
    try {
        const response = await fetch(url);
        if (response.ok) {
            const records = await response.json();
            renderRecords(records);
        } else {
            showToast('加载记录失败', 'error');
        }
    } catch (error) {
        showToast('网络错误', 'error');
        console.error(error);
    }
}

function renderRecords(records) {
    const tbody = document.getElementById('records-body');
    if (!tbody) return;

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">暂无请假补签记录</td></tr>';
        return;
    }

    let html = '';
    records.forEach(record => {
        const typeClass = record.type === 'leave' ? 'type-leave' : 'type-makeup';
        const typeText = record.type === 'leave' ? '请假' : '补签';
        const statusClass = record.status === 'completed' ? 'status-completed' : '';
        
        html += `
            <tr>
                <td>${record.id}</td>
                <td>${record.student_name}</td>
                <td class="${typeClass}">${typeText}</td>
                <td>${record.hours}</td>
                <td>${record.date}</td>
                <td class="${statusClass}">${record.status === 'completed' ? '已完成' : record.status}</td>
                <td>${record.description || '-'}</td>
                <td>${formatDateTime(record.created_at)}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// ========== 预约管理 ==========

async function loadReservations(filterDate = null) {
    const dateInput = document.getElementById('reservation-date');
    let date = filterDate !== null ? filterDate : (dateInput ? dateInput.value : '');
    
    let url = `${API_BASE}/api/reservations`;
    if (date) {
        url += `?date=${date}`;
    }
    
    try {
        const response = await fetch(url);
        if (response.ok) {
            const reservations = await response.json();
            renderReservations(reservations);
        } else {
            showToast('加载预约失败', 'error');
        }
    } catch (error) {
        showToast('网络错误', 'error');
        console.error(error);
    }
}

function renderReservations(reservations) {
    const tbody = document.getElementById('reservation-body');
    if (!tbody) return;

    if (reservations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="empty-state">暂无预约记录</td></tr>';
        return;
    }

    let html = '';
    reservations.forEach(res => {
        let statusClass = 'status-active';
        let statusText = '有效';
        
        if (res.status === 'cancelled') {
            statusClass = 'status-cancelled';
            statusText = '已取消';
        } else if (res.status === 'leave') {
            statusClass = 'status-leave';
            statusText = '已请假';
        } else if (res.status === 'completed') {
            statusClass = 'status-completed';
            statusText = '已完成';
        }
        
        const canCancel = res.status === 'active';
        
        html += `
            <tr>
                <td>${res.id}</td>
                <td>${res.student_name}</td>
                <td>${res.seat_name} (${res.seat_location || '-'})</td>
                <td>${res.date}</td>
                <td>${res.start_time} - ${res.end_time}</td>
                <td>${res.duration_hours}小时</td>
                <td class="${statusClass}">${statusText}</td>
                <td>
                    ${canCancel ? `
                        <button class="action-btn btn-warning" onclick="cancelReservation(${res.id})">取消</button>
                        <button class="action-btn btn-danger" onclick="applyLeave(${res.id})">请假</button>
                    ` : '-'}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// 取消预约
async function cancelReservation(id) {
    if (!confirm('确定要取消该预约吗？余额将退还。')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/reservations/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('预约已取消', 'success');
            loadReservations();
            loadBoard();
            loadBalances();
        } else {
            const data = await response.json();
            showToast(data.error || '取消失败', 'error');
        }
    } catch (error) {
        showToast('网络错误', 'error');
        console.error(error);
    }
}

// 申请请假
async function applyLeave(id) {
    if (!confirm('确定要申请请假吗？将生成对应补签额度。')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/leaves`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reservation_id: id, description: '学员请假' })
        });
        
        if (response.ok) {
            showToast('请假成功，已生成补签额度', 'success');
            loadReservations();
            loadBoard();
            loadBalances();
            loadRecords();
        } else {
            const data = await response.json();
            showToast(data.error || '请假失败', 'error');
        }
    } catch (error) {
        showToast('网络错误', 'error');
        console.error(error);
    }
}

// ========== 学员管理 ==========

async function loadStudents() {
    try {
        await loadStudentsList();
        renderStudents();
    } catch (error) {
        showToast('加载学员数据失败', 'error');
        console.error(error);
    }
}

function renderStudents() {
    const tbody = document.getElementById('students-body');
    if (!tbody) return;

    if (students.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无学员数据</td></tr>';
        return;
    }

    let html = '';
    students.forEach(student => {
        html += `
            <tr>
                <td>${student.id}</td>
                <td>${student.name}</td>
                <td>${student.phone || '-'}</td>
                <td>${student.email || '-'}</td>
                <td>${formatDateTime(student.created_at)}</td>
                <td>
                    <button class="action-btn btn-danger" onclick="deleteStudent(${student.id})">删除</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// 删除学员
async function deleteStudent(id) {
    if (!confirm('确定要删除该学员吗？')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/students/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('删除成功', 'success');
            loadStudents();
            loadBalances();
        } else {
            const data = await response.json();
            showToast(data.error || '删除失败', 'error');
        }
    } catch (error) {
        showToast('网络错误', 'error');
        console.error(error);
    }
}

// ========== 座位管理 ==========

async function loadSeats() {
    try {
        await loadSeatsList();
        renderSeats();
    } catch (error) {
        showToast('加载座位数据失败', 'error');
        console.error(error);
    }
}

function renderSeats() {
    const tbody = document.getElementById('seats-body');
    if (!tbody) return;

    if (seats.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">暂无座位数据</td></tr>';
        return;
    }

    let html = '';
    seats.forEach(seat => {
        html += `
            <tr>
                <td>${seat.id}</td>
                <td>${seat.name}</td>
                <td>${seat.location || '-'}</td>
                <td class="${seat.status === 'active' ? 'status-active' : ''}">${seat.status === 'active' ? '启用' : '禁用'}</td>
                <td>
                    <button class="action-btn btn-danger" onclick="deleteSeat(${seat.id})">删除</button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

// 删除座位
async function deleteSeat(id) {
    if (!confirm('确定要删除该座位吗？')) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/seats/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('删除成功', 'success');
            loadSeats();
            loadBoard();
        } else {
            const data = await response.json();
            showToast(data.error || '删除失败', 'error');
        }
    } catch (error) {
        showToast('网络错误', 'error');
        console.error(error);
    }
}

// ========== 模态框和表单 ==========

// 显示新建预约模态框
async function showReservationModal() {
    // 加载最新的学员和座位数据
    await loadStudentsList();
    await loadSeatsList();
    
    // 填充下拉框
    const studentSelect = document.getElementById('reservation-student');
    const seatSelect = document.getElementById('reservation-seat');
    
    if (studentSelect) {
        studentSelect.innerHTML = '<option value="">请选择学员</option>';
        students.forEach(s => {
            studentSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    }
    
    if (seatSelect) {
        seatSelect.innerHTML = '<option value="">请选择座位</option>';
        seats.forEach(s => {
            if (s.status === 'active') {
                seatSelect.innerHTML += `<option value="${s.id}">${s.name} (${s.location || '-'})</option>`;
            }
        });
    }
    
    // 设置默认日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reservation-date-input').value = today;
    
    // 显示模态框
    showModal('reservation-modal');
}

// 显示补签预约模态框
async function showMakeupModal() {
    // 加载最新的余额和座位数据
    await loadBalancesList();
    await loadSeatsList();
    
    // 填充下拉框（只显示有补签额度的学员）
    const studentSelect = document.getElementById('makeup-student');
    const seatSelect = document.getElementById('makeup-seat');
    
    if (studentSelect) {
        studentSelect.innerHTML = '<option value="">请选择学员（仅显示有补签额度的学员）</option>';
        balances.forEach(b => {
            if (b.makeup_hours > 0) {
                studentSelect.innerHTML += `<option value="${b.student_id}" data-balance="${b.makeup_hours}">${b.student_name} (补签额度: ${b.makeup_hours}小时)</option>`;
            }
        });
        
        // 监听学员选择变化
        studentSelect.onchange = function() {
            const selectedOption = this.options[this.selectedIndex];
            const balance = selectedOption ? selectedOption.dataset.balance : 0;
            const infoEl = document.getElementById('makeup-balance-info');
            if (infoEl) {
                infoEl.textContent = balance ? `当前补签额度: ${balance}小时` : '';
            }
        };
    }
    
    if (seatSelect) {
        seatSelect.innerHTML = '<option value="">请选择座位</option>';
        seats.forEach(s => {
            if (s.status === 'active') {
                seatSelect.innerHTML += `<option value="${s.id}">${s.name} (${s.location || '-'})</option>`;
            }
        });
    }
    
    // 设置默认日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('makeup-date-input').value = today;
    
    // 显示模态框
    showModal('makeup-modal');
}

// 显示新增学员模态框
function showStudentModal() {
    // 清空表单
    document.getElementById('student-form').reset();
    showModal('student-modal');
}

// 显示购买套餐模态框
async function showPackageModal() {
    await loadStudentsList();
    
    const studentSelect = document.getElementById('package-student');
    if (studentSelect) {
        studentSelect.innerHTML = '<option value="">请选择学员</option>';
        students.forEach(s => {
            studentSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    }
    
    // 设置默认日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('package-date').value = today;
    
    // 清空其他字段
    document.getElementById('package-hours').value = '';
    document.getElementById('package-price').value = '';
    
    showModal('package-modal');
}

// 显示新增座位模态框
function showSeatModal() {
    document.getElementById('seat-form').reset();
    showModal('seat-modal');
}

// 显示模态框
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
    }
}

// 关闭模态框
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
    }
}

// 点击模态框外部关闭
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});

// ========== 表单提交 ==========

function initForms() {
    // 预约表单
    const reservationForm = document.getElementById('reservation-form');
    if (reservationForm) {
        reservationForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const data = {
                student_id: parseInt(document.getElementById('reservation-student').value),
                seat_id: parseInt(document.getElementById('reservation-seat').value),
                date: document.getElementById('reservation-date-input').value,
                start_time: document.getElementById('reservation-start').value,
                end_time: document.getElementById('reservation-end').value
            };
            
            try {
                const response = await fetch(`${API_BASE}/api/reservations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    showToast('预约成功', 'success');
                    closeModal('reservation-modal');
                    loadReservations();
                    loadBoard();
                    loadBalances();
                } else {
                    const errorData = await response.json();
                    showToast(errorData.error || '预约失败', 'error');
                }
            } catch (error) {
                showToast('网络错误', 'error');
                console.error(error);
            }
        });
    }
    
    // 补签表单
    const makeupForm = document.getElementById('makeup-form');
    if (makeupForm) {
        makeupForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const data = {
                student_id: parseInt(document.getElementById('makeup-student').value),
                seat_id: parseInt(document.getElementById('makeup-seat').value),
                date: document.getElementById('makeup-date-input').value,
                start_time: document.getElementById('makeup-start').value,
                end_time: document.getElementById('makeup-end').value
            };
            
            try {
                const response = await fetch(`${API_BASE}/api/makeups`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    showToast('补签预约成功', 'success');
                    closeModal('makeup-modal');
                    loadReservations();
                    loadBoard();
                    loadBalances();
                    loadRecords();
                } else {
                    const errorData = await response.json();
                    showToast(errorData.error || '补签失败', 'error');
                }
            } catch (error) {
                showToast('网络错误', 'error');
                console.error(error);
            }
        });
    }
    
    // 学员表单
    const studentForm = document.getElementById('student-form');
    if (studentForm) {
        studentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const data = {
                name: document.getElementById('student-name').value,
                phone: document.getElementById('student-phone').value,
                email: document.getElementById('student-email').value
            };
            
            try {
                const response = await fetch(`${API_BASE}/api/students`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    showToast('添加学员成功', 'success');
                    closeModal('student-modal');
                    loadStudents();
                    loadBalances();
                } else {
                    const errorData = await response.json();
                    showToast(errorData.error || '添加失败', 'error');
                }
            } catch (error) {
                showToast('网络错误', 'error');
                console.error(error);
            }
        });
    }
    
    // 套餐表单
    const packageForm = document.getElementById('package-form');
    if (packageForm) {
        packageForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const data = {
                student_id: parseInt(document.getElementById('package-student').value),
                hours: parseFloat(document.getElementById('package-hours').value),
                price: parseFloat(document.getElementById('package-price').value) || null,
                purchase_date: document.getElementById('package-date').value
            };
            
            try {
                const response = await fetch(`${API_BASE}/api/packages`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    showToast('购买套餐成功', 'success');
                    closeModal('package-modal');
                    loadBalances();
                } else {
                    const errorData = await response.json();
                    showToast(errorData.error || '购买失败', 'error');
                }
            } catch (error) {
                showToast('网络错误', 'error');
                console.error(error);
            }
        });
    }
    
    // 座位表单
    const seatForm = document.getElementById('seat-form');
    if (seatForm) {
        seatForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const data = {
                name: document.getElementById('seat-name').value,
                location: document.getElementById('seat-location').value
            };
            
            try {
                const response = await fetch(`${API_BASE}/api/seats`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (response.ok) {
                    showToast('添加座位成功', 'success');
                    closeModal('seat-modal');
                    loadSeats();
                    loadBoard();
                } else {
                    const errorData = await response.json();
                    showToast(errorData.error || '添加失败', 'error');
                }
            } catch (error) {
                showToast('网络错误', 'error');
                console.error(error);
            }
        });
    }
}

// ========== CSV导出 ==========

function exportBalances() {
    window.location.href = `${API_BASE}/api/export/balances`;
}

function exportReservations() {
    const dateInput = document.getElementById('board-date');
    const date = dateInput ? dateInput.value : '';
    
    let url = `${API_BASE}/api/export/reservations`;
    if (date) {
        url += `?date=${date}`;
    }
    
    window.location.href = url;
}

function exportLeaveRecords() {
    const dateInput = document.getElementById('records-date');
    const date = dateInput ? dateInput.value : '';
    
    let url = `${API_BASE}/api/export/leave-records`;
    if (date) {
        url += `?date=${date}`;
    }
    
    window.location.href = url;
}

// ========== 辅助函数 ==========

function formatDateTime(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateStr;
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
