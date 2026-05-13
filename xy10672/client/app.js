const API_BASE = 'http://localhost:5000/api';

let flightsData = [];
let driversData = [];
let tripsData = [];
let feesData = [];
let reassignsData = [];
let reviewsData = [];
let historyData = [];

async function fetchData(endpoint) {
    try {
        const response = await fetch(`${API_BASE}/${endpoint}`);
        const result = await response.json();
        return result.success ? result.data : [];
    } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        return [];
    }
}

async function postData(endpoint, data) {
    try {
        const response = await fetch(`${API_BASE}/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await response.json();
    } catch (error) {
        console.error(`Error posting to ${endpoint}:`, error);
        return { success: false, message: '请求失败' };
    }
}

function getStatusBadge(status) {
    const badges = {
        'delayed': '<span class="badge badge-delayed">延误</span>',
        'on_time': '<span class="badge badge-on-time">准点</span>',
        'cancelled': '<span class="badge badge-cancelled">取消</span>',
        'pending': '<span class="badge badge-pending">待处理</span>',
        'arrived': '<span class="badge badge-arrived">已到达</span>',
        'available': '<span class="badge badge-on-time">可用</span>',
        'on_trip': '<span class="badge badge-pending">执行中</span>',
        'offline': '<span class="badge badge-cancelled">离线</span>',
        'completed': '<span class="badge badge-on-time">已完成</span>'
    };
    return badges[status] || status;
}

function renderFlights(data) {
    const tbody = document.getElementById('flightsTable');
    tbody.innerHTML = data.map(f => `
        <tr>
            <td><strong>${f.flightNo}</strong></td>
            <td>${f.airline}</td>
            <td>${f.departure} → ${f.arrival}</td>
            <td>${f.scheduledTime || '-'}</td>
            <td>${f.actualTime || '-'}</td>
            <td>${getStatusBadge(f.status)}</td>
            <td>${f.gate || '-'}</td>
            <td>${f.updateTime || '-'}</td>
        </tr>
    `).join('');
}

function renderDrivers(data) {
    const tbody = document.getElementById('driversTable');
    tbody.innerHTML = data.map(d => `
        <tr>
            <td><strong>${d.name}</strong></td>
            <td>${d.phone}</td>
            <td>${d.vehiclePlate}</td>
            <td>${d.vehicleModel}</td>
            <td>${getStatusBadge(d.status)}</td>
            <td>⭐ ${d.rating}</td>
        </tr>
    `).join('');
}

function renderTrips(data) {
    const tbody = document.getElementById('tripsTable');
    const driverMap = {};
    driversData.forEach(d => driverMap[d.id] = d.name);
    
    tbody.innerHTML = data.map(t => `
        <tr>
            <td><strong>${t.orderNo}</strong></td>
            <td>${t.customerName}</td>
            <td>${t.flightNo}</td>
            <td>${driverMap[t.driverId] || t.driverId}</td>
            <td>${t.pickupAddress}</td>
            <td>${t.dropoffAddress}</td>
            <td>${t.scheduledTime || '-'}</td>
            <td>${getStatusBadge(t.status)}</td>
        </tr>
    `).join('');
}

function renderFees(data) {
    const tbody = document.getElementById('feesTable');
    tbody.innerHTML = data.map(f => `
        <tr>
            <td><strong>${f.orderNo}</strong></td>
            <td>${f.arriveTime}</td>
            <td>${f.pickupTime}</td>
            <td>${f.waitingMinutes}</td>
            <td>${f.freeMinutes}</td>
            <td>${f.chargeMinutes}</td>
            <td><strong class="text-danger">¥${f.amount}</strong></td>
            <td>${f.handler}</td>
        </tr>
    `).join('');
}

function renderReassigns(data) {
    const tbody = document.getElementById('reassignsTable');
    tbody.innerHTML = data.map(r => `
        <tr>
            <td><strong>${r.orderNo}</strong></td>
            <td class="old-value">${r.oldDriverName}</td>
            <td class="new-value">${r.newDriverName}</td>
            <td>${r.reason}</td>
            <td>${r.handler}</td>
            <td>${r.createTime}</td>
        </tr>
    `).join('');
}

function renderReviews(data) {
    const tbody = document.getElementById('reviewsTable');
    const stars = (rating) => '⭐'.repeat(Math.floor(rating));
    tbody.innerHTML = data.map(r => `
        <tr>
            <td><strong>${r.orderNo}</strong></td>
            <td>${r.customerName}</td>
            <td>${r.driverName}</td>
            <td>${stars(r.rating)} ${r.rating}</td>
            <td><small>${r.comment}</small></td>
            <td>${r.createTime}</td>
        </tr>
    `).join('');
}

function renderHistory(data) {
    const tbody = document.getElementById('historyTable');
    const typeMap = {
        'flight_update': '✈️ 航班更新',
        'trip_update': '📋 行程更新',
        'waiting_fee': '⏱️ 等待计费',
        'reassign': '🔄 改签重派'
    };
    tbody.innerHTML = data.map(h => `
        <tr>
            <td>${typeMap[h.type] || h.type}</td>
            <td><code>${h.field}</code></td>
            <td class="old-value history-diff">${h.oldValue || '-'}</td>
            <td class="new-value history-diff">${h.newValue || '-'}</td>
            <td>${h.handler}</td>
            <td>${h.handleTime}</td>
            <td><small>${h.remark}</small></td>
        </tr>
    `).join('');
}

function renderSelectOptions(elementId, data, valueField, textField) {
    const select = document.getElementById(elementId);
    select.innerHTML = data.map(item => 
        `<option value="${item[valueField]}">${item[textField]}</option>`
    ).join('');
}

function updateStats(stats) {
    document.getElementById('totalTrips').textContent = stats.totalTrips;
    document.getElementById('pendingTrips').textContent = stats.pendingTrips;
    document.getElementById('completedTrips').textContent = stats.completedTrips;
    document.getElementById('reassignedTrips').textContent = stats.reassignedTrips;
    document.getElementById('totalWaitingFees').textContent = stats.totalWaitingFees;
    document.getElementById('averageRating').textContent = stats.averageRating;
}

async function loadAllData() {
    const [flights, drivers, trips, fees, reassigns, reviews, history, stats] = await Promise.all([
        fetchData('flights'),
        fetchData('drivers'),
        fetchData('trips'),
        fetchData('waiting-fees'),
        fetchData('reassigns'),
        fetchData('reviews'),
        fetchData('history'),
        fetchData('statistics')
    ]);

    flightsData = flights;
    driversData = drivers;
    tripsData = trips;
    feesData = fees;
    reassignsData = reassigns;
    reviewsData = reviews;
    historyData = history;

    renderFlights(flights);
    renderDrivers(drivers);
    renderTrips(trips);
    renderFees(fees);
    renderReassigns(reassigns);
    renderReviews(reviews);
    renderHistory(history);
    updateStats(stats);

    renderSelectOptions('validateTripId', trips, 'id', 'orderNo');
    renderSelectOptions('feeTripId', trips, 'id', 'orderNo');
    renderSelectOptions('reassignTripId', trips, 'id', 'orderNo');
    renderSelectOptions('validateDriverId', drivers, 'id', 'name');
    renderSelectOptions('oldDriverId', drivers, 'id', 'name');
    renderSelectOptions('newDriverId', drivers, 'id', 'name');

    document.getElementById('validateDriverId').addEventListener('change', function() {
        const driver = drivers.find(d => d.id === this.value);
        document.getElementById('validateVehicleId').value = driver ? driver.vehicleId : '';
    });

    document.getElementById('reassignTripId').addEventListener('change', function() {
        const trip = trips.find(t => t.id === this.value);
        if (trip) {
            document.getElementById('oldDriverId').value = trip.driverId;
        }
    });

    if (drivers.length > 0) {
        document.getElementById('validateVehicleId').value = drivers[0].vehicleId;
    }
    if (trips.length > 0) {
        document.getElementById('oldDriverId').value = trips[0].driverId;
    }
}

function filterData() {
    const flightNo = document.getElementById('searchFlightNo').value.toLowerCase();
    const customer = document.getElementById('searchCustomer').value.toLowerCase();
    const status = document.getElementById('searchStatus').value;

    const filteredFlights = flightsData.filter(f => 
        (!flightNo || f.flightNo.toLowerCase().includes(flightNo)) &&
        (!status || f.status === status)
    );

    const filteredDrivers = driversData.filter(d => 
        (!status || d.status === status)
    );

    const filteredTrips = tripsData.filter(t => 
        (!customer || t.customerName.toLowerCase().includes(customer)) &&
        (!flightNo || t.flightNo.toLowerCase().includes(flightNo)) &&
        (!status || t.status === status)
    );

    renderFlights(filteredFlights);
    renderDrivers(filteredDrivers);
    renderTrips(filteredTrips);
}

function filterHistory() {
    const handler = document.getElementById('searchHandler').value.toLowerCase();
    const startTime = document.getElementById('searchStartTime').value;
    const endTime = document.getElementById('searchEndTime').value;

    const filtered = historyData.filter(h => {
        const matchHandler = !handler || h.handler.toLowerCase().includes(handler);
        const matchStart = !startTime || new Date(h.handleTime) >= new Date(startTime);
        const matchEnd = !endTime || new Date(h.handleTime) <= new Date(endTime + ' 23:59:59');
        return matchHandler && matchStart && matchEnd;
    });

    renderHistory(filtered);
}

async function refreshData() {
    await loadAllData();
    showResult('validateResult', '数据已刷新', 'success');
}

function showResult(elementId, message, type) {
    const element = document.getElementById(elementId);
    const bgClass = type === 'success' ? 'text-success' : type === 'error' ? 'text-danger' : 'text-info';
    element.innerHTML = `<span class="${bgClass}">${message}</span>`;
}

async function validateDriverVehicle() {
    const tripId = document.getElementById('validateTripId').value;
    const driverId = document.getElementById('validateDriverId').value;
    const vehicleId = document.getElementById('validateVehicleId').value;

    const result = await postData('validate-driver-vehicle', { tripId, driverId, vehicleId });
    
    if (result.success) {
        showResult('validateResult', 
            `✅ ${result.message}<br>司机: ${result.data.driver.name}<br>车辆: ${result.data.vehicle.model}`, 
            'success');
    } else {
        showResult('validateResult', `❌ ${result.message}`, 'error');
    }
}

async function calculateWaitingFee() {
    const tripId = document.getElementById('feeTripId').value;
    const arriveTime = document.getElementById('arriveTime').value.replace('T', ' ') + ':00';
    const pickupTime = document.getElementById('pickupTime').value.replace('T', ' ') + ':00';
    const handler = document.getElementById('feeHandler').value;

    const result = await postData('calculate-waiting-fee', { tripId, arriveTime, pickupTime, handler });
    
    if (result.success) {
        showResult('feeResult', 
            `✅ ${result.message}<br>等待: ${result.data.waitingMinutes}分钟<br>费用: ¥${result.data.amount}`, 
            'success');
        await loadAllData();
    } else {
        showResult('feeResult', `❌ ${result.message}`, 'error');
    }
}

async function saveReassign() {
    const tripId = document.getElementById('reassignTripId').value;
    const oldDriverId = document.getElementById('oldDriverId').value;
    const newDriverId = document.getElementById('newDriverId').value;
    const reason = document.getElementById('reassignReason').value;
    const handler = document.getElementById('reassignHandler').value;

    const result = await postData('save-reassign', { tripId, oldDriverId, newDriverId, reason, handler });
    
    if (result.success) {
        showResult('reassignResult', 
            `✅ ${result.message}<br>${result.data.oldDriverName} → ${result.data.newDriverName}`, 
            'success');
        await loadAllData();
    } else {
        showResult('reassignResult', `❌ ${result.message}`, 'error');
    }
}

async function exportReport() {
    const handler = document.getElementById('searchHandler').value;
    const startTime = document.getElementById('searchStartTime').value;
    const endTime = document.getElementById('searchEndTime').value;

    const params = new URLSearchParams();
    if (handler) params.append('handler', handler);
    if (startTime) params.append('startTime', startTime);
    if (endTime) params.append('endTime', endTime);

    const url = `${API_BASE}/export-report?${params.toString()}`;
    
    try {
        const response = await fetch(url);
        const result = await response.json();
        
        if (result.success) {
            const report = result.data;
            const csvContent = [
                ['操作类型', '修改字段', '原值', '新值', '操作人', '操作时间', '备注'],
                ...report.data.map(h => [h.type, h.field, h.oldValue, h.newValue, h.handler, h.handleTime, h.remark])
            ].map(row => row.join(',')).join('\n');

            const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `改派报告_${new Date().toISOString().slice(0,10)}.csv`;
            link.click();
            
            showResult('reassignResult', `✅ 报告已导出，共 ${report.data.length} 条记录`, 'success');
        }
    } catch (error) {
        showResult('reassignResult', `❌ 导出失败: ${error.message}`, 'error');
    }
}

document.addEventListener('DOMContentLoaded', loadAllData);
