from sqlalchemy.orm import Session
from app.models.models import DeliveryRoute
from app.schemas.schemas import DeliveryRouteCreate, DeliveryRouteUpdate
from app.services.audit_service import log_entity_change


def get_route(db: Session, route_id: int):
    return db.query(DeliveryRoute).filter(DeliveryRoute.id == route_id).first()


def get_route_by_name(db: Session, name: str):
    return db.query(DeliveryRoute).filter(DeliveryRoute.name == name).first()


def get_routes(db: Session, skip: int = 0, limit: int = 100, is_active: bool = None):
    query = db.query(DeliveryRoute)
    if is_active is not None:
        query = query.filter(DeliveryRoute.is_active == is_active)
    return query.order_by(DeliveryRoute.sequence, DeliveryRoute.name).offset(skip).limit(limit).all()


def create_route(db: Session, route: DeliveryRouteCreate, operator: str = None, ip_address: str = None):
    if get_route_by_name(db, route.name):
        raise ValueError(f"路线名称 '{route.name}' 已存在")
    
    db_route = DeliveryRoute(**route.model_dump())
    db.add(db_route)
    db.commit()
    db.refresh(db_route)
    
    log_entity_change(
        db, "route", db_route.id,
        old_data={},
        new_data=route.model_dump(mode='json'),
        operator=operator, ip_address=ip_address, action="create"
    )
    
    return db_route


def update_route(db: Session, route_id: int, route: DeliveryRouteUpdate, operator: str = None, ip_address: str = None):
    db_route = get_route(db, route_id)
    if not db_route:
        raise ValueError(f"路线 ID {route_id} 不存在")
    
    old_data = {c.name: getattr(db_route, c.name) for c in db_route.__table__.columns}
    
    if route.name != db_route.name:
        existing = get_route_by_name(db, route.name)
        if existing and existing.id != route_id:
            raise ValueError(f"路线名称 '{route.name}' 已存在")
    
    update_data = route.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_route, key, value)
    
    db.commit()
    db.refresh(db_route)
    
    new_data = {**old_data, **update_data}
    log_entity_change(
        db, "route", route_id,
        old_data=old_data,
        new_data=new_data,
        operator=operator, ip_address=ip_address, action="update"
    )
    
    return db_route


def delete_route(db: Session, route_id: int, operator: str = None, ip_address: str = None):
    db_route = get_route(db, route_id)
    if not db_route:
        raise ValueError(f"路线 ID {route_id} 不存在")
    
    old_data = {c.name: getattr(db_route, c.name) for c in db_route.__table__.columns}
    
    db_route.is_active = False
    db.commit()
    
    log_entity_change(
        db, "route", route_id,
        old_data=old_data,
        new_data={**old_data, "is_active": False},
        operator=operator, ip_address=ip_address, action="delete"
    )
    
    return db_route
