"""
报告模块 - 生成问题报告和审计报告
"""

import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

from .rules import Issue, Severity
from .state_machine import FlowStateMachine


class CSVReporter:
    def __init__(self, output_dir: Optional[Path] = None):
        self.output_dir = output_dir or Path.cwd()

    def generate_issues_csv(self, issues: List[Issue], filename: str = "issues.csv") -> Path:
        filepath = self.output_dir / filename
        
        if not issues:
            with open(filepath, "w", encoding="utf-8", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "问题ID", "规则ID", "规则名称", "严重程度", "试卷袋ID",
                    "扫描ID", "操作人ID", "问题描述", "检测时间"
                ])
            return filepath

        fieldnames = self._get_all_fieldnames(issues)
        
        with open(filepath, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            
            for issue in issues:
                row = self._issue_to_csv_row(issue, fieldnames)
                writer.writerow(row)

        return filepath

    def _get_all_fieldnames(self, issues: List[Issue]) -> List[str]:
        base_fields = [
            "问题ID", "规则ID", "规则名称", "严重程度", "试卷袋ID",
            "扫描ID", "操作人ID", "问题描述", "检测时间"
        ]
        
        detail_fields = set()
        for issue in issues:
            for key in issue.details.keys():
                detail_fields.add(f"详情_{key}")
        
        return base_fields + sorted(list(detail_fields))

    def _issue_to_csv_row(self, issue: Issue, fieldnames: List[str]) -> Dict[str, str]:
        row = {
            "问题ID": issue.issue_id,
            "规则ID": issue.rule_id,
            "规则名称": issue.rule_name,
            "严重程度": issue.severity.value,
            "试卷袋ID": issue.bag_id or "",
            "扫描ID": issue.scan_id or "",
            "操作人ID": issue.teacher_id or "",
            "问题描述": issue.description,
            "检测时间": issue.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        }
        
        for key, value in issue.details.items():
            detail_key = f"详情_{key}"
            if detail_key in fieldnames:
                if isinstance(value, list):
                    row[detail_key] = ", ".join(str(v) for v in value)
                else:
                    row[detail_key] = str(value)
        
        return row


class MarkdownReporter:
    def __init__(self, output_dir: Optional[Path] = None):
        self.output_dir = output_dir or Path.cwd()

    def generate_handover_audit_md(
        self,
        rule_results: Dict[str, Any],
        state_machine_results: Dict[str, Any],
        context: Dict[str, Any],
        filename: str = "handover_audit.md"
    ) -> Path:
        filepath = self.output_dir / filename
        
        summary = rule_results.get("summary", {})
        by_severity = rule_results.get("by_severity", {})
        all_issues = rule_results.get("all_issues", [])
        
        lines = [
            "# 试卷袋流转交接审计报告",
            "",
            f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "---",
            "",
            "## 一、问题总览",
            "",
            self._generate_summary_section(summary),
            "",
            "---",
            "",
            "## 二、按严重程度分类",
            "",
            self._generate_severity_section(by_severity),
            "",
            "---",
            "",
            "## 三、流转状态概览",
            "",
            self._generate_state_machine_section(state_machine_results),
            "",
            "---",
            "",
            "## 四、问题详情",
            "",
            self._generate_issues_detail_section(all_issues, context),
            "",
            "---",
            "",
            "## 五、交接审计追踪",
            "",
            self._generate_audit_trail_section(state_machine_results, context),
            "",
            "---",
            "",
            "## 六、统计数据",
            "",
            self._generate_statistics_section(rule_results, state_machine_results, context),
            "",
            "---",
            "",
            "## 七、建议措施",
            "",
            self._generate_recommendations_section(summary, all_issues),
            "",
        ]

        with open(filepath, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return filepath

    def _generate_summary_section(self, summary: Dict[str, int]) -> str:
        total = summary.get("total", 0)
        critical = summary.get("critical", 0)
        high = summary.get("high", 0)
        medium = summary.get("medium", 0)
        low = summary.get("low", 0)

        lines = [
            "| 统计项 | 数量 |",
            "|--------|------|",
            f"| **问题总数** | {total} |",
            f"| 🔴 严重 (CRITICAL) | {critical} |",
            f"| 🟠 高危 (HIGH) | {high} |",
            f"| 🟡 中危 (MEDIUM) | {medium} |",
            f"| 🟢 低危 (LOW) | {low} |",
            "",
        ]

        if total > 0:
            lines.append("### 风险等级")
            lines.append("")
            if critical > 0:
                lines.append("⚠️ **存在严重问题，需要立即处理！**")
            elif high > 0:
                lines.append("⚠️ **存在高危问题，建议尽快处理**")
            elif medium > 0:
                lines.append("ℹ️ **存在中等问题，建议关注**")
            else:
                lines.append("✅ **所有问题等级较低**")

        return "\n".join(lines)

    def _generate_severity_section(self, by_severity: Dict[str, List[Issue]]) -> str:
        lines = []
        
        severity_order = [
            ("critical", "🔴 严重问题 (CRITICAL)", by_severity.get("critical", [])),
            ("high", "🟠 高危问题 (HIGH)", by_severity.get("high", [])),
            ("medium", "🟡 中危问题 (MEDIUM)", by_severity.get("medium", [])),
            ("low", "🟢 低危问题 (LOW)", by_severity.get("low", [])),
        ]

        for key, title, issues in severity_order:
            lines.append(f"### {title}")
            lines.append("")
            
            if not issues:
                lines.append("暂无此类问题。")
                lines.append("")
                continue

            lines.append(f"**共 {len(issues)} 个问题**")
            lines.append("")
            
            for issue in issues:
                lines.append(f"- **{issue.rule_name}**: {issue.description}")
                if issue.bag_id:
                    lines.append(f"  - 试卷袋: {issue.bag_id}")
                if issue.scan_id:
                    lines.append(f"  - 扫描ID: {issue.scan_id}")
                lines.append("")

        return "\n".join(lines)

    def _generate_state_machine_section(self, state_machine_results: Dict[str, Any]) -> str:
        total_scans = state_machine_results.get("total_scans", 0)
        valid_transitions = state_machine_results.get("valid_transitions", 0)
        invalid_transitions = state_machine_results.get("invalid_transitions", 0)
        completed_bags = state_machine_results.get("completed_bags", 0)
        in_progress_bags = state_machine_results.get("in_progress_bags", 0)

        lines = [
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 总扫描记录数 | {total_scans} |",
            f"| ✅ 有效流转 | {valid_transitions} |",
            f"| ❌ 无效流转 | {invalid_transitions} |",
            f"| ✅ 已完成流转的试卷袋 | {completed_bags} |",
            f"| ⏳ 进行中的试卷袋 | {in_progress_bags} |",
            "",
        ]

        if valid_transitions + invalid_transitions > 0:
            valid_rate = (valid_transitions / (valid_transitions + invalid_transitions)) * 100
            lines.append(f"**有效流转率**: {valid_rate:.1f}%")
            lines.append("")

        return "\n".join(lines)

    def _generate_issues_detail_section(self, issues: List[Issue], context: Dict[str, Any]) -> str:
        if not issues:
            return "✅ 未检测到任何问题。\n"

        lines = []
        invigilators = context.get("invigilators", {})
        bag_manifests = context.get("bag_manifests", {})

        for i, issue in enumerate(issues, 1):
            severity_icon = {
                Severity.CRITICAL: "🔴",
                Severity.HIGH: "🟠",
                Severity.MEDIUM: "🟡",
                Severity.LOW: "🟢"
            }.get(issue.severity, "⚪")

            lines.append(f"### {severity_icon} 问题 {i}: {issue.rule_name}")
            lines.append("")
            lines.append(f"**问题ID**: {issue.issue_id}")
            lines.append(f"**严重程度**: {issue.severity.value}")
            lines.append("")
            lines.append(f"**描述**: {issue.description}")
            lines.append("")

            if issue.bag_id:
                manifest = bag_manifests.get(issue.bag_id)
                if manifest:
                    lines.append(f"**试卷袋信息**:")
                    lines.append(f"- 袋ID: {manifest.bag_id}")
                    lines.append(f"- 类型: {manifest.bag_type}")
                    lines.append(f"- 科目: {manifest.subject}")
                    lines.append(f"- 考场: {manifest.room_id}")
                    lines.append(f"- 校区: {manifest.campus}")
                    lines.append(f"- 考试时间: {manifest.exam_date} {manifest.exam_time}")

            if issue.teacher_id:
                teacher = invigilators.get(issue.teacher_id)
                if teacher:
                    lines.append("")
                    lines.append(f"**操作人信息**:")
                    lines.append(f"- 工号: {teacher.teacher_id}")
                    lines.append(f"- 姓名: {teacher.name}")
                    lines.append(f"- 部门: {teacher.department}")
                    lines.append(f"- 校区: {teacher.campus}")
                    lines.append(f"- 角色: {teacher.role}")

            if issue.details:
                lines.append("")
                lines.append(f"**详细信息**:")
                for key, value in issue.details.items():
                    if isinstance(value, list):
                        value_str = ", ".join(str(v) for v in value)
                    else:
                        value_str = str(value)
                    lines.append(f"- {key}: {value_str}")

            lines.append("")
            lines.append("---")
            lines.append("")

        return "\n".join(lines)

    def _generate_audit_trail_section(self, state_machine_results: Dict[str, Any], context: Dict[str, Any]) -> str:
        lines = []
        bag_states = state_machine_results.get("bag_states", {})
        bag_manifests = context.get("bag_manifests", {})
        invigilators = context.get("invigilators", {})

        if not bag_states:
            lines.append("暂无流转记录。")
            return "\n".join(lines)

        completed_bags = []
        in_progress_bags = []

        for bag_id, state_data in bag_states.items():
            if state_data.get("status") == "COMPLETED":
                completed_bags.append((bag_id, state_data))
            else:
                in_progress_bags.append((bag_id, state_data))

        if completed_bags:
            lines.append("### ✅ 已完成流转的试卷袋")
            lines.append("")
            for bag_id, state_data in completed_bags:
                manifest = bag_manifests.get(bag_id)
                subject = manifest.subject if manifest else "未知"
                lines.append(f"#### {bag_id} ({subject})")
                lines.append("")
                lines.append(f"**状态历史**: {' → '.join(state_data.get('state_history', []))}")
                lines.append("")
                lines.append("**流转记录**:")
                lines.append("")
                lines.append("| 时间 | 操作 | 从状态 | 到状态 | 操作人 | 状态 |")
                lines.append("|------|------|--------|--------|--------|------|")
                
                for trans in state_data.get("transitions", []):
                    teacher = invigilators.get(trans.get("teacher_id", ""))
                    teacher_name = teacher.name if teacher else trans.get("teacher_id", "未知")
                    status_icon = "✅" if trans.get("valid") else "❌"
                    lines.append(
                        f"| {trans.get('timestamp', '')} | {trans.get('action', '')} | "
                        f"{trans.get('from_state', '')} | {trans.get('to_state', '')} | "
                        f"{teacher_name} | {status_icon} |"
                    )
                lines.append("")

        if in_progress_bags:
            lines.append("### ⏳ 进行中的试卷袋")
            lines.append("")
            for bag_id, state_data in in_progress_bags:
                manifest = bag_manifests.get(bag_id)
                subject = manifest.subject if manifest else "未知"
                lines.append(f"#### {bag_id} ({subject})")
                lines.append("")
                lines.append(f"**当前状态**: {state_data.get('current_state', '未知')}")
                lines.append(f"**状态历史**: {' → '.join(state_data.get('state_history', []))}")
                lines.append("")

        return "\n".join(lines)

    def _generate_statistics_section(self, rule_results: Dict[str, Any], 
                                      state_machine_results: Dict[str, Any],
                                      context: Dict[str, Any]) -> str:
        rule_results_data = rule_results.get("rule_results", {})
        bag_manifests = context.get("bag_manifests", {})
        invigilators = context.get("invigilators", {})
        exam_rooms = context.get("exam_rooms", {})

        paper_bags = sum(1 for m in bag_manifests.values() if m.is_paper_bag)
        answer_bags = sum(1 for m in bag_manifests.values() if m.is_answer_bag)

        lines = [
            "### 4.1 基础数据统计",
            "",
            "| 数据项 | 数量 |",
            "|--------|------|",
            f"| 考场总数 | {len(exam_rooms)} |",
            f"| 监考人员总数 | {len(invigilators)} |",
            f"| 试卷袋总数 | {len(bag_manifests)} |",
            f"| - 备用卷袋 | {paper_bags} |",
            f"| - 答题卡袋 | {answer_bags} |",
            "",
            "### 4.2 规则检测统计",
            "",
            "| 规则名称 | 检测到的问题数 |",
            "|----------|----------------|",
        ]

        for rule_id, result in rule_results_data.items():
            lines.append(f"| {result.get('name', rule_id)} | {result.get('issue_count', 0)} |")

        lines.append("")
        lines.append("### 4.3 流转统计")
        lines.append("")
        
        total_scans = state_machine_results.get("total_scans", 0)
        valid = state_machine_results.get("valid_transitions", 0)
        invalid = state_machine_results.get("invalid_transitions", 0)
        completed = state_machine_results.get("completed_bags", 0)
        in_progress = state_machine_results.get("in_progress_bags", 0)
        
        lines.extend([
            "| 指标 | 数值 |",
            "|------|------|",
            f"| 总扫描记录 | {total_scans} |",
            f"| 有效流转 | {valid} |",
            f"| 无效流转 | {invalid} |",
            f"| 已完成试卷袋 | {completed} |",
            f"| 进行中试卷袋 | {in_progress} |",
            "",
        ])

        if total_scans > 0:
            valid_rate = (valid / total_scans) * 100
            lines.append(f"**流转合规率**: {valid_rate:.1f}%")

        return "\n".join(lines)

    def _generate_recommendations_section(self, summary: Dict[str, int], issues: List[Issue]) -> str:
        lines = []
        critical = summary.get("critical", 0)
        high = summary.get("high", 0)
        medium = summary.get("medium", 0)

        if critical > 0:
            lines.append("### 🔴 紧急处理建议")
            lines.append("")
            lines.append("存在严重问题，需要立即处理：")
            lines.append("")
            
            for issue in [i for i in issues if i.severity == Severity.CRITICAL]:
                lines.append(f"- **{issue.rule_name}**: {issue.description}")
                if issue.bag_id:
                    lines.append(f"  - 涉及试卷袋: {issue.bag_id}")
                lines.append("")
            
            lines.append("**建议行动**:")
            lines.append("- 立即暂停相关试卷袋的流转")
            lines.append("- 核对监考人员权限配置")
            lines.append("- 重新授权受影响的考场")
            lines.append("")

        if high > 0:
            lines.append("### 🟠 高优先级处理建议")
            lines.append("")
            lines.append("存在高危问题，建议尽快处理：")
            lines.append("")
            
            high_issues = [i for i in issues if i.severity == Severity.HIGH]
            rule_types = set(i.rule_id for i in high_issues)
            
            if "duplicate_signature" in rule_types:
                lines.append("**重复签收问题**:")
                lines.append("- 检查扫描设备是否存在重复扫描问题")
                lines.append("- 核对系统日志中的扫描记录")
                lines.append("- 确认实际签收情况")
                lines.append("")
            
            if "cross_campus" in rule_types:
                lines.append("**跨校区操作问题**:")
                lines.append("- 确认操作人校区归属是否正确")
                lines.append("- 检查试卷袋校区分配是否正确")
                lines.append("- 确认是否存在跨校区借调情况")
                lines.append("")
            
            if "missing_transition" in rule_types:
                lines.append("**缺失流转节点问题**:")
                lines.append("- 检查流转记录是否完整")
                lines.append("- 确认是否存在遗漏的扫描环节")
                lines.append("- 补充缺失的流转记录")
                lines.append("")

        if medium > 0:
            lines.append("### 🟡 中优先级处理建议")
            lines.append("")
            lines.append("存在中等问题，建议关注：")
            lines.append("")
            
            medium_issues = [i for i in issues if i.severity == Severity.MEDIUM]
            rule_types = set(i.rule_id for i in medium_issues)
            
            if "midnight_exam_archive" in rule_types:
                lines.append("**跨午夜归档错位问题**:")
                lines.append("- 对于跨午夜考试，归档日期应使用考试结束日期")
                lines.append("- 核对系统时间设置")
                lines.append("- 调整归档日期计算逻辑")
                lines.append("")
            
            if "time_violation" in rule_types:
                lines.append("**时间窗口违规问题**:")
                lines.append("- 提醒监考人员按规定时间操作")
                lines.append("- 检查是否存在特殊情况需要调整时间窗口")
                lines.append("")

        if not any([critical, high, medium]):
            lines.append("✅ **所有检测通过，无需要处理的问题**")
            lines.append("")
            lines.append("建议定期复核以确保流转合规。")

        return "\n".join(lines)


class Reporter:
    def __init__(self, output_dir: Optional[Path] = None):
        self.output_dir = output_dir or Path.cwd()
        self.csv_reporter = CSVReporter(output_dir)
        self.md_reporter = MarkdownReporter(output_dir)

    def generate_all_reports(
        self,
        rule_results: Dict[str, Any],
        state_machine_results: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Dict[str, Path]:
        issues = rule_results.get("all_issues", [])
        
        issues_csv = self.csv_reporter.generate_issues_csv(issues)
        handover_md = self.md_reporter.generate_handover_audit_md(
            rule_results, state_machine_results, context
        )

        return {
            "issues_csv": issues_csv,
            "handover_audit_md": handover_md
        }

    def generate_issues_report(self, issues: List[Issue]) -> Path:
        return self.csv_reporter.generate_issues_csv(issues)

    def generate_audit_report(
        self,
        rule_results: Dict[str, Any],
        state_machine_results: Dict[str, Any],
        context: Dict[str, Any]
    ) -> Path:
        return self.md_reporter.generate_handover_audit_md(
            rule_results, state_machine_results, context
        )
