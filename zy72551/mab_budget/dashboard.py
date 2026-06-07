"""Web小看板 - Flask应用"""
from flask import Flask, render_template_string, jsonify, request, redirect, url_for
import os


INDEX_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>多臂老虎机预算分流 - 小看板</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #f8fafc; color: #1e293b; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        .subtitle { color: #64748b; margin-bottom: 24px; }
        .warning-bar { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
        .stat-number { font-size: 28px; font-weight: 700; }
        .stat-label { color: #64748b; margin-top: 4px; font-size: 13px; }
        .stat-high { color: #dc2626; }
        .section { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .section h2 { font-size: 18px; color: #334155; margin-bottom: 16px; display: flex; align-items: center; gap: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { text-align: left; padding: 10px 12px; background: #f1f5f9; font-weight: 500; border-bottom: 2px solid #e2e8f0; }
        td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
        tr:hover { background: #f8fafc; }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        .badge-high { background: #fef2f2; color: #dc2626; }
        .badge-medium { background: #fffbeb; color: #d97706; }
        .badge-low { background: #ecfdf5; color: #059669; }
        .badge-ok { background: #dbeafe; color: #1d4ed8; }
        .btn { padding: 8px 16px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; }
        .btn-primary { background: #3b82f6; color: white; }
        .btn-primary:hover { background: #2563eb; }
        .btn-secondary { background: #f1f5f9; color: #475569; }
        .btn-secondary:hover { background: #e2e8f0; }
        .actions { display: flex; gap: 8px; }
        .tabs { display: flex; gap: 4px; margin-bottom: 20px; border-bottom: 1px solid #e2e8f0; }
        .tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; font-weight: 500; color: #64748b; }
        .tab.active { color: #1e293b; border-bottom-color: #3b82f6; }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .param-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .param-item { display: flex; justify-content: space-between; padding: 8px 12px; background: #f8fafc; border-radius: 6px; }
        .param-key { color: #64748b; font-size: 13px; }
        .param-val { font-weight: 500; }
        a { color: #3b82f6; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎰 多臂老虎机预算分流</h1>
        <p class="subtitle">异常复核小看板 · 实时数据</p>

        <div class="warning-bar">
            ⚠️ <strong>重要：</strong>「时间窗穿越」样本会导致效果虚高，结论不可直接发布，需实验平台负责人复核。
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">{{ stats.total_candidates }}</div>
                <div class="stat-label">召回候选总数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number stat-high">{{ stats.total_anomalies }}</div>
                <div class="stat-label">异常样本数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number stat-high">{{ stats.time_cross }}</div>
                <div class="stat-label">时间窗穿越</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">{{ stats.verified }}</div>
                <div class="stat-label">已复核</div>
            </div>
        </div>

        <div class="tabs">
            <div class="tab active" onclick="switchTab('anomalies')">🔍 异常样本</div>
            <div class="tab" onclick="switchTab('candidates')">📋 召回候选</div>
            <div class="tab" onclick="switchTab('audit')">📝 复核记录</div>
            <div class="tab" onclick="switchTab('params')">⚙️ 参数配置</div>
        </div>

        <div id="tab-anomalies" class="tab-content active">
            <div class="section">
                <h2>🔍 异常样本列表</h2>
                <table>
                    <tr>
                        <th>样本ID</th>
                        <th>类型</th>
                        <th>严重度</th>
                        <th>关联策略</th>
                        <th>状态</th>
                        <th>下一步负责人</th>
                        <th>操作</th>
                    </tr>
                    {% for a in anomalies %}
                    <tr>
                        <td><a href="{{ url_for('anomaly_detail', sample_id=a.sample_id) }}">{{ a.sample_id }}</a></td>
                        <td>{{ a.type_label }}</td>
                        <td><span class="badge badge-{{ a.severity }}">{{ a.severity_label }}</span></td>
                        <td>{{ a.strategy_name or '-' }}</td>
                        <td>{% if a.is_verified %}<span class="badge badge-ok">已复核</span>{% else %}<span class="badge badge-medium">待复核</span>{% endif %}</td>
                        <td>{{ a.next_step_owner }}</td>
                        <td class="actions">
                            <form method="POST" action="{{ url_for('verify_anomaly', sample_id=a.sample_id) }}" style="display:inline;">
                                <button type="submit" class="btn btn-secondary" {% if a.is_verified %}disabled{% endif %}>标记已复核</button>
                            </form>
                        </td>
                    </tr>
                    {% endfor %}
                </table>
            </div>
        </div>

        <div id="tab-candidates" class="tab-content">
            <div class="section">
                <h2>📋 召回候选表</h2>
                <table>
                    <tr>
                        <th>候选ID</th>
                        <th>策略</th>
                        <th>臂</th>
                        <th>曝光</th>
                        <th>点击</th>
                        <th>CTR</th>
                        <th>消耗</th>
                        <th>预算利用率</th>
                        <th>异常</th>
                    </tr>
                    {% for c in candidates %}
                    <tr>
                        <td>{{ c.candidate_id }}</td>
                        <td>{{ c.strategy_name }}</td>
                        <td>{{ c.arm_id }}</td>
                        <td>{{ "{:,}".format(c.impression) }}</td>
                        <td>{{ "{:,}".format(c.click) }}</td>
                        <td class="{% if c.is_anomaly %}stat-high{% endif %}">{{ "%.4f"|format(c.ctr) }}</td>
                        <td>¥{{ "%.2f"|format(c.cost) }}</td>
                        <td>{{ "%.1f%%"|format(c.budget_utilization * 100) }}</td>
                        <td>{% if c.is_anomaly %}<span class="badge badge-high">是</span>{% else %}-{% endif %}</td>
                    </tr>
                    {% endfor %}
                </table>
            </div>
        </div>

        <div id="tab-audit" class="tab-content">
            <div class="section">
                <h2>📝 复核记录（谁改了什么、为什么改）</h2>
                <table>
                    <tr>
                        <th>时间</th>
                        <th>操作人</th>
                        <th>动作</th>
                        <th>目标</th>
                        <th>变更摘要</th>
                        <th>原因</th>
                    </tr>
                    {% for r in audit %}
                    <tr>
                        <td style="font-size:12px;color:#64748b;">{{ r.timestamp }}</td>
                        <td><strong>{{ r.operator }}</strong></td>
                        <td>{{ r.action }}</td>
                        <td>{{ r.target_type }}</td>
                        <td style="font-size:12px;">{{ r.change_summary }}</td>
                        <td style="font-size:12px;color:#475569;">{{ r.reason }}</td>
                    </tr>
                    {% endfor %}
                </table>
            </div>
        </div>

        <div id="tab-params" class="tab-content">
            <div class="section">
                <h2>⚙️ 当前参数配置</h2>
                {% if params %}
                <div class="param-grid">
                    <div class="param-item"><span class="param-key">版本</span><span class="param-val">v{{ params.version }}</span></div>
                    <div class="param-item"><span class="param-key">时间窗口</span><span class="param-val">{{ params.time_window_size_hours }}h</span></div>
                    <div class="param-item"><span class="param-key">最低曝光阈值</span><span class="param-val">{{ "{:,}".format(params.min_impression_threshold) }}</span></div>
                    <div class="param-item"><span class="param-key">CTR显著阈值</span><span class="param-val">{{ params.ctr_significance_threshold }}</span></div>
                    <div class="param-item"><span class="param-key">消耗上限</span><span class="param-val">¥{{ "%.0f"|format(params.cost_ceiling) }}</span></div>
                    <div class="param-item"><span class="param-key">负责人</span><span class="param-val">{{ params.owner }}</span></div>
                </div>
                <h3 style="margin-top:20px;font-size:15px;">预算分配</h3>
                <div class="param-grid">
                    {% for k, v in params.budget_allocation.items() %}
                    <div class="param-item"><span class="param-key">{{ k }}</span><span class="param-val">{{ "%.0f%%"|format(v * 100) }}</span></div>
                    {% endfor %}
                </div>
                {% else %}
                <p style="color:#64748b;">暂无参数配置，请先通过命令行导入。</p>
                {% endif %}
            </div>
        </div>
    </div>

    <script>
        function switchTab(name) {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById('tab-' + name).classList.add('active');
        }
    </script>
</body>
</html>
"""


ANOMALY_DETAIL_TEMPLATE = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>异常样本详情 - {{ anomaly.sample_id }}</title>
    <style>
        body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 900px; margin: 0 auto; padding: 30px; background: #f8fafc; color: #1e293b; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .back-btn { color: #64748b; text-decoration: none; font-size: 14px; }
        .severity-badge { padding: 6px 14px; border-radius: 20px; font-weight: 600; }
        .severity-high { color: #dc2626; background: #fef2f2; }
        .severity-medium { color: #d97706; background: #fffbeb; }
        .severity-low { color: #059669; background: #ecfdf5; }
        .verified-badge { padding: 6px 14px; border-radius: 20px; font-weight: 500; color: #059669; background: #ecfdf5; font-size: 14px; }
        h1 { font-size: 24px; margin: 0; }
        h2 { font-size: 18px; color: #334155; border-left: 4px solid #3b82f6; padding-left: 12px; margin-top: 28px; }
        h3 { font-size: 16px; color: #475569; margin-top: 20px; }
        .card { background: white; border-radius: 12px; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .info-table { width: 100%; border-collapse: collapse; }
        .info-table th { text-align: left; padding: 8px 12px; background: #f1f5f9; font-weight: 500; width: 140px; }
        .info-table td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
        .highlight { font-weight: 600; color: #dc2626; }
        .reason-text { white-space: pre-line; line-height: 1.8; background: #fffbeb; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b; }
        .missing-list, .correction-list { line-height: 2; color: #475569; padding-left: 20px; }
        .next-step { background: #eff6ff; padding: 16px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-top: 16px; }
        .next-step .owner { font-weight: 600; color: #1d4ed8; }
        .meta { color: #94a3b8; font-size: 13px; margin-top: 8px; }
        .type-label { display: inline-block; padding: 4px 10px; background: #f1f5f9; border-radius: 6px; font-size: 14px; margin-right: 10px; }
        textarea { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 8px; font-family: inherit; font-size: 14px; min-height: 80px; }
        .btn { padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; }
        .btn-primary { background: #3b82f6; color: white; }
        .form-row { margin-bottom: 12px; }
        label { display: block; margin-bottom: 4px; font-weight: 500; color: #475569; font-size: 14px; }
    </style>
</head>
<body>
    <a href="{{ url_for('index') }}" class="back-btn">← 返回列表</a>
    <div class="header" style="margin-top:10px;">
        <div>
            <h1>异常样本详情</h1>
            <div class="meta">样本ID: {{ anomaly.sample_id }} | 检测时间: {{ anomaly.detected_at }}</div>
        </div>
        <div>
            <span class="type-label">{{ anomaly.type_label }}</span>
            <span class="severity-badge severity-{{ anomaly.severity }}">{{ anomaly.severity_label }}</span>
            {% if anomaly.is_verified %}<span class="verified-badge">✅ 已复核 by {{ anomaly.verified_by }}</span>{% endif %}
        </div>
    </div>

    <div class="card">
        <h2>❓ 为什么这条被留下</h2>
        <div class="reason-text">{{ anomaly.reason_description }}</div>
    </div>

    {% if candidate %}
    <div class="card">
        <h3>关联召回候选</h3>
        <table class="info-table">
            <tr><th>候选ID</th><td>{{ candidate.candidate_id }}</td></tr>
            <tr><th>策略名称</th><td>{{ candidate.strategy_name }}</td></tr>
            <tr><th>臂ID</th><td>{{ candidate.arm_id }}</td></tr>
            <tr><th>曝光量</th><td>{{ "{:,}".format(candidate.impression) }}</td></tr>
            <tr><th>点击量</th><td>{{ "{:,}".format(candidate.click) }}</td></tr>
            <tr><th>CTR</th><td class="highlight">{{ "%.4f"|format(candidate.ctr) }}</td></tr>
            <tr><th>消耗</th><td>¥{{ "%.2f"|format(candidate.cost) }}</td></tr>
            <tr><th>预算利用率</th><td>{{ "%.2f%%"|format(candidate.budget_utilization * 100) }}</td></tr>
            <tr><th>时间窗口</th><td>{{ candidate.time_window_start }}<br>~ {{ candidate.time_window_end }}</td></tr>
        </table>
    </div>
    {% endif %}

    {% if anomaly.missing_materials %}
    <div class="card">
        <h3>🔍 还缺什么材料</h3>
        <ul class="missing-list">
            {% for m in anomaly.missing_materials %}
            <li>{{ m }}</li>
            {% endfor %}
        </ul>
    </div>
    {% endif %}

    <div class="card next-step">
        <h3>🎯 下一步该找谁</h3>
        <p><span class="owner">负责人：{{ anomaly.next_step_owner }}</span></p>
        <p>行动：{{ anomaly.next_step_action }}</p>
        {% if anomaly.correction_notes %}<p style="margin-top:12px;"><strong>修正备注：</strong>{{ anomaly.correction_notes }}</p>{% endif %}
    </div>

    {% if anomaly.correction_history %}
    <div class="card">
        <h3>📝 人工修正记录</h3>
        <ol class="correction-list">
            {% for corr in anomaly.correction_history|reverse %}
            <li><strong style="color:#64748b;">{{ corr.timestamp }} {{ corr.operator }}:</strong> {{ corr.notes }}</li>
            {% endfor %}
        </ol>
    </div>
    {% endif %}

    <div class="card">
        <h3>✏️ 人工修正</h3>
        <form method="POST" action="{{ url_for('correct_anomaly', sample_id=anomaly.sample_id) }}">
            <div class="form-row">
                <label>操作人</label>
                <select name="operator" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;">
                    <option>推荐策略老唐</option>
                    <option>实验平台负责人</option>
                    <option>数据分析师</option>
                </select>
            </div>
            <div class="form-row">
                <label>修正备注（必填）</label>
                <textarea name="notes" required placeholder="说明修正原因、变更内容等..."></textarea>
            </div>
            <div class="form-row" style="display:flex;gap:20px;">
                <label style="display:flex;align-items:center;gap:6px;"><input type="checkbox" name="mark_verified"> 标记为已复核</label>
            </div>
            <div class="form-row">
                <label>下一步负责人（可选）</label>
                <select name="next_owner" style="width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;">
                    <option value="">不修改</option>
                    <option>实验平台负责人</option>
                    <option>推荐策略老唐</option>
                    <option>数据分析师</option>
                </select>
            </div>
            <button type="submit" class="btn btn-primary">提交修正</button>
        </form>
    </div>
</body>
</html>
"""


def create_app(reviewer):
    app = Flask(__name__)
    app.config["reviewer"] = reviewer

    TYPE_LABELS = {
        "time_window_cross": "时间窗穿越（效果虚高）",
        "ctr_outlier": "CTR异常偏高",
        "budget_overrun": "预算超支预警"
    }
    SEVERITY_LABELS = {
        "high": "高风险",
        "medium": "中风险",
        "low": "低风险"
    }

    def _enrich_anomalies(anomalies):
        result = []
        for a in anomalies:
            d = {
                "sample_id": a.sample_id,
                "candidate_id": a.candidate_id,
                "anomaly_type": a.anomaly_type,
                "type_label": TYPE_LABELS.get(a.anomaly_type, a.anomaly_type),
                "severity": a.severity,
                "severity_label": SEVERITY_LABELS.get(a.severity, a.severity),
                "is_verified": a.is_verified,
                "verified_by": a.verified_by,
                "next_step_owner": a.next_step_owner,
                "next_step_action": a.next_step_action,
                "reason_description": a.reason_description,
                "missing_materials": a.missing_materials,
                "correction_history": a.correction_history,
                "correction_notes": a.correction_notes,
                "detected_at": a.detected_at,
                "strategy_name": a.candidate.strategy_name if a.candidate else None
            }
            result.append(d)
        return result

    @app.route("/")
    def index():
        reviewer = app.config["reviewer"]
        data = reviewer.get_dashboard_data()

        anomalies = _enrich_anomalies(data["anomalies"])
        stats = {
            "total_candidates": len(data["candidates"]),
            "total_anomalies": len(data["anomalies"]),
            "time_cross": sum(1 for a in data["anomalies"] if a.anomaly_type == "time_window_cross"),
            "verified": sum(1 for a in data["anomalies"] if a.is_verified)
        }

        return render_template_string(
            INDEX_TEMPLATE,
            stats=stats,
            anomalies=anomalies,
            candidates=data["candidates"],
            audit=list(reversed(data["audit"])),
            params=data["params"]
        )

    @app.route("/anomaly/<sample_id>")
    def anomaly_detail(sample_id):
        reviewer = app.config["reviewer"]
        anomaly = reviewer.store.load_anomaly(sample_id)
        if not anomaly:
            return "未找到", 404

        enriched = _enrich_anomalies([anomaly])[0]
        return render_template_string(
            ANOMALY_DETAIL_TEMPLATE,
            anomaly=enriched,
            candidate=anomaly.candidate
        )

    @app.route("/anomaly/<sample_id>/verify", methods=["POST"])
    def verify_anomaly(sample_id):
        reviewer = app.config["reviewer"]
        reviewer.manual_correct_anomaly(
            sample_id,
            operator="小看板用户",
            correction_notes="通过小看板标记为已复核",
            mark_verified=True
        )
        return redirect(url_for("index"))

    @app.route("/anomaly/<sample_id>/correct", methods=["POST"])
    def correct_anomaly(sample_id):
        reviewer = app.config["reviewer"]
        operator = request.form.get("operator", "推荐策略老唐")
        notes = request.form.get("notes", "")
        mark_verified = "mark_verified" in request.form
        next_owner = request.form.get("next_owner") or None

        reviewer.manual_correct_anomaly(
            sample_id,
            operator=operator,
            correction_notes=notes,
            mark_verified=mark_verified,
            next_step_owner=next_owner
        )
        return redirect(url_for("anomaly_detail", sample_id=sample_id))

    @app.route("/api/rerun", methods=["POST"])
    def api_rerun():
        reviewer = app.config["reviewer"]
        anomalies = reviewer.rerun_detection()
        return jsonify({"status": "ok", "anomalies": len(anomalies)})

    return app
