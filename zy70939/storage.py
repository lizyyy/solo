import uuid
from datetime import datetime
from typing import Dict, List, Optional
from models import (
    MaterialRecord, MaterialStatus, ModificationLog, CategoryResult,
    MaterialCategory, FollowUpType
)


class InMemoryStorage:
    def __init__(self):
        self._materials: Dict[str, MaterialRecord] = {}
        self._batch_index: Dict[str, str] = {}

    def generate_id(self) -> str:
        return str(uuid.uuid4())

    def get_by_batch_no(self, batch_no: str) -> Optional[MaterialRecord]:
        material_id = self._batch_index.get(batch_no)
        if material_id:
            return self._materials.get(material_id)
        return None

    def get_by_id(self, material_id: str) -> Optional[MaterialRecord]:
        return self._materials.get(material_id)

    def save_material(self, material: MaterialRecord) -> MaterialRecord:
        self._materials[material.material_id] = material
        self._batch_index[material.batch_no] = material.material_id
        return material

    def add_modification_log(self, log: ModificationLog) -> None:
        material = self._materials.get(log.material_id)
        if material:
            material.modification_history.append(log)
            material.status = MaterialStatus.MODIFIED

    def list_materials(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        category: Optional[MaterialCategory] = None,
        follow_up_type: Optional[FollowUpType] = None,
        pharmacy_name: Optional[str] = None,
        clerk_id: Optional[str] = None,
        patient_name: Optional[str] = None,
        page: int = 1,
        page_size: int = 20
    ) -> tuple[int, List[MaterialRecord]]:
        materials = list(self._materials.values())

        if start_date:
            materials = [m for m in materials if m.submit_time >= start_date]
        if end_date:
            materials = [m for m in materials if m.submit_time <= end_date]
        if category:
            materials = [m for m in materials if m.category_result and m.category_result.category == category]
        if follow_up_type:
            materials = [m for m in materials if m.follow_up_type == follow_up_type]
        if pharmacy_name:
            materials = [m for m in materials if pharmacy_name in m.pharmacy_name]
        if clerk_id:
            materials = [m for m in materials if m.clerk_id == clerk_id]
        if patient_name:
            materials = [m for m in materials if patient_name in m.patient_name]

        materials.sort(key=lambda x: x.submit_time, reverse=True)

        total = len(materials)
        start = (page - 1) * page_size
        end = start + page_size
        paginated = materials[start:end]

        return total, paginated


storage = InMemoryStorage()
