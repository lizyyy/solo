from datetime import date
from typing import Optional, List
from pydantic import Field
from .base import BaseModel, RecordStatus, ReviewStatus


class ConstructionNoticeImport(BaseModel):
    notice_no: str
    project_name: str
    construction_location: str
    start_date: date
    end_date: date
    construction_type: str
    temporary_detour: bool = False
    detour_description: Optional[str] = None
    map_updated: bool = True
    impact_scope: str
    remark: Optional[str] = None
    import_batch_no: str
    source_file: Optional[str] = None


class ConstructionNotice(ConstructionNoticeImport):
    status: RecordStatus = RecordStatus.IMPORTED
    review_status: ReviewStatus = ReviewStatus.NOT_REQUIRED
    ramp_records_verified: bool = False
    conflict_ids: List[str] = Field(default_factory=list)
    point_list_updated: bool = False
    resident_review_note: Optional[str] = None

    def mark_detour_unsynced(self, operator: str):
        self.map_updated = False
        self.review_status = ReviewStatus.PENDING_RESIDENT_REVIEW
        self.status = RecordStatus.PENDING_REVIEW
        self.touch(operator)
