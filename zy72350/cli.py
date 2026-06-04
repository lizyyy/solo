#!/usr/bin/env python3
import argparse
import sys
from datetime import datetime
from replay_engine import DefrostReplayEngine
from demo_data import (
    create_demo_sampling_interval,
    create_demo_defrost_records_initial,
    create_demo_temperature_calibrations,
    create_demo_manual_correction,
    create_supplemented_record
)
from models import ManualCorrection, TemperatureCalibration, UnitCaliber


def main():
    parser = argparse.ArgumentParser(
        description="热泵除霜能耗复盘 - 老岑师傅的返工留痕工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例：
  python cli.py demo                              # 跑完整演示流程
  python cli.py import-interval                   # 导入采样间隔说明
  python cli.py import-records                    # 导入除霜记录
  python cli.py summary                           # 查看汇总
  python cli.py detail DEF-20250115-002           # 查看记录详情
  python cli.py pending                           # 查看待复核记录
  python cli.py supplement-calibration            # 补录温度校准记录
  python cli.py correct DEF-20250115-002 2.9 5.2  # 人工修正
  python cli.py rerun 老岑                        # 重跑
  python cli.py review DEF-20250115-002 abnormal  # 复核记录
        """
    )

    parser.add_argument(
        "command",
        choices=[
            "demo", "import-interval", "import-records",
            "summary", "detail", "pending",
            "supplement-calibration", "correct", "rerun", "review",
            "unit-note", "all"
        ],
        help="操作命令"
    )
    parser.add_argument("args", nargs="*", help="命令参数")

    args = parser.parse_args()
    engine = DefrostReplayEngine()

    if args.command == "demo":
        run_demo(engine)
    elif args.command == "import-interval":
        result = engine.import_sampling_interval(create_demo_sampling_interval())
        print(result)
    elif args.command == "import-records":
        result = engine.import_defrost_records(create_demo_defrost_records_initial())
        print(result)
    elif args.command == "summary":
        engine.import_sampling_interval(create_demo_sampling_interval())
        engine.import_defrost_records(create_demo_defrost_records_initial())
        print(engine.get_records_summary())
    elif args.command == "detail":
        if not args.args:
            print("❌ 请指定记录ID，如：python cli.py detail DEF-20250115-002")
            sys.exit(1)
        engine.import_sampling_interval(create_demo_sampling_interval())
        engine.import_defrost_records(create_demo_defrost_records_initial())
        print(engine.get_record_detail(args.args[0]))
    elif args.command == "pending":
        engine.import_sampling_interval(create_demo_sampling_interval())
        engine.import_defrost_records(create_demo_defrost_records_initial())
        pending = engine.get_pending_review_records()
        print(f"⏳ 待复核记录：{len(pending)} 条\n")
        for r in pending:
            status_label = engine._get_status_label(r.status)
            print(f"  {r.id} | {r.start_time.strftime('%H:%M')} | {r.energy_consumption_kwh} kWh | {status_label}")
    elif args.command == "supplement-calibration":
        engine.import_sampling_interval(create_demo_sampling_interval())
        engine.import_defrost_records(create_demo_defrost_records_initial())
        calibrations = create_demo_temperature_calibrations()
        result = engine.supplement_from_calibration(calibrations)
        print(result)
        print("\n" + engine.get_records_summary())
    elif args.command == "correct":
        if len(args.args) < 4:
            print("❌ 用法：python cli.py correct <record_id> <original_value> <corrected_value> <note>")
            sys.exit(1)
        engine.import_sampling_interval(create_demo_sampling_interval())
        engine.import_defrost_records(create_demo_defrost_records_initial())
        correction = ManualCorrection(
            correction_id=f"CORR-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            record_id=args.args[0],
            corrected_by="老岑",
            corrected_at=datetime.now(),
            original_value=float(args.args[1]),
            corrected_value=float(args.args[2]),
            correction_note=args.args[3] if len(args.args) > 3 else "人工修正"
        )
        result = engine.apply_manual_correction(correction)
        print(result)
    elif args.command == "rerun":
        engine.import_sampling_interval(create_demo_sampling_interval())
        engine.import_defrost_records(create_demo_defrost_records_initial())
        calibrations = create_demo_temperature_calibrations()
        engine.supplement_from_calibration(calibrations)
        run_by = args.args[0] if args.args else "老岑"
        description = args.args[1] if len(args.args) > 1 else ""
        result = engine.rerun(run_by, description)
        print(result)
    elif args.command == "review":
        if len(args.args) < 3:
            print("❌ 用法：python cli.py review <record_id> <normal|abnormal> <note>")
            sys.exit(1)
        engine.import_sampling_interval(create_demo_sampling_interval())
        engine.import_defrost_records(create_demo_defrost_records_initial())
        record_id = args.args[0]
        is_normal = args.args[1].lower() == "normal"
        note = args.args[2] if len(args.args) > 2 else ""
        result = engine.review_record(record_id, "老岑", is_normal, note)
        print(result)
    elif args.command == "unit-note":
        engine.import_sampling_interval(create_demo_sampling_interval())
        engine.import_defrost_records(create_demo_defrost_records_initial())
        print("📐 单位换算说明（补录前）：")
        print("  " + engine.unit_conversion.get_conversion_text().replace("\n", "\n  "))
        print("\n📥 补录温度校准记录（旧口径）...")
        calibrations = create_demo_temperature_calibrations()
        engine.supplement_from_calibration(calibrations)
        print("\n📐 单位换算说明（补录后）：")
        print("  " + engine.unit_conversion.get_conversion_text().replace("\n", "\n  "))
    elif args.command == "all":
        engine.import_sampling_interval(create_demo_sampling_interval())
        engine.import_defrost_records(create_demo_defrost_records_initial())
        calibrations = create_demo_temperature_calibrations()
        engine.supplement_from_calibration(calibrations)
        correction = create_demo_manual_correction()
        engine.apply_manual_correction(correction)
        engine.rerun("老岑", "完整演示重跑")
        print(engine.get_records_summary())
        print("\n" + "=" * 50 + "\n")
        for r in engine.records:
            print(engine.get_record_detail(r.id))
            print("-" * 50)


def run_demo(engine: DefrostReplayEngine):
    print_header("老岑师傅的热泵除霜能耗复盘 - 演示流程")

    print_step(1, "导入采样间隔说明")
    result = engine.import_sampling_interval(create_demo_sampling_interval())
    print(result)

    print_step(2, "导入除霜能耗记录")
    result = engine.import_defrost_records(create_demo_defrost_records_initial())
    print(result)

    print_step(3, "查看汇总 - 注意有一条被平均值盖掉了")
    print(engine.get_records_summary())

    print_step(4, "查看被盖掉的记录详情 - 别急着归正常，留着复核")
    print(engine.get_record_detail("DEF-20250115-002"))

    print_step(5, "查看待复核清单")
    pending = engine.get_pending_review_records()
    print(f"⏳ 待复核：{len(pending)} 条")
    for r in pending:
        status_label = engine._get_status_label(r.status)
        print(f"  • {r.id} | {r.start_time.strftime('%H:%M')} | {r.energy_consumption_kwh} kWh | {status_label}")

    print_step(6, "老岑师傅补看温度校准记录 - 发现是旧口径")
    calibrations = create_demo_temperature_calibrations()
    result = engine.supplement_from_calibration(calibrations)
    print(result)

    print_step(7, "查看单位换算说明 - 跟着变了！")
    print("📐 " + engine.unit_conversion.get_conversion_text().replace("\n", "\n   "))

    print_step(8, "老岑师傅人工修正 - 把被平均值盖掉的数据改回来")
    correction = create_demo_manual_correction()
    result = engine.apply_manual_correction(correction)
    print(result)

    print_step(9, "重跑 - 看看返工痕迹都留着没有")
    result = engine.rerun("老岑", "补录温度校准记录后的重跑")
    print(result)

    print_step(10, "复核记录 - 老岑给三种处理结果签字")
    print(engine.review_record(
        "DEF-20250115-001", "老岑", True,
        "顺利记录：正常除霜，能耗2.8度，没问题，过了"
    ))
    print()
    print(engine.review_record(
        "DEF-20250115-002", "老岑", False,
        "超阈值：5.2度超了3.5，被平均值盖过，恢复后确认是真实异常，那天寒潮"
    ))
    print()
    print(engine.review_record(
        "DEF-20250115-006", "老岑", False,
        "校准补录：从凌晨2点半的校准记录补来的，旧口径6.1度，确实超了"
    ))

    print_step(11, "最终汇总 - 三种处理结果清清楚楚")
    print(engine.get_records_summary())

    print_step(12, "看三条典型记录的完整痕迹")
    for rid in ["DEF-20250115-001", "DEF-20250115-002", "DEF-20250115-006"]:
        print("\n" + engine.get_record_detail(rid))
        print("-" * 50)

    print_footer("演示完成！老岑师傅说：返工就要返工在明面上，别偷偷摸摸改数据。")


def print_header(title: str):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70 + "\n")


def print_step(step: int, title: str):
    print(f"\n{'='*10} 步骤 {step}：{title} {'='*10}\n")


def print_footer(message: str):
    print("\n" + "=" * 70)
    print(f"  {message}")
    print("=" * 70 + "\n")


if __name__ == "__main__":
    main()
