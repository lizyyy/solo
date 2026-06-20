import hashlib
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd
from models import get_conn


REQUIRED_COLS = ["批次号", "材料名称"]
OPTIONAL_COLS = ["材料编码", "规格型号", "测量值", "单位", "供应商", "备注"]


def _row_hash(rec: Dict) -> str:
    key = json.dumps({
        "b": rec.get("batch_no"),
        "c": rec.get("material_code"),
        "n": rec.get("material_name"),
        "s": rec.get("spec_model"),
        "v": rec.get("measured_value"),
        "u": rec.get("unit"),
        "sup": rec.get("supplier"),
    }, sort_keys=True, ensure_ascii=False)
    return hashlib.md5(key.encode("utf-8")).hexdigest()[:16]


def _business_key(rec: Dict) -> str:
    return "|".join(filter(None, [
        rec.get("batch_no") or "",
        rec.get("material_code") or "",
        rec.get("material_name") or "",
        rec.get("spec_model") or "",
    ]))


def generate_sample_excel(output_path: str):
    data = [
        {"批次号": "B2026-06001", "材料编码": "ZZ-001", "材料名称": "板式橡胶支座",
         "规格型号": "GJZ200x200x42", "测量值": 42.1, "单位": "mm",
         "供应商": "衡橡科技", "备注": "正常到货"},
        {"批次号": "B2026-06001", "材料编码": "ZZ-001", "材料名称": "板式橡胶支座",
         "规格型号": "GJZ200x200x42", "测量值": 41.8, "单位": "mm",
         "供应商": "衡橡科技", "备注": ""},
        {"批次号": "B2026-06001", "材料编码": "ZZ-001", "材料名称": "板式橡胶支座",
         "规格型号": "GJZ200x200x42", "测量值": 42.0, "单位": "mm",
         "供应商": "衡橡科技", "备注": ""},
        {"批次号": "B2026-06001", "材料编码": "ZZ-001", "材料名称": "板式橡胶支座",
         "规格型号": "GJZ200x200x42", "测量值": 41.9, "单位": "mm",
         "供应商": "衡橡科技", "备注": ""},
        {"批次号": "B2026-06001", "材料编码": "ZZ-001", "材料名称": "板式橡胶支座",
         "规格型号": "GJZ200x200x42", "测量值": 42.2, "单位": "mm",
         "供应商": "衡橡科技", "备注": ""},
        {"批次号": "B2026-06001", "材料编码": "ZZ-001", "材料名称": "板式橡胶支座",
         "规格型号": "GJZ200x200x42", "测量值": 41.7, "单位": "mm",
         "供应商": "衡橡科技", "备注": ""},
        {"批次号": "B2026-06001", "材料编码": "ZZ-001", "材料名称": "板式橡胶支座",
         "规格型号": "GJZ200x200x42", "测量值": 35.5, "单位": "mm",
         "供应商": "衡橡科技", "备注": "严重偏低，需复核（异常，会被IQR检出）"},
        {"批次号": "B2026-06001", "材料编码": "ZZ-001", "材料名称": "板式橡胶支座",
         "规格型号": "GJZ200x200x42", "测量值": 52.3, "单位": "mm",
         "供应商": "衡橡科技", "备注": "严重偏高，需复核（异常，会被IQR检出）"},
        {"批次号": "B2026-06001", "材料编码": "ZZ-002", "材料名称": "盆式橡胶支座",
         "规格型号": "GPZ(II)2.5DX", "测量值": 285, "单位": "mm",
         "供应商": "中交橡一", "备注": ""},
        {"批次号": "B2026-06001", "材料编码": "ZZ-002", "材料名称": "盆式橡胶支座",
         "规格型号": "GPZ(II)2.5DX", "测量值": 283, "单位": "mm",
         "供应商": "中交橡一", "备注": ""},
        {"批次号": "B2026-06001", "材料编码": "ZZ-002", "材料名称": "盆式橡胶支座",
         "规格型号": "GPZ(II)2.5DX", "测量值": 284, "单位": "mm",
         "供应商": "中交橡一", "备注": ""},
        {"批次号": "B2026-06001", "材料编码": "ZZ-002", "材料名称": "盆式橡胶支座",
         "规格型号": "GPZ(II)2.5DX", "测量值": 286, "单位": "mm",
         "供应商": "中交橡一", "备注": ""},
        {"批次号": "B2026-06001", "材料编码": "ZZ-002", "材料名称": "盆式橡胶支座",
         "规格型号": "GPZ(II)2.5DX", "测量值": 282, "单位": "mm",
         "供应商": "中交橡一", "备注": ""},
        {"批次号": "B2026-06001", "材料编码": "ZZ-002", "材料名称": "盆式橡胶支座",
         "规格型号": "GPZ(II)2.5DX", "测量值": 284, "单位": "mm",
         "供应商": "中交橡一", "备注": ""},
        {"批次号": "B2026-06001", "材料编码": "ZZ-002", "材料名称": "盆式橡胶支座",
         "规格型号": "GPZ(II)2.5DX", "测量值": 310, "单位": "mm",
         "供应商": "中交橡一", "备注": "偏高，疑似混批（异常）"},
        {"批次号": "B2026-06001", "材料编码": "ZZ-003", "材料名称": "球型支座",
         "规格型号": "QZ1000GD", "测量值": None, "单位": "mm",
         "供应商": "宝力集团", "备注": "测量值后补，先入库（不齐整材料）"},
        {"批次号": "B2026-06001", "材料编码": "", "材料名称": "滑板式橡胶支座",
         "规格型号": "", "测量值": 38.0, "单位": "",
         "供应商": "", "备注": "缺编码/规格/单位/供应商，信息待补（不齐整）"},
        {"批次号": "B2026-06001", "材料编码": "ZZ-005", "材料名称": "高阻尼橡胶支座",
         "规格型号": "HDR(I)-D550x132-G1.0", "测量值": 132.5, "单位": "mm",
         "供应商": "时代新材", "备注": ""},
        {"批次号": "B2026-06001", "材料编码": "ZZ-005", "材料名称": "高阻尼橡胶支座",
         "规格型号": "HDR(I)-D550x132-G1.0", "测量值": 131.8, "单位": "mm",
         "供应商": "时代新材", "备注": ""},
        {"批次号": "B2026-06001", "材料编码": "ZZ-005", "材料名称": "高阻尼橡胶支座",
         "规格型号": "HDR(I)-D550x132-G1.0", "测量值": 132.2, "单位": "mm",
         "供应商": "时代新材", "备注": ""},
    ]
    df = pd.DataFrame(data)
    df.to_excel(output_path, index=False, sheet_name="备件清单")
    return output_path


def parse_excel_to_records(file_path: str) -> List[Dict[str, Any]]:
    df = pd.read_excel(file_path, dtype=str)
    df.columns = [str(c).strip() for c in df.columns]

    missing_req = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing_req:
        raise ValueError(f"缺少必填列: {missing_req}")

    records = []
    for _, row in df.iterrows():
        def _get(col):
            if col not in df.columns:
                return None
            v = row[col]
            if pd.isna(v):
                return None
            return str(v).strip() or None

        batch_no = _get("批次号")
        material_name = _get("材料名称")
        if not batch_no or not material_name:
            continue

        raw_value = _get("测量值")
        measured_value = None
        if raw_value:
            try:
                measured_value = float(raw_value)
            except (ValueError, TypeError):
                measured_value = None

        material_code = _get("材料编码")
        spec_model = _get("规格型号")
        unit = _get("单位")
        supplier = _get("供应商")
        raw_remark = _get("备注")

        is_complete = 1
        incomplete_fields = []
        if not material_code:
            incomplete_fields.append("材料编码")
        if not spec_model:
            incomplete_fields.append("规格型号")
        if measured_value is None:
            incomplete_fields.append("测量值")
        if not unit:
            incomplete_fields.append("单位")
        if not supplier:
            incomplete_fields.append("供应商")
        if incomplete_fields:
            is_complete = 0
            if raw_remark:
                raw_remark = f"{raw_remark} | 不齐整:缺{','.join(incomplete_fields)}"
            else:
                raw_remark = f"不齐整:缺{','.join(incomplete_fields)}，后补"

        records.append({
            "batch_no": batch_no,
            "material_code": material_code,
            "material_name": material_name,
            "spec_model": spec_model,
            "measured_value": measured_value,
            "unit": unit,
            "supplier": supplier,
            "raw_remark": raw_remark,
            "is_complete": is_complete
        })

    return records


def import_spare_parts(file_path: str, file_name: Optional[str] = None,
                       operator: str = "导入人") -> Dict[str, Any]:
    batch_id = f"IMP-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"
    records = parse_excel_to_records(file_path)

    conn = get_conn()
    c = conn.cursor()

    try:
        c.execute("""
            INSERT INTO import_batch (batch_id, file_name, total_count, imported_at, imported_by)
            VALUES (?, ?, ?, ?, ?)
        """, (
            batch_id,
            file_name or file_path.split("/")[-1],
            len(records),
            datetime.now().isoformat(),
            operator
        ))
        conn.commit()

        success = 0
        duplicates = 0
        incomplete = 0
        skipped_due_remark = 0

        seen_hashes_in_this_batch = set()
        duplicate_detail = []
        skipped_due_remark_detail = []
        incomplete_detail = []
        reused_ids = []

        for rec in records:
            rh = _row_hash(rec)

            if rh in seen_hashes_in_this_batch:
                duplicates += 1
                duplicate_detail.append({
                    "batch_no": rec["batch_no"],
                    "material_code": rec.get("material_code"),
                    "material_name": rec["material_name"],
                    "spec_model": rec.get("spec_model"),
                    "measured_value": rec.get("measured_value"),
                    "reason": "本批次内重复"
                })
                continue
            seen_hashes_in_this_batch.add(rh)

            existing = conn.execute("""
                SELECT id, manual_remark, import_batch_id, row_hash
                FROM spare_parts
                WHERE row_hash = ?
                LIMIT 1
            """, (rh,)).fetchone()

            if not existing:
                bk = _business_key(rec)
                existing = conn.execute("""
                    SELECT id, manual_remark, import_batch_id, row_hash
                    FROM spare_parts
                    WHERE batch_no = COALESCE(?, batch_no)
                      AND COALESCE(material_code, '') = COALESCE(?, COALESCE(material_code, ''))
                      AND material_name = ?
                      AND COALESCE(spec_model, '') = COALESCE(?, COALESCE(spec_model, ''))
                      AND ABS(COALESCE(measured_value, -999999) - COALESCE(?, -999999)) < 0.001
                    LIMIT 1
                """, (
                    rec["batch_no"] or None,
                    rec.get("material_code") or "",
                    rec["material_name"],
                    rec.get("spec_model") or "",
                    rec.get("measured_value") if rec.get("measured_value") is not None else -999999
                )).fetchone()

            if existing:
                duplicates += 1
                reused_ids.append(existing["id"])

                if existing["manual_remark"]:
                    skipped_due_remark += 1
                    skipped_due_remark_detail.append({
                        "spare_part_id": existing["id"],
                        "batch_no": rec["batch_no"],
                        "material_name": rec["material_name"],
                        "spec_model": rec.get("spec_model"),
                        "measured_value": rec.get("measured_value"),
                        "existing_manual_remark": existing["manual_remark"],
                        "original_import_batch": existing["import_batch_id"]
                    })
                    duplicate_detail.append({
                        "batch_no": rec["batch_no"],
                        "material_code": rec.get("material_code"),
                        "material_name": rec["material_name"],
                        "spec_model": rec.get("spec_model"),
                        "measured_value": rec.get("measured_value"),
                        "reason": "跨批次重复（已有人工备注，已保留）",
                        "existing_id": existing["id"]
                    })
                else:
                    duplicate_detail.append({
                        "batch_no": rec["batch_no"],
                        "material_code": rec.get("material_code"),
                        "material_name": rec["material_name"],
                        "spec_model": rec.get("spec_model"),
                        "measured_value": rec.get("measured_value"),
                        "reason": "跨批次重复（普通记录，已跳过）",
                        "existing_id": existing["id"]
                    })
                continue

            if not rec["is_complete"]:
                field_map = {
                    "材料编码": "material_code",
                    "规格型号": "spec_model",
                    "测量值": "measured_value",
                    "单位": "unit",
                    "供应商": "supplier"
                }
                missing_fields = []
                for label, key in field_map.items():
                    val = rec.get(key)
                    if val is None or (isinstance(val, str) and val == ""):
                        missing_fields.append(label)
                incomplete_detail.append({
                    "spare_part_id": None,
                    "batch_no": rec["batch_no"],
                    "material_name": rec["material_name"],
                    "spec_model": rec.get("spec_model"),
                    "remark": rec["raw_remark"],
                    "missing_fields": missing_fields
                })

            try:
                c.execute("""
                    INSERT INTO spare_parts (
                        batch_no, material_code, material_name, spec_model, measured_value,
                        unit, supplier, import_batch_id, raw_remark, manual_remark,
                        is_complete, created_at, row_hash
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    rec["batch_no"], rec.get("material_code"), rec["material_name"],
                    rec.get("spec_model"), rec.get("measured_value"), rec.get("unit"), rec.get("supplier"),
                    batch_id, rec.get("raw_remark"),
                    None,
                    rec["is_complete"],
                    datetime.now().isoformat(),
                    rh
                ))
                new_id = c.lastrowid
                reused_ids.append(new_id)
                success += 1
                if not rec["is_complete"]:
                    incomplete += 1
                    if incomplete_detail and incomplete_detail[-1]["spare_part_id"] is None:
                        incomplete_detail[-1]["spare_part_id"] = new_id
            except Exception as e:
                if "UNIQUE" in str(e):
                    duplicates += 1
                    duplicate_detail.append({
                        "batch_no": rec["batch_no"],
                        "material_code": rec.get("material_code"),
                        "material_name": rec["material_name"],
                        "spec_model": rec.get("spec_model"),
                        "measured_value": rec.get("measured_value"),
                        "reason": "数据库唯一约束冲突"
                    })
                else:
                    raise

        c.execute("""
            UPDATE import_batch
            SET success_count=?, duplicate_count=?, incomplete_count=?
            WHERE batch_id=?
        """, (success, duplicates, incomplete, batch_id))

        pending_warnings = []
        if reused_ids:
            placeholders = ",".join("?" * len(reused_ids))
            warnings = conn.execute(f"""
                SELECT wr.id, wr.level, wr.anomaly_type, wr.status, wr.conclusion,
                       sp.material_name, sp.spec_model, sp.batch_no,
                       aq.queue_status, aq.file_conclusion
                FROM warning_record wr
                JOIN spare_parts sp ON wr.spare_part_id = sp.id
                JOIN anomaly_queue aq ON aq.warning_record_id = wr.id
                WHERE wr.spare_part_id IN ({placeholders})
                  AND wr.status NOT IN ('已放行', '需补货')
                ORDER BY CASE wr.level WHEN '严重' THEN 1 WHEN '警告' THEN 2 ELSE 3 END
            """, reused_ids).fetchall()
            pending_warnings = [dict(w) for w in warnings]

        details = {
            "duplicate_detail": duplicate_detail,
            "skipped_due_remark_detail": skipped_due_remark_detail,
            "incomplete_detail": incomplete_detail,
            "pending_warnings": pending_warnings,
            "summary_text": f"共{len(records)}条 → 新增{success}条，跳过重复{duplicates}条（其中{skipped_due_remark}条带人工备注已保留），不齐整{incomplete}条"
        }
        c.execute("UPDATE import_batch SET details_json=? WHERE batch_id=?",
                  (json.dumps(details, ensure_ascii=False), batch_id))

        conn.commit()

        return {
            "success": True,
            "batch_id": batch_id,
            "file_name": file_name or file_path,
            "total": len(records),
            "imported": success,
            "duplicates": duplicates,
            "incomplete": incomplete,
            "skipped_due_manual_remark": skipped_due_remark,
            "reused_spare_part_ids": reused_ids,
            "duplicate_detail": duplicate_detail,
            "skipped_due_remark_detail": skipped_due_remark_detail,
            "incomplete_detail": incomplete_detail,
            "pending_warnings": pending_warnings,
            "summary_text": details["summary_text"]
        }
    except Exception as e:
        conn.rollback()
        return {"success": False, "error": str(e), "batch_id": batch_id}
    finally:
        conn.close()
