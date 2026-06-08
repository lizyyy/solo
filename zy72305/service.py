import uuid
import json
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from models import get_connection, take_record_snapshot


BOUNDARY_THRESHOLD = 0.15

COUNTEREXAMPLE_BOUNDARY = 'boundary'
COUNTEREXAMPLE_MISSING_SAMPLE = 'missing_sample'
COUNTEREXAMPLE_NOTE_MODIFIED = 'note_modified'
COUNTEREXAMPLE_TEACHER_PENDING = 'teacher_pending'

COUNTEREXAMPLE_LABELS = {
    COUNTEREXAMPLE_BOUNDARY: '边界值待复核',
    COUNTEREXAMPLE_MISSING_SAMPLE: '缺少抽样名单',
    COUNTEREXAMPLE_NOTE_MODIFIED: '备注被人工修改',
    COUNTEREXAMPLE_TEACHER_PENDING: '待老师最终确认'
}


def generate_batch_id() -> str:
    return f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"


def _append_history(
    cursor,
    record_id: int,
    field_name: str,
    old_value,
    new_value,
    operator: str,
    operation_type: str,
    operation_note: str,
    snapshot: str
):
    cursor.execute('''
        INSERT INTO change_history
        (record_id, field_name, old_value, new_value, operator, operation_type, operation_note, full_snapshot_before)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        record_id, field_name,
        str(old_value) if old_value is not None else None,
        str(new_value) if new_value is not None else None,
        operator, operation_type, operation_note, snapshot
    ))


def _sync_counterexample_flags(cursor, record_id: int) -> Tuple[bool, str]:
    cursor.execute('''
        SELECT pr.*, sl.id as has_sample
        FROM processing_records pr
        LEFT JOIN sampling_list sl ON pr.comment_id = sl.comment_id AND sl.is_deleted = 0
        WHERE pr.id = ?
    ''', (record_id,))
    row = cursor.fetchone()
    if not row:
        return False, ''

    types = []
    if row['is_boundary_case']:
        types.append(COUNTEREXAMPLE_BOUNDARY)
    if row['needs_teacher_review']:
        types.append(COUNTEREXAMPLE_TEACHER_PENDING)
    if not row['has_sample']:
        types.append(COUNTEREXAMPLE_MISSING_SAMPLE)
    if (row['note_modified_count'] or 0) > 0:
        types.append(COUNTEREXAMPLE_NOTE_MODIFIED)

    types_str = ','.join(types) if types else None
    is_ce = 1 if types else 0

    cursor.execute('''
        UPDATE processing_records
        SET is_counterexample = ?, counterexample_types = ?, processed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (is_ce, types_str, record_id))

    return bool(is_ce), types_str or ''


def _get_current_processing_record(cursor, record_id: int) -> Optional[Dict]:
    cursor.execute('SELECT * FROM processing_records WHERE id = ?', (record_id,))
    row = cursor.fetchone()
    return dict(row) if row else None


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
    record_ids = []

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
            if boundary_value is not None:
                status, needs_review, is_boundary = evaluate_boundary_case(
                    boundary_value, BOUNDARY_THRESHOLD
                )
            else:
                status, needs_review, is_boundary = 'pending', False, False

            cursor.execute('''
                INSERT INTO processing_records
                (comment_id, current_status, boundary_value, threshold_value,
                 is_boundary_case, needs_teacher_review, assistant_operator,
                 is_counterexample, counterexample_types, note_modified_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, 0)
            ''', (comment_id, status, boundary_value, BOUNDARY_THRESHOLD,
                  1 if is_boundary else 0,
                  1 if needs_review else 0,
                  imported_by))

            record_id = cursor.lastrowid
            record_ids.append(record_id)

            init_snapshot = json.dumps({
                'id': record_id,
                'comment_id': comment_id,
                'current_status': status,
                'boundary_value': boundary_value,
                'threshold_value': BOUNDARY_THRESHOLD,
                'is_boundary_case': 1 if is_boundary else 0,
                'needs_teacher_review': 1 if needs_review else 0,
                'teacher_review_result': None,
                'teacher_reviewer': None,
                'teacher_review_at': None,
                'assistant_operator': imported_by,
                'assistant_note': None,
                'is_counterexample': 0,
                'counterexample_types': None,
                'note_modified_count': 0
            }, ensure_ascii=False)

            _append_history(
                cursor, record_id, 'import', None, json.dumps(comment, ensure_ascii=False),
                imported_by, 'create', '首次导入老师批注', init_snapshot
            )

            success_count += 1

        except Exception as e:
            skipped_items.append(f"第{line_number}行: 导入失败 - {str(e)}")

    for rid in record_ids:
        _sync_counterexample_flags(cursor, rid)

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
    related_record_ids = []

    for sample in sampling_data:
        sample_id = sample.get('sample_id')
        sample_name = sample.get('sample_name', '')
        comment_id = sample.get('comment_id')
        supplementary_note = sample.get('supplementary_note', '')

        cursor.execute('''
            SELECT id, supplementary_note, comment_id as old_cid FROM sampling_list WHERE sample_id = ?
        ''', (sample_id,))

        existing = cursor.fetchone()

        if existing:
            old_cid = existing['old_cid']
            if old_cid and old_cid != comment_id:
                cursor.execute('''
                    SELECT id FROM processing_records WHERE comment_id = ?
                ''', (old_cid,))
                old_pr = cursor.fetchone()
                if old_pr:
                    related_record_ids.append(old_pr['id'])

            snapshot = ''
            if comment_id:
                cursor.execute('SELECT id FROM processing_records WHERE comment_id = ?', (comment_id,))
                pr = cursor.fetchone()
                if pr:
                    snapshot = take_record_snapshot(pr['id'])
                    related_record_ids.append(pr['id'])

            cursor.execute('''
                UPDATE sampling_list
                SET sample_name = ?, comment_id = ?, supplementary_note = ?,
                    supplementary_operator = ?, supplementary_at = CURRENT_TIMESTAMP
                WHERE sample_id = ?
            ''', (sample_name, comment_id, supplementary_note, operator, sample_id))

            if comment_id:
                cursor.execute('SELECT id FROM processing_records WHERE comment_id = ?', (comment_id,))
                record = cursor.fetchone()
                if record:
                    _append_history(
                        cursor, record['id'], 'sampling_link',
                        existing['supplementary_note'], supplementary_note,
                        operator, 'update', f'补录抽样名单关联: {supplementary_note}',
                        snapshot or take_record_snapshot(record['id'])
                    )

            updated_count += 1
            messages.append(f"样本{sample_id}: 已更新")
        else:
            snapshot = ''
            if comment_id:
                cursor.execute('SELECT id FROM processing_records WHERE comment_id = ?', (comment_id,))
                pr = cursor.fetchone()
                if pr:
                    snapshot = take_record_snapshot(pr['id'])
                    related_record_ids.append(pr['id'])

            cursor.execute('''
                INSERT INTO sampling_list
                (sample_id, sample_name, comment_id, supplementary_note,
                 supplementary_operator, supplementary_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ''', (sample_id, sample_name, comment_id, supplementary_note, operator))

            if comment_id:
                cursor.execute('SELECT id FROM processing_records WHERE comment_id = ?', (comment_id,))
                record = cursor.fetchone()
                if record:
                    _append_history(
                        cursor, record['id'], 'sampling_link',
                        None, sample_id, operator, 'create',
                        f'关联抽样名单: {supplementary_note}',
                        snapshot or take_record_snapshot(record['id'])
                    )

            updated_count += 1
            messages.append(f"样本{sample_id}: 已新增")

    for rid in set(related_record_ids):
        _sync_counterexample_flags(cursor, rid)

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

    current = _get_current_processing_record(cursor, record_id)
    if not current:
        conn.close()
        return False

    old_note = current.get('assistant_note')
    old_count = current.get('note_modified_count') or 0

    if old_note == new_note:
        conn.close()
        return True

    snapshot = take_record_snapshot(record_id)

    cursor.execute('''
        UPDATE processing_records
        SET assistant_note = ?, assistant_operator = ?,
            note_modified_count = ?, processed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (new_note, operator, old_count + 1, record_id))

    _append_history(
        cursor, record_id, 'assistant_note', old_note, new_note,
        operator, 'update', '实验助理修改备注', snapshot
    )

    _sync_counterexample_flags(cursor, record_id)

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

    current = _get_current_processing_record(cursor, record_id)
    if not current:
        conn.close()
        return False

    old_status = current.get('current_status')
    old_review = current.get('teacher_review_result')
    old_reviewer = current.get('teacher_reviewer')

    snapshot = take_record_snapshot(record_id)

    cursor.execute('''
        UPDATE processing_records
        SET current_status = ?, teacher_review_result = ?,
            teacher_reviewer = ?, teacher_review_at = CURRENT_TIMESTAMP,
            needs_teacher_review = 0, is_boundary_case = 0,
            processed_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (final_status, review_result, reviewer, record_id))

    _append_history(
        cursor, record_id, 'teacher_review',
        json.dumps({'status': old_status, 'review': old_review, 'reviewer': old_reviewer}, ensure_ascii=False),
        json.dumps({'status': final_status, 'review': review_result, 'reviewer': reviewer}, ensure_ascii=False),
        reviewer, 'review', '任课老师复核并最终判定', snapshot
    )

    _sync_counterexample_flags(cursor, record_id)

    conn.commit()
    conn.close()

    return True


def rollback_to_history(
    record_id: int,
    history_id: int,
    operator: str
) -> Dict:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT full_snapshot_before, field_name, operation_note, operated_at
        FROM change_history WHERE record_id = ? AND id = ?
    ''', (record_id, history_id))

    history = cursor.fetchone()
    result = {'success': False, 'message': '', 'restored_fields': []}

    if not history:
        conn.close()
        result['message'] = '未找到指定历史版本'
        return result

    snapshot_json = history['full_snapshot_before']
    if not snapshot_json:
        conn.close()
        result['message'] = '该历史版本没有完整快照，无法回滚'
        return result

    try:
        snapshot = json.loads(snapshot_json)
    except Exception as e:
        conn.close()
        result['message'] = f'快照解析失败: {str(e)}'
        return result

    current = _get_current_processing_record(cursor, record_id)
    if not current:
        conn.close()
        result['message'] = '未找到当前处理记录'
        return result

    before_rollback_snapshot = take_record_snapshot(record_id)

    allowed_fields = [
        'current_status', 'boundary_value', 'threshold_value',
        'is_boundary_case', 'needs_teacher_review',
        'teacher_review_result', 'teacher_reviewer', 'teacher_review_at',
        'assistant_operator', 'assistant_note',
        'is_counterexample', 'counterexample_types', 'note_modified_count'
    ]

    update_parts = []
    update_values = []
    restored = []

    for f in allowed_fields:
        if f in snapshot:
            new_val = snapshot[f]
            cur_val = current.get(f)
            if str(cur_val) != str(new_val):
                update_parts.append(f'{f} = ?')
                update_values.append(new_val)
                restored.append({
                    'field': f,
                    'from': cur_val,
                    'to': new_val
                })

    if not update_parts:
        conn.close()
        result['message'] = '没有需要回滚的字段差异'
        result['success'] = True
        return result

    update_values.append(record_id)
    update_sql = f"UPDATE processing_records SET {', '.join(update_parts)}, processed_at = CURRENT_TIMESTAMP WHERE id = ?"
    cursor.execute(update_sql, update_values)

    _append_history(
        cursor, record_id, 'rollback',
        json.dumps(current, ensure_ascii=False, default=str),
        json.dumps(snapshot, ensure_ascii=False, default=str),
        operator, 'rollback',
        f'回滚至版本#{history_id}（原操作：{history["operation_note"]}，时间：{history["operated_at"]}）',
        before_rollback_snapshot
    )

    _sync_counterexample_flags(cursor, record_id)

    conn.commit()
    conn.close()

    result['success'] = True
    result['message'] = '回滚成功'
    result['restored_fields'] = restored
    return result


def get_counterexamples(
    filter_types: Optional[List[str]] = None
) -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT
            pr.id as record_id,
            pr.current_status,
            pr.boundary_value,
            pr.threshold_value,
            pr.is_boundary_case,
            pr.needs_teacher_review,
            pr.assistant_note,
            pr.teacher_review_result,
            pr.is_counterexample,
            pr.counterexample_types,
            pr.note_modified_count,
            tc.id as comment_id,
            tc.source_file,
            tc.original_line_number,
            tc.original_content,
            tc.comment_text,
            tc.imported_at,
            sl.sample_id,
            sl.sample_name,
            sl.supplementary_note as sample_note
        FROM processing_records pr
        JOIN teacher_comments tc ON pr.comment_id = tc.id
        LEFT JOIN sampling_list sl ON tc.id = sl.comment_id AND sl.is_deleted = 0
        WHERE pr.is_counterexample = 1
        ORDER BY pr.processed_at DESC
    ''')

    rows = cursor.fetchall()
    conn.close()

    results = []
    for row in rows:
        d = dict(row)
        types_str = d.get('counterexample_types') or ''
        types = [t for t in types_str.split(',') if t]
        labels = [COUNTEREXAMPLE_LABELS.get(t, t) for t in types]

        if filter_types:
            if not any(t in filter_types for t in types):
                continue

        d['types'] = types
        d['type_labels'] = labels
        d['has_sample'] = bool(d.get('sample_id'))
        results.append(d)

    return results


def get_report_summary() -> Dict:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute('SELECT COUNT(*) as total FROM processing_records')
    total = cursor.fetchone()['total']

    cursor.execute("SELECT COUNT(*) as n FROM processing_records WHERE current_status = 'normal'")
    normal = cursor.fetchone()['n']

    cursor.execute("SELECT COUNT(*) as n FROM processing_records WHERE current_status = 'warning'")
    warning = cursor.fetchone()['n']

    cursor.execute("SELECT COUNT(*) as n FROM processing_records WHERE needs_teacher_review = 1")
    pending_review = cursor.fetchone()['n']

    cursor.execute("SELECT COUNT(*) as n FROM processing_records WHERE is_boundary_case = 1")
    boundary = cursor.fetchone()['n']

    cursor.execute("SELECT COUNT(*) as n FROM processing_records WHERE is_counterexample = 1")
    counterexamples = cursor.fetchone()['n']

    cursor.execute('''
        SELECT COUNT(DISTINCT pr.id) as n
        FROM processing_records pr
        JOIN teacher_comments tc ON pr.comment_id = tc.id
        LEFT JOIN sampling_list sl ON tc.id = sl.comment_id AND sl.is_deleted = 0
        WHERE sl.id IS NULL
    ''')
    missing_sample = cursor.fetchone()['n']

    cursor.execute("SELECT COUNT(*) as n FROM processing_records WHERE note_modified_count > 0")
    note_modified = cursor.fetchone()['n']

    cursor.execute('SELECT COUNT(*) as n FROM teacher_comments')
    comments = cursor.fetchone()['n']

    cursor.execute('SELECT COUNT(*) as n FROM sampling_list WHERE is_deleted = 0')
    samples = cursor.fetchone()['n']

    cursor.execute('SELECT COUNT(*) as n FROM change_history')
    changes = cursor.fetchone()['n']

    conn.close()

    return {
        'total_records': total,
        'normal': normal,
        'warning': warning,
        'pending_teacher_review': pending_review,
        'boundary_case': boundary,
        'counterexamples': counterexamples,
        'missing_sample': missing_sample,
        'note_modified': note_modified,
        'comments_imported': comments,
        'samples_recorded': samples,
        'total_changes': changes
    }


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
        LEFT JOIN sampling_list sl ON tc.id = sl.comment_id AND sl.is_deleted = 0
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

    types_str = record['counterexample_types'] or ''
    types = [t for t in types_str.split(',') if t]

    return {
        'basic_info': dict(record),
        'counterexample': {
            'is_counterexample': bool(record['is_counterexample']),
            'types': types,
            'labels': [COUNTEREXAMPLE_LABELS.get(t, t) for t in types]
        },
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
                'teacher_reviewer': record['teacher_reviewer'],
                'teacher_review_at': record['teacher_review_at'],
                'assistant_note': record['assistant_note'],
                'assistant_operator': record['assistant_operator'],
                'note_modified_count': record['note_modified_count']
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
    ''')

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
        has_snapshot = bool(entry['full_snapshot_before'])
        diffs.append({
            'version': i + 1,
            'history_id': entry['id'],
            'timestamp': entry['operated_at'],
            'operator': entry['operator'],
            'operation_type': entry['operation_type'],
            'field': entry['field_name'],
            'old_value': entry['old_value'],
            'new_value': entry['new_value'],
            'note': entry['operation_note'],
            'can_rollback': has_snapshot and entry['operation_type'] != 'rollback'
        })

    return diffs
