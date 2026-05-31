import json
from fastapi import APIRouter, HTTPException, Query
from app.database import get_db
from app.models import BatchInput, RecordOutput
from app.engine import verify_record

router = APIRouter(prefix="/records", tags=["记录管理"])


def _row_to_record_output(row, conflicts=None):
    d = dict(row)
    d["has_voucher"] = bool(d["has_voucher"])
    conflict_detail = d.pop("conflict_detail", None)
    if conflict_detail:
        try:
            d["conflict_detail"] = json.loads(conflict_detail)
        except (json.JSONDecodeError, TypeError):
            d["conflict_detail"] = None
    else:
        d["conflict_detail"] = None
    d["conflicts"] = conflicts or []
    return RecordOutput(**d)


@router.post("/import", summary="导入一个批次的记录")
def import_batch(batch_input: BatchInput):
    with get_db() as conn:
        existing = conn.execute(
            "SELECT batch_id FROM batch WHERE batch_id = ?", (batch_input.batch_id,)
        ).fetchone()
        if existing:
            raise HTTPException(status_code=409, detail=f"批次 {batch_input.batch_id} 已存在")

        conn.execute(
            "INSERT INTO batch (batch_id, description) VALUES (?, ?)",
            (batch_input.batch_id, batch_input.description),
        )

        screenshot_records = {}
        for r in batch_input.records:
            if r.source == "bank_receipt_screenshot":
                screenshot_records[r.lc_number] = {
                    "amount": None,
                    "currency": None,
                    "date": None,
                    "applicant": r.applicant,
                    "beneficiary": r.beneficiary,
                }
                parsed_a, parsed_c = None, None
                if r.amount_raw:
                    from app.engine import parse_amount
                    parsed_a, parsed_c = parse_amount(r.amount_raw)
                if parsed_a is not None:
                    screenshot_records[r.lc_number]["amount"] = parsed_a
                if parsed_c:
                    screenshot_records[r.lc_number]["currency"] = parsed_c
                from app.engine import parse_date
                if r.date_raw:
                    screenshot_records[r.lc_number]["date"] = parse_date(r.date_raw)

        imported_records = []
        for r in batch_input.records:
            existing_screenshot = screenshot_records.get(r.lc_number)
            record_dict = {
                "lc_number": r.lc_number,
                "applicant": r.applicant,
                "beneficiary": r.beneficiary,
                "amount_raw": r.amount_raw,
                "date_raw": r.date_raw,
                "operator_name": r.operator_name,
                "source": r.source,
                "source_detail": r.source_detail,
                "voucher_reference": r.voucher_reference,
                "amount": None,
                "currency": None,
                "date": None,
            }

            if r.source == "import" and existing_screenshot:
                verify_result = verify_record(record_dict, existing_screenshot)
            else:
                verify_result = verify_record(record_dict)

            if verify_result["amount"] is not None:
                record_dict["amount"] = verify_result["amount"]
            if verify_result["currency"] is not None:
                record_dict["currency"] = verify_result["currency"]
            if verify_result["date"] is not None:
                record_dict["date"] = verify_result["date"]

            conflict_detail_json = None
            if verify_result["conflict_detail"]:
                conflict_detail_json = json.dumps(verify_result["conflict_detail"], ensure_ascii=False)

            cursor = conn.execute(
                """INSERT INTO record
                   (batch_id, lc_number, applicant, beneficiary, amount_raw, amount, currency,
                    date_raw, date, operator_name, source, source_detail, voucher_reference,
                    has_voucher, status, conflict_detail, suggested_action, verification_note)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    batch_input.batch_id,
                    r.lc_number,
                    r.applicant,
                    r.beneficiary,
                    r.amount_raw,
                    record_dict["amount"],
                    record_dict["currency"],
                    r.date_raw,
                    record_dict["date"],
                    r.operator_name,
                    r.source,
                    r.source_detail,
                    r.voucher_reference,
                    int(verify_result["has_voucher"]),
                    verify_result["status"],
                    conflict_detail_json,
                    verify_result["suggested_action"],
                    "\n".join(verify_result["verification_note"]),
                ),
            )
            record_id = cursor.lastrowid

            if verify_result["conflict_detail"]:
                for c in verify_result["conflict_detail"]:
                    conn.execute(
                        """INSERT INTO conflict (record_id, field_name, imported_value, screenshot_value, suggested_action)
                           VALUES (?, ?, ?, ?, ?)""",
                        (
                            record_id,
                            c["field_name"],
                            c.get("imported_value"),
                            c.get("screenshot_value"),
                            c.get("suggested_action"),
                        ),
                    )

            imported_records.append({
                "record_id": record_id,
                "lc_number": r.lc_number,
                "status": verify_result["status"],
            })

    return {
        "batch_id": batch_input.batch_id,
        "imported_count": len(imported_records),
        "records": imported_records,
    }


@router.get("/list", summary="查询记录列表")
def list_records(
    batch_id: str = Query(..., description="批次ID"),
    status: str = Query(None, description="按状态筛选"),
):
    with get_db() as conn:
        sql = "SELECT * FROM record WHERE batch_id = ?"
        params = [batch_id]
        if status:
            sql += " AND status = ?"
            params.append(status)
        sql += " ORDER BY id"
        rows = conn.execute(sql, params).fetchall()

        results = []
        for row in rows:
            conflicts = []
            conflict_rows = conn.execute(
                "SELECT * FROM conflict WHERE record_id = ?", (row["id"],)
            ).fetchall()
            for cr in conflict_rows:
                conflicts.append(dict(cr))
            results.append(_row_to_record_output(row, conflicts))

        return {"total": len(results), "records": results}


@router.get("/{record_id}", summary="查询单条记录详情")
def get_record(record_id: int):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM record WHERE id = ?", (record_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="记录不存在")
        conflicts = []
        conflict_rows = conn.execute(
            "SELECT * FROM conflict WHERE record_id = ?", (record_id,)
        ).fetchall()
        for cr in conflict_rows:
            conflicts.append(dict(cr))
        return _row_to_record_output(row, conflicts)
