import json
import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any

from .models import AuditResult, ValidationError, AuditRecord


class ReportGenerator:
    def __init__(self, output_dir: str = "./output"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_reports(
        self,
        result: AuditResult,
        parse_errors: List[ValidationError],
        base_filename: str = "audit_report",
    ) -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        reports = {}

        reports["json"] = self._generate_json_report(
            result, parse_errors, f"{base_filename}_{timestamp}.json"
        )
        reports["csv_summary"] = self._generate_csv_summary(
            result, parse_errors, f"{base_filename}_summary_{timestamp}.csv"
        )
        reports["csv_errors"] = self._generate_csv_errors(
            parse_errors, f"{base_filename}_errors_{timestamp}.csv"
        )
        reports["text"] = self._generate_text_report(
            result, parse_errors, f"{base_filename}_{timestamp}.txt"
        )

        return reports

    def _generate_json_report(
        self, result: AuditResult, parse_errors: List[ValidationError], filename: str
    ) -> str:
        valid_records_list = sorted(
            [self._record_to_dict(r) for r in result.valid_records.values()],
            key=lambda x: (x["log_topic"], x["start_time"], x["id"]),
        )

        sorted_overlaps = sorted(
            [o.dict() for o in result.overlaps],
            key=lambda x: (x["record1_id"], x["record2_id"]),
        )

        sorted_duplicates = sorted(
            result.duplicates,
            key=lambda x: (x["record_id"], x["primary_id"]),
        )

        sorted_pending = sorted(
            result.pending_releases,
            key=lambda x: (x["log_topic"], x["record_id"]),
        )

        sorted_merged = {}
        for topic in sorted(result.merged_ranges.keys()):
            sorted_merged[topic] = sorted(
                result.merged_ranges[topic],
                key=lambda x: x["start_time"],
            )

        sorted_errors = sorted(
            [e.dict() for e in parse_errors],
            key=lambda x: (
                x["source_info"]["file_path"] if x.get("source_info") else "",
                x["source_info"]["line_number"] if x.get("source_info") else 0,
            ),
        )

        report = {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_valid_records": len(valid_records_list),
                "total_parse_errors": len(sorted_errors),
                "total_duplicates": len(sorted_duplicates),
                "total_overlaps": len(sorted_overlaps),
                "total_pending_releases": len(sorted_pending),
                "total_merged_ranges": sum(len(r) for r in sorted_merged.values()),
            },
            "valid_records": valid_records_list,
            "parse_errors": sorted_errors,
            "duplicates": sorted_duplicates,
            "overlaps": sorted_overlaps,
            "pending_releases": sorted_pending,
            "merged_ranges": sorted_merged,
        }

        output_path = self.output_dir / filename
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2, sort_keys=True)

        return str(output_path)

    def _record_to_dict(self, record: AuditRecord) -> Dict[str, Any]:
        data = record.dict()
        data["start_time"] = record.start_time.isoformat()
        data["end_time"] = record.end_time.isoformat()
        if record.approval_time:
            data["approval_time"] = record.approval_time.isoformat()
        data["created_at"] = record.created_at.isoformat()
        data["operation_type"] = record.operation_type.value
        data["freeze_reason"] = record.freeze_reason.value
        if record.release_status:
            data["release_status"] = record.release_status.value
        return data

    def _generate_csv_summary(
        self, result: AuditResult, parse_errors: List[ValidationError], filename: str
    ) -> str:
        output_path = self.output_dir / filename
        fieldnames = [
            "记录ID",
            "操作类型",
            "日志主题",
            "开始时间",
            "结束时间",
            "冻结原因",
            "申请人",
            "释放条件",
            "释放状态",
            "审批人",
            "审批时间",
            "来源文件",
            "来源行号",
        ]

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            sorted_records = sorted(
                result.valid_records.values(),
                key=lambda r: (r.log_topic, r.start_time, r.id),
            )

            for record in sorted_records:
                writer.writerow(
                    {
                        "记录ID": record.id,
                        "操作类型": record.operation_type.value,
                        "日志主题": record.log_topic,
                        "开始时间": record.start_time.isoformat(),
                        "结束时间": record.end_time.isoformat(),
                        "冻结原因": record.freeze_reason.value,
                        "申请人": record.applicant,
                        "释放条件": record.release_condition or "",
                        "释放状态": record.release_status.value if record.release_status else "",
                        "审批人": record.approver or "",
                        "审批时间": record.approval_time.isoformat() if record.approval_time else "",
                        "来源文件": record.source_info.file_path if record.source_info else "",
                        "来源行号": record.source_info.line_number if record.source_info else "",
                    }
                )

        return str(output_path)

    def _generate_csv_errors(self, parse_errors: List[ValidationError], filename: str) -> str:
        output_path = self.output_dir / filename
        fieldnames = ["错误类型", "错误信息", "来源文件", "来源行号", "原始内容"]

        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            sorted_errors = sorted(
                parse_errors,
                key=lambda e: (
                    e.source_info.file_path if e.source_info else "",
                    e.source_info.line_number if e.source_info else 0,
                ),
            )

            for error in sorted_errors:
                writer.writerow(
                    {
                        "错误类型": error.error_type,
                        "错误信息": error.message,
                        "来源文件": error.source_info.file_path if error.source_info else "",
                        "来源行号": error.source_info.line_number if error.source_info else "",
                        "原始内容": error.source_info.raw_content if error.source_info else "",
                    }
                )

        return str(output_path)

    def _generate_text_report(
        self, result: AuditResult, parse_errors: List[ValidationError], filename: str
    ) -> str:
        output_path = self.output_dir / filename

        lines = []
        lines.append("=" * 80)
        lines.append("日志留存冻结释放审计报告")
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append("")

        lines.append("一、统计摘要")
        lines.append("-" * 40)
        lines.append(f"有效记录数: {len(result.valid_records)}")
        lines.append(f"解析错误数: {len(parse_errors)}")
        lines.append(f"重复申请数: {len(result.duplicates)}")
        lines.append(f"时间范围重叠数: {len(result.overlaps)}")
        lines.append(f"待审批释放数: {len(result.pending_releases)}")
        lines.append("")

        lines.append("二、解析错误详情")
        lines.append("-" * 40)
        if parse_errors:
            sorted_errors = sorted(
                parse_errors,
                key=lambda e: (
                    e.source_info.file_path if e.source_info else "",
                    e.source_info.line_number if e.source_info else 0,
                ),
            )
            for i, error in enumerate(sorted_errors, 1):
                lines.append(f"{i}. {error.error_type}: {error.message}")
                if error.source_info:
                    lines.append(f"   来源: {error.source_info.file_path}:{error.source_info.line_number or 'N/A'}")
                    lines.append(f"   原始内容: {error.source_info.raw_content[:100]}")
                lines.append("")
        else:
            lines.append("无解析错误")
            lines.append("")

        lines.append("三、重复申请详情")
        lines.append("-" * 40)
        if result.duplicates:
            for i, dup in enumerate(result.duplicates, 1):
                lines.append(f"{i}. 记录ID: {dup['record_id']}")
                lines.append(f"   主记录ID: {dup['primary_id']}")
                if dup.get("source_info"):
                    lines.append(f"   来源: {dup['source_info']['file_path']}:{dup['source_info'].get('line_number', 'N/A')}")
                lines.append("")
        else:
            lines.append("无重复申请")
            lines.append("")

        lines.append("四、时间范围重叠详情")
        lines.append("-" * 40)
        if result.overlaps:
            for i, overlap in enumerate(result.overlaps, 1):
                lines.append(f"{i}. 记录 {overlap.record1_id} 与 {overlap.record2_id} 重叠")
                lines.append(f"   重叠时间: {overlap.overlap_start} 至 {overlap.overlap_end}")
                lines.append("")
        else:
            lines.append("无时间范围重叠")
            lines.append("")

        lines.append("五、待审批释放申请")
        lines.append("-" * 40)
        if result.pending_releases:
            for i, pending in enumerate(result.pending_releases, 1):
                lines.append(f"{i}. 记录ID: {pending['record_id']}")
                lines.append(f"   日志主题: {pending['log_topic']}")
                lines.append(f"   当前状态: {pending['current_status']}")
                lines.append(f"   申请人: {pending['applicant']}")
                lines.append(f"   释放条件: {pending.get('release_condition', 'N/A')}")
                lines.append("")
        else:
            lines.append("无待审批释放申请")
            lines.append("")

        lines.append("六、合并后的冻结时间范围")
        lines.append("-" * 40)
        for topic in sorted(result.merged_ranges.keys()):
            lines.append(f"日志主题: {topic}")
            for r in result.merged_ranges[topic]:
                lines.append(f"  {r['start_time']} 至 {r['end_time']}")
                lines.append(f"  涉及记录: {', '.join(r['record_ids'])}")
                lines.append(f"  冻结原因: {', '.join(r['reasons'])}")
                lines.append("")

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return str(output_path)
