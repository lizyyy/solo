#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from typing import List, Optional

from examples.example_tasks import create_example_tasks
from task_compensation.core.compensation_workflow import CompensationWorkflow
from task_compensation.models import SystemConfig


def parse_args():
    parser = argparse.ArgumentParser(
        description="定时任务漏跑补偿脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 补偿昨天的漏跑任务
  python run_compensation.py
  
  # 补偿指定日期的漏跑任务
  python run_compensation.py --date 2024-01-15
  
  # 仅补偿特定任务
  python run_compensation.py --tasks extract_data,transform_data
  
  # 试运行（不实际执行）
  python run_compensation.py --dry-run
  
  # 导出多种格式报告
  python run_compensation.py --export json,csv,html
        """
    )
    
    parser.add_argument(
        "--date", "-d",
        type=str,
        help="目标日期 (格式: YYYY-MM-DD)，默认是昨天"
    )
    
    parser.add_argument(
        "--tasks", "-t",
        type=str,
        help="特定任务ID列表，用逗号分隔"
    )
    
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="试运行模式，仅生成计划不执行"
    )
    
    parser.add_argument(
        "--include-inactive",
        action="store_true",
        help="包含已禁用的任务"
    )
    
    parser.add_argument(
        "--export", "-e",
        type=str,
        default="json",
        help="导出格式: json,csv,html，用逗号分隔"
    )
    
    parser.add_argument(
        "--data-dir",
        type=str,
        default="./data",
        help="数据目录"
    )
    
    parser.add_argument(
        "--no-idempotency",
        action="store_true",
        help="禁用幂等检查"
    )
    
    return parser.parse_args()


def parse_date(date_str: Optional[str]) -> date:
    if date_str is None:
        return date.today() - timedelta(days=1)
    
    try:
        from datetime import datetime
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        print(f"错误: 日期格式无效 '{date_str}'，请使用 YYYY-MM-DD 格式")
        sys.exit(1)


def parse_tasks(tasks_str: Optional[str]) -> Optional[List[str]]:
    if tasks_str is None:
        return None
    
    return [t.strip() for t in tasks_str.split(",") if t.strip()]


def parse_export_formats(formats_str: str) -> List[str]:
    return [f.strip() for f in formats_str.split(",") if f.strip()]


def main():
    args = parse_args()
    
    target_date = parse_date(args.date)
    task_ids = parse_tasks(args.tasks)
    export_formats = parse_export_formats(args.export)
    
    print("=" * 60)
    print("定时任务漏跑补偿脚本")
    print("=" * 60)
    print(f"目标日期: {target_date}")
    if task_ids:
        print(f"特定任务: {', '.join(task_ids)}")
    print(f"试运行: {'是' if args.dry_run else '否'}")
    print(f"导出格式: {', '.join(export_formats)}")
    print("=" * 60)
    
    registry = create_example_tasks()
    
    config = SystemConfig(
        data_dir=args.data_dir,
        records_dir=f"{args.data_dir}/records",
        reports_dir=f"{args.data_dir}/reports",
        enable_idempotency_check=not args.no_idempotency
    )
    
    workflow = CompensationWorkflow(registry=registry, config=config)
    
    try:
        report = workflow.run(
            target_date=target_date,
            specific_task_ids=task_ids,
            dry_run=args.dry_run,
            include_inactive=args.include_inactive,
            export_formats=export_formats
        )
        
        print(f"\n执行完成，报告ID: {report.report_id}")
        print(f"成功率: {report.get_success_rate():.2f}%")
        
        if report.failed_count > 0:
            print(f"\n失败任务 ({report.failed_count}):")
            for result in report.task_results:
                if result.status.value in ['failed', 'timeout']:
                    print(f"  - {result.task_id}: {result.error_message}")
                    if result.error_traceback:
                        print(f"    堆栈: {result.error_traceback[:200]}...")
        
        return 0
        
    except Exception as e:
        print(f"\n错误: {str(e)}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
