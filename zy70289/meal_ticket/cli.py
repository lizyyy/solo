import click
import json
import os
from rich.console import Console
from rich.table import Table
from rich import box

from .service import MealTicketService
from .models import ShiftType, MealType, PositionType

console = Console()
DATA_DIR = "./data"


def get_service():
    return MealTicketService(DATA_DIR)


def print_validation_result(record):
    status_colors = {
        "正常": "green",
        "重复核销": "red",
        "漏发": "yellow",
        "班次不符": "orange",
        "餐点不符": "magenta",
        "已过期": "red"
    }
    
    color = status_colors.get(record.validation_status.value, "white")
    
    table = Table(title="核销结果", box=box.SIMPLE)
    table.add_column("项目", style="cyan")
    table.add_column("内容")
    
    table.add_row("核销状态", f"[{color}]{record.validation_status.value}[/{color}]")
    table.add_row("餐券ID", record.ticket_id)
    table.add_row("志愿者", record.volunteer_name)
    table.add_row("岗位", record.position.value)
    table.add_row("班次", record.shift.value)
    table.add_row("餐点", record.meal_type.value)
    table.add_row("核销时间", record.validation_time)
    table.add_row("详情", record.details)
    
    console.print(table)


def print_report(report):
    console.print("\n[bold blue]===== 餐券核销报告 =====[/bold blue]\n")
    
    summary = report["summary"]
    table = Table(title="总体统计", box=box.SIMPLE)
    table.add_column("统计项", style="cyan")
    table.add_column("数值", justify="right")
    
    table.add_row("志愿者总数", str(summary["total_volunteers"]))
    table.add_row("餐券总数", str(summary["total_tickets"]))
    table.add_row("已使用", str(summary["used_tickets"]))
    table.add_row("未使用", str(summary["unused_tickets"]))
    table.add_row("核销记录数", str(summary["validation_count"]))
    
    console.print(table)
    
    if report["validation_status"]:
        status_table = Table(title="核销状态分布", box=box.SIMPLE)
        status_table.add_column("状态", style="cyan")
        status_table.add_column("数量", justify="right")
        for status, count in report["validation_status"].items():
            status_table.add_row(status, str(count))
        console.print(status_table)
    
    anomalies = report["anomalies_summary"]
    if any(anomalies.values()):
        console.print("\n[bold red]⚠️  异常情况检测[/bold red]")
        anom_table = Table(box=box.SIMPLE)
        anom_table.add_column("异常类型", style="red")
        anom_table.add_column("数量", justify="right")
        
        if anomalies["duplicate_count"] > 0:
            anom_table.add_row("重复核销", str(anomalies["duplicate_count"]))
        if anomalies["missing_count"] > 0:
            anom_table.add_row("漏发餐券", str(anomalies["missing_count"]))
        if anomalies["invalid_shift_count"] > 0:
            anom_table.add_row("班次不符", str(anomalies["invalid_shift_count"]))
        if anomalies["invalid_meal_count"] > 0:
            anom_table.add_row("餐点不符", str(anomalies["invalid_meal_count"]))
        
        console.print(anom_table)


@click.group()
@click.version_option(version="0.1.0")
def main():
    """赛事志愿者餐券核销 CLI 工具
    
    用于管理赛事志愿者餐券的发放、核销和异常检测。
    """
    pass


@main.command()
@click.option("--force", "-f", is_flag=True, help="覆盖现有数据")
def init(force):
    """初始化样例数据
    
    创建志愿者名单、发放餐券并绑定班次。
    志愿者按岗位（签到组、安保组、引导组等）和班次（早班、中班、晚班、夜班）分配。
    每位志愿者发放午餐和晚餐两张餐券。
    """
    service = get_service()
    
    try:
        result = service.init_sample_data(force)
        console.print(f"[green]✓ 初始化完成[/green]")
        console.print(f"  志愿者: {result['volunteers']} 人")
        console.print(f"  餐券: {result['tickets']} 张")
        console.print(f"\n数据存储位置: {os.path.abspath(DATA_DIR)}")
    except ValueError as e:
        console.print(f"[red]✗ 错误: {e}[/red]")


@main.command()
@click.argument("file_path", type=click.Path(exists=True))
def import_volunteers(file_path):
    """从 JSON 文件导入志愿者名单
    
    文件格式示例:
    [
      {
        "id": "VOL0001",
        "name": "张三",
        "phone": "13800138000",
        "position": "签到组",
        "shift": "早班"
      }
    ]
    """
    service = get_service()
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not isinstance(data, list):
            raise ValueError("文件格式错误，应为数组")
        
        added, updated = service.import_volunteers(data)
        console.print(f"[green]✓ 导入完成[/green]")
        console.print(f"  新增: {added} 人")
        console.print(f"  更新: {updated} 人")
    except Exception as e:
        console.print(f"[red]✗ 导入失败: {e}[/red]")


@main.command()
@click.argument("ticket_id")
@click.option("--shift", "-s", type=click.Choice(["早班", "中班", "晚班", "夜班"]), help="当前班次")
@click.option("--meal", "-m", type=click.Choice(["早餐", "午餐", "晚餐", "夜宵"]), help="当前餐点")
def validate(ticket_id, shift, meal):
    """核销餐券
    
    根据餐券ID进行核销，系统会自动检测：
    - 重复核销（同一餐券多次核销）
    - 班次不符（当前班次与餐券班次不一致）
    - 餐点不符（当前餐点与餐券餐点不一致）
    - 漏发（餐券不存在）
    """
    service = get_service()
    
    current_shift = ShiftType(shift) if shift else None
    current_meal = MealType(meal) if meal else None
    
    record = service.validate_ticket(ticket_id, current_shift=current_shift, current_meal=current_meal)
    print_validation_result(record)


@main.command()
@click.option("--limit", "-n", type=int, help="显示最近N条记录")
def history(limit):
    """查看核销历史记录"""
    service = get_service()
    records = service.get_validation_history(limit)
    
    if not records:
        console.print("[yellow]暂无核销记录[/yellow]")
        return
    
    table = Table(title="核销历史", box=box.SIMPLE)
    table.add_column("时间", style="cyan")
    table.add_column("餐券ID", style="magenta")
    table.add_column("志愿者")
    table.add_column("岗位")
    table.add_column("班次")
    table.add_column("餐点")
    table.add_column("状态")
    
    for record in records:
        status_color = "green" if record.validation_status.value == "正常" else "red"
        table.add_row(
            record.validation_time[:19],
            record.ticket_id,
            record.volunteer_name,
            record.position.value,
            record.shift.value,
            record.meal_type.value,
            f"[{status_color}]{record.validation_status.value}[/{status_color}]"
        )
    
    console.print(table)


@main.command()
def check():
    """执行异常检查
    
    检测以下异常情况：
    - 重复核销记录
    - 漏发餐券（按班次应发未发）
    - 班次不符
    - 餐点不符
    """
    service = get_service()
    report = service.generate_report()
    print_report(report)
    
    anomalies = report["details"]
    
    if anomalies["duplicates"]:
        console.print("\n[bold red]----- 重复核销详情 -----[/bold red]")
        for record in anomalies["duplicates"]:
            console.print(f"  {record.volunteer_name} ({record.ticket_id}): {record.details}")
    
    if anomalies["missing_tickets"]:
        console.print("\n[bold yellow]----- 漏发餐券详情 -----[/bold yellow]")
        for item in anomalies["missing_tickets"]:
            volunteer = item["volunteer"]
            missing = ", ".join([m.value for m in item["missing_meals"]])
            console.print(f"  {volunteer.name} ({volunteer.id}, {volunteer.shift.value}): 缺少 {missing}")


@main.command()
@click.argument("output_path", type=click.Path())
@click.option("--format", "-f", default="json", type=click.Choice(["json"]), help="导出格式")
def export(output_path, format):
    """导出数据到文件"""
    service = get_service()
    
    try:
        data = service.export_data(format)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        console.print(f"[green]✓ 数据已导出到: {output_path}[/green]")
    except Exception as e:
        console.print(f"[red]✗ 导出失败: {e}[/red]")


@main.command()
@click.argument("volunteer_id")
def issue(volunteer_id):
    """为志愿者补发餐券
    
    按照志愿者的班次自动发放对应的餐券：
    - 早班: 午餐
    - 中班: 午餐、晚餐
    - 晚班: 晚餐、夜宵
    - 夜班: 夜宵
    """
    service = get_service()
    
    try:
        volunteer = next((v for v in service.db.volunteers if v.id == volunteer_id), None)
        if not volunteer:
            console.print(f"[red]✗ 志愿者不存在: {volunteer_id}[/red]")
            return
        
        meal_map = {
            ShiftType.MORNING: [MealType.LUNCH],
            ShiftType.AFTERNOON: [MealType.LUNCH, MealType.DINNER],
            ShiftType.EVENING: [MealType.DINNER, MealType.MIDNIGHT_SNACK],
            ShiftType.NIGHT: [MealType.MIDNIGHT_SNACK]
        }
        
        expected_meals = meal_map[volunteer.shift]
        new_tickets = service.issue_tickets_for_volunteer(volunteer_id, expected_meals)
        
        if new_tickets:
            console.print(f"[green]✓ 已为 {volunteer.name} 补发 {len(new_tickets)} 张餐券:[/green]")
            for ticket in new_tickets:
                console.print(f"  {ticket.id} ({ticket.meal_type.value})")
        else:
            console.print(f"[yellow]该志愿者的餐券已全部发放[/yellow]")
    except Exception as e:
        console.print(f"[red]✗ 补发失败: {e}[/red]")


if __name__ == "__main__":
    main()
