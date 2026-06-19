from __future__ import annotations

import cgi
import html
import http.server
import json
import socketserver
import urllib.parse

from .models import ConflictResolution
from .sample_data import (
    make_old_caliber_note,
    make_webcalc_screenshot_a,
    make_webcalc_screenshot_b_mixed,
)
from .workflow import PulleyReviewWorkflow

_workflow = PulleyReviewWorkflow(equipment_id="PULLEY-A01")

BASE_STYLE = """
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7fa; color: #2c3e50; padding: 20px; }
  .container { max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 24px; margin-bottom: 16px; color: #1a237e; }
  h2 { font-size: 18px; margin-bottom: 12px; color: #283593; }
  .card { background: #fff; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
  .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; }
  .summary-card h2 { color: #fff; }
  .summary-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; }
  .stat-box { background: rgba(255,255,255,0.2); border-radius: 8px; padding: 16px; text-align: center; }
  .stat-number { font-size: 32px; font-weight: bold; }
  .stat-label { font-size: 13px; opacity: 0.9; margin-top: 4px; }
  .stat-normal { border-left: 4px solid #4caf50; }
  .stat-pending { border-left: 4px solid #ff9800; }
  .stat-supplemented { border-left: 4px solid #2196f3; }
  .stat-conflict { border-left: 4px solid #f44336; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e0e0e0; font-size: 14px; }
  th { background: #f8f9fa; font-weight: 600; }
  .tag { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
  .tag-normal { background: #e8f5e9; color: #2e7d32; }
  .tag-pending { background: #fff3e0; color: #e65100; }
  .tag-supplemented { background: #e3f2fd; color: #1565c0; }
  .tag-confirmed { background: #e8f5e9; color: #2e7d32; }
  .tag-rejected { background: #ffebee; color: #c62828; }
  .tag-pending-conflict { background: #fff3e0; color: #e65100; }
  .btn-group { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
  form { display: inline; }
  button, .btn { background: #3f51b5; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px; text-decoration: none; display: inline-block; }
  button:hover, .btn:hover { background: #303f9f; }
  .btn-secondary { background: #607d8b; }
  .btn-secondary:hover { background: #455a64; }
  .btn-success { background: #4caf50; }
  .btn-success:hover { background: #388e3c; }
  .btn-danger { background: #f44336; }
  .btn-danger:hover { background: #d32f2f; }
  .btn-sm { padding: 4px 10px; font-size: 12px; }
  .pending-card { background: #fff8e1; border: 1px solid #ffcc02; border-radius: 8px; padding: 16px; margin: 12px 0; }
  .pending-card h3 { color: #f57f17; font-size: 16px; margin-bottom: 10px; }
  .field-row { display: grid; grid-template-columns: 140px 1fr; gap: 8px; margin-bottom: 6px; font-size: 14px; }
  .field-label { color: #666; font-weight: 500; }
  .field-value { color: #2c3e50; word-break: break-all; }
  .back-link { margin-bottom: 16px; display: inline-block; color: #3f51b5; text-decoration: none; font-size: 14px; }
  .back-link:hover { text-decoration: underline; }
  .conflict-form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-top: 8px; }
  .conflict-form input[type="text"] { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; }
  .empty-state { text-align: center; padding: 40px 20px; color: #999; }
  .footer-summary { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 13px; color: #666; }
  .section-title { margin-bottom: 8px; margin-top: 16px; }
</style>
"""


def _status_tag_class(status: str) -> str:
    mapping = {
        "normal": "tag-normal",
        "pending_review": "tag-pending",
        "supplemented": "tag-supplemented",
    }
    return mapping.get(status, "tag-normal")


def _conflict_tag_class(resolution: str) -> str:
    mapping = {
        "confirmed": "tag-confirmed",
        "rejected": "tag-rejected",
        "pending": "tag-pending-conflict",
    }
    return mapping.get(resolution, "tag-pending-conflict")


def _escape(text: str | None) -> str:
    if text is None:
        return ""
    return html.escape(str(text))


def _render_summary_card(sv: dict) -> str:
    c = sv["counts"]
    return f"""
    <div class="card summary-card">
      <h2>滑轮组效率复核 Web 交互计算器 — 设备 {_escape(sv["equipment_id"])}</h2>
      <p>{_escape(sv["summary_text"])}</p>
      <div class="summary-stats">
        <div class="stat-box">
          <div class="stat-number">{c["normal"]}</div>
          <div class="stat-label">正常记录</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">{c["pending"]}</div>
          <div class="stat-label">待复核</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">{c["supplemented"]}</div>
          <div class="stat-label">旧口径补录</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">{c["conflicts"]}</div>
          <div class="stat-label">冲突</div>
        </div>
      </div>
      <div style="margin-top:12px; font-size:13px; opacity:0.9;">
        总记录: {sv["record_count"]} | 截图: {sv["screenshot_count"]} | 采样说明: {sv["note_count"]} | 审计条目: {sv["audit_count"]}
      </div>
    </div>
    """


def _render_home(sv: dict, records: list[dict]) -> str:
    rows_html = ""
    if records:
        for r in records:
            rows_html += f"""
            <tr>
              <td>{_escape(r["id"])}</td>
              <td>{_escape(r["equipment_id"])}</td>
              <td>{r["temperature_value"]} {_escape(r["temperature_unit"])}</td>
              <td>{r["efficiency"]}</td>
              <td><span class="tag {_status_tag_class(r["status"])}">{_escape(r["status_label"])}</span></td>
              <td>{_escape(r["source"])}</td>
              <td>
                <a href="/record/{_escape(r["id"])}" class="btn btn-sm btn-secondary">查看详情</a>
              </td>
            </tr>
            """
    else:
        rows_html = '<tr><td colspan="7" class="empty-state">暂无记录，点击下方按钮导入样例数据</td></tr>'

    conflicts_list_html = ""
    if _workflow.conflicts:
        conflicts_rows = ""
        for idx, c in enumerate(_workflow.conflicts):
            res_tag_class = _conflict_tag_class(c.resolution.value)
            resolve_form = ""
            if c.resolution == ConflictResolution.PENDING:
                resolve_form = f"""
                <div class="conflict-form">
                  <form method="POST" action="/resolve-conflict" style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                    <input type="hidden" name="idx" value="{idx}">
                    <input type="text" name="note" placeholder="备注（可选）" style="flex:1; min-width:180px;">
                    <button type="submit" name="action" value="confirm" class="btn btn-sm btn-success">确认</button>
                    <button type="submit" name="action" value="reject" class="btn btn-sm btn-danger">驳回</button>
                  </form>
                </div>
                """
            conflicts_rows += f"""
            <div class="card" style="margin-bottom:12px; padding:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong>冲突 #{idx + 1}: 截图 {_escape(c.screenshot_id)} ↔ 说明 {_escape(c.note_id)}</strong>
                <span class="tag {res_tag_class}">{_escape(c.resolution.value)}</span>
              </div>
              <div class="field-row"><span class="field-label">截图温度</span><span class="field-value">{c.screenshot_temp[0]} {c.screenshot_temp[1].value}</span></div>
              <div class="field-row"><span class="field-label">说明温度</span><span class="field-value">{c.note_temp[0]} {c.note_temp[1].value}</span></div>
              <div class="field-row"><span class="field-label">截图效率</span><span class="field-value">{c.screenshot_efficiency}</span></div>
              <div class="field-row"><span class="field-label">说明效率</span><span class="field-value">{c.note_efficiency}</span></div>
              {resolve_form}
              {f'<div style="margin-top:8px; font-size:13px; color:#555;">处理人: {_escape(c.resolved_by)} | 备注: {_escape(c.resolution_note)}</div>' if c.resolution != ConflictResolution.PENDING else ''}
            </div>
            """
        conflicts_list_html = f"""
        <div class="card">
          <h2>冲突列表 ({len(_workflow.conflicts)})</h2>
          {conflicts_rows}
        </div>
        """

    body = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>滑轮组效率复核 — 首页</title>
{BASE_STYLE}
</head>
<body>
<div class="container">
  <h1>🏗️ 滑轮组效率复核交接系统</h1>
  {_render_summary_card(sv)}

  <div class="card">
    <h2>📋 记录列表 ({len(records)})</h2>
    <table>
      <thead>
        <tr>
          <th>ID</th>
          <th>设备</th>
          <th>温度</th>
          <th>效率</th>
          <th>状态</th>
          <th>来源</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {rows_html}
      </tbody>
    </table>
    <div class="btn-group">
      <form method="POST" action="/import-sample-a">
        <button type="submit">📥 导入维修群截图样例A(摄氏度)</button>
      </form>
      <form method="POST" action="/import-sample-b">
        <button type="submit" class="btn-secondary">📥 导入样例B(开尔文→混用)</button>
      </form>
      <form method="POST" action="/supplement-old">
        <button type="submit" class="btn-secondary">📝 导入旧口径补录（独立补录记录，来自采样间隔说明）</button>
      </form>
      <form method="POST" action="/export-text">
        <button type="submit" class="btn-success">📄 导出文本报告</button>
      </form>
      <form method="POST" action="/export-json">
        <button type="submit" class="btn-success">📊 导出JSON报告</button>
      </form>
    </div>
  </div>

  {conflicts_list_html}
</div>
</body>
</html>
"""
    return body


def _render_record_detail(detail: dict | None, record_id: str) -> str:
    if detail is None:
        body = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>记录未找到</title>
{BASE_STYLE}
</head>
<body>
<div class="container">
  <a href="/" class="back-link">← 返回首页</a>
  <div class="card">
    <h2>❌ 记录未找到</h2>
    <p>ID 为 {_escape(record_id)} 的记录不存在。</p>
  </div>
</div>
</body>
</html>
"""
        return body

    rec = detail["record"]
    sv = detail["summary_view"]

    pending_html = ""
    if detail["pending_review"]:
        pr = detail["pending_review"]
        pending_html = f"""
        <div class="pending-card">
          <h3>⚠️ 待复核信息</h3>
          <div class="field-row"><span class="field-label">原始表述</span><span class="field-value">{_escape(pr["original_statement"])}</span></div>
          <div class="field-row"><span class="field-label">建议值</span><span class="field-value">{_escape(pr["suggested_value"])}</span></div>
          <div class="field-row"><span class="field-label">原因</span><span class="field-value">{_escape(pr["reason"])}</span></div>
          <div class="field-row"><span class="field-label">下一步处理人</span><span class="field-value">{_escape(pr["next_handler"])}</span></div>
        </div>
        """

    history_html = ""
    if detail["history"]:
        rows = ""
        for h in detail["history"]:
            rows += f"""
            <tr>
              <td>{_escape(h["changed_at"])}</td>
              <td>{_escape(h["changed_by"])}</td>
              <td>{_escape(h["change_type"])}</td>
              <td>{_escape(h["old_value"])}</td>
              <td>{_escape(h["new_value"])}</td>
              <td>{_escape(h["reason"])}</td>
            </tr>
            """
        history_html = f"""
        <div class="card">
          <h2 class="section-title">📜 历史记录</h2>
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>操作人</th>
                <th>变更类型</th>
                <th>旧值</th>
                <th>新值</th>
                <th>原因</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
        """

    conflicts_html = ""
    if detail["conflicts"]:
        rows = ""
        for c in detail["conflicts"]:
            res_tag_class = _conflict_tag_class(c["resolution"])
            rows += f"""
            <div class="card" style="margin-bottom:12px; padding:14px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <strong>冲突: 截图 {_escape(c["screenshot_id"])} ↔ 说明 {_escape(c["note_id"])}</strong>
                <span class="tag {res_tag_class}">{_escape(c["resolution"])}</span>
              </div>
              <div class="field-row"><span class="field-label">截图温度</span><span class="field-value">{c["screenshot_temp"][0]} {c["screenshot_temp"][1]}</span></div>
              <div class="field-row"><span class="field-label">说明温度</span><span class="field-value">{c["note_temp"][0]} {c["note_temp"][1]}</span></div>
              <div class="field-row"><span class="field-label">截图效率</span><span class="field-value">{c["screenshot_efficiency"]}</span></div>
              <div class="field-row"><span class="field-label">说明效率</span><span class="field-value">{c["note_efficiency"]}</span></div>
              {f'<div style="margin-top:6px; font-size:13px; color:#555;">处理人: {_escape(c["resolved_by"])} | 备注: {_escape(c["resolution_note"])}</div>' if c["resolution"] != "pending" else ''}
            </div>
            """
        conflicts_html = f"""
        <div class="card">
          <h2 class="section-title">🔍 相关冲突 ({len(detail["conflicts"])})</h2>
          {rows}
        </div>
        """

    body = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>记录详情 - {_escape(rec["id"])}</title>
{BASE_STYLE}
</head>
<body>
<div class="container">
  <a href="/" class="back-link">← 返回首页</a>
  <h1>📋 记录详情</h1>

  {_render_summary_card(sv)}

  <div class="card">
    <h2>记录字段</h2>
    <div class="field-row"><span class="field-label">ID</span><span class="field-value">{_escape(rec["id"])}</span></div>
    <div class="field-row"><span class="field-label">设备ID</span><span class="field-value">{_escape(rec["equipment_id"])}</span></div>
    <div class="field-row"><span class="field-label">温度值</span><span class="field-value">{rec["temperature_value"]} {_escape(rec["temperature_unit"])}</span></div>
    <div class="field-row"><span class="field-label">效率</span><span class="field-value">{rec["efficiency"]}</span></div>
    <div class="field-row"><span class="field-label">状态</span><span class="field-value"><span class="tag {_status_tag_class(rec["status"])}">{_escape(rec["status_label"])}</span></span></div>
    <div class="field-row"><span class="field-label">来源</span><span class="field-value">{_escape(rec["source"])}</span></div>
    <div class="field-row"><span class="field-label">备注</span><span class="field-value">{_escape(rec["note"]) or "—"}</span></div>
    {f'<div class="field-row"><span class="field-label">原始单位</span><span class="field-value">{_escape(rec["original_unit"])}</span></div>' if rec["original_unit"] else ''}
    {f'<div class="field-row"><span class="field-label">补录前温度</span><span class="field-value">{rec["original_value_before_supplement"]}</span></div>' if rec["original_value_before_supplement"] is not None else ''}
    {f'<div class="field-row"><span class="field-label">补录前效率</span><span class="field-value">{rec["original_efficiency_before_supplement"]}</span></div>' if rec["original_efficiency_before_supplement"] is not None else ''}
    {f'<div class="field-row"><span class="field-label">补录来源</span><span class="field-value">{_escape(rec["supplemental_source"])}</span></div>' if rec["supplemental_source"] else ''}
    {f'<div class="field-row"><span class="field-label">关联原始记录</span><span class="field-value"><a href="/record/{_escape(rec["related_screenshot_id"])}">{_escape(rec["related_screenshot_id"])}</a></span></div>' if rec["related_screenshot_id"] else ''}
  </div>

  {f'''
  <div class="card" style="background: #e3f2fd; border: 1px solid #2196f3;">
    <h3 style="color: #1565c0; margin-bottom: 8px;">🔗 关联的旧口径补录记录</h3>
    {"".join([f'<div><a href="/record/{_escape(s["id"])}">{_escape(s["id"])}</a></div>' for s in detail["related_supplemented_records"]])}
  </div>
  ''' if detail["related_supplemented_records"] else ''}

  {pending_html}
  {history_html}
  {conflicts_html}

  <div class="footer-summary">
    {_escape(detail["report_summary"])}
  </div>
</div>
</body>
</html>
"""
    return body


class PulleyReviewWebServer(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        return

    def _send_html(self, content: str, status: int = 200) -> None:
        body = content.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_redirect(self, location: str) -> None:
        self.send_response(303)
        self.send_header("Location", location)
        self.end_headers()

    def _send_file(self, content: bytes, content_type: str, filename: str) -> None:
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header(
            "Content-Disposition",
            'attachment; filename="{}"'.format(filename),
        )
        self.end_headers()
        self.wfile.write(content)

    def _parse_post_form(self) -> dict[str, str]:
        ctype = self.headers.get("Content-Type", "")
        result: dict[str, str] = {}
        if "multipart/form-data" in ctype.lower():
            fs = cgi.FieldStorage(
                fp=self.rfile,
                headers=self.headers,
                environ={
                    "REQUEST_METHOD": "POST",
                    "CONTENT_TYPE": ctype,
                },
            )
            for key in fs.keys():
                val = fs.getvalue(key)
                if isinstance(val, bytes):
                    result[key] = val.decode("utf-8", errors="replace")
                else:
                    result[key] = str(val) if val is not None else ""
        else:
            length = int(self.headers.get("Content-Length", 0))
            if length > 0:
                raw = self.rfile.read(length).decode("utf-8", errors="replace")
                parsed = urllib.parse.parse_qs(raw, keep_blank_values=True)
                for k, v in parsed.items():
                    result[k] = v[0] if v else ""
        return result

    def do_GET(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/":
            sv = _workflow.build_summary_view()
            records = _workflow.build_records_list()
            self._send_html(_render_home(sv, records))
            return

        if path.startswith("/record/"):
            record_id = path[len("/record/"):]
            detail = _workflow.build_record_detail(record_id)
            self._send_html(_render_record_detail(detail, record_id))
            return

        self._send_html(
            f"<html><head><meta charset='UTF-8'><title>404</title></head>"
            f"<body><h1>404 Not Found</h1><p>{_escape(self.path)}</p></body></html>",
            status=404,
        )

    def do_POST(self) -> None:
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/import-sample-a":
            ss = make_webcalc_screenshot_a()
            _workflow.step1_import_screenshot(ss)
            self._send_redirect("/")
            return

        if path == "/import-sample-b":
            ss = make_webcalc_screenshot_b_mixed()
            _workflow.step1_import_screenshot(ss)
            self._send_redirect("/")
            return

        if path == "/supplement-old":
            old_note = make_old_caliber_note()
            related_record_id = None
            if _workflow.records:
                related_record_id = _workflow.records[0].id
            _workflow.step2_create_supplemented(old_note, "老岑", related_record_id)
            self._send_redirect("/")
            return

        if path == "/export-text":
            content = _workflow.export_handover_text().encode("utf-8")
            self._send_file(content, "text/plain; charset=utf-8", "handover.txt")
            return

        if path == "/export-json":
            content = _workflow.export_handover_json().encode("utf-8")
            self._send_file(content, "application/json; charset=utf-8", "handover.json")
            return

        if path == "/resolve-conflict":
            form = self._parse_post_form()
            try:
                idx = int(form.get("idx", "-1"))
            except ValueError:
                idx = -1
            action = form.get("action", "")
            note = form.get("note", "")
            if 0 <= idx < len(_workflow.conflicts):
                resolution = ConflictResolution.CONFIRMED if action == "confirm" else ConflictResolution.REJECTED
                _workflow.resolve_conflict(_workflow.conflicts[idx], resolution, "老岑", note)
            self._send_redirect("/")
            return

        self._send_redirect("/")


def run_server(port: int = 8765) -> None:
    with socketserver.TCPServer(("", port), PulleyReviewWebServer) as httpd:
        print("Pulley Review Web Calculator running at http://localhost:{}".format(port))
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    run_server()
