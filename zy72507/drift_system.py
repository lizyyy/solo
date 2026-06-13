import sqlite3
import hashlib
import json
import csv
from datetime import datetime
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path

DB_PATH = "drift.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    schema_path = Path(__file__).parent / "schema.sql"
    with open(schema_path, "r") as f:
        schema = f.read()
    conn = get_db()
    conn.executescript(schema)
    conn.commit()
    conn.close()


def compute_import_hash(rows: List[Dict]) -> str:
    content = json.dumps(rows, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def compute_row_hash(row: Dict, keys: List[str]) -> str:
    payload = {k: row.get(k) for k in sorted(keys)}
    return hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()


STATUS_LABEL = {
    "pending": "待处理",
    "annotator_imported": "标注已导入",
    "model_only": "仅有模型结果",
    "drift_detected": "检测到情绪漂移",
    "manually_adjusted": "已人工改判",
    "adjustment_overridden": "人工改判被批跑覆盖（待安全审核）",
    "batch_rerun": "批跑已更新",
    "reviewed": "安全审核已复核",
}


class DataAccessor:
    @staticmethod
    def get_record_by_comment_id(comment_id: str) -> Optional[Dict]:
        conn = get_db()
        row = conn.execute(
            """
            SELECT 
                sdr.*,
                ac.original_line_no, ac.content as annotator_content, ac.sentiment_label as annotator_sentiment,
                ac.batch_id as annotator_batch_id,
                ib_ann.source_file as annotator_source_file, ib_ann.import_time as annotator_import_time,
                mo.fragment_text, mo.sentiment_pred as model_sentiment, mo.confidence,
                mo.batch_id as model_batch_id,
                mo.model_version,
                ib_mod.source_file as model_source_file, ib_mod.import_time as model_import_time
            FROM sentiment_drift_records sdr
            LEFT JOIN annotator_comments ac ON sdr.annotator_comment_id = ac.id
            LEFT JOIN import_batches ib_ann ON ac.batch_id = ib_ann.id
            LEFT JOIN model_outputs mo ON sdr.model_output_id = mo.id
            LEFT JOIN import_batches ib_mod ON mo.batch_id = ib_mod.id
            WHERE sdr.comment_id = ?
            """,
            (comment_id,),
        ).fetchone()
        conn.close()
        if not row:
            return None
        r = dict(row)
        r["status_label"] = STATUS_LABEL.get(r["status"], r["status"])
        r["adjustments"] = DataAccessor.get_manual_adjustments(r["id"]) if r["id"] else []
        r["history"] = DataAccessor.get_status_history(r["id"]) if r["id"] else []
        return r

    @staticmethod
    def list_records(status: Optional[str] = None, store_id: Optional[str] = None) -> List[Dict]:
        conn = get_db()
        query = """
            SELECT 
                sdr.*,
                ac.original_line_no, ac.content as annotator_content, ac.sentiment_label as annotator_sentiment,
                ac.batch_id as annotator_batch_id,
                ib_ann.source_file as annotator_source_file, ib_ann.import_time as annotator_import_time,
                mo.fragment_text, mo.sentiment_pred as model_sentiment, mo.confidence,
                mo.batch_id as model_batch_id,
                mo.model_version,
                ib_mod.source_file as model_source_file, ib_mod.import_time as model_import_time
            FROM sentiment_drift_records sdr
            LEFT JOIN annotator_comments ac ON sdr.annotator_comment_id = ac.id
            LEFT JOIN import_batches ib_ann ON ac.batch_id = ib_ann.id
            LEFT JOIN model_outputs mo ON sdr.model_output_id = mo.id
            LEFT JOIN import_batches ib_mod ON mo.batch_id = ib_mod.id
        """
        params = []
        wheres = []
        if status:
            wheres.append("sdr.status = ?")
            params.append(status)
        if store_id:
            wheres.append("sdr.store_id = ?")
            params.append(store_id)
        if wheres:
            query += " WHERE " + " AND ".join(wheres)
        query += " ORDER BY sdr.updated_at DESC"
        rows = conn.execute(query, params).fetchall()
        conn.close()
        results = []
        for r in rows:
            d = dict(r)
            d["status_label"] = STATUS_LABEL.get(d["status"], d["status"])
            results.append(d)
        return results

    @staticmethod
    def get_manual_adjustments(record_id: int) -> List[Dict]:
        conn = get_db()
        rows = conn.execute(
            "SELECT * FROM manual_adjustments WHERE record_id = ? ORDER BY adjusted_at DESC",
            (record_id,),
        ).fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            d["overridden_label"] = "是" if d.get("overridden") else "否"
            result.append(d)
        return result

    @staticmethod
    def get_status_history(record_id: int) -> List[Dict]:
        conn = get_db()
        rows = conn.execute(
            "SELECT * FROM status_history WHERE record_id = ? ORDER BY changed_at DESC",
            (record_id,),
        ).fetchall()
        conn.close()
        result = []
        for r in rows:
            d = dict(r)
            d["old_status_label"] = STATUS_LABEL.get(d.get("old_status") or "", d.get("old_status") or "-")
            d["new_status_label"] = STATUS_LABEL.get(d.get("new_status") or "", d.get("new_status") or "")
            result.append(d)
        return result

    @staticmethod
    def list_batches(batch_type: Optional[str] = None) -> List[Dict]:
        conn = get_db()
        q = "SELECT * FROM import_batches"
        params = []
        if batch_type:
            q += " WHERE batch_type = ?"
            params.append(batch_type)
        q += " ORDER BY import_time DESC"
        rows = conn.execute(q, params).fetchall()
        conn.close()
        results = []
        for r in rows:
            d = dict(r)
            d["batch_type_label"] = "标注员留言" if d["batch_type"] == "annotator" else "模型输出"
            results.append(d)
        return results

    @staticmethod
    def list_self_check_logs(limit: int = 50) -> List[Dict]:
        conn = get_db()
        rows = conn.execute(
            "SELECT * FROM self_check_logs ORDER BY checked_at DESC LIMIT ?",
            (limit,),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def find_original_material(comment_id: str) -> Dict:
        conn = get_db()
        ann = conn.execute(
            """SELECT ac.*, ib.source_file, ib.import_time 
               FROM annotator_comments ac 
               LEFT JOIN import_batches ib ON ac.batch_id = ib.id 
               WHERE ac.comment_id = ? ORDER BY ac.created_at DESC""",
            (comment_id,),
        ).fetchall()
        mod = conn.execute(
            """SELECT mo.*, ib.source_file, ib.import_time 
               FROM model_outputs mo 
               LEFT JOIN import_batches ib ON mo.batch_id = ib.id 
               WHERE mo.comment_id = ? ORDER BY mo.created_at DESC""",
            (comment_id,),
        ).fetchall()
        adj = conn.execute(
            """SELECT ma.*, sdr.comment_id FROM manual_adjustments ma 
               JOIN sentiment_drift_records sdr ON ma.record_id = sdr.id 
               WHERE sdr.comment_id = ? ORDER BY ma.adjusted_at DESC""",
            (comment_id,),
        ).fetchall()
        conn.close()
        return {
            "comment_id": comment_id,
            "annotator_versions": [dict(a) for a in ann],
            "model_versions": [dict(m) for m in mod],
            "adjustment_trace": [dict(a) for a in adj],
        }


class ImportService:
    @staticmethod
    def import_annotator_comments(rows: List[Dict], source_file: Optional[str] = None) -> Dict:
        conn = get_db()
        import_hash = compute_import_hash(rows)
        existing = conn.execute(
            "SELECT id, record_count, duplicate_count FROM import_batches WHERE import_hash = ?", (import_hash,)
        ).fetchone()
        if existing:
            conn.close()
            return {
                "batch_id": existing["id"],
                "same_file_duplicate": True,
                "new_count": 0,
                "history_duplicate_count": 0,
                "current_duplicate_count": 0,
                "total_count": len(rows),
                "message": "完全相同文件已导入过（同内容Hash），跳过。本次相同文件重复{}条".format(len(rows)),
                "breakdown": {
                    "new": [],
                    "history_duplicate": [],
                    "current_duplicate": [],
                    "same_file_duplicate": [r["comment_id"] for r in rows],
                },
            }

        batch = conn.execute(
            "INSERT INTO import_batches (batch_type, source_file, import_hash) VALUES (?, ?, ?)",
            ("annotator", source_file, import_hash),
        )
        batch_id = batch.lastrowid

        new_count = 0
        history_duplicate_count = 0
        current_duplicate_count = 0
        new_list = []
        history_duplicate_list = []
        current_duplicate_list = []
        seen_in_current = set()

        for idx, row in enumerate(rows, start=1):
            comment_id = row["comment_id"]
            line_no = row.get("original_line_no", idx)
            row_key = "{}#{}".format(comment_id, line_no)

            if row_key in seen_in_current:
                current_duplicate_count += 1
                current_duplicate_list.append({
                    "comment_id": comment_id,
                    "line_no": line_no,
                    "reason": "本批次内comment_id+line_no重复",
                })
                continue
            seen_in_current.add(row_key)

            pre_exist = conn.execute(
                "SELECT id FROM annotator_comments WHERE comment_id = ? AND original_line_no = ?",
                (comment_id, line_no),
            ).fetchone()

            try:
                cur = conn.execute(
                    """INSERT INTO annotator_comments 
                    (batch_id, store_id, comment_id, original_line_no, content, sentiment_label, import_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        batch_id,
                        row["store_id"],
                        comment_id,
                        line_no,
                        row["content"],
                        row["sentiment_label"],
                        import_hash,
                    ),
                )
                annotator_id = cur.lastrowid

                if pre_exist:
                    history_duplicate_count += 1
                    history_duplicate_list.append({
                        "comment_id": comment_id,
                        "line_no": line_no,
                        "reason": "历史批次已存在相同记录，本次补录更新关联",
                    })
                else:
                    new_count += 1
                    new_list.append({"comment_id": comment_id, "line_no": line_no})

                existing_record = conn.execute(
                    "SELECT id, original_sentiment, current_sentiment FROM sentiment_drift_records WHERE comment_id = ?",
                    (comment_id,),
                ).fetchone()

                if existing_record:
                    orig = dict(existing_record)
                    conn.execute(
                        """UPDATE sentiment_drift_records 
                        SET annotator_comment_id = ?, 
                            original_sentiment = COALESCE(original_sentiment, ?),
                            current_sentiment = ?,
                            store_id = ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?""",
                        (
                            annotator_id,
                            row["sentiment_label"],
                            row["sentiment_label"],
                            row["store_id"],
                            orig["id"],
                        ),
                    )
                else:
                    conn.execute(
                        """INSERT INTO sentiment_drift_records
                        (comment_id, store_id, annotator_comment_id, original_sentiment, current_sentiment, status)
                        VALUES (?, ?, ?, ?, ?, 'annotator_imported')""",
                        (
                            comment_id,
                            row["store_id"],
                            annotator_id,
                            row["sentiment_label"],
                            row["sentiment_label"],
                        ),
                    )
                    dr_id = conn.execute("SELECT last_insert_rowid() as id").fetchone()["id"]
                    conn.execute(
                        "INSERT INTO status_history (record_id, new_status, changed_by, reason) VALUES (?, ?, ?, ?)",
                        (dr_id, "annotator_imported", "system", "标注员留言导入(批次#{},源文件:{})".format(batch_id, source_file or "-")),
                    )
            except sqlite3.IntegrityError as e:
                if pre_exist:
                    history_duplicate_count += 1
                    history_duplicate_list.append({
                        "comment_id": comment_id,
                        "line_no": line_no,
                        "reason": "DB唯一约束:历史批次已存在",
                    })
                else:
                    current_duplicate_count += 1
                    current_duplicate_list.append({
                        "comment_id": comment_id,
                        "line_no": line_no,
                        "reason": "DB约束冲突:{}".format(str(e)),
                    })

        total_dup = history_duplicate_count + current_duplicate_count
        conn.execute(
            "UPDATE import_batches SET record_count = ?, duplicate_count = ? WHERE id = ?",
            (new_count + history_duplicate_count, total_dup, batch_id),
        )
        conn.commit()
        conn.close()

        return {
            "batch_id": batch_id,
            "same_file_duplicate": False,
            "new_count": new_count,
            "history_duplicate_count": history_duplicate_count,
            "current_duplicate_count": current_duplicate_count,
            "total_count": len(rows),
            "message": "导入完成：新记录{}条，历史重复{}条，本批次重复{}条".format(
                new_count, history_duplicate_count, current_duplicate_count
            ),
            "breakdown": {
                "new": new_list,
                "history_duplicate": history_duplicate_list,
                "current_duplicate": current_duplicate_list,
                "same_file_duplicate": [],
            },
        }

    @staticmethod
    def import_model_outputs(rows: List[Dict], source_file: Optional[str] = None) -> Dict:
        conn = get_db()
        import_hash = compute_import_hash(rows)
        existing = conn.execute(
            "SELECT id FROM import_batches WHERE import_hash = ?", (import_hash,)
        ).fetchone()
        if existing:
            conn.close()
            return {
                "batch_id": existing["id"],
                "same_file_duplicate": True,
                "new_count": 0,
                "matched_count": 0,
                "unmatched_count": 0,
                "total_count": len(rows),
                "message": "相同文件模型输出已导入过，跳过{}条".format(len(rows)),
            }

        batch = conn.execute(
            "INSERT INTO import_batches (batch_type, source_file, import_hash) VALUES (?, ?, ?)",
            ("model", source_file, import_hash),
        )
        batch_id = batch.lastrowid

        new_count = 0
        matched_count = 0
        unmatched_count = 0

        for row in rows:
            comment_id = row["comment_id"]
            cur = conn.execute(
                """INSERT INTO model_outputs 
                (batch_id, comment_id, fragment_text, sentiment_pred, model_version, confidence)
                VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    batch_id,
                    comment_id,
                    row["fragment_text"],
                    row["sentiment_pred"],
                    row.get("model_version"),
                    row.get("confidence"),
                ),
            )
            model_id = cur.lastrowid

            existing_record = conn.execute(
                "SELECT id, status, current_sentiment, original_sentiment FROM sentiment_drift_records WHERE comment_id = ?",
                (comment_id,),
            ).fetchone()

            if existing_record:
                matched_count += 1
                orig = dict(existing_record)
                drift = 0
                new_status = orig["status"]
                if orig["original_sentiment"] and orig["original_sentiment"] != row["sentiment_pred"]:
                    drift = 1
                    if orig["status"] in ("annotator_imported", "pending"):
                        new_status = "drift_detected"

                conn.execute(
                    """UPDATE sentiment_drift_records 
                    SET model_output_id = ?, 
                        current_sentiment = ?,
                        drift_detected = ?,
                        status = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?""",
                    (
                        model_id,
                        row["sentiment_pred"],
                        drift,
                        new_status,
                        orig["id"],
                    ),
                )
                if new_status != orig["status"]:
                    reason = "模型输出导入(批次#{},源文件:{})，检测到情绪漂移".format(batch_id, source_file or "-") if drift else "模型输出导入(批次#{},源文件:{})".format(batch_id, source_file or "-")
                    conn.execute(
                        "INSERT INTO status_history (record_id, old_status, new_status, changed_by, reason) VALUES (?, ?, ?, ?, ?)",
                        (orig["id"], orig["status"], new_status, "system", reason),
                    )
            else:
                new_count += 1
                unmatched_count += 1
                conn.execute(
                    """INSERT INTO sentiment_drift_records
                    (comment_id, model_output_id, current_sentiment, status)
                    VALUES (?, ?, ?, 'model_only')""",
                    (comment_id, model_id, row["sentiment_pred"]),
                )

        conn.execute(
            "UPDATE import_batches SET record_count = ? WHERE id = ?",
            (new_count + matched_count, batch_id),
        )
        conn.commit()
        conn.close()

        return {
            "batch_id": batch_id,
            "same_file_duplicate": False,
            "new_count": new_count,
            "matched_count": matched_count,
            "unmatched_count": unmatched_count,
            "total_count": len(rows),
            "message": "模型导入完成：已匹配标注{}条，新建(无对应标注){}条，共{}条".format(matched_count, unmatched_count, len(rows)),
        }


class AdjustmentService:
    @staticmethod
    def manual_adjust(record_id: int, new_sentiment: str, adjusted_by: str, note: Optional[str] = None) -> Dict:
        conn = get_db()
        record = conn.execute(
            "SELECT id, comment_id, current_sentiment, status FROM sentiment_drift_records WHERE id = ?",
            (record_id,),
        ).fetchone()
        if not record:
            conn.close()
            return {"success": False, "message": "记录不存在"}

        old_sentiment = record["current_sentiment"]
        old_status = record["status"]
        comment_id = record["comment_id"]

        if old_sentiment == new_sentiment:
            conn.close()
            return {"success": False, "message": "新旧情绪一致，无需改判"}

        conn.execute(
            "INSERT INTO manual_adjustments (record_id, old_sentiment, new_sentiment, adjusted_by, note) VALUES (?, ?, ?, ?, ?)",
            (record_id, old_sentiment, new_sentiment, adjusted_by, note),
        )

        new_status = "manually_adjusted"
        conn.execute(
            "UPDATE sentiment_drift_records SET current_sentiment = ?, status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_sentiment, new_status, adjusted_by, record_id),
        )
        conn.execute(
            "INSERT INTO status_history (record_id, old_status, new_status, changed_by, reason) VALUES (?, ?, ?, ?, ?)",
            (record_id, old_status, new_status, adjusted_by, "人工改判:{}→{}".format(old_sentiment, new_sentiment)),
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": "人工改判完成({})".format(comment_id), "comment_id": comment_id}

    @staticmethod
    def batch_rerun(comment_ids: List[str], new_sentiments: Dict[str, str], run_by: str) -> Dict:
        conn = get_db()
        overridden_count = 0
        normal_count = 0
        overridden_list = []
        for comment_id in comment_ids:
            record = conn.execute(
                "SELECT id, status, current_sentiment FROM sentiment_drift_records WHERE comment_id = ?",
                (comment_id,),
            ).fetchone()
            if not record:
                continue
            rec = dict(record)
            new_sentiment = new_sentiments.get(comment_id, rec["current_sentiment"])

            if rec["status"] == "manually_adjusted":
                adj = conn.execute(
                    "SELECT id FROM manual_adjustments WHERE record_id = ? AND overridden = 0 ORDER BY adjusted_at DESC LIMIT 1",
                    (rec["id"],),
                ).fetchone()
                if adj:
                    conn.execute(
                        "UPDATE manual_adjustments SET overridden = 1, overridden_by = ?, overridden_at = CURRENT_TIMESTAMP WHERE id = ?",
                        (run_by, adj["id"]),
                    )

                new_status = "adjustment_overridden"
                conn.execute(
                    "INSERT INTO status_history (record_id, old_status, new_status, changed_by, reason) VALUES (?, ?, ?, ?, ?)",
                    (rec["id"], rec["status"], new_status, run_by,
                     "批跑覆盖人工改判（{}），情绪变更为{}，待安全审核复核".format(run_by, new_sentiment)),
                )
                overridden_count += 1
                overridden_list.append({
                    "comment_id": comment_id,
                    "old_sentiment": rec["current_sentiment"],
                    "new_sentiment": new_sentiment,
                })
            else:
                new_status = "batch_rerun"
                normal_count += 1

            conn.execute(
                "UPDATE sentiment_drift_records SET current_sentiment = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (new_sentiment, new_status, rec["id"]),
            )

        conn.commit()
        conn.close()
        return {
            "success": True,
            "overridden_count": overridden_count,
            "normal_count": normal_count,
            "overridden_list": overridden_list,
            "message": "批跑完成：{}条人工改判被覆盖（需安全审核），{}条普通更新".format(overridden_count, normal_count),
        }

    @staticmethod
    def review_overridden(record_id: int, reviewed_by: str, final_sentiment: str, status: str = "reviewed") -> Dict:
        conn = get_db()
        record = conn.execute(
            "SELECT id, comment_id, status FROM sentiment_drift_records WHERE id = ?",
            (record_id,),
        ).fetchone()
        if not record:
            conn.close()
            return {"success": False, "message": "记录不存在"}

        old_status = record["status"]
        comment_id = record["comment_id"]
        conn.execute(
            "UPDATE sentiment_drift_records SET current_sentiment = ?, status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (final_sentiment, status, reviewed_by, record_id),
        )
        conn.execute(
            "INSERT INTO status_history (record_id, old_status, new_status, changed_by, reason) VALUES (?, ?, ?, ?, ?)",
            (record_id, old_status, status, reviewed_by,
             "安全审核复核完成，最终认定情绪为{}".format(final_sentiment)),
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": "复核完成({})".format(comment_id), "comment_id": comment_id}


class SelfCheckService:
    @staticmethod
    def check_duplicate_import() -> Dict:
        conn = get_db()
        hashes = conn.execute(
            "SELECT import_hash, COUNT(*) as cnt, GROUP_CONCAT(id) as batch_ids FROM import_batches GROUP BY import_hash HAVING cnt > 1"
        ).fetchall()
        issues = [dict(h) for h in hashes]
        conn.execute(
            "INSERT INTO self_check_logs (check_type, status, details) VALUES (?, ?, ?)",
            (
                "duplicate_import",
                "passed" if len(issues) == 0 else "warning",
                json.dumps(issues, ensure_ascii=False),
            ),
        )
        conn.commit()
        conn.close()
        return {
            "check": "duplicate_import",
            "check_label": "重复导入检测",
            "status": "passed" if len(issues) == 0 else "warning",
            "status_label": "通过" if len(issues) == 0 else "告警",
            "issues": issues,
        }

    @staticmethod
    def check_adjustment_overridden() -> Dict:
        conn = get_db()
        records = conn.execute(
            """
            SELECT sdr.id, sdr.comment_id, sdr.store_id, sdr.status, sdr.current_sentiment,
                   ma.adjusted_by, ma.adjusted_at, ma.old_sentiment, ma.new_sentiment,
                   ma.overridden_by, ma.overridden_at
            FROM sentiment_drift_records sdr
            JOIN manual_adjustments ma ON sdr.id = ma.record_id
            WHERE sdr.status = 'adjustment_overridden' AND ma.overridden = 1
            ORDER BY ma.overridden_at DESC
            """
        ).fetchall()
        issues = [dict(r) for r in records]
        conn.execute(
            "INSERT INTO self_check_logs (check_type, status, details) VALUES (?, ?, ?)",
            (
                "adjustment_overridden",
                "passed" if len(issues) == 0 else "warning",
                json.dumps(issues, ensure_ascii=False),
            ),
        )
        conn.commit()
        conn.close()
        return {
            "check": "adjustment_overridden",
            "check_label": "人工改判被覆盖检测",
            "status": "passed" if len(issues) == 0 else "warning",
            "status_label": "通过" if len(issues) == 0 else "告警",
            "pending_review": len(issues),
            "issues": issues,
        }

    @staticmethod
    def check_recompute_after_supplement() -> Dict:
        conn = get_db()
        records = conn.execute(
            """
            SELECT id, comment_id, status, updated_at,
                   CASE WHEN annotator_comment_id IS NULL THEN '缺少标注' ELSE '缺少模型' END as missing_part
            FROM sentiment_drift_records
            WHERE status IN ('annotator_imported', 'model_only', 'pending')
            AND (annotator_comment_id IS NULL OR model_output_id IS NULL)
            """
        ).fetchall()
        issues = [dict(r) for r in records]
        conn.execute(
            "INSERT INTO self_check_logs (check_type, status, details) VALUES (?, ?, ?)",
            (
                "recompute_after_supplement",
                "passed" if len(issues) == 0 else "warning",
                json.dumps(issues, ensure_ascii=False),
            ),
        )
        conn.commit()
        conn.close()
        return {
            "check": "recompute_after_supplement",
            "check_label": "补录后重算检测",
            "status": "passed" if len(issues) == 0 else "warning",
            "status_label": "通过" if len(issues) == 0 else "告警",
            "incomplete": len(issues),
            "issues": issues,
        }

    @staticmethod
    def check_export_consistency() -> Dict:
        conn = get_db()
        count_api = conn.execute(
            "SELECT COUNT(*) as cnt FROM sentiment_drift_records"
        ).fetchone()["cnt"]
        count_annotator = conn.execute(
            "SELECT COUNT(DISTINCT comment_id) as cnt FROM annotator_comments"
        ).fetchone()["cnt"]
        count_model = conn.execute(
            "SELECT COUNT(DISTINCT comment_id) as cnt FROM model_outputs"
        ).fetchone()["cnt"]
        count_overridden_status = conn.execute(
            "SELECT COUNT(*) as cnt FROM sentiment_drift_records WHERE status = 'adjustment_overridden'"
        ).fetchone()["cnt"]
        count_overridden_flag = conn.execute(
            "SELECT COUNT(DISTINCT record_id) as cnt FROM manual_adjustments WHERE overridden = 1"
        ).fetchone()["cnt"]

        status = "passed"
        details = {
            "drift_records": count_api,
            "annotator_distinct_comments": count_annotator,
            "model_distinct_comments": count_model,
            "overridden_status_count": count_overridden_status,
            "overridden_flag_count": count_overridden_flag,
        }
        issues = []
        if count_api < max(count_annotator, count_model):
            status = "warning"
            issues.append("部分评论未整合到漂移记录中")
        if count_overridden_status != count_overridden_flag:
            status = "warning"
            issues.append("被覆盖状态({})与覆盖标记数({})不一致，需核对".format(
                count_overridden_status, count_overridden_flag
            ))
        details["issues"] = issues
        conn.execute(
            "INSERT INTO self_check_logs (check_type, status, details) VALUES (?, ?, ?)",
            ("export_consistency", status, json.dumps(details, ensure_ascii=False)),
        )
        conn.commit()
        conn.close()
        return {
            "check": "export_consistency",
            "check_label": "导出一致性检测",
            "status": status,
            "status_label": "通过" if status == "passed" else "告警",
            **details,
        }

    @staticmethod
    def run_all_checks() -> List[Dict]:
        return [
            SelfCheckService.check_duplicate_import(),
            SelfCheckService.check_adjustment_overridden(),
            SelfCheckService.check_recompute_after_supplement(),
            SelfCheckService.check_export_consistency(),
        ]


class ExportService:
    @staticmethod
    def export_details(filepath: str, status: Optional[str] = None, store_id: Optional[str] = None) -> Dict:
        records = DataAccessor.list_records(status=status, store_id=store_id)
        conn = get_db()
        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            if not records:
                return {"success": True, "count": 0}
            fieldnames = [
                "comment_id", "store_id",
                "original_line_no", "annotator_content", "annotator_sentiment",
                "annotator_batch_id", "annotator_source_file", "annotator_import_time",
                "model_version", "fragment_text", "model_sentiment", "confidence",
                "model_batch_id", "model_source_file", "model_import_time",
                "original_sentiment", "current_sentiment",
                "drift_detected", "status", "status_label",
                "reviewed_by", "reviewed_at", "created_at", "updated_at",
                "adjustment_count", "last_adjust_by", "last_adjust_time",
                "adjust_overridden_flag", "adjust_overridden_by", "adjust_overridden_time",
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for r in records:
                rid = r["id"]
                adjustments = conn.execute(
                    "SELECT * FROM manual_adjustments WHERE record_id = ? ORDER BY adjusted_at DESC",
                    (rid,),
                ).fetchall()
                r["adjustment_count"] = len(adjustments)
                if adjustments:
                    first = dict(adjustments[0])
                    r["last_adjust_by"] = first.get("adjusted_by")
                    r["last_adjust_time"] = first.get("adjusted_at")
                    r["adjust_overridden_flag"] = "是" if first.get("overridden") else "否"
                    r["adjust_overridden_by"] = first.get("overridden_by")
                    r["adjust_overridden_time"] = first.get("overridden_at")
                else:
                    r["last_adjust_by"] = ""
                    r["last_adjust_time"] = ""
                    r["adjust_overridden_flag"] = ""
                    r["adjust_overridden_by"] = ""
                    r["adjust_overridden_time"] = ""
                writer.writerow(r)
        conn.close()
        return {"success": True, "count": len(records), "filepath": filepath}

    @staticmethod
    def export_overridden_trace(filepath: str) -> Dict:
        conn = get_db()
        rows = conn.execute(
            """
            SELECT 
                sdr.comment_id, sdr.store_id, sdr.status, sdr.status as status_code, sdr.current_sentiment,
                ma.old_sentiment, ma.new_sentiment, ma.adjusted_by, ma.adjusted_at, ma.note,
                ma.overridden, ma.overridden_by, ma.overridden_at,
                ac.original_line_no, ac.content as annotator_content, ac.sentiment_label as annotator_sentiment,
                ib_ann.source_file as annotator_source_file,
                mo.fragment_text, mo.sentiment_pred as model_sentiment
            FROM manual_adjustments ma
            JOIN sentiment_drift_records sdr ON ma.record_id = sdr.id
            LEFT JOIN annotator_comments ac ON sdr.annotator_comment_id = ac.id
            LEFT JOIN import_batches ib_ann ON ac.batch_id = ib_ann.id
            LEFT JOIN model_outputs mo ON sdr.model_output_id = mo.id
            ORDER BY ma.overridden_at DESC, ma.adjusted_at DESC
            """
        ).fetchall()
        conn.close()
        if not rows:
            with open(filepath, "w", encoding="utf-8-sig") as f:
                f.write("无被覆盖的人工改判记录\n")
            return {"success": True, "count": 0, "filepath": filepath}
        fieldnames = [
            "comment_id", "store_id", "status_code", "status",
            "original_line_no", "annotator_source_file",
            "annotator_content", "annotator_sentiment",
            "fragment_text", "model_sentiment",
            "old_sentiment", "new_sentiment", "current_sentiment",
            "adjusted_by", "adjusted_at", "note",
            "overridden", "overridden_by", "overridden_at",
        ]
        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for r in rows:
                d = dict(r)
                d["overridden"] = "是" if d.get("overridden") else "否"
                d["status"] = STATUS_LABEL.get(d.get("status_code"), d.get("status_code", ""))
                writer.writerow(d)
        return {"success": True, "count": len(rows), "filepath": filepath}


class ReportService:
    @staticmethod
    def generate_report(batch_id: Optional[int] = None) -> Dict:
        conn = get_db()
        total = conn.execute("SELECT COUNT(*) as cnt FROM sentiment_drift_records").fetchone()["cnt"]
        drift = conn.execute("SELECT COUNT(*) as cnt FROM sentiment_drift_records WHERE drift_detected = 1").fetchone()["cnt"]
        by_status = conn.execute(
            "SELECT status, COUNT(*) as cnt FROM sentiment_drift_records GROUP BY status"
        ).fetchall()
        by_store = conn.execute(
            "SELECT store_id, COUNT(*) as cnt, SUM(drift_detected) as drift_cnt FROM sentiment_drift_records GROUP BY store_id"
        ).fetchall()
        overridden = conn.execute(
            "SELECT COUNT(*) as cnt FROM sentiment_drift_records WHERE status = 'adjustment_overridden'"
        ).fetchone()["cnt"]
        manual_adjusted = conn.execute(
            "SELECT COUNT(*) as cnt FROM sentiment_drift_records WHERE status = 'manually_adjusted'"
        ).fetchone()["cnt"]
        reviewed = conn.execute(
            "SELECT COUNT(*) as cnt FROM sentiment_drift_records WHERE status = 'reviewed'"
        ).fetchone()["cnt"]

        status_distribution = {}
        for r in by_status:
            code = r["status"]
            status_distribution[code] = {
                "count": r["cnt"],
                "label": STATUS_LABEL.get(code, code),
            }

        batches = conn.execute(
            "SELECT id, batch_type, source_file, import_time, record_count, duplicate_count FROM import_batches ORDER BY import_time DESC LIMIT 10"
        ).fetchall()

        related_batches = []
        if batch_id:
            b = conn.execute("SELECT * FROM import_batches WHERE id = ?", (batch_id,)).fetchone()
            if b:
                related_batches.append(dict(b))

        conn.close()
        return {
            "batch_context": {
                "query_batch_id": batch_id,
                "related_batches": [dict(b) for b in related_batches],
            },
            "import_batches_recent": [dict(b) for b in batches],
            "summary": {
                "total_records": total,
                "drift_count": drift,
                "drift_rate": round(drift / total * 100, 2) if total > 0 else 0,
                "manual_adjusted_count": manual_adjusted,
                "overridden_pending_count": overridden,
                "reviewed_count": reviewed,
            },
            "status_distribution": status_distribution,
            "store_distribution": [
                {
                    **dict(r),
                    "drift_rate": round((r["drift_cnt"] or 0) / r["cnt"] * 100, 2) if r["cnt"] > 0 else 0,
                }
                for r in by_store
            ],
            "generated_at": datetime.now().isoformat(),
            "generated_at_label": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    @staticmethod
    def get_report_summary_text(report: Dict) -> str:
        s = report["summary"]
        lines = [
            "=== 门店评论情绪漂移 - 评测报告 ===",
            "生成时间：{}".format(report["generated_at_label"]),
            "",
            "【核心指标】",
            "  - 总评论数：{}".format(s["total_records"]),
            "  - 情绪漂移数：{} ({}%)".format(s["drift_count"], s["drift_rate"]),
            "  - 已人工改判：{}".format(s["manual_adjusted_count"]),
            "  - 待安全审核(被批跑覆盖)：{}".format(s["overridden_pending_count"]),
            "  - 已安全复核：{}".format(s["reviewed_count"]),
            "",
            "【状态分布】",
        ]
        for code, info in report["status_distribution"].items():
            lines.append("  - {}：{}".format(info["label"], info["count"]))
        return "\n".join(lines)


if __name__ == "__main__":
    init_db()
    print("数据库初始化完成")
