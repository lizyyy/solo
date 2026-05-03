from datetime import date, datetime
from typing import List, Dict, Optional
from collections import defaultdict

from trademark_deadlines.core.date_calculator import DeadlineCalculationResult
from trademark_deadlines.core.risk_detector import (
    RiskItem, RiskCategory, RiskSeverity,
    MissingDocumentRisk, TimezoneConflictRisk, MultiCaseConflictRisk
)
from trademark_deadlines.core.data_loader import DataIssues, DataIssue, DataIssueType


class MarkdownExporter:
    def __init__(self):
        pass
    
    def export_report(
        self,
        deadlines: List[DeadlineCalculationResult],
        risks: List[RiskItem],
        data_issues: DataIssues,
        output_path: str,
        reference_date: Optional[date] = None
    ) -> None:
        ref_date = reference_date or date.today()
        
        content = self._generate_report(
            deadlines, risks, data_issues, ref_date
        )
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    def _generate_report(
        self,
        deadlines: List[DeadlineCalculationResult],
        risks: List[RiskItem],
        data_issues: DataIssues,
        reference_date: date
    ) -> str:
        lines: List[str] = []
        
        lines.append("# 商标案件期限复核报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**参考日期**: {reference_date.strftime('%Y-%m-%d')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        lines.append("## 执行摘要")
        lines.append("")
        
        total_deadlines = len(deadlines)
        overdue = len([d for d in deadlines if d.is_overdue])
        imminent_3d = len([d for d in deadlines if 0 <= d.days_until_deadline <= 3])
        imminent_7d = len([d for d in deadlines if 0 <= d.days_until_deadline <= 7])
        
        total_risks = len(risks)
        critical_risks = len([r for r in risks if r.severity == RiskSeverity.CRITICAL])
        high_risks = len([r for r in risks if r.severity == RiskSeverity.HIGH])
        
        lines.append(f"- **总期限数量**: {total_deadlines}")
        lines.append(f"- **已逾期**: {overdue} 个")
        lines.append(f"- **3天内到期**: {imminent_3d} 个")
        lines.append(f"- **7天内到期**: {imminent_7d} 个")
        lines.append(f"- **风险项总数**: {total_risks}")
        lines.append(f"  - 严重: {critical_risks}")
        lines.append(f"  - 高: {high_risks}")
        lines.append("")
        
        if data_issues.issues:
            errors = data_issues.get_errors()
            warnings = data_issues.get_warnings()
            lines.append(f"- **数据质量问题**: {len(data_issues.issues)} 个")
            lines.append(f"  - 错误: {len(errors)}")
            lines.append(f"  - 警告: {len(warnings)}")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        
        if overdue > 0 or imminent_3d > 0 or critical_risks > 0:
            lines.append("## ⚠️ 紧急事项")
            lines.append("")
            
            if overdue > 0:
                lines.append("### 已逾期")
                lines.append("")
                overdue_items = sorted(
                    [d for d in deadlines if d.is_overdue],
                    key=lambda x: x.days_until_deadline
                )
                lines.append("| 案件ID | 商标 | 截止类型 | 截止日期 | 逾期天数 |")
                lines.append("|--------|------|----------|----------|----------|")
                for item in overdue_items:
                    lines.append(
                        f"| {item.case_id} | {item.trademark} | "
                        f"{item.deadline_type.value} | {item.adjusted_deadline} | "
                        f"{abs(item.days_until_deadline)} |"
                    )
                lines.append("")
            
            if imminent_3d > 0:
                lines.append("### 3天内到期")
                lines.append("")
                imminent_items = sorted(
                    [d for d in deadlines if 0 <= d.days_until_deadline <= 3],
                    key=lambda x: x.days_until_deadline
                )
                lines.append("| 案件ID | 商标 | 截止类型 | 截止日期 | 剩余天数 |")
                lines.append("|--------|------|----------|----------|----------|")
                for item in imminent_items:
                    lines.append(
                        f"| {item.case_id} | {item.trademark} | "
                        f"{item.deadline_type.value} | {item.adjusted_deadline} | "
                        f"{item.days_until_deadline} |"
                    )
                lines.append("")
            
            critical_risk_items = [r for r in risks if r.severity == RiskSeverity.CRITICAL]
            if critical_risk_items:
                lines.append("### 严重风险")
                lines.append("")
                for risk in critical_risk_items:
                    lines.append(f"**{risk.risk_id}**: {risk.title}")
                    lines.append("")
                    lines.append(f"> {risk.description}")
                    lines.append("")
            
            lines.append("---")
            lines.append("")
        
        lines.append("## 详细风险分析")
        lines.append("")
        
        risk_by_category: Dict[RiskCategory, List[RiskItem]] = defaultdict(list)
        for risk in risks:
            risk_by_category[risk.category].append(risk)
        
        category_names = {
            RiskCategory.OVERDUE: "已逾期",
            RiskCategory.IMMINENT_DEADLINE: "即将到期",
            RiskCategory.MISSING_DOCUMENT: "材料缺失",
            RiskCategory.TIMEZONE_CONFLICT: "时区冲突",
            RiskCategory.MULTI_CASE_CONFLICT: "多案件冲突",
            RiskCategory.DATA_QUALITY: "数据质量",
        }
        
        for category, category_risks in sorted(
            risk_by_category.items(),
            key=lambda x: x[0].value
        ):
            if not category_risks:
                continue
            
            category_name = category_names.get(category, category.value)
            lines.append(f"### {category_name}")
            lines.append("")
            
            for risk in sorted(category_risks, key=lambda x: x.severity.value, reverse=True):
                severity_emoji = {
                    RiskSeverity.CRITICAL: "🔴",
                    RiskSeverity.HIGH: "🟠",
                    RiskSeverity.MEDIUM: "🟡",
                    RiskSeverity.LOW: "🟢",
                }.get(risk.severity, "⚪")
                
                lines.append(f"#### {severity_emoji} [{risk.risk_id}] {risk.title}")
                lines.append("")
                lines.append(f"- **案件ID**: {risk.case_id}")
                lines.append(f"- **商标**: {risk.trademark}")
                lines.append(f"- **司法管辖区**: {risk.jurisdiction}")
                lines.append(f"- **严重程度**: {risk.severity.value}")
                if risk.deadline_date:
                    lines.append(f"- **截止日期**: {risk.deadline_date}")
                if risk.days_remaining is not None:
                    lines.append(f"- **剩余天数**: {risk.days_remaining}")
                lines.append("")
                lines.append(f"**描述**: {risk.description}")
                lines.append("")
                
                if isinstance(risk, MissingDocumentRisk) and risk.missing_documents:
                    lines.append(f"**缺失材料**: {', '.join(risk.missing_documents)}")
                    lines.append("")
                
                if isinstance(risk, TimezoneConflictRisk):
                    lines.append(f"- **提交时区**: {risk.source_timezone}")
                    lines.append(f"- **目标时区**: {risk.target_timezone}")
                    if risk.is_after_deadline:
                        lines.append("- **状态**: ⚠️ 已超过当地截止时间")
                    lines.append("")
                
                if isinstance(risk, MultiCaseConflictRisk):
                    lines.append(f"- **冲突案件**: {', '.join(risk.conflicting_case_ids)}")
                    lines.append(f"- **冲突类型**: {risk.conflict_type}")
                    lines.append("")
                
                lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 期限汇总表")
        lines.append("")
        
        if deadlines:
            sorted_deadlines = sorted(
                deadlines,
                key=lambda x: (x.is_overdue, -x.days_until_deadline 
                               if not x.is_overdue else x.days_until_deadline)
            )
            
            lines.append("| 状态 | 案件ID | 商标 | 截止类型 | 调整后截止日 | 剩余天数 | 备注 |")
            lines.append("|------|--------|------|----------|--------------|----------|------|")
            
            for item in sorted_deadlines:
                status = "🔴 逾期" if item.is_overdue else (
                    "🟠 紧急" if item.days_until_deadline <= 3 else
                    "🟡 高" if item.days_until_deadline <= 7 else
                    "🟢 正常"
                )
                days_display = f"-{abs(item.days_until_deadline)}" if item.is_overdue else str(item.days_until_deadline)
                notes = []
                if item.was_adjusted:
                    notes.append("已顺延")
                if item.notes:
                    notes.append(item.notes[:30] + "..." if len(item.notes) > 30 else item.notes)
                
                lines.append(
                    f"| {status} | {item.case_id} | {item.trademark} | "
                    f"{item.deadline_type.value} | {item.adjusted_deadline} | "
                    f"{days_display} | {'; '.join(notes) if notes else '-'} |"
                )
        else:
            lines.append("*无期限数据*")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 数据质量报告")
        lines.append("")
        
        if data_issues.issues:
            issue_by_type: Dict[DataIssueType, List[DataIssue]] = defaultdict(list)
            for issue in data_issues.issues:
                issue_by_type[issue.issue_type].append(issue)
            
            issue_type_names = {
                DataIssueType.MISSING_APPLICATION_DATE: "缺少申请日",
                DataIssueType.ABANDONED_CASE_WITH_ACTIONS: "已放弃案件有后续动作",
                DataIssueType.INVALID_DATE_FORMAT: "无效日期格式",
                DataIssueType.MISSING_REQUIRED_FIELD: "缺少必填字段",
                DataIssueType.INVALID_ACTION_TYPE: "无效动作类型",
                DataIssueType.INVALID_CASE_STATUS: "无效案件状态",
                DataIssueType.UNKNOWN_JURISDICTION: "未知司法管辖区",
            }
            
            for issue_type, issues in issue_by_type.items():
                type_name = issue_type_names.get(issue_type, issue_type.value)
                lines.append(f"### {type_name} ({len(issues)}个)")
                lines.append("")
                
                for issue in issues[:10]:
                    severity_mark = "❌" if issue.severity == "error" else "⚠️"
                    lines.append(f"- {severity_mark} **{issue.case_id}**: {issue.message}")
                    if issue.action_id:
                        lines.append(f"  - 关联动作: {issue.action_id}")
                
                if len(issues) > 10:
                    lines.append(f"  ... 还有 {len(issues) - 10} 个")
                lines.append("")
        else:
            lines.append("✅ 未检测到数据质量问题")
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*报告结束*")
        
        return "\n".join(lines)
