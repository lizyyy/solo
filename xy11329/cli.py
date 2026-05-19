#!/usr/bin/env python3
import argparse
import sys
from datetime import datetime

from app.database import SessionLocal
from app.models import TaskStatus, TaskPriority
from app.services import TaskService, EscortService, StatsService, ExportService, BatchService


def create_task(args):
    db = SessionLocal()
    service = TaskService(db)
    task, status = service.create_task(
        request_id=args.request_id,
        patient_name=args.patient_name,
        patient_medical_record_no=args.medical_record,
        patient_phone=args.phone,
        patient_department=args.department,
        service_type=args.service_type,
        from_location=args.from_location,
        to_location=args.to_location,
        priority=args.priority,
        operator_role=args.operator_role,
        operator_name=args.operator_name,
    )
    print(f"任务创建: {status}")
    print(f"任务ID: {task.id}, 状态: {task.status}")
    db.close()


def assign_task(args):
    db = SessionLocal()
    service = TaskService(db)
    task, status = service.assign_task(
        task_id=args.task_id,
        escort_id=args.escort_id,
        operator_role=args.operator_role,
        operator_name=args.operator_name,
    )
    print(f"派单结果: {status}")
    if task:
        print(f"任务ID: {task.id}, 陪检员ID: {task.assigned_escort_id}")
    db.close()


def accept_task(args):
    db = SessionLocal()
    service = TaskService(db)
    task, status = service.accept_task(
        task_id=args.task_id,
        operator_role=args.operator_role,
        operator_name=args.operator_name,
    )
    print(f"接单结果: {status}")
    if task:
        print(f"任务ID: {task.id}, 状态: {task.status}")
    db.close()


def complete_task(args):
    db = SessionLocal()
    service = TaskService(db)
    task, status = service.complete_task(
        task_id=args.task_id,
        operator_role=args.operator_role,
        operator_name=args.operator_name,
        completion_note=args.note,
    )
    print(f"完成结果: {status}")
    if task:
        print(f"任务ID: {task.id}, 状态: {task.status}")
    db.close()


def cancel_task(args):
    db = SessionLocal()
    service = TaskService(db)
    task, status = service.cancel_task(
        task_id=args.task_id,
        operator_role=args.operator_role,
        operator_name=args.operator_name,
        cancel_reason=args.reason,
    )
    print(f"取消结果: {status}")
    if task:
        print(f"任务ID: {task.id}, 状态: {task.status}")
    db.close()


def list_tasks(args):
    db = SessionLocal()
    service = TaskService(db)
    tasks = service.list_tasks(
        status=args.status,
        escort_id=args.escort_id,
        skip=args.skip,
        limit=args.limit,
    )
    print(f"共找到 {len(tasks)} 个任务:")
    for task in tasks:
        print(f"  ID: {task.id}, 请求ID: {task.request_id}, 状态: {task.status}, "
              f"优先级: {task.priority}, 排队位置: {task.queue_position}")
    db.close()


def get_stats(args):
    db = SessionLocal()
    service = StatsService(db)
    summary = service.get_task_summary()
    print("任务统计:")
    print(f"  总数: {summary['total']}")
    print(f"  各状态: {summary['status']}")
    print(f"  异常数: {summary['has_exception']}")
    print(f"  平均等待时间: {summary['wait_times']['avg_wait_minutes']:.2f} 分钟")
    print(f"  平均服务时间: {summary['wait_times']['avg_service_minutes']:.2f} 分钟")
    db.close()


def create_escort(args):
    db = SessionLocal()
    service = EscortService(db)
    escort, status = service.create_escort(
        name=args.name,
        phone=args.phone,
        employee_id=args.employee_id,
    )
    print(f"陪检员创建: {status}")
    print(f"ID: {escort.id}, 姓名: {escort.name}, 工号: {escort.employee_id}")
    db.close()


def list_escorts(args):
    db = SessionLocal()
    service = EscortService(db)
    escorts = service.list_escorts(active_only=args.active_only)
    print(f"共找到 {len(escorts)} 个陪检员:")
    for escort in escorts:
        status = "激活" if escort.is_active else "停用"
        print(f"  ID: {escort.id}, 姓名: {escort.name}, 工号: {escort.employee_id}, 状态: {status}")
    db.close()


def export_tasks(args):
    db = SessionLocal()
    service = ExportService(db)
    if args.format == "excel":
        filepath = service.export_tasks_to_excel(
            status=args.status,
        )
    else:
        filepath = service.export_tasks_to_csv(
            status=args.status,
        )
    print(f"导出文件: {filepath}")
    db.close()


def main():
    parser = argparse.ArgumentParser(description="门诊陪检调度系统 CLI")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    task_parser = subparsers.add_parser("create-task", help="创建任务")
    task_parser.add_argument("--request-id", required=True, help="请求ID")
    task_parser.add_argument("--patient-name", required=True, help="患者姓名")
    task_parser.add_argument("--medical-record", help="病历号")
    task_parser.add_argument("--phone", help="电话")
    task_parser.add_argument("--department", help="科室")
    task_parser.add_argument("--service-type", help="服务类型")
    task_parser.add_argument("--from-location", help="起始位置")
    task_parser.add_argument("--to-location", help="目标位置")
    task_parser.add_argument("--priority", default=TaskPriority.NORMAL,
                             choices=[e.value for e in TaskPriority], help="优先级")
    task_parser.add_argument("--operator-role", default="dispatcher", help="操作人角色")
    task_parser.add_argument("--operator-name", default="System", help="操作人姓名")
    task_parser.set_defaults(func=create_task)

    assign_parser = subparsers.add_parser("assign-task", help="派单")
    assign_parser.add_argument("--task-id", type=int, required=True, help="任务ID")
    assign_parser.add_argument("--escort-id", type=int, required=True, help="陪检员ID")
    assign_parser.add_argument("--operator-role", default="dispatcher", help="操作人角色")
    assign_parser.add_argument("--operator-name", default="System", help="操作人姓名")
    assign_parser.set_defaults(func=assign_task)

    accept_parser = subparsers.add_parser("accept-task", help="接单")
    accept_parser.add_argument("--task-id", type=int, required=True, help="任务ID")
    accept_parser.add_argument("--operator-role", default="escort", help="操作人角色")
    accept_parser.add_argument("--operator-name", default="System", help="操作人姓名")
    accept_parser.set_defaults(func=accept_task)

    complete_parser = subparsers.add_parser("complete-task", help="完成任务")
    complete_parser.add_argument("--task-id", type=int, required=True, help="任务ID")
    complete_parser.add_argument("--note", help="完成备注")
    complete_parser.add_argument("--operator-role", default="escort", help="操作人角色")
    complete_parser.add_argument("--operator-name", default="System", help="操作人姓名")
    complete_parser.set_defaults(func=complete_task)

    cancel_parser = subparsers.add_parser("cancel-task", help="取消任务")
    cancel_parser.add_argument("--task-id", type=int, required=True, help="任务ID")
    cancel_parser.add_argument("--reason", help="取消原因")
    cancel_parser.add_argument("--operator-role", default="dispatcher", help="操作人角色")
    cancel_parser.add_argument("--operator-name", default="System", help="操作人姓名")
    cancel_parser.set_defaults(func=cancel_task)

    list_parser = subparsers.add_parser("list-tasks", help="列出任务")
    list_parser.add_argument("--status", choices=[e.value for e in TaskStatus], help="状态筛选")
    list_parser.add_argument("--escort-id", type=int, help="陪检员ID筛选")
    list_parser.add_argument("--skip", type=int, default=0, help="跳过数量")
    list_parser.add_argument("--limit", type=int, default=50, help="限制数量")
    list_parser.set_defaults(func=list_tasks)

    stats_parser = subparsers.add_parser("stats", help="统计信息")
    stats_parser.set_defaults(func=get_stats)

    escort_parser = subparsers.add_parser("create-escort", help="创建陪检员")
    escort_parser.add_argument("--name", required=True, help="姓名")
    escort_parser.add_argument("--phone", required=True, help="电话")
    escort_parser.add_argument("--employee-id", required=True, help="工号")
    escort_parser.set_defaults(func=create_escort)

    list_escort_parser = subparsers.add_parser("list-escorts", help="列出陪检员")
    list_escort_parser.add_argument("--active-only", action="store_true", default=True, help="仅显示激活的")
    list_escort_parser.set_defaults(func=list_escorts)

    export_parser = subparsers.add_parser("export", help="导出任务")
    export_parser.add_argument("--format", choices=["excel", "csv"], default="excel", help="导出格式")
    export_parser.add_argument("--status", help="状态筛选")
    export_parser.set_defaults(func=export_tasks)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return 1

    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
