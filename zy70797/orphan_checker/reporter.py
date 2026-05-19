import json
import os
from datetime import datetime
from typing import List, Dict, Any
import pandas as pd
from .models import OrphanReport, ServiceEntry, EvidenceStatus, SourceLocation


class ReportGenerator:
    def __init__(self, output_dir: str = "reports"):
        self.output_dir = os.path.abspath(output_dir)
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_report(
        self,
        valid_entries: List[ServiceEntry],
        invalid_entries: List[ServiceEntry],
        orphan_reports: List[OrphanReport],
        include_details: bool = True,
    ) -> Dict[str, Any]:
        orphan_reports_sorted = sorted(orphan_reports, key=lambda r: r.get_stable_sort_key())

        orphan_count = sum(1 for r in orphan_reports_sorted if r.is_orphan)
        alive_count = sum(1 for r in orphan_reports_sorted if r.overall_status == EvidenceStatus.ALIVE)
        dead_count = sum(1 for r in orphan_reports_sorted if r.overall_status == EvidenceStatus.DEAD)
        unknown_count = sum(1 for r in orphan_reports_sorted if r.overall_status == EvidenceStatus.UNKNOWN)
        error_count = sum(1 for r in orphan_reports_sorted if r.overall_status == EvidenceStatus.ERROR)

        report = {
            "metadata": {
                "generated_at": datetime.now().isoformat(),
                "version": "1.0.0",
            },
            "summary": {
                "total_services": len(valid_entries) + len(invalid_entries),
                "valid_services": len(valid_entries),
                "invalid_services": len(invalid_entries),
                "orphan_services": orphan_count,
                "status_breakdown": {
                    "alive": alive_count,
                    "dead": dead_count,
                    "unknown": unknown_count,
                    "error": error_count,
                },
            },
            "orphan_services": self._format_orphan_list(orphan_reports_sorted, include_details),
            "invalid_entries": self._format_invalid_list(invalid_entries),
        }

        return report

    def _format_orphan_list(self, orphan_reports: List[OrphanReport], include_details: bool) -> List[Dict[str, Any]]:
        result: List[Dict[str, Any]] = []

        for report in orphan_reports:
            entry = report.service_entry
            item = {
                "service_name": entry.service_name,
                "is_orphan": report.is_orphan,
                "overall_status": report.overall_status.value,
                "orphan_reasons": report.orphan_reasons,
                "source_location": str(entry.source) if entry.source else None,
                "repository": entry.repository,
                "owners": entry.owners,
                "alert_rules": entry.alert_rules,
            }

            if include_details:
                item["repository_evidence"] = self._format_evidence(report.repository_evidence)
                item["alert_evidence"] = self._format_evidence(report.alert_evidence)
                item["owner_evidence"] = {
                    k: [t.value for t in v] for k, v in report.owner_evidence.items()
                }

            result.append(item)

        return result

    def _format_evidence(self, evidence) -> Dict[str, Any]:
        if not evidence:
            return {}
        return {
            "status": evidence.status.value,
            "message": evidence.message,
            "checked_at": evidence.checked_at.isoformat(),
            "details": evidence.details,
        }

    def _format_invalid_list(self, invalid_entries: List[ServiceEntry]) -> List[Dict[str, Any]]:
        result: List[Dict[str, Any]] = []

        for entry in invalid_entries:
            item = {
                "service_name": entry.service_name,
                "parse_error": entry.parse_error,
                "source_location": str(entry.source) if entry.source else None,
                "raw_content": entry.source.raw_content if entry.source else None,
            }
            result.append(item)

        return result

    def export_json(self, report: Dict[str, Any], filename: str = "orphan_report.json") -> str:
        file_path = os.path.join(self.output_dir, filename)
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2, sort_keys=True)
        return file_path

    def export_excel(self, report: Dict[str, Any], filename: str = "orphan_report.xlsx") -> str:
        file_path = os.path.join(self.output_dir, filename)

        with pd.ExcelWriter(file_path, engine="openpyxl") as writer:
            orphan_data = report.get("orphan_services", [])
            if orphan_data:
                df_orphan = pd.DataFrame([
                    {
                        "服务名称": item["service_name"],
                        "是否孤儿": "是" if item["is_orphan"] else "否",
                        "整体状态": item["overall_status"],
                        "仓库地址": item.get("repository", ""),
                        "负责人": ", ".join(item.get("owners", [])),
                        "告警规则": ", ".join(item.get("alert_rules", [])),
                        "孤儿原因": "; ".join(item.get("orphan_reasons", [])),
                        "来源位置": item.get("source_location", ""),
                    }
                    for item in orphan_data
                ])
                df_orphan.to_excel(writer, sheet_name="孤儿服务清单", index=False)

            invalid_data = report.get("invalid_entries", [])
            if invalid_data:
                df_invalid = pd.DataFrame([
                    {
                        "条目名称": item["service_name"],
                        "解析错误": item["parse_error"],
                        "来源位置": item.get("source_location", ""),
                        "原始内容": item.get("raw_content", ""),
                    }
                    for item in invalid_data
                ])
                df_invalid.to_excel(writer, sheet_name="无效条目", index=False)

            summary_data = report.get("summary", {})
            df_summary = pd.DataFrame([
                {"统计项": "总服务数", "数值": summary_data.get("total_services", 0)},
                {"统计项": "有效服务数", "数值": summary_data.get("valid_services", 0)},
                {"统计项": "无效服务数", "数值": summary_data.get("invalid_services", 0)},
                {"统计项": "孤儿服务数", "数值": summary_data.get("orphan_services", 0)},
            ])
            df_summary.to_excel(writer, sheet_name="统计汇总", index=False)

        return file_path

    def export_text(self, report: Dict[str, Any], filename: str = "orphan_report.txt") -> str:
        file_path = os.path.join(self.output_dir, filename)

        lines = []
        lines.append("=" * 80)
        lines.append("服务目录孤儿条目排查报告")
        lines.append(f"生成时间: {report['metadata']['generated_at']}")
        lines.append("=" * 80)
        lines.append("")

        summary = report["summary"]
        lines.append("【统计汇总】")
        lines.append(f"  总服务数: {summary['total_services']}")
        lines.append(f"  有效服务: {summary['valid_services']}")
        lines.append(f"  无效条目: {summary['invalid_services']}")
        lines.append(f"  孤儿服务: {summary['orphan_services']}")
        lines.append("")
        lines.append("  状态分布:")
        for status, count in summary["status_breakdown"].items():
            lines.append(f"    {status.upper()}: {count}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("【孤儿服务详情】")
        lines.append("")

        for item in report["orphan_services"]:
            if item["is_orphan"]:
                lines.append(f"  服务: {item['service_name']}")
                lines.append(f"  状态: {item['overall_status']}")
                lines.append(f"  位置: {item.get('source_location', 'N/A')}")
                if item.get("repository"):
                    lines.append(f"  仓库: {item['repository']}")
                if item.get("owners"):
                    lines.append(f"  负责人: {', '.join(item['owners'])}")
                if item.get("orphan_reasons"):
                    lines.append("  原因:")
                    for reason in item["orphan_reasons"]:
                        lines.append(f"    - {reason}")
                lines.append("")

        lines.append("-" * 80)
        lines.append("【无效条目详情】")
        lines.append("")

        for item in report["invalid_entries"]:
            lines.append(f"  条目: {item['service_name']}")
            lines.append(f"  错误: {item['parse_error']}")
            lines.append(f"  位置: {item.get('source_location', 'N/A')}")
            lines.append("")

        with open(file_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return file_path

    def export_all(self, report: Dict[str, Any], base_name: str = "orphan_report") -> Dict[str, str]:
        return {
            "json": self.export_json(report, f"{base_name}.json"),
            "excel": self.export_excel(report, f"{base_name}.xlsx"),
            "text": self.export_text(report, f"{base_name}.txt"),
        }
