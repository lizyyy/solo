from datetime import datetime
from typing import List, Dict, Any
from pathlib import Path
import json
import csv

from .models import (
    ProcessingResult,
    AuctionRecord,
    IssueSeverity,
    IssueType,
    RecordState,
)


class ReportGenerator:
    def __init__(self):
        pass

    def _format_issue_for_report(self, issue) -> Dict[str, Any]:
        return {
            "类型": issue.get("type", "") if isinstance(issue, dict) else issue.issue_type.value,
            "严重程度": issue.get("severity", "") if isinstance(issue, dict) else issue.severity.value,
            "消息": issue.get("message", "") if isinstance(issue, dict) else issue.message,
            "字段": issue.get("field", "") if isinstance(issue, dict) else (issue.field or ""),
            "影响": issue.get("impact", "") if isinstance(issue, dict) else (issue.impact or ""),
            "建议": issue.get("suggestion", "") if isinstance(issue, dict) else (issue.suggestion or ""),
            "影响记录数": issue.get("affected_records", 1) if isinstance(issue, dict) else issue.affected_records,
        }

    def generate_text_report(self, result: ProcessingResult, output_path: str) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("艺术品价格指数分析报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"处理状态: {result.status.value}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("一、处理概览")
        lines.append("-" * 80)
        lines.append(f"总文件数: {result.total_files}")
        lines.append(f"成功文件: {result.successful_files}")
        lines.append(f"失败文件: {result.failed_files}")
        lines.append(f"总记录数: {result.total_records}")
        lines.append(f"有效记录: {result.valid_records}")
        lines.append(f"排除记录: {result.excluded_records}")
        lines.append(f"艺术家数量: {len(result.artists)}")
        lines.append(f"媒介数量: {len(result.media)}")
        lines.append("")

        lines.append("记录状态分布:")
        for state, count in result.records_by_state.items():
            state_name = {
                "raw": "原始数据",
                "imported": "已导入",
                "currency_normalized": "币种已归一化",
                "deduplicated": "已去重",
                "outlier_checked": "异常值已检测",
                "index_calculated": "指数已计算",
                "excluded": "已排除",
            }.get(state, state)
            lines.append(f"  - {state_name}: {count} 条")
        lines.append("")

        lines.append("-" * 80)
        lines.append("二、问题汇总")
        lines.append("-" * 80)

        severity_counts: Dict[str, int] = {}
        type_counts: Dict[str, int] = {}
        for issue in result.issues:
            sev = issue.severity.value if hasattr(issue, "severity") else issue.get("severity", "unknown")
            typ = issue.issue_type.value if hasattr(issue, "issue_type") else issue.get("type", "unknown")
            severity_counts[sev] = severity_counts.get(sev, 0) + 1
            type_counts[typ] = type_counts.get(typ, 0) + 1

        lines.append("按严重程度:")
        for sev, count in sorted(severity_counts.items()):
            sev_name = {
                "info": "信息",
                "warning": "警告",
                "error": "错误",
                "critical": "严重",
            }.get(sev, sev)
            lines.append(f"  - {sev_name}: {count} 个")
        lines.append("")

        lines.append("按问题类型:")
        for typ, count in sorted(type_counts.items()):
            type_name = {
                "missing_field": "字段缺失",
                "invalid_date": "日期格式错误",
                "invalid_price": "价格格式错误",
                "unknown_currency": "未知币种",
                "duplicate_record": "重复记录",
                "extreme_value": "极端价格",
                "outlier": "异常值",
                "corrupt_file": "文件损坏",
                "parse_error": "解析错误",
            }.get(typ, typ)
            lines.append(f"  - {type_name}: {count} 个")
        lines.append("")

        critical_issues = [
            i
            for i in result.issues
            if (hasattr(i, "severity") and i.severity in (IssueSeverity.ERROR, IssueSeverity.CRITICAL))
            or (isinstance(i, dict) and i.get("severity") in ("error", "critical"))
        ]
        if critical_issues:
            lines.append("严重问题列表:")
            for issue in critical_issues[:20]:
                msg = issue.get("message", "") if isinstance(issue, dict) else issue.message
                lines.append(f"  ! {msg}")
            if len(critical_issues) > 20:
                lines.append(f"  ... 还有 {len(critical_issues) - 20} 个严重问题")
        lines.append("")

        lines.append("-" * 80)
        lines.append("三、价格指数")
        lines.append("-" * 80)

        if result.index_series:
            lines.append(f"指数周期数: {len(result.index_series)}")
            lines.append(f"基期: {result.index_series[0].period}")
            lines.append("")
            lines.append("指数序列:")
            lines.append(f"{'周期':<15} {'指数值':>10} {'记录数':>8} {'中位价':>12} {'均价':>12}")
            lines.append("-" * 65)
            for point in result.index_series:
                lines.append(
                    f"{point.period:<15} {point.index_value:>10.2f} {point.record_count:>8} "
                    f"${point.median_price:>11,.0f} ${point.mean_price:>11,.0f}"
                )
        else:
            lines.append("未生成价格指数 (有效记录不足)")
        lines.append("")

        lines.append("-" * 80)
        lines.append("四、文件处理详情")
        lines.append("-" * 80)
        for fr in result.file_results:
            status_icon = {"success": "✓", "partial": "⚠", "failed": "✗", "skipped": "-"}.get(
                fr.get("status", "unknown"), "?"
            )
            lines.append(
                f"{status_icon} {fr.get('file_name', '')}: "
                f"成功 {fr.get('records_imported', 0)} 条, "
                f"失败 {fr.get('records_failed', 0)} 条"
            )
            if fr.get("issues"):
                for issue in fr["issues"][:3]:
                    lines.append(f"    - {issue.get('message', '')}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("五、主要艺术家")
        lines.append("-" * 80)
        sorted_artists = sorted(
            result.artists.values(), key=lambda a: a.total_auctions, reverse=True
        )[:10]
        for artist in sorted_artists:
            lines.append(f"  - {artist.name}: {artist.total_auctions} 条记录")
        lines.append("")

        lines.append("-" * 80)
        lines.append("六、主要媒介")
        lines.append("-" * 80)
        sorted_media = sorted(
            result.media.values(), key=lambda m: m.total_records, reverse=True
        )[:10]
        for medium in sorted_media:
            lines.append(f"  - {medium.name}: {medium.total_records} 条记录")
        lines.append("")

        lines.append("=" * 80)

        report_text = "\n".join(lines)

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(report_text)

        return report_text

    def generate_json_report(self, result: ProcessingResult, output_path: str) -> str:
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "summary": result.to_summary_dict(),
            "files": result.file_results,
            "issues": [
                self._format_issue_for_report(i) for i in result.issues
            ],
            "index_series": [p.to_dict() for p in result.index_series],
            "artists": [a.to_dict() for a in result.artists.values()],
            "media": [m.to_dict() for m in result.media.values()],
            "records_sample": [r.to_dict() for r in result.records[:100]],
        }

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

        return json.dumps(report_data, ensure_ascii=False, indent=2)

    def generate_records_csv(self, result: ProcessingResult, output_path: str) -> None:
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)

        fieldnames = [
            "record_id",
            "source_file",
            "artist_name",
            "artwork_title",
            "medium_name",
            "auction_date",
            "auction_house",
            "original_currency",
            "original_price",
            "usd_price",
            "state",
            "is_duplicate",
            "is_outlier",
            "index_value",
            "issues_count",
        ]

        with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for record in result.records:
                writer.writerow(
                    {
                        "record_id": record.record_id,
                        "source_file": record.source_file,
                        "artist_name": record.artist_name or "",
                        "artwork_title": record.artwork_title or "",
                        "medium_name": record.medium_name or "",
                        "auction_date": record.auction_date.isoformat()
                        if record.auction_date
                        else "",
                        "auction_house": record.auction_house or "",
                        "original_currency": record.original_currency or "",
                        "original_price": record.original_price or "",
                        "usd_price": record.usd_price or "",
                        "state": record.state.value,
                        "is_duplicate": record.duplicate_of is not None,
                        "is_outlier": record.is_outlier,
                        "index_value": record.index_value or "",
                        "issues_count": len(record.issues),
                    }
                )

    def generate_all_reports(
        self, result: ProcessingResult, output_dir: str
    ) -> Dict[str, str]:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        reports = {}

        text_path = str(output_path / "report.txt")
        self.generate_text_report(result, text_path)
        reports["text_report"] = text_path

        json_path = str(output_path / "report.json")
        self.generate_json_report(result, json_path)
        reports["json_report"] = json_path

        csv_path = str(output_path / "records.csv")
        self.generate_records_csv(result, csv_path)
        reports["records_csv"] = csv_path

        return reports
