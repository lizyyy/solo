from sqlalchemy import Column, String, Float, Boolean
from sqlalchemy.orm import relationship

from .base import BaseModel
from .enums import MaterialType


class Material(BaseModel):
    material_type = Column(String(20), nullable=False, default=MaterialType.PLA.value)
    name = Column(String(100), nullable=False)
    density = Column(Float, nullable=False)
    filament_diameter = Column(Float, nullable=False, default=1.75)
    color = Column(String(50))
    supplier = Column(String(100))
    is_active = Column(Boolean, default=True)
    notes = Column(String(500))

    params_versions = relationship("SliceParamsVersion", back_populates="material")
    estimations = relationship("SupportEstimation", back_populates="material")
