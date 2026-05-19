from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from .database import Base


class BatchStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class ChunkStrategy(Base):
    __tablename__ = "chunk_strategies"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    chunk_size = Column(Integer, default=512)
    chunk_overlap = Column(Integer, default=50)
    separator = Column(String, default="\n\n")
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batches = relationship("DocumentBatch", back_populates="chunk_strategy")


class DocumentBatch(Base):
    __tablename__ = "document_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_name = Column(String, index=True, nullable=False)
    source_type = Column(String, index=True)
    total_documents = Column(Integer, default=0)
    total_chunks = Column(Integer, default=0)
    status = Column(Enum(BatchStatus), default=BatchStatus.PENDING)
    progress = Column(Float, default=0.0)
    strategy_id = Column(Integer, ForeignKey("chunk_strategies.id"))
    metadata_ = Column("metadata", Text)
    error_message = Column(Text)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    chunk_strategy = relationship("ChunkStrategy", back_populates="batches")
    tasks = relationship("VectorTask", back_populates="batch", cascade="all, delete-orphan")
    failed_chunks = relationship("FailedChunk", back_populates="batch", cascade="all, delete-orphan")
    index_results = relationship("IndexResult", back_populates="batch", cascade="all, delete-orphan")
    retry_queue = relationship("RetryQueue", back_populates="batch", cascade="all, delete-orphan")

    @property
    def metadata_dict(self):
        import json
        if self.metadata_:
            try:
                return json.loads(self.metadata_)
            except json.JSONDecodeError:
                return None
        return None


class VectorTask(Base):
    __tablename__ = "vector_tasks"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("document_batches.id"), nullable=False)
    document_id = Column(String, index=True)
    chunk_index = Column(Integer)
    chunk_text = Column(Text)
    embedding_model = Column(String)
    vector_dimension = Column(Integer)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING)
    retry_count = Column(Integer, default=0)
    max_retries = Column(Integer, default=3)
    error_message = Column(Text)
    processing_started_at = Column(DateTime(timezone=True))
    processing_completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    batch = relationship("DocumentBatch", back_populates="tasks")
    index_result = relationship("IndexResult", back_populates="task", uselist=False)


class FailedChunk(Base):
    __tablename__ = "failed_chunks"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("document_batches.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("vector_tasks.id"), nullable=False)
    document_id = Column(String, index=True)
    chunk_index = Column(Integer)
    chunk_text = Column(Text)
    error_type = Column(String)
    error_message = Column(Text)
    error_traceback = Column(Text)
    failed_at = Column(DateTime(timezone=True), server_default=func.now())
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime(timezone=True))

    batch = relationship("DocumentBatch", back_populates="failed_chunks")


class RetryQueue(Base):
    __tablename__ = "retry_queue"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("document_batches.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("vector_tasks.id"), nullable=False)
    failed_chunk_id = Column(Integer, ForeignKey("failed_chunks.id"))
    priority = Column(Integer, default=0)
    retry_after = Column(DateTime(timezone=True))
    retry_count = Column(Integer, default=0)
    status = Column(String, default="pending")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    batch = relationship("DocumentBatch", back_populates="retry_queue")


class IndexResult(Base):
    __tablename__ = "index_results"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("document_batches.id"), nullable=False)
    task_id = Column(Integer, ForeignKey("vector_tasks.id"), nullable=False)
    document_id = Column(String, index=True)
    chunk_index = Column(Integer)
    vector_id = Column(String, unique=True, index=True)
    vector_checksum = Column(String)
    indexed_at = Column(DateTime(timezone=True), server_default=func.now())
    verified = Column(Boolean, default=False)
    verified_at = Column(DateTime(timezone=True))
    verification_error = Column(Text)

    batch = relationship("DocumentBatch", back_populates="index_results")
    task = relationship("VectorTask", back_populates="index_result")
