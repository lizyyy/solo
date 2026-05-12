import os
import json
import sys
from datetime import datetime, date as date_cls
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

from clinic_congestion.models import Database, AppointmentStatus, DoctorStatus
from clinic_congestion.analyzer import CongestionAnalyzer, DataValidator
from clinic_congestion.sample_data import SampleDataGenerator


console = Console()


def get_db_path():
    return os.environ.get('CLINIC_DB', 'clinic.db')


def print_title(title):
    console.print()
    console.print(Panel.fit(
        f"[bold cyan]{title}[/bold cyan]",
        box=box.DOUBLE,
        border_style="cyan"
    ))


@click.group()
@click.pass_context
def cli(ctx):
    """
    门诊候诊拥堵分析 CLI 工具

    用于分析门诊候诊拥堵情况，支持预约、到诊、叫号、过号和医生出诊状态管理。
    """
    ctx.ensure_object(dict)
    ctx.obj['db_path'] = get_db_path()
    ctx.obj['db'] = Database(ctx.obj['db_path'])


@cli.command()
@click.option('--reset', is_flag=True, help='重置数据库')
@click.pass_context
def init(ctx, reset):
    """
    初始化数据库，创建所有必要的表结构。

    使用 --reset 参数可以重置数据库（清空所有数据）。
    """
    print_title("数据库初始化")
    db = ctx.obj['db']

    if reset and os.path.exists(ctx.obj['db_path']):
        os.remove(ctx.obj['db_path'])
        console.print("[yellow]已清除旧数据库[/yellow]")

    db.connect()
    db.init_db()
    console.print("[green]数据库初始化成功[/green]")
    console.print(f"数据库路径: {ctx.obj['db_path']}")

    tables = ['departments', 'doctors', 'doctor_status_log', 'appointments',
              'arrival_records', 'call_logs', 'overcall_records',
              'operation_logs', 'import_batches', 'check_results']

    table = Table(title="已创建的表", box=box.SIMPLE)
    table.add_column("序号", style="dim")
    table.add_column("表名", style="cyan")
    table.add_column("状态", style="green")
    for i, t in enumerate(tables, 1):
        table.add_row(str(i), t, "已创建")
    console.print(table)


@cli.command()
@click.option('--type', 'data_type', type=click.Choice(['appointments', 'arrivals', 'calls', 'overcalls', 'doctor_status']), required=True, help='数据类型')
@click.option('--file', 'file_path', type=click.Path(exists=True), help='JSON数据文件路径')
@click.option('--operator', default='cli_user', help='操作者标识')
@click.pass_context
def import_data(ctx, data_type, file_path, operator):
    """
    导入数据到数据库。支持幂等操作，重复导入不会重复创建数据。

    数据类型:
    - appointments: 预约表
    - arrivals: 到诊记录
    - calls: 叫号日志
    - overcalls: 过号记录
    - doctor_status: 医生出诊状态
    """
    print_title(f"导入 {data_type} 数据")
    db = ctx.obj['db']
    db.connect()
    validator = DataValidator(db)

    if not file_path:
        console.print("[red]请提供数据文件路径[/red]")
        return

    batch_id = db.log_import_batch(data_type, file_path, operator)
    console.print(f"批次ID: {batch_id}")

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except Exception as e:
        db.update_import_batch(batch_id, 0, 0, 0, 'failed', str(e))
        console.print(f"[red]读取文件失败: {e}[/red]")
        return

    if not isinstance(data, list):
        data = [data]

    record_count = len(data)
    success_count = 0
    failed_count = 0
    errors = []

    for i, item in enumerate(data):
        try:
            if data_type == 'appointments':
                is_valid, validation_errors = validator.validate_appointment_data(item)
                if not is_valid:
                    failed_count += 1
                    errors.append(f"记录 {i+1}: {', '.join(validation_errors)}")
                    continue

                inserted = db.insert_appointment(item)
                if inserted:
                    db.log_operation('INSERT', 'appointment', item['id'],
                                    None, item, operator, '导入预约数据')
                    success_count += 1
                else:
                    console.print(f"[yellow]记录 {i+1} 已存在，跳过[/yellow]")
                    success_count += 1

            elif data_type == 'arrivals':
                is_valid, validation_errors = validator.validate_arrival_data(item)
                if not is_valid:
                    failed_count += 1
                    errors.append(f"记录 {i+1}: {', '.join(validation_errors)}")
                    continue

                if 'id' not in item or not item['id']:
                    item['id'] = f"ARR_{item['appointment_id']}"

                inserted = db.insert_arrival(item)
                if inserted:
                    appt = db.get_appointment_by_id(item['appointment_id'])
                    if appt:
                        before, after = db.update_appointment_status(item['appointment_id'],
                                                                    AppointmentStatus.ARRIVED.value)
                        db.log_operation('UPDATE', 'appointment', item['appointment_id'],
                                        before, after, operator, '患者到达')
                    success_count += 1
                else:
                    console.print(f"[yellow]记录 {i+1} 已存在，跳过[/yellow]")
                    success_count += 1

            elif data_type == 'calls':
                is_valid, validation_errors = validator.validate_call_log_data(item)
                if not is_valid:
                    failed_count += 1
                    errors.append(f"记录 {i+1}: {', '.join(validation_errors)}")
                    continue

                if 'id' not in item or not item['id']:
                    item['id'] = f"CALL_{item['appointment_id']}_{datetime.now().strftime('%H%M%S')}"

                inserted = db.insert_call_log(item)
                if inserted:
                    appt = db.get_appointment_by_id(item['appointment_id'])
                    if appt:
                        before, after = db.update_appointment_status(item['appointment_id'],
                                                                    AppointmentStatus.CALLED.value)
                        db.log_operation('UPDATE', 'appointment', item['appointment_id'],
                                        before, after, operator, '呼叫患者')
                    success_count += 1
                else:
                    console.print(f"[yellow]记录 {i+1} 已存在，跳过[/yellow]")
                    success_count += 1

            elif data_type == 'overcalls':
                is_valid, validation_errors = validator.validate_overcall_data(item)
                if not is_valid:
                    failed_count += 1
                    errors.append(f"记录 {i+1}: {', '.join(validation_errors)}")
                    continue

                if 'id' not in item or not item['id']:
                    item['id'] = f"OC_{item['appointment_id']}_{datetime.now().strftime('%H%M%S')}"

                inserted = db.insert_overcall(item)
                if inserted:
                    appt = db.get_appointment_by_id(item['appointment_id'])
                    if appt:
                        before, after = db.update_appointment_status(item['appointment_id'],
                                                                    AppointmentStatus.OVERCALLED.value)
                        db.log_operation('UPDATE', 'appointment', item['appointment_id'],
                                        before, after, operator, '患者过号')
                    success_count += 1
                else:
                    console.print(f"[yellow]记录 {i+1} 已存在，跳过[/yellow]")
                    success_count += 1

            elif data_type == 'doctor_status':
                if 'doctor_id' not in item or 'status' not in item:
                    failed_count += 1
                    errors.append(f"记录 {i+1}: 缺少必要字段")
                    continue

                success = db.insert_doctor_status(
                    item['doctor_id'],
                    item['status'],
                    item.get('reason', ''),
                    operator
                )
                if success:
                    db.log_operation('UPDATE', 'doctor_status', item['doctor_id'],
                                    None, item, operator, item.get('reason', '修改医生状态'))
                    success_count += 1
                else:
                    failed_count += 1

        except Exception as e:
            failed_count += 1
            errors.append(f"记录 {i+1}: {str(e)}")

    status = 'success' if failed_count == 0 else ('partial' if success_count > 0 else 'failed')
    db.update_import_batch(batch_id, record_count, success_count, failed_count, status)

    result_table = Table(title="导入结果", box=box.SIMPLE)
    result_table.add_column("项目", style="cyan")
    result_table.add_column("数量", style="bold")
    result_table.add_row("总记录数", str(record_count))
    result_table.add_row("成功", f"[green]{success_count}[/green]")
    result_table.add_row("失败", f"[red]{failed_count}[/red]")
    console.print(result_table)

    if errors:
        console.print("\n[red]错误详情:[/red]")
        for err in errors[:10]:
            console.print(f"  - {err}")
        if len(errors) > 10:
            console.print(f"  ... 还有 {len(errors)-10} 条错误")


@cli.command()
@click.option('--department', help='科室ID，不指定则检查所有科室')
@click.option('--date', help='检查日期 (YYYY-MM-DD)，默认今天')
@click.pass_context
def check(ctx, department, date):
    """
    检查门诊拥堵情况，分析拥堵原因并给出建议。
    """
    print_title("拥堵检查")
    db = ctx.obj['db']
    db.connect()

    check_date = date or date_cls.today().isoformat()
    console.print(f"检查日期: {check_date}")

    analyzer = CongestionAnalyzer(db)

    if department:
        result = analyzer.analyze_department_congestion(department, check_date)
        if 'error' in result:
            console.print(f"[red]{result['error']}[/red]")
            return

        display_department_result(result)

        result_id = db.save_check_result(
            'department',
            department,
            result['summary']['congestion_level'],
            result
        )
        console.print(f"\n[green]检查结果已保存，ID: {result_id}[/green]")
    else:
        result = analyzer.analyze_all_departments(check_date)
        display_overall_result(result)

        result_id = db.save_check_result(
            'overall',
            None,
            result['overall']['by_congestion'],
            result
        )
        console.print(f"\n[green]检查结果已保存，ID: {result_id}[/green]")


def display_department_result(result):
    dept = result['department']
    summary = result['summary']

    console.print(f"\n[bold]科室:[/bold] {dept['name']} ({dept['id']})")
    console.print(f"[bold]窗口:[/bold] {dept['window_number']}")
    console.print()

    level_color = {
        'normal': 'green',
        'mild': 'yellow',
        'moderate': 'orange',
        'severe': 'red'
    }.get(summary['congestion_level'], 'white')

    level_desc = {
        'normal': '正常',
        'mild': '轻度拥堵',
        'moderate': '中度拥堵',
        'severe': '严重拥堵'
    }.get(summary['congestion_level'], '未知')

    console.print(Panel.fit(
        f"[bold {level_color}]{level_desc}[/bold {level_color}]",
        title="拥堵级别",
        box=box.SIMPLE
    ))

    stat_table = Table(title="候诊统计", box=box.SIMPLE)
    stat_table.add_column("类别", style="cyan")
    stat_table.add_column("数量", style="bold")
    stat_table.add_row("总预约数", str(summary['total_appointments']))
    stat_table.add_row("已完成", str(summary['completed']))
    stat_table.add_row("等待中", str(summary['waiting']))
    stat_table.add_row("已到诊", str(summary['arrived']))
    stat_table.add_row("未到诊", str(summary['pending_arrival']))
    stat_table.add_row("过号重排", str(summary['overcalled']))
    console.print(stat_table)

    if result['reason_analysis']:
        console.print("\n[bold]拥堵原因分析:[/bold]")
        for reason in result['reason_analysis']:
            severity_color = {
                'low': 'green',
                'medium': 'yellow',
                'high': 'red'
            }.get(reason['severity'], 'white')

            console.print(f"\n  [{severity_color}]{reason['description']}[/{severity_color}]")
            if reason['reason'] == 'doctor_suspension':
                for doc in reason['details']:
                    console.print(f"    - {doc['doctor_name']} ({doc['status']}): {doc['reason']}")
                    console.print(f"      操作人: {doc['operator']}, 时间: {doc['change_time'][:19]}")
            elif reason['reason'] == 'overcall_requeue':
                console.print(f"    过号患者数: {reason['count']}")
            elif reason['reason'] == 'walkin_surge':
                d = reason['details']
                console.print(f"    现场号: {d['walkin_count']}, 预约号: {d['booked_count']}, 比例: {d['ratio']}")

    if result['recommendations']:
        console.print("\n[bold]调整建议:[/bold]")
        for i, rec in enumerate(result['recommendations'], 1):
            priority_color = {
                'low': 'green',
                'medium': 'yellow',
                'high': 'red'
            }.get(rec['priority'], 'white')
            console.print(f"  [{priority_color}]优先级: {rec['priority']}[/{priority_color}]")
            console.print(f"    {i}. {rec['action']}")
            console.print(f"       {rec['details']}")


def display_overall_result(result):
    overall = result['overall']

    console.print(f"\n[bold]总览统计[/bold]")
    console.print(f"分析日期: {overall['date']}")
    console.print(f"科室总数: {overall['total_depts']}")
    console.print(f"已分析: {overall['analyzed_depts']}")
    console.print(f"总患者数: {overall['total_patients']}")
    console.print(f"等待中: {overall['total_waiting']}")

    console.print("\n[bold]按拥堵级别分布:[/bold]")
    congestion = overall['by_congestion']
    color_map = {'normal': 'green', 'mild': 'yellow', 'moderate': 'orange', 'severe': 'red'}
    for level, count in congestion.items():
        color = color_map.get(level, 'white')
        console.print(f"  [{color}]{level}: {count} 个科室[/{color}]")

    for dept_id, dept_result in result['departments'].items():
        console.print(f"\n{'-'*50}")
        display_department_result(dept_result)


@cli.command()
@click.option('--id', 'result_id', help='检查结果ID')
@click.option('--list', 'list_all', is_flag=True, help='列出历史检查记录')
@click.option('--limit', default=20, help='列表数量限制')
@click.pass_context
def detail(ctx, result_id, list_all, limit):
    """
    查看详细检查结果或历史记录。
    """
    print_title("检查详情")
    db = ctx.obj['db']
    db.connect()

    if list_all:
        results = db.get_check_results(limit)
        if not results:
            console.print("[yellow]暂无检查记录[/yellow]")
            return

        table = Table(title="历史检查记录", box=box.SIMPLE)
        table.add_column("ID", style="cyan")
        table.add_column("类型", style="bold")
        table.add_column("科室", style="yellow")
        table.add_column("结果摘要", style="green")
        table.add_column("时间", style="dim")

        for r in results:
            table.add_row(
                r['id'][:8],
                r['check_type'],
                r['department_id'] or '-',
                str(r['result_summary']),
                r['check_time'][:19]
            )
        console.print(table)
        return

    if result_id:
        result = db.get_check_result(result_id)
        if not result:
            console.print("[red]未找到该检查记录[/red]")
            return

        console.print(f"ID: {result['id']}")
        console.print(f"类型: {result['check_type']}")
        console.print(f"时间: {result['check_time']}")
        console.print(f"摘要: {result['result_summary']}")

        try:
            details = json.loads(result['details'])
            if 'overall' in details:
                display_overall_result(details)
            else:
                display_department_result(details)
        except Exception as e:
            console.print(f"[yellow]无法解析详情: {e}[/yellow]")
            if result['details']:
                console.print(result['details'])
        return

    console.print("[red]请指定 --id 或使用 --list[/red]")


@cli.command()
@click.option('--date', help='报告日期 (YYYY-MM-DD)，默认今天')
@click.option('--format', 'output_format', type=click.Choice(['text', 'json']), default='text', help='输出格式')
@click.pass_context
def report(ctx, date, output_format):
    """
    生成拥堵分析报告。
    """
    print_title("拥堵分析报告")
    db = ctx.obj['db']
    db.connect()

    report_date = date or date_cls.today().isoformat()
    analyzer = CongestionAnalyzer(db)

    result = analyzer.analyze_all_departments(report_date)
    report_data = generate_report_data(result)

    if output_format == 'json':
        console.print(json.dumps(report_data, indent=2, ensure_ascii=False, default=str))
    else:
        display_text_report(report_data)


def generate_report_data(analysis_result):
    overall = analysis_result['overall']

    peaks = []
    affected = []
    reasons = {}

    for dept_id, dept_result in analysis_result['departments'].items():
        for cp in dept_result.get('congestion_points', []):
            if cp.get('is_peak'):
                peaks.append({
                    'department': dept_result['department']['name'],
                    'time_range': cp['time_range'],
                    'patient_count': cp['patient_count']
                })

        affected.append({
            'department': dept_result['department']['name'],
            'waiting_count': dept_result['summary']['waiting'],
            'congestion_level': dept_result['summary']['congestion_level'],
            'impacted_patients': dept_result['impacted_patients']
        })

        for reason in dept_result.get('reason_analysis', []):
            key = reason['reason']
            if key not in reasons:
                reasons[key] = {
                    'description': reason['description'],
                    'departments': [],
                    'count': 0
                }
            reasons[key]['departments'].append(dept_result['department']['name'])
            reasons[key]['count'] += 1

    return {
        'date': overall['date'],
        'generated_at': datetime.now().isoformat(),
        'summary': {
            'total_departments': overall['total_depts'],
            'total_patients': overall['total_patients'],
            'total_waiting': overall['total_waiting'],
            'congestion_distribution': overall['by_congestion']
        },
        'congestion_peaks': peaks,
        'affected_departments': affected,
        'reason_breakdown': list(reasons.values()),
        'recommendations': []
    }


def display_text_report(report_data):
    console.print(f"\n[bold]生成时间:[/bold] {report_data['generated_at']}")
    console.print(f"[bold]报告日期:[/bold] {report_data['date']}")

    summary = report_data['summary']
    summary_table = Table(title="报告摘要", box=box.DOUBLE, style="cyan")
    summary_table.add_column("项目", style="bold")
    summary_table.add_column("数值", style="green")
    summary_table.add_row("科室总数", str(summary['total_departments']))
    summary_table.add_row("总患者数", str(summary['total_patients']))
    summary_table.add_row("等待中", f"[yellow]{summary['total_waiting']}[/yellow]")
    console.print(summary_table)

    if report_data['congestion_peaks']:
        peak_table = Table(title="拥堵峰值", box=box.SIMPLE, style="red")
        peak_table.add_column("科室", style="cyan")
        peak_table.add_column("时段", style="yellow")
        peak_table.add_column("患者数", style="red")
        for peak in report_data['congestion_peaks']:
            peak_table.add_row(peak['department'], peak['time_range'], str(peak['patient_count']))
        console.print(peak_table)

    if report_data['reason_breakdown']:
        console.print("\n[bold]原因归类:[/bold]")
        for reason in report_data['reason_breakdown']:
            console.print(f"\n  [yellow]{reason['description']}[/yellow]")
            console.print(f"    影响科室: {', '.join(reason['departments'])}")
            console.print(f"    出现次数: {reason['count']}")

    if report_data['affected_departments']:
        affected_table = Table(title="影响人数分布", box=box.SIMPLE)
        affected_table.add_column("科室", style="cyan")
        affected_table.add_column("等待人数", style="yellow")
        affected_table.add_column("拥堵级别", style="bold")
        for dept in report_data['affected_departments']:
            level_color = {
                'normal': 'green', 'mild': 'yellow',
                'moderate': 'orange', 'severe': 'red'
            }.get(dept['congestion_level'], 'white')
            affected_table.add_row(
                dept['department'],
                str(dept['waiting_count']),
                f"[{level_color}]{dept['congestion_level']}[/{level_color}]"
            )
        console.print(affected_table)


@cli.command()
@click.option('--type', 'sample_type', type=click.Choice(['all', 'failure']), default='all', help='样例类型')
@click.pass_context
def seed(ctx, sample_type):
    """
    生成内置样例数据用于演示。
    """
    print_title("生成样例数据")
    db = ctx.obj['db']
    db.connect()
    db.init_db()

    generator = SampleDataGenerator(db)

    if sample_type == 'failure':
        console.print("[yellow]生成故障演示样例...[/yellow]")
        generator.generate_basic_structure()
        count = generator.generate_failure_case()
        console.print(f"[green]已生成 {count} 条故障样例数据[/green]")
        console.print("\n场景说明:")
        console.print("  - 李医生临时停诊")
        console.print("  - 过号患者重新排队")
        console.print("  - 现场号激增")
    else:
        console.print("[cyan]生成完整演示样例...[/cyan]")
        counts = generator.generate_all_samples()
        console.print(f"[green]已生成样例数据:[/green]")
        console.print(f"  内科门诊: {counts['internal_medicine']} 条")
        console.print(f"  儿科门诊: {counts['pediatrics']} 条")
        console.print(f"  检验窗口: {counts['lab']} 条")


@cli.command()
@click.option('--type', 'log_type', type=click.Choice(['operations', 'imports']), default='operations', help='日志类型')
@click.option('--limit', default=50, help='显示数量')
@click.pass_context
def logs(ctx, log_type, limit):
    """
    查看操作日志或导入历史记录。
    """
    print_title(f"查看 {log_type} 日志")
    db = ctx.obj['db']
    db.connect()

    if log_type == 'operations':
        logs = db.get_operation_logs(limit)
        if not logs:
            console.print("[yellow]暂无操作日志[/yellow]")
            return

        table = Table(title="操作日志", box=box.SIMPLE)
        table.add_column("时间", style="dim")
        table.add_column("类型", style="cyan")
        table.add_column("实体", style="yellow")
        table.add_column("操作人", style="bold")
        table.add_column("原因", style="green")

        for log in logs:
            table.add_row(
                log['created_at'][:19],
                log['operation_type'],
                f"{log['entity_type']}/{log['entity_id'][:8]}",
                log['operator'] or '-',
                log['reason'] or '-'
            )
        console.print(table)

    elif log_type == 'imports':
        batches = db.get_import_batches(limit)
        if not batches:
            console.print("[yellow]暂无导入记录[/yellow]")
            return

        table = Table(title="导入历史", box=box.SIMPLE)
        table.add_column("时间", style="dim")
        table.add_column("数据类型", style="cyan")
        table.add_column("总数/成功/失败", style="yellow")
        table.add_column("状态", style="bold")
        table.add_column("操作人", style="green")

        for batch in batches:
            status_color = {
                'success': 'green',
                'partial': 'yellow',
                'failed': 'red',
                'processing': 'cyan'
            }.get(batch['status'], 'white')

            table.add_row(
                batch['created_at'][:19],
                batch['data_type'],
                f"{batch['record_count']}/{batch['success_count']}/{batch['failed_count']}",
                f"[{status_color}]{batch['status']}[/{status_color}]",
                batch['operator'] or '-'
            )
        console.print(table)


if __name__ == '__main__':
    cli()
