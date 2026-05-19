import json
from datetime import datetime
from typing import Dict, List, Any
from .comparator import MismatchIssue
from .fix_suggestion import FixSuggestionGenerator

class ReportGenerator:
    def __init__(self):
        self.suggestion_generator = FixSuggestionGenerator()
    
    def generate_machine_readable(
        self,
        all_issues: Dict[str, List[MismatchIssue]],
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        report = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "version": "1.0.0",
                **(metadata or {})
            },
            "summary": {
                "total_languages": len(all_issues),
                "total_issues": sum(len(issues) for issues in all_issues.values()),
                "issues_by_language": {
                    lang: len(issues) for lang, issues in all_issues.items()
                },
                "issues_by_severity": self._count_by_severity(all_issues)
            },
            "issues": {}
        }
        
        for lang, issues in all_issues.items():
            report["issues"][lang] = [
                self._issue_to_dict(issue) for issue in issues
            ]
        
        return report
    
    def generate_human_readable(
        self,
        all_issues: Dict[str, List[MismatchIssue]],
        metadata: Dict[str, Any] = None
    ) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("翻译占位符一致性缺失排查报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        if metadata:
            for k, v in metadata.items():
                lines.append(f"{k}: {v}")
        lines.append("")
        
        total_issues = sum(len(issues) for issues in all_issues.values())
        lines.append(f"总问题数: {total_issues}")
        lines.append("")
        
        for lang, issues in all_issues.items():
            if not issues:
                continue
                
            lines.append(f"-" * 80)
            lines.append(f"语言: {lang}")
            lines.append(f"问题数: {len(issues)}")
            lines.append(f"-" * 80)
            lines.append("")
            
            for i, issue in enumerate(issues, 1):
                lines.append(f"  问题 {i}: {issue.key}")
                lines.append(f"  严重程度: {issue.severity.upper()}")
                lines.append(f"  源语言 ({issue.source_language}) 占位符: {sorted(issue.source_placeholders)}")
                lines.append(f"  目标语言 ({issue.target_language}) 占位符: {sorted(issue.target_placeholders)}")
                
                if issue.missing_in_target:
                    lines.append(f"  缺失的占位符: {sorted(issue.missing_in_target)}")
                if issue.extra_in_target:
                    lines.append(f"  多余的占位符: {sorted(issue.extra_in_target)}")
                
                if issue.source_text:
                    lines.append(f"  源文案: {issue.source_text}")
                if issue.target_text:
                    lines.append(f"  译文: {issue.target_text}")
                
                suggestions = self.suggestion_generator.generate_suggestions(issue)
                if suggestions:
                    lines.append(f"  修复建议:")
                    for s in suggestions:
                        lines.append(f"    - {s['suggestion']}")
                        lines.append(f"      操作: {s['action']}")
                
                lines.append("")
        
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)
        
        return "\n".join(lines)
    
    def save_json_report(
        self,
        all_issues: Dict[str, List[MismatchIssue]],
        output_path: str,
        metadata: Dict[str, Any] = None
    ):
        report = self.generate_machine_readable(all_issues, metadata)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
    
    def save_text_report(
        self,
        all_issues: Dict[str, List[MismatchIssue]],
        output_path: str,
        metadata: Dict[str, Any] = None
    ):
        report = self.generate_human_readable(all_issues, metadata)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report)
    
    def _issue_to_dict(self, issue: MismatchIssue) -> Dict[str, Any]:
        return {
            "key": issue.key,
            "severity": issue.severity,
            "source_language": issue.source_language,
            "target_language": issue.target_language,
            "source_placeholders": sorted(issue.source_placeholders),
            "target_placeholders": sorted(issue.target_placeholders),
            "missing_in_target": sorted(issue.missing_in_target),
            "extra_in_target": sorted(issue.extra_in_target),
            "source_text": issue.source_text,
            "target_text": issue.target_text,
            "suggestions": self.suggestion_generator.generate_suggestions(issue)
        }
    
    def _count_by_severity(self, all_issues: Dict[str, List[MismatchIssue]]) -> Dict[str, int]:
        counts = {"critical": 0, "warning": 0, "info": 0}
        for issues in all_issues.values():
            for issue in issues:
                counts[issue.severity] += 1
        return counts
