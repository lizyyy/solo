import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box
from datetime import datetime, timedelta
from typing import Optional

from .models import (
    RoundType, TimeSlot, InterviewStatus, generate_id
)
from .scheduler import Scheduler
from .store import (
    load_state, save_state, state_exists, create_sample_data, get_data_dir, get_state_path
)

console = Console()


def require_initialized():
    if not state_exists():
        console.print(Panel("[bold red]错误: 工作目录未初始化，请先运行 init 命令", border_style="red"))
        raise click.Abort()


def get_status_color(status: InterviewStatus) -> str:
    color_map = {
        InterviewStatus.PENDING: "yellow",
        InterviewStatus.SCHEDULED: "blue",
        InterviewStatus.CONFIRMED: "green",
        InterviewStatus.RESCHEDULED: "magenta",
        InterviewStatus.CANDIDATE_NO_SHOW: "red",
        InterviewStatus.INTERVIEWER_NO_SHOW: "orange",
        InterviewStatus.CANCELLED: "strikethrough",
        InterviewStatus.COMPLETED: "cyan",
    }
    return color_map.get(status, "white")


def get_status_text(status: InterviewStatus) -> str:
    text_map = {
        InterviewStatus.PENDING: "待安排",
        InterviewStatus.SCHEDULED: "已安排",
        InterviewStatus.CONFIRMED: "已确认",
        InterviewStatus.RESCHEDULED: "已改期",
        InterviewStatus.CANDIDATE_NO_SHOW: "候选人爽约",
        InterviewStatus.INTERVIEWER_NO_SHOW: "面试官爽约",
        InterviewStatus.CANCELLED: "已取消",
        InterviewStatus.COMPLETED: "已完成",
    }
    return text_map.get(status, status.value)


def get_round_text(round_type: RoundType) -> str:
    text_map = {
        RoundType.FIRST: "初试",
        RoundType.SECOND: "复试",
        RoundType.FINAL: "终面",
    }
    return text_map.get(round_type, round_type.value)


@click.group()
@click.version_option(package_name="interview-scheduler")
def main():
    pass


@main.command()
@click.option("--sample/--no-sample", default=True, help="是否加载样例数据")
@click.option("--force", is_flag=True, help="强制重新初始化（覆盖现有数据）")
@click.option("--data-dir", default=None, help="指定数据目录路径")
def init(sample, force, data_dir):
    """初始化排班系统工作目录"""
    console.print(Panel("[bold blue]面试排班系统 - 初始化", border_style="blue"))
    
    if state_exists(data_dir) and not force:
        console.print("[yellow]工作目录已存在，使用 --force 参数覆盖[/yellow]")
        console.print(f"[dim]数据目录: {get_data_dir(data_dir)}[/dim]")
        return
    
    if sample:
        console.print("[green]正在创建样例数据...[/green]")
        state = create_sample_data()
        console.print(f"  [green]+ {len(state.candidates)} 位候选人[/green]")
        console.print(f"  [green]+ {len(state.interviewers)} 位面试官[/green]")
        console.print(f"  [green]+ {len(state.rooms)} 个会议室[/green]")
        console.print(f"  [green]+ {len(state.round_rules)} 条轮次规则[/green]")
        console.print(f"  [green]+ {len(state.interviews)} 个面试安排[/green]")
    else:
        console.print("[green]正在创建空工作目录...[/green]")
        state = load_state(data_dir)
    
    save_state(state, data_dir)
    console.print(f"\n[bold green]初始化成功![/bold green]")
    console.print(f"[dim]数据存储位置: {get_state_path(get_data_dir(data_dir))}[/dim]")


@main.command("list")
@click.option("--status", "-s", type=click.Choice(['all', 'confirmed', 'pending', 'scheduled', 'rescheduled', 'no_show']), default='all', help="筛选状态")
@click.option("--candidate", "-c", default=None, help="按候选人ID筛选")
@click.option("--round", "-r", type=click.Choice(['first', 'second', 'final']), default=None, help="按轮次筛选")
def list_interviews(status, candidate, round):
    """列出所有面试安排"""
    require_initialized()
    
    state = load_state()
    scheduler = Scheduler(state)
    
    interviews = list(state.interviews.values())
    
    if status != 'all':
        status_map = {
            'confirmed': InterviewStatus.CONFIRMED,
            'pending': InterviewStatus.PENDING,
            'scheduled': InterviewStatus.SCHEDULED,
            'rescheduled': InterviewStatus.RESCHEDULED,
            'no_show': [InterviewStatus.CANDIDATE_NO_SHOW, InterviewStatus.INTERVIEWER_NO_SHOW],
        }
        target_status = status_map[status]
        if isinstance(target_status, list):
            interviews = [i for i in interviews if i.status in target_status]
        else:
            interviews = [i for i in interviews if i.status == target_status]
    
    if candidate:
        interviews = [i for i in interviews if i.candidate_id == candidate]
    
    if round:
        round_map = {'first': RoundType.FIRST, 'second': RoundType.SECOND, 'final': RoundType.FINAL}
        target_round = round_map[round]
        interviews = [i for i in interviews if i.round_type == target_round]
    
    interviews.sort(key=lambda x: (x.slot.start if x.slot else datetime.max, x.round_type.value))
    
    table = Table(title="面试安排列表", box=box.ROUNDED, show_lines=True)
    table.add_column("ID", style="cyan", no_wrap=True)
    table.add_column("候选人", style="green")
    table.add_column("岗位", style="yellow")
    table.add_column("轮次", style="magenta")
    table.add_column("时间", style="blue")
    table.add_column("面试官", style="dim")
    table.add_column("会议室", style="dim")
    table.add_column("状态", style="bold")
    
    for interview in interviews:
        cand = state.candidates.get(interview.candidate_id)
        cand_name = cand.name if cand else interview.candidate_id
        cand_pos = cand.position if cand else ""
        
        intv_names = []
        for intv_id in interview.interviewer_ids:
            intv = state.interviewers.get(intv_id)
            intv_names.append(intv.name if intv else intv_id)
        
        room = state.rooms.get(interview.room_id)
        room_name = room.name if room else interview.room_id or "未分配"
        
        slot_str = str(interview.slot) if interview.slot else "未安排"
        
        status_color = get_status_color(interview.status)
        status_text = get_status_text(interview.status)
        
        table.add_row(
            interview.id,
            cand_name,
            cand_pos,
            get_round_text(interview.round_type),
            slot_str,
            ", ".join(intv_names),
            room_name,
            f"[{status_color}]{status_text}[/{status_color}]"
        )
    
    console.print(table)
    console.print(f"\n[dim]共 {len(interviews)} 条记录[/dim]")


@main.command()
@click.argument("interview_id")
def detail(interview_id):
    """查看面试详情和历史记录"""
    require_initialized()
    
    state = load_state()
    interview = state.interviews.get(interview_id)
    
    if not interview:
        console.print(Panel(f"[bold red]错误: 面试 {interview_id} 不存在", border_style="red"))
        raise click.Abort()
    
    cand = state.candidates.get(interview.candidate_id)
    cand_name = cand.name if cand else interview.candidate_id
    
    table = Table(title=f"面试详情 - {interview_id}", box=box.ROUNDED, show_lines=True)
    table.add_column("项目", style="cyan", width=15)
    table.add_column("内容", style="white")
    
    table.add_row("面试ID", interview.id)
    table.add_row("候选人", f"{cand_name} ({interview.candidate_id})")
    table.add_row("岗位", cand.position if cand else "")
    table.add_row("轮次", get_round_text(interview.round_type))
    
    slot_str = str(interview.slot) if interview.slot else "未安排"
    table.add_row("时间", slot_str)
    
    intv_names = []
    for intv_id in interview.interviewer_ids:
        intv = state.interviewers.get(intv_id)
        name = intv.name if intv else intv_id
        intv_names.append(f"- {name} ({intv_id})")
    table.add_row("面试官", "\n".join(intv_names) if intv_names else "未分配")
    
    room = state.rooms.get(interview.room_id)
    room_info = f"{room.name} ({room.building} {room.room_number})" if room else interview.room_id or "未分配"
    table.add_row("会议室", room_info)
    
    status_color = get_status_color(interview.status)
    status_text = get_status_text(interview.status)
    table.add_row("状态", f"[{status_color}]{status_text}[/{status_color}]")
    table.add_row("改期次数", str(interview.reschedule_count))
    table.add_row("操作者", interview.operator or "未记录")
    table.add_row("创建时间", interview.created_at.strftime('%Y-%m-%d %H:%M:%S'))
    table.add_row("更新时间", interview.updated_at.strftime('%Y-%m-%d %H:%M:%S'))
    table.add_row("备注", interview.notes or "无")
    
    console.print(table)
    
    if interview.reschedule_history:
        hist_table = Table(title="改期/状态变更历史", box=box.ROUNDED, show_lines=True)
        hist_table.add_column("#", style="cyan", width=3)
        hist_table.add_column("原时间", style="yellow")
        hist_table.add_column("新时间", style="green")
        hist_table.add_column("原因", style="white")
        hist_table.add_column("申请人", style="dim")
        hist_table.add_column("状态", style="bold")
        
        for idx, record in enumerate(interview.reschedule_history, 1):
            orig_slot = str(record.original_slot) if record.original_slot else "无"
            new_slot = str(record.new_slot) if record.new_slot else "无"
            resolved = "[green]已处理[/green]" if record.is_resolved else "[red]未处理[/red]"
            
            hist_table.add_row(
                str(idx),
                orig_slot,
                new_slot,
                record.reason,
                record.requested_by,
                resolved
            )
        
        console.print(hist_table)


@main.command()
@click.argument("candidate_id")
@click.argument("round_type", type=click.Choice(['first', 'second', 'final']))
@click.option("--time", "-t", help="指定开始时间 (格式: YYYY-MM-DD HH:MM)")
@click.option("--duration", type=int, default=None, help="指定时长（分钟）")
@click.option("--interviewer", "-i", multiple=True, help="指定面试官ID（可多次指定）")
@click.option("--room", "-r", default=None, help="指定会议室ID")
@click.option("--operator", "-o", default="hr_cli", help="操作者标识")
def schedule(candidate_id, round_type, time, duration, interviewer, room, operator):
    """安排新面试"""
    require_initialized()
    
    state = load_state()
    scheduler = Scheduler(state)
    
    if candidate_id not in state.candidates:
        console.print(Panel(f"[bold red]错误: 候选人 {candidate_id} 不存在", border_style="red"))
        console.print("[dim]可用候选人:[/dim]")
        for cid, cand in state.candidates.items():
            console.print(f"  {cid}: {cand.name} - {cand.position}")
        raise click.Abort()
    
    round_enum = RoundType(round_type)
    
    preferred_slot = None
    if time:
        try:
            start = datetime.strptime(time, "%Y-%m-%d %H:%M")
            if not duration:
                cand = state.candidates[candidate_id]
                position_type = scheduler._get_position_type(cand.position)
                rule = scheduler.get_round_rule(position_type, round_enum)
                duration = rule.duration_minutes if rule else 45
            end = start + timedelta(minutes=duration)
            preferred_slot = TimeSlot(start=start, end=end)
        except ValueError:
            console.print(Panel("[bold red]错误: 时间格式不正确，请使用 YYYY-MM-DD HH:MM 格式", border_style="red"))
            raise click.Abort()
    
    preferred_intvs = list(interviewer) if interviewer else None
    
    if preferred_intvs:
        for intv_id in preferred_intvs:
            if intv_id not in state.interviewers:
                console.print(Panel(f"[bold red]错误: 面试官 {intv_id} 不存在", border_style="red"))
                raise click.Abort()
    
    if room and room not in state.rooms:
        console.print(Panel(f"[bold red]错误: 会议室 {room} 不存在", border_style="red"))
        raise click.Abort()
    
    console.print(f"[blue]正在安排面试...[/blue]")
    console.print(f"  候选人: {state.candidates[candidate_id].name}")
    console.print(f"  轮次: {get_round_text(round_enum)}")
    if preferred_slot:
        console.print(f"  指定时间: {preferred_slot}")
    if preferred_intvs:
        intv_names = [state.interviewers[i].name for i in preferred_intvs]
        console.print(f"  指定面试官: {', '.join(intv_names)}")
    if room:
        console.print(f"  指定会议室: {state.rooms[room].name}")
    
    result = scheduler.schedule_interview(
        candidate_id=candidate_id,
        round_type=round_enum,
        operator=operator,
        preferred_slot=preferred_slot,
        preferred_interviewers=preferred_intvs,
        preferred_room=room
    )
    
    if result.success:
        save_state(state)
        console.print(f"\n[bold green]安排成功![/bold green]")
        console.print(f"  面试ID: {result.interview_id}")
        console.print(f"  时间: {result.assigned_slot}")
        
        intv_names = [state.interviewers[i].name for i in result.assigned_interviewers]
        console.print(f"  面试官: {', '.join(intv_names)}")
        
        room_name = state.rooms[result.assigned_room].name if result.assigned_room in state.rooms else result.assigned_room
        console.print(f"  会议室: {room_name}")
    else:
        console.print(f"\n[bold red]安排失败[/bold red]")
        console.print(f"[yellow]原因: {result.message}[/yellow]")
        
        if result.conflicts:
            conflict_table = Table(title="冲突详情", box=box.ROUNDED)
            conflict_table.add_column("类型", style="cyan")
            conflict_table.add_column("描述", style="white")
            for conflict in result.conflicts:
                conflict_table.add_row(conflict.conflict_type, conflict.description)
            console.print(conflict_table)


@main.command()
@click.argument("interview_id")
@click.option("--reason", "-r", required=True, help="改期原因")
@click.option("--requested-by", default="hr_cli", help="申请人")
@click.option("--time", "-t", help="新的开始时间 (格式: YYYY-MM-DD HH:MM)")
@click.option("--duration", type=int, default=None, help="指定时长（分钟）")
@click.option("--interviewer", "-i", multiple=True, help="新的面试官ID（可多次指定）")
@click.option("--room", default=None, help="新的会议室ID")
@click.option("--operator", "-o", default="hr_cli", help="操作者标识")
def reschedule(interview_id, reason, requested_by, time, duration, interviewer, room, operator):
    """改期面试"""
    require_initialized()
    
    state = load_state()
    scheduler = Scheduler(state)
    
    if interview_id not in state.interviews:
        console.print(Panel(f"[bold red]错误: 面试 {interview_id} 不存在", border_style="red"))
        raise click.Abort()
    
    interview = state.interviews[interview_id]
    original_slot_str = str(interview.slot) if interview.slot else "未安排"
    
    console.print(f"[blue]正在改期面试 {interview_id}...[/blue]")
    console.print(f"  原时间: {original_slot_str}")
    console.print(f"  改期原因: {reason}")
    
    new_slot = None
    if time:
        try:
            start = datetime.strptime(time, "%Y-%m-%d %H:%M")
            if not duration:
                cand = state.candidates.get(interview.candidate_id)
                if cand:
                    position_type = scheduler._get_position_type(cand.position)
                    rule = scheduler.get_round_rule(position_type, interview.round_type)
                    duration = rule.duration_minutes if rule else 45
                else:
                    duration = 45
            end = start + timedelta(minutes=duration)
            new_slot = TimeSlot(start=start, end=end)
            console.print(f"  新时间: {new_slot}")
        except ValueError:
            console.print(Panel("[bold red]错误: 时间格式不正确，请使用 YYYY-MM-DD HH:MM 格式", border_style="red"))
            raise click.Abort()
    
    new_intvs = list(interviewer) if interviewer else None
    if new_intvs:
        for intv_id in new_intvs:
            if intv_id not in state.interviewers:
                console.print(Panel(f"[bold red]错误: 面试官 {intv_id} 不存在", border_style="red"))
                raise click.Abort()
    
    if room and room not in state.rooms:
        console.print(Panel(f"[bold red]错误: 会议室 {room} 不存在", border_style="red"))
        raise click.Abort()
    
    result = scheduler.reschedule_interview(
        interview_id=interview_id,
        reason=reason,
        requested_by=requested_by,
        new_slot=new_slot,
        new_interviewers=new_intvs,
        new_room=room,
        operator=operator
    )
    
    if result.success:
        save_state(state)
        console.print(f"\n[bold green]改期成功![/bold green]")
        console.print(f"  新时间: {result.assigned_slot}")
        
        intv_names = [state.interviewers[i].name for i in result.assigned_interviewers]
        console.print(f"  面试官: {', '.join(intv_names)}")
        
        room_name = state.rooms[result.assigned_room].name if result.assigned_room in state.rooms else result.assigned_room
        console.print(f"  会议室: {room_name}")
        console.print(f"  累计改期次数: {interview.reschedule_count}")
    else:
        console.print(f"\n[bold red]改期失败[/bold red]")
        console.print(f"[yellow]原因: {result.message}[/yellow]")
        
        if result.conflicts:
            conflict_table = Table(title="冲突详情", box=box.ROUNDED)
            conflict_table.add_column("类型", style="cyan")
            conflict_table.add_column("描述", style="white")
            for conflict in result.conflicts:
                conflict_table.add_row(conflict.conflict_type, conflict.description)
            console.print(conflict_table)


@main.command("confirm")
@click.argument("interview_id")
@click.option("--operator", "-o", default="hr_cli", help="操作者标识")
def confirm_interview(interview_id, operator):
    """确认面试"""
    require_initialized()
    
    state = load_state()
    scheduler = Scheduler(state)
    
    result = scheduler.confirm_interview(interview_id, operator)
    
    if result.success:
        save_state(state)
        console.print(f"[bold green]{result.message}[/bold green]")
    else:
        console.print(f"[bold red]确认失败[/bold red]")
        console.print(f"[yellow]原因: {result.message}[/yellow]")


@main.command("mark-no-show")
@click.argument("interview_id")
@click.option("--who", type=click.Choice(['candidate', 'interviewer']), default='candidate', help="谁爽约")
@click.option("--reason", "-r", required=True, help="爽约原因")
@click.option("--operator", "-o", default="hr_cli", help="操作者标识")
def mark_no_show(interview_id, who, reason, operator):
    """标记爽约"""
    require_initialized()
    
    state = load_state()
    scheduler = Scheduler(state)
    
    is_candidate = (who == 'candidate')
    result = scheduler.mark_no_show(interview_id, is_candidate, reason, operator)
    
    if result.success:
        save_state(state)
        console.print(f"[bold green]{result.message}[/bold green]")
        console.print(f"[dim]爽约记录已添加到该面试的历史中[/dim]")
        console.print(f"[dim]可以使用 reschedule 命令重新安排面试[/dim]")
    else:
        console.print(f"[bold red]操作失败[/bold red]")
        console.print(f"[yellow]原因: {result.message}[/yellow]")


@main.command("check")
def check():
    """检查冲突和状态"""
    require_initialized()
    
    state = load_state()
    scheduler = Scheduler(state)
    
    console.print(Panel("[bold blue]状态检查", border_style="blue"))
    
    total = len(state.interviews)
    confirmed = len([i for i in state.interviews.values() if i.status == InterviewStatus.CONFIRMED])
    scheduled = len([i for i in state.interviews.values() if i.status == InterviewStatus.SCHEDULED])
    rescheduled = len([i for i in state.interviews.values() if i.status == InterviewStatus.RESCHEDULED])
    pending = len([i for i in state.interviews.values() if i.status == InterviewStatus.PENDING])
    no_show = len([i for i in state.interviews.values() if i.status in [InterviewStatus.CANDIDATE_NO_SHOW, InterviewStatus.INTERVIEWER_NO_SHOW]])
    completed = len([i for i in state.interviews.values() if i.status == InterviewStatus.COMPLETED])
    
    stat_table = Table(box=box.ROUNDED)
    stat_table.add_column("状态", style="cyan")
    stat_table.add_column("数量", style="bold", justify="right")
    stat_table.add_column("说明", style="dim")
    
    stat_table.add_row("总数", str(total), "所有面试")
    stat_table.add_row("[green]已确认[/green]", str(confirmed), "双方已确认")
    stat_table.add_row("[blue]已安排[/blue]", str(scheduled), "待确认")
    stat_table.add_row("[magenta]已改期[/magenta]", str(rescheduled), "改过时间")
    stat_table.add_row("[yellow]待安排[/yellow]", str(pending), "未分配时间")
    stat_table.add_row("[red]爽约[/red]", str(no_show), "需重新安排")
    stat_table.add_row("[cyan]已完成[/cyan]", str(completed), "面试结束")
    
    console.print(stat_table)
    
    reminders = scheduler.get_reminders()
    if reminders:
        console.print(f"\n[bold yellow]提醒事项 ({len(reminders)} 条):[/bold yellow]")
        rem_table = Table(box=box.ROUNDED)
        rem_table.add_column("优先级", style="bold", width=6)
        rem_table.add_column("类型", style="cyan")
        rem_table.add_column("描述", style="white")
        
        for rem in reminders:
            urgency_color = "red" if rem["urgency"] == "high" else "yellow"
            urgency_text = "高" if rem["urgency"] == "high" else "中"
            rem_table.add_row(
                f"[{urgency_color}]{urgency_text}[/{urgency_color}]",
                rem["type"],
                rem["message"]
            )
        
        console.print(rem_table)
    else:
        console.print(f"\n[green]无需要关注的提醒事项[/green]")


@main.command("report")
@click.option("--output", "-o", type=click.Choice(['table', 'json']), default='table', help="输出格式")
@click.option("--filter", "-f", type=click.Choice(['all', 'confirmed', 'pending', 'rescheduled', 'no_show', 'today']), default='all', help="筛选范围")
def report(output, filter):
    """生成排班报告"""
    require_initialized()
    
    state = load_state()
    scheduler = Scheduler(state)
    
    interviews = list(state.interviews.values())
    
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)
    
    if filter == 'today':
        interviews = [i for i in interviews if i.slot and today <= i.slot.start < tomorrow]
    elif filter == 'confirmed':
        interviews = [i for i in interviews if i.status == InterviewStatus.CONFIRMED]
    elif filter == 'pending':
        interviews = [i for i in interviews if i.status in [InterviewStatus.PENDING, InterviewStatus.SCHEDULED]]
    elif filter == 'rescheduled':
        interviews = [i for i in interviews if i.reschedule_count > 0]
    elif filter == 'no_show':
        interviews = [i for i in interviews if i.status in [InterviewStatus.CANDIDATE_NO_SHOW, InterviewStatus.INTERVIEWER_NO_SHOW]]
    
    interviews.sort(key=lambda x: (x.slot.start if x.slot else datetime.max, x.candidate_id))
    
    if output == 'json':
        import json
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "filter": filter,
            "total": len(interviews),
            "interviews": []
        }
        
        for interview in interviews:
            cand = state.candidates.get(interview.candidate_id)
            intv_names = [state.interviewers.get(i, {}).__dict__.get('name', i) for i in interview.interviewer_ids]
            room = state.rooms.get(interview.room_id)
            
            report_data["interviews"].append({
                "id": interview.id,
                "candidate": cand.name if cand else interview.candidate_id,
                "position": cand.position if cand else "",
                "round": get_round_text(interview.round_type),
                "time": str(interview.slot) if interview.slot else None,
                "interviewers": intv_names,
                "room": room.name if room else interview.room_id,
                "status": get_status_text(interview.status),
                "reschedule_count": interview.reschedule_count,
                "notes": interview.notes
            })
        
        console.print(json.dumps(report_data, ensure_ascii=False, indent=2))
    else:
        filter_text = {
            'all': '全部',
            'confirmed': '已确认',
            'pending': '待确认',
            'rescheduled': '已改期',
            'no_show': '爽约',
            'today': '今日'
        }[filter]
        
        table = Table(title=f"排班报告 - {filter_text} ({len(interviews)} 条)", box=box.ROUNDED, show_lines=True)
        table.add_column("候选人", style="green")
        table.add_column("岗位", style="yellow", width=14)
        table.add_column("轮次", style="magenta")
        table.add_column("时间", style="blue")
        table.add_column("面试官", style="dim")
        table.add_column("会议室", style="dim")
        table.add_column("状态", style="bold")
        table.add_column("改期", style="cyan", justify="center")
        
        for interview in interviews:
            cand = state.candidates.get(interview.candidate_id)
            cand_name = cand.name if cand else interview.candidate_id
            cand_pos = cand.position if cand else ""
            
            intv_names = []
            for intv_id in interview.interviewer_ids:
                intv = state.interviewers.get(intv_id)
                intv_names.append(intv.name if intv else intv_id)
            
            room = state.rooms.get(interview.room_id)
            room_name = room.name if room else interview.room_id or "-"
            
            slot_str = str(interview.slot) if interview.slot else "-"
            
            status_color = get_status_color(interview.status)
            status_text = get_status_text(interview.status)
            
            reschedule_text = str(interview.reschedule_count) if interview.reschedule_count > 0 else "-"
            
            table.add_row(
                cand_name,
                cand_pos,
                get_round_text(interview.round_type),
                slot_str,
                ", ".join(intv_names) if intv_names else "-",
                room_name,
                f"[{status_color}]{status_text}[/{status_color}]",
                reschedule_text
            )
        
        console.print(table)
        
        total_all = len(state.interviews)
        confirmed_all = len([i for i in state.interviews.values() if i.status == InterviewStatus.CONFIRMED])
        scheduled_all = len([i for i in state.interviews.values() if i.status == InterviewStatus.SCHEDULED])
        rescheduled_all = len([i for i in state.interviews.values() if i.status == InterviewStatus.RESCHEDULED])
        no_show_all = len([i for i in state.interviews.values() if i.status in [InterviewStatus.CANDIDATE_NO_SHOW, InterviewStatus.INTERVIEWER_NO_SHOW]])
        
        summary = Table(box=box.ROUNDED, show_lines=False)
        summary.add_column("统计项", style="cyan")
        summary.add_column("数值", style="bold", justify="right")
        
        summary.add_row("候选人总数", str(len(state.candidates)))
        summary.add_row("面试官总数", str(len(state.interviewers)))
        summary.add_row("会议室总数", str(len(state.rooms)))
        summary.add_row("面试安排数", str(total_all))
        summary.add_row("已确认", str(confirmed_all))
        summary.add_row("待确认", str(scheduled_all + rescheduled_all))
        summary.add_row("爽约待重排", str(no_show_all))
        
        console.print(summary)


@main.group()
def import_cmd():
    """导入数据"""
    pass


@import_cmd.command("candidates")
@click.argument("file_path", type=click.Path(exists=True))
def import_candidates(file_path):
    """导入候选人数据（JSON格式）"""
    require_initialized()
    
    import json
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    state = load_state()
    count = 0
    
    for item in data:
        cand_id = item.get('id') or generate_id("cand")
        if cand_id in state.candidates:
            console.print(f"[yellow]跳过已存在的候选人: {cand_id}[/yellow]")
            continue
        
        from .models import Candidate
        state.candidates[cand_id] = Candidate(
            id=cand_id,
            name=item['name'],
            position=item['position'],
            email=item['email'],
            phone=item['phone'],
            department=item.get('department', 'general'),
            status=item.get('status', 'active'),
            notes=item.get('notes', '')
        )
        count += 1
    
    save_state(state)
    console.print(f"[bold green]成功导入 {count} 位候选人[/bold green]")


@import_cmd.command("interviewers")
@click.argument("file_path", type=click.Path(exists=True))
def import_interviewers(file_path):
    """导入面试官数据（JSON格式）"""
    require_initialized()
    
    import json
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    state = load_state()
    count = 0
    
    for item in data:
        intv_id = item.get('id') or generate_id("intv")
        if intv_id in state.interviewers:
            console.print(f"[yellow]跳过已存在的面试官: {intv_id}[/yellow]")
            continue
        
        from .models import Interviewer, TimeSlot
        avail_slots = []
        for slot_data in item.get('available_slots', []):
            avail_slots.append(TimeSlot(
                start=datetime.fromisoformat(slot_data['start']),
                end=datetime.fromisoformat(slot_data['end'])
            ))
        
        state.interviewers[intv_id] = Interviewer(
            id=intv_id,
            name=item['name'],
            email=item['email'],
            departments=item['departments'],
            available_slots=avail_slots
        )
        count += 1
    
    save_state(state)
    console.print(f"[bold green]成功导入 {count} 位面试官[/bold green]")


@main.command("demo")
def run_demo():
    """运行完整演示流程"""
    console.print(Panel("[bold blue]招聘面试排班系统 - 演示模式", border_style="blue"))
    
    if not state_exists():
        console.print("[green]初始化工作目录...[/green]")
        state = create_sample_data()
        save_state(state)
        console.print("[green]样例数据已加载[/green]\n")
    else:
        console.print("[yellow]工作目录已存在，直接使用现有数据[/yellow]\n")
    
    state = load_state()
    scheduler = Scheduler(state)
    
    console.print(Panel("[bold]第一步: 查看当前状态", border_style="cyan"))
    total = len(state.interviews)
    confirmed = len([i for i in state.interviews.values() if i.status == InterviewStatus.CONFIRMED])
    scheduled = len([i for i in state.interviews.values() if i.status == InterviewStatus.SCHEDULED])
    no_show = len([i for i in state.interviews.values() if i.status in [InterviewStatus.CANDIDATE_NO_SHOW, InterviewStatus.INTERVIEWER_NO_SHOW]])
    
    console.print(f"总面试数: {total}")
    console.print(f"  [green]已确认: {confirmed}[/green]")
    console.print(f"  [blue]已安排待确认: {scheduled}[/blue]")
    console.print(f"  [red]爽约待重排: {no_show}[/red]")
    console.print()
    
    console.print(Panel("[bold]第二步: 查看提醒事项", border_style="yellow"))
    reminders = scheduler.get_reminders()
    if reminders:
        for rem in reminders[:5]:
            urgency = "[red]高[/red]" if rem["urgency"] == "high" else "[yellow]中[/yellow]"
            console.print(f"  {urgency}: {rem['message']}")
        if len(reminders) > 5:
            console.print(f"  ... 还有 {len(reminders) - 5} 条")
    else:
        console.print("[green]暂无提醒[/green]")
    console.print()
    
    console.print(Panel("[bold]第三步: 演示成功场景 - 安排新面试", border_style="green"))
    console.print("为候选人 '孙架构' (cand_007) 安排初试...")
    result = scheduler.schedule_interview(
        candidate_id="cand_007",
        round_type=RoundType.FIRST,
        operator="hr_demo"
    )
    
    if result.success:
        cand = state.candidates.get("cand_007")
        console.print(f"  [green]成功![/green]")
        console.print(f"    面试ID: {result.interview_id}")
        console.print(f"    候选人: {cand.name if cand else 'cand_007'}")
        console.print(f"    时间: {result.assigned_slot}")
        intv_names = [state.interviewers[i].name for i in result.assigned_interviewers]
        console.print(f"    面试官: {', '.join(intv_names)}")
        room = state.rooms.get(result.assigned_room)
        console.print(f"    会议室: {room.name if room else result.assigned_room}")
    else:
        console.print(f"  [red]失败: {result.message}[/red]")
    console.print()
    
    console.print(Panel("[bold]第四步: 演示失败场景 - 冲突检测", border_style="red"))
    console.print("尝试在已占用的时间段安排另一个面试...")
    console.print("使用已确认的面试时间 (cand_001 初试):")
    
    interview_001 = state.interviews.get("intv_001")
    if interview_001 and interview_001.slot:
        console.print(f"  已占用时间段: {interview_001.slot}")
        console.print()
        console.print("尝试在同一时间段为 cand_008 安排面试:")
        
        result2 = scheduler.schedule_interview(
            candidate_id="cand_008",
            round_type=RoundType.FIRST,
            operator="hr_demo",
            preferred_slot=interview_001.slot
        )
        
        if result2.success:
            console.print(f"  [green]成功[/green]")
        else:
            console.print(f"  [red]失败[/red]")
            console.print(f"  [yellow]原因: {result2.message}[/yellow]")
            if result2.conflicts:
                for conflict in result2.conflicts:
                    console.print(f"    - {conflict.description}")
    console.print()
    
    console.print(Panel("[bold]第五步: 最终状态汇总", border_style="blue"))
    total = len(state.interviews)
    confirmed = len([i for i in state.interviews.values() if i.status == InterviewStatus.CONFIRMED])
    scheduled = len([i for i in state.interviews.values() if i.status == InterviewStatus.SCHEDULED])
    rescheduled = len([i for i in state.interviews.values() if i.status == InterviewStatus.RESCHEDULED])
    no_show = len([i for i in state.interviews.values() if i.status in [InterviewStatus.CANDIDATE_NO_SHOW, InterviewStatus.INTERVIEWER_NO_SHOW]])
    
    table = Table(box=box.ROUNDED)
    table.add_column("状态", style="cyan")
    table.add_column("数量", style="bold", justify="right")
    table.add_row("[green]已确认[/green]", str(confirmed))
    table.add_row("[blue]已安排[/blue]", str(scheduled))
    table.add_row("[magenta]已改期[/magenta]", str(rescheduled))
    table.add_row("[red]爽约[/red]", str(no_show))
    table.add_row("[bold]总计[/bold]", str(total))
    console.print(table)
    
    save_state(state)
    
    console.print("\n[bold green]演示完成![/bold green]")
    console.print("[dim]使用以下命令查看详情:[/dim]")
    console.print("  interview-scheduler list          - 查看所有面试")
    console.print("  interview-scheduler detail <id>   - 查看面试详情")
    console.print("  interview-scheduler check         - 检查冲突和提醒")
    console.print("  interview-scheduler report        - 生成排班报告")


if __name__ == "__main__":
    main()
