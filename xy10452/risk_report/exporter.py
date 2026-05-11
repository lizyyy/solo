from pathlib import Path
from typing import List
from datetime import datetime

from .models import ProjectRiskReport, Risk, RiskLevel, RiskStatus


class ReportExporter:
    @staticmethod
    def export_markdown(report: ProjectRiskReport, output_path: str) -> str:
        content = ReportExporter._generate_markdown(report)
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text(content, encoding='utf-8')
        return str(output_file)
    
    @staticmethod
    def _generate_markdown(report: ProjectRiskReport) -> str:
        lines = []
        
        lines.append(f"# 项目风险周报")
        lines.append(f"")
        lines.append(f"**项目:** {report.project}")
        lines.append(f"**周数:** 第 {report.week_number} 周")
        lines.append(f"**生成时间:** {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"")
        
        level_icons = {
            RiskLevel.LOW: "🟢",
            RiskLevel.MEDIUM: "🟡",
            RiskLevel.HIGH: "🟠",
            RiskLevel.CRITICAL: "🔴"
        }
        
        lines.append(f"## 总体风险等级")
        lines.append(f"")
        lines.append(f"{level_icons.get(report.overall_risk_level, '⚪')} **{report.overall_risk_level.value}**")
        lines.append(f"")
        
        if report.summary:
            lines.append(f"## 项目统计")
            lines.append(f"")
            
            task_stats = report.summary.get("task_stats", {})
            defect_stats = report.summary.get("defect_stats", {})
            milestone_stats = report.summary.get("milestone_stats", {})
            
            lines.append(f"| 类别 | 总数 | 完成/解决 | 进行中/待处理 | 风险 |")
            lines.append(f"|------|------|-----------|---------------|------|")
            lines.append(f"| 任务 | {task_stats.get('total', 0)} | {task_stats.get('completed', 0)} | {task_stats.get('in_progress', 0)} | {task_stats.get('delayed', 0)} |")
            lines.append(f"| 缺陷 | {defect_stats.get('total', 0)} | {defect_stats.get('total', 0) - defect_stats.get('open', 0)} | {defect_stats.get('open', 0)} | {defect_stats.get('critical', 0)} |")
            lines.append(f"| 里程碑 | {milestone_stats.get('total', 0)} | {milestone_stats.get('completed', 0)} | - | {milestone_stats.get('at_risk', 0)} |")
            lines.append(f"")
            
            lines.append(f"### 风险分布")
            lines.append(f"")
            risk_by_level = report.summary.get("risk_count_by_level", {})
            lines.append(f"- 低风险: {risk_by_level.get('低', 0)} 项")
            lines.append(f"- 中风险: {risk_by_level.get('中', 0)} 项")
            lines.append(f"- 高风险: {risk_by_level.get('高', 0)} 项")
            lines.append(f"- 严重风险: {risk_by_level.get('严重', 0)} 项")
            lines.append(f"")
        
        lines.append(f"## 风险详情")
        lines.append(f"")
        
        if not report.risks:
            lines.append(f"✅ 本周未检测到风险，项目健康。")
            lines.append(f"")
        else:
            sorted_risks = sorted(
                report.risks,
                key=lambda r: {
                    RiskLevel.CRITICAL: 0,
                    RiskLevel.HIGH: 1,
                    RiskLevel.MEDIUM: 2,
                    RiskLevel.LOW: 3
                }.get(r.level, 4)
            )
            
            for i, risk in enumerate(sorted_risks, 1):
                lines.append(f"### {i}. [{level_icons.get(risk.level, '⚪')} {risk.level.value}] {risk.title}")
                lines.append(f"")
                lines.append(f"- **风险ID:** {risk.id}")
                lines.append(f"- **风险类型:** {risk.risk_type.value}")
                lines.append(f"- **风险状态:** {risk.status.value}")
                lines.append(f"- **负责人:** {risk.owner or '未分配'}")
                lines.append(f"- **创建时间:** {risk.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
                lines.append(f"")
                lines.append(f"**描述:**")
                lines.append(f"{risk.description}")
                lines.append(f"")
                
                if risk.explanation:
                    lines.append(f"**解释说明:**")
                    lines.append(f"{risk.explanation}")
                    lines.append(f"")
                
                lines.append(f"**📋 证据来源:**")
                lines.append(f"")
                for ev_idx, evidence in enumerate(risk.evidence, 1):
                    lines.append(f"{ev_idx}. **{evidence.source_type}** - {evidence.source_id}: {evidence.source_title}")
                    for key, value in evidence.details.items():
                        key_cn = {
                            'status': '状态',
                            'planned_end': '计划结束日期',
                            'actual_end': '实际结束日期',
                            'delay_days': '延期天数',
                            'today': '当前日期',
                            'severity': '严重程度',
                            'owner': '负责人',
                            'related_task_id': '关联任务ID',
                            'active_tasks': '进行中任务数',
                            'open_defects': '待处理缺陷数',
                            'total_workload': '总工作量',
                            'planned_date': '计划日期',
                            'incomplete_dependent_tasks': '未完成关联任务数',
                            'total_dependent_tasks': '关联任务总数',
                            'latest_task_end': '任务最晚结束日期',
                            'defect_status': '缺陷状态',
                            'defect_severity': '缺陷严重程度',
                            'task_status': '任务状态',
                            'task_id': '任务ID',
                            'milestone_planned': '里程碑计划日期',
                            'task_planned_end': '任务计划结束日期',
                            'issue': '问题'
                        }.get(key, key)
                        lines.append(f"   - {key_cn}: {value}")
                    lines.append(f"")
                
                lines.append(f"---")
                lines.append(f"")
        
        lines.append(f"## 建议措施")
        lines.append(f"")
        
        high_and_critical = [r for r in report.risks if r.level in [RiskLevel.HIGH, RiskLevel.CRITICAL] and r.status == RiskStatus.IDENTIFIED]
        
        if high_and_critical:
            lines.append(f"### 需立即关注")
            lines.append(f"")
            for risk in high_and_critical:
                lines.append(f"- [ ] **{risk.risk_type.value}**: {risk.title} - 建议在 24 小时内跟进")
            lines.append(f"")
        
        medium_risks = [r for r in report.risks if r.level == RiskLevel.MEDIUM and r.status == RiskStatus.IDENTIFIED]
        if medium_risks:
            lines.append(f"### 需本周关注")
            lines.append(f"")
            for risk in medium_risks:
                lines.append(f"- [ ] **{risk.risk_type.value}**: {risk.title} - 建议本周内处理")
            lines.append(f"")
        
        if not high_and_critical and not medium_risks:
            lines.append(f"项目整体风险可控，建议继续保持当前的项目管理节奏。")
            lines.append(f"")
        
        return "\n".join(lines)
    
    @staticmethod
    def export_json(report: ProjectRiskReport, output_path: str) -> str:
        import json
        content = json.dumps(report.to_dict(), ensure_ascii=False, indent=2)
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text(content, encoding='utf-8')
        return str(output_file)
