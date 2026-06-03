import csv
import json
import hashlib
import uuid
from datetime import datetime, date
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any
import sys
import os

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.models import (
    SettlementBatch,
    ForecastRecord,
    ChangeHistory,
    ReconciliationNote,
    ConflictEvidence,
    ForecastDataset,
    MaterialType,
    SettlementCycle,
)
from config.settings import SAMPLES_DIR, INPUT_DIR, OUTPUT_DIR


class DuplicateDetector:
    def __init__(self):
        self.imported_batches: Dict[str, SettlementBatch] = {}
        self.imported_record_hashes: Dict[str, str] = {}

    def _generate_batch_hash(self, batch: SettlementBatch) -> str:
        content = f"{batch.batch_id}|{batch.batch_date.isoformat()}|{batch.total_amount}|{batch.record_count}"
        return hashlib.sha256(content.encode()).hexdigest()

    def _generate_record_hash(self, record: ForecastRecord) -> str:
        content = (
            f"{record.record_id}|{record.supplier_id}|{record.invoice_amount}|"
            f"{record.original_settlement_cycle.value}|{record.original_arrival_date.isoformat()}"
        )
        return hashlib.sha256(content.encode()).hexdigest()

    def check_batch_duplicate(self, batch: SettlementBatch) -> Tuple[bool, Optional[str]]:
        batch_hash = self._generate_batch_hash(batch)
        for existing_id, existing_batch in self.imported_batches.items():
            if self._generate_batch_hash(existing_batch) == batch_hash:
                return True, existing_id
        return False, None

    def check_record_duplicate(self, record: ForecastRecord) -> Tuple[bool, Optional[str]]:
        record_hash = self._generate_record_hash(record)
        if record_hash in self.imported_record_hashes:
            return True, self.imported_record_hashes[record_hash]
        return False, None

    def register_batch(self, batch: SettlementBatch):
        self.imported_batches[batch.batch_id] = batch

    def register_records(self, records: List[ForecastRecord]):
        for record in records:
            record_hash = self._generate_record_hash(record)
            self.imported_record_hashes[record_hash] = record.record_id


class ForecastImporter:
    def __init__(self, duplicate_detector: Optional[DuplicateDetector] = None):
        self.duplicate_detector = duplicate_detector or DuplicateDetector()

    def import_from_json(self, file_path: str, material_type: MaterialType,
                        import_user: str = "system") -> ForecastDataset:
        file_path = Path(file_path)
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        batch_data = data["batch"]
        batch = SettlementBatch(
            batch_id=batch_data["batch_id"],
            batch_date=date.fromisoformat(batch_data["batch_date"]),
            import_timestamp=datetime.fromisoformat(batch_data.get("import_timestamp", datetime.now().isoformat())),
            total_amount=float(batch_data["total_amount"]),
            record_count=int(batch_data["record_count"]),
            source_file=str(file_path),
            import_user=import_user,
        )

        is_duplicate, duplicate_of = self.duplicate_detector.check_batch_duplicate(batch)
        batch.is_duplicate = is_duplicate
        batch.duplicate_of_batch = duplicate_of

        records = []
        for rec_data in data["records"]:
            record = ForecastRecord(
                record_id=rec_data["record_id"],
                batch_id=batch.batch_id,
                supplier_id=rec_data["supplier_id"],
                supplier_name=rec_data["supplier_name"],
                invoice_amount=float(rec_data["invoice_amount"]),
                original_settlement_cycle=SettlementCycle(rec_data["original_settlement_cycle"]),
                current_settlement_cycle=SettlementCycle(rec_data["current_settlement_cycle"]),
                expected_arrival_date=date.fromisoformat(rec_data["expected_arrival_date"]),
                original_arrival_date=date.fromisoformat(rec_data["original_arrival_date"]),
                is_manually_modified=rec_data.get("is_manually_modified", False),
                modification_reason=rec_data.get("modification_reason"),
                modified_by=rec_data.get("modified_by"),
                modification_timestamp=datetime.fromisoformat(rec_data["modification_timestamp"])
                if rec_data.get("modification_timestamp") else None,
                holiday_deferral_applies=rec_data.get("holiday_deferral_applies", False),
                holiday_deferral_explanation=rec_data.get("holiday_deferral_explanation"),
            )

            if record.original_settlement_cycle != record.current_settlement_cycle:
                record.is_manually_modified = True

            is_rec_dup, dup_of = self.duplicate_detector.check_record_duplicate(record)
            if is_rec_dup:
                record.is_manually_modified = True
                if not record.modification_reason:
                    record.modification_reason = f"潜在重复记录，疑似重复于: {dup_of}"

            records.append(record)

        change_history = []
        for h_data in data.get("change_history", []):
            change_history.append(ChangeHistory(
                history_id=h_data["history_id"],
                record_id=h_data["record_id"],
                field_changed=h_data["field_changed"],
                old_value=h_data["old_value"],
                new_value=h_data["new_value"],
                changed_by=h_data["changed_by"],
                change_timestamp=datetime.fromisoformat(h_data["change_timestamp"]),
                change_reason=h_data["change_reason"],
                batch_id=h_data.get("batch_id", batch.batch_id),
            ))

        reconciliation_notes = []
        for n_data in data.get("reconciliation_notes", []):
            reconciliation_notes.append(ReconciliationNote(
                note_id=n_data["note_id"],
                batch_id=n_data.get("batch_id", batch.batch_id),
                record_id=n_data["record_id"],
                note_content=n_data["note_content"],
                note_type=n_data["note_type"],
                created_by=n_data["created_by"],
                created_timestamp=datetime.fromisoformat(n_data["created_timestamp"]),
                updated_by=n_data.get("updated_by"),
                updated_timestamp=datetime.fromisoformat(n_data["updated_timestamp"])
                if n_data.get("updated_timestamp") else None,
                is_reconciled=n_data.get("is_reconciled", False),
                reconciled_by=n_data.get("reconciled_by"),
                reconciled_timestamp=datetime.fromisoformat(n_data["reconciled_timestamp"])
                if n_data.get("reconciled_timestamp") else None,
            ))

        conflicts = []
        for c_data in data.get("conflicts", []):
            conflicts.append(ConflictEvidence(
                conflict_id=c_data["conflict_id"],
                batch_id=c_data.get("batch_id", batch.batch_id),
                record_id=c_data["record_id"],
                conflict_type=c_data["conflict_type"],
                evidence_description=c_data["evidence_description"],
                field_a_name=c_data["field_a_name"],
                field_a_value=c_data["field_a_value"],
                field_b_name=c_data["field_b_name"],
                field_b_value=c_data["field_b_value"],
                resolution_status=c_data.get("resolution_status", "pending"),
                resolved_by=c_data.get("resolved_by"),
                resolved_timestamp=datetime.fromisoformat(c_data["resolved_timestamp"])
                if c_data.get("resolved_timestamp") else None,
                resolution=c_data.get("resolution"),
                requires_manager_review=c_data.get("requires_manager_review", True),
            ))

        if not batch.is_duplicate:
            self.duplicate_detector.register_batch(batch)
            self.duplicate_detector.register_records(records)

        return ForecastDataset(
            material_type=material_type,
            batch=batch,
            records=records,
            change_history=change_history,
            reconciliation_notes=reconciliation_notes,
            conflicts=conflicts,
        )

    def import_sample(self, sample_name: str, material_type: MaterialType,
                      import_user: str = "system") -> ForecastDataset:
        sample_path = SAMPLES_DIR / sample_name
        return self.import_from_json(str(sample_path), material_type, import_user)


class ForecastExporter:
    def export_to_json(self, dataset: ForecastDataset, output_path: Optional[str] = None) -> str:
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = OUTPUT_DIR / f"{dataset.batch.batch_id}_{dataset.material_type.value}_{timestamp}.json"
        else:
            output_path = Path(output_path)

        output_path.parent.mkdir(parents=True, exist_ok=True)

        data = {
            "material_type": dataset.material_type.value,
            "export_timestamp": datetime.now().isoformat(),
            "batch": {
                "batch_id": dataset.batch.batch_id,
                "batch_date": dataset.batch.batch_date.isoformat(),
                "import_timestamp": dataset.batch.import_timestamp.isoformat(),
                "total_amount": dataset.batch.total_amount,
                "record_count": dataset.batch.record_count,
                "source_file": dataset.batch.source_file,
                "is_duplicate": dataset.batch.is_duplicate,
                "duplicate_of_batch": dataset.batch.duplicate_of_batch,
                "import_user": dataset.batch.import_user,
            },
            "records": [
                {
                    "record_id": r.record_id,
                    "batch_id": r.batch_id,
                    "supplier_id": r.supplier_id,
                    "supplier_name": r.supplier_name,
                    "invoice_amount": r.invoice_amount,
                    "original_settlement_cycle": r.original_settlement_cycle.value,
                    "current_settlement_cycle": r.current_settlement_cycle.value,
                    "expected_arrival_date": r.expected_arrival_date.isoformat(),
                    "original_arrival_date": r.original_arrival_date.isoformat(),
                    "is_manually_modified": r.is_manually_modified,
                    "modification_reason": r.modification_reason,
                    "modified_by": r.modified_by,
                    "modification_timestamp": r.modification_timestamp.isoformat()
                    if r.modification_timestamp else None,
                    "modification_status": r.modification_status.value,
                    "review_note": r.review_note,
                    "holiday_deferral_applies": r.holiday_deferral_applies,
                    "holiday_deferral_explanation": r.holiday_deferral_explanation,
                }
                for r in dataset.records
            ],
            "change_history": [
                {
                    "history_id": h.history_id,
                    "record_id": h.record_id,
                    "field_changed": h.field_changed,
                    "old_value": str(h.old_value),
                    "new_value": str(h.new_value),
                    "changed_by": h.changed_by,
                    "change_timestamp": h.change_timestamp.isoformat(),
                    "change_reason": h.change_reason,
                    "batch_id": h.batch_id,
                }
                for h in dataset.change_history
            ],
            "reconciliation_notes": [
                {
                    "note_id": n.note_id,
                    "batch_id": n.batch_id,
                    "record_id": n.record_id,
                    "note_content": n.note_content,
                    "note_type": n.note_type,
                    "created_by": n.created_by,
                    "created_timestamp": n.created_timestamp.isoformat(),
                    "updated_by": n.updated_by,
                    "updated_timestamp": n.updated_timestamp.isoformat()
                    if n.updated_timestamp else None,
                    "is_reconciled": n.is_reconciled,
                    "reconciled_by": n.reconciled_by,
                    "reconciled_timestamp": n.reconciled_timestamp.isoformat()
                    if n.reconciled_timestamp else None,
                }
                for n in dataset.reconciliation_notes
            ],
            "conflicts": [
                {
                    "conflict_id": c.conflict_id,
                    "batch_id": c.batch_id,
                    "record_id": c.record_id,
                    "conflict_type": c.conflict_type,
                    "evidence_description": c.evidence_description,
                    "field_a_name": c.field_a_name,
                    "field_a_value": str(c.field_a_value),
                    "field_b_name": c.field_b_name,
                    "field_b_value": str(c.field_b_value),
                    "resolution_status": c.resolution_status,
                    "resolved_by": c.resolved_by,
                    "resolved_timestamp": c.resolved_timestamp.isoformat()
                    if c.resolved_timestamp else None,
                    "resolution": c.resolution,
                    "requires_manager_review": c.requires_manager_review,
                }
                for c in dataset.conflicts
            ],
            "checks_passed": dataset.checks_passed,
            "checks_detail": dataset.checks_detail,
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return str(output_path)

    def export_report_to_txt(self, dataset: ForecastDataset,
                             check_report: Optional[Any] = None,
                             output_path: Optional[str] = None) -> str:
        if output_path is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_path = OUTPUT_DIR / f"{dataset.batch.batch_id}_report_{timestamp}.txt"
        else:
            output_path = Path(output_path)

        output_path.parent.mkdir(parents=True, exist_ok=True)

        lines = []
        lines.append("=" * 80)
        lines.append("供应链账期滚动预测 - 分析报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"材料类型: {dataset.material_type.value}")
        lines.append(f"批次号: {dataset.batch.batch_id}")
        lines.append(f"批次日期: {dataset.batch.batch_date.isoformat()}")
        lines.append(f"导入时间: {dataset.batch.import_timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"导入用户: {dataset.batch.import_user}")
        lines.append(f"总金额: {dataset.batch.total_amount:,.2f}")
        lines.append(f"记录数: {dataset.batch.record_count}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("预测记录明细")
        lines.append("-" * 80)
        for r in dataset.records:
            lines.append(f"记录ID: {r.record_id}")
            lines.append(f"  供应商: {r.supplier_name} ({r.supplier_id})")
            lines.append(f"  发票金额: {r.invoice_amount:,.2f}")
            lines.append(f"  原始账期: {r.original_settlement_cycle.value} -> "
                         f"当前账期: {r.current_settlement_cycle.value}")
            lines.append(f"  原始到账日: {r.original_arrival_date.isoformat()} -> "
                         f"预计到账日: {r.expected_arrival_date.isoformat()}")
            if r.is_manually_modified:
                lines.append(f"  ⚠️  手工修改: 是 (状态: {r.modification_status.value})")
                lines.append(f"     修改原因: {r.modification_reason}")
                lines.append(f"     修改人: {r.modified_by}")
                if r.modification_status.value == "pending_review":
                    lines.append(f"     🔒 待基金经理复核，暂不归为正常")
            if r.holiday_deferral_applies:
                lines.append(f"  📅 节假日顺延: 是 - {r.holiday_deferral_explanation}")
            lines.append("")

        if dataset.conflicts:
            lines.append("-" * 80)
            lines.append("⚠️  冲突证据列表 (需要风控值班老秦确认或驳回)")
            lines.append("-" * 80)
            for c in dataset.conflicts:
                lines.append(f"冲突ID: {c.conflict_id}")
                lines.append(f"  类型: {c.conflict_type}")
                lines.append(f"  描述: {c.evidence_description}")
                lines.append(f"  字段A [{c.field_a_name}]: {c.field_a_value}")
                lines.append(f"  字段B [{c.field_b_name}]: {c.field_b_value}")
                lines.append(f"  状态: {c.resolution_status}")
                lines.append(f"  需要经理复核: {'是' if c.requires_manager_review else '否'}")
                if c.requires_manager_review and c.resolution_status == "pending":
                    lines.append(f"  👉 请风控值班老秦选择: [确认] 或 [驳回]，不要替业务同事自动拍板")
                lines.append("")

        if check_report:
            lines.append("-" * 80)
            lines.append("自检结果")
            lines.append("-" * 80)
            lines.append(f"总体结果: {'✅ 通过' if check_report.overall_pass else '❌ 未通过'}")
            lines.append("")
            for result in check_report.results:
                status = "✅ 通过" if result.passed else "❌ 未通过"
                lines.append(f"[{status}] {result.check_name}")
                lines.append(f"  严重程度: {result.severity}")
                lines.append(f"  消息: {result.message}")
                if result.evidence:
                    lines.append(f"  证据:")
                    for ev in result.evidence:
                        lines.append(f"    - {ev}")
                if result.recommendation:
                    lines.append(f"  建议: {result.recommendation}")
                lines.append("")

        if dataset.workflow_state:
            lines.append("-" * 80)
            lines.append("工作流状态")
            lines.append("-" * 80)
            for step, status in dataset.workflow_state.step_statuses.items():
                status_icon = "⏳" if status.value == "not_started" else "🔄" if status.value == "in_progress" else "⚠️" if status.value == "needs_review" else "✅"
                lines.append(f"  {status_icon} {step}: {status.value}")
            if dataset.workflow_state.t1_to_t2_records:
                lines.append(f"  T+1改T+2记录: {', '.join(dataset.workflow_state.t1_to_t2_records)}")
            lines.append(f"  工作流完成: {'是' if dataset.workflow_state.is_complete else '否'}")
            lines.append(f"  报告可发布: {'是' if dataset.workflow_state.final_report_ready else '否'}")
            if dataset.workflow_state.requires_manager_review:
                lines.append(f"  🔒 需要基金经理复核")
            lines.append("")

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(lines))

        return str(output_path)
