import os
import json
import io
from datetime import datetime
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from openpyxl import Workbook

from models import get_conn, init_db, now_str, row_to_dict, rows_to_list, DB_PATH
from parser_service import (
    parse_meeting_minutes, detect_coordinate_offsets,
    extract_collisions, synthesize_judgement
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, 'static')

app = Flask(__name__, static_folder=STATIC_DIR, static_url_path='/static')
CORS(app)
app.config['JSON_AS_ASCII'] = False

if not os.path.exists(DB_PATH):
    init_db()
else:
    init_db()


@app.route('/')
def index():
    return send_from_directory(STATIC_DIR, 'index.html')


def _gen_case_no():
    prefix = 'ME-PRE'
    today = datetime.now().strftime('%Y%m%d')
    with get_conn() as conn:
        cur = conn.execute(
            "SELECT COUNT(*) AS c FROM preaudit_cases WHERE case_no LIKE ?",
            (f"{prefix}-{today}%",)
        )
        seq = cur.fetchone()['c'] + 1
    return f"{prefix}-{today}-{seq:03d}"


def _log_remark(conn, case_id, field_name, old_val, new_val, operator, note=None):
    if old_val == new_val:
        return
    conn.execute(
        '''INSERT INTO remark_history
           (case_id, field_name, old_value, new_value, operator, changed_at, change_note)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        (case_id, field_name, str(old_val) if old_val is not None else None,
         str(new_val) if new_val is not None else None, operator, now_str(), note)
    )


def _log_judgement(conn, case_id, old_judge, new_judge, reason, operator, rerun_batch=0):
    conn.execute(
        '''INSERT INTO judgement_log
           (case_id, old_judgement, new_judgement, reason, operator, created_at, rerun_batch)
           VALUES (?, ?, ?, ?, ?, ?, ?)''',
        (case_id, old_judge, new_judge, reason, operator, now_str(), rerun_batch)
    )


@app.route('/api/cases', methods=['GET'])
def list_cases():
    with get_conn() as conn:
        rows = conn.execute(
            'SELECT * FROM preaudit_cases ORDER BY updated_at DESC'
        ).fetchall()
        return jsonify({'ok': True, 'data': rows_to_list(rows)})


@app.route('/api/cases/<int:case_id>', methods=['GET'])
def get_case(case_id):
    with get_conn() as conn:
        case = conn.execute('SELECT * FROM preaudit_cases WHERE id=?', (case_id,)).fetchone()
        if not case:
            return jsonify({'ok': False, 'msg': '预审单不存在'}), 404
        materials = conn.execute(
            'SELECT * FROM materials WHERE case_id=? ORDER BY id', (case_id,)
        ).fetchall()
        coords = conn.execute(
            'SELECT * FROM coordinate_checks WHERE case_id=? ORDER BY id', (case_id,)
        ).fetchall()
        collisions = conn.execute(
            'SELECT * FROM collision_items WHERE case_id=? ORDER BY id', (case_id,)
        ).fetchall()
        remarks = conn.execute(
            'SELECT * FROM remark_history WHERE case_id=? ORDER BY changed_at DESC', (case_id,)
        ).fetchall()
        judgements = conn.execute(
            'SELECT * FROM judgement_log WHERE case_id=? ORDER BY created_at DESC', (case_id,)
        ).fetchall()
        return jsonify({
            'ok': True,
            'case': row_to_dict(case),
            'materials': rows_to_list(materials),
            'coordinates': rows_to_list(coords),
            'collisions': rows_to_list(collisions),
            'remark_history': rows_to_list(remarks),
            'judgement_history': rows_to_list(judgements),
        })


@app.route('/api/cases/analyze', methods=['POST'])
def analyze_case():
    """阿宁提交交接材料：会议纪要 + 后补备注 + 口头说明，一键解析"""
    data = request.get_json() or {}
    project_name = (data.get('project_name') or '').strip() or '未命名项目'
    meeting = data.get('meeting_minutes') or ''
    supplementary = data.get('supplementary_note') or ''
    oral = data.get('oral_instruction') or ''
    operator = data.get('operator') or '阿宁'

    parsed = parse_meeting_minutes(meeting, supplementary, oral)
    coord = detect_coordinate_offsets(meeting, supplementary, oral)
    collisions = extract_collisions(meeting, supplementary, oral)

    all_offset_confirmed = all(c['confirmed'] for c in coord['checks']) if coord['checks'] else True
    judgement, judge_note = synthesize_judgement(
        parsed['detected_mismatch_count'],
        coord['any_offset'],
        all_offset_confirmed,
        len(collisions)
    )

    is_suspended = 1 if judgement == 'suspended' else 0
    suspend_reason = judge_note if judgement == 'suspended' else None

    with get_conn() as conn:
        case_no = _gen_case_no()
        cur = conn.execute(
            '''INSERT INTO preaudit_cases
               (case_no, project_name, status, created_at, updated_at,
                meeting_minutes, supplementary_note, oral_instruction,
                current_judgement, current_judgement_note,
                is_suspended, suspend_reason)
               VALUES (?, ?, 'analyzed', ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (case_no, project_name, now_str(), now_str(),
             meeting, supplementary, oral,
             judgement, judge_note,
             is_suspended, suspend_reason)
        )
        case_id = cur.lastrowid

        for m in parsed['materials']:
            conn.execute(
                '''INSERT INTO materials
                   (case_id, material_name, review_spec, construction_spec,
                    spec_mismatch, version_tag, modified_after_submit,
                    submitted_at, modified_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (case_id, m['material_name'], m['review_spec'], m['construction_spec'],
                 m['spec_mismatch'], m['version_tag'], m['modified_after_submit'],
                 m['submitted_at'], m['modified_at'])
            )

        for c in coord['checks']:
            conn.execute(
                '''INSERT INTO coordinate_checks
                   (case_id, system_name, origin_x, origin_y, origin_z,
                    measured_x, measured_y, measured_z,
                    offset_detected, offset_value_x, offset_value_y, offset_value_z, confirmed)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (case_id, c['system_name'], c['origin_x'], c['origin_y'], c['origin_z'],
                 c.get('measured_x'), c.get('measured_y'), c.get('measured_z'),
                 c['offset_detected'], c['offset_value_x'], c['offset_value_y'],
                 c['offset_value_z'], c['confirmed'])
            )

        for ci in collisions:
            conn.execute(
                '''INSERT INTO collision_items
                   (case_id, system_a, system_b, collision_level, location, resolved, version_tag)
                   VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (case_id, ci['system_a'], ci['system_b'], ci['collision_level'],
                 ci['location'], ci['resolved'], ci['version_tag'])
            )

        _log_judgement(conn, case_id, None, judgement, judge_note, operator, 0)

    return jsonify({
        'ok': True,
        'case_id': case_id,
        'case_no': case_no,
        'parsed_note': parsed['note'],
        'coord_threshold': coord['threshold'],
    })


@app.route('/api/cases/<int:case_id>/remark', methods=['PATCH'])
def update_remark(case_id):
    """复核人前端修改备注后，后端同步并留痕，导出时自动同步"""
    data = request.get_json() or {}
    operator = data.get('operator') or '复核人'
    note = data.get('change_note') or '前端修改备注'

    allowed_fields = [
        'supplementary_note', 'oral_instruction',
        'current_judgement_note', 'meeting_minutes'
    ]

    with get_conn() as conn:
        case = conn.execute('SELECT * FROM preaudit_cases WHERE id=?', (case_id,)).fetchone()
        if not case:
            return jsonify({'ok': False, 'msg': '预审单不存在'}), 404

        changed = False
        for field in allowed_fields:
            if field in data:
                new_val = data[field]
                old_val = case[field]
                if str(old_val) != str(new_val):
                    conn.execute(
                        f'UPDATE preaudit_cases SET {field}=?, updated_at=? WHERE id=?',
                        (new_val, now_str(), case_id)
                    )
                    _log_remark(conn, case_id, field, old_val, new_val, operator, note)
                    changed = True

        if 'materials' in data and isinstance(data['materials'], list):
            for m_in in data['materials']:
                mid = m_in.get('id')
                if not mid:
                    continue
                old_m = conn.execute('SELECT * FROM materials WHERE id=? AND case_id=?',
                                     (mid, case_id)).fetchone()
                if not old_m:
                    continue
                new_review = m_in.get('review_spec', old_m['review_spec'])
                new_const = m_in.get('construction_spec', old_m['construction_spec'])
                new_mismatch = 1 if (new_review and new_const and new_review != new_const) else 0
                new_modified = (
                    old_m['modified_after_submit'] or
                    (old_m['review_spec'] != new_review and old_m['review_spec'] is not None) or
                    (old_m['construction_spec'] != new_const and old_m['construction_spec'] is not None)
                )
                conn.execute(
                    '''UPDATE materials SET review_spec=?, construction_spec=?,
                       spec_mismatch=?, modified_after_submit=?, modified_at=?, version_tag=?
                       WHERE id=?''',
                    (new_review, new_const, new_mismatch, 1 if new_modified else 0,
                     now_str(), old_m['version_tag'] + 1, mid)
                )
                _log_remark(conn, case_id, f"material[{old_m['material_name']}].spec",
                            f"送审:{old_m['review_spec']} 施工:{old_m['construction_spec']}",
                            f"送审:{new_review} 施工:{new_const}",
                            operator, note)
                changed = True

        if changed:
            conn.execute('UPDATE preaudit_cases SET updated_at=? WHERE id=?', (now_str(), case_id))

        updated = conn.execute('SELECT * FROM preaudit_cases WHERE id=?', (case_id,)).fetchone()
        materials = conn.execute(
            'SELECT * FROM materials WHERE case_id=? ORDER BY id', (case_id,)
        ).fetchall()

    return jsonify({'ok': True, 'case': row_to_dict(updated), 'materials': rows_to_list(materials)})


@app.route('/api/cases/<int:case_id>/judgement', methods=['POST'])
def change_judgement(case_id):
    """阿宁临时调整判断 / 复核人改判断 —— 旧判断、新判断、说明全留下"""
    data = request.get_json() or {}
    new_judge = (data.get('new_judgement') or '').strip()
    reason = (data.get('reason') or '').strip()
    operator = data.get('operator') or '阿宁'

    if new_judge not in ('pass', 'conditional', 'reject', 'suspended'):
        return jsonify({'ok': False, 'msg': '判断类型无效'}), 400
    if not reason:
        return jsonify({'ok': False, 'msg': '必须提供变更说明'}), 400

    with get_conn() as conn:
        case = conn.execute('SELECT * FROM preaudit_cases WHERE id=?', (case_id,)).fetchone()
        if not case:
            return jsonify({'ok': False, 'msg': '预审单不存在'}), 404
        old_judge = case['current_judgement']
        is_suspend = 1 if new_judge == 'suspended' else 0
        suspend_reason = reason if new_judge == 'suspended' else None

        conn.execute(
            '''UPDATE preaudit_cases SET
               current_judgement=?, current_judgement_note=?,
               is_suspended=?, suspend_reason=?, updated_at=?, status='judged'
               WHERE id=?''',
            (new_judge, reason, is_suspend, suspend_reason, now_str(), case_id)
        )
        _log_judgement(conn, case_id, old_judge, new_judge, reason, operator, case['rerun_count'])

    return jsonify({'ok': True})


@app.route('/api/cases/<int:case_id>/coordinate/confirm', methods=['POST'])
def confirm_coordinate(case_id):
    """复核人确认坐标偏移——解除挂起状态"""
    data = request.get_json() or {}
    operator = data.get('operator') or '复核人'
    check_ids = data.get('check_ids') or []
    with get_conn() as conn:
        if check_ids:
            conn.executemany(
                'UPDATE coordinate_checks SET confirmed=1 WHERE id=? AND case_id=?',
                [(cid, case_id) for cid in check_ids]
            )
        else:
            conn.execute(
                'UPDATE coordinate_checks SET confirmed=1 WHERE case_id=?', (case_id,)
            )
        case = conn.execute('SELECT * FROM preaudit_cases WHERE id=?', (case_id,)).fetchone()
        if not case:
            return jsonify({'ok': False, 'msg': '预审单不存在'}), 404

        materials = conn.execute(
            'SELECT COUNT(*) c, SUM(spec_mismatch) mm FROM materials WHERE case_id=?',
            (case_id,)
        ).fetchone()
        coords = conn.execute(
            'SELECT COUNT(*) c, SUM(offset_detected) o, SUM(confirmed) cf '
            'FROM coordinate_checks WHERE case_id=?', (case_id,)
        ).fetchone()
        collisions = conn.execute(
            'SELECT COUNT(*) c FROM collision_items WHERE case_id=?', (case_id,)
        ).fetchone()

        mismatch_count = materials['mm'] or 0
        collision_count = collisions['c'] or 0
        any_offset = (coords['o'] or 0) > 0
        all_confirmed = coords['c'] == 0 or (coords['cf'] or 0) >= (coords['c'] or 0)

        new_judge, note = synthesize_judgement(
            mismatch_count, any_offset, all_confirmed, collision_count
        )
        old_judge = case['current_judgement']
        is_suspend = 1 if new_judge == 'suspended' else 0
        suspend_reason = note if new_judge == 'suspended' else None

        conn.execute(
            '''UPDATE preaudit_cases SET
               current_judgement=?, current_judgement_note=?,
               is_suspended=?, suspend_reason=?, updated_at=?
               WHERE id=?''',
            (new_judge, note, is_suspend, suspend_reason, now_str(), case_id)
        )
        if old_judge != new_judge:
            _log_judgement(conn, case_id, old_judge, new_judge,
                           '复核人确认坐标偏移后重新判定', operator, case['rerun_count'])

    return jsonify({'ok': True})


@app.route('/api/cases/<int:case_id>/rerun', methods=['POST'])
def rerun_case(case_id):
    """补录后重跑：保留历史，增加批次号，不覆盖旧数据历史"""
    data = request.get_json() or {}
    operator = data.get('operator') or '阿宁'
    meeting = data.get('meeting_minutes')
    supplementary = data.get('supplementary_note')
    oral = data.get('oral_instruction')

    with get_conn() as conn:
        case = conn.execute('SELECT * FROM preaudit_cases WHERE id=?', (case_id,)).fetchone()
        if not case:
            return jsonify({'ok': False, 'msg': '预审单不存在'}), 404

        new_meeting = meeting if meeting is not None else case['meeting_minutes']
        new_supp = supplementary if supplementary is not None else case['supplementary_note']
        new_oral = oral if oral is not None else case['oral_instruction']

        # 留痕：修改了哪些交接材料
        if new_meeting != case['meeting_minutes']:
            _log_remark(conn, case_id, 'meeting_minutes', case['meeting_minutes'],
                        new_meeting, operator, '补录重跑-会议纪要更新')
        if new_supp != case['supplementary_note']:
            _log_remark(conn, case_id, 'supplementary_note', case['supplementary_note'],
                        new_supp, operator, '补录重跑-后补备注更新')
        if new_oral != case['oral_instruction']:
            _log_remark(conn, case_id, 'oral_instruction', case['oral_instruction'],
                        new_oral, operator, '补录重跑-口头说明更新')

        # 版本+1重新解析
        old_materials = conn.execute(
            'SELECT * FROM materials WHERE case_id=?', (case_id,)
        ).fetchall()
        old_mats_map = {m['material_name']: row_to_dict(m) for m in old_materials}

        parsed = parse_meeting_minutes(new_meeting, new_supp, new_oral)
        coord = detect_coordinate_offsets(new_meeting, new_supp, new_oral)
        collisions = extract_collisions(new_meeting, new_supp, new_oral)

        # 更新材料，版本递增
        for m in parsed['materials']:
            name = m['material_name']
            old = old_mats_map.pop(name, None)
            if old:
                new_tag = old['version_tag'] + 1
                was_modified = old['modified_after_submit'] or (
                    (old['review_spec'] != m['review_spec'] and m['review_spec'] is not None) or
                    (old['construction_spec'] != m['construction_spec'] and m['construction_spec'] is not None)
                )
                conn.execute(
                    '''UPDATE materials SET review_spec=?, construction_spec=?,
                       spec_mismatch=?, version_tag=?, modified_after_submit=?, modified_at=?
                       WHERE id=?''',
                    (m['review_spec'], m['construction_spec'], m['spec_mismatch'],
                     new_tag, 1 if was_modified else 0, now_str(), old['id'])
                )
                _log_remark(conn, case_id, f"material[{name}].rerun",
                            f"v{old['version_tag']}:送审:{old['review_spec']} 施工:{old['construction_spec']}",
                            f"v{new_tag}:送审:{m['review_spec']} 施工:{m['construction_spec']}",
                            operator, f"补录重跑第{case['rerun_count'] + 1}次")
            else:
                cur = conn.execute(
                    '''INSERT INTO materials
                       (case_id, material_name, review_spec, construction_spec,
                        spec_mismatch, version_tag, modified_after_submit,
                        submitted_at, modified_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                    (case_id, m['material_name'], m['review_spec'], m['construction_spec'],
                     m['spec_mismatch'], 1, m['modified_after_submit'],
                     now_str(), m['modified_at'])
                )
                _log_remark(conn, case_id, f"material[{name}].new",
                            None, f"新增材料:送审:{m['review_spec']} 施工:{m['construction_spec']}",
                            operator, f"补录重跑第{case['rerun_count'] + 1}次新增")

        # 坐标校验：更新或新增
        old_coords = conn.execute('SELECT * FROM coordinate_checks WHERE case_id=?', (case_id,)).fetchall()
        old_coord_map = {c['system_name']: row_to_dict(c) for c in old_coords}
        for c in coord['checks']:
            sn = c['system_name']
            old = old_coord_map.pop(sn, None)
            if old:
                conn.execute(
                    '''UPDATE coordinate_checks SET origin_x=?, origin_y=?, origin_z=?,
                       measured_x=?, measured_y=?, measured_z=?,
                       offset_detected=?, offset_value_x=?, offset_value_y=?, offset_value_z=?,
                       confirmed=? WHERE id=?''',
                    (c['origin_x'], c['origin_y'], c['origin_z'],
                     c.get('measured_x'), c.get('measured_y'), c.get('measured_z'),
                     c['offset_detected'], c['offset_value_x'], c['offset_value_y'],
                     c['offset_value_z'], c['confirmed'], old['id'])
                )
            else:
                conn.execute(
                    '''INSERT INTO coordinate_checks
                       (case_id, system_name, origin_x, origin_y, origin_z,
                        measured_x, measured_y, measured_z,
                        offset_detected, offset_value_x, offset_value_y, offset_value_z, confirmed)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                    (case_id, c['system_name'], c['origin_x'], c['origin_y'], c['origin_z'],
                     c.get('measured_x'), c.get('measured_y'), c.get('measured_z'),
                     c['offset_detected'], c['offset_value_x'], c['offset_value_y'],
                     c['offset_value_z'], c['confirmed'])
                )

        # 碰撞点：版本+1新增（保留旧版本便于追溯口径变化）
        conn.execute(
            'UPDATE collision_items SET version_tag=version_tag+100 WHERE case_id=?',
            (case_id,)
        )
        for ci in collisions:
            conn.execute(
                '''INSERT INTO collision_items
                   (case_id, system_a, system_b, collision_level, location, resolved, version_tag)
                   VALUES (?, ?, ?, ?, ?, ?, 1)''',
                (case_id, ci['system_a'], ci['system_b'], ci['collision_level'],
                 ci['location'], ci['resolved'])
            )

        # 重跑后重新判定
        mismatch_count = sum(1 for m in parsed['materials'] if m['spec_mismatch'])
        collision_count = len(collisions)
        any_offset = coord['any_offset']
        all_confirmed = True
        coords_now = conn.execute(
            'SELECT offset_detected, confirmed FROM coordinate_checks WHERE case_id=?',
            (case_id,)
        ).fetchall()
        if coords_now:
            all_confirmed = all(c['confirmed'] for c in coords_now if c['offset_detected'])

        new_judge, judge_note = synthesize_judgement(
            mismatch_count, any_offset, all_confirmed, collision_count
        )
        old_judge = case['current_judgement']
        is_suspend = 1 if new_judge == 'suspended' else 0
        suspend_reason = judge_note if new_judge == 'suspended' else None

        last_manual_j = conn.execute('''
            SELECT * FROM judgement_log WHERE case_id=?
            AND operator IS NOT NULL AND operator != 'system'
            ORDER BY created_at DESC LIMIT 1
        ''', (case_id,)).fetchone()

        if new_judge == 'suspended':
            final_note = judge_note
        elif last_manual_j and not last_manual_j['reason'].startswith('复核人确认坐标偏移后重新判定'):
            final_note = case['current_judgement_note']
        else:
            final_note = judge_note

        new_rerun = case['rerun_count'] + 1
        conn.execute(
            '''UPDATE preaudit_cases SET
               meeting_minutes=?, supplementary_note=?, oral_instruction=?,
               current_judgement=?, current_judgement_note=?,
               is_suspended=?, suspend_reason=?,
               rerun_count=?, status='rerun', updated_at=?
               WHERE id=?''',
            (new_meeting, new_supp, new_oral,
             new_judge, final_note, is_suspend, suspend_reason,
             new_rerun, now_str(), case_id)
        )
        if old_judge != new_judge:
            _log_judgement(conn, case_id, old_judge, new_judge,
                           f'补录后重跑（第{new_rerun}次）', operator, new_rerun)

    return jsonify({'ok': True, 'rerun_batch': new_rerun if 'new_rerun' in dir() else 1})


@app.route('/api/cases/<int:case_id>/export', methods=['GET'])
def export_case(case_id):
    """导出预审结果（Excel）—— 读取最新备注/口径，保证与前端同步"""
    with get_conn() as conn:
        case = conn.execute('SELECT * FROM preaudit_cases WHERE id=?', (case_id,)).fetchone()
        if not case:
            return jsonify({'ok': False, 'msg': '预审单不存在'}), 404
        materials = conn.execute(
            'SELECT * FROM materials WHERE case_id=? ORDER BY spec_mismatch DESC, id', (case_id,)
        ).fetchall()
        coords = conn.execute(
            'SELECT * FROM coordinate_checks WHERE case_id=? ORDER BY offset_detected DESC, id', (case_id,)
        ).fetchall()
        collisions = conn.execute(
            'SELECT * FROM collision_items WHERE case_id=? AND version_tag <= 100 ORDER BY id', (case_id,)
        ).fetchall()
        judgements = conn.execute(
            'SELECT * FROM judgement_log WHERE case_id=? ORDER BY created_at', (case_id,)
        ).fetchall()
        remarks = conn.execute(
            'SELECT * FROM remark_history WHERE case_id=? ORDER BY changed_at', (case_id,)
        ).fetchall()

    wb = Workbook()

    ws = wb.active
    ws.title = '预审结论'
    ws.append(['机电管综碰撞预审报告'])
    ws.append(['预审单号', case['case_no'], '项目名称', case['project_name']])
    ws.append(['创建时间', case['created_at'], '更新时间', case['updated_at']])
    ws.append(['重跑次数', case['rerun_count'], '当前状态', case['status']])
    judge_map = {'pass': '通过', 'conditional': '附条件通过', 'reject': '不通过', 'suspended': '挂起待确认'}
    ws.append(['当前判定', judge_map.get(case['current_judgement'], case['current_judgement'])])
    ws.append(['判定说明', case['current_judgement_note'] or ''])
    if case['is_suspended']:
        ws.append(['挂起原因', case['suspend_reason'] or ''])
    ws.append([])
    ws.append(['—— 交接材料（与前端同步）——'])
    ws.append(['会议纪要', case['meeting_minutes'] or ''])
    ws.append(['后补备注', case['supplementary_note'] or ''])
    ws.append(['临时口头说明', case['oral_instruction'] or ''])

    ws2 = wb.create_sheet('材料口径对比')
    ws2.append(['材料名称', '送审口径', '施工口径', '是否不一致', '补录后改过口径', '版本号', '提交时间', '修改时间'])
    for m in materials:
        ws2.append([
            m['material_name'], m['review_spec'] or '', m['construction_spec'] or '',
            '是' if m['spec_mismatch'] else '否',
            '是' if m['modified_after_submit'] else '否',
            m['version_tag'], m['submitted_at'] or '', m['modified_at'] or ''
        ])

    ws3 = wb.create_sheet('坐标校验')
    ws3.append(['系统名称', '原点X', '原点Y', '原点Z', '偏移X', '偏移Y', '偏移Z', '是否偏移', '复核人确认'])
    for c in coords:
        ws3.append([
            c['system_name'], c['origin_x'], c['origin_y'], c['origin_z'],
            c['offset_value_x'], c['offset_value_y'], c['offset_value_z'],
            '是' if c['offset_detected'] else '否',
            '已确认' if c['confirmed'] else '未确认'
        ])

    ws4 = wb.create_sheet('碰撞清单')
    ws4.append(['系统A', '系统B', '碰撞级别', '位置', '是否解决', '版本号'])
    for ci in collisions:
        ws4.append([ci['system_a'], ci['system_b'], ci['collision_level'],
                    ci['location'] or '', '已解决' if ci['resolved'] else '未解决', ci['version_tag']])

    ws5 = wb.create_sheet('判断历史')
    ws5.append(['时间', '批次', '旧判断', '新判断', '变更说明', '操作人'])
    for j in judgements:
        ws5.append([
            j['created_at'], j['rerun_batch'],
            judge_map.get(j['old_judgement'], j['old_judgement'] or '-'),
            judge_map.get(j['new_judgement'], j['new_judgement']),
            j['reason'], j['operator']
        ])

    ws6 = wb.create_sheet('变更留痕')
    ws6.append(['时间', '字段', '旧值', '新值', '变更说明', '操作人'])
    for r in remarks:
        ws6.append([
            r['changed_at'], r['field_name'],
            (r['old_value'] or '')[:200],
            (r['new_value'] or '')[:200],
            r['change_note'] or '', r['operator']
        ])

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"{case['case_no']}_预审报告.xlsx"
    return send_file(
        buf,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=filename
    )


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({'ok': True, 'ts': now_str()})


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5173))
    app.run(host='0.0.0.0', port=port, debug=False)
