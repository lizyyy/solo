import os
from datetime import datetime
from typing import List, Dict, Any
import json
import csv


class Exporter:
    def __init__(self, export_dir: str = "./exports"):
        self.export_dir = export_dir
        if not os.path.exists(export_dir):
            os.makedirs(export_dir)

    def export_dashboard_report(self, stats: Dict[str, Any], expiring: List[Dict[str, Any]], 
                                 missed: List[Dict[str, Any]], pending: List[Dict[str, Any]], 
                                 filename: str = None) -> str:
        if not filename:
            filename = f"dashboard_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        filepath = os.path.join(self.export_dir, filename)

        lines = []
        lines.append("=" * 80)
        lines.append("社区AED点检管理 - 业务负责人报告")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")

        lines.append("一、核心指标概览")
        lines.append("-" * 40)
        lines.append(f"  设备总数: {stats['total_devices']}")
        lines.append(f"  在用设备: {stats['active_devices']}")
        lines.append(f"  志愿者总数: {stats['total_volunteers']}")
        lines.append(f"  活跃志愿者: {stats['active_volunteers']}")
        lines.append(f"  点检计划总数: {stats['total_plans']}")
        lines.append(f"  已完成点检: {stats['completed_plans']}")
        lines.append(f"  漏检计划: {stats['missed_plans']}")
        lines.append(f"  点检完成率: {stats['completion_rate']}%")
        lines.append(f"  待复核报告: {stats['pending_reviews']}")
        lines.append(f"  未解决异常: {stats['unresolved_exceptions']}")
        lines.append("")

        lines.append("二、耗材效期预警 (30天内到期)")
        lines.append("-" * 40)
        if expiring:
            for item in expiring:
                severity_flag = "[紧急]" if item['severity'] == 'critical' else "[预警]"
                lines.append(f"  {severity_flag} {item['supplies_type']}")
                lines.append(f"     设备位置: {item['device_location']} ({item['device_id']})")
                lines.append(f"     批次号: {item['batch_number']}")
                lines.append(f"     到期日期: {item['expiration_date']}")
                lines.append(f"     剩余天数: {item['days_left']} 天")
                lines.append("")
        else:
            lines.append("  [正常] 暂无即将到期的耗材")
        lines.append("")

        lines.append("三、漏检预警")
        lines.append("-" * 40)
        if missed:
            for item in missed:
                lines.append(f"  [漏检] 计划 {item['plan_id']}")
                lines.append(f"     设备位置: {item['device_location']} ({item['device_id']})")
                lines.append(f"     责任志愿者: {item['volunteer_name']}")
                lines.append(f"     联系电话: {item['volunteer_phone']}")
                lines.append(f"     计划日期: {item['plan_date']}")
                lines.append("")
        else:
            lines.append("  [正常] 暂无漏检记录")
        lines.append("")

        lines.append("四、待复核点检报告")
        lines.append("-" * 40)
        if pending:
            for item in pending:
                lines.append(f"  [待复核] 报告 {item['report_id']}")
                lines.append(f"     设备位置: {item['device_location']} ({item['device_id']})")
                lines.append(f"     点检志愿者: {item['volunteer_name']}")
                lines.append(f"     点检日期: {item['inspection_date'][:10]}")
                lines.append(f"     电极片: {'OK' if item['electrode_pads_ok'] else '异常'}")
                lines.append(f"     电池: {'OK' if item['battery_ok'] else '异常'}")
                lines.append(f"     位置标识: {'清晰' if item['location_visible'] else '不清晰'}")
                lines.append(f"     整体状态: {item['overall_status']}")
                if item['notes']:
                    lines.append(f"     备注: {item['notes']}")
                lines.append("")
        else:
            lines.append("  [正常] 暂无待复核报告")
        lines.append("")

        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write("\n".join(lines))

        return filepath

    def export_to_csv(self, data: List[Dict[str, Any]], filename: str) -> str:
        if not data:
            return ""
        if not filename.endswith('.csv'):
            filename = f"{filename}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        filepath = os.path.join(self.export_dir, filename)

        fieldnames = list(data[0].keys())
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(data)

        return filepath

    def export_to_json(self, data: Dict[str, Any], filename: str) -> str:
        if not filename.endswith('.json'):
            filename = f"{filename}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(self.export_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return filepath
