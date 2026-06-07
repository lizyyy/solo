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
def import_note(track_name, file_path, duration, has_leave_hours, leave_hours_count, original_note, imported_by):
    note_id = services.import_audio_note(
        track_name, file_path, duration, has_leave_hours, leave_hours_count, original_note, imported_by
    )
    click.echo(f'音频备注导入成功，ID: {note_id}')
    checklist = services.get_checklist(note_id)
    click.echo(f'  状态: {STATUS_LABELS.get(checklist["status"], checklist["status"])}')
    click.echo(f'  保留原因: {checklist["reason_kept"]}')
    click.echo(f'  缺失材料: {checklist["missing_materials"]}')
    click.echo(f'  下一步: {NEXT_OWNER.get(checklist["next_owner"], checklist["next_owner"])} - {checklist["next_action"]}')

@cli.command()
@click.option('--audio-note-id', type=int, required=True)
@click.option('--auth-number', required=True, help='授权编号')
@click.option('--valid-from', required=True, help='有效期开始 YYYY-MM-DD')
@click.option('--valid-to', required=True, help='有效期结束 YYYY-MM-DD')
@click.option('--page-content', default='', help='授权页内容')
@click.option('--uploaded-by', type=int, required=True, help='上传人用户ID')
def add_auth(audio_note_id, auth_number, valid_from, valid_to, page_content, uploaded_by):
    services.add_authorization_page(audio_note_id, auth_number, valid_from, valid_to, page_content, uploaded_by)
    click.echo('授权期限页已添加')
    checklist = services.get_checklist(audio_note_id)
    click.echo(f'  更新后状态: {STATUS_LABELS.get(checklist["status"], checklist["status"])}')
    click.echo(f'  保留原因: {checklist["reason_kept"]}')
    click.echo(f'  下一步: {NEXT_OWNER.get(checklist["next_owner"], checklist["next_owner"])}')

@cli.command()
@click.option('--audio-note-id', type=int, required=True)
@click.option('--field', required=True, type=click.Choice(['status', 'next_owner', 'reason_kept', 'missing_materials']))
@click.option('--old-value', required=True)
@click.option('--new-value', required=True)
@click.option('--reason', required=True)
@click.option('--operator-id', type=int, required=True)
def correct(audio_note_id, field, old_value, new_value, reason, operator_id):
    services.manual_correction(audio_note_id, field, old_value, new_value, reason, operator_id)
    click.echo('人工修正完成')

@cli.command()
@click.option('--audio-note-id', type=int, required=True)
@click.option('--reason', required=True)
@click.option('--operator-id', type=int, required=True)
def rerun(audio_note_id, reason, operator_id):
    checklist_id = services.rerun_process(audio_note_id, reason, operator_id)
    click.echo(f'流程重跑完成，新核对表ID: {checklist_id}')
    checklist = services.get_checklist(audio_note_id)
    click.echo(f'  新状态: {STATUS_LABELS.get(checklist["status"], checklist["status"])}')

@cli.command()
def list_checklists():
    checklists = services.get_all_checklists()
    for cl in checklists:
        leave_tag = ' [⚠️ 有请假课时异常]' if cl['has_leave_hours'] else ''
        click.echo(f"#{cl['audio_note_id']} {cl['track_name']}{leave_tag}")
        click.echo(f"  状态: {STATUS_LABELS.get(cl['status'], cl['status'])}")
        click.echo(f"  原因: {cl['reason_kept']}")
        click.echo(f"  下一步: {NEXT_OWNER.get(cl['next_owner'], cl['next_owner'])} - {cl['next_action']}")
        click.echo('---')

@cli.command()
@click.argument('audio_note_id', type=int)
def show(audio_note_id):
    note = services.get_audio_note(audio_note_id)
    checklist = services.get_checklist(audio_note_id)
    auth = services.get_authorization_page(audio_note_id)
    records = services.get_rework_records(audio_note_id)
    
    click.echo(f'=== 曲目: {note["track_name"]} ===')
    click.echo(f'文件: {note["file_path"]}')
    click.echo(f'时长: {note["duration"]} 分钟')
    if note['has_leave_hours']:
        click.echo(f'⚠️  请假课时被算入已消耗: {note["leave_hours_count"]} 节')
    click.echo(f'原始备注: {note["original_note"]}')
    click.echo('')
    
    click.echo('=== 曲目核对表 ===')
    click.echo(f'状态: {STATUS_LABELS.get(checklist["status"], checklist["status"])}')
    click.echo(f'为什么被留下: {checklist["reason_kept"]}')
    click.echo(f'还缺什么材料: {checklist["missing_materials"]}')
    click.echo(f'下一步该找谁: {NEXT_OWNER.get(checklist["next_owner"], checklist["next_owner"])}')
    click.echo(f'具体做什么: {checklist["next_action"]}')
    click.echo('')
    
    if auth:
        click.echo('=== 授权期限页 ===')
        click.echo(f'授权编号: {auth["authorization_number"]}')
        click.echo(f'有效期: {auth["valid_from"]} 至 {auth["valid_to"]}')
        click.echo('')
    
    click.echo('=== 返工记录 (伴奏降噪返工记录) ===')
    for r in records:
        click.echo(f"[{r['created_at']}] {r['operator_name']}")
        click.echo(f"  动作: {r['action_type']}")
        if r['field_changed']:
            click.echo(f"  字段: {r['field_changed']}: {r['old_value']} → {r['new_value']}")
        click.echo(f"  原因: {r['reason']}")
        click.echo(f"  影响: {r['affected_results']}")
        click.echo('')

@cli.command()
@click.option('--audio-note-id', type=int, required=True)
@click.option('--operator-id', type=int, required=True)
def review_complete(audio_note_id, operator_id):
    services.review_complete(audio_note_id, operator_id)
    click.echo('巡演统筹复核完成')

@cli.command()
def demo_setup():
    init_db()
    click.echo('正在初始化演示数据...')
    
    xu_id = services.create_user('xulaoshi', '许老师', ROLES['MUSIC_TEACHER'])
    tour_id = services.create_user('tour_coord', '巡演统筹小王', ROLES['TOUR_COORDINATOR'])
    admin_id = services.create_user('admin', '管理员', ROLES['ADMIN'])
    
    note1_id = services.import_audio_note(
        '夜曲_降噪版_v2.wav',
        '/audio/perform/夜曲_降噪版_v2.wav',
        4.5,
        True,
        2,
        '2024春季巡演伴奏，原文件有背景噪音，已降噪处理',
        xu_id
    )
    
    note2_id = services.import_audio_note(
        '稻香_现场版.wav',
        '/audio/perform/稻香_现场版.wav',
        3.8,
        False,
        0,
        '校园巡演曲目，无异常',
        xu_id
    )
    
    services.add_authorization_page(
        note1_id,
        'AUTH-2024-SPRING-0012',
        '2024-01-01',
        '2024-12-31',
        '授权方：音乐版权代理公司A，涵盖2024全年商业演出',
        xu_id
    )
    
    services.manual_correction(
        note1_id,
        'reason_kept',
        '授权期限页已补充（授权号：AUTH-2024-SPRING-0012，有效期：2024-01-01 至 2024-12-31），但仍有 2 节请假课时待复核',
        '授权期限页已补充，但经许老师核对发现请假课时实为1节（另一节是系统重复统计），需巡演统筹最终确认',
        '人工复核时发现系统重复统计了一节请假课时，实际只有1节',
        xu_id
    )
    
    services.rerun_process(
        note1_id,
        '修正请假课时统计后重跑流程',
        xu_id
    )
    
    services.add_authorization_page(
        note2_id,
        'AUTH-2024-CAMPUS-0056',
        '2024-03-01',
        '2024-06-30',
        '校园巡演专项授权，限非商业演出',
        xu_id
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
    click.echo(f'  #{note1_id} 夜曲_降噪版_v2.wav (有请假课时异常)')
    click.echo(f'  #{note2_id} 稻香_现场版.wav (正常流程)')
    click.echo('')
    click.echo('夜曲的完整流程演示:')
    click.echo('  1. 许老师第一次导入音频备注（含2节请假课时被算入已消耗）')
    click.echo('  2. 系统自动标记为「请假课时异常」，留给巡演统筹复核')
    click.echo('  3. 许老师补录授权期限页')
    click.echo('  4. 许老师人工修正：发现实际只有1节请假课时')
    click.echo('  5. 许老师重跑流程，生成新的曲目核对表')
    click.echo('')
    click.echo('使用下面的命令查看详情:')
    click.echo(f'  python cli.py show {note1_id}')
    click.echo('  python cli.py list-checklists')

if __name__ == '__main__':
    cli()
