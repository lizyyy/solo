from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db, MeetingMinute
from schemas import MeetingMinuteCreate, MeetingMinute as MeetingMinuteSchema
from exceptions import NotFoundException, MissingFieldException, AlreadyProcessedException
from markdown_parser import parser

router = APIRouter()

@router.post("/", response_model=MeetingMinuteSchema)
def create_meeting_minute(meeting: MeetingMinuteCreate, db: Session = Depends(get_db)):
    if not meeting.title:
        raise MissingFieldException("title")
    if not meeting.content:
        raise MissingFieldException("content")
    
    db_meeting = MeetingMinute(
        title=meeting.title,
        content=meeting.content,
        meeting_date=meeting.meeting_date
    )
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return db_meeting

@router.get("/", response_model=List[MeetingMinuteSchema])
def list_meeting_minutes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    meetings = db.query(MeetingMinute).offset(skip).limit(limit).all()
    return meetings

@router.get("/{meeting_id}", response_model=MeetingMinuteSchema)
def get_meeting_minute(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(MeetingMinute).filter(MeetingMinute.id == meeting_id).first()
    if not meeting:
        raise NotFoundException("会议纪要", meeting_id)
    return meeting

@router.post("/{meeting_id}/parse")
def parse_meeting_minute(meeting_id: int, db: Session = Depends(get_db)):
    from database import ActionItem, Person
    
    meeting = db.query(MeetingMinute).filter(MeetingMinute.id == meeting_id).first()
    if not meeting:
        raise NotFoundException("会议纪要", meeting_id)
    
    if meeting.processed:
        raise AlreadyProcessedException(meeting_id, "会议纪要已解析过")
    
    action_items, needs_review_count = parser.extract_action_items(meeting.content)
    
    all_persons = db.query(Person).all()
    
    for item in action_items:
        assignee_id = None
        review_notes_list = []
        
        if item.review_notes:
            review_notes_list.append(item.review_notes)
        
        if item.raw_assignee:
            for person in all_persons:
                if person.name == item.raw_assignee:
                    assignee_id = person.id
                    break
                if person.alias:
                    aliases = [a.strip() for a in person.alias.split(',')]
                    if item.raw_assignee in aliases:
                        assignee_id = person.id
                        break
        
        db_item = ActionItem(
            meeting_id=meeting_id,
            content=item.content,
            raw_assignee=item.raw_assignee,
            assignee_id=assignee_id,
            raw_due_date=item.raw_due_date,
            due_date=item.due_date,
            status=item.status,
            delay_reason=item.delay_reason,
            needs_review=item.needs_review,
            review_notes="; ".join(review_notes_list) if review_notes_list else None
        )
        db.add(db_item)
    
    meeting.processed = True
    db.commit()
    
    matched_count = sum(1 for item in action_items if item.raw_assignee and any(
        p.name == item.raw_assignee or (p.alias and item.raw_assignee in [a.strip() for a in p.alias.split(',')])
        for p in all_persons
    ))
    
    return {
        "meeting_id": meeting_id,
        "action_items_count": len(action_items),
        "needs_review_count": needs_review_count,
        "matched_assignees_count": matched_count,
        "message": f"成功解析 {len(action_items)} 个行动项，其中 {matched_count} 个已匹配负责人，{needs_review_count} 个需要人工复核"
    }

@router.delete("/{meeting_id}")
def delete_meeting_minute(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(MeetingMinute).filter(MeetingMinute.id == meeting_id).first()
    if not meeting:
        raise NotFoundException("会议纪要", meeting_id)
    db.delete(meeting)
    db.commit()
    return {"message": "会议纪要已删除", "meeting_id": meeting_id}
