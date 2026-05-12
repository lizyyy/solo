import os
import json
from datetime import datetime
from typing import Optional, List
import click
from tabulate import tabulate

from .config import ConfigManager
from .storage import StorageManager
from .data_import import DataImporter
from .rules import RuleEngine
from .sample_data import get_all_sample_data, SAMPLE_DATA_DESCRIPTION, SAMPLE_MONTH
from .models import Correction, CheckRun, to_dict


SEVERITY_COLOR = {
    "blocker": "red",
    "warning": "yellow",
    "info": "blue"
}

STATUS_COLOR = {
    "pending": "red",
    "resolved": "green",
    "in_progress": "yellow"
}

SEVERITY_ICON = {
    "blocker": "[BLOCK]",
    "warning": "[WARN]",
    "info": "[INFO]"
}

STATUS_ICON = {
    "pending": "[待处理]",
    "resolved": "[已处理]",
    "in_progress": "[处理中]"
}


def colorize(text: str, color: str) -> str:
    colors = {
        "red": "\033[91m",
        "green": "\033[92m",
        "yellow": "\033[93m",
        "blue": "\033[94m",
        "cyan": "\033[96m",
        "bold": "\033[1m",
        "reset": "\033[0m"
    }
    return f"{colors.get(color, '')}{text}{colors['reset']}"


def get_storage() -> tuple:
    config = ConfigManager()
    storage = StorageManager(config.get_data_dir())
    return config, storage


@click.group()
@click.version_option("1.0.0")
def cli():
    """发薪异常解释 CLI 工具 - 帮助薪酬专员在发薪前核对工资项、考勤、请假、补贴、扣款、个税和银行回盘异常"""
    pass


@cli.command()
@click.option("--force", is_flag=True, help="强制初始化，覆盖现有数据")
def init(force: bool):
    """初始化项目，创建配置文件和数据目录"""
    config_path = "salary_checker.json"
    data_dir = ".salary_data"
    
    if os.path.exists(config_path) and not force:
        click.echo(colorize(f"错误: 配置文件 {config_path} 已存在", "red"))
        click.echo("使用 --force 选项强制重新初始化")
        return
    
    if os.path.exists(data_dir) and not force:
        click.echo(colorize(f"错误: 数据目录 {data_dir} 已存在", "red"))
        click.echo("使用 --force 选项强制重新初始化")
        return
    
    config = ConfigManager(config_path)
    config.save()
    
    storage = StorageManager(data_dir)
    storage._ensure_dirs()
    
    click.echo(colorize("✓ 初始化完成", "green"))
    click.echo(f"  配置文件: {config_path}")
    click.echo(f"  数据目录: {data_dir}")
    click.echo("")
    click.echo("下一步:")
    click.echo("  1. 使用 'salary import --sample' 导入样例数据")
    click.echo("  2. 或使用 'salary import --file <path> --type <type> --month <YYYY-MM>' 导入自己的数据")


@cli.command()
@click.option("--file", "-f", type=click.Path(exists=True), help="JSON数据文件路径")
@click.option("--type", "-t", "data_type", type=click.Choice([
    "employees", "salary_items", "attendances", "leaves",
    "allowances", "deductions", "taxes", "bank_responses"
]), help="数据类型")
@click.option("--month", "-m", help="月份 (格式: YYYY-MM)")
@click.option("--sample", is_flag=True, help="使用内置样例数据")
def import_data(file: Optional[str], data_type: Optional[str], month: Optional[str], sample: bool):
    """导入数据 - 支持从文件或内置样例导入"""
    config, storage = get_storage()
    importer = DataImporter(storage)
    
    if sample:
        click.echo(colorize("导入内置样例数据...", "cyan"))
        sample_data = get_all_sample_data()
        month = SAMPLE_MONTH
        
        for dtype, items in sample_data.items():
            record = importer.import_from_data(dtype, items, month)
            status_color = "green" if record.status == "success" else ("yellow" if record.status == "partial" else "red")
            click.echo(f"  [{colorize(record.status.upper(), status_color)}] {dtype}: {len(items)} 条记录")
            if record.error_message:
                click.echo(f"    错误: {record.error_message}")
        
        click.echo("")
        click.echo(colorize("✓ 样例数据导入完成", "green"))
        click.echo("")
        click.echo("样例数据说明:")
        for line in SAMPLE_DATA_DESCRIPTION.strip().split("\n"):
            if line:
                click.echo(f"  {line}")
        return
    
    if not all([file, data_type, month]):
        click.echo(colorize("错误: 必须指定 --file, --type 和 --month，或使用 --sample", "red"))
        click.echo("")
        click.echo("示例:")
        click.echo("  salary import --file employees.json --type employees --month 2024-03")
        click.echo("  salary import --sample")
        return
    
    click.echo(colorize(f"导入 {data_type} 数据...", "cyan"))
    record = importer.import_from_file(file, data_type, month)
    
    status_color = "green" if record.status == "success" else ("yellow" if record.status == "partial" else "red")
    click.echo(f"[{colorize(record.status.upper(), status_color)}] 共 {record.count} 条记录")
    
    if record.error_message:
        click.echo(f"错误: {record.error_message}")


@cli.command()
@click.option("--month", "-m", required=True, help="月份 (格式: YYYY-MM)")
@click.option("--employee", "-e", help="指定员工ID (可选)")
def check(month: str, employee: Optional[str]):
    """执行规则检查，生成异常报告"""
    config, storage = get_storage()
    engine = RuleEngine(config, storage)
    
    click.echo(colorize(f"\n{'='*60}", "bold"))
    click.echo(colorize(f"  发薪异常检查 - {month}", "bold"))
    click.echo(colorize(f"{'='*60}\n", "bold"))
    
    check_run = CheckRun(
        run_id=StorageManager.generate_id(),
        month=month,
        status="running"
    )
    storage.save_check_run(check_run)
    
    employees = storage.list_employees()
    if not employees:
        click.echo(colorize("错误: 没有员工数据，请先导入数据", "red"))
        click.echo("使用 'salary import --sample' 导入样例数据")
        return
    
    if employee:
        employees = [e for e in employees if e.emp_id == employee]
        if not employees:
            click.echo(colorize(f"错误: 未找到员工 {employee}", "red"))
            return
    
    all_anomalies = []
    
    for emp in employees:
        emp_type_name = config.get_employee_type_config(emp.employee_type).get("name", emp.employee_type)
        click.echo(colorize(f"\n检查: {emp.name} ({emp.emp_id}) - {emp_type_name}", "cyan"))
        
        anomalies = engine.check_employee(emp.emp_id, month)
        
        if anomalies:
            for anomaly in anomalies:
                storage.save_anomaly(anomaly)
                all_anomalies.append(anomaly)
                
                severity_color = SEVERITY_COLOR.get(anomaly.severity, "blue")
                click.echo(f"  {SEVERITY_ICON.get(anomaly.severity, '')} {colorize(anomaly.rule_name, severity_color)}")
                click.echo(f"    {anomaly.message}")
        else:
            click.echo(colorize("  ✓ 无异常", "green"))
    
    check_run.finished_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    check_run.total_anomalies = len(all_anomalies)
    check_run.blocker_anomalies = len([a for a in all_anomalies if a.severity == "blocker"])
    check_run.warning_anomalies = len([a for a in all_anomalies if a.severity == "warning"])
    check_run.status = "completed"
    storage.save_check_run(check_run)
    
    click.echo(colorize(f"\n{'='*60}", "bold"))
    click.echo(colorize("  检查汇总", "bold"))
    click.echo(colorize(f"{'='*60}\n", "bold"))
    
    summary_table = [
        ["总异常数", len(all_anomalies)],
        [colorize("阻断性异常", "red"), len([a for a in all_anomalies if a.severity == "blocker"])],
        [colorize("警告性异常", "yellow"), len([a for a in all_anomalies if a.severity == "warning"])],
        [colorize("可发薪", "green"), len(employees) - len(set(a.emp_id for a in all_anomalies if a.severity == "blocker"))],
        [colorize("需处理", "yellow"), len(set(a.emp_id for a in all_anomalies if a.severity == "blocker"))]
    ]
    click.echo(tabulate(summary_table, tablefmt="grid"))
    
    if any(a.severity == "blocker" for a in all_anomalies):
        click.echo(f"\n{colorize('⚠ 存在阻断性异常，建议暂缓发薪', 'red')}")
    else:
        click.echo(f"\n{colorize('✓ 无阻断性异常，可以正常发薪', 'green')}")


@cli.command()
@click.option("--month", "-m", required=True, help="月份 (格式: YYYY-MM)")
@click.option("--employee", "-e", help="指定员工ID")
@click.option("--anomaly-id", "-a", help="指定异常ID")
@click.option("--status", "-s", type=click.Choice(["all", "pending", "resolved"]), default="all")
def detail(month: str, employee: Optional[str], anomaly_id: Optional[str], status: str):
    """查看异常详情、历史记录和失败原因"""
    config, storage = get_storage()
    
    if anomaly_id:
        anomalies = [a for a in storage.list_anomalies(month) if a.anomaly_id == anomaly_id]
    elif employee:
        anomalies = storage.list_anomalies_by_emp(employee, month)
    else:
        anomalies = storage.list_anomalies(month)
    
    if status != "all":
        anomalies = [a for a in anomalies if a.status == status]
    
    if not anomalies:
        click.echo(colorize("未找到匹配的异常记录", "yellow"))
        return
    
    click.echo(colorize(f"\n{'='*80}", "bold"))
    click.echo(colorize(f"  异常详情 - {month}", "bold"))
    click.echo(colorize(f"{'='*80}\n", "bold"))
    
    for i, anomaly in enumerate(anomalies, 1):
        emp = storage.get_employee(anomaly.emp_id)
        emp_name = emp.name if emp else "未知"
        emp_type_name = config.get_employee_type_config(emp.employee_type if emp else "full_time").get("name", "")
        
        severity_color = SEVERITY_COLOR.get(anomaly.severity, "blue")
        status_color = STATUS_COLOR.get(anomaly.status, "yellow")
        
        click.echo(colorize(f"[{i}] {anomaly.rule_name}", "cyan"))
        click.echo(f"    员工: {emp_name} ({anomaly.emp_id}) - {emp_type_name}")
        click.echo(f"    异常ID: {anomaly.anomaly_id}")
        click.echo(f"    严重性: {colorize(anomaly.severity.upper(), severity_color)} ({SEVERITY_ICON.get(anomaly.severity, '')})")
        click.echo(f"    状态: {colorize(anomaly.status.upper(), status_color)} ({STATUS_ICON.get(anomaly.status, '')})")
        click.echo(f"    消息: {anomaly.message}")
        click.echo(f"    创建时间: {anomaly.created_at}")
        
        if anomaly.resolved_at:
            click.echo(f"    解决时间: {anomaly.resolved_at}")
        if anomaly.resolved_by:
            click.echo(f"    处理人: {anomaly.resolved_by}")
        
        click.echo(colorize("    详细信息:", "cyan"))
        for key, value in anomaly.detail.items():
            click.echo(f"      {key}: {value}")
        
        if anomaly.resolution_detail:
            click.echo(colorize("    处理详情:", "green"))
            for key, value in anomaly.resolution_detail.items():
                click.echo(f"      {key}: {value}")
        
        corrections = storage.list_corrections_by_emp(anomaly.emp_id, month)
        if corrections:
            click.echo(colorize(f"    相关修正记录 ({len(corrections)}条):", "yellow"))
            for corr in corrections:
                click.echo(f"      [{corr.correction_id}] {corr.operator} 于 {corr.created_at}")
                click.echo(f"        操作: {corr.operation}")
                click.echo(f"        原因: {corr.reason}")
                click.echo(f"        变更: {corr.before_value} -> {corr.after_value}")
        
        click.echo("")
    
    import_records = storage.list_import_records(month)
    if import_records:
        click.echo(colorize(f"{'='*80}", "bold"))
        click.echo(colorize("  数据导入历史", "bold"))
        click.echo(colorize(f"{'='*80}\n", "bold"))
        
        history_table = []
        for record in import_records:
            status_color = "green" if record.status == "success" else ("yellow" if record.status == "partial" else "red")
            history_table.append([
                record.record_id[:8],
                record.data_type,
                record.count,
                colorize(record.status, status_color),
                record.created_at
            ])
        
        click.echo(tabulate(
            history_table,
            headers=["记录ID", "数据类型", "数量", "状态", "时间"],
            tablefmt="grid"
        ))
    
    check_runs = storage.list_check_runs(month)
    if check_runs:
        click.echo(colorize(f"\n{'='*80}", "bold"))
        click.echo(colorize("  检查运行历史", "bold"))
        click.echo(colorize(f"{'='*80}\n", "bold"))
        
        run_table = []
        for run in check_runs:
            run_table.append([
                run.run_id[:8],
                run.total_anomalies,
                colorize(run.blocker_anomalies, "red"),
                colorize(run.warning_anomalies, "yellow"),
                run.status,
                run.started_at
            ])
        
        click.echo(tabulate(
            run_table,
            headers=["运行ID", "总数", "阻断", "警告", "状态", "开始时间"],
            tablefmt="grid"
        ))


@cli.command()
@click.option("--month", "-m", required=True, help="月份 (格式: YYYY-MM)")
@click.option("--employee", "-e", help="指定员工ID查看个人明细")
@click.option("--output", "-o", type=click.Choice(["console", "json"]), default="console")
def report(month: str, employee: Optional[str], output: str):
    """生成最终报告 - 阻断发薪/可提醒/已处理异常和个人解释明细"""
    config, storage = get_storage()
    
    employees = storage.list_employees()
    if employee:
        employees = [e for e in employees if e.emp_id == employee]
    
    all_anomalies = storage.list_anomalies(month)
    pending_anomalies = [a for a in all_anomalies if a.status == "pending"]
    resolved_anomalies = [a for a in all_anomalies if a.status == "resolved"]
    blocker_anomalies = [a for a in pending_anomalies if a.severity == "blocker"]
    warning_anomalies = [a for a in pending_anomalies if a.severity == "warning"]
    
    blocked_employees = set(a.emp_id for a in blocker_anomalies)
    warned_employees = set(a.emp_id for a in warning_anomalies) - blocked_employees
    
    if output == "json":
        report_data = {
            "month": month,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "summary": {
                "total_employees": len(employees),
                "blocked_employees": len(blocked_employees),
                "warned_employees": len(warned_employees),
                "clear_employees": len(employees) - len(blocked_employees | warned_employees),
                "total_anomalies": len(pending_anomalies),
                "blocker_anomalies": len(blocker_anomalies),
                "warning_anomalies": len(warning_anomalies),
                "resolved_anomalies": len(resolved_anomalies)
            },
            "blocked_employees": [],
            "warned_employees": [],
            "clear_employees": [],
            "employee_details": {}
        }
        
        for emp in employees:
            emp_anomalies = [a for a in all_anomalies if a.emp_id == emp.emp_id]
            emp_blockers = [a for a in emp_anomalies if a.severity == "blocker" and a.status == "pending"]
            emp_warnings = [a for a in emp_anomalies if a.severity == "warning" and a.status == "pending"]
            emp_resolved = [a for a in emp_anomalies if a.status == "resolved"]
            
            report_data["employee_details"][emp.emp_id] = {
                "name": emp.name,
                "employee_type": emp.employee_type,
                "department": emp.department,
                "bank_account": emp.bank_account,
                "bank_name": emp.bank_name,
                "blocker_count": len(emp_blockers),
                "warning_count": len(emp_warnings),
                "resolved_count": len(emp_resolved),
                "anomalies": [to_dict(a) for a in emp_anomalies]
            }
            
            if emp.emp_id in blocked_employees:
                report_data["blocked_employees"].append(emp.emp_id)
            elif emp.emp_id in warned_employees:
                report_data["warned_employees"].append(emp.emp_id)
            else:
                report_data["clear_employees"].append(emp.emp_id)
        
        click.echo(json.dumps(report_data, ensure_ascii=False, indent=2))
        return
    
    click.echo(colorize(f"\n{'='*80}", "bold"))
    click.echo(colorize(f"  发薪异常报告 - {month}", "bold"))
    click.echo(colorize(f"  生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", "bold"))
    click.echo(colorize(f"{'='*80}\n", "bold"))
    
    click.echo(colorize("  一、业务闭环状态判断", "cyan"))
    click.echo(colorize("-" * 80, "cyan"))
    
    if blocker_anomalies:
        click.echo(colorize(f"\n  ❌ 状态: {colorize('业务未闭环 - 存在阻断性异常，建议暂缓发薪', 'red')}", "red"))
    else:
        click.echo(colorize(f"\n  ✓ 状态: {colorize('业务已闭环 - 无阻断性异常，可以正常发薪', 'green')}", "green"))
    
    click.echo("")
    summary_data = [
        ["员工总数", len(employees)],
        [colorize("需阻断发薪", "red"), len(blocked_employees)],
        [colorize("需提醒关注", "yellow"), len(warned_employees)],
        [colorize("可正常发薪", "green"), len(employees) - len(blocked_employees | warned_employees)],
        ["", ""],
        ["待处理异常总数", len(pending_anomalies)],
        [colorize("阻断性异常", "red"), len(blocker_anomalies)],
        [colorize("警告性异常", "yellow"), len(warning_anomalies)],
        [colorize("已处理异常", "green"), len(resolved_anomalies)]
    ]
    click.echo(tabulate(summary_data, tablefmt="grid"))
    
    if blocker_anomalies:
        click.echo(colorize(f"\n  二、阻断发薪异常 (必须处理)", "red"))
        click.echo(colorize("-" * 80, "red"))
        
        for emp_id in sorted(blocked_employees):
            emp = storage.get_employee(emp_id)
            emp_name = emp.name if emp else "未知"
            emp_anomalies = [a for a in blocker_anomalies if a.emp_id == emp_id]
            
            click.echo(f"\n  员工: {colorize(emp_name, 'bold')} ({emp_id})")
            for a in emp_anomalies:
                click.echo(f"    [{colorize('BLOCK', 'red')}] {a.rule_name}")
                click.echo(f"      原因: {a.message}")
    
    if warning_anomalies:
        click.echo(colorize(f"\n  三、可提醒异常 (建议关注)", "yellow"))
        click.echo(colorize("-" * 80, "yellow"))
        
        for emp_id in sorted(warned_employees):
            emp = storage.get_employee(emp_id)
            emp_name = emp.name if emp else "未知"
            emp_anomalies = [a for a in warning_anomalies if a.emp_id == emp_id]
            
            click.echo(f"\n  员工: {emp_name} ({emp_id})")
            for a in emp_anomalies:
                click.echo(f"    [{colorize('WARN', 'yellow')}] {a.rule_name}")
                click.echo(f"      原因: {a.message}")
    
    if resolved_anomalies:
        click.echo(colorize(f"\n  四、已处理异常", "green"))
        click.echo(colorize("-" * 80, "green"))
        
        resolved_by_emp = {}
        for a in resolved_anomalies:
            if a.emp_id not in resolved_by_emp:
                resolved_by_emp[a.emp_id] = []
            resolved_by_emp[a.emp_id].append(a)
        
        for emp_id, anomalies in resolved_by_emp.items():
            emp = storage.get_employee(emp_id)
            emp_name = emp.name if emp else "未知"
            click.echo(f"\n  员工: {emp_name} ({emp_id})")
            for a in anomalies:
                click.echo(f"    [{colorize('DONE', 'green')}] {a.rule_name}")
                click.echo(f"      处理人: {a.resolved_by or '未知'}")
                click.echo(f"      处理时间: {a.resolved_at}")
    
    click.echo(colorize(f"\n  五、个人工资解释明细", "cyan"))
    click.echo(colorize("-" * 80, "cyan"))
    
    for emp in employees:
        emp_type_config = config.get_employee_type_config(emp.employee_type)
        emp_type_name = emp_type_config.get("name", emp.employee_type)
        
        salary = storage.get_salary_item(emp.emp_id, month)
        attendance = storage.get_attendance(emp.emp_id, month)
        tax = storage.get_tax(emp.emp_id, month)
        allowances = storage.list_allowances_by_emp(emp.emp_id, month)
        deductions = storage.list_deductions_by_emp(emp.emp_id, month)
        emp_anomalies = [a for a in all_anomalies if a.emp_id == emp.emp_id]
        corrections = storage.list_corrections_by_emp(emp.emp_id, month)
        
        emp_status = "clear"
        if any(a.severity == "blocker" and a.status == "pending" for a in emp_anomalies):
            emp_status = "blocked"
        elif any(a.status == "pending" for a in emp_anomalies):
            emp_status = "warned"
        
        status_icon = colorize("✓", "green") if emp_status == "clear" else (colorize("❌", "red") if emp_status == "blocked" else colorize("⚠", "yellow"))
        status_text = colorize("可正常发薪", "green") if emp_status == "clear" else (colorize("需阻断发薪", "red") if emp_status == "blocked" else colorize("需关注", "yellow"))
        
        click.echo(f"\n{status_icon} {colorize(emp.name, 'bold')} ({emp.emp_id})")
        click.echo(f"    类型: {emp_type_name} | 部门: {emp.department}")
        click.echo(f"    状态: {status_text}")
        
        if salary:
            total_income = salary.base_salary + salary.overtime + salary.performance + salary.other_allowance
            click.echo(f"\n    【工资项】")
            click.echo(f"      基本工资: {salary.base_salary:.2f}")
            if salary.overtime:
                click.echo(f"      加班费: {salary.overtime:.2f}")
            if salary.performance:
                click.echo(f"      绩效奖金: {salary.performance:.2f}")
            if salary.other_allowance:
                click.echo(f"      其他津贴: {salary.other_allowance:.2f}")
            click.echo(f"      收入合计: {colorize(f'{total_income:.2f}', 'green')}")
        
        if allowances:
            click.echo(f"\n    【补贴】")
            total_allowance = 0
            for alw in allowances:
                click.echo(f"      {alw.allowance_type}: {alw.amount:.2f} (审批人: {alw.approved_by or '无'})")
                total_allowance += alw.amount
            click.echo(f"      补贴合计: {total_allowance:.2f}")
        
        if deductions:
            click.echo(f"\n    【扣款】")
            total_deduction = 0
            for ded in deductions:
                click.echo(f"      {ded.deduction_type}: {ded.amount:.2f} (原因: {ded.reason or '无'})")
                total_deduction += ded.amount
            click.echo(f"      扣款合计: {total_deduction:.2f}")
        
        if tax:
            click.echo(f"\n    【个税】")
            click.echo(f"      应纳税所得: {tax.taxable_income:.2f}")
            click.echo(f"      本月税额: {colorize(f'{tax.tax_amount:.2f}', 'yellow' if tax.tax_amount < 0 else 'normal')}")
            click.echo(f"      累计税额: {tax.cumulative_tax:.2f}")
        
        if emp_anomalies:
            click.echo(f"\n    【异常记录】")
            for a in emp_anomalies:
                sev_color = "red" if a.severity == "blocker" else "yellow"
                status_text = "待处理" if a.status == "pending" else "已处理"
                click.echo(f"      [{a.rule_name}] {a.message} ({colorize(status_text, sev_color)})")
        
        if corrections:
            click.echo(f"\n    【人工修正】")
            for corr in corrections:
                click.echo(f"      {corr.operation}: {corr.before_value} -> {corr.after_value}")
                click.echo(f"        操作人: {corr.operator} | 原因: {corr.reason}")
        
        click.echo(f"\n    {'-'*60}")
    
    click.echo(colorize(f"\n{'='*80}", "bold"))
    click.echo(colorize("  说明: 本报告自动生成，所有数据变更均有历史记录可追溯", "cyan"))
    click.echo(colorize(f"{'='*80}\n", "bold"))


@cli.command()
@click.option("--month", "-m", required=True, help="月份 (格式: YYYY-MM)")
@click.option("--anomaly-id", "-a", required=True, help="异常ID")
@click.option("--operator", "-o", required=True, help="操作人")
@click.option("--reason", "-r", required=True, help="处理原因/备注")
@click.option("--before-value", "-b", help="修正前的值 (用于记录差异)")
@click.option("--after-value", "-c", help="修正后的值 (用于记录差异)")
@click.option("--operation", "-p", default="manual_fix", help="操作类型")
def resolve(month: str, anomaly_id: str, operator: str, reason: str,
            before_value: Optional[str], after_value: Optional[str],
            operation: str):
    """人工标记异常为已处理，留下前后差异和操作者记录"""
    config, storage = get_storage()
    
    anomaly = storage.get_anomaly(anomaly_id, month)
    if not anomaly:
        click.echo(colorize(f"错误: 未找到异常 {anomaly_id}", "red"))
        return
    
    click.echo(colorize("标记异常为已处理...", "cyan"))
    click.echo(f"  员工: {anomaly.emp_id}")
    click.echo(f"  规则: {anomaly.rule_name}")
    click.echo(f"  消息: {anomaly.message}")
    
    if before_value and after_value:
        correction = Correction(
            correction_id=StorageManager.generate_id(),
            emp_id=anomaly.emp_id,
            month=month,
            operator=operator,
            operation=operation,
            before_value=before_value,
            after_value=after_value,
            reason=reason
        )
        storage.save_correction(correction)
        click.echo(f"  修正记录: {correction.correction_id}")
        click.echo(f"  变更: {before_value} -> {after_value}")
    
    anomaly.status = "resolved"
    anomaly.resolved_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    anomaly.resolved_by = operator
    anomaly.resolution_detail = {
        "operation": operation,
        "reason": reason,
        "operator": operator
    }
    if before_value and after_value:
        anomaly.resolution_detail["before_value"] = before_value
        anomaly.resolution_detail["after_value"] = after_value
    
    storage.save_anomaly(anomaly)
    
    click.echo(colorize("✓ 异常已标记为已处理", "green"))


@cli.command()
@click.option("--month", "-m", help="月份 (格式: YYYY-MM)，不指定则清除所有月份")
@click.option("--type", "-t", "data_types", multiple=True, help="指定清除的数据类型，可多次指定")
@click.option("--force", is_flag=True, help="强制清除，跳过确认")
def clear(month: Optional[str], data_types: tuple, force: bool):
    """清除数据 - 用于幂等性测试（重复导入测试）"""
    config, storage = get_storage()
    
    if not force:
        confirm = click.prompt(
            f"确定要清除{month + ' ' if month else '所有'}数据吗？输入 yes 确认",
            default="no"
        )
        if confirm.lower() != "yes":
            click.echo("操作已取消")
            return
    
    data_types_list = list(data_types) if data_types else None
    
    if month:
        storage.clear_month_data(month, data_types_list)
        click.echo(colorize(f"✓ 已清除 {month} 的数据", "green"))
    else:
        for m in ["2024-01", "2024-02", "2024-03"]:
            storage.clear_month_data(m, data_types_list)
        click.echo(colorize("✓ 已清除所有月份的数据", "green"))


if __name__ == "__main__":
    cli()
