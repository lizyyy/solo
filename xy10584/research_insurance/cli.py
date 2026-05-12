import click
import json
import sys
from datetime import datetime
from colorama import init, Fore, Style

from .config import is_initialized, get_db_path, get_export_dir
from .database import (
    init_db, clear_all, StudentRepo, InsuranceRepo, AuthorizationRepo,
    VehicleRepo, WithdrawalRepo, AuditRepo, CheckReportRepo
)
from .models import (
    Student, StudentStatus, Insurance, Authorization, Vehicle,
    Withdrawal, CheckResult
)
from .checker import (
    check_all, get_summary, check_duplicates, get_student_full_info
)
from . import sample_data

init(autoreset=True)


def _require_init():
    if not is_initialized():
        click.echo(Fore.RED + "错误: 未初始化，请先运行: ri init")
        sys.exit(1)


def _print_status(report):
    if report.result == CheckResult.CAN_GO:
        return Fore.GREEN + "[可出发]" + Style.RESET_ALL
    elif report.result == CheckResult.CANNOT_GO:
        return Fore.RED + "[禁止出发]" + Style.RESET_ALL
    else:
        return Fore.YELLOW + "[需补材料]" + Style.RESET_ALL


@click.group()
def main():
    """研学活动保险 CLI - 出发前名单核对、保险、授权、退团管理"""
    pass


@main.command()
def init():
    """初始化工作目录和数据库"""
    if is_initialized():
        click.echo(Fore.YELLOW + "工作目录已存在，无需重复初始化")
        click.echo(f"数据库位置: {get_db_path()}")
        return
    init_db()
    click.echo(Fore.GREEN + "初始化成功!")
    click.echo(f"数据库位置: {get_db_path()}")
    click.echo("\n下一步:")
    click.echo("  1. 导入样例数据: ri import --sample")
    click.echo("  2. 或导入自定义数据: ri import students students.json")


@main.group(name='import')
def import_cmd():
    """导入各类数据（学生名单、保险、授权、车辆、退团）"""
    pass


@import_cmd.command('students')
@click.argument('file_path', required=False)
@click.option('--sample', is_flag=True, help='使用内置样例数据')
@click.option('--operator', default='admin', help='操作人姓名')
@click.option('--reason', default='', help='操作原因')
def import_students(file_path, sample, operator, reason):
    """导入学生名单 JSON"""
    _require_init()
    if sample:
        data = sample_data.SAMPLE_STUDENTS
    elif file_path:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        click.echo(Fore.RED + "请提供文件路径或使用 --sample")
        sys.exit(1)
    added = 0
    skipped = 0
    for item in data:
        s = Student(
            id=item['id'],
            name=item['name'],
            id_card=item['id_card'],
            school=item.get('school', ''),
            class_name=item.get('class_name', ''),
            guardian_name=item.get('guardian_name', ''),
            guardian_phone=item.get('guardian_phone', ''),
            status=StudentStatus.ACTIVE,
        )
        if StudentRepo.add(s, operator, reason):
            added += 1
            click.echo(f"  + 导入学生: {s.name} ({s.id_card})")
        else:
            skipped += 1
            click.echo(Fore.YELLOW + f"  ! 跳过(重复): {s.name} ({s.id_card})")
    click.echo(Fore.GREEN + f"\n完成: 新增 {added} 人, 跳过 {skipped} 人")


@import_cmd.command('insurance')
@click.argument('file_path', required=False)
@click.option('--sample', is_flag=True, help='使用内置样例数据')
@click.option('--operator', default='admin', help='操作人姓名')
@click.option('--reason', default='', help='操作原因')
def import_insurance(file_path, sample, operator, reason):
    """导入保险保单 JSON"""
    _require_init()
    if sample:
        data = sample_data.SAMPLE_INSURANCES
    elif file_path:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        click.echo(Fore.RED + "请提供文件路径或使用 --sample")
        sys.exit(1)
    added = 0
    skipped = 0
    for item in data:
        ins = Insurance(
            id=f"ins_{item['policy_number']}",
            student_name=item['student_name'],
            student_id_card=item['student_id_card'],
            policy_number=item['policy_number'],
            insurance_company=item.get('insurance_company', ''),
            start_date=item['start_date'],
            end_date=item['end_date'],
            amount=float(item.get('amount', 0)),
        )
        if InsuranceRepo.add(ins, operator, reason):
            added += 1
            click.echo(f"  + 导入保险: {ins.student_name} - {ins.policy_number}")
        else:
            skipped += 1
            click.echo(Fore.YELLOW + f"  ! 跳过(重复保单): {ins.policy_number}")
    click.echo(Fore.GREEN + f"\n完成: 新增 {added} 份, 跳过 {skipped} 份")


@import_cmd.command('authorization')
@click.argument('file_path', required=False)
@click.option('--sample', is_flag=True, help='使用内置样例数据')
@click.option('--operator', default='admin', help='操作人姓名')
@click.option('--reason', default='', help='操作原因')
def import_authorization(file_path, sample, operator, reason):
    """导入家长授权书 JSON"""
    _require_init()
    if sample:
        data = sample_data.SAMPLE_AUTHORIZATIONS
    elif file_path:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        click.echo(Fore.RED + "请提供文件路径或使用 --sample")
        sys.exit(1)
    added = 0
    skipped = 0
    for item in data:
        auth = Authorization(
            id=f"auth_{item['student_id_card']}",
            student_name=item['student_name'],
            student_id_card=item['student_id_card'],
            guardian_name=item['guardian_name'],
            guardian_id_card=item.get('guardian_id_card', ''),
            relation=item.get('relation', ''),
            signature_status=bool(item.get('signature_status', False)),
            emergency_contact=item.get('emergency_contact', ''),
            emergency_phone=item.get('emergency_phone', ''),
            medical_allergy=item.get('medical_allergy', ''),
            special_needs=item.get('special_needs', ''),
        )
        if AuthorizationRepo.add(auth, operator, reason):
            added += 1
            status = "已签字" if auth.signature_status else "未签字"
            click.echo(f"  + 导入授权: {auth.student_name} ({status})")
        else:
            skipped += 1
            click.echo(Fore.YELLOW + f"  ! 跳过(已存在): {item['student_name']}")
    click.echo(Fore.GREEN + f"\n完成: 新增 {added} 份, 跳过 {skipped} 份")


@import_cmd.command('vehicles')
@click.argument('file_path', required=False)
@click.option('--sample', is_flag=True, help='使用内置样例数据')
@click.option('--operator', default='admin', help='操作人姓名')
@click.option('--reason', default='', help='操作原因')
def import_vehicles(file_path, sample, operator, reason):
    """导入车辆分组 JSON"""
    _require_init()
    if sample:
        data = sample_data.SAMPLE_VEHICLES
    elif file_path:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        click.echo(Fore.RED + "请提供文件路径或使用 --sample")
        sys.exit(1)
    added = 0
    skipped = 0
    for item in data:
        v = Vehicle(
            id=f"veh_{item['plate_number']}",
            plate_number=item['plate_number'],
            driver_name=item.get('driver_name', ''),
            driver_phone=item.get('driver_phone', ''),
            capacity=int(item.get('capacity', 0)),
            route=item.get('route', ''),
            student_ids=item.get('student_ids', []),
        )
        if VehicleRepo.add(v, operator, reason):
            added += 1
            click.echo(f"  + 导入车辆: {v.plate_number} ({len(v.student_ids)}人)")
        else:
            skipped += 1
            click.echo(Fore.YELLOW + f"  ! 跳过(重复车牌): {v.plate_number}")
    click.echo(Fore.GREEN + f"\n完成: 新增 {added} 辆, 跳过 {skipped} 辆")


@import_cmd.command('withdrawals')
@click.argument('file_path', required=False)
@click.option('--sample', is_flag=True, help='使用内置样例数据')
@click.option('--operator', default='admin', help='操作人姓名')
@click.option('--reason', default='', help='操作原因')
def import_withdrawals(file_path, sample, operator, reason):
    """导入退团记录 JSON，同时标记学生状态和作废保险"""
    _require_init()
    if sample:
        data = sample_data.SAMPLE_WITHDRAWALS
    elif file_path:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    else:
        click.echo(Fore.RED + "请提供文件路径或使用 --sample")
        sys.exit(1)
    for item in data:
        student = StudentRepo.get_by_id(item['student_id'])
        if not student:
            click.echo(Fore.RED + f"  ! 未找到学生: {item['student_id']}")
            continue
        if student.status == StudentStatus.WITHDRW:
            click.echo(Fore.YELLOW + f"  ! 已退团(幂等跳过): {student.name}")
            continue
        w = Withdrawal(
            id=f"w_{item['student_id']}_{int(datetime.now().timestamp())}",
            student_id=item['student_id'],
            student_name=student.name,
            student_id_card=student.id_card,
            reason=item['reason'],
            withdrawal_date=item.get('withdrawal_date', datetime.now().strftime('%Y-%m-%d')),
            operator=item.get('operator', operator),
            refund_status=item.get('refund_status', 'pending'),
            insurance_voided=False,
        )
        WithdrawalRepo.add(w, operator, reason)
        student.status = StudentStatus.WITHDRW
        StudentRepo.update(student, operator, f"退团处理: {item['reason']}")
        InsuranceRepo.void_for_student(student.id_card, operator, f"退团保险作废: {item['reason']}")
        w.insurance_voided = True
        click.echo(Fore.CYAN + f"  退团处理: {student.name} -> 状态已更新, 保险已作废")
    click.echo(Fore.GREEN + "\n退团处理完成")


@import_cmd.command('all-sample')
@click.option('--operator', default='admin', help='操作人姓名')
def import_all_sample(operator):
    """一键导入所有样例数据（学生+保险+授权+车辆+退团）"""
    _require_init()
    click.echo(Fore.CYAN + "=== 导入学生名单 ===")
    ctx = click.get_current_context()
    ctx.invoke(import_students, sample=True, operator=operator, reason='样例数据导入')
    click.echo("")
    click.echo(Fore.CYAN + "=== 导入保险保单 ===")
    ctx.invoke(import_insurance, sample=True, operator=operator, reason='样例数据导入')
    click.echo("")
    click.echo(Fore.CYAN + "=== 导入家长授权 ===")
    ctx.invoke(import_authorization, sample=True, operator=operator, reason='样例数据导入')
    click.echo("")
    click.echo(Fore.CYAN + "=== 导入车辆分组 ===")
    ctx.invoke(import_vehicles, sample=True, operator=operator, reason='样例数据导入')
    click.echo("")
    click.echo(Fore.CYAN + "=== 处理退团记录 ===")
    ctx.invoke(import_withdrawals, sample=True, operator=operator, reason='样例数据导入')
    click.echo("")
    click.echo(Fore.GREEN + "所有样例数据导入完成!")
    click.echo("下一步: 执行 ri check --trip-start 2026-05-15")


@main.command()
@click.option('--trip-start', help='活动出发日期 YYYY-MM-DD')
@click.option('--student-id', help='只检查指定学生')
def check(trip_start, student_id):
    """执行核对检查，生成检查报告"""
    _require_init()
    if student_id:
        from .checker import check_student
        s = StudentRepo.get_by_id(student_id)
        if not s:
            click.echo(Fore.RED + f"未找到学生: {student_id}")
            return
        report = check_student(s, trip_start)
        CheckReportRepo.save(report)
        click.echo(f"\n学生: {report.student_name}")
        click.echo(f"状态: {_print_status(report)}")
        for issue in report.issues:
            click.echo(Fore.RED + f"  ❌ {issue}")
        for warn in report.warnings:
            click.echo(Fore.YELLOW + f"  ⚠️  {warn}")
        for ok in report.ok_items:
            click.echo(Fore.GREEN + f"  ✅ {ok}")
        return
    check_time, reports = check_all(trip_start)
    summary = get_summary(check_time)
    total = len(reports)
    can_go = len(summary['can_go'])
    cannot_go = len(summary['cannot_go'])
    need_info = len(summary['need_info'])
    click.echo(Fore.CYAN + f"\n=== 检查报告 ({check_time}) ===")
    click.echo(f"总人数: {total}")
    click.echo(Fore.GREEN + f"可出发: {can_go}")
    click.echo(Fore.RED + f"禁止出发: {cannot_go}")
    click.echo(Fore.YELLOW + f"需补材料: {need_info}")
    if summary['can_go']:
        click.echo("\n" + Fore.GREEN + "[可出发名单]")
        for r in summary['can_go']:
            click.echo(f"  ✅ {r.student_name} ({r.student_id_card[:6]}****{r.student_id_card[-4:]})")
    if summary['need_info']:
        click.echo("\n" + Fore.YELLOW + "[需补材料名单]")
        for r in summary['need_info']:
            click.echo(f"  ⚠️  {r.student_name}")
            for issue in r.issues[:3]:
                click.echo(Fore.YELLOW + f"      - {issue}")
    if summary['cannot_go']:
        click.echo("\n" + Fore.RED + "[禁止出发名单]")
        for r in summary['cannot_go']:
            click.echo(f"  ❌ {r.student_name}")
            for issue in r.issues[:3]:
                click.echo(Fore.RED + f"      - {issue}")
    duplicates = check_duplicates()
    if duplicates:
        click.echo("\n" + Fore.RED + "[⚠️ 发现身份证重复]")
        for d in duplicates:
            click.echo(f"  身份证 {d['id_card']} 出现 {d['cnt']} 次: {d['names']}")
    click.echo(f"\n检查时间戳: {check_time}")
    click.echo("使用 ri report 查看完整历史报告")


@main.command('detail')
@click.argument('student_id')
def student_detail(student_id):
    """查看学生详细信息（名单+保险+授权+车辆+退团+历史+审计）"""
    _require_init()
    info = get_student_full_info(student_id)
    if not info:
        click.echo(Fore.RED + f"未找到学生: {student_id}")
        return
    s = info['student']
    click.echo(Fore.CYAN + f"\n=== 学生: {s.name} ===")
    click.echo(f"  学号: {s.id}")
    click.echo(f"  身份证: {s.id_card}")
    click.echo(f"  学校班级: {s.school} / {s.class_name}")
    click.echo(f"  监护人: {s.guardian_name} ({s.guardian_phone})")
    click.echo(f"  状态: {s.status.value}")
    if info['insurance']:
        ins = info['insurance']
        click.echo(Fore.CYAN + "\n[保险信息]")
        click.echo(f"  保单号: {ins.policy_number}")
        click.echo(f"  保险公司: {ins.insurance_company}")
        click.echo(f"  有效期: {ins.start_date} ~ {ins.end_date}")
        click.echo(f"  保额: {ins.amount}元")
        click.echo(f"  状态: {ins.status}")
    else:
        click.echo(Fore.YELLOW + "\n[保险信息] 未找到")
    if info['authorization']:
        auth = info['authorization']
        status = "已签字" if auth.signature_status else "未签字"
        click.echo(Fore.CYAN + "\n[家长授权]")
        click.echo(f"  状态: {status}")
        click.echo(f"  监护人: {auth.guardian_name} ({auth.relation})")
        click.echo(f"  紧急联系: {auth.emergency_contact} {auth.emergency_phone}")
        if auth.medical_allergy:
            click.echo(Fore.YELLOW + f"  药物过敏: {auth.medical_allergy}")
        if auth.special_needs:
            click.echo(Fore.YELLOW + f"  特殊需求: {auth.special_needs}")
    else:
        click.echo(Fore.YELLOW + "\n[家长授权] 未找到")
    if info['vehicle']:
        v = info['vehicle']
        click.echo(Fore.CYAN + "\n[车辆分配]")
        click.echo(f"  车牌: {v.plate_number}")
        click.echo(f"  司机: {v.driver_name} ({v.driver_phone})")
        click.echo(f"  路线: {v.route}")
        click.echo(f"  同车人数: {len(v.student_ids)}/{v.capacity}")
    else:
        click.echo(Fore.YELLOW + "\n[车辆分配] 未分配")
    if info['withdrawal']:
        w = info['withdrawal']
        click.echo(Fore.RED + "\n[退团记录]")
        click.echo(f"  退团原因: {w.reason}")
        click.echo(f"  退团日期: {w.withdrawal_date}")
        click.echo(f"  操作人: {w.operator}")
        click.echo(f"  保险作废: {'是' if w.insurance_voided else '否'}")
        click.echo(f"  退款状态: {w.refund_status}")
    if info['latest_report']:
        r = info['latest_report']
        click.echo(Fore.CYAN + f"\n[最新检查结果] {_print_status(r)}")
        for issue in r.issues:
            click.echo(Fore.RED + f"  ❌ {issue}")
        for warn in r.warnings:
            click.echo(Fore.YELLOW + f"  ⚠️  {warn}")
        for ok in r.ok_items:
            click.echo(Fore.GREEN + f"  ✅ {ok}")
    if info['audit_logs']:
        click.echo(Fore.CYAN + "\n[变更审计日志]")
        for log in info['audit_logs'][:5]:
            click.echo(f"  [{log.timestamp}] {log.operation} by {log.operator}")
            if log.reason:
                click.echo(f"    原因: {log.reason}")
            if log.before:
                click.echo(f"    之前: {json.dumps(log.before, ensure_ascii=False)[:100]}")
            if log.after:
                click.echo(f"    之后: {json.dumps(log.after, ensure_ascii=False)[:100]}")


@main.command()
@click.option('--check-time', help='指定检查时间戳（默认最新一次）')
@click.option('--export', is_flag=True, help='导出为 JSON 文件')
def report(check_time, export):
    """查看历史检查报告（可按时间筛选）"""
    _require_init()
    times = CheckReportRepo.get_all_check_times()
    if not times:
        click.echo(Fore.YELLOW + "暂无检查报告，请先执行: ri check")
        return
    target = check_time or times[0]
    if target not in times:
        click.echo(Fore.RED + f"未找到该时间戳: {target}")
        click.echo("可用时间戳:")
        for t in times[:5]:
            click.echo(f"  {t}")
        return
    summary = get_summary(target)
    total = sum(len(v) for v in summary.values())
    click.echo(Fore.CYAN + f"\n=== 检查报告 ({target}) ===")
    click.echo(f"总人数: {total}  |  可出发: {len(summary['can_go'])}  |  禁止: {len(summary['cannot_go'])}  |  需补: {len(summary['need_info'])}")
    click.echo("\n" + Fore.GREEN + "1. 可出发名单 (可以随团出发)")
    if summary['can_go']:
        for r in summary['can_go']:
            click.echo(f"   ✅ {r.student_name}")
    else:
        click.echo("   (无)")
    click.echo("\n" + Fore.YELLOW + "2. 需补材料名单 (补齐后可出发)")
    if summary['need_info']:
        for r in summary['need_info']:
            click.echo(f"   ⚠️  {r.student_name}")
            for issue in r.issues:
                click.echo(Fore.YELLOW + f"      - {issue}")
    else:
        click.echo("   (无)")
    click.echo("\n" + Fore.RED + "3. 禁止出发名单 (有严重问题)")
    if summary['cannot_go']:
        for r in summary['cannot_go']:
            click.echo(f"   ❌ {r.student_name}")
            for issue in r.issues:
                click.echo(Fore.RED + f"      - {issue}")
    else:
        click.echo("   (无)")
    click.echo("\n" + Fore.CYAN + "4. 历史检查时间戳:")
    for i, t in enumerate(times[:10], 1):
        mark = " <- 当前" if t == target else ""
        click.echo(f"   {i}. {t}{mark}")
    if export:
        export_dir = get_export_dir()
        export_dir.mkdir(parents=True, exist_ok=True)
        filename = export_dir / f"report_{target.replace(':', '-')}.json"
        export_data = {
            'check_time': target,
            'summary': {
                'total': total,
                'can_go': len(summary['can_go']),
                'cannot_go': len(summary['cannot_go']),
                'need_info': len(summary['need_info']),
            },
            'can_go_list': [
                {
                    'student_id': r.student_id,
                    'name': r.student_name,
                    'id_card': r.student_id_card,
                    'ok_items': r.ok_items,
                }
                for r in summary['can_go']
            ],
            'need_info_list': [
                {
                    'student_id': r.student_id,
                    'name': r.student_name,
                    'id_card': r.student_id_card,
                    'issues': r.issues,
                    'warnings': r.warnings,
                }
                for r in summary['need_info']
            ],
            'cannot_go_list': [
                {
                    'student_id': r.student_id,
                    'name': r.student_name,
                    'id_card': r.student_id_card,
                    'issues': r.issues,
                    'warnings': r.warnings,
                }
                for r in summary['cannot_go']
            ],
        }
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
        click.echo(Fore.GREEN + f"\n已导出: {filename}")


@main.command('fix')
@click.argument('student_id')
@click.option('--field', required=True, help='要修改的字段: name/id_card/guardian_name 等')
@click.option('--new-value', required=True, help='新值')
@click.option('--operator', required=True, help='操作人姓名')
@click.option('--reason', required=True, help='修改原因')
def fix_student(student_id, field, new_value, operator, reason):
    """人工修正学生信息（记录审计日志）"""
    _require_init()
    s = StudentRepo.get_by_id(student_id)
    if not s:
        click.echo(Fore.RED + f"未找到学生: {student_id}")
        return
    valid_fields = ['name', 'id_card', 'school', 'class_name', 'guardian_name', 'guardian_phone']
    if field not in valid_fields:
        click.echo(Fore.RED + f"无效字段，允许: {', '.join(valid_fields)}")
        return
    old_value = getattr(s, field)
    if old_value == new_value:
        click.echo(Fore.YELLOW + "值未变化，无需修改")
        return
    setattr(s, field, new_value)
    if StudentRepo.update(s, operator, reason):
        click.echo(Fore.GREEN + "修改成功!")
        click.echo(f"  字段: {field}")
        click.echo(Fore.RED + f"  旧值: {old_value}")
        click.echo(Fore.GREEN + f"  新值: {new_value}")
        click.echo(f"  操作人: {operator}")
        click.echo(f"  原因: {reason}")
    else:
        click.echo(Fore.RED + "修改失败")


@main.command('audit')
@click.option('--limit', default=50, help='显示最近 N 条')
def audit_log(limit):
    """查看审计日志（所有操作历史）"""
    _require_init()
    logs = AuditRepo.get_all(limit)
    if not logs:
        click.echo(Fore.YELLOW + "暂无审计记录")
        return
    click.echo(Fore.CYAN + f"=== 审计日志 (最近 {len(logs)} 条) ===")
    for log in logs:
        op_color = {
            'create': Fore.GREEN,
            'update': Fore.YELLOW,
            'void': Fore.RED,
        }.get(log.operation, '')
        click.echo(f"\n[{log.timestamp}] {op_color}{log.operation}{Style.RESET_ALL} | {log.entity_type}:{log.entity_id}")
        click.echo(f"  操作人: {log.operator}")
        if log.reason:
            click.echo(f"  原因: {log.reason}")
        if log.before:
            click.echo(Fore.RED + f"  之前: {json.dumps(log.before, ensure_ascii=False)}")
        if log.after:
            click.echo(Fore.GREEN + f"  之后: {json.dumps(log.after, ensure_ascii=False)}")


@main.command('list')
@click.option('--type', 'list_type', default='students', help='类型: students/insurance/authorization/vehicles/withdrawals')
def list_data(list_type):
    """列出已导入的数据"""
    _require_init()
    types = {
        'students': (StudentRepo.get_all, '学生名单'),
        'insurance': (InsuranceRepo.get_all, '保险保单'),
        'authorization': (AuthorizationRepo.get_all, '家长授权'),
        'vehicles': (VehicleRepo.get_all, '车辆分组'),
        'withdrawals': (WithdrawalRepo.get_all, '退团记录'),
    }
    if list_type not in types:
        click.echo(Fore.RED + f"无效类型，允许: {', '.join(types.keys())}")
        return
    fetcher, title = types[list_type]
    items = fetcher()
    click.echo(Fore.CYAN + f"\n=== {title} (共 {len(items)} 条) ===")
    for item in items:
        if list_type == 'students':
            status = Fore.RED + '退团' if item.status == StudentStatus.WITHDRW else Fore.GREEN + '正常'
            click.echo(f"  {item.id} | {item.name} ({item.id_card}) {status}")
        elif list_type == 'insurance':
            status = Fore.RED + '已作废' if item.status == 'voided' else Fore.GREEN + '有效'
            click.echo(f"  {item.policy_number} | {item.student_name} ({item.start_date}~{item.end_date}) {status}")
        elif list_type == 'authorization':
            status = Fore.GREEN + '已签字' if item.signature_status else Fore.RED + '未签字'
            click.echo(f"  {item.student_name} | 监护人:{item.guardian_name} {status}")
        elif list_type == 'vehicles':
            click.echo(f"  {item.plate_number} | 司机:{item.driver_name} | {len(item.student_ids)}/{item.capacity}人")
        elif list_type == 'withdrawals':
            click.echo(f"  {item.student_name} | 原因:{item.reason} | 操作人:{item.operator}")


@main.command('reset')
@click.option('--yes', is_flag=True, help='确认删除所有数据')
def reset(yes):
    """清空所有数据（危险操作）"""
    if not yes:
        click.echo(Fore.RED + "危险操作: 这将删除所有数据!")
        if not click.confirm('确认继续?'):
            return
    clear_all()
    click.echo(Fore.GREEN + "所有数据已清空")


@main.command('demo')
def demo():
    """一键演示完整流程（初始化+造数+检查+报告）"""
    import os
    if is_initialized():
        click.echo(Fore.YELLOW + "已存在工作目录，demo 会在临时目录执行...")
    click.echo(Fore.CYAN + "\n=== 研学活动保险 CLI 演示 ===")
    ctx = click.get_current_context()
    click.echo("\n1) 初始化数据库...")
    if not is_initialized():
        ctx.invoke(init)
    else:
        click.echo("已初始化，跳过")
    click.echo("\n2) 导入样例数据...")
    ctx.invoke(import_all_sample, operator='demo_user')
    click.echo("\n3) 执行出发前检查...")
    ctx.invoke(check, trip_start='2026-05-15', student_id=None)
    click.echo("\n4) 查看张三的详细信息...")
    ctx.invoke(student_detail, student_id='S001')
    click.echo("\n5) 导出报告...")
    ctx.invoke(report, check_time=None, export=True)
    click.echo("\n" + Fore.GREEN + "=== 演示完成 ===")
    click.echo("\n你可以继续:")
    click.echo("  - ri check  再次执行检查（幂等）")
    click.echo("  - ri detail S002  查看证件错误的学生")
    click.echo("  - ri fix S002 --field id_card --new-value 110101201203045678 --operator 张老师 --reason '输入错误修正'")
    click.echo("  - ri audit  查看所有操作历史")


if __name__ == '__main__':
    main()
