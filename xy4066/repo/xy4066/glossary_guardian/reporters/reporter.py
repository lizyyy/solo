import csv
import json
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum, auto
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

from ..engine.rule_engine import Issue, IssueSeverity, IssueType, RuleResult


class ReportFormat(Enum):
    MARKDOWN = auto()
    CSV = auto()
    JSON = auto()


@dataclass
class ReportSection:
    title: str
    description: str
    items: List[Dict[str, Any]] = field(default_factory=list)
    priority: int = 0


class Reporter:
    def __init__(
        self,
        project_name: str,
        rule_result: RuleResult,
        similarity_result: Optional[Dict[str, Any]] = None,
    ):
        self.project_name = project_name
        self.rule_result = rule_result
        self.similarity_result = similarity_result or {}
        self.generated_at = datetime.now().isoformat()

    def generate_report(self, format: ReportFormat) -> str:
        if format == ReportFormat.MARKDOWN:
            return self._generate_markdown()
        elif format == ReportFormat.CSV:
            return self._generate_csv()
        elif format == ReportFormat.JSON:
            return self._generate_json()
        else:
            raise ValueError(f"Unsupported report format: {format}")

    def export(self, file_path: Union[str, Path], format: ReportFormat):
        file_path = Path(file_path)
        file_path.parent.mkdir(parents=True, exist_ok=True)

        content = self.generate_report(format)

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)

    def _generate_markdown(self) -> str:
        lines = []

        lines.append(f"# 术语检查报告 - {self.project_name}")
        lines.append("")
        lines.append(f"> 生成时间: {self.generated_at}")
        lines.append("")
        lines.append("---")
        lines.append("")

        lines.append("## 摘要")
        lines.append("")

        stats = self.rule_result.stats
        lines.append(f"- **总问题数**: {stats.get('total_issues', 0)}")
        lines.append(f"- **检查片段数**: {stats.get('segments_checked', 0)}")
        lines.append("")

        severity_counts = self.rule_result.count_by_severity()
        if severity_counts:
            lines.append("### 按严重程度分布")
            lines.append("")
            lines.append("| 严重程度 | 数量 |")
            lines.append("|---------|------|")
            for sev, count in sorted(severity_counts.items()):
                sev_icon = self._get_severity_icon(sev)
                lines.append(f"| {sev_icon} {sev} | {count} |")
            lines.append("")

        type_counts = self.rule_result.count_by_type()
        if type_counts:
            lines.append("### 按问题类型分布")
            lines.append("")
            lines.append("| 问题类型 | 数量 |")
            lines.append("|---------|------|")
            for typ, count in sorted(type_counts.items()):
                lines.append(f"| {typ} | {count} |")
            lines.append("")

        lines.append("---")
        lines.append("")

        if self.rule_result.issues:
            lines.append("## 问题详情")
            lines.append("")

            issues_by_severity: Dict[str, List[Issue]] = {}
            for issue in self.rule_result.issues:
                sev = issue.severity.name
                if sev not in issues_by_severity:
                    issues_by_severity[sev] = []
                issues_by_severity[sev].append(issue)

            severity_order = ["CRITICAL", "HIGH", "MEDIUM", "LOW"]
            for sev in severity_order:
                if sev in issues_by_severity:
                    issues = issues_by_severity[sev]
                    lines.append(f"### {self._get_severity_icon(sev)} {sev} - {len(issues)} 个问题")
                    lines.append("")

                    for i, issue in enumerate(issues, 1):
                        lines.append(f"#### {i}. {issue.issue_type.name}")
                        lines.append("")
                        lines.append(f"**消息**: {issue.message}")
                        lines.append("")

                        if issue.location:
                            lines.append("**位置信息**:")
                            lines.append("")
                            lines.append("```")
                            lines.append(json.dumps(issue.location, ensure_ascii=False, indent=2))
                            lines.append("```")
                            lines.append("")

                        if issue.suggestion:
                            lines.append(f"**建议**: {issue.suggestion}")
                            lines.append("")

                        if issue.details:
                            lines.append("**详细信息**:")
                            lines.append("")
                            lines.append("```")
                            lines.append(json.dumps(issue.details, ensure_ascii=False, indent=2))
                            lines.append("```")
                            lines.append("")

                        lines.append("---")
                        lines.append("")

        similarity_summary = self.similarity_result.get("summary", {})
        if similarity_summary and any(
            v > 0 for k, v in similarity_summary.items() if k.startswith("total_")
        ):
            lines.append("## 相似度检查结果")
            lines.append("")

            lines.append("### 摘要")
            lines.append("")
            lines.append(f"- **姓名变体问题**: {similarity_summary.get('total_name_variant_issues', 0)}")
            lines.append(f"- **翻译不一致问题**: {similarity_summary.get('total_inconsistent_translation_issues', 0)}")
            lines.append(f"- **相似上下文不同译法**: {similarity_summary.get('total_similar_context_issues', 0)}")
            lines.append(f"- **相似度阈值**: {similarity_summary.get('threshold_used', 0.85)}")
            lines.append("")

            name_variants = self.similarity_result.get("name_variants", [])
            if name_variants:
                lines.append("### 姓名变体")
                lines.append("")
                for i, nv in enumerate(name_variants, 1):
                    lines.append(f"#### {i}. {nv['main_name']}")
                    lines.append("")
                    lines.append(f"- **变体**: {', '.join(nv['variants'])}")
                    if nv.get("english_name"):
                        lines.append(f"- **英文名**: {nv['english_name']}")
                    if nv.get("context"):
                        lines.append(f"- **出现位置**: {len(nv['context'])} 处")
                    lines.append("")

            inconsistent_trans = self.similarity_result.get("inconsistent_translations", [])
            if inconsistent_trans:
                lines.append("### 翻译不一致")
                lines.append("")
                for i, it in enumerate(inconsistent_trans, 1):
                    lines.append(f"#### {i}. {it['chinese_term']}")
                    lines.append("")
                    lines.append(f"- **相似度分数**: {it['similarity_score']:.2f}")
                    lines.append("- **不同译法**:")
                    for trans in it.get("translations", []):
                        lines.append(f"  - {trans.get('translation', '')}: {trans.get('context', '')[:50]}...")
                    lines.append("")

            similar_context = self.similarity_result.get("similar_context_issues", [])
            if similar_context:
                lines.append("### 相似上下文不同译法")
                lines.append("")
                for i, sci in enumerate(similar_context, 1):
                    lines.append(f"#### {i}. {sci['chinese_term']}")
                    lines.append("")
                    lines.append(f"- **上下文相似度**: {sci['similarity_score']:.2f}")
                    lines.append(f"- **片段 {sci['segment1']['id']}**: {sci['segment1']['translation']}")
                    lines.append(f"- **片段 {sci['segment2']['id']}**: {sci['segment2']['translation']}")
                    lines.append(f"- **建议**: {sci['suggestion']}")
                    lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("## 报告结束")
        lines.append("")
        lines.append("> 此报告由「术语包离线守门员」生成")

        return "\n".join(lines)

    def _generate_csv(self) -> str:
        lines = []

        header = [
            "序号",
            "问题类型",
            "严重程度",
            "消息",
            "片段ID",
            "说话人",
            "建议",
            "详细信息",
        ]
        lines.append(",".join(self._csv_escape(h) for h in header))

        for i, issue in enumerate(self.rule_result.issues, 1):
            segment_id = ""
            speaker = ""
            if issue.location:
                segment_id = str(issue.location.get("segment_id", ""))
                speaker = str(issue.location.get("speaker", ""))

            details_json = json.dumps(issue.details, ensure_ascii=False) if issue.details else ""

            row = [
                str(i),
                issue.issue_type.name,
                issue.severity.name,
                issue.message,
                segment_id,
                speaker,
                issue.suggestion or "",
                details_json,
            ]
            lines.append(",".join(self._csv_escape(r) for r in row))

        if self.similarity_result:
            lines.append("")
            lines.append("")
            lines.append("相似度检查结果")
            lines.append("")

            name_variants = self.similarity_result.get("name_variants", [])
            if name_variants:
                lines.append("姓名变体")
                lines.append("主名称,变体,英文名,出现次数")
                for nv in name_variants:
                    row = [
                        nv["main_name"],
                        ";".join(nv["variants"]),
                        nv.get("english_name", ""),
                        str(len(nv.get("context", []))),
                    ]
                    lines.append(",".join(self._csv_escape(r) for r in row))

            inconsistent_trans = self.similarity_result.get("inconsistent_translations", [])
            if inconsistent_trans:
                lines.append("")
                lines.append("翻译不一致")
                lines.append("中文术语,相似度,译法数量")
                for it in inconsistent_trans:
                    trans_list = [t.get("translation", "") for t in it.get("translations", [])]
                    row = [
                        it["chinese_term"],
                        f"{it['similarity_score']:.2f}",
                        ";".join(trans_list),
                    ]
                    lines.append(",".join(self._csv_escape(r) for r in row))

        return "\n".join(lines)

    def _generate_json(self) -> str:
        report = {
            "project_name": self.project_name,
            "generated_at": self.generated_at,
            "summary": {
                "total_issues": len(self.rule_result.issues),
                "segments_checked": self.rule_result.stats.get("segments_checked", 0),
                "by_severity": self.rule_result.count_by_severity(),
                "by_type": self.rule_result.count_by_type(),
            },
            "issues": [i.to_dict() for i in self.rule_result.issues],
            "similarity_check": self.similarity_result,
        }

        return json.dumps(report, ensure_ascii=False, indent=2)

    def _get_severity_icon(self, severity: str) -> str:
        icons = {
            "CRITICAL": "🔴",
            "HIGH": "🟠",
            "MEDIUM": "🟡",
            "LOW": "🟢",
        }
        return icons.get(severity, "⚪")

    def _csv_escape(self, value: str) -> str:
        value = str(value)
        if "," in value or '"' in value or "\n" in value:
            value = '"' + value.replace('"', '""') + '"'
        return value
