from sqlalchemy import Column, String, Float, Integer, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship

from .base import BaseModel


class SliceParamsVersion(BaseModel):
    task_id = Column(Integer, ForeignKey("estimationtask.id"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    material_id = Column(Integer, ForeignKey("material.id"))

    layer_height = Column(Float)
    nozzle_diameter = Column(Float)
    print_speed = Column(Float)
    infill_density = Column(Float)
    infill_pattern = Column(String(50))
    wall_thickness = Column(Float)
    top_bottom_layers = Column(Integer)

    support_enabled = Column(Boolean, default=True)
    support_type = Column(String(50))
    support_density = Column(Float)
    support_angle = Column(Float)

    bed_temperature = Column(Float)
    nozzle_temperature = Column(Float)
    cooling_enabled = Column(Boolean, default=True)

    extra_params = Column(JSON, default={})
    source = Column(String(50))
    notes = Column(String(500))

    task = relationship("EstimationTask", back_populates="params_versions")
    material = relationship("Material", back_populates="params_versions")
