import click
import json
import os
from datetime import datetime
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from .models import Course, Registration, RegistrationStatus
from .engine import WaitlistEngine

console = Console()


def load_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path: str, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def print_header(title: str):
    console.print(Panel(Text(title, style="bold cyan"), border_style="cyan"))


@click.group()
@click.version_option(version="1.0.0", prog_name="waitlist-cli")
def cli():
    """社区团课候补转正管理 CLI 工具"""
    pass


@cli.command()
@click.option("--output-dir", "-o", default="./data", help="输出目录", show_default=True)
def init(output_dir):
    """初始化样例数据"""
    print_header("初始化样例数据")

    courses = [
        {
            "id": "C001",
            "name": "流瑜伽入门班",
            "category": "瑜伽",
            "instructor": "王教练",
            "max_capacity": 3,
            "date": "2026-05-15",
            "time": "19:00-20:00",
            "location": "阳光社区活动室A"
        },
        {
            "id": "C002",
            "name": "爵士舞基础班",
            "category": "舞蹈",
            "instructor": "李教练",
            "max_capacity": 4,
            "date": "2026-05-16",
            "time": "18:30-19:30",
            "location": "阳光社区舞蹈室"
        },
        {
            "id": "C003",
            "name": "儿童体能启蒙班",
            "category": "儿童体能",
            "instructor": "张教练",
            "max_capacity": 5,
            "date": "2026-05-17",
            "time": "16:00-17:00",
            "location": "阳光社区体育馆"
        }
    ]

    registrations = [
        {"id": "R001", "course_id": "C001", "name": "张三", "phone": "13800000001", "member_level": "钻石会员", "registration_time": "2026-05-08T09:00:00", "status": "已确认"},
        {"id": "R002", "course_id": "C001", "name": "李四", "phone": "13800000002", "member_level": "金卡会员", "registration_time": "2026-05-08T09:05:00", "status": "已确认"},
        {"id": "R003", "course_id": "C001", "name": "王五", "phone": "13800000003", "member_level": "银卡会员", "registration_time": "2026-05-08T09:10:00", "status": "已确认"},
        {"id": "R004", "course_id": "C001", "name": "赵六", "phone": "13800000004", "member_level": "钻石会员", "registration_time": "2026-05-08T09:15:00", "status": "候补"},
        {"id": "R005", "course_id": "C001", "name": "钱七", "phone": "13800000005", "member_level": "普通会员", "registration_time": "2026-05-08T09:20:00", "status": "候补"},
        {"id": "R006", "course_id": "C001", "name": "孙八", "phone": "13800000004", "member_level": "金卡会员", "registration_time": "2026-05-08T09:25:00", "status": "候补"},
        {"id": "R007", "course_id": "C002", "name": "周九", "phone": "13800000007", "member_level": "钻石会员", "registration_time": "2026-05-08T10:00:00", "status": "已确认"},
        {"id": "R008", "course_id": "C002", "name": "吴十", "phone": "13800000008", "member_level": "银卡会员", "registration_time": "2026-05-08T10:05:00", "status": "已确认"},
        {"id": "R009", "course_id": "C002", "name": "郑十一", "phone": "13800000009", "member_level": "普通会员", "registration_time": "2026-05-08T10:10:00", "status": "已通知待确认", "is_notified": True},
        {"id": "R010", "course_id": "C003", "name": "王小明", "phone": "13800000010", "member_level": "金卡会员", "registration_time": "2026-05-08T11:00:00", "status": "已确认"},
        {"id": "R011", "course_id": "C003", "name": "李小华", "phone": "13800000011", "member_level": "钻石会员", "registration_time": "2026-05-08T11:05:00", "status": "候补"},
        {"id": "R012", "course_id": "C003", "name": "张小强", "phone": "13800000012", "member_level": "普通会员", "registration_time": "2026-05-08T11:10:00", "status": "候补"},
    ]

    withdrawals = ["R003", "R007"]

    os.makedirs(output_dir, exist_ok=True)
    save_json(os.path.join(output_dir, "courses.json"), courses)
    save_json(os.path.join(output_dir, "registrations.json"), registrations)
    save_json(os.path.join(output_dir, "withdrawals_sample.json"), withdrawals)

    console.print(f"[green]✓ 样例数据已创建到目录: {output_dir}[/green]")
    console.print()
    console.print("[yellow]创建的文件:[/yellow]")
    console.print(f"  • {output_dir}/courses.json - 课程数据")
    console.print(f"  • {output_dir}/registrations.json - 报名数据")
    console.print(f"  • {output_dir}/withdrawals_sample.json - 退课样例")
    console.print()
    console.print("[cyan]提示:[/cyan]")
    console.print("  数据包含3门课程（瑜伽、舞蹈、儿童体能），12条报名记录")
    console.print("  其中包含:")
    console.print("    • 已确认名额的用户")
    console.print("    • 不同会员等级的候补用户")
    console.print("    • 同一手机号重复报名的测试用例 (赵六和孙八)")
    console.print("    • 已通知但未确认的用户 (郑十一)")


@cli.command()
@click.option("--courses", "-c", required=True, help="课程数据文件路径 (JSON)")
@click.option("--registrations", "-r", required=True, help="报名数据文件路径 (JSON)")
@click.option("--output-dir", "-o", default="./data", help="输出目录", show_default=True)
@click.option("--batch-id", "-b", help="批次ID（可选，用于追踪）")
def import_data(courses, registrations, output_dir, batch_id):
    """导入课程和报名数据"""
    print_header("导入课程和报名数据")

    try:
        courses_data = load_json(courses)
        regs_data = load_json(registrations)
    except Exception as e:
        console.print(f"[red]✗ 读取文件失败: {e}[/red]")
        return

    engine = WaitlistEngine()
    engine.load_courses([Course.from_dict(c) for c in courses_data])
    engine.load_registrations([Registration.from_dict(r) for r in regs_data])

    console.print(f"[green]✓ 成功导入 {len(engine.courses)} 门课程[/green]")
    console.print(f"[green]✓ 成功导入 {len(engine.registrations)} 条报名记录[/green]")
    console.print()

    table = Table(title="课程概览")
    table.add_column("课程ID", style="cyan")
    table.add_column("课程名称", style="green")
    table.add_column("类型", style="yellow")
    table.add_column("容量", style="magenta")
    table.add_column("已确认", style="blue")
    table.add_column("候补", style="red")
    table.add_column("可用名额", style="bold green")

    for course_id, course in sorted(engine.courses.items()):
        confirmed = engine.get_confirmed_count(course_id)
        waitlist = len(engine.get_waitlist(course_id))
        available = engine.get_available_slots(course_id)
        table.add_row(
            course.id,
            course.name,
            course.category,
            str(course.max_capacity),
            str(confirmed),
            str(waitlist),
            str(available)
        )

    console.print(table)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    batch_suffix = f"_{batch_id}" if batch_id else ""
    snapshot_path = os.path.join(output_dir, f"snapshot_{timestamp}{batch_suffix}.json")
    snapshot = {
        "courses": [c.to_dict() for c in engine.courses.values()],
        "registrations": [r.to_dict() for r in engine.registrations],
        "imported_at": datetime.now().isoformat(),
        "batch_id": batch_id
    }
    save_json(snapshot_path, snapshot)
    console.print(f"[cyan]✓ 数据快照已保存: {snapshot_path}[/cyan]")


@cli.command()
@click.option("--withdrawals", "-w", required=True, help="退课ID列表文件 (JSON 数组)")
@click.option("--snapshot", "-s", required=True, help="数据快照文件路径")
@click.option("--output-dir", "-o", default="./results", help="输出目录", show_default=True)
@click.option("--batch-id", "-b", help="批次ID（可选，重复批次会防止重复转正）")
@click.option("--dry-run", is_flag=True, help="模拟运行，不保存结果")
def process(withdrawals, snapshot, output_dir, batch_id, dry_run):
    """处理退课并执行候补转正"""
    print_header("处理退课与候补转正")

    try:
        withdrawal_ids = load_json(withdrawals)
        snapshot_data = load_json(snapshot)
    except Exception as e:
        console.print(f"[red]✗ 读取文件失败: {e}[/red]")
        return

    engine = WaitlistEngine()
    engine.load_courses([Course.from_dict(c) for c in snapshot_data["courses"]])
    engine.load_registrations([Registration.from_dict(r) for r in snapshot_data["registrations"]])

    console.print(f"[cyan]加载的退课ID:[/cyan] {withdrawal_ids}")
    console.print()

    result = engine.process_withdrawals(withdrawal_ids, batch_id)

    console.print(Panel(f"[bold]处理批次:[/bold] {result.batch_id}", border_style="yellow"))
    console.print()

    if result.waitlist_changes:
        console.print("[bold green]候补变化记录:[/bold green]")
        change_table = Table(title="候补转正明细")
        change_table.add_column("课程", style="cyan")
        change_table.add_column("姓名", style="green")
        change_table.add_column("电话", style="yellow")
        change_table.add_column("会员等级", style="magenta")
        change_table.add_column("状态变化", style="blue")
        change_table.add_column("报名时间", style="white")

        for change in result.waitlist_changes:
            change_table.add_row(
                change["course_name"],
                change["name"],
                change["phone"],
                change["member_level"],
                f"{change['from_status']} → {change['to_status']}",
                change["registration_time"]
            )
        console.print(change_table)
    else:
        console.print("[yellow]无候补转正记录[/yellow]")

    console.print()

    if result.notification_queue:
        console.print("[bold cyan]通知模拟:[/bold cyan]")
        for i, n in enumerate(result.notification_queue, 1):
            msg = f"""[magenta]【短信发送模拟 - {n['phone']}】[/magenta]
  尊敬的{n['name']}（{n['member_level']}）：
  恭喜您！您候补的【{n['course_name']}】课程已有空位。
  课程信息：{n['course_date']} {n['course_time']} @ {n['course_location']}
  教练：{n['instructor']}
  请在1小时内确认，逾期将自动释放名额。"""
            console.print(Panel(msg, border_style="cyan", title=f"通知 {i}/{len(result.notification_queue)}"))
    else:
        console.print("[yellow]无待发送通知[/yellow]")

    console.print()

    if result.duplicates:
        console.print("[bold yellow]重复报名检测:[/bold yellow]")
        dup_table = Table(title="同一手机号重复报名")
        dup_table.add_column("报名ID", style="cyan")
        dup_table.add_column("姓名", style="green")
        dup_table.add_column("电话", style="yellow")
        dup_table.add_column("重复于", style="red")

        for d in result.duplicates:
            dup_table.add_row(d["registration_id"], d["name"], d["phone"], d["duplicate_name"])
        console.print(dup_table)
        console.print(f"[yellow]⚠ 共 {len(result.duplicates)} 个重复手机号，已跳过[/yellow]")
        console.print()

    if result.problems:
        console.print("[bold red]异常原因:[/bold red]")
        prob_table = Table(title="问题清单")
        prob_table.add_column("报名ID", style="cyan")
        prob_table.add_column("姓名", style="green")
        prob_table.add_column("异常原因", style="red")

        for p in result.problems:
            prob_table.add_row(
                p.get("registration_id", "-"),
                p.get("name", "-"),
                p["reason"]
            )
        console.print(prob_table)
        console.print(f"[red]⚠ 共 {len(result.problems)} 个问题记录[/red]")
        console.print()

    summary = Table(title="处理汇总")
    summary.add_column("项目", style="cyan")
    summary.add_column("数量", style="yellow", justify="right")
    summary.add_row("处理的退课数", str(len(withdrawal_ids)))
    summary.add_row("成功转正人数", str(len(result.promoted)))
    summary.add_row("跳过的重复报名", str(len(result.duplicates)))
    summary.add_row("问题记录数", str(len(result.problems)))
    summary.add_row("待发送通知", str(len(result.notification_queue)))
    console.print(summary)

    if not dry_run:
        files = engine.export_results(result, output_dir)
        console.print()
        console.print("[bold green]导出文件位置:[/bold green]")
        for name, path in files.items():
            console.print(f"  • {name}: [cyan]{path}[/cyan]")

        updated_snapshot = {
            "courses": [c.to_dict() for c in engine.courses.values()],
            "registrations": [r.to_dict() for r in engine.registrations],
            "processed_at": datetime.now().isoformat(),
            "batch_id": result.batch_id
        }
        updated_path = os.path.join(output_dir, f"snapshot_updated_{result.batch_id}.json")
        save_json(updated_path, updated_snapshot)
        console.print(f"  • updated_snapshot: [cyan]{updated_path}[/cyan]")
    else:
        console.print()
        console.print("[yellow]⚠ 模拟运行模式，未保存结果[/yellow]")


@cli.command()
@click.option("--snapshot", "-s", required=True, help="数据快照文件路径")
def status(snapshot):
    """查看当前课程和报名状态"""
    print_header("查看当前状态")

    try:
        snapshot_data = load_json(snapshot)
    except Exception as e:
        console.print(f"[red]✗ 读取文件失败: {e}[/red]")
        return

    engine = WaitlistEngine()
    engine.load_courses([Course.from_dict(c) for c in snapshot_data["courses"]])
    engine.load_registrations([Registration.from_dict(r) for r in snapshot_data["registrations"]])

    for course_id, course in sorted(engine.courses.items()):
        console.print()
        console.print(f"[bold cyan]━━━━━━ 课程: {course.name} ({course.id}) ━━━━━━[/bold cyan]")
        console.print(f"  类型: {course.category} | 教练: {course.instructor} | 容量: {course.max_capacity}")
        console.print(f"  时间: {course.date} {course.time} | 地点: {course.location}")
        console.print()

        confirmed = [r for r in engine.get_course_registrations(course_id) if r.status == RegistrationStatus.CONFIRMED]
        waitlist = engine.get_waitlist(course_id)

        if confirmed:
            conf_table = Table(title="已确认名单")
            conf_table.add_column("#", style="cyan")
            conf_table.add_column("姓名", style="green")
            conf_table.add_column("电话", style="yellow")
            conf_table.add_column("会员等级", style="magenta")
            conf_table.add_column("报名时间", style="white")
            for i, r in enumerate(sorted(confirmed, key=lambda x: x.registration_time), 1):
                conf_table.add_row(
                    str(i),
                    r.name,
                    r.phone,
                    r.member_level.value,
                    r.registration_time.strftime("%Y-%m-%d %H:%M")
                )
            console.print(conf_table)

        if waitlist:
            wait_table = Table(title="候补名单 (按优先级排序)")
            wait_table.add_column("优先级", style="cyan")
            wait_table.add_column("姓名", style="green")
            wait_table.add_column("电话", style="yellow")
            wait_table.add_column("会员等级", style="magenta")
            wait_table.add_column("状态", style="red")
            wait_table.add_column("报名时间", style="white")
            for i, r in enumerate(waitlist, 1):
                status_text = r.status.value
                if r.status == RegistrationStatus.NOTIFIED:
                    status_text = f"[bold red]{status_text}[/bold red]"
                wait_table.add_row(
                    str(i),
                    r.name,
                    r.phone,
                    r.member_level.value,
                    status_text,
                    r.registration_time.strftime("%Y-%m-%d %H:%M")
                )
            console.print(wait_table)

        if not confirmed and not waitlist:
            console.print("[yellow]  暂无报名记录[/yellow]")

        console.print()
        available = engine.get_available_slots(course_id)
        console.print(f"  [bold]当前可用名额:[/bold] {available} / {course.max_capacity}")


if __name__ == "__main__":
    cli()
