from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import datetime
from . import models, schemas


def get_pickup_by_no(db: Session, pickup_no: str):
    return db.query(models.Pickup).filter(models.Pickup.pickup_no == pickup_no).first()


def create_pickup(db: Session, pickup: schemas.PickupCreate):
    db_pickup = models.Pickup(**pickup.model_dump())
    db.add(db_pickup)
    db.commit()
    db.refresh(db_pickup)
    return db_pickup


def get_pickups(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Pickup).offset(skip).limit(limit).all()


def create_return(db: Session, return_item: schemas.ReturnCreate):
    db_return = models.Return(**return_item.model_dump())
    db.add(db_return)
    db.commit()
    db.refresh(db_return)
    return db_return


def get_return_by_no(db: Session, return_no: str):
    return db.query(models.Return).filter(models.Return.return_no == return_no).first()


def get_returns_by_pickup(db: Session, pickup_no: str):
    return db.query(models.Return).filter(models.Return.pickup_no == pickup_no).all()


def create_claim(db: Session, claim: schemas.ClaimCreate):
    db_claim = models.Claim(**claim.model_dump())
    db.add(db_claim)
    db.commit()
    db.refresh(db_claim)
    return db_claim


def get_claim_by_no(db: Session, claim_no: str):
    return db.query(models.Claim).filter(models.Claim.claim_no == claim_no).first()


def get_claims_by_pickup(db: Session, pickup_no: str):
    return db.query(models.Claim).filter(models.Claim.pickup_no == pickup_no).all()


def get_claims(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Claim).offset(skip).limit(limit).all()


def create_anomaly(db: Session, anomaly: schemas.AnomalyCreate):
    db_anomaly = models.Anomaly(**anomaly.model_dump())
    db.add(db_anomaly)
    db.commit()
    db.refresh(db_anomaly)
    return db_anomaly


def get_anomalies(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Anomaly).offset(skip).limit(limit).all()


def create_review_record(db: Session, review: schemas.ReviewRecordCreate):
    db_review = models.ReviewRecord(**review.model_dump())
    db.add(db_review)
    db.commit()
    db.refresh(db_review)
    return db_review


def get_review_records(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ReviewRecord).offset(skip).limit(limit).all()


def check_match_status(db: Session, pickup_no: str) -> schemas.MatchResult:
    pickup = get_pickup_by_no(db, pickup_no)
    if not pickup:
        raise ValueError(f"Pickup {pickup_no} not found")
    
    returns = get_returns_by_pickup(db, pickup_no)
    claims = get_claims_by_pickup(db, pickup_no)
    
    total_return_qty = sum(r.return_quantity for r in returns)
    has_return = len(returns) > 0
    has_claim = len(claims) > 0
    
    anomalies = []
    if not has_return:
        anomalies.append("缺失旧件返还记录")
    if has_return and total_return_qty < pickup.quantity:
        anomalies.append(f"返还数量不足: 领件{pickup.quantity}, 返还{total_return_qty}")
    if not has_claim:
        anomalies.append("缺失厂商索赔记录")
    if has_claim and claims[0].status != "approved":
        anomalies.append(f"索赔状态异常: {claims[0].status}")
    
    is_fully_matched = (
        has_return and 
        total_return_qty >= pickup.quantity and
        has_claim and 
        claims[0].status == "approved"
    )
    
    return schemas.MatchResult(
        pickup_no=pickup.pickup_no,
        work_order_no=pickup.work_order_no,
        engineer=pickup.engineer,
        part_code=pickup.part_code,
        part_name=pickup.part_name,
        pickup_quantity=pickup.quantity,
        has_return=has_return,
        return_quantity=total_return_qty if has_return else None,
        has_claim=has_claim,
        claim_status=claims[0].status if has_claim else None,
        is_fully_matched=is_fully_matched,
        anomalies=anomalies
    )


def get_match_results(
    db: Session,
    engineer: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    handler: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[schemas.MatchResult]:
    query = db.query(models.Pickup)
    
    if engineer:
        query = query.filter(models.Pickup.engineer.contains(engineer))
    if start_date:
        query = query.filter(models.Pickup.pickup_date >= start_date)
    if end_date:
        query = query.filter(models.Pickup.pickup_date <= end_date)
    
    pickups = query.offset(skip).limit(limit).all()
    results = []
    
    for pickup in pickups:
        match_result = check_match_status(db, pickup.pickup_no)
        
        if status == "matched" and not match_result.is_fully_matched:
            continue
        if status == "unmatched" and match_result.is_fully_matched:
            continue
        
        if anomaly_type:
            has_anomaly = any(anomaly_type in a for a in match_result.anomalies)
            if not has_anomaly:
                continue
        
        if handler:
            anomalies = db.query(models.Anomaly).filter(
                models.Anomaly.pickup_no == pickup.pickup_no,
                models.Anomaly.handler == handler
            ).first()
            if not anomalies:
                continue
        
        results.append(match_result)
    
    return results


def filter_anomalies(
    db: Session,
    anomaly_type: Optional[str] = None,
    handler: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100
) -> List[models.Anomaly]:
    query = db.query(models.Anomaly)
    
    if anomaly_type:
        query = query.filter(models.Anomaly.anomaly_type.contains(anomaly_type))
    if handler:
        query = query.filter(models.Anomaly.handler.contains(handler))
    if status:
        query = query.filter(models.Anomaly.status == status)
    if start_date:
        query = query.filter(models.Anomaly.created_at >= start_date)
    if end_date:
        query = query.filter(models.Anomaly.created_at <= end_date)
    
    return query.offset(skip).limit(limit).all()
