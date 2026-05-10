from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.schemas import BillOut
from app.models import Bill, Task

router = APIRouter(prefix="/bills", tags=["Bills"])


@router.get("/", response_model=List[BillOut])
def list_bills(
    user_id: Optional[str] = None,
    task_id: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(Bill)
    
    if user_id:
        query = query.filter(Bill.user_id == user_id)
    if task_id:
        task = db.query(Task).filter(Task.task_id == task_id).first()
        if task:
            query = query.filter(Bill.task_id == task.id)
    if start_time:
        query = query.filter(Bill.start_time >= start_time)
    if end_time:
        query = query.filter(Bill.start_time <= end_time)
    
    return query.order_by(Bill.id.desc()).limit(limit).all()


@router.get("/{bill_id}", response_model=BillOut)
def get_bill(bill_id: str, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.bill_id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail=f"Bill {bill_id} not found")
    return bill


@router.get("/task/{task_id}", response_model=BillOut)
def get_bill_by_task(task_id: str, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.task_id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    
    bill = db.query(Bill).filter(Bill.task_id == task.id).first()
    if not bill:
        raise HTTPException(status_code=404, detail=f"No bill found for task {task_id}")
    return bill


@router.get("/summary/{user_id}")
def get_user_bill_summary(
    user_id: str,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Bill).filter(Bill.user_id == user_id)
    
    if start_time:
        query = query.filter(Bill.start_time >= start_time)
    if end_time:
        query = query.filter(Bill.start_time <= end_time)
    
    bills = query.all()
    
    total_seconds = sum(b.total_seconds or 0 for b in bills)
    total_base_cost = sum(b.base_cost or 0 for b in bills)
    total_premium_cost = sum(b.premium_cost or 0 for b in bills)
    total_cost = sum(b.total_cost or 0 for b in bills)
    
    return {
        "user_id": user_id,
        "total_bills": len(bills),
        "total_seconds": total_seconds,
        "total_minutes": round(total_seconds / 60, 2),
        "base_cost": round(total_base_cost, 2),
        "premium_cost": round(total_premium_cost, 2),
        "total_cost": round(total_cost, 2),
        "average_cost_per_bill": round(total_cost / len(bills), 2) if bills else 0
    }
