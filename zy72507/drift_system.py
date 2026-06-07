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


@dataclass
class AnnotatorComment:
    store_id: str
    comment_id: str
    original_line_no: int
    content: str
    sentiment_label: str
    batch_id: Optional[int] = None
    id: Optional[int] = None
    import_hash: Optional[str] = None


@dataclass
class ModelOutput:
    comment_id: str
    fragment_text: str
    sentiment_pred: str
    model_version: Optional[str] = None
    confidence: Optional[float] = None
    batch_id: Optional[int] = None
    id: Optional[int] = None


@dataclass
class DriftRecord:
    comment_id: str
    store_id: Optional[str] = None
    annotator_comment_id: Optional[int] = None
    model_output_id: Optional[int] = None
    original_sentiment: Optional[str] = None
    current_sentiment: Optional[str] = None
    drift_detected: int = 0
    status: str = "pending"
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    id: Optional[int] = None


def compute_import_hash(rows: List[Dict]) -> str:
    content = json.dumps(rows, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


class DataAccessor:
    @staticmethod
    def get_record_by_comment_id(comment_id: str) -> Optional[Dict]:
        conn = get_db()
        row = conn.execute(
            """
            SELECT 
                sdr.*,
                ac.original_line_no, ac.content as annotator_content, ac.sentiment_label as annotator_sentiment,
                mo.fragment_text, mo.sentiment_pred as model_sentiment, mo.confidence
            FROM sentiment_drift_records sdr
            LEFT JOIN annotator_comments ac ON sdr.annotator_comment_id = ac.id
            LEFT JOIN model_outputs mo ON sdr.model_output_id = mo.id
            WHERE sdr.comment_id = ?
            """,
            (comment_id,),
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def list_records(status: Optional[str] = None, store_id: Optional[str] = None) -> List[Dict]:
        conn = get_db()
        query = """
            SELECT 
                sdr.*,
                ac.original_line_no, ac.content as annotator_content, ac.sentiment_label as annotator_sentiment,
                mo.fragment_text, mo.sentiment_pred as model_sentiment, mo.confidence
            FROM sentiment_drift_records sdr
            LEFT JOIN annotator_comments ac ON sdr.annotator_comment_id = ac.id
            LEFT JOIN model_outputs mo ON sdr.model_output_id = mo.id
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
        return [dict(r) for r in rows]

    @staticmethod
    def get_manual_adjustments(record_id: int) -> List[Dict]:
        conn = get_db()
        rows = conn.execute(
            "SELECT * FROM manual_adjustments WHERE record_id = ? ORDER BY adjusted_at DESC",
            (record_id,),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_status_history(record_id: int) -> List[Dict]:
        conn = get_db()
        rows = conn.execute(
            "SELECT * FROM status_history WHERE record_id = ? ORDER BY changed_at DESC",
            (record_id,),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]


class ImportService:
    @staticmethod
    def import_annotator_comments(rows: List[Dict], source_file: Optional[str] = None) -> Dict:
        conn = get_db()
        import_hash = compute_import_hash(rows)
        existing = conn.execute(
            "SELECT id FROM import_batches WHERE import_hash = ?", (import_hash,)
        ).fetchone()
        if existing:
            conn.close()
            return {
                "batch_id": existing["id"],
                "duplicate": True,
                "record_count": 0,
                "duplicate_count": len(rows),
                "message": "重复导入，已跳过",
            }

        batch = conn.execute(
            "INSERT INTO import_batches (batch_type, source_file, import_hash) VALUES (?, ?, ?)",
            ("annotator", source_file, import_hash),
        )
        batch_id = batch.lastrowid

        record_count = 0
        duplicate_count = 0

        for idx, row in enumerate(rows, start=1):
            try:
                cur = conn.execute(
                    """INSERT INTO annotator_comments 
                    (batch_id, store_id, comment_id, original_line_no, content, sentiment_label, import_hash)
                    VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        batch_id,
                        row["store_id"],
                        row["comment_id"],
                        row.get("original_line_no", idx),
                        row["content"],
                        row["sentiment_label"],
                        import_hash,
                    ),
                )
                annotator_id = cur.lastrowid
                record_count += 1

                existing_record = conn.execute(
                    "SELECT id, original_sentiment, current_sentiment FROM sentiment_drift_records WHERE comment_id = ?",
                    (row["comment_id"],),
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
                            row["comment_id"],
                            row["store_id"],
                            annotator_id,
                            row["sentiment_label"],
                            row["sentiment_label"],
                        ),
                    )
                    dr_id = conn.execute("SELECT last_insert_rowid() as id").fetchone()["id"]
                    conn.execute(
                        "INSERT INTO status_history (record_id, new_status, changed_by, reason) VALUES (?, ?, ?, ?)",
                        (dr_id, "annotator_imported", "system", "标注员留言导入"),
                    )
            except sqlite3.IntegrityError:
                duplicate_count += 1

        conn.execute(
            "UPDATE import_batches SET record_count = ?, duplicate_count = ? WHERE id = ?",
            (record_count, duplicate_count, batch_id),
        )
        conn.commit()
        conn.close()

        return {
            "batch_id": batch_id,
            "duplicate": False,
            "record_count": record_count,
            "duplicate_count": duplicate_count,
            "message": "导入完成，成功{}条，重复{}条".format(record_count, duplicate_count),
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
                "duplicate": True,
                "record_count": 0,
                "duplicate_count": len(rows),
                "message": "重复导入，已跳过",
            }

        batch = conn.execute(
            "INSERT INTO import_batches (batch_type, source_file, import_hash) VALUES (?, ?, ?)",
            ("model", source_file, import_hash),
        )
        batch_id = batch.lastrowid

        record_count = 0
        for row in rows:
            cur = conn.execute(
                """INSERT INTO model_outputs 
                (batch_id, comment_id, fragment_text, sentiment_pred, model_version, confidence)
                VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    batch_id,
                    row["comment_id"],
                    row["fragment_text"],
                    row["sentiment_pred"],
                    row.get("model_version"),
                    row.get("confidence"),
                ),
            )
            model_id = cur.lastrowid
            record_count += 1

            existing_record = conn.execute(
                "SELECT id, status, current_sentiment, original_sentiment FROM sentiment_drift_records WHERE comment_id = ?",
                (row["comment_id"],),
            ).fetchone()

            if existing_record:
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
                    conn.execute(
                        "INSERT INTO status_history (record_id, old_status, new_status, changed_by, reason) VALUES (?, ?, ?, ?, ?)",
                        (orig["id"], orig["status"], new_status, "system", "模型输出导入，检测到情绪漂移" if drift else "模型输出导入"),
                    )
            else:
                conn.execute(
                    """INSERT INTO sentiment_drift_records
                    (comment_id, model_output_id, current_sentiment, status)
                    VALUES (?, ?, ?, 'model_only')""",
                    (row["comment_id"], model_id, row["sentiment_pred"]),
                )

        conn.execute(
            "UPDATE import_batches SET record_count = ? WHERE id = ?",
            (record_count, batch_id),
        )
        conn.commit()
        conn.close()

        return {
            "batch_id": batch_id,
            "duplicate": False,
            "record_count": record_count,
            "duplicate_count": 0,
            "message": "模型输出导入完成，共{}条".format(record_count),
        }


class AdjustmentService:
    @staticmethod
    def manual_adjust(record_id: int, new_sentiment: str, adjusted_by: str, note: Optional[str] = None) -> Dict:
        conn = get_db()
        record = conn.execute(
            "SELECT id, current_sentiment, status FROM sentiment_drift_records WHERE id = ?",
            (record_id,),
        ).fetchone()
        if not record:
            conn.close()
            return {"success": False, "message": "记录不存在"}

        old_sentiment = record["current_sentiment"]
        old_status = record["status"]

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
            (record_id, old_status, new_status, adjusted_by, "人工改判"),
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": "人工改判完成"}

    @staticmethod
    def batch_rerun(comment_ids: List[str], new_sentiments: Dict[str, str], run_by: str) -> Dict:
        conn = get_db()
        overridden_count = 0
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
                    (rec["id"], rec["status"], new_status, run_by, "批跑覆盖人工改判，待安全审核复核"),
                )
                overridden_count += 1
            else:
                new_status = "batch_rerun"

            conn.execute(
                "UPDATE sentiment_drift_records SET current_sentiment = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                (new_sentiment, new_status, rec["id"]),
            )

        conn.commit()
        conn.close()
        return {
            "success": True,
            "overridden_count": overridden_count,
            "message": "批跑完成，{}条人工改判被覆盖，需复核".format(overridden_count),
        }

    @staticmethod
    def review_overridden(record_id: int, reviewed_by: str, final_sentiment: str, status: str = "reviewed") -> Dict:
        conn = get_db()
        record = conn.execute(
            "SELECT id, status FROM sentiment_drift_records WHERE id = ?",
            (record_id,),
        ).fetchone()
        if not record:
            conn.close()
            return {"success": False, "message": "记录不存在"}

        old_status = record["status"]
        conn.execute(
            "UPDATE sentiment_drift_records SET current_sentiment = ?, status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (final_sentiment, status, reviewed_by, record_id),
        )
        conn.execute(
            "INSERT INTO status_history (record_id, old_status, new_status, changed_by, reason) VALUES (?, ?, ?, ?, ?)",
            (record_id, old_status, status, reviewed_by, "安全审核复核完成"),
        )
        conn.commit()
        conn.close()
        return {"success": True, "message": "复核完成"}


class SelfCheckService:
    @staticmethod
    def check_duplicate_import() -> Dict:
        conn = get_db()
        hashes = conn.execute(
            "SELECT import_hash, COUNT(*) as cnt FROM import_batches GROUP BY import_hash HAVING cnt > 1"
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
            "status": "passed" if len(issues) == 0 else "warning",
            "issues": issues,
        }

    @staticmethod
    def check_adjustment_overridden() -> Dict:
        conn = get_db()
        records = conn.execute(
            """
            SELECT sdr.id, sdr.comment_id, sdr.status, ma.adjusted_by, ma.adjusted_at
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
            "status": "passed" if len(issues) == 0 else "warning",
            "pending_review": len(issues),
            "issues": issues,
        }

    @staticmethod
    def check_recompute_after_supplement() -> Dict:
        conn = get_db()
        records = conn.execute(
            """
            SELECT id, comment_id, status, updated_at
            FROM sentiment_drift_records
            WHERE status IN ('annotator_imported', 'model_only')
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
            "status": "passed" if len(issues) == 0 else "warning",
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

        status = "passed"
        details = {
            "drift_records": count_api,
            "annotator_comments": count_annotator,
            "model_outputs": count_model,
        }
        if count_api < max(count_annotator, count_model):
            status = "warning"
            details["issue"] = "部分评论未整合到漂移记录中"

        conn.execute(
            "INSERT INTO self_check_logs (check_type, status, details) VALUES (?, ?, ?)",
            ("export_consistency", status, json.dumps(details, ensure_ascii=False)),
        )
        conn.commit()
        conn.close()
        return {
            "check": "export_consistency",
            "status": status,
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
    def export_details(filepath: str, status: Optional[str] = None) -> Dict:
        records = DataAccessor.list_records(status=status)
        with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
            if not records:
                return {"success": True, "count": 0}
            fieldnames = [
                "comment_id", "store_id", "original_line_no",
                "annotator_content", "annotator_sentiment",
                "fragment_text", "model_sentiment", "confidence",
                "original_sentiment", "current_sentiment",
                "drift_detected", "status", "reviewed_by", "updated_at",
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for r in records:
                writer.writerow(r)
        return {"success": True, "count": len(records), "filepath": filepath}


class ReportService:
    @staticmethod
    def generate_report() -> Dict:
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
        conn.close()
        return {
            "total_records": total,
            "drift_count": drift,
            "drift_rate": round(drift / total * 100, 2) if total > 0 else 0,
            "status_distribution": {r["status"]: r["cnt"] for r in by_status},
            "store_distribution": [dict(r) for r in by_store],
            "pending_review_overridden": overridden,
            "generated_at": datetime.now().isoformat(),
        }


if __name__ == "__main__":
    init_db()
    print("数据库初始化完成")
