from sqlalchemy import Column, Integer, String, DateTime, Text, Enum, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class BookCondition(str, enum.Enum):
    NEW = "全新"
    LIKE_NEW = "九成新"
    GOOD = "八成新"
    FAIR = "七成新"
    POOR = "有破损"
    UNKNOWN = "未标注"


class BookStatus(str, enum.Enum):
    PENDING = "待入库"
    INSPECTING = "校验中"
    APPROVED = "已入库"
    REJECTED = "已驳回"
    ARCHIVED = "已归档"
    EXCEPTION = "异常"


class GradeLevel(str, enum.Enum):
    PRE_SCHOOL = "学前"
    GRADE_1 = "一年级"
    GRADE_2 = "二年级"
    GRADE_3 = "三年级"
    GRADE_4 = "四年级"
    GRADE_5 = "五年级"
    GRADE_6 = "六年级"
    JUNIOR_HIGH_1 = "初一"
    JUNIOR_HIGH_2 = "初二"
    JUNIOR_HIGH_3 = "初三"
    SENIOR_HIGH_1 = "高一"
    SENIOR_HIGH_2 = "高二"
    SENIOR_HIGH_3 = "高三"
    ADULT = "成人"
    UNKNOWN = "未分类"


class ExceptionType(str, enum.Enum):
    INVALID_ISBN = "ISBN格式错误"
    INVALID_CONDITION = "品相标注错误"
    INVALID_GRADE = "年级标签错误"
    DUPLICATE_BOOK = "重复书籍"
    MISSING_INFO = "信息缺失"
    IMPORT_ERROR = "导入错误"
    OTHER = "其他异常"


class ImportSource(str, enum.Enum):
    CSV_SCAN = "扫码CSV"
    MARKDOWN_NOTE = "人工备注Markdown"
    MANUAL = "人工录入"


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    isbn = Column(String(20), index=True)
    title = Column(String(200))
    author = Column(String(100))
    publisher = Column(String(100))
    condition = Column(Enum(BookCondition), default=BookCondition.UNKNOWN)
    grade_level = Column(Enum(GradeLevel), default=GradeLevel.UNKNOWN)
    status = Column(Enum(BookStatus), default=BookStatus.PENDING)
    volunteer = Column(String(50), index=True)
    remarks = Column(Text)
    shelf_location = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    import_source = Column(Enum(ImportSource))
    import_batch_id = Column(String(50), index=True)

    status_history = relationship("StatusHistory", back_populates="book")
    exceptions = relationship("BookException", back_populates="book")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id"))
    old_status = Column(Enum(BookStatus))
    new_status = Column(Enum(BookStatus))
    changed_by = Column(String(50))
    change_reason = Column(Text)
    changed_at = Column(DateTime(timezone=True), server_default=func.now())

    book = relationship("Book", back_populates="status_history")


class BookException(Base):
    __tablename__ = "book_exceptions"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id"))
    exception_type = Column(Enum(ExceptionType))
    description = Column(Text)
    suggestion = Column(Text)
    resolved = Column(Boolean, default=False)
    resolved_by = Column(String(50))
    resolved_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    book = relationship("Book", back_populates="exceptions")


class ImportLog(Base):
    __tablename__ = "import_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(50), unique=True, index=True)
    source = Column(Enum(ImportSource))
    file_name = Column(String(200))
    imported_by = Column(String(50))
    total_records = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    imported_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))

    bad_records = relationship("BadRecord", back_populates="import_log")


class BadRecord(Base):
    __tablename__ = "bad_records"

    id = Column(Integer, primary_key=True, index=True)
    import_log_id = Column(Integer, ForeignKey("import_logs.id"))
    original_position = Column(String(50))
    raw_data = Column(Text)
    failure_reason = Column(Text)
    suggestion = Column(Text)
    is_retried = Column(Boolean, default=False)
    retried_at = Column(DateTime(timezone=True))
    resolved = Column(Boolean, default=False)

    import_log = relationship("ImportLog", back_populates="bad_records")
