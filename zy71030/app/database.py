from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey, Boolean, Enum as SAEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import enum

SQLALCHEMY_DATABASE_URL = "sqlite:///./pathology.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class SecondReadStatus(str, enum.Enum):
    PENDING = "pending"
    FIRST_READ = "first_read"
    SECOND_READ_IN_PROGRESS = "second_read_in_progress"
    SECOND_READ_COMPLETED = "second_read_completed"
    REVISED = "revised"
    REPORTED = "reported"
    CANCELLED = "cancelled"


class BorrowStatus(str, enum.Enum):
    BORROWED = "borrowed"
    RETURNED = "returned"
    OVERDUE = "overdue"


class Slide(Base):
    __tablename__ = "slides"

    id = Column(Integer, primary_key=True, index=True)
    slide_number = Column(String, unique=True, index=True)
    patient_id = Column(String, index=True)
    patient_name = Column(String)
    specimen_type = Column(String)
    collection_date = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    second_reads = relationship("SecondRead", back_populates="slide")
    borrow_records = relationship("BorrowRecord", back_populates="slide")
    opinion_versions = relationship("OpinionVersion", back_populates="slide")


class SecondRead(Base):
    __tablename__ = "second_reads"

    id = Column(Integer, primary_key=True, index=True)
    slide_id = Column(Integer, ForeignKey("slides.id"))
    first_read_doctor = Column(String)
    first_read_opinion = Column(Text)
    first_read_date = Column(DateTime)
    second_read_doctor = Column(String)
    second_read_opinion = Column(Text)
    second_read_date = Column(DateTime)
    revision_opinion = Column(Text)
    revision_date = Column(DateTime)
    status = Column(SAEnum(SecondReadStatus), default=SecondReadStatus.PENDING)
    is_report_issued = Column(Boolean, default=False)
    report_issued_date = Column(DateTime)
    deadline = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    slide = relationship("Slide", back_populates="second_reads")
    review_records = relationship("ReviewRecord", back_populates="second_read")


class BorrowRecord(Base):
    __tablename__ = "borrow_records"

    id = Column(Integer, primary_key=True, index=True)
    slide_id = Column(Integer, ForeignKey("slides.id"))
    borrower = Column(String)
    borrower_department = Column(String)
    borrow_date = Column(DateTime)
    due_date = Column(DateTime)
    return_date = Column(DateTime)
    status = Column(SAEnum(BorrowStatus), default=BorrowStatus.BORROWED)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    slide = relationship("Slide", back_populates="borrow_records")


class OpinionVersion(Base):
    __tablename__ = "opinion_versions"

    id = Column(Integer, primary_key=True, index=True)
    slide_id = Column(Integer, ForeignKey("slides.id"))
    version_number = Column(Integer)
    doctor = Column(String)
    opinion = Column(Text)
    opinion_type = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    slide = relationship("Slide", back_populates="opinion_versions")


class ReviewRecord(Base):
    __tablename__ = "review_records"

    id = Column(Integer, primary_key=True, index=True)
    second_read_id = Column(Integer, ForeignKey("second_reads.id"))
    reviewer = Column(String)
    review_opinion = Column(Text)
    review_date = Column(DateTime, default=datetime.utcnow)
    is_approved = Column(Boolean, default=False)

    second_read = relationship("SecondRead", back_populates="review_records")


class ImportRecord(Base):
    __tablename__ = "import_records"

    id = Column(Integer, primary_key=True, index=True)
    slide_number = Column(String)
    import_hash = Column(String, unique=True)
    import_date = Column(DateTime, default=datetime.utcnow)
    import_status = Column(String)
    message = Column(Text)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
