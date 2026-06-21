from dataclasses import dataclass, field, fields
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any, TypeVar, Type
from uuid import uuid4


T = TypeVar("T")


def _clone_dataclass(instance: Any, target_cls: Type[T]) -> T:
    valid_fields = {f.name for f in fields(target_cls)}
    kwargs = {k: v for k, v in instance.__dict__.items() if k in valid_fields}
    return target_cls(**kwargs)


class ChangeOrderStatus(str, Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPORTED = "exported"


class ProcessingType(str, Enum):
    ORIGINAL = "original"
    SUPPLEMENTARY = "supplementary"
    LATEST = "latest"


class JudgementImpact(str, Enum):
    STRUCTURAL_SAFETY = "structural_safety"
    MATERIAL_QUANTITY = "material_quantity"
    CONSTRUCTION_SEQUENCE = "construction_sequence"
    COST = "cost"
    DRAWING_VERSION = "drawing_version"


@dataclass
class DrawingVersion:
    version: str
    issued_at: datetime
    issued_by: str
    is_latest: bool = False
    description: Optional[str] = None


@dataclass
class VisaNote:
    content: str
    created_at: datetime
    created_by: str
    source_doc: str
    id: str = field(default_factory=lambda: str(uuid4()))
    affected_judgements: List[str] = field(default_factory=list)
    impacts: List[JudgementImpact] = field(default_factory=list)


@dataclass
class CoordinateOffset:
    offset_x: float
    offset_y: float
    offset_z: float
    detected_at: datetime
    source_record_id: str
    source_record_title: str
    confirmer_role: str = "结构工程师"
    confirmer_name: str = "老叶"
    confirmation_status: str = "pending"
    affected_regions: List[str] = field(default_factory=list)


@dataclass
class Judgement:
    item_code: str
    item_name: str
    original_judgement: str
    final_judgement: str
    basis: List[str]
    id: str = field(default_factory=lambda: str(uuid4()))
    modified_by: Optional[str] = None
    modified_at: Optional[datetime] = None
    modification_reason: Optional[str] = None
    is_overridden: bool = False
    impacts: List[JudgementImpact] = field(default_factory=list)


@dataclass
class VersionHistory:
    version: int
    timestamp: datetime
    operator: str
    change_summary: str
    judgements_snapshot: List[Judgement]
    visa_notes_snapshot: List[VisaNote]
    coordinate_offset_snapshot: Optional[CoordinateOffset] = None


@dataclass
class ExportRecord:
    exported_at: datetime
    exported_by: str
    processing_type: ProcessingType
    scene_annotation: str
    sidebar_note: str
    page_summary: str
    judgements: List[Judgement]
    visa_notes: List[VisaNote]
    id: str = field(default_factory=lambda: str(uuid4()))
    coordinate_offset: Optional[CoordinateOffset] = None
    warnings: List[str] = field(default_factory=list)
    material_location_hint: Optional[str] = None
    delivery_smoothness_score: int = 100


@dataclass
class ChangeOrder:
    project_name: str
    change_order_no: str
    id: str = field(default_factory=lambda: str(uuid4()))
    status: ChangeOrderStatus = ChangeOrderStatus.DRAFT
    drawing_versions: List[DrawingVersion] = field(default_factory=list)
    judgements: List[Judgement] = field(default_factory=list)
    visa_notes: List[VisaNote] = field(default_factory=list)
    coordinate_offsets: List[CoordinateOffset] = field(default_factory=list)
    version_history: List[VersionHistory] = field(default_factory=list)
    export_records: List[ExportRecord] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    created_by: str = ""
    current_version: int = 0

    def get_latest_drawing(self) -> Optional[DrawingVersion]:
        for dv in self.drawing_versions:
            if dv.is_latest:
                return dv
        return None

    def get_judgement_by_code(self, item_code: str) -> Optional[Judgement]:
        for j in self.judgements:
            if j.item_code == item_code:
                return j
        return None

    def save_version(self, operator: str, change_summary: str) -> None:
        self.current_version += 1
        snapshot = VersionHistory(
            version=self.current_version,
            timestamp=datetime.now(),
            operator=operator,
            change_summary=change_summary,
            judgements_snapshot=[_clone_dataclass(j, Judgement) for j in self.judgements],
            visa_notes_snapshot=[_clone_dataclass(v, VisaNote) for v in self.visa_notes],
            coordinate_offset_snapshot=(
                _clone_dataclass(self.coordinate_offsets[-1], CoordinateOffset)
                if self.coordinate_offsets else None
            )
        )
        self.version_history.append(snapshot)

    def add_visa_note(
        self,
        content: str,
        created_by: str,
        source_doc: str,
        affected_item_codes: List[str],
        impacts: List[JudgementImpact]
    ) -> VisaNote:
        affected_judgements = []
        for code in affected_item_codes:
            j = self.get_judgement_by_code(code)
            if j:
                j.impacts.extend(impacts)
                affected_judgements.append(j.id)

        visa = VisaNote(
            content=content,
            created_at=datetime.now(),
            created_by=created_by,
            source_doc=source_doc,
            affected_judgements=affected_judgements,
            impacts=impacts
        )
        self.visa_notes.append(visa)
        return visa

    def override_judgement(
        self,
        item_code: str,
        new_judgement: str,
        operator: str,
        reason: str
    ) -> Optional[Judgement]:
        j = self.get_judgement_by_code(item_code)
        if j:
            j.final_judgement = new_judgement
            j.modified_by = operator
            j.modified_at = datetime.now()
            j.modification_reason = reason
            j.is_overridden = True
            return j
        return None
