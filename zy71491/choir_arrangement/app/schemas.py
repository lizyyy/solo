from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class MemberBase(BaseModel):
    name: str
    voice_part: Optional[str] = None
    is_active: bool = True


class MemberCreate(MemberBase):
    pass


class MemberUpdate(BaseModel):
    voice_part: Optional[str] = None
    is_active: Optional[bool] = None


class Member(MemberBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AbsenceBase(BaseModel):
    member_id: int
    rehearsal_date: str
    reason: Optional[str] = None


class AbsenceCreate(AbsenceBase):
    pass


class Absence(AbsenceBase):
    id: int
    created_at: datetime
    member: Optional[Member] = None

    class Config:
        from_attributes = True


class RehearsalBase(BaseModel):
    rehearsal_date: str
    difficulty: int = 1
    notes: Optional[str] = None
    status: str = "draft"


class RehearsalCreate(RehearsalBase):
    pass


class RehearsalUpdate(BaseModel):
    difficulty: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[str] = None


class Rehearsal(RehearsalBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ArrangementBase(BaseModel):
    rehearsal_id: int
    member_id: int
    position_row: Optional[int] = None
    position_col: Optional[int] = None
    is_substitute: bool = False
    substituted_for: Optional[int] = None
    is_manual: bool = False


class ArrangementCreate(ArrangementBase):
    pass


class ArrangementUpdate(BaseModel):
    position_row: Optional[int] = None
    position_col: Optional[int] = None
    is_substitute: Optional[bool] = None
    substituted_for: Optional[int] = None
    is_manual: Optional[bool] = None


class Arrangement(ArrangementBase):
    id: int
    created_at: datetime
    member: Optional[Member] = None

    class Config:
        from_attributes = True


class SubstitutePoolBase(BaseModel):
    member_id: int
    voice_part: str
    priority: int = 0
    is_available: bool = True


class SubstitutePoolCreate(SubstitutePoolBase):
    pass


class SubstitutePool(SubstitutePoolBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ArrangementHistoryBase(BaseModel):
    rehearsal_id: int
    action_type: str
    field_name: Optional[str] = None
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    changed_by: Optional[str] = None
    reason: Optional[str] = None


class ArrangementHistoryCreate(ArrangementHistoryBase):
    pass


class ArrangementHistory(ArrangementHistoryBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class AbsenceSummary(BaseModel):
    rehearsal_date: str
    total_absences: int
    absences_by_voice: dict


class BalanceIssue(BaseModel):
    type: str
    voice_part: str
    current_count: int
    expected_range: str
    severity: str
    message: str


class SubstituteRecommendation(BaseModel):
    absent_member_id: int
    absent_member_name: str
    voice_part: str
    recommended_substitutes: List[dict]
    reason: str


class ArrangementResult(BaseModel):
    rehearsal_id: int
    rehearsal_date: str
    status: str
    attendance_summary: dict
    balance_issues: List[BalanceIssue]
    substitute_recommendations: List[SubstituteRecommendation]
    final_arrangement: List[dict]
    position_conflicts: List[dict]
