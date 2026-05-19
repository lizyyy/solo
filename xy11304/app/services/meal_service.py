from sqlalchemy.orm import Session
from app.models.models import MealDistribution, MealStatus, Elder, Menu, ElderStatus
from app.schemas.schemas import MealDistributionCreate, MealDistributionReview, MealDistributionDelivery
from app.services.audit_service import log_entity_change
from app.services.menu_service import check_dietary_conflict
from datetime import date, datetime
from typing import Optional, List, Tuple


def get_meal_distribution(db: Session, distribution_id: int):
    return db.query(MealDistribution).filter(MealDistribution.id == distribution_id).first()


def get_meal_distributions(db: Session, skip: int = 0, limit: int = 100,
                           status: Optional[MealStatus] = None,
                           elder_id: Optional[int] = None,
                           menu_id: Optional[int] = None):
    query = db.query(MealDistribution)
    if status:
        query = query.filter(MealDistribution.status == status)
    if elder_id:
        query = query.filter(MealDistribution.elder_id == elder_id)
    if menu_id:
        query = query.filter(MealDistribution.menu_id == menu_id)
    return query.order_by(MealDistribution.created_at.desc()).offset(skip).limit(limit).all()


def get_meal_distributions_with_details(db: Session, skip: int = 0, limit: int = 100,
                                         status: Optional[MealStatus] = None,
                                         menu_date: Optional[date] = None,
                                         route_id: Optional[int] = None):
    query = db.query(MealDistribution).join(Elder).join(Menu)
    
    if status:
        query = query.filter(MealDistribution.status == status)
    if menu_date:
        query = query.filter(Menu.date == menu_date)
    if route_id is not None:
        query = query.filter(Elder.route_id == route_id)
    
    return query.order_by(Elder.route_id, Elder.name).offset(skip).limit(limit).all()


def create_meal_distribution(db: Session, meal: MealDistributionCreate,
                              operator: str = None, ip_address: str = None,
                              auto_check_conflict: bool = True):
    elder = db.query(Elder).filter(Elder.id == meal.elder_id).first()
    if not elder:
        raise ValueError(f"老人 ID {meal.elder_id} 不存在")
    
    if elder.status != ElderStatus.ACTIVE:
        raise ValueError(f"老人 {elder.name} 不是活跃状态，无法配餐")
    
    menu = db.query(Menu).filter(Menu.id == meal.menu_id).first()
    if not menu:
        raise ValueError(f"菜单 ID {meal.menu_id} 不存在")
    
    existing = db.query(MealDistribution).filter(
        MealDistribution.elder_id == meal.elder_id,
        MealDistribution.menu_id == meal.menu_id
    ).first()
    if existing:
        raise ValueError(f"该老人此菜单的配餐记录已存在")
    
    warnings = []
    if auto_check_conflict and elder.dietary_restrictions:
        ok, conflicts = check_dietary_conflict(menu, elder.dietary_restrictions)
        if not ok:
            warnings.extend(conflicts)
    
    special_reqs = []
    if meal.special_requirements:
        special_reqs.append(meal.special_requirements)
    if warnings:
        special_reqs.extend(warnings)
    
    db_meal = MealDistribution(
        elder_id=meal.elder_id,
        menu_id=meal.menu_id,
        special_requirements="; ".join(special_reqs) if special_reqs else None,
        actual_dishes=meal.actual_dishes,
        status=MealStatus.PENDING
    )
    db.add(db_meal)
    db.commit()
    db.refresh(db_meal)
    
    log_entity_change(
        db, "meal_distribution", db_meal.id,
        old_data={},
        new_data={
            "elder_id": meal.elder_id,
            "menu_id": meal.menu_id,
            "special_requirements": db_meal.special_requirements,
            "actual_dishes": meal.actual_dishes
        },
        operator=operator, ip_address=ip_address, action="create"
    )
    
    return db_meal, warnings


def review_meal_distribution(db: Session, distribution_id: int,
                              review: MealDistributionReview,
                              operator: str = None, ip_address: str = None):
    db_meal = get_meal_distribution(db, distribution_id)
    if not db_meal:
        raise ValueError(f"配餐记录 ID {distribution_id} 不存在")
    
    if db_meal.status not in [MealStatus.PENDING, MealStatus.CONFIRMED]:
        raise ValueError(f"当前状态 {db_meal.status} 无法复核")
    
    old_data = {c.name: getattr(db_meal, c.name) for c in db_meal.__table__.columns}
    
    db_meal.status = review.status
    db_meal.review_notes = review.review_notes
    db_meal.reviewed_by = operator or review.reviewed_by
    db_meal.reviewed_at = datetime.now()
    
    db.commit()
    db.refresh(db_meal)
    
    new_data = {c.name: getattr(db_meal, c.name) for c in db_meal.__table__.columns}
    log_entity_change(
        db, "meal_distribution", distribution_id,
        old_data=old_data,
        new_data=new_data,
        operator=operator, ip_address=ip_address, action="review"
    )
    
    return db_meal


def deliver_meal_distribution(db: Session, distribution_id: int,
                               delivery: MealDistributionDelivery,
                               operator: str = None, ip_address: str = None):
    db_meal = get_meal_distribution(db, distribution_id)
    if not db_meal:
        raise ValueError(f"配餐记录 ID {distribution_id} 不存在")
    
    if db_meal.status != MealStatus.CONFIRMED:
        raise ValueError(f"只有已确认的配餐才能配送，当前状态: {db_meal.status}")
    
    old_data = {c.name: getattr(db_meal, c.name) for c in db_meal.__table__.columns}
    
    db_meal.status = delivery.status
    db_meal.delivery_notes = delivery.delivery_notes
    db_meal.delivered_by = operator or delivery.delivered_by
    db_meal.delivered_at = datetime.now()
    
    db.commit()
    db.refresh(db_meal)
    
    new_data = {c.name: getattr(db_meal, c.name) for c in db_meal.__table__.columns}
    log_entity_change(
        db, "meal_distribution", distribution_id,
        old_data=old_data,
        new_data=new_data,
        operator=operator, ip_address=ip_address, action="deliver"
    )
    
    return db_meal


def cancel_meal_distribution(db: Session, distribution_id: int,
                              operator: str = None, ip_address: str = None,
                              reason: str = None):
    db_meal = get_meal_distribution(db, distribution_id)
    if not db_meal:
        raise ValueError(f"配餐记录 ID {distribution_id} 不存在")
    
    if db_meal.status == MealStatus.DELIVERED:
        raise ValueError("已配送的配餐无法取消")
    
    old_data = {c.name: getattr(db_meal, c.name) for c in db_meal.__table__.columns}
    
    db_meal.status = MealStatus.CANCELLED
    if reason:
        db_meal.review_notes = (db_meal.review_notes or "") + f" 取消原因: {reason}"
    
    db.commit()
    db.refresh(db_meal)
    
    new_data = {c.name: getattr(db_meal, c.name) for c in db_meal.__table__.columns}
    log_entity_change(
        db, "meal_distribution", distribution_id,
        old_data=old_data,
        new_data=new_data,
        operator=operator, ip_address=ip_address, action="cancel"
    )
    
    return db_meal


def batch_create_meal_distributions(db: Session, menu_id: int,
                                     elder_ids: List[int] = None,
                                     route_id: int = None,
                                     operator: str = None, ip_address: str = None):
    menu = db.query(Menu).filter(Menu.id == menu_id).first()
    if not menu:
        raise ValueError(f"菜单 ID {menu_id} 不存在")
    
    if elder_ids:
        elders = db.query(Elder).filter(Elder.id.in_(elder_ids)).filter(
            Elder.status == ElderStatus.ACTIVE
        ).all()
    elif route_id is not None:
        elders = db.query(Elder).filter(Elder.route_id == route_id).filter(
            Elder.status == ElderStatus.ACTIVE
        ).all()
    else:
        elders = db.query(Elder).filter(Elder.status == ElderStatus.ACTIVE).all()
    
    results = {
        "success": 0,
        "failed": 0,
        "errors": [],
        "warnings": []
    }
    
    for elder in elders:
        try:
            meal = MealDistributionCreate(elder_id=elder.id, menu_id=menu_id)
            _, warnings = create_meal_distribution(db, meal, operator, ip_address, auto_check_conflict=True)
            results["success"] += 1
            if warnings:
                results["warnings"].extend([f"{elder.name}: {w}" for w in warnings])
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"{elder.name}: {str(e)}")
    
    return results


def get_daily_statistics(db: Session, report_date: date):
    from sqlalchemy import func
    
    query = db.query(
        MealDistribution.status,
        func.count(MealDistribution.id)
    ).join(Menu).filter(Menu.date == report_date).group_by(MealDistribution.status)
    
    stats = {
        MealStatus.PENDING: 0,
        MealStatus.CONFIRMED: 0,
        MealStatus.DELIVERED: 0,
        MealStatus.CANCELLED: 0
    }
    
    for status, count in query.all():
        stats[status] = count
    
    special_count = db.query(MealDistribution).join(Menu).filter(
        Menu.date == report_date,
        MealDistribution.special_requirements.isnot(None)
    ).count()
    
    return {
        "total": sum(stats.values()),
        "by_status": stats,
        "special_requirements_count": special_count
    }
