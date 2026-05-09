from sqlalchemy.orm import Session
from typing import List, Optional
from models import Material, ReviewRule
from schemas import MaterialCreate, MaterialUpdate, ReviewRuleCreate, ReviewRuleUpdate


class MaterialService:
    @staticmethod
    def get_materials(db: Session, category: Optional[str] = None, keyword: Optional[str] = None) -> List[Material]:
        query = db.query(Material)
        if category:
            query = query.filter(Material.category == category)
        if keyword:
            query = query.filter(Material.name.like(f"%{keyword}%"))
        return query.order_by(Material.id.desc()).all()

    @staticmethod
    def get_material_by_id(db: Session, material_id: int) -> Optional[Material]:
        return db.query(Material).filter(Material.id == material_id).first()

    @staticmethod
    def get_material_by_code(db: Session, code: str) -> Optional[Material]:
        return db.query(Material).filter(Material.code == code).first()

    @staticmethod
    def create_material(db: Session, material_data: MaterialCreate) -> Material:
        material = Material(**material_data.model_dump())
        db.add(material)
        db.commit()
        db.refresh(material)
        return material

    @staticmethod
    def update_material(db: Session, material_id: int, update_data: MaterialUpdate) -> Optional[Material]:
        material = MaterialService.get_material_by_id(db, material_id)
        if not material:
            return None
        for key, value in update_data.model_dump(exclude_unset=True).items():
            setattr(material, key, value)
        db.commit()
        db.refresh(material)
        return material

    @staticmethod
    def delete_material(db: Session, material_id: int) -> bool:
        material = MaterialService.get_material_by_id(db, material_id)
        if not material:
            return False
        db.delete(material)
        db.commit()
        return True


class ReviewRuleService:
    @staticmethod
    def get_rules_by_material(db: Session, material_id: int, is_active: Optional[int] = None) -> List[ReviewRule]:
        query = db.query(ReviewRule).filter(ReviewRule.material_id == material_id)
        if is_active is not None:
            query = query.filter(ReviewRule.is_active == is_active)
        return query.order_by(ReviewRule.priority.desc()).all()

    @staticmethod
    def get_rule_by_id(db: Session, rule_id: int) -> Optional[ReviewRule]:
        return db.query(ReviewRule).filter(ReviewRule.id == rule_id).first()

    @staticmethod
    def create_rule(db: Session, rule_data: ReviewRuleCreate) -> ReviewRule:
        rule = ReviewRule(**rule_data.model_dump())
        db.add(rule)
        db.commit()
        db.refresh(rule)
        return rule

    @staticmethod
    def update_rule(db: Session, rule_id: int, update_data: ReviewRuleUpdate) -> Optional[ReviewRule]:
        rule = ReviewRuleService.get_rule_by_id(db, rule_id)
        if not rule:
            return None
        for key, value in update_data.model_dump(exclude_unset=True).items():
            setattr(rule, key, value)
        db.commit()
        db.refresh(rule)
        return rule

    @staticmethod
    def delete_rule(db: Session, rule_id: int) -> bool:
        rule = ReviewRuleService.get_rule_by_id(db, rule_id)
        if not rule:
            return False
        db.delete(rule)
        db.commit()
        return True
