from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(Text)
    owner = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    status = Column(String, default="active")

    upstream_tasks = relationship("UpstreamTask", back_populates="dataset")
    downstream_reports = relationship("DownstreamReport", back_populates="dataset")
    field_mappings = relationship("FieldMapping", back_populates="dataset")
    change_impacts = relationship("ChangeImpact", back_populates="dataset")
    lineage_graph = relationship("LineageGraph", uselist=False, back_populates="dataset")


class UpstreamTask(Base):
    __tablename__ = "upstream_tasks"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    name = Column(String)
    task_type = Column(String)
    source_system = Column(String)
    schedule = Column(String)
    last_run_time = Column(DateTime)
    status = Column(String, default="pending")
    handler = Column(String)
    handled_at = Column(DateTime)
    handle_reason = Column(Text)
    is_failed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("Dataset", back_populates="upstream_tasks")


class DownstreamReport(Base):
    __tablename__ = "downstream_reports"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    name = Column(String)
    report_type = Column(String)
    target_audience = Column(String)
    refresh_frequency = Column(String)
    last_refresh_time = Column(DateTime)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("Dataset", back_populates="downstream_reports")


class FieldMapping(Base):
    __tablename__ = "field_mappings"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    source_field = Column(String)
    target_field = Column(String)
    mapping_rule = Column(Text)
    transformation_logic = Column(Text)
    is_manual_correction = Column(Boolean, default=False)
    corrected_by = Column(String)
    corrected_at = Column(DateTime)
    correction_reason = Column(Text)
    status = Column(String, default="valid")
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    dataset = relationship("Dataset", back_populates="field_mappings")


class ChangeImpact(Base):
    __tablename__ = "change_impacts"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    change_type = Column(String)
    change_description = Column(Text)
    impacted_fields = Column(JSON)
    impacted_reports = Column(JSON)
    severity = Column(String)
    status = Column(String, default="pending")
    handler = Column(String)
    handled_at = Column(DateTime)
    handle_reason = Column(Text)
    is_failed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    dataset = relationship("Dataset", back_populates="change_impacts")


class LineageGraph(Base):
    __tablename__ = "lineage_graphs"

    id = Column(Integer, primary_key=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"))
    nodes = Column(JSON)
    edges = Column(JSON)
    graph_data = Column(JSON)
    calculated_at = Column(DateTime, default=datetime.utcnow)
    version = Column(Integer, default=1)

    dataset = relationship("Dataset", back_populates="lineage_graph")
