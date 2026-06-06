from enum import Enum
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator


class TicketType(str, Enum):
    PAID = "paid"
    COMPLIMENTARY = "complimentary"
    UNKNOWN = "unknown"


class BatchStatus(str, Enum):
    NORMAL = "normal"
    MIXED = "mixed"
    PENDING_REVIEW = "pending_review"
    RESOLVED = "resolved"
    ROLLED_BACK = "rolled_back"


class WorkflowStage(str, Enum):
    STAGE_1_IMPORTED = "stage_1_imported"
    STAGE_2_CONTRACT_REVIEWED = "stage_2_contract_reviewed"
    STAGE_3_AUTHORIZED = "stage_3_authorized"


class Ticket(BaseModel):
    id: str
    type: TicketType
    seat: Optional[str] = None
    price: Optional[float] = None
    guest_name: Optional[str] = None
    source_ref: str
    note: Optional[str] = None


class Batch(BaseModel):
    id: str
    name: str
    show_id: str
    tickets: List[Ticket] = Field(default_factory=list)
    status: BatchStatus = BatchStatus.NORMAL
    mixed_issue_found: Optional[bool] = None
    review_note: Optional[str] = None
    resolved_at: Optional[datetime] = None
    rolled_back_at: Optional[datetime] = None

    @property
    def ticket_counts(self) -> Dict[TicketType, int]:
        counts: Dict[TicketType, int] = {}
        for t in self.tickets:
            counts[t.type] = counts.get(t.type, 0) + 1
        return counts

    @property
    def has_mixed_types(self) -> bool:
        counts = self.ticket_counts
        return TicketType.PAID in counts and TicketType.COMPLIMENTARY in counts


class EnergyPoint(BaseModel):
    track_name: str
    track_order: int
    energy_level: float = Field(ge=0.0, le=10.0)
    bpm: Optional[int] = None
    mood: Optional[str] = None
    note: Optional[str] = None
    source_ref: Optional[str] = None


class EnergyCurve(BaseModel):
    id: str
    show_id: str
    points: List[EnergyPoint] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    modified_at: datetime = Field(default_factory=datetime.now)
    modified_by: str
    version: int = 1


class RehearsalImport(BaseModel):
    id: str
    show_id: str
    source_filename: str
    source_hash: str
    imported_at: datetime = Field(default_factory=datetime.now)
    imported_by: str
    raw_content: str
    batch_ids: List[str] = Field(default_factory=list)
    note: Optional[str] = None


class ContractScreenshot(BaseModel):
    id: str
    show_id: str
    image_path: str
    uploaded_at: datetime = Field(default_factory=datetime.now)
    uploaded_by: str
    ocr_text: Optional[str] = None
    linked_batch_ids: List[str] = Field(default_factory=list)
    note: Optional[str] = None


class ModificationRecord(BaseModel):
    id: str
    show_id: str
    entity_type: str
    entity_id: str
    field_name: str
    old_value: Optional[Any] = None
    new_value: Optional[Any] = None
    modified_at: datetime = Field(default_factory=datetime.now)
    modified_by: str
    reason: Optional[str] = None


class ReviewDecision(BaseModel):
    id: str
    batch_id: str
    show_id: str
    decided_at: datetime = Field(default_factory=datetime.now)
    decided_by: str
    is_approved: bool
    resolution: Optional[str] = None
    split_into_batches: Optional[List[str]] = None


class DJShow(BaseModel):
    id: str
    name: str
    date: datetime
    venue: str
    dj_name: str
    workflow_stage: WorkflowStage = WorkflowStage.STAGE_1_IMPORTED
    batches: List[Batch] = Field(default_factory=list)
    energy_curve: Optional[EnergyCurve] = None
    rehearsal_imports: List[RehearsalImport] = Field(default_factory=list)
    contract_screenshots: List[ContractScreenshot] = Field(default_factory=list)
    modification_history: List[ModificationRecord] = Field(default_factory=list)
    review_decisions: List[ReviewDecision] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    note: Optional[str] = None


class ImportResult(BaseModel):
    success: bool
    show_id: Optional[str] = None
    is_duplicate: bool = False
    existing_import_id: Optional[str] = None
    batches_created: int = 0
    tickets_imported: int = 0
    mixed_batches_found: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    errors: List[str] = Field(default_factory=list)
