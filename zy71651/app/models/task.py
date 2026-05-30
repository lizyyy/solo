from sqlalchemy import Column, String, Integer, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship

from .base import BaseModel
from .enums import TaskStatus


class EstimationTask(BaseModel):
    student_id = Column(Integer, ForeignKey("student.id"))
    project_name = Column(String(200), nullable=False)
    description = Column(Text)

    status = Column(String(30), nullable=False, default=TaskStatus.CREATED.value)
    current_params_version = Column(Integer, default=1)
    active_estimation_id = Column(Integer)

    tags = Column(JSON, default=[])
    config = Column(JSON, default={})
    notes = Column(Text)

    student = relationship("Student", back_populates="tasks")
    model_files = relationship("ModelFile", back_populates="task", order_by="ModelFile.created_at")
    params_versions = relationship("SliceParamsVersion", back_populates="task", order_by="SliceParamsVersion.version.desc()")
    status_logs = relationship("TaskStatusLog", back_populates="task", order_by="TaskStatusLog.created_at")
    analysis_results = relationship("MeshAnalysisResult", back_populates="task", order_by="MeshAnalysisResult.created_at")
    estimations = relationship("SupportEstimation", back_populates="task", order_by="SupportEstimation.created_at")
    anomalies = relationship("Anomaly", back_populates="task", order_by="Anomaly.created_at")
    reports = relationship("EstimationReport", back_populates="task", order_by="EstimationReport.created_at")


class TaskStatusLog(BaseModel):
    task_id = Column(Integer, ForeignKey("estimationtask.id"), nullable=False)
    previous_status = Column(String(30))
    new_status = Column(String(30), nullable=False)
    message = Column(String(500))
    triggered_by = Column(String(100))
    meta_data = Column(JSON, default={})

    task = relationship("EstimationTask", back_populates="status_logs")
