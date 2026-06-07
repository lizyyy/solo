#!/usr/bin/env python3
from flask import Flask, jsonify, request, render_template_string
import json

from image_retrieval_mining import HardCaseMiner
from image_retrieval_mining.demo_flow import run_step_by_step_demo
from image_retrieval_mining.models import RecordStatus

app = Flask(__name__)

_global_miner = None


def get_miner():
    global _global_miner
    if _global_miner is None:
        _global_miner = run_step_by_step_demo()
    return _global_miner


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>图像检索难例挖掘 - 小看板</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f5f7fa;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 {
            color: #1a1a2e;
            margin-bottom: 20px;
            font-size: 24px;
        }
        .section {
            background: white;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        .section h2 {
            color: #16213e;
            font-size: 18px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e8e8e8;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
        }
        .stat-card {
            padding: 15px;
            border-radius: 6px;
            text-align: center;
        }
        .stat-card .number {
            font-size: 28px;
            font-weight: bold;
            color: #1a1a2e;
        }
        .stat-card .label {
            font-size: 13px;
            color: #666;
            margin-top: 5px;
        }
        .stat-normal { background: #f0fff4; border-left: 4px solid #48bb78; }
        .stat-diff { background: #fff5f5; border-left: 4px solid #f56565; }
        .stat-pending { background: #fffff0; border-left: 4px solid #ecc94b; }
        .stat-old { background: #f0f4ff; border-left: 4px solid #667eea; }
        .stat-fixed { background: #f0fff4; border-left: 4px solid #38b2ac; }
        .stat-rerun { background: #faf5ff; border-left: 4px solid #9f7aea; }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        th {
            background: #f7fafc;
            font-weight: 600;
            color: #2d3748;
        }
        tr:hover { background: #f7fafc; }

        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
        }
        .badge-A { background: #c6f6d5; color: #22543d; }
        .badge-B { background: #bee3f8; color: #2a4365; }
        .badge-C { background: #feebc8; color: #744210; }
        .badge-D { background: #fed7d7; color: #742a2a; }
        .badge-E { background: #e2e8f0; color: #1a202c; }

        .status-pending {
            background: #fff3cd;
            color: #856404;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 500;
        }
        .status-normal {
            background: #d4edda;
            color: #155724;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .status-old {
            background: #cce5ff;
            color: #004085;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .status-fixed {
            background: #d1ecf1;
            color: #0c5460;
            padding: 4px 8px;
            border-radius: 4px;
        }
        .status-rerun {
            background: #e2d5f1;
            color: #452769;
            padding: 4px 8px;
            border-radius: 4px;
        }

        .step-log {
            background: #1a1a2e;
            color: #e2e8f0;
            padding: 15px;
            border-radius: 6px;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 12px;
            line-height: 1.6;
            max-height: 300px;
            overflow-y: auto;
        }
        .step-log .line { margin-bottom: 4px; }

        .comparison-table td {
            font-family: 'SF Mono', Monaco, monospace;
        }
        .delta-positive { color: #38a169; }
        .delta-negative { color: #e53e3e; }

        .warning-note {
            background: #fff3cd;
            border: 1px solid #ffeeba;
            color: #856404;
            padding: 12px 16px;
            border-radius: 6px;
            margin-bottom: 15px;
        }
        .warning-note strong { color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 图像检索难例挖掘 - 小看板</h1>

        <div class="warning-note">
            <strong>⚠️  关键原则：</strong>离线和线上分数差一个桶时，自动标记为【待评测运营复核】，不会自动归为正常。
            实验对比会跟随阈值调参笔记自动更新。
        </div>

        <div class="section">
            <h2>📊 数据概览</h2>
            <div class="stats-grid">
                <div class="stat-card stat-normal">
                    <div class="number">{{ summary['总记录数'] }}</div>
                    <div class="label">总记录数</div>
                </div>
                <div class="stat-card stat-normal">
                    <div class="number">{{ summary['正常记录'] }}</div>
                    <div class="label">正常记录</div>
                </div>
                <div class="stat-card stat-diff">
                    <div class="number">{{ summary['离线线上分桶差'] }}</div>
                    <div class="label">分桶差异</div>
                </div>
                <div class="stat-card stat-pending">
                    <div class="number">{{ summary['待复核'] }}</div>
                    <div class="label">待运营复核</div>
                </div>
                <div class="stat-card stat-old">
                    <div class="number">{{ summary['旧口径记录'] }}</div>
                    <div class="label">旧口径</div>
                </div>
                <div class="stat-card stat-fixed">
                    <div class="number">{{ summary['人工修正'] }}</div>
                    <div class="label">人工修正</div>
                </div>
                <div class="stat-card stat-rerun">
                    <div class="number">{{ summary['重跑记录'] }}</div>
                    <div class="label">重跑</div>
                </div>
                <div class="stat-card stat-old">
                    <div class="number">{{ summary['已应用阈值笔记'] }}</div>
                    <div class="label">已应用笔记</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>📋 检索记录</h2>
            <table>
                <thead>
                    <tr>
                        <th>图片ID</th>
                        <th>查询词</th>
                        <th>离线分数</th>
                        <th>线上分数</th>
                        <th>状态</th>
                        <th>备注</th>
                    </tr>
                </thead>
                <tbody>
                    {% for r in records %}
                    <tr>
                        <td><code>{{ r.image_id }}</code></td>
                        <td>{{ r.query }}</td>
                        <td>
                            <span class="badge badge-{{ r.offline_bucket }}">
                                {{ "%.3f"|format(r.offline_score) }} ({{ r.offline_bucket }}桶)
                            </span>
                        </td>
                        <td>
                            <span class="badge badge-{{ r.online_bucket }}">
                                {{ "%.3f"|format(r.online_score) }} ({{ r.online_bucket }}桶)
                            </span>
                        </td>
                        <td>
                            {% if r.status == '待评测运营复核' %}
                            <span class="status-pending">⏳ {{ r.status }}</span>
                            {% elif r.status == '正常' %}
                            <span class="status-normal">✅ {{ r.status }}</span>
                            {% elif r.status == '旧口径(来自阈值调参笔记)' %}
                            <span class="status-old">📜 {{ r.status }}</span>
                            {% elif r.status == '人工修正' %}
                            <span class="status-fixed">🔧 {{ r.status }}</span>
                            {% elif r.status == '重跑' %}
                            <span class="status-rerun">🔄 {{ r.status }}</span>
                            {% else %}
                            {{ r.status }}
                            {% endif %}
                        </td>
                        <td style="font-size: 12px; color: #666;">{{ r.remark }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>🔬 实验对比</h2>
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>对比说明</th>
                        <th>离线差</th>
                        <th>线上差</th>
                    </tr>
                </thead>
                <tbody>
                    {% for c in comparisons %}
                    <tr>
                        <td>{{ c.note }}</td>
                        <td class="{{ 'delta-positive' if c.offline_delta >= 0 else 'delta-negative' }}">
                            {{ "%+.3f"|format(c.offline_delta) }}
                        </td>
                        <td class="{{ 'delta-positive' if c.online_delta >= 0 else 'delta-negative' }}">
                            {{ "%+.3f"|format(c.online_delta) }}
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>📝 完整操作轨迹</h2>
            <div class="step-log">
                {% for line in step_log %}
                <div class="line">{{ line }}</div>
                {% endfor %}
            </div>
        </div>
    </div>
</body>
</html>
"""


@app.route("/")
def index():
    miner = get_miner()
    result = miner.run_mining()
    return render_template_string(
        HTML_TEMPLATE,
        summary=result.summary(),
        records=miner.all_records(),
        comparisons=miner.all_comparisons(),
        step_log=miner.get_step_log(),
    )


@app.route("/api/summary")
def api_summary():
    miner = get_miner()
    result = miner.run_mining()
    return jsonify(result.summary())


@app.route("/api/records")
def api_records():
    miner = get_miner()
    records = []
    for r in miner.all_records():
        records.append({
            "record_id": r.record_id,
            "image_id": r.image_id,
            "query": r.query,
            "offline_score": r.offline_score,
            "online_score": r.online_score,
            "offline_bucket": r.offline_bucket.value,
            "online_bucket": r.online_bucket.value,
            "status": r.status.value,
            "bucket_diff": r.bucket_diff,
            "remark": r.remark,
        })
    return jsonify(records)


@app.route("/api/comparisons")
def api_comparisons():
    miner = get_miner()
    comps = []
    for c in miner.all_comparisons():
        comps.append({
            "note": c.note,
            "offline_delta": c.offline_delta,
            "online_delta": c.online_delta,
        })
    return jsonify(comps)


@app.route("/api/step-log")
def api_step_log():
    miner = get_miner()
    return jsonify(miner.get_step_log())


@app.route("/api/reset")
def api_reset():
    global _global_miner
    _global_miner = None
    return jsonify({"status": "ok", "message": "已重置"})


if __name__ == "__main__":
    print("=" * 60)
    print("图像检索难例挖掘 - 小看板启动")
    print("访问 http://127.0.0.1:5000 查看界面")
    print("=" * 60)
    app.run(debug=True, host="127.0.0.1", port=5000)
