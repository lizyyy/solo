from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from string import Template

from ..models.data_template import DataTemplate
from ..schemas.data_template import DataTemplateCreate, DataTemplateUpdate


class TemplateService:
    @staticmethod
    def get_template(db: Session, template_id: int) -> Optional[DataTemplate]:
        return db.query(DataTemplate).filter(DataTemplate.id == template_id).first()
    
    @staticmethod
    def list_templates(db: Session, skip: int = 0, limit: int = 100, is_active: Optional[bool] = None) -> List[DataTemplate]:
        query = db.query(DataTemplate)
        if is_active is not None:
            query = query.filter(DataTemplate.is_active == is_active)
        return query.offset(skip).limit(limit).all()
    
    @staticmethod
    def create_template(db: Session, template_create: DataTemplateCreate) -> DataTemplate:
        template = DataTemplate(**template_create.model_dump())
        db.add(template)
        db.commit()
        db.refresh(template)
        return template
    
    @staticmethod
    def update_template(db: Session, template_id: int, template_update: DataTemplateUpdate) -> Optional[DataTemplate]:
        template = TemplateService.get_template(db, template_id)
        if not template:
            return None
        update_data = template_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(template, key, value)
        db.commit()
        db.refresh(template)
        return template
    
    @staticmethod
    def delete_template(db: Session, template_id: int) -> bool:
        template = TemplateService.get_template(db, template_id)
        if not template:
            return False
        db.delete(template)
        db.commit()
        return True
    
    @staticmethod
    def render_template(template: DataTemplate, parameters: Dict[str, Any]) -> str:
        sql = template.sql_template
        for key, value in parameters.items():
            sql = sql.replace("{{" + key + "}}", str(value))
        return sql
    
    @staticmethod
    def validate_parameters(template: DataTemplate, parameters: Dict[str, Any]) -> tuple[bool, List[str]]:
        errors = []
        template_params = template.parameters or []
        required_params = [p for p in template_params if p.get("required", False)]
        for param in required_params:
            param_name = param.get("name")
            if param_name not in parameters:
                errors.append(f"Missing required parameter: {param_name}")
        return len(errors) == 0, errors
