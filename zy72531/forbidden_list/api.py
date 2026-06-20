import json
from datetime import datetime
from flask import Flask, jsonify, request, render_template_string

from .core import ForbiddenListEngine
from .data.demo_data import DEMO_DATA


app = Flask(__name__)
engine = ForbiddenListEngine()


def record_to_dict(record):
    return {
        "id": record.id,
        "keyword": record.keyword,
        "original_keyword": record.original_keyword,
        "resolved_keyword": record.resolved_keyword,
        "status": record.status.value,
        "source": record.source.value,
        "reference_url": record.reference_url,
        "link_404": record.link_404,
        "conflict_note": record.conflict_note,
        "pm_review_note": record.pm_review_note,
        "confirm_reason": record.confirm_reason,
        "reject_reason": record.reject_reason,
        "rerun_count": record.rerun_count,
        "last_rerun_at": record.last_rerun_at.isoformat() if record.last_rerun_at else None,
        "created_at": record.created_at.isoformat(),
        "updated_at": record.updated_at.isoformat(),
        "history_count": len(record.history),
    }


def conflict_to_dict(conflict):
    return {
        "id": conflict.id,
        "forbidden_record_id": conflict.forbidden_record_id,
        "conflict_type": conflict.conflict_type.value,
        "old_content": conflict.old_content,
        "new_content": conflict.new_content,
        "detected_at": conflict.detected_at.isoformat(),
        "resolved": conflict.resolved,
        "resolved_by": conflict.resolved_by,
        "resolution_note": conflict.resolution_note,
        "confirm_reason": conflict.confirm_reason,
        "reject_reason": conflict.reject_reason,
    }


def _run_all_five_steps():
    global engine
    engine = ForbiddenListEngine()
    records = engine.run_full_workflow_step1_import(DEMO_DATA)

    review_decisions = {}
    for i, key in enumerate(["first_record", "second_record", "third_record"]):
        if i < len(records):
            review_decisions[records[i].id] = DEMO_DATA["review_decisions"][key]
    engine.run_full_workflow_step2_review("周姐", review_decisions)

    supplements = {}
    if len(records) >= 3:
        supplements[records[2].id] = DEMO_DATA["model_outputs_to_supplement"]["third_record"]
    engine.run_full_workflow_step3_supplement("周姐", supplements)

    corrections = {}
    third_record = engine.forbidden_records[2]
    corr_data = dict(DEMO_DATA["manual_corrections"]["third_record"])
    corr_data["resolve_conflict_id"] = engine.conflict_samples[0].id if engine.conflict_samples else None
    corrections[third_record.id] = corr_data
    engine.run_full_workflow_step4_manual_correct("周姐", corrections)

    pm_review_data = DEMO_DATA["pm_reviews"]["second_record"]
    second_record = engine.forbidden_records[1]
    engine.pm_review(second_record, "张总", pm_review_data["decision"], pm_review_data["reason"])

    rerun_ids = [engine.forbidden_records[2].id]
    engine.run_full_workflow_step5_rerun("周姐", rerun_ids)


@app.route("/")
def dashboard():
    stats = engine.get_statistics()
    records = [record_to_dict(r) for r in engine.forbidden_records]
    conflicts = [conflict_to_dict(c) for c in engine.conflict_samples]

    status_tags = {
        "正常通过": ("tag-normal", "正常通过"),
        "链接404但判通过": ("tag-404", "链接404但判通过"),
        "待产品经理复核": ("tag-pm", "待PM复核"),
        "口径冲突": ("tag-conflict", "口径冲突"),
        "已补录修正": ("tag-supplemented", "已补录修正"),
        "产品经理复核通过": ("tag-pm-ok", "PM复核通过"),
        "产品经理驳回": ("tag-reject", "PM驳回"),
        "已驳回": ("tag-reject", "已驳回"),
        "已重跑": ("tag-rerun", "已重跑"),
        "待处理": ("tag-pending", "待处理"),
    }

    return render_template_string(
        """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>导购推荐禁推清单 - 小看板</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
               background: #f5f7fa; padding: 20px; color: #303133; }
        .header { background: linear-gradient(135deg, #409eff, #66b1ff);
                  color: white; padding: 24px; border-radius: 8px; margin-bottom: 20px; }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { opacity: 0.92; font-size: 14px; line-height: 1.6; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
                      gap: 14px; margin-bottom: 22px; }
        .stat-card { background: white; padding: 18px; border-radius: 8px;
                     box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .stat-card .num { font-size: 28px; font-weight: bold; color: #409eff; }
        .stat-card .label { font-size: 13px; color: #909399; margin-top: 4px; }
        .section { background: white; border-radius: 8px; padding: 20px;
                   margin-bottom: 20px; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
        .section h2 { font-size: 17px; margin-bottom: 14px; color: #303133;
                      border-left: 4px solid #409eff; padding-left: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #ebeef5; vertical-align: top; }
        th { background: #f5f7fa; font-weight: 600; color: #606266; font-size: 12px; }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 4px;
               font-size: 12px; font-weight: 500; }
        .tag-normal { background: #f0f9eb; color: #67c23a; }
        .tag-404 { background: #fdf6ec; color: #e6a23c; }
        .tag-pm { background: #fef0f0; color: #f56c6c; }
        .tag-pm-ok { background: #f0f9eb; color: #67c23a; border:1px solid #e1f3d8; }
        .tag-conflict { background: #fef0f0; color: #f56c6c; }
        .tag-supplemented { background: #ecf5ff; color: #409eff; }
        .tag-rerun { background: #f4ecf7; color: #909399; }
        .tag-pending { background: #f4f4f5; color: #909399; }
        .tag-reject { background: #fef0f0; color: #f56c6c; }
        .btn { padding: 7px 14px; border: none; border-radius: 4px;
               cursor: pointer; font-size: 13px; margin-right: 6px; margin-bottom: 6px;
               transition: opacity 0.15s; }
        .btn:hover { opacity: 0.85; }
        .btn-primary { background: #409eff; color: white; }
        .btn-success { background: #67c23a; color: white; }
        .btn-warning { background: #e6a23c; color: white; }
        .btn-danger { background: #f56c6c; color: white; }
        .btn-info { background: #909399; color: white; }
        .btn-sm { padding: 4px 10px; font-size: 12px; }
        .btn-group { margin-bottom: 14px; }
        .workflow-step { padding: 10px 14px; background: #f5f7fa; border-radius: 4px;
                          margin-bottom: 6px; font-size: 13px; display: flex; align-items: center; }
        .workflow-step.active { background: #ecf5ff; border-left: 3px solid #409eff; }
        .workflow-step.done { background: #f0f9eb; }
        .step-num { display: inline-block; width: 22px; height: 22px; background: #c0c4cc;
                    color: white; border-radius: 50%; text-align: center; line-height: 22px;
                    font-size: 12px; margin-right: 8px; flex-shrink: 0; }
        .workflow-step.active .step-num, .workflow-step.done .step-num { background: #409eff; }
        .alert { padding: 11px 14px; border-radius: 4px; margin-bottom: 12px; font-size: 13px; }
        .alert-warning { background: #fdf6ec; color: #e6a23c; border-left: 4px solid #e6a23c; }
        .alert-info { background: #ecf5ff; color: #409eff; border-left: 4px solid #409eff; }
        .alert-success { background: #f0f9eb; color: #67c23a; border-left: 4px solid #67c23a; }
        .mini-note { font-size: 12px; color: #909399; }
        .detail-block { background: #fafbfc; padding: 10px 12px; border-radius: 4px;
                        margin-top: 6px; font-size: 12px; line-height: 1.6; }
        .detail-label { color: #606266; font-weight: 500; }
        .reason-ok { color: #67c23a; }
        .reason-no { color: #f56c6c; }
        .link-broken { color: #f56c6c; text-decoration: line-through; }
        .tabs { border-bottom: 1px solid #ebeef5; margin-bottom: 12px; }
        .tab { display: inline-block; padding: 8px 16px; cursor: pointer; font-size: 14px;
               color: #909399; border-bottom: 2px solid transparent; }
        .tab.active { color: #409eff; border-bottom-color: #409eff; font-weight: 500; }
        .modal-mask { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.45);
                      justify-content: center; align-items: center; z-index: 100; }
        .modal-mask.show { display: flex; }
        .modal { background: white; border-radius: 8px; padding: 24px; max-width: 680px;
                 width: 90%; max-height: 85vh; overflow-y: auto; }
        .modal h3 { margin-bottom: 14px; color: #303133; }
        .modal-close { float: right; cursor: pointer; font-size: 20px; color: #909399; }
        .hist-item { padding: 10px 0; border-bottom: 1px dashed #ebeef5; font-size: 13px; }
        .hist-item:last-child { border-bottom: none; }
        .hist-title { font-weight: 500; color: #303133; }
        .hist-meta { font-size: 12px; color: #909399; margin-top: 3px; }
        .hist-note { color: #606266; margin-top: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🛒 导购推荐禁推清单 · 小看板</h1>
        <p>标注负责人：周姐 &nbsp;|&nbsp; 产品经理：张总 &nbsp;|&nbsp; 覆盖错口径和补录返工两大常见场景</p>
    </div>

    <div class="stats-grid">
        <div class="stat-card"><div class="num">{{ stats.总记录数 }}</div><div class="label">总记录数</div></div>
        <div class="stat-card"><div class="num">{{ stats.已解决冲突数 }}/{{ stats.冲突样本数 }}</div><div class="label">冲突样本（已解决/总数）</div></div>
        <div class="stat-card"><div class="num">{{ stats.待产品经理复核数 }}</div><div class="label">待PM复核（链接404）</div></div>
        <div class="stat-card"><div class="num">{{ stats.人工修正次数 }}</div><div class="label">人工修正次数</div></div>
        <div class="stat-card"><div class="num">{{ stats.重跑执行次数 }}</div><div class="label">重跑执行次数</div></div>
        <div class="stat-card"><div class="num">步骤 {{ stats.工作流步骤 }}/5</div><div class="label">当前工作流进度</div></div>
    </div>

    {% if stats.待产品经理复核数 > 0 %}
    <div class="alert alert-warning">
        ⚠️ 有 <strong>{{ stats.待产品经理复核数 }}</strong> 条记录引用链接 404 仍被判通过，已标记转产品经理复核（未急于归正常）
    </div>
    {% endif %}
    {% if stats.冲突样本数 > 0 %}
    <div class="alert alert-info">
        🔍 共发现 <strong>{{ stats.冲突样本数 }}</strong> 条口径冲突，已解决 <strong>{{ stats.已解决冲突数 }}</strong> 条
    </div>
    {% endif %}

    <div class="section">
        <h2>快速操作 &amp; 工作流（五步完整演示）</h2>
        <div class="btn-group">
            <button class="btn btn-primary" onclick="loadFullDemo()">载入完整样例（五步）</button>
            <button class="btn btn-success" onclick="runStep(1)">① 标注员导入留言</button>
            <button class="btn btn-success" onclick="runStep(2)">② 周姐复核</button>
            <button class="btn btn-success" onclick="runStep(3)">③ 补录模型输出</button>
            <button class="btn btn-warning" onclick="runStep(4)">④ 人工修正</button>
            <button class="btn btn-warning" onclick="runStep(5)">⑤ PM复核+重跑</button>
            <button class="btn btn-info" onclick="location.reload()">刷新</button>
        </div>
        <div class="workflow-step {{ 'done' if stats.工作流步骤 >= 1 else '' }} {{ 'active' if stats.工作流步骤 == 1 else '' }}">
            <span class="step-num">1</span>标注员第一次导入留言（主材料：标注员留言，可反查）
        </div>
        <div class="workflow-step {{ 'done' if stats.工作流步骤 >= 2 else '' }} {{ 'active' if stats.工作流步骤 == 2 else '' }}">
            <span class="step-num">2</span>标注负责人周姐复核（保留确认/驳回理由）
        </div>
        <div class="workflow-step {{ 'done' if stats.工作流步骤 >= 3 else '' }} {{ 'active' if stats.工作流步骤 == 3 else '' }}">
            <span class="step-num">3</span>补录模型输出片段（关键备注），冲突样本表自动更新
        </div>
        <div class="workflow-step {{ 'done' if stats.工作流步骤 >= 4 else '' }} {{ 'active' if stats.工作流步骤 == 4 else '' }}">
            <span class="step-num">4</span>一次人工修正，解决旧口径冲突
        </div>
        <div class="workflow-step {{ 'done' if stats.工作流步骤 >= 5 else '' }} {{ 'active' if stats.工作流步骤 == 5 else '' }}">
            <span class="step-num">5</span>产品经理复核 + 一次重跑
        </div>
    </div>

    <div class="section">
        <h2>禁推清单记录 <span class="mini-note">（点击"详情"可反查标注员留言、模型输出、冲突、历史）</span></h2>
        <table>
            <thead>
                <tr>
                    <th>关键词/口径</th>
                    <th>状态</th>
                    <th>来源</th>
                    <th>引用链接</th>
                    <th>确认/驳回理由</th>
                    <th>其他</th>
                    <th style="width:170px">操作</th>
                </tr>
            </thead>
            <tbody>
                {% for r in records %}
                {% set st = status_tags.get(r.status, ('tag-pending', r.status)) %}
                <tr>
                    <td>
                        <strong>{{ r.keyword }}</strong>
                        {% if r.original_keyword and r.original_keyword != r.keyword %}
                        <div class="mini-note" style="color:#e6a23c">原始: {{ r.original_keyword }} → 已修正</div>
                        {% elif r.resolved_keyword and r.resolved_keyword != r.keyword %}
                        <div class="mini-note">→ 修正: {{ r.resolved_keyword }}</div>
                        {% endif %}
                    </td>
                    <td><span class="tag {{ st[0] }}">{{ st[1] }}</span></td>
                    <td>{{ r.source }}</td>
                    <td>
                        {% if r.reference_url %}
                          {% if r.link_404 %}
                            <span class="link-broken">{{ r.reference_url[:50] }}...</span>
                            <div class="mini-note reason-no">⚠️ 链接404</div>
                          {% else %}
                            {{ r.reference_url[:50] }}...
                          {% endif %}
                        {% else %}
                          <span class="mini-note">无</span>
                        {% endif %}
                    </td>
                    <td style="max-width:220px">
                        {% if r.confirm_reason %}
                          <div class="reason-ok">✅ {{ r.confirm_reason[:80] }}{% if r.confirm_reason|length > 80 %}...{% endif %}</div>
                        {% endif %}
                        {% if r.reject_reason %}
                          <div class="reason-no">❌ {{ r.reject_reason[:80] }}{% if r.reject_reason|length > 80 %}...{% endif %}</div>
                        {% endif %}
                        {% if r.pm_review_note %}
                          <div class="mini-note">📝 {{ r.pm_review_note[:60] }}...</div>
                        {% endif %}
                    </td>
                    <td style="font-size:12px">
                        {% if r.rerun_count > 0 %}🔁 重跑{{ r.rerun_count }}次<br>{% endif %}
                        {% if r.conflict_note %}⚠️ {{ r.conflict_note[:50] }}<br>{% endif %}
                        <span class="mini-note">历史{{ r.history_count }}条</span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="showDetail('{{ r.id }}')">详情</button>
                        <button class="btn btn-sm btn-info" onclick="showHistory('{{ r.id }}')">历史</button>
                        <button class="btn btn-sm btn-warning" onclick="rerunRecord('{{ r.id }}')">重跑</button>
                    </td>
                </tr>
                {% else %}
                <tr><td colspan="7" style="text-align:center;color:#909399;padding:24px">
                    暂无数据，点击上方 <strong>"载入完整样例（五步）"</strong> 加载三种场景演示
                </td></tr>
                {% endfor %}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>冲突样本表</h2>
        <table>
            <thead>
                <tr>
                    <th>冲突ID</th>
                    <th>关联记录</th>
                    <th>冲突类型</th>
                    <th>旧内容</th>
                    <th>状态</th>
                    <th>解决结论 &amp; 理由</th>
                    <th style="width:120px">操作</th>
                </tr>
            </thead>
            <tbody>
                {% for c in conflicts %}
                <tr>
                    <td style="font-family:monospace;font-size:12px">{{ c.id }}</td>
                    <td style="font-family:monospace;font-size:12px">{{ c.forbidden_record_id }}</td>
                    <td>{{ c.conflict_type }}</td>
                    <td>{{ c.old_content }}</td>
                    <td>
                        {% if c.resolved %}
                          <span class="tag tag-normal">已解决（{{ c.resolved_by }}）</span>
                        {% else %}
                          <span class="tag tag-conflict">未解决</span>
                        {% endif %}
                    </td>
                    <td style="max-width:260px">
                        {% if c.resolution_note %}
                          <div>{{ c.resolution_note[:80] }}{% if c.resolution_note|length > 80 %}...{% endif %}</div>
                        {% endif %}
                        {% if c.confirm_reason %}
                          <div class="reason-ok" style="font-size:12px;margin-top:4px">
                            ✅ {{ c.confirm_reason[:60] }}...
                          </div>
                        {% endif %}
                    </td>
                    <td>
                        {% if not c.resolved %}
                        <button class="btn btn-sm btn-success" onclick="resolveConflict('{{ c.id }}')">解决</button>
                        {% endif %}
                    </td>
                </tr>
                {% else %}
                <tr><td colspan="7" style="text-align:center;color:#909399;padding:24px">暂无冲突样本</td></tr>
                {% endfor %}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>可复现路线（三种结果对照）</h2>
        <div class="alert alert-success">
            <strong>✅ 顺利记录</strong>：保健品螺旋藻片 → 链接有效 → 周姐复核通过（带确认理由）→ 最终正常通过
        </div>
        <div class="alert alert-warning">
            <strong>🟡 链接404 不急着归正常</strong>：美白祛斑霜特效版 → 链接404仍判通过 → 周姐转PM复核 → 张总确认通过（带确认理由）
        </div>
        <div class="alert alert-info">
            <strong>🔴 补录发现旧口径 + 人工修正 + 重跑</strong>：七天长高营养液 → 补录模型输出发现旧口径 → 冲突样本新增 → 人工修正为"强效生长激素口服液"（带确认理由）→ 一次重跑 → 已补录修正
        </div>
    </div>

    <div class="modal-mask" id="modalMask">
        <div class="modal" id="modalBox">
            <span class="modal-close" onclick="closeModal()">&times;</span>
            <div id="modalContent"></div>
        </div>
    </div>

    <script>
        function loadFullDemo() {
            fetch('/api/load-full-demo', {method: 'POST'})
                .then(r => r.json()).then(d => {
                    alert('已载入完整五步演示：' + d.message); location.reload();
                });
        }
        function runStep(n) {
            fetch('/api/workflow/step' + n, {method: 'POST'})
                .then(r => r.json()).then(d => {
                    alert('第' + n + '步完成'); location.reload();
                });
        }
        function showDetail(id) {
            fetch('/api/records/' + id + '/detail')
                .then(r => r.json()).then(d => { showModal(renderDetail(d)); });
        }
        function showHistory(id) {
            fetch('/api/records/' + id + '/history')
                .then(r => r.json()).then(d => { showModal(renderHistory(d, id)); });
        }
        function rerunRecord(id) {
            if (!confirm('确认对该记录执行重跑？')) return;
            fetch('/api/records/' + id + '/rerun', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({operator: '周姐', note: '小看板手动触发重跑'})
            }).then(r => r.json()).then(d => { alert('重跑完成'); location.reload(); });
        }
        function resolveConflict(id) {
            const reason = prompt('请输入确认/解决理由：', '已核对Q2口径更新文档，确认新口径正确');
            if (!reason) return;
            fetch('/api/conflicts/' + id + '/resolve', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({operator: '周姐', resolution: '人工确认解决冲突', confirm_reason: reason})
            }).then(r => r.json()).then(d => { alert('冲突已解决'); location.reload(); });
        }
        function showModal(html) {
            document.getElementById('modalContent').innerHTML = html;
            document.getElementById('modalMask').classList.add('show');
        }
        function closeModal() { document.getElementById('modalMask').classList.remove('show'); }

        function renderDetail(d) {
            if (!d) return '<h3>未找到记录</h3>';
            const r = d.record;
            let html = `<h3>📋 记录详情</h3>
                <div class="detail-block">
                    <div><span class="detail-label">记录ID：</span>${r.id}</div>
                    <div><span class="detail-label">当前关键词：</span><strong style="color:#67c23a">${r.keyword}</strong></div>
                    ${r.original_keyword && r.original_keyword != r.keyword ?
                        `<div><span class="detail-label">原始关键词：</span><span style="color:#909399;text-decoration:line-through">${r.original_keyword}</span>
                         <div style="margin-left:80px;color:#e6a23c;font-size:13px">⚠️ 口径已变更：${r.original_keyword} → ${r.keyword}</div></div>` : ''}
                    ${r.resolved_keyword && r.resolved_keyword != r.keyword ?
                        `<div><span class="detail-label">修正后口径：</span><strong style="color:#409eff">${r.resolved_keyword}</strong></div>` : ''}
                    <div><span class="detail-label">状态：</span>${r.status}</div>
                    <div><span class="detail-label">来源：</span>${r.source}</div>
                    <div><span class="detail-label">引用链接：</span>${r.reference_url || '无'}${r.link_404 ? ' <span class="reason-no">（404失效）</span>' : ''}</div>
                    <div><span class="detail-label">重跑次数：</span>${r.rerun_count} 次</div>
                    ${r.confirm_reason ? `<div class="reason-ok"><span class="detail-label">✅ 确认理由：</span>${r.confirm_reason}</div>` : ''}
                    ${r.reject_reason ? `<div class="reason-no"><span class="detail-label">❌ 驳回理由：</span>${r.reject_reason}</div>` : ''}
                    ${r.conflict_note ? `<div><span class="detail-label">⚠️ 冲突备注：</span>${r.conflict_note}</div>` : ''}
                    ${r.pm_review_note ? `<div><span class="detail-label">📝 PM备注：</span>${r.pm_review_note}</div>` : ''}
                </div>`;
            if (d.annotator_comment) {
                const c = d.annotator_comment;
                html += `<h3 style="margin-top:18px">📝 标注员留言（主材料，可反查同一条样例）</h3>
                    <div class="detail-block">
                        <div><span class="detail-label">留言ID：</span>${c.id}</div>
                        <div><span class="detail-label">标注员：</span>${c.annotator}</div>
                        <div><span class="detail-label">留言内容：</span>${c.content}</div>
                        ${c.reason ? `<div class="reason-ok"><span class="detail-label">标注员理由：</span>${c.reason}</div>` : ''}
                        ${c.product_id ? `<div><span class="detail-label">商品ID：</span>${c.product_id}</div>` : ''}
                        <div><span class="detail-label">时间：</span>${c.timestamp}</div>
                    </div>`;
            }
            if (d.model_output) {
                const m = d.model_output;
                html += `<h3 style="margin-top:18px">🤖 模型输出片段（藏着关键备注）</h3>
                    <div class="detail-block">
                        <div><span class="detail-label">片段ID：</span>${m.id}</div>
                        <div><span class="detail-label">模型版本：</span>${m.model_version}</div>
                        <div><span class="detail-label">任务ID：</span>${m.source_task_id}</div>
                        <div><span class="detail-label">输出内容：</span>${m.content}</div>
                    </div>`;
            }
            if (d.conflicts && d.conflicts.length) {
                html += `<h3 style="margin-top:18px">⚔️ 关联冲突样本（${d.conflicts.length}条）</h3>`;
                d.conflicts.forEach((c, i) => {
                    html += `<div class="detail-block" style="margin-top:6px">
                        <div><span class="detail-label">[${i+1}] 冲突ID：</span>${c.id}，
                             <span class="detail-label">类型：</span>${c.type}，
                             <span class="detail-label">已解决：</span>${c.resolved ? '是' : '否'}</div>
                        <div><span class="detail-label">旧内容：</span>${c.old_content}</div>
                        <div><span class="detail-label">新内容：</span>${c.new_content.substring(0, 120)}...</div>
                        ${c.resolution_note ? `<div><span class="detail-label">解决结论：</span>${c.resolution_note}</div>` : ''}
                        ${c.confirm_reason ? `<div class="reason-ok"><span class="detail-label">✅ 确认理由：</span>${c.confirm_reason}</div>` : ''}
                    </div>`;
                });
            }
            if (d.history && d.history.length) {
                html += `<h3 style="margin-top:18px">🕒 操作历史（最新在前，${d.history.length}条）</h3>`;
                d.history.slice(0, 12).forEach((h, i) => {
                    html += `<div class="hist-item">
                        <div class="hist-title">[${i+1}] ${h.action}（${h.operator}）
                            ${h.before_status && h.after_status && h.before_status != h.after_status ?
                                `<span class="mini-note"> [${h.before_status} → ${h.after_status}]</span>` : ''}
                            ${h.rerun_number ? `<span class="mini-note"> 🔁重跑#${h.rerun_number}</span>` : ''}
                        </div>
                        <div class="hist-meta">${h.timestamp}</div>
                        ${h.note ? `<div class="hist-note">${h.note}</div>` : ''}
                        ${h.confirm_reason ? `<div class="hist-note reason-ok">✅ 确认理由：${h.confirm_reason}</div>` : ''}
                        ${h.reject_reason ? `<div class="hist-note reason-no">❌ 驳回理由：${h.reject_reason}</div>` : ''}
                    </div>`;
                });
            }
            return html;
        }

        function renderHistory(list, id) {
            let html = `<h3>🕒 记录 ${id} 操作历史</h3>`;
            if (!list || !list.length) return html + '<p class="mini-note">暂无历史</p>';
            list.forEach((h, i) => {
                html += `<div class="hist-item">
                    <div class="hist-title">[${i+1}] ${h.action}（${h.operator}）
                        ${h.before_status && h.after_status && h.before_status != h.after_status ?
                            `<span class="mini-note"> [${h.before_status} → ${h.after_status}]</span>` : ''}
                    </div>
                    <div class="hist-meta">${h.timestamp}</div>
                    ${h.note ? `<div class="hist-note">${h.note}</div>` : ''}
                    ${h.confirm_reason ? `<div class="hist-note reason-ok">✅ ${h.confirm_reason}</div>` : ''}
                    ${h.reject_reason ? `<div class="hist-note reason-no">❌ ${h.reject_reason}</div>` : ''}
                </div>`;
            });
            return html;
        }
    </script>
</body>
</html>
    """,
        stats=stats,
        records=records,
        conflicts=conflicts,
        status_tags=status_tags,
    )


@app.route("/api/stats")
def api_stats():
    return jsonify(engine.get_statistics())


@app.route("/api/records")
def api_records():
    return jsonify([record_to_dict(r) for r in engine.forbidden_records])


@app.route("/api/records/<rid>/detail")
def api_record_detail(rid):
    return jsonify(engine.get_record_detail(rid))


@app.route("/api/records/<rid>/history")
def api_record_history(rid):
    return jsonify(engine.get_record_history(rid))


@app.route("/api/records/<rid>/rerun", methods=["POST"])
def api_record_rerun(rid):
    data = request.get_json() or {}
    record = engine._find_record_by_id(rid)
    if not record:
        return jsonify({"error": "记录不存在"}), 404
    engine.rerun_record(record, data.get("operator", "周姐"), data.get("note", ""))
    return jsonify({"status": "ok", "rerun_count": record.rerun_count})


@app.route("/api/conflicts")
def api_conflicts():
    return jsonify([conflict_to_dict(c) for c in engine.conflict_samples])


@app.route("/api/conflicts/<cid>/resolve", methods=["POST"])
def api_resolve_conflict(cid):
    data = request.get_json() or {}
    conflict = next((c for c in engine.conflict_samples if c.id == cid), None)
    if not conflict:
        return jsonify({"error": "冲突不存在"}), 404
    engine.resolve_conflict(
        conflict,
        data.get("operator", "周姐"),
        data.get("resolution", "人工解决冲突"),
        keep_new=data.get("keep_new", True),
        confirm_reason=data.get("confirm_reason"),
        reject_reason=data.get("reject_reason"),
    )
    return jsonify({"status": "ok"})


@app.route("/api/load-full-demo", methods=["POST"])
def api_load_full_demo():
    _run_all_five_steps()
    return jsonify({"message": f"已加载 {len(engine.forbidden_records)} 条记录、{len(engine.conflict_samples)} 条冲突",
                    "stats": engine.get_statistics()})


@app.route("/api/workflow/step<int:n>", methods=["POST"])
def api_run_step(n):
    if n == 1:
        records = engine.run_full_workflow_step1_import(DEMO_DATA)
        return jsonify({"count": len(records)})
    elif n == 2:
        review_decisions = {}
        for i, key in enumerate(["first_record", "second_record", "third_record"]):
            if i < len(engine.forbidden_records):
                review_decisions[engine.forbidden_records[i].id] = DEMO_DATA["review_decisions"][key]
        engine.run_full_workflow_step2_review("周姐", review_decisions)
        return jsonify({"status": "ok"})
    elif n == 3:
        supplements = {}
        if len(engine.forbidden_records) >= 3:
            supplements[engine.forbidden_records[2].id] = DEMO_DATA["model_outputs_to_supplement"]["third_record"]
        new_conflicts = engine.run_full_workflow_step3_supplement("周姐", supplements)
        return jsonify({"conflicts": len(new_conflicts)})
    elif n == 4:
        corrections = {}
        if len(engine.forbidden_records) >= 3:
            third = engine.forbidden_records[2]
            corr_data = dict(DEMO_DATA["manual_corrections"]["third_record"])
            corr_data["resolve_conflict_id"] = engine.conflict_samples[0].id if engine.conflict_samples else None
            corrections[third.id] = corr_data
        engine.run_full_workflow_step4_manual_correct("周姐", corrections)
        return jsonify({"status": "ok"})
    elif n == 5:
        if len(engine.forbidden_records) >= 2:
            pm_data = DEMO_DATA["pm_reviews"]["second_record"]
            engine.pm_review(engine.forbidden_records[1], "张总", pm_data["decision"], pm_data["reason"])
        rerun_ids = [engine.forbidden_records[2].id] if len(engine.forbidden_records) >= 3 else []
        engine.run_full_workflow_step5_rerun("周姐", rerun_ids)
        return jsonify({"status": "ok"})
    return jsonify({"error": "invalid step"}), 400


@app.route("/api/import", methods=["POST"])
def api_import():
    data = request.get_json()
    records = engine.run_full_workflow_step1_import(data)
    return jsonify({"count": len(records), "ids": [r.id for r in records]})


@app.route("/api/report")
def api_report():
    return jsonify(engine.generate_report())


def run_server(host="127.0.0.1", port=5000):
    print(f"🚀 导购推荐禁推清单小看板启动: http://{host}:{port}")
    app.run(host=host, port=port, debug=False)


if __name__ == "__main__":
    run_server()
