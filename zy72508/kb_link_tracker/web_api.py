"""Flask Web API - 页面展示+接口返回，与导出明细读取同一份UnifiedDataStore"""

import json
from datetime import datetime
from typing import Optional

from flask import Flask, jsonify, render_template_string, request

from .store import UnifiedDataStore
from .models import RecordStatus, IssueType


def create_app(store: UnifiedDataStore) -> Flask:
    app = Flask(__name__)
    app.config["store"] = store

    INDEX_HTML = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>知识库失效链接追踪</title>
<style>
body { font-family: -apple-system, sans-serif; margin: 20px; background: #f5f5f5; }
h1 { color: #333; }
h2 { color: #555; margin-top: 24px; }
table { border-collapse: collapse; width: 100%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 13px; }
th { background: #f8f9fa; font-weight: 600; position: sticky; top: 0; }
tr:nth-child(even) { background: #fafafa; }
tr:hover { background: #e8f4fd; }
.status-imported { color: #888; }
.status-review_required { color: #e67e22; font-weight: bold; }
.status-reviewed { color: #27ae60; font-weight: bold; }
.status-confirmed { color: #2980b9; }
.status-rejected { color: #c0392b; text-decoration: line-through; }
.issue-duplicate_user_feedback { background: #fff3cd; }
.issue-duplicate_import { background: #ffeaa7; }
.tag { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-right: 4px; }
.tag-reimport { background: #e74c3c; color: white; }
.tag-duplicate { background: #e67e22; color: white; }
.tag-keep { background: #27ae60; color: white; }
.tag-reject { background: #c0392b; color: white; }
.summary-bar { background: white; padding: 16px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; gap: 24px; flex-wrap: wrap; }
.summary-item { text-align: center; }
.summary-item .num { font-size: 28px; font-weight: bold; }
.summary-item .label { font-size: 12px; color: #666; }
.evidence-section { background: white; padding: 16px; border-radius: 8px; margin-top: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.evidence-section h3 { margin-top: 0; color: #2c3e50; }
.evidence-item { padding: 8px; border-left: 3px solid #3498db; margin-bottom: 8px; background: #f8f9fa; }
.evidence-item.model-output { border-left-color: #3498db; }
.evidence-item.manual-judgment { border-left-color: #27ae60; }
.evidence-item.status-change { border-left-color: #e67e22; }
.consistency-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
.consistency-pass { background: #d4edda; color: #155724; }
.consistency-fail { background: #f8d7da; color: #721c24; }
.detail-link { color: #3498db; cursor: pointer; text-decoration: underline; }
</style>
</head>
<body>
<h1>知识库失效链接追踪</h1>
<div id="summary" class="summary-bar"></div>
<div id="consistency"></div>
<h2>全部记录</h2>
<table id="records-table">
<thead><tr>
<th>记录ID</th><th>用户反馈ID</th><th>用户ID</th><th>KB链接</th><th>状态</th>
<th>问题类型</th><th>人工改判摘要</th><th>标签</th><th>原始行号</th><th>复核理由</th>
</tr></thead>
<tbody id="records-body"></tbody>
</table>
<div id="detail-panel" class="evidence-section" style="display:none;">
<h3 id="detail-title"></h3>
<div id="detail-content"></div>
</div>

<script>
const storeData = {{ data | safe }};

function renderSummary() {
    const s = storeData.summary;
    document.getElementById('summary').innerHTML = `
        <div class="summary-item"><div class="num">${s.total_records}</div><div class="label">总记录</div></div>
        <div class="summary-item"><div class="num" style="color:#27ae60">${s.reviewed_count}</div><div class="label">已复核</div></div>
        <div class="summary-item"><div class="num" style="color:#e67e22">${s.review_required_count}</div><div class="label">待复核</div></div>
        <div class="summary-item"><div class="num" style="color:#c0392b">${s.duplicate_user_feedback_count}</div><div class="label">重复用户反馈</div></div>
        <div class="summary-item"><div class="num">${s.duplicate_group_count}</div><div class="label">重复分组</div></div>
    `;
}

function renderConsistency() {
    const c = storeData.consistency;
    const cls = c.export_consistent ? 'consistency-pass' : 'consistency-fail';
    const text = c.export_consistent
        ? '✓ 导出一致性校验通过 - 页面/API/CSV 读同一份结果'
        : '✗ 导出一致性校验失败';
    document.getElementById('consistency').innerHTML =
        `<span class="consistency-badge ${cls}">${text}</span>` +
        `<span style="margin-left:12px;font-size:12px;color:#666;">数据源: ${c.data_source} | 校验时间: ${c.check_time}</span>`;
}

function renderRecords() {
    const tbody = document.getElementById('records-body');
    tbody.innerHTML = storeData.records.map(r => {
        const statusCls = 'status-' + r.status;
        const issueCls = r.issue_type !== 'normal' ? 'issue-' + r.issue_type : '';
        let tags = '';
        if (r.is_reimport) tags += '<span class="tag tag-reimport">复用</span>';
        if (r.is_duplicate_user_feedback) tags += '<span class="tag tag-duplicate">重复反馈</span>';
        if (r.status === 'reviewed') tags += '<span class="tag tag-keep">保留</span>';
        if (r.status === 'rejected') tags += '<span class="tag tag-reject">剔除</span>';
        return `<tr class="${issueCls}">
            <td><span class="detail-link" onclick="showDetail('${r.record_id}')">${r.record_id.substring(0,12)}...</span></td>
            <td>${r.user_feedback_id}</td>
            <td>${r.user_id}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.kb_link}">${r.kb_link}</td>
            <td><span class="${statusCls}">${r.status}</span></td>
            <td>${r.issue_type}</td>
            <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.manual_judgment_summary}">${r.manual_judgment_summary || '-'}</td>
            <td>${tags}</td>
            <td>${r.raw_line_number}</td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${r.review_reason || ''}">${r.review_reason || '-'}</td>
        </tr>`;
    }).join('');
}

function showDetail(recordId) {
    fetch('/api/record/' + recordId)
        .then(r => r.json())
        .then(data => {
            const panel = document.getElementById('detail-panel');
            panel.style.display = 'block';
            document.getElementById('detail-title').textContent =
                '记录详情: ' + data.record_id + ' (' + data.user_feedback_id + ')';

            let html = `<p><strong>KB链接:</strong> ${data.kb_link} | <strong>状态:</strong> ${data.status} | <strong>问题类型:</strong> ${data.issue_type}</p>`;
            if (data.review_reason) html += `<p><strong>复核理由:</strong> ${data.review_reason}</p>`;

            html += '<h4>人工改判</h4>';
            if (data.manual_judgments && data.manual_judgments.length > 0) {
                data.manual_judgments.forEach(j => {
                    html += `<div class="evidence-item manual-judgment">
                        <strong>${j.judge_name}</strong>: ${j.judgment_result}<br>
                        理由: ${j.judgment_reason}<br>
                        <small>改判表行号: ${j.raw_line_number}</small>
                    </div>`;
                });
            } else {
                html += '<p>无人工改判</p>';
            }

            html += '<h4>证据链</h4>';
            if (data.evidence_trail && data.evidence_trail.length > 0) {
                data.evidence_trail.forEach(e => {
                    const cls = e.type === 'model_output' ? 'model-output'
                        : e.type === 'manual_judgment' ? 'manual-judgment'
                        : 'status-change';
                    html += `<div class="evidence-item ${cls}">
                        <strong>${e.description}</strong><br>
                        <small>${e.timestamp}</small>
                    </div>`;
                });
            }

            document.getElementById('detail-content').innerHTML = html;
            panel.scrollIntoView({behavior: 'smooth'});
        });
}

renderSummary();
renderConsistency();
renderRecords();
</script>
</body>
</html>
"""

    @app.route("/")
    def index():
        store = app.config["store"]
        df = store.to_dataframe()
        summary = store.generate_review_summary()
        consistency = store.check_export_consistency()

        data = {
            "records": df.to_dict(orient="records"),
            "summary": summary,
            "consistency": consistency,
        }
        return render_template_string(INDEX_HTML, data=json.dumps(data, ensure_ascii=False, default=str))

    @app.route("/api/records")
    def api_records():
        store = app.config["store"]
        response = store.get_api_response()
        response["consistency"] = store.check_export_consistency()
        return jsonify(response)

    @app.route("/api/record/<record_id>")
    def api_record(record_id):
        store = app.config["store"]
        record = store.get_record(record_id)
        if not record:
            return jsonify({"error": f"未找到记录: {record_id}"}), 404

        evidence_trail = store.get_evidence_trail(record_id)

        return jsonify({
            "record_id": record_id,
            "user_feedback_id": record.user_feedback_id,
            "user_id": record.user_id,
            "kb_link": record.kb_link,
            "status": record.status.value,
            "issue_type": record.issue_type.value,
            "issue_note": record.issue_note,
            "is_duplicate_user_feedback": record.is_duplicate_user_feedback,
            "duplicate_group_id": record.duplicate_group_id,
            "is_reimport": record.is_reimport,
            "reimport_source_record_id": record.reimport_source_record_id,
            "manual_judgment_summary": record.manual_judgment_summary,
            "review_by": record.review_by,
            "review_reason": record.review_reason,
            "review_timestamp": record.review_timestamp.isoformat() if record.review_timestamp else None,
            "raw_line_number": record.initial_model_fragment.raw_line_number,
            "manual_judgments": [
                {
                    "judge_name": j.judge_name,
                    "judgment_result": j.judgment_result,
                    "judgment_reason": j.judgment_reason,
                    "raw_line_number": j.raw_line_number,
                }
                for j in record.manual_judgments
            ],
            "evidence_trail": evidence_trail,
        })

    @app.route("/api/duplicate-groups")
    def api_duplicate_groups():
        store = app.config["store"]
        summary = store.generate_review_summary()
        groups_detail = []
        for g in summary["duplicate_groups"]:
            detail = store.get_duplicate_group_detail(g["group_id"])
            groups_detail.append(detail)
        return jsonify({
            "groups": groups_detail,
            "total_groups": len(groups_detail),
        })

    @app.route("/api/consistency")
    def api_consistency():
        store = app.config["store"]
        result = store.check_export_consistency()
        return jsonify(result)

    return app
