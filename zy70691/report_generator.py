import json
import re
from datetime import date
from typing import Dict

from models import Flower, Subscription


class ReportGenerator:
    def generate_human_readable_report(self, report_data: Dict, subscription: Subscription, flowers: Dict[str, Flower]) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("           鲜花订阅配送报告")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"订阅ID: {report_data['subscription_id']}")
        lines.append(f"统计周期: {report_data['period']}")
        lines.append(f"客户ID: {subscription.customer_id}")
        lines.append(f"订阅状态: {subscription.status.value}")
        lines.append("")
        lines.append("-" * 60)
        lines.append("配送统计")
        lines.append("-" * 60)
        lines.append(f"  总配送计划数: {report_data['total_deliveries']}")
        lines.append(f"  已完成配送:   {report_data['completed_deliveries']}")
        lines.append(f"  已暂停配送:   {report_data['paused_deliveries']}")
        lines.append("")
        lines.append("-" * 60)
        lines.append("调整统计")
        lines.append("-" * 60)
        lines.append(f"  总调整次数:   {report_data['total_adjustments']}")
        lines.append(f"  差价总金额:   ¥{report_data['price_adjustments_total']:+}")
        lines.append("")
        if report_data['flower_changes']:
            lines.append("-" * 60)
            lines.append("花材变更记录")
            lines.append("-" * 60)
            for idx, change in enumerate(report_data['flower_changes'], 1):
                old_names = [flowers[fid].name if fid in flowers else fid for fid in change['old']]
                new_names = [flowers[fid].name if fid in flowers else fid for fid in change['new']]
                lines.append(f"  {idx}. 日期: {change['date']}")
                lines.append(f"     原花材: {', '.join(old_names)}")
                lines.append(f"     新花材: {', '.join(new_names)}")
                lines.append("")
        lines.append("-" * 60)
        lines.append(f"报告生成时间: {report_data['generated_at']}")
        lines.append("=" * 60)
        return "\n".join(lines)

    def export_json_report(self, report_data: Dict, filepath: str) -> None:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, indent=2, ensure_ascii=False)

    def verify_report_consistency(self, json_data: Dict, human_text: str) -> bool:
        try:
            assert str(json_data['total_deliveries']) in human_text, "配送总数不一致"
            assert str(json_data['completed_deliveries']) in human_text, "已完成数不一致"
            assert str(json_data['total_adjustments']) in human_text, "调整次数不一致"
            assert str(json_data['price_adjustments_total']) in human_text, "差价总金额不一致"
            assert json_data['subscription_id'] in human_text, "订阅ID不一致"
            for change in json_data['flower_changes']:
                assert change['date'] in human_text, f"换花日期{change['date']}未找到"
            return True
        except AssertionError as e:
            print(f"一致性验证失败: {e}")
            return False
