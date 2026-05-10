# -*- coding: utf-8 -*-
"""
排程报告生成模块
"""

from datetime import datetime
from typing import List, Dict, Any
from collections import defaultdict


class ReportGenerator:
    """排程报告生成器"""
    
    def generate_summary_report(
        self,
        result,
        work_orders: List
    ) -> str:
        """生成文本摘要报告"""
        lines = []
        lines.append("=" * 70)
        lines.append("            船坞维修占坞排程器 - 处理结果报告")
        lines.append("=" * 70)
        lines.append(f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("-" * 70)
        lines.append("【统计摘要】")
        lines.append("-" * 70)
        lines.append(f"  总处理工单数: {result.total_rows}")
        lines.append(f"  成功排程: {result.valid_rows}")
        lines.append(f"  失败/跳过: {len(result.skipped_rows)}")
        lines.append(f"  存在冲突: {len(result.conflicts)}")
        lines.append(f"  待人工确认: {len(result.need_review_rows)}")
        lines.append("")
        
        scheduled_count = len(result.successful_assignments)
        conflict_count = len(result.conflicts)
        review_count = len(result.need_review_rows)
        
        lines.append("-" * 70)
        lines.append("【成功排程明细】")
        lines.append("-" * 70)
        
        if result.successful_assignments:
            for i, assignment in enumerate(result.successful_assignments, 1):
                lines.append(f"\n  {i}. 工单: {assignment.order_id}")
                lines.append(f"     坞位: {assignment.dock_name} ({assignment.dock_id})")
                lines.append(f"     吊装: {', '.join(assignment.lift_ids) if assignment.lift_ids else '无'}")
                craft_str = ', '.join([
                    f"{k}({','.join(v)})"
                    for k, v in assignment.craft_assignments.items()
                ])
                lines.append(f"     工种: {craft_str if craft_str else '无'}")
                lines.append(f"     时间: {assignment.start_time.strftime('%Y-%m-%d %H:%M')} ~ "
                           f"{assignment.end_time.strftime('%Y-%m-%d %H:%M')}")
        else:
            lines.append("  无")
        lines.append("")
        
        lines.append("-" * 70)
        lines.append("【冲突记录】")
        lines.append("-" * 70)
        
        if result.conflicts:
            for i, conflict in enumerate(result.conflicts, 1):
                lines.append(f"\n  {i}. 工单: {conflict['order_id']} | 船舶: {conflict['ship_name']}")
                lines.append(f"     冲突原因:")
                for j, reason in enumerate(conflict['conflicts'], 1):
                    lines.append(f"       {j}. {reason}")
        else:
            lines.append("  无")
        lines.append("")
        
        lines.append("-" * 70)
        lines.append("【待人工确认】")
        lines.append("-" * 70)
        
        if result.need_review_rows:
            for i, review in enumerate(result.need_review_rows, 1):
                lines.append(f"\n  {i}. 工单: {review['order_id']} | 船舶: {review['ship_name']}")
                lines.append(f"     原因: {review['reason']}")
                for j, c in enumerate(review['conflicts'], 1):
                    lines.append(f"     详情: {c}")
        else:
            lines.append("  无")
        lines.append("")
        
        lines.append("=" * 70)
        lines.append("报告结束")
        lines.append("=" * 70)
        
        return "\n".join(lines)
    
    def generate_conflict_details(
        self,
        conflicts: List[Dict[str, Any]]
    ) -> str:
        """生成冲突详情报告"""
        lines = []
        lines.append("=" * 70)
        lines.append("            冲突详细分析报告")
        lines.append("=" * 70)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        conflict_types = defaultdict(list)
        for conflict in conflicts:
            for reason in conflict['conflicts']:
                if '坞位' in reason or 'dock' in reason.lower():
                    conflict_types['坞位冲突'].append(conflict)
                if '潮汐' in reason or 'tide' in reason.lower():
                    conflict_types['潮汐窗口冲突'].append(conflict)
                if '吊装' in reason or '吊' in reason:
                    conflict_types['吊装资源冲突'].append(conflict)
                if '工' in reason:
                    conflict_types['工种排班冲突'].append(conflict)
                if '尺寸' in reason or '长度' in reason or '宽度' in reason:
                    conflict_types['船舶尺寸冲突'].append(conflict)
        
        lines.append(f"总冲突工单数: {len(conflicts)}")
        lines.append(f"冲突类型分布:")
        for ctype, items in conflict_types.items():
            lines.append(f"  - {ctype}: {len(items)} 个工单")
        lines.append("")
        
        for ctype, items in conflict_types.items():
            lines.append("-" * 70)
            lines.append(f"【{ctype}】")
            lines.append("-" * 70)
            for item in items:
                lines.append(f"  工单: {item['order_id']} | 船舶: {item['ship_name']}")
                for reason in item['conflicts']:
                    if ctype in reason or any(k in reason for k in ctype):
                        lines.append(f"    原因: {reason}")
            lines.append("")
        
        return "\n".join(lines)
    
    def generate_dock_utilization_report(
        self,
        result,
        dock_slots: List
    ) -> str:
        """生成坞位利用率报告"""
        lines = []
        lines.append("=" * 70)
        lines.append("            坞位资源使用报告")
        lines.append("=" * 70)
        
        dock_usage = defaultdict(list)
        for assignment in result.successful_assignments:
            dock_usage[assignment.dock_id].append(assignment)
        
        for slot in dock_slots:
            lines.append(f"\n[{slot.dock_name} ({slot.dock_id})]")
            lines.append(f"  类型: {slot.dock_type.value}")
            lines.append(f"  规格: {slot.max_length}m × {slot.max_width}m")
            lines.append(f"  可用期: {slot.start_time.strftime('%Y-%m-%d %H:%M')} ~ "
                       f"{slot.end_time.strftime('%Y-%m-%d %H:%M')}")
            
            usages = dock_usage.get(slot.dock_id, [])
            lines.append(f"  已排程工单: {len(usages)} 个")
            for i, usage in enumerate(usages, 1):
                lines.append(f"    {i}. {usage.order_id}: "
                           f"{usage.start_time.strftime('%Y-%m-%d %H:%M')} ~ "
                           f"{usage.end_time.strftime('%Y-%m-%d %H:%M')}")
        
        return "\n".join(lines)
