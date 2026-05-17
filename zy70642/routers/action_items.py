from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date, datetime
from database import get_db, ActionItem, Person, ActionStatus, DelayRecord
from schemas import (
    ActionItem as ActionItemSchema,
    ActionItemCreate,
    ActionItemUpdate,
    ActionItemWithMeeting,
    Person as PersonSchema,
    PersonCreate,
    ParseRequest,
    ParseResponse
)
from exceptions import (
    NotFoundException,
    MissingFieldException,
    InvalidStatusException,
    NeedsReviewException,
    DuplicatePersonException
)
from markdown_parser import parser

router = APIRouter()

@router.post("/parse-markdown", response_model=ParseResponse)
def parse_markdown(request: ParseRequest):
    if not request.markdown_content:
        raise MissingFieldException("markdown_content")
    
    action_items, needs_review_count = parser.extract_action_items(request.markdown_content)
    
    return ParseResponse(
        action_items=action_items,
        needs_review_count=needs_review_count,
        message=f"成功解析 {len(action_items)} 个行动项，其中 {needs_review_count} 个需要人工复核"
    )

@router.post("/", response_model=ActionItemSchema)
def create_action_item(item: ActionItemCreate, db: Session = Depends(get_db)):
    if not item.content:
        raise MissingFieldException("content")
    
    db_item = ActionItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.get("/", response_model=List[ActionItemWithMeeting])
def list_action_items(
    skip: int = 0,
    limit: int = 100,
    status: Optional[ActionStatus] = None,
    assignee_id: Optional[int] = None,
    needs_review: Optional[bool] = None,
    overdue_only: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ActionItem)
    
    if status:
        query = query.filter(ActionItem.status == status)
    if assignee_id:
        query = query.filter(ActionItem.assignee_id == assignee_id)
    if needs_review is not None:
        query = query.filter(ActionItem.needs_review == needs_review)
    if overdue_only:
        today = date.today()
        query = query.filter(
            ActionItem.due_date < today,
            ActionItem.status != ActionStatus.COMPLETED
        )
    
    items = query.offset(skip).limit(limit).all()
    return items

@router.get("/{item_id}", response_model=ActionItemWithMeeting)
def get_action_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ActionItem).filter(ActionItem.id == item_id).first()
    if not item:
        raise NotFoundException("行动项", item_id)
    return item

@router.put("/{item_id}", response_model=ActionItemSchema)
def update_action_item(item_id: int, update_data: ActionItemUpdate, db: Session = Depends(get_db)):
    item = db.query(ActionItem).filter(ActionItem.id == item_id).first()
    if not item:
        raise NotFoundException("行动项", item_id)
    
    update_dict = update_data.model_dump(exclude_unset=True)
    
    for key, value in update_dict.items():
        setattr(item, key, value)
    
    db.commit()
    db.refresh(item)
    return item

@router.post("/{item_id}/mark-delayed")
def mark_action_item_delayed(
    item_id: int,
    reason: str,
    new_due_date: Optional[date] = None,
    db: Session = Depends(get_db)
):
    item = db.query(ActionItem).filter(ActionItem.id == item_id).first()
    if not item:
        raise NotFoundException("行动项", item_id)
    
    if item.needs_review:
        raise NeedsReviewException(item_id, item.review_notes)
    
    if item.status == ActionStatus.COMPLETED:
        raise InvalidStatusException(
            str(item.status),
            [ActionStatus.PENDING.value, ActionStatus.IN_PROGRESS.value],
            "已完成的行动项不能标记为延期"
        )
    
    original_due_date = item.due_date
    item.status = ActionStatus.DELAYED
    item.delay_reason = reason
    
    if new_due_date:
        item.due_date = new_due_date
    
    delay_record = DelayRecord(
        action_item_id=item_id,
        original_due_date=original_due_date,
        new_due_date=new_due_date,
        reason=reason
    )
    db.add(delay_record)
    db.commit()
    
    return {"message": "行动项已标记为延期", "item_id": item_id}

@router.post("/{item_id}/resolve-review")
def resolve_review(
    item_id: int,
    assignee_id: Optional[int] = None,
    due_date: Optional[date] = None,
    review_notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    item = db.query(ActionItem).filter(ActionItem.id == item_id).first()
    if not item:
        raise NotFoundException("行动项", item_id)
    
    if assignee_id is not None:
        item.assignee_id = assignee_id
    if due_date is not None:
        item.due_date = due_date
    if review_notes is not None:
        item.review_notes = review_notes
    
    item.needs_review = False
    db.commit()
    
    return {"message": "复核已解决", "item_id": item_id}

@router.delete("/{item_id}")
def delete_action_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(ActionItem).filter(ActionItem.id == item_id).first()
    if not item:
        raise NotFoundException("行动项", item_id)
    db.delete(item)
    db.commit()
    return {"message": "行动项已删除", "item_id": item_id}

@router.post("/persons/", response_model=PersonSchema)
def create_person(person: PersonCreate, db: Session = Depends(get_db)):
    if not person.name:
        raise MissingFieldException("name")
    
    existing = db.query(Person).filter(Person.name == person.name).first()
    if existing:
        raise DuplicatePersonException(person.name)
    
    db_person = Person(**person.model_dump())
    db.add(db_person)
    db.commit()
    db.refresh(db_person)
    return db_person

@router.get("/persons/", response_model=List[PersonSchema])
def list_persons(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    persons = db.query(Person).offset(skip).limit(limit).all()
    return persons

@router.post("/merge-persons")
def merge_persons(primary_person_id: int, duplicate_person_ids: List[int], db: Session = Depends(get_db)):
    primary = db.query(Person).filter(Person.id == primary_person_id).first()
    if not primary:
        raise NotFoundException("负责人", primary_person_id)
    
    for dup_id in duplicate_person_ids:
        duplicate = db.query(Person).filter(Person.id == dup_id).first()
        if duplicate:
            db.query(ActionItem).filter(ActionItem.assignee_id == dup_id).update(
                {"assignee_id": primary_person_id}
            )
            db.delete(duplicate)
    
    db.commit()
    return {"message": "负责人合并完成", "primary_person_id": primary_person_id}
