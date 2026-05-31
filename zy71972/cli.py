#!/usr/bin/env python3
import sys
import json
from datetime import datetime
from pathlib import Path

from storage import DataStorage
from manual_judgment import ManualJudgmentManager
from discrepancy_detector import DiscrepancyDetector
from quality_check import QualityCheckManager
from exporter import DataExporter


class ReviewSystemCLI:
    def __init__(self, data_dir="./data"):
        self.storage = DataStorage(data_dir)
        self.manual_mgr = ManualJudgmentManager(self.storage)
        self.discrepancy_mgr = DiscrepancyDetector(self.storage)
        self.quality_mgr = QualityCheckManager(self.storage)
        self.exporter = DataExporter(self.storage)

    def cmd_import(self, args):
        """导入呼叫数据: python cli.py import <batch_id> <json_file>"""
        if len(args) < 2:
            print("用法: python cli.py import <batch_id> <json_file>")
            return

        batch_id = args[0]
        json_file = args[1]

        with open(json_file, 'r', encoding='utf-8') as f:
            calls_data = json.load(f)

        from models import CallRecord
        calls = []
        for item in calls_data:
            item['call_time'] = datetime.fromisoformat(item['call_time'])
            calls.append(CallRecord.from_dict(item))

        result = self.storage.import_calls(calls, batch_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    def cmd_who_changed(self, args):
        """查询谁改过某条记录: python cli.py who_changed <call_id>"""
        if not args:
            print("用法: python cli.py who_changed <call_id>")
            return

        call_id = args[0]
        changers = self.manual_mgr.who_changed(call_id)

        print(f"\n呼叫 {call_id} 的改判历史:")
        print("-" * 80)
        if not changers:
            print("  暂无改判记录")
        else:
            for i, changer in enumerate(changers, 1):
                print(f"  {i}. 操作人: {changer['operator']}")
                print(f"     时间: {changer['operate_time']}")
                print(f"     变更: {changer['old_value']} → {changer['new_value']}")
                if changer['reason']:
                    print(f"     原因: {changer['reason']}")
                print()

    def cmd_update_result(self, args):
        """人工改判: python cli.py update_result <call_id> <new_result> <operator> [reason]"""
        if len(args) < 3:
            print("用法: python cli.py update_result <call_id> <new_result> <operator> [reason]")
            return

        call_id = args[0]
        new_result = args[1]
        operator = args[2]
        reason = args[3] if len(args) > 3 else None

        result = self.manual_mgr.update_manual_result(call_id, new_result, operator, reason)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    def cmd_call_history(self, args):
        """查看单条记录完整历史: python cli.py call_history <call_id>"""
        if not args:
            print("用法: python cli.py call_history <call_id>")
            return

        call_id = args[0]
        history = self.manual_mgr.get_call_history(call_id)
        print(json.dumps(history, ensure_ascii=False, indent=2))

    def cmd_detect_discrepancies(self, args):
        """检测灰度与报表差异: python cli.py detect_discrepancies <task_id> <report_json>"""
        if len(args) < 2:
            print("用法: python cli.py detect_discrepancies <task_id> <report_json>")
            return

        task_id = args[0]
        report_file = args[1]

        with open(report_file, 'r', encoding='utf-8') as f:
            report_data = json.load(f)

        result = self.discrepancy_mgr.detect_discrepancies(task_id, report_data)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    def cmd_discrepancy_detail(self, args):
        """查看差异详情及下一步: python cli.py discrepancy_detail <discrepancy_id>"""
        if not args:
            print("用法: python cli.py discrepancy_detail <discrepancy_id>")
            return

        discrepancy_id = args[0]
        detail = self.discrepancy_mgr.get_discrepancy_detail(discrepancy_id)

        if not detail:
            print("差异记录不存在")
            return

        d = detail['discrepancy']
        ns = detail['next_step']

        print(f"\n差异详情:")
        print("=" * 80)
        print(f"  差异ID: {d['discrepancy_id']}")
        print(f"  呼叫ID: {d['call_id']}")
        print(f"  差异字段: {d['field_name']}")
        print(f"  差异来源: {d['source']}")
        print(f"  灰度值: {d['grayscale_value']}")
        print(f"  报表值: {d['report_value']}")
        print(f"  责任人: {d['responsible_person']}")
        print(f"  描述: {d['description']}")
        print()
        print(f"下一步行动:")
        print(f"  动作: {ns['action']}")
        print(f"  联系人: {ns['contact']}")
        print(f"  方式: {ns['method']}")
        print(f"  升级路径: {ns['escalation']}")
        print()

    def cmd_quality_history(self, args):
        """查看质检历史: python cli.py quality_history <call_id>"""
        if not args:
            print("用法: python cli.py quality_history <call_id>")
            return

        call_id = args[0]
        history = self.quality_mgr.get_call_quality_history(call_id)
        print(json.dumps(history, ensure_ascii=False, indent=2))

    def cmd_compare_weekly(self, args):
        """周报告对比: python cli.py compare_weekly <week_start> <week_end> [task_id]"""
        if len(args) < 2:
            print("用法: python cli.py compare_weekly <week_start> <week_end> [task_id]")
            return

        week_start = args[0]
        week_end = args[1]
        task_id = args[2] if len(args) > 2 else None

        result = self.quality_mgr.compare_weekly_reports(week_start, week_end, task_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    def cmd_export_package(self, args):
        """导出完整复盘数据包: python cli.py export_package <output_dir> [task_id] [batch_id]"""
        if not args:
            print("用法: python cli.py export_package <output_dir> [task_id] [batch_id]")
            return

        output_dir = args[0]
        task_id = args[1] if len(args) > 1 else None
        batch_id = args[2] if len(args) > 2 else None

        result = self.exporter.export_full_review_package(output_dir, task_id, batch_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    def cmd_summary(self, args):
        """查看整体统计: python cli.py summary [task_id]"""
        task_id = args[0] if args else None

        print("\n" + "=" * 80)
        print("智能外呼复盘系统 - 数据概览")
        print("=" * 80)

        manual_summary = self.manual_mgr.get_manual_judge_summary(task_id)
        quality_summary = self.quality_mgr.get_quality_summary(task_id)
        discrepancy_summary = self.discrepancy_mgr.get_discrepancy_summary(task_id)
        operator_stats = self.manual_mgr.get_operator_statistics()

        print("\n【人工改判统计】")
        print(f"  总呼叫数: {manual_summary['total_calls']}")
        print(f"  已改判: {manual_summary['judged_count']} ({manual_summary['judge_rate']}%)")
        print(f"  改判分布: {manual_summary['result_distribution']}")

        print("\n【操作人统计】")
        if operator_stats:
            for stat in operator_stats:
                print(f"  - {stat['operator']}: 操作{stat['total_changes']}次, 处理{stat['unique_calls_handled']}条")
                print(f"    最后操作: {stat['last_operation_time']}")
        else:
            print("  暂无操作记录")

        print("\n【质检统计】")
        print(f"  质检覆盖: {quality_summary['check_coverage']}%")
        print(f"  修改率: {quality_summary['modify_rate']}%")

        print("\n【差异统计】")
        print(f"  待解决差异: {discrepancy_summary['unresolved_count']}")
        print(f"  差异来源分布: {discrepancy_summary['source_distribution']}")
        if discrepancy_summary['responsible_pending']:
            print("  待处理责任人:")
            for person, count in discrepancy_summary['responsible_pending'].items():
                print(f"    - {person}: {count}条待处理")

        print("\n" + "=" * 80 + "\n")

    def cmd_export_excel(self, args):
        """导出Excel: python cli.py export_excel <output_path> [task_id] [batch_id]"""
        if not args:
            print("用法: python cli.py export_excel <output_path> [task_id] [batch_id]")
            return

        output_path = args[0]
        task_id = args[1] if len(args) > 1 else None
        batch_id = args[2] if len(args) > 2 else None

        result = self.exporter.export_to_excel(output_path, task_id, batch_id)
        print(json.dumps(result, ensure_ascii=False, indent=2))

    def run(self):
        if len(sys.argv) < 2:
            self.print_help()
            return

        command = sys.argv[1]
        args = sys.argv[2:]

        handlers = {
            'import': self.cmd_import,
            'who_changed': self.cmd_who_changed,
            'update_result': self.cmd_update_result,
            'call_history': self.cmd_call_history,
            'detect_discrepancies': self.cmd_detect_discrepancies,
            'discrepancy_detail': self.cmd_discrepancy_detail,
            'quality_history': self.cmd_quality_history,
            'compare_weekly': self.cmd_compare_weekly,
            'export_package': self.cmd_export_package,
            'export_excel': self.cmd_export_excel,
            'summary': self.cmd_summary,
        }

        if command in handlers:
            handlers[command](args)
        else:
            print(f"未知命令: {command}")
            self.print_help()

    def print_help(self):
        print("""
智能外呼复盘系统 - 命令行工具

数据导入:
  import <batch_id> <json_file>          导入呼叫数据（重复导入自动去重）

人工改判追踪:
  who_changed <call_id>                  查询谁改过某条记录
  update_result <call_id> <result> <operator> [reason]  人工改判
  call_history <call_id>                 查看单条记录完整历史

差异检测:
  detect_discrepancies <task_id> <report_json>  检测灰度与报表差异
  discrepancy_detail <discrepancy_id>    查看差异详情及下一步行动

质检追踪:
  quality_history <call_id>              查看质检历史
  compare_weekly <start> <end> [task_id] 周报告一致性对比

数据导出（统一口径）:
  export_package <output_dir> [task_id]  导出完整复盘数据包
  export_excel <output_path> [task_id]   导出多Sheet Excel

统计查询:
  summary [task_id]                      查看整体统计概览
""")


if __name__ == "__main__":
    cli = ReviewSystemCLI()
    cli.run()
