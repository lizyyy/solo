from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict
from datetime import date, datetime
from database import get_db, ActionItem, ActionStatus
from schemas import KanbanExport, ActionItemWithMeeting

router = APIRouter()

@router.get("/kanban", response_model=KanbanExport)
def get_kanban_board(db: Session = Depends(get_db)):
    pending = db.query(ActionItem).filter(ActionItem.status == ActionStatus.PENDING).all()
    in_progress = db.query(ActionItem).filter(ActionItem.status == ActionStatus.IN_PROGRESS).all()
    delayed = db.query(ActionItem).filter(ActionItem.status == ActionStatus.DELAYED).all()
    completed = db.query(ActionItem).filter(ActionItem.status == ActionStatus.COMPLETED).all()
    needs_review = db.query(ActionItem).filter(ActionItem.needs_review == True).all()
    
    return KanbanExport(
        pending=pending,
        in_progress=in_progress,
        delayed=delayed,
        completed=completed,
        needs_review=needs_review
    )

@router.get("/by-assignee")
def get_report_by_assignee(db: Session = Depends(get_db)):
    from database import Person
    
    persons = db.query(Person).all()
    result = []
    
    for person in persons:
        items = db.query(ActionItem).filter(ActionItem.assignee_id == person.id).all()
        pending = len([i for i in items if i.status == ActionStatus.PENDING])
        in_progress = len([i for i in items if i.status == ActionStatus.IN_PROGRESS])
        delayed = len([i for i in items if i.status == ActionStatus.DELAYED])
        completed = len([i for i in items if i.status == ActionStatus.COMPLETED])
        
        result.append({
            "person_id": person.id,
            "person_name": person.name,
            "department": person.department,
            "total_items": len(items),
            "pending": pending,
            "in_progress": in_progress,
            "delayed": delayed,
            "completed": completed
        })
    
    return result

@router.get("/overdue-summary")
def get_overdue_summary(db: Session = Depends(get_db)):
    today = date.today()
    overdue_items = db.query(ActionItem).filter(
        ActionItem.due_date < today,
        ActionItem.status != ActionStatus.COMPLETED
    ).all()
    
    by_status = {}
    for status in ActionStatus:
        count = len([i for i in overdue_items if i.status == status])
        if count > 0:
            by_status[status.value] = count
    
    return {
        "total_overdue": len(overdue_items),
        "by_status": by_status,
        "items": overdue_items
    }

@router.get("/export-markdown")
def export_as_markdown(db: Session = Depends(get_db)):
    items = db.query(ActionItem).all()
    
    status_groups = {
        "待处理": [],
        "进行中": [],
        "已延期": [],
        "已完成": [],
        "需人工复核": []
    }
    
    for item in items:
        assignee = item.assignee.name if item.assignee else item.raw_assignee or "未分配"
        due_date_str = item.due_date.strftime("%Y-%m-%d") if item.due_date else item.raw_due_date or "待定"
        
        line = f"- [{'x' if item.status == ActionStatus.COMPLETED else ' '}] {item.content}"
        line += f" | 负责人: {assignee}"
        line += f" | 截止日期: {due_date_str}"
        if item.delay_reason:
            line += f" | 延期原因: {item.delay_reason}"
        
        if item.needs_review:
            status_groups["需人工复核"].append(line)
        elif item.status.value in status_groups:
            status_groups[item.status.value].append(line)
    
    markdown_content = f"# 行动项看板\n\n生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"
    
    for status, lines in status_groups.items():
        if lines:
            markdown_content += f"## {status} ({len(lines)})\n\n"
            for line in lines:
                markdown_content += f"{line}\n"
            markdown_content += "\n"
    
    return {"content": markdown_content}
