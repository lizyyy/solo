import argparse
import sys
from typing import List, Optional
from datetime import datetime

from models import CylinderConversionRecord, RecordStatus, NextAction
from importer import (
    import_temperature_calibrations,
    import_pressure_data,
    create_conversion_records,
    check_caliber_mismatch
)
from sensor_detector import (
    SensorRegistry,
    process_sensor_abnormalities,
    require_safety_officer_review
)
from safety_reminder import (
    auto_apply_reminders,
    format_reminder_for_display,
    resolve_reminder
)
from converter import (
    update_sensor_and_refresh_reminders,
    update_pressure_data,
    fix_caliber,
    safety_officer_review,
    perform_conversion,
    manual_correct,
    rerun_conversion,
    can_convert
)
from demo_data import (
    create_demo_sensor_registry,
    create_physical_tag_map,
    get_expected_sensor_id_for_cylinder,
    DEMO_SCENARIO_DESCRIPTION
)


class ConversionSystem:
    def __init__(self):
        self.records: List[CylinderConversionRecord] = []
        self.registry: SensorRegistry = create_demo_sensor_registry()
        self.physical_tag_map = create_physical_tag_map()

    def import_calibrations(self, file_path: str):
        calibrations = import_temperature_calibrations(file_path)
        self.records = create_conversion_records(calibrations)
        self.records = check_caliber_mismatch(self.records)
        self.records = process_sensor_abnormalities(
            self.records, self.registry, self.physical_tag_map
        )
        for record in self.records:
            _, expected_id = get_expected_sensor_id_for_cylinder(
                record.cylinder_id, self.registry
            )
            auto_apply_reminders(record, expected_id)
        print(f"✅ 成功导入 {len(calibrations)} 条温度校准记录")
        return calibrations

    def import_pressure(self, file_path: str):
        pressure_data = import_pressure_data(file_path)
        for i, record in enumerate(self.records):
            if i < len(pressure_data):
                p = pressure_data[i]
                if record.cylinder_id == p.get("cylinder_id"):
                    record.raw_pressure = p.get("raw_pressure", 0)
                    record.add_log("导入压力数据", "系统", f"压力值: {record.raw_pressure} MPa")
                    _, expected_id = get_expected_sensor_id_for_cylinder(
                        record.cylinder_id, self.registry
                    )
                    auto_apply_reminders(record, expected_id)
        print(f"✅ 成功导入 {len(pressure_data)} 条压力数据")
        return pressure_data

    def list_records(self, show_all: bool = False):
        print("\n" + "=" * 80)
        print("气瓶压力温度换算记录列表")
        print("=" * 80)

        for i, record in enumerate(self.records):
            status_icon = "🔴" if record.status in [
                RecordStatus.SENSOR_ABNORMAL,
                RecordStatus.PENDING_REVIEW
            ] else "🟡" if record.status != RecordStatus.CONVERTED else "🟢"

            has_alert = any(not r.is_resolved for r in record.safety_reminders)
            alert_icon = " ⚠️" if has_alert else ""

            print(f"\n{status_icon} [{i+1}] {record.cylinder_id} "
                  f"状态: {record.status.value}{alert_icon}")
            print(f"    换算ID: {record.conversion_id}")
            print(f"    校准时间: {record.calibrate_time.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"    原始温度: {record.raw_temperature}℃ → "
                  f"校准温度: {record.calibrated_temperature}℃")
            print(f"    原始压力: {record.raw_pressure} MPa")

            if record.converted_pressure:
                print(f"    换算压力: {record.converted_pressure} MPa")

            if record.is_sensor_id_changed:
                print(f"    🔴 传感器编号异常: 上报[{record.sensor_id_original}] "
                      f"→ 确认[{record.sensor_id_confirmed or '未补录'}]")

            if record.caliber_mismatch:
                print(f"    🔴 口径不匹配: 期望[{record.caliber_expected}] "
                      f"实际[{record.caliber_actual}]")

            unresolved = [r for r in record.safety_reminders if not r.is_resolved]
            if unresolved:
                next_actions = set(r.next_action.value for r in unresolved)
                print(f"    ⚠️  待处理提醒 {len(unresolved)} 条, 下一步: {', '.join(next_actions)}")

        print("\n" + "=" * 80)

    def show_record(self, index: int):
        if index < 1 or index > len(self.records):
            print(f"❌ 记录编号 {index} 不存在")
            return

        record = self.records[index - 1]
        print("\n" + "=" * 80)
        print(f"📋 记录详情 - {record.cylinder_id}")
        print("=" * 80)

        print(f"\n【基本信息】")
        print(f"  换算ID: {record.conversion_id}")
        print(f"  校准记录ID: {record.temperature_calibration_id}")
        print(f"  校准时间: {record.calibrate_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"  当前状态: {record.status.value}")

        print(f"\n【温度数据】")
        print(f"  原始温度: {record.raw_temperature}℃")
        print(f"  校准温度: {record.calibrated_temperature}℃")

        print(f"\n【压力数据】")
        print(f"  原始压力: {record.raw_pressure} MPa")
        if record.converted_pressure:
            print(f"  换算压力: {record.converted_pressure} MPa")

        print(f"\n【传感器信息】")
        print(f"  上报编号: {record.sensor_id_original or '无'}")
        print(f"  确认编号: {record.sensor_id_confirmed or '未补录'}")
        print(f"  编号是否变化: {'是 🔴' if record.is_sensor_id_changed else '否'}")
        print(f"  传感器口径: {record.caliber_actual} (期望: {record.caliber_expected})")
        print(f"  口径是否匹配: {'否 🔴' if record.caliber_mismatch else '是'}")

        if record.manual_correction_note:
            print(f"\n【人工修正】")
            print(f"  修正说明: {record.manual_correction_note}")

        if record.rerun_count > 0:
            print(f"\n【重跑信息】")
            print(f"  重跑次数: {record.rerun_count}")

        print(f"\n【安全提醒】")
        if not record.safety_reminders:
            print("  暂无安全提醒")
        else:
            for r in record.safety_reminders:
                print("\n" + "-" * 60)
                print(format_reminder_for_display(r))

        print(f"\n【操作日志】")
        for log in record.operation_log:
            time_str = log["time"].strftime("%Y-%m-%d %H:%M:%S") if hasattr(log["time"], "strftime") else str(log["time"])
            print(f"  [{time_str}] {log['operator']} - {log['action']}")
            if log["note"]:
                print(f"      {log['note']}")

        print("\n" + "=" * 80)

    def update_sensor_id(self, index: int, sensor_id: str, operator: str = "老唐"):
        if index < 1 or index > len(self.records):
            print(f"❌ 记录编号 {index} 不存在")
            return

        record = self.records[index - 1]
        _, expected_id = get_expected_sensor_id_for_cylinder(
            record.cylinder_id, self.registry
        )

        record = update_sensor_and_refresh_reminders(
            record, sensor_id, operator, expected_id
        )

        print(f"✅ {operator} 已补录传感器编号:")
        print(f"   原上报: {record.sensor_id_original}")
        print(f"   确认编号: {sensor_id}")

        if require_safety_officer_review(record):
            print(f"\n⚠️  该记录传感器编号曾发生变化，已转入安全员复核队列")
            print(f"   下一步: 找安全员复核")

        return record

    def update_pressure(self, index: int, pressure: float, operator: str = "现场技术"):
        if index < 1 or index > len(self.records):
            print(f"❌ 记录编号 {index} 不存在")
            return

        record = self.records[index - 1]
        record = update_pressure_data(record, pressure, operator)
        print(f"✅ 已补录压力数据: {pressure} MPa")
        return record

    def fix_caliber(self, index: int, caliber: str, operator: str = "现场技术"):
        if index < 1 or index > len(self.records):
            print(f"❌ 记录编号 {index} 不存在")
            return

        record = self.records[index - 1]
        record = fix_caliber(record, caliber, operator)

        if record.caliber_mismatch:
            print(f"⚠️  口径仍不匹配: 期望[{record.caliber_expected}] 实际[{caliber}]")
        else:
            print(f"✅ 口径已修正为: {caliber}，匹配成功")
        return record

    def safety_review(self, index: int, result: str, approve: bool = True, operator: str = "安全员"):
        if index < 1 or index > len(self.records):
            print(f"❌ 记录编号 {index} 不存在")
            return

        record = self.records[index - 1]
        try:
            record = safety_officer_review(record, operator, result, approve)
            if approve:
                print(f"✅ 安全员复核通过: {result}")
            else:
                print(f"❌ 安全员复核不通过: {result}")
            return record
        except ValueError as e:
            print(f"❌ {e}")
            return None

    def convert(self, index: int, operator: str = "系统"):
        if index < 1 or index > len(self.records):
            print(f"❌ 记录编号 {index} 不存在")
            return

        record = self.records[index - 1]
        can_do, blockers = can_convert(record)

        if not can_do:
            print(f"❌ 无法进行换算，存在以下问题:")
            for b in blockers:
                print(f"   - {b}")
            return None

        try:
            record = perform_conversion(record, operator)
            print(f"✅ 换算完成:")
            print(f"   原始压力: {record.raw_pressure} MPa")
            print(f"   使用温度: {record.calibrated_temperature}℃")
            print(f"   换算结果: {record.converted_pressure} MPa")
            return record
        except ValueError as e:
            print(f"❌ {e}")
            return None

    def manual_correct(self, index: int, pressure: float, note: str, operator: str = "老唐"):
        if index < 1 or index > len(self.records):
            print(f"❌ 记录编号 {index} 不存在")
            return

        record = self.records[index - 1]
        record = manual_correct(record, pressure, operator, note)
        print(f"✅ 人工修正完成:")
        print(f"   修正结果: {pressure} MPa")
        print(f"   修正原因: {note}")
        return record

    def rerun(self, index: int, operator: str = "系统",
              new_pressure: Optional[float] = None,
              new_temp: Optional[float] = None):
        if index < 1 or index > len(self.records):
            print(f"❌ 记录编号 {index} 不存在")
            return

        record = self.records[index - 1]
        record.rerun_count += 1
        record.status = RecordStatus.RERUN

        try:
            record = rerun_conversion(
                record, operator,
                new_raw_pressure=new_pressure,
                new_raw_temperature=new_temp
            )
            print(f"✅ 重跑完成 (第{record.rerun_count}次):")
            print(f"   换算结果: {record.converted_pressure} MPa")
            return record
        except ValueError as e:
            print(f"❌ {e}")
            return None

    def show_sensors(self):
        print("\n" + "=" * 80)
        print("📡 传感器注册表")
        print("=" * 80)

        sensors = self.registry.list_all_sensors()
        for s in sensors:
            restart_str = ""
            if s.last_restart:
                minutes = int((datetime.now() - s.last_restart).total_seconds() / 60)
                restart_str = f" (最近重启: {minutes}分钟前)"

            print(f"\n  传感器编号: {s.sensor_id}{restart_str}")
            print(f"  物理标签: {s.physical_tag}")
            print(f"  安装位置: {s.location}")
            print(f"  安装日期: {s.install_date.strftime('%Y-%m-%d')}")

        print("\n" + "=" * 80)

    def show_demo_scenario(self):
        print(DEMO_SCENARIO_DESCRIPTION)


def run_interactive(system: ConversionSystem):
    print("\n" + "=" * 80)
    print("🔥 气瓶压力温度换算系统 - 交互模式")
    print("=" * 80)
    print("\n可用命令:")
    print("  list          - 列出所有记录")
    print("  show <N>      - 查看第N条记录详情")
    print("  sensors       - 查看传感器注册表")
    print("  update-sensor <N> <id> - 第N条记录补录传感器编号 (默认老唐)")
    print("  update-pressure <N> <val> - 第N条记录补录压力")
    print("  fix-caliber <N> <caliber> - 第N条记录修正口径")
    print("  review <N> <result> [--reject] - 安全员复核第N条记录")
    print("  convert <N>   - 对第N条记录执行换算")
    print("  correct <N> <pressure> <note> - 人工修正第N条记录")
    print("  rerun <N>     - 重跑第N条记录的换算")
    print("  demo          - 查看演示场景说明")
    print("  quit          - 退出")
    print("\n提示: 先运行 list 查看记录编号")

    while True:
        try:
            cmd = input("\n> ").strip()
            if not cmd:
                continue

            parts = cmd.split()
            action = parts[0].lower()

            if action in ["quit", "exit", "q"]:
                print("👋 再见")
                break

            elif action == "list":
                system.list_records()

            elif action == "show" and len(parts) >= 2:
                system.show_record(int(parts[1]))

            elif action == "sensors":
                system.show_sensors()

            elif action == "update-sensor" and len(parts) >= 3:
                system.update_sensor_id(int(parts[1]), parts[2])

            elif action == "update-pressure" and len(parts) >= 3:
                system.update_pressure(int(parts[1]), float(parts[2]))

            elif action == "fix-caliber" and len(parts) >= 3:
                system.fix_caliber(int(parts[1]), parts[2])

            elif action == "review" and len(parts) >= 3:
                approve = "--reject" not in parts
                result = " ".join(p for p in parts[2:] if p != "--reject")
                system.safety_review(int(parts[1]), result, approve)

            elif action == "convert" and len(parts) >= 2:
                system.convert(int(parts[1]))

            elif action == "correct" and len(parts) >= 4:
                pressure = float(parts[2])
                note = " ".join(parts[3:])
                system.manual_correct(int(parts[1]), pressure, note)

            elif action == "rerun" and len(parts) >= 2:
                system.rerun(int(parts[1]))

            elif action == "demo":
                system.show_demo_scenario()

            else:
                print("❌ 未知命令，输入 help 查看帮助")

        except KeyboardInterrupt:
            print("\n👋 再见")
            break
        except Exception as e:
            print(f"❌ 命令执行失败: {e}")


def main():
    parser = argparse.ArgumentParser(
        description="气瓶压力温度换算系统\n"
                    "处理温度校准记录导入、传感器异常检测、安全提醒、压力换算等",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 交互模式（推荐，可逐步走流程）
  python3 cli.py --interactive

  # 使用演示数据
  python3 cli.py --calib demo_data/calibrations.csv --pressure demo_data/pressure.csv

  # 导入后直接查看列表
  python3 cli.py --calib demo_data/calibrations.csv --list

  # 查看第1条记录详情
  python3 cli.py --calib demo_data/calibrations.csv --show 1
        """
    )

    parser.add_argument("--calib", help="温度校准记录文件 (CSV/JSON)")
    parser.add_argument("--pressure", help="压力数据文件 (CSV/JSON)")
    parser.add_argument("--list", action="store_true", help="列出所有记录")
    parser.add_argument("--show", type=int, help="查看指定记录详情")
    parser.add_argument("--sensors", action="store_true", help="查看传感器注册表")
    parser.add_argument("--interactive", "-i", action="store_true", help="进入交互模式")
    parser.add_argument("--demo", action="store_true", help="显示演示场景说明")

    args = parser.parse_args()

    system = ConversionSystem()

    if args.demo:
        system.show_demo_scenario()
        return

    if args.calib:
        system.import_calibrations(args.calib)

    if args.pressure:
        system.import_pressure(args.pressure)

    if args.sensors:
        system.show_sensors()

    if args.list:
        system.list_records()

    if args.show:
        system.show_record(args.show)

    if args.interactive:
        run_interactive(system)

    if not any([args.calib, args.pressure, args.list, args.show,
                args.sensors, args.interactive, args.demo]):
        parser.print_help()


if __name__ == "__main__":
    main()
