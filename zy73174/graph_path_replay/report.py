from __future__ import annotations

import html
import json
from pathlib import Path

from .history import QuestionHistoryStore
from .models import AnomalyStatus, QuestionItem, ReplaySummary


class ReviewReportGenerator:
    def __init__(self, summary: ReplaySummary, store: QuestionHistoryStore | None = None):
        self.summary = summary
        self.store = store
        self._qmap = self._build_qmap()

    def _build_qmap(self) -> dict[str, QuestionItem]:
        result = {}
        for row in self.summary.break_down:
            if row.question:
                result[row.question.question_id] = row.question
        return result

    def _anomaly_badge(self, status: AnomalyStatus) -> tuple[str, str]:
        mapping = {
            AnomalyStatus.OPEN: ("🔴 待处理", "#fee2e2"),
            AnomalyStatus.SUPPLEMENTED: ("🟡 已补充", "#fef9c3"),
            AnomalyStatus.REJUDGED: ("🔵 已改判", "#dbeafe"),
            AnomalyStatus.RESOLVED: ("🟢 已解决", "#dcfce7"),
        }
        return mapping.get(status, ("⚪ 未知", "#f1f5f9"))

    def _escape(self, s: str) -> str:
        return html.escape(str(s))

    def generate_html(self, output_path: str) -> str:
        s = self.summary
        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)

        anomalies_html_parts = []
        for a in s.anomalies:
            label, color = self._anomaly_badge(AnomalyStatus(a.status))
            ops_log = ""
            if a.operation_log:
                ops_log = "<ul class='ops-log'>" + "".join(
                    f"<li><span class='op-time'>{self._escape(op['timestamp'])}</span> "
                    f"<span class='op-type'>[{self._escape(op['op_type'])}]</span> "
                    f"@{self._escape(op['operator'])} — {self._escape(op['detail'])}</li>"
                    for op in a.operation_log
                ) + "</ul>"

            q = self._qmap.get(a.question_id)
            hist_html = ""
            if q and self.store:
                q_full = self.store.get(a.question_id)
                if q_full:
                    hist_items = []
                    for i, rm in enumerate(q_full.remark.history):
                        hist_items.append(
                            f"<div class='hist-item'><span class='hist-ver'>V{i + 1}</span> "
                            f"<span class='hist-time'>{self._escape(rm.timestamp)}</span> "
                            f"@{self._escape(rm.author)}: {self._escape(rm.value)}</div>"
                        )
                    shot_items = []
                    for i, sh in enumerate(q_full.screenshots.history):
                        shot_items.append(
                            f"<div class='hist-item'><span class='hist-ver'>📷#{i + 1}</span> "
                            f"<span class='hist-time'>{self._escape(sh.timestamp)}</span> "
                            f"@{self._escape(sh.author)}: {self._escape(sh.value)}</div>"
                        )
                    hist_html = (
                        "<details class='history-box'>"
                        "<summary>📜 题目历史（备注+截图，而非仅最终值）</summary>"
                        f"<div class='hist-section'><b>备注历史:</b>{''.join(hist_items) or '<em>(无)</em>'}</div>"
                        f"<div class='hist-section'><b>截图历史:</b>{''.join(shot_items) or '<em>(无)</em>'}</div>"
                        "</details>"
                    )

            anomalies_html_parts.append(f"""
            <div class="anomaly-card" style="border-left: 4px solid {color};">
                <div class="anomaly-head">
                    <span class="anomaly-id">#{self._escape(a.anomaly_id)}</span>
                    <span class="anomaly-title">{self._escape(a.title)} <small>({self._escape(a.question_id)})</small></span>
                    <span class="anomaly-badge" style="background:{color}">{label}</span>
                </div>
                <div class="anomaly-type">类型: {self._escape(a.anomaly_type)}</div>
                <div class="anomaly-desc">说明: {self._escape(a.description)}</div>
                <div class="anomaly-params">参数快照: <code>{self._escape(json.dumps(a.params_snapshot, ensure_ascii=False))}</code></div>
                <div class="anomaly-meta">创建: {self._escape(a.created_at)}</div>
                {hist_html}
                {ops_log}
            </div>
            """)

        sort_html = ""
        if s.sort_detection:
            sd = s.sort_detection
            stable_cls = "ok" if sd.stable == "stable" else "warn"
            diff_rows = "".join(
                f"<tr><td>{idx}</td><td>{self._escape(a)}</td><td>{self._escape(b)}</td></tr>"
                for idx, a, b in sd.diff_indices[:10]
            )
            sort_html = f"""
            <section class="panel sort-panel">
                <h2>🔀 排序稳定性检测 <span class="tag {stable_cls}">{sd.stable}</span></h2>
                <details open>
                    <summary>差异位置列表（前10条）</summary>
                    <table class="diff-table">
                        <tr><th>位置</th><th>基准顺序</th><th>冲突顺序</th></tr>
                        {diff_rows or '<tr><td colspan="3">(无差异)</td></tr>'}
                    </table>
                </details>
                <pre class="action-box">{self._escape(sd.action_suggestion)}</pre>
            </section>
            """

        stats_rows = [
            ("参数版本", s.param_version, "#1e3a8a"),
            ("已处理行", f"{s.processed_rows} 行", "#15803d"),
            ("跳过行", f"{s.skipped_rows} 行", "#a16207"),
            ("坏行", f"{s.bad_rows} 行", "#b91c1c"),
            ("异常项", f"{len(s.anomalies)} 条", "#b45309"),
            ("总行数", f"{s.total_rows} 行", "#475569"),
        ]
        stats_html = "".join(
            f"<div class='stat-card' style='border-top:3px solid {c}'>"
            f"<div class='stat-label'>{self._escape(n)}</div>"
            f"<div class='stat-value'>{self._escape(v)}</div></div>"
            for n, v, c in stats_rows
        )

        content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>图论路径参数回放 - 复核报告</title>
<style>
* {{ box-sizing: border-box; }}
body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
       margin: 0; padding: 24px; background: #f8fafc; color: #0f172a; line-height: 1.6; }}
h1 {{ margin: 0 0 8px; font-size: 24px; }}
h2 {{ margin: 0 0 12px; font-size: 18px; }}
.subtitle {{ color: #64748b; font-size: 14px; margin-bottom: 20px; }}
.panel {{ background: #fff; border-radius: 8px; padding: 18px 20px; margin-bottom: 18px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.08); }}
.stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }}
.stat-card {{ background: #f8fafc; padding: 12px 14px; border-radius: 6px; }}
.stat-label {{ font-size: 12px; color: #64748b; }}
.stat-value {{ font-size: 22px; font-weight: 700; margin-top: 4px; }}
.tag {{ display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }}
.tag.ok {{ background: #dcfce7; color: #166534; }}
.tag.warn {{ background: #fef9c3; color: #854d0e; }}
.anomaly-card {{ background: #fff; border-radius: 6px; padding: 14px 16px; margin-bottom: 12px; }}
.anomaly-head {{ display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 6px; }}
.anomaly-id {{ font-weight: 700; color: #475569; }}
.anomaly-title {{ flex: 1; font-weight: 600; }}
.anomaly-title small {{ color: #94a3b8; font-weight: 400; }}
.anomaly-badge {{ padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }}
.anomaly-type {{ font-size: 13px; color: #475569; }}
.anomaly-desc {{ margin: 4px 0; font-size: 14px; }}
.anomaly-params {{ font-size: 13px; margin: 4px 0; }}
.anomaly-params code {{ background: #f1f5f9; padding: 2px 6px; border-radius: 3px; }}
.anomaly-meta {{ font-size: 12px; color: #94a3b8; }}
.action-box {{ background: #0f172a; color: #e2e8f0; padding: 12px 14px; border-radius: 6px;
               font-size: 13px; white-space: pre-wrap; overflow-x: auto; }}
.ops-log {{ list-style: none; padding: 8px 12px; background: #f8fafc; border-radius: 4px; margin: 8px 0 0; }}
.ops-log li {{ padding: 3px 0; font-size: 13px; border-bottom: 1px dashed #e2e8f0; }}
.ops-log li:last-child {{ border-bottom: none; }}
.op-time {{ color: #64748b; margin-right: 8px; font-size: 12px; }}
.op-type {{ color: #2563eb; font-weight: 600; }}
.history-box {{ margin-top: 10px; }}
.history-box summary {{ cursor: pointer; font-size: 13px; color: #2563eb; padding: 4px 0; }}
.hist-section {{ margin: 8px 0 4px; font-size: 13px; }}
.hist-section b {{ display: block; margin-bottom: 4px; color: #334155; }}
.hist-item {{ padding: 3px 0; border-bottom: 1px dashed #e2e8f0; }}
.hist-item:last-child {{ border-bottom: none; }}
.hist-ver {{ display: inline-block; background: #3b82f6; color: #fff; padding: 0 6px;
             border-radius: 3px; font-size: 11px; margin-right: 6px; }}
.hist-time {{ color: #64748b; font-size: 12px; margin-right: 6px; }}
.diff-table {{ width: 100%; border-collapse: collapse; font-size: 13px; margin: 8px 0; }}
.diff-table th, .diff-table td {{ padding: 6px 10px; border: 1px solid #e2e8f0; text-align: left; }}
.diff-table th {{ background: #f1f5f9; }}
.footer {{ text-align: center; color: #94a3b8; font-size: 12px; margin-top: 24px; }}
</style>
</head>
<body>
<h1>📊 图论路径参数回放 · 复核报告</h1>
<div class="subtitle">
  参数版本 <b>{self._escape(s.param_version)}</b> ·
  开始 {self._escape(s.started_at)} → 完成 {self._escape(s.finished_at)}
</div>

<section class="panel">
  <h2>📈 一页总览：参数版本 + 关键数据</h2>
  <div class="stats-grid">{stats_html}</div>
</section>

{sort_html}

<section class="panel">
  <h2>⚠️ 异常队列：同一页可见异常点、参数快照、解释与历史</h2>
  {''.join(anomalies_html_parts) or '<p style="color:#64748b">本次回放未发现异常。</p>'}
</section>

<div class="footer">报告生成时间 · 图论路径参数回放 v1.0</div>
</body>
</html>"""

        with open(out, "w", encoding="utf-8") as f:
            f.write(content)
        return str(out.resolve())
