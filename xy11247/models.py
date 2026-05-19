from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Enum
import enum

db = SQLAlchemy()

class ConditionEnum(enum.Enum):
    NEW = "全新"
    LIKE_NEW = "九成新"
    GOOD = "八成新"
    FAIR = "七成新"
    POOR = "六成新及以下"
    UNKNOWN = "未标注"

class GradeEnum(enum.Enum):
    PRESCHOOL = "学前"
    GRADE_1 = "一年级"
    GRADE_2 = "二年级"
    GRADE_3 = "三年级"
    GRADE_4 = "四年级"
    GRADE_5 = "五年级"
    GRADE_6 = "六年级"
    JUNIOR_HIGH_1 = "初一"
    JUNIOR_HIGH_2 = "初二"
    JUNIOR_HIGH_3 = "初三"
    HIGH_SCHOOL_1 = "高一"
    HIGH_SCHOOL_2 = "高二"
    HIGH_SCHOOL_3 = "高三"
    ADULT = "成人"
    UNKNOWN = "未标注"

class ImportStatusEnum(enum.Enum):
    PENDING = "待处理"
    SUCCESS = "成功"
    FAILED = "失败"
    DUPLICATE = "重复"
    REVIEWED = "已复核"

class Book(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    isbn = db.Column(db.String(20), index=True)
    isbn_valid = db.Column(db.Boolean, default=False)
    title = db.Column(db.String(200), nullable=False)
    author = db.Column(db.String(100))
    publisher = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.UniqueConstraint('isbn', 'title', name='_book_isbn_title_uc'),
    )

class BookInventory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'), nullable=False)
    condition = db.Column(db.Enum(ConditionEnum), default=ConditionEnum.UNKNOWN)
    grade = db.Column(db.Enum(GradeEnum), default=GradeEnum.UNKNOWN)
    quantity = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    book = db.relationship('Book', backref=db.backref('inventories', lazy=True))

    __table_args__ = (
        db.UniqueConstraint('book_id', 'condition', 'grade', name='_inventory_book_condition_grade_uc'),
    )

class ImportBatch(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_no = db.Column(db.String(50), unique=True, nullable=False)
    total_count = db.Column(db.Integer, default=0)
    success_count = db.Column(db.Integer, default=0)
    failed_count = db.Column(db.Integer, default=0)
    duplicate_count = db.Column(db.Integer, default=0)
    created_by = db.Column(db.String(50), default="system")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime)
    reviewed_by = db.Column(db.String(50))
    is_reviewed = db.Column(db.Boolean, default=False)

class ImportRecord(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(db.Integer, db.ForeignKey('import_batch.id'), nullable=False)
    row_number = db.Column(db.Integer)
    raw_isbn = db.Column(db.String(50))
    raw_title = db.Column(db.String(200))
    raw_author = db.Column(db.String(100))
    raw_publisher = db.Column(db.String(100))
    raw_condition = db.Column(db.String(50))
    raw_grade = db.Column(db.String(50))
    raw_quantity = db.Column(db.Integer, default=1)
    normalized_isbn = db.Column(db.String(20))
    status = db.Column(db.Enum(ImportStatusEnum), default=ImportStatusEnum.PENDING)
    process_message = db.Column(db.Text)
    book_id = db.Column(db.Integer, db.ForeignKey('book.id'))
    inventory_id = db.Column(db.Integer, db.ForeignKey('book_inventory.id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    processed_at = db.Column(db.DateTime)

    batch = db.relationship('ImportBatch', backref=db.backref('records', lazy=True))
    book = db.relationship('Book', backref=db.backref('import_records', lazy=True))
    inventory = db.relationship('BookInventory', backref=db.backref('import_records', lazy=True))

class ReviewLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    record_id = db.Column(db.Integer, db.ForeignKey('import_record.id'), nullable=False)
    reviewer = db.Column(db.String(50), default="system")
    action = db.Column(db.String(50))
    remark = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    record = db.relationship('ImportRecord', backref=db.backref('review_logs', lazy=True))
