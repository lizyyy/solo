from sqlalchemy import Column, Integer, Float, ForeignKey, JSON, Boolean, Text, String
from sqlalchemy.orm import relationship

from .base import BaseModel


class SupportEstimation(BaseModel):
    task_id = Column(Integer, ForeignKey("estimationtask.id"), nullable=False)
    params_version = Column(Integer, nullable=False, default=1)
    material_id = Column(Integer, ForeignKey("material.id"))
    analysis_result_id = Column(Integer, ForeignKey("meshanalysisresult.id"))

    part_mass_g = Column(Float)
    part_volume_cm3 = Column(Float)

    support_mass_g = Column(Float)
    support_volume_cm3 = Column(Float)
    support_material_ratio = Column(Float)

    total_mass_g = Column(Float)
    total_volume_cm3 = Column(Float)

    filament_length_m = Column(Float)
    filament_cost_estimate = Column(Float)

    print_time_hours = Column(Float)
    print_time_minutes = Column(Float)
    time_breakdown = Column(JSON, default={})

    layer_count = Column(Integer)
    total_lines = Column(Integer)

    time_correction_factor = Column(Float, default=1.0)
    is_time_underestimated = Column(Boolean, default=False)

    calculation_details = Column(JSON, default={})
    confidence_score = Column(Float)
    notes = Column(Text)

    task = relationship("EstimationTask", back_populates="estimations")
    material = relationship("Material", back_populates="estimations")
    analysis_result = relationship("MeshAnalysisResult")


class Anomaly(BaseModel):
    task_id = Column(Integer, ForeignKey("estimationtask.id"), nullable=False)
    anomaly_type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False)

    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    suggestion = Column(Text)
    location = Column(String(200))

    affected_value = Column(Float)
    expected_range = Column(String(100))
    data_source = Column(String(100))

    params_version = Column(Integer)
    analysis_result_id = Column(Integer, ForeignKey("meshanalysisresult.id"))
    estimation_id = Column(Integer, ForeignKey("supportestimation.id"))

    is_resolved = Column(Boolean, default=False)
    resolution_notes = Column(Text)
    meta_data = Column(JSON, default={})

    task = relationship("EstimationTask", back_populates="anomalies")
    analysis_result = relationship("MeshAnalysisResult")
    estimation = relationship("SupportEstimation")
