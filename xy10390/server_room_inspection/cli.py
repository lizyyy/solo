"""
CLI命令行接口
"""

import argparse
import sys
from datetime import datetime, timedelta
from typing import Optional
from .storage import DataStore
from .importer import DataImporter
from .checker import RiskChecker
from .reporter import DailyReporter
from .models import ReviewRecord


class CLIController:
    """CLI控制器"""

    def __init__(self, data_dir: str = "./data"):
        self.store = DataStore(data_dir)
        self.importer = DataImporter(self.store)
        self.checker = RiskChecker(self.store)
        self.reporter = DailyReporter(self.store)

    def _get_today(self) -> str:
        return datetime.now().strftime("%Y-%m-%d")

    def _print_header(self, title: str):
        print("\n" + "=" * 70)
        print(f"  {title}")
        print("=" * 70)

    def _print_separator(self):
        print("-" * 70)

    def cmd_import(self, args) -> int:
        """导入数据命令"""
        if args.type == "inspection":
            results = self.importer.import_inspections(args.file)
            type_name = "巡检数据"
        elif args.type == "ups":
            results = self.importer.import_ups_status(args.file)
            type_name = "UPS状态"
        elif args.type == "alarm":
            results = self.importer.import_ac_alarms(args.file)
            type_name = "空调告警"
        else:
            print(f"错误: 未知的数据类型 '{args.type}'")
            return 1

        self._print_header(f"导入 {type_name}")
        print(f"文件: {args.file}")
        self._print_separator()
        print(f"  总计: {results['total']} 条")
        print(f"  新增: {results['created']} 条")
        print(f"  更新: {results['updated']} 条")
        print(f"  错误: {results['errors']} 条")

        if results['updated'] > 0:
            print("\n  [更新说明] 检测到重复记录，已执行更新而非追加")

        if results['errors'] > 0:
            print("\n  [错误记录]")
            for rec in results['records']:
                if rec['action'] == 'error':
                    print(f"    - {rec.get('error', '未知错误')}")

        return 0

    def cmd_check(self, args) -> int:
        """检查风险命令"""
        date = args.date or self._get_today()

        self._print_header(f"风险检查 - {date}")

        result = self.checker.check_date(date)

        print(f"  巡检记录: {result['stats']['inspections']} 条")
        print(f"  UPS状态: {result['stats']['ups']} 条")
        print(f"  空调告警: {result['stats']['alarms']} 条")
        self._print_separator()
        print(f"  发现风险: {result['total']} 项")
        print(f"    高危: {result['by_level']['high']}")
        print(f"    中危: {result['by_level']['medium']}")
        print(f"    低危: {result['by_level']['low']}")

        if result['total'] > 0:
            self._print_separator()
            print("  风险详情:")
            for r in result['risks']:
                level_display = {"high": "高危", "medium": "中危", "low": "低危"}
                level_color = {"high": "!", "medium": "*", "low": "-"}
                print(f"  [{level_color[r.level]}] {level_display[r.level]:<4} {r.code:<6} {r.source}")
                print(f"      {r.message}")

        self._print_separator()
        print("  检查完成。使用 'risks' 命令查看详情，使用 'export' 命令导出报告。")

        return 0

    def cmd_risks(self, args) -> int:
        """查看风险命令"""
        date = args.date or self._get_today()
        risks = self.store.get_risks_by_date(date)

        if not risks:
            self._print_header(f"风险列表 - {date}")
            print("  未发现风险记录")
            print("  提示: 请先使用 'check' 命令执行风险检查")
            return 0

        self._print_header(f"风险列表 - {date} (共 {len(risks)} 项)")

        level_display = {"high": "高危", "medium": "中危", "low": "低危"}

        sorted_risks = sorted(
            risks,
            key=lambda r: {"high": 0, "medium": 1, "low": 2}[r.level]
        )

        for i, r in enumerate(sorted_risks, 1):
            self._print_separator()
            print(f"\n  [{i}] {r.risk_id}")
            print(f"      等级: {level_display[r.level]}")
            print(f"      代码: {r.code}")
            print(f"      来源: {r.source}")
            print(f"      类型: {r.type}")
            print(f"      状态: {r.status}")
            print(f"      已复核: {'是' if r.reviewed else '否'}")
            print(f"      描述: {r.message}")
            print(f"      建议: {r.suggestion}")
            if r.notes:
                print(f"      备注: {r.notes}")

        return 0

    def cmd_review(self, args) -> int:
        """人工复核命令"""
        date = args.date or self._get_today()

        self._print_header(f"人工复核 - {date}")

        inspections = self.store.get_inspections_by_date(date)
        if not inspections:
            print(f"  日期 {date} 没有巡检记录，无法进行复核")
            return 1

        if args.undo:
            self._undo_review(date)
            return 0

        existing = self.store.get_review_by_date(date)
        if existing:
            print(f"  该日期已由 {existing.reviewer} 于 {existing.reviewed_at} 完成复核")
            if not args.force:
                print("  使用 --force 参数可覆盖已有复核记录")
                return 1

        risks = self.store.get_risks_by_date(date)
        risk_count = len(risks)
        print(f"  巡检记录: {len(inspections)} 条")
        print(f"  风险数量: {risk_count} 项")

        status = args.status or ("通过" if risk_count == 0 else "有异常")

        review = ReviewRecord(
            date=date,
            reviewer=args.reviewer,
            reviewed_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            status=status,
            notes=args.notes or ""
        )

        self.store.save_review(review)

        self._print_separator()
        print(f"  复核完成！")
        print(f"    复核人: {review.reviewer}")
        print(f"    复核时间: {review.reviewed_at}")
        print(f"    复核结果: {review.status}")
        if review.notes:
            print(f"    备注: {review.notes}")

        return 0

    def _undo_review(self, date: str):
        """撤销复核"""
        import os
        import json

        reviews_file = os.path.join(self.store.data_dir, "reviews.json")
        with open(reviews_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        original_len = len(data)
        data = [r for r in data if r.get("date") != date]

        if len(data) < original_len:
            with open(reviews_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"  已撤销 {date} 的复核记录")
        else:
            print(f"  日期 {date} 没有复核记录")

    def cmd_export(self, args) -> int:
        """导出命令"""
        date = args.date or self._get_today()
        format_type = args.format or "txt"

        if args.format not in ["txt", "json", "csv"]:
            print(f"错误: 不支持的格式 '{args.format}'")
            return 1

        file_path = args.output or f"report_{date}.{format_type}"

        self._print_header(f"导出报告 - {date}")

        try:
            self.reporter.export_report(date, file_path, format_type)
            print(f"  报告已导出到: {file_path}")
            print(f"  格式: {format_type.upper()}")
            return 0
        except Exception as e:
            print(f"  导出失败: {e}")
            return 1

    def cmd_status(self, args) -> int:
        """查看状态命令"""
        date = args.date or self._get_today()

        self._print_header(f"当日状态 - {date}")

        report = self.reporter.generate_report(date)
        s = report["summary"]

        print(f"\n  整体状态: {report['status']}")
        print(f"\n  数据概览:")
        print(f"    巡检记录: {s['inspections_count']} 条")
        print(f"    UPS状态: {s['ups_count']} 条")
        print(f"    空调告警: {s['alarms_count']} 条")
        print(f"    未处理告警: {s['unhandled_alarms_count']} 条")
        print(f"\n  复核状态: {s['review_status']}")
        print(f"    复核人: {s['reviewer']}")

        print(f"\n  风险统计:")
        print(f"    高危: {s['risks_by_level']['high']}")
        print(f"    中危: {s['risks_by_level']['medium']}")
        print(f"    低危: {s['risks_by_level']['low']}")

        if report["suggestions"]:
            print(f"\n  处理建议:")
            for sug in report["suggestions"]:
                print(f"\n    [{sug['priority']}] {sug['action']}")
                for item in sug['items']:
                    print(f"      • {item}")

        return 0

    def cmd_merge_info(self, args) -> int:
        """查看补录合并信息"""
        date = args.date or self._get_today()

        info = self.importer.get_merge_info(date)

        self._print_header(f"补录数据合并信息 - {date}")

        print(f"\n  巡检记录: {info['inspections']['count']} 条")
        if info['inspections']['can_correct']:
            print(f"    允许修改 ({len(info['inspections']['can_correct'])}条):")
            for t in info['inspections']['can_correct']:
                print(f"      - {t}")

        print(f"\n  UPS状态: {info['ups']['count']} 条")

        print(f"\n  空调告警: {info['ac_alarms']['count']} 条")

        self._print_separator()
        print("  合并规则说明:")
        print("  ✅ 允许改正 (当日记录):")
        print("     - 巡检数据录入错误（如温湿度数值、单位）")
        print("     - 漏录的正常巡检数据")
        print("     - 备注信息补充")
        print("  ❌ 必须退回 (历史记录):")
        print("     - 超过24小时的记录修改")
        print("     - 涉及风险判定的关键数据篡改")
        print("     - 已复核完成的数据修改（需主管审批）")

        return 0


def create_parser() -> argparse.ArgumentParser:
    """创建命令行解析器"""
    parser = argparse.ArgumentParser(
        prog="server-room",
        description="机房巡检温湿度 CLI 工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  server-room import --type inspection --file inspections.csv
  server-room check --date 2026-05-11
  server-room risks --date 2026-05-11
  server-room review --date 2026-05-11 --reviewer 张主管
  server-room export --date 2026-05-11 --format txt --output report.txt
  server-room status --date 2026-05-11
        """
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    import_parser = subparsers.add_parser("import", help="导入数据")
    import_parser.add_argument("--type", required=True,
                               choices=["inspection", "ups", "alarm"],
                               help="数据类型: inspection(巡检), ups(UPS状态), alarm(空调告警)")
    import_parser.add_argument("--file", required=True,
                               help="CSV文件路径")

    check_parser = subparsers.add_parser("check", help="检查风险")
    check_parser.add_argument("--date", help="检查日期 (YYYY-MM-DD, 默认今天)")

    risks_parser = subparsers.add_parser("risks", help="查看风险")
    risks_parser.add_argument("--date", help="日期 (YYYY-MM-DD, 默认今天)")

    review_parser = subparsers.add_parser("review", help="人工复核")
    review_parser.add_argument("--date", help="日期 (YYYY-MM-DD, 默认今天)")
    review_parser.add_argument("--reviewer", required=True,
                               help="复核人姓名")
    review_parser.add_argument("--status",
                               choices=["通过", "有异常", "驳回"],
                               help="复核状态")
    review_parser.add_argument("--notes", help="复核备注")
    review_parser.add_argument("--force", action="store_true",
                               help="覆盖已有复核记录")
    review_parser.add_argument("--undo", action="store_true",
                               help="撤销该日期的复核")

    export_parser = subparsers.add_parser("export", help="导出报告")
    export_parser.add_argument("--date", help="日期 (YYYY-MM-DD, 默认今天)")
    export_parser.add_argument("--format", default="txt",
                               choices=["txt", "json", "csv"],
                               help="输出格式 (默认: txt)")
    export_parser.add_argument("--output", help="输出文件路径")

    status_parser = subparsers.add_parser("status", help="查看状态")
    status_parser.add_argument("--date", help="日期 (YYYY-MM-DD, 默认今天)")

    merge_parser = subparsers.add_parser("merge-info",
                                         help="查看补录数据合并信息")
    merge_parser.add_argument("--date", help="日期 (YYYY-MM-DD, 默认今天)")

    return parser


def main() -> int:
    """主入口函数"""
    parser = create_parser()
    args = parser.parse_args()

    controller = CLIController()

    if args.command == "import":
        return controller.cmd_import(args)
    elif args.command == "check":
        return controller.cmd_check(args)
    elif args.command == "risks":
        return controller.cmd_risks(args)
    elif args.command == "review":
        return controller.cmd_review(args)
    elif args.command == "export":
        return controller.cmd_export(args)
    elif args.command == "status":
        return controller.cmd_status(args)
    elif args.command == "merge-info":
        return controller.cmd_merge_info(args)

    return 0


if __name__ == "__main__":
    sys.exit(main())
