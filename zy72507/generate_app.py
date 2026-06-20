import os

APP_CONTENT = r'''import os, sys, socket, json, csv
from datetime import datetime
from io import StringIO
from flask import Flask, render_template_string, request, jsonify, send_file, redirect

sys.path.insert(0, os.path.dirname(__file__))
from drift_system import (
    init_db, get_db, DataAccessor, ImportService, AdjustmentService,
    SelfCheckService, ExportService, ReportService, STATUS_LABEL,
)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024
EXPORTS_DIR = os.path.join(os.path.dirname(__file__), "exports")
os.makedirs(EXPORTS_DIR, exist_ok=True)


def find_free_port():
    for p in range(5000, 5100):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(("127.0.0.1", p))
            s.close()
            return p
        except OSError:
            s.close()
            continue
    return 5080


TPL_HEAD = """<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>门店评论情绪漂移</title>
<style>
body{font-family:sans-serif;background:#f5f7fa;margin:0;padding:0}
.hd{background:#409eff;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}
.hd h1{font-size:16px;margin:0}
.hd a{color:#fff;margin-left:12px;text-decoration:none;font-size:13px}
.ct{max-width:1200px;margin:0 auto;padding:16px}
.card{background:#fff;border-radius:6px;padding:16px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
.card h2{font-size:16px;margin:0 0 12px 0;color:#333}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:16px}
.stat{background:#fff;border-radius:6px;padding:16px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.1)}
.stat .num{font-size:28px;font-weight:bold;color:#409eff}
.stat .label{font-size:13px;color:#666;margin-top:4px}
.stat.new .num{color:#67c23a}
.stat.history .num{color:#e6a23c}
.stat.current .num{color:#f56c6c}
.stat.file .num{color:#909399}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #eee}
th{background:#fafafa;font-weight:600}
tr:hover{background:#f9f9f9}
.btn{display:inline-block;padding:6px 14px;background:#409eff;color:#fff;border:none;border-radius:4px;cursor:pointer;text-decoration:none;font-size:13px}
.btn:hover{background:#66b1ff}
.btn.success{background:#67c23a}
.btn.warning{background:#e6a23c}
.btn.danger{background:#f56c6c}
.btn.small{padding:3px 8px;font-size:12px}
.form-group{margin-bottom:12px}
.form-group label{display:block;margin-bottom:4px;font-size:13px;color:#333}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:6px 10px;border:1px solid #dcdfe6;border-radius:4px;font-size:13px;box-sizing:border-box}
.form-row{display:flex;gap:12px}
.form-row .form-group{flex:1}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;background:#ecf5ff;color:#409eff}
.badge.pending{background:#f4f4f5;color:#909399}
.badge.drift{background:#fef0f0;color:#f56c6c}
.badge.adjusted{background:#fdf6ec;color:#e6a23c}
.badge.reviewed{background:#f0f9eb;color:#67c23a}
.badge.overridden{background:#fef0f0;color:#f56c6c}
.tabs{margin-bottom:16px;border-bottom:2px solid #eee}
.tabs a{display:inline-block;padding:8px 16px;margin-right:8px;text-decoration:none;color:#666;font-size:14px;border-bottom:2px solid transparent;margin-bottom:-2px}
.tabs a.active{color:#409eff;border-bottom-color:#409eff}
.alert{padding:12px 16px;border-radius:4px;margin-bottom:16px}
.alert.success{background:#f0f9eb;color:#67c23a;border:1px solid #e1f3d8}
.alert.warning{background:#fdf6ec;color:#e6a23c;border:1px solid #faecd8}
.alert.error{background:#fef0f0;color:#f56c6c;border:1px solid #fde2e2}
.alert.info{background:#ecf5ff;color:#409eff;border:1px solid #d9ecff}
.detail-section{margin-bottom:20px}
.detail-section h3{font-size:14px;color:#333;margin:0 0 8px 0;padding-bottom:6px;border-bottom:1px solid #eee}
.trace-item{background:#f9f9f9;padding:12px;border-radius:4px;margin-bottom:8px;font-size:13px}
.trace-item .meta{color:#909399;font-size:12px;margin-bottom:4px}
.filter-bar{display:flex;gap:12px;margin-bottom:16px;align-items:flex-end}
.filter-bar .form-group{margin-bottom:0}
.file-list{list-style:none;padding:0;margin:0}
.file-list li{display:flex;justify-content:space-between;align-items:center;padding:10px;background:#f9f9f9;border-radius:4px;margin-bottom:6px}
.file-list .actions a{margin-left:8px}
.preview-box{background:#fff;border:1px solid #eee;border-radius:4px;padding:12px;max-height:400px;overflow:auto;font-family:monospace;font-size:12px;white-space:pre-wrap}
</style></head><body>
<div class="hd"><h1>门店评论情绪漂移</h1>
<div><a href="/">报告</a><a href="/records">明细</a><a href="/import">导入</a><a href="/export">导出</a><a href="/self-check">自检</a><a href="/batches">批次</a></div>
</div><div class="ct">
"""

TPL_FOOT = "</div></body></html>"


def render_page(content):
    return render_template_string(TPL_HEAD + content + TPL_FOOT)


def _breakdown(batch_id=None):
    conn = get_db()
    sql = "SELECT * FROM import_batches "
    if batch_id:
        sql += "WHERE id = ? ORDER BY import_time DESC"
        batches = conn.execute(sql, (batch_id,)).fetchall()
    else:
        sql += "ORDER BY import_time DESC LIMIT 10"
        batches = conn.execute(sql).fetchall()
    tn = th = tc = tf = 0
    for b in batches:
        bd = dict(b)
        bid = bd["id"]
        bt = bd.get("batch_type", "")
        if bt == "annotator":
            fh = bd.get("import_hash")
            if fh:
                hn = conn.execute("SELECT COUNT(*) as cnt FROM import_batches WHERE import_hash = ? AND id < ?", (fh, bid)).fetchone()["cnt"]
                if hn > 0:
                    fc = bd.get("record_count", 0)
                    tf += fc
            arecs = conn.execute("SELECT comment_id, original_line_no FROM annotator_comments WHERE batch_id = ?", (bid,)).fetchall()
            seen = set()
            nc = hc = cc = 0
            for ar in arecs:
                key = ar["comment_id"] + "#" + str(ar["original_line_no"])
                if key in seen:
                    cc += 1
                else:
                    seen.add(key)
                he = conn.execute("SELECT COUNT(*) as cnt FROM annotator_comments ac WHERE ac.comment_id = ? AND ac.original_line_no = ? AND ac.batch_id < ?", (ar["comment_id"], ar["original_line_no"], bid)).fetchone()["cnt"]
                if he > 0:
                    hc += 1
                else:
                    nc += 1
            tn += nc
            th += hc
            tc += cc
    conn.close()
    return {"total_new": tn, "total_history_dup": th, "total_current_dup": tc, "total_file_dup": tf}


@app.route("/")
def index():
    report = ReportService.generate_report()
    breakdown = _breakdown()
    status_rows = ""
    total = report["summary"]["total_records"]
    for info in report["status_distribution"].values():
        pct = round(info["count"] / total * 100, 1) if total > 0 else 0
        status_rows += "<tr><td><span class='badge'>{}</span></td><td>{}</td><td>{}%</td></tr>".format(info["label"], info["count"], pct)
    store_rows = ""
    for r in report["store_distribution"]:
        store_rows += "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}%</td></tr>".format(r["store_id"], r["cnt"], r["drift_cnt"] or 0, r["drift_rate"])
    batch_rows = ""
    for b in report["import_batches_recent"]:
        btype = "标注员留言" if b["batch_type"] == "annotator" else "模型输出"
        batch_rows += "<tr><td>#{}<a href='/api/import-breakdown?batch_id={}' target='_blank' style='margin-left:6px;font-size:12px'>明细</a></td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>".format(
            b["id"], b["id"], btype, b["source_file"] or "-", b["import_time"], b["record_count"] or 0, b["duplicate_count"] or 0)
    content = """
    <h2 style="margin-top:0">数据概览</h2>
    <div class="grid">
        <div class="stat"><div class="num">{total}</div><div class="label">总记录数</div></div>
        <div class="stat"><div class="num" style="color:#f56c6c">{drift}</div><div class="label">情绪漂移 ({drift_rate}%)</div></div>
        <div class="stat"><div class="num" style="color:#e6a23c">{adjusted}</div><div class="label">已人工改判</div></div>
        <div class="stat"><div class="num" style="color:#f56c6c">{overridden}</div><div class="label">待安全审核</div></div>
        <div class="stat"><div class="num" style="color:#67c23a">{reviewed}</div><div class="label">已安全复核</div></div>
    </div>

    <h2>四类重复统计</h2>
    <div class="grid">
        <div class="stat new"><div class="num">{bn}</div><div class="label">新记录</div></div>
        <div class="stat history"><div class="num">{bh}</div><div class="label">历史批次重复</div></div>
        <div class="stat current"><div class="num">{bc}</div><div class="label">本批次内重复</div></div>
        <div class="stat file"><div class="num">{bf}</div><div class="label">同文件Hash重复</div></div>
    </div>

    <div class="card">
        <h2>状态分布</h2>
        <table>
            <tr><th>状态</th><th>数量</th><th>比例</th></tr>
            {status_rows}
        </table>
    </div>

    <div class="card">
        <h2>门店分布</h2>
        <table>
            <tr><th>门店ID</th><th>总评论数</th><th>漂移数</th><th>漂移率</th></tr>
            {store_rows}
        </table>
    </div>

    <div class="card">
        <h2>最近导入批次</h2>
        <table>
            <tr><th>批次ID</th><th>类型</th><th>源文件</th><th>导入时间</th><th>记录数</th><th>重复数</th></tr>
            {batch_rows}
        </table>
    </div>
    """.format(
        total=report["summary"]["total_records"],
        drift=report["summary"]["drift_count"],
        drift_rate=report["summary"]["drift_rate"],
        adjusted=report["summary"]["manual_adjusted_count"],
        overridden=report["summary"]["overridden_pending_count"],
        reviewed=report["summary"]["reviewed_count"],
        bn=breakdown["total_new"],
        bh=breakdown["total_history_dup"],
        bc=breakdown["total_current_dup"],
        bf=breakdown["total_file_dup"],
        status_rows=status_rows,
        store_rows=store_rows,
        batch_rows=batch_rows
    )
    return render_page(content)


@app.route("/records")
def records():
    status = request.args.get("status", "")
    store_id = request.args.get("store_id", "")
    all_records = DataAccessor.list_records(status=status if status else None, store_id=store_id if store_id else None)
    conn = get_db()
    stores = conn.execute("SELECT DISTINCT store_id FROM sentiment_drift_records WHERE store_id IS NOT NULL ORDER BY store_id").fetchall()
    conn.close()
    status_options = ""
    for code, label in STATUS_LABEL.items():
        sel = "selected" if status == code else ""
        status_options += "<option value='{}' {}>{}</option>".format(code, sel, label)
    store_options = ""
    for s in stores:
        sel = "selected" if store_id == s["store_id"] else ""
        store_options += "<option value='{}' {}>{}</option>".format(s["store_id"], sel, s["store_id"])
    rows = ""
    if all_records:
        for r in all_records:
            badge_cls = "pending"
            if r["status"] == "drift_detected":
                badge_cls = "drift"
            elif r["status"] == "manually_adjusted":
                badge_cls = "adjusted"
            elif r["status"] == "adjustment_overridden":
                badge_cls = "overridden"
            elif r["status"] == "reviewed":
                badge_cls = "reviewed"
            rows += "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td><span class='badge {}'>{}</span></td><td>{}</td><td><a href='/record/{}' class='btn small'>详情</a></td></tr>".format(
                r["comment_id"], r["store_id"] or "-", r["annotator_sentiment"] or "-", r["model_sentiment"] or "-",
                badge_cls, r["status_label"], r["updated_at"], r["comment_id"])
    else:
        rows = "<tr><td colspan='7' style='text-align:center;color:#999;padding:20px'>暂无数据</td></tr>"
    content = """
    <h2 style="margin-top:0">明细列表</h2>
    <div class="filter-bar">
        <div class="form-group">
            <label>状态筛选</label>
            <select onchange="location.href='/records?status='+this.value+'&store_id='+document.getElementById('store_select').value">
                <option value="">全部</option>
                {status_options}
            </select>
        </div>
        <div class="form-group">
            <label>门店筛选</label>
            <select id="store_select" onchange="location.href='/records?status='+document.querySelector('select').value+'&store_id='+this.value">
                <option value="">全部</option>
                {store_options}
            </select>
        </div>
        <div class="form-group">
            <label>&nbsp;</label>
            <a href="/records" class="btn">重置</a>
        </div>
    </div>
    <div class="card">
        <table>
            <tr><th>评论ID</th><th>门店</th><th>标注情绪</th><th>模型情绪</th><th>状态</th><th>更新时间</th><th>操作</th></tr>
            {rows}
        </table>
    </div>
    """.format(status_options=status_options, store_options=store_options, rows=rows)
    return render_page(content)


@app.route("/record/<comment_id>")
def record_detail(comment_id):
    r = DataAccessor.get_record_by_comment_id(comment_id)
    if not r:
        return render_page("<div class='alert error'>记录不存在: {}</div>".format(comment_id))
    adj_rows = ""
    if r["adjustments"]:
        for a in r["adjustments"]:
            adj_rows += "<div class='trace-item'><div class='meta'>{} 由 {} 改判 · 是否被覆盖: {}</div><div>{} → {}<br>备注: {}</div></div>".format(
                a["adjusted_at"], a["adjusted_by"], a["overridden_label"], a["old_sentiment"], a["new_sentiment"], a.get("note") or "-")
    else:
        adj_rows = "<div style='color:#999'>暂无改判记录</div>"
    hist_rows = ""
    if r["history"]:
        for h in r["history"]:
            hist_rows += "<div class='trace-item'><div class='meta'>{} 由 {}</div><div>{} → {}<br>原因: {}</div></div>".format(
                h["changed_at"], h["changed_by"], h["old_status_label"], h["new_status_label"], h.get("reason") or "-")
    else:
        hist_rows = "<div style='color:#999'>暂无状态变更</div>"
    review_section = ""
    if r["status"] == "adjustment_overridden":
        review_section = """
        <hr style="margin:20px 0;border:0;border-top:1px solid #eee">
        <div class="form-row">
            <div class="form-group">
                <label>最终情绪</label>
                <select id="final_sentiment">
                    <option value="positive">正面</option>
                    <option value="negative">负面</option>
                    <option value="neutral">中性</option>
                </select>
            </div>
            <div class="form-group">
                <label>复核人</label>
                <input type="text" id="reviewed_by" placeholder="输入复核人">
            </div>
            <div class="form-group">
                <label>&nbsp;</label>
                <button class="btn success" onclick="doReview()">安全审核复核</button>
            </div>
        </div>
        """
    content = """
    <h2 style="margin-top:0">记录详情 - {comment_id}</h2>
    <div class="card">
        <h2>基本信息</h2>
        <table>
            <tr><th>评论ID</th><td>{comment_id}</td><th>门店</th><td>{store_id}</td></tr>
            <tr><th>当前状态</th><td><span class='badge'>{status_label}</span></td><th>是否漂移</th><td>{drift}</td></tr>
            <tr><th>原始情绪</th><td>{orig}</td><th>当前情绪</th><td>{curr}</td></tr>
            <tr><th>创建时间</th><td>{created}</td><th>更新时间</th><td>{updated}</td></tr>
        </table>
    </div>

    <div class="card">
        <h2>标注员留言</h2>
        <table>
            <tr><th>行号</th><td>{line_no}</td><th>批次ID</th><td>{ann_batch}</td></tr>
            <tr><th>源文件</th><td>{ann_file}</td><th>导入时间</th><td>{ann_time}</td></tr>
            <tr><th>标注情绪</th><td colspan='3'>{ann_sent}</td></tr>
            <tr><th>留言内容</th><td colspan='3' style='white-space:pre-wrap'>{ann_content}</td></tr>
        </table>
    </div>

    <div class="card">
        <h2>模型输出</h2>
        <table>
            <tr><th>模型版本</th><td>{model_ver}</td><th>置信度</th><td>{conf}</td></tr>
            <tr><th>批次ID</th><td>{model_batch}</td><th>导入时间</th><td>{model_time}</td></tr>
            <tr><th>模型情绪</th><td colspan='3'>{model_sent}</td></tr>
            <tr><th>片段文本</th><td colspan='3' style='white-space:pre-wrap'>{frag}</td></tr>
        </table>
    </div>

    <div class="card">
        <h2>人工改判历史</h2>
        {adj_rows}
    </div>

    <div class="card">
        <h2>状态变更历史</h2>
        {hist_rows}
    </div>

    <div class="card">
        <h2>操作</h2>
        <div class="form-row">
            <div class="form-group">
                <label>改判为</label>
                <select id="new_sentiment">
                    <option value="positive">正面</option>
                    <option value="negative">负面</option>
                    <option value="neutral">中性</option>
                </select>
            </div>
            <div class="form-group">
                <label>操作人</label>
                <input type="text" id="adjusted_by" placeholder="输入操作人">
            </div>
            <div class="form-group">
                <label>备注</label>
                <input type="text" id="note" placeholder="选填">
            </div>
            <div class="form-group">
                <label>&nbsp;</label>
                <button class="btn warning" onclick="doAdjust()">人工改判</button>
            </div>
        </div>
        {review_section}
    </div>

    <script>
    function doAdjust() {{
        var ns = document.getElementById('new_sentiment').value;
        var by = document.getElementById('adjusted_by').value;
        var note = document.getElementById('note').value;
        if (!by) {{ alert('请输入操作人'); return; }}
        fetch('/api/adjust', {{
            method: 'POST',
            headers: {{'Content-Type': 'application/json'}},
            body: JSON.stringify({{record_id: {rid}, new_sentiment: ns, adjusted_by: by, note: note}})
        }}).then(r=>r.json()).then(d=>{{ alert(d.message); if(d.success) location.reload(); }});
    }}
    function doReview() {{
        var fs = document.getElementById('final_sentiment').value;
        var by = document.getElementById('reviewed_by').value;
        if (!by) {{ alert('请输入操作人'); return; }}
        fetch('/api/review', {{
            method: 'POST',
            headers: {{'Content-Type': 'application/json'}},
            body: JSON.stringify({{record_id: {rid}, reviewed_by: by, final_sentiment: fs}})
        }}).then(r=>r.json()).then(d=>{{ alert(d.message); if(d.success) location.reload(); }});
    }}
    </script>
    """.format(
        comment_id=r["comment_id"], rid=r["id"], store_id=r.get("store_id") or "-",
        status_label=r["status_label"], drift="是" if r.get("drift_detected") else "否",
        orig=r.get("original_sentiment") or "-", curr=r.get("current_sentiment") or "-",
        created=r.get("created_at") or "-", updated=r.get("updated_at") or "-",
        line_no=r.get("original_line_no") or "-", ann_batch=r.get("annotator_batch_id") or "-",
        ann_file=r.get("annotator_source_file") or "-", ann_time=r.get("annotator_import_time") or "-",
        ann_sent=r.get("annotator_sentiment") or "-", ann_content=r.get("annotator_content") or "-",
        model_ver=r.get("model_version") or "-", conf=r.get("confidence") or "-",
        model_batch=r.get("model_batch_id") or "-", model_time=r.get("model_import_time") or "-",
        model_sent=r.get("model_sentiment") or "-", frag=r.get("fragment_text") or "-",
        adj_rows=adj_rows, hist_rows=hist_rows, review_section=review_section
    )
    return render_page(content)


@app.route("/import")
def import_page():
    status_options = ""
    for code, label in STATUS_LABEL.items():
        status_options += "<option value='{}'>{}</option>".format(code, label)
    content = """
    <h2 style="margin-top:0">数据导入</h2>
    <div class="alert info">
        <strong>导入说明：</strong>支持 CSV/JSON 格式。标注员留言需包含：store_id, comment_id, content, sentiment_label；模型输出需包含：comment_id, fragment_text, sentiment_pred。
    </div>

    <div class="card">
        <h2>导入样例数据</h2>
        <p>一键导入预设的样例数据用于测试</p>
        <a href="/import-sample" class="btn success">导入样例数据</a>
    </div>

    <div class="card">
        <h2>导入标注员留言</h2>
        <form id="form_annotator" enctype="multipart/form-data">
            <div class="form-group">
                <label>选择文件 (CSV/JSON)</label>
                <input type="file" name="file" accept=".csv,.json" required>
            </div>
            <button type="submit" class="btn">上传标注数据</button>
        </form>
    </div>

    <div class="card">
        <h2>导入模型输出</h2>
        <form id="form_model" enctype="multipart/form-data">
            <div class="form-group">
                <label>选择文件 (CSV/JSON)</label>
                <input type="file" name="file" accept=".csv,.json" required>
            </div>
            <button type="submit" class="btn">上传模型数据</button>
        </form>
    </div>

    <div class="card">
        <h2>导入结果</h2>
        <div id="import_result" style="white-space:pre-wrap;font-family:monospace;font-size:13px">等待导入...</div>
    </div>

    <script>
    function handleImport(formId, apiUrl) {
        document.getElementById(formId).addEventListener('submit', function(e) {
            e.preventDefault();
            var formData = new FormData(this);
            document.getElementById('import_result').textContent = '导入中...';
            fetch(apiUrl, {method: 'POST', body: formData})
            .then(r=>r.json())
            .then(d=>{
                document.getElementById('import_result').textContent = JSON.stringify(d, null, 2);
            });
        });
    }
    handleImport('form_annotator', '/api/import/annotator');
    handleImport('form_model', '/api/import/model');
    </script>
    """
    return render_page(content)


@app.route("/import-sample")
def import_sample():
    sample_annotator = [
        {"store_id": "S001", "comment_id": "C001", "content": "这家店味道真不错，服务也很好！", "sentiment_label": "positive"},
        {"store_id": "S001", "comment_id": "C002", "content": "上菜太慢了，等了一个小时。", "sentiment_label": "negative"},
        {"store_id": "S002", "comment_id": "C003", "content": "环境一般，味道还可以。", "sentiment_label": "neutral"},
        {"store_id": "S002", "comment_id": "C004", "content": "非常推荐，性价比很高！", "sentiment_label": "positive"},
    ]
    sample_model = [
        {"comment_id": "C001", "fragment_text": "味道真不错，服务也很好", "sentiment_pred": "positive", "model_version": "v1.0", "confidence": 0.95},
        {"comment_id": "C002", "fragment_text": "上菜太慢了，等了一个小时", "sentiment_pred": "neutral", "model_version": "v1.0", "confidence": 0.72},
        {"comment_id": "C003", "fragment_text": "环境一般，味道还可以", "sentiment_pred": "negative", "model_version": "v1.0", "confidence": 0.68},
        {"comment_id": "C004", "fragment_text": "非常推荐，性价比很高", "sentiment_pred": "positive", "model_version": "v1.0", "confidence": 0.91},
    ]
    r1 = ImportService.import_annotator_comments(sample_annotator, "sample_annotator")
    r2 = ImportService.import_model_outputs(sample_model, "sample_model")
    return redirect("/import")


@app.route("/export")
def export_page():
    files = []
    if os.path.exists(EXPORTS_DIR):
        files = sorted(os.listdir(EXPORTS_DIR), reverse=True)
    status_options = ""
    for code, label in STATUS_LABEL.items():
        status_options += "<option value='{}'>{}</option>".format(code, label)
    file_rows = ""
    if files:
        for f in files:
            if f.endswith('.csv'):
                file_rows += "<li><span>{}</span><span class='actions'><a href='/exports/preview/{}' class='btn small'>预览</a><a href='/exports/{}' class='btn small'>下载</a></span></li>".format(f, f, f)
    else:
        file_rows = "<li><span style='color:#999'>暂无导出文件</span><span></span></li>"
    content = """
    <h2 style="margin-top:0">数据导出</h2>
    <div class="card">
        <h2>导出操作</h2>
        <div class="form-row">
            <div class="form-group">
                <label>状态筛选</label>
                <select id="exp_status">
                    <option value="">全部</option>
                    {status_options}
                </select>
            </div>
            <div class="form-group">
                <label>门店筛选</label>
                <input type="text" id="exp_store" placeholder="选填，门店ID">
            </div>
            <div class="form-group">
                <label>&nbsp;</label>
                <button class="btn" onclick="exportDetails()">导出明细数据</button>
            </div>
        </div>
        <div style="margin-top:12px">
            <button class="btn warning" onclick="exportOverridden()">导出被覆盖人工改判溯源</button>
        </div>
    </div>

    <div class="card">
        <h2>已导出文件</h2>
        <ul class="file-list">
            {file_rows}
        </ul>
    </div>

    <div id="export_result" style="margin-top:16px"></div>

    <script>
    function exportDetails() {
        var s = document.getElementById('exp_status').value;
        var st = document.getElementById('exp_store').value;
        document.getElementById('export_result').innerHTML = '<div class="alert info">导出中...</div>';
        fetch('/api/export/details', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({status: s || null, store_id: st || null})
        }).then(r=>r.json()).then(d=>{
            if (d.success) {
                document.getElementById('export_result').innerHTML = '<div class="alert success">导出成功，共 ' + d.count + ' 条记录</div>';
                setTimeout(()=>location.reload(), 1000);
            } else {
                document.getElementById('export_result').innerHTML = '<div class="alert error">导出失败</div>';
            }
        });
    }
    function exportOverridden() {
        document.getElementById('export_result').innerHTML = '<div class="alert info">导出中...</div>';
        fetch('/api/export/overridden-trace', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'})
        .then(r=>r.json()).then(d=>{
            if (d.success) {
                document.getElementById('export_result').innerHTML = '<div class="alert success">导出成功，共 ' + d.count + ' 条记录</div>';
                setTimeout(()=>location.reload(), 1000);
            } else {
                document.getElementById('export_result').innerHTML = '<div class="alert error">导出失败</div>';
            }
        });
    }
    </script>
    """.format(status_options=status_options, file_rows=file_rows)
    return render_page(content)


@app.route("/exports/<filename>")
def download_export(filename):
    filepath = os.path.join(EXPORTS_DIR, filename)
    if not os.path.exists(filepath):
        return "File not found", 404
    return send_file(filepath, as_attachment=True, download_name=filename)


@app.route("/exports/preview/<filename>")
def preview_export(filename):
    filepath = os.path.join(EXPORTS_DIR, filename)
    if not os.path.exists(filepath):
        return render_page("<div class='alert error'>文件不存在</div>")
    with open(filepath, "r", encoding="utf-8-sig") as f:
        content_preview = f.read()
    content = """
    <h2 style="margin-top:0">文件预览 - {}</h2>
    <div class="card">
        <p><a href="/export" class="btn small">返回导出页</a> <a href="/exports/{}" class="btn small">下载</a></p>
        <div class="preview-box">{}</div>
    </div>
    """.format(filename, filename, content_preview)
    return render_page(content)


@app.route("/self-check")
def self_check():
    checks = SelfCheckService.run_all_checks()
    logs = DataAccessor.list_self_check_logs(20)
    check_rows = ""
    for c in checks:
        badge_cls = "reviewed" if c["status"] == "passed" else "overridden"
        details = json.dumps({k: v for k, v in c.items() if k not in ("check", "check_label", "status", "status_label")}, ensure_ascii=False, indent=2)
        check_rows += "<div class='trace-item'><div class='meta'>{} <span class='badge {}'>{}</span></div><div><pre>{}</pre></div></div>".format(c["check_label"], badge_cls, c["status_label"], details)
    log_rows = ""
    if logs:
        for l in logs:
            badge_cls = "reviewed" if l["status"] == "passed" else "overridden"
            log_rows += "<tr><td>{}</td><td><span class='badge {}'>{}</span></td><td>{}</td><td style='max-width:300px;overflow:hidden;text-overflow:ellipsis'>{}</td></tr>".format(
                l["check_type"], badge_cls, l["status"], l["checked_at"], l["details"] or "-")
    else:
        log_rows = "<tr><td colspan='4' style='text-align:center;color:#999;padding:20px'>暂无日志</td></tr>"
    content = """
    <h2 style="margin-top:0">系统自检</h2>
    <div class="card">
        <h2>自检项目 <button class="btn small" onclick="runChecks()" style="float:right">重新运行</button></h2>
        {check_rows}
    </div>
    <div class="card">
        <h2>自检日志</h2>
        <table>
            <tr><th>检查类型</th><th>状态</th><th>时间</th><th>详情</th></tr>
            {log_rows}
        </table>
    </div>
    <script>
    function runChecks() {
        fetch('/api/self-check/run', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'})
        .then(r=>r.json()).then(d=>{
            alert('自检完成');
            location.reload();
        });
    }
    </script>
    """.format(check_rows=check_rows, log_rows=log_rows)
    return render_page(content)


@app.route("/batches")
def batches():
    all_batches = DataAccessor.list_batches()
    rows = ""
    if all_batches:
        for b in all_batches:
            hash_short = (b.get("import_hash") or "")[:16] + "..."
            rows += "<tr><td>#{}<a href='/api/import-breakdown?batch_id={}' target='_blank' style='margin-left:6px;font-size:12px'>明细</a></td><td><span class='badge'>{}</span></td><td>{}</td><td>{}</td><td>{}</td><td>{}</td><td style='font-family:monospace;font-size:11px;color:#999'>{}</td><td><button class='btn small' onclick=\\\"rerunBatch({})\\\">批跑重算</button></td></tr>".format(
                b["id"], b["id"], b["batch_type_label"], b["source_file"] or "-", b["import_time"],
                b["record_count"] or 0, b["duplicate_count"] or 0, hash_short, b["id"])
    else:
        rows = "<tr><td colspan='8' style='text-align:center;color:#999;padding:20px'>暂无批次</td></tr>"
    content = """
    <h2 style="margin-top:0">批次列表</h2>
    <div class="card">
        <table>
            <tr><th>批次ID</th><th>类型</th><th>源文件</th><th>导入时间</th><th>记录数</th><th>重复数</th><th>Hash</th><th>操作</th></tr>
            {rows}
        </table>
    </div>
    <script>
    function rerunBatch(batchId) {
        if (!confirm('确定要对该批次执行批跑重算吗？')) return;
        fetch('/api/batch-rerun', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({batch_id: batchId, run_by: 'operator', comment_ids: [], new_sentiments: {}})
        }).then(r=>r.json()).then(d=>{ alert(d.message); location.reload(); });
    }
    </script>
    """.format(rows=rows)
    return render_page(content)


@app.route("/api/records")
def api_records():
    status = request.args.get("status")
    store_id = request.args.get("store_id")
    records = DataAccessor.list_records(status=status, store_id=store_id)
    return jsonify({"count": len(records), "records": records})


@app.route("/api/record/<comment_id>")
def api_record(comment_id):
    r = DataAccessor.get_record_by_comment_id(comment_id)
    if not r:
        return jsonify({"error": "not found"}), 404
    return jsonify(r)


@app.route("/api/report")
def api_report():
    batch_id = request.args.get("batch_id", type=int)
    report = ReportService.generate_report(batch_id=batch_id)
    breakdown = _breakdown(batch_id=batch_id)
    report["breakdown"] = breakdown
    return jsonify(report)


@app.route("/api/self-check")
def api_self_check():
    checks = SelfCheckService.run_all_checks()
    return jsonify({"checks": checks})


@app.route("/api/self-check/run", methods=["POST"])
def api_self_check_run():
    checks = SelfCheckService.run_all_checks()
    return jsonify({"success": True, "checks": checks})


@app.route("/api/import/annotator", methods=["POST"])
def api_import_annotator():
    file = request.files.get("file")
    if not file:
        return jsonify({"success": False, "message": "未选择文件"})
    filename = file.filename
    content = file.read().decode("utf-8-sig")
    if filename.endswith(".csv"):
        reader = csv.DictReader(StringIO(content))
        rows = list(reader)
    elif filename.endswith(".json"):
        rows = json.loads(content)
    else:
        return jsonify({"success": False, "message": "不支持的文件格式"})
    result = ImportService.import_annotator_comments(rows, filename)
    return jsonify(result)


@app.route("/api/import/model", methods=["POST"])
def api_import_model():
    file = request.files.get("file")
    if not file:
        return jsonify({"success": False, "message": "未选择文件"})
    filename = file.filename
    content = file.read().decode("utf-8-sig")
    if filename.endswith(".csv"):
        reader = csv.DictReader(StringIO(content))
        rows = list(reader)
    elif filename.endswith(".json"):
        rows = json.loads(content)
    else:
        return jsonify({"success": False, "message": "不支持的文件格式"})
    result = ImportService.import_model_outputs(rows, filename)
    return jsonify(result)


@app.route("/api/adjust", methods=["POST"])
def api_adjust():
    data = request.get_json()
    record_id = data.get("record_id")
    new_sentiment = data.get("new_sentiment")
    adjusted_by = data.get("adjusted_by")
    note = data.get("note")
    if not all([record_id, new_sentiment, adjusted_by]):
        return jsonify({"success": False, "message": "参数缺失"})
    result = AdjustmentService.manual_adjust(record_id, new_sentiment, adjusted_by, note)
    return jsonify(result)


@app.route("/api/batch-rerun", methods=["POST"])
def api_batch_rerun():
    data = request.get_json()
    comment_ids = data.get("comment_ids", [])
    new_sentiments = data.get("new_sentiments", {})
    run_by = data.get("run_by", "system")
    if not comment_ids:
        conn = get_db()
        rows = conn.execute("SELECT comment_id, current_sentiment FROM sentiment_drift_records").fetchall()
        conn.close()
        comment_ids = [r["comment_id"] for r in rows]
        new_sentiments = {r["comment_id"]: r["current_sentiment"] for r in rows}
    result = AdjustmentService.batch_rerun(comment_ids, new_sentiments, run_by)
    return jsonify(result)


@app.route("/api/review", methods=["POST"])
def api_review():
    data = request.get_json()
    record_id = data.get("record_id")
    reviewed_by = data.get("reviewed_by")
    final_sentiment = data.get("final_sentiment")
    if not all([record_id, reviewed_by, final_sentiment]):
        return jsonify({"success": False, "message": "参数缺失"})
    result = AdjustmentService.review_overridden(record_id, reviewed_by, final_sentiment)
    return jsonify(result)


@app.route("/api/export/details", methods=["POST"])
def api_export_details():
    data = request.get_json() or {}
    status = data.get("status")
    store_id = data.get("store_id")
    filename = "details_{}_{}.csv".format(datetime.now().strftime("%Y%m%d_%H%M%S"), status or "all")
    filepath = os.path.join(EXPORTS_DIR, filename)
    result = ExportService.export_details(filepath, status=status, store_id=store_id)
    return jsonify(result)


@app.route("/api/export/overridden-trace", methods=["POST"])
def api_export_overridden_trace():
    filename = "overridden_trace_{}.csv".format(datetime.now().strftime("%Y%m%d_%H%M%S"))
    filepath = os.path.join(EXPORTS_DIR, filename)
    result = ExportService.export_overridden_trace(filepath)
    return jsonify(result)


@app.route("/api/import-breakdown")
def api_import_breakdown():
    batch_id = request.args.get("batch_id", type=int)
    breakdown = _breakdown(batch_id=batch_id)
    return jsonify(breakdown)


@app.route("/api/recompute", methods=["POST"])
def api_recompute():
    conn = get_db()
    rows = conn.execute("SELECT id, comment_id, original_sentiment, current_sentiment, status FROM sentiment_drift_records").fetchall()
    updated = 0
    for r in rows:
        if r["original_sentiment"] and r["current_sentiment"] and r["original_sentiment"] != r["current_sentiment"]:
            conn.execute("UPDATE sentiment_drift_records SET drift_detected = 1 WHERE id = ?", (r["id"],))
            updated += 1
    conn.commit()
    conn.close()
    return jsonify({"success": True, "updated": updated})


init_db()

if __name__ == "__main__":
    port = find_free_port()
    print("Starting server on http://127.0.0.1:{}".format(port))
    app.run(host="127.0.0.1", port=port, debug=False)
'''

with open('/Users/lzy/pro/solo/workspaces/zy72507/app.py', 'w') as f:
    f.write(APP_CONTENT)

print("File written successfully")
print("Total lines:", len(APP_CONTENT.split('\n')))
