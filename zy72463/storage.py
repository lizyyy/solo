import json
import os
from typing import Dict, List, Optional
from models import TreePoolInspection


class InspectionStorage:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.inspections_file = os.path.join(data_dir, "inspections.json")
        self._ensure_dir()

    def _ensure_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
        if not os.path.exists(self.inspections_file):
            with open(self.inspections_file, "w", encoding="utf-8") as f:
                json.dump([], f, ensure_ascii=False, indent=2)

    def load_all(self) -> Dict[str, TreePoolInspection]:
        with open(self.inspections_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        inspections = {}
        for item in data:
            inspection = TreePoolInspection.from_dict(item)
            inspections[inspection.complaint_id] = inspection
        return inspections

    def save_all(self, inspections: Dict[str, TreePoolInspection]):
        data = [inspection.to_dict() for inspection in inspections.values()]
        with open(self.inspections_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_by_complaint_id(self, complaint_id: str) -> Optional[TreePoolInspection]:
        inspections = self.load_all()
        return inspections.get(complaint_id)

    def get_by_inspection_id(self, inspection_id: str) -> Optional[TreePoolInspection]:
        inspections = self.load_all()
        for inspection in inspections.values():
            if inspection.inspection_id == inspection_id:
                return inspection
        return None

    def save(self, inspection: TreePoolInspection):
        inspections = self.load_all()
        inspections[inspection.complaint_id] = inspection
        self.save_all(inspections)

    def get_all_list(self) -> List[TreePoolInspection]:
        return list(self.load_all().values())

    def get_needs_review(self) -> List[TreePoolInspection]:
        return [i for i in self.get_all_list() if i.status == "needs_review"]

    def clear_all(self):
        with open(self.inspections_file, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False, indent=2)
