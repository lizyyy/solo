import csv
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from models import (
    RiskIssue, TankStatus, AnalysisReport,
    RiskLevel, RiskType
)
from config import OUTPUT_DIR


class DataExporter:
    def __init__(self):
        self.output_dir = Path(OUTPUT_DIR)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def export_issues_csv(self, issues: List[RiskIssue], filename: str = None) -> str:
        if not filename:
            filename = f"issues_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        filepath = self.output_dir / filename
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                '问题ID', '压载舱', '风险类型', '风险等级', '时间',
                '描述', '受影响体积(m³)', '位置(纬度)', '位置(经度)',
                '是否已确认', '确认人', '确认时间', '备注',
                '源数据详情'
            ])
            
            for issue in issues:
                writer.writerow([
                    issue.issue_id,
                    issue.tank_id,
                    issue.risk_type.value,
                    issue.risk_level.value,
                    issue.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                    issue.description,
                    f"{issue.affected_volume:.2f}",
                    f"{issue.location.get('lat', 0):.4f}",
                    f"{issue.location.get('lon', 0):.4f}",
                    '是' if issue.is_confirmed else '否',
                    issue.confirmed_by or '',
                    issue.confirmed_time.strftime('%Y-%m-%d %H:%M:%S') if issue.confirmed_time else '',
                    issue.notes or '',
                    json.dumps(issue.source_data, ensure_ascii=False, default=str)
                ])
        
        return str(filepath)
    
    def export_ballast_report_md(
        self,
        report: AnalysisReport,
        issues: List[RiskIssue],
        tank_statuses: Dict[str, TankStatus],
        filename: str = None
    ) -> str:
        if not filename:
            filename = f"ballast_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        
        filepath = self.output_dir / filename
        
        md_content = self._generate_markdown_report(report, issues, tank_statuses)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        return str(filepath)
    
    def _generate_markdown_report(
        self,
        report: AnalysisReport,
        issues: List[RiskIssue],
        tank_statuses: Dict[str, TankStatus]
    ) -> str:
        lines = []
        
        lines.append("# 压载水换舱复核报告")
        lines.append("")
        lines.append(f"**报告编号**: {report.report_id}")
        lines.append(f"**航次编号**: {report.voyage_id}")
        lines.append(f"**生成时间**: {report.generated_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 一、执行摘要")
        lines.append("")
        lines.append(f"- **总压载舱数**: {report.total_tanks}")
        lines.append(f"- **存在问题的舱数**: {report.tanks_with_issues}")
        lines.append(f"- **总问题数**: {report.total_issues}")
        lines.append("")
        
        lines.append("### 问题按等级分布")
        lines.append("")
        lines.append("| 风险等级 | 数量 |")
        lines.append("|----------|------|")
        for level, count in report.issues_by_level.items():
            lines.append(f"| {level} | {count} |")
        lines.append("")
        
        lines.append("### 问题按类型分布")
        lines.append("")
        lines.append("| 风险类型 | 数量 |")
        lines.append("|----------|------|")
        for risk_type, count in report.issues_by_type.items():
            lines.append(f"| {risk_type} | {count} |")
        lines.append("")
        
        lines.append("## 二、详细问题列表")
        lines.append("")
        
        critical_issues = [i for i in issues if i.risk_level == RiskLevel.CRITICAL]
        high_issues = [i for i in issues if i.risk_level == RiskLevel.HIGH]
        medium_issues = [i for i in issues if i.risk_level == RiskLevel.MEDIUM]
        low_issues = [i for i in issues if i.risk_level == RiskLevel.LOW]
        
        if critical_issues:
            lines.append("### 🔴 严重问题 (CRITICAL)")
            lines.append("")
            for issue in critical_issues:
                lines.append(f"#### 问题 {issue.issue_id}")
                lines.append(f"- **压载舱**: {issue.tank_id}")
                lines.append(f"- **风险类型**: {issue.risk_type.value}")
                lines.append(f"- **发生时间**: {issue.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"- **描述**: {issue.description}")
                lines.append(f"- **受影响体积**: {issue.affected_volume:.2f} m³")
                lines.append(f"- **位置**: 纬度 {issue.location.get('lat', 0):.4f}, 经度 {issue.location.get('lon', 0):.4f}")
                lines.append(f"- **确认状态**: {'✅ 已确认' if issue.is_confirmed else '❌ 未确认'}")
                if issue.is_confirmed and issue.confirmed_by:
                    lines.append(f"- **确认人**: {issue.confirmed_by}")
                if issue.notes:
                    lines.append(f"- **备注**: {issue.notes}")
                lines.append("")
        
        if high_issues:
            lines.append("### 🟠 高风险问题 (HIGH)")
            lines.append("")
            for issue in high_issues:
                lines.append(f"#### 问题 {issue.issue_id}")
                lines.append(f"- **压载舱**: {issue.tank_id}")
                lines.append(f"- **风险类型**: {issue.risk_type.value}")
                lines.append(f"- **发生时间**: {issue.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"- **描述**: {issue.description}")
                lines.append(f"- **受影响体积**: {issue.affected_volume:.2f} m³")
                lines.append(f"- **位置**: 纬度 {issue.location.get('lat', 0):.4f}, 经度 {issue.location.get('lon', 0):.4f}")
                lines.append(f"- **确认状态**: {'✅ 已确认' if issue.is_confirmed else '❌ 未确认'}")
                if issue.is_confirmed and issue.confirmed_by:
                    lines.append(f"- **确认人**: {issue.confirmed_by}")
                if issue.notes:
                    lines.append(f"- **备注**: {issue.notes}")
                lines.append("")
        
        if medium_issues:
            lines.append("### 🟡 中等风险问题 (MEDIUM)")
            lines.append("")
            for issue in medium_issues:
                lines.append(f"#### 问题 {issue.issue_id}")
                lines.append(f"- **压载舱**: {issue.tank_id}")
                lines.append(f"- **风险类型**: {issue.risk_type.value}")
                lines.append(f"- **发生时间**: {issue.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"- **描述**: {issue.description}")
                lines.append(f"- **受影响体积**: {issue.affected_volume:.2f} m³")
                lines.append(f"- **位置**: 纬度 {issue.location.get('lat', 0):.4f}, 经度 {issue.location.get('lon', 0):.4f}")
                lines.append(f"- **确认状态**: {'✅ 已确认' if issue.is_confirmed else '❌ 未确认'}")
                if issue.is_confirmed and issue.confirmed_by:
                    lines.append(f"- **确认人**: {issue.confirmed_by}")
                if issue.notes:
                    lines.append(f"- **备注**: {issue.notes}")
                lines.append("")
        
        lines.append("## 三、压载舱状态汇总")
        lines.append("")
        lines.append("| 压载舱 | 当前体积(m³) | 最大体积(m³) | 装载率 | 状态 | 事件数 | 问题数 |")
        lines.append("|--------|-------------|-------------|--------|------|--------|--------|")
        
        for tank_id, tank_status in sorted(tank_statuses.items()):
            load_rate = (tank_status.current_volume / tank_status.max_volume * 100) if tank_status.max_volume > 0 else 0
            tank_issues = [i for i in issues if i.tank_id == tank_id]
            lines.append(
                f"| {tank_id} | {tank_status.current_volume:.2f} | {tank_status.max_volume:.2f} | "
                f"{load_rate:.1f}% | {tank_status.status} | {len(tank_status.history)} | {len(tank_issues)} |"
            )
        lines.append("")
        
        lines.append("## 四、建议措施")
        lines.append("")
        
        if report.recommendations:
            for i, rec in enumerate(report.recommendations, 1):
                lines.append(f"{i}. {rec}")
        else:
            lines.append("1. 请尽快复核所有未确认的风险问题")
            lines.append("2. 对严重问题需立即采取纠正措施")
            lines.append("3. 确保传感器正常工作，避免数据断采")
            lines.append("4. 严格遵守各海区的压载水排放规定")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*此报告由压载水换舱复核工具自动生成*")
        
        return "\n".join(lines)
    
    def save_analysis_state(
        self,
        issues: List[RiskIssue],
        tank_statuses: Dict[str, TankStatus],
        filename: str = "analysis_state.json"
    ) -> str:
        filepath = self.output_dir / filename
        
        state = {
            "saved_at": datetime.now().isoformat(),
            "issues": [i.to_dict() for i in issues],
            "tank_statuses": {k: v.to_dict() for k, v in tank_statuses.items()}
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2, default=str)
        
        return str(filepath)
    
    def export_all(
        self,
        report: AnalysisReport,
        issues: List[RiskIssue],
        tank_statuses: Dict[str, TankStatus]
    ) -> Dict[str, str]:
        results = {}
        
        results["issues_csv"] = self.export_issues_csv(issues)
        results["report_md"] = self.export_ballast_report_md(report, issues, tank_statuses)
        results["state_json"] = self.save_analysis_state(issues, tank_statuses)
        
        return results
