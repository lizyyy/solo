import os, sys, socket, json, csv
from datetime import datetime
from io import StringIO
from flask import Flask, render_template_string, request, jsonify, send_file, redirect

sys.path.insert(0, os.path.dirname(__file__))
from drift_system import (
    init_db, get_db, DataAccessor, ImportService, AdjustmentService,
    SelfCheckService, ExportService, ReportService, STATUS_LABEL,
)

app = Flask(__name__)
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
    return 5080


TH = """<!DOCTYPE html><html><head><meta charset="utf-8"><title>情绪漂移</title>
<style>
body{font-family:sans-serif;background:#f5f7fa;margin:0;padding:0}
.hd{background:#409eff;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}
.hd h1{font-size:16px;margin:0}
.hd a{color:#fff;margin-left:12px;text-decoration:none;font-size:13px}
.ct{max-width:1000px;margin:0 auto;padding:16px}
.card{background:#fff;border-radius:6px;padding:16px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.06)}
.card h2{font-size:14px;margin:0 0 10px 0;padding-bottom:8px;border-bottom:1px solid #eee}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#f5f7fa;color:#888;text-align:left;padding:6px 8px;border-bottom:1px solid #eee}
td{padding:6px 8px;border-bottom:1px solid #eee}
.tag{padding:1px 6px;border-radius:3px;font-size:11px}
.red{background:#fef0f0;color:#f56c6c}.blue{background:#ecf5ff;color:#409eff}
.green{background:#f0f9eb;color:#67c23a}.orange{background:#fdf6ec;color:#e6a23c}
.btn{padding:4px 10px;border-radius:3px;border:1px solid #ddd;background:#fff;color:#666;text-decoration:none;font-size:12px}
.btnp{background:#409eff;color:#fff;border-color:#409eff}
.sg{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-bottom:10px}
.si{background:#f5f7fa;padding:10px;border-radius:4px;text-align:center}
.sn{font-size:20px;font-weight:700;color:#409eff}.sl{font-size:11px;color:#999}
.bg{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:10px}
.bi{background:#f5f7fa;padding:10px;border-radius:4px;text-align:center}
.bl{font-size:11px;color:#999}.bn{font-size:18px;font-weight:700}
.ov{background:#f56c6c;color:#fff;padding:1px 4px;border-radius:2px;font-size:10px;margin-left:4px}
.al{padding:8px 12px;border-radius:4px;margin-bottom:8px;font-size:12px}
.as{background:#f0f9eb;color:#67c23a;border:1px solid #e1f3d8}
.ae{background:#fef0f0;color:#f56c6c;border:1px solid #fde2e2}
.aw{background:#fdf6ec;color:#e6a23c;border:1px solid #faecd8}
pre{background:#f5f7fa;padding:8px;border-radius:4px;font-size:11px;overflow-x:auto}
.dg{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.ds h3{font-size:12px;color:#999;margin:0 0 6px 0}.ds p{font-size:12px;margin:2px 0}
.empty{text-align:center;padding:24px;color:#999;font-size:13px}
</style></head><body>
<div class="hd"><h1>门店评论情绪漂移</h1>
<div><a href="/">报告</a><a href="/records">明细</a><a href="/import">导入</a><a href="/export">导出</a><a href="/self-check">自检</a><a href="/batches">批次</a></div>
</div><div class="ct">
"""
TF = "</div></body></html>"


def rp(c):
    return render_template_string(TH + c + TF)


def _bd(batch_id=None):
    conn = get_db()
    if batch_id:
        bs = conn.execute("SELECT * FROM import_batches WHERE id=? ORDER BY import_time DESC", (batch_id,)).fetchall()
    else:
        bs = conn.execute("SELECT * FROM import_batches ORDER BY import_time DESC LIMIT 10").fetchall()
    tn=th=tc=tf=0
    for b in bs:
        bd=dict(b); bid=bd["id"]; bt=bd.get("batch_type","")
        if bt=="annotator":
            fh=bd.get("import_hash")
            if fh:
                hn=conn.execute("SELECT COUNT(*) c FROM import_batches WHERE import_hash=? AND id<?",(fh,bid)).fetchone()["c"]
                if hn>0: tf+=bd.get("record_count",0)
            ars=conn.execute("SELECT comment_id,original_line_no FROM annotator_comments WHERE batch_id=?",(bid,)).fetchall()
            seen=set(); nc=hc=cc=0
            for ar in ars:
                k=ar["comment_id"]+"#"+str(ar["original_line_no"])
                if k in seen: cc+=1
                seen.add(k)
                he=conn.execute("SELECT COUNT(*) c FROM annotator_comments WHERE comment_id=? AND original_line_no=? AND batch_id<?",(ar["comment_id"],ar["original_line_no"],bid)).fetchone()["c"]
                if he>0: hc+=1
                else: nc+=1
            tn+=nc; th+=hc; tc+=cc
    conn.close()
    return {"total_new":tn,"total_history_dup":th,"total_current_dup":tc,"total_file_dup":tf}


init_db()

if __name__ == "__main__":
    port = find_free_port()
    print("=" * 50)
    print("门店评论情绪漂移系统")
    print("http://127.0.0.1:" + str(port))
    print("=" * 50)
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
