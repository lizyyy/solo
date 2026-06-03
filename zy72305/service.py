import uuid
import json
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from models import get_connection


BOUNDARY_THRESHOLD = 0.15


def generate_batch_id() -> str:
    return f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"


def import_teacher_comments(
    comments_data: List[Dict],
    source_file: str,
    imported_by: str
) -> Tuple[str, int, List[str]]:
    batch_id = generate_batch_id()
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO import_batches (batch_id, source_type, imported_by, record_count)
        VALUES (?, 'teacher_comments', ?, 0)
    ''', (batch_id, imported_by))
    
    success_count = 0
    skipped_items = []
    
    for comment in comments_data:
        line_number = comment.get('line_number')
        original_content = comment.get('original_content', '')
        comment_text = comment.get('comment_text', '')
        
        cursor.execute('''
            SELECT id FROM teacher_comments 
            WHERE source_file = ? AND original_line_number = ? AND comment_text = ? AND is_deleted = 0
        ''', (source_file, line_number, comment_text))
        
        existing = cursor.fetchone()
        
        if existing:
            skipped_items.append(f"第{line_number}行: 批注已存在，跳过")
            continue
        
        try:
            cursor.execute('''
                INSERT INTO teacher_comments 
                (source_file, original_line_number, original_content, comment_text, import_batch_id)
                VALUES (?, ?, ?, ?, ?)
            ''', (source_file, line_number, original_content, comment_text, batch_id))
            
            comment_id = cursor.lastrowid
            
            boundary_value = comment.get('boundary_value')
            status, needs_review, is_boundary = evaluate_boundary_case(
                boundary_value, BOUNDARY_THRESHOLD
            ) if boundary_value is not None else ('pending', False, False)
            
            cursor.execute('''
                INSERT INTO processing_records 
                (comment_id, current_status, boundary_value, threshold_value, 
                 is_boundary_case, needs_teacher_review, assistant_operator)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (comment_id, status, boundary_value, BOUNDARY_THRESHOLD, 
                  1 if is_boundary else 0, 
                  1 if needs_review else 0, 
                  imported_by))
            
            record_id = cursor.lastrowid
            
            cursor.execute('''
                INSERT INTO change_history 
                (record_id, field_name, old_value, new_value, operator, operation_type, operation_note)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (record_id, 'import', None, json.dumps(comment), 
                  imported_by, 'create', '首次导入老师批注'))
            
            success_count += 1
            
        except Exception as e:
            skipped_items.append(f"第{line_number}行: 导入失败 - {str(e)}")
    
    cursor.execute('''
        UPDATE import_batches SET record_count = ? WHERE batch_id = ?
    ''', (success_count, batch_id))
    
    conn.commit()
    conn.close()
    
    return batch_id, success_count, skipped_items


def evaluate_boundary_case(
    value: float, threshold: float
) -> Tuple[str, bool, bool]:
    is_boundary = abs(value - threshold) < 1e-9
    
    if is_boundary:
        return 'pending_teacher_review', True, True
    elif value < threshold:
        return 'normal', False, False
    else:
        return 'warning', False, False


def supplementary_sampling_list(
    sampling_data: List[Dict],
    operator: str
) -> Tuple[int, List[str]]:
    conn = get_connection()
    cursor = conn.cursor()
    
    updated_count = 0
    messages = []
    
    for sample in sampling_data:
        sample_id = sample.get('sample_id')
        sample_name = sample.get('sample_name', '')
        comment_id = sample.get('comment_id')
        supplementary_note = sample.get('supplementary_note', '')
        
        cursor.execute('''
            SELECT id, supplementary_note FROM sampling_list WHERE sample_id = ?
        ''', (sample_id,))
        
        existing = cursor.fetchone()
        
        if existing:
            old_note = existing['supplementary_note']
            cursor.execute('''
                UPDATE sampling_list 
                SET sample_name = ?, comment_id = ?, supplementary_note = ?, 
                    supplementary_operator = ?, supplementary_at = CURRENT_TIMESTAMP
                WHERE sample_id = ?
            ''', (sample_name, comment_id, supplementary_note, operator, sample_id))
            
            if comment_id:
                cursor.execute('''
                    SELECT id FROM processing_records WHERE comment_id = ?
                ''', (comment_id,))
                record = cursor.fetchone()
                if record:
                    cursor.execute('''
                        INSERT INTO change_history 
                        (record_id, field_name, old_value, new_value, operator, 
                         operation_type, operation_note)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (record['id'], 'sampling_link', 
                          None, sample_id, operator, 'update', 
                          f'补录抽样名单: {supplementary_note}'))
            
            updated_count += 1
            messages.append(f"样本{sample_id}: 已更新")
        else:
            cursor.execute('''
                INSERT INTO sampling_list 
                (sample_id, sample_name, comment_id, supplementary_note, 
                 supplementary_operator, supplementary_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (sample_id, sample_name, comment_id, supplementary_note, operator))
            
            if comment_id:
                cursor.execute('''
                    SELECT id FROM processing_records WHERE comment_id = ?
                ''', (comment_id,))
                record = cursor.fetchone()
                if record:
                    cursor.execute('''
                        INSERT INTO change_history 
                        (record_id, field_name, old_value, new_value, operator, 
                         operation_type, operation_note)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    ''', (record['id'], 'sampling_link', 
                          None, sample_id, operator, 'create', 
                          f'关联抽样名单: {supplementary_note}'))
            
            updated_count += 1
            messages.append(f"样本{sample_id}: 已新增")
    
    conn.commit()
    conn.close()
    
    return updated_count, messages


def update_assistant_note(
    record_id: int,
    new_note: str,
    operator: str
) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT assistant_note FROM processing_records WHERE id = ?
    ''', (record_id,))
    
    record = cursor.fetchone()
    if not record:
        conn.close()
        return False
    
    old_note = record['assistant_note']
    
    cursor.execute('''
        UPDATE processing_records 
        SET assistant_note = ?, assistant_operator = ?, processed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (new_note, operator, record_id))
    
    cursor.execute('''
        INSERT INTO change_history 
        (record_id, field_name, old_value, new_value, operator, operation_type, operation_note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (record_id, 'assistant_note', old_note, new_note, operator, 'update', '实验助理修改备注'))
    
    conn.commit()
    conn.close()
    
    return True


def teacher_review(
    record_id: int,
    review_result: str,
    reviewer: str,
    final_status: str
) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT current_status, teacher_review_result 
        FROM processing_records WHERE id = ?
    ''', (record_id,))
    
    record = cursor.fetchone()
    if not record:
        conn.close()
        return False
    
    old_status = record['current_status']
    old_review = record['teacher_review_result']
    
    cursor.execute('''
        UPDATE processing_records 
        SET current_status = ?, teacher_review_result = ?, 
            teacher_reviewer = ?, teacher_review_at = CURRENT_TIMESTAMP,
            needs_teacher_review = 0
        WHERE id = ?
    ''', (final_status, review_result, reviewer, record_id))
    
    cursor.execute('''
        INSERT INTO change_history 
        (record_id, field_name, old_value, new_value, operator, operation_type, operation_note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (record_id, 'teacher_review', 
          json.dumps({'status': old_status, 'review': old_review}),
          json.dumps({'status': final_status, 'review': review_result}),
          reviewer, 'review', '任课老师复核'))
    
    conn.commit()
    conn.close()
    
    return True


def rollback_to_version(
    record_id: int,
    history_id: int,
    operator: str
) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT field_name, old_value FROM change_history 
        WHERE record_id = ? AND id = ?
    ''', (record_id, history_id))
    
    history = cursor.fetchone()
    if not history:
        conn.close()
        return False
    
    field_name = history['field_name']
    old_value = history['old_value']
    
    if field_name == 'assistant_note':
        cursor.execute('''
            UPDATE processing_records SET assistant_note = ? WHERE id = ?
        ''', (old_value, record_id))
    elif field_name == 'status':
        cursor.execute('''
            UPDATE processing_records SET current_status = ? WHERE id = ?
        ''', (old_value, record_id))
    
    cursor.execute('''
        INSERT INTO change_history 
        (record_id, field_name, old_value, new_value, operator, operation_type, operation_note)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (record_id, 'rollback', None, f"回滚至版本{history_id}", 
          operator, 'rollback', '人工回滚操作'))
    
    conn.commit()
    conn.close()
    
    return True


def get_complete_trace(record_id: int) -> Dict:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            pr.*,
            tc.source_file, tc.original_line_number, tc.original_content, 
            tc.comment_text, tc.import_batch_id, tc.imported_at,
            sl.sample_id, sl.sample_name, sl.supplementary_note, 
            sl.supplementary_operator, sl.supplementary_at
        FROM processing_records pr
        JOIN teacher_comments tc ON pr.comment_id = tc.id
        LEFT JOIN sampling_list sl ON tc.id = sl.comment_id
        WHERE pr.id = ?
    ''', (record_id,))
    
    record = cursor.fetchone()
    
    if not record:
        conn.close()
        return {}
    
    cursor.execute('''
        SELECT * FROM change_history 
        WHERE record_id = ? ORDER BY operated_at ASC
    ''', (record_id,))
    
    history = cursor.fetchall()
    
    conn.close()
    
    return {
        'basic_info': dict(record),
        'trace_phases': {
            'phase1_teacher_comment': {
                'source': record['source_file'],
                'line_number': record['original_line_number'],
                'content': record['original_content'],
                'comment': record['comment_text'],
                'imported_at': record['imported_at']
            },
            'phase2_sampling_supplement': {
                'sample_id': record['sample_id'],
                'sample_name': record['sample_name'],
                'supplementary_note': record['supplementary_note'],
                'supplementary_operator': record['supplementary_operator'],
                'supplementary_at': record['supplementary_at']
            },
            'phase3_manual_confirmation': {
                'current_status': record['current_status'],
                'is_boundary_case': record['is_boundary_case'],
                'needs_teacher_review': record['needs_teacher_review'],
                'teacher_review_result': record['teacher_review_result'],
                'assistant_note': record['assistant_note']
            }
        },
        'change_history': [dict(h) for h in history]
    }


def get_all_records_with_trace() -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT pr.id FROM processing_records pr
        ORDER BY pr.processed_at DESC
    ''',)
    
    record_ids = cursor.fetchall()
    conn.close()
    
    return [get_complete_trace(r['id']) for r in record_ids]


def get_record_history_diff(record_id: int) -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM change_history 
        WHERE record_id = ? ORDER BY operated_at ASC
    ''', (record_id,))
    
    history = cursor.fetchall()
    conn.close()
    
    diffs = []
    for i, entry in enumerate(history):
        diffs.append({
            'version': i + 1,
            'timestamp': entry['operated_at'],
            'operator': entry['operator'],
            'operation_type': entry['operation_type'],
            'field': entry['field_name'],
            'old_value': entry['old_value'],
            'new_value': entry['new_value'],
            'note': entry['operation_note']
        })
    
    return diffs
