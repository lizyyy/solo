#!/usr/bin/env python3
from flask import Flask, jsonify, request, render_template_string
from datetime import datetime, date
import uuid
import json
from dataclasses import dataclass, asdict
from typing import List, Optional, Dict

app = Flask(__name__)

@dataclass
class TimeReport:
    id: str
    employee_id: str
    employee_name: str
    project_id: str
    project_name: str
    report_date: str
    hours: float
    original_input: Dict
    processed_result: Optional[Dict]
    approval_status: str
    fill_reason: Optional[str]
    error_message: Optional[str]
    can_retry: bool
    created_at: str
    updated_at: str

class TimeReportDB:
    def __init__(self):
        self.reports: Dict[str, TimeReport] = {}
        self._init_sample_data()
    
    def _init_sample_data(self):
        sample_data = [
            {
                "employee_id": "E001",
                "employee_name": "张三",
                "project_id": "P001",
                "project_name": "工时系统改造",
                "report_date": "2026-05-10",
                "hours": 8.0,
                "original_input": {"employee": "张三", "project": "工时系统", "date": "2026-05-10", "hours": "8"},
                "approval_status": "success",
                "fill_reason": None,
                "error_message": None,
                "can_retry": False
            },
            {
                "employee_id": "E001",
                "employee_name": "张三",
                "project_id": "P001",
                "project_name": "工时系统改造",
                "report_date": "2026-05-11",
                "hours": 9.0,
                "original_input": {"employee": "张三", "project": "工时系统", "date": "2026-05-11", "hours": "9"},
                "approval_status": "pending_review",
                "fill_reason": None,
                "error_message": "工时超过8小时，需要项目经理复核",
                "can_retry": False
            },
            {
                "employee_id": "E002",
                "employee_name": "李四",
                "project_id": "P002",
                "project_name": "客户管理系统",
                "report_date": "2026-05-10",
                "hours": -2.0,
                "original_input": {"employee": "李四", "project": "客户管理", "date": "2026-05-10", "hours": "-2"},
                "approval_status": "blocked",
                "fill_reason": None,
                "error_message": "工时不能为负数",
                "can_retry": True
            },
            {
                "employee_id": "E002",
                "employee_name": "李四",
                "project_id": "P002",
                "project_name": "客户管理系统",
                "report_date": "2026-05-11",
                "hours": 8.0,
                "original_input": {"employee": "李四", "project": "客户管理", "date": "2026-05-11", "hours": "8"},
                "approval_status": "success",
                "fill_reason": None,
                "error_message": None,
                "can_retry": False
            },
            {
                "employee_id": "E003",
                "employee_name": "王五",
                "project_id": "P999",
                "project_name": "未知项目",
                "report_date": "2026-05-12",
                "hours": 8.0,
                "original_input": {"employee": "王五", "project": "未知项目", "date": "2026-05-12", "hours": "8"},
                "approval_status": "blocked",
                "fill_reason": "补填：项目编码错误，已人工核对为P003-财务系统",
                "error_message": "项目不存在",
                "can_retry": True
            },
            {
                "employee_id": "E003",
                "employee_name": "王五",
                "project_id": "P003",
                "project_name": "财务系统",
                "report_date": "2026-05-12",
                "hours": 8.0,
                "original_input": {"employee": "王五", "project": "财务系统", "date": "2026-05-12", "hours": "8"},
                "processed_result": {"corrected_project": "P003", "original_project": "P999"},
                "approval_status": "success",
                "fill_reason": "补填：项目编码错误，已人工核对为P003-财务系统",
                "error_message": None,
                "can_retry": False
            },
            {
                "employee_id": "E004",
                "employee_name": "赵六",
                "project_id": "P001",
                "project_name": "工时系统改造",
                "report_date": "2026-05-32",
                "hours": 8.0,
                "original_input": {"employee": "赵六", "project": "工时系统", "date": "2026-05-32", "hours": "8"},
                "approval_status": "blocked",
                "fill_reason": None,
                "error_message": "日期格式错误：5月没有32天",
                "can_retry": True
            },
            {
                "employee_id": "E005",
                "employee_name": "孙七",
                "project_id": "P002",
                "project_name": "客户管理系统",
                "report_date": "2026-05-13",
                "hours": 25.0,
                "original_input": {"employee": "孙七", "project": "客户管理", "date": "2026-05-13", "hours": "25"},
                "approval_status": "blocked",
                "fill_reason": None,
                "error_message": "工时不能超过24小时",
                "can_retry": True
            }
        ]
        
        for data in sample_data:
            report_id = str(uuid.uuid4())
            now = datetime.now().isoformat()
            report = TimeReport(
                id=report_id,
                employee_id=data["employee_id"],
                employee_name=data["employee_name"],
                project_id=data["project_id"],
                project_name=data["project_name"],
                report_date=data["report_date"],
                hours=data["hours"],
                original_input=data["original_input"],
                processed_result=data.get("processed_result"),
                approval_status=data["approval_status"],
                fill_reason=data["fill_reason"],
                error_message=data["error_message"],
                can_retry=data["can_retry"],
                created_at=now,
                updated_at=now
            )
            self.reports[report_id] = report
    
    def get_all(self) -> List[TimeReport]:
        return list(self.reports.values())
    
    def get_by_id(self, report_id: str) -> Optional[TimeReport]:
        return self.reports.get(report_id)
    
    def search(self, employee_name: Optional[str] = None, project_name: Optional[str] = None, 
               status: Optional[str] = None) -> List[TimeReport]:
        results = list(self.reports.values())
        if employee_name:
            results = [r for r in results if employee_name in r.employee_name]
        if project_name:
            results = [r for r in results if project_name in r.project_name]
        if status:
            results = [r for r in results if r.approval_status == status]
        return results
    
    def retry(self, report_id: str) -> Optional[TimeReport]:
        report = self.reports.get(report_id)
        if report and report.can_retry:
            report.approval_status = "success"
            report.error_message = None
            report.can_retry = False
            report.updated_at = datetime.now().isoformat()
            return report
        return None
    
    def rollback(self, report_id: str) -> Optional[TimeReport]:
        report = self.reports.get(report_id)
        if report:
            if report.processed_result:
                original_project = report.processed_result.get("original_project", report.project_id)
                report.project_id = original_project
                report.project_name = "未知项目"
            report.approval_status = "blocked"
            report.error_message = "已回滚，需要重新处理"
            report.can_retry = True
            report.updated_at = datetime.now().isoformat()
            return report
        return None
    
    def diagnose(self, report_id: str) -> Dict:
        report = self.reports.get(report_id)
        if not report:
            return {"error": "报表不存在"}
        
        issues = []
        if report.hours < 0:
            issues.append("工时为负数")
        if report.hours > 24:
            issues.append("工时超过24小时")
        try:
            report_date = datetime.strptime(report.report_date, "%Y-%m-%d")
        except ValueError:
            issues.append("日期格式错误")
        
        return {
            "report_id": report_id,
            "status": report.approval_status,
            "issues": issues,
            "original_input": report.original_input,
            "fill_reason": report.fill_reason,
            "recommendation": "重新提交" if issues else "正常"
        }

db = TimeReportDB()

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/api/reports', methods=['GET'])
def get_reports():
    employee_name = request.args.get('employee_name')
    project_name = request.args.get('project_name')
    status = request.args.get('status')
    reports = db.search(employee_name, project_name, status)
    return jsonify([asdict(r) for r in reports])

@app.route('/api/reports/<report_id>', methods=['GET'])
def get_report(report_id):
    report = db.get_by_id(report_id)
    if not report:
        return jsonify({"error": "报表不存在"}), 404
    return jsonify(asdict(report))

@app.route('/api/reports/<report_id>/retry', methods=['POST'])
def retry_report(report_id):
    report = db.retry(report_id)
    if not report:
        return jsonify({"error": "无法重试或报表不存在"}), 400
    return jsonify(asdict(report))

@app.route('/api/reports/<report_id>/rollback', methods=['POST'])
def rollback_report(report_id):
    report = db.rollback(report_id)
    if not report:
        return jsonify({"error": "报表不存在"}), 404
    return jsonify(asdict(report))

@app.route('/api/reports/<report_id>/diagnose', methods=['GET'])
def diagnose_report(report_id):
    result = db.diagnose(report_id)
    return jsonify(result)

@app.route('/api/stats', methods=['GET'])
def get_stats():
    reports = db.get_all()
    return jsonify({
        "total": len(reports),
        "success": len([r for r in reports if r.approval_status == "success"]),
        "pending_review": len([r for r in reports if r.approval_status == "pending_review"]),
        "blocked": len([r for r in reports if r.approval_status == "blocked"]),
        "can_retry": len([r for r in reports if r.can_retry])
    })

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>工时填报校验台</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; padding: 20px; }
        .container { max-width: 1400px; margin: 0 auto; }
        h1 { color: #333; margin-bottom: 20px; }
        
        .stats-bar { display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; }
        .stat-value { font-size: 24px; font-weight: bold; }
        .stat-label { color: #666; font-size: 12px; margin-top: 5px; }
        .stat-total .stat-value { color: #333; }
        .stat-success .stat-value { color: #52c41a; }
        .stat-pending .stat-value { color: #faad14; }
        .stat-blocked .stat-value { color: #ff4d4f; }
        .stat-retry .stat-value { color: #1890ff; }
        
        .search-bar { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; display: flex; gap: 15px; flex-wrap: wrap; }
        .search-group { display: flex; flex-direction: column; gap: 5px; }
        .search-group label { font-size: 12px; color: #666; }
        .search-bar input, .search-bar select { padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 4px; min-width: 180px; }
        .search-bar button { padding: 8px 20px; background: #1890ff; color: white; border: none; border-radius: 4px; cursor: pointer; align-self: flex-end; }
        .search-bar button:hover { background: #40a9ff; }
        
        .table-container { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #f0f0f0; }
        th { background: #fafafa; font-weight: 600; color: #333; }
        tr:hover { background: #fafafa; }
        
        .status-badge { padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        .status-success { background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; }
        .status-pending_review { background: #fffbe6; color: #faad14; border: 1px solid #ffe58f; }
        .status-blocked { background: #fff2f0; color: #ff4d4f; border: 1px solid #ffccc7; }
        
        .btn { padding: 5px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-right: 5px; }
        .btn-retry { background: #1890ff; color: white; }
        .btn-retry:disabled { background: #d9d9d9; cursor: not-allowed; }
        .btn-diagnose { background: #722ed1; color: white; }
        .btn-rollback { background: #faad14; color: white; }
        .btn-detail { background: #f0f0f0; color: #333; }
        
        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; }
        .modal.active { display: flex; align-items: center; justify-content: center; }
        .modal-content { background: white; padding: 25px; border-radius: 8px; max-width: 700px; width: 90%; max-height: 80vh; overflow-y: auto; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #f0f0f0; }
        .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #999; }
        .detail-section { margin-bottom: 20px; }
        .detail-section h4 { margin-bottom: 10px; color: #333; }
        .detail-row { display: flex; padding: 8px 0; border-bottom: 1px solid #f5f5f5; }
        .detail-label { width: 150px; color: #666; }
        .detail-value { flex: 1; }
        .json-block { background: #f5f5f5; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; white-space: pre-wrap; }
        .error-detail { background: #fff2f0; padding: 15px; border-radius: 4px; border-left: 4px solid #ff4d4f; }
        .fill-reason { background: #fffbe6; padding: 15px; border-radius: 4px; border-left: 4px solid #faad14; }
    </style>
</head>
<body>
    <div class="container">
        <h1>工时填报校验台</h1>
        
        <div class="stats-bar">
            <div class="stat-card stat-total">
                <div class="stat-value" id="total-count">0</div>
                <div class="stat-label">总数</div>
            </div>
            <div class="stat-card stat-success">
                <div class="stat-value" id="success-count">0</div>
                <div class="stat-label">成功</div>
            </div>
            <div class="stat-card stat-pending">
                <div class="stat-value" id="pending-count">0</div>
                <div class="stat-label">待复核</div>
            </div>
            <div class="stat-card stat-blocked">
                <div class="stat-value" id="blocked-count">0</div>
                <div class="stat-label">已拦截</div>
            </div>
            <div class="stat-card stat-retry">
                <div class="stat-value" id="retry-count">0</div>
                <div class="stat-label">可重试</div>
            </div>
        </div>
        
        <div class="search-bar">
            <div class="search-group">
                <label>员工姓名</label>
                <input type="text" id="search-employee" placeholder="输入员工姓名">
            </div>
            <div class="search-group">
                <label>项目名称</label>
                <input type="text" id="search-project" placeholder="输入项目名称">
            </div>
            <div class="search-group">
                <label>审批状态</label>
                <select id="search-status">
                    <option value="">全部</option>
                    <option value="success">成功</option>
                    <option value="pending_review">待复核</option>
                    <option value="blocked">已拦截</option>
                </select>
            </div>
            <button onclick="loadReports()">搜索</button>
        </div>
        
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>员工</th>
                        <th>项目</th>
                        <th>日期</th>
                        <th>工时</th>
                        <th>状态</th>
                        <th>补填原因</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody id="reports-table">
                </tbody>
            </table>
        </div>
    </div>
    
    <div class="modal" id="detail-modal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>报表详情</h3>
                <button class="modal-close" onclick="closeModal()">&times;</button>
            </div>
            <div id="modal-body"></div>
        </div>
    </div>
    
    <script>
        const statusMap = {
            'success': { text: '成功', class: 'status-success' },
            'pending_review': { text: '待复核', class: 'status-pending_review' },
            'blocked': { text: '已拦截', class: 'status-blocked' }
        };
        
        async function loadStats() {
            const res = await fetch('/api/stats');
            const stats = await res.json();
            document.getElementById('total-count').textContent = stats.total;
            document.getElementById('success-count').textContent = stats.success;
            document.getElementById('pending-count').textContent = stats.pending_review;
            document.getElementById('blocked-count').textContent = stats.blocked;
            document.getElementById('retry-count').textContent = stats.can_retry;
        }
        
        async function loadReports() {
            const employee = document.getElementById('search-employee').value;
            const project = document.getElementById('search-project').value;
            const status = document.getElementById('search-status').value;
            
            const params = new URLSearchParams();
            if (employee) params.append('employee_name', employee);
            if (project) params.append('project_name', project);
            if (status) params.append('status', status);
            
            const res = await fetch(`/api/reports?${params}`);
            const reports = await res.json();
            
            const tbody = document.getElementById('reports-table');
            tbody.innerHTML = reports.map(r => `
                <tr>
                    <td>${r.employee_name} (${r.employee_id})</td>
                    <td>${r.project_name}</td>
                    <td>${r.report_date}</td>
                    <td>${r.hours}h</td>
                    <td><span class="status-badge ${statusMap[r.approval_status].class}">${statusMap[r.approval_status].text}</span></td>
                    <td>${r.fill_reason || '-'}</td>
                    <td>
                        <button class="btn btn-retry" onclick="retryReport('${r.id}')" ${!r.can_retry ? 'disabled' : ''}>重试</button>
                        <button class="btn btn-diagnose" onclick="diagnoseReport('${r.id}')">诊断</button>
                        <button class="btn btn-rollback" onclick="rollbackReport('${r.id}')">回滚</button>
                        <button class="btn btn-detail" onclick="showDetail('${r.id}')">详情</button>
                    </td>
                </tr>
            `).join('');
            
            await loadStats();
        }
        
        async function retryReport(id) {
            const res = await fetch(`/api/reports/${id}/retry`, { method: 'POST' });
            if (res.ok) {
                alert('重试成功！');
                loadReports();
            } else {
                alert('重试失败！');
            }
        }
        
        async function rollbackReport(id) {
            if (!confirm('确定要回滚吗？')) return;
            const res = await fetch(`/api/reports/${id}/rollback`, { method: 'POST' });
            if (res.ok) {
                alert('回滚成功！');
                loadReports();
            } else {
                alert('回滚失败！');
            }
        }
        
        async function diagnoseReport(id) {
            const res = await fetch(`/api/reports/${id}/diagnose`);
            const data = await res.json();
            showModal('诊断结果', `
                <div class="detail-section">
                    <h4>诊断信息</h4>
                    <div class="detail-row"><div class="detail-label">报表ID</div><div class="detail-value">${data.report_id}</div></div>
                    <div class="detail-row"><div class="detail-label">当前状态</div><div class="detail-value">${statusMap[data.status]?.text || data.status}</div></div>
                    <div class="detail-row"><div class="detail-label">建议</div><div class="detail-value">${data.recommendation}</div></div>
                </div>
                <div class="detail-section">
                    <h4>问题列表</h4>
                    ${data.issues.length ? data.issues.map(i => `<div class="error-detail">${i}</div>`).join('') : '<p>无问题</p>'}
                </div>
                <div class="detail-section">
                    <h4>原始输入</h4>
                    <div class="json-block">${JSON.stringify(data.original_input, null, 2)}</div>
                </div>
                ${data.fill_reason ? `
                <div class="detail-section">
                    <h4>补填原因</h4>
                    <div class="fill-reason">${data.fill_reason}</div>
                </div>
                ` : ''}
            `);
        }
        
        async function showDetail(id) {
            const res = await fetch(`/api/reports/${id}`);
            const r = await res.json();
            showModal('报表详情', `
                <div class="detail-section">
                    <h4>基本信息</h4>
                    <div class="detail-row"><div class="detail-label">报表ID</div><div class="detail-value">${r.id}</div></div>
                    <div class="detail-row"><div class="detail-label">员工</div><div class="detail-value">${r.employee_name} (${r.employee_id})</div></div>
                    <div class="detail-row"><div class="detail-label">项目</div><div class="detail-value">${r.project_name} (${r.project_id})</div></div>
                    <div class="detail-row"><div class="detail-label">日期</div><div class="detail-value">${r.report_date}</div></div>
                    <div class="detail-row"><div class="detail-label">工时</div><div class="detail-value">${r.hours}小时</div></div>
                    <div class="detail-row"><div class="detail-label">状态</div><div class="detail-value"><span class="status-badge ${statusMap[r.approval_status].class}">${statusMap[r.approval_status].text}</span></div></div>
                </div>
                ${r.error_message ? `
                <div class="detail-section">
                    <h4>错误明细</h4>
                    <div class="error-detail">${r.error_message}</div>
                </div>
                ` : ''}
                ${r.fill_reason ? `
                <div class="detail-section">
                    <h4>补填原因（人工处理）</h4>
                    <div class="fill-reason">${r.fill_reason}</div>
                </div>
                ` : ''}
                <div class="detail-section">
                    <h4>原始输入</h4>
                    <div class="json-block">${JSON.stringify(r.original_input, null, 2)}</div>
                </div>
                ${r.processed_result ? `
                <div class="detail-section">
                    <h4>处理后结果</h4>
                    <div class="json-block">${JSON.stringify(r.processed_result, null, 2)}</div>
                </div>
                ` : ''}
                <div class="detail-section">
                    <h4>时间戳</h4>
                    <div class="detail-row"><div class="detail-label">创建时间</div><div class="detail-value">${r.created_at}</div></div>
                    <div class="detail-row"><div class="detail-label">更新时间</div><div class="detail-value">${r.updated_at}</div></div>
                </div>
            `);
        }
        
        function showModal(title, content) {
            document.querySelector('#detail-modal h3').textContent = title;
            document.getElementById('modal-body').innerHTML = content;
            document.getElementById('detail-modal').classList.add('active');
        }
        
        function closeModal() {
            document.getElementById('detail-modal').classList.remove('active');
        }
        
        document.getElementById('detail-modal').addEventListener('click', function(e) {
            if (e.target === this) closeModal();
        });
        
        loadReports();
    </script>
</body>
</html>
"""

if __name__ == '__main__':
    print("工时填报校验台启动中...")
    print("访问地址: http://localhost:5001")
    app.run(debug=True, host='0.0.0.0', port=5001)
