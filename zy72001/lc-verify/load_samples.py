import json
import sys
import os

HERE = os.path.dirname(os.path.abspath(__file__))

sys.path.insert(0, HERE)

from app.database import reset_db, get_db
from app.engine import verify_record, parse_amount, parse_date
from app.models import BatchInput, RecordInput


from typing import Optional


def load_samples(sample_path: Optional[str] = None):
    if sample_path is None:
        sample_path = os.path.join(HERE, "data", "samples.json")

    with open(sample_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    reset_db()

    batch_input = BatchInput(**data)

    with get_db() as conn:
        conn.execute(
            "INSERT INTO batch (batch_id, description) VALUES (?, ?)",
            (batch_input.batch_id, batch_input.description),
        )

        screenshot_records = {}
        for r in batch_input.records:
            if r.source == "bank_receipt_screenshot":
                entry = {"amount": None, "currency": None, "date": None,
                         "applicant": r.applicant, "beneficiary": r.beneficiary}
                parsed_a, parsed_c = parse_amount(r.amount_raw)
                if parsed_a is not None:
                    entry["amount"] = parsed_a
                if parsed_c:
                    entry["currency"] = parsed_c
                parsed_d = parse_date(r.date_raw)
                if parsed_d:
                    entry["date"] = parsed_d
                screenshot_records[r.lc_number] = entry

        for r in batch_input.records:
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
                "amount": None, "currency": None, "date": None,
            }

            existing_screenshot = screenshot_records.get(r.lc_number)
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
                        (record_id, c["field_name"], c.get("imported_value"),
                         c.get("screenshot_value"), c.get("suggested_action")),
                    )

    print(f"样例加载完成：批次 {batch_input.batch_id}，共 {len(batch_input.records)} 条记录")

    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, lc_number, status, suggested_action FROM record ORDER BY id"
        ).fetchall()
        for row in rows:
            print(f"  ID={row['id']} | {row['lc_number']} | 状态={row['status']}")
            if row["suggested_action"]:
                print(f"         → {row['suggested_action']}")


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else None
    load_samples(path)
