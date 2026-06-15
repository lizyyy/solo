import json
import os
import numpy as np
import dataclasses
from datetime import datetime, date
from typing import Dict, List, Any
from jinja2 import Environment
from .data_models import WorkflowStep, CheckResult, ConflictEvidence


class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        elif isinstance(obj, (datetime, date)):
            return obj.isoformat()
        elif dataclasses.is_dataclass(obj) and not isinstance(obj, type):
            return dataclasses.asdict(obj)
        elif isinstance(obj, set):
            return list(obj)
        return super().default(obj)


def _to_json_pretty(x):
    return json.dumps(x, ensure_ascii=False, indent=2, cls=NumpyEncoder)


def _severity_badge(s):
    return {
        'info': ('badge passed', '通过'),
        'warning': ('badge warning', '警告'),
        'error': ('badge error', '失败'),
    }.get(s, ('badge pending', s))


def _status_badge(s):
    m = {
        'pending': ('badge pending', '待执行'),
        'running': ('badge pending', '执行中'),
        'completed': ('badge passed', '已完成'),
        'completed_with_warnings': ('badge warning', '完成(有警告)'),
        'failed': ('badge error', '失败'),
    }
    return m.get(s, ('badge pending', s))


def _resolution_badge(r):
    return {
        'pending': ('badge pending', '待处理'),
        'confirmed': ('badge passed', '林姐已确认'),
        'rejected': ('badge error', '林姐已驳回'),
    }.get(r, ('badge pending', r))


HTML_TEMPLATE = r"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>{{ project_name }} - 检查报告</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:20px;background:#f5f5f5;color:#333}
.container{max-width:1280px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.08)}
h1{color:#1f2937;border-bottom:3px solid #2563eb;padding-bottom:10px}
h2{color:#1d4ed8;margin-top:30px;border-left:4px solid #2563eb;padding-left:10px}
h3{color:#374151;margin-top:20px}
.meta-info{color:#6b7280;font-size:.9em;margin-bottom:20px;line-height:1.7}
.summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:20px 0}
.summary-card{background:#f8fafc;padding:15px;border-radius:6px;border-left:4px solid #2563eb}
.summary-card.warning{border-left-color:#d97706;background:#fffbeb}
.summary-card.error{border-left-color:#dc2626;background:#fef2f2}
.summary-card.success{border-left-color:#059669;background:#f0fdf4}
.card-title{font-size:.85em;color:#6b7280;margin-bottom:6px}
.card-value{font-size:1.6em;font-weight:700;color:#1f2937}
.card-sub{font-size:.75em;color:#9ca3af;margin-top:4px}
.step-section{margin:20px 0;padding:20px;background:#fafafa;border-radius:6px;border:1px solid #e5e7eb}
.check-item{margin:14px 0;padding:14px;background:#fff;border-radius:4px;border:1px solid #e5e7eb}
.check-item.passed{border-left:4px solid #059669}
.check-item.warning{border-left:4px solid #d97706}
.check-item.error{border-left:4px solid #dc2626}
.check-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px;flex-wrap:wrap}
.check-name{font-weight:600;font-size:1.05em}
.check-meta{font-size:.75em;color:#9ca3af}
.badge{padding:4px 10px;border-radius:12px;font-size:.8em;font-weight:600;white-space:nowrap;display:inline-block}
.badge.passed{background:#d1fae5;color:#065f46}
.badge.warning{background:#fef3c7;color:#92400e}
.badge.error{background:#fee2e2;color:#991b1b}
.badge.pending{background:#e5e7eb;color:#374151}
.suggestion{margin-top:10px;padding:10px 12px;background:#fef3c7;border-radius:4px;color:#92400e;font-size:.92em;line-height:1.5}
.guide{margin-top:8px;padding:8px 10px;background:#eff6ff;border-radius:4px;color:#1e40af;font-size:.85em}
.details-box{margin-top:10px;padding:10px;background:#f8fafc;border-radius:4px;font-family:Menlo,Consolas,monospace;font-size:.82em;overflow-x:auto;max-height:360px;overflow-y:auto}
.details-box summary{cursor:pointer;color:#2563eb}
.conflict-item{margin:12px 0;padding:14px;background:#fff7ed;border-radius:4px;border:1px solid #fed7aa}
.conflict-header{font-weight:600;color:#9a3412;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.conflict-meta{font-size:.75em;color:#9a3412}
.conflict-data{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px}
.conflict-side{padding:10px;background:#fff;border-radius:4px;border:1px solid #fed7aa;word-break:break-all}
.conflict-side h5{margin:0 0 6px 0;font-size:.9em;color:#374151}
.resolution-block{margin-top:10px;padding:10px;background:#ecfdf5;border-radius:4px;border:1px solid #a7f3d0}
.resolution-block.rejected{background:#fef2f2;border-color:#fecaca}
.resolution-block.pending{background:#fffbeb;border-color:#fde68a}
.resolution-meta{font-size:.8em;color:#6b7280;margin-top:4px}
.reason-box{margin-top:6px;padding:6px 8px;background:#fff;border:1px dashed #d1d5db;border-radius:4px;font-size:.85em;font-style:italic}
.batch-section{margin-top:30px}
table{width:100%;border-collapse:collapse;margin:10px 0;background:#fff}
th,td{padding:9px 10px;text-align:left;border-bottom:1px solid #e5e7eb;font-size:.9em;vertical-align:top}
th{background:#f1f5f9;font-weight:600;color:#374151;white-space:nowrap}
tr:hover td{background:#f8fafc}
.trace-id{font-family:Menlo,Consolas,monospace;font-size:.82em;background:#eef2ff;color:#3730a3;padding:1px 4px;border-radius:3px;cursor:pointer}
.batch-id{font-family:Menlo,Consolas,monospace;font-size:.82em;background:#ecfeff;color:#0e7490;padding:1px 4px;border-radius:3px}
.mini-note{font-size:.75em;color:#6b7280;margin-top:4px}
.history-diff{color:#dc2626;font-weight:600}
.history-match{color:#059669;font-weight:600}
.trace-lookup{margin-top:20px;padding:16px;background:#f1f5f9;border-radius:6px}
.trace-lookup input{padding:8px 12px;border:1px solid #cbd5e1;border-radius:4px;font-family:Menlo,Consolas,monospace;margin-right:8px;width:360px;max-width:100%}
.trace-lookup button{padding:8px 16px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer}
.trace-lookup-result{margin-top:10px;padding:12px;background:#fff;border-radius:4px;display:none}
.warning-note{background:#fef3c7;border:1px solid #fde68a;padding:15px;border-radius:4px;margin:20px 0}
.warning-note h4{color:#92400e;margin-top:0;margin-bottom:8px}
.warning-note ul{margin:8px 0;padding-left:22px;line-height:1.7}
.ops-nav{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}
.ops-nav button{padding:8px 14px;background:#1d4ed8;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:.9em}
.ops-nav button.alt{background:#6b7280}
.ops-nav button.warn{background:#b45309}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
@media(max-width:768px){.conflict-data,.grid-2{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="container">
<h1>{{ project_name }} <span style="font-size:.5em;color:#6b7280">v{{ version }}</span></h1>
<div class="meta-info">
  <p><strong>报告生成时间：</strong>{{ generated_at }} ｜
     <strong>当前阈值：</strong>{{ current_threshold }} ｜
     <strong>导出目录：</strong><code>{{ export_dir }}</code></p>
  <p><strong>批次总数：</strong>{{ batches | length }} ｜
     <strong>历史记录：</strong>{{ history_count }} 条 ｜
     <strong>导出记录：</strong>{{ export_history | length }} 次</p>
</div>

{% if pending_conflicts > 0 or total_warnings > 0 or total_errors > 0 %}
<div class="warning-note">
  <h4>⚠️ 必须人工复核的事项</h4>
  <ul>
    {% if total_warnings > 0 %}
    <li>少数类样本被总指标盖住：<strong>请勿直接归为正常</strong>，请点击 trace_id 反查样例，转发给算法工程师复核并留下理由</li>
    {% endif %}
    {% if pending_conflicts > 0 %}
    <li>负样本列表与召回候选表有 <strong>{{ pending_conflicts }} 条标签冲突待处理</strong>：请数据科学家林姐逐条确认或驳回，并填写确认/驳回理由。<strong>不要替业务同事自动拍板</strong></li>
    {% endif %}
    {% if total_errors > 0 %}
    <li>存在 <strong>{{ total_errors }} 项错误</strong>：请优先修复后再使用导出文件</li>
    {% endif %}
  </ul>
</div>
{% endif %}

<h2>概览</h2>
<div class="summary-grid">
  <div class="summary-card success"><div class="card-title">步骤总数</div><div class="card-value">{{ total_steps }}</div><div class="card-sub">完成 {{ completed_steps }} 个</div></div>
  <div class="summary-card success"><div class="card-title">通过检查项</div><div class="card-value">{{ total_passed }}</div><div class="card-sub">共 {{ total_checks }} 项检查</div></div>
  <div class="summary-card warning"><div class="card-title">警告数</div><div class="card-value">{{ total_warnings }}</div><div class="card-sub">需人工复核</div></div>
  <div class="summary-card error"><div class="card-title">错误数</div><div class="card-value">{{ total_errors }}</div><div class="card-sub">阻塞导出</div></div>
  <div class="summary-card warning"><div class="card-title">待处理冲突</div><div class="card-value">{{ pending_conflicts }}</div><div class="card-sub">已确认 {{ confirmed_conflicts }} / 驳回 {{ rejected_conflicts }}</div></div>
  <div class="summary-card success"><div class="card-title">导出一致</div><div class="card-value">{{ export_consistent_icon }}</div><div class="card-sub">{{ export_consistent_text }}</div></div>
</div>

<div class="ops-nav">
  <button onclick="document.getElementById('history-section').scrollIntoView({behavior:'smooth'})">📜 历史记录</button>
  <button onclick="document.getElementById('batch-section').scrollIntoView({behavior:'smooth'})">📦 批次管理</button>
  <button onclick="document.getElementById('export-section').scrollIntoView({behavior:'smooth'})">📤 导出与一致性</button>
  <button class="alt" onclick="document.getElementById('trace-section').scrollIntoView({behavior:'smooth'})">🔍 Trace反查</button>
  <button class="warn" onclick="document.getElementById('conflicts-all').scrollIntoView({behavior:'smooth'})">⚔️ 冲突证据</button>
</div>

<div class="trace-lookup" id="trace-section">
  <h3 style="margin-top:0">🔍 通过 trace_id 反查同一条样例</h3>
  <p class="mini-note">同一记录的 <span class="trace-id">trace_id</span> 在列表、详情、历史、导出CSV中完全一致，可交叉验证。</p>
  <input id="trace-input" placeholder="粘贴 trace_id，例如 rec_0123456789abcdef"/>
  <button onclick="findTrace()">反查</button>
  <div id="trace-result" class="trace-lookup-result"></div>
</div>

{% for step_id, step in steps.items() %}
<div class="step-section" id="step-{{ loop.index }}">
  <h2>步骤{{ loop.index }}：{{ step.step_name }}
    <span class="{{ step_badges[step_id][0] }}">{{ step_badges[step_id][1] }}</span>
  </h2>
  <p class="mini-note">
    {% if step.batch_id %}批次：<span class="batch-id">{{ step.batch_id }}</span>　{% endif %}
    数据版本：{{ step.data_version or 'N/A' }}
    {% if step.export_path %}　导出文件：<code>{{ step.export_path }}</code>{% endif %}
  </p>

  {% if step.checks %}
  <h3>检查结果（{{ step.checks | length }} 项）</h3>
  {% for check in step.checks %}
  <div class="check-item {{ check.severity }}">
    <div class="check-header">
      <div>
        <span class="check-name">{{ check.name }}</span>
        <span class="check-meta">｜check_id: {{ check.check_id }}</span>
        {% if check.batch_id %}<span class="check-meta">｜<span class="batch-id">{{ check.batch_id }}</span></span>{% endif %}
      </div>
      <span class="{{ check_badges[loop.index0][0] }}">{{ check_badges[loop.index0][1] }}</span>
    </div>
    {% if check.suggestion %}
    <div class="suggestion">💡 {{ check.suggestion }}</div>
    {% endif %}
    {% if check.details and ('trace_guide' in check.details or 'resolution_guide' in check.details or 'reverse_lookup_guide' in check.details or 'next_export_will_compare' in check.details or 'decision_guide' in check.details) %}
    <div class="guide">
      {% if check.details.get('trace_guide') %}🔗 {{ check.details.trace_guide }}{% endif %}
      {% if check.details.get('resolution_guide') %}📝 {{ check.details.resolution_guide }}{% endif %}
      {% if check.details.get('reverse_lookup_guide') %}🔍 {{ check.details.reverse_lookup_guide }}{% endif %}
      {% if check.details.get('next_export_will_compare') %}🛡️ {{ check.details.next_export_will_compare }}{% endif %}
      {% if check.details.get('decision_guide') %}⚖️ {{ check.details.decision_guide }}{% endif %}
    </div>
    {% endif %}
    <details class="details-box">
      <summary>查看 JSON 详情</summary>
      <pre>{{ check_details_json[loop.index0] }}</pre>
    </details>
  </div>
  {% endfor %}
  {% else %}
  <p style="color:#9ca3af">暂无检查结果</p>
  {% endif %}

  {% if step.conflicts %}
  <h3 id="conflicts-all">冲突证据（{{ step.conflicts | length }} 条）</h3>
  {% for c in step.conflicts %}
  <div class="conflict-item" id="cf-{{ c.conflict_id }}">
    <div class="conflict-header">
      <div>
        {{ c.description }}
        {% if c.record_trace_id %}<span class="trace-id" title="点击复制反查" onclick="copyText('{{ c.record_trace_id }}')">🆔 {{ c.record_trace_id }}</span>{% endif %}
      </div>
      <div>
        <span class="{{ resolution_badges[loop.index0][0] }}">{{ resolution_badges[loop.index0][1] }}</span>
        <span class="conflict-meta">　#{{ c.conflict_id }}</span>
      </div>
    </div>
    <div class="conflict-data">
      <div class="conflict-side">
        <h5>📋 负样本列表 <small style="font-weight:normal;color:#6b7280">（林姐翻的那张表）</small></h5>
        <pre>{{ c_neg_json[loop.index0] }}</pre>
      </div>
      <div class="conflict-side">
        <h5>🎯 召回候选表</h5>
        <pre>{{ c_recall_json[loop.index0] }}</pre>
      </div>
    </div>
    <div class="resolution-block {{ c.resolution }}">
      {% if c.resolution == 'pending' %}
      <strong>⏳ 待处理：</strong>请数据科学家林姐确认或驳回，不要自动拍板
      <div class="reason-box">提示：确认/驳回时请务必填写理由，例如「按口径v2.3，user=1001在该时段确实未曝光，因此负样本正确，驳回召回候选表的标签」</div>
      {% elif c.resolution == 'confirmed' %}
      <strong>✅ 已确认：</strong>负样本列表标签正确，由 {{ c.resolved_by or '林姐' }} 确认
      <div class="resolution-meta">处理时间：{{ c.resolved_at or '' }}</div>
      {% if c.resolution_reason %}<div class="reason-box">📝 理由：{{ c.resolution_reason }}</div>{% endif %}
      {% elif c.resolution == 'rejected' %}
      <strong>❌ 已驳回：</strong>负样本列表标签错误，由 {{ c.resolved_by or '林姐' }} 驳回
      <div class="resolution-meta">处理时间：{{ c.resolved_at or '' }}</div>
      {% if c.resolution_reason %}<div class="reason-box">📝 理由：{{ c.resolution_reason }}</div>{% endif %}
      {% endif %}
    </div>
  </div>
  {% endfor %}
  {% endif %}
</div>
{% endfor %}

<h2 class="batch-section" id="export-section">📤 导出与一致性核验</h2>
{% if steps.get('step4_export') and steps.get('step4_export').results %}
{% for er in steps.get('step4_export').results %}
<div class="check-item {{ er.severity }}">
  <div class="check-header">
    <span class="check-name">{{ er.check_name }}</span>
    <span class="{{ _sb(er) }}">{{ _sbt(er) }}</span>
  </div>
  {% if er.suggestion %}<div class="suggestion">💡 {{ er.suggestion }}</div>{% endif %}
  <details class="details-box"><summary>详情</summary><pre>{{ er | to_dict | jpp }}</pre></details>
</div>
{% endfor %}
{% else %}
<p style="color:#9ca3af">尚未执行导出步骤。在批量模式下会自动导出；交互模式下在步骤3后按提示选择导出。</p>
{% endif %}

<h3>导出历史</h3>
{% if export_history %}
<table>
  <thead><tr><th>export_id</th><th>时间</th><th>文件</th><th>条数</th><th>批次来源</th><th>校验和</th><th>导出者</th></tr></thead>
  <tbody>
  {% for e in export_history %}
  <tr>
    <td class="batch-id">{{ e.export_id }}</td>
    <td>{{ e.export_time }}</td>
    <td><code>{{ e.export_path }}</code></td>
    <td>{{ e.record_count }}</td>
    <td>{% for b in e.source_batch_ids %}<span class="batch-id">{{ b }}</span><br/>{% endfor %}</td>
    <td style="font-family:Menlo,monospace;font-size:.8em">{{ e.checksum }}</td>
    <td>{{ e.exported_by }}</td>
  </tr>
  {% endfor %}
  </tbody>
</table>
<p class="mini-note">💡 每一次导出都生成独立校验和，可用于对比复跑前后是否一致。导出CSV中 <code>_trace_id</code> 与报告中 100% 对应，反查同一条样例。</p>
{% else %}
<p class="mini-note">暂无导出记录</p>
{% endif %}

<h2 class="batch-section" id="batch-section">📦 批次管理（区分本次导入 vs 历史批次）</h2>
{% if batches %}
<table>
  <thead><tr><th>batch_id</th><th>类型</th><th>来源</th><th>创建时间</th><th>记录范围</th><th>条数</th><th>父批次</th><th>备注</th></tr></thead>
  <tbody>
  {% for b in batches %}
  <tr {% if loop.last %}style="background:#eff6ff"{% endif %}>
    <td class="batch-id">{{ b.batch_id }}</td>
    <td>{% if b.batch_type=='initial_import' %}首次导入{% elif b.batch_type=='supplement' %}<span style="color:#b45309">补录</span>{% else %}{{ b.batch_type }}{% endif %}</td>
    <td><code>{{ b.source_path }}</code></td>
    <td>{{ b.created_at }}</td>
    <td>{{ b.record_start_idx }} — {{ b.record_end_idx }}</td>
    <td>{{ b.record_count }}</td>
    <td>{{ b.parent_batch_id or '-' }}</td>
    <td>{{ b.note or '-' }}</td>
  </tr>
  {% endfor %}
  </tbody>
</table>
<p class="mini-note">💡 高亮行 = 最近一次批次。重复导入是在所有历史批次（蓝底行 + 白底行）联合范围内检查，而非只看本批次。</p>
{% else %}
<p class="mini-note">暂无批次</p>
{% endif %}

<h2 id="history-section">📜 阈值回放与历史记录（可反查同一条样例）</h2>
{% if history %}
<table>
  <thead>
    <tr><th>run_id</th><th>时间</th><th>数据源 / 事件</th><th>阈值</th><th>Precision</th><th>Recall</th><th>条数</th><th>批次</th><th>少数类样例trace_id</th><th>备注</th></tr>
  </thead>
  <tbody>
  {% for h in history %}
  <tr>
    <td class="batch-id">{{ h.run_id }}</td>
    <td>{{ h.timestamp }}</td>
    <td><code>{{ h.data_source }}</code></td>
    <td>{{ h.threshold }}</td>
    <td>{{ h.precision }}</td>
    <td>{{ h.recall }}</td>
    <td>{{ h.row_count }}</td>
    <td style="font-family:Menlo,monospace;font-size:.78em;line-height:1.4">
      {% for b in h.batch_ids %}{{ b }}<br/>{% endfor %}
    </td>
    <td style="font-family:Menlo,monospace;font-size:.78em;line-height:1.4;max-width:200px">
      {% if h.minority_sample_ids %}
        {% for tid in h.minority_sample_ids %}
          <span class="trace-id" onclick="copyText('{{ tid }}')" title="点击复制">{{ tid }}</span><br/>
        {% endfor %}
      {% else %}-{% endif %}
    </td>
    <td>{{ h.note or '-' }}</td>
  </tr>
  {% endfor %}
  </tbody>
</table>
<p class="mini-note">
💡 历史中的阈值、precision、recall 可与当前步骤3结果对比，如果不同会在步骤3中高亮提示。<br/>
💡 少数类样例 trace_id 与报告正文、导出文件完全一致，点击即可复制反查。
</p>
{% else %}
<p class="mini-note">暂无历史记录</p>
{% endif %}

<h2 id="all-minority">🪤 少数类样本清单（被总指标盖住的样例）</h2>
{% if minority_trace_list %}
<table>
  <thead><tr><th>#</th><th>trace_id</th><th>批次</th><th>user</th><th>item</th><th>label</th><th>click_rate</th><th>conversion_rate</th><th>score</th></tr></thead>
  <tbody>
  {% for m in minority_trace_list %}
  <tr>
    <td>{{ loop.index }}</td>
    <td class="trace-id" onclick="copyText('{{ m.trace_id }}')">{{ m.trace_id }}</td>
    <td class="batch-id">{{ m.batch_id }}</td>
    <td>{{ m.user_id }}</td><td>{{ m.item_id }}</td>
    <td style="color:#b45309;font-weight:600">{{ m.label }}</td>
    <td>{{ m.click_rate }}</td><td>{{ m.conversion_rate }}</td><td>{{ m.score or '-' }}</td>
  </tr>
  {% endfor %}
  </tbody>
</table>
<p class="mini-note">⚠️ 这些就是林姐翻负样本列表时「被总指标盖住」的少数类。<strong>不要直接归为正常</strong>，发给算法工程师复核。点击 trace_id 复制，去顶部「反查」里看完整字段。</p>
{% else %}
<p class="mini-note">未检测到少数类，或少数类与总指标差异在正常范围内。</p>
{% endif %}

<div class="meta-info" style="margin-top:40px;border-top:1px solid #e5e7eb;padding-top:15px">
  <p>📄 本报告由工具自动生成。建议配合 <code>main.py --mode interactive</code> 使用，走完 导入→对比→阈值→保存→导出 全流程。</p>
</div>
</div>

<script>
window._allRecords = {{ all_trace_records | safe }};
function copyText(t){const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}catch(e){}document.body.removeChild(ta);showToast('已复制: '+t);}
function showToast(msg){const t=document.createElement('div');t.style.cssText='position:fixed;top:20px;right:20px;background:#1f2937;color:#fff;padding:10px 18px;border-radius:6px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,.3);font-size:.9em';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),1800);}
function findTrace(){const input=document.getElementById('trace-input').value.trim();const result=document.getElementById('trace-result');if(!input){alert('请输入 trace_id');return;}const rec=window._allRecords[input];if(!rec){result.style.display='block';result.innerHTML='<p style="color:#dc2626">❌ 未找到该 trace_id，请注意：只包含本次运行内存中的负样本记录；导出CSV中的 trace_id 则可脱离程序离线保留。</p>';return;}result.style.display='block';result.innerHTML='<p><strong>✅ 找到记录</strong> <span class="trace-id">'+input+'</span></p><div class="grid-2"><div class="conflict-side"><h5>记录字段</h5><pre>'+JSON.stringify(rec.record,null,2)+'</pre></div><div class="conflict-side"><h5>批次信息</h5><pre>'+JSON.stringify(rec.batch_info||{'none':true},null,2)+'</pre><p class="mini-note">行号: '+rec.row_idx+' | 所属批次: <span class="batch-id">'+rec.batch_id+'</span></p></div></div>';}
</script>
</body>
</html>
"""


class Reporter:
    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_report(self, engine, report_name: str = None) -> Dict[str, str]:
        report_name = report_name or f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        summary = engine.get_summary()
        steps_raw = engine.steps

        steps_flat = {}
        all_checks = []
        all_conflicts = []
        for sid, s in steps_raw.items():
            checks = []
            for r in s.results:
                rd = {
                    'check_id': r.check_id, 'name': r.check_name,
                    'passed': r.passed, 'severity': r.severity,
                    'suggestion': r.suggestion, 'batch_id': r.batch_id,
                    '_raw': r
                }
                try:
                    rd['details'] = self._to_serializable(r.details)
                except Exception:
                    rd['details'] = {}
                checks.append(rd)
                all_checks.append(r)
            conflicts = []
            for c in s.conflicts:
                cd = {
                    'conflict_id': c.conflict_id,
                    'description': c.description,
                    'neg_sample_data': self._to_serializable(c.neg_sample_data),
                    'recall_candidate_data': self._to_serializable(c.recall_candidate_data),
                    'field': c.field,
                    'record_trace_id': c.record_trace_id,
                    'resolution': c.resolution,
                    'resolved_by': c.resolved_by,
                    'resolved_at': c.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if c.resolved_at else '',
                    'resolution_reason': c.resolution_reason,
                }
                conflicts.append(cd)
                all_conflicts.append(cd)
            steps_flat[sid] = {
                'step_id': sid,
                'step_name': s.step_name,
                'status': s.status,
                'batch_id': s.batch_id,
                'data_version': s.data_version,
                'export_path': s.export_path,
                'checks': checks,
                'conflicts': conflicts,
            }

        step_badges = {sid: _status_badge(s['status']) for sid, s in steps_flat.items()}
        check_badges = [_severity_badge(c['severity']) if c['severity'] != 'info' else _severity_badge('info')
                        for s in steps_flat.values() for c in s['checks']]
        resolution_badges = [_resolution_badge(c['resolution'])
                           for s in steps_flat.values() for c in s['conflicts']]

        c_neg_json = [_to_json_pretty(c['neg_sample_data'])
                      for s in steps_flat.values() for c in s['conflicts']]
        c_recall_json = [_to_json_pretty(c['recall_candidate_data'])
                         for s in steps_flat.values() for c in s['conflicts']]

        check_details_json = []
        for s in steps_flat.values():
            for c in s['checks']:
                check_details_json.append(_to_json_pretty(c['details']))

        total_checks = len(all_checks)
        total_passed = sum(1 for c in all_checks if c.passed)
        total_warnings = sum(1 for c in all_checks if c.severity == 'warning')
        total_errors = sum(1 for c in all_checks if c.severity == 'error')
        pending_conflicts = sum(1 for c in all_conflicts if c['resolution'] == 'pending')
        confirmed_conflicts = sum(1 for c in all_conflicts if c['resolution'] == 'confirmed')
        rejected_conflicts = sum(1 for c in all_conflicts if c['resolution'] == 'rejected')
        completed_steps = sum(1 for s in steps_flat.values()
                              if s['status'] in ('completed', 'completed_with_warnings'))

        export_consistent = True
        export_result = None
        if 'step4_export' in steps_flat:
            for c in steps_flat['step4_export']['checks']:
                if c['name'] == '导出一致性检查':
                    export_result = c
                    export_consistent = c['passed']
                    break
        export_consistent_icon = '✅' if (export_result and export_consistent) else ('⚠️' if export_result else '—')
        export_consistent_text = '一致' if (export_result and export_consistent) else (
            '不一致，请修复' if export_result else '尚未执行')

        minority_trace_list = []
        if engine.neg_dataset and not engine.neg_dataset.df.empty:
            ms = engine.neg_dataset.get_minority_samples()
            if not ms.empty:
                for _, row in ms.iterrows():
                    rd = row.to_dict()
                    minority_trace_list.append({
                        'trace_id': rd.get('_trace_id', ''),
                        'batch_id': rd.get('_batch_id', ''),
                        'user_id': rd.get('user_id'),
                        'item_id': rd.get('item_id'),
                        'label': rd.get('label'),
                        'click_rate': rd.get('click_rate'),
                        'conversion_rate': rd.get('conversion_rate'),
                        'score': rd.get('score'),
                    })

        all_trace_records = {}
        if engine.neg_dataset and not engine.neg_dataset.df.empty:
            for _, row in engine.neg_dataset.df.iterrows():
                rd = row.to_dict()
                tid = rd.get('_trace_id', '')
                if not tid:
                    continue
                bid = rd.get('_batch_id', '')
                binfo = None
                for b in engine.neg_dataset.batches:
                    if b.batch_id == bid:
                        binfo = {
                            'batch_id': b.batch_id, 'batch_type': b.batch_type,
                            'created_at': b.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                            'source_path': b.source_path, 'note': b.note,
                        }
                        break
                all_trace_records[tid] = {
                    'record': {k: v for k, v in rd.items() if not k.startswith('_')},
                    'trace_id': tid, 'batch_id': bid, 'batch_info': binfo,
                    'row_idx': rd.get('_row_idx', -1),
                }

        history_flat = engine.get_run_history_table()
        batches_flat = engine.get_all_batches()
        export_history = engine.get_export_history()

        report_data = {
            'project_name': summary['project'],
            'version': summary['version'],
            'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'current_threshold': summary['current_threshold'],
            'export_dir': summary.get('export_dir', ''),
            'total_steps': len(steps_flat),
            'completed_steps': completed_steps,
            'total_checks': total_checks,
            'total_passed': total_passed,
            'total_warnings': total_warnings,
            'total_errors': total_errors,
            'pending_conflicts': pending_conflicts,
            'confirmed_conflicts': confirmed_conflicts,
            'rejected_conflicts': rejected_conflicts,
            'steps': steps_flat,
            'step_badges': step_badges,
            'check_badges': check_badges,
            'resolution_badges': resolution_badges,
            'check_details_json': check_details_json,
            'c_neg_json': c_neg_json,
            'c_recall_json': c_recall_json,
            'export_consistent_icon': export_consistent_icon,
            'export_consistent_text': export_consistent_text,
            'batches': batches_flat,
            'export_history': export_history,
            'history': history_flat,
            'history_count': len(history_flat),
            'minority_trace_list': minority_trace_list,
            'all_trace_records': json.dumps(all_trace_records, ensure_ascii=False, cls=NumpyEncoder),
        }

        json_full = {
            'meta': {k: v for k, v in report_data.items()
                     if k not in ('step_badges', 'check_badges', 'resolution_badges',
                                  'check_details_json', 'c_neg_json', 'c_recall_json',
                                  'all_trace_records')},
            'raw_steps': {
                sid: {
                    'results': [{
                        'check_id': r.check_id, 'check_name': r.check_name,
                        'passed': r.passed, 'severity': r.severity,
                        'suggestion': r.suggestion,
                        'details': self._to_serializable(r.details),
                    } for r in s.results],
                    'conflicts': [{
                        'conflict_id': c.conflict_id,
                        'description': c.description,
                        'neg_sample_data': self._to_serializable(c.neg_sample_data),
                        'recall_candidate_data': self._to_serializable(c.recall_candidate_data),
                        'record_trace_id': c.record_trace_id,
                        'resolution': c.resolution,
                        'resolved_by': c.resolved_by,
                        'resolution_reason': c.resolution_reason,
                        'resolved_at': c.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if c.resolved_at else None,
                    } for c in s.conflicts],
                    'status': s.status, 'batch_id': s.batch_id,
                    'data_version': s.data_version, 'export_path': s.export_path,
                }
                for sid, s in steps_raw.items()
            },
            'batches': batches_flat,
            'export_history': export_history,
            'run_history': history_flat,
            'trace_index': self._to_serializable(all_trace_records),
        }

        json_path = os.path.join(self.output_dir, f"{report_name}.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_full, f, ensure_ascii=False, indent=2, cls=NumpyEncoder)

        env = Environment()
        env.filters['jpp'] = _to_json_pretty
        env.filters['to_dict'] = lambda obj: self._to_serializable(getattr(obj, '__dict__', obj) if not isinstance(obj, dict) else obj)
        env.globals.update({
            '_sb': lambda r: _severity_badge(r.severity)[0],
            '_sbt': lambda r: _severity_badge(r.severity)[1],
        })
        template = env.from_string(HTML_TEMPLATE)
        html_content = template.render(**report_data)
        html_path = os.path.join(self.output_dir, f"{report_name}.html")
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

        return {'json': json_path, 'html': html_path}

    @staticmethod
    def _to_serializable(obj):
        try:
            return json.loads(_to_json_pretty(obj))
        except Exception:
            if isinstance(obj, (dict, list, str, int, float, bool, type(None))):
                return obj
            if hasattr(obj, 'item'):
                return obj.item()
            if hasattr(obj, 'to_dict'):
                return obj.to_dict()
            return str(obj)
