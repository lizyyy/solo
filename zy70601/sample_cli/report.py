import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
import uuid

from .models import SampleRecord, ValidationResult, HandoverReport, RejectionReason, ApprovalStatus


class ReportGenerator:
    def __init__(self):
        pass

    def generate_report(self, records: List[SampleRecord], validation_result: ValidationResult) -> HandoverReport:
        sorted_records = sorted(records, key=lambda x: (x.source_file, x.source_row))

        summary = {
            "by_source": self._summarize_by_source(sorted_records),
            "by_rejection_reason": self._summarize_by_rejection_reason(sorted_records),
            "by_approval_status": self._summarize_by_approval_status(sorted_records),
        }

        return HandoverReport(
            report_id=str(uuid.uuid4()),
            generated_at=datetime.now(),
            validation_result=validation_result,
            records=sorted_records,
            summary=summary,
        )

    def _summarize_by_source(self, records: List[SampleRecord]) -> Dict[str, Dict[str, int]]:
        source_map: Dict[str, Dict[str, int]] = {}
        for record in records:
            source = record.source_file
            if source not in source_map:
                source_map[source] = {
                    "total": 0,
                    "valid": 0,
                    "invalid": 0,
                    "rejected": 0,
                    "pending_approval": 0,
                }
            source_map[source]["total"] += 1
            if record.is_valid:
                source_map[source]["valid"] += 1
            else:
                source_map[source]["invalid"] += 1
            if record.is_rejected:
                source_map[source]["rejected"] += 1
            if record.approval_status == ApprovalStatus.PENDING:
                source_map[source]["pending_approval"] += 1
        return source_map

    def _summarize_by_rejection_reason(self, records: List[SampleRecord]) -> Dict[str, int]:
        reason_count: Dict[str, int] = {}
        for record in records:
            if record.rejection_reason:
                reason = record.rejection_reason.value
                reason_count[reason] = reason_count.get(reason, 0) + 1
        return reason_count

    def _summarize_by_approval_status(self, records: List[SampleRecord]) -> Dict[str, int]:
        status_count: Dict[str, int] = {}
        for record in records:
            status = record.approval_status.value
            status_count[status] = status_count.get(status, 0) + 1
        return status_count

    def export_csv(self, report: HandoverReport, output_path: str) -> str:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        rows = []
        for record in report.records:
            row = {
                "来源文件": record.source_file,
                "来源行号": record.source_row,
                "样本条码": record.barcode,
                "采样时间": record.sampling_time.strftime("%Y-%m-%d %H:%M:%S") if record.sampling_time else "",
                "运输人": record.transporter or "",
                "运输批次": record.transport_batch or "",
                "接收时间": record.receive_time.strftime("%Y-%m-%d %H:%M:%S") if record.receive_time else "",
                "接收窗口": record.receive_window or "",
                "是否拒收": "是" if record.is_rejected else "否",
                "拒收原因": record.rejection_reason.value if record.rejection_reason else "",
                "拒收备注": record.rejection_note or "",
                "审批状态": record.approval_status.value,
                "审批人": record.approver or "",
                "审批时间": record.approval_time.strftime("%Y-%m-%d %H:%M:%S") if record.approval_time else "",
                "记录有效": "是" if record.is_valid else "否",
                "错误信息": "; ".join(record.errors),
                "警告信息": "; ".join(record.warnings),
            }
            rows.append(row)

        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys() if rows else [])
            writer.writeheader()
            writer.writerows(rows)

        return str(path)

    def export_json(self, report: HandoverReport, output_path: str) -> str:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "report_id": report.report_id,
            "generated_at": report.generated_at.isoformat(),
            "validation_result": {
                "total_records": report.validation_result.total_records,
                "valid_records": report.validation_result.valid_records,
                "invalid_records": report.validation_result.invalid_records,
                "rejected_records": report.validation_result.rejected_records,
                "pending_approval": report.validation_result.pending_approval,
                "barcode_duplicates": report.validation_result.barcode_duplicates,
                "time_expired": report.validation_result.time_expired,
                "error_details": report.validation_result.error_details,
            },
            "summary": report.summary,
            "records": [
                {
                    "source_file": r.source_file,
                    "source_row": r.source_row,
                    "barcode": r.barcode,
                    "sampling_time": r.sampling_time.isoformat() if r.sampling_time else None,
                    "transporter": r.transporter,
                    "transport_batch": r.transport_batch,
                    "receive_time": r.receive_time.isoformat() if r.receive_time else None,
                    "receive_window": r.receive_window,
                    "is_rejected": r.is_rejected,
                    "rejection_reason": r.rejection_reason.value if r.rejection_reason else None,
                    "rejection_note": r.rejection_note,
                    "approval_status": r.approval_status.value,
                    "approval_time": r.approval_time.isoformat() if r.approval_time else None,
                    "approver": r.approver,
                    "is_valid": r.is_valid,
                    "errors": r.errors,
                    "warnings": r.warnings,
                }
                for r in report.records
            ],
        }

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return str(path)

    def export_summary_txt(self, report: HandoverReport, output_path: str) -> str:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        lines = [
            "=" * 60,
            f"检验样本交接报告",
            f"报告ID: {report.report_id}",
            f"生成时间: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            "=" * 60,
            "",
            "【总体统计】",
            f"  总记录数: {report.validation_result.total_records}",
            f"  有效记录: {report.validation_result.valid_records}",
            f"  无效记录: {report.validation_result.invalid_records}",
            f"  拒收记录: {report.validation_result.rejected_records}",
            f"  待审批: {report.validation_result.pending_approval}",
            "",
        ]

        if report.validation_result.barcode_duplicates:
            lines.extend([
                "【条码重复】",
                f"  共 {len(report.validation_result.barcode_duplicates)} 个重复条码:",
            ])
            for barcode in report.validation_result.barcode_duplicates:
                lines.append(f"    - {barcode}")
            lines.append("")

        if report.validation_result.time_expired:
            lines.extend([
                "【接收超时】",
                f"  共 {len(report.validation_result.time_expired)} 条超时记录:",
            ])
            for barcode in report.validation_result.time_expired:
                lines.append(f"    - {barcode}")
            lines.append("")

        lines.extend([
            "【按来源文件统计】",
        ])
        for source, stats in report.summary["by_source"].items():
            lines.extend([
                f"  {source}:",
                f"    总数: {stats['total']}, 有效: {stats['valid']}, 无效: {stats['invalid']}, 拒收: {stats['rejected']}, 待审批: {stats['pending_approval']}",
            ])
        lines.append("")

        lines.extend([
            "【按拒收原因统计】",
        ])
        for reason, count in report.summary["by_rejection_reason"].items():
            lines.append(f"  {reason}: {count} 条")
        lines.append("")

        lines.extend([
            "【按审批状态统计】",
        ])
        for status, count in report.summary["by_approval_status"].items():
            lines.append(f"  {status}: {count} 条")

        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return str(path)
