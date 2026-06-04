#!/usr/bin/env python3
import sys
import os
from typing import List
from models import ShockDataPoint, TempUnit
from workflow import WorkflowEngine
from visualizer import Chart3D
from report_renderer import ReportRenderer

def create_fresh_shock_data():
    return [
        ShockDataPoint(time_ms=0, acceleration_g=1.0, altitude_m=1000.0, velocity_m_s=0.0),
        ShockDataPoint(time_ms=50, acceleration_g=2.3, altitude_m=980.0, velocity_m_s=15.2),
        ShockDataPoint(time_ms=100, acceleration_g=5.8, altitude_m=920.0, velocity_m_s=35.6),
        ShockDataPoint(time_ms=150, acceleration_g=12.4, altitude_m=850.0, velocity_m_s=55.2),
        ShockDataPoint(time_ms=200, acceleration_g=18.7, altitude_m=760.0, velocity_m_s=68.9),
        ShockDataPoint(time_ms=250, acceleration_g=16.2, altitude_m=680.0, velocity_m_s=62.1),
        ShockDataPoint(time_ms=300, acceleration_g=8.5, altitude_m=600.0, velocity_m_s=48.3),
        ShockDataPoint(time_ms=350, acceleration_g=4.2, altitude_m=530.0, velocity_m_s=32.8),
        ShockDataPoint(time_ms=400, acceleration_g=2.1, altitude_m=480.0, velocity_m_s=18.5),
        ShockDataPoint(time_ms=450, acceleration_g=1.2, altitude_m=450.0, velocity_m_s=8.2),
    ]


class ParachuteShockCLI:
    def __init__(self):
        self.engine = WorkflowEngine()
        self.chart = None
        self.renderer = None

    def _refresh(self):
        if self.engine.state.shock_data:
            self.chart = Chart3D(self.engine.state)
        self.renderer = ReportRenderer(self.engine.state)

    def cmd_help(self, *args):
        help_text = """
降落伞开伞冲击 命令行工具
========================

可用命令:
  import [文件路径]        第一步: 导入采样间隔说明 (默认使用 sample_data/sampling_spec.txt)
  shock                    导入开伞冲击试验数据
  status                   查看当前工作阶段和状态
  chart [3d|2d]            查看3D或2D图表展示
  click <点号>             点击数据点，回溯采样间隔说明和校准记录
  list                     列出所有可点击的混用数据点
  calibrate <点号>         第二步: 林老师补录温度校准记录 (交互模式)
  update [教练备注]        第三步: 更新交接报告
  report                   查看完整交接报告
  demo                     运行完整演示流程
  help                     显示此帮助
  exit                     退出

示例:
  import sample_data/sampling_spec.txt
  shock
  chart 3d
  click 1
  calibrate 1
  update
  report
"""
        print(help_text)

    def cmd_import(self, *args):
        file_path = args[0] if args else "sample_data/sampling_spec.txt"
        if not os.path.exists(file_path):
            print(f"❌ 文件不存在: {file_path}")
            return

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except Exception as e:
            print(f"❌ 读取文件失败: {e}")
            return

        self.engine.step1_import_sampling_spec(content, file_path)
        self._refresh()

        print(f"✅ 已导入采样间隔说明: {file_path}")
        spec = self.engine.state.sampling_spec
        if spec:
            print(f"   解析到 {len(spec.readings)} 个温度读数")
            if spec.has_mixed_units:
                print(f"   ⚠️  检测到摄氏度/开尔文混用，涉及 {len(spec.mixed_unit_points)} 个数据点")
                print(f"   混用点: {spec.mixed_unit_points}")
            else:
                print(f"   ✓ 温度单位一致")

    def cmd_shock(self, *args):
        try:
            data = create_fresh_shock_data()
            self.engine.step1_import_shock_data(data)
            self._refresh()
            print(f"✅ 已导入 {len(data)} 个开伞冲击数据点")
            mixed = [i for i, p in enumerate(self.engine.state.shock_data) if p.has_mixed_units]
            if mixed:
                print(f"   ⚠️  其中 {len(mixed)} 个点关联了温度单位混用的采样记录")
        except ValueError as e:
            print(f"❌ {e}")

    def cmd_status(self, *args):
        if self.renderer:
            print(self.renderer.render_stage_banner())

    def cmd_chart(self, *args):
        if not self.chart:
            print("❌ 请先导入数据 (import + shock)")
            return
        mode = args[0] if args else "3d"
        print(self.chart.render_chart(mode))

    def cmd_click(self, *args):
        if not self.chart:
            print("❌ 请先导入数据")
            return
        if not args:
            print("❌ 请指定数据点号，例如: click 1")
            return
        try:
            idx = int(args[0])
            result = self.chart.click_point(idx)
            print(self.renderer.render_click_result(result))
        except ValueError:
            print("❌ 请输入有效的数字点号")

    def cmd_list(self, *args):
        if not self.chart:
            print("❌ 请先导入数据")
            return
        points = self.chart.list_clickable_points()
        if points:
            print(f"可点击的单位混用数据点: {points}")
            print("执行 click <点号> 查看详情")
        else:
            print("暂无单位混用的数据点")

    def cmd_calibrate(self, *args):
        if not args:
            print("❌ 请指定数据点号，例如: calibrate 1")
            return
        try:
            idx = int(args[0])
        except ValueError:
            print("❌ 请输入有效的数字点号")
            return

        print(f"\n📋 林老师正在为数据点 {idx} 补录温度校准记录...")
        print("请输入校准信息 (直接回车使用默认值):")

        instrument = input("  仪器编号 [INS-2026-001]: ").strip() or "INS-2026-001"
        temp_str = input("  校准温度 [0°C]: ").strip() or "0"
        unit_str = input("  温度单位 (°C/K) [°C]: ").strip() or "°C"
        remarks = input("  备注 [已用标准温度计校准，误差±0.5°C]: ").strip() or "已用标准温度计校准，误差±0.5°C"

        try:
            temp = float(temp_str)
        except ValueError:
            temp = 0.0

        unit = TempUnit.KELVIN if unit_str.upper() == "K" else TempUnit.CELSIUS

        self.engine.step2_lin_add_calibration(
            data_point_ids=[idx],
            instrument_id=instrument,
            calibration_temp=temp,
            calibration_unit=unit,
            remarks=remarks
        )
        self._refresh()
        print(f"\n✅ 林老师已为数据点 {idx} 录入校准记录")
        print(self.renderer.render_stage_banner())

    def cmd_update(self, *args):
        coach_notes = " ".join(args) if args else ""
        self.engine.step3_update_report(coach_notes)
        self._refresh()
        print("✅ 交接报告已更新")
        print(self.renderer.render_stage_banner())

    def cmd_report(self, *args):
        if self.renderer:
            print(self.renderer.render_full_report())

    def cmd_demo(self, *args):
        print("🚀 运行降落伞开伞冲击完整演示流程\n")

        print("=" * 80)
        print("【第一步：导入采样间隔说明】")
        print("=" * 80)
        self.cmd_import("sample_data/sampling_spec.txt")

        print("\n" + "=" * 80)
        print("【导入开伞冲击数据】")
        print("=" * 80)
        self.cmd_shock()

        print("\n" + "=" * 80)
        print("【查看当前状态】")
        print("=" * 80)
        self.cmd_status()

        print("\n" + "=" * 80)
        print("【查看3D图表】")
        print("=" * 80)
        self.cmd_chart("3d")

        print("\n" + "=" * 80)
        print("【训练教练点击数据点1，回溯混用记录】")
        print("=" * 80)
        self.cmd_click("1")

        print("\n" + "=" * 80)
        print("【第二步：林老师补录温度校准记录】")
        print("=" * 80)

        self.engine.step2_lin_add_calibration(
            data_point_ids=[1],
            instrument_id="INS-2026-001",
            calibration_temp=24.85,
            calibration_unit=TempUnit.CELSIUS,
            remarks="开尔文298K转换为摄氏度24.85°C，已确认与原始采样一致"
        )
        self._refresh()
        print("✅ 林老师已为数据点1录入校准记录")
        print(self.renderer.render_stage_banner())

        print("\n" + "=" * 80)
        print("【再次点击数据点1，现在可以看到校准记录】")
        print("=" * 80)
        self.cmd_click("1")

        print("\n" + "=" * 80)
        print("【林老师继续为其他混用点补录校准】")
        print("=" * 80)
        for idx in [3, 5, 7, 9]:
            self.engine.step2_lin_add_calibration(
                data_point_ids=[idx],
                instrument_id="INS-2026-001",
                calibration_temp=25.0 + idx * 0.2,
                calibration_unit=TempUnit.CELSIUS,
                remarks=f"已完成温度单位校准，数据点{idx}确认无误"
            )
        self._refresh()
        print("✅ 林老师已为数据点3,5,7,9录入校准记录")

        print("\n" + "=" * 80)
        print("【第三步：更新交接报告】")
        print("=" * 80)
        self.cmd_update("已复核所有单位混用点，校准记录完整，可用于训练评估")

        print("\n" + "=" * 80)
        print("【查看完整交接报告】")
        print("=" * 80)
        self.cmd_report()

        print("\n🎉 演示完成！系统支持：")
        print("   • 导入时自动标出摄氏度/开尔文混用")
        print("   • 3D图表点击混用点可回溯采样间隔说明")
        print("   • 林老师补录校准记录后报告自动更新")
        print("   • 报告说明每条数据为什么留下、缺什么、找谁")
        print("   • 混用数据不归一化，留给训练教练复核")

    def run(self):
        print("\n🪂 降落伞开伞冲击分析系统")
        print("输入 help 查看命令，输入 demo 运行完整演示")
        print("=" * 80)

        while True:
            try:
                cmd = input("\nparachute> ").strip()
                if not cmd:
                    continue

                parts = cmd.split()
                command = parts[0].lower()
                args = parts[1:]

                if command in ['exit', 'quit', 'q']:
                    print("👋 再见")
                    break
                elif command == 'help':
                    self.cmd_help(*args)
                elif command == 'import':
                    self.cmd_import(*args)
                elif command == 'shock':
                    self.cmd_shock(*args)
                elif command == 'status':
                    self.cmd_status(*args)
                elif command == 'chart':
                    self.cmd_chart(*args)
                elif command == 'click':
                    self.cmd_click(*args)
                elif command == 'list':
                    self.cmd_list(*args)
                elif command == 'calibrate':
                    self.cmd_calibrate(*args)
                elif command == 'update':
                    self.cmd_update(*args)
                elif command == 'report':
                    self.cmd_report(*args)
                elif command == 'demo':
                    self.cmd_demo(*args)
                else:
                    print(f"❌ 未知命令: {command}，输入 help 查看可用命令")

            except KeyboardInterrupt:
                print("\n👋 再见")
                break
            except Exception as e:
                print(f"❌ 执行出错: {e}")


def main():
    cli = ParachuteShockCLI()
    if len(sys.argv) > 1:
        cmd = sys.argv[1].lower()
        args = sys.argv[2:]
        if cmd == 'demo':
            cli.cmd_demo(*args)
        else:
            cli.cmd_help()
    else:
        cli.run()


if __name__ == "__main__":
    main()
