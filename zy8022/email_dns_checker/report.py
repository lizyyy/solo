import csv
from typing import Dict, List
from datetime import datetime
from .rule_engine import Issue, RiskLevel


class MarkdownReport:
    @staticmethod
    def generate(results: Dict[str, List[Issue]], output_file: str) -> None:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("# Email DNS Health Check Report\n\n")
            f.write(f"**Generated at:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            total_critical = 0
            total_warning = 0
            total_info = 0
            
            for domain, issues in results.items():
                for issue in issues:
                    if issue.risk_level == RiskLevel.CRITICAL:
                        total_critical += 1
                    elif issue.risk_level == RiskLevel.WARNING:
                        total_warning += 1
                    else:
                        total_info += 1
            
            f.write("## Summary\n\n")
            f.write(f"- **Critical issues:** {total_critical}\n")
            f.write(f"- **Warning issues:** {total_warning}\n")
            f.write(f"- **Info issues:** {total_info}\n")
            f.write(f"- **Domains checked:** {len(results)}\n\n")
            
            f.write("## Detailed Results\n\n")
            
            for domain, issues in sorted(results.items()):
                f.write(f"### {domain}\n\n")
                
                critical_issues = [i for i in issues if i.risk_level == RiskLevel.CRITICAL]
                warning_issues = [i for i in issues if i.risk_level == RiskLevel.WARNING]
                info_issues = [i for i in issues if i.risk_level == RiskLevel.INFO]
                
                if critical_issues:
                    f.write("#### 🔴 Critical\n\n")
                    for issue in critical_issues:
                        selector_info = f" (selector: {issue.selector})" if issue.selector else ""
                        f.write(f"- **{issue.rule}**: {issue.description}{selector_info}\n")
                    f.write("\n")
                
                if warning_issues:
                    f.write("#### 🟡 Warning\n\n")
                    for issue in warning_issues:
                        selector_info = f" (selector: {issue.selector})" if issue.selector else ""
                        f.write(f"- **{issue.rule}**: {issue.description}{selector_info}\n")
                    f.write("\n")
                
                if info_issues:
                    f.write("#### 🔵 Info\n\n")
                    for issue in info_issues:
                        selector_info = f" (selector: {issue.selector})" if issue.selector else ""
                        f.write(f"- **{issue.rule}**: {issue.description}{selector_info}\n")
                    f.write("\n")
                
                if not issues:
                    f.write("✅ All checks passed!\n\n")


class CSVReport:
    @staticmethod
    def generate(results: Dict[str, List[Issue]], output_file: str) -> None:
        with open(output_file, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                'domain',
                'selector',
                'rule',
                'description',
                'risk_level',
                'timestamp'
            ])
            
            timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            
            for domain, issues in sorted(results.items()):
                if not issues:
                    writer.writerow([
                        domain,
                        '',
                        'ALL_PASSED',
                        'All checks passed',
                        'info',
                        timestamp
                    ])
                else:
                    for issue in issues:
                        writer.writerow([
                            domain,
                            issue.selector or '',
                            issue.rule,
                            issue.description,
                            issue.risk_level.value,
                            timestamp
                        ])


class Reports:
    @staticmethod
    def generate_all(results: Dict[str, List[Issue]], markdown_file: str, csv_file: str) -> None:
        MarkdownReport.generate(results, markdown_file)
        CSVReport.generate(results, csv_file)
