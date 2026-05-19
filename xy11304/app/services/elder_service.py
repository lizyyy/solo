from sqlalchemy.orm import Session
from app.models.models import Elder, ElderStatus
from app.schemas.schemas import ElderCreate, ElderUpdate, ElderSafe
from app.services.audit_service import log_entity_change
from typing import List, Optional
import json


def get_elder(db: Session, elder_id: int):
    return db.query(Elder).filter(Elder.id == elder_id).first()


def get_elder_by_id_card(db: Session, id_card: str):
    return db.query(Elder).filter(Elder.id_card == id_card).first()


def get_elders(db: Session, skip: int = 0, limit: int = 100, status: Optional[ElderStatus] = None,
               route_id: Optional[int] = None):
    query = db.query(Elder)
    if status:
        query = query.filter(Elder.status == status)
    if route_id:
        query = query.filter(Elder.route_id == route_id)
    return query.order_by(Elder.name).offset(skip).limit(limit).all()


def create_elder(db: Session, elder: ElderCreate, operator: str = None, ip_address: str = None):
    if elder.id_card and get_elder_by_id_card(db, elder.id_card):
        raise ValueError(f"身份证号 {elder.id_card} 已存在")
    
    db_elder = Elder(**elder.model_dump())
    db.add(db_elder)
    db.commit()
    db.refresh(db_elder)
    
    log_entity_change(
        db, "elder", db_elder.id,
        old_data={},
        new_data=elder.model_dump(mode='json'),
        operator=operator, ip_address=ip_address, action="create"
    )
    
    return db_elder


def update_elder(db: Session, elder_id: int, elder: ElderUpdate, operator: str = None, ip_address: str = None):
    db_elder = get_elder(db, elder_id)
    if not db_elder:
        raise ValueError(f"老人 ID {elder_id} 不存在")
    
    old_data = {c.name: getattr(db_elder, c.name) for c in db_elder.__table__.columns}
    
    if elder.id_card and elder.id_card != db_elder.id_card:
        existing = get_elder_by_id_card(db, elder.id_card)
        if existing and existing.id != elder_id:
            raise ValueError(f"身份证号 {elder.id_card} 已被其他用户使用")
    
    update_data = elder.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_elder, key, value)
    
    db.commit()
    db.refresh(db_elder)
    
    new_data = {**old_data, **update_data}
    log_entity_change(
        db, "elder", elder_id,
        old_data=old_data,
        new_data=new_data,
        operator=operator, ip_address=ip_address, action="update"
    )
    
    return db_elder


def delete_elder(db: Session, elder_id: int, operator: str = None, ip_address: str = None):
    db_elder = get_elder(db, elder_id)
    if not db_elder:
        raise ValueError(f"老人 ID {elder_id} 不存在")
    
    old_data = {c.name: getattr(db_elder, c.name) for c in db_elder.__table__.columns}
    
    db_elder.status = ElderStatus.INACTIVE
    db.commit()
    
    log_entity_change(
        db, "elder", elder_id,
        old_data=old_data,
        new_data={**old_data, "status": ElderStatus.INACTIVE},
        operator=operator, ip_address=ip_address, action="delete"
    )
    
    return db_elder


def get_elders_with_dietary_restrictions(db: Session):
    return db.query(Elder).filter(Elder.dietary_restrictions.isnot(None)).filter(
        Elder.dietary_restrictions != ''
    ).all()


def elder_to_safe(elder: Elder) -> ElderSafe:
    return ElderSafe.model_validate(elder)


def elders_to_safe(elders: List[Elder]) -> List[ElderSafe]:
    return [elder_to_safe(elder) for elder in elders]
