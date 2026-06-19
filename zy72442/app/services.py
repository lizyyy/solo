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

def import_audio_note(track_name, file_path, duration, has_leave_hours, leave_hours_count, original_note, imported_by, source_material=None):
    conn = get_conn()
    cursor = conn.cursor()
    
    cursor.execute(
        '''INSERT INTO audio_notes 
           (track_name, file_path, duration, has_leave_hours, leave_hours_count, original_leave_hours_count, leave_hours_correction_note, original_note, imported_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (track_name, file_path, duration, 1 if has_leave_hours else 0, leave_hours_count, leave_hours_count, None, original_note, imported_by)
    )
    audio_note_id = cursor.lastrowid
    
    user = get_user(imported_by)
    operator_name = user['name'] if user else '未知'
    
    if has_leave_hours:
        status = STATUS['LEAVE_MARKED']
        reason_kept = f'检测到 {leave_hours_count} 节请假课时被算入已消耗，原始导入记录显示为{leave_hours_count}节，需巡演统筹复核确认是否属于正常消耗'
        missing_materials = '请假课时原始消耗明细报表、授课老师签字确认单'
        missing_materials_source = '依据：系统自动检测音频文件备注中的请假课时标记，触发缺失材料提示'
        next_owner = ROLES['TOUR_COORDINATOR']
        next_action = '核对请假课时原始明细，确认2节是否均为合理消耗，或找出重复统计的证据'
        data_source = 'initial_import'
    else:
        status = STATUS['AUTH_MISSING']
        reason_kept = '音频文件已导入，需补充授权期限页信息'
        missing_materials = '授权期限页（授权编号、有效期起止）'
        missing_materials_source = '依据：标准流程要求，所有曲目需提供授权文件'
        next_owner = ROLES['MUSIC_TEACHER']
        next_action = '查找并上传该曲目的授权期限页扫描件或录入授权信息'
        data_source = 'initial_import'
    
    cursor.execute(
        '''INSERT INTO track_checklists 
           (audio_note_id, status, reason_kept, missing_materials, missing_materials_source, leave_hours_count_used, next_owner, next_action, data_source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (audio_note_id, status, reason_kept, missing_materials, missing_materials_source, leave_hours_count, next_owner, next_action, data_source)
    )
    checklist_id = cursor.lastrowid
    
    if source_material is None:
        source_material = f'音频文件：{track_name}，原始备注：{original_note}'
    
    cursor.execute(
        '''INSERT INTO rework_records
           (audio_note_id, checklist_id, action_type, reason, operator_id, operator_name, affected_results, source_material)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
        (audio_note_id, checklist_id, 'import', '音频文件备注第一次导入系统', imported_by, operator_name,
         f'创建曲目核对表，状态：{STATUS_LABELS[status]}，下一步：{NEXT_OWNER[next_owner]}，使用请假课时数：{leave_hours_count}节',
         source_material)
    )
    
    conn.commit()
    conn.close()
    return audio_note_id

def add_authorization_page(audio_note_id, authorization_number, valid_from, valid_to, page_content, uploaded_by, source_material=None):
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
    current_leave_count = audio_note['leave_hours_count']
    original_leave_count = audio_note['original_leave_hours_count']
    correction_note = audio_note['leave_hours_correction_note']
    
    if audio_note['has_leave_hours']:
        new_status = STATUS['PENDING_REVIEW']
        if correction_note:
            reason_kept = f'授权期限页已补充（授权号：{authorization_number}，有效期：{valid_from} 至 {valid_to}），请假课时原始{original_leave_count}节，经修正后为{current_leave_count}节，{correction_note}，需巡演统筹最终确认'
        else:
            reason_kept = f'授权期限页已补充（授权号：{authorization_number}，有效期：{valid_from} 至 {valid_to}），仍有 {current_leave_count} 节请假课时待复核（原始记录为{original_leave_count}节）'
        missing_materials = '请假课时消耗明细核对表、差异说明文件（如已修正）'
        missing_materials_source = f'依据：已补授权文件编号{authorization_number}，请假课时数据来自audio_notes表当前值{current_leave_count}节'
        next_owner = ROLES['TOUR_COORDINATOR']
        next_action = '最终复核请假课时消耗异常，核对原始{original_leave_count}节与修正后{current_leave_count}节的差异原因，确认无误后标记完成'
    else:
        new_status = STATUS['AUTH_COMPLETED']
        reason_kept = f'授权期限页已补充（授权号：{authorization_number}，有效期：{valid_from} 至 {valid_to}），资料齐全'
        missing_materials = '暂无'
        missing_materials_source = f'依据：已补授权文件编号{authorization_number}，无请假课时异常'
        next_owner = ROLES['TOUR_COORDINATOR']
        next_action = '确认所有信息无误，标记为完成'
    
    cursor.execute(
        '''UPDATE track_checklists 
           SET status = ?, reason_kept = ?, missing_materials = ?, missing_materials_source = ?, leave_hours_count_used = ?, next_owner = ?, next_action = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?''',
        (new_status, reason_kept, missing_materials, missing_materials_source, current_leave_count, next_owner, next_action, checklist['id'])
    )
    
    if source_material is None:
        source_material = f'授权文件扫描件，编号{authorization_number}，有效期{valid_from}至{valid_to}'
    
    cursor.execute(
        '''INSERT INTO rework_records
           (audio_note_id, checklist_id, action_type, field_changed, old_value, new_value, reason, operator_id, operator_name, affected_results, source_material)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (audio_note_id, checklist['id'], 'add_auth', 'status', old_status, new_status,
         f'音乐老师{operator_name}补录授权期限页信息', uploaded_by, operator_name,
         f'状态从「{STATUS_LABELS[old_status]}」更新为「{STATUS_LABELS[new_status]}」，曲目核对表同步更新，当前使用请假课时数：{current_leave_count}节（原始{original_leave_count}节）',
         source_material)
    )
    
    conn.commit()
    conn.close()
    return True

def manual_correction(audio_note_id, field, old_value, new_value, reason, operator_id, source_material=None):
    conn = get_conn()
    cursor = conn.cursor()
    
    user = get_user(operator_id)
    operator_name = user['name'] if user else '未知'
    
    audio_note = conn.execute('SELECT * FROM audio_notes WHERE id = ?', (audio_note_id,)).fetchone()
    checklist = conn.execute('SELECT * FROM track_checklists WHERE audio_note_id = ? ORDER BY id DESC LIMIT 1', (audio_note_id,)).fetchone()
    
    affected = f'人工修正字段「{field}」：{old_value} → {new_value}'
    current_leave_count = audio_note['leave_hours_count']
    original_leave_count = audio_note['original_leave_hours_count']
    
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
            'UPDATE track_checklists SET missing_materials = ?, missing_materials_source = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (new_value, f'依据：人工修正，操作人{operator_name}，原因：{reason}', checklist['id'])
        )
        affected += '，缺失材料清单已更新，同步更新材料来源追溯'
    elif field == 'leave_hours_count':
        new_count = int(new_value)
        old_count = int(old_value)
        cursor.execute(
            '''UPDATE audio_notes 
               SET leave_hours_count = ?, leave_hours_correction_note = ?, has_leave_hours = ?, last_corrected_by = ?, last_corrected_at = CURRENT_TIMESTAMP
               WHERE id = ?''',
            (new_count, reason, 1 if new_count > 0 else 0, operator_id, audio_note_id)
        )
        auth_page = conn.execute('SELECT * FROM authorization_pages WHERE audio_note_id = ? ORDER BY id DESC LIMIT 1', (audio_note_id,)).fetchone()
        if auth_page:
            new_reason_kept = f'授权期限页已补充（授权号：{auth_page["authorization_number"]}，有效期：{auth_page["valid_from"]} 至 {auth_page["valid_to"]}），请假课时原始{original_leave_count}节，经人工修正后为{new_count}节，修正原因：{reason}，需巡演统筹最终确认'
            new_missing_materials = '请假课时消耗原始明细报表、人工修正说明文件（考勤表原件、差异对比表）、巡演统筹复核确认单'
            new_missing_materials_source = f'依据：授权文件编号{auth_page["authorization_number"]}已补，请假课时数据已人工修正：audio_notes表当前值{new_count}节，原始值{original_leave_count}节（旧值{old_count}节），差异来自本次人工修正记录，需复核材料支撑修正依据'
        else:
            new_reason_kept = f'检测到 {new_count} 节请假课时被算入已消耗（原始{original_leave_count}节，经人工修正：{reason}），且缺少授权期限页'
            new_missing_materials = '授权期限页、请假课时消耗原始明细报表、人工修正说明文件'
            new_missing_materials_source = f'依据：请假课时数据已人工修正：audio_notes表当前值{new_count}节，原始值{original_leave_count}节（旧值{old_count}节），缺少授权文件，触发缺失材料提示'
        new_next_owner = ROLES['TOUR_COORDINATOR'] if auth_page else ROLES['MUSIC_TEACHER']
        if auth_page:
            new_next_action = f'最终复核：请假课时原始{original_leave_count}节→旧值{old_count}节→修正后{new_count}节，核对修正原因和支撑材料，确认后标记完成'
        else:
            new_next_action = f'先补授权期限页，再复核请假课时（修正后{new_count}节，原始{original_leave_count}节）'
        cursor.execute(
            '''UPDATE track_checklists 
               SET leave_hours_count_used = ?, reason_kept = ?, missing_materials = ?, missing_materials_source = ?, next_owner = ?, next_action = ?, updated_at = CURRENT_TIMESTAMP 
               WHERE id = ?''',
            (new_count, new_reason_kept, new_missing_materials, new_missing_materials_source, new_next_owner, new_next_action, checklist['id'])
        )
        for hist_id, in conn.execute('SELECT id FROM track_checklists WHERE audio_note_id = ? AND id != ?', (audio_note_id, checklist['id'])).fetchall():
            cursor.execute(
                '''UPDATE track_checklists 
                   SET leave_hours_count_used = ?, reason_kept = CASE WHEN reason_kept LIKE '%节请假课%' THEN ? ELSE reason_kept END,
                       missing_materials_source = ?, updated_at = CURRENT_TIMESTAMP 
                   WHERE id = ?''',
                (new_count, new_reason_kept, new_missing_materials_source, hist_id)
            )
        current_leave_count = new_count
        affected = f'人工修正底层请假课时数：{old_count}节 → {new_count}节（原始{original_leave_count}节），同步更新当前版本+历史版本的reason_kept/missing_materials/missing_materials_source，确保文字说明与数值一致'
    elif field == 'missing_materials_source':
        cursor.execute(
            'UPDATE track_checklists SET missing_materials_source = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            (new_value, checklist['id'])
        )
        affected += '，缺失材料来源追溯已更新'
    
    if source_material is None:
        source_material = f'人工修正操作，依据：{reason}，操作人：{operator_name}'
    
    cursor.execute(
        '''INSERT INTO rework_records
           (audio_note_id, checklist_id, action_type, field_changed, old_value, new_value, reason, operator_id, operator_name, affected_results, source_material)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (audio_note_id, checklist['id'], 'manual_correction', field, old_value, new_value,
         reason, operator_id, operator_name, affected, source_material)
    )
    
    conn.commit()
    conn.close()
    return True

def rerun_process(audio_note_id, reason, operator_id, source_material=None):
    conn = get_conn()
    cursor = conn.cursor()
    
    user = get_user(operator_id)
    operator_name = user['name'] if user else '未知'
    
    audio_note = conn.execute('SELECT * FROM audio_notes WHERE id = ?', (audio_note_id,)).fetchone()
    old_checklist = conn.execute('SELECT * FROM track_checklists WHERE audio_note_id = ? ORDER BY id DESC LIMIT 1', (audio_note_id,)).fetchone()
    
    auth_page = conn.execute('SELECT * FROM authorization_pages WHERE audio_note_id = ? ORDER BY id DESC LIMIT 1', (audio_note_id,)).fetchone()
    
    current_leave_count = audio_note['leave_hours_count']
    original_leave_count = audio_note['original_leave_hours_count']
    correction_note = audio_note['leave_hours_correction_note']
    
    has_correction = correction_note is not None and current_leave_count != original_leave_count
    
    if audio_note['has_leave_hours']:
        if auth_page:
            new_status = STATUS['PENDING_REVIEW']
            if has_correction:
                reason_kept = f'重跑后检测到 {current_leave_count} 节请假课时（原始{original_leave_count}节，已人工修正，修正原因：{correction_note}），授权已补，最终待巡演统筹复核'
            else:
                reason_kept = f'重跑后检测到 {current_leave_count} 节请假课时（原始{original_leave_count}节，无修正记录），授权已补，最终待巡演统筹复核'
            missing_materials = '请假课时消耗原始明细报表、人工修正说明文件（如有）、巡演统筹复核确认单'
            if has_correction:
                missing_materials_source = f'依据：重跑时读取audio_notes表当前值{current_leave_count}节，原始值{original_leave_count}节，差异来自rework_records表中的人工修正记录，触发缺失复核材料提示'
            else:
                missing_materials_source = f'依据：重跑时读取audio_notes表当前值{current_leave_count}节，与原始值一致，需复核确认'
            next_owner = ROLES['TOUR_COORDINATOR']
            next_action = f'复核请假课时消耗：原始{original_leave_count}节，现显示{current_leave_count}节，核对差异原因和修正材料，确认后标记完成'
            data_source = 'rerun_with_correction' if has_correction else 'rerun_original'
        else:
            new_status = STATUS['LEAVE_MARKED']
            if has_correction:
                reason_kept = f'重跑后检测到 {current_leave_count} 节请假课时（原始{original_leave_count}节，已人工修正：{correction_note}），且缺少授权期限页'
            else:
                reason_kept = f'重跑后检测到 {current_leave_count} 节请假课时（原始{original_leave_count}节），且缺少授权期限页'
            missing_materials = '授权期限页、请假课时消耗明细报表'
            missing_materials_source = f'依据：重跑时检测到无授权文件，请假课时数据{current_leave_count}节来自audio_notes表'
            next_owner = ROLES['MUSIC_TEACHER']
            next_action = f'先补授权期限页，再交由巡演统筹复核请假课时（{current_leave_count}节）'
            data_source = 'rerun_no_auth'
    else:
        if auth_page:
            new_status = STATUS['AUTH_COMPLETED']
            reason_kept = '重跑后确认无请假课时异常，授权期限页已齐全'
            missing_materials = '暂无'
            missing_materials_source = '依据：重跑确认无异常，资料齐全'
            next_owner = ROLES['TOUR_COORDINATOR']
            next_action = '确认无误后标记为完成'
            data_source = 'rerun_normal'
        else:
            new_status = STATUS['AUTH_MISSING']
            reason_kept = '重跑后确认无请假课时异常，但仍缺授权期限页'
            missing_materials = '授权期限页'
            missing_materials_source = '依据：重跑确认缺授权文件'
            next_owner = ROLES['MUSIC_TEACHER']
            next_action = '补充授权期限页信息'
            data_source = 'rerun_missing_auth'
    
    cursor.execute(
        '''INSERT INTO track_checklists 
           (audio_note_id, status, reason_kept, missing_materials, missing_materials_source, leave_hours_count_used, next_owner, next_action, data_source)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (audio_note_id, new_status, reason_kept, missing_materials, missing_materials_source, current_leave_count, next_owner, next_action, data_source)
    )
    new_checklist_id = cursor.lastrowid
    
    if source_material is None:
        source_material = f'重跑流程触发，读取最新audio_notes.leave_hours_count={current_leave_count}节，原始值={original_leave_count}节，已修正={has_correction}'
    
    cursor.execute(
        '''INSERT INTO rework_records
           (audio_note_id, checklist_id, action_type, field_changed, old_value, new_value, reason, operator_id, operator_name, affected_results, source_material)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (audio_note_id, new_checklist_id, 'rerun', 'checklist_version', 
         f'版本#{old_checklist["id"]}', f'版本#{new_checklist_id}',
         reason, operator_id, operator_name,
         f'重跑流程，生成新版本曲目核对表，状态：{STATUS_LABELS[new_status]}，旧状态：{STATUS_LABELS[old_checklist["status"]]}，使用请假课时数：{current_leave_count}节（原始{original_leave_count}节，已修正：{has_correction}）',
         source_material)
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
        SELECT tc.*, an.track_name, an.has_leave_hours, an.leave_hours_count, an.original_leave_hours_count, an.leave_hours_correction_note
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

def review_complete(audio_note_id, operator_id, source_material=None):
    conn = get_conn()
    cursor = conn.cursor()
    
    user = get_user(operator_id)
    operator_name = user['name'] if user else '未知'
    
    audio_note = conn.execute('SELECT * FROM audio_notes WHERE id = ?', (audio_note_id,)).fetchone()
    checklist = conn.execute('SELECT * FROM track_checklists WHERE audio_note_id = ? ORDER BY id DESC LIMIT 1', (audio_note_id,)).fetchone()
    old_status = checklist['status']
    
    new_status = STATUS['COMPLETED']
    current_leave_count = audio_note['leave_hours_count']
    original_leave_count = audio_note['original_leave_hours_count']
    
    cursor.execute(
        '''UPDATE track_checklists 
           SET status = ?, reason_kept = ?, missing_materials = ?, missing_materials_source = ?, next_owner = ?, next_action = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?''',
        (new_status, 
         f'巡演统筹已复核，请假课时{current_leave_count}节（原始{original_leave_count}节）消耗确认无误，所有信息核对通过', 
         '暂无', 
         f'依据：巡演统筹{operator_name}复核通过，请假课时数据最终确认为{current_leave_count}节', 
         ROLES['ADMIN'], 
         '流程完成，归档', 
         checklist['id'])
    )
    
    if source_material is None:
        source_material = f'巡演统筹复核签字确认单，请假课时{current_leave_count}节确认无误'
    
    cursor.execute(
        '''INSERT INTO rework_records
           (audio_note_id, checklist_id, action_type, field_changed, old_value, new_value, reason, operator_id, operator_name, affected_results, source_material)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
        (audio_note_id, checklist['id'], 'review_complete', 'status', old_status, new_status,
         '巡演统筹复核通过，请假课时消耗确认无误', operator_id, operator_name,
         f'状态从「{STATUS_LABELS[old_status]}」更新为「{STATUS_LABELS[new_status]}」，流程结束，最终请假课时数确认：{current_leave_count}节（原始{original_leave_count}节）',
         source_material)
    )
    
    conn.commit()
    conn.close()
    return True

def get_checklist_history(audio_note_id):
    conn = get_conn()
    checklists = conn.execute(
        'SELECT * FROM track_checklists WHERE audio_note_id = ? ORDER BY id ASC',
        (audio_note_id,)
    ).fetchall()
    conn.close()
    return rows_to_dict(checklists)

def generate_report(audio_note_id=None, fmt='text'):
    conn = get_conn()
    conn.row_factory = sqlite3.Row
    
    if audio_note_id:
        note_ids = [audio_note_id]
    else:
        note_ids = [r[0] for r in conn.execute('SELECT id FROM audio_notes ORDER BY id').fetchall()]
    
    reports = []
    for nid in note_ids:
        note = conn.execute('SELECT * FROM audio_notes WHERE id = ?', (nid,)).fetchone()
        checklists = conn.execute('SELECT * FROM track_checklists WHERE audio_note_id = ? ORDER BY id ASC', (nid,)).fetchall()
        records = conn.execute('SELECT * FROM rework_records WHERE audio_note_id = ? ORDER BY id ASC', (nid,)).fetchall()
        auth = conn.execute('SELECT * FROM authorization_pages WHERE audio_note_id = ? ORDER BY id DESC LIMIT 1', (nid,)).fetchone()
        
        rpt = {
            'audio_note': dict(note),
            'checklist_history': [dict(c) for c in checklists],
            'rework_records': [dict(r) for r in records],
            'authorization': dict(auth) if auth else None,
        }
        reports.append(rpt)
    
    conn.close()
    
    if fmt == 'json':
        import json
        return json.dumps(reports, ensure_ascii=False, indent=2, default=str)
    else:
        lines = []
        for rpt in reports:
            note = rpt['audio_note']
            hist = rpt['checklist_history']
            recs = rpt['rework_records']
            auth = rpt['authorization']
            has_corr = note.get('leave_hours_correction_note') and note['leave_hours_count'] != note['original_leave_hours_count']
            
            lines.append('=' * 80)
            lines.append('伴奏降噪返工记录 - 复核报告')
            lines.append('=' * 80)
            lines.append('')
            lines.append('【曲目信息】')
            lines.append('  曲目名称: ' + note['track_name'])
            lines.append('  曲目ID: #' + str(note['id']))
            if note.get('file_path'):
                lines.append('  文件路径: ' + note['file_path'])
            lines.append('')
            lines.append('【请假课时数据 - 双轨追溯】')
            lines.append('  原始导入值: ' + str(note['original_leave_hours_count']) + '节 (永久保留用于审计)')
            lines.append('  当前使用值: ' + str(note['leave_hours_count']) + '节')
            if has_corr:
                lines.append('  ⚠️  已人工修正: ' + str(note['original_leave_hours_count']) + ' → ' + str(note['leave_hours_count']) + '节')
                lines.append('  修正说明: ' + note['leave_hours_correction_note'])
                if note.get('last_corrected_at'):
                    lines.append('  修正时间: ' + note['last_corrected_at'])
            else:
                lines.append('  无修正记录')
            lines.append('')
            
            if auth:
                lines.append('【授权期限页】')
                lines.append('  授权编号: ' + auth['authorization_number'])
                lines.append('  有效期: ' + auth['valid_from'] + ' 至 ' + auth['valid_to'])
                lines.append('')
            
            lines.append('【曲目核对表 - 历史版本追溯】')
            lines.append('-' * 60)
            for i, cl in enumerate(hist):
                is_latest = (i == len(hist) - 1)
                mark = ' ⭐ 当前版本' if is_latest else ''
                lines.append('')
                lines.append('  版本#' + str(cl['id']) + ' (data_source=' + cl['data_source'] + ')' + mark)
                lines.append('    使用请假课时数: ' + str(cl['leave_hours_count_used']) + '节')
                lines.append('    状态: ' + cl['status'])
                lines.append('    为什么被留下: ' + cl['reason_kept'])
                lines.append('    还缺什么材料: ' + cl['missing_materials'])
                lines.append('    材料来源依据: ' + cl['missing_materials_source'])
                lines.append('    下一步找谁: ' + cl['next_owner'] + ' → ' + cl['next_action'])
            lines.append('')
            
            lines.append('【返工记录时间线】')
            lines.append('-' * 60)
            for rec in recs:
                lines.append('')
                lines.append('  [' + str(rec['id']) + '] ' + rec['created_at'] + ' - ' + rec['action_type'] + ' (操作人: ' + rec['operator_name'] + ')')
                if rec.get('field_changed'):
                    lines.append('    字段变更: ' + rec['field_changed'] + ': ' + str(rec['old_value']) + ' → ' + str(rec['new_value']))
                lines.append('    原因: ' + rec['reason'])
                lines.append('    影响结果: ' + rec['affected_results'])
                lines.append('    原始材料依据: ' + rec['source_material'])
            lines.append('')
            
            lines.append('【追溯验证 - 请假课时口径一致性检查】')
            lines.append('-' * 60)
            all_used = [cl['leave_hours_count_used'] for cl in hist]
            current = note['leave_hours_count']
            same_as_current = all(u == current for u in all_used)
            lines.append('  当前值: ' + str(current) + '节')
            lines.append('  历史版本使用值: [' + ', '.join('%d节' % u for u in all_used) + ']')
            if same_as_current:
                lines.append('  ✅ 口径一致: 所有版本使用值 = 当前值 ' + str(current) + '节')
            else:
                lines.append('  ❌ 口径不一致: 存在历史版本使用值与当前值不同')
            
            if has_corr:
                lines.append('')
                lines.append('  修正追溯路径:')
                for rec in recs:
                    if rec['action_type'] == 'manual_correction' and rec.get('field_changed') == 'leave_hours_count':
                        lines.append('    rework_records#' + str(rec['id']) + ': ' + rec['old_value'] + ' → ' + rec['new_value'] + '节')
                        lines.append('      原因: ' + rec['reason'])
                        lines.append('      原始材料: ' + rec['source_material'])
            
            lines.append('')
            lines.append('【导出时间】' + datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
            lines.append('')
        
        return '\n'.join(lines)

import sqlite3
