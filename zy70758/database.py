from sqlalchemy import create_engine, Column, String, Integer, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./k8s_timeline.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class DeploymentRelease(Base):
    __tablename__ = "deployment_releases"

    id = Column(Integer, primary_key=True, index=True)
    namespace = Column(String, index=True)
    deployment_name = Column(String, index=True)
    release_time = Column(DateTime, default=datetime.utcnow)
    status = Column(String)  # pending, processing, completed, failed_manual_review, already_processed
    old_image = Column(String)
    new_image = Column(String)
    result = Column(String)  # success, failed, partial
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    events = relationship("K8sEvent", back_populates="release")
    pods = relationship("PodStatus", back_populates="release")
    timeline_report = relationship("TimelineReport", back_populates="release", uselist=False)


class K8sEvent(Base):
    __tablename__ = "k8s_events"

    id = Column(Integer, primary_key=True, index=True)
    release_id = Column(Integer, ForeignKey("deployment_releases.id"))
    event_time = Column(DateTime)
    type = Column(String)  # Normal, Warning, Error
    reason = Column(String)
    message = Column(Text)
    involved_object_kind = Column(String)
    involved_object_name = Column(String)
    source_component = Column(String)
    count = Column(Integer, default=1)

    release = relationship("DeploymentRelease", back_populates="events")


class PodStatus(Base):
    __tablename__ = "pod_statuses"

    id = Column(Integer, primary_key=True, index=True)
    release_id = Column(Integer, ForeignKey("deployment_releases.id"))
    pod_name = Column(String)
    namespace = Column(String)
    phase = Column(String)
    ready = Column(String)
    status = Column(String)
    restarts = Column(Integer)
    age = Column(String)
    image = Column(String)
    node = Column(String)
    start_time = Column(DateTime)

    release = relationship("DeploymentRelease", back_populates="pods")
    containers = relationship("ContainerStatus", back_populates="pod")


class ContainerStatus(Base):
    __tablename__ = "container_statuses"

    id = Column(Integer, primary_key=True, index=True)
    pod_id = Column(Integer, ForeignKey("pod_statuses.id"))
    name = Column(String)
    ready = Column(Boolean)
    state = Column(String)
    image = Column(String)
    restart_count = Column(Integer)
    reason = Column(String)
    message = Column(Text)

    pod = relationship("PodStatus", back_populates="containers")


class TimelineReport(Base):
    __tablename__ = "timeline_reports"

    id = Column(Integer, primary_key=True, index=True)
    release_id = Column(Integer, ForeignKey("deployment_releases.id"))
    markdown_content = Column(Text)
    root_cause = Column(String)
    confidence = Column(String)  # high, medium, low
    suggested_actions = Column(Text)
    generated_at = Column(DateTime, default=datetime.utcnow)

    release = relationship("DeploymentRelease", back_populates="timeline_report")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
