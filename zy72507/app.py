#!/usr/bin/env python3
import os
import json
import csv
from datetime import datetime
from pathlib import Path
from flask import Flask, render_template_string, request, redirect, url_for, jsonify, Response, send_file, abort

from drift_system import (
    init_db, DB_PATH,
    ImportService, AdjustmentService,
    SelfCheckService, DataAccessor,
    ExportService, ReportService,
    STATUS_LABEL,
)

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

BASE_DIR = Path(__file__).parent
EXPORT_DIR = BASE_DIR / "exports"
EXPORT_DIR.mkdir(exist_ok=True)

if not Path(DB_PATH).exists():
    init_db()


def read_csv_file(file_storage):
    content = file_storage.read().decode("utf-8-sig")
    lines = content.splitlines()
    reader = csv.DictReader(lines)
    return list(reader)


def read_json_file(file_storage):
    content = file_storage.read().decode("utf-8")
    return json.loads(content)


BASE_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>门店评论情绪漂移系统</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #f5f7fa; color: #303133; line-height: 1.6; }
.header { background: linear-gradient(135deg, #3a8ee6 0%, #2d6cb5 100%); color: white; padding: 20px 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
.header h1 { font-size: 22px; font-weight: 600; }
.header .sub { opacity: 0.85; font-size: 13px; margin-top: 4px; }
.nav { background: white; padding: 0 40px; border-bottom: 1px solid #ebeef5; display: flex; gap: 4px; }
.nav a { display: inline-block; padding: 14px 20px; text-decoration: none; color: #606266; font-size: 14px; border-bottom: 2px solid transparent; transition: all 0.2s; }
.nav a:hover { color: #409eff; }
.nav a.active { color: #409eff; border-bottom-color: #409eff; font-weight: 500; }
.container { padding: 24px 40px; max-width: 1600px; margin: 0 auto; }
.card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 1px 4px rgba(0,0,0,0.04); }
.card-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #ebeef5; display: flex; justify-content: space-between; align-items: center; }
.card-title .tag { font-size: 12px; padding: 2px 10px; border-radius: 10px; background: #ecf5ff; color: #409eff; font-weight: normal; }
.btn { display: inline-block; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; text-decoration: none; transition: all 0.2s; }
.btn-primary { background: #409eff; color: white; }
.btn-primary:hover { background: #66b1ff; }
.btn-success { background: #67c23a; color: white; }
.btn-success:hover { background: #85ce61; }
.btn-warning { background: #e6a23c; color: white; }
.btn-warning:hover { background: #ebb563; }
.btn-danger { background: #f56c6c; color: white; }
.btn-danger:hover { background: #f78989; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.grid { display: grid; gap: 16px; }
.grid-4 { grid-template-columns: repeat(4, 1fr); }
.grid-2 { grid-template-columns: repeat(2, 1fr); }
.stat { padding: 16px; border-radius: 6px; border-left: 4px solid; }
.stat-blue { background: #ecf5ff; border-color: #409eff; }
.stat-green { background: #f0f9eb; border-color: #67c23a; }
.stat-orange { background: #fdf6ec; border-color: #e6a23c; }
.stat-red { background: #fef0f0; border-color: #f56c6c; }
.stat .num { font-size: 28px; font-weight: 600; margin-top: 6px; }
.stat .label { font-size: 13px; color: #606266; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 12px; }
.badge-info { background: #ecf5ff; color: #409eff; }
.badge-success { background: #f0f9eb; color: #67c23a; }
.badge-warning { background: #fdf6ec; color: #e6a23c; }
.badge-danger { background: #fef0f0; color: #f56c6c; }
.badge-primary { background: #e8e8ff; color: #606266; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #ebeef5; vertical-align: top; }
th { background: #fafafa; font-weight: 500; color: #606266; white-space: nowrap; }
tr:hover { background: #fafcff; }
.form-group { margin-bottom: 14px; }
.form-group label { display: block; margin-bottom: 6px; font-size: 13px; color: #606266; font-weight: 500; }
.form-group input[type=text], .form-group input[type=file], .form-group select, .form-group textarea {
    width: 100%; padding: 8px 10px; border: 1px solid #dcdfe6; border-radius: 4px; font-size: 13px; outline: none; transition: border 0.2s;
}
.form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #409eff; }
.alert { padding: 12px 16px; border-radius: 4px; margin-bottom: 16px; font-size: 13px; }
.alert-success { background: #f0f9eb; color: #67c23a; border-left: 4px solid #67c23a; }
.alert-warning { background: #fdf6ec; color: #e6a23c; border-left: 4px solid #e6a23c; }
.alert-danger { background: #fef0f0; color: #f56c6c; border-left: 4px solid #f56c6c; }
.alert-info { background: #ecf5ff; color: #409eff; border-left: 4px solid #409eff; }
.breadcrumb { margin-bottom: 16px; font-size: 13px; color: #909399; }
.breadcrumb a { color: #409eff; text-decoration: none; }
.breadcrumb span { margin: 0 6px; }
.timeline { padding-left: 20px; }
.timeline-item { padding: 8px 0; position: relative; border-left: 2px solid #e4e7ed; padding-left: 16px; }
.timeline-item::before { content: ""; position: absolute; left: -7px; top: 12px; width: 12px; height: 12px; border-radius: 50%; background: #409eff; }
.timeline-item .time { font-size: 12px; color: #909399; }
.timeline-item .event { font-size: 13px; color: #303133; margin-top: 2px; }
.timeline-item .who { font-size: 12px; color: #606266; margin-top: 2px; }
.inline-form { display: flex; gap: 8px; align-items: flex-end; flex-wrap: wrap; }
.inline-form .form-group { margin-bottom: 0; flex: 1; min-width: 150px; }
details { margin-bottom: 10px; }
summary { cursor: pointer; padding: 8px 0; font-weight: 500; color: #409eff; }
pre { background: #2d2d2d; color: #f8f8f2; padding: 12px; border-radius: 4px; font-size: 12px; overflow-x: auto; }
.json-display { font-size: 12px; }
.section-title { font-size: 14px; font-weight: 600; margin: 16px 0 10px 0; color: #606266; padding-left: 8px; border-left: 3px solid #409eff; }
.empty { text-align: center; padding: 40px; color: #909399; font-size: 13px; }
</style>
</head>
<body>
<div class="header">
  <h1>🏪 门店评论情绪漂移系统</h1>
  <div class="sub">标注员留言 + 模型输出片段 双源对齐 · 人工改判追溯 · 安全审核复核</div>
</div>
<nav class="nav">
  <a href="{{ url_for('index') }}" class="{% if request.endpoint == 'index' %}active{% endif %}">📊 总览/报告</a>
  <a href="{{ url_for('records_list') }}" class="{% if request.endpoint == 'records_list' %}active{% endif %}">📝 明细记录</a>
  <a href="{{ url_for('import_page') }}" class="{% if request.endpoint == 'import_page' %}active{% endif %}">📥 数据导入</a>
  <a href="{{ url_for('self_check_page') }}" class="{% if request.endpoint == 'self_check_page' %}active{% endif %}">🔍 自检中心</a>
  <a href="{{ url_for('batches_list') }}" class="{% if request.endpoint == 'batches_list' %}active{% endif %}">📦 导入批次</a>
  <a href="{{ url_for('export_page') }}" class="{% if request.endpoint == 'export_page' %}active{% endif %}">📤 导出</a>
</nav>
<div class="container">
  {% with messages = get_flashed_messages(with_categories=true) %}
    {% for category, msg in messages %}
      <div class="alert alert-{{ category }}">{{ msg|safe }}</div>
    {% endfor %}
  {% endwith %}
  {% block content %}{% endblock %}
</div>
</body>
</html>
"""


@app.route("/")
def index():
    report = ReportService.generate_report()
    checks = SelfCheckService.run_all_checks()
    check_warnings = [c for c in checks if c["status"] != "passed"]
    text_report = ReportService.get_report_summary_text(report)

    return render_template_string(BASE_TEMPLATE + """
{% block content %}
<div class="grid grid-4">
  <div class="stat stat-blue">
    <div class="label">总评论数</div>
    <div class="num">{{ report.summary.total_records }}</div>
  </div>
  <div class="stat stat-red">
    <div class="label">情绪漂移数</div>
    <div class="num">{{ report.summary.drift_count }} <span style="font-size:14px;">({{ report.summary.drift_rate }}%)</span></div>
  </div>
  <div class="stat stat-orange">
    <div class="label">待安全审核（被批跑覆盖）</div>
    <div class="num">{{ report.summary.overridden_pending_count }}</div>
  </div>
  <div class="stat stat-green">
    <div class="label">已安全复核</div>
    <div class="num">{{ report.summary.reviewed_count }}</div>
  </div>
</div>

{% if check_warnings %}
<div class="card" style="margin-top:20px; border-left: 4px solid #e6a23c;">
  <div class="card-title">
    <span>⚠️ 自检告警（{{ check_warnings|length }}项）</span>
    <a href="{{ url_for('self_check_page') }}" class="btn btn-warning btn-sm">前往处理</a>
  </div>
  <table>
    <tr><th>自检项</th><th>状态</th><th>详情</th></tr>
    {% for c in check_warnings %}
    <tr>
      <td>{{ c.check_label }}</td>
      <td><span class="badge badge-warning">{{ c.status_label }}</span></td>
      <td>
        {% if c.pending_review is defined %}待复核: {{ c.pending_review }}条{% endif %}
        {% if c.incomplete is defined %}数据不全: {{ c.incomplete }}条{% endif %}
        {% if c.issues is defined and c.issues %}共{{ c.issues|length }}项问题{% endif %}
      </td>
    </tr>
    {% endfor %}
  </table>
</div>
{% endif %}

<div class="grid grid-2" style="margin-top:20px;">
  <div class="card">
    <div class="card-title"><span>📊 状态分布</span><span class="tag">实时</span></div>
    <table>
      <tr><th>状态</th><th>数量</th><th>占比</th></tr>
      {% for code, info in report.status_distribution.items() %}
      <tr>
        <td>
          {% set cls = 'badge-primary' %}
          {% if code == 'drift_detected' %}{% set cls = 'badge-danger' %}
          {% elif code == 'adjustment_overridden' %}{% set cls = 'badge-warning' %}
          {% elif code == 'reviewed' %}{% set cls = 'badge-success' %}
          {% elif code == 'manually_adjusted' %}{% set cls = 'badge-info' %}{% endif %}
          <span class="badge {{ cls }}">{{ info.label }}</span>
        </td>
        <td><b>{{ info.count }}</b></td>
        <td>{{ ((info.count / report.summary.total_records * 100) if report.summary.total_records else 0)|round(1) }}%</td>
      </tr>
      {% endfor %}
    </table>
  </div>

  <div class="card">
    <div class="card-title"><span>🏬 门店分布</span><span class="tag">{{ report.store_distribution|length }}家</span></div>
    <table>
      <tr><th>门店ID</th><th>评论数</th><th>漂移数</th><th>漂移率</th></tr>
      {% for s in report.store_distribution %}
      <tr>
        <td><b>{{ s.store_id }}</b></td>
        <td>{{ s.cnt }}</td>
        <td>{{ s.drift_cnt or 0 }}</td>
        <td>
          {% set rate = s.drift_rate %}
          {% if rate > 30 %}<span class="badge badge-danger">{{ rate }}%</span>
          {% elif rate > 15 %}<span class="badge badge-warning">{{ rate }}%</span>
          {% else %}<span class="badge badge-success">{{ rate }}%</span>{% endif %}
        </td>
      </tr>
      {% endfor %}
    </table>
  </div>
</div>

<div class="card">
  <div class="card-title"><span>📋 评测报告（文本版）</span>
    <span>
      <button class="btn btn-sm btn-primary" onclick="navigator.clipboard.writeText(document.getElementById('report-text').innerText)">📋 复制</button>
    </span>
  </div>
  <pre id="report-text">{{ text_report }}</pre>
</div>

<div class="card">
  <div class="card-title"><span>📦 最近导入批次</span><span class="tag">最近10条</span></div>
  <table>
    <tr><th>批次ID</th><th>类型</th><th>源文件</th><th>导入时间</th><th>记录数</th><th>重复数</th></tr>
    {% for b in report.import_batches_recent %}
    <tr>
      <td>#{{ b.id }}</td>
      <td><span class="badge {% if b.batch_type == 'annotator' %}badge-info{% else %}badge-primary{% endif %}">
        {{ '标注员留言' if b.batch_type == 'annotator' else '模型输出' }}
      </span></td>
      <td>{{ b.source_file or '-' }}</td>
      <td>{{ b.import_time }}</td>
      <td>{{ b.record_count }}</td>
      <td>{{ b.duplicate_count or 0 }}</td>
    </tr>
    {% endfor %}
  </table>
</div>

<div style="display:flex;gap:12px;margin-top:20px;">
  <a href="{{ url_for('import_page') }}" class="btn btn-primary">📥 立即导入数据</a>
  <a href="{{ url_for('records_list') }}" class="btn btn-success">📝 查看全部明细</a>
  <a href="{{ url_for('records_list', status='adjustment_overridden') }}" class="btn btn-warning">⚠️ 处理待审核记录</a>
</div>
{% endblock %}
""", report=report, checks=checks, check_warnings=check_warnings, text_report=text_report)


@app.route("/records")
def records_list():
    status = request.args.get("status")
    store_id = request.args.get("store_id")
    records = DataAccessor.list_records(status=status, store_id=store_id)
    return render_template_string(BASE_TEMPLATE + """
{% block content %}
<div class="breadcrumb">
  <a href="{{ url_for('index') }}">首页</a><span>/</span>明细记录
</div>
<div class="card">
  <div class="card-title">
    <span>📝 明细记录（共{{ records|length }}条）</span>
    <div>
      <form class="inline-form" method="get" style="display:inline-flex;">
        <select name="status" onchange="this.form.submit()" style="padding:6px 10px;">
          <option value="">全部状态</option>
          {% for code, label in STATUS_LABEL.items() %}
          <option value="{{ code }}" {% if request.args.get('status') == code %}selected{% endif %}>{{ label }}</option>
          {% endfor %}
        </select>
        <input type="text" name="store_id" placeholder="门店ID" value="{{ request.args.get('store_id', '') }}"
               style="padding:6px 10px;width:120px;">
        <button class="btn btn-sm btn-primary">筛选</button>
      </form>
    </div>
  </div>
  {% if records %}
  <table>
    <tr>
      <th>评论ID</th><th>门店</th><th>原始行号</th>
      <th>标注员留言</th><th>标注情绪</th>
      <th>模型片段</th><th>模型情绪</th><th>漂移</th>
      <th>原始情绪</th><th>当前情绪</th>
      <th>状态</th><th>最后更新</th><th>操作</th>
    </tr>
    {% for r in records %}
    <tr>
      <td><code>{{ r.comment_id }}</code></td>
      <td>{{ r.store_id or '-' }}</td>
      <td>{% if r.original_line_no %}行{{ r.original_line_no }}{% else %}-{% endif %}</td>
      <td style="max-width:200px;">{{ r.annotator_content or '-' }}</td>
      <td>
        {% if r.annotator_sentiment %}
          {% if r.annotator_sentiment == '正面' %}<span class="badge badge-success">正面</span>
          {% elif r.annotator_sentiment == '负面' %}<span class="badge badge-danger">负面</span>
          {% else %}<span class="badge badge-warning">中性</span>{% endif %}
        {% else %}-{% endif %}
      </td>
      <td style="max-width:180px;">{{ r.fragment_text or '-' }}</td>
      <td>
        {% if r.model_sentiment %}
          {% if r.model_sentiment == '正面' %}<span class="badge badge-success">正面</span>
          {% elif r.model_sentiment == '负面' %}<span class="badge badge-danger">负面</span>
          {% else %}<span class="badge badge-warning">中性</span>{% endif %}
        {% else %}-{% endif %}
      </td>
      <td>
        {% if r.drift_detected %}<span class="badge badge-danger">⚠️ 是</span>
        {% else %}<span class="badge badge-success">否</span>{% endif %}
      </td>
      <td>{{ r.original_sentiment or '-' }}</td>
      <td><b>
        {% if r.current_sentiment == '正面' %}<span style="color:#67c23a">正面</span>
        {% elif r.current_sentiment == '负面' %}<span style="color:#f56c6c">负面</span>
        {% else %}<span style="color:#e6a23c">中性</span>{% endif %}
      </b></td>
      <td>
        {% set code = r.status %}
        {% set cls = 'badge-primary' %}
        {% if code == 'drift_detected' %}{% set cls = 'badge-danger' %}
        {% elif code == 'adjustment_overridden' %}{% set cls = 'badge-warning' %}
        {% elif code == 'reviewed' %}{% set cls = 'badge-success' %}
        {% elif code == 'manually_adjusted' %}{% set cls = 'badge-info' %}{% endif %}
        <span class="badge {{ cls }}">{{ r.status_label }}</span>
      </td>
      <td style="font-size:12px;color:#909399;">{{ r.updated_at }}</td>
      <td><a class="btn btn-sm btn-primary" href="{{ url_for('record_detail', comment_id=r.comment_id) }}">查看详情</a></td>
    </tr>
    {% endfor %}
  </table>
  {% else %}
  <div class="empty">暂无记录，前往 <a href="{{ url_for('import_page') }}">导入数据</a></div>
  {% endif %}
</div>
{% endblock %}
""", records=records, STATUS_LABEL=STATUS_LABEL)


@app.route("/record/<comment_id>")
def record_detail(comment_id):
    rec = DataAccessor.get_record_by_comment_id(comment_id)
    if not rec:
        abort(404)
    adjustments = DataAccessor.get_manual_adjustments(rec["id"])
    history = DataAccessor.get_status_history(rec["id"])
    origin = DataAccessor.find_original_material(comment_id)
    return render_template_string(BASE_TEMPLATE + """
{% block content %}
<div class="breadcrumb">
  <a href="{{ url_for('index') }}">首页</a><span>/</span>
  <a href="{{ url_for('records_list') }}">明细记录</a><span>/</span>{{ comment_id }}
</div>

<div class="grid grid-2">
  <div class="card">
    <div class="card-title">
      <span>📌 评论基本信息</span>
      <span class="badge badge-info">{{ rec.comment_id }}</span>
    </div>
    <table>
      <tr><td style="width:120px;color:#909399;">门店ID</td><td>{{ rec.store_id or '-' }}</td></tr>
      <tr><td style="color:#909399;">漂移标记</td>
        <td>{% if rec.drift_detected %}<span class="badge badge-danger">⚠️ 检测到漂移</span>{% else %}<span class="badge badge-success">无漂移</span>{% endif %}</td>
      </tr>
      <tr><td style="color:#909399;">当前处理状态</td>
        <td>
          {% set code = rec.status %}
          {% set cls = 'badge-primary' %}
          {% if code == 'drift_detected' %}{% set cls = 'badge-danger' %}
          {% elif code == 'adjustment_overridden' %}{% set cls = 'badge-warning' %}
          {% elif code == 'reviewed' %}{% set cls = 'badge-success' %}
          {% elif code == 'manually_adjusted' %}{% set cls = 'badge-info' %}{% endif %}
          <span class="badge {{ cls }}">{{ rec.status_label }}</span>
        </td>
      </tr>
      <tr><td style="color:#909399;">原始情绪</td><td>{{ rec.original_sentiment or '-' }}</td></tr>
      <tr><td style="color:#909399;">当前情绪</td><td><b>{{ rec.current_sentiment or '-' }}</b></td></tr>
      <tr><td style="color:#909399;">复核人</td><td>{{ rec.reviewed_by or '-' }}</td></tr>
      <tr><td style="color:#909399;">创建时间</td><td>{{ rec.created_at }}</td></tr>
      <tr><td style="color:#909399;">最后更新</td><td>{{ rec.updated_at }}</td></tr>
    </table>
  </div>

  <div class="card">
    <div class="card-title">
      <span>🔧 操作区</span>
      <span class="tag">算法运营 / 安全审核</span>
    </div>

    <div class="section-title">① 人工改判（算法运营）</div>
    <form method="post" action="{{ url_for('api_adjust') }}">
      <input type="hidden" name="record_id" value="{{ rec.id }}">
      <div class="form-group">
        <label>改判为：</label>
        <select name="new_sentiment">
          <option value="正面" {% if rec.current_sentiment == '正面' %}selected{% endif %}>正面</option>
          <option value="中性" {% if rec.current_sentiment == '中性' %}selected{% endif %}>中性</option>
          <option value="负面" {% if rec.current_sentiment == '负面' %}selected{% endif %}>负面</option>
        </select>
      </div>
      <div class="form-group">
        <label>操作人：</label>
        <input type="text" name="adjusted_by" placeholder="如：老唐" value="老唐">
      </div>
      <div class="form-group">
        <label>改判说明（给安全审核留痕）：</label>
        <textarea name="note" rows="2" placeholder="描述改判原因、依据现场说法..."></textarea>
      </div>
      <button class="btn btn-primary" type="submit">确认人工改判</button>
    </form>

    {% if rec.status == 'adjustment_overridden' %}
    <div class="section-title" style="margin-top:24px;">② 安全审核复核（被批跑覆盖记录）</div>
    <div class="alert alert-warning">
      ⚠️ 该记录的人工改判被批跑任务覆盖，需安全审核同事做最终确认后才能流转。
    </div>
    <form method="post" action="{{ url_for('api_review') }}">
      <input type="hidden" name="record_id" value="{{ rec.id }}">
      <div class="form-group">
        <label>最终认定情绪：</label>
        <select name="final_sentiment">
          <option value="正面">正面</option>
          <option value="中性">中性</option>
          <option value="负面" selected>负面</option>
        </select>
      </div>
      <div class="form-group">
        <label>审核人：</label>
        <input type="text" name="reviewed_by" placeholder="安全审核同事姓名" value="安全审核-小王">
      </div>
      <button class="btn btn-success" type="submit">确认复核完成</button>
    </form>
    {% endif %}
  </div>
</div>

<div class="grid grid-2">
  <div class="card">
    <div class="card-title"><span>📝 标注员留言（原始材料）</span>
      <span class="badge badge-info">源文件: {{ rec.annotator_source_file or '-' }}</span>
    </div>
    <table>
      <tr><td style="width:120px;color:#909399;">原始行号</td><td><b>行 {{ rec.original_line_no or '-' }}</b></td></tr>
      <tr><td style="color:#909399;">标注情绪</td><td>
        {% if rec.annotator_sentiment == '正面' %}<span class="badge badge-success">正面</span>
        {% elif rec.annotator_sentiment == '负面' %}<span class="badge badge-danger">负面</span>
        {% elif rec.annotator_sentiment %}<span class="badge badge-warning">中性</span>{% else %}-{% endif %}
      </td></tr>
      <tr><td style="color:#909399;">留言内容</td><td style="line-height:1.8;background:#fafcff;padding:10px;border-radius:4px;">{{ rec.annotator_content or '<i style="color:#909399;">(暂无标注数据)</i>' }}</td></tr>
      <tr><td style="color:#909399;">标注批次</td><td>#{{ rec.annotator_batch_id or '-' }} · {{ rec.annotator_import_time or '-' }}</td></tr>
    </table>
  </div>

  <div class="card">
    <div class="card-title"><span>🤖 模型输出片段（现场说法）</span>
      <span class="badge badge-primary">{{ rec.model_version or '-' }}</span>
    </div>
    <table>
      <tr><td style="width:120px;color:#909399;">模型情绪</td><td>
        {% if rec.model_sentiment == '正面' %}<span class="badge badge-success">正面</span>
        {% elif rec.model_sentiment == '负面' %}<span class="badge badge-danger">负面</span>
        {% elif rec.model_sentiment %}<span class="badge badge-warning">中性</span>{% else %}-{% endif %}
      </td></tr>
      <tr><td style="color:#909399;">置信度</td><td>{{ (rec.confidence * 100)|round(1) if rec.confidence else '-' }}%</td></tr>
      <tr><td style="color:#909399;">片段内容</td><td style="line-height:1.8;background:#f0f9eb;padding:10px;border-radius:4px;">{{ rec.fragment_text or '<i style="color:#909399;">(暂无模型数据)</i>' }}</td></tr>
      <tr><td style="color:#909399;">模型批次</td><td>#{{ rec.model_batch_id or '-' }} · {{ rec.model_import_time or '-' }}</td></tr>
    </table>
  </div>
</div>

<div class="card">
  <div class="card-title"><span>👣 状态流转历史</span><span class="tag">{{ history|length }}条记录</span></div>
  {% if history %}
  <div class="timeline">
    {% for h in history %}
    <div class="timeline-item">
      <div class="time">{{ h.changed_at }} · 操作人：<b>{{ h.changed_by or 'system' }}</b></div>
      <div class="event">状态：{{ h.old_status_label }} → <b>{{ h.new_status_label }}</b></div>
      {% if h.reason %}<div class="who">原因：{{ h.reason }}</div>{% endif %}
    </div>
    {% endfor %}
  </div>
  {% else %}<div class="empty">暂无状态流转</div>{% endif %}
</div>

<div class="card">
  <div class="card-title"><span>✍️ 人工改判历史</span><span class="tag">{{ adjustments|length }}条记录</span></div>
  {% if adjustments %}
  <table>
    <tr><th>时间</th><th>操作人</th><th>改前→改后</th><th>是否被覆盖</th><th>覆盖人</th><th>覆盖时间</th><th>备注</th></tr>
    {% for adj in adjustments %}
    <tr>
      <td>{{ adj.adjusted_at }}</td>
      <td><b>{{ adj.adjusted_by }}</b></td>
      <td>{{ adj.old_sentiment }} → <b style="color:#409eff;">{{ adj.new_sentiment }}</b></td>
      <td>
        {% if adj.overridden %}<span class="badge badge-danger">是</span>{% else %}<span class="badge badge-success">否</span>{% endif %}
      </td>
      <td>{{ adj.overridden_by or '-' }}</td>
      <td>{{ adj.overridden_at or '-' }}</td>
      <td style="max-width:200px;">{{ adj.note or '-' }}</td>
    </tr>
    {% endfor %}
  </table>
  {% else %}<div class="empty">暂无人工改判记录</div>{% endif %}
</div>

<details>
  <summary>🔍 查看原始材料所有版本（用于安全审核追溯）</summary>
  <div style="padding:10px;">
    <div class="section-title">标注员留言版本（{{ origin.annotator_versions|length }}条）</div>
    {% if origin.annotator_versions %}
    <table><tr><th>版本ID</th><th>批次</th><th>行号</th><th>内容</th><th>情绪</th><th>源文件</th><th>导入时间</th></tr>
    {% for v in origin.annotator_versions %}
    <tr><td>#{{ v.id }}</td><td>#{{ v.batch_id }}</td><td>行{{ v.original_line_no }}</td><td>{{ v.content }}</td><td>{{ v.sentiment_label }}</td><td>{{ v.source_file or '-' }}</td><td>{{ v.import_time or v.created_at }}</td></tr>
    {% endfor %}
    </table>
    {% else %}<div class="empty">无</div>{% endif %}

    <div class="section-title">模型输出版本（{{ origin.model_versions|length }}条）</div>
    {% if origin.model_versions %}
    <table><tr><th>版本ID</th><th>批次</th><th>片段</th><th>预测情绪</th><th>模型版本</th><th>源文件</th><th>导入时间</th></tr>
    {% for v in origin.model_versions %}
    <tr><td>#{{ v.id }}</td><td>#{{ v.batch_id }}</td><td style="max-width:200px;">{{ v.fragment_text }}</td><td>{{ v.sentiment_pred }}</td><td>{{ v.model_version or '-' }}</td><td>{{ v.source_file or '-' }}</td><td>{{ v.import_time or v.created_at }}</td></tr>
    {% endfor %}
    </table>
    {% else %}<div class="empty">无</div>{% endif %}
  </div>
</details>
{% endblock %}
""", rec=rec, adjustments=adjustments, history=history, origin=origin, comment_id=comment_id)


@app.route("/import", methods=["GET"])
def import_page():
    sample_dir = BASE_DIR / "sample_data"
    samples = []
    if sample_dir.exists():
        samples = sorted([p.name for p in sample_dir.iterdir()])
    return render_template_string(BASE_TEMPLATE + """
{% block content %}
<div class="breadcrumb">
  <a href="{{ url_for('index') }}">首页</a><span>/</span>数据导入
</div>

<div class="grid grid-2">
  <div class="card">
    <div class="card-title"><span>📥 ① 导入标注员留言（CSV）</span><span class="tag">主流程 - 第一步</span></div>
    <div class="alert alert-info">
      CSV格式：store_id, comment_id, original_line_no, content, sentiment_label<br>
      导入后会自动进入后续步骤（等待模型片段对齐、自动检测漂移）
    </div>
    <form method="post" action="{{ url_for('api_import_annotator') }}" enctype="multipart/form-data">
      <div class="form-group">
        <label>选择CSV文件：</label>
        <input type="file" name="file" accept=".csv" required>
      </div>
      <div class="form-group">
        <label>源文件标识（追溯用，自动取文件名）：</label>
        <input type="text" name="source_file" placeholder="留空则使用上传文件名">
      </div>
      <button class="btn btn-primary" type="submit">开始导入标注员留言</button>
    </form>

    {% if samples %}
    <div class="section-title">或使用工作区样例文件：</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      {% for s in samples %}
        {% if s.endswith('.csv') %}
        <form method="post" action="{{ url_for('api_import_annotator_sample') }}" style="display:inline;">
          <input type="hidden" name="filename" value="{{ s }}">
          <button class="btn btn-sm btn-info">📄 {{ s }}</button>
        </form>
        {% endif %}
      {% endfor %}
    </div>
    {% endif %}
  </div>

  <div class="card">
    <div class="card-title"><span>🤖 ② 导入模型输出片段（JSON）</span><span class="tag">老唐补看 - 第二步</span></div>
    <div class="alert alert-success">
      JSON格式数组，字段：comment_id, fragment_text, sentiment_pred, model_version, confidence<br>
      导入后自动匹配已有标注、自动检测情绪漂移
    </div>
    <form method="post" action="{{ url_for('api_import_model') }}" enctype="multipart/form-data">
      <div class="form-group">
        <label>选择JSON文件：</label>
        <input type="file" name="file" accept=".json" required>
      </div>
      <div class="form-group">
        <label>源文件标识：</label>
        <input type="text" name="source_file" placeholder="留空则使用上传文件名">
      </div>
      <button class="btn btn-success" type="submit">开始导入模型输出</button>
    </form>

    {% if samples %}
    <div class="section-title">或使用工作区样例文件：</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      {% for s in samples %}
        {% if s.endswith('.json') %}
        <form method="post" action="{{ url_for('api_import_model_sample') }}" style="display:inline;">
          <input type="hidden" name="filename" value="{{ s }}">
          <button class="btn btn-sm btn-primary">🤖 {{ s }}</button>
        </form>
        {% endif %}
      {% endfor %}
    </div>
    {% endif %}
  </div>
</div>

<div class="card">
  <div class="card-title"><span>⚡ 模拟批跑任务（用于验证"人工改判被下一次批跑覆盖"场景）</span><span class="tag">演示用</span></div>
  <div class="alert alert-warning">
    模拟算法下一次批跑，会把所有记录用模拟结果重跑一遍。重点：<b>已人工改判的记录会被标记为"adjustment_overridden"，留给安全审核复核，不归为正常。</b>
  </div>
  <form method="post" action="{{ url_for('api_batch_rerun') }}">
    <div class="form-group">
      <label>批跑任务名称：</label>
      <input type="text" name="run_by" placeholder="如：批跑任务_v2.2" value="批跑任务_v2.2">
    </div>
    <button class="btn btn-danger" type="submit" onclick="return confirm('确定模拟批跑？会覆盖已有的人工改判标记！')">执行批跑</button>
  </form>
</div>
{% endblock %}
""", samples=samples)


@app.route("/batches")
def batches_list():
    batches = DataAccessor.list_batches()
    return render_template_string(BASE_TEMPLATE + """
{% block content %}
<div class="breadcrumb">
  <a href="{{ url_for('index') }}">首页</a><span>/</span>导入批次
</div>
<div class="card">
  <div class="card-title"><span>📦 所有导入批次</span><span class="tag">{{ batches|length }}条</span></div>
  <table>
    <tr><th>批次ID</th><th>类型</th><th>源文件</th><th>导入时间</th><th>导入记录数</th><th>重复数</th><th>状态</th><th>Hash</th></tr>
    {% for b in batches %}
    <tr>
      <td><b>#{{ b.id }}</b></td>
      <td>
        {% if b.batch_type == 'annotator' %}<span class="badge badge-info">标注员留言</span>
        {% else %}<span class="badge badge-primary">模型输出</span>{% endif %}
      </td>
      <td>{{ b.source_file or '-' }}</td>
      <td>{{ b.import_time }}</td>
      <td>{{ b.record_count }}</td>
      <td>{{ b.duplicate_count or 0 }}</td>
      <td><span class="badge badge-success">{{ b.status }}</span></td>
      <td style="font-size:11px;color:#909399;max-width:200px;">{{ b.import_hash[:32] }}...</td>
    </tr>
    {% endfor %}
  </table>
</div>
{% endblock %}
""", batches=batches)


@app.route("/self-check")
def self_check_page():
    checks = SelfCheckService.run_all_checks()
    logs = DataAccessor.list_self_check_logs()
    return render_template_string(BASE_TEMPLATE + """
{% block content %}
<div class="breadcrumb">
  <a href="{{ url_for('index') }}">首页</a><span>/</span>自检中心
</div>

<div class="card">
  <div class="card-title">
    <span>🔍 四项核心自检结果</span>
    <span>
      <a class="btn btn-sm btn-primary" href="{{ url_for('self_check_page') }}">🔄 重新运行</a>
    </span>
  </div>
  <table>
    <tr><th>自检项</th><th>状态</th><th>检测内容</th><th>详情</th></tr>
    {% for c in checks %}
    <tr>
      <td><b>{{ c.check_label }}</b><br><span style="font-size:11px;color:#909399;">{{ c.check }}</span></td>
      <td>
        {% if c.status == 'passed' %}<span class="badge badge-success">✅ {{ c.status_label }}</span>
        {% else %}<span class="badge badge-warning">⚠️ {{ c.status_label }}</span>{% endif %}
      </td>
      <td>
        {% if c.check == 'duplicate_import' %}检查同一文件是否被反复导入{% endif %}
        {% if c.check == 'adjustment_overridden' %}检查待安全审核复核的覆盖记录{% endif %}
        {% if c.check == 'recompute_after_supplement' %}检查单边数据未重算（只有标注或只有模型）{% endif %}
        {% if c.check == 'export_consistency' %}检查导出/页面/接口数据一致性、覆盖标记与状态一致性{% endif %}
      </td>
      <td>
        {% if c.check == 'adjustment_overridden' %}
          待复核：<b style="color:#e6a23c;">{{ c.pending_review }}</b> 条
          {% if c.issues %}
            <div style="margin-top:6px;">
            {% for iss in c.issues[:3] %}
              <div style="font-size:12px;color:#f56c6c;">
                <a href="{{ url_for('record_detail', comment_id=iss.comment_id) }}" style="color:#f56c6c;">
                  {{ iss.comment_id }} (门店{{ iss.store_id }}): {{ iss.adjusted_by }}于{{ iss.adjusted_at }}的改判被覆盖
                </a>
              </div>
            {% endfor %}
            {% if c.issues|length > 3 %}<div style="font-size:11px;color:#909399;">... 还有 {{ c.issues|length - 3 }} 条</div>{% endif %}
            </div>
          {% endif %}
        {% elif c.check == 'recompute_after_supplement' %}
          数据不全：<b>{{ c.incomplete }}</b> 条
          {% if c.issues %}
            <div style="margin-top:6px;">
            {% for iss in c.issues[:3] %}
              <div style="font-size:12px;color:#e6a23c;">
                <a href="{{ url_for('record_detail', comment_id=iss.comment_id) }}" style="color:#e6a23c;">
                  {{ iss.comment_id }}: {{ iss.missing_part }}
                </a>
              </div>
            {% endfor %}
            </div>
          {% endif %}
        {% elif c.check == 'export_consistency' %}
          <div style="font-size:12px;">
            <div>漂移记录总数：{{ c.drift_records }}</div>
            <div>标注评论去重：{{ c.annotator_distinct_comments }}</div>
            <div>模型评论去重：{{ c.model_distinct_comments }}</div>
            <div>覆盖状态数：{{ c.overridden_status_count }}</div>
            <div>覆盖标记数：{{ c.overridden_flag_count }}</div>
            {% if c.issues %}
              <div style="color:#f56c6c;margin-top:6px;">
                {% for i in c.issues %}⚠️ {{ i }}<br>{% endfor %}
              </div>
            {% endif %}
          </div>
        {% elif c.check == 'duplicate_import' %}
          {% if c.issues %}
            <div style="font-size:12px;color:#e6a23c;">
              {% for iss in c.issues %}重复批次：{{ iss.batch_ids }} ({{ iss.cnt }}次){% endfor %}
            </div>
          {% else %}<span style="color:#67c23a;">无重复导入</span>{% endif %}
        {% endif %}
      </td>
    </tr>
    {% endfor %}
  </table>
</div>

<div class="card">
  <div class="card-title"><span>📜 自检历史日志</span><span class="tag">最近{{ logs|length }}条</span></div>
  <table>
    <tr><th>时间</th><th>自检项</th><th>结果</th><th>详情</th></tr>
    {% for l in logs %}
    <tr>
      <td>{{ l.checked_at }}</td>
      <td>{{ l.check_type }}</td>
      <td>
        {% if l.status == 'passed' %}<span class="badge badge-success">通过</span>
        {% else %}<span class="badge badge-warning">告警</span>{% endif %}
      </td>
      <td style="font-size:12px;max-width:300px;">{{ l.details[:120] }}{% if l.details|length > 120 %}...{% endif %}</td>
    </tr>
    {% endfor %}
  </table>
</div>
{% endblock %}
""", checks=checks, logs=logs)


@app.route("/export", methods=["GET"])
def export_page():
    exports = sorted(EXPORT_DIR.glob("*.csv"), reverse=True) if EXPORT_DIR.exists() else []
    return render_template_string(BASE_TEMPLATE + """
{% block content %}
<div class="breadcrumb">
  <a href="{{ url_for('index') }}">首页</a><span>/</span>导出中心
</div>

<div class="grid grid-2">
  <div class="card">
    <div class="card-title"><span>📤 ① 导出全部明细（主数据）</span><span class="tag">页面 / 接口 / 导出共用同一份SQL</span></div>
    <div class="alert alert-info">
      包含：溯源字段（源文件、批次号、原始行号）+ 双源证据 + 改判历史 + 覆盖标记 + 状态<br>
      <b>重点：导出明细中单独包含被批跑覆盖的人工改判记录，不会消失。</b>
    </div>
    <form method="post" action="{{ url_for('api_export_details') }}">
      <div class="inline-form">
        <div class="form-group">
          <label>状态筛选：</label>
          <select name="status">
            <option value="">全部状态</option>
            {% for code, label in STATUS_LABEL.items() %}
            <option value="{{ code }}">{{ label }}</option>
            {% endfor %}
          </select>
        </div>
        <div class="form-group">
          <label>门店筛选：</label>
          <input type="text" name="store_id" placeholder="留空=全部">
        </div>
        <button class="btn btn-primary" type="submit">导出CSV</button>
      </div>
    </form>
  </div>

  <div class="card">
    <div class="card-title"><span>🔎 ② 导出「人工改判被批跑覆盖」专项追溯文件</span><span class="tag">安全审核专用</span></div>
    <div class="alert alert-warning">
      专为安全审核同事准备：所有被批跑覆盖过的人工改判记录，含完整溯源链路<br>
      → 原始材料（批次/源文件/行号） → 标注情绪 → 模型情绪 → 人工改判 → 覆盖记录
    </div>
    <form method="post" action="{{ url_for('api_export_overridden') }}">
      <button class="btn btn-warning" type="submit">导出覆盖追溯CSV</button>
    </form>
  </div>
</div>

<div class="card">
  <div class="card-title"><span>📁 已生成的导出文件</span><span class="tag">{{ exports|length }}个</span></div>
  {% if exports %}
  <table>
    <tr><th>文件名</th><th>大小</th><th>生成时间</th><th>操作</th></tr>
    {% for e in exports %}
    <tr>
      <td><code>{{ e.name }}</code></td>
      <td>{{ (e.stat().st_size / 1024)|round(1) }} KB</td>
      <td>{{ datetime.fromtimestamp(e.stat().st_mtime).strftime('%Y-%m-%d %H:%M:%S') }}</td>
      <td>
        <a class="btn btn-sm btn-success" href="{{ url_for('download_export', filename=e.name) }}">⬇️ 下载</a>
        <a class="btn btn-sm btn-info" href="{{ url_for('preview_export', filename=e.name) }}">👁 预览</a>
      </td>
    </tr>
    {% endfor %}
  </table>
  {% else %}
  <div class="empty">暂无导出文件，点击上方按钮生成</div>
  {% endif %}
</div>
{% endblock %}
""", exports=exports, STATUS_LABEL=STATUS_LABEL, datetime=datetime)


@app.route("/api/import/annotator", methods=["POST"])
def api_import_annotator():
    f = request.files.get("file")
    if not f:
        return jsonify({"success": False, "message": "未选择文件"}), 400
    try:
        rows = read_csv_file(f)
    except Exception as e:
        return jsonify({"success": False, "message": f"CSV解析失败: {e}"}), 400
    source_file = request.form.get("source_file") or f.filename
    result = ImportService.import_annotator_comments(rows, source_file=source_file)
    _flash_from_result(result)
    return redirect(url_for("import_page"))


@app.route("/api/import/annotator/sample", methods=["POST"])
def api_import_annotator_sample():
    filename = request.form.get("filename")
    path = BASE_DIR / "sample_data" / filename
    if not path.exists():
        return jsonify({"success": False}), 404
    rows = []
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    result = ImportService.import_annotator_comments(rows, source_file=filename)
    _flash_from_result(result)
    return redirect(url_for("import_page"))


@app.route("/api/import/model", methods=["POST"])
def api_import_model():
    f = request.files.get("file")
    if not f:
        return jsonify({"success": False, "message": "未选择文件"}), 400
    try:
        rows = read_json_file(f)
    except Exception as e:
        return jsonify({"success": False, "message": f"JSON解析失败: {e}"}), 400
    source_file = request.form.get("source_file") or f.filename
    result = ImportService.import_model_outputs(rows, source_file=source_file)
    _flash_from_result(result)
    return redirect(url_for("import_page"))


@app.route("/api/import/model/sample", methods=["POST"])
def api_import_model_sample():
    filename = request.form.get("filename")
    path = BASE_DIR / "sample_data" / filename
    if not path.exists():
        return jsonify({"success": False}), 404
    with open(path, "r", encoding="utf-8") as f:
        rows = json.load(f)
    result = ImportService.import_model_outputs(rows, source_file=filename)
    _flash_from_result(result)
    return redirect(url_for("import_page"))


@app.route("/api/adjust", methods=["POST"])
def api_adjust():
    try:
        record_id = int(request.form["record_id"])
        new_sentiment = request.form["new_sentiment"]
        adjusted_by = request.form["adjusted_by"] or "匿名"
        note = request.form.get("note")
    except (KeyError, ValueError):
        return jsonify({"success": False, "message": "参数错误"}), 400
    result = AdjustmentService.manual_adjust(record_id, new_sentiment, adjusted_by, note)
    rec = DataAccessor.list_records()
    cid = result.get("comment_id") or (rec[0]["comment_id"] if rec else "")
    from flask import flash
    flash(result["message"], "success" if result["success"] else "danger")
    if cid:
        return redirect(url_for("record_detail", comment_id=cid))
    return redirect(url_for("records_list"))


@app.route("/api/review", methods=["POST"])
def api_review():
    try:
        record_id = int(request.form["record_id"])
        final_sentiment = request.form["final_sentiment"]
        reviewed_by = request.form["reviewed_by"] or "匿名"
    except (KeyError, ValueError):
        return jsonify({"success": False, "message": "参数错误"}), 400
    result = AdjustmentService.review_overridden(record_id, reviewed_by, final_sentiment)
    from flask import flash
    flash(result["message"], "success" if result["success"] else "danger")
    cid = result.get("comment_id")
    if cid:
        return redirect(url_for("record_detail", comment_id=cid))
    return redirect(url_for("records_list"))


@app.route("/api/batch-rerun", methods=["POST"])
def api_batch_rerun():
    run_by = request.form.get("run_by") or "批跑任务"
    records = DataAccessor.list_records()
    import random
    random.seed(42)
    options = ["正面", "中性", "负面"]
    new_sentiments = {}
    comment_ids = []
    for r in records:
        comment_ids.append(r["comment_id"])
        if r["status"] == "manually_adjusted":
            new_sentiments[r["comment_id"]] = random.choice(options)
        else:
            new_sentiments[r["comment_id"]] = r["current_sentiment"] or random.choice(options)
    result = AdjustmentService.batch_rerun(comment_ids, new_sentiments, run_by)
    _flash_from_result(result)
    return redirect(url_for("index"))


@app.route("/api/export/details", methods=["POST"])
def api_export_details():
    status = request.form.get("status") or None
    store_id = request.form.get("store_id") or None
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    fname = f"情绪漂移明细_{ts}.csv"
    fpath = EXPORT_DIR / fname
    result = ExportService.export_details(str(fpath), status=status, store_id=store_id)
    from flask import flash
    if result["success"]:
        flash(f"✅ 导出成功：{result['count']}条记录 → <a href='{url_for('preview_export', filename=fname)}' style='color:inherit;text-decoration:underline;'>{fname}</a>", "success")
    else:
        flash("导出失败", "danger")
    return redirect(url_for("export_page"))


@app.route("/api/export/overridden", methods=["POST"])
def api_export_overridden():
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    fname = f"人工改判被覆盖追溯_{ts}.csv"
    fpath = EXPORT_DIR / fname
    result = ExportService.export_overridden_trace(str(fpath))
    from flask import flash
    if result["success"]:
        flash(f"✅ 导出成功：{result['count']}条覆盖记录 → <a href='{url_for('preview_export', filename=fname)}' style='color:inherit;text-decoration:underline;'>{fname}</a>（{result['count']}条）", "success")
    else:
        flash("导出失败", "danger")
    return redirect(url_for("export_page"))


@app.route("/exports/<filename>")
def download_export(filename):
    path = EXPORT_DIR / filename
    if not path.exists():
        abort(404)
    return send_file(str(path), as_attachment=True, download_name=filename)


@app.route("/exports/preview/<filename>")
def preview_export(filename):
    path = EXPORT_DIR / filename
    if not path.exists():
        abort(404)
    with open(path, "r", encoding="utf-8-sig") as f:
        lines = f.readlines()
    header = None
    data_rows = []
    if lines:
        reader = csv.reader(lines)
        rows = list(reader)
        if rows:
            header = rows[0]
            data_rows = rows[1:21]
    return render_template_string(BASE_TEMPLATE + """
{% block content %}
<div class="breadcrumb">
  <a href="{{ url_for('index') }}">首页</a><span>/</span>
  <a href="{{ url_for('export_page') }}">导出中心</a><span>/</span>预览
</div>
<div class="card">
  <div class="card-title">
    <span>👁 预览：{{ filename }}</span>
    <span>
      共 {{ total_lines }} 行 ·
      <a class="btn btn-sm btn-success" href="{{ url_for('download_export', filename=filename) }}">⬇️ 下载完整文件</a>
    </span>
  </div>
  {% if header %}
  <div style="overflow-x:auto;">
  <table>
    <tr>{% for h in header %}<th style="font-size:12px;white-space:nowrap;">{{ h }}</th>{% endfor %}</tr>
    {% for row in data_rows %}
    <tr>
      {% for cell in row %}
      <td style="font-size:12px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="{{ cell }}">{{ cell }}</td>
      {% endfor %}
    </tr>
    {% endfor %}
  </table>
  </div>
  {% if data_rows|length == 20 %}
  <div style="text-align:center;padding:12px;color:#909399;font-size:12px;">↑ 只展示前20行，请下载查看完整文件</div>
  {% endif %}
  {% else %}
  <div class="empty">文件为空</div>
  {% endif %}
</div>
{% endblock %}
""", filename=filename, total_lines=len(lines), header=header, data_rows=data_rows)


@app.route("/api/records")
def api_records():
    status = request.args.get("status")
    store_id = request.args.get("store_id")
    records = DataAccessor.list_records(status=status, store_id=store_id)
    return jsonify({
        "success": True,
        "total": len(records),
        "data": records,
    })


@app.route("/api/record/<comment_id>")
def api_record(comment_id):
    rec = DataAccessor.get_record_by_comment_id(comment_id)
    if not rec:
        return jsonify({"success": False, "message": "not found"}), 404
    return jsonify({"success": True, "data": rec})


@app.route("/api/report")
def api_report():
    batch_id = request.args.get("batch_id", type=int)
    report = ReportService.generate_report(batch_id=batch_id)
    return jsonify({"success": True, "data": report})


@app.route("/api/self-check")
def api_self_check():
    return jsonify({
        "success": True,
        "data": SelfCheckService.run_all_checks(),
    })


def _flash_from_result(result):
    from flask import flash
    msg = result.get("message", "")
    extra = []
    if "new_count" in result:
        extra.append(f"新记录{result['new_count']}条")
    if "history_duplicate_count" in result:
        extra.append(f"历史重复{result['history_duplicate_count']}条")
    if "current_duplicate_count" in result:
        extra.append(f"本批次重复{result['current_duplicate_count']}条")
    if "same_file_duplicate" in result and result["same_file_duplicate"]:
        extra.append("（同文件Hash重复）")
    if "matched_count" in result:
        extra.append(f"匹配{result['matched_count']}条")
    if "unmatched_count" in result:
        extra.append(f"无对应标注{result['unmatched_count']}条")
    if "overridden_count" in result:
        extra.append(f"<b style='color:#e6a23c;'>覆盖人工改判{result['overridden_count']}条（待审核）</b>")
    if extra:
        msg = msg + "，" + "，".join(extra)

    cat = "warning" if (result.get("same_file_duplicate") or result.get("duplicate") or result.get("duplicate_count", 0) > 0) else "success"
    if result.get("overridden_count", 0) > 0:
        cat = "warning"
    flash(msg, cat)


from flask import flash
app.secret_key = "drift-system-secret-key-2026"

if __name__ == "__main__":
    print("🚀 门店评论情绪漂移系统启动中...")
    print("👉 访问地址: http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=False)
