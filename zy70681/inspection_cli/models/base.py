from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from uuid import uuid4


class InspectionStatus(Enum):
    DRAFT = "草稿"
    SUBMITTED = "已提交"
    IN_RECTIFICATION = "整改中"
    RECHECKING = "复查中"
    COMPLETED = "已完成"
    REJECTED = "已驳回"


class RectificationStatus(Enum):
    PENDING = "待整改"
    IN_PROGRESS = "整改中"
    SUBMITTED = "已提交复查"
    PASSED = "整改通过"
    REJECTED = "整改驳回"


class RecheckResult(Enum):
    PASSED = "通过"
    REJECTED = "驳回"
    NEEDS_RECTIFICATION = "需再次整改"


@dataclass
class SourceLocation:
    file_path: str
    sheet_name: Optional[str] = None
    row_number: Optional[int] = None
    column_name: Optional[str] = None

    def __str__(self) -> str:
        parts = [self.file_path]
        if self.sheet_name:
            parts.append(f"[{self.sheet_name}]")
        if self.row_number is not None:
            parts.append(f"第{self.row_number}行")
        if self.column_name:
            parts.append(f"({self.column_name})")
        return "".join(parts)


@dataclass
class Store:
    store_id: str
    store_name: str
    region: str
    manager: Optional[str] = None
    address: Optional[str] = None
    source_location: Optional[SourceLocation] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PhotoEvidence:
    photo_id: str
    file_path: str
    photo_type: str
    description: str = ""
    taken_at: Optional[datetime] = None
    taken_by: Optional[str] = None
    source_location: Optional[SourceLocation] = None
    file_hash: Optional[str] = None

    def __post_init__(self):
        if not self.photo_id:
            self.photo_id = str(uuid4())


@dataclass
class InspectionItem:
    item_id: str
    store_id: str
    category: str
    item_name: str
    score: float
    max_score: float
    is_pass: bool
    inspector: str
    inspected_at: datetime
    photos: List[PhotoEvidence] = field(default_factory=list)
    remarks: str = ""
    source_location: Optional[SourceLocation] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RectificationTask:
    task_id: str
    item_id: str
    store_id: str
    description: str
    deadline: datetime
    assigned_to: str
    status: RectificationStatus
    created_at: datetime
    photos: List[PhotoEvidence] = field(default_factory=list)
    source_location: Optional[SourceLocation] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Recheck:
    recheck_id: str
    task_id: str
    item_id: str
    store_id: str
    rechecker: str
    rechecked_at: datetime
    result: RecheckResult
    reason: str = ""
    photos: List[PhotoEvidence] = field(default_factory=list)
    source_location: Optional[SourceLocation] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Deduction:
    deduction_id: str
    item_id: str
    store_id: str
    reason: str
    points: float
    deducted_at: datetime
    deducted_by: str
    source_location: Optional[SourceLocation] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ParsingError:
    error_type: str
    message: str
    source_location: SourceLocation
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class InspectionSession:
    session_id: str
    stores: Dict[str, Store] = field(default_factory=dict)
    items: Dict[str, InspectionItem] = field(default_factory=dict)
    tasks: Dict[str, RectificationTask] = field(default_factory=dict)
    rechecks: Dict[str, Recheck] = field(default_factory=dict)
    deductions: Dict[str, Deduction] = field(default_factory=dict)
    photos: Dict[str, PhotoEvidence] = field(default_factory=dict)
    parsing_errors: List[ParsingError] = field(default_factory=list)

    def __post_init__(self):
        if not self.session_id:
            self.session_id = str(uuid4())

    def add_store(self, store: Store) -> None:
        self.stores[store.store_id] = store

    def add_item(self, item: InspectionItem) -> None:
        self.items[item.item_id] = item
        for photo in item.photos:
            self.photos[photo.photo_id] = photo

    def add_task(self, task: RectificationTask) -> None:
        self.tasks[task.task_id] = task
        for photo in task.photos:
            self.photos[photo.photo_id] = photo

    def add_recheck(self, recheck: Recheck) -> None:
        self.rechecks[recheck.recheck_id] = recheck
        for photo in recheck.photos:
            self.photos[photo.photo_id] = photo

    def add_deduction(self, deduction: Deduction) -> None:
        self.deductions[deduction.deduction_id] = deduction

    def add_parsing_error(self, error: ParsingError) -> None:
        self.parsing_errors.append(error)

    def get_store_items(self, store_id: str) -> List[InspectionItem]:
        return [item for item in self.items.values() if item.store_id == store_id]

    def get_item_tasks(self, item_id: str) -> List[RectificationTask]:
        return [task for task in self.tasks.values() if task.item_id == item_id]

    def get_task_rechecks(self, task_id: str) -> List[Recheck]:
        return [recheck for recheck in self.rechecks.values() if recheck.task_id == task_id]

    def get_item_deductions(self, item_id: str) -> List[Deduction]:
        return [ded for ded in self.deductions.values() if ded.item_id == item_id]

    def get_store_deductions(self, store_id: str) -> List[Deduction]:
        return [ded for ded in self.deductions.values() if ded.store_id == store_id]
