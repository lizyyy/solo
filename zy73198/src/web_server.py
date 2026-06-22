"""Flask Web 服务 - 优化调参图表解释在线复核"""

from __future__ import annotations

import io
import json
import os
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from flask import Flask, jsonify, request, send_file, send_from_directory

from .parameter_manager import ParameterManager
from .chart_explainer import ChartExplainer

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
CHARTS_DIR = DATA_DIR / "charts"
PARAMS_FILE = DATA_DIR / "parameters.json"

DATA_DIR.mkdir(parents=True, exist_ok=True)
CHARTS_DIR.mkdir(parents=True, exist_ok=True)

_last_explanation: Optional[Dict[str, Any]] = None
_last_chart_paths: Optional[Dict[str, str]] = None

plt.rcParams["font.sans-serif"] = ["Arial Unicode MS", "PingFang SC", "Microsoft YaHei", "SimHei"]
plt.rcParams["axes.unicode_minus"] = False


def load_manager() -> ParameterManager:
    if PARAMS_FILE.exists():
        return ParameterManager.load(str(PARAMS_FILE))
    return ParameterManager()


def save_manager(manager: ParameterManager) -> None:
    manager.save(str(PARAMS_FILE))


def get_version_id_by_name(manager: ParameterManager, version_name: str) -> Optional[str]:
    for v in manager.list_versions():
        if v.version_name == version_name:
            return v.version_id
    return None


def generate_param_chart(params: Dict[str, Any], timestamp: str) -> str:
    param_names = ["分子", "分母", "总数", "样本量", "A值", "B值"]
    values = []
    labels = []
    for name in param_names:
        if name in params and isinstance(params[name], (int, float)):
            values.append(float(params[name]))
            labels.append(name)

    if not values:
        return ""

    fig, ax = plt.subplots(figsize=(10, 5))
    bars = ax.bar(labels, values, color=["#667eea", "#764ba2", "#f093fb", "#f5576c", "#4facfe", "#43e97b"][:len(labels)])
    ax.set_title("参数对比柱状图", fontsize=14, fontweight="bold", pad=15)
    ax.set_ylabel("数值", fontsize=12)
    ax.grid(axis="y", alpha=0.3)

    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.5,
                f"{val}", ha="center", va="bottom", fontsize=10)

    fig.tight_layout()
    filename = f"params_{timestamp}.png"
    filepath = CHARTS_DIR / filename
    fig.savefig(str(filepath), dpi=120, bbox_inches="tight")
    plt.close(fig)
    return f"/charts/{filename}"


def generate_result_chart(steps: List[Any], timestamp: str) -> str:
    labels = []
    values = []

    for step in steps:
        output = step.output
        if isinstance(output, str) and "%" in output:
            try:
                val = float(output.replace("%", ""))
                labels.append(step.step_name.replace("计算", ""))
                values.append(val)
            except ValueError:
                continue
        elif isinstance(output, (int, float)):
            import math
            if not math.isnan(output):
                labels.append(step.step_name.replace("计算", ""))
                values.append(float(output))

    if not values:
        return ""

    fig, ax = plt.subplots(figsize=(10, 5))
    bars = ax.bar(labels, values, color=["#43e97b", "#38f9d7", "#fa709a", "#fee140"][:len(labels)])
    ax.set_title("计算结果对比图", fontsize=14, fontweight="bold", pad=15)
    ax.set_ylabel("数值", fontsize=12)
    ax.grid(axis="y", alpha=0.3)

    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.5,
                f"{val:.2f}", ha="center", va="bottom", fontsize=10)

    fig.tight_layout()
    filename = f"result_{timestamp}.png"
    filepath = CHARTS_DIR / filename
    fig.savefig(str(filepath), dpi=120, bbox_inches="tight")
    plt.close(fig)
    return f"/charts/{filename}"


def format_calculate_response(explanation, chart1_path: str, chart2_path: str) -> Dict[str, Any]:
    steps_formatted = []
    for step in explanation.calculation_steps:
        lineage = []
        for dl in step.data_lineage:
            o = dl["origin"]
            lineage.append({
                "input_name": dl["input_name"],
                "input_value": dl.get("input_value"),
                "origin": {
                    "param_name": o.get("param_name"),
                    "param_value": o.get("param_value"),
                    "version_id": o.get("version_id"),
                    "version_name": o.get("version_name"),
                    "source_type": o.get("source_type"),
                    "source_id": o.get("source_id"),
                    "source_name": o.get("source_name"),
                    "source_location": o.get("source_location"),
                    "created_by": o.get("created_by"),
                    "created_at": o.get("created_at"),
                    "raw_value": o.get("raw_value"),
                    "raw_data_snapshot": o.get("raw_data_snapshot"),
                    "was_cleaned": o.get("was_cleaned"),
                    "cleaning_note": o.get("cleaning_note"),
                    "change_from_previous": o.get("change_from_previous"),
                },
            })
        steps_formatted.append({
            "step_id": step.step_id,
            "name": step.step_name,
            "description": step.description,
            "formula": step.formula,
            "inputs": step.inputs,
            "output": step.output,
            "data_lineage": lineage,
        })

    issues_formatted = []
    for issue in explanation.boundary_issues:
        param_origin = None
        if issue.param_origin:
            po = issue.param_origin
            param_origin = {
                "param_name": po.param_name,
                "param_value": po.param_value,
                "version_id": po.version_id,
                "version_name": po.version_name,
                "source_type": po.source_type,
                "source_id": po.source_id,
                "source_name": po.source_name,
                "source_location": po.row_hint,
                "created_by": po.created_by,
                "created_at": po.created_at,
                "raw_value": po.raw_value,
                "raw_data_snapshot": po.raw_data,
                "was_cleaned": po.cleaned,
                "change_from_previous": po.change_from_previous,
            }
        issues_formatted.append({
            "type": issue.issue_type,
            "severity": issue.severity,
            "location": issue.location,
            "message": issue.message,
            "suggestion": issue.suggestion,
            "param_name": issue.param_name,
            "param_value": issue.param_value,
            "source_location": issue.location,
            "affected_calculations": issue.affected_calculations,
            "param_origin": param_origin,
            "fallback_hint": issue.fallback_version_hint,
            "fallback_version_id": issue.fallback_version_id,
        })

    return {
        "success": True,
        "explanation_id": explanation.explanation_id,
        "version_id": explanation.version_id,
        "version_name": explanation.version_name,
        "title": explanation.title,
        "steps": steps_formatted,
        "findings": explanation.key_findings,
        "issues": issues_formatted,
        "summary": explanation.plain_language_summary,
        "data_sources": explanation.data_sources,
        "parameter_changes": explanation.parameter_changes,
        "generated_at": explanation.generated_at.isoformat() if hasattr(explanation.generated_at, "isoformat") else str(explanation.generated_at),
        "chart1_path": chart1_path,
        "chart2_path": chart2_path,
    }


app = Flask(__name__)


@app.route("/", methods=["GET"])
def index():
    html = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>优化调参图表解释 - 在线复核</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
        header {
            text-align: center; color: white; padding: 30px 0 20px;
        }
        header h1 { font-size: 2rem; font-weight: 500; letter-spacing: 2px; }
        .tabs {
            display: flex; background: rgba(255,255,255,0.1);
            border-radius: 12px; padding: 6px; margin-bottom: 20px; gap: 6px;
        }
        .tab-btn {
            flex: 1; padding: 14px 20px; border: none; background: transparent;
            color: white; font-size: 1rem; cursor: pointer; border-radius: 8px;
            transition: all 0.3s ease; font-weight: 500;
        }
        .tab-btn:hover { background: rgba(255,255,255,0.15); }
        .tab-btn.active { background: white; color: #667eea; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
        .card {
            background: white; border-radius: 16px; padding: 30px; margin-bottom: 20px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        .card h2 {
            color: #667eea; margin-bottom: 20px; font-weight: 500; font-size: 1.3rem;
            display: flex; align-items: center; gap: 10px;
        }
        .form-grid {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 15px; margin-bottom: 20px;
        }
        .form-group { display: flex; flex-direction: column; }
        .form-group label {
            font-size: 0.9rem; color: #666; margin-bottom: 6px; font-weight: 500;
        }
        .form-group input, .form-group select, .form-group textarea {
            padding: 10px 14px; border: 2px solid #e0e0e0; border-radius: 8px;
            font-size: 0.95rem; transition: border-color 0.3s ease;
            font-family: inherit;
        }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus {
            outline: none; border-color: #667eea;
        }
        .form-group textarea { resize: vertical; min-height: 80px; font-family: monospace; font-size: 0.85rem; }
        .btn-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
        .btn {
            padding: 12px 28px; border: none; border-radius: 50px; font-size: 0.95rem;
            cursor: pointer; font-weight: 500; transition: all 0.3s ease;
            display: inline-flex; align-items: center; gap: 6px;
        }
        .btn-primary {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; box-shadow: 0 8px 20px rgba(102,126,234,0.4);
        }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(102,126,234,0.5); }
        .btn-secondary { background: #f0f0f0; color: #333; }
        .btn-secondary:hover { background: #e0e0e0; }
        .btn-success { background: linear-gradient(135deg, #43e97b 0%, #38f9d7 100%); color: white; }
        .btn-danger { background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%); color: white; }
        .result-section { margin-top: 25px; }
        .summary-card {
            background: linear-gradient(135deg, #E3F2FD 0%, #E8F5E9 100%);
            border-left: 5px solid #667eea; padding: 20px; border-radius: 8px;
            white-space: pre-wrap; line-height: 1.8; font-size: 0.95rem;
        }
        .findings-list { list-style: none; padding: 0; }
        .findings-list li {
            background: #E8F5E9; padding: 12px 18px; margin: 8px 0;
            border-radius: 8px; border-left: 4px solid #4CAF50; font-size: 0.95rem;
        }
        .issue-card { padding: 18px; margin: 12px 0; border-radius: 10px; border-left: 5px solid; }
        .issue-card.high { background: #FFEBEE; border-color: #F44336; }
        .issue-card.medium { background: #FFF3CD; border-color: #FFC107; }
        .issue-card h4 { margin-bottom: 8px; font-size: 1rem; }
        .issue-card p { font-size: 0.9rem; line-height: 1.6; margin: 4px 0; white-space: pre-wrap; }
        .step-card {
            background: #fafafa; border: 1px solid #e0e0e0; border-radius: 10px;
            padding: 20px; margin: 12px 0;
        }
        .step-card h4 { color: #667eea; margin-bottom: 10px; }
        .step-card .formula {
            background: #1e1e2e; color: #a6e3a1; padding: 8px 14px;
            border-radius: 6px; font-family: monospace; display: inline-block; margin: 8px 0;
        }
        .lineage-table {
            width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 0.85rem;
        }
        .lineage-table th, .lineage-table td {
            border: 1px solid #e0e0e0; padding: 8px 12px; text-align: left;
        }
        .lineage-table th { background: #f0f0f0; font-weight: 600; }
        .charts-grid {
            display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
            gap: 20px; margin: 20px 0;
        }
        .chart-box {
            background: #fafafa; border-radius: 10px; padding: 15px; text-align: center;
        }
        .chart-box img { max-width: 100%; height: auto; border-radius: 6px; }
        .chart-box h4 { margin-bottom: 10px; color: #667eea; }
        table.diff-table {
            width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 0.9rem;
        }
        .diff-table th, .diff-table td {
            border: 1px solid #e0e0e0; padding: 10px 14px; text-align: left;
        }
        .diff-table th { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
        .diff-table tr:nth-child(even) { background: #fafafa; }
        .badge {
            display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: 500;
        }
        .badge-red { background: #FFEBEE; color: #F44336; }
        .badge-green { background: #E8F5E9; color: #4CAF50; }
        .badge-yellow { background: #FFF3CD; color: #FF9800; }
        .badge-blue { background: #E3F2FD; color: #2196F3; }
        .loading {
            display: none; text-align: center; padding: 30px; color: #667eea; font-size: 1rem;
        }
        .loading.active { display: block; }
        .empty-state {
            text-align: center; padding: 40px; color: #999;
        }
        .section-divider {
            height: 1px; background: linear-gradient(to right, transparent, #e0e0e0, transparent);
            margin: 25px 0;
        }
        .meta-row {
            display: flex; gap: 20px; flex-wrap: wrap; margin-bottom: 15px;
        }
        .meta-item { display: flex; flex-direction: column; flex: 1; min-width: 180px; }
        .meta-item label { font-size: 0.85rem; color: #888; margin-bottom: 4px; }
        .meta-item span { font-size: 0.95rem; color: #333; font-weight: 500; }
        .compare-row {
            display: flex; gap: 15px; margin-bottom: 20px; align-items: flex-end;
        }
        .compare-row .form-group { flex: 1; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>📊 优化调参图表解释 - 在线复核</h1>
        </header>

        <div class="tabs">
            <button class="tab-btn active" onclick="switchTab('calculate')">🧮 参数计算</button>
            <button class="tab-btn" onclick="switchTab('compare')">📋 版本对比</button>
            <button class="tab-btn" onclick="switchTab('trace')">🔍 数据溯源</button>
        </div>

        <div id="tab-calculate" class="tab-content active">
            <div class="card">
                <h2>🧮 参数输入</h2>
                <div class="form-grid">
                    <div class="form-group">
                        <label>分子</label>
                        <input type="number" id="input-molecule" placeholder="30" step="any">
                    </div>
                    <div class="form-group">
                        <label>分母</label>
                        <input type="number" id="input-denominator" placeholder="100" step="any">
                    </div>
                    <div class="form-group">
                        <label>总数</label>
                        <input type="number" id="input-total" placeholder="550" step="any">
                    </div>
                    <div class="form-group">
                        <label>样本量</label>
                        <input type="number" id="input-sample_size" placeholder="50" step="any">
                    </div>
                    <div class="form-group">
                        <label>A值</label>
                        <input type="number" id="input-value_a" placeholder="85" step="any">
                    </div>
                    <div class="form-group">
                        <label>B值</label>
                        <input type="number" id="input-value_b" placeholder="70" step="any">
                    </div>
                </div>

                <h2>📋 元信息</h2>
                <div class="form-grid">
                    <div class="form-group">
                        <label>版本名称</label>
                        <input type="text" id="input-version_name" placeholder="v4">
                    </div>
                    <div class="form-group">
                        <label>来源类型</label>
                        <select id="input-source_type">
                            <option value="excel">excel</option>
                            <option value="manual">manual</option>
                            <option value="api">api</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>来源ID</label>
                        <input type="text" id="input-source_id" placeholder="data_20240601.xlsx">
                    </div>
                    <div class="form-group">
                        <label>来源名称</label>
                        <input type="text" id="input-source_name" placeholder="6月1日数据表格">
                    </div>
                    <div class="form-group">
                        <label>录入人</label>
                        <input type="text" id="input-created_by" placeholder="阿宁">
                    </div>
                </div>
                <div class="form-grid">
                    <div class="form-group">
                        <label>变更描述</label>
                        <input type="text" id="input-change_description" placeholder="修正分子参数">
                    </div>
                    <div class="form-group">
                        <label>变更原因</label>
                        <input type="text" id="input-change_reason" placeholder="发现原始数据录入错误">
                    </div>
                </div>
                <div class="form-group">
                    <label>原始数据（JSON格式）</label>
                    <textarea id="input-raw_data" placeholder='{"分子": 30, "分母": 100, "备注": "修正后的数据"}'></textarea>
                </div>

                <div class="btn-row" style="margin-top: 20px;">
                    <button class="btn btn-success" onclick="loadDemo()">🎬 一键加载演示数据</button>
                    <button class="btn btn-primary" onclick="calculate()">📊 计算并生成解释</button>
                    <button class="btn btn-secondary" onclick="resetForm()">🔄 重置</button>
                </div>

                <div id="calc-loading" class="loading">⏳ 正在计算，请稍候...</div>

                <div id="calc-result" style="display: none;">
                    <div class="section-divider"></div>
                    <h2>📝 通俗易懂解释</h2>
                    <div id="result-summary" class="summary-card"></div>

                    <h2 style="margin-top: 25px;">🎯 关键结论</h2>
                    <ul id="result-findings" class="findings-list"></ul>

                    <h2 style="margin-top: 25px;">⚠️ 边界问题</h2>
                    <div id="result-issues"></div>

                    <h2 style="margin-top: 25px;">🔢 计算步骤</h2>
                    <div id="result-steps"></div>

                    <h2 style="margin-top: 25px;">📊 图表展示</h2>
                    <div class="charts-grid">
                        <div class="chart-box">
                            <h4>参数对比柱状图</h4>
                            <img id="chart1" src="" alt="参数对比图">
                        </div>
                        <div class="chart-box">
                            <h4>计算结果对比图</h4>
                            <img id="chart2" src="" alt="结果对比图">
                        </div>
                    </div>

                    <div class="btn-row" style="margin-top: 20px;">
                        <button class="btn btn-primary" onclick="downloadJson()">📥 下载解释JSON</button>
                        <button class="btn btn-success" onclick="downloadReport()">📦 下载完整报告包</button>
                    </div>
                </div>
            </div>
        </div>

        <div id="tab-compare" class="tab-content">
            <div class="card">
                <h2>📋 版本对比</h2>
                <div class="compare-row">
                    <div class="form-group">
                        <label>版本1</label>
                        <select id="compare-v1"></select>
                    </div>
                    <div class="form-group">
                        <label>版本2</label>
                        <select id="compare-v2"></select>
                    </div>
                    <button class="btn btn-primary" onclick="compareVersions()">🔍 比较</button>
                    <button class="btn btn-secondary" onclick="refreshVersions()">🔄 刷新版本</button>
                </div>

                <div id="compare-loading" class="loading">⏳ 正在对比，请稍候...</div>

                <div id="compare-result" style="display: none;">
                    <h2>📝 参数变更</h2>
                    <table class="diff-table" id="param-diff-table">
                        <thead><tr><th>参数名</th><th>版本1值</th><th>版本2值</th><th>变更类型</th><th>说明</th></tr></thead>
                        <tbody></tbody>
                    </table>

                    <h2 style="margin-top: 25px;">🔢 计算结果差异</h2>
                    <table class="diff-table" id="result-diff-table">
                        <thead><tr><th>计算项</th><th>版本1结果</th><th>版本2结果</th><th>差异</th><th>原因</th></tr></thead>
                        <tbody></tbody>
                    </table>

                    <h2 style="margin-top: 25px;">💡 差异总结</h2>
                    <div id="compare-summary" class="summary-card"></div>
                </div>
            </div>
        </div>

        <div id="tab-trace" class="tab-content">
            <div class="card">
                <h2>🔍 数据溯源</h2>
                <div class="compare-row">
                    <div class="form-group" style="flex: 2;">
                        <label>参数名称</label>
                        <input type="text" id="trace-param" placeholder="分母">
                    </div>
                    <button class="btn btn-primary" onclick="traceParam()">🔍 追溯</button>
                </div>

                <div id="trace-loading" class="loading">⏳ 正在追溯，请稍候...</div>

                <div id="trace-result" style="display: none;">
                    <div class="meta-row">
                        <div class="meta-item">
                            <label>参数名称</label>
                            <span id="trace-param-name"></span>
                        </div>
                        <div class="meta-item">
                            <label>当前值</label>
                            <span id="trace-current-value"></span>
                        </div>
                        <div class="meta-item">
                            <label>当前状态</label>
                            <span id="trace-status"></span>
                        </div>
                    </div>

                    <h2 style="margin-top: 20px;">📅 首次出现</h2>
                    <div id="trace-first" class="step-card"></div>

                    <div id="trace-first-abnormal-wrap" style="display: none;">
                        <h2 style="margin-top: 20px;">⚠️ 首次异常</h2>
                        <div id="trace-first-abnormal" class="issue-card high"></div>
                    </div>

                    <h2 style="margin-top: 20px;">🔄 最后一次变更</h2>
                    <div id="trace-last-change" class="step-card"></div>

                    <h2 style="margin-top: 20px;">⚡ 导致异常的关键变更</h2>
                    <div id="trace-critical"></div>

                    <h2 style="margin-top: 20px;">✅ 有效版本列表</h2>
                    <table class="diff-table" id="trace-valid-table">
                        <thead><tr><th>版本名称</th><th>参数值</th></tr></thead>
                        <tbody></tbody>
                    </table>

                    <h2 style="margin-top: 20px;">💡 处理建议</h2>
                    <div id="trace-suggestion" class="summary-card"></div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let lastCalcResult = null;

        function switchTab(name) {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            event.target.classList.add('active');
            document.getElementById('tab-' + name).classList.add('active');
            if (name === 'compare') refreshVersions();
        }

        async function apiCall(url, method, body) {
            const opts = { method, headers: { 'Content-Type': 'application/json' } };
            if (body) opts.body = JSON.stringify(body);
            const res = await fetch(url, opts);
            return await res.json();
        }

        function resetForm() {
            ['molecule','denominator','total','sample_size','value_a','value_b',
             'version_name','source_id','source_name','created_by',
             'change_description','change_reason','raw_data'].forEach(id => {
                document.getElementById('input-' + id).value = '';
            });
            document.getElementById('input-source_type').value = 'excel';
            document.getElementById('calc-result').style.display = 'none';
            lastCalcResult = null;
        }

        async function loadDemo() {
            const loading = document.getElementById('calc-loading');
            loading.classList.add('active');
            try {
                await apiCall('/api/load_demo', 'GET');
                alert('✅ 演示数据加载成功！已生成3个版本（v1, v2, v3），请点击计算或切换到其他标签体验。');
                refreshVersions();
            } catch (e) {
                alert('加载失败：' + e.message);
            } finally {
                loading.classList.remove('active');
            }
        }

        async function calculate() {
            const loading = document.getElementById('calc-loading');
            const resultBox = document.getElementById('calc-result');
            loading.classList.add('active');
            resultBox.style.display = 'none';

            try {
                let raw_data = {};
                const rawStr = document.getElementById('input-raw_data').value.trim();
                if (rawStr) {
                    try { raw_data = JSON.parse(rawStr); } catch(e) { alert('原始数据JSON格式错误'); return; }
                }

                const body = {
                    molecule: parseFloat(document.getElementById('input-molecule').value) || 0,
                    denominator: parseFloat(document.getElementById('input-denominator').value) || 0,
                    total: parseFloat(document.getElementById('input-total').value) || 0,
                    sample_size: parseFloat(document.getElementById('input-sample_size').value) || 0,
                    value_a: parseFloat(document.getElementById('input-value_a').value) || 0,
                    value_b: parseFloat(document.getElementById('input-value_b').value) || 0,
                    version_name: document.getElementById('input-version_name').value || 'v1',
                    source_type: document.getElementById('input-source_type').value,
                    source_id: document.getElementById('input-source_id').value || 'unknown',
                    source_name: document.getElementById('input-source_name').value || '未命名来源',
                    created_by: document.getElementById('input-created_by').value || '匿名',
                    raw_data: raw_data,
                    change_description: document.getElementById('input-change_description').value,
                    change_reason: document.getElementById('input-change_reason').value,
                };

                const res = await apiCall('/api/calculate', 'POST', body);
                if (!res.success) { alert('计算失败'); return; }

                lastCalcResult = res;
                document.getElementById('result-summary').textContent = res.summary;

                const findingsEl = document.getElementById('result-findings');
                findingsEl.innerHTML = res.findings.map(f => `<li>${f}</li>`).join('');

                const issuesEl = document.getElementById('result-issues');
                if (res.issues && res.issues.length) {
                    issuesEl.innerHTML = res.issues.map(i => `
                        <div class="issue-card ${i.severity}">
                            <h4>${i.type} <span class="badge badge-${i.severity === 'high' ? 'red' : 'yellow'}">${i.severity === 'high' ? '严重' : '中等'}</span></h4>
                            <p><strong>位置：</strong>${i.source_location}</p>
                            <p>${i.message}</p>
                            <p><strong>影响计算：</strong>${i.affected_calculations ? i.affected_calculations.join(', ') : '-'}</p>
                            ${i.fallback_hint ? `<p><strong>回退建议：</strong>${i.fallback_hint}</p>` : ''}
                        </div>
                    `).join('');
                } else {
                    issuesEl.innerHTML = '<div class="empty-state">✅ 未发现边界问题</div>';
                }

                const stepsEl = document.getElementById('result-steps');
                stepsEl.innerHTML = res.steps.map(s => `
                    <div class="step-card">
                        <h4>${s.name}</h4>
                        <div class="formula">${s.formula}</div>
                        <p><strong>输入：</strong>${JSON.stringify(s.inputs)}</p>
                        <p><strong>结果：</strong><code>${s.output}</code></p>
                        ${s.data_lineage && s.data_lineage.length ? `
                        <table class="lineage-table">
                            <thead><tr><th>输入参数</th><th>来源位置</th><th>版本</th><th>录入人</th><th>原始值</th><th>是否清洗</th></tr></thead>
                            <tbody>
                                ${s.data_lineage.map(dl => `<tr>
                                    <td>${dl.input_name}</td>
                                    <td>${dl.source_location}</td>
                                    <td>${dl.version_name}</td>
                                    <td>${dl.created_by}</td>
                                    <td>${dl.raw_value}</td>
                                    <td>${dl.was_cleaned ? '是' : '否'}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>` : ''}
                    </div>
                `).join('');

                if (res.chart1_path) document.getElementById('chart1').src = res.chart1_path;
                if (res.chart2_path) document.getElementById('chart2').src = res.chart2_path;

                resultBox.style.display = 'block';
                refreshVersions();
            } catch (e) {
                alert('计算出错：' + e.message);
            } finally {
                loading.classList.remove('active');
            }
        }

        function downloadJson() {
            if (!lastCalcResult) return;
            const blob = new Blob([JSON.stringify(lastCalcResult, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `explanation_${Date.now()}.json`; a.click();
            URL.revokeObjectURL(url);
        }

        function downloadReport() {
            window.location.href = '/api/export_report';
        }

        async function refreshVersions() {
            try {
                const res = await apiCall('/api/versions', 'GET');
                const v1 = document.getElementById('compare-v1');
                const v2 = document.getElementById('compare-v2');
                const cur1 = v1.value;
                const cur2 = v2.value;
                v1.innerHTML = ''; v2.innerHTML = '';
                res.forEach(v => {
                    v1.innerHTML += `<option value="${v}">${v}</option>`;
                    v2.innerHTML += `<option value="${v}">${v}</option>`;
                });
                if (cur1) v1.value = cur1;
                if (cur2) v2.value = cur2;
                else if (res.length >= 2) { v1.value = res[0]; v2.value = res[res.length-1]; }
            } catch(e) {}
        }

        async function compareVersions() {
            const v1 = document.getElementById('compare-v1').value;
            const v2 = document.getElementById('compare-v2').value;
            if (!v1 || !v2) { alert('请选择两个版本'); return; }
            const loading = document.getElementById('compare-loading');
            loading.classList.add('active');
            document.getElementById('compare-result').style.display = 'none';
            try {
                const res = await apiCall('/api/compare', 'POST', {version1: v1, version2: v2});
                const pBody = document.querySelector('#param-diff-table tbody');
                pBody.innerHTML = res.param_diff.map(r => `<tr>
                    <td>${r.param_name}</td><td>${r.v1}</td><td>${r.v2}</td>
                    <td><span class="badge badge-${r.change_type === '修改' ? 'yellow' : r.change_type === '新增' ? 'green' : 'red'}">${r.change_type}</span></td>
                    <td>${r.description}</td>
                </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#999;">无参数变更</td></tr>';

                const rBody = document.querySelector('#result-diff-table tbody');
                rBody.innerHTML = res.result_diff.map(r => `<tr>
                    <td>${r.name}</td><td>${r.v1}</td><td>${r.v2}</td>
                    <td>${r.diff}</td><td>${r.reason || '-'}</td>
                </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#999;">无计算结果</td></tr>';

                document.getElementById('compare-summary').textContent = res.summary;
                document.getElementById('compare-result').style.display = 'block';
            } catch (e) {
                alert('对比失败：' + e.message);
            } finally {
                loading.classList.remove('active');
            }
        }

        async function traceParam() {
            const param = document.getElementById('trace-param').value.trim();
            if (!param) { alert('请输入参数名称'); return; }
            const loading = document.getElementById('trace-loading');
            loading.classList.add('active');
            document.getElementById('trace-result').style.display = 'none';
            try {
                const res = await apiCall('/api/trace', 'POST', {param_name: param});
                if (!res.found) { alert(res.message); return; }

                document.getElementById('trace-param-name').textContent = res.param_name;
                document.getElementById('trace-current-value').textContent = res.current_value;
                const statusBadge = `<span class="badge badge-${res.current_is_abnormal ? 'red' : 'green'}">${res.current_is_abnormal ? '异常' : '正常'}</span>`;
                document.getElementById('trace-status').innerHTML = statusBadge;

                const fo = res.first_occurrence;
                document.getElementById('trace-first').innerHTML = `
                    <p><strong>版本：</strong>${fo.version_name} &nbsp;|&nbsp; <strong>初始值：</strong>${fo.value}</p>
                    <p><strong>来源：</strong>${fo.source_name} (ID: ${fo.source_id})</p>
                    <p><strong>录入人：</strong>${fo.created_by} &nbsp;|&nbsp; <strong>时间：</strong>${fo.created_at}</p>
                    <p><strong>原始数据：</strong><code>${JSON.stringify(fo.raw_data)}</code></p>
                `;

                const faWrap = document.getElementById('trace-first-abnormal-wrap');
                if (res.first_abnormal) {
                    faWrap.style.display = 'block';
                    const fa = res.first_abnormal;
                    document.getElementById('trace-first-abnormal').innerHTML = `
                        <h4>版本 ${fa.version_name} 值为 ${fa.value}</h4>
                        <p><strong>来源：</strong>${fa.source_name} (ID: ${fa.source_id})</p>
                        <p><strong>录入人：</strong>${fa.created_by} &nbsp;|&nbsp; <strong>时间：</strong>${fa.created_at}</p>
                        <p>建议联系 ${fa.created_by} 确认该条记录是否正确</p>
                    `;
                } else {
                    faWrap.style.display = 'none';
                }

                const lc = res.last_change;
                document.getElementById('trace-last-change').innerHTML = lc ? `
                    <p>${lc.from_version} (${lc.from_value}) → ${lc.to_version} (${lc.to_value})</p>
                    <p><strong>变更人：</strong>${lc.changed_by} &nbsp;|&nbsp; <strong>来源：</strong>${lc.source_name}</p>
                    <p><strong>定位：</strong>${lc.row_hint}</p>
                ` : '<p style="color:#999;">暂无变更记录</p>';

                const ccEl = document.getElementById('trace-critical');
                if (res.critical_changes && res.critical_changes.length) {
                    ccEl.innerHTML = res.critical_changes.map((cc, i) => `
                        <div class="issue-card ${cc.description.includes('已修复') ? 'medium' : 'high'}">
                            <h4>第${i+1}次关键变更</h4>
                            <p>${cc.description}</p>
                            <p><strong>版本：</strong>${cc.from_version} → ${cc.to_version}</p>
                            <p><strong>定位：</strong>${cc.row_hint}</p>
                            <p><strong>原始数据：</strong><code>${JSON.stringify(cc.raw_data)}</code></p>
                        </div>
                    `).join('');
                } else {
                    ccEl.innerHTML = '<div class="empty-state">无关键异常变更</div>';
                }

                const vtBody = document.querySelector('#trace-valid-table tbody');
                vtBody.innerHTML = res.valid_versions.map(v => `<tr><td>${v.version_name}</td><td>${v.value}</td></tr>`).join('')
                    || '<tr><td colspan="2" style="text-align:center;color:#999;">无有效版本</td></tr>';

                document.getElementById('trace-suggestion').textContent = res.suggestion;
                document.getElementById('trace-result').style.display = 'block';
            } catch (e) {
                alert('追溯失败：' + e.message);
            } finally {
                loading.classList.remove('active');
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            refreshVersions();
        });
    </script>
</body>
</html>"""
    return html


@app.route("/api/calculate", methods=["POST"])
def api_calculate():
    global _last_explanation, _last_chart_paths
    try:
        data = request.get_json(force=True)

        parameters = {}
        field_map = {
            "molecule": "分子",
            "denominator": "分母",
            "total": "总数",
            "sample_size": "样本量",
            "value_a": "A值",
            "value_b": "B值",
        }
        for req_key, param_key in field_map.items():
            if req_key in data and data[req_key] is not None:
                parameters[param_key] = data[req_key]

        manager = load_manager()
        manager.import_parameters(
            parameters=parameters,
            source_type=data.get("source_type", "manual"),
            source_id=data.get("source_id", "unknown"),
            source_name=data.get("source_name", "未命名来源"),
            raw_data=data.get("raw_data", {}),
            created_by=data.get("created_by", "匿名"),
            version_name=data.get("version_name") or None,
            change_description=data.get("change_description", ""),
            change_reason=data.get("change_reason", ""),
        )
        save_manager(manager)

        explainer = ChartExplainer(manager)
        explanation = explainer.explain()

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        chart1_path = generate_param_chart(parameters, timestamp)
        chart2_path = generate_result_chart(explanation.calculation_steps, timestamp)

        result = format_calculate_response(explanation, chart1_path, chart2_path)
        _last_explanation = explanation.to_dict()
        _last_chart_paths = {"chart1": chart1_path, "chart2": chart2_path}

        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/versions", methods=["GET"])
def api_versions():
    try:
        manager = load_manager()
        versions = [v.version_name for v in manager.list_versions()]
        return jsonify(versions)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/compare", methods=["POST"])
def api_compare():
    try:
        data = request.get_json(force=True)
        v1_name = data.get("version1")
        v2_name = data.get("version2")

        manager = load_manager()
        vid1 = get_version_id_by_name(manager, v1_name)
        vid2 = get_version_id_by_name(manager, v2_name)

        if not vid1 or not vid2:
            return jsonify({"success": False, "error": "版本不存在"}), 400

        explainer = ChartExplainer(manager)
        exp1 = explainer.explain(version_id=vid1)
        exp2 = explainer.explain(version_id=vid2)

        changes = manager.compare_versions(vid1, vid2)
        param_diff = []
        all_params = set()
        ver1 = manager.get_version(vid1)
        ver2 = manager.get_version(vid2)
        if ver1: all_params.update(ver1.parameters.keys())
        if ver2: all_params.update(ver2.parameters.keys())
        for p in sorted(all_params):
            v1_val = ver1.parameters.get(p, "-") if ver1 else "-"
            v2_val = ver2.parameters.get(p, "-") if ver2 else "-"
            ctype = "修改"
            if p not in (ver1.parameters if ver1 else {}):
                ctype = "新增"
            elif p not in (ver2.parameters if ver2 else {}):
                ctype = "删除"
            elif v1_val == v2_val:
                continue
            desc = next((c.description for c in changes if c.param_name == p), f"{p} 从 {v1_val} 变为 {v2_val}")
            param_diff.append({
                "param_name": p, "v1": v1_val, "v2": v2_val,
                "change_type": ctype, "description": desc,
            })

        result_diff = []
        step_names = set()
        for s in exp1.calculation_steps: step_names.add(s.step_name)
        for s in exp2.calculation_steps: step_names.add(s.step_name)
        for name in sorted(step_names):
            s1 = next((s for s in exp1.calculation_steps if s.step_name == name), None)
            s2 = next((s for s in exp2.calculation_steps if s.step_name == name), None)
            v1_out = s1.output if s1 else "-"
            v2_out = s2.output if s2 else "-"
            causing = []
            for c in changes:
                if s2 and c.param_name in s2.inputs:
                    causing.append(c.param_name)
            reason = "参数变更导致" if causing else "计算逻辑或版本差异"
            diff = "-"
            try:
                if isinstance(v1_out, (int, float)) and isinstance(v2_out, (int, float)):
                    diff = v2_out - v1_out
            except Exception:
                pass
            result_diff.append({
                "name": name, "v1": v1_out, "v2": v2_out,
                "diff": diff, "reason": reason,
            })

        summary_parts = [f"版本对比：{v1_name} → {v2_name}"]
        if param_diff:
            summary_parts.append(f"\n参数变更 {len(param_diff)} 处：")
            for d in param_diff:
                summary_parts.append(f"  - {d['description']}")
        if result_diff:
            summary_parts.append(f"\n计算结果差异 {len(result_diff)} 处：")
            for d in result_diff:
                summary_parts.append(f"  - {d['name']}: {d['v1']} → {d['v2']} (差异: {d['diff']})")
        if not param_diff and not result_diff:
            summary_parts.append("两个版本完全一致")

        return jsonify({
            "success": True,
            "param_diff": param_diff,
            "result_diff": result_diff,
            "summary": "\n".join(summary_parts),
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/trace", methods=["POST"])
def api_trace():
    try:
        data = request.get_json(force=True)
        param_name = data.get("param_name", "")
        if not param_name:
            return jsonify({"success": False, "error": "参数名称不能为空"}), 400

        manager = load_manager()
        explainer = ChartExplainer(manager)
        result = explainer.trace_bad_data(param_name)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/load_demo", methods=["GET"])
def api_load_demo():
    try:
        manager = ParameterManager()
        raw_data1 = {"分子": 25, "分母": 100, "备注": "原始录入数据，来自Excel表格"}
        manager.import_parameters(
            parameters={"分子": 25, "分母": 100, "总数": 500, "样本量": 50},
            source_type="excel", source_id="data_20240601.xlsx", source_name="6月1日数据表格",
            raw_data=raw_data1, created_by="阿宁", version_name="v1",
            change_description="初始参数导入", change_reason="首次录入",
            notes="教研编辑阿宁提供的原始数据",
        )
        raw_data2 = {"分子": 30, "分母": 100, "备注": "修正后的数据"}
        manager.import_parameters(
            parameters={"分子": 30, "分母": 100, "总数": 550, "样本量": 50},
            source_type="excel", source_id="data_20240601.xlsx", source_name="6月1日数据表格",
            raw_data=raw_data2, created_by="阿宁", version_name="v2",
            change_description="修正分子和总数", change_reason="发现原始数据录入错误，分子应为30",
        )
        raw_data3 = {"分子": 30, "分母": 0, "备注": "分母错误地设为0"}
        manager.import_parameters(
            parameters={"分子": 30, "分母": 0, "总数": 550, "样本量": 50, "A值": 85, "B值": 70},
            source_type="manual", source_id="manual_input_001", source_name="手动录入",
            raw_data=raw_data3, created_by="排班同事", version_name="v3",
            change_description="添加A值和B值，分母意外设为0", change_reason="测试除零边界处理",
            notes="用于测试边界条件",
        )
        save_manager(manager)
        return jsonify({"success": True, "message": "演示数据已生成，包含 v1, v2, v3 三个版本"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/charts/<filename>", methods=["GET"])
def serve_chart(filename):
    return send_from_directory(str(CHARTS_DIR), filename)


@app.route("/api/export_report", methods=["GET"])
def api_export_report():
    global _last_explanation, _last_chart_paths
    try:
        if not _last_explanation:
            manager = load_manager()
            if manager.get_active_version():
                explainer = ChartExplainer(manager)
                exp = explainer.explain()
                _last_explanation = exp.to_dict()
                params = manager.get_active_version().parameters
                ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                chart1 = generate_param_chart(params, ts)
                chart2 = generate_result_chart(exp.calculation_steps, ts)
                _last_chart_paths = {"chart1": chart1, "chart2": chart2}
            else:
                return jsonify({"success": False, "error": "暂无报告，请先执行计算"}), 400

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            exp_json = json.dumps(_last_explanation, ensure_ascii=False, indent=2)
            zf.writestr("explanation.json", exp_json)

            md_lines = [f"# {_last_explanation.get('title', '图表解释报告')}",
                        f"版本: {_last_explanation.get('version_name')}",
                        f"生成时间: {_last_explanation.get('generated_at')}",
                        "",
                        "## 通俗易懂解释",
                        _last_explanation.get('plain_language_summary', ''),
                        "",
                        "## 关键结论"]
            for f in _last_explanation.get('key_findings', []):
                md_lines.append(f"- {f}")
            md_lines.extend(["", "## 边界问题"])
            for i in _last_explanation.get('boundary_issues', []):
                md_lines.extend([f"### {i.get('issue_type')} ({i.get('severity')})",
                                 i.get('message', ''), "",
                                 "**处理建议:**", i.get('suggestion', ''), ""])
            md_lines.extend(["", "## 计算步骤"])
            for s in _last_explanation.get('calculation_steps', []):
                md_lines.extend([f"### {s.get('step_name')}",
                                 f"公式: {s.get('formula')}",
                                 f"输入: {json.dumps(s.get('inputs', {}), ensure_ascii=False)}",
                                 f"输出: {s.get('output')}", ""])
                if s.get('data_lineage'):
                    md_lines.extend(["#### 数据来源", ""])
                    for dl in s['data_lineage']:
                        o = dl.get('origin', dl)
                        md_lines.extend([
                            f"- **{o.get('param_name', dl.get('input_name'))}** = {o.get('param_value', dl.get('input_value'))}",
                            f"  - 来源定位: {o.get('source_location', o.get('row_hint', 'N/A'))}",
                            f"  - 版本: {o.get('version_name')} | 录入人: {o.get('created_by')} | 录入时间: {o.get('created_at')}",
                            f"  - 原始值: {o.get('raw_value')}",
                        ])
                        if o.get('was_cleaned'):
                            md_lines.append(f"  - ⚠️ 经过清洗: {o.get('cleaning_note', '')}")
                        if o.get('change_from_previous'):
                            md_lines.append(f"  - 变更记录: {o.get('change_from_previous')}")
                        raw_snap = o.get('raw_data_snapshot') or o.get('raw_data')
                        if raw_snap:
                            md_lines.append(f"  - 原始数据快照: `{json.dumps(raw_snap, ensure_ascii=False)}`")
                        md_lines.append("")
            zf.writestr("explanation.md", "\n".join(md_lines))

            boundary_md = ["# 边界问题处理建议", ""]
            for i in _last_explanation.get('boundary_issues', []):
                boundary_md.extend([
                    f"## {i.get('issue_type')} - {i.get('severity')}",
                    f"**位置:** {i.get('location')}",
                    f"**问题描述:**", i.get('message', ''), "",
                ])
                if i.get('affected_calculations'):
                    boundary_md.extend([
                        "**影响的计算:**",
                        ", ".join(i['affected_calculations']), "",
                    ])
                po = i.get('param_origin')
                if po:
                    boundary_md.extend([
                        "**参数来源追踪:**",
                        f"- 参数: {po.get('param_name')} = {po.get('param_value')}",
                        f"- 来源定位: {po.get('source_location', po.get('row_hint'))}",
                        f"- 来源信息: {po.get('source_type')} | {po.get('source_id')} | {po.get('source_name')}",
                        f"- 录入人: {po.get('created_by')} | 录入时间: {po.get('created_at')}",
                        f"- 版本: {po.get('version_name')}",
                        f"- 原始值: {po.get('raw_value')}",
                        "",
                    ])
                if i.get('fallback_version_hint'):
                    boundary_md.extend([
                        "**回退建议:**", i.get('fallback_version_hint'), "",
                    ])
                boundary_md.extend([
                    "**处理建议:**", i.get('suggestion', ''), "",
                ])
            if not _last_explanation.get('boundary_issues'):
                boundary_md.append("暂无边界问题。")
            zf.writestr("boundary_suggestions.md", "\n".join(boundary_md))

            if _last_chart_paths:
                for key, url_path in _last_chart_paths.items():
                    fname = url_path.rsplit("/", 1)[-1]
                    fpath = CHARTS_DIR / fname
                    if fpath.exists():
                        zf.write(str(fpath), arcname=fname)

        buf.seek(0)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        return send_file(
            buf, mimetype="application/zip", as_attachment=True,
            download_name=f"report_{ts}.zip"
        )
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
