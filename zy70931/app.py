"""汽修保养套餐核销 API 服务.

提供批次管理、原始材料登记、自动拆分（正常/待补充/已拦截）、
处理轨迹查询以及最终报告导出能力。
"""
from __future__ import annotations

import csv
import io
import json
import sqlite3
import time
from contextlib import contextmanager
from datetime import date, datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field, ValidationError

DB_PATH = Path(__file__).resolve().parent / "redeem.db"

REQUIRED_FIELDS = ("package_code", "plate", "vin", "service_date", "store_id")
OPTIONAL_FIELDS = ("mileage", "phone", "customer_name", "technician")
KNOWN_PACKAGE_PREFIX = {"B", "M", "T"}


# ----------------------------- 数据模型 ---------------------------------
class RawRecord(BaseModel):
    package_code: Optional[str] = Field(None, description="保养套餐编号，如 B10035")
    plate: Optional[str] = Field(None, description="车牌号，如 沪A12345")
    vin: Optional[str] = Field(None, description="车架号 VIN，17 位")
    service_date: Optional[str] = Field(None, description="服务日期 YYYY-MM-DD")
    store_id: Optional[str] = Field(None, description="门店编号")
    mileage: Optional[int] = Field(None, description="里程数 km")
    phone: Optional[str] = Field(None, description="客户手机号")
    customer_name: Optional[str] = Field(None, description="客户姓名")
    technician: Optional[str] = Field(None, description="服务技师")
    note: Optional[str] = Field(None, description="备注")


class BatchCreate(BaseModel):
    store_id: str
    operator: str
    remark: Optional[str] = None


class RecordListIn(BaseModel):
    records: List[RawRecord]


# ----------------------------- 数据库 ---------------------------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS batch (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no     TEXT UNIQUE NOT NULL,
    store_id     TEXT NOT NULL,
    operator     TEXT NOT NULL,
    remark       TEXT,
    status       TEXT NOT NULL DEFAULT 'open',
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS raw_record (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id     INTEGER NOT NULL REFERENCES batch(id),
    seq          INTEGER NOT NULL,
    payload      TEXT NOT NULL,
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_record_id    INTEGER NOT NULL UNIQUE REFERENCES raw_record(id),
    batch_id         INTEGER NOT NULL REFERENCES batch(id),
    category         TEXT NOT NULL,
    reason           TEXT NOT NULL,
    follow_up        TEXT NOT NULL,
    fields           TEXT NOT NULL,
    processed_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS item_history (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id          INTEGER NOT NULL REFERENCES item(id),
    category         TEXT NOT NULL,
    action           TEXT NOT NULL,
    reason           TEXT NOT NULL,
    created_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_item_batch   ON item(batch_id);
CREATE INDEX IF NOT EXISTS idx_item_cat     ON item(category);
CREATE INDEX IF NOT EXISTS idx_hist_item    ON item_history(item_id);
"""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def tx():
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


@contextmanager
def ro():
    conn = get_conn()
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    with tx() as conn:
        conn.executescript(SCHEMA)


# ----------------------------- 工具函数 ---------------------------------
def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def parse_csv_rows(text: str) -> List[Dict[str, Any]]:
    reader = csv.DictReader(io.StringIO(text))
    rows: List[Dict[str, Any]] = []
    for row in reader:
        cleaned: Dict[str, Any] = {}
        for k, v in row.items():
            key = (k or "").strip()
            if not key:
                continue
            val = (v or "").strip()
            cleaned[key] = val if val != "" else None
        rows.append(cleaned)
    return rows


# ----------------------------- 拆分引擎 ---------------------------------
def _validate_date(s: str) -> Tuple[bool, Optional[str]]:
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return True, None
    except ValueError:
        return False, "服务日期格式错误（应为 YYYY-MM-DD）"


def classify(payload: Dict[str, Any]) -> Tuple[str, str, str, List[str]]:
    """返回 (category, reason, follow_up, missing_fields)."""
    payload = payload or {}
    missing = [f for f in REQUIRED_FIELDS if not payload.get(f)]
    blanks = [f for f in OPTIONAL_FIELDS if f in payload and payload.get(f) in (None, "")]

    package_code = (payload.get("package_code") or "").strip()
    vin = (payload.get("vin") or "").strip()
    phone = (payload.get("phone") or "").strip()

    # 1. 拦截类
    if package_code and package_code[0].upper() not in KNOWN_PACKAGE_PREFIX:
        return ("blocked",
                f"套餐前缀非法({package_code[0]})，不在备案范围 B/M/T 内",
                "冻结本单并提交风控复核，门店店长需在 24h 内补正套餐协议",
                missing + blanks)

    if vin and len(vin) != 17:
        return ("blocked",
                f"VIN 长度异常({len(vin)})，标准长度为 17 位",
                "驳回门店原始单，要求重新扫描 VIN 并上传行驶证照片",
                missing + blanks)

    ok, msg = _validate_date(payload.get("service_date") or "")
    if not ok and payload.get("service_date"):
        return ("blocked",
                msg or "服务日期解析失败",
                "退回门店修正日期后重新提交，如超过套餐有效期则直接作废",
                missing + blanks)

    if phone and (not phone.isdigit() or len(phone) != 11):
        return ("blocked",
                "客户手机号格式不合法",
                "通知客服与客户确认后补录，已拦截本单避免错发权益短信",
                missing + blanks)

    # 2. 待补充类
    if missing:
        return ("pending",
                f"缺失必填字段: {', '.join(missing)}",
                f"指派门店店长补齐 {', '.join(missing)} 后回流，超 48h 未补充则转拦截",
                missing + blanks)

    if blanks:
        return ("pending",
                f"可填字段留空: {', '.join(blanks)}",
                "系统自动发送提醒短信给门店前台，72h 内补充即可；不影响当前核销结算",
                missing + blanks)

    return ("normal",
            "核心字段齐全且格式校验通过",
            "自动推送至结算系统，权益包次日到账，客户短信通知已触发",
            [])


def process_record(raw_id: int, batch_id: int, payload: Dict[str, Any]) -> None:
    category, reason, follow_up, fields = classify(payload)
    processed_at = now_iso()
    with tx() as conn:
        cur = conn.execute(
            "INSERT INTO item(raw_record_id, batch_id, category, reason, follow_up, fields, processed_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (raw_id, batch_id, category, reason, follow_up, json.dumps(fields, ensure_ascii=False), processed_at),
        )
        item_id = cur.lastrowid
        conn.execute(
            "INSERT INTO item_history(item_id, category, action, reason, created_at)"
            " VALUES (?, ?, '分类归档', ?, ?)",
            (item_id, category, reason, processed_at),
        )


# ----------------------------- FastAPI 应用 ---------------------------------
app = FastAPI(
    title="汽修保养套餐核销 API",
    description="面向汽修连锁门店的套餐核销处理服务，支持批次管理、材料登记、自动分类与报告导出。",
    version="1.0.0",
)


@app.on_event("startup")
def _startup() -> None:
    init_db()


@app.post("/batches", tags=["批次"])
def create_batch(body: BatchCreate) -> Dict[str, Any]:
    batch_no = f"B{time.strftime('%Y%m%d%H%M%S')}{int(time.time() * 1000) % 1000:03d}"
    created_at = now_iso()
    with tx() as conn:
        conn.execute(
            "INSERT INTO batch(batch_no, store_id, operator, remark, status, created_at)"
            " VALUES (?, ?, ?, ?, 'open', ?)",
            (batch_no, body.store_id, body.operator, body.remark, created_at),
        )
    return {"batch_no": batch_no, "store_id": body.store_id, "status": "open", "created_at": created_at}


@app.post("/batches/{batch_no}/register", tags=["批次"])
def register_records(batch_no: str, body: RecordListIn) -> Dict[str, Any]:
    with tx() as conn:
        row = conn.execute("SELECT id, status FROM batch WHERE batch_no=?", (batch_no,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="批次不存在")
        if row["status"] != "open":
            raise HTTPException(status_code=400, detail=f"批次已{row['status']}，不可再登记")
        batch_id = row["id"]
        seq_row = conn.execute(
            "SELECT COALESCE(MAX(seq), 0) AS m FROM raw_record WHERE batch_id=?", (batch_id,)
        ).fetchone()
        seq = int(seq_row["m"])
        created_at = now_iso()
        for rec in body.records:
            seq += 1
            payload = rec.model_dump(mode="json")
            conn.execute(
                "INSERT INTO raw_record(batch_id, seq, payload, created_at) VALUES (?, ?, ?, ?)",
                (batch_id, seq, json.dumps(payload, ensure_ascii=False), created_at),
            )
    return {"batch_no": batch_no, "registered": len(body.records), "total_in_batch": seq}


@app.post("/batches/{batch_no}/upload", tags=["批次"])
async def upload_records(batch_no: str, file: UploadFile = File(...),
                         encoding: str = Form(default="utf-8")) -> Dict[str, Any]:
    raw = await file.read()
    try:
        text = raw.decode(encoding)
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"文件解码失败: {exc}")
    rows = parse_csv_rows(text)
    records: List[RawRecord] = []
    for idx, r in enumerate(rows, start=1):
        try:
            records.append(RawRecord.model_validate(r))
        except ValidationError as exc:
            raise HTTPException(status_code=400, detail=f"第 {idx} 行校验失败: {exc.errors()}")
    return register_records(batch_no, RecordListIn(records=records))


@app.post("/batches/{batch_no}/split", tags=["批次"])
def split_batch(batch_no: str) -> Dict[str, Any]:
    with tx() as conn:
        row = conn.execute("SELECT id, status FROM batch WHERE batch_no=?", (batch_no,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="批次不存在")
        batch_id = row["id"]
        done = conn.execute(
            "SELECT COUNT(*) AS c FROM item WHERE batch_id=?", (batch_id,)
        ).fetchone()["c"]
        if done:
            raise HTTPException(status_code=400, detail="该批次已完成拆分，不可重复执行")
        rows = conn.execute(
            "SELECT id, payload FROM raw_record WHERE batch_id=? ORDER BY seq", (batch_id,)
        ).fetchall()
        if not rows:
            raise HTTPException(status_code=400, detail="批次内暂无原始材料，无法拆分")
        for r in rows:
            payload = json.loads(r["payload"])
            process_record(r["id"], batch_id, payload)
        conn.execute("UPDATE batch SET status='split' WHERE id=?", (batch_id,))
    counts = count_by_category(batch_no)
    return {"batch_no": batch_no, "status": "split", "counts": counts, "total": sum(counts.values())}


@app.get("/batches/{batch_no}", tags=["批次"])
def get_batch(batch_no: str) -> Dict[str, Any]:
    with tx() as conn:
        row = conn.execute(
            "SELECT * FROM batch WHERE batch_no=?", (batch_no,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="批次不存在")
        raw_cnt = conn.execute(
            "SELECT COUNT(*) AS c FROM raw_record WHERE batch_id=?", (row["id"],)
        ).fetchone()["c"]
        return {**dict(row), "raw_count": raw_cnt, "counts": count_by_category(batch_no)}


@app.get("/batches/{batch_no}/items", tags=["批次"])
def list_items(batch_no: str, category: Optional[str] = None) -> List[Dict[str, Any]]:
    with tx() as conn:
        row = conn.execute("SELECT id FROM batch WHERE batch_no=?", (batch_no,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="批次不存在")
        sql = (
            "SELECT i.id, i.category, i.reason, i.follow_up, i.processed_at, "
            "       r.payload, r.seq "
            "FROM item i JOIN raw_record r ON r.id = i.raw_record_id "
            "WHERE i.batch_id=?"
        )
        params: List[Any] = [row["id"]]
        if category:
            sql += " AND i.category=?"
            params.append(category)
        sql += " ORDER BY r.seq"
        return [
            {
                "item_id": r["id"],
                "seq": r["seq"],
                "category": r["category"],
                "reason": r["reason"],
                "follow_up": r["follow_up"],
                "processed_at": r["processed_at"],
                "payload": json.loads(r["payload"]),
            }
            for r in conn.execute(sql, params).fetchall()
        ]


@app.get("/items/{item_id}/history", tags=["明细"])
def item_history(item_id: int) -> Dict[str, Any]:
    with tx() as conn:
        item = conn.execute(
            "SELECT i.*, r.payload, r.seq FROM item i JOIN raw_record r ON r.id=i.raw_record_id WHERE i.id=?",
            (item_id,),
        ).fetchone()
        if not item:
            raise HTTPException(status_code=404, detail="明细不存在")
        hist = conn.execute(
            "SELECT category, action, reason, created_at FROM item_history WHERE item_id=? ORDER BY id",
            (item_id,),
        ).fetchall()
        return {
            "item_id": item["id"],
            "seq": item["seq"],
            "payload": json.loads(item["payload"]),
            "current": {
                "category": item["category"],
                "reason": item["reason"],
                "follow_up": item["follow_up"],
                "processed_at": item["processed_at"],
            },
            "history": [dict(h) for h in hist],
        }


@app.get("/batches/{batch_no}/report", tags=["报告"])
def download_report(batch_no: str, fmt: str = "csv") -> StreamingResponse:
    items = list_items(batch_no)
    if not items:
        raise HTTPException(status_code=404, detail="批次下暂无报告数据")
    if fmt == "json":
        data = json.dumps({"batch_no": batch_no, "items": items}, ensure_ascii=False, indent=2)
        return StreamingResponse(
            io.StringIO(data),
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{batch_no}.json"'},
        )
    buf = io.StringIO()
    fieldnames = [
        "seq", "category", "package_code", "plate", "vin", "service_date",
        "store_id", "mileage", "phone", "customer_name", "technician",
        "note", "reason", "follow_up", "processed_at",
    ]
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for it in items:
        p = it["payload"] or {}
        writer.writerow(
            {
                "seq": it["seq"],
                "category": it["category"],
                "package_code": p.get("package_code", ""),
                "plate": p.get("plate", ""),
                "vin": p.get("vin", ""),
                "service_date": p.get("service_date", ""),
                "store_id": p.get("store_id", ""),
                "mileage": p.get("mileage", "") if p.get("mileage") is not None else "",
                "phone": p.get("phone", ""),
                "customer_name": p.get("customer_name", ""),
                "technician": p.get("technician", ""),
                "note": p.get("note", ""),
                "reason": it["reason"],
                "follow_up": it["follow_up"],
                "processed_at": it["processed_at"],
            }
        )
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{batch_no}.csv"'},
    )


@app.get("/health", tags=["系统"])
def health() -> Dict[str, str]:
    return {"status": "ok", "db": str(DB_PATH)}


# ----------------------------- 内部辅助 ---------------------------------
def count_by_category(batch_no: str) -> Dict[str, int]:
    with ro() as conn:
        row = conn.execute("SELECT id FROM batch WHERE batch_no=?", (batch_no,)).fetchone()
        if not row:
            return {"normal": 0, "pending": 0, "blocked": 0}
        rows = conn.execute(
            "SELECT category, COUNT(*) AS c FROM item WHERE batch_id=? GROUP BY category",
            (row["id"],),
        ).fetchall()
    counts = {"normal": 0, "pending": 0, "blocked": 0}
    for r in rows:
        counts[r["category"]] = int(r["c"])
    return counts


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
