from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from models.order import Order
from models.patient import Patient
from models.photo import Photo
from models.stl_file import STLFile
from models.processing_status import ProcessingStatus
from models.issue import Issue


@dataclass
class WorkbenchItem:
    model_id: str
    order: Optional[Order] = None
    patient: Optional[Patient] = None
    photos: List[Photo] = field(default_factory=list)
    stl_files: List[STLFile] = field(default_factory=list)
    processing_status: Optional[ProcessingStatus] = None
    issues: List[Issue] = field(default_factory=list)
    review_notes: str = ""
    is_locked: bool = False
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    internal_id: str = field(default_factory=lambda: uuid4().hex)

    @property
    def has_issues(self) -> bool:
        return len(self.issues) > 0

    @property
    def unresolved_issues(self) -> List[Issue]:
        return [i for i in self.issues if not i.is_resolved]

    @property
    def issue_count(self) -> int:
        return len(self.issues)

    @property
    def unresolved_issue_count(self) -> int:
        return len(self.unresolved_issues)

    def to_dict(self) -> dict:
        return {
            "internal_id": self.internal_id,
            "model_id": self.model_id,
            "order": self.order.to_dict() if self.order else None,
            "patient": self.patient.to_dict() if self.patient else None,
            "photos": [p.to_dict() for p in self.photos],
            "stl_files": [s.to_dict() for s in self.stl_files],
            "processing_status": self.processing_status.to_dict() if self.processing_status else None,
            "issues": [i.to_dict() for i in self.issues],
            "review_notes": self.review_notes,
            "is_locked": self.is_locked,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "WorkbenchItem":
        order = None
        if data.get("order"):
            order = Order.from_dict(data["order"])
        
        patient = None
        if data.get("patient"):
            patient = Patient.from_dict(data["patient"])
        
        photos = [Photo.from_dict(p) for p in data.get("photos", [])]
        stl_files = [STLFile.from_dict(s) for s in data.get("stl_files", [])]
        
        processing_status = None
        if data.get("processing_status"):
            processing_status = ProcessingStatus.from_dict(data["processing_status"])
        
        issues = [Issue.from_dict(i) for i in data.get("issues", [])]
        
        created_at = datetime.now()
        if data.get("created_at"):
            created_at = datetime.fromisoformat(data["created_at"])
        
        updated_at = datetime.now()
        if data.get("updated_at"):
            updated_at = datetime.fromisoformat(data["updated_at"])
        
        item = cls(
            model_id=data["model_id"],
            order=order,
            patient=patient,
            photos=photos,
            stl_files=stl_files,
            processing_status=processing_status,
            issues=issues,
            review_notes=data.get("review_notes", ""),
            is_locked=data.get("is_locked", False),
            created_at=created_at,
            updated_at=updated_at,
        )
        item.internal_id = data.get("internal_id", item.internal_id)
        return item


@dataclass
class Workbench:
    name: str = "取模返工复核台"
    items: Dict[str, WorkbenchItem] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    internal_id: str = field(default_factory=lambda: uuid4().hex)

    @property
    def item_count(self) -> int:
        return len(self.items)

    @property
    def items_with_issues(self) -> List[WorkbenchItem]:
        return [item for item in self.items.values() if item.has_issues]

    @property
    def total_issues(self) -> int:
        return sum(item.issue_count for item in self.items.values())

    @property
    def total_unresolved_issues(self) -> int:
        return sum(item.unresolved_issue_count for item in self.items.values())

    def get_item(self, model_id: str) -> Optional[WorkbenchItem]:
        return self.items.get(model_id)

    def add_item(self, item: WorkbenchItem) -> None:
        self.items[item.model_id] = item
        self.updated_at = datetime.now()

    def remove_item(self, model_id: str) -> bool:
        if model_id in self.items:
            del self.items[model_id]
            self.updated_at = datetime.now()
            return True
        return False

    def to_dict(self) -> dict:
        return {
            "internal_id": self.internal_id,
            "name": self.name,
            "items": {k: v.to_dict() for k, v in self.items.items()},
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Workbench":
        items = {}
        for model_id, item_data in data.get("items", {}).items():
            items[model_id] = WorkbenchItem.from_dict(item_data)
        
        created_at = datetime.now()
        if data.get("created_at"):
            created_at = datetime.fromisoformat(data["created_at"])
        
        updated_at = datetime.now()
        if data.get("updated_at"):
            updated_at = datetime.fromisoformat(data["updated_at"])
        
        workbench = cls(
            name=data.get("name", "取模返工复核台"),
            items=items,
            created_at=created_at,
            updated_at=updated_at,
        )
        workbench.internal_id = data.get("internal_id", workbench.internal_id)
        return workbench
