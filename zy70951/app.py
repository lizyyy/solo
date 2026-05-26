import csv
import hashlib
import io
import json
import os
import sqlite3
from datetime import datetime
from flask import Flask, g, jsonify, request, Response

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "settlement.db")

app = Flask(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no TEXT UNIQUE NOT NULL,
    submitter TEXT NOT NULL,
    content_hash TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'processed',
    remark TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS addons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    onsite_price REAL NOT NULL DEFAULT 0,
    settle_price REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    coupon_code TEXT NOT NULL,
    patient_name TEXT NOT NULL,
    onsite_amount REAL NOT NULL DEFAULT 0,
    settle_amount REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS unit_bills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    patient_name TEXT NOT NULL,
    onsite_total REAL NOT NULL DEFAULT 0,
    settle_total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE TABLE IF NOT EXISTS handlers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    handler TEXT NOT NULL,
    handled_at TEXT NOT NULL,
    note TEXT,
    FOREIGN KEY (batch_id) REFERENCES batches(id)
);

CREATE INDEX IF NOT EXISTS idx_addons_batch ON addons(batch_id);
CREATE INDEX IF NOT EXISTS idx_coupons_batch ON coupons(batch_id);
CREATE INDEX IF NOT EXISTS idx_unit_bills_batch ON unit_bills(batch_id);
CREATE INDEX IF NOT EXISTS idx_handlers_batch ON handlers(batch_id);
"""


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA)
    conn.commit()
    conn.close()


def now_iso():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def compute_content_hash(payload):
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def next_batch_no(db):
    row = db.execute("SELECT MAX(id) AS m FROM batches").fetchone()
    seq = (row["m"] or 0) + 1
    return f"B{datetime.now().strftime('%Y%m%d')}{seq:04d}"


def find_batch_by_hash(db, content_hash):
    row = db.execute("SELECT * FROM batches WHERE content_hash = ?", (content_hash,)).fetchone()
    if not row:
        return None
    return dict(row)


def fetch_batch_details(db, batch_id):
    batch = dict(db.execute("SELECT * FROM batches WHERE id = ?", (batch_id,)).fetchone())
    batch["addons"] = [dict(r) for r in db.execute(
        "SELECT id, item_name, patient_name, onsite_price, settle_price FROM addons WHERE batch_id = ?",
        (batch_id,)
    )]
    batch["coupons"] = [dict(r) for r in db.execute(
        "SELECT id, coupon_code, patient_name, onsite_amount, settle_amount FROM coupons WHERE batch_id = ?",
        (batch_id,)
    )]
    batch["unit_bills"] = [dict(r) for r in db.execute(
        "SELECT id, patient_name, onsite_total, settle_total FROM unit_bills WHERE batch_id = ?",
        (batch_id,)
    )]
    handlers = [dict(r) for r in db.execute(
        "SELECT id, handler, handled_at, note FROM handlers WHERE batch_id = ? ORDER BY id DESC",
        (batch_id,)
    )]
    batch["handlers"] = handlers
    batch["last_handler"] = handlers[0] if handlers else None
    return batch


def compute_stats(db, batch_id):
    addons = db.execute(
        "SELECT COALESCE(SUM(onsite_price),0) AS onsite, COALESCE(SUM(settle_price),0) AS settle, COUNT(*) AS cnt FROM addons WHERE batch_id = ?",
        (batch_id,),
    ).fetchone()
    coupons = db.execute(
        "SELECT COALESCE(SUM(onsite_amount),0) AS onsite, COALESCE(SUM(settle_amount),0) AS settle, COUNT(*) AS cnt FROM coupons WHERE batch_id = ?",
        (batch_id,),
    ).fetchone()
    bills = db.execute(
        "SELECT COALESCE(SUM(onsite_total),0) AS onsite, COALESCE(SUM(settle_total),0) AS settle, COUNT(*) AS cnt FROM unit_bills WHERE batch_id = ?",
        (batch_id,),
    ).fetchone()
    addon_diff = round(addons["onsite"] - addons["settle"], 2)
    coupon_diff = round(coupons["onsite"] - coupons["settle"], 2)
    bill_diff = round(bills["onsite"] - bills["settle"], 2)
    return {
        "addon": {
            "onsite_total": addons["onsite"],
            "settle_total": addons["settle"],
            "diff": addon_diff,
            "count": addons["cnt"],
        },
        "coupon": {
            "onsite_total": coupons["onsite"],
            "settle_total": coupons["settle"],
            "diff": coupon_diff,
            "count": coupons["cnt"],
        },
        "unit_bill": {
            "onsite_total": bills["onsite"],
            "settle_total": bills["settle"],
            "diff": bill_diff,
            "count": bills["cnt"],
        },
        "total_diff": round(addon_diff + coupon_diff + bill_diff, 2),
    }


def validate_payload(data):
    errors = []
    if not isinstance(data, dict):
        errors.append("payload must be a JSON object")
        return errors
    for key in ("submitter", "addons", "coupons", "unit_bills"):
        if key not in data:
            errors.append(f"missing field: {key}")
    if errors:
        return errors
    if not isinstance(data["addons"], list):
        errors.append("addons must be a list")
    if not isinstance(data["coupons"], list):
        errors.append("coupons must be a list")
    if not isinstance(data["unit_bills"], list):
        errors.append("unit_bills must be a list")
    for i, a in enumerate(data.get("addons", [])):
        for f in ("item_name", "patient_name", "onsite_price", "settle_price"):
            if f not in a:
                errors.append(f"addons[{i}] missing {f}")
    for i, c in enumerate(data.get("coupons", [])):
        for f in ("coupon_code", "patient_name", "onsite_amount", "settle_amount"):
            if f not in c:
                errors.append(f"coupons[{i}] missing {f}")
    for i, b in enumerate(data.get("unit_bills", [])):
        for f in ("patient_name", "onsite_total", "settle_total"):
            if f not in b:
                errors.append(f"unit_bills[{i}] missing {f}")
    return errors


@app.route("/api/batches", methods=["POST"])
def create_batch():
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "invalid JSON body"}), 400
    errors = validate_payload(data)
    if errors:
        return jsonify({"error": "validation failed", "details": errors}), 400

    db = get_db()
    content_hash = compute_content_hash(data)
    existing = find_batch_by_hash(db, content_hash)
    if existing:
        details = fetch_batch_details(db, existing["id"])
        stats = compute_stats(db, existing["id"])
        return jsonify({
            "duplicate": True,
            "message": "已存在相同批次材料，返回原处理结果",
            "batch": details,
            "stats": stats,
        }), 200

    batch_no = next_batch_no(db)
    ts = now_iso()
    cur = db.execute(
        "INSERT INTO batches (batch_no, submitter, content_hash, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (batch_no, data["submitter"], content_hash, data.get("remark", ""), ts, ts),
    )
    batch_id = cur.lastrowid

    for a in data["addons"]:
        db.execute(
            "INSERT INTO addons (batch_id, item_name, patient_name, onsite_price, settle_price) VALUES (?, ?, ?, ?, ?)",
            (batch_id, a["item_name"], a["patient_name"], float(a["onsite_price"]), float(a["settle_price"])),
        )
    for c in data["coupons"]:
        db.execute(
            "INSERT INTO coupons (batch_id, coupon_code, patient_name, onsite_amount, settle_amount) VALUES (?, ?, ?, ?, ?)",
            (batch_id, c["coupon_code"], c["patient_name"], float(c["onsite_amount"]), float(c["settle_amount"])),
        )
    for b in data["unit_bills"]:
        db.execute(
            "INSERT INTO unit_bills (batch_id, patient_name, onsite_total, settle_total) VALUES (?, ?, ?, ?)",
            (batch_id, b["patient_name"], float(b["onsite_total"]), float(b["settle_total"])),
        )

    handler = data.get("handler") or data["submitter"]
    db.execute(
        "INSERT INTO handlers (batch_id, handler, handled_at, note) VALUES (?, ?, ?, ?)",
        (batch_id, handler, ts, data.get("handler_note", "提交即处理")),
    )
    db.commit()

    details = fetch_batch_details(db, batch_id)
    stats = compute_stats(db, batch_id)
    return jsonify({
        "duplicate": False,
        "message": "批次已创建并处理",
        "batch": details,
        "stats": stats,
    }), 201


@app.route("/api/batches", methods=["GET"])
def list_batches():
    db = get_db()
    rows = db.execute("SELECT * FROM batches ORDER BY id DESC").fetchall()
    result = []
    for r in rows:
        item = dict(r)
        item["stats"] = compute_stats(db, r["id"])
        last_h = db.execute(
            "SELECT handler, handled_at, note FROM handlers WHERE batch_id = ? ORDER BY id DESC LIMIT 1",
            (r["id"],),
        ).fetchone()
        item["last_handler"] = dict(last_h) if last_h else None
        result.append(item)
    return jsonify({"batches": result})


@app.route("/api/batches/<batch_no>", methods=["GET"])
def get_batch(batch_no):
    db = get_db()
    row = db.execute("SELECT * FROM batches WHERE batch_no = ?", (batch_no,)).fetchone()
    if not row:
        return jsonify({"error": "batch not found"}), 404
    details = fetch_batch_details(db, row["id"])
    stats = compute_stats(db, row["id"])
    return jsonify({"batch": details, "stats": stats})


@app.route("/api/batches/<batch_no>/stats", methods=["GET"])
def get_batch_stats(batch_no):
    db = get_db()
    row = db.execute("SELECT * FROM batches WHERE batch_no = ?", (batch_no,)).fetchone()
    if not row:
        return jsonify({"error": "batch not found"}), 404
    return jsonify({"batch_no": batch_no, "stats": compute_stats(db, row["id"])})


@app.route("/api/batches/<batch_no>/handlers", methods=["POST"])
def add_handler(batch_no):
    data = request.get_json(silent=True) or {}
    handler = (data.get("handler") or "").strip()
    note = (data.get("note") or "").strip()
    if not handler:
        return jsonify({"error": "handler is required"}), 400
    db = get_db()
    row = db.execute("SELECT id FROM batches WHERE batch_no = ?", (batch_no,)).fetchone()
    if not row:
        return jsonify({"error": "batch not found"}), 404
    ts = now_iso()
    db.execute(
        "INSERT INTO handlers (batch_id, handler, handled_at, note) VALUES (?, ?, ?, ?)",
        (row["id"], handler, ts, note),
    )
    db.execute("UPDATE batches SET updated_at = ? WHERE id = ?", (ts, row["id"]))
    db.commit()
    return jsonify({"batch_no": batch_no, "last_handler": {"handler": handler, "handled_at": ts, "note": note}})


@app.route("/api/batches/<batch_no>/report", methods=["GET"])
def download_report(batch_no):
    db = get_db()
    row = db.execute("SELECT * FROM batches WHERE batch_no = ?", (batch_no,)).fetchone()
    if not row:
        return jsonify({"error": "batch not found"}), 404
    batch_id = row["id"]
    stats = compute_stats(db, batch_id)
    last_h = db.execute(
        "SELECT handler, handled_at, note FROM handlers WHERE batch_id = ? ORDER BY id DESC LIMIT 1",
        (batch_id,),
    ).fetchone()
    last_handler = dict(last_h) if last_h else {"handler": "", "handled_at": "", "note": ""}

    addons = db.execute(
        "SELECT item_name, patient_name, onsite_price, settle_price FROM addons WHERE batch_id = ? ORDER BY id",
        (batch_id,),
    ).fetchall()
    coupons = db.execute(
        "SELECT coupon_code, patient_name, onsite_amount, settle_amount FROM coupons WHERE batch_id = ? ORDER BY id",
        (batch_id,),
    ).fetchall()
    bills = db.execute(
        "SELECT patient_name, onsite_total, settle_total FROM unit_bills WHERE batch_id = ? ORDER BY id",
        (batch_id,),
    ).fetchall()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "批次号", "提交人", "提交时间", "最后处理人", "最后处理时间", "最后处理备注",
        "类别", "编号/项目", "姓名", "现场金额", "结算金额", "差异",
        "加项差异总计", "优惠券差异总计", "单位账单差异总计", "差异总计",
    ])

    def write_rows(category, rows, name_field, onsite_field, settle_field, code_field=None):
        for r in rows:
            code = r[code_field] if code_field else ""
            onsite = float(r[onsite_field])
            settle = float(r[settle_field])
            writer.writerow([
                batch_no, row["submitter"], row["created_at"],
                last_handler["handler"], last_handler["handled_at"], last_handler["note"],
                category, code, r[name_field],
                f"{onsite:.2f}", f"{settle:.2f}", f"{round(onsite - settle, 2):.2f}",
                f"{stats['addon']['diff']:.2f}",
                f"{stats['coupon']['diff']:.2f}",
                f"{stats['unit_bill']['diff']:.2f}",
                f"{stats['total_diff']:.2f}",
            ])

    write_rows("加项", addons, "patient_name", "onsite_price", "settle_price", code_field="item_name")
    write_rows("优惠券", coupons, "patient_name", "onsite_amount", "settle_amount", code_field="coupon_code")
    write_rows("单位账单", bills, "patient_name", "onsite_total", "settle_total", code_field=None)

    csv_text = buf.getvalue()
    filename = f"settlement_{batch_no}_{datetime.now().strftime('%Y%m%d%H%M%S')}.csv"
    return Response(
        csv_text,
        mimetype="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "time": now_iso()})


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5001, debug=False)
else:
    init_db()
