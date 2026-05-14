from sqlalchemy import Column, Integer, String, Text, JSON, Boolean
from .base import BaseModel


class DataTemplate(BaseModel):
    __tablename__ = "data_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    template_type = Column(String(50), nullable=False)
    sql_template = Column(Text, nullable=False)
    parameters = Column(JSON, default=list)
    dependencies = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    version = Column(String(20), default="1.0")
