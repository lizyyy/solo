"""报告生成模块 - 生成带理由的分析结果"""

import os
import json
from datetime import datetime
from typing import Dict, Any, List

from .models import AnalysisResult, BatchAnalysisResult, ValidationIssue


class ReportGenerator:
    """报告生成器"""

    def __init__(self, output_dir: str):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def generate_text_report(self, batch_result: BatchAnalysisResult, filename: str = None) -> str:
        """生成文本报告"""
        if filename is None:
            filename = f"analysis_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"

        filepath = os.path.join(self.output_dir, filename)
        content = self._build_text_content(batch_result)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)

        return filepath

    def generate_json_report(self, batch_result: BatchAnalysisResult, filename: str = None) -> str:
        """生成JSON报告"""
        if filename is None:
            filename = f"analysis_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"

        filepath = os.path.join(self.output_dir, filename)

        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(batch_result.to_dict(), f, ensure_ascii=False, indent=2)

        return filepath

    def print_result(self, batch_result: BatchAnalysisResult):
        """打印分析结果到控制台"""
        content = self._build_text_content(batch_result)
        print(content)

    def _build_text_content(self, batch_result: BatchAnalysisResult) -> str:
        """构建文本内容"""
        lines = []
        lines.append("=" * 80)
        lines.append("                  温室虫害诱捕分析器 - 分析报告")
        lines.append("=" * 80)
        lines.append("")
        lines.append(f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"批次ID: {batch_result.batch_id}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("一、批量统计概览")
        lines.append("-" * 80)
        lines.append(f"总记录数: {batch_result.total_records}")
        lines.append(f"有效记录数: {batch_result.valid_records}")
        lines.append(f"无效记录数: {batch_result.invalid_records}")
        lines.append("")
        lines.append("质量评级分布:")
        for grade, count in batch_result.grade_distribution.items():
            lines.append(f"  - {grade}级: {count}条")
        lines.append("")
        if batch_result.issue_summary:
            lines.append("问题类型统计:")
            for issue_type, count in batch_result.issue_summary.items():
                lines.append(f"  - {issue_type}: {count}次")
        lines.append("")

        lines.append("-" * 80)
        lines.append("二、逐记录分析详情")
        lines.append("-" * 80)
        lines.append("")

        for idx, result in enumerate(batch_result.results, 1):
            lines.extend(self._build_single_record_section(idx, result))
            lines.append("")

        lines.append("-" * 80)
        lines.append("三、使用说明")
        lines.append("-" * 80)
        lines.append("")
        lines.append("问题等级说明:")
        lines.append("  🔴 严重错误(critical): 必须修正，否则数据不可用")
        lines.append("  🟠 高优先级(high): 严重影响分析结果，建议立即修正")
        lines.append("  🟡 中优先级(medium): 可能影响分析结果，建议检查")
        lines.append("  🔵 低优先级(low): 不影响结果，但建议优化")
        lines.append("")
        lines.append("质量评级标准:")
        lines.append("  A级(优秀): 90-100分 - 数据质量高，可直接使用")
        lines.append("  B级(良好): 75-89分 - 数据质量较好，注意小问题")
        lines.append("  C级(合格): 60-74分 - 数据质量合格，存在明显问题")
        lines.append("  D级(不合格): 0-59分 - 数据质量差，建议重新采集")
        lines.append("")
        lines.append("虫害预警阈值:")
        lines.append("  🔴 高预警: 单张诱捕板总虫量 ≥ 150头")
        lines.append("  🟠 中预警: 单张诱捕板总虫量 ≥ 50头")
        lines.append("  🟡 低预警: 单张诱捕板总虫量 ≥ 10头")
        lines.append("  ✅ 正常: 单张诱捕板总虫量 < 10头")
        lines.append("")
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)

        return "\n".join(lines)

    def _build_single_record_section(self, idx: int, result: AnalysisResult) -> List[str]:
        """构建单条记录的分析内容"""
        lines = []
        lines.append(f"【记录 {idx}】{result.record_id}")
        lines.append("-" * 60)
        lines.append(f"诱捕板: {result.trap_board_id}  温室: {result.greenhouse_id}  日期: {result.capture_date}")
        lines.append("")

        grade_display = self._get_grade_display(result)
        lines.append(f"数据质量评分: {result.quality_score:.1f}分  评级: {grade_display}")
        lines.append("")

        alert_emoji = {
            "high": "🔴",
            "medium": "🟠",
            "low": "🟡",
            "normal": "✅"
        }.get(result.alert_level, "⚪")
        lines.append(f"虫害预警: {alert_emoji} {result.alert_message}")
        lines.append("")

        lines.append("虫害统计明细:")
        for pest_type, pest_data in result.pest_summary.items():
            if pest_type == '_total':
                continue
            alert = {
                "high": "🔴",
                "medium": "🟠",
                "low": "🟡",
                "normal": ""
            }.get(pest_data.get('alert_level', 'normal'), "")

            corrected = " [人工修正]" if pest_data.get('manual_corrected') else ""
            lines.append(
                f"  {alert} {pest_data.get('name', pest_type)}: "
                f"AI={pest_data.get('ai_count', 0)} "
                f"→ 最终={pest_data.get('final_count', 0)}{corrected}"
            )

        total_data = result.pest_summary.get('_total', {})
        lines.append(
            f"  ──────────────────────────────────────"
        )
        lines.append(
            f"  总计: AI={total_data.get('ai_count', 0)} "
            f"→ 最终={total_data.get('final_count', 0)}"
        )
        lines.append("")

        if result.confidence_notes:
            lines.append("数据质量说明:")
            for note in result.confidence_notes:
                lines.append(f"  {note}")
            lines.append("")

        if result.issues:
            lines.append("检测到的问题及详细说明:")
            lines.append("")

            issues_by_level = self._group_issues_by_level(result.issues)
            for level in ['critical', 'high', 'medium', 'low']:
                if level in issues_by_level:
                    level_issues = issues_by_level[level]
                    level_name = {
                        "critical": "🔴 严重错误",
                        "high": "🟠 高优先级问题",
                        "medium": "🟡 中优先级问题",
                        "low": "🔵 低优先级提醒"
                    }[level]

                    lines.append(f"  {level_name} ({len(level_issues)}个):")
                    for issue in level_issues:
                        lines.extend(self._format_issue_detail(issue))

        lines.append("")

        return lines

    def _format_issue_detail(self, issue: ValidationIssue) -> List[str]:
        """格式化问题详情"""
        lines = []
        lines.append("")
        lines.append(f"    【{issue.rule_name}】(扣{issue.score_penalty}分)")
        lines.append(f"      描述: {issue.description}")
        lines.append(f"      原因: {issue.reason}")
        lines.append(f"      建议: {issue.suggestion}")

        if issue.related_values:
            lines.append(f"      相关数值:")
            for key, value in issue.related_values.items():
                lines.append(f"        - {key}: {value}")

        return lines

    def _group_issues_by_level(self, issues: List[ValidationIssue]) -> Dict[str, List[ValidationIssue]]:
        """按等级分组问题"""
        grouped = {}
        for issue in issues:
            if issue.level not in grouped:
                grouped[issue.level] = []
            grouped[issue.level].append(issue)
        return grouped

    def _get_grade_display(self, result: AnalysisResult) -> str:
        """获取评级显示"""
        grade_emojis = {
            "A": "⭐",
            "B": "👍",
            "C": "⚠️",
            "D": "❌"
        }
        return f"{grade_emojis.get(result.quality_grade, '')} {result.quality_grade}级({result.quality_grade_name})"
