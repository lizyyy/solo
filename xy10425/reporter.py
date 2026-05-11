from datetime import datetime
from typing import List, Dict
import csv
import os
from .models import DailyData, ValidationIssue
from .validator import Validator


class Reporter:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir

    def generate_compliance_report(self, daily_data: DailyData) -> Dict:
        validator = Validator()
        issues = validator.validate(daily_data)

        total_menu_items = len(daily_data.menu_items)
        registered_reservations = [
            res for res in daily_data.reservations
            if res.status in ["registered", "destroyed"]
        ]
        destroyed_reservations = [
            res for res in daily_data.reservations
            if res.status == "destroyed"
        ]
        missed_items = daily_data.missed_items

        high_issues = [i for i in issues if i.severity == "high"]
        medium_issues = [i for i in issues if i.severity == "medium"]

        compliance_rate = 0.0
        if total_menu_items > 0:
            compliant_items = len(registered_reservations) - len(missed_items) - len(high_issues)
            compliance_rate = (compliant_items / total_menu_items) * 100

        return {
            "date": daily_data.date,
            "total_menu_items": total_menu_items,
            "registered_reservations": len(registered_reservations),
            "destroyed_reservations": len(destroyed_reservations),
            "missed_items": len(missed_items),
            "high_issues": len(high_issues),
            "medium_issues": len(medium_issues),
            "compliance_rate": round(compliance_rate, 2),
            "issues": [
                {
                    "type": issue.type,
                    "severity": issue.severity,
                    "message": issue.message
                }
                for issue in issues
            ]
        }

    def get_destruction_reminders(self, daily_data: DailyData, hours_before: int = 2) -> List[Dict]:
        validator = Validator()
        reminders = validator.get_destruction_reminders(daily_data, hours_before)

        return [
            {
                "id": res.id,
                "menu_item_name": res.menu_item_name,
                "window": res.window,
                "fridge_location": res.fridge_location,
                "container_id": res.container_id,
                "expected_destruction_time": res.expected_destruction_time.strftime('%Y-%m-%d %H:%M:%S'),
                "operator": res.operator
            }
            for res in reminders
        ]

    def get_responsible_statistics(self, daily_data: DailyData) -> Dict:
        validator = Validator()
        stats = validator.get_responsible_persons(daily_data)

        return {
            "date": daily_data.date,
            "operators": stats["operators"],
            "windows": stats["windows"]
        }

    def export_csv_report(self, daily_data: DailyData, file_path: str) -> bool:
        try:
            compliance_report = self.generate_compliance_report(daily_data)
            statistics = self.get_responsible_statistics(daily_data)
            reminders = self.get_destruction_reminders(daily_data)

            with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)

                writer.writerow(['食堂菜品留样检查报告', daily_data.date])
                writer.writerow([])

                writer.writerow(['一、今日合规情况'])
                writer.writerow(['菜品总数', compliance_report['total_menu_items']])
                writer.writerow(['已留样', compliance_report['registered_reservations']])
                writer.writerow(['已销毁', compliance_report['destroyed_reservations']])
                writer.writerow(['漏留', compliance_report['missed_items']])
                writer.writerow(['严重问题', compliance_report['high_issues']])
                writer.writerow(['一般问题', compliance_report['medium_issues']])
                writer.writerow(['合规率', f"{compliance_report['compliance_rate']}%"])
                writer.writerow([])

                writer.writerow(['二、问题列表'])
                if compliance_report['issues']:
                    writer.writerow(['问题类型', '严重程度', '问题描述'])
                    for issue in compliance_report['issues']:
                        writer.writerow([
                            issue['type'],
                            issue['severity'],
                            issue['message']
                        ])
                else:
                    writer.writerow(['无问题'])
                writer.writerow([])

                writer.writerow(['三、待销毁提醒'])
                if reminders:
                    writer.writerow(['留样ID', '菜品名称', '窗口', '冰箱位置', '容器编号', '预计销毁时间', '操作人'])
                    for reminder in reminders:
                        writer.writerow([
                            reminder['id'],
                            reminder['menu_item_name'],
                            reminder['window'],
                            reminder['fridge_location'],
                            reminder['container_id'],
                            reminder['expected_destruction_time'],
                            reminder['operator']
                        ])
                else:
                    writer.writerow(['无待销毁留样'])
                writer.writerow([])

                writer.writerow(['四、责任人统计 - 操作人'])
                if statistics['operators']:
                    writer.writerow(['操作人', '漏留次数'])
                    for operator, count in statistics['operators'].items():
                        writer.writerow([operator, count])
                else:
                    writer.writerow(['无操作人记录'])
                writer.writerow([])

                writer.writerow(['五、责任人统计 - 窗口'])
                if statistics['windows']:
                    writer.writerow(['窗口', '漏留次数'])
                    for window, count in statistics['windows'].items():
                        writer.writerow([window, count])
                else:
                    writer.writerow(['无窗口漏留记录'])

            return True
        except Exception as e:
            print(f"导出报告失败: {e}")
            return False

    def print_compliance_summary(self, daily_data: DailyData):
        compliance_report = self.generate_compliance_report(daily_data)

        print("\n" + "="*60)
        print(f"【今日合规情况】- {daily_data.date}")
        print("="*60)
        print(f"菜品总数: {compliance_report['total_menu_items']}")
        print(f"已留样: {compliance_report['registered_reservations']}")
        print(f"已销毁: {compliance_report['destroyed_reservations']}")
        print(f"漏留: {compliance_report['missed_items']}")
        print(f"严重问题: {compliance_report['high_issues']}")
        print(f"一般问题: {compliance_report['medium_issues']}")
        print(f"合规率: {compliance_report['compliance_rate']}%")
        print("-"*60)

        if compliance_report['issues']:
            print("\n【问题列表】:")
            for issue in compliance_report['issues']:
                severity_marker = "🔴" if issue['severity'] == "high" else "🟡"
                print(f"  {severity_marker} [{issue['type']}] {issue['message']}")
        else:
            print("\n✅ 所有检查通过！")

    def print_destruction_reminders(self, daily_data: DailyData, hours_before: int = 2):
        reminders = self.get_destruction_reminders(daily_data, hours_before)

        print("\n" + "="*60)
        print(f"【待销毁提醒】- {daily_data.date} (未来{hours_before}小时内)")
        print("="*60)

        if reminders:
            for reminder in reminders:
                print(f"\n留样ID: {reminder['id']}")
                print(f"  菜品: {reminder['menu_item_name']}")
                print(f"  窗口: {reminder['window']}")
                print(f"  冰箱位置: {reminder['fridge_location']}")
                print(f"  容器编号: {reminder['container_id']}")
                print(f"  预计销毁时间: {reminder['expected_destruction_time']}")
                print(f"  操作人: {reminder['operator']}")
        else:
            print("✅ 无待销毁留样")

    def print_responsible_statistics(self, daily_data: DailyData):
        stats = self.get_responsible_statistics(daily_data)

        print("\n" + "="*60)
        print(f"【责任人统计】- {daily_data.date}")
        print("="*60)

        print("\n【操作人统计】:")
        if stats['operators']:
            for operator, count in stats['operators'].items():
                print(f"  {operator}: {count} 次漏留")
        else:
            print("  无操作人记录")

        print("\n【窗口统计】:")
        if stats['windows']:
            for window, count in stats['windows'].items():
                print(f"  {window}: {count} 次漏留")
        else:
            print("  无窗口漏留记录")
