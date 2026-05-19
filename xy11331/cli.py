import json
import click
from database import init_db
from service import ClinicService


def _print_result(result):
    click.echo(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))


@click.group()
def cli():
    """门诊服务台陪检管理系统"""
    init_db()


@cli.command()
@click.option("--patient-id", required=True, help="患者ID")
@click.option("--name", required=True, help="患者姓名")
@click.option("--age", type=int, help="年龄")
@click.option("--gender", help="性别")
@click.option("--department", help="科室")
@click.option("--bed-number", help="床号")
def create_patient(patient_id, name, age, gender, department, bed_number):
    """创建患者信息"""
    service = ClinicService()
    result = service.create_patient(patient_id, name, age, gender, department, bed_number)
    service.close()
    _print_result(result)


@cli.command()
@click.option("--escort-id", required=True, help="陪检员ID")
@click.option("--name", required=True, help="陪检员姓名")
@click.option("--phone", help="联系电话")
@click.option("--max-tasks", type=int, default=3, help="最大任务数")
def create_escort(escort_id, name, phone, max_tasks):
    """创建陪检员信息"""
    service = ClinicService()
    result = service.create_escort(escort_id, name, phone, max_tasks)
    service.close()
    _print_result(result)


@cli.command()
@click.option("--task-id", required=True, help="任务ID")
@click.option("--patient-id", required=True, help="患者ID")
@click.option("--inspection-type", required=True, help="检查类型")
@click.option("--location", help="检查地点")
@click.option("--priority", default="normal", type=click.Choice(["emergency", "urgent", "normal", "low"]), help="优先级")
@click.option("--duration", type=int, default=30, help="预计时长(分钟)")
def create_task(task_id, patient_id, inspection_type, location, priority, duration):
    """创建检查任务"""
    service = ClinicService()
    result = service.create_task(task_id, patient_id, inspection_type, location, priority, duration)
    service.close()
    _print_result(result)


@cli.command()
@click.option("--task-id", required=True, help="任务ID")
@click.option("--escort-id", help="指定陪检员ID（不指定则自动分配）")
@click.option("--operator-id", help="操作员ID")
def assign_task(task_id, escort_id, operator_id):
    """派单给陪检员"""
    service = ClinicService()
    result = service.assign_task(task_id, escort_id, operator_id)
    service.close()
    _print_result(result)


@cli.command()
@click.option("--task-id", required=True, help="任务ID")
@click.option("--escort-id", required=True, help="陪检员ID")
def accept_task(task_id, escort_id):
    """陪检员接单"""
    service = ClinicService()
    result = service.accept_task(task_id, escort_id)
    service.close()
    _print_result(result)


@cli.command()
@click.option("--task-id", required=True, help="任务ID")
@click.option("--escort-id", required=True, help="陪检员ID")
def start_task(task_id, escort_id):
    """开始执行任务"""
    service = ClinicService()
    result = service.start_task(task_id, escort_id)
    service.close()
    _print_result(result)


@cli.command()
@click.option("--task-id", required=True, help="任务ID")
@click.option("--escort-id", required=True, help="陪检员ID")
@click.option("--actual-duration", type=int, help="实际时长(秒)")
def complete_task(task_id, escort_id, actual_duration):
    """完成任务"""
    service = ClinicService()
    result = service.complete_task(task_id, escort_id, actual_duration)
    service.close()
    _print_result(result)


@cli.command()
@click.option("--task-id", required=True, help="任务ID")
@click.option("--reason", required=True, help="取消原因")
@click.option("--operator-id", help="操作员ID")
def cancel_task(task_id, reason, operator_id):
    """取消任务"""
    service = ClinicService()
    result = service.cancel_task(task_id, reason, operator_id)
    service.close()
    _print_result(result)


@cli.command()
@click.option("--task-id", required=True, help="任务ID")
@click.option("--from-escort-id", required=True, help="原陪检员ID")
@click.option("--to-escort-id", required=True, help="目标陪检员ID")
@click.option("--reason", required=True, help="转派原因")
def transfer_task(task_id, from_escort_id, to_escort_id, reason):
    """转派任务"""
    service = ClinicService()
    result = service.transfer_task(task_id, from_escort_id, to_escort_id, reason)
    service.close()
    _print_result(result)


@cli.command()
@click.option("--task-id", required=True, help="任务ID")
def task_history(task_id):
    """查看任务历史记录"""
    service = ClinicService()
    result = service.get_task_history(task_id)
    service.close()
    _print_result(result)


@cli.command()
@click.option("--date", help="日期 (YYYY-MM-DD)，默认今日")
def daily_report(date):
    """查看每日统计报告"""
    service = ClinicService()
    result = service.get_daily_report(date)
    service.close()
    _print_result(result)


@cli.command()
@click.option("--status", help="按状态筛选")
@click.option("--priority", help="按优先级筛选")
def list_tasks(status, priority):
    """列出所有任务"""
    service = ClinicService()
    result = service.list_tasks(status, priority)
    service.close()
    _print_result(result)


@cli.command()
def demo():
    """运行完整演示流程"""
    service = ClinicService()

    click.echo("=" * 60)
    click.echo("门诊服务台陪检管理系统 - 演示流程")
    click.echo("=" * 60)

    click.echo("\n1. 创建患者...")
    service.create_patient("P001", "张三", 45, "男", "内科", "101")
    service.create_patient("P002", "李四", 32, "女", "外科", "203")
    click.echo("   ✓ 患者创建完成")

    click.echo("\n2. 创建陪检员...")
    service.create_escort("E001", "王师傅", "13800138001", 3)
    service.create_escort("E002", "李师傅", "13800138002", 3)
    click.echo("   ✓ 陪检员创建完成")

    click.echo("\n3. 创建检查任务（含急诊优先）...")
    service.create_task("T001", "P001", "CT检查", "影像科1楼", "normal", 30)
    service.create_task("T002", "P002", "MRI检查", "影像科2楼", "emergency", 45)
    click.echo("   ✓ 任务创建完成")

    click.echo("\n4. 自动派单（急诊优先）...")
    result1 = service.assign_task("T002")
    click.echo(f"   急诊任务 T002 派给: {result1.data.get('escort_name', 'N/A')}")

    result2 = service.assign_task("T001")
    click.echo(f"   普通任务 T001 派给: {result2.data.get('escort_name', 'N/A')}")

    click.echo("\n5. 陪检员接单...")
    service.accept_task("T002", "E001")
    service.accept_task("T001", "E002")
    click.echo("   ✓ 接单完成")

    click.echo("\n6. 任务转派演示...")
    transfer_result = service.transfer_task("T001", "E002", "E001", "E002临时有事")
    click.echo(f"   转派结果: {transfer_result.message}")

    click.echo("\n7. 完成任务...")
    service.start_task("T002", "E001")
    service.complete_task("T002", "E001", 1800)
    click.echo("   ✓ 任务 T002 已完成")

    click.echo("\n8. 取消任务演示（触发取消补位）...")
    cancel_result = service.cancel_task("T001", "患者临时取消检查", "OP001")
    click.echo(f"   取消结果: {cancel_result.message}")

    click.echo("\n9. 查看任务历史记录...")
    history_result = service.get_task_history("T001")
    click.echo(f"   任务 T001 状态: {history_result.data['current_status']}")
    click.echo(f"   历史记录数: {len(history_result.data['history'])}")

    click.echo("\n10. 生成今日统计报告...")
    report_result = service.get_daily_report()
    report = report_result.data
    click.echo(f"   日期: {report.get('date')}")
    click.echo(f"   总任务数: {report.get('total_tasks', 0)}")
    click.echo(f"   已完成: {report.get('completed_tasks', 0)}")
    click.echo(f"   已取消: {report.get('cancelled_tasks', 0)}")
    click.echo(f"   急诊任务: {report.get('emergency_tasks', 0)}")
    click.echo(f"   转派次数: {report.get('total_transfers', 0)}")

    click.echo("\n" + "=" * 60)
    click.echo("演示完成！数据已持久化到本地数据库。")
    click.echo("=" * 60)

    service.close()


if __name__ == "__main__":
    cli()
