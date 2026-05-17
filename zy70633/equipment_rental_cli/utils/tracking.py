from typing import List, Dict
from ..models import BadRecord, SourceLocation, VerificationResult


class BadRecordReporter:
    @staticmethod
    def group_by_file(bad_records: List[BadRecord]) -> Dict[str, List[BadRecord]]:
        grouped = {}
        for record in bad_records:
            file_path = record.source.file_path
            if file_path not in grouped:
                grouped[file_path] = []
            grouped[file_path].append(record)
        return grouped

    @staticmethod
    def format_bad_records(bad_records: List[BadRecord]) -> str:
        if not bad_records:
            return "无错误记录"

        lines = []
        grouped = BadRecordReporter.group_by_file(bad_records)

        for file_path, records in sorted(grouped.items()):
            lines.append(f"\n文件: {file_path}")
            lines.append(f"  错误数量: {len(records)}")

            for record in sorted(records, key=lambda x: x.source.row_number):
                lines.append(f"    行 {record.source.row_number}:")
                lines.append(f"      类型: {record.record_type}")
                lines.append(f"      错误: {record.error_message}")

        return "\n".join(lines)


class SourceTracker:
    @staticmethod
    def get_source_info(obj) -> str:
        if hasattr(obj, "source") and obj.source:
            source: SourceLocation = obj.source
            info = f"文件: {source.file_path}"
            if source.row_number:
                info += f", 行: {source.row_number}"
            return info
        return "无来源信息"

    @staticmethod
    def trace_verification_result(result: VerificationResult, parsed_data) -> Dict[str, str]:
        traces = {}

        order = parsed_data.rental_orders.get(result.order_id)
        if order and order.source:
            traces["借用单来源"] = SourceTracker.get_source_info(order)

        inspection = None
        for insp in parsed_data.return_inspections.values():
            if insp.order_id == result.order_id:
                inspection = insp
                break
        if inspection and inspection.source:
            traces["归还检查来源"] = SourceTracker.get_source_info(inspection)

        deduction_sources = []
        for deduction in parsed_data.deposit_deductions.values():
            if deduction.order_id == result.order_id and deduction.source:
                deduction_sources.append(
                    f"{deduction.deduction_id}: {SourceTracker.get_source_info(deduction)}"
                )
        if deduction_sources:
            traces["扣款单来源"] = "\n".join(deduction_sources)

        return traces
