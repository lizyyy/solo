from flask import Flask, render_template, jsonify, request, send_file, redirect, url_for
from datetime import datetime
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from data_parser import DataParser
from metrics_calculator import MetricsCalculator
from rules_engine import RulesEngine, RiskLevel
from storage_manager import StorageManager, ProcessingStatus
from exporter import Exporter
import config

app = Flask(__name__)
app.secret_key = 'dialysis-alert-system-2026'

data_parser = DataParser()
storage_manager = StorageManager()
exporter = Exporter()

metrics_cached_analysis_result = None
_cached_machine_metrics = None
_cached_water_metrics = None
_cached_patient_metrics = None


def serialize_datetime(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: serialize_datetime(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [serialize_datetime(item) for item in obj]
    return obj


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/load-data', methods=['POST'])
def load_data():
    try:
        data_parser.load_all_from_directory()
        
        if data_parser.machine_records is None:
            return jsonify({'success': False, 'error': '未找到机器记录数据'})
        
        metrics_calc = MetricsCalculator(data_parser)
        machine_metrics = metrics_calc.calculate_machine_load()
        water_metrics = metrics_calc.calculate_water_quality_status()
        patient_metrics = metrics_calc.calculate_patient_risk_alignment()
        
        rules_engine = RulesEngine(metrics_calc, data_parser)
        analysis_result = rules_engine.run_all_checks()
        
        global _cached_analysis_result, _cached_machine_metrics, _cached_water_metrics, _cached_patient_metrics
        _cached_analysis_result = analysis_result
        _cached_machine_metrics = machine_metrics
        _cached_water_metrics = water_metrics
        _cached_patient_metrics = patient_metrics
        
        for rec in analysis_result.get('recommendations', []):
            storage_manager.create_alert_record(rec['alert_id'], rec)
        
        session_data = {
            'total_alerts': analysis_result.get('total_alerts', 0),
            'risk_counts': analysis_result.get('risk_counts', {}),
            'timestamp': datetime.now().isoformat()
        }
        storage_manager.save_session(session_data)
        
        return jsonify({
            'success': True,
            'message': '数据加载成功',
            'data': {
                'risk_counts': analysis_result.get('risk_counts', {}),
                'total_alerts': analysis_result.get('total_alerts', 0),
                'machine_count': len(machine_metrics.get('machines', [])),
                'patient_count': patient_metrics.get('total_patients', 0),
                'high_risk_patient_count': patient_metrics.get('high_risk_count', 0)
            }
        })
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/dashboard')
def get_dashboard():
    global _cached_analysis_result, _cached_machine_metrics, _cached_water_metrics, _cached_patient_metrics
    
    if _cached_analysis_result is None:
        return jsonify({
            'success': False,
            'error': '请先加载数据'
        })
    
    risk_counts = _cached_analysis_result.get('risk_counts', {})
    recommendations = _cached_analysis_result.get('recommendations', [])
    
    load_matrix = _cached_machine_metrics.get('load_matrix', {}) if _cached_machine_metrics else {}
    machines = _cached_machine_metrics.get('machines', []) if _cached_machine_metrics else []
    dates = _cached_machine_metrics.get('dates', []) if _cached_machine_metrics else []
    
    heatmap_data = []
    for machine_id, daily_load in load_matrix.items():
        row = {'machine_id': machine_id}
        for date in dates:
            hours = daily_load.get(date, 0)
            row[str(date)] = hours
        heatmap_data.append(row)
    
    water_status = {
        'overall_status': _cached_water_metrics.get('overall_status', 'unknown') if _cached_water_metrics else 'unknown',
        'latest_time': _cached_water_metrics.get('latest_test_time', '').isoformat() if _cached_water_metrics and _cached_water_metrics.get('latest_test_time') else '',
        'anomalies': serialize_datetime(_cached_water_metrics.get('anomalies', [])) if _cached_water_metrics else []
    }
    
    patient_stats = {
        'total': _cached_patient_metrics.get('total_patients', 0) if _cached_patient_metrics else 0,
        'high_risk': _cached_patient_metrics.get('high_risk_count', 0) if _cached_patient_metrics else 0,
        'risk_sessions': serialize_datetime(_cached_patient_metrics.get('risk_sessions', [])) if _cached_patient_metrics else []
    }
    
    alert_records = storage_manager.get_all_alert_records()
    alert_records_dict = [r.to_dict() for r in alert_records]
    
    return jsonify({
        'success': True,
        'data': {
            'risk_counts': risk_counts,
            'recommendations': serialize_datetime(recommendations),
            'heatmap': {
                'machines': machines,
                'dates': [str(d) for d in dates],
                'data': heatmap_data
            },
            'water_status': water_status,
            'patient_stats': patient_stats,
            'alert_records': alert_records_dict
        }
    })


@app.route('/api/alerts/update-status', methods=['POST'])
def update_alert_status():
    data = request.json
    alert_id = data.get('alert_id')
    status_value = data.get('status')
    processed_by = data.get('processed_by', '')
    notes = data.get('notes', '')
    actions_taken = data.get('actions_taken', [])
    
    try:
        status = ProcessingStatus(status_value)
    except ValueError:
        return jsonify({'success': False, 'error': '无效的状态值'})
    
    record = storage_manager.update_alert_status(
        alert_id=alert_id,
        status=status,
        processed_by=processed_by,
        notes=notes,
        actions_taken=actions_taken
    )
    
    if record:
        return jsonify({
            'success': True,
            'message': '状态更新成功',
            'record': record.to_dict()
        })
    else:
        return jsonify({'success': False, 'error': '未找到该预警记录'})


@app.route('/api/export/markdown')
def export_markdown():
    global _cached_analysis_result, _cached_machine_metrics, _cached_water_metrics, _cached_patient_metrics
    
    if _cached_analysis_result is None:
        return jsonify({'success': False, 'error': '请先加载数据'})
    
    try:
        alert_records = storage_manager.get_all_alert_records()
        alert_records_dict = [r.to_dict() for r in alert_records]
        
        filepath = exporter.export_markdown_brief(
            _cached_analysis_result,
            _cached_machine_metrics or {},
            _cached_water_metrics or {},
            _cached_patient_metrics or {}
        )
        
        return send_file(
            filepath,
            as_attachment=True,
            download_name=os.path.basename(filepath),
            mimetype='text/markdown'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/export/csv')
def export_csv():
    global _cached_analysis_result
    
    if _cached_analysis_result is None:
        return jsonify({'success': False, 'error': '请先加载数据'})
    
    try:
        filepath = exporter.export_csv_adjustments(
            _cached_analysis_result.get('recommendations', [])
        )
        
        return send_file(
            filepath,
            as_attachment=True,
            download_name=os.path.basename(filepath),
            mimetype='text/csv'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/export/json')
def export_json():
    global _cached_analysis_result, _cached_machine_metrics, _cached_water_metrics, _cached_patient_metrics
    
    if _cached_analysis_result is None:
        return jsonify({'success': False, 'error': '请先加载数据'})
    
    try:
        alert_records = storage_manager.get_all_alert_records()
        alert_records_dict = [r.to_dict() for r in alert_records]
        
        filepath = exporter.export_json_audit(
            _cached_analysis_result,
            _cached_machine_metrics or {},
            _cached_water_metrics or {},
            _cached_patient_metrics or {},
            alert_records_dict
        )
        
        return send_file(
            filepath,
            as_attachment=True,
            download_name=os.path.basename(filepath),
            mimetype='application/json'
        )
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/export/all')
def export_all():
    global _cached_analysis_result, _cached_machine_metrics, _cached_water_metrics, _cached_patient_metrics
    
    if _cached_analysis_result is None:
        return jsonify({'success': False, 'error': '请先加载数据'})
    
    try:
        alert_records = storage_manager.get_all_alert_records()
        alert_records_dict = [r.to_dict() for r in alert_records]
        
        filepaths = exporter.export_all(
            _cached_analysis_result,
            _cached_machine_metrics or {},
            _cached_water_metrics or {},
            _cached_patient_metrics or {},
            alert_records_dict
        )
        
        return jsonify({
            'success': True,
            'message': '导出成功',
            'files': {
                'markdown': os.path.basename(filepaths['markdown']),
                'csv': os.path.basename(filepaths['csv']),
                'json': os.path.basename(filepaths['json'])
            }
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/api/sessions')
def get_sessions():
    sessions = storage_manager.get_recent_sessions(limit=10)
    return jsonify({
        'success': True,
        'sessions': sessions
    })


@app.route('/api/audit-logs')
def get_audit_logs():
    date = request.args.get('date')
    logs = storage_manager.get_audit_logs(date)
    return jsonify({
        'success': True,
        'logs': logs
    })


def create_templates():
    templates_dir = os.path.join(os.path.dirname(__file__), 'templates')
    os.makedirs(templates_dir, exist_ok=True)
    
    index_html = '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>透析排班水处理预警台</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: #f5f7fa;
            color: #333;
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem 2rem;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .header h1 {
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
        }
        
        .header p {
            opacity: 0.9;
            font-size: 0.9rem;
        }
        
        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 1.5rem;
        }
        
        .action-bar {
            background: white;
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 1.5rem;
            display: flex;
            gap: 1rem;
            align-items: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .btn {
            padding: 0.6rem 1.2rem;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 0.9rem;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
        }
        
        .btn-primary:hover {
            opacity: 0.9;
            transform: translateY(-1px);
        }
        
        .btn-success {
            background: #10b981;
            color: white;
        }
        
        .btn-success:hover {
            background: #059669;
        }
        
        .btn-warning {
            background: #f59e0b;
            color: white;
        }
        
        .btn-warning:hover {
            background: #d97706;
        }
        
        .btn-danger {
            background: #ef4444;
            color: white;
        }
        
        .btn-danger:hover {
            background: #dc2626;
        }
        
        .btn-secondary {
            background: #6b7280;
            color: white;
        }
        
        .btn-secondary:hover {
            background: #4b5563;
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
        }
        
        .stat-card {
            background: white;
            padding: 1.2rem;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .stat-card h3 {
            font-size: 0.85rem;
            color: #6b7280;
            margin-bottom: 0.5rem;
        }
        
        .stat-card .value {
            font-size: 2rem;
            font-weight: bold;
        }
        
        .stat-card.critical .value { color: #ef4444; }
        .stat-card.high .value { color: #f59e0b; }
        .stat-card.medium .value { color: #3b82f6; }
        .stat-card.normal .value { color: #10b981; }
        
        .dashboard-section {
            background: white;
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
        }
        
        .section-title {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 1rem;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .heatmap-container {
            overflow-x: auto;
        }
        
        .heatmap-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
        }
        
        .heatmap-table th,
        .heatmap-table td {
            padding: 0.75rem;
            text-align: center;
            border: 1px solid #e5e7eb;
        }
        
        .heatmap-table th {
            background: #f9fafb;
            font-weight: 600;
        }
        
        .heatmap-cell {
            position: relative;
            font-weight: 500;
        }
        
        .heatmap-cell.low { background: #dcfce7; color: #166534; }
        .heatmap-cell.medium { background: #fef08a; color: #854d0e; }
        .heatmap-cell.high { background: #fed7aa; color: #9a3412; }
        .heatmap-cell.critical { background: #fecaca; color: #991b1b; }
        
        .alert-list {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }
        
        .alert-item {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 1rem;
            transition: all 0.2s;
        }
        
        .alert-item:hover {
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .alert-item.critical { border-left: 4px solid #ef4444; }
        .alert-item.high { border-left: 4px solid #f59e0b; }
        .alert-item.medium { border-left: 4px solid #3b82f6; }
        
        .alert-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 0.5rem;
        }
        
        .alert-title {
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .badge {
            padding: 0.2rem 0.6rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .badge-critical { background: #fee2e2; color: #991b1b; }
        .badge-high { background: #fef3c7; color: #92400e; }
        .badge-medium { background: #dbeafe; color: #1e40af; }
        .badge-low { background: #dcfce7; color: #166534; }
        
        .alert-description {
            color: #6b7280;
            font-size: 0.9rem;
            margin-bottom: 0.5rem;
        }
        
        .alert-recommendation {
            background: #f9fafb;
            padding: 0.75rem;
            border-radius: 4px;
            font-size: 0.85rem;
            color: #374151;
        }
        
        .alert-actions {
            display: flex;
            gap: 0.5rem;
            margin-top: 0.75rem;
        }
        
        .status-badge {
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
        }
        
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-in_progress { background: #dbeafe; color: #1e40af; }
        .status-resolved { background: #dcfce7; color: #166534; }
        .status-dismissed { background: #e5e7eb; color: #4b5563; }
        .status-deferred { background: #f3e8ff; color: #6b21a8; }
        
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }
        
        .modal.show {
            display: flex;
        }
        
        .modal-content {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        }
        
        .modal-title {
            font-size: 1.2rem;
            font-weight: 600;
            margin-bottom: 1.5rem;
        }
        
        .form-group {
            margin-bottom: 1rem;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            font-weight: 500;
        }
        
        .form-group select,
        .form-group input,
        .form-group textarea {
            width: 100%;
            padding: 0.6rem;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            font-size: 0.9rem;
        }
        
        .form-group textarea {
            resize: vertical;
            min-height: 80px;
        }
        
        .modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 0.75rem;
            margin-top: 1.5rem;
        }
        
        .water-status {
            display: flex;
            align-items: center;
            gap: 1rem;
        }
        
        .water-indicator {
            width: 20px;
            height: 20px;
            border-radius: 50%;
        }
        
        .water-normal { background: #10b981; }
        .water-warning { background: #f59e0b; }
        .water-critical { background: #ef4444; }
        .water-unknown { background: #6b7280; }
        
        .loading {
            text-align: center;
            padding: 2rem;
            color: #6b7280;
        }
        
        .toast {
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            padding: 1rem 1.5rem;
            border-radius: 6px;
            color: white;
            font-weight: 500;
            z-index: 2000;
            animation: slideIn 0.3s ease;
        }
        
        .toast.success { background: #10b981; }
        .toast.error { background: #ef4444; }
        .toast.info { background: #3b82f6; }
        
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        .tab-container {
            margin-bottom: 1rem;
        }
        
        .tabs {
            display: flex;
            border-bottom: 2px solid #e5e7eb;
            margin-bottom: 1rem;
        }
        
        .tab {
            padding: 0.75rem 1.5rem;
            cursor: pointer;
            border-bottom: 2px solid transparent;
            margin-bottom: -2px;
            transition: all 0.2s;
        }
        
        .tab:hover {
            color: #667eea;
        }
        
        .tab.active {
            color: #667eea;
            border-bottom-color: #667eea;
            font-weight: 600;
        }
        
        .tab-content {
            display: none;
        }
        
        .tab-content.active {
            display: block;
        }
        
        .two-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5rem;
        }
        
        @media (max-width: 1024px) {
            .two-column {
                grid-template-columns: 1fr;
            }
        }
        
        .patient-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
        }
        
        .patient-table th,
        .patient-table td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .patient-table th {
            background: #f9fafb;
            font-weight: 600;
        }
        
        .patient-table tr:hover {
            background: #f9fafb;
        }
        
        .risk-tag {
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
        }
        
        .risk-hepatitis-b { background: #fee2e2; color: #991b1b; }
        .risk-hepatitis-c { background: #fef3c7; color: #92400e; }
        .risk-syphilis { background: #dbeafe; color: #1e40af; }
        .risk-hiv { background: #f3e8ff; color: #6b21a8; }
    </style>
</head>
<body>
    <div class="header">
        <h1>透析排班水处理预警台</h1>
        <p>血液透析室 - 数据分析与风险预警系统</p>
    </div>
    
    <div class="container">
        <div class="action-bar">
            <button class="btn btn-primary" onclick="loadData()">
                <span>📊</span> 加载示例数据
            </button>
            <div style="flex: 1;"></div>
            <button class="btn btn-success" onclick="exportAll()">
                <span>📄</span> 导出全部
            </button>
            <button class="btn btn-warning" onclick="exportMarkdown()">
                <span>📝</span> 导出简报
            </button>
            <button class="btn btn-secondary" onclick="exportCsv()">
                <span>📋</span> 导出调整单
            </button>
            <button class="btn btn-danger" onclick="exportJson()">
                <span>📦</span> 导出审计包
            </button>
        </div>
        
        <div id="stats-container" class="stats-grid" style="display: none;">
            <div class="stat-card critical">
                <h3>🔴 紧急风险</h3>
                <div class="value" id="stat-critical">0</div>
            </div>
            <div class="stat-card high">
                <h3>🟠 高危风险</h3>
                <div class="value" id="stat-high">0</div>
            </div>
            <div class="stat-card medium">
                <h3>🟡 中危风险</h3>
                <div class="value" id="stat-medium">0</div>
            </div>
            <div class="stat-card normal">
                <h3>🟢 透析机总数</h3>
                <div class="value" id="stat-machines">0</div>
            </div>
            <div class="stat-card normal">
                <h3>👥 患者总数</h3>
                <div class="value" id="stat-patients">0</div>
            </div>
            <div class="stat-card high">
                <h3>⚠️ 高风险患者</h3>
                <div class="value" id="stat-high-risk-patients">0</div>
            </div>
        </div>
        
        <div id="dashboard-content" style="display: none;">
            <div class="two-column">
                <div class="dashboard-section">
                    <div class="section-title">📈 机器负荷热图</div>
                    <div class="heatmap-container">
                        <table class="heatmap-table" id="heatmap-table">
                        </table>
                    </div>
                    <div style="margin-top: 1rem; font-size: 0.8rem; color: #6b7280;">
                        <span style="display: inline-flex; align-items: center; gap: 0.3rem; margin-right: 1rem;">
                            <span style="width: 16px; height: 16px; background: #dcfce7; display: inline-block;"></span> 正常 (<8h
                        </span>
                        <span style="display: inline-flex; align-items: center; gap: 0.3rem; margin-right: 1rem;">
                            <span style="width: 16px; height: 16px; background: #fef08a; display: inline-block;"></span> 中等 (8-10h)
                        </span>
                        <span style="display: inline-flex; align-items: center; gap: 0.3rem; margin-right: 1rem;">
                            <span style="width: 16px; height: 16px; background: #fed7aa; display: inline-block;"></span> 较高 (10-12h)
                        </span>
                        <span style="display: inline-flex; align-items: center; gap: 0.3rem;">
                            <span style="width: 16px; height: 16px; background: #fecaca; display: inline-block;"></span> 超负荷 (>12h)
                        </span>
                    </div>
                </div>
                
                <div class="dashboard-section">
                    <div class="section-title">💧 水质检测状态</div>
                    <div id="water-status-container"></div>
                </div>
            </div>
            
            <div class="dashboard-section">
                <div class="tab-container">
                    <div class="tabs">
                        <div class="tab active" onclick="switchTab('alerts')">风险预警列表</div>
                        <div class="tab" onclick="switchTab('patients')">高风险患者</div>
                    </div>
                    
                    <div id="tab-alerts" class="tab-content active">
                        <div class="alert-list" id="alert-list"></div>
                    </div>
                    
                    <div id="tab-patients" class="tab-content">
                        <div id="patients-container"></div>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="empty-state" class="dashboard-section" style="text-align: center; padding: 3rem;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">📊</div>
            <h2 style="margin-bottom: 0.5rem; color: #6b7280;">暂无数据</h2>
            <p style="color: #9ca3af;">请点击上方"加载示例数据"按钮开始分析</p>
        </div>
    </div>
    
    <div id="status-modal" class="modal">
        <div class="modal-content">
            <div class="modal-title">更新预警状态</div>
            <div class="form-group">
                <label>预警ID</label>
                <input type="text" id="modal-alert-id" readonly>
            </div>
            <div class="form-group">
                <label>新状态</label>
                <select id="modal-status">
                    <option value="pending">待处理</option>
                    <option value="in_progress">处理中</option>
                    <option value="resolved">已解决</option>
                    <option value="dismissed">已忽略</option>
                    <option value="deferred">已延期</option>
                </select>
            </div>
            <div class="form-group">
                <label>处理人</label>
                <input type="text" id="modal-processed-by" placeholder="请输入处理人姓名">
            </div>
            <div class="form-group">
                <label>备注</label>
                <textarea id="modal-notes" placeholder="请输入处理备注"></textarea>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal()">取消</button>
                <button class="btn btn-primary" onclick="submitStatusUpdate()">确认更新</button>
            </div>
        </div>
    </div>
    
    <script>
        let currentAlertId = null;
        
        async function loadData() {
            showToast('正在加载数据...', 'info');
            
            try {
                const response = await fetch('/api/load-data', { method: 'POST' });
                const result = await response.json();
                
                if (result.success) {
                    showToast('数据加载成功！', 'success');
                    document.getElementById('stats-container').style.display = 'grid';
                    document.getElementById('dashboard-content').style.display = 'block';
                    document.getElementById('empty-state').style.display = 'none';
                    
                    updateStats(result.data);
                    await loadDashboard();
                } else {
                    showToast('加载失败: ' + result.error, 'error');
                }
            } catch (error) {
                showToast('网络错误: ' + error.message, 'error');
            }
        }
        
        function updateStats(data) {
            document.getElementById('stat-critical').textContent = data.risk_counts.critical || 0;
            document.getElementById('stat-high').textContent = data.risk_counts.high || 0;
            document.getElementById('stat-medium').textContent = data.risk_counts.medium || 0;
            document.getElementById('stat-machines').textContent = data.machine_count || 0;
            document.getElementById('stat-patients').textContent = data.patient_count || 0;
            document.getElementById('stat-high-risk-patients').textContent = data.high_risk_patient_count || 0;
        }
        
        async function loadDashboard() {
            try {
                const response = await fetch('/api/dashboard');
                const result = await response.json();
                
                if (result.success) {
                    renderHeatmap(result.data.heatmap);
                    renderWaterStatus(result.data.water_status);
                    renderAlerts(result.data.recommendations, result.data.alert_records);
                    renderPatients(result.data.patient_stats);
                }
            } catch (error) {
                showToast('加载仪表板失败: ' + error.message, 'error');
            }
        }
        
        function renderHeatmap(heatmap) {
            const table = document.getElementById('heatmap-table');
            if (!heatmap.dates || heatmap.dates.length === 0) {
                table.innerHTML = '<tr><td class="loading">暂无负荷数据</td></tr>';
                return;
            }
            
            let html = '<thead><tr><th>机器ID</th>';
            heatmap.dates.forEach(date => {
                html += `<th>${date}</th>`;
            });
            html += '</tr></thead><tbody>';
            
            heatmap.data.forEach(row => {
                html += `<tr><td><strong>${row.machine_id}</strong></td>`;
                heatmap.dates.forEach(date => {
                    const hours = row[date] || 0;
                    let cellClass = 'low';
                    if (hours > 12) cellClass = 'critical';
                    else if (hours > 10) cellClass = 'high';
                    else if (hours > 8) cellClass = 'medium';
                    
                    html += `<td class="heatmap-cell ${cellClass}">${hours.toFixed(1)}h</td>`;
                });
                html += '</tr>';
            });
            
            html += '</tbody>';
            table.innerHTML = html;
        }
        
        function renderWaterStatus(waterStatus) {
            const container = document.getElementById('water-status-container');
            
            let statusClass = 'water-unknown';
            let statusText = '未知';
            
            switch (waterStatus.overall_status) {
                case 'normal':
                    statusClass = 'water-normal';
                    statusText = '正常';
                    break;
                case 'warning':
                    statusClass = 'water-warning';
                    statusText = '异常';
                    break;
                case 'critical':
                    statusClass = 'water-critical';
                    statusText = '严重异常';
                    break;
            }
            
            let html = `
                <div class="water-status" style="margin-bottom: 1rem;">
                    <div class="water-indicator ${statusClass}"></div>
                    <div>
                        <div style="font-weight: 600;">当前状态: ${statusText}</div>
                        <div style="font-size: 0.85rem; color: #6b7280;">
                            最新检测: ${waterStatus.latest_time || '无数据'}
                        </div>
                    </div>
                </div>
            `;
            
            if (waterStatus.anomalies && waterStatus.anomalies.length > 0) {
                html += '<div style="margin-top: 1rem;"><strong style="color: #ef4444;">异常参数:</strong><ul style="margin-top: 0.5rem; padding-left: 1.5rem;">';
                waterStatus.anomalies.forEach(anomaly => {
                    const paramName = {
                        'conductivity': '电导率',
                        'bacteria_count': '细菌数',
                        'endotoxin': '内毒素'
                    }[anomaly.parameter] || anomaly.parameter;
                    html += `<li style="margin-bottom: 0.25rem;">${paramName}: ${anomaly.value} (阈值: ${anomaly.threshold})</li>`;
                });
                html += '</ul></div>';
            }
            
            container.innerHTML = html;
        }
        
        function renderAlerts(recommendations, alertRecords) {
            const container = document.getElementById('alert-list');
            
            if (!recommendations || recommendations.length === 0) {
                container.innerHTML = '<div class="loading">暂无风险预警</div>';
                return;
            }
            
            const recordsMap = {};
            alertRecords.forEach(r => {
                recordsMap[r.alert_id] = r;
            });
            
            let html = '';
            recommendations.forEach(rec => {
                const record = recordsMap[rec.alert_id];
                const statusBadgeClass = `status-${record?.status || 'pending'}`.replace('_', '-');
                const statusText = {
                    'pending': '待处理',
                    'in_progress': '处理中',
                    'resolved': '已解决',
                    'dismissed': '已忽略',
                    'deferred': '已延期'
                }[record?.status || 'pending'];
                
                const categoryText = {
                    'high_load': '机器高负荷',
                    'consecutive_overuse': '连续超负荷运行',
                    'disinfection_violation': '消毒间隔违规',
                    'water_quality_anomaly': '水质异常',
                    'high_risk_patient_water_risk': '高风险患者水质风险',
                    'unresolved_maintenance': '未解决故障',
                    'session_during_unresolved_fault': '故障期间安排透析',
                    'session_near_maintenance': '维修时间冲突'
                }[rec.category] || rec.category;
                
                html += `
                    <div class="alert-item ${rec.risk_level}">
                        <div class="alert-header">
                            <div class="alert-title">
                                <span class="badge badge-${rec.risk_level}">${rec.risk_level.toUpperCase()}</span>
                                ${categoryText}
                                <span style="font-size: 0.8rem; color: #6b7280;">(涉及: ${rec.machine_id || '无'}${rec.patient_id ? ` / 患者: ${rec.patient_id}` : ''})</span>
                            </div>
                            <span class="status-badge ${statusBadgeClass}">${statusText}</span>
                        </div>
                        <div class="alert-description">${rec.problem}</div>
                        <div class="alert-recommendation">
                            <strong>💡 调整建议:</strong> ${rec.recommendation}
                        </div>
                        ${record?.notes ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: #6b7280;">
                            <strong>备注:</strong> ${record.notes}
                        </div>` : ''}
                        <div class="alert-actions">
                            <button class="btn btn-primary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;" onclick="openStatusModal('${rec.alert_id}')">
                                更新状态
                            </button>
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        }
        
        function renderPatients(patientStats) {
            const container = document.getElementById('patients-container');
            
            if (!patientStats.risk_sessions || patientStats.risk_sessions.length === 0) {
                container.innerHTML = '<div class="loading">暂无高风险患者</div>';
                return;
            }
            
            let html = `
                <div style="margin-bottom: 1rem;">
                    <strong>高风险患者数:</strong> ${patientStats.high_risk} / ${patientStats.total}
                </div>
                <table class="patient-table">
                    <thead>
                        <tr>
                            <th>患者ID</th>
                            <th>患者姓名</th>
                            <th>感染类型</th>
                            <th>透析时间</th>
                            <th>机器ID</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            patientStats.risk_sessions.forEach(session => {
                const riskClass = {
                    '乙肝': 'risk-hepatitis-b',
                    '丙肝': 'risk-hepatitis-c',
                    '梅毒': 'risk-syphilis',
                    'HIV': 'risk-hiv'
                }[session.infection_type] || '';
                
                html += `
                    <tr>
                        <td><strong>${session.patient_id}</strong></td>
                        <td>${session.patient_name || '-'}</td>
                        <td><span class="risk-tag ${riskClass}">${session.infection_type}</span></td>
                        <td>${session.treatment_time || '-'}</td>
                        <td>${session.machine_id || '-'}</td>
                    </tr>
                `;
            });
            
            html += '</tbody></table>';
            container.innerHTML = html;
        }
        
        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            event.target.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
        }
        
        function openStatusModal(alertId) {
            currentAlertId = alertId;
            document.getElementById('modal-alert-id').value = alertId;
            document.getElementById('modal-status').value = 'pending';
            document.getElementById('modal-processed-by').value = '';
            document.getElementById('modal-notes').value = '';
            document.getElementById('status-modal').classList.add('show');
        }
        
        function closeModal() {
            document.getElementById('status-modal').classList.remove('show');
            currentAlertId = null;
        }
        
        async function submitStatusUpdate() {
            const status = document.getElementById('modal-status').value;
            const processedBy = document.getElementById('modal-processed-by').value;
            const notes = document.getElementById('modal-notes').value;
            
            try {
                const response = await fetch('/api/alerts/update-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        alert_id: currentAlertId,
                        status: status,
                        processed_by: processedBy,
                        notes: notes
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    showToast('状态更新成功！', 'success');
                    closeModal();
                    await loadDashboard();
                } else {
                    showToast('更新失败: ' + result.error, 'error');
                }
            } catch (error) {
                showToast('网络错误: ' + error.message, 'error');
            }
        }
        
        async function exportMarkdown() {
            window.open('/api/export/markdown', '_blank');
        }
        
        async function exportCsv() {
            window.open('/api/export/csv', '_blank');
        }
        
        async function exportJson() {
            window.open('/api/export/json', '_blank');
        }
        
        async function exportAll() {
            try {
                const response = await fetch('/api/export/all');
                const result = await response.json();
                
                if (result.success) {
                    showToast(`导出成功! 文件: ${result.files.markdown}, ${result.files.csv}, ${result.files.json}`, 'success');
                } else {
                    showToast('导出失败: ' + result.error, 'error');
                }
            } catch (error) {
                showToast('网络错误: ' + error.message, 'error');
            }
        }
        
        function showToast(message, type) {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => {
                toast.remove();
            }, 3000);
        }
        
        document.getElementById('status-modal').addEventListener('click', function(e) {
            if (e.target === this) {
                closeModal();
            }
        });
    </script>
</body>
</html>
'''
    
    index_path = os.path.join(templates_dir, 'index.html')
    with open(index_path, 'w', encoding='utf-8') as f:
        f.write(index_html)


if __name__ == '__main__':
    create_templates()
    print('启动透析排班水处理预警台...')
    print('请在浏览器中访问: http://localhost:5000')
    app.run(debug=True, host='0.0.0.0', port=5000)
