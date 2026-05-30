from sqlalchemy import Column, String, Float, Integer, ForeignKey, Boolean
from sqlalchemy.orm import relationship

from .base import BaseModel
from .enums import FileType


class ModelFile(BaseModel):
    task_id = Column(Integer, ForeignKey("estimationtask.id"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(20), nullable=False, default=FileType.STL.value)
    file_size = Column(Integer)

    vertex_count = Column(Integer)
    face_count = Column(Integer)
    bounding_box_x = Column(Float)
    bounding_box_y = Column(Float)
    bounding_box_z = Column(Float)
    volume = Column(Float)
    surface_area = Column(Float)

    md5_hash = Column(String(32), index=True)
    uploaded_by = Column(String(100))
    is_processed = Column(Boolean, default=False)
    processing_notes = Column(String(500))

    task = relationship("EstimationTask", back_populates="model_files")
    analysis_results = relationship("MeshAnalysisResult", back_populates="model_file")
