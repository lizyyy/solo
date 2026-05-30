from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import asdict, dataclass

from .models import (
    Registration,
    RecordStatus,
    AnomalyType,
)


class ResumeHandler:
    def __init__(self, state_dir: str = ".resume_state"):
        self.state_dir = state_dir
        os.makedirs(state_dir, exist_ok=True)

    def save_state(self, reg: Registration) -> str:
        path = os.path.join(self.state_dir, f"{reg.reg_id}.json")
        data = {
            "reg_id": reg.reg_id,
            "patient_name": reg.patient_name,
            "patient_id": reg.patient_id,
            "doctor_id": reg.doctor_id,
            "doctor_name": reg.doctor_name,
            "dept": reg.dept,
            "clinic_date": reg.clinic_date.isoformat(),
            "slot_time": reg.slot_time.isoformat() if reg.slot_time else None,
            "queue_number": reg.queue_number,
            "is_addon": reg.is_addon,
            "reg_time": reg.reg_time.isoformat() if reg.reg_time else None,
            "status": reg.status.value,
            "last_successful_stage": reg.last_successful_stage.value,
            "anomaly_types": [a.value for a in reg.anomaly_types],
            "anomaly_details": reg.anomaly_details,
            "supplement_materials": reg.supplement_materials,
            "returned_reason": reg.returned_reason,
            "metadata": reg.metadata,
            "saved_at": datetime.now().isoformat(),
        }
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return path

    def load_state(self, reg_id: str) -> Optional[Registration]:
        path = os.path.join(self.state_dir, f"{reg_id}.json")
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        from datetime import date as date_cls, time as time_cls

        reg = Registration(
            reg_id=data["reg_id"],
            patient_name=data.get("patient_name", ""),
            patient_id=data.get("patient_id", ""),
            doctor_id=data.get("doctor_id", ""),
            doctor_name=data.get("doctor_name", ""),
            dept=data.get("dept", ""),
            clinic_date=date_cls.fromisoformat(data["clinic_date"]) if data.get("clinic_date") else date_cls.today(),
            slot_time=time_cls.fromisoformat(data["slot_time"]) if data.get("slot_time") else None,
            queue_number=data.get("queue_number", 0),
            is_addon=data.get("is_addon", False),
            reg_time=datetime.fromisoformat(data["reg_time"]) if data.get("reg_time") else None,
            status=RecordStatus(data.get("status", "received")),
            last_successful_stage=RecordStatus(data.get("last_successful_stage", "received")),
            anomaly_types=[AnomalyType(a) for a in data.get("anomaly_types", [])],
            anomaly_details=data.get("anomaly_details", {}),
            supplement_materials=data.get("supplement_materials", {}),
            returned_reason=data.get("returned_reason", ""),
            metadata=data.get("metadata", {}),
        )
        return reg

    def return_for_supplement(self, reg: Registration, reason: str) -> Registration:
        reg.return_for_supplement(reason)
        self.save_state(reg)
        return reg

    def resume_with_supplement(self, reg_id: str, materials: Dict[str, Any]) -> Optional[Registration]:
        reg = self.load_state(reg_id)
        if reg is None:
            return None
        if reg.status != RecordStatus.RETURNED_FOR_SUPPLEMENT:
            return reg
        reg.supplement(materials)
        self.save_state(reg)
        return reg

    def get_resume_stage(self, reg: Registration) -> RecordStatus:
        return reg.last_successful_stage

    def list_returned_records(self) -> List[Dict[str, Any]]:
        results = []
        for fname in os.listdir(self.state_dir):
            if not fname.endswith(".json"):
                continue
            path = os.path.join(self.state_dir, fname)
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if data.get("status") == RecordStatus.RETURNED_FOR_SUPPLEMENT.value:
                results.append({
                    "reg_id": data["reg_id"],
                    "patient_name": data.get("patient_name", ""),
                    "returned_reason": data.get("returned_reason", ""),
                    "saved_at": data.get("saved_at", ""),
                })
        return results

    def delete_state(self, reg_id: str) -> bool:
        path = os.path.join(self.state_dir, f"{reg_id}.json")
        if os.path.exists(path):
            os.remove(path)
            return True
        return False
