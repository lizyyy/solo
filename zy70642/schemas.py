from pydantic import BaseModel, Field
from datetime import date, datetime
from typing import Optional, List
from database import ActionStatus

class PersonBase(BaseModel):
    name: str = Field(..., max_length=100)
    alias: Optional[str] = None
    department: Optional[str] = None

class PersonCreate(PersonBase):
    pass

class Person(PersonBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class MeetingMinuteBase(BaseModel):
    title: str = Field(..., max_length=200)
    content: str
    meeting_date: Optional[date] = None

class MeetingMinuteCreate(MeetingMinuteBase):
    pass

class MeetingMinute(MeetingMinuteBase):
    id: int
    created_at: datetime
    processed: bool
    
    class Config:
        from_attributes = True

class DelayRecordBase(BaseModel):
    original_due_date: Optional[date] = None
    new_due_date: Optional[date] = None
    reason: str

class DelayRecordCreate(DelayRecordBase):
    pass

class DelayRecord(DelayRecordBase):
    id: int
    action_item_id: int
    recorded_at: datetime
    
    class Config:
        from_attributes = True

class ActionItemBase(BaseModel):
    content: str
    raw_assignee: Optional[str] = None
    raw_due_date: Optional[str] = None
    status: ActionStatus = ActionStatus.PENDING
    delay_reason: Optional[str] = None
    needs_review: bool = False
    review_notes: Optional[str] = None

class ActionItemCreate(ActionItemBase):
    meeting_id: Optional[int] = None
    assignee_id: Optional[int] = None
    due_date: Optional[date] = None

class ActionItemUpdate(BaseModel):
    content: Optional[str] = None
    assignee_id: Optional[int] = None
    due_date: Optional[date] = None
    status: Optional[ActionStatus] = None
    delay_reason: Optional[str] = None
    needs_review: Optional[bool] = None
    review_notes: Optional[str] = None

class ActionItem(ActionItemBase):
    id: int
    meeting_id: Optional[int] = None
    assignee_id: Optional[int] = None
    due_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime
    assignee: Optional[Person] = None
    delay_records: List[DelayRecord] = []
    
    class Config:
        from_attributes = True

class ActionItemWithMeeting(ActionItem):
    meeting: Optional[MeetingMinute] = None

class ParseRequest(BaseModel):
    markdown_content: str

class ParseResponse(BaseModel):
    action_items: List[ActionItemCreate]
    needs_review_count: int
    message: str

class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None

class KanbanExport(BaseModel):
    pending: List[ActionItemWithMeeting]
    in_progress: List[ActionItemWithMeeting]
    delayed: List[ActionItemWithMeeting]
    completed: List[ActionItemWithMeeting]
    needs_review: List[ActionItemWithMeeting]
