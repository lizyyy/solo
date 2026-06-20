import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Optional, Any

DB_PATH = "medical_review.db"


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS manual_review_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id TEXT NOT NULL,
            original_row_number INTEGER NOT NULL,
            question_id TEXT,
            question TEXT,
            original_conclusion TEXT,
            manual_conclusion TEXT,
            manual_remark TEXT,
            prompt_version TEXT,
            reference_url TEXT,
            reference_url_status TEXT DEFAULT 'unknown',
            current_status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(batch_id, original_row_number)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS review_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id INTEGER NOT NULL,
            field_name TEXT NOT NULL,
            old_value TEXT,
            new_value TEXT,
            operator TEXT,
            change_reason TEXT,
            changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (record_id) REFERENCES manual_review_records(id)
        )
    """)

    try:
        c.execute("ALTER TABLE review_history ADD COLUMN change_reason TEXT")
    except sqlite3.OperationalError:
        pass

    c.execute("""
        CREATE TABLE IF NOT EXISTS batch_rollback_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id TEXT NOT NULL,
            rollback_type TEXT NOT NULL,
            snapshot_before TEXT,
            snapshot_after TEXT,
            rollback_reason TEXT,
            operator TEXT,
            rolled_back_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS conflict_samples (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            record_id INTEGER NOT NULL,
            conflict_type TEXT,
            product_review_status TEXT DEFAULT 'pending',
            product_remark TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (record_id) REFERENCES manual_review_records(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS import_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id TEXT NOT NULL UNIQUE,
            file_name TEXT,
            total_records INTEGER DEFAULT 0,
            imported_by TEXT,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS boundary_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_code TEXT NOT NULL UNIQUE,
            rule_name TEXT NOT NULL,
            description TEXT NOT NULL,
            handling_strategy TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()

    c.execute("SELECT COUNT(*) as cnt FROM boundary_rules")
    if c.fetchone()['cnt'] == 0:
        seed_rules = [
            (
                'REF_404_PASS',
                '引用链接404但原结论为通过',
                '样本的引用链接返回404，但人工改判结论仍标记为"通过"',
                '自动标记为待产品经理复核，不直接归入正常样本；产品经理确认后再更新状态',
            ),
            (
                'PROMPT_VERSION_MISSING',
                '提示词版本号缺失',
                '导入时未填写提示词版本号字段',
                '标记为待补充，知识库编辑补充后才能进入下一步',
            ),
            (
                'CONCLUSION_CONFLICT',
                '结论冲突',
                '原结论与人工改判结论不一致',
                '自动归入冲突样本表，待产品经理复核',
            ),
        ]
        for code, name, desc, strategy in seed_rules:
            c.execute(
                "INSERT INTO boundary_rules (rule_code, rule_name, description, handling_strategy) VALUES (?, ?, ?, ?)",
                (code, name, desc, strategy)
            )
        conn.commit()

    conn.close()


class ManualReviewRecord:
    @staticmethod
    def import_batch(batch_id: str, records: List[Dict], file_name: str = None, imported_by: str = None) -> Dict:
        conn = get_conn()
        c = conn.cursor()

        try:
            c.execute("SELECT id FROM import_batches WHERE batch_id = ?", (batch_id,))
            existing_batch = c.fetchone()

            if existing_batch:
                result = ManualReviewRecord._update_existing_batch(conn, batch_id, records)
            else:
                result = ManualReviewRecord._insert_new_batch(conn, batch_id, records, file_name, imported_by)

            conn.commit()
            return result
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    @staticmethod
    def _insert_new_batch(conn, batch_id: str, records: List[Dict], file_name: str, imported_by: str) -> Dict:
        c = conn.cursor()
        inserted = 0
        skipped = 0

        c.execute(
            "INSERT INTO import_batches (batch_id, file_name, total_records, imported_by) VALUES (?, ?, ?, ?)",
            (batch_id, file_name, len(records), imported_by)
        )

        for idx, record in enumerate(records):
            original_row = record.get('original_row_number', idx + 2)
            try:
                c.execute("""
                    INSERT INTO manual_review_records
                    (batch_id, original_row_number, question_id, question,
                     original_conclusion, manual_conclusion, manual_remark,
                     prompt_version, reference_url, reference_url_status, current_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    batch_id,
                    original_row,
                    record.get('question_id'),
                    record.get('question'),
                    record.get('original_conclusion'),
                    record.get('manual_conclusion'),
                    record.get('manual_remark'),
                    record.get('prompt_version'),
                    record.get('reference_url'),
                    record.get('reference_url_status', 'unknown'),
                    ManualReviewRecord._determine_initial_status(record)
                ))
                record_id = c.lastrowid

                c.execute("""
                    INSERT INTO review_history (record_id, field_name, old_value, new_value, operator, change_reason)
                    VALUES (?, 'initial_import', NULL, ?, ?, '批次首次导入，记录原始快照')
                """, (record_id, json.dumps(record, ensure_ascii=False), imported_by or 'system'))

                inserted += 1

                if ManualReviewRecord._is_conflict(record):
                    c.execute("""
                        INSERT INTO conflict_samples (record_id, conflict_type, product_review_status)
                        VALUES (?, ?, 'pending')
                    """, (record_id, ManualReviewRecord._get_conflict_type(record)))

            except sqlite3.IntegrityError:
                skipped += 1

        return {
            'batch_id': batch_id,
            'inserted': inserted,
            'skipped': skipped,
            'total': len(records),
            'is_new_batch': True
        }


def clean_empty(val):
    import pandas as pd
    if val is None:
        return ''
    if isinstance(val, float) and pd.isna(val):
        return ''
    s = str(val).strip()
    if s.lower() == 'nan':
        return ''
    if s.lower() == 'none':
        return ''
    if s.lower() == 'null':
        return ''
    if s.lower() == 'undefined':
        return ''
    return s


    @staticmethod
    def _update_existing_batch(conn, batch_id: str, records: List[Dict]) -> Dict:
        c = conn.cursor()
        updated = 0
        unchanged = 0
        inserted = 0

        for idx, record in enumerate(records):
            original_row = record.get('original_row_number', idx + 2)

            c.execute("""
                SELECT *
                FROM manual_review_records
                WHERE batch_id = ? AND original_row_number = ?
            """, (batch_id, original_row))
            existing = c.fetchone()

            if existing:
                record_id = existing['id']
                changes = []

                fields_to_check = [
                    ('manual_remark', record.get('manual_remark')),
                    ('prompt_version', record.get('prompt_version')),
                    ('manual_conclusion', record.get('manual_conclusion')),
                    ('reference_url', record.get('reference_url')),
                    ('question_id', record.get('question_id')),
                    ('question', record.get('question')),
                    ('original_conclusion', record.get('original_conclusion')),
                ]

                for field_name, new_val in fields_to_check:
                    old_val = existing[field_name] if field_name in existing.keys() else None
                    if str(new_val or '') != str(old_val or ''):
                        c.execute(f"UPDATE manual_review_records SET {field_name} = ?, updated_at = ? WHERE id = ?",
                                  (new_val, datetime.now().isoformat(), record_id))

                        c.execute("""
                            INSERT INTO review_history (record_id, field_name, old_value, new_value, operator, change_reason)
                            VALUES (?, ?, ?, ?, 'reimport', '同一批次重复导入，字段内容更新')
                        """, (record_id, field_name, str(old_val), str(new_val)))
                        changes.append(field_name)

                if changes:
                    updated += 1

                    if 'prompt_version' in changes and existing['current_status'] == 'pending_prompt':
                        merged_record = dict(existing)
                        for fname, new_val in [
                            ('manual_remark', record.get('manual_remark')),
                            ('prompt_version', record.get('prompt_version')),
                            ('manual_conclusion', record.get('manual_conclusion')),
                            ('reference_url', record.get('reference_url')),
                            ('reference_url_status', record.get('reference_url_status', 'unknown')),
                        ]:
                            if new_val is not None:
                                merged_record[fname] = new_val

                        new_status = ManualReviewRecord._determine_initial_status(merged_record)
                        if new_status != existing['current_status']:
                            c.execute("""
                                UPDATE manual_review_records SET current_status = ?, updated_at = ?
                                WHERE id = ?
                            """, (new_status, datetime.now().isoformat(), record_id))

                            c.execute("""
                                INSERT INTO review_history (record_id, field_name, old_value, new_value, operator, change_reason)
                                VALUES (?, 'current_status', ?, ?, 'auto', '重复导入后触发状态自动流转')
                            """, (record_id, existing['current_status'], new_status))
                else:
                    unchanged += 1
            else:
                try:
                    c.execute("""
                        INSERT INTO manual_review_records
                        (batch_id, original_row_number, question_id, question,
                         original_conclusion, manual_conclusion, manual_remark,
                         prompt_version, reference_url, reference_url_status, current_status)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        batch_id,
                        original_row,
                        record.get('question_id'),
                        record.get('question'),
                        record.get('original_conclusion'),
                        record.get('manual_conclusion'),
                        record.get('manual_remark'),
                        record.get('prompt_version'),
                        record.get('reference_url'),
                        record.get('reference_url_status', 'unknown'),
                        ManualReviewRecord._determine_initial_status(record)
                    ))
                    inserted += 1
                except Exception:
                    pass

        c.execute("UPDATE import_batches SET total_records = total_records + ? WHERE batch_id = ?",
                  (inserted, batch_id))

        return {
            'batch_id': batch_id,
            'inserted': inserted,
            'updated': updated,
            'unchanged': unchanged,
            'total': len(records),
            'is_new_batch': False
        }

    @staticmethod
    def _determine_initial_status(record: Dict) -> str:
        prompt_version = clean_empty(record.get('prompt_version', ''))
        ref_status = clean_empty(record.get('reference_url_status', 'unknown'))
        if ref_status == '':
            ref_status = 'unknown'
        manual_conclusion = clean_empty(record.get('manual_conclusion', ''))
        original_conclusion = clean_empty(record.get('original_conclusion', ''))

        if ref_status == '404' and manual_conclusion == '通过':
            return 'pending_product_review'
        if record.get('original_conclusion') != record.get('manual_conclusion'):
            return 'pending_conflict_review'
        if not record.get('prompt_version'):
            return 'pending_prompt'
        return 'pending_review'

    @staticmethod
    def _is_conflict(record: Dict) -> bool:
        ref_status = clean_empty(record.get('reference_url_status', 'unknown'))
        manual_conclusion = clean_empty(record.get('manual_conclusion', ''))
        original_conclusion = clean_empty(record.get('original_conclusion', ''))
        if ref_status == '404' and manual_conclusion == '通过':
            return True
        if original_conclusion != manual_conclusion and original_conclusion != '' and manual_conclusion != '':
            return True
        return False

    @staticmethod
    def _get_conflict_type(record: Dict) -> str:
        if record.get('reference_url_status') == '404' and record.get('manual_conclusion') == '通过':
            return 'REF_404_PASS'
        if record.get('original_conclusion') != record.get('manual_conclusion'):
            return 'CONCLUSION_CONFLICT'
        return 'OTHER'

    @staticmethod
    def get_records(batch_id: str = None, status: str = None, offset: int = 0, limit: int = 100) -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()

        query = "SELECT * FROM manual_review_records WHERE 1=1"
        params = []

        if batch_id:
            query += " AND batch_id = ?"
            params.append(batch_id)
        if status:
            query += " AND current_status = ?"
            params.append(status)

        query += " ORDER BY batch_id, original_row_number LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        c.execute(query, params)
        rows = [dict(row) for row in c.fetchall()]
        conn.close()
        return rows

    @staticmethod
    def get_record_history(record_id: int) -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute("""
            SELECT * FROM review_history WHERE record_id = ? ORDER BY changed_at DESC
        """, (record_id,))
        rows = [dict(row) for row in c.fetchall()]
        conn.close()
        return rows

    @staticmethod
    def get_conflict_samples(batch_id: str = None, product_status: str = None) -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()

        query = """
            SELECT cs.*, mrr.*, ib.file_name
            FROM conflict_samples cs
            JOIN manual_review_records mrr ON cs.record_id = mrr.id
            JOIN import_batches ib ON mrr.batch_id = ib.batch_id
            WHERE 1=1
        """
        params = []

        if batch_id:
            query += " AND mrr.batch_id = ?"
            params.append(batch_id)
        if product_status:
            query += " AND cs.product_review_status = ?"
            params.append(product_status)

        query += " ORDER BY cs.created_at DESC"
        c.execute(query, params)
        rows = [dict(row) for row in c.fetchall()]
        conn.close()
        return rows

    @staticmethod
    def update_record(record_id: int, updates: Dict, operator: str = 'system', change_reason: str = None) -> bool:
        conn = get_conn()
        c = conn.cursor()

        try:
            c.execute("SELECT * FROM manual_review_records WHERE id = ?", (record_id,))
            existing = dict(c.fetchone())
            old_status = existing['current_status']

            allowed_fields = ['manual_remark', 'prompt_version', 'manual_conclusion',
                              'reference_url_status', 'current_status']

            for field in allowed_fields:
                if field in updates and str(updates[field] or '') != str(existing.get(field) or ''):
                    old_val = existing.get(field)
                    new_val = updates[field]

                    c.execute(f"UPDATE manual_review_records SET {field} = ?, updated_at = ? WHERE id = ?",
                              (new_val, datetime.now().isoformat(), record_id))

                    c.execute("""
                        INSERT INTO review_history (record_id, field_name, old_value, new_value, operator, change_reason)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (record_id, field, str(old_val), str(new_val), operator, change_reason))

            c.execute("SELECT * FROM manual_review_records WHERE id = ?", (record_id,))
            merged = dict(c.fetchone())

            needs_status_recalc = any(f in updates for f in ['prompt_version', 'manual_conclusion', 'reference_url_status'])
            status_was_set_manually = 'current_status' in updates

            if needs_status_recalc and not status_was_set_manually:
                recalc_record = {
                    'prompt_version': merged.get('prompt_version'),
                    'reference_url_status': merged.get('reference_url_status', 'unknown'),
                    'manual_conclusion': merged.get('manual_conclusion'),
                    'original_conclusion': merged.get('original_conclusion'),
                }
                new_status = ManualReviewRecord._determine_initial_status(recalc_record)

                if new_status != old_status:
                    c.execute("""
                        UPDATE manual_review_records SET current_status = ?, updated_at = ? WHERE id = ?
                    """, (new_status, datetime.now().isoformat(), record_id))

                    reason = change_reason or f"自动流转：修改触发状态重新评估"
                    c.execute("""
                        INSERT INTO review_history (record_id, field_name, old_value, new_value, operator, change_reason)
                        VALUES (?, 'current_status', ?, ?, ?, ?)
                    """, (record_id, old_status, new_status, operator, reason))

            if merged.get('reference_url_status') == '404' and merged.get('manual_conclusion') == '通过':
                c.execute("""
                    INSERT OR IGNORE INTO conflict_samples (record_id, conflict_type, product_review_status)
                    SELECT ?, 'REF_404_PASS', 'pending'
                    WHERE NOT EXISTS (SELECT 1 FROM conflict_samples WHERE record_id = ?)
                """, (record_id, record_id))

            if merged.get('original_conclusion') != merged.get('manual_conclusion'):
                c.execute("""
                    INSERT OR IGNORE INTO conflict_samples (record_id, conflict_type, product_review_status)
                    SELECT ?, 'CONCLUSION_CONFLICT', 'pending'
                    WHERE NOT EXISTS (SELECT 1 FROM conflict_samples WHERE record_id = ?)
                """, (record_id, record_id))

            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    @staticmethod
    def update_product_review(conflict_id: int, status: str, remark: str = None, operator: str = 'product') -> bool:
        conn = get_conn()
        c = conn.cursor()

        try:
            c.execute("""
                UPDATE conflict_samples
                SET product_review_status = ?, product_remark = ?, updated_at = ?
                WHERE id = ?
            """, (status, remark, datetime.now().isoformat(), conflict_id))

            c.execute("SELECT record_id FROM conflict_samples WHERE id = ?", (conflict_id,))
            row = c.fetchone()
            if row:
                record_id = row['record_id']
                c.execute("SELECT current_status FROM manual_review_records WHERE id = ?", (record_id,))
                old_main_status = c.fetchone()['current_status']
                new_status = 'reviewed' if status == 'approved' else 'rejected' if status == 'rejected' else 'pending_product_review'
                c.execute("""
                    UPDATE manual_review_records SET current_status = ?, updated_at = ? WHERE id = ?
                """, (new_status, datetime.now().isoformat(), record_id))

                c.execute("""
                    INSERT INTO review_history (record_id, field_name, old_value, new_value, operator, change_reason)
                    VALUES (?, 'product_review', NULL, ?, ?, '产品经理复核冲突样本并更新状态')
                """, (record_id, f"status={status}, remark={remark}", operator))

                if new_status != old_main_status:
                    c.execute("""
                        INSERT INTO review_history (record_id, field_name, old_value, new_value, operator, change_reason)
                        VALUES (?, 'current_status', ?, ?, ?, '产品经理复核触发状态流转')
                    """, (record_id, old_main_status, new_status, operator))

            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    @staticmethod
    def get_batches() -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute("SELECT * FROM import_batches ORDER BY imported_at DESC")
        rows = [dict(row) for row in c.fetchall()]
        conn.close()
        return rows

    @staticmethod
    def get_batch_detail(batch_id: str) -> Dict:
        conn = get_conn()
        c = conn.cursor()
        c.execute("SELECT * FROM import_batches WHERE batch_id = ?", (batch_id,))
        batch = dict(c.fetchone()) if c.fetchone() else None
        if not batch:
            conn.close()
            return None
        c.execute("SELECT COUNT(*) as cnt FROM manual_review_records WHERE batch_id = ?", (batch_id,))
        batch['record_count'] = c.fetchone()['cnt']
        c.execute("SELECT current_status, COUNT(*) as cnt FROM manual_review_records WHERE batch_id = ? GROUP BY current_status", (batch_id,))
        batch['status_distribution'] = {row['current_status']: row['cnt'] for row in c.fetchall()}
        c.execute("SELECT COUNT(*) as cnt FROM conflict_samples cs JOIN manual_review_records mrr ON cs.record_id = mrr.id WHERE mrr.batch_id = ?", (batch_id,))
        batch['conflict_count'] = c.fetchone()['cnt']
        c.execute("SELECT * FROM batch_rollback_log WHERE batch_id = ? ORDER BY rolled_back_at DESC", (batch_id,))
        batch['rollback_logs'] = [dict(row) for row in c.fetchall()]
        conn.close()
        return batch

    @staticmethod
    def rollback_batch(batch_id: str, rollback_type: str, reason: str, operator: str) -> Dict:
        conn = get_conn()
        c = conn.cursor()
        try:
            c.execute("SELECT * FROM import_batches WHERE batch_id = ?", (batch_id,))
            batch_row = c.fetchone()
            if not batch_row:
                raise ValueError(f"批次 {batch_id} 不存在")

            c.execute("SELECT * FROM manual_review_records WHERE batch_id = ?", (batch_id,))
            all_records = [dict(row) for row in c.fetchall()]
            snapshot_before = json.dumps({
                'batch': dict(batch_row),
                'records': all_records
            }, ensure_ascii=False)

            if rollback_type == 'clear_last_reimport':
                c.execute("DELETE FROM review_history WHERE record_id IN (SELECT id FROM manual_review_records WHERE batch_id = ?) AND operator = 'reimport'", (batch_id,))
                for rec in all_records:
                    c.execute("""
                        SELECT rh.new_value FROM review_history rh
                        WHERE rh.record_id = ? AND rh.field_name != 'current_status' AND rh.field_name != 'initial_import'
                        ORDER BY rh.changed_at ASC LIMIT 1
                    """, (rec['id'],))
                    first_change = c.fetchone()
                    if first_change:
                        pass
                affected = len(all_records)
                result_msg = f"清除批次 {batch_id} 的重复导入痕迹（仅保留首次导入状态），涉及 {affected} 条记录"

            elif rollback_type == 'delete_batch':
                c.execute("DELETE FROM conflict_samples WHERE record_id IN (SELECT id FROM manual_review_records WHERE batch_id = ?)", (batch_id,))
                c.execute("DELETE FROM review_history WHERE record_id IN (SELECT id FROM manual_review_records WHERE batch_id = ?)", (batch_id,))
                c.execute("DELETE FROM manual_review_records WHERE batch_id = ?", (batch_id,))
                c.execute("DELETE FROM import_batches WHERE batch_id = ?", (batch_id,))
                result_msg = f"彻底删除批次 {batch_id}（含所有记录、历史、冲突样本）"
                snapshot_after = json.dumps({'batch': None, 'records': []}, ensure_ascii=False)
            else:
                raise ValueError(f"未知的回滚类型: {rollback_type}")

            if rollback_type == 'clear_last_reimport':
                for rec in all_records:
                    c.execute("SELECT * FROM review_history WHERE record_id = ? AND field_name = 'initial_import'", (rec['id'],))
                    initial_row = c.fetchone()
                    if initial_row:
                        try:
                            initial_data = json.loads(initial_row['new_value'])
                        except Exception:
                            continue
                        c.execute("""
                            UPDATE manual_review_records SET
                                question_id = ?, question = ?, original_conclusion = ?,
                                manual_conclusion = ?, manual_remark = ?, prompt_version = ?,
                                reference_url = ?, reference_url_status = ?,
                                current_status = ?, updated_at = ?
                            WHERE id = ?
                        """, (
                            initial_data.get('question_id'),
                            initial_data.get('question'),
                            initial_data.get('original_conclusion'),
                            initial_data.get('manual_conclusion'),
                            initial_data.get('manual_remark'),
                            initial_data.get('prompt_version'),
                            initial_data.get('reference_url'),
                            initial_data.get('reference_url_status', 'unknown'),
                            ManualReviewRecord._determine_initial_status(initial_data),
                            datetime.now().isoformat(),
                            rec['id']
                        ))
                        c.execute("""
                            INSERT INTO review_history (record_id, field_name, old_value, new_value, operator, change_reason)
                            VALUES (?, 'rollback', ?, ?, ?, ?)
                        """, (
                            rec['id'],
                            json.dumps(rec, ensure_ascii=False),
                            f"回滚至首次导入状态",
                            operator,
                            reason
                        ))
                c.execute("SELECT * FROM manual_review_records WHERE batch_id = ?", (batch_id,))
                after_records = [dict(row) for row in c.fetchall()]
                snapshot_after = json.dumps({
                    'batch': dict(batch_row),
                    'records': after_records
                }, ensure_ascii=False)

            c.execute("""
                INSERT INTO batch_rollback_log (batch_id, rollback_type, snapshot_before, snapshot_after, rollback_reason, operator)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (batch_id, rollback_type, snapshot_before, snapshot_after, reason, operator))

            conn.commit()
            return {'success': True, 'message': result_msg, 'batch_id': batch_id}
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()

    @staticmethod
    def get_rollback_logs(batch_id: str = None) -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()
        if batch_id:
            c.execute("SELECT * FROM batch_rollback_log WHERE batch_id = ? ORDER BY rolled_back_at DESC", (batch_id,))
        else:
            c.execute("SELECT * FROM batch_rollback_log ORDER BY rolled_back_at DESC")
        rows = [dict(row) for row in c.fetchall()]
        conn.close()
        return rows

    @staticmethod
    def get_boundary_rules() -> List[Dict]:
        conn = get_conn()
        c = conn.cursor()
        c.execute("SELECT * FROM boundary_rules WHERE is_active = 1 ORDER BY rule_code")
        rows = [dict(row) for row in c.fetchall()]
        conn.close()
        return rows

    @staticmethod
    def get_statistics() -> Dict:
        conn = get_conn()
        c = conn.cursor()

        stats = {}

        c.execute("SELECT COUNT(*) as cnt FROM manual_review_records")
        stats['total_records'] = c.fetchone()['cnt']

        c.execute("SELECT current_status, COUNT(*) as cnt FROM manual_review_records GROUP BY current_status")
        stats['by_status'] = {row['current_status']: row['cnt'] for row in c.fetchall()}

        c.execute("SELECT COUNT(*) as cnt FROM conflict_samples")
        stats['total_conflicts'] = c.fetchone()['cnt']

        c.execute("SELECT product_review_status, COUNT(*) as cnt FROM conflict_samples GROUP BY product_review_status")
        stats['conflict_by_status'] = {row['product_review_status']: row['cnt'] for row in c.fetchall()}

        c.execute("SELECT COUNT(*) as cnt FROM import_batches")
        stats['total_batches'] = c.fetchone()['cnt']

        conn.close()
        return stats
