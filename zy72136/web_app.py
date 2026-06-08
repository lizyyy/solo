import os
import json
import pandas as pd
from datetime import datetime
from flask import Flask, render_template_string, request, redirect, url_for, flash, jsonify, send_file
from tour_meal_allowance import TourMealAllowanceChecker, STANDARD_COLUMNS, normalize_column_name

app = Flask(__name__)
app.secret_key = 'tour_meal_allowance_2024'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

checker_instance = None

INDEX_HTML = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>合唱团巡演餐补表</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f5f6fa;color:#333;line-height:1.6}
.container{max-width:1100px;margin:0 auto;padding:20px}
h1{font-size:22px;margin-bottom:6px;color:#1a1a2e}
.subtitle{color:#666;font-size:13px;margin-bottom:20px}
.card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.card h2{font-size:16px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee}
.upload-area{border:2px dashed #c8d6e5;border-radius:8px;padding:30px;text-align:center;cursor:pointer;transition:.2s}
.upload-area:hover{border-color:#5f7cdb;background:#f8f9ff}
.upload-area p{color:#666;margin-top:8px;font-size:13px}
input[type=file]{display:none}
.btn{display:inline-block;padding:8px 20px;border:none;border-radius:6px;font-size:14px;cursor:pointer;transition:.2s;text-decoration:none;color:#fff}
.btn-primary{background:#5f7cdb}.btn-primary:hover{background:#4a66c4}
.btn-success{background:#27ae60}.btn-success:hover{background:#219a52}
.btn-warning{background:#f39c12}.btn-warning:hover{background:#d68910}
.btn-danger{background:#e74c3c}.btn-danger:hover{background:#c0392b}
.btn-secondary{background:#95a5a6}.btn-secondary:hover{background:#7f8c8d}
.btn-sm{padding:4px 12px;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #eee}
th{background:#f8f9ff;font-weight:600;color:#444;position:sticky;top:0}
tr:hover{background:#fafbff}
.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500}
.tag-ok{background:#d5f5e3;color:#1e8449}
.tag-warn{background:#fef9e7;color:#b7950b}
.tag-error{background:#fadbd8;color:#c0392b}
.tag-info{background:#d6eaf8;color:#2874a6}
.stat-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px}
.stat-item{flex:1;min-width:120px;background:#f8f9ff;border-radius:6px;padding:12px;text-align:center}
.stat-item .num{font-size:24px;font-weight:700;color:#5f7cdb}
.stat-item .label{font-size:12px;color:#888;margin-top:2px}
.source-table{font-size:12px}
.source-table td{padding:4px 8px}
.mapping-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.mapping-row label{min-width:140px;font-size:13px;text-align:right;color:#555}
.mapping-row select{flex:1;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:13px}
.nav{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.nav a{padding:6px 16px;border-radius:6px;text-decoration:none;font-size:13px;background:#eee;color:#555;transition:.2s}
.nav a:hover,.nav a.active{background:#5f7cdb;color:#fff}
.suggestion{padding:6px 12px;margin-bottom:6px;border-radius:4px;font-size:13px;background:#f8f9ff;border-left:3px solid #5f7cdb}
.issue-section{margin-bottom:12px}
.issue-section h3{font-size:14px;margin-bottom:6px;color:#555}
.issue-item{padding:4px 0;font-size:13px}
.issue-item span{color:#888;font-size:12px}
.annotate-input{width:100%;padding:4px 8px;border:1px solid #ddd;border-radius:4px;font-size:12px}
.supplement-form{display:flex;gap:4px;align-items:center;font-size:12px}
.supplement-form input{padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px;width:80px}
.supplement-form select{padding:4px 6px;border:1px solid #ddd;border-radius:4px;font-size:12px}
.empty-msg{text-align:center;color:#999;padding:30px;font-size:14px}
</style>
</head>
<body>
<div class="container">
<h1>🎵 合唱团巡演餐补表</h1>
<p class="subtitle">林老师的曲目数据检查与餐补管理工具 &mdash; 支持 Excel/CSV 多源导入</p>

<div class="nav">
<a href="/" class="active">上传导入</a>
<a href="/data">数据总览</a>
<a href="/report">检查报告</a>
<a href="/export">导出清单</a>
</div>

<div class="card">
<h2>上传文件</h2>
<form id="uploadForm" action="/upload" method="post" enctype="multipart/form-data">
<div class="upload-area" onclick="document.getElementById('fileInput').click()">
<p>📁 点击选择 Excel (.xlsx) 或 CSV 文件</p>
<p>支持多文件同时上传，系统自动识别列名并映射</p>
</div>
<input type="file" id="fileInput" name="files" multiple accept=".xlsx,.xls,.csv">
<div id="fileList" style="margin-top:10px;font-size:13px;color:#666"></div>
<button type="submit" class="btn btn-primary" style="margin-top:12px">开始导入</button>
</form>
</div>

{% if sources %}
<div class="card">
<h2>已导入数据源</h2>
<div class="stat-row">
<div class="stat-item"><div class="num">{{ total_rows }}</div><div class="label">总记录数</div></div>
<div class="stat-item"><div class="num">{{ sources|length }}</div><div class="label">数据源</div></div>
</div>
<table class="source-table">
<tr><th>文件名</th><th>类型</th><th>行数</th><th>列映射</th><th>未映射列</th></tr>
{% for s in sources %}
<tr>
<td>{{ s.来源 }}</td>
<td><span class="tag tag-info">{{ s.类型 }}</span></td>
<td>{{ s.原始行数 }}</td>
<td>{{ s.列映射|default('-',true) }}</td>
<td>{{ s.未映射列|default('-',true) }}</td>
</tr>
{% endfor %}
</table>
</div>
{% endif %}

{% with messages = get_flashed_messages() %}
{% if messages %}
<div class="card" style="border-left:3px solid #e74c3c">
{% for msg in messages %}<p style="color:#e74c3c;font-size:13px">{{ msg }}</p>{% endfor %}
</div>
{% endif %}
{% endwith %}
</div>

<script>
document.getElementById('fileInput').addEventListener('change',function(e){
var list=document.getElementById('fileList');
list.innerHTML='';
for(var i=0;i<e.target.files.length;i++){
list.innerHTML+='<div>📎 '+e.target.files[i].name+'</div>';
}
});
</script>
</body>
</html>
"""

DATA_HTML = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>数据总览 - 合唱团巡演餐补表</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f5f6fa;color:#333;line-height:1.6}
.container{max-width:1200px;margin:0 auto;padding:20px}
h1{font-size:22px;margin-bottom:6px;color:#1a1a2e}
.subtitle{color:#666;font-size:13px;margin-bottom:20px}
.card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.card h2{font-size:16px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee}
.btn{display:inline-block;padding:8px 20px;border:none;border-radius:6px;font-size:14px;cursor:pointer;transition:.2s;text-decoration:none;color:#fff}
.btn-primary{background:#5f7cdb}.btn-primary:hover{background:#4a66c4}
.btn-success{background:#27ae60}.btn-success:hover{background:#219a52}
.btn-sm{padding:4px 12px;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #eee}
th{background:#f8f9ff;font-weight:600;color:#444;position:sticky;top:0;z-index:1}
tr:hover{background:#fafbff}
.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500}
.tag-ok{background:#d5f5e3;color:#1e8449}
.tag-warn{background:#fef9e7;color:#b7950b}
.tag-error{background:#fadbd8;color:#c0392b}
.tag-info{background:#d6eaf8;color:#2874a6}
.stat-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px}
.stat-item{flex:1;min-width:100px;background:#f8f9ff;border-radius:6px;padding:10px;text-align:center}
.stat-item .num{font-size:22px;font-weight:700;color:#5f7cdb}
.stat-item .label{font-size:11px;color:#888;margin-top:2px}
.nav{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.nav a{padding:6px 16px;border-radius:6px;text-decoration:none;font-size:13px;background:#eee;color:#555;transition:.2s}
.nav a:hover,.nav a.active{background:#5f7cdb;color:#fff}
.annotate-input{width:100%;padding:3px 6px;border:1px solid #ddd;border-radius:3px;font-size:11px}
.supplement-form{display:flex;gap:4px;align-items:center;font-size:11px;margin-top:2px}
.supplement-form input{padding:3px 5px;border:1px solid #ddd;border-radius:3px;font-size:11px;width:70px}
.supplement-form select{padding:3px 5px;border:1px solid #ddd;border-radius:3px;font-size:11px}
.scroll-table{max-height:500px;overflow:auto;border:1px solid #eee;border-radius:6px}
.empty-msg{text-align:center;color:#999;padding:30px;font-size:14px}
.check-col{color:#27ae60}.cross-col{color:#e74c3c}
</style>
</head>
<body>
<div class="container">
<h1>📋 数据总览</h1>
<p class="subtitle">查看导入数据、标注和补录</p>

<div class="nav">
<a href="/">上传导入</a>
<a href="/data" class="active">数据总览</a>
<a href="/report">检查报告</a>
<a href="/export">导出清单</a>
</div>

{% if records %}
<div class="card">
<h2>数据统计</h2>
<div class="stat-row">
<div class="stat-item"><div class="num">{{ records|length }}</div><div class="label">总记录</div></div>
<div class="stat-item"><div class="num">{{ source_count }}</div><div class="label">数据源</div></div>
<div class="stat-item"><div class="num">{{ annotated_count }}</div><div class="label">已标注</div></div>
</div>
</div>

<div class="card">
<h2>全部记录 <span style="font-size:12px;color:#888">（可点击标注/补录）</span></h2>
<div class="scroll-table">
<table>
<tr>
<th>行号</th><th>曲目编号</th><th>曲目名称</th><th>版本</th><th>时长</th>
<th>授权状态</th><th>授权到期日</th><th>演出地点</th><th>参演人数</th>
<th>餐补标准</th><th>来源</th><th>备注</th><th>标注</th><th>操作</th>
</tr>
{% for r in records %}
<tr>
<td>{{ r._来源行号 }}</td>
<td>{{ r.曲目编号 }}</td>
<td>{{ r.曲目名称 }}</td>
<td>{{ r.版本 }}</td>
<td>{{ r.时长 }}</td>
<td>
{% if r.授权状态=='过期' %}<span class="tag tag-error">{{ r.授权状态 }}</span>
{% elif r.授权状态=='待确认' %}<span class="tag tag-warn">{{ r.授权状态 }}</span>
{% elif r.授权状态=='有效' %}<span class="tag tag-ok">{{ r.授权状态 }}</span>
{% else %}{{ r.授权状态 }}{% endif %}
</td>
<td>{{ r.授权到期日 }}</td>
<td>{{ r.演出地点 }}</td>
<td>{{ r.参演人数 }}</td>
<td>{{ r.餐补标准 }}</td>
<td><span class="tag tag-info">{{ r._来源文件 }}</span></td>
<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="{{ r.备注 }}">{{ r.备注 }}</td>
<td>
<form method="post" action="/annotate" style="display:flex;gap:4px">
<input type="hidden" name="row_idx" value="{{ loop.index0 }}">
<input type="text" name="annotation" value="{{ r._标注 }}" class="annotate-input" style="width:120px" placeholder="标注...">
<button type="submit" class="btn btn-primary btn-sm">保存</button>
</form>
</td>
<td>
<form method="post" action="/supplement" class="supplement-form">
<input type="hidden" name="row_idx" value="{{ loop.index0 }}">
<select name="field">
<option value="参演人数">人数</option>
<option value="餐补标准">餐标</option>
<option value="授权到期日">到期日</option>
<option value="授权状态">授权</option>
</select>
<input type="text" name="value" placeholder="新值">
<button type="submit" class="btn btn-success btn-sm">补录</button>
</form>
</td>
</tr>
{% endfor %}
</table>
</div>
</div>
{% else %}
<div class="card"><div class="empty-msg">暂无数据，请先上传文件</div></div>
{% endif %}
</div>
</body>
</html>
"""

REPORT_HTML = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>检查报告 - 合唱团巡演餐补表</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f5f6fa;color:#333;line-height:1.6}
.container{max-width:1100px;margin:0 auto;padding:20px}
h1{font-size:22px;margin-bottom:6px;color:#1a1a2e}
.subtitle{color:#666;font-size:13px;margin-bottom:20px}
.card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.card h2{font-size:16px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee}
.btn{display:inline-block;padding:8px 20px;border:none;border-radius:6px;font-size:14px;cursor:pointer;transition:.2s;text-decoration:none;color:#fff}
.btn-primary{background:#5f7cdb}.btn-success{background:#27ae60}
.btn-sm{padding:4px 12px;font-size:12px}
.stat-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px}
.stat-item{flex:1;min-width:100px;background:#f8f9ff;border-radius:6px;padding:10px;text-align:center}
.stat-item .num{font-size:24px;font-weight:700}
.stat-item .label{font-size:11px;color:#888;margin-top:2px}
.num-red{color:#e74c3c}.num-green{color:#27ae60}.num-blue{color:#5f7cdb}
.nav{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.nav a{padding:6px 16px;border-radius:6px;text-decoration:none;font-size:13px;background:#eee;color:#555;transition:.2s}
.nav a:hover,.nav a.active{background:#5f7cdb;color:#fff}
.suggestion{padding:8px 14px;margin-bottom:6px;border-radius:4px;font-size:13px;background:#f8f9ff;border-left:3px solid #5f7cdb}
.issue-group{margin-bottom:14px}
.issue-group h3{font-size:14px;margin-bottom:8px;padding:6px 10px;background:#fafbff;border-radius:4px}
.issue-item{padding:6px 10px;margin-bottom:4px;font-size:13px;background:#fff;border:1px solid #f0f0f0;border-radius:4px}
.issue-item .track{font-weight:600;color:#5f7cdb}
.issue-item .detail{color:#888;font-size:12px;margin-top:2px}
.issue-item .suggestion-text{color:#27ae60;font-size:12px;margin-top:2px}
.smooth-item{padding:6px 10px;margin-bottom:4px;font-size:13px;background:#d5f5e3;border-radius:4px}
.empty-msg{text-align:center;color:#999;padding:30px;font-size:14px}
.diff-table{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
.diff-table th,.diff-table td{padding:6px 8px;border:1px solid #eee;text-align:left}
.diff-table th{background:#f8f9ff}
</style>
</head>
<body>
<div class="container">
<h1>📊 检查报告</h1>
<p class="subtitle">生成时间: {{ generated_at }}</p>

<div class="nav">
<a href="/">上传导入</a>
<a href="/data">数据总览</a>
<a href="/report" class="active">检查报告</a>
<a href="/export">导出清单</a>
</div>

{% if summary %}
<div class="card">
<h2>概览统计</h2>
<div class="stat-row">
<div class="stat-item"><div class="num num-blue">{{ summary.总记录数 }}</div><div class="label">总记录数</div></div>
<div class="stat-item"><div class="num num-red">{{ summary.问题总数 }}</div><div class="label">问题点</div></div>
<div class="stat-item"><div class="num num-green">{{ summary.顺利记录数 }}</div><div class="label">顺利记录</div></div>
</div>
</div>

<div class="card">
<h2>处理建议</h2>
{% for s in summary.处理建议 %}
<div class="suggestion">{{ s }}</div>
{% endfor %}
</div>

{% if source_diffs %}
<div class="card">
<h2>来源差异核对</h2>
<table class="diff-table">
<tr><th>来源文件</th><th>类型</th><th>原始行数</th><th>列映射</th><th>未映射列</th></tr>
{% for d in source_diffs %}
<tr>
<td>{{ d.来源 }}</td>
<td>{{ d.类型 }}</td>
<td>{{ d.原始行数 }}</td>
<td>{{ d.列映射 }}</td>
<td>{{ d.未映射列 }}</td>
</tr>
{% endfor %}
</table>
</div>
{% endif %}

{% for key, items in issues.items() %}
{% if items %}
<div class="issue-group">
<h3>{{ issue_names[key] }} ({{ items|length }}条)</h3>
{% for item in items %}
<div class="issue-item">
{% if '涉及曲目' in item %}
<span class="track">{{ item.曲目编号 }} - {{ item.涉及曲目|join(', ') }}</span>
{% else %}
<span class="track">{{ item.曲目编号 }} - {{ item.曲目名称 }}</span>
{% endif %}
<div class="detail">
{% for k, v in item.items() %}
{% if k not in ['曲目编号','曲目名称','涉及曲目','建议'] %}
{{ k }}: {{ v }} &nbsp;
{% endif %}
{% endfor %}
</div>
<div class="suggestion-text">💡 {{ item.建议 }}</div>
</div>
{% endfor %}
</div>
{% endif %}
{% endfor %}

{% if smooth_records %}
<div class="issue-group">
<h3 style="background:#d5f5e3">✅ 顺利通过检查</h3>
{% for r in smooth_records %}
<div class="smooth-item">{{ r.曲目编号 }} - {{ r.曲目名称 }}: {{ r.说明 }}</div>
{% endfor %}
</div>
{% endif %}

{% else %}
<div class="card"><div class="empty-msg">暂无数据，请先上传文件并检查</div></div>
{% endif %}
</div>
</body>
</html>
"""

EXPORT_HTML = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>导出清单 - 合唱团巡演餐补表</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#f5f6fa;color:#333;line-height:1.6}
.container{max-width:1100px;margin:0 auto;padding:20px}
h1{font-size:22px;margin-bottom:6px;color:#1a1a2e}
.subtitle{color:#666;font-size:13px;margin-bottom:20px}
.card{background:#fff;border-radius:8px;padding:20px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,.06)}
.card h2{font-size:16px;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #eee}
.btn{display:inline-block;padding:10px 24px;border:none;border-radius:6px;font-size:14px;cursor:pointer;transition:.2s;text-decoration:none;color:#fff}
.btn-primary{background:#5f7cdb}.btn-success{background:#27ae60}
.nav{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.nav a{padding:6px 16px;border-radius:6px;text-decoration:none;font-size:13px;background:#eee;color:#555;transition:.2s}
.nav a:hover,.nav a.active{background:#5f7cdb;color:#fff}
table{width:100%;border-collapse:collapse;font-size:12px;margin-top:10px}
th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #eee}
th{background:#f8f9ff;font-weight:600}
.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500}
.tag-ok{background:#d5f5e3;color:#1e8449}
.tag-warn{background:#fef9e7;color:#b7950b}
.tag-error{background:#fadbd8;color:#c0392b}
.tag-info{background:#d6eaf8;color:#2874a6}
.scroll-table{max-height:500px;overflow:auto;border:1px solid #eee;border-radius:6px}
.empty-msg{text-align:center;color:#999;padding:30px;font-size:14px}
</style>
</head>
<body>
<div class="container">
<h1>📥 导出清单</h1>
<p class="subtitle">给演出/发行同事看的餐补清单</p>

<div class="nav">
<a href="/">上传导入</a>
<a href="/data">数据总览</a>
<a href="/report">检查报告</a>
<a href="/export" class="active">导出清单</a>
</div>

{% if export_records %}
<div class="card">
<h2>餐补清单预览</h2>
<p style="font-size:13px;color:#666;margin-bottom:10px">
{{ export_records|length }} 条记录，其中 {{ confirmed_count }} 条可直接发放餐补
</p>
<div style="margin-bottom:12px">
<a href="/download/xlsx" class="btn btn-primary">下载 Excel</a>
<a href="/download/csv" class="btn btn-success" style="margin-left:8px">下载 CSV</a>
</div>
<div class="scroll-table">
<table>
<tr>
<th>曲目编号</th><th>曲目名称</th><th>演出地点</th><th>参演人数</th>
<th>餐补标准</th><th>预计总额</th><th>状态</th><th>问题说明</th>
<th>来源</th><th>行号</th><th>标注</th>
</tr>
{% for r in export_records %}
<tr>
<td>{{ r.曲目编号 }}</td>
<td>{{ r.曲目名称 }}</td>
<td>{{ r.演出地点 }}</td>
<td>{{ r.参演人数 }}</td>
<td>{{ r.餐补标准 }}</td>
<td>{{ r.预计餐补总额 }}</td>
<td>
{% if r.状态=='可发放' %}<span class="tag tag-ok">{{ r.状态 }}</span>
{% elif r.状态=='暂停' %}<span class="tag tag-error">{{ r.状态 }}</span>
{% else %}<span class="tag tag-warn">{{ r.状态 }}</span>{% endif %}
</td>
<td>{{ r.问题说明 }}</td>
<td><span class="tag tag-info">{{ r.来源文件 }}</span></td>
<td>{{ r.来源行号 }}</td>
<td>{{ r.标注 }}</td>
</tr>
{% endfor %}
</table>
</div>
</div>
{% else %}
<div class="card"><div class="empty-msg">暂无数据，请先上传文件并运行检查</div></div>
{% endif %}
</div>
</body>
</html>
"""


def get_checker():
    global checker_instance
    if checker_instance is None:
        checker_instance = TourMealAllowanceChecker()
    return checker_instance


@app.route('/')
def index():
    c = get_checker()
    sources = c.get_source_diff()
    total_rows = len(c.df) if c.df is not None else 0
    return render_template_string(INDEX_HTML, sources=sources, total_rows=total_rows)


@app.route('/upload', methods=['POST'])
def upload():
    c = get_checker()
    files = request.files.getlist('files')
    if not files or all(f.filename == '' for f in files):
        flash('请选择至少一个文件')
        return redirect(url_for('index'))

    for f in files:
        if f.filename == '':
            continue
        filename = f.filename
        save_path = os.path.join(UPLOAD_FOLDER, filename)
        f.save(save_path)
        result = c.add_source(save_path)
        if result.get('import_errors'):
            for err in result['import_errors']:
                flash(f'{filename}: {err}')

    c.run_all_checks()
    return redirect(url_for('data_page'))


@app.route('/data')
def data_page():
    c = get_checker()
    if c.df is None or len(c.df) == 0:
        return render_template_string(DATA_HTML, records=None, source_count=0, annotated_count=0)
    records = c.df.to_dict('records')
    source_count = len(c.sources)
    annotated_count = sum(1 for r in records if r.get('_标注', ''))
    return render_template_string(DATA_HTML, records=records, source_count=source_count, annotated_count=annotated_count)


@app.route('/annotate', methods=['POST'])
def annotate():
    c = get_checker()
    row_idx = int(request.form.get('row_idx', -1))
    annotation = request.form.get('annotation', '')
    c.set_annotation(row_idx, annotation)
    return redirect(url_for('data_page'))


@app.route('/supplement', methods=['POST'])
def supplement():
    c = get_checker()
    row_idx = int(request.form.get('row_idx', -1))
    field = request.form.get('field', '')
    value = request.form.get('value', '')
    if field and value:
        c.supplement_field(row_idx, field, value)
        c.run_all_checks()
    return redirect(url_for('data_page'))


@app.route('/report')
def report():
    c = get_checker()
    if c.df is None or len(c.df) == 0:
        return render_template_string(REPORT_HTML, summary=None, issues=None, issue_names=None, smooth_records=None, source_diffs=None, generated_at='')

    summary = c.get_summary()
    issue_names = {
        'duplicate_tracks': '🔁 重复曲目编号',
        'expired_license': '🔴 授权过期/即将到期',
        'missing_license': '🟡 授权待确认',
        'old_master_tapes': '🔵 旧版母带',
        'timecode_mismatch': '⚡ 时码错位',
        'empty_values': '📝 空值缺失',
        'manual_rename': '📋 人工改名记录',
        'old_format': '📚 旧口径数据',
        'need_confirmation': '👀 需要林老师确认'
    }
    source_diffs = c.get_source_diff()
    generated_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    return render_template_string(REPORT_HTML, summary=summary, issues=c.issues, issue_names=issue_names, smooth_records=c.smooth_records, source_diffs=source_diffs, generated_at=generated_at)


@app.route('/export')
def export_page():
    c = get_checker()
    if c.df is None or len(c.df) == 0:
        return render_template_string(EXPORT_HTML, export_records=None, confirmed_count=0)

    c.run_all_checks()
    export_path = os.path.join(UPLOAD_FOLDER, 'meal_allowance_preview.xlsx')
    c.export_meal_allowance_list(export_path)

    export_df = pd.read_excel(export_path, engine='openpyxl')
    export_records = export_df.to_dict('records')
    confirmed_count = sum(1 for r in export_records if r.get('状态') == '可发放')
    return render_template_string(EXPORT_HTML, export_records=export_records, confirmed_count=confirmed_count)


@app.route('/download/xlsx')
def download_xlsx():
    c = get_checker()
    if c.df is None:
        return redirect(url_for('export_page'))
    c.run_all_checks()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'合唱团巡演餐补清单_{timestamp}.xlsx'
    output_path = os.path.join(UPLOAD_FOLDER, filename)
    c.export_meal_allowance_list(output_path)
    return send_file(output_path, as_attachment=True, download_name=filename)


@app.route('/download/csv')
def download_csv():
    c = get_checker()
    if c.df is None:
        return redirect(url_for('export_page'))
    c.run_all_checks()
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'合唱团巡演餐补清单_{timestamp}.csv'
    output_path = os.path.join(UPLOAD_FOLDER, filename)
    c.export_meal_allowance_list(output_path)
    return send_file(output_path, as_attachment=True, download_name=filename)


if __name__ == '__main__':
    app.run(debug=True, port=5000)
