import csv
import json
import uuid
import os
from datetime import datetime
from models import Visitor, TemporaryPlate, Blacklist, ValidationError
from database import create_batch_operation, update_batch_operation, add_batch_record, get_connection
from config import ERROR_DIR


class DataImporter:
    def __init__(self, operator, role):
        self.operator = operator
        self.role = role

    def import_visitors_from_csv(self, file_path):
        batch_id = f"visitor_import_{uuid.uuid4().hex[:8]}"
        success_count = 0
        failed_count = 0
        failed_records = []

        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            total_count = len(rows)
            create_batch_operation(batch_id, 'import_visitors', total_count, self.operator, self.role)

            for idx, row in enumerate(rows, start=1):
                original_data = row.copy()
                try:
                    visitor_id = Visitor.create(row, self.operator, self.role)
                    add_batch_record(batch_id, idx, original_data, 'success', entity_id=visitor_id)
                    success_count += 1
                except ValidationError as e:
                    add_batch_record(batch_id, idx, original_data, 'failed',
                                   error_message=str(e.args[0]), suggestion=str(e.args[1]))
                    failed_records.append({
                        'row': idx,
                        'data': original_data,
                        'error': str(e.args[0]),
                        'suggestion': str(e.args[1])
                    })
                    failed_count += 1
                except Exception as e:
                    add_batch_record(batch_id, idx, original_data, 'failed',
                                   error_message=str(e), suggestion='请检查数据是否重复或联系管理员')
                    failed_records.append({
                        'row': idx,
                        'data': original_data,
                        'error': str(e),
                        'suggestion': '请检查数据是否重复或联系管理员'
                    })
                    failed_count += 1

        update_batch_operation(batch_id, success_count, failed_count, 'completed')

        if failed_records:
            self._save_failed_records('visitors', batch_id, failed_records)

        return {
            'batch_id': batch_id,
            'total': total_count,
            'success': success_count,
            'failed': failed_count,
            'failed_records': failed_records
        }

    def import_plates_from_json(self, file_path):
        batch_id = f"plate_import_{uuid.uuid4().hex[:8]}"
        success_count = 0
        failed_count = 0
        failed_records = []

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            plates = data if isinstance(data, list) else data.get('plates', [])
            total_count = len(plates)
            create_batch_operation(batch_id, 'import_plates', total_count, self.operator, self.role)

            for idx, plate in enumerate(plates, start=1):
                original_data = plate.copy()
                try:
                    plate_id = TemporaryPlate.create(plate, self.operator, self.role)
                    add_batch_record(batch_id, idx, original_data, 'success', entity_id=plate_id)
                    success_count += 1
                except ValidationError as e:
                    add_batch_record(batch_id, idx, original_data, 'failed',
                                   error_message=str(e.args[0]), suggestion=str(e.args[1]))
                    failed_records.append({
                        'index': idx,
                        'data': original_data,
                        'error': str(e.args[0]),
                        'suggestion': str(e.args[1])
                    })
                    failed_count += 1
                except Exception as e:
                    add_batch_record(batch_id, idx, original_data, 'failed',
                                   error_message=str(e), suggestion='请检查数据是否重复或联系管理员')
                    failed_records.append({
                        'index': idx,
                        'data': original_data,
                        'error': str(e),
                        'suggestion': '请检查数据是否重复或联系管理员'
                    })
                    failed_count += 1

        update_batch_operation(batch_id, success_count, failed_count, 'completed')

        if failed_records:
            self._save_failed_records('plates', batch_id, failed_records)

        return {
            'batch_id': batch_id,
            'total': total_count,
            'success': success_count,
            'failed': failed_count,
            'failed_records': failed_records
        }

    def import_blacklist_from_db(self, source_db_path, table_name, mapping):
        batch_id = f"blacklist_import_{uuid.uuid4().hex[:8]}"
        success_count = 0
        failed_count = 0
        failed_records = []

        source_conn = sqlite3.connect(source_db_path)
        source_conn.row_factory = sqlite3.Row
        source_cursor = source_conn.cursor()
        source_cursor.execute(f'SELECT * FROM {table_name}')
        rows = source_cursor.fetchall()
        total_count = len(rows)
        create_batch_operation(batch_id, 'import_blacklist', total_count, self.operator, self.role)

        for idx, row in enumerate(rows, start=1):
            original_data = dict(row)
            mapped_data = {}
            for target_key, source_key in mapping.items():
                mapped_data[target_key] = original_data.get(source_key)

            try:
                blacklist_id = Blacklist.create(mapped_data, self.operator, self.role)
                add_batch_record(batch_id, idx, original_data, 'success', entity_id=blacklist_id)
                success_count += 1
            except ValidationError as e:
                add_batch_record(batch_id, idx, original_data, 'failed',
                               error_message=str(e.args[0]), suggestion=str(e.args[1]))
                failed_records.append({
                    'row': idx,
                    'data': original_data,
                    'error': str(e.args[0]),
                    'suggestion': str(e.args[1])
                })
                failed_count += 1
            except Exception as e:
                add_batch_record(batch_id, idx, original_data, 'failed',
                               error_message=str(e), suggestion='请检查数据是否重复或联系管理员')
                failed_records.append({
                    'row': idx,
                    'data': original_data,
                    'error': str(e),
                    'suggestion': '请检查数据是否重复或联系管理员'
                })
                failed_count += 1

        source_conn.close()
        update_batch_operation(batch_id, success_count, failed_count, 'completed')

        if failed_records:
            self._save_failed_records('blacklist', batch_id, failed_records)

        return {
            'batch_id': batch_id,
            'total': total_count,
            'success': success_count,
            'failed': failed_count,
            'failed_records': failed_records
        }

    def retry_failed_batch(self, batch_id):
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT br.*, bo.operation_type
            FROM batch_records br
            JOIN batch_operations bo ON br.batch_id = bo.batch_id
            WHERE br.batch_id = ? AND br.status = 'failed'
        ''', (batch_id,))
        failed_records = cursor.fetchall()
        conn.close()

        if not failed_records:
            return {'message': '没有需要重试的失败记录', 'retried': 0, 'success': 0, 'failed': 0}

        retry_batch_id = f"retry_{batch_id}_{uuid.uuid4().hex[:4]}"
        operation_type = failed_records[0]['operation_type']
        total_count = len(failed_records)
        create_batch_operation(retry_batch_id, f'retry_{operation_type}', total_count, self.operator, self.role)

        success_count = 0
        failed_count = 0

        for record in failed_records:
            original_data = json.loads(record['original_data'])
            record_idx = record['record_index']

            try:
                entity_id = None
                if 'visitor' in operation_type:
                    entity_id = Visitor.create(original_data, self.operator, self.role)
                elif 'plate' in operation_type:
                    entity_id = TemporaryPlate.create(original_data, self.operator, self.role)
                elif 'blacklist' in operation_type:
                    entity_id = Blacklist.create(original_data, self.operator, self.role)

                add_batch_record(retry_batch_id, record_idx, original_data, 'success', entity_id=entity_id)
                success_count += 1
            except ValidationError as e:
                add_batch_record(retry_batch_id, record_idx, original_data, 'failed',
                               error_message=str(e.args[0]), suggestion=str(e.args[1]))
                failed_count += 1
            except Exception as e:
                add_batch_record(retry_batch_id, record_idx, original_data, 'failed',
                               error_message=str(e), suggestion='请检查数据是否重复或联系管理员')
                failed_count += 1

        update_batch_operation(retry_batch_id, success_count, failed_count, 'completed')

        return {
            'batch_id': retry_batch_id,
            'total': total_count,
            'success': success_count,
            'failed': failed_count
        }

    def _save_failed_records(self, data_type, batch_id, failed_records):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f'failed_{data_type}_{batch_id}_{timestamp}.json'
        filepath = os.path.join(ERROR_DIR, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump({
                'batch_id': batch_id,
                'operator': self.operator,
                'role': self.role,
                'failed_records': failed_records
            }, f, ensure_ascii=False, indent=2)

        return filepath


import sqlite3
