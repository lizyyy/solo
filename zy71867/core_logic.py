import json
import os
from datetime import datetime
from database import get_db, generate_id, calculate_hash, file_hash

UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

EXPORT_FOLDER = os.path.join(os.path.dirname(__file__), 'exports')
os.makedirs(EXPORT_FOLDER, exist_ok=True)

DIFFICULTY_TAGS = ['基础', '中等', '较难', '难题', '竞赛级']

def log_audit(conn, action, lecture_id=None, record_type=None, record_id=None,
              old_value=None, new_value=None, operator='system', note=None):
    audit_id = generate_id('AUD')
    c = conn.cursor()
    c.execute('''INSERT INTO audit_logs 
                 (id, action, lecture_id, record_type, record_id, old_value, new_value, 
                  operator, operated_at, note)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
              (audit_id, action, lecture_id, record_type, record_id,
               json.dumps(old_value, ensure_ascii=False) if old_value else None,
               json.dumps(new_value, ensure_ascii=False) if new_value else None,
               operator, datetime.now().isoformat(), note))
    return audit_id

def check_duplicate(conn, screenshot_hash=None, content_hash=None, title=None):
    c = conn.cursor()
    duplicates = []
    
    if screenshot_hash:
        c.execute('''SELECT id, title, screenshot_path FROM lectures 
                     WHERE screenshot_hash = ? AND status = 'active' ''',
                  (screenshot_hash,))
        for row in c.fetchall():
            duplicates.append({
                'type': 'screenshot',
                'key': screenshot_hash,
                'lecture_id': row['id'],
                'title': row['title'],
                'message': f'讲义截图重复：已存在标题为「{row["title"]}」的相同截图'
            })
    
    if content_hash:
        c.execute('''SELECT cr.id, cr.content, l.title 
                     FROM commentary_records cr
                     JOIN lectures l ON cr.lecture_id = l.id
                     WHERE cr.content_hash = ?''',
                  (content_hash,))
        for row in c.fetchall():
            duplicates.append({
                'type': 'commentary',
                'key': content_hash,
                'lecture_id': row['id'],
                'title': row['title'],
                'record_id': row['id'],
                'message': f'讲评内容重复：在「{row["title"]}」中已存在相同讲评记录'
            })
    
    if title:
        c.execute('''SELECT id, title FROM lectures 
                     WHERE title = ? AND status = 'active' ''',
                  (title,))
        for row in c.fetchall():
            duplicates.append({
                'type': 'title',
                'key': title,
                'lecture_id': row['id'],
                'title': row['title'],
                'message': f'讲义标题重复：已存在标题为「{title}」的讲义'
            })
    
    return duplicates

def record_duplicate(conn, lecture_id, dup_type, dup_key):
    dup_id = generate_id('DUP')
    c = conn.cursor()
    c.execute('''INSERT INTO duplicate_records 
                 (id, lecture_id, duplicate_type, duplicate_key, detected_at)
                 VALUES (?, ?, ?, ?, ?)''',
              (dup_id, lecture_id, dup_type, dup_key, datetime.now().isoformat()))
    return dup_id

def import_lecture(title, screenshot_file=None, difficulty_tag=None, 
                   commentary_content=None, teacher=None, operator='user'):
    conn = get_db()
    lecture_id = generate_id('LEC')
    now = datetime.now().isoformat()
    
    screenshot_path = None
    screenshot_hash = None
    if screenshot_file:
        filename = f"{lecture_id}_{screenshot_file.filename}"
        screenshot_path = os.path.join(UPLOAD_FOLDER, filename)
        screenshot_file.save(screenshot_path)
        screenshot_hash = file_hash(screenshot_path)
    
    if difficulty_tag and difficulty_tag not in DIFFICULTY_TAGS:
        difficulty_tag = None
    
    duplicates = check_duplicate(
        conn,
        screenshot_hash=screenshot_hash,
        title=title
    )
    
    has_duplicate = len(duplicates) > 0
    
    c = conn.cursor()
    c.execute('''INSERT INTO lectures 
                 (id, title, screenshot_path, screenshot_hash, difficulty_tag, 
                  created_at, updated_at, status, version)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
              (lecture_id, title, screenshot_path, screenshot_hash, difficulty_tag,
               now, now, 'active', 1))
    
    log_audit(conn, 'IMPORT_LECTURE', lecture_id=lecture_id,
              new_value={'title': title, 'difficulty_tag': difficulty_tag,
                        'has_duplicate': has_duplicate},
              operator=operator,
              note='导入讲义' + ('（检测到重复）' if has_duplicate else ''))
    
    for dup in duplicates:
        record_duplicate(conn, lecture_id, dup['type'], dup['key'])
    
    commentary_id = None
    if commentary_content:
        commentary_id = generate_id('COM')
        content_hash = calculate_hash(commentary_content)
        
        comment_duplicates = check_duplicate(conn, content_hash=content_hash)
        for cd in comment_duplicates:
            record_duplicate(conn, lecture_id, cd['type'], cd['key'])
        
        c.execute('''INSERT INTO commentary_records 
                     (id, lecture_id, content, teacher, recorded_at, created_at, content_hash)
                     VALUES (?, ?, ?, ?, ?, ?, ?)''',
                  (commentary_id, lecture_id, commentary_content, teacher,
                   now, now, content_hash))
        
        log_audit(conn, 'ADD_COMMENTARY', lecture_id=lecture_id,
                  record_type='commentary', record_id=commentary_id,
                  new_value={'content': commentary_content, 'teacher': teacher},
                  operator=operator, note='添加讲评记录')
    
    conn.commit()
    conn.close()
    
    return {
        'lecture_id': lecture_id,
        'commentary_id': commentary_id,
        'duplicates': duplicates,
        'has_duplicate': has_duplicate,
        'missing_difficulty': difficulty_tag is None
    }

def add_commentary(lecture_id, content, teacher=None, operator='user'):
    conn = get_db()
    now = datetime.now().isoformat()
    commentary_id = generate_id('COM')
    content_hash = calculate_hash(content)
    
    duplicates = check_duplicate(conn, content_hash=content_hash)
    
    c = conn.cursor()
    c.execute('''INSERT INTO commentary_records 
                 (id, lecture_id, content, teacher, recorded_at, created_at, content_hash)
                 VALUES (?, ?, ?, ?, ?, ?, ?)''',
              (commentary_id, lecture_id, content, teacher, now, now, content_hash))
    
    for dup in duplicates:
        record_duplicate(conn, lecture_id, dup['type'], dup['key'])
    
    log_audit(conn, 'ADD_COMMENTARY', lecture_id=lecture_id,
              record_type='commentary', record_id=commentary_id,
              new_value={'content': content, 'teacher': teacher},
              operator=operator,
              note='添加讲评记录' + ('（检测到内容重复）' if duplicates else ''))
    
    c.execute('''UPDATE lectures SET updated_at = ?, version = version + 1 
                 WHERE id = ?''', (now, lecture_id))
    
    conn.commit()
    conn.close()
    
    return {
        'commentary_id': commentary_id,
        'duplicates': duplicates
    }

def update_difficulty(lecture_id, difficulty_tag, operator='user', confirmed=False):
    conn = get_db()
    now = datetime.now().isoformat()
    
    if difficulty_tag not in DIFFICULTY_TAGS:
        conn.close()
        return {'success': False, 'message': f'难度标签必须是：{DIFFICULTY_TAGS}'}
    
    c = conn.cursor()
    c.execute('SELECT difficulty_tag, difficulty_confirmed FROM lectures WHERE id = ?',
              (lecture_id,))
    old = c.fetchone()
    
    c.execute('''UPDATE lectures 
                 SET difficulty_tag = ?, difficulty_confirmed = ?, 
                     updated_at = ?, version = version + 1
                 WHERE id = ?''',
              (difficulty_tag, 1 if confirmed else 0, now, lecture_id))
    
    log_audit(conn, 'UPDATE_DIFFICULTY', lecture_id=lecture_id,
              old_value={'difficulty_tag': old['difficulty_tag'], 
                        'confirmed': old['difficulty_confirmed']},
              new_value={'difficulty_tag': difficulty_tag, 'confirmed': confirmed},
              operator=operator,
              note='更新难度标签' + ('（人工确认）' if confirmed else ''))
    
    conn.commit()
    conn.close()
    
    return {'success': True}

def withdraw_lecture(lecture_id, reason, operator='user'):
    conn = get_db()
    now = datetime.now().isoformat()
    
    c = conn.cursor()
    c.execute('SELECT status, version FROM lectures WHERE id = ?', (lecture_id,))
    old = c.fetchone()
    
    c.execute('''UPDATE lectures 
                 SET status = 'withdrawn', updated_at = ?, version = version + 1
                 WHERE id = ?''', (now, lecture_id))
    
    log_audit(conn, 'WITHDRAW_LECTURE', lecture_id=lecture_id,
              old_value={'status': old['status'], 'version': old['version']},
              new_value={'status': 'withdrawn', 'version': old['version'] + 1},
              operator=operator, note=f'撤回调讲：{reason}')
    
    conn.commit()
    conn.close()
    
    return {'success': True}

def revise_lecture(lecture_id, new_title=None, new_difficulty=None, 
                   operator='user', reason=''):
    conn = get_db()
    now = datetime.now().isoformat()
    
    c = conn.cursor()
    c.execute('SELECT * FROM lectures WHERE id = ?', (lecture_id,))
    old = dict(c.fetchone())
    
    updates = {}
    if new_title:
        updates['title'] = new_title
    if new_difficulty:
        updates['difficulty_tag'] = new_difficulty
        updates['difficulty_confirmed'] = 1
    
    if not updates:
        conn.close()
        return {'success': False, 'message': '没有提供更新内容'}
    
    set_clause = ', '.join([f"{k} = ?" for k in updates.keys()])
    set_clause += ", updated_at = ?, version = version + 1"
    values = list(updates.values()) + [now, lecture_id]
    
    c.execute(f'UPDATE lectures SET {set_clause} WHERE id = ?', values)
    
    log_audit(conn, 'REVISE_LECTURE', lecture_id=lecture_id,
              old_value={k: old[k] for k in updates.keys()},
              new_value=updates,
              operator=operator,
              note=f'修正讲义：{reason}')
    
    conn.commit()
    conn.close()
    
    return {'success': True}

def get_filter_criteria():
    return {
        'difficulty_tags': DIFFICULTY_TAGS,
        'status_options': ['active', 'withdrawn', 'all'],
        'has_check_result': ['all', 'passed', 'failed', 'pending'],
        'has_duplicate': ['all', 'yes', 'no'],
        'missing_difficulty': ['all', 'yes', 'no']
    }

def query_lectures(filters=None, operator='user'):
    conn = get_db()
    c = conn.cursor()
    
    base_query = '''
        SELECT DISTINCT l.*,
               (SELECT COUNT(*) FROM commentary_records cr WHERE cr.lecture_id = l.id) as commentary_count,
               (SELECT COUNT(*) FROM tangent_checks tc WHERE tc.lecture_id = l.id) as check_count,
               (SELECT result FROM tangent_checks tc WHERE tc.lecture_id = l.id 
                ORDER BY tc.checked_at DESC LIMIT 1) as latest_check_result,
               (SELECT COUNT(*) FROM duplicate_records dr WHERE dr.lecture_id = l.id 
                AND dr.resolved = 0) as unresolved_duplicate_count
        FROM lectures l
        LEFT JOIN duplicate_records dr ON l.id = dr.lecture_id
        WHERE 1=1
    '''
    
    params = []
    
    if filters:
        if filters.get('difficulty_tag') and filters['difficulty_tag'] != 'all':
            if filters['difficulty_tag'] == 'missing':
                base_query += ' AND l.difficulty_tag IS NULL'
            else:
                base_query += ' AND l.difficulty_tag = ?'
                params.append(filters['difficulty_tag'])
        
        if filters.get('status') and filters['status'] != 'all':
            base_query += ' AND l.status = ?'
            params.append(filters['status'])
        
        if filters.get('has_check_result') and filters['has_check_result'] != 'all':
            if filters['has_check_result'] == 'pending':
                base_query += ' AND (SELECT COUNT(*) FROM tangent_checks tc WHERE tc.lecture_id = l.id) = 0'
            else:
                base_query += ''' AND (SELECT result FROM tangent_checks tc WHERE tc.lecture_id = l.id 
                                   ORDER BY tc.checked_at DESC LIMIT 1) = ?'''
                params.append(filters['has_check_result'])
        
        if filters.get('has_duplicate') and filters['has_duplicate'] != 'all':
            if filters['has_duplicate'] == 'yes':
                base_query += ' AND (SELECT COUNT(*) FROM duplicate_records dr WHERE dr.lecture_id = l.id) > 0'
            else:
                base_query += ' AND (SELECT COUNT(*) FROM duplicate_records dr WHERE dr.lecture_id = l.id) = 0'
        
        if filters.get('missing_difficulty') and filters['missing_difficulty'] != 'all':
            if filters['missing_difficulty'] == 'yes':
                base_query += ' AND l.difficulty_tag IS NULL'
            else:
                base_query += ' AND l.difficulty_tag IS NOT NULL'
    
    base_query += ' ORDER BY l.created_at DESC'
    
    c.execute(base_query, params)
    lectures = [dict(row) for row in c.fetchall()]
    
    log_audit(conn, 'QUERY_LECTURES',
              new_value={'filters': filters, 'result_count': len(lectures)},
              operator=operator, note='筛选查询讲义')
    
    conn.close()
    return lectures

def get_lecture_timeline(lecture_id):
    conn = get_db()
    c = conn.cursor()
    
    c.execute('SELECT * FROM lectures WHERE id = ?', (lecture_id,))
    lecture = dict(c.fetchone())
    
    c.execute('SELECT * FROM commentary_records WHERE lecture_id = ? ORDER BY created_at',
              (lecture_id,))
    commentaries = [dict(row) for row in c.fetchall()]
    
    c.execute('SELECT * FROM tangent_checks WHERE lecture_id = ? ORDER BY checked_at',
              (lecture_id,))
    checks = [dict(row) for row in c.fetchall()]
    
    c.execute('SELECT * FROM audit_logs WHERE lecture_id = ? ORDER BY operated_at',
              (lecture_id,))
    audits = [dict(row) for row in c.fetchall()]
    
    c.execute('SELECT * FROM duplicate_records WHERE lecture_id = ?',
              (lecture_id,))
    duplicates = [dict(row) for row in c.fetchall()]
    
    timeline = []
    
    timeline.append({
        'type': 'lecture',
        'time': lecture['created_at'],
        'title': '讲义创建',
        'data': lecture,
        'icon': '📄'
    })
    
    for com in commentaries:
        timeline.append({
            'type': 'commentary',
            'time': com['created_at'],
            'title': '讲评记录',
            'data': com,
            'icon': '💬'
        })
    
    for check in checks:
        timeline.append({
            'type': 'check',
            'time': check['checked_at'],
            'title': '切线检查',
            'data': check,
            'icon': '✅' if check['result'] == 'passed' else '❌'
        })
    
    for audit in audits:
        timeline.append({
            'type': 'audit',
            'time': audit['operated_at'],
            'title': f"操作记录：{audit['action']}",
            'data': audit,
            'icon': '📝'
        })
    
    for dup in duplicates:
        timeline.append({
            'type': 'duplicate',
            'time': dup['detected_at'],
            'title': f"重复检测：{dup['duplicate_type']}",
            'data': dup,
            'icon': '⚠️'
        })
    
    timeline.sort(key=lambda x: x['time'])
    
    conn.close()
    return {
        'lecture': lecture,
        'timeline': timeline,
        'commentaries': commentaries,
        'checks': checks,
        'audits': audits,
        'duplicates': duplicates
    }

def export_data(filters=None, format='excel', operator='user'):
    import pandas as pd
    
    lectures = query_lectures(filters, operator=operator)
    
    conn = get_db()
    c = conn.cursor()
    
    export_rows = []
    for lect in lectures:
        c.execute('SELECT * FROM commentary_records WHERE lecture_id = ? ORDER BY created_at',
                  (lect['id'],))
        commentaries = [dict(row) for row in c.fetchall()]
        
        c.execute('SELECT * FROM tangent_checks WHERE lecture_id = ? ORDER BY checked_at DESC LIMIT 1',
                  (lect['id'],))
        check = dict(c.fetchone()) if c.fetchone() else None
        
        c.execute('SELECT * FROM duplicate_records WHERE lecture_id = ? AND resolved = 0',
                  (lect['id'],))
        duplicates = [dict(row) for row in c.fetchall()]
        
        com_texts = '; '.join([f"[{com['teacher']}] {com['content'][:50]}" for com in commentaries])
        
        export_rows.append({
            '讲义ID': lect['id'],
            '标题': lect['title'],
            '难度标签': lect['difficulty_tag'] or '（未设置）',
            '难度已确认': '是' if lect['difficulty_confirmed'] else '否',
            '状态': '正常' if lect['status'] == 'active' else '已撤回',
            '版本': lect['version'],
            '讲评记录数': len(commentaries),
            '讲评摘要': com_texts,
            '切线检查结果': check['result'] if check else '未检查',
            '检查置信度': f"{check['confidence']:.0%}" if check else '',
            '检查理由': check['reasoning'] if check else '',
            '下一步建议': check['next_step'] if check else '',
            '未解决重复数': len(duplicates),
            '创建时间': lect['created_at'],
            '更新时间': lect['updated_at']
        })
    
    conn.close()
    
    df = pd.DataFrame(export_rows)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    
    if format == 'excel':
        filename = f'讲义导出_{timestamp}.xlsx'
        filepath = os.path.join(EXPORT_FOLDER, filename)
        df.to_excel(filepath, index=False, engine='openpyxl')
    else:
        filename = f'讲义导出_{timestamp}.csv'
        filepath = os.path.join(EXPORT_FOLDER, filename)
        df.to_csv(filepath, index=False)
    
    conn = get_db()
    log_audit(conn, 'EXPORT_DATA',
              new_value={'filters': filters, 'format': format, 
                        'record_count': len(export_rows), 'filename': filename},
              operator=operator, note='导出数据')
    conn.commit()
    conn.close()
    
    return {
        'filepath': filepath,
        'filename': filename,
        'record_count': len(export_rows)
    }
