import uuid
import json
from datetime import datetime
from typing import List, Dict, Any
from copy import deepcopy
from pathlib import Path

from .models import (
    PropertyRepairOrder, FixSuggestion, FixRecord, ExecutionResult,
    BatchExecutionReport, RiskType
)


class DataFixEngine:
    def __init__(self):
        self.execution_history: List[BatchExecutionReport] = []

    def preview_fixes(self, orders: List[PropertyRepairOrder], suggestions: List[FixSuggestion]) -> Dict[str, Any]:
        preview_data = {
            "total_orders": len(orders),
            "total_suggestions": len(suggestions),
            "risk_summary": self._group_by_risk_type(suggestions),
            "affected_orders": self._get_affected_order_ids(suggestions),
            "suggestions_detail": [s.model_dump() for s in suggestions],
            "before_after_preview": self._generate_before_after_preview(orders, suggestions)
        }
        return preview_data

    def _group_by_risk_type(self, suggestions: List[FixSuggestion]) -> Dict[str, int]:
        summary = {}
        for s in suggestions:
            risk_type = s.risk_type.value
            summary[risk_type] = summary.get(risk_type, 0) + 1
        return summary

    def _get_affected_order_ids(self, suggestions: List[FixSuggestion]) -> List[str]:
        return list({s.order_id for s in suggestions})

    def _generate_before_after_preview(self, orders: List[PropertyRepairOrder], suggestions: List[FixSuggestion]) -> List[Dict[str, Any]]:
        order_map = {o.order_id: o for o in orders}
        preview = []

        for suggestion in suggestions:
            order = order_map.get(suggestion.order_id)
            if order:
                preview.append({
                    "order_id": suggestion.order_id,
                    "field_path": suggestion.field_path,
                    "before": suggestion.current_value,
                    "after": suggestion.suggested_value,
                    "reason": suggestion.reason,
                    "basis": suggestion.basis,
                    "original_row_index": suggestion.original_row_index
                })
            elif suggestion.risk_type == RiskType.GRAYSCALE_RECORD:
                preview.append({
                    "order_id": suggestion.order_id,
                    "field_path": suggestion.field_path,
                    "before": suggestion.current_value,
                    "after": suggestion.suggested_value,
                    "reason": suggestion.reason,
                    "basis": suggestion.basis,
                    "is_grayscale_note": True,
                    "original_row_index": suggestion.original_row_index
                })

        return preview

    def execute_fixes(
        self,
        orders: List[PropertyRepairOrder],
        suggestions: List[FixSuggestion],
        operator: str,
        dry_run: bool = False
    ) -> BatchExecutionReport:
        batch_id = f"BATCH-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{uuid.uuid4().hex[:8]}"

        report = BatchExecutionReport(
            batch_id=batch_id,
            operator=operator,
            start_time=datetime.now(),
            total_count=len(suggestions)
        )

        order_map = {o.order_id: o for o in orders}

        for suggestion in suggestions:
            fix_record = FixRecord(
                order_id=suggestion.order_id,
                risk_type=suggestion.risk_type,
                field_path=suggestion.field_path,
                old_value=deepcopy(suggestion.current_value),
                new_value=deepcopy(suggestion.suggested_value),
                result=ExecutionResult.SUCCESS,
                executed_at=datetime.now()
            )

            try:
                if not dry_run:
                    if suggestion.risk_type == RiskType.GRAYSCALE_RECORD:
                        report.grayscale_notes.append({
                            "record_id": suggestion.order_id,
                            "field_path": suggestion.field_path,
                            "content": suggestion.suggested_value,
                            "basis": suggestion.basis,
                            "timestamp": datetime.now().isoformat()
                        })
                    else:
                        order = order_map.get(suggestion.order_id)
                        if order and "permission_level" in suggestion.field_path:
                            order.permission_level = suggestion.suggested_value

                report.success_count += 1
                report.fix_records.append(fix_record)

            except Exception as e:
                fix_record.result = ExecutionResult.FAILED
                fix_record.error_message = str(e)
                report.failed_count += 1
                report.failed_records.append(fix_record)

        report.end_time = datetime.now()
        report.next_steps = self._generate_next_steps(report)

        self.execution_history.append(report)

        return report

    def _generate_next_steps(self, report: BatchExecutionReport) -> List[str]:
        steps = []

        if report.failed_count > 0:
            steps.append(f"处理{report.failed_count}条失败记录，查看failed_records.json了解具体原因")

        steps.append("导出异常样本给同事进行复核")
        steps.append("按批次ID查询本次执行的完整历史记录")
        steps.append("监控修复后的数据状态，确认无次生问题")

        if any(fr.risk_type == RiskType.PERMISSION_OVER_GRANTED for fr in report.fix_records):
            steps.append("验证权限修复后，相关人员功能访问是否正常")

        if report.grayscale_notes:
            steps.append("完成灰度发布备忘人工修正记录的归档")

        return steps

    def query_history(
        self,
        batch_id: str = None,
        operator: str = None,
        risk_type: RiskType = None
    ) -> List[BatchExecutionReport]:
        results = self.execution_history

        if batch_id:
            results = [r for r in results if r.batch_id == batch_id]

        if operator:
            results = [r for r in results if r.operator == operator]

        if risk_type:
            filtered = []
            for report in results:
                if any(fr.risk_type == risk_type for fr in report.fix_records):
                    filtered.append(report)
            results = filtered

        return results

    def export_failed_records(self, report: BatchExecutionReport, filepath: str) -> None:
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump([fr.model_dump() for fr in report.failed_records], f, ensure_ascii=False, indent=2, default=str)

    def export_exception_samples(self, report: BatchExecutionReport, filepath: str) -> None:
        samples = []
        for record in report.fix_records:
            if record.risk_type in [RiskType.PERMISSION_OVER_GRANTED, RiskType.GRAYSCALE_RECORD]:
                samples.append({
                    "order_id": record.order_id,
                    "risk_type": record.risk_type.value,
                    "field_path": record.field_path,
                    "old_value": record.old_value,
                    "new_value": record.new_value,
                    "source": record.field_path,
                    "processing_basis": "根据业务规则和权限管理规范执行修复",
                    "needs_review": True
                })
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(samples, f, ensure_ascii=False, indent=2, default=str)

    def load_history_from_directory(self, directory: str) -> List[BatchExecutionReport]:
        dir_path = Path(directory)
        if not dir_path.exists():
            return []

        history_records = []
        for report_file in dir_path.glob("*_report.json"):
            try:
                report = self._load_report_from_file(str(report_file))
                if report:
                    history_records.append(report)
            except Exception:
                continue

        history_records.sort(key=lambda x: x.start_time, reverse=True)
        return history_records

    def _load_report_from_file(self, filepath: str) -> BatchExecutionReport:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        fix_records = []
        for record_data in data.get("fix_records_with_details", []):
            fix_records.append(FixRecord(
                order_id=record_data["order_id"],
                risk_type=RiskType(record_data["risk_type"]),
                field_path=record_data["field_path"],
                old_value=record_data["old_value"],
                new_value=record_data["new_value"],
                result=ExecutionResult(record_data["result"]),
                error_message=record_data.get("error_message"),
                executed_at=datetime.fromisoformat(record_data["executed_at"])
            ))

        report = BatchExecutionReport(
            batch_id=data["batch_id"],
            operator=data["operator"],
            start_time=datetime.fromisoformat(data["start_time"]),
            end_time=datetime.fromisoformat(data["end_time"]) if data.get("end_time") else None,
            total_count=data["summary"]["total_count"],
            success_count=data["summary"]["success_count"],
            failed_count=data["summary"]["failed_count"],
            skipped_count=data["summary"]["skipped_count"],
            fix_records=fix_records,
            failed_records=[],
            next_steps=data.get("next_steps", []),
            grayscale_notes=data.get("grayscale_notes", [])
        )

        return report
