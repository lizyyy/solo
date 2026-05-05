import json
from dataclasses import asdict, is_dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, Optional

from ..analyzers import AnalysisResult


class ExportFormat(Enum):
    JSON = "json"
    MARKDOWN = "markdown"


class ReportExporter:
    def __init__(self, result: AnalysisResult):
        self.result = result
    
    def export_json(self, pretty: bool = True) -> str:
        data = self._to_serializable_dict(self.result)
        
        if pretty:
            return json.dumps(data, indent=2, ensure_ascii=False, default=str)
        return json.dumps(data, ensure_ascii=False, default=str)
    
    def export_markdown(self, title: Optional[str] = None) -> str:
        if title is None:
            title = "Configuration Diagnostic Report"
        
        lines = []
        
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**Project:** {self.result.project_path}")
        lines.append("")
        
        lines.append("## Summary")
        lines.append("")
        lines.append("| Metric | Value |")
        lines.append("|--------|-------|")
        
        summary = self.result.summary
        lines.append(f"| Config Files Found | {summary.get('configs_found', 0)} |")
        lines.append(f"| Total Keys | {summary.get('total_keys', 0)} |")
        
        issues = summary.get('issues', {})
        lines.append(f"| Security Issues | {issues.get('security', 0)} |")
        lines.append(f"| Priority Conflicts | {issues.get('priority_conflicts', 0)} |")
        lines.append(f"| Missing Defaults | {issues.get('missing_defaults', 0)} |")
        lines.append("")
        
        if self.result.priority_result:
            lines.append("## Priority Analysis")
            lines.append("")
            
            priority = self.result.priority_result
            lines.append(f"**Total Configs:** {priority.total_configs}")
            lines.append(f"**Unique Keys:** {priority.unique_keys}")
            lines.append(f"**Overridden Keys:** {priority.overridden_keys}")
            lines.append("")
            
            if priority.overrides:
                lines.append("### Overridden Keys")
                lines.append("")
                lines.append("| Key | Effective Value | Source | Overridden By |")
                lines.append("|-----|-----------------|--------|---------------|")
                
                for key, override in priority.overrides.items():
                    overridden_list = ", ".join(
                        f"{o['source']} ({o['value']})"
                        for o in override.overridden_by
                    )
                    lines.append(
                        f"| `{key}` | `{override.effective_value}` | "
                        f"{override.effective_source.value} | {overridden_list or 'None'} |"
                    )
                lines.append("")
        
        if self.result.security_result:
            lines.append("## Security Analysis")
            lines.append("")
            
            security = self.result.security_result
            lines.append("### Severity Distribution")
            lines.append("")
            lines.append("| Severity | Count |")
            lines.append("|----------|-------|")
            lines.append(f"| Critical | {security.critical_count} |")
            lines.append(f"| High | {security.high_count} |")
            lines.append(f"| Medium | {security.medium_count} |")
            lines.append(f"| Low | {security.low_count} |")
            lines.append("")
            
            if security.findings:
                lines.append("### Findings")
                lines.append("")
                
                for finding in security.findings:
                    severity_badge = self._get_severity_badge(finding.severity)
                    lines.append(f"#### {severity_badge} {finding.finding_type.value}")
                    lines.append("")
                    lines.append(f"**Key:** `{finding.key}`")
                    lines.append(f"**Source:** {finding.source} ({finding.source_path})")
                    if finding.line_number:
                        lines.append(f"**Line:** {finding.line_number}")
                    lines.append("")
                    lines.append(f"**Description:** {finding.description}")
                    lines.append("")
                    lines.append(f"**Suggestion:** {finding.suggestion}")
                    lines.append("")
        
        if self.result.defaults_result:
            lines.append("## Default Values Analysis")
            lines.append("")
            
            defaults = self.result.defaults_result
            lines.append("### Status Distribution")
            lines.append("")
            lines.append("| Status | Count |")
            lines.append("|--------|-------|")
            lines.append(f"| Explicitly Set | {defaults.explicitly_set} |")
            lines.append(f"| Using Default | {defaults.using_default} |")
            lines.append(f"| Missing Default | {defaults.missing_no_default} |")
            lines.append(f"| Overridden | {defaults.overridden} |")
            lines.append("")
            
            if defaults.warnings:
                lines.append("### Warnings")
                lines.append("")
                for warning in defaults.warnings:
                    lines.append(f"- ⚠️ {warning}")
                lines.append("")
        
        if self.result.migration_result:
            lines.append("## Migration Analysis")
            lines.append("")
            
            migration = self.result.migration_result
            summary = migration.summary
            
            lines.append("### Changes Summary")
            lines.append("")
            lines.append(f"**Versions Compared:** {summary.get('versions_compared', 0)}")
            lines.append(f"**Total Changes:** {summary.get('total_changes', 0)}")
            lines.append("")
            
            if migration.added_keys:
                lines.append(f"**Added Keys ({len(migration.added_keys)}):**")
                lines.append("")
                for key in migration.added_keys:
                    lines.append(f"- `{key}`")
                lines.append("")
            
            if migration.removed_keys:
                lines.append(f"**Removed Keys ({len(migration.removed_keys)}):**")
                lines.append("")
                for key in migration.removed_keys:
                    lines.append(f"- `{key}`")
                lines.append("")
            
            if migration.modified_keys:
                lines.append(f"**Modified Keys ({len(migration.modified_keys)}):**")
                lines.append("")
                for key in migration.modified_keys:
                    lines.append(f"- `{key}`")
                lines.append("")
            
            if migration.rollback_risks:
                lines.append("### Rollback Risks")
                lines.append("")
                for risk in migration.rollback_risks:
                    severity_badge = self._get_severity_badge(risk.risk_level)
                    lines.append(f"#### {severity_badge} {risk.key}")
                    lines.append("")
                    lines.append(f"**Risk:** {risk.risk_description}")
                    lines.append("")
                    lines.append(f"**Impact:** {risk.impact}")
                    lines.append("")
                    lines.append(f"**Mitigation:** {risk.mitigation}")
                    lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*Report generated by config-diagnostic CLI*")
        
        return "\n".join(lines)
    
    def _to_serializable_dict(self, obj: Any) -> Any:
        if is_dataclass(obj):
            return {
                k: self._to_serializable_dict(v)
                for k, v in asdict(obj).items()
            }
        elif isinstance(obj, Enum):
            return obj.value
        elif isinstance(obj, dict):
            return {k: self._to_serializable_dict(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._to_serializable_dict(v) for v in obj]
        elif isinstance(obj, tuple):
            return tuple(self._to_serializable_dict(v) for v in obj)
        elif isinstance(obj, Path):
            return str(obj)
        elif isinstance(obj, datetime):
            return obj.isoformat()
        return obj
    
    def _get_severity_badge(self, severity: Enum) -> str:
        badges = {
            "critical": "🔴 **CRITICAL**",
            "high": "🟠 **HIGH**",
            "medium": "🟡 **MEDIUM**",
            "low": "🟢 **LOW**",
            "info": "🔵 **INFO**",
        }
        return badges.get(severity.value, severity.value)
    
    def save_json(self, path: str, pretty: bool = True) -> None:
        output_path = Path(path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(self.export_json(pretty=pretty))
    
    def save_markdown(self, path: str, title: Optional[str] = None) -> None:
        output_path = Path(path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(self.export_markdown(title=title))
