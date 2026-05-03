import pandas as pd
from datetime import datetime
from typing import Dict, Any, List, Optional
import os
from .config_loader import ConfigLoader
from .inventory_manager import InventoryManager
from .appointment_manager import AppointmentManager
from .allocation_engine import AllocationEngine
from .issue_detector import IssueDetector


class ReportGenerator:
    def __init__(self, config_loader: ConfigLoader,
                 inventory_manager: InventoryManager,
                 appointment_manager: AppointmentManager,
                 allocation_engine: AllocationEngine,
                 issue_detector: IssueDetector):
        self.config = config_loader
        self.inventory = inventory_manager
        self.appointments = appointment_manager
        self.allocation = allocation_engine
        self.issues = issue_detector

    def generate_review_report(self, current_date: datetime = None) -> str:
        if current_date is None:
            current_date = datetime.now()

        inventory_summary = self.inventory.get_inventory_summary(current_date)
        appointment_summary = self.appointments.get_appointments_summary()
        issue_stats = self.issues.get_issue_statistics()
        expiring_priority = self.allocation.get_expiring_priority_list(current_date)
        transfer_suggestions = self.allocation.get_cross_campus_transfer_suggestions()

        report_parts = []

        report_parts.append(f"# 血库红细胞库存效期调拨评审报告")
        report_parts.append(f"\n**生成时间**: {current_date.strftime('%Y-%m-%d %H:%M:%S')}")
        report_parts.append(f"\n---\n")

        report_parts.append(f"## 一、库存概览")
        report_parts.append(f"\n- **总血袋数**: {inventory_summary.get('total_bags', 0)} 袋")
        report_parts.append(f"- **总容量**: {inventory_summary.get('total_volume_ml', 0)} ml")

        by_type = inventory_summary.get('by_blood_type', {})
        if by_type:
            report_parts.append(f"\n### 按血型分布")
            for bt, vol in sorted(by_type.items()):
                is_rare = self.config.is_rare_blood_type(bt)
                rare_mark = " (稀有)" if is_rare else ""
                report_parts.append(f"- **{bt}**{rare_mark}: {vol} ml ({vol // 450} 袋)")

        by_campus = inventory_summary.get('by_campus', {})
        if by_campus:
            report_parts.append(f"\n### 按院区分布")
            for campus_id, vol in by_campus.items():
                campus_name = self.config.get_campus_name(campus_id)
                report_parts.append(f"- **{campus_name}**: {vol} ml ({vol // 450} 袋)")

        expiry_summary = inventory_summary.get('expiry_summary', {})
        if expiry_summary:
            report_parts.append(f"\n### 效期状态")
            report_parts.append(f"- **已过期**: {expiry_summary.get('expired', 0)} 袋")
            report_parts.append(f"- **临期(≤2天)**: {expiry_summary.get('critical', 0)} 袋")
            report_parts.append(f"- **预警(3-5天)**: {expiry_summary.get('warning', 0)} 袋")
            report_parts.append(f"- **正常(>5天)**: {expiry_summary.get('normal', 0)} 袋")

        report_parts.append(f"\n---\n")

        report_parts.append(f"## 二、用血预约概览")
        report_parts.append(f"\n- **总预约数**: {appointment_summary.get('total_appointments', 0)} 例")
        report_parts.append(f"- **总需求容量**: {appointment_summary.get('total_required_volume_ml', 0)} ml")
        report_parts.append(f"- **跨午夜预约**: {appointment_summary.get('cross_midnight_count', 0)} 例")

        by_urgency = appointment_summary.get('by_urgency', {})
        if by_urgency:
            report_parts.append(f"\n### 按紧急程度")
            urgency_names = {'emergency': '急诊', 'routine': '常规'}
            for urgency, vol in by_urgency.items():
                name = urgency_names.get(urgency, urgency)
                report_parts.append(f"- **{name}**: {vol} ml")

        report_parts.append(f"\n---\n")

        if not expiring_priority.empty:
            report_parts.append(f"## 三、临期优先分配建议")
            report_parts.append(f"\n以下血袋即将过期，建议优先分配给近期手术：\n")

            for idx, row in expiring_priority.head(10).iterrows():
                risk_icon = "🔴" if row['expiry_risk'] == 'critical' else "🟡"
                report_parts.append(f"\n### {risk_icon} 血袋 {row['blood_bag_id']}")
                report_parts.append(f"- **血型**: {row['blood_type']}")
                report_parts.append(f"- **院区**: {self.config.get_campus_name(row['campus'])}")
                report_parts.append(f"- **剩余天数**: {row['days_until_expiry']} 天")
                report_parts.append(f"- **匹配预约数**: {row['matching_appointments_count']} 例")

                matches = row.get('matching_appointments', [])
                if matches:
                    report_parts.append(f"- **建议分配给**:")
                    for match in matches[:3]:
                        urgency_mark = "🚨" if match.get('urgency') == 'emergency' else ""
                        report_parts.append(f"  - {match['appointment_id']} - {match['patient_name']} {urgency_mark}")

        report_parts.append(f"\n---\n")

        if transfer_suggestions:
            report_parts.append(f"## 四、跨院调拨建议")
            report_parts.append(f"\n以下调拨建议可帮助优化库存分布：\n")

            for transfer in transfer_suggestions:
                urgency_mark = "🚨" if transfer.get('urgency') == 'emergency' else ""
                report_parts.append(f"\n### 调拨建议 {urgency_mark}")
                report_parts.append(f"- **血袋编号**: {transfer['bag_id']}")
                report_parts.append(f"- **血型**: {transfer['blood_type']}")
                report_parts.append(f"- **来源院区**: {self.config.get_campus_name(transfer['from_campus'])}")
                report_parts.append(f"- **目标院区**: {self.config.get_campus_name(transfer['to_campus'])}")
                report_parts.append(f"- **运输时间**: {transfer['distance_minutes']} 分钟")
                report_parts.append(f"- **用于预约**: {transfer['appointment_id']} - {transfer['patient_name']}")

        report_parts.append(f"\n---\n")

        report_parts.append(f"## 五、问题检测汇总")
        report_parts.append(f"\n- **总问题数**: {issue_stats.get('total_issues', 0)}")
        report_parts.append(f"- **严重问题**: {issue_stats.get('by_severity', {}).get('critical', 0)}")
        report_parts.append(f"- **警告问题**: {issue_stats.get('by_severity', {}).get('warning', 0)}")

        by_type = issue_stats.get('by_type', {})
        if by_type:
            report_parts.append(f"\n### 按问题类型")
            type_names = {
                'duplicate_assignment': '重复分配',
                'incompatible_blood': '血型不相容',
                'cross_midnight': '跨午夜预约',
                'expiring_soon': '临期血袋',
                'rare_shortage': '稀有血型短缺',
                'unmet_demand': '需求未满足',
                'time_overlap': '时间重叠'
            }
            for issue_type, count in by_type.items():
                if count > 0:
                    name = type_names.get(issue_type, issue_type)
                    report_parts.append(f"- **{name}**: {count} 例")

        critical_issues = self.issues.get_issues_by_severity('critical')
        if critical_issues:
            report_parts.append(f"\n### 🔴 严重问题详情")
            for issue in critical_issues:
                report_parts.append(f"\n- **{issue.get('description', '')}**")
                report_parts.append(f"  - 建议: {issue.get('recommendation', '')}")

        report_parts.append(f"\n---\n")

        report_parts.append(f"## 六、分配结果汇总")
        fully_allocated = sum(1 for r in self.allocation.allocation_results if r['status'] == 'fully_allocated')
        partially_allocated = sum(1 for r in self.allocation.allocation_results if r['status'] == 'partially_allocated')
        unallocated = sum(1 for r in self.allocation.allocation_results if r['status'] == 'unallocated')

        report_parts.append(f"\n- **完全分配**: {fully_allocated} 例")
        report_parts.append(f"- **部分分配**: {partially_allocated} 例")
        report_parts.append(f"- **未分配**: {unallocated} 例")

        for result in self.allocation.allocation_results:
            status_icon = {
                'fully_allocated': '✅',
                'partially_allocated': '⚠️',
                'unallocated': '❌'
            }.get(result['status'], '❓')

            report_parts.append(f"\n{status_icon} **{result['appointment_id']} - {result['patient_name']}**")
            report_parts.append(f"  - 需求: {result['required_blood_type']} {result['required_volume_ml']}ml")
            report_parts.append(f"  - 已分配: {result['total_assigned_volume_ml']}ml")
            report_parts.append(f"  - 未满足: {result['unmet_volume_ml']}ml")

            if result.get('needs_transfer'):
                report_parts.append(f"  - ⚠️ 需要跨院调拨")

        report_parts.append(f"\n---\n")
        report_parts.append(f"*报告生成完毕*")

        return '\n'.join(report_parts)

    def generate_issues_csv(self) -> str:
        issues_df = self.issues.get_issues_dataframe()
        if issues_df.empty:
            return "issue_id,issue_type,severity,description,recommendation\n"
        return issues_df.to_csv(index=False, encoding='utf-8-sig')

    def save_report(self, output_dir: str, current_date: datetime = None) -> Dict[str, str]:
        if current_date is None:
            current_date = datetime.now()

        date_str = current_date.strftime('%Y%m%d_%H%M%S')

        os.makedirs(output_dir, exist_ok=True)

        report_content = self.generate_review_report(current_date)
        report_path = os.path.join(output_dir, f"review_report_{date_str}.md")
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report_content)

        issues_csv = self.generate_issues_csv()
        issues_path = os.path.join(output_dir, f"issues_{date_str}.csv")
        with open(issues_path, 'w', encoding='utf-8-sig') as f:
            f.write(issues_csv)

        return {
            'report_path': report_path,
            'issues_path': issues_path
        }
