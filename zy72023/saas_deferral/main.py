import json
import csv
import io
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from .database import (
    init_db, get_conn, add_audit, row_to_dict, _now,
    STATUS_PENDING, STATUS_CONFIRMED, STATUS_SUSPENDED, STATUS_CONFLICT,
    VALID_TRANSITIONS,
)

app = FastAPI(title="SaaS订阅收入递延处理系统", version="1.0.0")

@app.on_event("startup")
def startup():
    init_db()

class RecordCreate(BaseModel):
    batch_id: str
    customer_name: str
    contract_no: str
    subscription_period_start: str
    subscription_period_end: str
    total_amount: float
    deferred_amount: float = 0
    recognized_amount: float = 0
    source_type: str
    has_voucher: int = 0
    voucher_source: str = ""
    contract_scan_note: str = ""
    imported_data_note: str = ""
    operator: str = ""

class RecordBatchCreate(BaseModel):
    records: List[RecordCreate]
    operator: str = ""

class ConfirmRequest(BaseModel):
    operator: str
    note: str = ""

class SuspendRequest(BaseModel):
    operator: str
    reason: str = ""

class ResolveConflictRequest(BaseModel):
    operator: str
    chosen_side: str
    note: str = ""

class AddOperatorNoteRequest(BaseModel):
    operator: str
    note: str

def _generate_suggestion(record: dict) -> str:
    parts = []
    if record["status"] == STATUS_SUSPENDED:
        parts.append(
            f"【挂起提醒】该记录缺凭证（来源：{record['source_type']}），"
            f"递延金额 {record['deferred_amount']} 元暂不计入已确认。"
            f"请找齐银行回单或合同扫描件后再确认。"
        )
    elif record["status"] == STATUS_CONFLICT:
        parts.append(
            f"【冲突提醒】合同扫描件与导入数据不一致，请仔细核对后再操作：\n"
            f"  - 导入数据口径：{record['imported_data_note']}\n"
            f"  - 合同扫描件口径：{record['contract_scan_note']}\n"
            f"建议：先确认合同扫描件的签约日期和金额是否为最新版本，"
            f"再决定按哪边为准。如有疑问请联系业务同事核实。"
        )
    elif record["status"] == STATUS_CONFIRMED:
        parts.append(
            f"【已确认】该记录已于 {_fmt_time(record['updated_at'])} 由 {record['updated_by']} 确认，"
            f"递延金额 {record['deferred_amount']} 元已计入。"
        )
    elif record["status"] == STATUS_PENDING:
        if record["has_voucher"]:
            parts.append(
                f"【待确认】凭证齐全（来源：{record['voucher_source']}），"
                f"递延金额 {record['deferred_amount']} 元可以确认。"
            )
        else:
            parts.append(
                f"【待确认-缺凭证】来源为 {record['source_type']}，"
                f"尚未提供凭证，确认前请补充。"
            )
    if record["operator_note"]:
        parts.append(f"上次备注：{record['operator_note']}")
    return "\n".join(parts)

def _fmt_time(t: str) -> str:
    return t if t else "未知"

def _detect_and_set_status(record: dict, conn) -> str:
    status = STATUS_PENDING
    has_contract_scan = bool(record.get("contract_scan_note", "").strip())
    has_imported_note = bool(record.get("imported_data_note", "").strip())
    if has_contract_scan and has_imported_note:
        scan = record["contract_scan_note"].strip()
        imported = record["imported_data_note"].strip()
        if scan != imported:
            status = STATUS_CONFLICT
    if status == STATUS_PENDING and not record.get("has_voucher"):
        status = STATUS_SUSPENDED
    return status

@app.get("/api/records")
def list_records(
    batch_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    customer_name: Optional[str] = Query(None),
):
    conn = get_conn()
    try:
        conditions = []
        params = []
        if batch_id:
            conditions.append("batch_id = ?")
            params.append(batch_id)
        if status:
            conditions.append("status = ?")
            params.append(status)
        if customer_name:
            conditions.append("customer_name LIKE ?")
            params.append(f"%{customer_name}%")
        where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        rows = conn.execute(
            f"SELECT * FROM deferral_records{where} ORDER BY id", params
        ).fetchall()
        result = []
        for r in rows:
            d = row_to_dict(r)
            d["suggestion"] = _generate_suggestion(d)
            result.append(d)
        return {"total": len(result), "records": result}
    finally:
        conn.close()

@app.get("/api/records/{record_id}")
def get_record(record_id: int):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM deferral_records WHERE id = ?", (record_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "记录不存在")
        record = row_to_dict(row)
        record["suggestion"] = _generate_suggestion(record)
        logs = conn.execute(
            "SELECT * FROM audit_log WHERE record_id = ? ORDER BY id", (record_id,)
        ).fetchall()
        record["audit_log"] = [row_to_dict(l) for l in logs]
        return record
    finally:
        conn.close()

@app.post("/api/records")
def create_record(rec: RecordCreate):
    conn = get_conn()
    try:
        now = _now()
        rec_dict = rec.dict()
        rec_dict.pop("operator")
        operator = rec.operator or "系统"
        rec_dict["status"] = STATUS_PENDING
        rec_dict["created_at"] = now
        rec_dict["updated_at"] = now
        rec_dict["updated_by"] = operator
        rec_dict["suggestion"] = ""
        rec_dict["conflict_detail"] = ""
        rec_dict["operator_note"] = ""
        auto_status = _detect_and_set_status(rec_dict, conn)
        rec_dict["status"] = auto_status
        rec_dict["suggestion"] = _generate_suggestion(rec_dict)
        if auto_status == STATUS_CONFLICT:
            rec_dict["conflict_detail"] = json.dumps({
                "imported_side": rec_dict["imported_data_note"],
                "contract_scan_side": rec_dict["contract_scan_note"],
                "advice": "请核对合同扫描件与台账口径差异，确认后选择一边为准"
            }, ensure_ascii=False)
        cols = ", ".join(rec_dict.keys())
        placeholders = ", ".join(["?"] * len(rec_dict))
        conn.execute(
            f"INSERT INTO deferral_records ({cols}) VALUES ({placeholders})",
            list(rec_dict.values()),
        )
        record_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        add_audit(record_id, "create", f"创建记录，自动判定状态：{auto_status}", operator, conn)
        conn.commit()
        return {"id": record_id, "status": auto_status}
    finally:
        conn.close()

@app.post("/api/records/batch")
def batch_create(req: RecordBatchCreate):
    results = []
    for rec in req.records:
        rec.operator = req.operator or rec.operator
        results.append(create_record(rec))
    return {"created": len(results), "results": results}

@app.put("/api/records/{record_id}/confirm")
def confirm_record(record_id: int, req: ConfirmRequest):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM deferral_records WHERE id = ?", (record_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "记录不存在")
        record = row_to_dict(row)
        if record["status"] not in VALID_TRANSITIONS or not VALID_TRANSITIONS[record["status"]]:
            raise HTTPException(400, f"当前状态 {record['status']} 不可执行确认操作")
        if record["status"] == STATUS_SUSPENDED and not record["has_voucher"]:
            raise HTTPException(
                400,
                "挂起记录缺少凭证，请先补充凭证（has_voucher=1）后再确认，"
                "或通过 /add-voucher 接口补录凭证"
            )
        now = _now()
        conn.execute(
            "UPDATE deferral_records SET status=?, updated_at=?, updated_by=?, operator_note=? WHERE id=?",
            (STATUS_CONFIRMED, now, req.operator, req.note, record_id),
        )
        add_audit(record_id, "confirm", f"确认记录。备注：{req.note}", req.operator, conn)
        conn.commit()
        return {"id": record_id, "status": STATUS_CONFIRMED}
    finally:
        conn.close()

@app.put("/api/records/{record_id}/suspend")
def suspend_record(record_id: int, req: SuspendRequest):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM deferral_records WHERE id = ?", (record_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "记录不存在")
        record = row_to_dict(row)
        if record["status"] not in VALID_TRANSITIONS or STATUS_SUSPENDED not in VALID_TRANSITIONS[record["status"]]:
            raise HTTPException(400, f"当前状态 {record['status']} 不可挂起")
        now = _now()
        conn.execute(
            "UPDATE deferral_records SET status=?, updated_at=?, updated_by=?, operator_note=? WHERE id=?",
            (STATUS_SUSPENDED, now, req.operator, req.reason, record_id),
        )
        add_audit(record_id, "suspend", f"挂起记录。原因：{req.reason}", req.operator, conn)
        conn.commit()
        return {"id": record_id, "status": STATUS_SUSPENDED}
    finally:
        conn.close()

@app.put("/api/records/{record_id}/resolve-conflict")
def resolve_conflict(record_id: int, req: ResolveConflictRequest):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM deferral_records WHERE id = ?", (record_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "记录不存在")
        record = row_to_dict(row)
        if record["status"] != STATUS_CONFLICT:
            raise HTTPException(400, "当前记录不是冲突状态")
        if req.chosen_side not in ("imported", "contract_scan"):
            raise HTTPException(400, "chosen_side 只能是 imported 或 contract_scan")
        now = _now()
        chosen_note = ""
        if req.chosen_side == "imported":
            chosen_note = f"按导入数据口径为准：{record['imported_data_note']}"
        else:
            chosen_note = f"按合同扫描件口径为准：{record['contract_scan_note']}"
        conflict_detail = json.loads(record.get("conflict_detail") or "{}")
        conflict_detail["resolution"] = chosen_note
        conflict_detail["resolved_by"] = req.operator
        conflict_detail["resolved_at"] = now
        conn.execute(
            "UPDATE deferral_records SET status=?, updated_at=?, updated_by=?, operator_note=?, conflict_detail=? WHERE id=?",
            (
                STATUS_CONFIRMED,
                now,
                req.operator,
                f"{chosen_note}；{req.note}",
                json.dumps(conflict_detail, ensure_ascii=False),
                record_id,
            ),
        )
        add_audit(
            record_id,
            "resolve_conflict",
            f"解决冲突：{chosen_note}。备注：{req.note}",
            req.operator,
            conn,
        )
        conn.commit()
        return {"id": record_id, "status": STATUS_CONFIRMED, "resolution": chosen_note}
    finally:
        conn.close()

@app.put("/api/records/{record_id}/add-voucher")
def add_voucher(record_id: int, req: ConfirmRequest):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM deferral_records WHERE id = ?", (record_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "记录不存在")
        now = _now()
        conn.execute(
            "UPDATE deferral_records SET has_voucher=1, voucher_source=?, updated_at=?, updated_by=? WHERE id=?",
            (req.note, now, req.operator, record_id),
        )
        add_audit(record_id, "add_voucher", f"补充凭证：{req.note}", req.operator, conn)
        conn.commit()
        return {"id": record_id, "has_voucher": 1, "voucher_source": req.note}
    finally:
        conn.close()

@app.put("/api/records/{record_id}/note")
def add_operator_note(record_id: int, req: AddOperatorNoteRequest):
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT * FROM deferral_records WHERE id = ?", (record_id,)
        ).fetchone()
        if not row:
            raise HTTPException(404, "记录不存在")
        record = row_to_dict(row)
        existing = record.get("operator_note", "")
        new_note = f"{existing}；{req.note}" if existing else req.note
        now = _now()
        conn.execute(
            "UPDATE deferral_records SET operator_note=?, updated_at=?, updated_by=? WHERE id=?",
            (new_note, now, req.operator, record_id),
        )
        add_audit(record_id, "add_note", f"添加备注：{req.note}", req.operator, conn)
        conn.commit()
        return {"id": record_id, "operator_note": new_note}
    finally:
        conn.close()

@app.get("/api/records/export/csv")
def export_csv(
    batch_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
):
    conn = get_conn()
    try:
        conditions = []
        params = []
        if batch_id:
            conditions.append("batch_id = ?")
            params.append(batch_id)
        if status:
            conditions.append("status = ?")
            params.append(status)
        where = (" WHERE " + " AND ".join(conditions)) if conditions else ""
        rows = conn.execute(
            f"SELECT * FROM deferral_records{where} ORDER BY id", params
        ).fetchall()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "ID", "批次号", "客户名称", "合同编号",
            "订阅期起始", "订阅期结束",
            "合同总金额", "递延金额", "已确认金额",
            "数据来源", "有凭证", "凭证来源",
            "状态", "合同扫描件口径", "导入数据口径",
            "冲突详情", "处理建议", "操作人备注",
            "创建时间", "更新时间", "操作人",
        ])
        for r in rows:
            d = row_to_dict(r)
            writer.writerow([
                d["id"], d["batch_id"], d["customer_name"], d["contract_no"],
                d["subscription_period_start"], d["subscription_period_end"],
                d["total_amount"], d["deferred_amount"], d["recognized_amount"],
                d["source_type"], d["has_voucher"], d["voucher_source"],
                d["status"], d["contract_scan_note"], d["imported_data_note"],
                d["conflict_detail"], _generate_suggestion(d), d["operator_note"],
                d["created_at"], d["updated_at"], d["updated_by"],
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=saas_deferral_report.csv"},
        )
    finally:
        conn.close()

@app.get("/api/summary")
def summary(batch_id: Optional[str] = Query(None)):
    conn = get_conn()
    try:
        condition = ""
        params = []
        if batch_id:
            condition = " WHERE batch_id = ?"
            params.append(batch_id)
        total = conn.execute(
            f"SELECT COUNT(*) as cnt FROM deferral_records{condition}", params
        ).fetchone()["cnt"]
        confirmed = conn.execute(
            f"SELECT COUNT(*) as cnt FROM deferral_records WHERE status=?{(' AND batch_id=?' if batch_id else '')}",
            [STATUS_CONFIRMED] + params,
        ).fetchone()["cnt"]
        suspended = conn.execute(
            f"SELECT COUNT(*) as cnt FROM deferral_records WHERE status=?{(' AND batch_id=?' if batch_id else '')}",
            [STATUS_SUSPENDED] + params,
        ).fetchone()["cnt"]
        conflict = conn.execute(
            f"SELECT COUNT(*) as cnt FROM deferral_records WHERE status=?{(' AND batch_id=?' if batch_id else '')}",
            [STATUS_CONFLICT] + params,
        ).fetchone()["cnt"]
        pending = conn.execute(
            f"SELECT COUNT(*) as cnt FROM deferral_records WHERE status=?{(' AND batch_id=?' if batch_id else '')}",
            [STATUS_PENDING] + params,
        ).fetchone()["cnt"]
        confirmed_amount = conn.execute(
            f"SELECT COALESCE(SUM(deferred_amount),0) as amt FROM deferral_records WHERE status=?{(' AND batch_id=?' if batch_id else '')}",
            [STATUS_CONFIRMED] + params,
        ).fetchone()["amt"]
        suspended_amount = conn.execute(
            f"SELECT COALESCE(SUM(deferred_amount),0) as amt FROM deferral_records WHERE status=?{(' AND batch_id=?' if batch_id else '')}",
            [STATUS_SUSPENDED] + params,
        ).fetchone()["amt"]
        conflict_amount = conn.execute(
            f"SELECT COALESCE(SUM(deferred_amount),0) as amt FROM deferral_records WHERE status=?{(' AND batch_id=?' if batch_id else '')}",
            [STATUS_CONFLICT] + params,
        ).fetchone()["amt"]
        return {
            "total_records": total,
            "by_status": {
                "confirmed": confirmed,
                "suspended": suspended,
                "conflict": conflict,
                "pending": pending,
            },
            "confirmed_deferred_amount": confirmed_amount,
            "suspended_deferred_amount": suspended_amount,
            "conflict_deferred_amount": conflict_amount,
            "warning": "挂起和冲突状态的递延金额不计入已确认金额" if (suspended_amount + conflict_amount) > 0 else "",
        }
    finally:
        conn.close()
