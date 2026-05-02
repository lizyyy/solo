import csv
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime
from ..diff.diff_engine import Change
from ..rules.rule_engine import Issue
from ..parser.policy_parser import UpgradePolicy


class ReportGenerator:
    def __init__(self, output_dir: Path = Path('.')):
        self.output_dir = output_dir
        self.output_dir.mkdir(exist_ok=True)

    def generate_patch_plan(self, changes: List[Change], deleted_fields: List[str], 
                            conflicts: List, issues: List[Issue], policy: UpgradePolicy) -> Path:
        """Generate patch_plan.md with changes requiring manual confirmation."""
        file_path = self.output_dir / 'patch_plan.md'
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(f"# Helm Upgrade Patch Plan\n\n")
            f.write(f"Generated: {datetime.now().isoformat()}\n\n")
            
            f.write("## Summary\n\n")
            f.write(f"- Total changes: {len(changes)}\n")
            f.write(f"- Deleted fields: {len(deleted_fields)}\n")
            f.write(f"- Conflicts: {len(conflicts)}\n")
            f.write(f"- Issues: {len(issues)}\n\n")
            
            if deleted_fields:
                f.write("## Deleted Fields (Still in Current Values)\n\n")
                f.write("These fields exist in your current values but have been removed from the target chart:\n\n")
                for field in deleted_fields:
                    f.write(f"- [ ] `{field}` - Verify if this is still needed\n")
                f.write("\n")
            
            if conflicts:
                f.write("## Conflicts Across Environments\n\n")
                f.write("These fields have conflicting values across environment override files:\n\n")
                for path, values in conflicts:
                    f.write(f"- `{path}`: {', '.join(str(v) for v in values)}\n")
                f.write("\n")
            
            f.write("## Field Changes\n\n")
            for change in changes:
                needs_confirm = any(req in change.path for req in policy.required_manual_confirm)
                checkbox = "[ ]" if needs_confirm else "[x]"
                
                f.write(f"### {checkbox} {change.type.upper()}: {change.path}\n\n")
                if change.old_value is not None:
                    f.write(f"**Before:**\n```yaml\n{change.old_value}\n```\n\n")
                if change.new_value is not None:
                    f.write(f"**After:**\n```yaml\n{change.new_value}\n```\n\n")
                f.write("\n")
            
            if issues:
                f.write("## Issues Requiring Attention\n\n")
                for issue in issues:
                    f.write(f"### [{issue.severity.upper()}] {issue.issue_type}: {issue.path}\n\n")
                    f.write(f"{issue.message}\n\n")
                    if issue.details:
                        f.write(f"**Details:**\n```\n{issue.details}\n```\n\n")
        
        return file_path

    def generate_issues_csv(self, issues: List[Issue]) -> Path:
        """Generate issues.csv with all detected issues."""
        file_path = self.output_dir / 'issues.csv'
        
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['Type', 'Severity', 'Path', 'Message', 'Details'])
            
            for issue in issues:
                writer.writerow([
                    issue.issue_type,
                    issue.severity,
                    issue.path,
                    issue.message,
                    str(issue.details)
                ])
        
        return file_path

    def generate_summary(self, diff_result: Dict[str, Any], issues: List[Issue]) -> Dict[str, Any]:
        """Generate a summary of all findings."""
        changes = diff_result.get('changes', [])
        deleted_fields = diff_result.get('deleted_fields', [])
        conflicts = diff_result.get('conflicts', [])
        
        return {
            'summary': {
                'changes': len(changes),
                'deleted_fields': len(deleted_fields),
                'conflicts': len(conflicts),
                'issues': len(issues),
                'critical_issues': len([i for i in issues if i.severity == 'high'])
            },
            'changes': [{'type': c.type, 'path': c.path} for c in changes],
            'deleted_fields': deleted_fields,
            'conflicts': [{'path': p, 'values': v} for p, v in conflicts],
            'issues': [{'type': i.issue_type, 'severity': i.severity, 'path': i.path, 'message': i.message} for i in issues]
        }
