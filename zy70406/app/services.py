import json
import re
from typing import Dict, Any, List, Tuple
from collections import defaultdict
from datetime import datetime
from pathlib import Path
import pandas as pd
from sqlalchemy.orm import Session
from app.models import EvaluationFragment, FieldTrace, ProcessingRecord, Report, BatchConflict
from app.config import settings


def get_nested_value(data: Dict[str, Any], path: str) -> Any:
    keys = path.split('.')
    value = data
    for key in keys:
        if isinstance(value, dict) and key in value:
            value = value[key]
        else:
            return None
    return value


def set_nested_value(data: Dict[str, Any], path: str, value: Any) -> Dict[str, Any]:
    keys = path.split('.')
    current = data
    for key in keys[:-1]:
        if key not in current:
            current[key] = {}
        current = current[key]
    current[keys[-1]] = value
    return data


class FieldTrimmer:
    def __init__(self, db: Session):
        self.db = db

    def trim_field(self, fragment: EvaluationFragment, field_path: str, trim_reason: str, handler: str) -> Tuple[bool, str]:
        original_value = get_nested_value(fragment.response_data, field_path)
        if original_value is None:
            return False, f"字段 {field_path} 不存在"

        trimmed_value = self._apply_trimming(original_value, trim_reason)
        
        fragment.response_data = set_nested_value(fragment.response_data, field_path, trimmed_value)
        
        field_trace = FieldTrace(
            fragment_id=fragment.id,
            field_path=field_path,
            original_value=str(original_value),
            trimmed_value=str(trimmed_value),
            trim_reason=trim_reason
        )
        self.db.add(field_trace)
        
        processing_record = ProcessingRecord(
            fragment_id=fragment.id,
            handler=handler,
            action=f"裁剪字段 {field_path}",
            result="成功",
            notes=f"原始值: {str(original_value)[:100]}... -> 裁剪后: {str(trimmed_value)[:100]}..."
        )
        self.db.add(processing_record)
        
        fragment.processed = True
        self.db.commit()
        
        return True, "字段裁剪成功"

    def _apply_trimming(self, value: Any, trim_reason: str) -> Any:
        if isinstance(value, str):
            if trim_reason == "remove_sensitive":
                value = re.sub(r'[\u4e00-\u9fa5]{2,4}(?:先生|女士|同志|经理|总监)', '[已脱敏]', value)
                value = re.sub(r'1[3-9]\d{9}', '[手机号已隐藏]', value)
                value = re.sub(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', '[邮箱已隐藏]', value)
            elif trim_reason == "trim_whitespace":
                value = value.strip()
            elif trim_reason == "truncate_long_text":
                if len(value) > 500:
                    value = value[:500] + "...[文本已截断]"
        return value

    def trim_multiple_fields(self, fragment_ids: List[int], fields_to_trim: List[str], trim_reason: str, handler: str) -> List[Dict[str, Any]]:
        results = []
        for fragment_id in fragment_ids:
            fragment = self.db.query(EvaluationFragment).filter(EvaluationFragment.id == fragment_id).first()
            if not fragment:
                results.append({"fragment_id": fragment_id, "success": False, "trimmed_fields": [], "message": "评测片段不存在"})
                continue
            
            trimmed_fields = []
            for field_path in fields_to_trim:
                success, msg = self.trim_field(fragment, field_path, trim_reason, handler)
                if success:
                    trimmed_fields.append(field_path)
            
            results.append({
                "fragment_id": fragment_id,
                "success": len(trimmed_fields) > 0,
                "trimmed_fields": trimmed_fields,
                "message": f"成功裁剪 {len(trimmed_fields)} 个字段" if trimmed_fields else "没有字段被裁剪"
            })
        
        return results


class ConflictDetector:
    def __init__(self, db: Session):
        self.db = db

    def detect_batch_number_conflicts(self) -> List[Dict[str, Any]]:
        fragments = self.db.query(EvaluationFragment).all()
        
        batch_groups = defaultdict(list)
        for fragment in fragments:
            batch_groups[fragment.batch_number].append(fragment)
        
        conflicts = []
        for batch_number, batch_fragments in batch_groups.items():
            if len(batch_fragments) > 1:
                source_systems = {f.source_system for f in batch_fragments}
                if len(source_systems) > 1:
                    conflict_info = self._create_conflict_record(
                        batch_number,
                        batch_fragments,
                        "多源系统批次号冲突",
                        f"批次号 {batch_number} 在 {len(source_systems)} 个系统中重复出现: {', '.join(source_systems)}"
                    )
                    conflicts.append(conflict_info)
        
        return conflicts

    def _create_conflict_record(self, batch_number: str, fragments: List[EvaluationFragment], conflict_type: str, description: str) -> Dict[str, Any]:
        existing_conflict = self.db.query(BatchConflict).filter(
            BatchConflict.batch_number == batch_number,
            BatchConflict.conflict_type == conflict_type,
            BatchConflict.resolved == False
        ).first()

        if existing_conflict:
            return {
                "conflict_id": existing_conflict.id,
                "batch_number": batch_number,
                "conflict_type": conflict_type,
                "description": description,
                "fragment_count": len(fragments),
                "already_recorded": True
            }

        conflict = BatchConflict(
            batch_number=batch_number,
            conflict_type=conflict_type,
            fragment_ids=[f.id for f in fragments],
            source_systems=list({f.source_system for f in fragments}),
            description=description
        )
        self.db.add(conflict)

        for fragment in fragments:
            fragment.has_error = True
            fragment.error_type = "批次号冲突"
            fragment.error_message = description

        self.db.commit()

        return {
            "conflict_id": conflict.id,
            "batch_number": batch_number,
            "conflict_type": conflict_type,
            "description": description,
            "fragment_count": len(fragments),
            "already_recorded": False
        }

    def get_all_conflicts(self, include_resolved: bool = False) -> List[BatchConflict]:
        query = self.db.query(BatchConflict)
        if not include_resolved:
            query = query.filter(BatchConflict.resolved == False)
        return query.order_by(BatchConflict.detected_at.desc()).all()

    def resolve_conflict(self, conflict_id: int, resolved_by: str, resolution_notes: str) -> bool:
        conflict = self.db.query(BatchConflict).filter(BatchConflict.id == conflict_id).first()
        if not conflict:
            return False

        conflict.resolved = True
        conflict.resolved_by = resolved_by
        conflict.resolved_at = datetime.now()

        for fragment_id in conflict.fragment_ids:
            fragment = self.db.query(EvaluationFragment).filter(EvaluationFragment.id == fragment_id).first()
            if fragment:
                fragment.processing_notes = resolution_notes

        self.db.commit()
        return True


class ReportGenerator:
    def __init__(self, db: Session):
        self.db = db

    def generate_error_report(self, batch_number: str = None, generated_by: str = "系统") -> Report:
        query = self.db.query(EvaluationFragment).filter(EvaluationFragment.has_error == True)
        if batch_number:
            query = query.filter(EvaluationFragment.batch_number == batch_number)
        
        error_fragments = query.all()
        
        content_summary = {
            "total_errors": len(error_fragments),
            "error_types": defaultdict(int),
            "batches_affected": set(),
            "fragment_details": []
        }

        for fragment in error_fragments:
            content_summary["error_types"][fragment.error_type or "未知错误"] += 1
            content_summary["batches_affected"].add(fragment.batch_number)
            content_summary["fragment_details"].append({
                "fragment_id": fragment.id,
                "batch_number": fragment.batch_number,
                "source_system": fragment.source_system,
                "model_name": fragment.model_name,
                "error_type": fragment.error_type,
                "error_message": fragment.error_message,
                "handler": fragment.handler,
                "original_input_preview": str(fragment.original_input)[:200]
            })

        content_summary["batches_affected"] = list(content_summary["batches_affected"])

        report_name = f"错误报告_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        report = Report(
            report_name=report_name,
            report_type="错误报告",
            batch_number=batch_number,
            total_records=len(error_fragments),
            error_count=len(error_fragments),
            conflict_count=0,
            content_summary=content_summary,
            generated_by=generated_by
        )

        self.db.add(report)
        self.db.commit()

        self._export_report_to_excel(report, content_summary)

        return report

    def _export_report_to_excel(self, report: Report, content_summary: Dict[str, Any]) -> str:
        file_path = settings.REPORTS_DIR / f"{report.report_name}.xlsx"
        
        with pd.ExcelWriter(file_path, engine='openpyxl') as writer:
            df_details = pd.DataFrame(content_summary["fragment_details"])
            df_details.to_excel(writer, sheet_name="错误明细", index=False)
            
            summary_data = {
                "统计项": ["总错误数", "涉及批次数量", "报告生成时间", "生成人"],
                "数值": [
                    content_summary["total_errors"],
                    len(content_summary["batches_affected"]),
                    datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                    report.generated_by
                ]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name="统计概览", index=False)

        report.file_path = str(file_path)
        self.db.commit()
        return str(file_path)


class ExportService:
    def __init__(self, db: Session):
        self.db = db

    def export_error_samples_for_review(self, conflict_id: int = None) -> str:
        if conflict_id:
            conflict = self.db.query(BatchConflict).filter(BatchConflict.id == conflict_id).first()
            if not conflict:
                raise ValueError("冲突记录不存在")
            fragments = self.db.query(EvaluationFragment).filter(
                EvaluationFragment.id.in_(conflict.fragment_ids)
            ).all()
            export_name = f"冲突样本复核_{conflict.batch_number}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        else:
            fragments = self.db.query(EvaluationFragment).filter(EvaluationFragment.has_error == True).all()
            export_name = f"异常样本导出_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        export_data = []
        for fragment in fragments:
            export_data.append({
                "片段ID": fragment.id,
                "批次号": fragment.batch_number,
                "来源系统": fragment.source_system,
                "模型名称": fragment.model_name,
                "任务类型": fragment.task_type,
                "处理人": fragment.handler,
                "部门": fragment.department,
                "错误类型": fragment.error_type,
                "错误信息": fragment.error_message,
                "原始输入": json.dumps(fragment.original_input, ensure_ascii=False, indent=2),
                "响应数据": json.dumps(fragment.response_data, ensure_ascii=False, indent=2),
                "提交时间": fragment.submitted_at.strftime('%Y-%m-%d %H:%M:%S') if fragment.submitted_at else ""
            })

        file_path = settings.EXPORT_DIR / f"{export_name}.xlsx"
        df = pd.DataFrame(export_data)
        df.to_excel(file_path, index=False, engine='openpyxl')

        return str(file_path)


class TraceabilityService:
    def __init__(self, db: Session):
        self.db = db

    def get_original_input_by_handler(self, handler: str) -> List[Dict[str, Any]]:
        fragments = self.db.query(EvaluationFragment).filter(EvaluationFragment.handler == handler).all()
        
        results = []
        for fragment in fragments:
            field_traces = self.db.query(FieldTrace).filter(FieldTrace.fragment_id == fragment.id).all()
            processing_records = self.db.query(ProcessingRecord).filter(ProcessingRecord.fragment_id == fragment.id).all()
            
            results.append({
                "fragment_id": fragment.id,
                "batch_number": fragment.batch_number,
                "source_system": fragment.source_system,
                "model_name": fragment.model_name,
                "task_type": fragment.task_type,
                "original_input": fragment.original_input,
                "field_traces": [
                    {
                        "field_path": ft.field_path,
                        "original_value": ft.original_value,
                        "trimmed_value": ft.trimmed_value,
                        "trim_reason": ft.trim_reason,
                        "traced_at": ft.traced_at
                    } for ft in field_traces
                ],
                "processing_records": [
                    {
                        "action": pr.action,
                        "result": pr.result,
                        "notes": pr.notes,
                        "processed_at": pr.processed_at
                    } for pr in processing_records
                ],
                "processing_basis": self._generate_processing_basis(fragment, field_traces, processing_records)
            })
        
        return results

    def _generate_processing_basis(self, fragment: EvaluationFragment, field_traces: List[FieldTrace], processing_records: List[ProcessingRecord]) -> str:
        basis = []
        basis.append(f"评测片段 {fragment.id} (批次号: {fragment.batch_number})")
        basis.append(f"来源系统: {fragment.source_system}, 模型: {fragment.model_name}")
        
        if field_traces:
            basis.append(f"\n字段裁剪记录:")
            for ft in field_traces:
                basis.append(f"  - {ft.field_path}: {ft.trim_reason}")
        
        if processing_records:
            basis.append(f"\n处理记录:")
            for pr in processing_records:
                basis.append(f"  - {pr.action}: {pr.result}")
        
        if fragment.processing_notes:
            basis.append(f"\n处理备注: {fragment.processing_notes}")
        
        return "\n".join(basis)
