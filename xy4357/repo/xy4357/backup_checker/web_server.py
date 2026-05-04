import os
import json
from datetime import datetime
from threading import Thread
from typing import Dict, Any

from flask import Flask, render_template_string, jsonify, request, redirect, url_for

from backup_checker.config import AppConfig
from backup_checker.database import DatabaseManager


def create_app(config: AppConfig = None) -> Flask:
    app = Flask(__name__)
    
    if config:
        app.config['APP_CONFIG'] = config
        app.config['DB_PATH'] = config.db_path
    
    INDEX_HTML = '''
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>备份巡检工具</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px 0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .header h1 { font-size: 1.8em; }
        .nav { display: flex; gap: 20px; }
        .nav a {
            color: rgba(255,255,255,0.9);
            text-decoration: none;
            padding: 8px 16px;
            border-radius: 4px;
            transition: background 0.2s;
        }
        .nav a:hover, .nav a.active {
            background: rgba(255,255,255,0.2);
            color: white;
        }
        .container {
            max-width: 1200px;
            margin: 30px auto;
            padding: 0 20px;
        }
        .card {
            background: white;
            border-radius: 8px;
            padding: 24px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            margin-bottom: 24px;
        }
        .card h2 {
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 1.3em;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
            padding: 20px;
            text-align: center;
        }
        .stat-card.warning {
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
        }
        .stat-card.success {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
        }
        .stat-card .number {
            font-size: 2.5em;
            font-weight: bold;
        }
        .stat-card .label {
            font-size: 0.9em;
            opacity: 0.9;
            margin-top: 5px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px 15px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #495057;
            position: sticky;
            top: 0;
        }
        tr:hover { background: #f8f9fa; }
        .btn {
            display: inline-block;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            text-decoration: none;
            font-size: 0.9em;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-primary {
            background: #667eea;
            color: white;
        }
        .btn-primary:hover { background: #5a6fd6; }
        .btn-success {
            background: #28a745;
            color: white;
        }
        .btn-success:hover { background: #218838; }
        .btn-danger {
            background: #dc3545;
            color: white;
        }
        .btn-danger:hover { background: #c82333; }
        .btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.8em;
            font-weight: 500;
        }
        .badge-success { background: #d4edda; color: #155724; }
        .badge-warning { background: #fff3cd; color: #856404; }
        .badge-danger { background: #f8d7da; color: #721c24; }
        .badge-info { background: #d1ecf1; color: #0c5460; }
        .badge-secondary { background: #e2e3e5; color: #383d41; }
        .path-cell {
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-family: monospace;
            font-size: 0.85em;
        }
        .empty-state {
            text-align: center;
            padding: 60px 20px;
            color: #6c757d;
        }
        .empty-state h3 { margin-bottom: 10px; }
        .tabs {
            display: flex;
            gap: 5px;
            margin-bottom: 20px;
            border-bottom: 1px solid #eee;
        }
        .tab {
            padding: 10px 20px;
            background: none;
            border: none;
            cursor: pointer;
            font-size: 1em;
            color: #6c757d;
            border-bottom: 2px solid transparent;
            margin-bottom: -1px;
        }
        .tab:hover { color: #667eea; }
        .tab.active {
            color: #667eea;
            border-bottom-color: #667eea;
        }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .detail-row { display: flex; margin-bottom: 15px; }
        .detail-label {
            width: 120px;
            font-weight: 600;
            color: #6c757d;
        }
        .loading {
            text-align: center;
            padding: 40px;
            color: #6c757d;
        }
        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            border-radius: 4px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        }
        .toast.success { background: #28a745; }
        .toast.error { background: #dc3545; }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-content">
            <h1>📁 备份巡检工具</h1>
            <nav class="nav">
                <a href="#" class="active" onclick="showPage('dashboard')">仪表盘</a>
                <a href="#" onclick="showPage('tasks')">任务管理</a>
                <a href="#" onclick="showPage('anomalies')">异常记录</a>
            </nav>
        </div>
    </div>
    
    <div class="container">
        <div id="page-dashboard">
            <div class="stats-grid" id="stats-grid">
                <div class="stat-card">
                    <div class="number" id="stat-total-scans">0</div>
                    <div class="label">总扫描次数</div>
                </div>
                <div class="stat-card warning">
                    <div class="number" id="stat-pending-anomalies">0</div>
                    <div class="label">待确认异常</div>
                </div>
                <div class="stat-card success">
                    <div class="number" id="stat-total-tasks">0</div>
                    <div class="label">配置任务数</div>
                </div>
            </div>
            
            <div class="card">
                <h2>最近巡检记录</h2>
                <div id="recent-scans">
                    <div class="loading">加载中...</div>
                </div>
            </div>
        </div>
        
        <div id="page-tasks" style="display:none;">
            <div class="card">
                <h2>任务列表</h2>
                <div id="tasks-list">
                    <div class="loading">加载中...</div>
                </div>
            </div>
        </div>
        
        <div id="page-anomalies" style="display:none;">
            <div class="card">
                <h2>异常记录</h2>
                <div class="tabs">
                    <button class="tab active" onclick="filterAnomalies('all')">全部</button>
                    <button class="tab" onclick="filterAnomalies('pending')">待确认</button>
                    <button class="tab" onclick="filterAnomalies('confirmed')">已确认</button>
                </div>
                <div id="anomalies-list">
                    <div class="loading">加载中...</div>
                </div>
            </div>
        </div>
        
        <div id="page-scan-detail" style="display:none;">
            <div class="card">
                <h2>巡检详情</h2>
                <div id="scan-detail-content"></div>
            </div>
        </div>
    </div>
    
    <div id="toast-container"></div>
    
    <script>
        let currentFilter = 'all';
        
        function showToast(message, type = 'success') {
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
        
        function showPage(page) {
            document.querySelectorAll('[id^="page-"]').forEach(el => el.style.display = 'none');
            document.querySelectorAll('.nav a').forEach(el => el.classList.remove('active'));
            
            if (page === 'dashboard') {
                document.getElementById('page-dashboard').style.display = 'block';
                document.querySelector('.nav a:nth-child(1)').classList.add('active');
                loadDashboard();
            } else if (page === 'tasks') {
                document.getElementById('page-tasks').style.display = 'block';
                document.querySelector('.nav a:nth-child(2)').classList.add('active');
                loadTasks();
            } else if (page === 'anomalies') {
                document.getElementById('page-anomalies').style.display = 'block';
                document.querySelector('.nav a:nth-child(3)').classList.add('active');
                loadAnomalies();
            }
        }
        
        async function loadDashboard() {
            try {
                const [scansRes, anomaliesRes, tasksRes] = await Promise.all([
                    fetch('/api/scans?limit=10'),
                    fetch('/api/anomalies?pending=true'),
                    fetch('/api/tasks')
                ]);
                
                const scans = await scansRes.json();
                const anomalies = await anomaliesRes.json();
                const tasks = await tasksRes.json();
                
                document.getElementById('stat-total-scans').textContent = scans.length || 0;
                document.getElementById('stat-pending-anomalies').textContent = anomalies.length || 0;
                document.getElementById('stat-total-tasks').textContent = tasks.length || 0;
                
                renderScansTable(scans);
            } catch (e) {
                console.error('Error loading dashboard:', e);
            }
        }
        
        function renderScansTable(scans) {
            const container = document.getElementById('recent-scans');
            if (!scans || scans.length === 0) {
                container.innerHTML = '<div class="empty-state"><h3>暂无扫描记录</h3><p>请先运行巡检命令</p></div>';
                return;
            }
            
            let html = '<table><thead><tr><th>ID</th><th>任务</th><th>开始时间</th><th>状态</th><th>源文件</th><th>目标文件</th><th>操作</th></tr></thead><tbody>';
            
            for (const scan of scans) {
                const statusClass = scan.status === 'completed' ? 'badge-success' : 
                                    scan.status === 'failed' ? 'badge-danger' : 'badge-warning';
                const startedAt = scan.started_at ? scan.started_at.replace('T', ' ').slice(0, 19) : '-';
                
                html += `
                <tr>
                    <td>${scan.id}</td>
                    <td>${scan.task_name || '-'}</td>
                    <td>${startedAt}</td>
                    <td><span class="badge ${statusClass}">${scan.status}</span></td>
                    <td>${scan.source_files_count}</td>
                    <td>${scan.target_files_count}</td>
                    <td>
                        <button class="btn btn-primary" onclick="viewScanDetail(${scan.id})">详情</button>
                    </td>
                </tr>`;
            }
            
            html += '</tbody></table>';
            container.innerHTML = html;
        }
        
        async function loadTasks() {
            try {
                const response = await fetch('/api/tasks');
                const tasks = await response.json();
                renderTasksTable(tasks);
            } catch (e) {
                console.error('Error loading tasks:', e);
            }
        }
        
        function renderTasksTable(tasks) {
            const container = document.getElementById('tasks-list');
            if (!tasks || tasks.length === 0) {
                container.innerHTML = '<div class="empty-state"><h3>暂无任务</h3><p>请先配置任务</p></div>';
                return;
            }
            
            let html = '<table><thead><tr><th>ID</th><th>名称</th><th>源目录</th><th>目标目录</th><th>保留天数</th><th>最后更新</th></tr></thead><tbody>';
            
            for (const task of tasks) {
                const updatedAt = task.updated_at ? task.updated_at.replace('T', ' ').slice(0, 19) : '-';
                
                html += `
                <tr>
                    <td>${task.id}</td>
                    <td><strong>${task.name}</strong></td>
                    <td class="path-cell" title="${task.source_dir}">${task.source_dir}</td>
                    <td class="path-cell" title="${task.target_dir}">${task.target_dir}</td>
                    <td>${task.retention_days}</td>
                    <td>${updatedAt}</td>
                </tr>`;
            }
            
            html += '</tbody></table>';
            container.innerHTML = html;
        }
        
        async function loadAnomalies() {
            try {
                let url = '/api/anomalies';
                if (currentFilter === 'pending') {
                    url += '?pending=true';
                } else if (currentFilter === 'confirmed') {
                    url += '?confirmed=true';
                }
                
                const response = await fetch(url);
                const anomalies = await response.json();
                renderAnomaliesTable(anomalies);
            } catch (e) {
                console.error('Error loading anomalies:', e);
            }
        }
        
        function filterAnomalies(filter) {
            currentFilter = filter;
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
            event.target.classList.add('active');
            loadAnomalies();
        }
        
        function getAnomalyTypeLabel(type) {
            const labels = {
                'missing_in_target': '目标缺失',
                'extra_in_target': '目标多余',
                'possible_duplicate': '疑似重复',
                'hash_mismatch': '哈希不一致'
            };
            return labels[type] || type;
        }
        
        function getAnomalyTypeBadge(type) {
            const badges = {
                'missing_in_target': 'badge-danger',
                'extra_in_target': 'badge-warning',
                'possible_duplicate': 'badge-info',
                'hash_mismatch': 'badge-secondary'
            };
            return badges[type] || 'badge-secondary';
        }
        
        function renderAnomaliesTable(anomalies) {
            const container = document.getElementById('anomalies-list');
            if (!anomalies || anomalies.length === 0) {
                container.innerHTML = '<div class="empty-state"><h3>暂无异常记录</h3></div>';
                return;
            }
            
            let html = '<table><thead><tr><th>ID</th><th>类型</th><th>源路径</th><th>目标路径</th><th>创建时间</th><th>状态</th><th>操作</th></tr></thead><tbody>';
            
            for (const anomaly of anomalies) {
                const createdAt = anomaly.created_at ? anomaly.created_at.replace('T', ' ').slice(0, 19) : '-';
                const statusBadge = anomaly.manually_confirmed ? 
                    '<span class="badge badge-success">已确认</span>' : 
                    '<span class="badge badge-warning">待确认</span>';
                const confirmBtn = anomaly.manually_confirmed ? '' : 
                    `<button class="btn btn-success" onclick="confirmAnomaly(${anomaly.id})">确认</button>`;
                
                html += `
                <tr>
                    <td>${anomaly.id}</td>
                    <td><span class="badge ${getAnomalyTypeBadge(anomaly.anomaly_type)}">${getAnomalyTypeLabel(anomaly.anomaly_type)}</span></td>
                    <td class="path-cell" title="${anomaly.source_path || '-'}">${anomaly.source_path || '-'}</td>
                    <td class="path-cell" title="${anomaly.target_path || '-'}">${anomaly.target_path || '-'}</td>
                    <td>${createdAt}</td>
                    <td>${statusBadge}</td>
                    <td>${confirmBtn}</td>
                </tr>`;
            }
            
            html += '</tbody></table>';
            container.innerHTML = html;
        }
        
        async function confirmAnomaly(id) {
            if (!confirm('确定要标记该异常为已确认吗？')) return;
            
            try {
                const response = await fetch(`/api/anomalies/${id}/confirm`, { method: 'POST' });
                if (response.ok) {
                    showToast('已标记为已确认');
                    loadAnomalies();
                } else {
                    showToast('操作失败', 'error');
                }
            } catch (e) {
                showToast('操作失败', 'error');
            }
        }
        
        async function viewScanDetail(scanId) {
            try {
                document.querySelectorAll('[id^="page-"]').forEach(el => el.style.display = 'none');
                document.getElementById('page-scan-detail').style.display = 'block';
                
                const response = await fetch(`/api/scans/${scanId}`);
                const scan = await response.json();
                
                renderScanDetail(scan);
            } catch (e) {
                console.error('Error loading scan detail:', e);
            }
        }
        
        function renderScanDetail(scan) {
            const container = document.getElementById('scan-detail-content');
            
            const startedAt = scan.started_at ? scan.started_at.replace('T', ' ').slice(0, 19) : '-';
            const completedAt = scan.completed_at ? scan.completed_at.replace('T', ' ').slice(0, 19) : '-';
            const statusClass = scan.status === 'completed' ? 'badge-success' : 
                                scan.status === 'failed' ? 'badge-danger' : 'badge-warning';
            
            let html = `
                <div class="detail-row">
                    <div class="detail-label">任务名称:</div>
                    <div><strong>${scan.task_name || '-'}</strong></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">状态:</div>
                    <div><span class="badge ${statusClass}">${scan.status}</span></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">开始时间:</div>
                    <div>${startedAt}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">完成时间:</div>
                    <div>${completedAt}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">源文件数:</div>
                    <div>${scan.source_files_count}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">目标文件数:</div>
                    <div>${scan.target_files_count}</div>
                </div>
            `;
            
            if (scan.comparison) {
                const comp = scan.comparison;
                html += `
                <h3 style="margin-top: 30px; margin-bottom: 15px;">比较结果</h3>
                <div class="detail-row">
                    <div class="detail-label">目标缺失:</div>
                    <div>${comp.missing_in_target || 0} 个文件</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">目标多余:</div>
                    <div>${comp.extra_in_target || 0} 个文件</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">疑似重复:</div>
                    <div>${comp.possible_duplicates || 0} 组</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">哈希不一致:</div>
                    <div>${comp.hash_mismatch || 0} 个文件</div>
                </div>
                `;
            }
            
            if (scan.anomalies && scan.anomalies.length > 0) {
                html += `
                <h3 style="margin-top: 30px; margin-bottom: 15px;">异常列表</h3>
                <table>
                    <thead>
                        <tr><th>类型</th><th>详情</th><th>状态</th></tr>
                    </thead>
                    <tbody>
                `;
                
                for (const anomaly of scan.anomalies) {
                    const statusBadge = anomaly.manually_confirmed ? 
                        '<span class="badge badge-success">已确认</span>' : 
                        '<span class="badge badge-warning">待确认</span>';
                    
                    html += `
                    <tr>
                        <td><span class="badge ${getAnomalyTypeBadge(anomaly.anomaly_type)}">${getAnomalyTypeLabel(anomaly.anomaly_type)}</span></td>
                        <td class="path-cell" title="${anomaly.details || ''}">${anomaly.details || '-'}</td>
                        <td>${statusBadge}</td>
                    </tr>
                    `;
                }
                
                html += '</tbody></table>';
            }
            
            html += `
            <div style="margin-top: 30px;">
                <button class="btn btn-primary" onclick="showPage('dashboard')">返回</button>
            </div>
            `;
            
            container.innerHTML = html;
        }
        
        window.onload = function() {
            loadDashboard();
        };
    </script>
</body>
</html>
'''
    
    @app.route('/')
    def index():
        return render_template_string(INDEX_HTML)
    
    @app.route('/api/scans')
    def api_scans():
        limit = request.args.get('limit', default=10, type=int)
        db = DatabaseManager(app.config.get('DB_PATH'))
        scans = db.get_recent_scans(limit)
        return jsonify(scans)
    
    @app.route('/api/scans/<int:scan_id>')
    def api_scan_detail(scan_id):
        db = DatabaseManager(app.config.get('DB_PATH'))
        scan = db.get_scan(scan_id)
        if not scan:
            return jsonify({'error': 'Scan not found'}), 404
        
        comparison = db.get_latest_comparison_for_task(scan['task_id'])
        if comparison:
            scan['comparison'] = comparison
            scan['anomalies'] = db.get_anomalies(comparison_id=comparison['id'])
        
        return jsonify(scan)
    
    @app.route('/api/tasks')
    def api_tasks():
        db = DatabaseManager(app.config.get('DB_PATH'))
        tasks = db.get_all_tasks()
        return jsonify(tasks)
    
    @app.route('/api/anomalies')
    def api_anomalies():
        pending = request.args.get('pending', default=None)
        confirmed = request.args.get('confirmed', default=None)
        
        db = DatabaseManager(app.config.get('DB_PATH'))
        
        manually_confirmed = None
        if pending is not None:
            manually_confirmed = False
        elif confirmed is not None:
            manually_confirmed = True
        
        anomalies = db.get_anomalies(manually_confirmed=manually_confirmed)
        return jsonify(anomalies)
    
    @app.route('/api/anomalies/<int:anomaly_id>/confirm', methods=['POST'])
    def api_confirm_anomaly(anomaly_id):
        db = DatabaseManager(app.config.get('DB_PATH'))
        
        anomalies = db.get_anomalies()
        target = None
        for a in anomalies:
            if a['id'] == anomaly_id:
                target = a
                break
        
        if not target:
            return jsonify({'error': 'Anomaly not found'}), 404
        
        db.confirm_anomaly(anomaly_id)
        return jsonify({'success': True})
    
    @app.route('/api/tasks/<int:task_id>/run', methods=['POST'])
    def api_run_task(task_id):
        return jsonify({'error': 'Not implemented'}), 501
    
    return app
