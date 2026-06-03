from http.server import HTTPServer, BaseHTTPRequestHandler
from fourier_noise.workflow import WorkflowEngine
from fourier_noise.demo_data import (
    get_demo_records,
    get_demo_teacher_annotations,
    get_demo_sampling_list,
    get_demo_manual_correction,
    get_demo_rerun_config,
)
from fourier_noise.models import RecordType, ReviewStatus


def _render_dashboard(engine: WorkflowEngine) -> str:
    status = engine.get_status()
    records = engine.records

    normal = [r for r in records if r.record_type == RecordType.NORMAL]
    neg_missing = [r for r in records if r.record_type == RecordType.NEGATIVE_AS_MISSING]
    supplemented = [r for r in records if r.record_type == RecordType.SUPPLEMENTED_FROM_SAMPLING]
    pending = [r for r in records if r.review_status == ReviewStatus.PENDING]

    step_badges = {
        "import_annotations": ("①导入批注", False),
        "supplement_sampling": ("②补看抽样", False),
        "update_report": ("③更新报告", False),
        "manual_correct": ("人工修正", False),
        "rerun": ("重跑", False),
    }
    for s in status.get("completed_steps", []):
        if s in step_badges:
            label, _ = step_badges[s]
            step_badges[s] = (label, True)

    steps_html = ""
    for step_key, (label, done) in step_badges.items():
        css_class = "step-done" if done else "step-pending"
        icon = "✔" if done else "○"
        steps_html += f'<div class="step {css_class}">{icon} {label}</div>\n'

    records_html = ""
    type_map = {
        RecordType.NORMAL: ("✅ 正常", "type-normal"),
        RecordType.NEGATIVE_AS_MISSING: ("⚠️ 负数→缺失", "type-neg"),
        RecordType.SUPPLEMENTED_FROM_SAMPLING: ("📋 抽样补录", "type-supp"),
    }
    review_map = {
        ReviewStatus.PENDING: ("⏳ 待复核", "review-pending"),
        ReviewStatus.CONFIRMED: ("✔ 已确认", "review-confirmed"),
        ReviewStatus.REJECTED: ("✖ 已拒绝", "review-rejected"),
    }

    for r in records:
        type_label, type_css = type_map.get(r.record_type, ("?", ""))
        rev_label, rev_css = review_map.get(r.review_status, ("?", ""))

        old_val = f"{r.old_table_value}" if r.old_table_value is not None else '<span class="missing">缺失</span>'
        corr_val = f"{r.corrected_value}" if r.corrected_value is not None else "—"
        ann = r.teacher_annotation[:30] + "…" if r.teacher_annotation and len(r.teacher_annotation) > 30 else (r.teacher_annotation or "—")
        src = r.sampling_list_source or "—"

        records_html += f"""<tr>
            <td>{r.id}</td>
            <td>{r.value}</td>
            <td>{old_val}</td>
            <td class="{type_css}">{type_label}</td>
            <td class="{rev_css}">{rev_label}</td>
            <td>{corr_val}</td>
            <td title="{r.teacher_annotation or ''}">{ann}</td>
            <td>{src}</td>
        </tr>\n"""

    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>傅里叶周期噪声拆解 — 小看板</title>
<style>
body {{ font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; max-width: 960px; margin: 0 auto; padding: 20px; background: #f8f9fa; color: #333; }}
h1 {{ color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 8px; }}
h2 {{ color: #34495e; margin-top: 24px; }}
.steps {{ display: flex; gap: 12px; flex-wrap: wrap; margin: 16px 0; }}
.step {{ padding: 8px 16px; border-radius: 6px; font-weight: 500; }}
.step-done {{ background: #27ae60; color: white; }}
.step-pending {{ background: #ecf0f1; color: #7f8c8d; }}
.stats {{ display: flex; gap: 16px; flex-wrap: wrap; margin: 16px 0; }}
.stat {{ background: white; padding: 12px 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
.stat-num {{ font-size: 24px; font-weight: 700; }}
.stat-label {{ font-size: 12px; color: #7f8c8d; }}
table {{ width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
th {{ background: #2c3e50; color: white; padding: 10px 8px; text-align: left; font-size: 13px; }}
td {{ padding: 8px; border-bottom: 1px solid #ecf0f1; font-size: 13px; }}
tr:hover {{ background: #f0f6ff; }}
.type-normal {{ color: #27ae60; }}
.type-neg {{ color: #e67e22; font-weight: 600; }}
.type-supp {{ color: #3498db; }}
.review-pending {{ color: #e67e22; }}
.review-confirmed {{ color: #27ae60; }}
.review-rejected {{ color: #e74c3c; }}
.missing {{ color: #e74c3c; font-style: italic; }}
.note {{ background: #fff3cd; border-left: 4px solid #ffc107; padding: 12px 16px; margin: 12px 0; border-radius: 4px; }}
</style>
</head>
<body>
<h1>🔬 傅里叶周期噪声拆解 — 小看板</h1>

<h2>流程进度</h2>
<div class="steps">
{steps_html}
</div>

<div class="note">
⚠️ <b>负数样本不自动归正常</b>：旧表将负值标记为缺失的记录，需留给学生助教复核确认后方可处理。
</div>

<h2>统计概览</h2>
<div class="stats">
    <div class="stat"><div class="stat-num">{len(records)}</div><div class="stat-label">总记录</div></div>
    <div class="stat"><div class="stat-num" style="color:#27ae60">{len(normal)}</div><div class="stat-label">✅ 正常</div></div>
    <div class="stat"><div class="stat-num" style="color:#e67e22">{len(neg_missing)}</div><div class="stat-label">⚠️ 负数→缺失</div></div>
    <div class="stat"><div class="stat-num" style="color:#3498db">{len(supplemented)}</div><div class="stat-label">📋 抽样补录</div></div>
    <div class="stat"><div class="stat-num" style="color:#e67e22">{len(pending)}</div><div class="stat-label">⏳ 待复核</div></div>
</div>

<h2>记录明细</h2>
<table>
<tr>
    <th>ID</th><th>值</th><th>旧表值</th><th>类型</th><th>复核</th><th>修正值</th><th>批注</th><th>来源</th>
</tr>
{records_html}
</table>

<h2>三种处理结果对比</h2>
<table>
<tr><th>类型</th><th>数量</th><th>处理方式</th></tr>
<tr class="type-normal"><td>✅ 正常记录</td><td>{len(normal)}</td><td>值与旧表一致，直接进入傅里叶拆解</td></tr>
<tr class="type-neg"><td>⚠️ 负数→缺失</td><td>{len(neg_missing)}</td><td>旧表丢弃负值，标记待复核，<b>不自动归正常</b></td></tr>
<tr class="type-supp"><td>📋 抽样补录</td><td>{len(supplemented)}</td><td>从抽样名单补回旧口径值，复核后可用</td></tr>
</table>

</body>
</html>"""
    return html


class DashboardHandler(BaseHTTPRequestHandler):

    def do_GET(self):
        engine = WorkflowEngine()
        try:
            from fourier_noise.cli import _load_engine
            engine = _load_engine(None)
        except Exception:
            pass

        if not engine.records:
            records = get_demo_records()
            annotations = get_demo_teacher_annotations()
            sampling = get_demo_sampling_list()
            correction = get_demo_manual_correction()
            engine.import_teacher_annotations(records, annotations)
            engine.supplement_from_sampling(sampling)
            engine.manual_correct(correction["record_id"], correction["corrected_value"])
            engine.rerun()

        html = _render_dashboard(engine)
        body = html.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass


def run_dashboard(host: str = "127.0.0.1", port: int = 8766):
    server = HTTPServer((host, port), DashboardHandler)
    print(f"傅里叶周期噪声拆解 小看板已启动: http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    run_dashboard()
