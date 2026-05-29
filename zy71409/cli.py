import argparse
import json
import os
import sys
from datetime import date

from models import CustAssessment, ProdGrade, PurchaseApp, RiskLevel
from engine import SuitabilityEngine
from exporter import Exporter
from correction_store import CorrectionStore


def build_sample_data():
    assessments = {
        "C001": CustAssessment(
            cust_id="C001",
            risk_level=RiskLevel.R3,
            assess_date=date(2025, 6, 1),
            expiry_date=date(2026, 5, 31),
            source="测评系统",
        ),
        "C002": CustAssessment(
            cust_id="C002",
            risk_level=RiskLevel.R2,
            assess_date=date(2025, 1, 1),
            expiry_date=date(2026, 1, 1),
            source="测评系统",
        ),
        "C003": CustAssessment(
            cust_id="C003",
            risk_level=RiskLevel.R4,
            assess_date=date(2025, 8, 15),
            expiry_date=date(2026, 8, 15),
            source="测评系统",
        ),
        "C004": CustAssessment(
            cust_id="C004",
            risk_level=RiskLevel.R1,
            assess_date=date(2025, 3, 1),
            expiry_date=date(2026, 3, 1),
            source="测评系统",
        ),
    }

    grades = {
        "FUND001": ProdGrade(
            prod_code="FUND001",
            risk_level=RiskLevel.R3,
            grade_date=date(2025, 7, 1),
            version="2.1",
            source="产品评级系统",
        ),
        "FUND002": ProdGrade(
            prod_code="FUND002",
            risk_level=RiskLevel.R4,
            grade_date=date(2025, 5, 10),
            version="1.3",
            source="产品评级系统",
        ),
        "FUND003": ProdGrade(
            prod_code="FUND003",
            risk_level=RiskLevel.R2,
            grade_date=date(2025, 9, 20),
            version="3.0",
            source="产品评级系统",
        ),
    }

    apps = [
        PurchaseApp(
            app_id="APP001",
            cust_id="C001",
            prod_code="FUND001",
            amount=50000.0,
            app_date=date(2026, 5, 15),
            has_recording=True,
            recording_id="REC001",
            source="交易系统",
        ),
        PurchaseApp(
            app_id="APP002",
            cust_id="C002",
            prod_code="FUND002",
            amount=100000.0,
            app_date=date(2026, 3, 1),
            has_recording=True,
            recording_id="REC002",
            source="交易系统",
        ),
        PurchaseApp(
            app_id="APP003",
            cust_id="C003",
            prod_code="FUND001",
            amount=30000.0,
            app_date=date(2026, 4, 20),
            has_recording=False,
            source="交易系统",
        ),
        PurchaseApp(
            app_id="APP004",
            cust_id="C004",
            prod_code="FUND003",
            amount=20000.0,
            app_date=date(2026, 4, 1),
            has_recording=False,
            source="交易系统",
        ),
        PurchaseApp(
            app_id="APP005",
            cust_id="C002",
            prod_code="FUND003",
            amount=80000.0,
            app_date=date(2026, 2, 15),
            has_recording=True,
            recording_id="REC005",
            source="交易系统",
        ),
    ]

    return apps, assessments, grades


def load_data_from_file(data_path: str):
    with open(data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    assessments = {}
    for a in data.get("assessments", []):
        assessments[a["cust_id"]] = CustAssessment(
            cust_id=a["cust_id"],
            risk_level=RiskLevel(a["risk_level"]),
            assess_date=date.fromisoformat(a["assess_date"]),
            expiry_date=date.fromisoformat(a["expiry_date"]),
            source=a.get("source", "测评系统"),
        )

    grades = {}
    for g in data.get("grades", []):
        grades[g["prod_code"]] = ProdGrade(
            prod_code=g["prod_code"],
            risk_level=RiskLevel(g["risk_level"]),
            grade_date=date.fromisoformat(g["grade_date"]),
            version=g["version"],
            source=g.get("source", "产品评级系统"),
        )

    apps = []
    for ap in data.get("apps", []):
        apps.append(
            PurchaseApp(
                app_id=ap["app_id"],
                cust_id=ap["cust_id"],
                prod_code=ap["prod_code"],
                amount=ap["amount"],
                app_date=date.fromisoformat(ap["app_date"]),
                has_recording=ap["has_recording"],
                recording_id=ap.get("recording_id"),
                source=ap.get("source", "交易系统"),
            )
        )

    return apps, assessments, grades


def cmd_scan(args):
    if args.data:
        apps, assessments, grades = load_data_from_file(args.data)
    else:
        apps, assessments, grades = build_sample_data()

    engine = SuitabilityEngine(
        reference_date=date.fromisoformat(args.date) if args.date else date.today()
    )
    batch_result = engine.check_batch(apps, assessments, grades)
    Exporter.to_console(batch_result)

    if args.output:
        Exporter.to_json(batch_result, args.output)
        print(f"\n已导出至: {args.output}")


def cmd_export(args):
    if args.data:
        apps, assessments, grades = load_data_from_file(args.data)
    else:
        apps, assessments, grades = build_sample_data()

    engine = SuitabilityEngine(
        reference_date=date.fromisoformat(args.date) if args.date else date.today()
    )
    batch_result = engine.check_batch(apps, assessments, grades)

    fmt = args.format or "json"

    if fmt == "json":
        output_path = args.output or "suitability_report.json"
        Exporter.to_json(batch_result, output_path)
        print(f"已导出JSON: {output_path}")
    elif fmt == "csv":
        output_dir = args.output or "suitability_export"
        normal_path, problematic_path = Exporter.to_csv(batch_result, output_dir)
        print(f"已导出CSV:")
        print(f"  正常记录: {normal_path}")
        print(f"  问题记录: {problematic_path}")
    else:
        print(f"不支持的格式: {fmt}，请使用 json 或 csv")
        sys.exit(1)


def cmd_correct(args):
    store = CorrectionStore(args.store or "corrections.json")
    correction = store.record_correction(
        app_id=args.app_id,
        field_name=args.field,
        old_value=args.old,
        new_value=args.new,
        reason=args.reason,
        operator=args.operator or "unknown",
    )
    print("修正已记录:")
    print(f"  申请号: {correction.app_id}")
    print(f"  字段: {correction.field_name}")
    print(f"  旧值: {correction.old_value}")
    print(f"  新值: {correction.new_value}")
    print(f"  理由: {correction.reason}")
    print(f"  操作人: {correction.operator}")
    print(f"  时间: {correction.corrected_at.isoformat()}")


def cmd_history(args):
    store = CorrectionStore(args.store or "corrections.json")
    app_id = args.app_id if hasattr(args, "app_id") and args.app_id else None
    output = store.format_history(app_id)
    print(output)


def main():
    parser = argparse.ArgumentParser(
        prog="基金销售适当性留痕",
        description="基金销售适当性留痕校验与复查工具",
    )
    subparsers = parser.add_subparsers(dest="command", help="子命令")

    scan_parser = subparsers.add_parser("scan", help="校验适当性材料")
    scan_parser.add_argument("--data", help="数据文件路径(JSON)，不指定则用示例数据")
    scan_parser.add_argument("--date", help="参照日期(YYYY-MM-DD)，默认今天")
    scan_parser.add_argument("--output", "-o", help="输出JSON文件路径")

    export_parser = subparsers.add_parser("export", help="导出校验结果")
    export_parser.add_argument("--data", help="数据文件路径(JSON)，不指定则用示例数据")
    export_parser.add_argument("--date", help="参照日期(YYYY-MM-DD)，默认今天")
    export_parser.add_argument("--format", "-f", choices=["json", "csv"], default="json", help="导出格式")
    export_parser.add_argument("--output", "-o", help="输出路径")

    correct_parser = subparsers.add_parser("correct", help="人工修正留痕")
    correct_parser.add_argument("--app-id", required=True, help="申请号")
    correct_parser.add_argument("--field", required=True, help="修正字段名")
    correct_parser.add_argument("--old", required=True, help="旧值")
    correct_parser.add_argument("--new", required=True, help="新值")
    correct_parser.add_argument("--reason", required=True, help="修正理由")
    correct_parser.add_argument("--operator", help="操作人")
    correct_parser.add_argument("--store", help="修正记录存储路径")

    history_parser = subparsers.add_parser("history", help="查看修正历史")
    history_parser.add_argument("--app-id", help="按申请号筛选")
    history_parser.add_argument("--store", help="修正记录存储路径")

    args = parser.parse_args()

    if args.command == "scan":
        cmd_scan(args)
    elif args.command == "export":
        cmd_export(args)
    elif args.command == "correct":
        cmd_correct(args)
    elif args.command == "history":
        cmd_history(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
