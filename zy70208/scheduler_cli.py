#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
船坞维修占坞排程器 - 命令行界面
"""

import argparse
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from shipyard_scheduler.models import WorkOrderStatus, DockType, LiftType, CraftType
from shipyard_scheduler.scheduler import SchedulingEngine
from shipyard_scheduler.data_io import DataImporter, DataExporter
from shipyard_scheduler.report import ReportGenerator


class ShipyardSchedulerCLI:
    """命令行界面"""
    
    def __init__(self):
        self.importer = DataImporter()
        self.exporter = DataExporter()
        self.engine = SchedulingEngine()
        self.reporter = ReportGenerator()
        self.work_orders = []
        self.dock_slots = []
        self.lift_resources = []
        self.craft_schedules = {}
        self.tide_windows = []
        self.result = None
    
    def _print_header(self, title: str):
        """打印标题"""
        print("\n" + "=" * 70)
        print(f"  {title}")
        print("=" * 70)
    
    def _print_separator(self):
        print("-" * 70)
    
    def load_all_data(
        self,
        work_orders_file: str,
        docks_file: str,
        lifts_file: str,
        crafts_file: str,
        tides_file: str = None
    ):
        """加载所有数据"""
        self._print_header("数据加载")
        
        all_bad_rows = []
        
        print("\n[1/5] 加载船舶工单...")
        self.work_orders, bad = self.importer.import_work_orders_csv(work_orders_file)
        all_bad_rows.extend(bad)
        print(f"  成功: {len(self.work_orders)} 条 | 坏数据: {len(bad)} 条")
        
        print("\n[2/5] 加载坞位窗口...")
        self.dock_slots, bad = self.importer.import_dock_slots_csv(docks_file)
        all_bad_rows.extend(bad)
        print(f"  成功: {len(self.dock_slots)} 条 | 坏数据: {len(bad)} 条")
        
        print("\n[3/5] 加载吊装资源...")
        self.lift_resources, bad = self.importer.import_lift_resources_csv(lifts_file)
        all_bad_rows.extend(bad)
        print(f"  成功: {len(self.lift_resources)} 条 | 坏数据: {len(bad)} 条")
        
        print("\n[4/5] 加载工种排班...")
        self.craft_schedules, bad = self.importer.import_craft_schedules_csv(crafts_file)
        all_bad_rows.extend(bad)
        print(f"  成功: {len(self.craft_schedules)} 个工种 | 坏数据: {len(bad)} 条")
        
        if tides_file and os.path.exists(tides_file):
            print("\n[5/5] 加载潮汐窗口...")
            self.tide_windows, bad = self.importer.import_tide_windows_csv(tides_file)
            all_bad_rows.extend(bad)
            print(f"  成功: {len(self.tide_windows)} 条 | 坏数据: {len(bad)} 条")
        else:
            print("\n[5/5] 未提供潮汐窗口数据，跳过检查...")
        
        if all_bad_rows:
            self._print_separator()
            print("\n【坏数据明细】")
            for bad in all_bad_rows:
                print(f"  行 {bad.get('row', '?')}: {bad.get('reason', '未知错误')}")
        
        return len(all_bad_rows) == 0
    
    def run_scheduling(self):
        """执行排程"""
        self._print_header("开始排程")
        
        print("\n设置资源...")
        self.engine.set_resources(
            dock_slots=self.dock_slots,
            lift_resources=self.lift_resources,
            craft_schedules=self.craft_schedules,
            tide_windows=self.tide_windows
        )
        
        print(f"待排程工单: {len(self.work_orders)} 条")
        print(f"可用坞位: {len(self.dock_slots)} 个")
        print(f"吊装资源: {len(self.lift_resources)} 台")
        print(f"工种数量: {len(self.craft_schedules)} 个")
        if self.tide_windows:
            print(f"潮汐数据: {len(self.tide_windows)} 天")
        
        print("\n正在排程...")
        self.result = self.engine.schedule_work_orders(self.work_orders)
        
        self._print_separator()
        print("\n【排程结果统计】")
        print(f"  总处理行数: {self.result.total_rows}")
        print(f"  成功排程: {self.result.valid_rows} 条")
        print(f"  跳过(坏数据): {len(self.result.skipped_rows)} 条")
        print(f"  存在冲突: {len(self.result.conflicts)} 条")
        print(f"  待人工确认: {len(self.result.need_review_rows)} 条")
        
        if self.result.skipped_rows:
            self._print_separator()
            print("\n【跳过的记录】")
            for skip in self.result.skipped_rows:
                print(f"  工单 {skip['order_id']} ({skip['ship_name']}): {skip['reason']}")
        
        if self.result.conflicts:
            self._print_separator()
            print("\n【冲突记录】")
            for conflict in self.result.conflicts:
                print(f"\n  工单: {conflict['order_id']} | 船舶: {conflict['ship_name']}")
                print(f"  冲突原因:")
                for reason in conflict['conflicts']:
                    print(f"    - {reason}")
        
        if self.result.need_review_rows:
            self._print_separator()
            print("\n【待人工确认】")
            for review in self.result.need_review_rows:
                print(f"\n  工单: {review['order_id']} | 船舶: {review['ship_name']}")
                print(f"  原因: {review['reason']}")
        
        return self.result
    
    def export_results(self, output_dir: str):
        """导出结果"""
        if not self.result:
            print("请先执行排程")
            return
        
        self._print_header("导出结果")
        
        os.makedirs(output_dir, exist_ok=True)
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        
        csv_path = os.path.join(output_dir, f'schedule_result_{timestamp}.csv')
        self.exporter.export_schedule_csv(self.result, csv_path)
        print(f"CSV结果已导出: {csv_path}")
        
        summary_report = self.reporter.generate_summary_report(
            self.result, self.work_orders
        )
        report_path = os.path.join(output_dir, f'report_{timestamp}.txt')
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(summary_report)
        print(f"报告已导出: {report_path}")
        
        if self.result.conflicts:
            conflict_report = self.reporter.generate_conflict_details(
                self.result.conflicts
            )
            conflict_path = os.path.join(output_dir, f'conflicts_{timestamp}.txt')
            with open(conflict_path, 'w', encoding='utf-8') as f:
                f.write(conflict_report)
            print(f"冲突报告已导出: {conflict_path}")
        
        dock_report = self.reporter.generate_dock_utilization_report(
            self.result, self.dock_slots
        )
        dock_path = os.path.join(output_dir, f'dock_usage_{timestamp}.txt')
        with open(dock_path, 'w', encoding='utf-8') as f:
            f.write(dock_report)
        print(f"坞位使用报告已导出: {dock_path}")
        
        return {
            'csv': csv_path,
            'report': report_path,
            'output_dir': output_dir
        }
    
    def print_full_report(self):
        """打印完整报告"""
        if not self.result:
            print("请先执行排程")
            return
        
        print("\n" + self.reporter.generate_summary_report(self.result, self.work_orders))


def main():
    parser = argparse.ArgumentParser(
        description='船坞维修占坞排程器',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
使用示例:
  # 基本使用
  python scheduler_cli.py --orders data/work_orders.csv --docks data/docks.csv --lifts data/lifts.csv --crafts data/crafts.csv
  
  # 包含潮汐窗口
  python scheduler_cli.py --orders data/work_orders.csv --docks data/docks.csv --lifts data/lifts.csv --crafts data/crafts.csv --tides data/tides.csv
  
  # 指定输出目录
  python scheduler_cli.py --orders ... --output ./results
        '''
    )
    
    parser.add_argument('--orders', required=True, help='船舶工单CSV文件')
    parser.add_argument('--docks', required=True, help='坞位窗口CSV文件')
    parser.add_argument('--lifts', required=True, help='吊装资源CSV文件')
    parser.add_argument('--crafts', required=True, help='工种排班CSV文件')
    parser.add_argument('--tides', default=None, help='潮汐窗口CSV文件(可选)')
    parser.add_argument('--output', default='./output', help='输出目录')
    parser.add_argument('--no-export', action='store_true', help='不导出文件，仅显示结果')
    
    args = parser.parse_args()
    
    cli = ShipyardSchedulerCLI()
    
    try:
        success = cli.load_all_data(
            work_orders_file=args.orders,
            docks_file=args.docks,
            lifts_file=args.lifts,
            crafts_file=args.crafts,
            tides_file=args.tides
        )
        
        if not cli.work_orders:
            print("\n错误: 没有有效的工单数据")
            sys.exit(1)
        
        if not cli.dock_slots:
            print("\n错误: 没有有效的坞位数据")
            sys.exit(1)
        
        cli.run_scheduling()
        cli.print_full_report()
        
        if not args.no_export:
            cli.export_results(args.output)
        
        print("\n" + "=" * 70)
        print("处理完成")
        print("=" * 70)
        
    except FileNotFoundError as e:
        print(f"\n错误: 文件不存在 - {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
