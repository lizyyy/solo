const API_BASE = '/api';

let state = {
    members: [],
    courses: [],
    coaches: [],
    schedules: [],
    bookings: [],
    currentMember: null
};

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initForms();
    setDefaultDates();
    loadAllData();
});

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('schedule-date').value = today;
    document.getElementById('export-date').value = today;
    document.getElementById('schedule-date-form').value = today;
}

function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabId);
    });
    
    document.querySelectorAll('.tab-content').forEach(c => {
        c.classList.toggle('active', c.id === tabId);
    });
    
    if (tabId === 'bookings') {
        loadMembersForFilter();
    }
}

function initForms() {
    document.getElementById('member-form').addEventListener('submit', handleMemberSubmit);
    document.getElementById('course-form').addEventListener('submit', handleCourseSubmit);
    document.getElementById('coach-form').addEventListener('submit', handleCoachSubmit);
    document.getElementById('schedule-form').addEventListener('submit', handleScheduleSubmit);
    document.getElementById('booking-form').addEventListener('submit', handleBookingSubmit);
}

async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || data.errors?.join(', ') || '请求失败');
        }
        
        return data;
    } catch (error) {
        showToast(error.message, 'error');
        throw error;
    }
}

async function loadAllData() {
    try {
        await Promise.all([
            loadMembers(),
            loadCourses(),
            loadCoaches(),
            loadSchedules(),
            loadBookings()
        ]);
    } catch (error) {
        console.error('加载数据失败:', error);
    }
}

async function loadMembers() {
    try {
        state.members = await apiRequest('/members');
        renderMembers();
        return state.members;
    } catch (error) {
        console.error('加载会员失败:', error);
    }
}

async function loadCourses() {
    try {
        state.courses = await apiRequest('/courses');
        renderCourses();
        return state.courses;
    } catch (error) {
        console.error('加载课程失败:', error);
    }
}

async function loadCoaches() {
    try {
        state.coaches = await apiRequest('/coaches');
        renderCoaches();
        return state.coaches;
    } catch (error) {
        console.error('加载教练失败:', error);
    }
}

async function loadSchedules() {
    const date = document.getElementById('schedule-date').value;
    const url = date ? `/schedules?date=${date}` : '/schedules';
    
    try {
        state.schedules = await apiRequest(url);
        renderSchedules();
        return state.schedules;
    } catch (error) {
        console.error('加载排班失败:', error);
    }
}

async function loadBookings() {
    const status = document.getElementById('booking-filter-status')?.value || '';
    const memberId = document.getElementById('booking-filter-member')?.value || '';
    
    let url = '/bookings';
    const params = [];
    if (status) params.push(`status=${status}`);
    if (memberId) params.push(`member_id=${memberId}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    
    try {
        state.bookings = await apiRequest(url);
        renderBookings();
        return state.bookings;
    } catch (error) {
        console.error('加载预约失败:', error);
    }
}

function renderMembers() {
    const tbody = document.getElementById('members-table');
    const searchTerm = document.getElementById('member-search')?.value?.toLowerCase() || '';
    
    const filteredMembers = state.members.filter(m => 
        m.name.toLowerCase().includes(searchTerm) || 
        m.phone.includes(searchTerm)
    );
    
    tbody.innerHTML = filteredMembers.map(member => `
        <tr>
            <td>${member.id}</td>
            <td>${member.name}</td>
            <td>${member.phone}</td>
            <td>${member.email || '-'}</td>
            <td><strong>${member.remaining_sessions}</strong></td>
            <td><span class="badge badge-${member.status}">${getStatusText(member.status)}</span></td>
            <td>
                <div class="actions">
                    <button class="btn btn-sm btn-secondary" onclick="viewMemberDetail(${member.id})">详情</button>
                    <button class="btn btn-sm btn-primary" onclick="editMember(${member.id})">编辑</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function searchMembers() {
    renderMembers();
}

function renderCourses() {
    const tbody = document.getElementById('courses-table');
    
    tbody.innerHTML = state.courses.map(course => `
        <tr>
            <td>${course.id}</td>
            <td><strong>${course.name}</strong></td>
            <td>${course.description || '-'}</td>
            <td>${course.duration} 分钟</td>
            <td>
                <div class="actions">
                    <button class="btn btn-sm btn-primary" onclick="editCourse(${course.id})">编辑</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCourse(${course.id})">删除</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderCoaches() {
    const tbody = document.getElementById('coaches-table');
    
    tbody.innerHTML = state.coaches.map(coach => `
        <tr>
            <td>${coach.id}</td>
            <td><strong>${coach.name}</strong></td>
            <td>${coach.phone || '-'}</td>
            <td>
                <div class="actions">
                    <button class="btn btn-sm btn-primary" onclick="editCoach(${coach.id})">编辑</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCoach(${coach.id})">删除</button>
                </div>
            </td>
        </tr>
    `).join('');
}

function renderSchedules() {
    const container = document.getElementById('schedules-list');
    
    if (state.schedules.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666; padding: 40px;">该日期暂无排班</p>';
        return;
    }
    
    container.innerHTML = state.schedules.map(schedule => {
        const isFull = schedule.booked_count >= schedule.capacity;
        const capacityPercent = (schedule.booked_count / schedule.capacity) * 100;
        
        return `
            <div class="schedule-card ${isFull ? 'full' : ''}">
                <h4>${schedule.course_name}</h4>
                <div class="schedule-info">
                    <div class="schedule-info-item">👨‍🏫 ${schedule.coach_name}</div>
                    <div class="schedule-info-item">📅 ${schedule.date}</div>
                    <div class="schedule-info-item">⏰ ${schedule.start_time} - ${schedule.end_time}</div>
                </div>
                <div class="capacity-bar">
                    <div class="capacity-fill" style="width: ${capacityPercent}%"></div>
                </div>
                <div class="capacity-text">
                    <span>已预约: ${schedule.booked_count}</span>
                    <span>容量: ${schedule.capacity}</span>
                </div>
                <div class="actions" style="margin-top: 15px;">
                    <button class="btn btn-sm btn-secondary" onclick="viewScheduleBookings(${schedule.id}, '${schedule.course_name}', '${schedule.date}')">查看预约</button>
                    ${!isFull ? `<button class="btn btn-sm btn-primary" onclick="quickBooking(${schedule.id})">快速预约</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderBookings() {
    const tbody = document.getElementById('bookings-table');
    
    tbody.innerHTML = state.bookings.map(booking => `
        <tr>
            <td>${booking.id}</td>
            <td>${booking.member_name}</td>
            <td>${booking.course_name}</td>
            <td>${booking.coach_name}</td>
            <td>${booking.date}</td>
            <td>${booking.start_time} - ${booking.end_time}</td>
            <td><span class="badge badge-${booking.status}">${getBookingStatusText(booking.status)}</span></td>
            <td>${booking.is_no_show ? '<span class="badge badge-no-show">是</span>' : '<span style="color: #666;">否</span>'}</td>
            <td>
                <div class="actions">
                    ${booking.status === 'booked' ? `
                        <button class="btn btn-sm btn-danger" onclick="cancelBooking(${booking.id})">取消预约</button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');
}

function getStatusText(status) {
    const texts = {
        active: '正常',
        frozen: '冻结',
        arrears: '欠费'
    };
    return texts[status] || status;
}

function getBookingStatusText(status) {
    const texts = {
        booked: '已预约',
        canceled: '已取消'
    };
    return texts[status] || status;
}

async function viewMemberDetail(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;
    
    state.currentMember = member;
    
    document.getElementById('member-detail-title').textContent = `${member.name} 的详情`;
    
    const history = await apiRequest(`/members/${memberId}/history`);
    
    const content = `
        <div class="member-detail">
            <div class="member-stats">
                <div class="stat-card">
                    <div class="stat-value">${member.remaining_sessions}</div>
                    <div class="stat-label">剩余课时</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value"><span class="badge badge-${member.status}">${getStatusText(member.status)}</span></div>
                    <div class="stat-label">账户状态</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${history.filter(h => h.is_no_show).length}</div>
                    <div class="stat-label">爽约次数</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${history.length}</div>
                    <div class="stat-label">总预约次数</div>
                </div>
            </div>
        </div>
        
        <h4 style="margin-bottom: 15px;">最近预约记录</h4>
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>课程</th>
                        <th>教练</th>
                        <th>日期</th>
                        <th>时间</th>
                        <th>状态</th>
                        <th>爽约</th>
                    </tr>
                </thead>
                <tbody>
                    ${history.slice(0, 10).map(h => `
                        <tr>
                            <td>${h.course_name}</td>
                            <td>${h.coach_name}</td>
                            <td>${h.date}</td>
                            <td>${h.start_time} - ${h.end_time}</td>
                            <td><span class="badge badge-${h.status}">${getBookingStatusText(h.status)}</span></td>
                            <td>${h.is_no_show ? '是' : '否'}</td>
                        </tr>
                    `).join('') || '<tr><td colspan="6" style="text-align: center;">暂无记录</td></tr>'}
                </tbody>
            </table>
        </div>
        
        <div style="margin-top: 20px;">
            <button class="btn btn-secondary" onclick="exportMemberHistory(${memberId})">导出该会员历史记录</button>
        </div>
    `;
    
    document.getElementById('member-detail-content').innerHTML = content;
    document.getElementById('member-detail-section').classList.remove('hidden');
}

function closeMemberDetail() {
    document.getElementById('member-detail-section').classList.add('hidden');
    state.currentMember = null;
}

function exportMemberHistory(memberId) {
    window.open(`${API_BASE}/export/member-history/${memberId}`, '_blank');
}

async function viewScheduleBookings(scheduleId, courseName, date) {
    document.getElementById('schedule-bookings-title').textContent = `${courseName} - ${date} 预约名单`;
    
    const bookings = await apiRequest(`/schedules/${scheduleId}/bookings`);
    
    const list = document.getElementById('schedule-bookings-list');
    
    if (bookings.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">暂无预约</p>';
    } else {
        list.innerHTML = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>序号</th>
                            <th>会员姓名</th>
                            <th>电话</th>
                            <th>预约时间</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bookings.map((b, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${b.member_name}</td>
                                <td>${b.member_phone}</td>
                                <td>${b.booked_at}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    openModal('schedule-bookings-modal');
}

function quickBooking(scheduleId) {
    showAddBookingModal(scheduleId);
}

function showAddMemberModal() {
    document.getElementById('member-modal-title').textContent = '添加会员';
    document.getElementById('member-form').reset();
    document.getElementById('member-id').value = '';
    document.getElementById('member-sessions').value = '0';
    document.getElementById('member-status').value = 'active';
    openModal('member-modal');
}

function editMember(id) {
    const member = state.members.find(m => m.id === id);
    if (!member) return;
    
    document.getElementById('member-modal-title').textContent = '编辑会员';
    document.getElementById('member-id').value = member.id;
    document.getElementById('member-name').value = member.name;
    document.getElementById('member-phone').value = member.phone;
    document.getElementById('member-email').value = member.email || '';
    document.getElementById('member-sessions').value = member.remaining_sessions;
    document.getElementById('member-status').value = member.status;
    openModal('member-modal');
}

async function handleMemberSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('member-id').value;
    const memberData = {
        name: document.getElementById('member-name').value.trim(),
        phone: document.getElementById('member-phone').value.trim(),
        email: document.getElementById('member-email').value.trim() || null,
        remaining_sessions: parseInt(document.getElementById('member-sessions').value) || 0,
        status: document.getElementById('member-status').value
    };
    
    try {
        if (id) {
            await apiRequest(`/members/${id}`, {
                method: 'PUT',
                body: JSON.stringify(memberData)
            });
            showToast('会员更新成功', 'success');
        } else {
            await apiRequest('/members', {
                method: 'POST',
                body: JSON.stringify(memberData)
            });
            showToast('会员添加成功', 'success');
        }
        
        closeModal('member-modal');
        await loadMembers();
    } catch (error) {
        console.error('保存会员失败:', error);
    }
}

function showAddCourseModal() {
    document.getElementById('course-modal-title').textContent = '添加课程';
    document.getElementById('course-form').reset();
    document.getElementById('course-id').value = '';
    document.getElementById('course-duration').value = '60';
    openModal('course-modal');
}

function editCourse(id) {
    const course = state.courses.find(c => c.id === id);
    if (!course) return;
    
    document.getElementById('course-modal-title').textContent = '编辑课程';
    document.getElementById('course-id').value = course.id;
    document.getElementById('course-name').value = course.name;
    document.getElementById('course-description').value = course.description || '';
    document.getElementById('course-duration').value = course.duration;
    openModal('course-modal');
}

async function handleCourseSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('course-id').value;
    const courseData = {
        name: document.getElementById('course-name').value.trim(),
        description: document.getElementById('course-description').value.trim() || null,
        duration: parseInt(document.getElementById('course-duration').value) || 60
    };
    
    try {
        if (id) {
            await apiRequest(`/courses/${id}`, {
                method: 'PUT',
                body: JSON.stringify(courseData)
            });
            showToast('课程更新成功', 'success');
        } else {
            await apiRequest('/courses', {
                method: 'POST',
                body: JSON.stringify(courseData)
            });
            showToast('课程添加成功', 'success');
        }
        
        closeModal('course-modal');
        await loadCourses();
    } catch (error) {
        console.error('保存课程失败:', error);
    }
}

async function deleteCourse(id) {
    if (!confirm('确定要删除这个课程吗？')) return;
    
    try {
        await apiRequest(`/courses/${id}`, { method: 'DELETE' });
        showToast('课程删除成功', 'success');
        await loadCourses();
    } catch (error) {
        console.error('删除课程失败:', error);
    }
}

function showAddCoachModal() {
    document.getElementById('coach-modal-title').textContent = '添加教练';
    document.getElementById('coach-form').reset();
    document.getElementById('coach-id').value = '';
    openModal('coach-modal');
}

function editCoach(id) {
    const coach = state.coaches.find(c => c.id === id);
    if (!coach) return;
    
    document.getElementById('coach-modal-title').textContent = '编辑教练';
    document.getElementById('coach-id').value = coach.id;
    document.getElementById('coach-name').value = coach.name;
    document.getElementById('coach-phone').value = coach.phone || '';
    openModal('coach-modal');
}

async function handleCoachSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('coach-id').value;
    const coachData = {
        name: document.getElementById('coach-name').value.trim(),
        phone: document.getElementById('coach-phone').value.trim() || null
    };
    
    try {
        if (id) {
            await apiRequest(`/coaches/${id}`, {
                method: 'PUT',
                body: JSON.stringify(coachData)
            });
            showToast('教练更新成功', 'success');
        } else {
            await apiRequest('/coaches', {
                method: 'POST',
                body: JSON.stringify(coachData)
            });
            showToast('教练添加成功', 'success');
        }
        
        closeModal('coach-modal');
        await loadCoaches();
    } catch (error) {
        console.error('保存教练失败:', error);
    }
}

async function deleteCoach(id) {
    if (!confirm('确定要删除这个教练吗？')) return;
    
    try {
        await apiRequest(`/coaches/${id}`, { method: 'DELETE' });
        showToast('教练删除成功', 'success');
        await loadCoaches();
    } catch (error) {
        console.error('删除教练失败:', error);
    }
}

async function showAddScheduleModal() {
    await loadCourses();
    await loadCoaches();
    
    const courseSelect = document.getElementById('schedule-course');
    const coachSelect = document.getElementById('schedule-coach');
    
    courseSelect.innerHTML = '<option value="">请选择课程</option>' + 
        state.courses.map(c => `<option value="${c.id}">${c.name} (${c.duration}分钟)</option>`).join('');
    
    coachSelect.innerHTML = '<option value="">请选择教练</option>' + 
        state.coaches.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    document.getElementById('schedule-modal-title').textContent = '添加排班';
    document.getElementById('schedule-form').reset();
    document.getElementById('schedule-id').value = '';
    document.getElementById('schedule-capacity').value = '10';
    document.getElementById('schedule-date-form').value = new Date().toISOString().split('T')[0];
    
    openModal('schedule-modal');
}

async function handleScheduleSubmit(e) {
    e.preventDefault();
    
    const scheduleData = {
        course_id: parseInt(document.getElementById('schedule-course').value),
        coach_id: parseInt(document.getElementById('schedule-coach').value),
        date: document.getElementById('schedule-date-form').value,
        start_time: document.getElementById('schedule-start-time').value,
        end_time: document.getElementById('schedule-end-time').value,
        capacity: parseInt(document.getElementById('schedule-capacity').value) || 10
    };
    
    try {
        await apiRequest('/schedules', {
            method: 'POST',
            body: JSON.stringify(scheduleData)
        });
        
        showToast('排班添加成功', 'success');
        closeModal('schedule-modal');
        await loadSchedules();
    } catch (error) {
        console.error('保存排班失败:', error);
    }
}

async function showAddBookingModal(preselectScheduleId = null) {
    await loadMembers();
    await loadSchedules();
    
    const memberSelect = document.getElementById('booking-member');
    const scheduleSelect = document.getElementById('booking-schedule');
    
    const activeMembers = state.members.filter(m => m.status === 'active' && m.remaining_sessions > 0);
    
    memberSelect.innerHTML = '<option value="">请选择会员</option>' + 
        activeMembers.map(m => `<option value="${m.id}">${m.name} (剩余${m.remaining_sessions}课时)</option>`).join('');
    
    const availableSchedules = state.schedules.filter(s => s.booked_count < s.capacity);
    
    scheduleSelect.innerHTML = '<option value="">请选择课程安排</option>' + 
        availableSchedules.map(s => `<option value="${s.id}">${s.date} ${s.start_time}-${s.end_time} ${s.course_name} (${s.coach_name})</option>`).join('');
    
    if (preselectScheduleId) {
        scheduleSelect.value = preselectScheduleId;
    }
    
    document.getElementById('booking-info').classList.add('hidden');
    document.getElementById('booking-form').reset();
    
    openModal('booking-modal');
}

async function loadMembersForFilter() {
    await loadMembers();
    
    const memberSelect = document.getElementById('booking-filter-member');
    if (memberSelect) {
        const currentValue = memberSelect.value;
        memberSelect.innerHTML = '<option value="">全部会员</option>' + 
            state.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('');
        memberSelect.value = currentValue;
    }
}

async function handleBookingSubmit(e) {
    e.preventDefault();
    
    const bookingData = {
        member_id: parseInt(document.getElementById('booking-member').value),
        schedule_id: parseInt(document.getElementById('booking-schedule').value)
    };
    
    try {
        const result = await apiRequest('/bookings', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });
        
        showToast('预约成功，已扣减1课时', 'success');
        closeModal('booking-modal');
        await Promise.all([
            loadBookings(),
            loadSchedules(),
            loadMembers()
        ]);
    } catch (error) {
        console.error('创建预约失败:', error);
    }
}

async function cancelBooking(id) {
    const booking = state.bookings.find(b => b.id === id);
    if (!booking) return;
    
    const scheduleDate = new Date(`${booking.date}T${booking.start_time}`);
    const now = new Date();
    const hoursBefore = (scheduleDate - now) / (1000 * 60 * 60);
    
    let message = `确定要取消 ${booking.member_name} 的 ${booking.course_name} 预约吗？`;
    if (hoursBefore < 2) {
        message += `\n\n⚠️ 注意：距离开课不足2小时，取消将记为爽约并扣课（不返还课时）。`;
    } else {
        message += `\n\n✅ 距离开课超过2小时，取消后课时将返还。`;
    }
    
    if (!confirm(message)) return;
    
    try {
        const result = await apiRequest(`/bookings/${id}/cancel`, {
            method: 'POST'
        });
        
        showToast(result.message, result.is_no_show ? 'error' : 'success');
        await Promise.all([
            loadBookings(),
            loadSchedules(),
            loadMembers()
        ]);
    } catch (error) {
        console.error('取消预约失败:', error);
    }
}

function exportTodayBookings() {
    const date = document.getElementById('export-date').value;
    const url = date ? 
        `${API_BASE}/export/today-bookings?date=${date}` : 
        `${API_BASE}/export/today-bookings`;
    window.open(url, '_blank');
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `alert alert-${type === 'success' ? 'success' : 'error'}`;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});
