import hashlib
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from models import ReviewSample, ChangeHistory
from config import CHANGE_TYPES
import schemas


class ChangeHistoryService:
    @staticmethod
    def _generate_version_hash(sample_id: int, field_name: str, new_value: Any, timestamp: datetime) -> str:
        data = {
            "sample_id": sample_id,
            "field_name": field_name,
            "new_value": new_value,
            "timestamp": timestamp.isoformat(),
        }
        return hashlib.md5(json.dumps(data, sort_keys=True).encode()).hexdigest()

    @staticmethod
    def _is_conclusion_field(field_name: str) -> bool:
        return field_name in ["is_anomaly", "anomaly_type", "conclusion", "review_status"]

    @staticmethod
    def _is_material_supplement(field_name: str, old_value: Any, new_value: Any) -> bool:
        if old_value is None and new_value is not None:
            return True
        if isinstance(old_value, (list, dict)) and isinstance(new_value, (list, dict)):
            old_str = json.dumps(old_value, sort_keys=True)
            new_str = json.dumps(new_value, sort_keys=True)
            if old_str in new_str and len(new_str) > len(old_str):
                return True
        return False

    @staticmethod
    def log_change(
        db: Session,
        sample_id: int,
        field_name: str,
        old_value: Any,
        new_value: Any,
        operator: str = None,
        remark: str = None,
        change_source: str = None,
    ) -> ChangeHistory:
        if old_value == new_value:
            return None

        timestamp = datetime.now()

        if ChangeHistoryService._is_conclusion_field(field_name):
            change_type = "CONCLUSION_CHANGE"
        elif ChangeHistoryService._is_material_supplement(field_name, old_value, new_value):
            change_type = "MATERIAL_SUPPLEMENT"
        else:
            change_type = "DATA_CORRECTION"

        version_hash = ChangeHistoryService._generate_version_hash(
            sample_id, field_name, new_value, timestamp
        )

        existing = db.query(ChangeHistory).filter(
            ChangeHistory.sample_id == sample_id,
            ChangeHistory.version_hash == version_hash,
        ).first()
        if existing:
            return existing

        change = ChangeHistory(
            sample_id=sample_id,
            change_type=change_type,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            operator=operator,
            operation_time=timestamp,
            remark=remark,
            change_source=change_source,
            version_hash=version_hash,
        )
        db.add(change)
        db.flush()
        return change

    @staticmethod
    def log_material_supplement(
        db: Session,
        sample_id: int,
        field_name: str,
        new_value: Any,
        operator: str = None,
        remark: str = "补材料",
        change_source: str = None,
    ) -> ChangeHistory:
        return ChangeHistoryService.log_change(
            db=db,
            sample_id=sample_id,
            field_name=field_name,
            old_value=None,
            new_value=new_value,
            operator=operator,
            remark=remark,
            change_source=change_source,
        )

    @staticmethod
    def get_sample_changes(
        db: Session,
        sample_id: int,
        change_type: str = None,
    ) -> List[Dict[str, Any]]:
        query = db.query(ChangeHistory).filter(ChangeHistory.sample_id == sample_id)
        if change_type:
            query = query.filter(ChangeHistory.change_type == change_type)
        changes = query.order_by(ChangeHistory.operation_time.desc()).all()

        result = []
        for ch in changes:
            result.append({
                "id": ch.id,
                "change_type": ch.change_type,
                "change_type_name": CHANGE_TYPES.get(ch.change_type, ch.change_type),
                "field_name": ch.field_name,
                "old_value": ch.old_value,
                "new_value": ch.new_value,
                "operator": ch.operator,
                "operation_time": ch.operation_time.isoformat(),
                "remark": ch.remark,
                "change_source": ch.change_source,
                "is_material_only": ch.change_type == "MATERIAL_SUPPLEMENT",
                "is_conclusion_change": ch.change_type == "CONCLUSION_CHANGE",
            })
        return result

    @staticmethod
    def get_change_summary(db: Session, sample_id: int) -> Dict[str, Any]:
        changes = ChangeHistoryService.get_sample_changes(db, sample_id)

        material_supplements = [c for c in changes if c["change_type"] == "MATERIAL_SUPPLEMENT"]
        conclusion_changes = [c for c in changes if c["change_type"] == "CONCLUSION_CHANGE"]
        data_corrections = [c for c in changes if c["change_type"] == "DATA_CORRECTION"]

        original_conclusion = None
        final_conclusion = None
        conclusion_change_fields = set()

        for ch in changes:
            if ch["is_conclusion_change"]:
                conclusion_change_fields.add(ch["field_name"])
                if original_conclusion is None and ch["old_value"] is not None:
                    original_conclusion = ch["old_value"]
                final_conclusion = ch["new_value"]

        return {
            "total_changes": len(changes),
            "material_supplements": len(material_supplements),
            "conclusion_changes": len(conclusion_changes),
            "data_corrections": len(data_corrections),
            "has_material_only": len(material_supplements) > 0 and len(conclusion_changes) == 0,
            "has_conclusion_change": len(conclusion_changes) > 0,
            "original_conclusion": original_conclusion,
            "final_conclusion": final_conclusion,
            "conclusion_change_fields": list(conclusion_change_fields),
            "change_log": changes,
        }

    @staticmethod
    def classify_changes_for_report(db: Session, sample_ids: List[int]) -> List[Dict[str, Any]]:
        results = []
        for sample_id in sample_ids:
            summary = ChangeHistoryService.get_change_summary(db, sample_id)
            sample = db.query(ReviewSample).filter(ReviewSample.id == sample_id).first()

            if summary["has_conclusion_change"]:
                classification = "结论变更"
            elif summary["has_material_only"]:
                classification = "仅补材料"
            else:
                classification = "数据修正"

            results.append({
                "sample_id": sample_id,
                "sample_batch_no": sample.sample_batch_no if sample else None,
                "classification": classification,
                "is_material_only": summary["has_material_only"],
                "is_conclusion_change": summary["has_conclusion_change"],
                "material_supplement_count": summary["material_supplements"],
                "conclusion_change_count": summary["conclusion_changes"],
                "original_conclusion": summary["original_conclusion"],
                "final_conclusion": summary["final_conclusion"],
            })
        return results
