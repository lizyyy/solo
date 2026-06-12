#!/usr/bin/env python3
import os
import sys
from pathlib import Path
from flask import Flask, render_template_string, jsonify, request

sys.path.insert(0, str(Path(__file__).parent))

from core.storage import Storage
from core.engine import InspectionEngine
from core.report import ReportGenerator

app = Flask(__name__)


def get_engine():
    data_dir = os.path.join(os.path.dirname(__file__), "data")
    storage = Storage(data_dir)
    return InspectionEngine(storage)


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>光伏逆变器散热质检系统 - 小看板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f0f2f5;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 {
            color: #1a1a2e;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #16213e;
        }
        .batch-list {
            display: grid;
            gap: 15px;
            margin-bottom: 30px;
        }
        .batch-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .batch-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }
        .batch-card h3 { color: #16213e; margin-bottom: 10px; }
        .batch-meta {
            display: flex;
            gap: 20px;
            color: #666;
            font-size: 14px;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        .badge-pending { background: #fff3cd; color: #856404; }
        .badge-dispute { background: #f8d7da; color: #721c24; }
        .badge-ready { background: #d1ecf1; color: #0c5460; }
        .badge-normal { background: #d4edda; color: #155724; }
        .badge-confirmed { background: #e2e3e5; color: #383d41; }
        .detail-section {
            background: white;
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .detail-section h2 {
            color: #16213e;
            margin-bottom: 15px;
            font-size: 18px;
        }
        .abnormal-card {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 12px;
            border-left: 4px solid #e74c3c;
        }
        .abnormal-card.dispute { border-left-color: #f39c12; }
        .abnormal-card.ready { border-left-color: #3498db; }
        .abnormal-card.resolved { border-left-color: #27ae60; }
        .abnormal-card.confirmed-normal { border-left-color: #95a5a6; background: #fafafa; }
        .abnormal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .abnormal-header h4 { color: #2c3e50; }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 10px;
            margin-top: 10px;
        }
        .info-item {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 6px;
        }
        .info-item label {
            display: block;
            font-size: 12px;
            color: #666;
            margin-bottom: 4px;
        }
        .info-item value {
            font-weight: 500;
            color: #333;
        }
        .timeline {
            position: relative;
            padding-left: 30px;
        }
        .timeline::before {
            content: '';
            position: absolute;
            left: 8px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: #e0e0e0;
        }
        .timeline-item {
            position: relative;
            margin-bottom: 20px;
        }
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -26px;
            top: 4px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #3498db;
            border: 2px solid white;
            box-shadow: 0 0 0 2px #3498db;
        }
        .timeline-time {
            font-size: 12px;
            color: #999;
        }
        .timeline-content {
            background: #f8f9fa;
            padding: 12px;
            border-radius: 6px;
            margin-top: 5px;
        }
        .tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        .tab {
            padding: 10px 20px;
            background: #e9ecef;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            transition: all 0.2s;
        }
        .tab.active {
            background: #16213e;
            color: white;
        }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .back-btn {
            background: #6c757d;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 20px;
        }
        .back-btn:hover { background: #5a6268; }
        .field-quote {
            background: #fff3cd;
            border-left: 3px solid #ffc107;
            padding: 8px 12px;
            margin: 8px 0;
            font-style: italic;
            color: #856404;
        }
        .evidence-tag {
            display: inline-block;
            background: #e8f4fd;
            color: #0c5460;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 12px;
            margin-right: 5px;
        }
        .handler-tag {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 15px;
            font-size: 12px;
            font-weight: 500;
        }
        .handler-teacher { background: #d4edda; color: #155724; }
        .handler-xiaobai { background: #d1ecf1; color: #0c5460; }
        .missing-list {
            color: #721c24;
            background: #f8d7da;
            padding: 8px 12px;
            border-radius: 6px;
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>☀️ 光伏逆变器散热质检系统 - 小看板</h1>

        <div id="batchListView">
            <h2 style="margin-bottom: 15px; color: #333;">质检批次列表</h2>
            <div class="batch-list" id="batchList"></div>
        </div>

        <div id="batchDetailView" style="display: none;">
            <button class="back-btn" onclick="showBatchList()">← 返回批次列表</button>
            <div id="batchDetail"></div>
        </div>
    </div>

    <script>
        let currentBatchId = null;

        function loadBatches() {
            fetch('/api/batches')
                .then(r => r.json())
                .then(data => {
                    const html = data.map(b => `
                        <div class="batch-card" onclick="showBatchDetail('${b.id}')">
                            <h3>${b.name}</h3>
                            <div class="batch-meta">
                                <span>ID: ${b.id}</span>
                                <span>状态: ${b.status}</span>
                                <span>异常: ${b.abnormal_count} 条</span>
                            </div>
                        </div>
                    `).join('');
                    document.getElementById('batchList').innerHTML = html;
                });
        }

        function showBatchList() {
            document.getElementById('batchListView').style.display = 'block';
            document.getElementById('batchDetailView').style.display = 'none';
            currentBatchId = null;
        }

        function showBatchDetail(batchId) {
            currentBatchId = batchId;
            document.getElementById('batchListView').style.display = 'none';
            document.getElementById('batchDetailView').style.display = 'block';

            fetch(`/api/batch/${batchId}`)
                .then(r => r.json())
                .then(data => {
                    renderBatchDetail(data);
                });
        }

        function renderBatchDetail(data) {
            const abnormalRecords = data.abnormal_records;
            const auditLogs = data.audit_logs;

            const statusBadge = (s) => {
                const map = {
                    '待处理': 'badge-pending',
                    '缺材料': 'badge-pending',
                    '待复核': 'badge-ready',
                    '有争议': 'badge-dispute',
                    '已解决': 'badge-normal',
                    '已确认正常': 'badge-confirmed'
                };
                return `<span class="badge ${map[s] || 'badge-pending'}">${s}</span>`;
            };

            const handlerBadge = (h) => {
                if (h === '实验老师') return `<span class="handler-tag handler-teacher">👨‍🔬 ${h}</span>`;
                if (h === '质检员小白') return `<span class="handler-tag handler-xiaobai">👩‍💼 ${h}</span>`;
                return `<span class="handler-tag">${h}</span>`;
            };

            const abnormalHtml = abnormalRecords.map((r, i) => {
                let cardClass = '';
                if (r.status === '有争议') cardClass = 'dispute';
                else if (r.status === '待复核') cardClass = 'ready';
                else if (r.status === '已解决') cardClass = 'resolved';
                else if (r.status === '已确认正常') cardClass = 'confirmed-normal';

                return `
                    <div class="abnormal-card ${cardClass}">
                        <div class="abnormal-header">
                            <h4>【${i+1}】${r.point_name}（${r.point_id}）</h4>
                            ${statusBadge(r.status)}
                        </div>
                        <div style="margin-bottom: 8px;">
                            <strong>🧭 方向判定：</strong>${r.direction_status}
                        </div>
                        ${r.is_field_dispute ? `
                            <div class="field-quote">
                                ⚠️ 现场表述争议：师傅说「${r.direction_field_text}」，应为「负方向」
                            </div>
                        ` : ''}
                        <div>
                            <strong>❓ 为什么留下：</strong>${r.keep_reason}
                        </div>
                        ${r.field_mention ? `
                            <div style="margin-top: 8px; color: #666;">
                                <strong>🗣️ 现场说法：</strong>${r.field_mention}
                            </div>
                        ` : ''}
                        ${r.missing_materials.length > 0 ? `
                            <div class="missing-list">
                                📦 还缺：${r.missing_materials.join('、')}
                            </div>
                        ` : ''}
                        <div class="info-grid">
                            <div class="info-item">
                                <label>下一步找谁</label>
                                <value>${handlerBadge(r.next_handler)}</value>
                            </div>
                            <div class="info-item">
                                <label>证据来源</label>
                                <value>${r.evidence_sources.map(e => `<span class="evidence-tag">${e}</span>`).join('')}</value>
                            </div>
                        </div>
                        ${r.notes ? `
                            <div style="margin-top: 10px; padding: 8px; background: #f0f0f0; border-radius: 4px;">
                                📝 ${r.notes}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('');

            const auditHtml = auditLogs.map(log => `
                <div class="timeline-item">
                    <div class="timeline-time">${log.timestamp} | ${log.operator}</div>
                    <div class="timeline-content">
                        <strong>${log.action}</strong>
                        <div style="margin-top: 5px; font-size: 14px;">
                            ${log.field_changed}：${log.old_value} → ${log.new_value}
                        </div>
                        <div style="margin-top: 5px; color: #666; font-size: 13px;">
                            原因：${log.reason}
                        </div>
                        ${log.affected_results.length > 0 ? `
                            <div style="margin-top: 5px; font-size: 12px; color: #0c5460;">
                                影响：${log.affected_results.join('、')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('');

            const html = `
                <div class="detail-section">
                    <h2>📋 批次概况</h2>
                    <div class="info-grid">
                        <div class="info-item">
                            <label>批次名称</label>
                            <value>${data.name}</value>
                        </div>
                        <div class="info-item">
                            <label>批次ID</label>
                            <value>${data.id}</value>
                        </div>
                        <div class="info-item">
                            <label>当前状态</label>
                            <value>${data.status}</value>
                        </div>
                        <div class="info-item">
                            <label>分析轮次</label>
                            <value>${data.run_count} 次</value>
                        </div>
                        <div class="info-item">
                            <label>维修群截图</label>
                            <value>${data.repair_count} 份</value>
                        </div>
                        <div class="info-item">
                            <label>采样间隔说明</label>
                            <value>${data.sampling_count} 份</value>
                        </div>
                    </div>
                </div>

                <div class="tabs">
                    <button class="tab active" onclick="switchTab('abnormal')">🔍 异常工况表（${abnormalRecords.length}）</button>
                    <button class="tab" onclick="switchTab('audit')">📜 操作轨迹</button>
                </div>

                <div id="tab-abnormal" class="tab-content active">
                    <div class="detail-section">
                        <h2>🔍 异常工况表</h2>
                        ${abnormalHtml}
                    </div>
                </div>

                <div id="tab-audit" class="tab-content">
                    <div class="detail-section">
                        <h2>📜 操作轨迹（谁改了什么）</h2>
                        <div class="timeline">
                            ${auditHtml}
                        </div>
                    </div>
                </div>
            `;

            document.getElementById('batchDetail').innerHTML = html;
        }

        function switchTab(tabName) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById('tab-' + tabName).classList.add('active');
        }

        loadBatches();
    </script>
</body>
</html>
"""


@app.route("/")
def index():
    return render_template_string(HTML_TEMPLATE)


@app.route("/api/batches")
def api_batches():
    engine = get_engine()
    batches = engine.storage.list_batches()
    return jsonify(batches)


@app.route("/api/batch/<batch_id>")
def api_batch(batch_id):
    engine = get_engine()
    batch = engine.storage.load_batch(batch_id)
    if not batch:
        return jsonify({"error": "批次不存在"}), 404

    return jsonify({
        "id": batch.id,
        "name": batch.name,
        "status": batch.status,
        "run_count": batch.run_count,
        "repair_count": len(batch.repair_screenshots),
        "sampling_count": len(batch.sampling_notes),
        "abnormal_records": [
            {
                "point_id": r.point_id,
                "point_name": r.point_name,
                "status": r.status.value,
                "direction_status": r.direction_status.value,
                "keep_reason": r.keep_reason,
                "missing_materials": r.missing_materials,
                "next_handler": r.next_handler.value,
                "evidence_sources": r.evidence_sources,
                "is_field_dispute": r.is_field_dispute,
                "direction_field_text": r.direction_field_text,
                "field_mention": r.field_mention,
                "notes": r.notes,
                "trigger_source": r.trigger_source,
                "resolution_trace": r.resolution_trace,
            }
            for r in batch.abnormal_records
        ],
        "audit_logs": [
            {
                "timestamp": l.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                "operator": l.operator,
                "action": l.action,
                "field_changed": l.field_changed,
                "old_value": l.old_value,
                "new_value": l.new_value,
                "reason": l.reason,
                "affected_results": l.affected_results,
            }
            for l in batch.audit_logs
        ],
    })


if __name__ == "__main__":
    print("☀️ 光伏逆变器散热质检小看板启动中...")
    print("访问 http://localhost:5000 查看")
    app.run(debug=True, port=5000)
