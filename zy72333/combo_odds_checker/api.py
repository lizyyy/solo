from __future__ import annotations

import json
from datetime import datetime

from combo_odds_checker.models import OldFormulaScreenshot
from combo_odds_checker.workflow import WorkflowEngine

engine = WorkflowEngine()

try:
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import HTMLResponse
    from pydantic import BaseModel
except ImportError:
    raise ImportError("请安装 fastapi 和 pydantic：pip install fastapi uvicorn")

app = FastAPI(title="组合数抽奖赔率核对", version="0.1.0")


class ImportRequest(BaseModel):
    table_id: str = "TBL-001"
    rows: list[dict]
    source: str = "api"


class ScreenshotRequest(BaseModel):
    screenshot_id: str
    description: str = ""
    image_ref: str = ""
    category: str
    uploaded_by: str = "教研负责人吴老师"


class CorrectionRequest(BaseModel):
    sample_id: str
    new_value: float
    reason: str
    corrected_by: str = "教研负责人吴老师"


@app.post("/api/import")
def api_import(req: ImportRequest):
    table = engine.step1_import_table(req.table_id, req.rows, req.source)
    flagged = [e for e in table.entries if e.old_table_treats_as_missing]
    return {
        "table_id": table.table_id,
        "total_entries": len(table.entries),
        "negative_as_missing": len(flagged),
        "flagged_categories": [e.category for e in flagged],
        "report": engine.get_human_report(),
    }


@app.post("/api/screenshot")
def api_screenshot(req: ScreenshotRequest):
    if engine.table is None:
        raise HTTPException(400, "请先导入评分权重表")
    ss = OldFormulaScreenshot(
        screenshot_id=req.screenshot_id,
        description=req.description,
        image_ref=req.image_ref,
        related_category=req.category,
        uploaded_by=req.uploaded_by,
    )
    engine.step2_add_screenshot(ss)
    report = engine.step3_update_report_after_screenshot()
    return {
        "screenshot_id": ss.screenshot_id,
        "report": engine.get_human_report(),
        "pending_ta": report.pending_ta_count,
        "negative_as_missing": report.negative_as_missing_count,
    }


@app.get("/api/report")
def api_report():
    if engine.report is None:
        return {"report": "尚未导入评分权重表，无法生成报告。", "samples": []}
    samples = []
    for s in engine.report.samples:
        samples.append({
            "sample_id": s.sample_id,
            "status": s.status.value,
            "category": s.entry.category,
            "raw_value": s.entry.raw_value,
            "reason_kept": s.reason_kept,
            "missing_materials": s.missing_materials,
            "next_contact": s.next_contact.value,
            "linked_screenshots": s.linked_screenshots,
        })
    return {
        "report": engine.get_human_report(),
        "summary": engine.report.summary,
        "samples": samples,
        "stats": {
            "total": len(samples),
            "pending_ta": engine.report.pending_ta_count,
            "negative_as_missing": engine.report.negative_as_missing_count,
            "corrected": engine.report.corrected_count,
        },
    }


@app.post("/api/correct")
def api_correct(req: CorrectionRequest):
    if engine.report is None:
        raise HTTPException(400, "请先导入评分权重表")
    correction = engine.apply_manual_correction(
        sample_id=req.sample_id,
        new_value=req.new_value,
        reason=req.reason,
        corrected_by=req.corrected_by,
    )
    rerun = engine.rerun()
    return {
        "correction_id": correction.correction_id,
        "old_value": correction.old_value,
        "new_value": correction.new_value,
        "rerun_id": rerun.rerun_id,
        "report": engine.get_human_report(),
    }


@app.get("/api/demo-load")
def api_demo_load():
    from combo_odds_checker.demo_data import DEMO_WEIGHT_ROWS
    engine.step1_import_table("demo-table-001", DEMO_WEIGHT_ROWS)
    return {"message": "演示数据已加载", "table_id": "demo-table-001"}


@app.get("/", response_class=HTMLResponse)
def dashboard():
    return DASHBOARD_HTML


DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>组合数抽奖赔率核对 — 小看板</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #f5f7fa; color: #333; padding: 24px; }
  h1 { font-size: 22px; margin-bottom: 6px; }
  .subtitle { color: #888; font-size: 14px; margin-bottom: 20px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .card { background: #fff; border-radius: 10px; padding: 18px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .card .label { font-size: 13px; color: #888; }
  .card .value { font-size: 28px; font-weight: 700; margin-top: 4px; }
  .card.warn .value { color: #e67e22; }
  .card.ok .value { color: #27ae60; }
  .card.info .value { color: #2980b9; }
  .section { background: #fff; border-radius: 10px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,.08); margin-bottom: 20px; }
  .section h2 { font-size: 16px; margin-bottom: 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
  .btn { display: inline-block; padding: 8px 18px; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; margin-right: 8px; margin-bottom: 8px; }
  .btn-primary { background: #2980b9; color: #fff; }
  .btn-primary:hover { background: #2471a3; }
  .btn-warn { background: #e67e22; color: #fff; }
  .btn-warn:hover { background: #d35400; }
  .btn-ok { background: #27ae60; color: #fff; }
  .btn-ok:hover { background: #1e8449; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid #eee; }
  th { color: #888; font-weight: 500; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
  .badge-danger { background: #fde8e8; color: #c0392b; }
  .badge-warn { background: #fef3e2; color: #e67e22; }
  .badge-ok { background: #e8f8f0; color: #27ae60; }
  .report-box { background: #fafafa; border: 1px solid #eee; border-radius: 6px; padding: 16px; white-space: pre-wrap; font-family: monospace; font-size: 13px; max-height: 400px; overflow-y: auto; line-height: 1.6; }
  .actions { margin-bottom: 16px; }
  input, textarea { padding: 6px 10px; border: 1px solid #ccc; border-radius: 4px; font-size: 13px; margin-right: 8px; margin-bottom: 6px; }
</style>
</head>
<body>
  <h1>组合数抽奖赔率核对</h1>
  <p class="subtitle">负数样本被旧表当成缺失？一目了然。</p>

  <div class="cards" id="stats-cards">
    <div class="card info"><div class="label">总边界样本</div><div class="value" id="stat-total">—</div></div>
    <div class="card warn"><div class="label">负数被当缺失</div><div class="value" id="stat-neg-missing">—</div></div>
    <div class="card warn"><div class="label">待学生助教复核</div><div class="value" id="stat-pending-ta">—</div></div>
    <div class="card ok"><div class="label">已修正</div><div class="value" id="stat-corrected">—</div></div>
  </div>

  <div class="section">
    <h2>操作</h2>
    <div class="actions">
      <button class="btn btn-primary" onclick="loadDemo()">加载演示数据</button>
      <button class="btn btn-primary" onclick="refreshReport()">刷新报告</button>
    </div>
    <div class="actions">
      <input id="ss-id" placeholder="截图ID" />
      <input id="ss-category" placeholder="关联类别" />
      <input id="ss-desc" placeholder="截图说明" />
      <button class="btn btn-warn" onclick="addScreenshot()">补录旧公式截图</button>
    </div>
    <div class="actions">
      <input id="cor-sample" placeholder="样本编号 (如 S-001)" />
      <input id="cor-value" type="number" placeholder="修正值" />
      <input id="cor-reason" placeholder="修正原因" />
      <button class="btn btn-ok" onclick="applyCorrection()">人工修正 + 重跑</button>
    </div>
  </div>

  <div class="section">
    <h2>边界样本列表</h2>
    <table>
      <thead>
        <tr><th>编号</th><th>状态</th><th>类别</th><th>原始值</th><th>保留原因</th><th>缺材料</th><th>下一步</th><th>关联截图</th></tr>
      </thead>
      <tbody id="sample-tbody"></tbody>
    </table>
  </div>

  <div class="section">
    <h2>完整报告</h2>
    <div class="report-box" id="full-report">点击「加载演示数据」或「刷新报告」查看。</div>
  </div>

<script>
const BASE = '';

async function api(method, path, body) {
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  return res.json();
}

function badgeClass(status) {
  if (status === 'negative_treated_as_missing') return 'badge-danger';
  if (status === 'pending_ta_review') return 'badge-warn';
  if (status === 'corrected') return 'badge-ok';
  return '';
}
function badgeText(status) {
  const m = { negative_treated_as_missing: '负数被当缺失', pending_ta_review: '待助教复核', corrected: '已修正', normal: '正常' };
  return m[status] || status;
}

function renderSamples(samples) {
  const tbody = document.getElementById('sample-tbody');
  tbody.innerHTML = '';
  samples.forEach(s => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${s.sample_id}</td>
      <td><span class="badge ${badgeClass(s.status)}">${badgeText(s.status)}</span></td>
      <td>${s.category}</td>
      <td>${s.raw_value}</td>
      <td style="max-width:260px">${s.reason_kept}</td>
      <td>${s.missing_materials.join('；') || '无'}</td>
      <td>${s.next_contact}</td>
      <td>${s.linked_screenshots.join(', ') || '—'}</td>`;
    tbody.appendChild(tr);
  });
}

function renderStats(stats) {
  document.getElementById('stat-total').textContent = stats.total;
  document.getElementById('stat-neg-missing').textContent = stats.negative_as_missing;
  document.getElementById('stat-pending-ta').textContent = stats.pending_ta;
  document.getElementById('stat-corrected').textContent = stats.corrected;
}

async function refreshReport() {
  const data = await api('GET', '/api/report');
  if (data.samples) {
    renderSamples(data.samples);
    renderStats(data.stats);
  }
  document.getElementById('full-report').textContent = data.report || '暂无';
}

async function loadDemo() {
  await api('GET', '/api/demo-load');
  await refreshReport();
}

async function addScreenshot() {
  const sid = document.getElementById('ss-id').value;
  const cat = document.getElementById('ss-category').value;
  const desc = document.getElementById('ss-desc').value;
  if (!sid || !cat) { alert('请填写截图ID和关联类别'); return; }
  await api('POST', '/api/screenshot', { screenshot_id: sid, category: cat, description: desc });
  await refreshReport();
}

async function applyCorrection() {
  const sid = document.getElementById('cor-sample').value;
  const val = parseFloat(document.getElementById('cor-value').value);
  const reason = document.getElementById('cor-reason').value;
  if (!sid || isNaN(val) || !reason) { alert('请填写样本编号、修正值和原因'); return; }
  await api('POST', '/api/correct', { sample_id: sid, new_value: val, reason: reason });
  await refreshReport();
}
</script>
</body>
</html>"""
