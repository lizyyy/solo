import os
import csv
from flask import Flask, request, jsonify, render_template_string, send_file
from flask_cors import CORS
from datetime import datetime
import io

from data_importer import (
    import_students_csv, import_swipe_jsonl, 
    import_routes_yaml, import_teacher_notes_csv
)
from database import (
    save_students, save_swipe_records, save_routes, save_teacher_notes,
    get_issues, get_trip_status, mark_issue_handled,
    get_available_dates, get_available_vehicles, get_student_by_id,
    get_all_students, get_all_routes
)
from trip_processor import process_all_trips, get_date_from_timestamp


app = Flask(__name__)
CORS(app)


DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)


@app.route('/')
def index():
    return render_template_string('''
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>幼儿园校车晨检复核系统</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; min-height: 100vh; }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 28px; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 16px; }
        .card { background: white; border-radius: 12px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
        .card h2 { font-size: 18px; color: #333; margin-bottom: 16px; border-bottom: 2px solid #667eea; padding-bottom: 8px; }
        .filters { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; }
        .filter-group { display: flex; flex-direction: column; gap: 6px; }
        .filter-group label { font-size: 13px; color: #666; font-weight: 500; }
        .filter-group select, .filter-group input { padding: 10px 12px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; min-width: 180px; }
        .btn { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
        .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
        .btn-success { background: #10b981; color: white; }
        .btn-success:hover { background: #059669; }
        .btn-warning { background: #f59e0b; color: white; }
        .btn-warning:hover { background: #d97706; }
        .btn-secondary { background: #6b7280; color: white; }
        .btn-secondary:hover { background: #4b5563; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .stat-card { background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); border-radius: 10px; padding: 20px; text-align: center; }
        .stat-card .number { font-size: 32px; font-weight: 700; color: #667eea; }
        .stat-card .label { font-size: 14px; color: #64748b; margin-top: 4px; }
        .stat-card.danger .number { color: #ef4444; }
        .stat-card.warning .number { color: #f59e0b; }
        .stat-card.success .number { color: #10b981; }
        .table-wrapper { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e2e8f0; }
        th { background: #f8fafc; font-weight: 600; color: #475569; font-size: 13px; }
        td { font-size: 14px; color: #334155; }
        tr:hover { background: #f8fafc; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .badge-danger { background: #fef2f2; color: #dc2626; }
        .badge-warning { background: #fffbeb; color: #d97706; }
        .badge-info { background: #eff6ff; color: #2563eb; }
        .badge-success { background: #ecfdf5; color: #059669; }
        .upload-section { border: 2px dashed #cbd5e1; border-radius: 12px; padding: 40px; text-align: center; background: #f8fafc; transition: all 0.2s; }
        .upload-section:hover { border-color: #667eea; background: #f1f5ff; }
        .upload-section input { display: none; }
        .upload-section label { cursor: pointer; color: #667eea; font-weight: 500; }
        .file-list { margin-top: 20px; text-align: left; }
        .file-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; background: white; border-radius: 8px; margin-bottom: 8px; }
        .action-buttons { display: flex; gap: 8px; }
        .tabs { display: flex; gap: 4px; background: #f1f5f9; padding: 4px; border-radius: 10px; margin-bottom: 20px; }
        .tab { padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: 500; color: #64748b; transition: all 0.2s; }
        .tab.active { background: white; color: #334155; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .tab:hover:not(.active) { background: #e2e8f0; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .loading { text-align: center; padding: 40px; color: #64748b; }
        .empty-state { text-align: center; padding: 60px 20px; color: #64748b; }
        .empty-state h3 { font-size: 18px; margin-bottom: 8px; color: #475569; }
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; align-items: center; justify-content: center; }
        .modal.active { display: flex; }
        .modal-content { background: white; border-radius: 12px; padding: 30px; max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; }
        .modal-content h3 { font-size: 20px; margin-bottom: 20px; color: #334155; }
        .modal-content p { margin-bottom: 12px; color: #64748b; line-height: 1.6; }
        .modal-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
        .detail-row { display: flex; margin-bottom: 12px; }
        .detail-label { width: 100px; font-weight: 500; color: #64748b; }
        .detail-value { color: #334155; }
        .refresh-btn { display: inline-flex; align-items: center; gap: 6px; }
        .btn-group { display: flex; gap: 8px; flex-wrap: wrap; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚌 幼儿园校车晨检复核系统</h1>
            <p>学生上下车状态监控与异常检测</p>
        </div>

        <div class="card">
            <div class="tabs" id="mainTabs">
                <div class="tab active" data-tab="dashboard">仪表盘</div>
                <div class="tab" data-tab="import">数据导入</div>
                <div class="tab" data-tab="issues">异常记录</div>
                <div class="tab" data-tab="trips">行程状态</div>
                <div class="tab" data-tab="export">数据导出</div>
            </div>

            <div class="tab-content active" id="dashboard">
                <div class="stats-grid" id="statsGrid">
                    <div class="stat-card">
                        <div class="number" id="totalStudents">-</div>
                        <div class="label">学生总数</div>
                    </div>
                    <div class="stat-card">
                        <div class="number" id="totalTrips">-</div>
                        <div class="label">总行程数</div>
                    </div>
                    <div class="stat-card danger">
                        <div class="number" id="totalIssues">-</div>
                        <div class="label">待处理异常</div>
                    </div>
                    <div class="stat-card success">
                        <div class="number" id="handledIssues">-</div>
                        <div class="label">已处理问题</div>
                    </div>
                </div>
                <div style="margin-top: 20px; display: flex; gap: 12px;">
                    <button class="btn btn-primary refresh-btn" onclick="loadData()">
                        <span>🔄</span> 刷新数据
                    </button>
                    <button class="btn btn-warning" onclick="processTrips()">
                        重新处理行程
                    </button>
                </div>
            </div>

            <div class="tab-content" id="import">
                <div class="upload-section">
                    <p>📁 上传数据文件（支持批量选择）</p>
                    <p style="margin-top: 10px; font-size: 13px; color: #64748b;">
                        支持格式：students.csv、swipe_records.jsonl、routes.yaml、teacher_notes.csv
                    </p>
                    <input type="file" id="fileInput" multiple accept=".csv,.jsonl,.yaml,.yml">
                    <p style="margin-top: 16px;"><label for="fileInput" class="btn btn-primary">选择文件</label></p>
                </div>
                <div class="file-list" id="fileList"></div>
                <div style="margin-top: 20px; display: flex; gap: 12px;">
                    <button class="btn btn-success" onclick="uploadFiles()" id="uploadBtn" disabled>导入数据</button>
                    <button class="btn btn-secondary" onclick="loadSampleData()">加载示例数据</button>
                </div>
            </div>

            <div class="tab-content" id="issues">
                <div class="filters" style="margin-bottom: 20px;">
                    <div class="filter-group">
                        <label>日期</label>
                        <select id="issueDateFilter" onchange="loadIssues()">
                            <option value="">全部日期</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>车辆</label>
                        <select id="issueVehicleFilter" onchange="loadIssues()">
                            <option value="">全部车辆</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>状态</label>
                        <select id="issueStatusFilter" onchange="loadIssues()">
                            <option value="">全部状态</option>
                            <option value="pending">待处理</option>
                            <option value="handled">已处理</option>
                        </select>
                    </div>
                    <div style="display: flex; align-items: flex-end;">
                        <button class="btn btn-primary refresh-btn" onclick="loadIssues()">
                            <span>🔍</span> 筛选
                        </button>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>学生</th>
                                <th>异常类型</th>
                                <th>描述</th>
                                <th>日期</th>
                                <th>车辆/线路</th>
                                <th>状态</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody id="issuesTable">
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="tab-content" id="trips">
                <div class="filters" style="margin-bottom: 20px;">
                    <div class="filter-group">
                        <label>日期</label>
                        <select id="tripDateFilter" onchange="loadTrips()">
                            <option value="">全部日期</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>车辆</label>
                        <select id="tripVehicleFilter" onchange="loadTrips()">
                            <option value="">全部车辆</option>
                        </select>
                    </div>
                    <div style="display: flex; align-items: flex-end;">
                        <button class="btn btn-primary refresh-btn" onclick="loadTrips()">
                            <span>🔍</span> 筛选
                        </button>
                    </div>
                </div>
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>学生</th>
                                <th>日期</th>
                                <th>车辆/线路</th>
                                <th>状态</th>
                                <th>上车时间</th>
                                <th>下车时间</th>
                            </tr>
                        </thead>
                        <tbody id="tripsTable">
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="tab-content" id="export">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
                    <div class="card" style="margin-bottom: 0;">
                        <h3>📋 导出异常记录 (issues.csv)</h3>
                        <p style="color: #64748b; margin-bottom: 16px; font-size: 14px;">
                            导出所有异常记录，包含学生信息、异常类型、状态等
                        </p>
                        <button class="btn btn-primary" onclick="exportIssues()">导出 issues.csv</button>
                    </div>
                    <div class="card" style="margin-bottom: 0;">
                        <h3>📝 导出交接报告 (handover_report.md)</h3>
                        <p style="color: #64748b; margin-bottom: 16px; font-size: 14px;">
                            生成Markdown格式的交接报告，包含统计汇总和详细异常
                        </p>
                        <button class="btn btn-success" onclick="exportReport()">导出 handover_report.md</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal" id="detailModal">
        <div class="modal-content">
            <h3 id="modalTitle">详情</h3>
            <div id="modalBody"></div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="closeModal()">关闭</button>
                <button class="btn btn-success" id="handleBtn" style="display: none;">标记已处理</button>
            </div>
        </div>
    </div>

    <script>
        let selectedFiles = [];
        let currentIssueId = null;

        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', function() {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                this.classList.add('active');
                document.getElementById(this.dataset.tab + 'Tab').classList.add('active');
                
                if (this.dataset.tab === 'issues') loadFilters().then(loadIssues);
                if (this.dataset.tab === 'trips') loadFilters().then(loadTrips);
            });
        });

        document.getElementById('fileInput').addEventListener('change', function(e) {
            selectedFiles = Array.from(e.target.files);
            updateFileList();
        });

        function updateFileList() {
            const list = document.getElementById('fileList');
            const btn = document.getElementById('uploadBtn');
            if (selectedFiles.length === 0) {
                list.innerHTML = '';
                btn.disabled = true;
                return;
            }
            list.innerHTML = selectedFiles.map((f, i) => `
                <div class="file-item">
                    <span>${f.name} (${(f.size/1024).toFixed(1)} KB)</span>
                    <button class="btn btn-secondary" style="padding: 4px 12px; font-size: 12px;" onclick="removeFile(${i})">移除</button>
                </div>
            `).join('');
            btn.disabled = false;
        }

        function removeFile(index) {
            selectedFiles.splice(index, 1);
            updateFileList();
        }

        async function uploadFiles() {
            if (selectedFiles.length === 0) return;
            
            for (const file of selectedFiles) {
                const formData = new FormData();
                formData.append('file', file);
                
                try {
                    const response = await fetch('/api/import', {
                        method: 'POST',
                        body: formData
                    });
                    const result = await response.json();
                    console.log('Upload result:', result);
                } catch (err) {
                    alert('上传失败: ' + err.message);
                    return;
                }
            }
            
            alert('数据导入成功！');
            selectedFiles = [];
            updateFileList();
            await processTrips();
        }

        async function loadSampleData() {
            try {
                const response = await fetch('/api/load-sample', { method: 'POST' });
                const result = await response.json();
                alert('示例数据加载成功！共 ' + result.total + ' 条记录');
                await processTrips();
            } catch (err) {
                alert('加载失败: ' + err.message);
            }
        }

        async function processTrips() {
            try {
                const response = await fetch('/api/process', { method: 'POST' });
                const result = await response.json();
                alert('行程处理完成！发现 ' + result.total_issues + ' 个异常');
                loadData();
                loadFilters();
            } catch (err) {
                alert('处理失败: ' + err.message);
            }
        }

        async function loadData() {
            try {
                const [statsRes, datesRes, vehiclesRes] = await Promise.all([
                    fetch('/api/stats'),
                    fetch('/api/dates'),
                    fetch('/api/vehicles')
                ]);
                
                const stats = await statsRes.json();
                const dates = await datesRes.json();
                const vehicles = await vehiclesRes.json();
                
                document.getElementById('totalStudents').textContent = stats.total_students || 0;
                document.getElementById('totalTrips').textContent = stats.total_trips || 0;
                document.getElementById('totalIssues').textContent = stats.pending_issues || 0;
                document.getElementById('handledIssues').textContent = stats.handled_issues || 0;
                
                updateSelectOptions('issueDateFilter', dates);
                updateSelectOptions('tripDateFilter', dates);
                updateSelectOptions('issueVehicleFilter', vehicles);
                updateSelectOptions('tripVehicleFilter', vehicles);
            } catch (err) {
                console.error('Load data failed:', err);
            }
        }

        async function loadFilters() {
            try {
                const [datesRes, vehiclesRes] = await Promise.all([
                    fetch('/api/dates'),
                    fetch('/api/vehicles')
                ]);
                
                const dates = await datesRes.json();
                const vehicles = await vehiclesRes.json();
                
                updateSelectOptions('issueDateFilter', dates);
                updateSelectOptions('tripDateFilter', dates);
                updateSelectOptions('issueVehicleFilter', vehicles);
                updateSelectOptions('tripVehicleFilter', vehicles);
            } catch (err) {
                console.error('Load filters failed:', err);
            }
        }

        function updateSelectOptions(selectId, options) {
            const select = document.getElementById(selectId);
            const currentValue = select.value;
            select.innerHTML = '<option value="">全部</option>' + 
                options.map(o => `<option value="${o}">${o}</option>`).join('');
            if (options.includes(currentValue)) {
                select.value = currentValue;
            }
        }

        async function loadIssues() {
            const date = document.getElementById('issueDateFilter').value;
            const vehicle = document.getElementById('issueVehicleFilter').value;
            const status = document.getElementById('issueStatusFilter').value;
            
            let url = '/api/issues';
            const params = new URLSearchParams();
            if (date) params.append('date', date);
            if (vehicle) params.append('vehicle', vehicle);
            if (status === 'pending') params.append('handled', 'false');
            if (status === 'handled') params.append('handled', 'true');
            if (params.toString()) url += '?' + params.toString();
            
            try {
                const response = await fetch(url);
                const issues = await response.json();
                
                const tbody = document.getElementById('issuesTable');
                if (issues.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><h3>暂无异常记录</h3><p>系统中没有检测到异常情况</p></div></td></tr>';
                    return;
                }
                
                tbody.innerHTML = issues.map(issue => `
                    <tr>
                        <td>
                            <strong>${issue.student_name || '未知'}</strong><br>
                            <small style="color: #64748b;">ID: ${issue.student_id}</small>
                        </td>
                        <td>
                            <span class="badge ${getIssueBadgeClass(issue.issue_type)}">
                                ${issue.issue_type}
                            </span>
                        </td>
                        <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${issue.description || ''}">
                            ${issue.description || '-'}
                        </td>
                        <td>${issue.date || '-'}</td>
                        <td>
                            ${issue.vehicle_id || '-'}<br>
                            <small style="color: #64748b;">${issue.route_id || '-'}</small>
                        </td>
                        <td>
                            <span class="badge ${issue.is_handled ? 'badge-success' : 'badge-danger'}">
                                ${issue.is_handled ? '已处理' : '待处理'}
                            </span>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button class="btn btn-info" style="padding: 4px 10px; font-size: 12px;" onclick="viewIssue('${issue.issue_id}')">查看</button>
                                ${!issue.is_handled ? `<button class="btn btn-success" style="padding: 4px 10px; font-size: 12px;" onclick="handleIssue('${issue.issue_id}')">处理</button>` : ''}
                            </div>
                        </td>
                    </tr>
                `).join('');
            } catch (err) {
                console.error('Load issues failed:', err);
            }
        }

        async function loadTrips() {
            const date = document.getElementById('tripDateFilter').value;
            const vehicle = document.getElementById('tripVehicleFilter').value;
            
            let url = '/api/trips';
            const params = new URLSearchParams();
            if (date) params.append('date', date);
            if (vehicle) params.append('vehicle', vehicle);
            if (params.toString()) url += '?' + params.toString();
            
            try {
                const response = await fetch(url);
                const trips = await response.json();
                
                const tbody = document.getElementById('tripsTable');
                if (trips.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><h3>暂无行程记录</h3><p>请先导入数据并处理行程</p></div></td></tr>';
                    return;
                }
                
                tbody.innerHTML = trips.map(trip => `
                    <tr>
                        <td><strong>${trip.student_name || trip.student_id}</strong></td>
                        <td>${trip.date || '-'}</td>
                        <td>
                            ${trip.vehicle_id || '-'}<br>
                            <small style="color: #64748b;">${trip.route_id || '-'}</small>
                        </td>
                        <td>
                            <span class="badge ${trip.status === 'completed' ? 'badge-success' : 'badge-warning'}">
                                ${trip.status === 'completed' ? '已完成' : trip.status === 'boarding' ? '乘车中' : trip.status}
                            </span>
                        </td>
                        <td>${trip.boarded_at || '-'}</td>
                        <td>${trip.alighted_at || '-'}</td>
                    </tr>
                `).join('');
            } catch (err) {
                console.error('Load trips failed:', err);
            }
        }

        function getIssueBadgeClass(type) {
            if (type.includes('重复') || type.includes('未下车')) return 'badge-danger';
            if (type.includes('错线路') || type.includes('请假')) return 'badge-warning';
            return 'badge-info';
        }

        async function viewIssue(issueId) {
            try {
                const response = await fetch(`/api/issues?id=${issueId}`);
                const issues = await response.json();
                if (issues.length > 0) {
                    showIssueModal(issues[0]);
                }
            } catch (err) {
                alert('获取详情失败: ' + err.message);
            }
        }

        function showIssueModal(issue) {
            currentIssueId = issue.issue_id;
            document.getElementById('modalTitle').textContent = '异常详情';
            document.getElementById('modalBody').innerHTML = `
                <div class="detail-row">
                    <span class="detail-label">学生：</span>
                    <span class="detail-value">${issue.student_name || '未知'} (${issue.student_id})</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">异常类型：</span>
                    <span class="detail-value">${issue.issue_type}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">描述：</span>
                    <span class="detail-value">${issue.description || '-'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">日期：</span>
                    <span class="detail-value">${issue.date || '-'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">车辆：</span>
                    <span class="detail-value">${issue.vehicle_id || '-'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">线路：</span>
                    <span class="detail-value">${issue.route_id || '-'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">状态：</span>
                    <span class="detail-value">${issue.is_handled ? '已处理' : '待处理'}</span>
                </div>
                ${issue.handled_by ? `
                <div class="detail-row">
                    <span class="detail-label">处理人：</span>
                    <span class="detail-value">${issue.handled_by}</span>
                </div>
                ` : ''}
                ${issue.handled_at ? `
                <div class="detail-row">
                    <span class="detail-label">处理时间：</span>
                    <span class="detail-value">${issue.handled_at}</span>
                </div>
                ` : ''}
            `;
            
            const handleBtn = document.getElementById('handleBtn');
            handleBtn.style.display = issue.is_handled ? 'none' : 'inline-block';
            handleBtn.onclick = () => handleIssue(issue.issue_id);
            
            document.getElementById('detailModal').classList.add('active');
        }

        function closeModal() {
            document.getElementById('detailModal').classList.remove('active');
            currentIssueId = null;
        }

        async function handleIssue(issueId) {
            if (!confirm('确定要标记此异常为已处理吗？')) return;
            
            try {
                const response = await fetch(`/api/issues/${issueId}/handle`, { method: 'POST' });
                const result = await response.json();
                if (result.success) {
                    alert('已标记为已处理');
                    closeModal();
                    loadIssues();
                    loadData();
                }
            } catch (err) {
                alert('操作失败: ' + err.message);
            }
        }

        async function exportIssues() {
            window.location.href = '/api/export/issues';
        }

        async function exportReport() {
            window.location.href = '/api/export/report';
        }

        loadData();
    </script>
</body>
</html>
    ''')


@app.route('/api/stats')
def get_stats():
    students = get_all_students()
    trips = get_trip_status()
    pending_issues = get_issues(is_handled=False)
    handled_issues = get_issues(is_handled=True)
    
    return jsonify({
        'total_students': len(students),
        'total_trips': len(trips),
        'pending_issues': len(pending_issues),
        'handled_issues': len(handled_issues)
    })


@app.route('/api/dates')
def get_dates():
    dates = get_available_dates()
    return jsonify(dates)


@app.route('/api/vehicles')
def get_vehicles():
    vehicles = get_available_vehicles()
    return jsonify(vehicles)


@app.route('/api/issues')
def api_get_issues():
    date = request.args.get('date')
    vehicle = request.args.get('vehicle')
    issue_id = request.args.get('id')
    handled_param = request.args.get('handled')
    
    is_handled = None
    if handled_param is not None:
        is_handled = handled_param.lower() == 'true'
    
    if issue_id:
        issues = get_issues()
        filtered = [i for i in issues if i['issue_id'] == issue_id]
        return jsonify(filtered)
    
    issues = get_issues(date=date, vehicle_id=vehicle, is_handled=is_handled)
    return jsonify(issues)


@app.route('/api/trips')
def api_get_trips():
    date = request.args.get('date')
    vehicle = request.args.get('vehicle')
    
    trips = get_trip_status(date=date, vehicle_id=vehicle)
    
    students = get_all_students()
    students_dict = {s['student_id']: s for s in students}
    
    for trip in trips:
        student = students_dict.get(trip['student_id'])
        if student:
            trip['student_name'] = student['name']
    
    return jsonify(trips)


@app.route('/api/issues/<issue_id>/handle', methods=['POST'])
def handle_issue(issue_id):
    mark_issue_handled(issue_id)
    return jsonify({'success': True})


@app.route('/api/import', methods=['POST'])
def import_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    filename = file.filename.lower()
    filepath = os.path.join(DATA_DIR, file.filename)
    file.save(filepath)
    
    try:
        if 'students' in filename:
            students = import_students_csv(filepath)
            save_students(students)
            return jsonify({'success': True, 'type': 'students', 'count': len(students)})
        elif 'swipe' in filename or filename.endswith('.jsonl'):
            records = import_swipe_jsonl(filepath)
            save_swipe_records(records)
            return jsonify({'success': True, 'type': 'swipe', 'count': len(records)})
        elif 'routes' in filename or filename.endswith('.yaml') or filename.endswith('.yml'):
            routes = import_routes_yaml(filepath)
            save_routes(routes)
            return jsonify({'success': True, 'type': 'routes', 'count': len(routes)})
        elif 'note' in filename or 'teacher' in filename:
            notes = import_teacher_notes_csv(filepath)
            save_teacher_notes(notes)
            return jsonify({'success': True, 'type': 'notes', 'count': len(notes)})
        else:
            return jsonify({'error': 'Unknown file type'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/process', methods=['POST'])
def process_api():
    result = process_all_trips()
    return jsonify({
        'success': True,
        'total_trips': result['total_trips'],
        'total_students': result['total_students'],
        'total_issues': result['total_issues']
    })


@app.route('/api/load-sample', methods=['POST'])
def load_sample():
    sample_dir = os.path.join(os.path.dirname(__file__), 'sample_data')
    
    total = 0
    
    if os.path.exists(os.path.join(sample_dir, 'students.csv')):
        students = import_students_csv(os.path.join(sample_dir, 'students.csv'))
        save_students(students)
        total += len(students)
    
    if os.path.exists(os.path.join(sample_dir, 'swipe_records.jsonl')):
        records = import_swipe_jsonl(os.path.join(sample_dir, 'swipe_records.jsonl'))
        save_swipe_records(records)
        total += len(records)
    
    if os.path.exists(os.path.join(sample_dir, 'routes.yaml')):
        routes = import_routes_yaml(os.path.join(sample_dir, 'routes.yaml'))
        save_routes(routes)
        total += len(routes)
    
    if os.path.exists(os.path.join(sample_dir, 'teacher_notes.csv')):
        notes = import_teacher_notes_csv(os.path.join(sample_dir, 'teacher_notes.csv'))
        save_teacher_notes(notes)
        total += len(notes)
    
    return jsonify({'success': True, 'total': total})


@app.route('/api/export/issues')
def export_issues():
    issues = get_issues()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        '异常ID', '学生ID', '学生姓名', '异常类型', '描述', '日期',
        '车辆ID', '线路ID', '刷卡ID', '状态', '处理人', '处理时间'
    ])
    
    for issue in issues:
        writer.writerow([
            issue['issue_id'],
            issue['student_id'],
            issue['student_name'] or '',
            issue['issue_type'],
            issue['description'] or '',
            issue['date'] or '',
            issue['vehicle_id'] or '',
            issue['route_id'] or '',
            issue['swipe_id'] or '',
            '已处理' if issue['is_handled'] else '待处理',
            issue.get('handled_by', '') or '',
            issue.get('handled_at', '') or ''
        ])
    
    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode('utf-8-sig')),
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'issues_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    )


@app.route('/api/export/report')
def export_report():
    students = get_all_students()
    trips = get_trip_status()
    all_issues = get_issues()
    pending_issues = get_issues(is_handled=False)
    handled_issues = get_issues(is_handled=True)
    
    students_dict = {s['student_id']: s for s in students}
    
    issue_types = {}
    for issue in all_issues:
        itype = issue['issue_type']
        if itype not in issue_types:
            issue_types[itype] = {'total': 0, 'pending': 0, 'handled': 0}
        issue_types[itype]['total'] += 1
        if issue['is_handled']:
            issue_types[itype]['handled'] += 1
        else:
            issue_types[itype]['pending'] += 1
    
    report = f'''# 幼儿园校车交接报告

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

---

## 一、统计汇总

| 指标 | 数值 |
|------|------|
| 学生总数 | {len(students)} |
| 总行程数 | {len(trips)} |
| 总异常数 | {len(all_issues)} |
| 待处理异常 | {len(pending_issues)} |
| 已处理异常 | {len(handled_issues)} |

---

## 二、异常类型统计

'''
    
    for itype, stats in issue_types.items():
        report += f'''### {itype}

- 总数: {stats['total']}
- 待处理: {stats['pending']}
- 已处理: {stats['handled']}

'''
    
    report += '''---

## 三、待处理异常详情

'''
    
    if pending_issues:
        for i, issue in enumerate(pending_issues, 1):
            student = students_dict.get(issue['student_id'], {})
            report += f'''### {i}. {issue['student_name'] or '未知学生'}

- **学生ID**: {issue['student_id']}
- **异常类型**: {issue['issue_type']}
- **日期**: {issue['date'] or '-'}
- **车辆**: {issue['vehicle_id'] or '-'}
- **线路**: {issue['route_id'] or '-'}
- **描述**: {issue['description'] or '-'}

'''
    else:
        report += '暂无待处理异常。\n\n'
    
    report += '''---

## 四、已处理异常详情

'''
    
    if handled_issues:
        for i, issue in enumerate(handled_issues, 1):
            report += f'''### {i}. {issue['student_name'] or '未知学生'}

- **学生ID**: {issue['student_id']}
- **异常类型**: {issue['issue_type']}
- **日期**: {issue['date'] or '-'}
- **状态**: 已处理
- **处理人**: {issue.get('handled_by', '-')}
- **处理时间**: {issue.get('handled_at', '-')}
- **描述**: {issue['description'] or '-'}

'''
    else:
        report += '暂无已处理异常。\n\n'
    
    report += '''---

*本报告由校车晨检复核系统自动生成*
'''
    
    return send_file(
        io.BytesIO(report.encode('utf-8')),
        mimetype='text/markdown',
        as_attachment=True,
        download_name=f'handover_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.md'
    )


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
