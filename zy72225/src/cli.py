#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path

from .processor import ReleaseScheduleProcessor


def cmd_import(args):
    processor = ReleaseScheduleProcessor(data_dir=args.data_dir)
    result = processor.step1_import_ex_dividend_screenshot(
        excel_file_path=args.file,
        operator=args.operator,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_risk_review(args):
    processor = ReleaseScheduleProcessor(data_dir=args.data_dir)
    result = processor.step2_risk_review_tax_rate_remark(
        record_id=args.record_id,
        operator=args.operator,
        tax_rate=args.tax_rate,
        remark=args.remark,
        review_note=args.review_note,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_summary(args):
    processor = ReleaseScheduleProcessor(data_dir=args.data_dir)
    result = processor.step3_update_summary_for_manager(
        operator=args.operator,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_list_risk_review(args):
    processor = ReleaseScheduleProcessor(data_dir=args.data_dir)
    records = processor.get_records_for_risk_review()
    print(json.dumps(records, ensure_ascii=False, indent=2))


def cmd_approve(args):
    processor = ReleaseScheduleProcessor(data_dir=args.data_dir)
    result = processor.approve_boundary_case(
        record_id=args.record_id,
        operator=args.operator,
        approve_note=args.note,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_reject(args):
    processor = ReleaseScheduleProcessor(data_dir=args.data_dir)
    result = processor.reject_boundary_case(
        record_id=args.record_id,
        operator=args.operator,
        reject_reason=args.reason,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_rollback(args):
    processor = ReleaseScheduleProcessor(data_dir=args.data_dir)
    result = processor.rollback_boundary_case(
        record_id=args.record_id,
        operator=args.operator,
        rollback_reason=args.reason,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


def cmd_history(args):
    processor = ReleaseScheduleProcessor(data_dir=args.data_dir)
    history = processor.get_record_history(record_id=args.record_id)
    print(json.dumps(history, ensure_ascii=False, indent=2))


def cmd_report(args):
    processor = ReleaseScheduleProcessor(data_dir=args.data_dir)
    report = processor.export_full_report(output_path=args.output)
    if not args.output:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(f"报告已导出至: {args.output}")


def cmd_replay(args):
    processor = ReleaseScheduleProcessor(data_dir=args.data_dir)
    commands = processor.generate_replay_commands()
    for cmd in commands:
        print(cmd)


def main():
    parser = argparse.ArgumentParser(
        description="票据池质押释放排程处理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例命令:
  # 步骤1: 导入除权日截图
  python -m src.cli import -f data/ex_dividend.xlsx -o 张三

  # 步骤2: 风控补看税费率备注
  python -m src.cli risk-review -r <record_id> -o 老秦 --tax-rate 0.06

  # 步骤3: 生成负责人摘要
  python -m src.cli summary -o 李四

  # 查看待风控复核记录
  python -m src.cli list-risk-review

  # 复核通过边界案例
  python -m src.cli approve -r <record_id> -o 老秦 --note "确认已冲正"

  # 回滚误触发的边界规则（如误判的"金额为0且备注已冲正"）
  python -m src.cli rollback -r <record_id> -o 老秦 --reason "备注为'已冲正'是正常业务，需撤销边界标记"

  # 查看单条记录完整历史
  python -m src.cli history -r <record_id>

  # 导出完整报告(含可重跑命令)
  python -m src.cli report -o report.json

  # 生成可重跑命令
  python -m src.cli replay
        """
    )
    parser.add_argument("--data-dir", default="./data", help="数据目录")

    subparsers = parser.add_subparsers(dest="command", required=True)

    import_parser = subparsers.add_parser("import", help="导入除权日截图Excel")
    import_parser.add_argument("-f", "--file", required=True, help="Excel文件路径")
    import_parser.add_argument("-o", "--operator", required=True, help="操作人")
    import_parser.set_defaults(func=cmd_import)

    risk_review_parser = subparsers.add_parser("risk-review", help="风控补看税费率备注")
    risk_review_parser.add_argument("-r", "--record-id", required=True, help="记录ID")
    risk_review_parser.add_argument("-o", "--operator", required=True, help="操作人")
    risk_review_parser.add_argument("--tax-rate", type=float, help="税费率")
    risk_review_parser.add_argument("--remark", help="备注")
    risk_review_parser.add_argument("--review-note", help="复核说明")
    risk_review_parser.set_defaults(func=cmd_risk_review)

    summary_parser = subparsers.add_parser("summary", help="生成负责人摘要")
    summary_parser.add_argument("-o", "--operator", required=True, help="操作人")
    summary_parser.set_defaults(func=cmd_summary)

    list_risk_parser = subparsers.add_parser("list-risk-review", help="列出待风控复核记录")
    list_risk_parser.set_defaults(func=cmd_list_risk_review)

    approve_parser = subparsers.add_parser("approve", help="风控复核通过")
    approve_parser.add_argument("-r", "--record-id", required=True, help="记录ID")
    approve_parser.add_argument("-o", "--operator", required=True, help="操作人")
    approve_parser.add_argument("--note", required=True, help="通过说明")
    approve_parser.set_defaults(func=cmd_approve)

    reject_parser = subparsers.add_parser("reject", help="风控复核驳回")
    reject_parser.add_argument("-r", "--record-id", required=True, help="记录ID")
    reject_parser.add_argument("-o", "--operator", required=True, help="操作人")
    reject_parser.add_argument("--reason", required=True, help="驳回原因")
    reject_parser.set_defaults(func=cmd_reject)

    rollback_parser = subparsers.add_parser(
        "rollback",
        help="回滚误触发的边界规则（如误判的'金额为0且备注已冲正'）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description="""回滚边界规则触发结果：
  - 回滚对象: record_id 对应记录当前的 boundary_type
  - 回滚前状态: RISK_REVIEW_REQUIRED (或其他规则设置的状态)
  - 回滚后状态: PENDING（待处理，边界标记清除）
  - 历史中会留下 change_type=ROLLBACK 的日志和补充的回滚原因说明
""",
    )
    rollback_parser.add_argument("-r", "--record-id", required=True, help="要回滚的记录ID")
    rollback_parser.add_argument("-o", "--operator", required=True, help="执行回滚的操作人")
    rollback_parser.add_argument("--reason", required=True, help="回滚原因（将写入历史，用于向负责人解释）")
    rollback_parser.set_defaults(func=cmd_rollback)

    history_parser = subparsers.add_parser("history", help="查看记录完整历史")
    history_parser.add_argument("-r", "--record-id", required=True, help="记录ID")
    history_parser.set_defaults(func=cmd_history)

    report_parser = subparsers.add_parser("report", help="导出完整报告")
    report_parser.add_argument("-o", "--output", help="输出文件路径")
    report_parser.set_defaults(func=cmd_report)

    replay_parser = subparsers.add_parser("replay", help="生成可重跑命令")
    replay_parser.set_defaults(func=cmd_replay)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
