from typing import List, Dict, Tuple
from models import RateRule
from data_io import DataIO
from config import RATE_DIR


class RateComparator:
    @staticmethod
    def compare_versions(new_rules: List[RateRule], old_rules: List[RateRule]) -> List[Dict]:
        changes = []
        
        new_rules_dict = {(r.merchant_id, r.card_type): r for r in new_rules}
        old_rules_dict = {(r.merchant_id, r.card_type): r for r in old_rules}
        
        all_keys = set(new_rules_dict.keys()) | set(old_rules_dict.keys())
        
        for key in all_keys:
            merchant_id, card_type = key
            
            if key in new_rules_dict and key not in old_rules_dict:
                new_rule = new_rules_dict[key]
                changes.append({
                    "type": "新增",
                    "merchant_id": merchant_id,
                    "card_type": card_type,
                    "field": "费率规则",
                    "old_value": "无",
                    "new_value": f"费率:{new_rule.rate}%, 固定费:{new_rule.fixed_fee}元",
                    "effective_date": new_rule.effective_date.strftime("%Y-%m-%d")
                })
            elif key in old_rules_dict and key not in new_rules_dict:
                old_rule = old_rules_dict[key]
                changes.append({
                    "type": "删除",
                    "merchant_id": merchant_id,
                    "card_type": card_type,
                    "field": "费率规则",
                    "old_value": f"费率:{old_rule.rate}%, 固定费:{old_rule.fixed_fee}元",
                    "new_value": "已删除",
                    "effective_date": ""
                })
            else:
                new_rule = new_rules_dict[key]
                old_rule = old_rules_dict[key]
                
                if abs(new_rule.rate - old_rule.rate) > 0.0001:
                    changes.append({
                        "type": "修改",
                        "merchant_id": merchant_id,
                        "card_type": card_type,
                        "field": "费率",
                        "old_value": f"{old_rule.rate}%",
                        "new_value": f"{new_rule.rate}%",
                        "effective_date": new_rule.effective_date.strftime("%Y-%m-%d"),
                        "impact": RateComparator._calc_impact(old_rule.rate, new_rule.rate)
                    })
                
                if abs(new_rule.fixed_fee - old_rule.fixed_fee) > 0.0001:
                    changes.append({
                        "type": "修改",
                        "merchant_id": merchant_id,
                        "card_type": card_type,
                        "field": "固定手续费",
                        "old_value": f"{old_rule.fixed_fee}元",
                        "new_value": f"{new_rule.fixed_fee}元",
                        "effective_date": new_rule.effective_date.strftime("%Y-%m-%d")
                    })
                
                if new_rule.effective_date != old_rule.effective_date:
                    changes.append({
                        "type": "修改",
                        "merchant_id": merchant_id,
                        "card_type": card_type,
                        "field": "生效日期",
                        "old_value": old_rule.effective_date.strftime("%Y-%m-%d"),
                        "new_value": new_rule.effective_date.strftime("%Y-%m-%d"),
                        "effective_date": new_rule.effective_date.strftime("%Y-%m-%d")
                    })
        
        return changes

    @staticmethod
    def _calc_impact(old_rate: float, new_rate: float) -> str:
        diff = new_rate - old_rate
        if diff > 0:
            return f"费率上升{diff:.4f}%，每万元手续费增加{diff * 100:.2f}元"
        elif diff < 0:
            return f"费率下降{abs(diff):.4f}%，每万元手续费减少{abs(diff) * 100:.2f}元"
        return "无变化"

    @staticmethod
    def format_changes_report(changes: List[Dict]) -> str:
        if not changes:
            return "【费率表变更提醒】未检测到费率变更\n"
        
        lines = []
        lines.append("=" * 60)
        lines.append("【重要提醒】费率表已变更！")
        lines.append("=" * 60)
        lines.append(f"变更总数: {len(changes)} 项")
        lines.append("")
        
        for i, change in enumerate(changes, 1):
            lines.append(f"--- 变更 #{i} [{change['type']}] ---")
            lines.append(f"商户ID: {change['merchant_id']}")
            lines.append(f"卡类型: {change['card_type']}")
            lines.append(f"变更字段: {change['field']}")
            lines.append(f"原值: {change['old_value']}")
            lines.append(f"新值: {change['new_value']}")
            if change.get('effective_date'):
                lines.append(f"生效日期: {change['effective_date']}")
            if change.get('impact'):
                lines.append(f"影响分析: {change['impact']}")
            lines.append("")
        
        lines.append("=" * 60)
        lines.append("注意: 以上变更将影响本次清算结果，请务必复核！")
        lines.append("=" * 60)
        
        return "\n".join(lines)

    @staticmethod
    def check_and_compare(current_rules: List[RateRule], current_version: str) -> Tuple[List[Dict], str]:
        versions = DataIO.get_rate_versions()
        
        if not versions:
            DataIO.archive_rate_table(current_version)
            return [], current_version
        
        latest_archive = versions[-1]
        old_file = RATE_DIR / f"rate_table_{latest_archive}.xlsx"
        
        if old_file.exists():
            old_rules, old_version = DataIO.read_rate_table(old_file)
            
            if old_version == current_version:
                return [], current_version
            
            changes = RateComparator.compare_versions(current_rules, old_rules)
            
            if changes:
                DataIO.archive_rate_table(current_version)
                return changes, current_version
        
        DataIO.archive_rate_table(current_version)
        return [], current_version
