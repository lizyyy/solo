import os
import json
import sqlite3
import csv
import io
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_file, g

app = Flask(__name__)
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "pipeline_review.db")

FORMULA_LIBRARY = {
    "pressure_loss": {
        "name": "管路压力损失",
        "expr": "lambda f, L, D, rho, v: f * (L/D) * (rho * v**2 / 2)",
        "units": {"f": "无量纲(摩擦系数)", "L": "m(管长)", "D": "m(管径)", "rho": "kg/m³(密度)", "v": "m/s(流速)"},
        "boundary": {"f": [0.01, 0.1], "L": [1, 5000], "D": [0.01, 2], "rho": [0.5, 2000], "v": [0.1, 30]},
        "description": "Darcy-Weisbach 方程，用于计算沿程压力损失"
    },
    "flow_rate": {
        "name": "体积流量",
        "expr": "lambda A, v: A * v",
        "units": {"A": "m²(截面积)", "v": "m/s(流速)"},
        "boundary": {"A": [0.0001, 10], "v": [0.01, 50]},
        "description": "Q = A × v，截面积乘以平均流速"
    },
    "pump_head": {
        "name": "泵扬程",
        "expr": "lambda P2, P1, rho, g, hL: (P2-P1)/(rho*g) + hL",
        "units": {"P2": "Pa(出口压)", "P1": "Pa(入口压)", "rho": "kg/m³", "g": "m/s²", "hL": "m(损失)"},
        "boundary": {"P2": [0, 1e8], "P1": [0, 1e8], "rho": [500, 2000], "g": [9.7, 9.9], "hL": [0, 500]},
        "description": "泵需要提供的总扬程"
    }
}

STATUS_LABELS = {
    "confirmed": {"text": "已确认", "color": "#16a34a"},
    "pending_parts": {"text": "待补件", "color": "#d97706"},
    "returned": {"text": "退回", "color": "#dc2626"}
}

def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()

def init_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.executescript("""
    CREATE TABLE IF NOT EXISTS handover_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shift_date TEXT NOT NULL,
        shift_name TEXT NOT NULL,
        operator TEXT NOT NULL,
        pipeline_id TEXT NOT NULL,
        line_section TEXT,
        status TEXT DEFAULT 'pending_parts',
        remark_later TEXT,
        created_at TEXT,
        updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS record_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        version_no INTEGER NOT NULL,
        snapshot_json TEXT NOT NULL,
        screenshot_ref TEXT,
        change_note TEXT,
        changed_by TEXT,
        changed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        formula_key TEXT NOT NULL,
        inputs_json TEXT NOT NULL,
        result REAL,
        unit TEXT,
        out_of_bound TEXT
    );
    CREATE TABLE IF NOT EXISTS photo_attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_id INTEGER NOT NULL,
        photo_ref TEXT NOT NULL,
        photo_taken_at TEXT,
        record_timestamp TEXT,
        time_shift_sec INTEGER,
        is_anomaly INTEGER DEFAULT 0,
        note TEXT
    );
    """)
    conn.commit()
    c.execute("SELECT COUNT(*) FROM handover_records")
    if c.fetchone()[0] == 0:
        seed_demo_data(conn)
    conn.close()

def seed_demo_data(conn):
    c = conn.cursor()
    shifts = [
        ("2026-06-07", "早班", "张师傅", "PL-A01", "北区主管廊1段", "confirmed", "交接后补充：焊缝位置确认无误"),
        ("2026-06-07", "中班", "李师傅", "PL-A01", "北区主管廊2段", "pending_parts", "3#阀门填料函备件申请已提交，采购单号PO-0607-14，预计3天到货"),
        ("2026-06-07", "夜班", "王师傅", "PL-B03", "南区回流管", "returned", "压力读数异常，退回重测"),
        ("2026-06-08", "早班", "赵师傅", "PL-A01", "北区主管廊2段", "confirmed", "补录：2号仪表校准证书已归档"),
        ("2026-06-08", "中班", "钱师傅", "PL-C02", "西区进料管", "pending_parts", None),
        ("2026-06-08", "夜班", "孙师傅", "PL-B03", "南区回流管", "confirmed", "已复核中班退回记录"),
        ("2026-06-09", "早班", "周师傅", "PL-A01", "北区主管廊3段", "pending_parts", None),
    ]
    now = datetime.now()
    for i, (sd, sn, op, pid, sec, st, rm) in enumerate(shifts):
        ca = (now - timedelta(days=2-i)).isoformat(timespec="seconds")
        c.execute(
            "INSERT INTO handover_records(shift_date,shift_name,operator,pipeline_id,line_section,status,remark_later,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)",
            (sd, sn, op, pid, sec, st, rm, ca, ca)
        )
        rec_id = c.lastrowid
        v1_snap = json.dumps({"shift_date": sd, "shift_name": sn, "operator": op, "status": "pending_parts", "remark_later": None})
        c.execute(
            "INSERT INTO record_versions(record_id,version_no,snapshot_json,change_note,changed_by,changed_at) VALUES(?,?,?,?,?,?)",
            (rec_id, 1, v1_snap, "初始录入", op, ca)
        )
        if st != "pending_parts" or rm:
            v2_snap = json.dumps({"shift_date": sd, "shift_name": sn, "operator": op, "status": st, "remark_later": rm})
            c.execute(
                "INSERT INTO record_versions(record_id,version_no,snapshot_json,screenshot_ref,change_note,changed_by,changed_at) VALUES(?,?,?,?,?,?,?)",
                (rec_id, 2, v2_snap, f"/static/materials/screenshots/v2_rec{rec_id}.svg" if i % 2 else None,
                 "状态更新/补录备注" if rm else "复核状态变更", "老何", (now - timedelta(days=1-i, hours=3)).isoformat(timespec="seconds"))
            )
        formulas_use = [("pressure_loss", {"f":0.035,"L":1200+i*50,"D":0.3,"rho":998,"v":2.1+i*0.05}),
                        ("flow_rate", {"A":0.0707,"v":2.1+i*0.05})]
        for fk, inp in formulas_use:
            info = FORMULA_LIBRARY[fk]
            fn = eval(info["expr"])
            res = round(fn(**inp), 4)
            oob = []
            for k, v in inp.items():
                lo, hi = info["boundary"][k]
                if v < lo or v > hi:
                    oob.append(f"{k}={v}")
            unit_map = {"pressure_loss": "Pa", "flow_rate": "m³/s", "pump_head": "m"}
            c.execute(
                "INSERT INTO measurements(record_id,formula_key,inputs_json,result,unit,out_of_bound) VALUES(?,?,?,?,?,?)",
                (rec_id, fk, json.dumps(inp), res, unit_map[fk], ",".join(oob) if oob else None)
            )
        photos = [
            (f"photo_{rec_id}_1.jpg", (now - timedelta(days=2-i, hours=6)).isoformat(timespec="seconds"), ca, 0),
            (f"photo_{rec_id}_2.jpg", (now - timedelta(days=5-i, hours=2)).isoformat(timespec="seconds"), ca, 1),
        ]
        for pref, pta, rts, is_an in photos:
            p_dt = datetime.fromisoformat(pta)
            r_dt = datetime.fromisoformat(rts)
            tshift = int((r_dt - p_dt).total_seconds())
            c.execute(
                "INSERT INTO photo_attachments(record_id,photo_ref,photo_taken_at,record_timestamp,time_shift_sec,is_anomaly,note) VALUES(?,?,?,?,?,?,?)",
                (rec_id, pref, pta, rts, tshift, is_an, "照片拍摄时间与记录日期间隔超过48h" if is_an else None)
            )
    conn.commit()

@app.route("/")
def index():
    return render_template("index.html", formula_lib=FORMULA_LIBRARY, status_labels=STATUS_LABELS)

@app.route("/api/records")
def list_records():
    db = get_db()
    status = request.args.get("status")
    pipeline = request.args.get("pipeline_id")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    anomaly = request.args.get("anomaly")
    sql = "SELECT DISTINCT r.* FROM handover_records r"
    wh = []
    params = []
    if anomaly == "1":
        sql += " JOIN photo_attachments pa ON pa.record_id = r.id"
        wh.append("pa.is_anomaly = 1")
    if status:
        wh.append("r.status = ?")
        params.append(status)
    if pipeline:
        wh.append("r.pipeline_id = ?")
        params.append(pipeline)
    if date_from:
        wh.append("r.shift_date >= ?")
        params.append(date_from)
    if date_to:
        wh.append("r.shift_date <= ?")
        params.append(date_to)
    if wh:
        sql += " WHERE " + " AND ".join(wh)
    sql += " ORDER BY r.shift_date DESC, r.id DESC"
    rows = db.execute(sql, params).fetchall()
    result = []
    for r in rows:
        d = dict(r)
        d["measurements"] = [dict(m) for m in db.execute(
            "SELECT * FROM measurements WHERE record_id=?", (r["id"],)).fetchall()]
        for m in d["measurements"]:
            m["inputs"] = json.loads(m["inputs_json"])
        d["photos"] = [dict(p) for p in db.execute(
            "SELECT * FROM photo_attachments WHERE record_id=?", (r["id"],)).fetchall()]
        vs = db.execute(
            "SELECT COUNT(*) c, MAX(CASE WHEN screenshot_ref IS NOT NULL THEN 1 ELSE 0 END) hs FROM record_versions WHERE record_id=?",
            (r["id"],)).fetchone()
        d["version_count"] = vs["c"]
        d["has_screenshot"] = bool(vs["hs"])
        result.append(d)
    return jsonify(result)

@app.route("/api/records/<int:rid>/versions")
def record_versions(rid):
    db = get_db()
    rows = db.execute(
        "SELECT * FROM record_versions WHERE record_id=? ORDER BY version_no",
        (rid,)).fetchall()
    vs = []
    for r in rows:
        d = dict(r)
        d["snapshot"] = json.loads(d["snapshot_json"])
        vs.append(d)
    return jsonify(vs)

@app.route("/api/formulas")
def list_formulas():
    return jsonify(FORMULA_LIBRARY)

@app.route("/api/pipelines")
def list_pipelines():
    db = get_db()
    rows = db.execute("SELECT DISTINCT pipeline_id FROM handover_records ORDER BY pipeline_id").fetchall()
    return jsonify([r["pipeline_id"] for r in rows])

@app.route("/api/records/<int:rid>/status", methods=["POST"])
def update_status(rid):
    db = get_db()
    body = request.get_json(force=True)
    new_status = body.get("status")
    note = body.get("change_note", "状态更新")
    who = body.get("changed_by", "老何")
    if new_status not in STATUS_LABELS:
        return jsonify({"error": "非法状态"}), 400
    cur = db.execute("SELECT * FROM handover_records WHERE id=?", (rid,)).fetchone()
    if not cur:
        return jsonify({"error": "记录不存在"}), 404
    now = datetime.now().isoformat(timespec="seconds")
    snap = {k: cur[k] for k in cur.keys()}
    snap["status"] = new_status
    max_v = db.execute("SELECT MAX(version_no) v FROM record_versions WHERE record_id=?", (rid,)).fetchone()["v"] or 0
    db.execute(
        "INSERT INTO record_versions(record_id,version_no,snapshot_json,change_note,changed_by,changed_at) VALUES(?,?,?,?,?,?)",
        (rid, max_v+1, json.dumps(snap), note, who, now)
    )
    db.execute("UPDATE handover_records SET status=?, updated_at=? WHERE id=?", (new_status, now, rid))
    db.commit()
    return jsonify({"ok": True})

@app.route("/api/export")
def export_records():
    status = request.args.get("status")
    pipeline = request.args.get("pipeline_id")
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    anomaly = request.args.get("anomaly")
    db = get_db()
    sql = "SELECT DISTINCT r.* FROM handover_records r"
    wh = []
    params = []
    if anomaly == "1":
        sql += " JOIN photo_attachments pa ON pa.record_id = r.id"
        wh.append("pa.is_anomaly = 1")
    if status:
        wh.append("r.status = ?")
        params.append(status)
    if pipeline:
        wh.append("r.pipeline_id = ?")
        params.append(pipeline)
    if date_from:
        wh.append("r.shift_date >= ?")
        params.append(date_from)
    if date_to:
        wh.append("r.shift_date <= ?")
        params.append(date_to)
    if wh:
        sql += " WHERE " + " AND ".join(wh)
    sql += " ORDER BY r.shift_date DESC, r.id DESC"
    rows = db.execute(sql, params).fetchall()

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["记录ID", "交接日期", "班次", "操作员", "管线编号", "管段", "状态", "补录备注",
                "使用公式", "输入值", "结果", "单位", "边界值告警",
                "历史版本数", "照片数", "异常照片数", "创建时间", "更新时间"])
    for r in rows:
        ms = db.execute("SELECT * FROM measurements WHERE record_id=?", (r["id"],)).fetchall()
        ps = db.execute("SELECT COUNT(*) c, SUM(is_anomaly) a FROM photo_attachments WHERE record_id=?", (r["id"],)).fetchone()
        vc = db.execute("SELECT COUNT(*) c FROM record_versions WHERE record_id=?", (r["id"],)).fetchone()["c"]
        if ms:
            for m in ms:
                inp = json.loads(m["inputs_json"])
                fi = FORMULA_LIBRARY.get(m["formula_key"], {})
                w.writerow([r["id"], r["shift_date"], r["shift_name"], r["operator"], r["pipeline_id"],
                            r["line_section"], STATUS_LABELS.get(r["status"], {}).get("text", r["status"]),
                            r["remark_later"] or "",
                            fi.get("name", m["formula_key"]),
                            json.dumps(inp, ensure_ascii=False),
                            m["result"], m["unit"], m["out_of_bound"] or "",
                            vc, ps["c"] or 0, ps["a"] or 0, r["created_at"], r["updated_at"]])
        else:
            w.writerow([r["id"], r["shift_date"], r["shift_name"], r["operator"], r["pipeline_id"],
                        r["line_section"], STATUS_LABELS.get(r["status"], {}).get("text", r["status"]),
                        r["remark_later"] or "", "", "", "", "", vc, ps["c"] or 0, ps["a"] or 0,
                        r["created_at"], r["updated_at"]])

    buf.seek(0)
    out = io.BytesIO(buf.getvalue().encode("utf-8-sig"))
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    return send_file(out, mimetype="text/csv;charset=utf-8",
                     as_attachment=True, download_name=f"管线报告复核_{ts}.csv")

@app.route("/api/export/timeline/<int:rid>")
def export_timeline(rid):
    db = get_db()
    vs = db.execute("SELECT * FROM record_versions WHERE record_id=? ORDER BY version_no", (rid,)).fetchall()
    if not vs:
        return jsonify({"error": "无记录"}), 404
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["版本号", "变更人", "变更时间", "变更说明", "截图", "快照内容"])
    for v in vs:
        w.writerow([v["version_no"], v["changed_by"], v["changed_at"], v["change_note"],
                    v["screenshot_ref"] or "", v["snapshot_json"]])
    buf.seek(0)
    out = io.BytesIO(buf.getvalue().encode("utf-8-sig"))
    return send_file(out, mimetype="text/csv;charset=utf-8",
                     as_attachment=True, download_name=f"记录{rid}_历史时间线.csv")

if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5009, debug=True)
