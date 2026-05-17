import click
import sys
from datetime import datetime, date
from pathlib import Path

from .models import (
    BusStop, Student, BusRoute, ReroutePlan, ParentConfirmation,
    RecoveryCheck, RerouteReason, ConfirmationStatus, RecoveryStatus,
    ConfirmationChannel
)
from .rules_engine import RulesEngine
from .recovery_state_machine import RecoveryStateMachine
from .storage import Storage
from .report_exporter import ReportExporter


class BusRoutingCLI:
    def __init__(self):
        self.storage = Storage()
        self.rules_engine = RulesEngine()
        self.recovery_sm = RecoveryStateMachine(self.rules_engine)
        self.report_exporter = ReportExporter(self.rules_engine, self.recovery_sm)

    def print_error(self, msg: str):
        click.echo(click.style(f"✗ 错误: {msg}", fg="red"))

    def print_success(self, msg: str):
        click.echo(click.style(f"✓ {msg}", fg="green"))

    def print_warning(self, msg: str):
        click.echo(click.style(f"⚠ {msg}", fg="yellow"))

    def print_info(self, msg: str):
        click.echo(click.style(f"ℹ {msg}", fg="blue"))


pass_cli = click.make_pass_decorator(BusRoutingCLI, ensure=True)


@click.group()
@click.version_option(version="1.0.0", prog_name="校车改线排查CLI")
def cli():
    """校车改线家长回执站点恢复排查CLI工具"""
    pass


@cli.command()
@click.argument('route_number')
@click.argument('name')
@pass_cli
def add_route(cli: BusRoutingCLI, route_number: str, name: str):
    """添加新线路"""
    try:
        route = BusRoute(
            route_id="",
            route_number=route_number,
            name=name
        )
        cli.storage.save_route(route)
        cli.print_success(f"已添加线路: {route_number} - {name}")
        cli.print_info(f"线路ID: {route.route_id}")
    except Exception as e:
        cli.print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument('name')
@click.argument('address')
@click.option('--temporary', is_flag=True, help='是否为临时站点')
@pass_cli
def add_stop(cli: BusRoutingCLI, name: str, address: str, temporary: bool):
    """添加新站点"""
    try:
        stop = BusStop(
            stop_id="",
            name=name,
            address=address,
            is_temporary=temporary
        )
        cli.storage.save_stop(stop)
        temp_str = " (临时)" if temporary else ""
        cli.print_success(f"已添加站点: {name}{temp_str} - {address}")
        cli.print_info(f"站点ID: {stop.stop_id}")
    except Exception as e:
        cli.print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument('name')
@click.argument('grade')
@click.argument('class_name')
@click.argument('contact_name')
@click.argument('phone')
@click.argument('default_stop_id')
@pass_cli
def add_student(cli: BusRoutingCLI, name: str, grade: str, class_name: str,
                contact_name: str, phone: str, default_stop_id: str):
    """添加学生"""
    try:
        student = Student(
            student_id="",
            name=name,
            grade=grade,
            class_name=class_name,
            primary_contact=contact_name,
            phone_number=phone,
            default_stop_id=default_stop_id
        )
        cli.storage.save_student(student)
        cli.print_success(f"已添加学生: {name} ({grade}{class_name})")
        cli.print_info(f"学生ID: {student.student_id}")
    except Exception as e:
        cli.print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument('route_id')
@click.argument('reason', type=click.Choice(['道路施工', '交通事故', '天气原因', '临时管制', '其他']))
@click.argument('reason_detail')
@click.argument('effective_date')
@pass_cli
def add_reroute(cli: BusRoutingCLI, route_id: str, reason: str,
                reason_detail: str, effective_date: str):
    """添加改线计划
    
    REASON: 改线原因（道路施工/交通事故/天气原因/临时管制/其他）
    """
    try:
        eff_date = date.fromisoformat(effective_date)
        reason_enum = RerouteReason(reason)
        
        reroute = ReroutePlan(
            reroute_id="",
            route_id=route_id,
            reason=reason_enum,
            reason_detail=reason_detail,
            effective_date=eff_date
        )
        cli.storage.save_reroute(reroute)
        cli.print_success(f"已添加改线计划")
        cli.print_info(f"改线ID: {reroute.reroute_id}")
        cli.print_info(f"原因: {reason} - {reason_detail}")
    except ValueError as e:
        cli.print_error(f"日期格式错误，请使用 YYYY-MM-DD: {e}")
        sys.exit(1)
    except Exception as e:
        cli.print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument('reroute_id')
@click.argument('original_stop_id')
@click.argument('new_stop_name')
@click.argument('new_stop_address')
@pass_cli
def add_stop_replacement(cli: BusRoutingCLI, reroute_id: str, original_stop_id: str,
                         new_stop_name: str, new_stop_address: str):
    """添加站点替换关系"""
    try:
        reroutes = cli.storage.get_all_reroutes()
        for r in reroutes:
            if r['reroute_id'] == reroute_id:
                new_stop = BusStop(
                    stop_id="",
                    name=new_stop_name,
                    address=new_stop_address,
                    is_temporary=True
                )
                r['original_stop_replacements'][original_stop_id] = {
                    'stop_id': new_stop.stop_id,
                    'name': new_stop.name,
                    'address': new_stop.address,
                    'is_temporary': True
                }
                
                import json
                from dataclasses import asdict
                from bus_routing_cli.storage import EnhancedJSONEncoder
                
                with open(cli.storage.reroutes_file, 'w', encoding='utf-8') as f:
                    json.dump(reroutes, f, cls=EnhancedJSONEncoder, ensure_ascii=False, indent=2)
                
                cli.print_success(f"已添加站点替换")
                cli.print_info(f"原站点: {original_stop_id} -> 新站点: {new_stop_name}")
                return
        
        cli.print_error(f"未找到改线ID: {reroute_id}")
        sys.exit(1)
    except Exception as e:
        cli.print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument('student_id')
@click.argument('reroute_id')
@click.argument('parent_name')
@click.option('--status', type=click.Choice(['已确认', '待确认', '已拒绝']), default='待确认')
@click.option('--channel', type=click.Choice(['家长群', '电话', '短信', 'APP', '其他']), default='家长群')
@click.option('--confirmed-at', help='确认时间 (YYYY-MM-DD HH:MM:SS)')
@click.option('--original-stop-id', help='原站点ID')
@click.option('--notes', help='备注')
@pass_cli
def add_confirmation(cli: BusRoutingCLI, student_id: str, reroute_id: str, parent_name: str,
                     status: str, channel: str, confirmed_at: str, original_stop_id: str, notes: str):
    """添加家长回执"""
    try:
        conf_time = None
        if confirmed_at:
            conf_time = datetime.fromisoformat(confirmed_at.replace(' ', 'T'))
        
        conf = ParentConfirmation(
            confirmation_id="",
            student_id=student_id,
            reroute_id=reroute_id,
            status=ConfirmationStatus(status),
            channel=ConfirmationChannel(channel),
            confirmed_at=conf_time,
            parent_name=parent_name,
            notes=notes or "",
            original_stop_id=original_stop_id
        )
        
        errors = cli.rules_engine.validate_confirmation_data(conf)
        if errors:
            for err in errors:
                cli.print_warning(err)
        
        cli.storage.save_confirmation(conf)
        cli.print_success(f"已添加回执: {parent_name}")
        cli.print_info(f"确认ID: {conf.confirmation_id}")
    except Exception as e:
        cli.print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument('reroute_id')
@pass_cli
def process_confirmations(cli: BusRoutingCLI, reroute_id: str):
    """处理回执：站点替换、去重、标记迟到"""
    try:
        reroute = cli.storage.get_reroute_by_id(reroute_id)
        if not reroute:
            cli.print_error(f"未找到改线ID: {reroute_id}")
            sys.exit(1)
        
        confirmations = cli.storage.get_confirmations_by_reroute(reroute_id)
        if not confirmations:
            cli.print_warning("该改线暂无回执")
            return
        
        conf_objects = [ParentConfirmation(
            confirmation_id=c['confirmation_id'],
            student_id=c['student_id'],
            reroute_id=c['reroute_id'],
            status=ConfirmationStatus(c['status']),
            channel=ConfirmationChannel(c['channel']),
            confirmed_at=datetime.fromisoformat(c['confirmed_at']) if c.get('confirmed_at') else None,
            parent_name=c.get('parent_name', ''),
            notes=c.get('notes', ''),
            is_late=c.get('is_late', False),
            original_stop_id=c.get('original_stop_id'),
            new_stop_id=c.get('new_stop_id')
        ) for c in confirmations]
        
        reroute_obj = ReroutePlan(
            reroute_id=reroute['reroute_id'],
            route_id=reroute['route_id'],
            reason=RerouteReason(reroute['reason']),
            reason_detail=reroute['reason_detail'],
            effective_date=date.fromisoformat(reroute['effective_date'])
        )
        for k, v in reroute['original_stop_replacements'].items():
            reroute_obj.original_stop_replacements[k] = BusStop(
                stop_id=v['stop_id'],
                name=v['name'],
                address=v['address'],
                is_temporary=v.get('is_temporary', False)
            )
        
        conf_objects = cli.rules_engine.batch_apply_stop_replacement(reroute_obj, conf_objects)
        unique_confs, duplicates = cli.rules_engine.deduplicate_confirmations(conf_objects)
        
        cli.storage._save_json(cli.storage.confirmations_file, [])
        cli.storage.batch_save_confirmations(unique_confs + duplicates)
        
        cli.print_success(f"处理完成")
        cli.print_info(f"有效回执: {len(unique_confs)}")
        cli.print_info(f"重复回执: {len(duplicates)}")
        
        if duplicates:
            cli.print_warning("重复回执已标记，将在报告中过滤")
            
    except Exception as e:
        cli.print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument('reroute_id')
@click.option('--checked-by', default='系统管理员', help='排查人')
@pass_cli
def start_recovery_check(cli: BusRoutingCLI, reroute_id: str, checked_by: str):
    """开始恢复排查"""
    try:
        check = RecoveryCheck(
            check_id="",
            reroute_id=reroute_id,
            status=RecoveryStatus.PENDING
        )
        cli.storage.save_recovery_check(check)
        
        success = cli.recovery_sm.start_check(check, checked_by)
        if success:
            cli.storage.update_recovery_check(check)
            cli.print_success(f"已开始恢复排查")
            cli.print_info(f"排查ID: {check.check_id}")
        else:
            cli.print_error("无法开始排查")
            sys.exit(1)
    except Exception as e:
        cli.print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument('check_id')
@click.option('--checked-by', default='系统管理员', help='排查人')
@click.option('--notes', help='备注')
@pass_cli
def verify_recovery(cli: BusRoutingCLI, check_id: str, checked_by: str, notes: str):
    """验证恢复成功"""
    try:
        checks = cli.storage.get_all_recovery_checks()
        for c in checks:
            if c['check_id'] == check_id:
                check = RecoveryCheck(
                    check_id=c['check_id'],
                    reroute_id=c['reroute_id'],
                    status=RecoveryStatus(c['status']),
                    checked_at=datetime.fromisoformat(c['checked_at']) if c.get('checked_at') else None,
                    checked_by=c.get('checked_by', ''),
                    issues_found=c.get('issues_found', []),
                    resolution_notes=c.get('resolution_notes', '')
                )
                
                success = cli.recovery_sm.verify_recovery(check, checked_by, notes)
                if success:
                    cli.storage.update_recovery_check(check)
                    cli.print_success(f"已验证恢复成功")
                else:
                    cli.print_error(f"无法从当前状态({c['status']})转换到验证成功状态")
                    sys.exit(1)
                return
        
        cli.print_error(f"未找到排查ID: {check_id}")
        sys.exit(1)
    except Exception as e:
        cli.print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument('check_id')
@click.option('--checked-by', default='系统管理员', help='排查人')
@click.option('--issue', multiple=True, help='发现的问题（可多次指定）')
@pass_cli
def mark_recovery_failed(cli: BusRoutingCLI, check_id: str, checked_by: str, issue: list):
    """标记恢复失败"""
    try:
        checks = cli.storage.get_all_recovery_checks()
        for c in checks:
            if c['check_id'] == check_id:
                check = RecoveryCheck(
                    check_id=c['check_id'],
                    reroute_id=c['reroute_id'],
                    status=RecoveryStatus(c['status']),
                    checked_at=datetime.fromisoformat(c['checked_at']) if c.get('checked_at') else None,
                    checked_by=c.get('checked_by', ''),
                    issues_found=c.get('issues_found', []),
                    resolution_notes=c.get('resolution_notes', '')
                )
                
                success = cli.recovery_sm.mark_failed(check, checked_by, list(issue))
                if success:
                    cli.storage.update_recovery_check(check)
                    cli.print_success(f"已标记恢复失败")
                    if issue:
                        cli.print_info(f"问题: {', '.join(issue)}")
                else:
                    cli.print_error(f"无法从当前状态({c['status']})转换到恢复失败状态")
                    sys.exit(1)
                return
        
        cli.print_error(f"未找到排查ID: {check_id}")
        sys.exit(1)
    except Exception as e:
        cli.print_error(str(e))
        sys.exit(1)


@cli.command()
@click.argument('reroute_id')
@click.option('--output-dir', default='./reports', help='输出目录')
@click.option('--name', default='recovery_report', help='报告文件名')
@pass_cli
def generate_report(cli: BusRoutingCLI, reroute_id: str, output_dir: str, name: str):
    """生成排查报告（机器可读+人类可读+CSV）"""
    try:
        Path(output_dir).mkdir(exist_ok=True)
        
        reroute = cli.storage.get_reroute_by_id(reroute_id)
        if not reroute:
            cli.print_error(f"未找到改线ID: {reroute_id}")
            sys.exit(1)
        
        confirmations = cli.storage.get_confirmations_by_reroute(reroute_id)
        recovery_checks = cli.storage.get_recovery_checks_by_reroute(reroute_id)
        
        json_path = f"{output_dir}/{name}.json"
        txt_path = f"{output_dir}/{name}.txt"
        csv_path = f"{output_dir}/{name}.csv"
        
        cli.report_exporter.generate_machine_readable_report(
            reroute, confirmations, recovery_checks, json_path
        )
        cli.print_success(f"机器可读报告: {json_path}")
        
        cli.report_exporter.generate_human_readable_report(
            reroute, confirmations, recovery_checks, txt_path
        )
        cli.print_success(f"人类可读报告: {txt_path}")
        
        cli.report_exporter.export_csv_report(reroute, confirmations, csv_path)
        cli.print_success(f"CSV报告: {csv_path}")
        
        assessment = cli.recovery_sm.assess_recovery_readiness(
            ReroutePlan(
                reroute_id=reroute['reroute_id'],
                route_id=reroute['route_id'],
                reason=RerouteReason(reroute['reason']),
                reason_detail=reroute['reason_detail'],
                effective_date=date.fromisoformat(reroute['effective_date'])
            ),
            [ParentConfirmation(
                confirmation_id=c['confirmation_id'],
                student_id=c['student_id'],
                reroute_id=c['reroute_id'],
                status=ConfirmationStatus(c['status']),
                channel=ConfirmationChannel(c['channel']),
                confirmed_at=datetime.fromisoformat(c['confirmed_at']) if c.get('confirmed_at') else None,
                parent_name=c.get('parent_name', ''),
                notes=c.get('notes', ''),
                is_late=c.get('is_late', False),
                original_stop_id=c.get('original_stop_id'),
                new_stop_id=c.get('new_stop_id')
            ) for c in confirmations]
        )
        
        click.echo()
        cli.print_info(f"恢复就绪分数: {assessment['readiness_score']}/100")
        cli.print_info(f"是否可恢复: {'是' if assessment['can_recover'] else '否'}")
        
    except Exception as e:
        cli.print_error(str(e))
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command()
@pass_cli
def list_routes(cli: BusRoutingCLI):
    """列出所有线路"""
    routes = cli.storage.get_all_routes()
    if not routes:
        cli.print_warning("暂无线路")
        return
    
    click.echo("\n线路列表:")
    for r in routes:
        click.echo(f"  - {r['route_number']}: {r['name']} (ID: {r['route_id']})")


@cli.command()
@pass_cli
def list_reroutes(cli: BusRoutingCLI):
    """列出所有改线计划"""
    reroutes = cli.storage.get_all_reroutes()
    if not reroutes:
        cli.print_warning("暂无改线计划")
        return
    
    click.echo("\n改线计划列表:")
    for r in reroutes:
        click.echo(f"  - ID: {r['reroute_id']}")
        click.echo(f"    线路ID: {r['route_id']}")
        click.echo(f"    原因: {r['reason']} - {r['reason_detail']}")
        click.echo()


@cli.command()
@click.argument('sample_type', type=click.Choice(['normal', 'dirty', 'conflict', 'empty']))
@click.option('--clear', is_flag=True, help='生成前清空数据')
@pass_cli
def generate_sample(cli: BusRoutingCLI, sample_type: str, clear: bool):
    """生成样例数据
    
    normal: 正常输入\n
    dirty: 脏数据（缺失字段、格式错误）\n
    conflict: 边界冲突（重复回执、状态冲突）\n
    empty: 空结果（无回执）\n
    """
    from .sample_data import generate_sample_data
    
    if clear:
        cli.storage.clear_all()
        cli.print_info("已清空现有数据")
    
    generate_sample_data(cli, sample_type)
    cli.print_success(f"已生成 {sample_type} 样例数据")


if __name__ == '__main__':
    cli()
