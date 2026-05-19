import enum
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Text, Boolean, ForeignKey, Index
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()


class DonationStatus(enum.Enum):
    PENDING = "pending"
    IMPORTED = "imported"
    DEDUPLICATED = "deduplicated"
    GRADED = "graded"
    REVIEWED = "reviewed"
    SHELVED = "shelved"
    REJECTED = "rejected"


class ExceptionType(enum.Enum):
    NONE = "none"
    INVALID_ISBN = "invalid_isbn"
    DUPLICATE = "duplicate"
    UNKNOWN_GRADE = "unknown_grade"
    UNKNOWN_CONDITION = "unknown_condition"
    MISSING_FIELD = "missing_field"
    PARSE_ERROR = "parse_error"


class ConditionLevel(enum.Enum):
    NEW = "new"
    LIKE_NEW = "like_new"
    GOOD = "good"
    ACCEPTABLE = "acceptable"
    POOR = "poor"
    UNUSABLE = "unusable"


class BookDonation(Base):
    __tablename__ = "book_donations"

    id = Column(Integer, primary_key=True)
    batch_id = Column(String(64), nullable=False, index=True)
    isbn_raw = Column(String(32), nullable=False)
    isbn_standard = Column(String(13), index=True)
    title_raw = Column(String(255))
    title_standard = Column(String(255))
    author = Column(String(255))
    publisher = Column(String(255))
    grade_raw = Column(String(64))
    grade_standard = Column(String(32), index=True)
    condition_raw = Column(String(64))
    condition_standard = Column(String(32))
    condition_score = Column(Integer)
    donor_name = Column(String(128))
    volunteer = Column(String(128), nullable=False, index=True)
    status = Column(String(32), nullable=False, index=True)
    exception_type = Column(String(32), default=ExceptionType.NONE.value, index=True)
    exception_detail = Column(Text)
    is_duplicate = Column(Boolean, default=False)
    duplicate_of = Column(Integer, ForeignKey("book_donations.id"))
    import_time = Column(DateTime, default=datetime.utcnow, index=True)
    update_time = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    shelf_code = Column(String(64), index=True)
    notes = Column(Text)
    idempotency_key = Column(String(128), unique=True, index=True)

    duplicate_source = relationship("BookDonation", remote_side=[id])

    __table_args__ = (
        Index("idx_volunteer_time", "volunteer", "import_time"),
        Index("idx_status_exception", "status", "exception_type"),
    )


class ISBNInfo(Base):
    __tablename__ = "isbn_info"

    id = Column(Integer, primary_key=True)
    isbn = Column(String(13), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    author = Column(String(255))
    publisher = Column(String(255))
    publish_date = Column(String(32))
    suggested_grades = Column(String(128))
    category = Column(String(64))
    create_time = Column(DateTime, default=datetime.utcnow)
    update_time = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class GradeLabel(Base):
    __tablename__ = "grade_labels"

    id = Column(Integer, primary_key=True)
    raw_label = Column(String(64), unique=True, nullable=False, index=True)
    standard_grade = Column(String(32), nullable=False, index=True)
    grade_order = Column(Integer, nullable=False)
    description = Column(String(255))


class ConditionRule(Base):
    __tablename__ = "condition_rules"

    id = Column(Integer, primary_key=True)
    raw_description = Column(String(64), unique=True, nullable=False, index=True)
    standard_condition = Column(String(32), nullable=False)
    condition_score = Column(Integer, nullable=False)
    min_score = Column(Integer, nullable=False)
    max_score = Column(Integer, nullable=False)
    can_shelf = Column(Boolean, default=True)


class ShelfList(Base):
    __tablename__ = "shelf_lists"

    id = Column(Integer, primary_key=True)
    list_id = Column(String(64), unique=True, nullable=False, index=True)
    batch_id = Column(String(64), nullable=False, index=True)
    generated_by = Column(String(128), nullable=False)
    generate_time = Column(DateTime, default=datetime.utcnow, index=True)
    total_books = Column(Integer, nullable=False)
    shelf_code = Column(String(64))
    status = Column(String(32), default="generated")
    notes = Column(Text)


class ShelfListItem(Base):
    __tablename__ = "shelf_list_items"

    id = Column(Integer, primary_key=True)
    shelf_list_id = Column(Integer, ForeignKey("shelf_lists.id"), nullable=False)
    donation_id = Column(Integer, ForeignKey("book_donations.id"), nullable=False)
    sort_order = Column(Integer, nullable=False)
    shelf_code = Column(String(64))

    shelf_list = relationship("ShelfList", backref="items")
    donation = relationship("BookDonation")


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True)
    operation_type = Column(String(64), nullable=False, index=True)
    batch_id = Column(String(64), index=True)
    operator = Column(String(128), nullable=False)
    operation_time = Column(DateTime, default=datetime.utcnow, index=True)
    success_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    total_count = Column(Integer, default=0)
    details = Column(Text)
    idempotency_key = Column(String(128), index=True)
