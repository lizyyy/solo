#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse

from core import (
    FactoringRepaymentStore,
    build_demo_store,
)

store: FactoringRepaymentStore = build_demo_store()

DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>保理回款认领 · 小看板</title>
<style>
  :root {
    --bg: #f5f6fa;
    --card: #ffffff;
    --border: #dcdde1;
    --primary: #2f3542;
    --accent: #3742fa;
    --warn: #ffa502;
    --ok: #2ed573;
    --muted: #747d8c;
    --tag-inconsistent: #ff6348;
    --tag-supplement: #1e90ff;
    --tag-smooth: #2ed573;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: var(--bg); color: var(--primary); padding: 20px; }
  h1 { font-size: 22px; font-weight: 600; margin-bottom: 6px; }
  .subtitle { color: var(--muted); font-size: 13px; margin-bottom: 20px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 16px; margin-bottom: 20px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; }
  .card h2 { font-size: 15px; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
  .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; color: #fff; }
  .tag-smooth { background: var(--tag-smooth); }
  .tag-inconsistent { background: var(--tag-inconsistent); }
  .tag-supplement { background: var(--tag-supplement); }
  .field { margin-bottom: 6px; font-size: 13px; }
  .field-label { color: var(--muted); margin-right: 4px; }
  .field-value { font-weight: 500; }
  .warn-text { color: var(--tag-inconsistent); font-weight: 600; }
  .actions { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
  button, .btn { padding: 6px 14px; border: 1px solid var(--border); border-radius: 6px; background: var(--card); font-size: 12px; cursor: pointer; transition: background .15s; }
  button:hover, .btn:hover { background: var(--bg); }
  .btn-primary { background: var(--accent); color: #fff; border-color: var(--accent); }
  .btn-primary:hover { opacity: .9; }
  .log-area { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 16px; font-family: "SF Mono", "Menlo", monospace; font-size: 12px; line-height: 1.6; max-height: 260px; overflow-y: auto; white-space: pre-wrap; }
  .summary-row { display: flex; gap: 24px; margin-bottom: 12px; }
  .summary-item { text-align: center; }
  .summary-num { font-size: 28px; font-weight: 700; }
  .summary-label { font-size: 12px; color: var(--muted); }
  .modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.35); z-index:10; justify-content:center; align-items:center; }
  .modal-overlay.active { display:flex; }
  .modal { background:var(--card); border-radius:10px; padding:24px; width:420px; max-width:90vw; box-shadow:0 8px 30px rgba(0,0,0,.12); }
  .modal h3 { margin-bottom:14px; font-size:16px; }
  .modal label { display:block; font-size:13px; color:var(--muted); margin-bottom:4px; margin-top:10px; }
  .modal input, .modal textarea { width:100%; padding:6px 10px; border:1px solid var(--border); border-radius:6px; font-size:13px; }
  .modal textarea { height:60px; resize:vertical; }
  .modal .actions { margin-top:16px; justify-content:flex-end; }
  .toast { position:fixed; top:20px; right:20px; padding:12px 20px; border-radius:8px; color:#fff; font-size:13px; z-index:20; opacity:0; transition:opacity .3s; }
  .toast.show { opacity:1; }
  .toast-ok { background:var(--ok); }
  .toast-warn { background:var(--warn); }
</style>
</head>
<body>

<h1>保理回款认领 · 小看板</h1>
<p class="subtitle">风控值班老秦和财务复核人的交接看板 · 机构简称前后不一致别急着归正常，留给财务复核人复核</p>

<div id="summary-area"></div>
<div id="cards-area" class="grid"></div>

<h2 style="font-size:15px;margin:16px 0 8px;">运行日志</h2>
<div id="log-area" class="log-area"></div>

<div class="actions" style="margin-top:16px;">
  <button class="btn-primary" onclick="resetDemo()">重置演示数据</button>
  <button onclick="refreshAll()">刷新</button>
</div>

<div id="custody-modal" class="modal-overlay">
  <div class="modal">
    <h3>审阅托管确认页</h3>
    <input type="hidden" id="cm-adj-id">
    <label>托管页机构简称</label>
    <input id="cm-custody-name" placeholder="如：中信保理">
    <label>确认金额</label>
    <input id="cm-amount" type="number" step="0.01">
    <label>确认日期</label>
    <input id="cm-date" type="date">
    <label>备注</label>
    <textarea id="cm-note"></textarea>
    <div class="actions">
      <button onclick="closeCustodyModal()">取消</button>
      <button class="btn-primary" onclick="submitCustody()">确认审阅</button>
    </div>
  </div>
</div>

<div id="supplement-modal" class="modal-overlay">
  <div class="modal">
    <h3>补录记录更新</h3>
    <input type="hidden" id="sm-adj-id">
    <input type="hidden" id="sm-custody-id">
    <label>更正后机构简称</label>
    <input id="sm-new-name" placeholder="如：远东宏信">
    <label>更正后金额</label>
    <input id="sm-amount" type="number" step="0.01">
    <label>补录原因</label>
    <textarea id="sm-reason"></textarea>
    <div class="actions">
      <button onclick="closeSupplementModal()">取消</button>
      <button class="btn-primary" onclick="submitSupplement()">确认补录</button>
    </div>
  </div>
</div>

<div id="toast" class="toast"></div>

<script>
function fmtStatus(s) {
  const m = { imported:"已导入", consistent:"简称一致·顺畅", inconsistent:"简称不一致·待复核", custody_reviewed:"托管已审阅", supplemented:"已补录", completed:"已完成" };
  return m[s] || s;
}
function fmtType(t) {
  const m = { smooth:"顺利", inconsistent_abbr:"简称不一致", old_standard_supplement:"旧口径补录" };
  return m[t] || t;
}
function tagClass(t) {
  const m = { smooth:"tag-smooth", inconsistent_abbr:"tag-inconsistent", old_standard_supplement:"tag-supplement" };
  return m[t] || "";
}

async function api(method, path, body) {
  const opts = { method, headers:{"Content-Type":"application/json"} };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  return r.json();
}

function showToast(msg, type="ok") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = "toast toast-" + type + " show";
  setTimeout(() => { t.className = "toast"; }, 2200);
}

async function refreshAll() {
  const [summary, adjs, logs] = await Promise.all([
    api("GET", "/api/summary"),
    api("GET", "/api/adjustments"),
    api("GET", "/api/log"),
  ]);
  renderSummary(summary);
  renderCards(adjs);
  document.getElementById("log-area").textContent = logs.join("\\n");
}

function renderSummary(s) {
  const byStatus = s.by_status || {};
  let html = '<div class="summary-row" style="margin-bottom:18px;">';
  html += '<div class="summary-item"><div class="summary-num">' + s.total_adjustments + '</div><div class="summary-label">尾差调整条</div></div>';
  html += '<div class="summary-item"><div class="summary-num">' + s.total_custody_confirmations + '</div><div class="summary-label">托管确认</div></div>';
  html += '<div class="summary-item"><div class="summary-num">' + s.total_supplement_records + '</div><div class="summary-label">补录记录</div></div>';
  for (const [k,v] of Object.entries(byStatus)) {
    html += '<div class="summary-item"><div class="summary-num">' + v + '</div><div class="summary-label">' + fmtStatus(k) + '</div></div>';
  }
  html += '</div>';
  document.getElementById("summary-area").innerHTML = html;
}

function renderCards(adjs) {
  let html = "";
  for (const a of adjs) {
    const mismatch = a.institution_short_name_imported !== a.institution_short_name_on_file;
    html += '<div class="card">';
    html += '<h2><span class="tag ' + tagClass(a.record_type) + '">' + fmtType(a.record_type) + '</span> ' + a.institution_full_name + '</h2>';
    html += '<div class="field"><span class="field-label">ID:</span><span class="field-value">' + a.id + '</span></div>';
    html += '<div class="field"><span class="field-label">导入简称:</span><span class="field-value">' + a.institution_short_name_imported + '</span></div>';
    html += '<div class="field"><span class="field-label">在册简称:</span><span class="field-value">' + a.institution_short_name_on_file + (mismatch ? ' <span class="warn-text">⚠ 不一致</span>' : '') + '</span></div>';
    html += '<div class="field"><span class="field-label">金额:</span><span class="field-value">' + Number(a.amount).toLocaleString("zh-CN", {minimumFractionDigits:2}) + '</span>';
    html += ' <span class="field-label">尾差:</span><span class="field-value">' + Number(a.diff_amount).toFixed(2) + '</span></div>';
    html += '<div class="field"><span class="field-label">状态:</span><span class="field-value">' + fmtStatus(a.status) + '</span></div>';
    html += '<div class="field"><span class="field-label">备注:</span><span class="field-value">' + a.note + '</span></div>';
    html += '<div class="actions">';

    if (!a.custody_confirmed) {
      html += '<button onclick="openCustodyModal(\\'' + a.id + '\\',\\'' + a.institution_short_name_on_file + '\\',' + a.amount + ')">审阅托管确认页</button>';
    }
    if (a.custody_confirmed && !a.supplement_applied && a.status === "custody_reviewed") {
      html += '<button onclick="openSupplementModal(\\'' + a.id + '\\')">补录更新</button>';
    }
    if (a.status === "inconsistent" || a.status === "custody_reviewed" || a.status === "supplemented") {
      if (!a.reviewed_by_finance) {
        html += '<button class="btn-primary" onclick="financeReview(\\'' + a.id + '\\')">财务复核通过</button>';
      }
    }
    if (a.supplement_applied) {
      html += '<button onclick="rerun(\\'' + a.id + '\\')">重跑</button>';
    }

    html += '</div></div>';
  }
  document.getElementById("cards-area").innerHTML = html;
}

function openCustodyModal(adjId, shortName, amount) {
  document.getElementById("cm-adj-id").value = adjId;
  document.getElementById("cm-custody-name").value = shortName;
  document.getElementById("cm-amount").value = amount;
  document.getElementById("cm-date").value = new Date().toISOString().slice(0,10);
  document.getElementById("cm-note").value = "";
  document.getElementById("custody-modal").classList.add("active");
}
function closeCustodyModal() { document.getElementById("custody-modal").classList.remove("active"); }

async function submitCustody() {
  const body = {
    adj_id: document.getElementById("cm-adj-id").value,
    custody_short_name: document.getElementById("cm-custody-name").value,
    confirmed_amount: parseFloat(document.getElementById("cm-amount").value),
    confirmed_date: document.getElementById("cm-date").value,
    note: document.getElementById("cm-note").value,
  };
  const r = await api("POST", "/api/custody", body);
  closeCustodyModal();
  if (r.ok) { showToast("托管确认页审阅完成"); refreshAll(); }
  else { showToast(r.error || "操作失败", "warn"); }
}

function openSupplementModal(adjId) {
  document.getElementById("sm-adj-id").value = adjId;
  document.getElementById("sm-custody-id").value = "";
  document.getElementById("sm-new-name").value = "";
  document.getElementById("sm-amount").value = "";
  document.getElementById("sm-reason").value = "";
  api("GET", "/api/adjustments/" + adjId).then(a => {
    const cc = (a.custody_confirmations || []).find(c => c.adjustment_id === adjId);
    if (cc) {
      document.getElementById("sm-custody-id").value = cc.id;
      document.getElementById("sm-new-name").value = cc.institution_short_name_custody;
      document.getElementById("sm-amount").value = cc.confirmed_amount;
    }
  });
  document.getElementById("supplement-modal").classList.add("active");
}
function closeSupplementModal() { document.getElementById("supplement-modal").classList.remove("active"); }

async function submitSupplement() {
  const body = {
    adj_id: document.getElementById("sm-adj-id").value,
    custody_id: document.getElementById("sm-custody-id").value,
    new_short_name: document.getElementById("sm-new-name").value,
    new_amount: parseFloat(document.getElementById("sm-amount").value),
    reason: document.getElementById("sm-reason").value,
  };
  const r = await api("POST", "/api/supplement", body);
  closeSupplementModal();
  if (r.ok) { showToast("补录更新完成"); refreshAll(); }
  else { showToast(r.error || "操作失败", "warn"); }
}

async function financeReview(adjId) {
  const r = await api("POST", "/api/finance-review/" + adjId);
  if (r.ok) { showToast("财务复核通过"); refreshAll(); }
  else { showToast(r.error || "操作失败", "warn"); }
}

async function rerun(adjId) {
  const r = await api("POST", "/api/rerun/" + adjId);
  if (r.ok) { showToast("重跑完成"); refreshAll(); }
  else { showToast(r.error || "操作失败", "warn"); }
}

async function resetDemo() {
  await api("POST", "/api/demo/reset");
  showToast("已重置为演示数据");
  refreshAll();
}

refreshAll();
</script>
</body>
</html>"""


class Handler(BaseHTTPRequestHandler):
    def _json_response(self, data, code=200):
        body = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length:
            return json.loads(self.rfile.read(length))
        return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/" or path == "/dashboard":
            html = DASHBOARD_HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.end_headers()
            self.wfile.write(html)
            return

        if path == "/api/adjustments":
            data = [a.to_dict() for a in store.adjustments]
            self._json_response(data)
            return

        if path.startswith("/api/adjustments/"):
            adj_id = path.split("/")[-1]
            adj = store.get_adjustment(adj_id)
            if adj is None:
                self._json_response({"ok": False, "error": "not found"}, 404)
                return
            custody_for_adj = [c.to_dict() for c in store.custody_confirmations if c.adjustment_id == adj_id]
            supp_for_adj = [s.to_dict() for s in store.supplement_records if s.adjustment_id == adj_id]
            result = adj.to_dict()
            result["custody_confirmations"] = custody_for_adj
            result["supplement_records"] = supp_for_adj
            self._json_response(result)
            return

        if path == "/api/log":
            self._json_response(store.get_run_log())
            return

        if path == "/api/summary":
            self._json_response(store.summary())
            return

        self._json_response({"ok": False, "error": "not found"}, 404)

    def do_POST(self):
        global store
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/adjustments/import":
            body = self._read_body()
            items = body if isinstance(body, list) else body.get("items", [])
            results = store.import_adjustments(items)
            self._json_response({"ok": True, "imported": [r.to_dict() for r in results]})
            return

        if path == "/api/custody":
            body = self._read_body()
            result = store.review_custody_confirmation(
                adj_id=body.get("adj_id", ""),
                custody_short_name=body.get("custody_short_name", ""),
                confirmed_amount=float(body.get("confirmed_amount", 0)),
                confirmed_date=body.get("confirmed_date", ""),
                note=body.get("note", ""),
            )
            if result is None:
                self._json_response({"ok": False, "error": "调整条不存在"}, 400)
                return
            cc, adj = result
            self._json_response({"ok": True, "custody_confirmation": cc.to_dict(), "adjustment": adj.to_dict()})
            return

        if path == "/api/supplement":
            body = self._read_body()
            result = store.apply_supplement(
                adj_id=body.get("adj_id", ""),
                custody_id=body.get("custody_id", ""),
                new_short_name=body.get("new_short_name", ""),
                new_amount=float(body.get("new_amount", 0)),
                reason=body.get("reason", ""),
            )
            if result is None:
                self._json_response({"ok": False, "error": "补录失败，请检查调整条ID和托管确认ID"}, 400)
                return
            sr, adj = result
            self._json_response({"ok": True, "supplement_record": sr.to_dict(), "adjustment": adj.to_dict()})
            return

        if path.startswith("/api/finance-review/"):
            adj_id = path.split("/")[-1]
            adj = store.finance_review(adj_id)
            if adj is None:
                self._json_response({"ok": False, "error": "财务复核失败，状态不满足条件"}, 400)
                return
            self._json_response({"ok": True, "adjustment": adj.to_dict()})
            return

        if path.startswith("/api/rerun/"):
            adj_id = path.split("/")[-1]
            adj = store.rerun(adj_id)
            if adj is None:
                self._json_response({"ok": False, "error": "调整条不存在"}, 404)
                return
            self._json_response({"ok": True, "adjustment": adj.to_dict()})
            return

        if path == "/api/demo/reset":
            store = build_demo_store()
            self._json_response({"ok": True, "message": "已重置为演示数据"})
            return

        self._json_response({"ok": False, "error": "not found"}, 404)

    def log_message(self, format, *args):
        pass


def main():
    port = int(os.environ.get("PORT", "8080"))
    server = HTTPServer(("0.0.0.0", port), Handler)
    print(f"保理回款认领 · 小看板已启动 → http://localhost:{port}")
    print("风控值班老秦和财务复核人的交接看板")
    server.serve_forever()


if __name__ == "__main__":
    main()
