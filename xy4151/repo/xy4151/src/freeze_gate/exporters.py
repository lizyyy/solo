import csv
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from freeze_gate.models import CheckResult, CheckSeverity, CheckType, ProjectConfig


class Exporter:
    def __init__(self, output_dir: Path, timestamp: Optional[str] = None):
        self.output_dir = output_dir
        self.timestamp = timestamp or datetime.now().strftime('%Y%m%d_%H%M%S')
    
    def export_markdown(self, result: CheckResult, config: ProjectConfig,
                        include_approved: bool = False) -> Path:
        filename = f"freeze_report_{result.resource_name}_{self.timestamp}.md"
        filepath = self.output_dir / filename
        
        unresolved_issues = result.get_unresolved_issues() if not include_approved else result.issues
        approved_issues = result.get_approved_issues()
        
        md = self._generate_markdown_report(
            result, config, unresolved_issues, approved_issues
        )
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(md)
        
        return filepath
    
    def _generate_markdown_report(self,
                                   result: CheckResult,
                                   config: ProjectConfig,
                                   unresolved_issues: List,
                                   approved_issues: List) -> str:
        lines = []
        
        lines.append(f"# 多语言文本包冻结报告")
        lines.append(f"")
        lines.append(f"**资源名称**: {result.resource_name}")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**源语言**: {config.source_language}")
        lines.append(f"**目标语言**: {', '.join(config.target_languages)}")
        lines.append(f"")
        lines.append(f"---")
        lines.append(f"")
        
        lines.append(f"## 检查概览")
        lines.append(f"")
        lines.append(f"| 指标 | 数值 |")
        lines.append(f"|------|------|")
        lines.append(f"| 总 Key 数 | {result.total_keys} |")
        lines.append(f"| 检查的语言 | {', '.join(result.languages_checked)} |")
        lines.append(f"| **关键错误** | {result.critical_count} |")
        lines.append(f"| **错误** | {result.error_count} |")
        lines.append(f"| **警告** | {result.warning_count} |")
        lines.append(f"| **信息** | {result.info_count} |")
        lines.append(f"| 已人工批准 | {len(approved_issues)} |")
        lines.append(f"| 待处理 | {len(unresolved_issues)} |")
        lines.append(f"")
        
        if result.needs_attention:
            lines.append(f"**状态**: ⚠️ 需要关注")
        elif result.is_clean:
            lines.append(f"**状态**: ✅ 检查通过")
        else:
            lines.append(f"**状态**: ℹ️ 有警告")
        lines.append(f"")
        lines.append(f"---")
        lines.append(f"")
        
        if unresolved_issues:
            lines.append(f"## 待处理问题 ({len(unresolved_issues)})")
            lines.append(f"")
            
            for severity in [CheckSeverity.CRITICAL, CheckSeverity.ERROR, CheckSeverity.WARNING, CheckSeverity.INFO]:
                severity_issues = [i for i in unresolved_issues if i.severity == severity]
                if not severity_issues:
                    continue
                
                severity_icon = {
                    CheckSeverity.CRITICAL: "🛑",
                    CheckSeverity.ERROR: "❌",
                    CheckSeverity.WARNING: "⚠️",
                    CheckSeverity.INFO: "ℹ️",
                }.get(severity, "")
                
                lines.append(f"### {severity_icon} {severity.name} ({len(severity_issues)})")
                lines.append(f"")
                
                for issue in severity_issues:
                    lines.append(f"#### `{issue.key}` [{issue.language}]")
                    lines.append(f"")
                    lines.append(f"- **类型**: {issue.check_type.name}")
                    lines.append(f"- **消息**: {issue.message}")
                    if issue.source_text:
                        lines.append(f"- **原文**: `{issue.source_text}`")
                    if issue.translated_text:
                        lines.append(f"- **译文**: `{issue.translated_text}`")
                    if issue.context:
                        lines.append(f"- **上下文**: {issue.context}")
                    if issue.suggestion:
                        lines.append(f"- **建议**: {issue.suggestion}")
                    lines.append(f"")
        
        if approved_issues:
            lines.append(f"---")
            lines.append(f"")
            lines.append(f"## 已人工批准的问题 ({len(approved_issues)})")
            lines.append(f"")
            lines.append(f"以下问题已通过人工复核放行：")
            lines.append(f"")
            lines.append(f"| Key | 语言 | 类型 | 复核意见 |")
            lines.append(f"|-----|------|------|----------|")
            
            for issue in approved_issues:
                decision = next(
                    (d for d in result.reviewed_decisions 
                     if d.key == issue.key and d.language == issue.language),
                    None
                )
                comment = decision.comment if decision else "已批准"
                lines.append(f"| `{issue.key}` | {issue.language} | {issue.check_type.name} | {comment} |")
            
            lines.append(f"")
        
        lines.append(f"---")
        lines.append(f"")
        lines.append(f"## 配置摘要")
        lines.append(f"")
        lines.append(f"### 占位符规则")
        for rule in config.placeholder_rules:
            lines.append(f"- `{rule.pattern}`: {rule.description}")
        lines.append(f"")
        
        if config.length_budgets:
            lines.append(f"### 长度预算")
            for lang, budget in config.length_budgets.items():
                lines.append(f"- **{lang}**: 最多 {budget.max_characters} 字符")
            lines.append(f"")
        
        if config.forbidden_words:
            lines.append(f"### 禁用词")
            for rule in config.forbidden_words:
                langs = ', '.join(rule.languages) if rule.languages else "所有语言"
                lines.append(f"- `{rule.word}` [{rule.severity.name}]: {langs}")
            lines.append(f"")
        
        lines.append(f"---")
        lines.append(f"")
        lines.append(f"*报告由 freeze-gate 工具生成*")
        
        return '\n'.join(lines)
    
    def export_csv(self, result: CheckResult, include_approved: bool = False) -> Path:
        filename = f"issues_{result.resource_name}_{self.timestamp}.csv"
        filepath = self.output_dir / filename
        
        issues = result.get_unresolved_issues() if not include_approved else result.issues
        
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "Severity", "Check Type", "Key", "Language", "Message",
                "Source Text", "Translated Text", "Context", "Suggestion", "Timestamp"
            ])
            
            for issue in issues:
                writer.writerow([
                    issue.severity.name,
                    issue.check_type.name,
                    issue.key,
                    issue.language,
                    issue.message,
                    issue.source_text,
                    issue.translated_text,
                    issue.context,
                    issue.suggestion,
                    issue.timestamp.isoformat(),
                ])
        
        return filepath
    
    def export_json(self, result: CheckResult, config: ProjectConfig,
                    include_approved: bool = False) -> Path:
        filename = f"audit_{result.resource_name}_{self.timestamp}.json"
        filepath = self.output_dir / filename
        
        unresolved_issues = result.get_unresolved_issues() if not include_approved else result.issues
        
        report_data = {
            "report": {
                "version": "1.0",
                "generated_at": datetime.now().isoformat(),
                "resource_name": result.resource_name,
                "total_keys": result.total_keys,
                "languages_checked": result.languages_checked,
            },
            "summary": {
                "critical": result.critical_count,
                "error": result.error_count,
                "warning": result.warning_count,
                "info": result.info_count,
                "approved": len(result.get_approved_issues()),
                "unresolved": len(unresolved_issues),
            },
            "unresolved_issues": [
                {
                    "severity": issue.severity.name,
                    "check_type": issue.check_type.name,
                    "key": issue.key,
                    "language": issue.language,
                    "message": issue.message,
                    "source_text": issue.source_text,
                    "translated_text": issue.translated_text,
                    "context": issue.context,
                    "suggestion": issue.suggestion,
                    "metadata": issue.metadata,
                    "timestamp": issue.timestamp.isoformat(),
                }
                for issue in unresolved_issues
            ],
            "approved_issues": [
                {
                    "key": decision.key,
                    "language": decision.language,
                    "approved": decision.approved,
                    "reviewer": decision.reviewer,
                    "comment": decision.comment,
                    "timestamp": decision.timestamp.isoformat(),
                }
                for decision in result.reviewed_decisions
            ],
            "config": {
                "source_language": config.source_language,
                "target_languages": config.target_languages,
                "placeholder_rules": [
                    {
                        "pattern": r.pattern,
                        "description": r.description,
                        "example": r.example,
                    }
                    for r in config.placeholder_rules
                ],
                "length_budgets": {
                    lang: {
                        "max_characters": b.max_characters,
                        "max_length": b.max_length,
                        "ratio_to_source": b.ratio_to_source,
                    }
                    for lang, b in config.length_budgets.items()
                },
                "forbidden_words": [
                    {
                        "word": w.word,
                        "languages": w.languages,
                        "severity": w.severity.name,
                        "reason": w.reason,
                    }
                    for w in config.forbidden_words
                ],
            },
        }
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        
        return filepath
