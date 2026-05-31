from __future__ import annotations
import json
import os
from datetime import datetime
from typing import Optional

from .models import Conversation, KnowledgeItem, HitResult, ReviewSession, HitType, ReviewStatus

_JS_NEWLINE = "\\n"


class ReportGenerator:
    HIT_TYPE_LABELS = {
        "exact": "精确命中",
        "partial": "部分命中",
        "miss": "未命中",
        "duplicate": "重复改判",
        "boundary": "边界情况",
    }

    STATUS_LABELS = {
        "auto": "自动判定",
        "confirmed": "已确认",
        "overridden": "已改判",
        "pending_review": "待复核",
    }

    def __init__(self):
        self._conversations: dict = {}
        self._knowledge: dict = {}

    def set_data(self, conversations: list, knowledge_items: list):
        self._conversations = {c.id: c for c in conversations}
        self._knowledge = {k.id: k for k in knowledge_items}

    def generate(
        self,
        hits: list,
        warnings: list,
        stats: dict,
        session: Optional[ReviewSession] = None,
        output_path: str = "output/report.html",
    ) -> str:
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        html = self._build_html(hits, warnings, stats, session)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)
        return output_path

    def _build_html(self, hits, warnings, stats, session) -> str:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        meta_parts = [f"生成时间：{now_str}"]
        if session:
            meta_parts.append(f"批次：{session.id}")
            meta_parts.append(f"操作人：{session.operator}")
        meta_str = " | ".join(meta_parts)

        stats_html = self._build_stats_html(stats)
        session_html = self._build_session_html(session) if session else ""
        warnings_html = self._build_warnings_html(warnings) if warnings else ""
        hits_rows_html = self._render_hits_rows(hits)
        hits_json = self._hits_to_json(hits)
        conv_json = self._conversations_to_json()
        kb_json = self._knowledge_to_json()
        hit_type_labels_json = json.dumps(self.HIT_TYPE_LABELS, ensure_ascii=False)
        js_code = self._build_js(hits_json, conv_json, kb_json, hit_type_labels_json)

        return f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>客服知识命中 - 分析报告</title>
<style>
{self._CSS}
</style>
</head>
<body>

<div class="header">
  <h1>客服知识命中 - 分析报告</h1>
  <div class="meta">{meta_str}</div>
</div>

<div class="container">

{stats_html}

{session_html}

{warnings_html}

<div class="card">
  <div class="card-header">
    <h2>命中详情（{len(hits)} 条）</h2>
    <div class="filters">
      <select id="filterType" onchange="applyFilters()">
        <option value="">全部类型</option>
        <option value="exact">精确命中</option>
        <option value="partial">部分命中</option>
        <option value="miss">未命中</option>
        <option value="duplicate">重复改判</option>
        <option value="boundary">边界情况</option>
      </select>
      <select id="filterStatus" onchange="applyFilters()">
        <option value="">全部状态</option>
        <option value="pending_review">待复核</option>
        <option value="confirmed">已确认</option>
        <option value="overridden">已改判</option>
        <option value="auto">自动判定</option>
      </select>
      <input type="text" id="filterSearch" placeholder="搜索对话ID或关键词..." oninput="applyFilters()">
      <button class="btn btn-primary" onclick="applyFilters()">筛选</button>
      <button class="btn btn-sm" onclick="resetFilters()">重置</button>
      <button class="btn btn-success btn-sm" onclick="batchConfirm()">批量确认当前筛选</button>
      <button class="btn btn-sm" onclick="exportCurrentView()">导出当前视图</button>
    </div>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th><input type="checkbox" id="selectAll" onchange="toggleSelectAll()"></th>
          <th>对话ID</th>
          <th>命中类型</th>
          <th>置信度</th>
          <th>关联知识</th>
          <th>复核状态</th>
          <th>复核人</th>
          <th>备注</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody id="hitsBody">
{hits_rows_html}
      </tbody>
    </table>
  </div>
</div>

</div>

<div class="modal-overlay" id="reviewModal">
  <div class="modal">
    <h3>复核操作</h3>
    <div id="modalConvInfo" style="margin-bottom:12px; font-size:13px; color:var(--text-secondary);"></div>
    <label>操作</label>
    <select id="modalAction">
      <option value="confirm">确认 - 同意自动判定结果</option>
      <option value="override">改判 - 修改判定结果</option>
    </select>
    <div id="overrideFields" style="display:none;">
      <label>新命中类型</label>
      <select id="modalNewType">
        <option value="">不改类型</option>
        <option value="exact">精确命中</option>
        <option value="partial">部分命中</option>
        <option value="miss">未命中</option>
        <option value="boundary">边界情况</option>
      </select>
      <label>新关联知识ID</label>
      <input type="text" id="modalNewKbId" placeholder="留空则不改">
    </div>
    <label>备注（下一班同事可见）</label>
    <textarea id="modalNote" placeholder="写清楚为什么这么判，方便后面的人接着查..."></textarea>
    <div id="modalOverrideWarn" style="display:none; background:#fef3c7; padding:8px 12px; border-radius:6px; font-size:12px; color:#92400e; margin-bottom:8px;"></div>
    <div class="modal-actions">
      <button class="btn" onclick="closeModal()">取消</button>
      <button class="btn btn-primary" onclick="submitReview()">提交</button>
    </div>
  </div>
</div>

<script>
{js_code}
</script>

</body>
</html>"""

    def _build_stats_html(self, stats: dict) -> str:
        items = [
            ("总条目", stats.get("total", 0), ""),
            ("精确命中", stats.get("exact", 0), "exact"),
            ("部分命中", stats.get("partial", 0), "partial"),
            ("未命中", stats.get("miss", 0), "miss"),
            ("重复改判", stats.get("duplicate", 0), "duplicate"),
            ("边界情况", stats.get("boundary", 0), "boundary"),
        ]
        cards = []
        for label, value, cls in items:
            cls_attr = f' class="stat-card {cls}"' if cls else ' class="stat-card"'
            cards.append(f'<div{cls_attr}><div class="label">{label}</div><div class="value">{value}</div></div>')
        cards.append(f'<div class="stat-card"><div class="label">待复核</div><div class="value" style="color:var(--danger)">{stats.get("pending_review", 0)}</div></div>')
        cards.append(f'<div class="stat-card"><div class="label">低置信度</div><div class="value" style="color:var(--warning)">{stats.get("low_confidence", 0)}</div></div>')
        return '<div class="stats-grid">\n' + "\n".join(cards) + "\n</div>"

    def _build_session_html(self, session: ReviewSession) -> str:
        return (
            f"<div class='session-info'><strong>当前批次</strong>：{session.id} "
            f"| 操作人：{session.operator} "
            f"| 已复核 {session.reviewed_count} 条 "
            f"| 待复核 {session.pending_count} 条</div>"
        )

    def _build_warnings_html(self, warnings: list) -> str:
        items = []
        for w in warnings:
            cls = "err" if "错误" in w.message or "Error" in w.code else "warn"
            items.append(f'<div class="warning-item {cls}"><span>⚠</span><span>{self._esc(w.message)}</span></div>')
        inner = "\n".join(items)
        return f"<div class='card'><div class='card-header'><h2>提示与警告</h2></div><div class='warning-list'>{inner}</div></div>"

    def _build_js(self, hits_json: str, conv_json: str, kb_json: str, labels_json: str) -> str:
        nl = _JS_NEWLINE
        return f"""const hitsData = {hits_json};
const conversationsData = {conv_json};
const knowledgeData = {kb_json};
let currentConvId = null;
const hitTypeLabels = {labels_json};

function applyFilters() {{
  const type = document.getElementById('filterType').value;
  const status = document.getElementById('filterStatus').value;
  const search = document.getElementById('filterSearch').value.toLowerCase();
  const rows = document.querySelectorAll('#hitsBody tr:not(.detail-row)');
  rows.forEach(row => {{
    const rType = row.dataset.type;
    const rStatus = row.dataset.status;
    const rId = row.dataset.id.toLowerCase();
    const rKw = (row.dataset.keywords || '').toLowerCase();
    let show = true;
    if (type && rType !== type) show = false;
    if (status && rStatus !== status) show = false;
    if (search && !rId.includes(search) && !rKw.includes(search)) show = false;
    row.style.display = show ? '' : 'none';
    const detailRow = row.nextElementSibling;
    if (detailRow && detailRow.classList.contains('detail-row')) {{
      detailRow.style.display = show && detailRow.classList.contains('show') ? '' : 'none';
    }}
  }});
}}

function resetFilters() {{
  document.getElementById('filterType').value = '';
  document.getElementById('filterStatus').value = '';
  document.getElementById('filterSearch').value = '';
  applyFilters();
}}

function toggleSelectAll() {{
  const checked = document.getElementById('selectAll').checked;
  document.querySelectorAll('.row-checkbox').forEach(cb => {{
    const row = cb.closest('tr');
    if (row.style.display !== 'none') cb.checked = checked;
  }});
}}

function toggleDetail(convId) {{
  const row = document.getElementById('detail-' + convId);
  row.classList.toggle('show');
  if (row.style.display === 'none' && row.classList.contains('show')) row.style.display = '';
}}

function openReview(convId) {{
  currentConvId = convId;
  const hit = hitsData.find(h => h.conversation_id === convId);
  const conv = conversationsData[convId];
  let info = '<div>对话ID：' + convId + '</div>';
  if (conv) info += '<div>客户：' + conv.customer_id + ' | 坐席：' + conv.agent_id + '</div>';
  if (hit) {{
    info += '<div>当前判定：' + hit.hit_type_label + '（置信度 ' + (hit.confidence * 100).toFixed(0) + '%）</div>';
    info += '<div>关联知识：' + (hit.knowledge_id || '无') + '</div>';
    if (hit.override_history && hit.override_history.length > 0) {{
      const last = hit.override_history[hit.override_history.length - 1];
      document.getElementById('modalOverrideWarn').style.display = 'block';
      document.getElementById('modalOverrideWarn').textContent = '注意：此对话之前已被 ' + (last.reviewer || '未知') + ' 于 ' + (last.time || '未知时间') + ' 改判过，再次改判会覆盖之前的判断。';
    }} else {{
      document.getElementById('modalOverrideWarn').style.display = 'none';
    }}
  }}
  document.getElementById('modalConvInfo').innerHTML = info;
  document.getElementById('modalAction').value = 'confirm';
  document.getElementById('overrideFields').style.display = 'none';
  document.getElementById('modalNote').value = '';
  document.getElementById('modalNewType').value = '';
  document.getElementById('modalNewKbId').value = '';
  document.getElementById('reviewModal').classList.add('show');
}}

function closeModal() {{
  document.getElementById('reviewModal').classList.remove('show');
  currentConvId = null;
}}

document.getElementById('modalAction').addEventListener('change', function() {{
  document.getElementById('overrideFields').style.display = this.value === 'override' ? 'block' : 'none';
}});

function submitReview() {{
  if (!currentConvId) return;
  const action = document.getElementById('modalAction').value;
  const note = document.getElementById('modalNote').value;
  const newType = document.getElementById('modalNewType').value;
  const newKbId = document.getElementById('modalNewKbId').value;
  const hit = hitsData.find(h => h.conversation_id === currentConvId);
  if (!hit) return;

  if (action === 'confirm') {{
    hit.status = 'confirmed';
    hit.status_label = '已确认';
    hit.reviewer_note = note;
    hit.reviewed_by = '当前操作人';
    hit.reviewed_at = new Date().toLocaleString('zh-CN');
  }} else {{
    hit.status = 'overridden';
    hit.status_label = '已改判';
    hit.reviewer_note = note;
    hit.reviewed_by = '当前操作人';
    hit.reviewed_at = new Date().toLocaleString('zh-CN');
    if (newType) {{
      hit.hit_type = newType;
      hit.hit_type_label = hitTypeLabels[newType] || newType;
    }}
    if (newKbId) hit.knowledge_id = newKbId;
    const overrideEntry = {{
      original_hit_type: hit.hit_type,
      original_knowledge_id: hit.knowledge_id,
      original_confidence: hit.confidence,
      reviewer: '当前操作人',
      time: new Date().toLocaleString('zh-CN'),
      note: note
    }};
    hit.override_history.push(overrideEntry);
  }}

  refreshRow(currentConvId);
  closeModal();
}}

function refreshRow(convId) {{
  const hit = hitsData.find(h => h.conversation_id === convId);
  if (!hit) return;
  const row = document.querySelector('tr[data-id="' + convId + '"]');
  if (!row) return;
  const typeBadge = '<span class="badge badge-' + hit.hit_type + '">' + hit.hit_type_label + '</span>';
  const statusBadge = '<span class="badge badge-' + hit.status + '">' + hit.status_label + '</span>';
  const confPct = (hit.confidence * 100).toFixed(0);
  const confColor = confPct >= 80 ? '#22c55e' : confPct >= 50 ? '#f59e0b' : '#ef4444';
  row.cells[2].innerHTML = typeBadge;
  row.cells[3].innerHTML = confPct + '% <div class="confidence-bar"><div class="confidence-fill" style="width:' + confPct + '%;background:' + confColor + '"></div></div>';
  row.cells[5].innerHTML = statusBadge;
  row.cells[6].textContent = hit.reviewed_by || '—';
  row.cells[7].textContent = hit.reviewer_note ? (hit.reviewer_note.length > 20 ? hit.reviewer_note.substring(0,20) + '...' : hit.reviewer_note) : '—';
  row.dataset.status = hit.status;
}}

function batchConfirm() {{
  const selected = document.querySelectorAll('.row-checkbox:checked');
  if (selected.length === 0) {{ alert('请先勾选要确认的条目'); return; }}
  if (!confirm('确认批量确认 ' + selected.length + ' 条记录？')) return;
  selected.forEach(cb => {{
    const convId = cb.dataset.convId;
    const hit = hitsData.find(h => h.conversation_id === convId);
    if (hit && hit.status === 'pending_review') {{
      hit.status = 'confirmed';
      hit.status_label = '已确认';
      hit.reviewed_by = '当前操作人';
      hit.reviewed_at = new Date().toLocaleString('zh-CN');
      refreshRow(convId);
    }}
  }});
}}

function exportCurrentView() {{
  const visibleRows = document.querySelectorAll('#hitsBody tr:not(.detail-row)');
  const visibleIds = new Set();
  visibleRows.forEach(row => {{
    if (row.style.display !== 'none') visibleIds.add(row.dataset.id);
  }});
  const visibleHits = hitsData.filter(h => visibleIds.has(h.conversation_id));
  let csv = '对话ID,命中类型,置信度,关联知识ID,复核状态,复核人,备注,详细说明{nl}';
  visibleHits.forEach(h => {{
    csv += '"' + h.conversation_id + '","' + h.hit_type_label + '","' + (h.confidence*100).toFixed(0) + '%","' + (h.knowledge_id||'无') + '","' + h.status_label + '","' + (h.reviewed_by||'') + '","' + (h.reviewer_note||'') + '","' + (h.detail||'') + '"{nl}';
  }});
  const blob = new Blob([String.fromCharCode(0xFEFF) + csv], {{ type: 'text/csv;charset=utf-8' }});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = '知识命中_筛选结果_' + new Date().toISOString().slice(0,10) + '.csv';
  a.click();
}}

document.getElementById('reviewModal').addEventListener('click', function(e) {{
  if (e.target === this) closeModal();
}});
"""

    _CSS = """:root {
  --bg: #f8fafc; --card: #ffffff; --border: #e2e8f0;
  --text: #1e293b; --text-secondary: #64748b;
  --primary: #3b82f6; --primary-hover: #2563eb;
  --success: #22c55e; --warning: #f59e0b; --danger: #ef4444;
  --purple: #8b5cf6; --cyan: #06b6d4;
  --radius: 8px; --shadow: 0 1px 3px rgba(0,0,0,0.08);
}
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; background:var(--bg); color:var(--text); line-height:1.6; }
.header { background:linear-gradient(135deg, #1e40af, #3b82f6); color:white; padding:24px 32px; }
.header h1 { font-size:24px; font-weight:700; margin-bottom:4px; }
.header .meta { font-size:14px; opacity:0.85; }
.container { max-width:1400px; margin:0 auto; padding:20px; }
.stats-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px; margin-bottom:24px; }
.stat-card { background:var(--card); border-radius:var(--radius); padding:20px; box-shadow:var(--shadow); border-left:4px solid var(--primary); }
.stat-card .label { font-size:13px; color:var(--text-secondary); margin-bottom:4px; }
.stat-card .value { font-size:28px; font-weight:700; }
.stat-card.exact { border-left-color:var(--success); }
.stat-card.partial { border-left-color:var(--warning); }
.stat-card.miss { border-left-color:var(--danger); }
.stat-card.duplicate { border-left-color:var(--purple); }
.stat-card.boundary { border-left-color:var(--cyan); }
.card { background:var(--card); border-radius:var(--radius); box-shadow:var(--shadow); margin-bottom:20px; }
.card-header { padding:16px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; }
.card-header h2 { font-size:16px; font-weight:600; }
.filters { display:flex; gap:8px; flex-wrap:wrap; align-items:center; }
.filters select, .filters input { padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-size:13px; background:white; }
.filters input { width:180px; }
.btn { padding:6px 14px; border:none; border-radius:6px; font-size:13px; cursor:pointer; font-weight:500; transition:all 0.15s; }
.btn-primary { background:var(--primary); color:white; }
.btn-primary:hover { background:var(--primary-hover); }
.btn-success { background:var(--success); color:white; }
.btn-warning { background:var(--warning); color:white; }
.btn-danger { background:var(--danger); color:white; }
.btn-sm { padding:4px 10px; font-size:12px; }
.badge { display:inline-block; padding:2px 8px; border-radius:12px; font-size:12px; font-weight:500; }
.badge-exact { background:#dcfce7; color:#166534; }
.badge-partial { background:#fef3c7; color:#92400e; }
.badge-miss { background:#fee2e2; color:#991b1b; }
.badge-duplicate { background:#ede9fe; color:#5b21b6; }
.badge-boundary { background:#cffafe; color:#155e75; }
.badge-auto { background:#f0f9ff; color:#0369a1; }
.badge-confirmed { background:#dcfce7; color:#166534; }
.badge-overridden { background:#fef3c7; color:#92400e; }
.badge-pending_review { background:#fee2e2; color:#991b1b; }
.table-wrap { overflow-x:auto; }
table { width:100%; border-collapse:collapse; font-size:13px; }
th { background:#f1f5f9; padding:10px 12px; text-align:left; font-weight:600; border-bottom:2px solid var(--border); white-space:nowrap; }
td { padding:10px 12px; border-bottom:1px solid var(--border); vertical-align:top; }
tr:hover { background:#f8fafc; }
.confidence-bar { width:60px; height:8px; background:#e2e8f0; border-radius:4px; overflow:hidden; display:inline-block; vertical-align:middle; }
.confidence-fill { height:100%; border-radius:4px; }
.detail-expand { cursor:pointer; color:var(--primary); font-size:12px; }
.detail-row { display:none; }
.detail-row.show { display:table-row; }
.detail-content { background:#f8fafc; padding:12px 16px; font-size:12px; line-height:1.8; }
.detail-content .field-label { color:var(--text-secondary); font-weight:500; margin-right:4px; }
.override-tag { background:#fef3c7; border:1px solid #fcd34d; border-radius:4px; padding:2px 6px; font-size:11px; color:#92400e; }
.warning-list { padding:16px 20px; }
.warning-item { padding:8px 12px; margin-bottom:6px; border-radius:6px; font-size:13px; display:flex; align-items:flex-start; gap:8px; }
.warning-item.warn { background:#fef3c7; border-left:3px solid var(--warning); }
.warning-item.err { background:#fee2e2; border-left:3px solid var(--danger); }
.review-actions { display:flex; gap:4px; flex-wrap:wrap; }
.modal-overlay { display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.4); z-index:1000; }
.modal-overlay.show { display:flex; align-items:center; justify-content:center; }
.modal { background:white; border-radius:12px; padding:24px; width:500px; max-width:90vw; max-height:80vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.2); }
.modal h3 { margin-bottom:16px; font-size:18px; }
.modal label { display:block; font-size:13px; font-weight:500; margin-bottom:4px; color:var(--text-secondary); }
.modal textarea, .modal select, .modal input { width:100%; padding:8px 12px; border:1px solid var(--border); border-radius:6px; font-size:14px; margin-bottom:12px; font-family:inherit; }
.modal textarea { min-height:80px; resize:vertical; }
.modal-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:16px; }
.session-info { padding:16px 20px; background:#f0f9ff; border-radius:var(--radius); margin-bottom:16px; font-size:13px; }
.session-info strong { color:var(--primary); }
@media (max-width:768px) { .stats-grid { grid-template-columns:repeat(2, 1fr); } .filters { flex-direction:column; } }"""

    def _render_hits_rows(self, hits: list) -> str:
        rows = []
        for h in hits:
            conv = self._conversations.get(h.conversation_id)
            kb = self._knowledge.get(h.knowledge_id) if h.knowledge_id else None

            type_label = self.HIT_TYPE_LABELS.get(h.hit_type.value, h.hit_type.value)
            status_label = self.STATUS_LABELS.get(h.status.value, h.status.value)

            conf_pct = int(h.confidence * 100)
            conf_color = "#22c55e" if conf_pct >= 80 else "#f59e0b" if conf_pct >= 50 else "#ef4444"

            kb_display = kb.title if kb else (h.knowledge_id or "无")

            note_display = h.reviewer_note[:20] + "..." if len(h.reviewer_note) > 20 else (h.reviewer_note or "—")

            override_tag = ""
            if h.override_history:
                override_tag = f' <span class="override-tag">已改判{len(h.override_history)}次</span>'

            conv_messages = ""
            if conv and conv.messages:
                for msg in conv.messages:
                    role_label = "客户" if msg.role in ("customer", "user") else "坐席"
                    conv_messages += f'<div><span class="field-label">[{role_label}]</span> {self._esc(msg.content)}</div>'

            kb_content_html = ""
            if kb:
                truncated = kb.content[:200]
                suffix = "..." if len(kb.content) > 200 else ""
                kb_content_html = f"<div><span class='field-label'>知识内容：</span>{self._esc(truncated)}{suffix}</div>"

            override_history_html = ""
            for ov in h.override_history:
                override_history_html += (
                    f'<div style="margin-top:8px;padding:6px 8px;background:#fef3c7;border-radius:4px;font-size:11px;">'
                    f'<span class="field-label">改判记录：</span>'
                    f'{ov.get("reviewer","?")} 于 {ov.get("time","?")} 由 {ov.get("original_hit_type","?")} 改判，'
                    f'备注：{self._esc(ov.get("note",""))}</div>'
                )

            matched_kw = "、".join(h.matched_keywords) if h.matched_keywords else "无"
            conv_msg_html = conv_messages or '<span style="color:#94a3b8">无对话内容</span>'
            kb_title_esc = self._esc(kb.title) if kb else "无"

            detail_html = (
                f'<td colspan="9" class="detail-content">'
                f'<div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">'
                f'<div><div class="field-label">对话内容：</div>{conv_msg_html}</div>'
                f'<div>'
                f'<div><span class="field-label">关联知识：</span>{kb_title_esc}</div>'
                f'{kb_content_html}'
                f'<div><span class="field-label">匹配关键词：</span>{matched_kw}</div>'
                f'<div><span class="field-label">详细说明：</span>{self._esc(h.detail)}</div>'
                f'{override_history_html}'
                f'</div></div></td>'
            )

            esc_id = self._esc(h.conversation_id)
            esc_kw = self._esc(",".join(h.matched_keywords))

            rows.append(
                f'        <tr data-id="{esc_id}" data-type="{h.hit_type.value}" '
                f'data-status="{h.status.value}" data-keywords="{esc_kw}">\n'
                f'          <td><input type="checkbox" class="row-checkbox" data-conv-id="{esc_id}"></td>\n'
                f'          <td><span class="detail-expand" onclick="toggleDetail(\'{esc_id}\')">▶</span> {esc_id}</td>\n'
                f'          <td><span class="badge badge-{h.hit_type.value}">{type_label}</span>{override_tag}</td>\n'
                f'          <td>{conf_pct}% <div class="confidence-bar"><div class="confidence-fill" style="width:{conf_pct}%;background:{conf_color}"></div></div></td>\n'
                f'          <td>{self._esc(kb_display)}</td>\n'
                f'          <td><span class="badge badge-{h.status.value}">{status_label}</span></td>\n'
                f'          <td>{self._esc(h.reviewed_by or "—")}</td>\n'
                f'          <td title="{self._esc(h.reviewer_note)}">{self._esc(note_display)}</td>\n'
                f'          <td class="review-actions">\n'
                f'            <button class="btn btn-primary btn-sm" onclick="openReview(\'{esc_id}\')">复核</button>\n'
                f'          </td>\n'
                f'        </tr>\n'
                f'        <tr id="detail-{esc_id}" class="detail-row">{detail_html}</tr>'
            )

        return "\n".join(rows)

    def _hits_to_json(self, hits: list) -> str:
        data = []
        for h in hits:
            data.append({
                "conversation_id": h.conversation_id,
                "knowledge_id": h.knowledge_id,
                "hit_type": h.hit_type.value,
                "hit_type_label": self.HIT_TYPE_LABELS.get(h.hit_type.value, h.hit_type.value),
                "confidence": h.confidence,
                "status": h.status.value,
                "status_label": self.STATUS_LABELS.get(h.status.value, h.status.value),
                "reviewer_note": h.reviewer_note,
                "reviewed_by": h.reviewed_by,
                "reviewed_at": h.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if h.reviewed_at else "",
                "matched_keywords": h.matched_keywords,
                "detail": h.detail,
                "override_history": h.override_history,
            })
        return json.dumps(data, ensure_ascii=False)

    def _conversations_to_json(self) -> str:
        data = {}
        for cid, conv in self._conversations.items():
            data[cid] = {
                "id": conv.id,
                "customer_id": conv.customer_id,
                "agent_id": conv.agent_id,
                "timestamp": conv.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "messages": [{"role": m.role, "content": m.content} for m in conv.messages],
                "source": conv.source.value,
                "manual_label": conv.manual_label,
            }
        return json.dumps(data, ensure_ascii=False)

    def _knowledge_to_json(self) -> str:
        data = {}
        for kid, kb in self._knowledge.items():
            data[kid] = {
                "id": kb.id,
                "title": kb.title,
                "content": kb.content,
                "keywords": kb.keywords,
                "category": kb.category,
                "active": kb.active,
            }
        return json.dumps(data, ensure_ascii=False)

    @staticmethod
    def _esc(text: str) -> str:
        if not text:
            return ""
        return (text.replace("&", "&amp;").replace("<", "&lt;")
                .replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;"))
