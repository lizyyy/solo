from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from .base import BaseModel


class Dependency(BaseModel):
    __tablename__ = "dependencies"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("data_templates.id"), nullable=False)
    depends_on_template_id = Column(Integer, ForeignKey("data_templates.id"), nullable=False)
    dependency_type = Column(String(50), default="hard")
    order = Column(Integer, default=0)
    
    template = relationship("DataTemplate", foreign_keys=[template_id])
    depends_on_template = relationship("DataTemplate", foreign_keys=[depends_on_template_id])
