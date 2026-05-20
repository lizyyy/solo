from datetime import datetime
from typing import List, Dict, Optional, Tuple
from .models import (
    get_connection, row_to_dict, rows_to_list,
    BatchStatus, UpgradeStatus
)

def now_str() -> str:
    return datetime.now().isoformat()

class DeviceModelService:
    @staticmethod
    def create(model_name: str, model_code: str, description: str = "") -> Dict:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO device_models (model_name, model_code, description, created_at) VALUES (?, ?, ?, ?)',
            (model_name, model_code, description, now_str())
        )
        conn.commit()
        model_id = cursor.lastrowid
        cursor.execute('SELECT * FROM device_models WHERE id = ?', (model_id,))
        result = row_to_dict(cursor.fetchone())
        conn.close()
        return result

    @staticmethod
    def get_all() -> List[Dict]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM device_models ORDER BY created_at DESC')
        results = rows_to_list(cursor.fetchall())
        conn.close()
        return results

    @staticmethod
    def get_by_id(model_id: int) -> Optional[Dict]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM device_models WHERE id = ?', (model_id,))
        result = row_to_dict(cursor.fetchone())
        conn.close()
        return result

class FirmwareService:
    @staticmethod
    def create(model_id: int, version: str, file_path: str = "", md5: str = "", size: int = 0, release_notes: str = "") -> Dict:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            'INSERT INTO firmware_versions (model_id, version, file_path, md5, size, release_notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            (model_id, version, file_path, md5, size, release_notes, now_str())
        )
        conn.commit()
        firmware_id = cursor.lastrowid
        cursor.execute('SELECT * FROM firmware_versions WHERE id = ?', (firmware_id,))
        result = row_to_dict(cursor.fetchone())
        conn.close()
        return result

    @staticmethod
    def get_all() -> List[Dict]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT f.*, m.model_name, m.model_code 
            FROM firmware_versions f 
            JOIN device_models m ON f.model_id = m.id 
            ORDER BY f.created_at DESC
        ''')
        results = rows_to_list(cursor.fetchall())
        conn.close()
        return results

    @staticmethod
    def get_by_id(firmware_id: int) -> Optional[Dict]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM firmware_versions WHERE id = ?', (firmware_id,))
        result = row_to_dict(cursor.fetchone())
        conn.close()
        return result

class GrayBatchService:
    @staticmethod
    def create(name: str, model_id: int, firmware_id: int, pause_threshold: float = 0.1, rollback_strategy: str = "manual") -> Dict:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute(
            '''INSERT INTO gray_batches 
               (name, model_id, firmware_id, status, pause_threshold, rollback_strategy, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (name, model_id, firmware_id, BatchStatus.CREATED.value, pause_threshold, rollback_strategy, now_str())
        )
        conn.commit()
        batch_id = cursor.lastrowid
        
        cursor.execute('''
            INSERT INTO pause_rules (batch_id, rule_type, threshold, enabled, created_at)
            VALUES (?, 'failure_rate', ?, 1, ?)
        ''', (batch_id, pause_threshold, now_str()))
        conn.commit()
        
        cursor.execute('SELECT * FROM gray_batches WHERE id = ?', (batch_id,))
        result = row_to_dict(cursor.fetchone())
        conn.close()
        return result

    @staticmethod
    def get_all(filters: Dict = None) -> List[Dict]:
        conn = get_connection()
        cursor = conn.cursor()
        
        query = '''
            SELECT b.*, m.model_name, m.model_code, f.version as firmware_version
            FROM gray_batches b
            JOIN device_models m ON b.model_id = m.id
            JOIN firmware_versions f ON b.firmware_id = f.id
        '''
        params = []
        
        if filters:
            conditions = []
            if filters.get('status'):
                conditions.append('b.status = ?')
                params.append(filters['status'])
            if filters.get('model_id'):
                conditions.append('b.model_id = ?')
                params.append(filters['model_id'])
            if conditions:
                query += ' WHERE ' + ' AND '.join(conditions)
        
        query += ' ORDER BY b.created_at DESC'
        
        cursor.execute(query, params)
        results = rows_to_list(cursor.fetchall())
        conn.close()
        return results

    @staticmethod
    def get_by_id(batch_id: int) -> Optional[Dict]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT b.*, m.model_name, m.model_code, f.version as firmware_version
            FROM gray_batches b
            JOIN device_models m ON b.model_id = m.id
            JOIN firmware_versions f ON b.firmware_id = f.id
            WHERE b.id = ?
        ''', (batch_id,))
        result = row_to_dict(cursor.fetchone())
        conn.close()
        return result

    @staticmethod
    def start_batch(batch_id: int) -> Tuple[bool, str]:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM gray_batches WHERE id = ?', (batch_id,))
        batch = row_to_dict(cursor.fetchone())
        
        if not batch:
            conn.close()
            return False, "批次不存在"
        
        if batch['status'] != BatchStatus.CREATED.value:
            conn.close()
            return False, f"批次状态不正确: {batch['status']}"
        
        cursor.execute(
            'UPDATE gray_batches SET status = ?, started_at = ? WHERE id = ?',
            (BatchStatus.RUNNING.value, now_str(), batch_id)
        )
        conn.commit()
        conn.close()
        return True, "批次已启动"

    @staticmethod
    def check_pause_conditions(batch_id: int) -> Tuple[bool, str]:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM gray_batches WHERE id = ?', (batch_id,))
        batch = row_to_dict(cursor.fetchone())
        
        if not batch or batch['status'] != BatchStatus.RUNNING.value:
            conn.close()
            return False, ""
        
        total = batch['current_devices']
        if total == 0:
            conn.close()
            return False, ""
        
        failure_rate = batch['failed_count'] / total
        
        if failure_rate >= batch['pause_threshold']:
            reason = f"失败率达到阈值: {failure_rate:.2%} >= {batch['pause_threshold']:.2%}"
            cursor.execute(
                'UPDATE gray_batches SET status = ?, pause_reason = ? WHERE id = ?',
                (BatchStatus.PAUSED.value, reason, batch_id)
            )
            conn.commit()
            conn.close()
            return True, reason
        
        conn.close()
        return False, ""

    @staticmethod
    def pause_batch(batch_id: int, reason: str = "手动暂停") -> Tuple[bool, str]:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT status FROM gray_batches WHERE id = ?', (batch_id,))
        batch = cursor.fetchone()
        
        if not batch:
            conn.close()
            return False, "批次不存在"
        
        if batch['status'] not in [BatchStatus.RUNNING.value, BatchStatus.CREATED.value]:
            conn.close()
            return False, f"批次状态不正确: {batch['status']}"
        
        cursor.execute(
            'UPDATE gray_batches SET status = ?, pause_reason = ? WHERE id = ?',
            (BatchStatus.PAUSED.value, reason, batch_id)
        )
        conn.commit()
        conn.close()
        return True, "批次已暂停"

    @staticmethod
    def resume_batch(batch_id: int) -> Tuple[bool, str]:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT status FROM gray_batches WHERE id = ?', (batch_id,))
        batch = cursor.fetchone()
        
        if not batch:
            conn.close()
            return False, "批次不存在"
        
        if batch['status'] != BatchStatus.PAUSED.value:
            conn.close()
            return False, f"批次状态不正确: {batch['status']}"
        
        cursor.execute(
            'UPDATE gray_batches SET status = ?, pause_reason = NULL WHERE id = ?',
            (BatchStatus.RUNNING.value, batch_id)
        )
        conn.commit()
        conn.close()
        return True, "批次已恢复"

    @staticmethod
    def rollback_batch(batch_id: int) -> Tuple[bool, str]:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT status FROM gray_batches WHERE id = ?', (batch_id,))
        batch = cursor.fetchone()
        
        if not batch:
            conn.close()
            return False, "批次不存在"
        
        cursor.execute(
            'UPDATE gray_batches SET status = ? WHERE id = ?',
            (BatchStatus.ROLLED_BACK.value, batch_id)
        )
        
        cursor.execute(
            'UPDATE upgrade_receipts SET status = ? WHERE batch_id = ? AND status != ?',
            (UpgradeStatus.ROLLED_BACK.value, batch_id, UpgradeStatus.ROLLED_BACK.value)
        )
        
        conn.commit()
        conn.close()
        return True, "批次已回滚"

    @staticmethod
    def complete_batch(batch_id: int) -> Tuple[bool, str]:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT status, current_devices, success_count, failed_count FROM gray_batches WHERE id = ?', (batch_id,))
        batch = row_to_dict(cursor.fetchone())
        
        if not batch:
            conn.close()
            return False, "批次不存在"
        
        if batch['status'] != BatchStatus.RUNNING.value:
            conn.close()
            return False, f"批次状态不正确: {batch['status']}"
        
        cursor.execute(
            'UPDATE gray_batches SET status = ?, completed_at = ? WHERE id = ?',
            (BatchStatus.COMPLETED.value, now_str(), batch_id)
        )
        conn.commit()
        conn.close()
        return True, "批次已完成"

class UpgradeReceiptService:
    @staticmethod
    def create(batch_id: int, device_sn: str) -> Dict:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute(
            '''INSERT INTO upgrade_receipts 
               (batch_id, device_sn, status, created_at) 
               VALUES (?, ?, ?, ?)''',
            (batch_id, device_sn, UpgradeStatus.PENDING.value, now_str())
        )
        conn.commit()
        receipt_id = cursor.lastrowid
        
        cursor.execute(
            'UPDATE gray_batches SET current_devices = current_devices + 1, target_devices = target_devices + 1 WHERE id = ?',
            (batch_id,)
        )
        conn.commit()
        
        cursor.execute('SELECT * FROM upgrade_receipts WHERE id = ?', (receipt_id,))
        result = row_to_dict(cursor.fetchone())
        conn.close()
        return result

    @staticmethod
    def start_upgrade(receipt_id: int) -> Tuple[bool, str]:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM upgrade_receipts WHERE id = ?', (receipt_id,))
        receipt = row_to_dict(cursor.fetchone())
        
        if not receipt:
            conn.close()
            return False, "回执不存在"
        
        cursor.execute(
            'UPDATE upgrade_receipts SET status = ?, started_at = ? WHERE id = ?',
            (UpgradeStatus.IN_PROGRESS.value, now_str(), receipt_id)
        )
        conn.commit()
        conn.close()
        return True, "升级已开始"

    @staticmethod
    def complete_upgrade(receipt_id: int, success: bool, error_code: str = None, error_message: str = None) -> Tuple[bool, str]:
        conn = get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM upgrade_receipts WHERE id = ?', (receipt_id,))
        receipt = row_to_dict(cursor.fetchone())
        
        if not receipt:
            conn.close()
            return False, "回执不存在"
        
        batch_id = receipt['batch_id']
        
        new_status = UpgradeStatus.SUCCESS.value if success else UpgradeStatus.FAILED.value
        
        cursor.execute(
            'UPDATE upgrade_receipts SET status = ?, completed_at = ?, error_code = ?, error_message = ? WHERE id = ?',
            (new_status, now_str(), error_code, error_message, receipt_id)
        )
        
        if success:
            cursor.execute('UPDATE gray_batches SET success_count = success_count + 1 WHERE id = ?', (batch_id,))
        else:
            cursor.execute('UPDATE gray_batches SET failed_count = failed_count + 1 WHERE id = ?', (batch_id,))
        
        conn.commit()
        conn.close()
        
        GrayBatchService.check_pause_conditions(batch_id)
        
        return True, "升级完成"

    @staticmethod
    def get_by_batch(batch_id: int) -> List[Dict]:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM upgrade_receipts WHERE batch_id = ? ORDER BY created_at DESC', (batch_id,))
        results = rows_to_list(cursor.fetchall())
        conn.close()
        return results

    @staticmethod
    def get_timeline(batch_id: int) -> List[Dict]:
        receipts = UpgradeReceiptService.get_by_batch(batch_id)
        timeline = []
        
        for r in receipts:
            events = []
            if r['created_at']:
                events.append({"time": r['created_at'], "event": "创建升级任务", "status": r['status']})
            if r['started_at']:
                events.append({"time": r['started_at'], "event": "开始升级", "status": r['status']})
            if r['completed_at']:
                events.append({"time": r['completed_at'], "event": "升级完成", "status": r['status']})
            
            for e in events:
                timeline.append({
                    "device_sn": r['device_sn'],
                    "receipt_id": r['id'],
                    **e
                })
        
        timeline.sort(key=lambda x: x['time'])
        return timeline

    @staticmethod
    def bulk_import(batch_id: int, device_sns: List[str]) -> Dict:
        created = []
        failed = []
        
        for sn in device_sns:
            try:
                receipt = UpgradeReceiptService.create(batch_id, sn.strip())
                created.append(receipt)
            except Exception as e:
                failed.append({"sn": sn, "error": str(e)})
        
        return {"created": len(created), "failed": len(failed), "items": created}

class ReportService:
    @staticmethod
    def generate_batch_report(batch_id: int) -> Dict:
        batch = GrayBatchService.get_by_id(batch_id)
        if not batch:
            return None
        
        receipts = UpgradeReceiptService.get_by_batch(batch_id)
        
        success_count = sum(1 for r in receipts if r['status'] == UpgradeStatus.SUCCESS.value)
        failed_count = sum(1 for r in receipts if r['status'] == UpgradeStatus.FAILED.value)
        pending_count = sum(1 for r in receipts if r['status'] == UpgradeStatus.PENDING.value)
        in_progress_count = sum(1 for r in receipts if r['status'] == UpgradeStatus.IN_PROGRESS.value)
        
        failure_reasons = {}
        for r in receipts:
            if r['status'] == UpgradeStatus.FAILED.value and r['error_message']:
                reason = r['error_message']
                failure_reasons[reason] = failure_reasons.get(reason, 0) + 1
        
        return {
            "batch": batch,
            "summary": {
                "total": len(receipts),
                "success": success_count,
                "failed": failed_count,
                "pending": pending_count,
                "in_progress": in_progress_count,
                "success_rate": success_count / len(receipts) if receipts else 0
            },
            "failure_reasons": failure_reasons,
            "receipts": receipts,
            "generated_at": now_str()
        }
