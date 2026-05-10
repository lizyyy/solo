#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import date, datetime
from typing import Optional

from volunteer_scheduler.models import (
    PositionRequirement,
    Volunteer,
    Schedule,
    LeaveRequest,
    SubstitutionRecord,
    EventLog,
    generate_id,
    parse_date,
)
from volunteer_scheduler.scheduler import (
    VolunteerScheduler,
    SchedulerState,
    GapAlert,
    ValidationError,
    NotFoundError,
    ConflictError,
    SchedulingError,
)


def load_json_file(filepath: str) -> dict:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"错误: 文件不存在 - {filepath}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"错误: JSON格式无效 - {str(e)}", file=sys.stderr)
        sys.exit(1)


def save_json_file(filepath: str, data: dict) -> None:
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def deserialize_state(data: dict) -> SchedulerState:
    state = SchedulerState()

    for pid, pos_data in data.get("positions", {}).items():
        state.positions[pid] = PositionRequirement(
            position_id=pos_data["position_id"],
            name=pos_data["name"],
            required_qualifications=pos_data["required_qualifications"],
            required_count=pos_data["required_count"],
            date=parse_date(pos_data["date"]),
            time_slot=pos_data["time_slot"],
            description=pos_data.get("description"),
        )

    for vid, vol_data in data.get("volunteers", {}).items():
        state.volunteers[vid] = Volunteer(
            volunteer_id=vol_data["volunteer_id"],
            name=vol_data["name"],
            qualifications=vol_data["qualifications"],
            phone=vol_data.get("phone"),
            email=vol_data.get("email"),
            is_active=vol_data.get("is_active", True),
        )

    for sid, sched_data in data.get("schedules", {}).items():
        state.schedules[sid] = Schedule(
            schedule_id=sched_data["schedule_id"],
            position_id=sched_data["position_id"],
            volunteer_id=sched_data["volunteer_id"],
            date=parse_date(sched_data["date"]),
            time_slot=sched_data["time_slot"],
            checkin_permission=sched_data["checkin_permission"],
            status=sched_data["status"],
            notes=sched_data.get("notes"),
            created_at=datetime.fromisoformat(sched_data["created_at"]),
            updated_at=datetime.fromisoformat(sched_data["updated_at"]),
        )

    for lid, leave_data in data.get("leave_requests", {}).items():
        processed_at = None
        if leave_data.get("processed_at"):
            processed_at = datetime.fromisoformat(leave_data["processed_at"])
        state.leave_requests[lid] = LeaveRequest(
            leave_id=leave_data["leave_id"],
            volunteer_id=leave_data["volunteer_id"],
            schedule_id=leave_data["schedule_id"],
            date=parse_date(leave_data["date"]),
            time_slot=leave_data["time_slot"],
            reason=leave_data["reason"],
            status=leave_data["status"],
            created_at=datetime.fromisoformat(leave_data["created_at"]),
            processed_at=processed_at,
            processed_by=leave_data.get("processed_by"),
        )

    for subid, sub_data in data.get("substitutions", {}).items():
        state.substitutions[subid] = SubstitutionRecord(
            substitution_id=sub_data["substitution_id"],
            leave_request_id=sub_data["leave_request_id"],
            original_schedule_id=sub_data["original_schedule_id"],
            new_schedule_id=sub_data["new_schedule_id"],
            original_volunteer_id=sub_data["original_volunteer_id"],
            substitute_volunteer_id=sub_data["substitute_volunteer_id"],
            position_id=sub_data["position_id"],
            date=parse_date(sub_data["date"]),
            time_slot=sub_data["time_slot"],
            created_at=datetime.fromisoformat(sub_data["created_at"]),
        )

    for log_data in data.get("event_logs", []):
        state.event_logs.append(EventLog(
            event_id=log_data["event_id"],
            event_type=log_data["event_type"],
            timestamp=datetime.fromisoformat(log_data["timestamp"]),
            entity_id=log_data["entity_id"],
            entity_type=log_data["entity_type"],
            details=log_data["details"],
            success=log_data["success"],
            error_message=log_data.get("error_message"),
        ))

    state.processed_leave_ids = set(data.get("processed_leave_ids", []))
    return state


def serialize_state(state: SchedulerState) -> dict:
    return {
        "positions": {pid: pos.to_dict() for pid, pos in state.positions.items()},
        "volunteers": {vid: vol.to_dict() for vid, vol in state.volunteers.items()},
        "schedules": {sid: sched.to_dict() for sid, sched in state.schedules.items()},
        "leave_requests": {lid: leave.to_dict() for lid, leave in state.leave_requests.items()},
        "substitutions": {subid: sub.to_dict() for subid, sub in state.substitutions.items()},
        "event_logs": [log.to_dict() for log in state.event_logs],
        "processed_leave_ids": list(state.processed_leave_ids),
    }


def load_scheduler(data_file: str) -> VolunteerScheduler:
    try:
        data = load_json_file(data_file)
        state = deserialize_state(data)
        return VolunteerScheduler(state=state)
    except Exception as e:
        print(f"错误: 无法加载数据文件 - {str(e)}", file=sys.stderr)
        sys.exit(1)


def save_scheduler(scheduler: VolunteerScheduler, data_file: str) -> None:
    try:
        data = serialize_state(scheduler.state)
        save_json_file(data_file, data)
    except Exception as e:
        print(f"错误: 无法保存数据文件 - {str(e)}", file=sys.stderr)
        sys.exit(1)


def cmd_status(args):
    scheduler = load_scheduler(args.data_file)

    print("=" * 60)
    print("志愿者排班服务状态")
    print("=" * 60)

    print(f"\n[岗位统计]")
    for pid, pos in scheduler.state.positions.items():
        gap = scheduler.get_position_gap(pid)
        status = "正常" if gap.gap_count == 0 else f"缺口 {gap.gap_count} 人"
        print(f"  - {pos.name} ({pid}): 需求 {gap.required_count} 人, 在岗 {gap.current_count} 人, {status}")

    print(f"\n[志愿者统计]")
    active = sum(1 for v in scheduler.state.volunteers.values() if v.is_active)
    total = len(scheduler.state.volunteers)
    print(f"  - 总人数: {total}, 活跃: {active}")

    print(f"\n[排班统计]")
    active_schedules = sum(
        1 for s in scheduler.state.schedules.values()
        if s.status == "active"
    )
    revoked = sum(
        1 for s in scheduler.state.schedules.values()
        if s.checkin_permission == "revoked"
    )
    print(f"  - 总排班: {len(scheduler.state.schedules)}")
    print(f"  - 活跃排班: {active_schedules}")
    print(f"  - 已撤销签到权限: {revoked}")

    print(f"\n[请假统计]")
    pending = sum(1 for l in scheduler.state.leave_requests.values() if l.status == "pending")
    approved = sum(1 for l in scheduler.state.leave_requests.values() if l.status == "approved")
    rejected = sum(1 for l in scheduler.state.leave_requests.values() if l.status == "rejected")
    print(f"  - 待处理: {pending}, 已批准: {approved}, 已拒绝: {rejected}")

    print(f"\n[当前缺口告警]")
    gaps = scheduler.get_all_gaps()
    if not gaps:
        print("  - 无缺口")
    else:
        for gap in gaps:
            print(f"  - [{gap.severity.upper()}] {gap.position_name} ({gap.date}) 缺口 {gap.gap_count} 人")

    print("\n" + "=" * 60)


def cmd_leave(args):
    scheduler = load_scheduler(args.data_file)

    try:
        leave = scheduler.create_leave_request(
            volunteer_id=args.volunteer_id,
            schedule_id=args.schedule_id,
            date=parse_date(args.date),
            time_slot=args.time_slot,
            reason=args.reason,
        )
        save_scheduler(scheduler, args.data_file)
        print(f"请假申请已创建: {leave.leave_id}")
        print(f"  志愿者: {args.volunteer_id}")
        print(f"  排班: {args.schedule_id}")
        print(f"  原因: {args.reason}")
        print(f"  状态: 待审批")
    except (ValidationError, NotFoundError, ConflictError) as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)


def cmd_approve(args):
    scheduler = load_scheduler(args.data_file)

    try:
        substitution, gaps = scheduler.process_leave_approval(
            leave_id=args.leave_id,
            approved=True,
            processed_by=args.processed_by,
        )
        save_scheduler(scheduler, args.data_file)

        print(f"请假已批准: {args.leave_id}")
        if substitution:
            print(f"  已找到替补: {substitution.substitute_volunteer_id}")
            print(f"  新排班ID: {substitution.new_schedule_id}")
        else:
            print("  警告: 未找到合格替补")

        if gaps:
            print(f"\n[缺口告警]")
            for gap in gaps:
                print(f"  - {gap.position_name}: 缺口 {gap.gap_count} 人 (需要: {gap.required_qualifications})")
    except (NotFoundError, ConflictError, SchedulingError) as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)


def cmd_reject(args):
    scheduler = load_scheduler(args.data_file)

    try:
        scheduler.process_leave_approval(
            leave_id=args.leave_id,
            approved=False,
            processed_by=args.processed_by,
        )
        save_scheduler(scheduler, args.data_file)
        print(f"请假已拒绝: {args.leave_id}")
    except (NotFoundError, ConflictError, SchedulingError) as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)


def cmd_gaps(args):
    scheduler = load_scheduler(args.data_file)

    gaps = scheduler.get_all_gaps()
    if not gaps:
        print("当前无岗位缺口")
        return

    print(f"发现 {len(gaps)} 个岗位缺口:\n")
    for gap in gaps:
        print("-" * 40)
        print(f"岗位: {gap.position_name} ({gap.position_id})")
        print(f"日期: {gap.date} {gap.time_slot}")
        print(f"需求人数: {gap.required_count}")
        print(f"在岗人数: {gap.current_count}")
        print(f"缺口人数: {gap.gap_count}")
        print(f"所需资质: {', '.join(gap.required_qualifications) if gap.required_qualifications else '无'}")
        print(f"严重程度: {gap.severity}")


def cmd_export(args):
    scheduler = load_scheduler(args.data_file)

    target_date = parse_date(args.date) if args.date else None
    exported = scheduler.export_schedule(target_date=target_date)

    output = {
        "export_time": datetime.now().isoformat(),
        "target_date": args.date,
        "schedule_count": len(exported),
        "schedules": exported,
    }

    if args.output:
        save_json_file(args.output, output)
        print(f"排班已导出到: {args.output}")
    else:
        print(json.dumps(output, ensure_ascii=False, indent=2))


def cmd_logs(args):
    scheduler = load_scheduler(args.data_file)

    logs = scheduler.state.event_logs
    if args.limit:
        logs = logs[-args.limit:]

    print(f"事件日志 (共 {len(scheduler.state.event_logs)} 条):\n")
    for log in logs:
        status = "成功" if log.success else "失败"
        print(f"[{log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}] {log.event_type} - {status}")
        print(f"  实体: {log.entity_type} / {log.entity_id}")
        if log.error_message:
            print(f"  错误: {log.error_message}")
        if log.details:
            print(f"  详情: {json.dumps(log.details, ensure_ascii=False)}")
        print()


def cmd_correct(args):
    scheduler = load_scheduler(args.data_file)

    try:
        corrections = json.loads(args.corrections)
        result = scheduler.apply_manual_correction(
            entity_type=args.entity_type,
            entity_id=args.entity_id,
            corrections=corrections,
            corrected_by=args.corrected_by,
        )
        save_scheduler(scheduler, args.data_file)
        print(f"已应用人工修正")
        print(f"  实体类型: {args.entity_type}")
        print(f"  实体ID: {args.entity_id}")
        print(f"  修正内容: {args.corrections}")
    except json.JSONDecodeError:
        print("错误: corrections 参数必须是有效的 JSON 格式", file=sys.stderr)
        sys.exit(1)
    except (ValidationError, NotFoundError) as e:
        print(f"错误: {str(e)}", file=sys.stderr)
        sys.exit(1)


def cmd_init(args):
    sample_data = {
        "positions": {
            "p1": {
                "position_id": "p1",
                "name": "急救站",
                "required_qualifications": ["first_aid"],
                "required_count": 2,
                "date": "2024-01-15",
                "time_slot": "09:00-12:00",
                "description": "主入口急救站"
            },
            "p2": {
                "position_id": "p2",
                "name": "安检入口",
                "required_qualifications": ["security"],
                "required_count": 1,
                "date": "2024-01-15",
                "time_slot": "09:00-12:00",
                "description": "主入口安检"
            }
        },
        "volunteers": {
            "v1": {
                "volunteer_id": "v1",
                "name": "张三",
                "qualifications": ["first_aid", "driving"],
                "phone": "13800138001",
                "email": "zhangsan@example.com",
                "is_active": True
            },
            "v2": {
                "volunteer_id": "v2",
                "name": "李四",
                "qualifications": ["first_aid"],
                "phone": "13800138002",
                "email": "lisi@example.com",
                "is_active": True
            },
            "v3": {
                "volunteer_id": "v3",
                "name": "王五",
                "qualifications": ["security"],
                "phone": "13800138003",
                "email": "wangwu@example.com",
                "is_active": True
            },
            "v4": {
                "volunteer_id": "v4",
                "name": "备用志愿者",
                "qualifications": ["first_aid"],
                "phone": "13800138004",
                "is_active": True
            }
        },
        "schedules": {
            "s1": {
                "schedule_id": "s1",
                "position_id": "p1",
                "volunteer_id": "v1",
                "date": "2024-01-15",
                "time_slot": "09:00-12:00",
                "checkin_permission": "granted",
                "status": "active",
                "notes": None,
                "created_at": "2024-01-01T10:00:00",
                "updated_at": "2024-01-01T10:00:00"
            },
            "s2": {
                "schedule_id": "s2",
                "position_id": "p1",
                "volunteer_id": "v2",
                "date": "2024-01-15",
                "time_slot": "09:00-12:00",
                "checkin_permission": "granted",
                "status": "active",
                "notes": None,
                "created_at": "2024-01-01T10:00:00",
                "updated_at": "2024-01-01T10:00:00"
            },
            "s3": {
                "schedule_id": "s3",
                "position_id": "p2",
                "volunteer_id": "v3",
                "date": "2024-01-15",
                "time_slot": "09:00-12:00",
                "checkin_permission": "granted",
                "status": "active",
                "notes": None,
                "created_at": "2024-01-01T10:00:00",
                "updated_at": "2024-01-01T10:00:00"
            }
        },
        "leave_requests": {},
        "substitutions": {},
        "event_logs": [],
        "processed_leave_ids": []
    }

    save_json_file(args.data_file, sample_data)
    print(f"示例数据已初始化到: {args.data_file}")
    print("\n你可以运行以下命令来测试:")
    print("  python3 scheduler_cli.py status")
    print("  python3 scheduler_cli.py leave --volunteer-id v1 --schedule-id s1 --date 2024-01-15 --time-slot '09:00-12:00' --reason '生病请假'")


def main():
    parser = argparse.ArgumentParser(
        description="活动志愿者排班服务 - 处理临时请假、替补调度、签到权限管理",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 初始化示例数据
  python3 scheduler_cli.py init

  # 查看当前状态
  python3 scheduler_cli.py status

  # 提交请假申请
  python3 scheduler_cli.py leave --volunteer-id v1 --schedule-id s1 \\
      --date 2024-01-15 --time-slot "09:00-12:00" --reason "生病"

  # 批准请假 (自动查找替补)
  python3 scheduler_cli.py approve --leave-id <leave_id> --processed-by admin

  # 拒绝请假
  python3 scheduler_cli.py reject --leave-id <leave_id>

  # 查看当前缺口
  python3 scheduler_cli.py gaps

  # 导出排班
  python3 scheduler_cli.py export --date 2024-01-15 --output schedule.json

  # 查看事件日志
  python3 scheduler_cli.py logs --limit 10

  # 人工修正数据
  python3 scheduler_cli.py correct --entity-type Volunteer --entity-id v1 \\
      --corrections '{"name": "张三改"}'
        """
    )
    parser.add_argument(
        "--data-file",
        default="scheduler_data.json",
        help="数据文件路径 (默认: scheduler_data.json)"
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    subparsers.add_parser("init", help="初始化示例数据")

    subparsers.add_parser("status", help="查看当前系统状态")

    leave_parser = subparsers.add_parser("leave", help="提交请假申请")
    leave_parser.add_argument("--volunteer-id", required=True, help="志愿者ID")
    leave_parser.add_argument("--schedule-id", required=True, help="排班ID")
    leave_parser.add_argument("--date", required=True, help="日期 (YYYY-MM-DD)")
    leave_parser.add_argument("--time-slot", required=True, help="时间段")
    leave_parser.add_argument("--reason", required=True, help="请假原因")

    approve_parser = subparsers.add_parser("approve", help="批准请假")
    approve_parser.add_argument("--leave-id", required=True, help="请假ID")
    approve_parser.add_argument("--processed-by", default="admin", help="处理人")

    reject_parser = subparsers.add_parser("reject", help="拒绝请假")
    reject_parser.add_argument("--leave-id", required=True, help="请假ID")
    reject_parser.add_argument("--processed-by", default="admin", help="处理人")

    subparsers.add_parser("gaps", help="查看岗位缺口")

    export_parser = subparsers.add_parser("export", help="导出排班")
    export_parser.add_argument("--date", help="过滤日期 (YYYY-MM-DD)")
    export_parser.add_argument("--output", help="输出文件路径 (默认: 标准输出)")

    logs_parser = subparsers.add_parser("logs", help="查看事件日志")
    logs_parser.add_argument("--limit", type=int, help="显示最近N条")

    correct_parser = subparsers.add_parser("correct", help="人工修正数据")
    correct_parser.add_argument("--entity-type", required=True,
                               choices=["Volunteer", "Schedule", "PositionRequirement"],
                               help="实体类型")
    correct_parser.add_argument("--entity-id", required=True, help="实体ID")
    correct_parser.add_argument("--corrections", required=True,
                                help='修正内容 (JSON格式, 如: {"name": "新名字"}')
    correct_parser.add_argument("--corrected-by", default="admin", help="修正人")

    args = parser.parse_args()

    if args.command == "init":
        cmd_init(args)
    elif args.command == "status":
        cmd_status(args)
    elif args.command == "leave":
        cmd_leave(args)
    elif args.command == "approve":
        cmd_approve(args)
    elif args.command == "reject":
        cmd_reject(args)
    elif args.command == "gaps":
        cmd_gaps(args)
    elif args.command == "export":
        cmd_export(args)
    elif args.command == "logs":
        cmd_logs(args)
    elif args.command == "correct":
        cmd_correct(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
