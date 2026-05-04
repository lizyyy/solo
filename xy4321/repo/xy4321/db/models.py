from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship, DeclarativeBase
from datetime import datetime


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    folder_path = Column(String(512), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    episodes = relationship("Episode", back_populates="project", cascade="all, delete-orphan")
    audio_files = relationship("AudioFile", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("TaskQueue", back_populates="project", cascade="all, delete-orphan")
    task_history = relationship("TaskHistory", back_populates="project", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}')>"


class Episode(Base):
    __tablename__ = "episodes"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    episode_number = Column(String(50), nullable=False)
    title = Column(String(255))
    status = Column(String(50), default="未开始")
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    project = relationship("Project", back_populates="episodes")
    audio_files = relationship("AudioFile", back_populates="episode", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Episode(id={self.id}, episode_number='{self.episode_number}')>"


class AudioFile(Base):
    __tablename__ = "audio_files"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    episode_id = Column(Integer, ForeignKey("episodes.id"))
    file_path = Column(String(512), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_size = Column(Integer)
    duration_seconds = Column(Float)
    format = Column(String(20))
    sample_rate = Column(Integer)
    channels = Column(Integer)
    bit_rate = Column(Integer)
    bit_depth = Column(Integer)
    
    role = Column(String(50))
    recording_quality = Column(String(50))
    editing_status = Column(String(50), default="未剪辑")
    delivery_version = Column(String(50))
    
    hash_value = Column(String(64))
    scan_time = Column(DateTime, default=datetime.now)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    project = relationship("Project", back_populates="audio_files")
    episode = relationship("Episode", back_populates="audio_files")
    issues = relationship("ValidationIssue", back_populates="audio_file", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<AudioFile(id={self.id}, file_name='{self.file_name}')>"


class ValidationIssue(Base):
    __tablename__ = "validation_issues"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    audio_file_id = Column(Integer, ForeignKey("audio_files.id"), nullable=False)
    issue_type = Column(String(100), nullable=False)
    severity = Column(String(20), default="warning")
    description = Column(Text)
    detected_at = Column(DateTime, default=datetime.now)
    resolved = Column(Boolean, default=False)
    resolved_at = Column(DateTime)
    
    audio_file = relationship("AudioFile", back_populates="issues")
    
    def __repr__(self):
        return f"<ValidationIssue(id={self.id}, issue_type='{self.issue_type}')>"


class TaskQueue(Base):
    __tablename__ = "task_queue"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    audio_file_id = Column(Integer, ForeignKey("audio_files.id"))
    task_type = Column(String(50), nullable=False)
    status = Column(String(50), default="pending")
    priority = Column(Integer, default=0)
    parameters = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    
    project = relationship("Project", back_populates="tasks")
    
    def __repr__(self):
        return f"<TaskQueue(id={self.id}, task_type='{self.task_type}')>"


class TaskHistory(Base):
    __tablename__ = "task_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    task_type = Column(String(50), nullable=False)
    source_file = Column(String(512))
    target_file = Column(String(512))
    status = Column(String(50))
    duration_seconds = Column(Float)
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    
    project = relationship("Project", back_populates="task_history")
    
    def __repr__(self):
        return f"<TaskHistory(id={self.id}, task_type='{self.task_type}')>"
