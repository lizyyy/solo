import json
import csv
import os
import hashlib
from typing import List, Dict, Any
from datetime import datetime

from .models import CheckResult, Issue, IssueType, SourceLocation


class ReportGenerator:
    def __init__(self):
        pass

    def _generate_content_hash(self, result: CheckResult) -> str:
        content = json.dumps({
            "summary": self._generate_summary(result),
            "issues": self._issues_to_list(result.issues, ensure_stable=True),
            "account_stats": result.account_stats,
            "person_stats": result.person_stats
        }, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]

    def generate_json_report(
        self,
        result: CheckResult,
        output_path: str,
        ensure_stable: bool = True
    ):
        report = {
            "summary": self._generate_summary(result),
            "issues": self._issues_to_list(result.issues, ensure_stable),
            "account_stats": result.account_stats,
            "person_stats": result.person_stats
        }
        if ensure_stable:
            report["content_hash"] = self._generate_content_hash(result)
            report = self._sort_dict_recursive(report)
        else:
            report["generated_at"] = datetime.now().isoformat()
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

    def generate_csv_report(
        self,
        result: CheckResult,
        output_path: str,
        ensure_stable: bool = True
    ):
        rows = []
        for issue in result.issues:
            for source in issue.sources:
                row = {
                    "issue_type": issue.issue_type.value,
                    "severity": issue.severity,
                    "message": issue.message,
                    "file_path": source.file_path,
                    "sheet_name": source.sheet_name or "",
                    "row_number": source.row_number,
                    "details": json.dumps(issue.details, ensure_ascii=False)
                }
                rows.append(row)
        if ensure_stable:
            rows.sort(key=lambda x: (
                x["issue_type"],
                x["severity"],
                x["file_path"],
                x["row_number"]
            ))
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else [])
            writer.writeheader()
            writer.writerows(rows)

    def _generate_summary(self, result: CheckResult) -> Dict[str, Any]:
        summary = {
            "total_rows": len(result.schedule_rows),
            "valid_rows": sum(1 for r in result.schedule_rows if r.is_valid),
            "total_issues": len(result.issues),
            "issues_by_type": {},
            "issues_by_severity": {}
        }
        for issue in result.issues:
            itype = issue.issue_type.value
            severity = issue.severity
            summary["issues_by_type"][itype] = summary["issues_by_type"].get(itype, 0) + 1
            summary["issues_by_severity"][severity] = summary["issues_by_severity"].get(severity, 0) + 1
        return summary

    def _issues_to_list(self, issues: List[Issue], ensure_stable: bool) -> List[Dict[str, Any]]:
        result = []
        for issue in issues:
            issue_dict = {
                "issue_type": issue.issue_type.value,
                "severity": issue.severity,
                "message": issue.message,
                "sources": [self._source_to_dict(s) for s in issue.sources],
                "details": issue.details
            }
            result.append(issue_dict)
        if ensure_stable:
            result.sort(key=lambda x: (
                x["issue_type"],
                x["severity"],
                x["sources"][0]["file_path"] if x["sources"] else "",
                x["sources"][0]["row_number"] if x["sources"] else 0
            ))
        return result

    @staticmethod
    def _source_to_dict(source: SourceLocation) -> Dict[str, Any]:
        return {
            "file_path": source.file_path,
            "sheet_name": source.sheet_name,
            "row_number": source.row_number,
            "original_content": source.original_content
        }

    @classmethod
    def _sort_dict_recursive(cls, d: Dict[str, Any]) -> Dict[str, Any]:
        if isinstance(d, dict):
            return {k: cls._sort_dict_recursive(v) for k, v in sorted(d.items())}
        elif isinstance(d, list):
            return [cls._sort_dict_recursive(item) for item in d]
        else:
            return d

    def print_console_report(self, result: CheckResult):
        print("=" * 80)
        print("直播排班冲突排查报告")
        print("=" * 80)
        summary = self._generate_summary(result)
        print(f"\n总计: {summary['total_rows']} 行, 有效: {summary['valid_rows']} 行")
        print(f"发现问题: {summary['total_issues']} 个")
        print("\n按类型分布:")
        for itype, count in sorted(summary["issues_by_type"].items()):
            print(f"  {itype}: {count}")
        print("\n" + "=" * 80)
        print("问题详情:")
        print("=" * 80)
        for issue in sorted(result.issues, key=lambda x: (
            {"high": 0, "medium": 1, "low": 2}[x.severity],
            x.issue_type.value
        )):
            print(f"\n[{issue.severity.upper()}] [{issue.issue_type.value}]")
            print(f"  {issue.message}")
            for source in issue.sources:
                loc = f"{source.file_path}:{source.row_number}"
                if source.sheet_name:
                    loc += f" (sheet: {source.sheet_name})"
                print(f"  位置: {loc}")
        print("\n" + "=" * 80)
