from sqlalchemy.orm import Session
from app.models.models import Menu
from app.schemas.schemas import MenuCreate, MenuUpdate
from app.services.audit_service import log_entity_change
from datetime import date
from typing import Optional


def get_menu(db: Session, menu_id: int):
    return db.query(Menu).filter(Menu.id == menu_id).first()


def get_menus(db: Session, skip: int = 0, limit: int = 100,
              menu_date: Optional[date] = None, meal_type: Optional[str] = None,
              route_id: Optional[int] = None):
    query = db.query(Menu)
    if menu_date:
        query = query.filter(Menu.date == menu_date)
    if meal_type:
        query = query.filter(Menu.meal_type == meal_type)
    if route_id is not None:
        query = query.filter(Menu.route_id == route_id)
    return query.order_by(Menu.date.desc(), Menu.meal_type).offset(skip).limit(limit).all()


def create_menu(db: Session, menu: MenuCreate, operator: str = None, ip_address: str = None):
    db_menu = Menu(**menu.model_dump())
    db.add(db_menu)
    db.commit()
    db.refresh(db_menu)
    
    log_entity_change(
        db, "menu", db_menu.id,
        old_data={},
        new_data=menu.model_dump(mode='json'),
        operator=operator, ip_address=ip_address, action="create"
    )
    
    return db_menu


def update_menu(db: Session, menu_id: int, menu: MenuUpdate, operator: str = None, ip_address: str = None):
    db_menu = get_menu(db, menu_id)
    if not db_menu:
        raise ValueError(f"菜单 ID {menu_id} 不存在")
    
    old_data = {c.name: getattr(db_menu, c.name) for c in db_menu.__table__.columns}
    
    update_data = menu.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_menu, key, value)
    
    db.commit()
    db.refresh(db_menu)
    
    new_data = {**old_data, **update_data}
    log_entity_change(
        db, "menu", menu_id,
        old_data=old_data,
        new_data=new_data,
        operator=operator, ip_address=ip_address, action="update"
    )
    
    return db_menu


def delete_menu(db: Session, menu_id: int, operator: str = None, ip_address: str = None):
    db_menu = get_menu(db, menu_id)
    if not db_menu:
        raise ValueError(f"菜单 ID {menu_id} 不存在")
    
    old_data = {c.name: getattr(db_menu, c.name) for c in db_menu.__table__.columns}
    
    db.delete(db_menu)
    db.commit()
    
    log_entity_change(
        db, "menu", menu_id,
        old_data=old_data,
        new_data={},
        operator=operator, ip_address=ip_address, action="delete"
    )
    
    return True


def check_dietary_conflict(menu: Menu, dietary_restrictions: str) -> tuple[bool, list]:
    if not dietary_restrictions:
        return True, []
    
    restrictions = [r.strip() for r in dietary_restrictions.split(',')]
    conflicts = []
    
    menu_items = [
        menu.main_dish,
        menu.side_dish1,
        menu.side_dish2,
        menu.soup,
        menu.staple
    ]
    
    for item in menu_items:
        if item:
            for restriction in restrictions:
                if restriction and restriction in item:
                    conflicts.append(f"菜品 '{item}' 包含忌口食材 '{restriction}'")
    
    return len(conflicts) == 0, conflicts
