from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import BloodlineSubscription, SubscriptionStatus
from schemas import (
    SubscriptionCreate, SubscriptionUpdate, SubscriptionResponse,
    ErrorResponse
)

router = APIRouter()

@router.post("/", response_model=SubscriptionResponse, responses={400: {"model": ErrorResponse}})
def create_subscription(
    subscription: SubscriptionCreate,
    db: Session = Depends(get_db)
):
    db_subscription = BloodlineSubscription(
        team_name=subscription.team_name,
        contact_person=subscription.contact_person,
        contact_email=subscription.contact_email,
        field_name_pattern=subscription.field_name_pattern,
        upstream_table_pattern=subscription.upstream_table_pattern,
        downstream_report_pattern=subscription.downstream_report_pattern,
        status=SubscriptionStatus.ACTIVE,
        notify_channels=subscription.notify_channels
    )
    db.add(db_subscription)
    db.commit()
    db.refresh(db_subscription)
    return db_subscription

@router.get("/", response_model=List[SubscriptionResponse])
def list_subscriptions(
    team_name: Optional[str] = Query(None, description="按团队名称过滤"),
    status: Optional[SubscriptionStatus] = Query(None, description="按状态过滤"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(BloodlineSubscription)
    if team_name:
        query = query.filter(BloodlineSubscription.team_name == team_name)
    if status:
        query = query.filter(BloodlineSubscription.status == status)
    return query.offset(skip).limit(limit).all()

@router.get("/{subscription_id}", response_model=SubscriptionResponse, responses={404: {"model": ErrorResponse}})
def get_subscription(
    subscription_id: int,
    db: Session = Depends(get_db)
):
    subscription = db.query(BloodlineSubscription).filter(BloodlineSubscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND",
            "error_message": f"订阅ID {subscription_id} 不存在"
        })
    return subscription

@router.put("/{subscription_id}", response_model=SubscriptionResponse, responses={404: {"model": ErrorResponse}})
def update_subscription(
    subscription_id: int,
    update_data: SubscriptionUpdate,
    db: Session = Depends(get_db)
):
    subscription = db.query(BloodlineSubscription).filter(BloodlineSubscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND",
            "error_message": f"订阅ID {subscription_id} 不存在"
        })
    
    update_dict = update_data.model_dump(exclude_unset=True)
    for field, value in update_dict.items():
        setattr(subscription, field, value)
    
    db.commit()
    db.refresh(subscription)
    return subscription

@router.delete("/{subscription_id}", responses={404: {"model": ErrorResponse}})
def delete_subscription(
    subscription_id: int,
    db: Session = Depends(get_db)
):
    subscription = db.query(BloodlineSubscription).filter(BloodlineSubscription.id == subscription_id).first()
    if not subscription:
        raise HTTPException(status_code=404, detail={
            "error_code": "NOT_FOUND",
            "error_message": f"订阅ID {subscription_id} 不存在"
        })
    db.delete(subscription)
    db.commit()
    return {"message": "订阅已删除", "subscription_id": subscription_id}
