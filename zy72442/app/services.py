import json
from datetime import datetime
from app.database import get_conn
from config import STATUS, STATUS_LABELS, NEXT_OWNER, ROLES

def row_to_dict(row):
    if row is None:
        return None
    return dict(row)

def rows_to_dict(rows):
    return [dict(r) for r in rows]

def get_user(user_id):
    conn = get_conn()
    user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
    conn.close()
    return row_to_dict(user)

def get_user_by_username(username):
    conn = get_conn()
    user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    conn.close()
    return row_to_dict(user)

def create_user(username, name, role):
    conn = get_conn()
    cursor = conn.cursor()
    cursor.execute(
        'INSERT INTO users (username, name, role) VALUES (?, ?, ?)',
        (username, name, role)
    )
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()
    return user_id

def import_audio_note(track_name, file_path, duration, has_leave_hours, leave_hours_count, original_note, imported_by):
    conn = get_conn()
    cursor = conn.cursor()
    
    cursor.execute(
        '''INSERT INTO audio_notes 
           (track_name, file_path, duration, has_leave_hours, leave_hours_count, original_note, imported_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        (track_name, file_path, duration, 1 if has_leave_hours else 0, leave_hours_count, original_note, imported_by)
    )
    audio_note_id = cursor.lastrowid
    
    user = get_user(imported_by)
    operator_name = user['name'] if user else '未知'
    
    if has_leave_hours:
        status = STATUS['LEAVE_MARKED']
        reason_kept = f'检测到 {leave_hours_count} 节请假课时被算入已消耗，需巡演统筹复核确认是否属于正常消耗'
        missing_materials = '暂无'
        next_owner = ROLES['TOUR_COORDINATOR']
        next_action = '复核请假课时消耗是否合理，确认后可标记为待处理或通过'
    else:
        status = STATUS['AUTH_MISSING']
        reason_kept = '音频文件已导入，需补充授权期限页信息'
        missing_materials = '授权期限页（授权编号、有效期起止）'
        next_owner = ROLES['MUSIC_TEACHER']
        next_action = '查找并上传该曲目的授权期限页扫描件或录入授权信息'
    
    cursor.execute(
        '''INSERT INTO track_checklists 
           (audio_note_id, status, reason_kept, missing_materials, next_owner, next_action)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (audio_note_id, status, reason_kept, missing_materials, next_owner, next_action)
    )
    checklist_id = cursor.lastrowid
    
    cursor.execute(
        '''INSERT INTO rework_records
           (audio_note_id, checklist_id, action_type, reason, operator_id, operator_name, affected_results)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        (audio_note_id, checklist_id, 'import', '音频文件备注第一次导入系统', imported_by, operator_name,
         f'创建曲目核对表，状态：{STATUS_LABELS[status]}，下一步：{NEXT_OWNER[next_owner]}')
    )
    
    conn.commit()
    conn.close()
    return audio_note_id

def add_authorization_page(audio_note_id, authorization_number, valid_from, valid_to, page_content, uploaded_by):
    conn = get_conn()
    cursor = conn.cursor()
    
    cursor.execute(
        '''INSERT INTO authorization_pages
           (audio_note_id, authorization_number, valid_from, valid_to, page_content, uploaded_by)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (audio_note_id, authorization_number, valid_from, valid_to, page_content, uploaded_by)
    )
    
    audio_note = conn.execute('SELECT * FROM audio_notes WHERE id = ?', (audio_note_id,)).fetchone()
    checklist = conn.execute('SELECT * FROM track_checklists WHERE audio_note_id = ? ORDER BY id DESC LIMIT 1', (audio_note_id,)).fetchone()
    
    user = get_user(uploaded_by)
    operator_name = user['name'] if user else '未知'
    
    old_status = checklist['status']
    
    if audio_note['has_leave_hours']:
        new_status = STATUS['PENDING_REVIEW']
        reason_kept = f'授权期限页已补充（授权号：{authorization_number}，有效期：{valid_from} 至 {valid_to}），但仍有 {audio_note["leave_hours_count"]} 节请假课时待复核'
        missing_materials = '暂无'
        next_owner = ROLES['TOUR_COORDINATOR']
        next_action = '最终复核请假课时消耗异常，确认无误后标记完成'
    else:
        new_status = STATUS['AUTH_COMPLETED']
        reason_kept = f'授权期限页已补充（授权号：{authorization_number}，有效期：{valid_from} 至 {valid_to}），资料齐全'
        missing_materials = '暂无'
        next_owner = ROLES['TOUR_COORDINATOR']
        next_action = '确认所有信息无误，标记为完成'
    
    cursor.execute(
        '''UPDATE track_checklists 
           SET status = ?, reason_kept = ?, missing_materials = ?, next_owner = ?, next_action = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?''',
        (new_status, reason_kept, missing_materials, next_owner, next_action, checklist['id'])
    )
    
    cursor.execute(
        '''INSERT INTO rework_records
           (audio_note_id, checklist_id, action_type, field_changed, old_value, new_value, reason, operator_id, operator_name, affected_results)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (audio_note_id, checklist['id'], 'add_auth', 'status', old_status, new_status,
         f'音乐老师{operator_name}补录授权期限页信息', uploaded_by, operator_name,
         f'状态从「{STATUS_LABELS[old_status]}」更新为「{STATUS_LABELS[new_status]}」，曲目核对表已同步更新')
    )
    
    conn.commit()
    conn.close()
    return True

def manual_correction(audio_note_id, field, old_value, new_value, reason, operator_id):
    conn = get_conn()
    cursor = conn.cursor()
    
    user = get_user(operator_id)
    operator_name = user['name'] if user else '未知'
    
    checklist = conn.execute('SELECT * FROM track_checklists WHERE audio_note_id = ? ORDER BY id DESC LIMIT 1', (audio_note_id,)).fetchone()
    
    affected = f'人工修正字段「{field}」：{old_value} → {new_value}'
    
    if field == 'status':
        cursor.execute(
            'UPDATE track_checklists SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (new_value, checklist['id'])
        )
        affected += f'，曲目核对表状态更新为「{STATUS_LABELS.get(new_value, new_value)}」'
    elif field == 'next_owner':
        cursor.execute(
            'UPDATE track_checklists SET next_owner = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (new_value, checklist['id'])
        )
        affected += f'，下一步负责人变更为「{NEXT_OWNER.get(new_value, new_value)}」'
    elif field == 'reason_kept':
        cursor.execute(
            'UPDATE track_checklists SET reason_kept = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (new_value, checklist['id'])
        )
        affected += '，保留原因已更新'
    elif field == 'missing_materials':
        cursor.execute(
            'UPDATE track_checklists SET missing_materials = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (new_value, checklist['id'])
        )
        affected += '，缺失材料清单已更新'
    
    cursor.execute(
        '''INSERT INTO rework_records
           (audio_note_id, checklist_id, action_type, field_changed, old_value, new_value, reason, operator_id, operator_name, affected_results)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (audio_note_id, checklist['id'], 'manual_correction', field, old_value, new_value,
         reason, operator_id, operator_name, affected)
    )
    
    conn.commit()
    conn.close()
    return True

def rerun_process(audio_note_id, reason, operator_id):
    conn = get_conn()
    cursor = conn.cursor()
    
    user = get_user(operator_id)
    operator_name = user['name'] if user else '未知'
    
    audio_note = conn.execute('SELECT * FROM audio_notes WHERE id = ?', (audio_note_id,)).fetchone()
    old_checklist = conn.execute('SELECT * FROM track_checklists WHERE audio_note_id = ? ORDER BY id DESC LIMIT 1', (audio_note_id,)).fetchone()
    
    auth_page = conn.execute('SELECT * FROM authorization_pages WHERE audio_note_id = ? ORDER BY id DESC LIMIT 1', (audio_note_id,)).fetchone()
    
    if audio_note['has_leave_hours']:
        if auth_page:
            new_status = STATUS['PENDING_REVIEW']
            reason_kept = f'重跑后检测到 {audio_note["leave_hours_count"]} 节请假课时，授权已补，最终待巡演统筹复核'
            missing_materials = '暂无'
            next_owner = ROLES['TOUR_COORDINATOR']
            next_action = '复核请假课时消耗是否合理，确认后标记完成'
        else:
            new_status = STATUS['LEAVE_MARKED']
            reason_kept = f'重跑后仍检测到 {audio_note["leave_hours_count"]} 节请假课时，且缺少授权期限页'
            missing_materials = '授权期限页'
            next_owner = ROLES['MUSIC_TEACHER']
            next_action = '先补授权期限页，再交由巡演统筹复核请假课时'
    else:
        if auth_page:
            new_status = STATUS['AUTH_COMPLETED']
            reason_kept = '重跑后确认无请假课时异常，授权期限页已齐全'
            missing_materials = '暂无'
            next_owner = ROLES['TOUR_COORDINATOR']
            next_action = '确认无误后标记为完成'
        else:
            new_status = STATUS['AUTH_MISSING']
            reason_kept = '重跑后确认无请假课时异常，但仍缺授权期限页'
            missing_materials = '授权期限页'
            next_owner = ROLES['MUSIC_TEACHER']
            next_action = '补充授权期限页信息'
    
    cursor.execute(
        '''INSERT INTO track_checklists 
           (audio_note_id, status, reason_kept, missing_materials, next_owner, next_action)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (audio_note_id, new_status, reason_kept, missing_materials, next_owner, next_action)
    )
    new_checklist_id = cursor.lastrowid
    
    cursor.execute(
        '''INSERT INTO rework_records
           (audio_note_id, checklist_id, action_type, field_changed, old_value, new_value, reason, operator_id, operator_name, affected_results)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (audio_note_id, new_checklist_id, 'rerun', 'checklist_version', 
         f'版本#{old_checklist["id"]}', f'版本#{new_checklist_id}',
         reason, operator_id, operator_name,
         f'重跑流程，生成新版本曲目核对表，状态：{STATUS_LABELS[new_status]}，旧状态：{STATUS_LABELS[old_checklist["status"]]}')
    )
    
    conn.commit()
    conn.close()
    return new_checklist_id

def get_checklist(audio_note_id):
    conn = get_conn()
    checklist = conn.execute(
        'SELECT * FROM track_checklists WHERE audio_note_id = ? ORDER BY id DESC LIMIT 1',
        (audio_note_id,)
    ).fetchone()
    conn.close()
    return row_to_dict(checklist)

def get_all_checklists():
    conn = get_conn()
    checklists = conn.execute('''
        SELECT tc.*, an.track_name, an.has_leave_hours, an.leave_hours_count
        FROM track_checklists tc
        JOIN audio_notes an ON tc.audio_note_id = an.id
        WHERE tc.id IN (
            SELECT MAX(id) FROM track_checklists GROUP BY audio_note_id
        )
        ORDER BY tc.updated_at DESC
    ''').fetchall()
    conn.close()
    return rows_to_dict(checklists)

def get_rework_records(audio_note_id=None):
    conn = get_conn()
    if audio_note_id:
        records = conn.execute(
            'SELECT * FROM rework_records WHERE audio_note_id = ? ORDER BY created_at DESC',
            (audio_note_id,)
        ).fetchall()
    else:
        records = conn.execute('SELECT * FROM rework_records ORDER BY created_at DESC').fetchall()
    conn.close()
    return rows_to_dict(records)

def get_audio_note(audio_note_id):
    conn = get_conn()
    note = conn.execute('SELECT * FROM audio_notes WHERE id = ?', (audio_note_id,)).fetchone()
    conn.close()
    return row_to_dict(note)

def get_authorization_page(audio_note_id):
    conn = get_conn()
    page = conn.execute(
        'SELECT * FROM authorization_pages WHERE audio_note_id = ? ORDER BY id DESC LIMIT 1',
        (audio_note_id,)
    ).fetchone()
    conn.close()
    return row_to_dict(page)

def get_all_audio_notes():
    conn = get_conn()
    notes = conn.execute('SELECT * FROM audio_notes ORDER BY imported_at DESC').fetchall()
    conn.close()
    return rows_to_dict(notes)

def review_complete(audio_note_id, operator_id):
    conn = get_conn()
    cursor = conn.cursor()
    
    user = get_user(operator_id)
    operator_name = user['name'] if user else '未知'
    
    checklist = conn.execute('SELECT * FROM track_checklists WHERE audio_note_id = ? ORDER BY id DESC LIMIT 1', (audio_note_id,)).fetchone()
    old_status = checklist['status']
    
    new_status = STATUS['COMPLETED']
    
    cursor.execute(
        '''UPDATE track_checklists 
           SET status = ?, reason_kept = ?, missing_materials = ?, next_owner = ?, next_action = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?''',
        (new_status, '巡演统筹已复核，所有信息确认无误', '暂无', ROLES['ADMIN'], '流程完成，归档', checklist['id'])
    )
    
    cursor.execute(
        '''INSERT INTO rework_records
           (audio_note_id, checklist_id, action_type, field_changed, old_value, new_value, reason, operator_id, operator_name, affected_results)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (audio_note_id, checklist['id'], 'review_complete', 'status', old_status, new_status,
         '巡演统筹复核通过，请假课时消耗确认无误', operator_id, operator_name,
         f'状态从「{STATUS_LABELS[old_status]}」更新为「{STATUS_LABELS[new_status]}」，流程结束')
    )
    
    conn.commit()
    conn.close()
    return True
