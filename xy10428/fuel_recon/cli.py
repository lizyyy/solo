import argparse
import os
import sys
from pathlib import Path
from .importer import DataImporter
from .matcher import Matcher
from .analyzer import Analyzer
from .exporter import Exporter
from .review import ReviewManager
from .models import ReviewStatus


DEFAULT_DATA_DIR = Path(__file__).parent.parent / "data"
REVIEW_NOTES_FILE = DEFAULT_DATA_DIR / "review_notes.json"


def load_all_data(
    data_dir: Path = DEFAULT_DATA_DIR,
) -> tuple[DataImporter, ReviewManager]:
    importer = DataImporter()

    fuel_file = data_dir / "fuel_records.csv"
    mileage_file = data_dir / "mileage_records.csv"
    schedule_file = data_dir / "schedule_records.csv"
    vehicles_file = data_dir / "vehicles.csv"

    if fuel_file.exists():
        importer.load_fuel_records_from_csv(str(fuel_file))
    if mileage_file.exists():
        importer.load_mileage_records_from_csv(str(mileage_file))
    if schedule_file.exists():
        importer.load_schedule_records_from_csv(str(schedule_file))
    if vehicles_file.exists():
        importer.load_vehicles_from_csv(str(vehicles_file))

    review_manager = ReviewManager()
    if REVIEW_NOTES_FILE.exists():
        notes = importer.load_review_notes_from_json(str(REVIEW_NOTES_FILE))
        review_manager = ReviewManager(notes)

    return importer, review_manager


def run_reconcile(
    importer: DataImporter,
    review_manager: ReviewManager,
    threshold: float = 1.3,
) -> tuple[Matcher, Analyzer]:
    matcher = Matcher(
        fuel_records=importer.fuel_records,
        mileage_records=importer.mileage_records,
        schedule_records=importer.schedule_records,
        vehicles=importer.vehicles,
        review_notes=review_manager.get_all_notes(),
        fuel_threshold_multiplier=threshold,
    )
    matched = matcher.match_all()
    matched_with_reviews = review_manager.attach_notes_to_results(matched)
    analyzer = Analyzer(matched_with_reviews)
    return matcher, analyzer


def cmd_summary(args):
    importer, review_manager = load_all_data()
    if not importer.fuel_records:
        print("未找到加油流水数据。请先准备样例数据或导入数据。")
        return 1

    _, analyzer = run_reconcile(importer, review_manager, args.threshold)
    result = analyzer.reconcile()
    print(Exporter.export_summary_text(result))
    return 0


def cmd_detail(args):
    importer, review_manager = load_all_data()
    if not importer.fuel_records:
        print("未找到加油流水数据。")
        return 1

    _, analyzer = run_reconcile(importer, review_manager, args.threshold)

    if args.plate:
        results = analyzer.get_results_by_plate(args.plate)
        if not results:
            print(f"未找到车辆 {args.plate} 的加油记录。")
            return 1
        print(Exporter.export_detail_text(results, args.plate))
    else:
        result = analyzer.reconcile()
        print(Exporter.export_detail_text(result.matched_results))
    return 0


def cmd_review(args):
    importer, review_manager = load_all_data()

    fuel_record_id = args.record_id
    reviewer = args.reviewer
    status = ReviewStatus(args.status)
    conclusion = args.conclusion
    remarks = args.remarks or ""

    review_manager.add_review(
        fuel_record_id=fuel_record_id,
        reviewer=reviewer,
        status=status,
        conclusion=conclusion,
        remarks=remarks,
    )

    DEFAULT_DATA_DIR.mkdir(parents=True, exist_ok=True)
    importer.save_review_notes_to_json(str(REVIEW_NOTES_FILE), review_manager.get_all_notes())

    print(f"已为加油记录 {fuel_record_id} 添加复核：")
    print(f"  复核人: {reviewer}")
    print(f"  状态: {status.value}")
    print(f"  结论: {conclusion}")
    if remarks:
        print(f"  备注: {remarks}")

    return 0


def cmd_recalc(args):
    importer, review_manager = load_all_data()
    if not importer.fuel_records:
        print("未找到数据。")
        return 1

    _, analyzer = run_reconcile(importer, review_manager, args.threshold)
    result = analyzer.reconcile()

    print("=" * 70)
    print("重新计算完成！")
    print("=" * 70)
    print("\n【处理前后变化】")
    print(f"  总记录数: {result.total_records}")
    print(f"  正常记录: {result.normal_records}")
    print(f"  异常记录: {result.abnormal_records}")
    print(f"  异常率: {result.summary.get('abnormal_rate', 0)}%")
    print(f"  待复核: {result.summary.get('pending_review_count', 0)}")

    pending_drivers = result.pending_review_drivers
    if pending_drivers:
        print(f"\n【待复核司机】共 {len(pending_drivers)} 位")
        for driver, records in pending_drivers.items():
            amt = sum(r.fuel_record.fuel_amount for r in records)
            print(f"  - {driver}: {len(records)} 笔, ¥{amt:,.2f}")

    return 0


def cmd_export(args):
    importer, review_manager = load_all_data()
    if not importer.fuel_records:
        print("未找到数据。")
        return 1

    _, analyzer = run_reconcile(importer, review_manager, args.threshold)
    result = analyzer.reconcile()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if args.format == "csv":
        Exporter.export_to_csv(result, str(output_path))
        print(f"对账报告已导出到 CSV: {output_path}")
    elif args.format == "json":
        Exporter.export_to_json(result, str(output_path))
        print(f"对账报告已导出到 JSON: {output_path}")
    elif args.format == "text":
        content = Exporter.export_summary_text(result) + "\n\n"
        content += Exporter.export_detail_text(result.matched_results)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"对账报告已导出到文本: {output_path}")

    return 0


def main():
    parser = argparse.ArgumentParser(
        prog="fuel-recon",
        description="车队加油卡对账 CLI - 按车牌、时间和油耗标准匹配归属，识别异常并支持复核",
    )
    subparsers = parser.add_subparsers(title="命令", dest="command")

    summary_parser = subparsers.add_parser("summary", help="查看对账汇总（总金额、异常金额、待复核司机）")
    summary_parser.add_argument("--threshold", type=float, default=1.3, help="油耗阈值倍数（默认 1.3）")
    summary_parser.set_defaults(func=cmd_summary)

    detail_parser = subparsers.add_parser("detail", help="查看单车加油详情")
    detail_parser.add_argument("--plate", type=str, help="指定车牌号查看单车详情，不指定则查看全部")
    detail_parser.add_argument("--threshold", type=float, default=1.3, help="油耗阈值倍数")
    detail_parser.set_defaults(func=cmd_detail)

    review_parser = subparsers.add_parser("review", help="登记复核说明")
    review_parser.add_argument("--record-id", type=str, required=True, help="加油记录 ID")
    review_parser.add_argument("--reviewer", type=str, required=True, help="复核人姓名")
    review_parser.add_argument(
        "--status",
        type=str,
        choices=[s.value for s in ReviewStatus],
        default=ReviewStatus.CONFIRMED_NORMAL.value,
        help="复核状态",
    )
    review_parser.add_argument("--conclusion", type=str, required=True, help="复核结论")
    review_parser.add_argument("--remarks", type=str, default="", help="备注")
    review_parser.set_defaults(func=cmd_review)

    recalc_parser = subparsers.add_parser("recalc", help="重新计算对账")
    recalc_parser.add_argument("--threshold", type=float, default=1.3, help="油耗阈值倍数")
    recalc_parser.set_defaults(func=cmd_recalc)

    export_parser = subparsers.add_parser("export", help="导出对账报告")
    export_parser.add_argument("--output", "-o", type=str, required=True, help="输出文件路径")
    export_parser.add_argument(
        "--format",
        "-f",
        type=str,
        choices=["csv", "json", "text"],
        default="csv",
        help="导出格式",
    )
    export_parser.add_argument("--threshold", type=float, default=1.3, help="油耗阈值倍数")
    export_parser.set_defaults(func=cmd_export)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
