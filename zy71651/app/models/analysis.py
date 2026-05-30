from sqlalchemy import Column, Integer, Float, ForeignKey, JSON, Boolean, Text
from sqlalchemy.orm import relationship

from .base import BaseModel


class MeshAnalysisResult(BaseModel):
    task_id = Column(Integer, ForeignKey("estimationtask.id"), nullable=False)
    model_file_id = Column(Integer, ForeignKey("modelfile.id"), nullable=False)
    params_version = Column(Integer, default=1)

    is_watertight = Column(Boolean)
    is_manifold = Column(Boolean)
    broken_face_count = Column(Integer, default=0)
    non_manifold_edges = Column(Integer, default=0)
    self_intersections = Column(Integer, default=0)
    duplicate_faces = Column(Integer, default=0)
    inverted_normals = Column(Integer, default=0)

    overhang_area = Column(Float)
    overhang_count = Column(Integer, default=0)
    min_support_angle = Column(Float)
    max_support_height = Column(Float)

    support_volume = Column(Float)
    support_contact_area = Column(Float)
    support_material_volume = Column(Float)

    total_volume = Column(Float)
    part_volume = Column(Float)
    bounding_box_volume = Column(Float)

    analysis_details = Column(JSON, default={})
    quality_score = Column(Float)
    processing_time_ms = Column(Integer)
    notes = Column(Text)

    task = relationship("EstimationTask", back_populates="analysis_results")
    model_file = relationship("ModelFile", back_populates="analysis_results")
