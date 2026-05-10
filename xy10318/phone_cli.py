#!/usr/bin/env python3
import argparse
import json
import os
import sys
from datetime import datetime
from typing import Optional

from phone_inspection import (
    PricingEngine,
    PhoneInfo,
    InspectionResult,
    StorageManager,
)


def format_price(amount: float) -> str:
    return f"¥{amount:,.2f}"


def format_percent(percent: float) -> str:
    return f"{percent * 100:.1f}%"


def print_pricing_result(result):
    print("\n" + "=" * 70)
    print("  二手手机质检定价报告")
    print("=" * 70)
    
    print("\n【手机基础信息】")
    print(f"  IMEI:      {result.phone_info.imei}")
    print(f"  型号:      {result.phone_info.model}")
    print(f"  存储:      {result.phone_info.storage}")
    print(f"  颜色:      {result.phone_info.color}")
    print(f"  购买日期:  {result.phone_info.purchase_date}")
    print(f"  保修状态:  {result.phone_info.warranty_status}")
    
    print("\n【价格计算详情】")
    print(f"  参考基准价: {format_price(result.base_price)}")
    print(f"  成色等级:   {result.quality_level} - {result.level_description}")
    
    print("\n【扣减明细】")
    if result.deductions:
        print(f"  {'项目':<10} {'扣减说明':<35} {'比例':>8} {'金额':>12}")
        print("  " + "-" * 70)
        for ded in result.deductions:
            print(
                f"  {ded.category:<10} {ded.description:<35} "
                f"{format_percent(ded.deduction_percent):>8} "
                f"{format_price(ded.deduction_amount):>12}"
            )
    else:
        print("  无扣减项目")
    
    print("  " + "-" * 70)
    print(
        f"  扣减合计: {'':<35} {format_percent(result.total_deduction_percent):>8} "
        f"{format_price(result.total_deduction_amount):>12}"
    )
    
    if result.is_manual_adjusted:
        adj = "+" if result.manual_adjustment > 0 else ""
        print(f"  人工调整: {'':<35} {'':>8} {adj}{format_price(result.manual_adjustment):>12}")
    
    print("\n" + "=" * 70)
    print(f"  最终报价: {format_price(result.final_price)}")
    print("=" * 70)
    
    if result.anomalies:
        print("\n【异常提示】")
        for anomaly in result.anomalies:
            print(f"  ⚠️  {anomaly}")
        print("\n  ⚠️  此单需要人工复核，已加入异常列表")
    
    if result.is_manual_adjusted:
        print("\n【人工改判】")
        print(f"  此单已进行人工调整，调整金额: {format_price(result.manual_adjustment)}")
    
    print("\n" + "=" * 70)


def import_phone_data(
    args: argparse.Namespace,
    engine: PricingEngine,
    storage: StorageManager,
):
    try:
        with open(args.input, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"读取文件失败: {e}")
        sys.exit(1)
    
    phone_data = data.get("phone_info", {})
    inspection_data = data.get("inspection", {})
    
    phone_info = PhoneInfo(
        imei=phone_data["imei"],
        model=phone_data["model"],
        storage=phone_data["storage"],
        color=phone_data["color"],
        purchase_date=phone_data.get("purchase_date", ""),
        warranty_status=phone_data.get("warranty_status", "out_of_warranty"),
    )
    
    inspection = InspectionResult(
        screen_condition=inspection_data["screen_condition"],
        frame_condition=inspection_data["frame_condition"],
        camera_condition=inspection_data["camera_condition"],
        battery_health=inspection_data["battery_health"],
        repair_history=inspection_data.get("repair_history", "none"),
        repair_proof=inspection_data.get("repair_proof", False),
        functional_issues=inspection_data.get("functional_issues", []),
        notes=inspection_data.get("notes", ""),
    )
    
    manual_adj = 0.0
    if storage.imei_exists(phone_info.imei):
        print(f"\n⚠️  发现IMEI重复: {phone_info.imei}")
        existing = storage.get_record(phone_info.imei)
        print(f"  现有记录 - 型号: {existing['phone_info']['model']}, "
              f"状态: {existing['status']}")
        
        if args.update:
            print("  ✓ 已指定 --update，将更新现有记录")
        else:
            choice = input("\n是否更新现有记录? (y/n): ").strip().lower()
            if choice != "y":
                print("已取消导入。")
                return
    elif args.update:
        print(f"未找到IMEI记录: {phone_info.imei}，将作为新记录导入")
    
    result = engine.calculate_price(
        phone_info=phone_info,
        inspection=inspection,
        manual_adjustment=manual_adj,
    )
    
    print_pricing_result(result)
    
    if args.update:
        storage.update_record(phone_info.imei, result)
        print(f"\n✓ 记录已更新: IMEI {phone_info.imei}")
    else:
        storage.save_pricing_result(result)
        print(f"\n✓ 记录已保存: IMEI {phone_info.imei}")


def trial_calculate(
    args: argparse.Namespace,
    engine: PricingEngine,
    storage: StorageManager,
):
    try:
        with open(args.input, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        print(f"读取文件失败: {e}")
        sys.exit(1)
    
    phone_data = data.get("phone_info", {})
    inspection_data = data.get("inspection", {})
    
    phone_info = PhoneInfo(
        imei=phone_data["imei"],
        model=phone_data["model"],
        storage=phone_data["storage"],
        color=phone_data["color"],
        purchase_date=phone_data.get("purchase_date", ""),
        warranty_status=phone_data.get("warranty_status", "out_of_warranty"),
    )
    
    inspection = InspectionResult(
        screen_condition=inspection_data["screen_condition"],
        frame_condition=inspection_data["frame_condition"],
        camera_condition=inspection_data["camera_condition"],
        battery_health=inspection_data["battery_health"],
        repair_history=inspection_data.get("repair_history", "none"),
        repair_proof=inspection_data.get("repair_proof", False),
        functional_issues=inspection_data.get("functional_issues", []),
        notes=inspection_data.get("notes", ""),
    )
    
    result = engine.calculate_price(
        phone_info=phone_info,
        inspection=inspection,
    )
    
    print_pricing_result(result)
    print("\nℹ️  这是试算结果，不会保存到数据库。")


def manual_adjust(
    args: argparse.Namespace,
    engine: PricingEngine,
    storage: StorageManager,
):
    imei = args.imei
    record = storage.get_record(imei)
    
    if not record:
        print(f"未找到IMEI记录: {imei}")
        sys.exit(1)
    
    print(f"\n当前记录 - IMEI: {imei}")
    print(f"  型号: {record['phone_info']['model']}")
    print(f"  当前报价: {format_price(record['final_price'])}")
    
    adjustment = args.adjustment
    if adjustment is None:
        try:
            adjustment = float(input("\n请输入调整金额（正数加价，负数降价）: "))
        except ValueError:
            print("无效的金额输入。")
            sys.exit(1)
    
    phone_info = PhoneInfo(**record["phone_info"])
    inspection = InspectionResult(**record["inspection"])
    
    result = engine.calculate_price(
        phone_info=phone_info,
        inspection=inspection,
        manual_adjustment=adjustment,
    )
    
    print_pricing_result(result)
    
    confirm = input("\n确认保存此人工调整? (y/n): ").strip().lower()
    if confirm == "y":
        storage.update_record(imei, result)
        print(f"✓ 已保存人工调整，新报价: {format_price(result.final_price)}")
    else:
        print("已取消。")


def confirm_quote(
    args: argparse.Namespace,
    engine: PricingEngine,
    storage: StorageManager,
):
    imei = args.imei
    record = storage.get_record(imei)
    
    if not record:
        print(f"未找到IMEI记录: {imei}")
        sys.exit(1)
    
    if record["status"] == "confirmed":
        print(f"此记录已在 {record.get('confirmed_at', 'N/A')} 确认过。")
        return
    
    print(f"\n确认记录 - IMEI: {imei}")
    print(f"  型号: {record['phone_info']['model']}")
    print(f"  报价: {format_price(record['final_price'])}")
    
    if record.get("needs_manual_review") and not record.get("is_manual_adjusted"):
        print("\n⚠️  此记录存在异常或需要复核，但尚未进行人工处理。")
        choice = input("是否仍然确认报价? (y/n): ").strip().lower()
        if choice != "y":
            print("已取消确认。")
            return
    
    phone_info = PhoneInfo(**record["phone_info"])
    inspection = InspectionResult(**record["inspection"])
    
    result = engine.calculate_price(
        phone_info=phone_info,
        inspection=inspection,
        manual_adjustment=record.get("manual_adjustment", 0.0),
    )
    result.status = "confirmed"
    
    storage.update_record(imei, result)
    print(f"\n✓ 报价已确认: {format_price(result.final_price)}")


def export_records(
    args: argparse.Namespace,
    engine: PricingEngine,
    storage: StorageManager,
):
    if args.confirmed_only:
        records = storage.get_confirmed_records()
    else:
        records = storage.get_all_records()
    
    if not records:
        print("没有可导出的记录。")
        return
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    default_filename = f"inspection_report_{timestamp}.json"
    output_file = args.output or default_filename
    
    export_data = {
        "export_time": datetime.now().isoformat(),
        "record_count": len(records),
        "records": records,
    }
    
    try:
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
        print(f"✓ 已导出 {len(records)} 条记录到: {output_file}")
    except Exception as e:
        print(f"导出失败: {e}")
        sys.exit(1)


def list_anomalies(
    args: argparse.Namespace,
    engine: PricingEngine,
    storage: StorageManager,
):
    anomalies = storage.get_anomaly_list()
    
    if not anomalies:
        print("异常列表为空。")
        return
    
    print("\n" + "=" * 80)
    print("  异常/待复核列表")
    print("=" * 80)
    print(f"  {'IMEI':<16} {'型号':<20} {'等级':<6} {'状态':<15} {'异常描述'}")
    print("  " + "-" * 80)
    
    for item in anomalies:
        anomaly_desc = "; ".join(item.get("anomalies", []))
        if not anomaly_desc:
            anomaly_desc = "需要人工复核"
        
        print(
            f"  {item['imei']:<16} {item['model']:<20} "
            f"{item['quality_level']:<6} {item['status']:<15} "
            f"{anomaly_desc}"
        )
    
    print("  " + "-" * 80)
    print(f"  共 {len(anomalies)} 条记录\n")


def list_available_models():
    from phone_inspection import BASE_PRICES
    print("\n支持的型号及参考基准价:")
    print(f"  {'型号':<25} {'基准价':>12}")
    print("  " + "-" * 40)
    for model, price in BASE_PRICES.items():
        print(f"  {model:<25} {format_price(price):>12}")
    print()


def main():
    parser = argparse.ArgumentParser(
        description="二手手机质检定价CLI工具 - 给回收门店用",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python phone_cli.py trial -i sample_high_value.json    # 试算定价
  python phone_cli.py import -i sample_heavy_deduction.json  # 导入并保存
  python phone_cli.py manual --imei 123456789012345 --adjustment +200  # 人工加价
  python phone_cli.py confirm --imei 123456789012345    # 确认报价
  python phone_cli.py anomalies                          # 查看异常列表
  python phone_cli.py export -o report.json             # 导出质检单
        """,
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    parser_trial = subparsers.add_parser("trial", help="试算定价（不保存）")
    parser_trial.add_argument("-i", "--input", required=True, help="质检数据JSON文件")
    
    parser_import = subparsers.add_parser("import", help="导入质检数据并保存")
    parser_import.add_argument("-i", "--input", required=True, help="质检数据JSON文件")
    parser_import.add_argument("--update", action="store_true", help="如果IMEI存在则更新")
    
    parser_manual = subparsers.add_parser("manual", help="人工改判价格")
    parser_manual.add_argument("--imei", required=True, help="手机IMEI号")
    parser_manual.add_argument("--adjustment", type=float, help="调整金额（正加负减）")
    
    parser_confirm = subparsers.add_parser("confirm", help="确认报价")
    parser_confirm.add_argument("--imei", required=True, help="手机IMEI号")
    
    parser_export = subparsers.add_parser("export", help="导出质检单")
    parser_export.add_argument("-o", "--output", help="输出文件路径")
    parser_export.add_argument("--confirmed-only", action="store_true", help="只导出已确认的")
    
    parser_anomalies = subparsers.add_parser("anomalies", help="查看异常列表")
    
    parser_models = subparsers.add_parser("models", help="查看支持的型号和基准价")
    
    args = parser.parse_args()
    
    if args.command == "models":
        list_available_models()
        return
    
    engine = PricingEngine()
    storage = StorageManager()
    
    commands = {
        "trial": trial_calculate,
        "import": import_phone_data,
        "manual": manual_adjust,
        "confirm": confirm_quote,
        "export": export_records,
        "anomalies": list_anomalies,
    }
    
    if args.command in commands:
        commands[args.command](args, engine, storage)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
