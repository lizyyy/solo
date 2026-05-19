from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


class Book(Base):
    __tablename__ = "books"
    
    id = Column(Integer, primary_key=True, index=True)
    isbn = Column(String(20), index=True, nullable=True)
    isbn_normalized = Column(String(20), index=True, nullable=True)
    title = Column(String(200), nullable=False)
    author = Column(String(100))
    publisher = Column(String(100))
    condition = Column(String(20), nullable=False)
    grade = Column(String(20), nullable=False)
    book_count = Column(Integer, default=1)
    donor_name = Column(String(100))
    donor_phone = Column(String(20))
    donor_idcard = Column(String(20))
    remarks = Column(Text)
    status = Column(String(20), default="待上架")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    import_records = relationship("ImportRecord", back_populates="book")
    
    __table_args__ = (
        Index('idx_isbn_condition_grade', 'isbn_normalized', 'condition', 'grade'),
    )


class ImportBatch(Base):
    __tablename__ = "import_batches"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, index=True)
    total_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    operator_name = Column(String(100))
    operator_phone = Column(String(20))
    status = Column(String(20), default="处理中")
    error_message = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    
    records = relationship("ImportRecord", back_populates="batch")


class ImportRecord(Base):
    __tablename__ = "import_records"
    
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("import_batches.id"))
    book_id = Column(Integer, ForeignKey("books.id"), nullable=True)
    row_number = Column(Integer)
    is_success = Column(Boolean, default=False)
    is_duplicate = Column(Boolean, default=False)
    action_taken = Column(String(50))
    reason = Column(Text)
    isbn = Column(String(20))
    title = Column(String(200))
    condition = Column(String(20))
    grade = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    batch = relationship("ImportBatch", back_populates="records")
    book = relationship("Book", back_populates="import_records")


class OperationLog(Base):
    __tablename__ = "operation_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    operation_type = Column(String(50), index=True)
    operator_name = Column(String(100))
    operator_phone = Column(String(20))
    target_type = Column(String(50))
    target_id = Column(Integer)
    old_value = Column(Text)
    new_value = Column(Text)
    change_reason = Column(String(500))
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
