#!/usr/bin/env python3
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from replay_engine import DefrostReplayEngine
from demo_data import (
    create_demo_sampling_interval,
    create_demo_defrost_records_initial,
    create_demo_temperature_calibrations,
    create_demo_manual_correction
)
from models import RecordStatus, UnitCaliber

engine = DefrostReplayEngine()
engine.import_sampling_interval(create_demo_sampling_interval())
engine.import_defrost_records(create_demo_defrost_records_initial())


class KanbanHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/" or parsed.path == "/index.html":
            self.send_html(self.get_kanban_html())
        elif parsed.path == "/api/summary":
            self.send_json(self.get_summary_data())
        elif parsed.path == "/api/records":
            self.send_json(self.get_records_data())
        elif parsed.path.startswith("/api/record/"):
            record_id = parsed.path.split("/")[-1]
            self.send_json(self.get_record_detail_data(record_id))
        elif parsed.path == "/api/unit-note":
            self.send_json(self.get_unit_note_data())
        elif parsed.path == "/api/pending":
            self.send_json(self.get_pending_data())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        global engine
        parsed = urlparse(self.path)
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        data = json.loads(body) if body else {}

        if parsed.path == "/api/supplement-calibration":
            calibrations = create_demo_temperature_calibrations()
            result = engine.supplement_from_calibration(calibrations)
            self.send_json({"message": result, "success": True})
        elif parsed.path == "/api/manual-correction":
            correction = create_demo_manual_correction()
            result = engine.apply_manual_correction(correction)
            self.send_json({"message": result, "success": True})
        elif parsed.path == "/api/rerun":
            result = engine.rerun(data.get("run_by", "老岑"), data.get("description", ""))
            self.send_json({"message": result, "success": True})
        elif parsed.path.startswith("/api/review/"):
            record_id = parsed.path.split("/")[-1]
            result = engine.review_record(
                record_id,
                data.get("reviewed_by", "老岑"),
                data.get("is_normal", False),
                data.get("note", "")
            )
            self.send_json({"message": result, "success": True})
        elif parsed.path == "/api/reset":
            engine = DefrostReplayEngine()
            engine.import_sampling_interval(create_demo_sampling_interval())
            engine.import_defrost_records(create_demo_defrost_records_initial())
            self.send_json({"message": "已重置为初始状态", "success": True})
        else:
            self.send_response(404)
            self.end_headers()

    def send_html(self, content):
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.end_headers()
        self.wfile.write(content.encode('utf-8'))

    def send_json(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, default=str).encode('utf-8'))

    def get_summary_data(self):
        status_counts = {}
        for record in engine.records:
            status_counts[record.status] = status_counts.get(record.status, 0) + 1

        total_energy = sum(r.energy_consumption_kwh for r in engine.records)
        masked_energy = sum(
            r.original_value or r.energy_consumption_kwh
            for r in engine.records
            if r.status == RecordStatus.MASKED_BY_AVERAGE
        )

        return {
            "total_records": len(engine.records),
            "total_energy": round(total_energy, 1),
            "masked_energy": round(masked_energy, 1),
            "threshold": engine.threshold_kwh,
            "status_counts": {k.value: v for k, v in status_counts.items()},
            "sampling_interval": {
                "description": engine.sampling_interval.description if engine.sampling_interval else "",
                "import_note": engine.sampling_interval.import_note if engine.sampling_interval else ""
            },
            "unit_note": engine.unit_conversion.get_conversion_text(),
            "current_caliber": engine.unit_conversion.current_caliber.value
        }

    def get_records_data(self):
        return [
            {
                "id": r.id,
                "start_time": r.start_time.strftime("%Y-%m-%d %H:%M"),
                "end_time": r.end_time.strftime("%H:%M"),
                "duration": r.duration_minutes,
                "energy": r.energy_consumption_kwh,
                "ambient_temp": r.ambient_temp,
                "coil_temp": r.coil_temp,
                "status": r.status.value,
                "status_label": engine._get_status_label(r.status),
                "status_note": r.status_note,
                "threshold_exceeded": r.threshold_exceeded,
                "original_value": r.original_value,
                "masked_value": r.masked_value,
                "supplemented_from": r.supplemented_from,
                "caliber": r.caliber.value,
                "reviewed_by": r.reviewed_by,
                "run_id": r.run_id
            }
            for r in sorted(engine.records, key=lambda x: x.start_time)
        ]

    def get_record_detail_data(self, record_id):
        r = engine._find_record(record_id)
        if not r:
            return {"error": "未找到记录"}
        return {
            "id": r.id,
            "start_time": r.start_time.strftime("%Y-%m-%d %H:%M"),
            "end_time": r.end_time.strftime("%H:%M"),
            "duration": r.duration_minutes,
            "energy": r.energy_consumption_kwh,
            "ambient_temp": r.ambient_temp,
            "coil_temp": r.coil_temp,
            "status": r.status.value,
            "status_label": engine._get_status_label(r.status),
            "status_note": r.status_note,
            "original_value": r.original_value,
            "masked_value": r.masked_value,
            "supplemented_from": r.supplemented_from,
            "caliber": r.caliber.value,
            "caliber_note": r.caliber_note,
            "reviewed_by": r.reviewed_by,
            "reviewed_at": r.reviewed_at.strftime("%Y-%m-%d %H:%M") if r.reviewed_at else None,
            "run_id": r.run_id
        }

    def get_unit_note_data(self):
        return {
            "current_caliber": engine.unit_conversion.current_caliber.value,
            "old_to_new_coefficient": engine.unit_conversion.old_to_new_coefficient,
            "new_to_old_coefficient": engine.unit_conversion.new_to_old_coefficient,
            "conversion_text": engine.unit_conversion.get_conversion_text(),
            "last_updated_at": engine.unit_conversion.last_updated_at.strftime("%Y-%m-%d %H:%M") if engine.unit_conversion.last_updated_at else None,
            "updated_by": engine.unit_conversion.updated_by,
            "update_reason": engine.unit_conversion.update_reason,
            "history": engine.unit_conversion.history
        }

    def get_pending_data(self):
        pending = engine.get_pending_review_records()
        return [
            {
                "id": r.id,
                "start_time": r.start_time.strftime("%H:%M"),
                "energy": r.energy_consumption_kwh,
                "status": r.status.value,
                "status_label": engine._get_status_label(r.status),
                "original_value": r.original_value
            }
            for r in sorted(pending, key=lambda x: x.start_time)
        ]

    def get_kanban_html(self):
        return '''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>热泵除霜能耗复盘 - 老岑师傅的看板</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
    background: #f5f7fa;
    padding: 20px;
    color: #303133;
}
.container { max-width: 1400px; margin: 0 auto; }
.header {
    background: linear-gradient(135deg, #409EFF 0%, #67C23A 100%);
    color: white;
    padding: 20px 30px;
    border-radius: 10px;
    margin-bottom: 20px;
}
.header h1 { font-size: 24px; margin-bottom: 5px; }
.header p { opacity: 0.9; font-size: 14px; }
.cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 15px;
    margin-bottom: 20px;
}
.card {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}
.card .label { font-size: 13px; color: #909399; margin-bottom: 8px; }
.card .value { font-size: 28px; font-weight: bold; color: #303133; }
.card.warning .value { color: #E6A23C; }
.card.danger .value { color: #F56C6C; }
.card.success .value { color: #67C23A; }
.panel {
    background: white;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.1);
}
.panel h2 {
    font-size: 18px;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 2px solid #409EFF;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    margin-left: 8px;
    transition: all 0.3s;
}
.btn-primary { background: #409EFF; color: white; }
.btn-primary:hover { background: #66b1ff; }
.btn-warning { background: #E6A23C; color: white; }
.btn-warning:hover { background: #ebb563; }
.btn-success { background: #67C23A; color: white; }
.btn-success:hover { background: #85ce61; }
.btn-danger { background: #F56C6C; color: white; }
.btn-danger:hover { background: #f78989; }
.btn-info { background: #909399; color: white; }
.btn-info:hover { background: #a6a9ad; }
table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
}
th, td {
    padding: 12px 10px;
    text-align: left;
    border-bottom: 1px solid #ebeef5;
}
th {
    background: #fafafa;
    font-weight: 600;
    color: #606266;
}
tr:hover { background: #f5f7fa; }
.status-badge {
    display: inline-block;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
}
.status-normal { background: #f0f9eb; color: #67C23A; }
.status-over { background: #fdf6ec; color: #E6A23C; }
.status-masked { background: #faecd8; color: #e6a23c; }
.status-supplemented { background: #ecf5ff; color: #409EFF; }
.status-reviewed-ok { background: #f0f9eb; color: #67C23A; }
.status-reviewed-bad { background: #fef0f0; color: #F56C6C; }
.unit-note {
    background: #ecf5ff;
    border-left: 4px solid #409EFF;
    padding: 15px;
    border-radius: 4px;
    margin-bottom: 15px;
    line-height: 1.8;
}
.unit-note.old {
    background: #fdf6ec;
    border-left-color: #E6A23C;
}
.masked-note {
    background: #fef0f0;
    color: #F56C6C;
    padding: 5px 10px;
    border-radius: 4px;
    font-size: 12px;
    display: inline-block;
}
.sampling-info {
    background: #f4f4f5;
    padding: 12px 15px;
    border-radius: 4px;
    margin-bottom: 15px;
    font-size: 13px;
    line-height: 1.6;
}
.actions { display: flex; gap: 8px; }
.detail-panel {
    display: none;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: white;
    padding: 30px;
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 1000;
    max-width: 600px;
    max-height: 80vh;
    overflow-y: auto;
}
.detail-panel.show { display: block; }
.detail-panel h3 { margin-bottom: 15px; color: #409EFF; }
.detail-panel .close {
    position: absolute;
    top: 15px;
    right: 20px;
    font-size: 24px;
    cursor: pointer;
    color: #909399;
}
.mask {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 999;
}
.mask.show { display: block; }
.detail-row {
    display: flex;
    padding: 10px 0;
    border-bottom: 1px solid #ebeef5;
}
.detail-row .key {
    width: 120px;
    color: #909399;
    flex-shrink: 0;
}
.detail-row .value {
    color: #303133;
    flex: 1;
}
.history-note {
    background: #fffbe6;
    border: 1px solid #ffe58f;
    padding: 10px;
    border-radius: 4px;
    margin-top: 10px;
    font-size: 13px;
}
.traffic-light {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 5px;
}
.light-green { background: #67C23A; }
.light-yellow { background: #E6A23C; }
.light-red { background: #F56C6C; }
.light-blue { background: #409EFF; }
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>🔧 热泵除霜能耗复盘 - 老岑师傅的看板</h1>
        <p>返工就要返工在明面上，别偷偷摸摸改数据</p>
    </div>

    <div class="cards" id="statsCards"></div>

    <div class="panel">
        <h2>
            操作面板
            <span>
                <button class="btn btn-primary" onclick="supplementCalibration()">📥 补录温度校准</button>
                <button class="btn btn-warning" onclick="manualCorrection()">✏️ 人工修正</button>
                <button class="btn btn-success" onclick="rerun()">🔄 重跑</button>
                <button class="btn btn-info" onclick="reset()">🔃 重置</button>
            </span>
        </h2>
        <div class="sampling-info" id="samplingInfo"></div>
        <div class="unit-note" id="unitNote"></div>
    </div>

    <div class="panel">
        <h2>
            待复核清单
            <span class="btn btn-danger" id="pendingCount">0 条</span>
        </h2>
        <table id="pendingTable">
            <thead>
                <tr>
                    <th>记录ID</th>
                    <th>时间</th>
                    <th>耗电</th>
                    <th>状态</th>
                    <th>原始值</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>

    <div class="panel">
        <h2>除霜记录明细</h2>
        <table id="recordsTable">
            <thead>
                <tr>
                    <th></th>
                    <th>记录ID</th>
                    <th>时间</th>
                    <th>时长</th>
                    <th>耗电</th>
                    <th>环境温度</th>
                    <th>盘管温度</th>
                    <th>口径</th>
                    <th>状态</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    </div>
</div>

<div class="mask" id="mask" onclick="closeDetail()"></div>
<div class="detail-panel" id="detailPanel">
    <span class="close" onclick="closeDetail()">&times;</span>
    <h3 id="detailTitle">记录详情</h3>
    <div id="detailContent"></div>
    <div style="margin-top: 20px; text-align: right;">
        <button class="btn btn-success" onclick="reviewCurrent(true)">✅ 复核为正常</button>
        <button class="btn btn-danger" onclick="reviewCurrent(false)">❌ 复核为异常</button>
    </div>
</div>

<script>
let currentRecordId = null;

function getStatusClass(status) {
    const map = {
        'normal': 'status-normal',
        'over_threshold': 'status-over',
        'masked_by_average': 'status-masked',
        'supplemented_from_calibration': 'status-supplemented',
        'reviewed_normal': 'status-reviewed-ok',
        'reviewed_abnormal': 'status-reviewed-bad',
        'pending_review': 'status-over'
    };
    return map[status] || 'status-normal';
}

function getTrafficLight(status) {
    if (status === 'normal' || status === 'reviewed_normal') return '<span class="traffic-light light-green"></span>';
    if (status === 'masked_by_average' || status === 'supplemented_from_calibration') return '<span class="traffic-light light-blue"></span>';
    if (status === 'reviewed_abnormal') return '<span class="traffic-light light-red"></span>';
    return '<span class="traffic-light light-yellow"></span>';
}

function loadData() {
    fetch('/api/summary').then(r => r.json()).then(data => {
        const cards = document.getElementById('statsCards');
        cards.innerHTML = `
            <div class="card">
                <div class="label">总记录数</div>
                <div class="value">${data.total_records} 条</div>
            </div>
            <div class="card">
                <div class="label">总耗电量</div>
                <div class="value">${data.total_energy} kWh</div>
            </div>
            <div class="card warning">
                <div class="label">被盖掉的真实能耗</div>
                <div class="value">${data.masked_energy} kWh</div>
            </div>
            <div class="card danger">
                <div class="label">能耗阈值</div>
                <div class="value">${data.threshold} kWh</div>
            </div>
            <div class="card success">
                <div class="label">正常记录</div>
                <div class="value">${data.status_counts.normal || 0} 条</div>
            </div>
            <div class="card warning">
                <div class="label">待复核</div>
                <div class="value">${(data.status_counts.over_threshold || 0) + (data.status_counts.masked_by_average || 0) + (data.status_counts.supplemented_from_calibration || 0)} 条</div>
            </div>
        `;

        const samplingInfo = document.getElementById('samplingInfo');
        samplingInfo.innerHTML = `
            <strong>📊 采样间隔说明：</strong>${data.sampling_interval.description}<br>
            <strong>📝 导入备注：</strong>${data.sampling_interval.import_note}
        `;

        const unitNote = document.getElementById('unitNote');
        unitNote.className = 'unit-note' + (data.current_caliber === 'old' ? ' old' : '');
        unitNote.innerHTML = `<strong>📐 单位换算说明：</strong><br>${data.unit_note.replace(/\\n/g, '<br>')}`;
    });

    fetch('/api/records').then(r => r.json()).then(records => {
        const tbody = document.querySelector('#recordsTable tbody');
        tbody.innerHTML = records.map(r => `
            <tr>
                <td>${getTrafficLight(r.status)}</td>
                <td><code>${r.id}</code></td>
                <td>${r.start_time}</td>
                <td>${r.duration} 分钟</td>
                <td>
                    ${r.energy} kWh
                    ${r.masked_value ? `<br><span class="masked-note">曾被盖为 ${r.masked_value}，原值 ${r.original_value}</span>` : ''}
                </td>
                <td>${r.ambient_temp}°C</td>
                <td>${r.coil_temp}°C</td>
                <td>${r.caliber === 'old' ? '🔴 旧口径' : '🟢 新口径'}</td>
                <td><span class="status-badge ${getStatusClass(r.status)}">${r.status_label}</span></td>
                <td class="actions">
                    <button class="btn btn-primary" onclick="showDetail('${r.id}')">详情</button>
                </td>
            </tr>
        `).join('');
    });

    fetch('/api/pending').then(r => r.json()).then(records => {
        document.getElementById('pendingCount').textContent = records.length + ' 条';
        const tbody = document.querySelector('#pendingTable tbody');
        if (records.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #909399; padding: 20px;">✅ 没有待复核的记录</td></tr>';
        } else {
            tbody.innerHTML = records.map(r => `
                <tr>
                    <td><code>${r.id}</code></td>
                    <td>${r.start_time}</td>
                    <td>${r.energy} kWh</td>
                    <td><span class="status-badge ${getStatusClass(r.status)}">${r.status_label}</span></td>
                    <td>${r.original_value || '-'}</td>
                    <td class="actions">
                        <button class="btn btn-primary" onclick="showDetail('${r.id}')">详情</button>
                        <button class="btn btn-success" onclick="review('${r.id}', true)">正常</button>
                        <button class="btn btn-danger" onclick="review('${r.id}', false)">异常</button>
                    </td>
                </tr>
            `).join('');
        }
    });
}

function showDetail(recordId) {
    currentRecordId = recordId;
    fetch('/api/record/' + recordId).then(r => r.json()).then(data => {
        document.getElementById('detailTitle').textContent = '📋 记录详情：' + data.id;
        let html = `
            <div class="detail-row"><span class="key">时间</span><span class="value">${data.start_time} - ${data.end_time}</span></div>
            <div class="detail-row"><span class="key">时长</span><span class="value">${data.duration} 分钟</span></div>
            <div class="detail-row"><span class="key">耗电</span><span class="value">${data.energy} kWh</span></div>
            <div class="detail-row"><span class="key">环境温度</span><span class="value">${data.ambient_temp}°C</span></div>
            <div class="detail-row"><span class="key">盘管温度</span><span class="value">${data.coil_temp}°C</span></div>
            <div class="detail-row"><span class="key">口径</span><span class="value">${data.caliber} - ${data.caliber_note}</span></div>
            <div class="detail-row"><span class="key">状态</span><span class="value"><span class="status-badge ${getStatusClass(data.status)}">${data.status_label}</span></span></div>
            <div class="detail-row"><span class="key">状态说明</span><span class="value">${data.status_note.replace(/\\n/g, '<br>')}</span></div>
        `;
        if (data.original_value) {
            html += `
                <div class="history-note">
                    <strong>⚠️ 历史痕迹：</strong><br>
                    原始值：${data.original_value} kWh<br>
                    ${data.masked_value ? '曾被盖为：' + data.masked_value + ' kWh' : ''}
                </div>
            `;
        }
        if (data.supplemented_from) {
            html += `
                <div class="history-note">
                    <strong>📎 补录来源：</strong><br>
                    ${data.supplemented_from}
                </div>
            `;
        }
        if (data.reviewed_by) {
            html += `
                <div class="history-note" style="background: #f0f9eb; border-color: #67C23A;">
                    <strong>✅ 复核信息：</strong><br>
                    复核人：${data.reviewed_by}<br>
                    复核时间：${data.reviewed_at || ''}
                </div>
            `;
        }
        html += `<div class="detail-row"><span class="key">批次</span><span class="value">${data.run_id}</span></div>`;
        document.getElementById('detailContent').innerHTML = html;
        document.getElementById('mask').classList.add('show');
        document.getElementById('detailPanel').classList.add('show');
    });
}

function closeDetail() {
    document.getElementById('mask').classList.remove('show');
    document.getElementById('detailPanel').classList.remove('show');
    currentRecordId = null;
}

function supplementCalibration() {
    if (!confirm('确定要补录温度校准记录吗？这会自动切换单位换算说明。')) return;
    fetch('/api/supplement-calibration', { method: 'POST' })
        .then(r => r.json()).then(data => {
            alert(data.message);
            loadData();
        });
}

function manualCorrection() {
    if (!confirm('确定要人工修正被平均值盖掉的记录吗？')) return;
    fetch('/api/manual-correction', { method: 'POST' })
        .then(r => r.json()).then(data => {
            alert(data.message);
            loadData();
        });
}

function rerun() {
    const desc = prompt('请输入重跑说明：', '补录温度校准记录后的重跑');
    if (desc === null) return;
    fetch('/api/rerun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_by: '老岑', description: desc })
    }).then(r => r.json()).then(data => {
        alert(data.message);
        loadData();
    });
}

function reset() {
    if (!confirm('确定要重置为初始状态吗？所有操作都会被清除。')) return;
    fetch('/api/reset', { method: 'POST' })
        .then(r => r.json()).then(data => {
            alert(data.message);
            loadData();
        });
}

function review(recordId, isNormal) {
    const note = prompt('请输入复核说明：', isNormal ? '正常，没问题' : '异常，需要处理');
    if (note === null) return;
    fetch('/api/review/' + recordId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed_by: '老岑', is_normal: isNormal, note: note })
    }).then(r => r.json()).then(data => {
        alert(data.message);
        loadData();
    });
}

function reviewCurrent(isNormal) {
    if (currentRecordId) {
        review(currentRecordId, isNormal);
        closeDetail();
    }
}

loadData();
</script>
</body>
</html>
'''


def run_server(port: int = 8080):
    print(f"🚀 热泵除霜能耗复盘看板已启动")
    print(f"📡 访问地址：http://localhost:{port}")
    print(f"👷 老岑师傅说：打开浏览器看看，有啥问题随时改\n")
    server = HTTPServer(('0.0.0.0', port), KanbanHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 已停止服务器")
        server.server_close()


if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    run_server(port)
