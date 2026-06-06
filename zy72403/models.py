from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./music_archive.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Song(Base):
    __tablename__ = "songs"
    id = Column(Integer, primary_key=True, index=True)
    live_name = Column(String(500), index=True, comment="现场用名")
    copyright_name = Column(String(500), index=True, comment="版权注册名")
    needs_teacher_review = Column(Boolean, default=True, comment="是否需要音乐老师复核")
    review_status = Column(String(50), default="pending", comment="复核状态:pending/approved/rejected")
    reviewed_by = Column(String(200), comment="复核人")
    reviewed_at = Column(DateTime, comment="复核时间")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SignInPhoto(Base):
    __tablename__ = "sign_in_photos"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(200), index=True, comment="导入批次号，用于防重复")
    file_hash = Column(String(200), index=True, comment="文件哈希，用于防重复")
    file_name = Column(String(500))
    file_path = Column(String(1000))
    course_name = Column(String(500), comment="课程名称")
    teacher_name = Column(String(200), comment="授课老师")
    sign_date = Column(DateTime, comment="签到日期")
    song_live_name = Column(String(500), comment="照片中显示的歌曲名")
    extracted_text = Column(Text, comment="OCR提取的文本")
    song_id = Column(Integer, ForeignKey("songs.id"), nullable=True)
    song = relationship("Song")
    import_status = Column(String(50), default="imported", comment="导入状态")
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(200), default="system")


class TicketExport(Base):
    __tablename__ = "ticket_exports"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(String(200), index=True)
    file_name = Column(String(500))
    file_path = Column(String(1000))
    song_copyright_name = Column(String(500), comment="票务表中的版权名")
    song_id = Column(Integer, ForeignKey("songs.id"), nullable=True)
    song = relationship("Song")
    revenue_amount = Column(String(100), comment="营收金额")
    performance_date = Column(DateTime, comment="演出日期")
    reviewed_by = Column(String(200), default="老周", comment="补录人")
    created_at = Column(DateTime, default=datetime.utcnow)


class TranspositionCalc(Base):
    __tablename__ = "transposition_calcs"
    id = Column(Integer, primary_key=True, index=True)
    parameter_version = Column(String(100), comment="参数版本")
    parameter_notes = Column(Text, comment="参数取舍理由")
    original_key = Column(String(50), comment="原调")
    target_key = Column(String(50), comment="转调后调")
    transpose_steps = Column(Integer, comment="转调半音数")
    calc_logic = Column(Text, comment="计算逻辑说明")
    confidence = Column(String(50), comment="置信度")
    created_at = Column(DateTime, default=datetime.utcnow)


class TranspositionAnnotation(Base):
    __tablename__ = "transposition_annotations"
    id = Column(Integer, primary_key=True, index=True)
    song_id = Column(Integer, ForeignKey("songs.id"))
    song = relationship("Song")
    sign_in_photo_id = Column(Integer, ForeignKey("sign_in_photos.id"))
    sign_in_photo = relationship("SignInPhoto")
    ticket_export_id = Column(Integer, ForeignKey("ticket_exports.id"), nullable=True)
    ticket_export = relationship("TicketExport")
    calc_id = Column(Integer, ForeignKey("transposition_calcs.id"), nullable=True)
    calc = relationship("TranspositionCalc")
    annotation_content = Column(Text, comment="转调批注内容")
    remark = Column(Text, comment="备注")
    annotated_by = Column(String(200), comment="批注人")
    annotated_at = Column(DateTime, default=datetime.utcnow)
    workflow_stage = Column(String(50), default="photo_imported", comment="工作流阶段:photo_imported/ticket_reviewed/weekly_reported")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ChangeHistory(Base):
    __tablename__ = "change_histories"
    id = Column(Integer, primary_key=True, index=True)
    archive_id = Column(Integer, ForeignKey("archive_records.id"))
    field_name = Column(String(200), comment="修改的字段名")
    old_value = Column(Text, comment="修改前值")
    new_value = Column(Text, comment="修改后值")
    changed_by = Column(String(200), comment="修改人")
    changed_at = Column(DateTime, default=datetime.utcnow)
    change_reason = Column(Text, comment="修改原因")


class ArchiveRecord(Base):
    __tablename__ = "archive_records"
    id = Column(Integer, primary_key=True, index=True)
    archive_no = Column(String(200), unique=True, index=True, comment="归档编号")
    annotation_id = Column(Integer, ForeignKey("transposition_annotations.id"))
    annotation = relationship("TranspositionAnnotation")
    archive_status = Column(String(50), default="active", comment="归档状态:active/archived")
    keep_reason = Column(Text, comment="归档保留原因")
    missing_materials = Column(JSON, comment="缺失材料列表")
    next_action = Column(String(500), comment="下一步行动:找音乐老师/找老周/等待复核")
    next_action_owner = Column(String(200), comment="下一步负责人")
    display_mode = Column(String(50), default="list", comment="展示模式:list/3d/chart")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    changes = relationship("ChangeHistory", backref="archive")


class WeeklyReport(Base):
    __tablename__ = "weekly_reports"
    id = Column(Integer, primary_key=True, index=True)
    week_start = Column(DateTime, comment="周开始日期")
    week_end = Column(DateTime, comment="周结束日期")
    report_content = Column(JSON, comment="报告内容")
    human_readable_summary = Column(Text, comment="人性化总结")
    generated_by = Column(String(200), default="system")
    generated_at = Column(DateTime, default=datetime.utcnow)
    archive_ids = Column(JSON, comment="本周涉及的归档ID列表")


def init_db():
    Base.metadata.create_all(bind=engine)
