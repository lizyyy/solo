import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from models.order import Order
from models.patient import Patient
from models.measurement import Measurement
from models.attachment import Attachment
from models.fitting_record import FittingRecord
from models.rework_record import ReworkRecord
from models.audit_log import AuditLog
from core.patient_repository import PatientRepository
from core.measurement_repository import MeasurementRepository
from core.attachment_repository import AttachmentRepository
from core.fitting_repository import FittingRecordRepository
from core.rework_repository import ReworkRecordRepository
from core.audit_repository import AuditLogRepository


class AuditExporter:
    def __init__(self):
        self.patient_repo = PatientRepository()
        self.measurement_repo = MeasurementRepository()
        self.attachment_repo = AttachmentRepository()
        self.fitting_repo = FittingRecordRepository()
        self.rework_repo = ReworkRecordRepository()
        self.audit_repo = AuditLogRepository()
    
    def export_order_audit(
        self,
        order: Order,
        output_path: Optional[Path] = None
    ) -> Dict[str, Any]:
        patient = self.patient_repo.get_by_id(order.patient_id)
        measurements = self.measurement_repo.get_by_order(order.id)
        attachments = self.attachment_repo.get_by_order(order.id)
        fittings = self.fitting_repo.get_by_order(order.id)
        reworks = self.rework_repo.get_by_order(order.id)
        audit_logs = self.audit_repo.get_by_order(order.id, limit=500)
        
        audit_data = self._build_audit_package(
            order, patient, measurements, attachments, fittings, reworks, audit_logs
        )
        
        if output_path:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(audit_data, f, ensure_ascii=False, indent=2, default=self._json_serializer)
        
        return audit_data
    
    def _build_audit_package(
        self,
        order: Order,
        patient: Optional[Patient],
        measurements: List[Measurement],
        attachments: List[Attachment],
        fittings: List[FittingRecord],
        reworks: List[ReworkRecord],
        audit_logs: List[AuditLog]
    ) -> Dict[str, Any]:
        attachment_hashes = []
        for att in attachments:
            attachment_hashes.append({
                "id": att.id,
                "file_name": att.file_name,
                "original_name": att.original_name,
                "sha256_hash": att.sha256_hash,
                "file_size": att.file_size,
                "file_type": att.file_type,
                "is_missing": att.is_missing
            })
        
        return {
            "audit_package_info": {
                "version": "1.0",
                "generated_at": datetime.now().isoformat(),
                "order_number": order.order_number,
                "order_id": order.id
            },
            "order": self._model_to_dict(order),
            "patient": self._model_to_dict(patient) if patient else None,
            "measurements": [self._model_to_dict(m) for m in measurements],
            "attachments": attachment_hashes,
            "fitting_records": [self._model_to_dict(f) for f in fittings],
            "rework_records": [self._model_to_dict(r) for r in reworks],
            "audit_logs": [self._model_to_dict(al) for al in audit_logs],
            "integrity_check": {
                "total_attachments": len(attachments),
                "missing_attachments": sum(1 for a in attachments if a.is_missing),
                "unique_hashes": len({a.sha256_hash for a in attachments})
            }
        }
    
    def _model_to_dict(self, obj) -> Dict[str, Any]:
        if obj is None:
            return {}
        if hasattr(obj, 'to_dict'):
            return obj.to_dict()
        return str(obj)
    
    def _json_serializer(self, obj) -> Any:
        if isinstance(obj, datetime):
            return obj.isoformat()
        if hasattr(obj, 'isoformat'):
            return obj.isoformat()
        return str(obj)
