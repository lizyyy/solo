import click
from app.database import init_db
from app import services
from config import STATUS_LABELS, NEXT_OWNER, ROLES

@click.group()
def cli():
    pass

@cli.command()
def init():
    init_db()
    click.echo('数据库初始化完成')

@cli.command()
@click.option('--username', required=True)
@click.option('--name', required=True)
@click.option('--role', type=click.Choice(['tour_coordinator', 'music_teacher', 'admin']), required=True)
def add_user(username, name, role):
    user_id = services.create_user(username, name, role)
    click.echo(f'用户创建成功，ID: {user_id}')

@cli.command()
@click.option('--track-name', required=True, help='曲目名称')
@click.option('--file-path', default='', help='音频文件路径')
@click.option('--duration', type=float, default=0, help='时长（分钟）')
@click.option('--has-leave-hours', is_flag=True, help='是否有请假课时被算入已消耗')
@click.option('--leave-hours-count', type=int, default=0, help='请假课时数量')
@click.option('--original-note', default='', help='原始备注')
@click.option('--imported-by', type=int, required=True, help='导入人用户ID')
@click.option('--source-material', default=None, help='原始材料来源说明')
def import_note(track_name, file_path, duration, has_leave_hours, leave_hours_count, original_note, imported_by, source_material):
    note_id = services.import_audio_note(
        track_name, file_path, duration, has_leave_hours, leave_hours_count, original_note, imported_by, source_material
    )
    click.echo(f'音频备注导入成功，ID: {note_id}')
    checklist = services.get_checklist(note_id)
    click.echo(f'  状态: {STATUS_LABELS.get(checklist["status"], checklist["status"])}')
    click.echo(f'  为什么被留下: {checklist["reason_kept"]}')
    click.echo(f'  还缺什么材料: {checklist["missing_materials"]}')
    if checklist.get('missing_materials_source'):
        click.echo(f'  材料来源依据: {checklist["missing_materials_source"]}')
    click.echo(f'  使用请假课时数: {checklist.get("leave_hours_count_used", "N/A")}节')
    click.echo(f'  下一步: {NEXT_OWNER.get(checklist["next_owner"], checklist["next_owner"])} - {checklist["next_action"]}')

@cli.command()
@click.option('--audio-note-id', type=int, required=True)
@click.option('--auth-number', required=True, help='授权编号')
@click.option('--valid-from', required=True, help='有效期开始 YYYY-MM-DD')
@click.option('--valid-to', required=True, help='有效期结束 YYYY-MM-DD')
@click.option('--page-content', default='', help='授权页内容')
@click.option('--uploaded-by', type=int, required=True, help='上传人用户ID')
@click.option('--source-material', default=None, help='授权文件来源说明')
def add_auth(audio_note_id, auth_number, valid_from, valid_to, page_content, uploaded_by, source_material):
    services.add_authorization_page(audio_note_id, auth_number, valid_from, valid_to, page_content, uploaded_by, source_material)
    click.echo('授权期限页已添加')
    checklist = services.get_checklist(audio_note_id)
    audio_note = services.get_audio_note(audio_note_id)
    click.echo(f'  更新后状态: {STATUS_LABELS.get(checklist["status"], checklist["status"])}')
    click.echo(f'  为什么被留下: {checklist["reason_kept"]}')
    click.echo(f'  还缺什么材料: {checklist["missing_materials"]}')
    if checklist.get('missing_materials_source'):
        click.echo(f'  材料来源依据: {checklist["missing_materials_source"]}')
    click.echo(f'  当前请假课时: {audio_note["leave_hours_count"]}节（原始: {audio_note.get("original_leave_hours_count", "N/A")}节）')
    if audio_note.get('leave_hours_correction_note'):
        click.echo(f'  修正说明: {audio_note["leave_hours_correction_note"]}')
    click.echo(f'  下一步: {NEXT_OWNER.get(checklist["next_owner"], checklist["next_owner"])}')

@cli.command()
@click.option('--audio-note-id', type=int, required=True)
@click.option('--field', required=True, type=click.Choice(['status', 'next_owner', 'reason_kept', 'missing_materials', 'missing_materials_source', 'leave_hours_count']))
@click.option('--old-value', required=True)
@click.option('--new-value', required=True)
@click.option('--reason', required=True)
@click.option('--operator-id', type=int, required=True)
@click.option('--source-material', default=None, help='修正依据的原始材料')
def correct(audio_note_id, field, old_value, new_value, reason, operator_id, source_material):
    services.manual_correction(audio_note_id, field, old_value, new_value, reason, operator_id, source_material)
    click.echo('人工修正完成')
    if field == 'leave_hours_count':
        audio_note = services.get_audio_note(audio_note_id)
        click.echo(f'  底层请假课时数已更新: {old_value}节 → {new_value}节')
        click.echo(f'  原始值保留: {audio_note.get("original_leave_hours_count", "N/A")}节')
        click.echo(f'  修正说明: {audio_note.get("leave_hours_correction_note", "N/A")}')

@cli.command()
@click.option('--audio-note-id', type=int, required=True)
@click.option('--reason', required=True)
@click.option('--operator-id', type=int, required=True)
@click.option('--source-material', default=None, help='重跑依据的材料')
def rerun(audio_note_id, reason, operator_id, source_material):
    checklist_id = services.rerun_process(audio_note_id, reason, operator_id, source_material)
    click.echo(f'流程重跑完成，新核对表ID: {checklist_id}')
    checklist = services.get_checklist(audio_note_id)
    audio_note = services.get_audio_note(audio_note_id)
    click.echo(f'  新状态: {STATUS_LABELS.get(checklist["status"], checklist["status"])}')
    click.echo(f'  为什么被留下: {checklist["reason_kept"]}')
    click.echo(f'  还缺什么材料: {checklist["missing_materials"]}')
    if checklist.get('missing_materials_source'):
        click.echo(f'  材料来源依据: {checklist["missing_materials_source"]}')
    click.echo(f'  本次使用请假课时数: {checklist.get("leave_hours_count_used", "N/A")}节')
    click.echo(f'  底层当前值: {audio_note["leave_hours_count"]}节，原始值: {audio_note.get("original_leave_hours_count", "N/A")}节')
    has_correction = audio_note.get('leave_hours_correction_note') is not None and audio_note["leave_hours_count"] != audio_note.get("original_leave_hours_count")
    click.echo(f'  是否已修正: {"是 - " + audio_note["leave_hours_correction_note"] if has_correction else "否"}')
    click.echo(f'  数据来源: {checklist.get("data_source", "N/A")}')

@cli.command()
def list_checklists():
    checklists = services.get_all_checklists()
    for cl in checklists:
        leave_tag = ' [⚠️ 有请假课时异常]' if cl['has_leave_hours'] else ''
        correction_tag = ''
        if cl.get('original_leave_hours_count') and cl['leave_hours_count'] != cl.get('original_leave_hours_count'):
            correction_tag = f' [已修正: {cl.get("original_leave_hours_count")}→{cl["leave_hours_count"]}节]'
        click.echo(f"#{cl['audio_note_id']} {cl['track_name']}{leave_tag}{correction_tag}")
        click.echo(f"  状态: {STATUS_LABELS.get(cl['status'], cl['status'])}")
        click.echo(f"  原因: {cl['reason_kept']}")
        click.echo(f"  还缺: {cl['missing_materials']}")
        if cl.get('missing_materials_source'):
            click.echo(f"  依据: {cl['missing_materials_source']}")
        click.echo(f"  请假课时: {cl.get('leave_hours_count_used', cl['leave_hours_count'])}节")
        click.echo(f"  下一步: {NEXT_OWNER.get(cl['next_owner'], cl['next_owner'])} - {cl['next_action']}")
        click.echo('---')

@cli.command()
@click.argument('audio_note_id', type=int)
def show(audio_note_id):
    note = services.get_audio_note(audio_note_id)
    checklist = services.get_checklist(audio_note_id)
    auth = services.get_authorization_page(audio_note_id)
    records = services.get_rework_records(audio_note_id)
    history = services.get_checklist_history(audio_note_id)
    
    click.echo(f'=== 曲目: {note["track_name"]} ===')
    click.echo(f'文件: {note["file_path"]}')
    click.echo(f'时长: {note["duration"]} 分钟')
    click.echo(f'原始请假课时: {note.get("original_leave_hours_count", "N/A")}节')
    click.echo(f'当前请假课时: {note["leave_hours_count"]}节')
    if note.get('leave_hours_correction_note'):
        click.echo(f'修正说明: {note["leave_hours_correction_note"]}')
    if note.get('last_corrected_at'):
        click.echo(f'最后修正时间: {note["last_corrected_at"]}')
    if note['has_leave_hours']:
        click.echo(f'⚠️  请假课时被算入已消耗: {note["leave_hours_count"]} 节')
    click.echo(f'原始备注: {note["original_note"]}')
    click.echo('')
    
    click.echo('=== 曲目核对表（最新版本）===')
    click.echo(f'版本ID: {checklist["id"]}')
    click.echo(f'状态: {STATUS_LABELS.get(checklist["status"], checklist["status"])}')
    click.echo(f'数据来源: {checklist.get("data_source", "N/A")}')
    click.echo(f'为什么被留下: {checklist["reason_kept"]}')
    click.echo(f'还缺什么材料: {checklist["missing_materials"]}')
    if checklist.get('missing_materials_source'):
        click.echo(f'材料来源依据: {checklist["missing_materials_source"]}')
    click.echo(f'本次使用请假课时数: {checklist.get("leave_hours_count_used", "N/A")}节')
    click.echo(f'下一步该找谁: {NEXT_OWNER.get(checklist["next_owner"], checklist["next_owner"])}')
    click.echo(f'具体做什么: {checklist["next_action"]}')
    click.echo('')
    
    if len(history) > 1:
        click.echo(f'=== 曲目核对表历史版本（共{len(history)}个版本）===')
        for h in history:
            click.echo(f'  版本#{h["id"]} 状态: {STATUS_LABELS.get(h["status"], h["status"])} 使用课时: {h.get("leave_hours_count_used", "N/A")}节 来源: {h.get("data_source", "N/A")}')
        click.echo('')
    
    if auth:
        click.echo('=== 授权期限页 ===')
        click.echo(f'授权编号: {auth["authorization_number"]}')
        click.echo(f'有效期: {auth["valid_from"]} 至 {auth["valid_to"]}')
        click.echo(f'授权内容: {auth.get("page_content", "-")}')
        click.echo('')
    
    click.echo('=== 返工记录（伴奏降噪返工记录）===')
    for idx, r in enumerate(records):
        click.echo(f"[{idx+1}] {r['created_at']} {r['operator_name']}")
        click.echo(f"  动作: {r['action_type']}")
        if r['field_changed']:
            click.echo(f"  字段: {r['field_changed']}: {r['old_value']} → {r['new_value']}")
        click.echo(f"  原因: {r['reason']}")
        click.echo(f"  影响: {r['affected_results']}")
        if r.get('source_material'):
            click.echo(f"  原始材料依据: {r['source_material']}")
        click.echo('')

@cli.command()
@click.option('--audio-note-id', type=int, required=True)
@click.option('--operator-id', type=int, required=True)
@click.option('--source-material', default=None, help='复核依据的材料')
def review_complete(audio_note_id, operator_id, source_material):
    services.review_complete(audio_note_id, operator_id, source_material)
    click.echo('巡演统筹复核完成')

@cli.command()
def demo_setup():
    init_db()
    click.echo('正在初始化演示数据...')
    
    xu_id = services.create_user('xulaoshi', '许老师', ROLES['MUSIC_TEACHER'])
    tour_id = services.create_user('tour_coord', '巡演统筹小王', ROLES['TOUR_COORDINATOR'])
    admin_id = services.create_user('admin', '管理员', ROLES['ADMIN'])
    
    click.echo('--- 第一步：音频文件备注第一次导入 ---')
    note1_id = services.import_audio_note(
        '夜曲_降噪版_v2.wav',
        '/audio/perform/夜曲_降噪版_v2.wav',
        4.5,
        True,
        2,
        '2024春季巡演伴奏，原文件有背景噪音，已降噪处理',
        xu_id,
        '原始材料：音频管理系统导出的课时消耗报表，记录编号2024-SPRING-042，显示请假2节'
    )
    note1 = services.get_audio_note(note1_id)
    click.echo(f'  导入成功：原始请假课时 {note1["original_leave_hours_count"]} 节，当前 {note1["leave_hours_count"]} 节')
    
    note2_id = services.import_audio_note(
        '稻香_现场版.wav',
        '/audio/perform/稻香_现场版.wav',
        3.8,
        False,
        0,
        '校园巡演曲目，无异常',
        xu_id,
        '原始材料：校园巡演曲目清单，无异常标记'
    )
    click.echo('')
    
    click.echo('--- 第二步：许老师补录授权期限页 ---')
    services.add_authorization_page(
        note1_id,
        'AUTH-2024-SPRING-0012',
        '2024-01-01',
        '2024-12-31',
        '授权方：音乐版权代理公司A，涵盖2024全年商业演出',
        xu_id,
        '原始材料：授权文件扫描件，文件名AUTH-2024-SPRING-0012.pdf'
    )
    click.echo('  已补授权：AUTH-2024-SPRING-0012')
    click.echo('')
    
    click.echo('--- 第三步：人工修正 - 修正底层请假课时数（关键修复） ---')
    click.echo('  发现问题：原始报表显示2节，但经核对发现1节是系统重复统计')
    services.manual_correction(
        note1_id,
        'leave_hours_count',
        '2',
        '1',
        '人工核对原始考勤表发现，2024年3月15日的请假记录被系统重复统计了一次，实际只有2024年4月2日的1节属于正常消耗',
        xu_id,
        '原始材料：授课老师签字的考勤表原件扫描件，2024年3月和4月课时统计对比表，差异说明文档'
    )
    note1_after = services.get_audio_note(note1_id)
    click.echo(f'  修正完成：底层数据 2节 → 1节，原始值 {note1_after["original_leave_hours_count"]} 节保留')
    click.echo(f'  修正说明：{note1_after["leave_hours_correction_note"]}')
    click.echo('')
    
    click.echo('--- 第四步：重跑流程（修正后重跑，验证数据一致性） ---')
    services.rerun_process(
        note1_id,
        '修正请假课时统计后重跑流程，确保所有版本口径一致',
        xu_id,
        '依据：人工修正后的audio_notes.leave_hours_count=1，原始值2节，rework_records表中有完整修正记录可追溯'
    )
    checklist_after = services.get_checklist(note1_id)
    click.echo(f'  重跑结果：新版本核对表使用请假课时 {checklist_after.get("leave_hours_count_used")} 节')
    click.echo(f'  核对表原因：{checklist_after["reason_kept"]}')
    click.echo(f'  还缺材料：{checklist_after["missing_materials"]}')
    click.echo(f'  材料依据：{checklist_after["missing_materials_source"]}')
    click.echo(f'  数据来源：{checklist_after.get("data_source")}')
    click.echo('')
    
    services.add_authorization_page(
        note2_id,
        'AUTH-2024-CAMPUS-0056',
        '2024-03-01',
        '2024-06-30',
        '校园巡演专项授权，限非商业演出',
        xu_id,
        '原始材料：校园巡演授权书扫描件'
    )
    
    click.echo('')
    click.echo('✅ 演示数据已就绪！')
    click.echo('')
    click.echo('演示账号:')
    click.echo(f'  音乐老师许老师: 用户ID {xu_id}')
    click.echo(f'  巡演统筹小王: 用户ID {tour_id}')
    click.echo(f'  管理员: 用户ID {admin_id}')
    click.echo('')
    click.echo('演示曲目:')
    click.echo(f'  #{note1_id} 夜曲_降噪版_v2.wav (有请假课时异常 + 人工修正 + 重跑)')
    click.echo(f'  #{note2_id} 稻香_现场版.wav (正常流程)')
    click.echo('')
    click.echo('夜曲的完整流程演示（已修复数据不一致问题）:')
    click.echo('  1. 许老师第一次导入音频备注（原始记录2节请假课时被算入已消耗）')
    click.echo('  2. 系统自动标记为「请假课时异常」，触发还缺什么材料：请假课时原始消耗明细报表')
    click.echo('  3. 许老师补录授权期限页，曲目核对表自动更新')
    click.echo('  4. ⭐ 许老师人工修正底层 leave_hours_count：2节→1节，原始值2节保留用于追溯')
    click.echo('     → 同时更新还缺什么材料及其来源依据')
    click.echo('  5. 许老师重跑流程，新版本核对表使用修正后的1节数据')
    click.echo('     → 为什么被留下：自动包含原始2节、修正后1节的对比说明')
    click.echo('     → 还缺什么材料：自动关联到需要复核的原始材料')
    click.echo('     → 数据来源：标记为 rerun_with_correction，可追溯')
    click.echo('')
    click.echo('关键修复点:')
    click.echo('  ✅ 人工修正同时改底层数据，重跑不会覆盖')
    click.echo('  ✅ 原始值永久保留，可追溯差异')
    click.echo('  ✅ 还缺什么材料 带来源依据，能从1节/2节差异追回原始材料')
    click.echo('  ✅ 每步操作都有 source_material 记录，谁改了什么、改完影响哪条结果清晰')
    click.echo('')
    click.echo('使用下面的命令查看详情:')
    click.echo(f'  python3 cli.py show {note1_id}')
    click.echo('  python3 cli.py list-checklists')
    click.echo('  python3 api.py  # 启动小看板 http://127.0.0.1:5001/')

if __name__ == '__main__':
    cli()
