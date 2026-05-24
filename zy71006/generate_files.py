#!/usr/bin/env python3
import os

BASE = os.path.dirname(os.path.abspath(__file__))

def make_main():
    path = os.path.join(BASE, 'main.py')
    code = []
    code.append('import hashlib')
    code.append('import os')
    code.append('import uuid')
    code.append('from datetime import datetime')
    code.append('from enum import Enum')
    code.append('from typing import Optional, List, Dict, Any')
    code.append('from io import BytesIO')
    code.append('')
    code.append('from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File')
    code.append('from fastapi.middleware.cors import CORSMiddleware')
    code.append('from fastapi.responses import StreamingResponse')
    code.append('from pydantic import BaseModel, Field')
    code.append('from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, ForeignKey')
    code.append('from sqlalchemy.ext.declarative import declarative_base')
    code.append('from sqlalchemy.orm import sessionmaker, Session, relationship')
    code.append('from sqlalchemy.sql import func')
    code.append('import pandas as pd')
    code.append('')
    code.append('UPLOAD_DIR = "uploads"')
    code.append('EXPORT_DIR = "exports"')
    code.append('os.makedirs(UPLOAD_DIR, exist_ok=True)')
    code.append('os.makedirs(EXPORT_DIR, exist_ok=True)')
    code.append('')
    code.append('SQLALCHEMY_DATABASE_URL = "sqlite:///./tree_hazards.db"')
    code.append('engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})')
    code.append('SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)')
    code.append('Base = declarative_base()')
    code.append('')
    code.append('class HazardLevel(str, Enum):')
    code.append('    GENERAL = "general"')
    code.append('    SERIOUS = "serious"')
    code.append('    SEVERE = "severe"')
    code.append('    EMERGENCY = "emergency"')
    code.append('')
    code.append('class HazardStatus(str, Enum):')
    code.append('    PENDING_REVIEW = "pending_review"')
    code.append('    BLOCKED = "blocked"')
    code.append('    APPROVED = "approved"')
    code.append('    IN_PROGRESS = "in_progress"')
    code.append('    PENDING_RECHECK = "pending_recheck"')
    code.append('    COMPLETED = "completed"')
    code.append('    CLOSED = "closed"')
    code.append('')
    code.append('class OperationType(str, Enum):')
    code.append('    REGISTER = "register"')
    code.append('    BLOCK = "block"')
    code.append('    APPROVE = "approve"')
    code.append('    ASSIGN = "assign"')
    code.append('    RECHECK_SUBMIT = "recheck_submit"')
    code.append('    COMPLETE = "complete"')
    code.append('    CLOSE = "close"')
    code.append('    MODIFY = "modify"')
    code.append('    WITHDRAW = "withdraw"')
    code.append('    RESUBMIT = "resubmit"')
    code.append('')
    code.append('class HazardDB(Base):')
    code.append('    __tablename__ = "hazards"')
    code.append('    id = Column(Integer, primary_key=True, index=True)')
    code.append('    tree_number = Column(String(50), index=True, nullable=False)')
    code.append('    road_location = Column(String(200), nullable=False)')
    code.append('    location_hash = Column(String(64), index=True)')
    code.append('    photo_path = Column(Text)')
    code.append('    hazard_level = Column(String(20), nullable=False)')
    code.append('    disposal_team = Column(String(100))')
    code.append('    status = Column(String(30), default=HazardStatus.PENDING_REVIEW)')
    code.append('    recheck_conclusion = Column(Text)')
    code.append('    batch_id = Column(String(64), index=True)')
    code.append('    description = Column(Text)')
    code.append('    created_at = Column(DateTime(timezone=True), server_default=func.now())')
    code.append('    updated_at = Column(DateTime(timezone=True), onupdate=func.now())')
    code.append('    is_duplicate = Column(Integer, default=0)')
    code.append('    original_hazard_id = Column(Integer, ForeignKey("hazards.id"))')
    code.append('    level_modified_count = Column(Integer, default=0)')
    code.append('    operations = relationship("OperationLogDB", back_populates="hazard")')
    code.append('    original = relationship("HazardDB", remote_side=[id])')
    code.append('')
    code.append('class OperationLogDB(Base):')
    code.append('    __tablename__ = "operation_logs"')
    code.append('    id = Column(Integer, primary_key=True, index=True)')
    code.append('    hazard_id = Column(Integer, ForeignKey("hazards.id"))')
    code.append('    operation_type = Column(String(30), nullable=False)')
    code.append('    operator = Column(String(100))')
    code.append('    remark = Column(Text)')
    code.append('    old_status = Column(String(30))')
    code.append('    new_status = Column(String(30))')
    code.append('    old_level = Column(String(20))')
    code.append('    new_level = Column(String(20))')
    code.append('    created_at = Column(DateTime(timezone=True), server_default=func.now())')
    code.append('    hazard = relationship("HazardDB", back_populates="operations")')
    code.append('')
    code.append('Base.metadata.create_all(bind=engine)')
    code.append('')
    
    # Utility functions
    code.append('def get_db():')
    code.append('    db = SessionLocal()')
    code.append('    try:')
    code.append('        yield db')
    code.append('    finally:')
    code.append('        db.close()')
    code.append('')
    code.append('def calc_location_hash(tree_no, road_loc):')
    code.append('    return hashlib.md5(f"{tree_no}|{road_loc}".encode()).hexdigest()')
    code.append('')
    code.append('def log_operation(db, h_id, op_type, operator=None, remark=None, old_status=None, new_status=None, old_level=None, new_level=None):')
    code.append('    log = OperationLogDB(hazard_id=h_id, operation_type=op_type.value if hasattr(op_type, "value") else op_type, operator=operator, remark=remark, old_status=old_status, new_status=new_status, old_level=old_level, new_level=new_level)')
    code.append('    db.add(log)')
    code.append('    db.commit()')
    code.append('')
    
    # Status transitions
    code.append('STATUS_TRANSITIONS = {')
    code.append('    HazardStatus.PENDING_REVIEW.value: [HazardStatus.BLOCKED.value, HazardStatus.APPROVED.value, HazardStatus.CLOSED.value],')
    code.append('    HazardStatus.BLOCKED.value: [HazardStatus.PENDING_REVIEW.value, HazardStatus.CLOSED.value],')
    code.append('    HazardStatus.APPROVED.value: [HazardStatus.IN_PROGRESS.value, HazardStatus.PENDING_REVIEW.value, HazardStatus.CLOSED.value],')
    code.append('    HazardStatus.IN_PROGRESS.value: [HazardStatus.PENDING_RECHECK.value, HazardStatus.PENDING_REVIEW.value, HazardStatus.COMPLETED.value, HazardStatus.CLOSED.value],')
    code.append('    HazardStatus.PENDING_RECHECK.value: [HazardStatus.COMPLETED.value, HazardStatus.IN_PROGRESS.value, HazardStatus.CLOSED.value],')
    code.append('    HazardStatus.COMPLETED.value: [HazardStatus.PENDING_REVIEW.value, HazardStatus.CLOSED.value],')
    code.append('    HazardStatus.CLOSED.value: [HazardStatus.PENDING_REVIEW.value],')
    code.append('}')
    code.append('')
    code.append('def validate_status_transition(old, new):')
    code.append('    return new in STATUS_TRANSITIONS.get(old, [])')
    code.append('')
    code.append('def can_close(hazard):')
    code.append('    if hazard.hazard_level == HazardLevel.EMERGENCY.value:')
    code.append('        if not hazard.recheck_conclusion:')
    code.append('            return False, "封路等级隐患必须有复查结论才能关闭"')
    code.append('    if hazard.status in [HazardStatus.IN_PROGRESS.value, HazardStatus.PENDING_RECHECK.value]:')
    code.append('        if not hazard.recheck_conclusion:')
    code.append('            return False, "处置中或待复查的隐患必须先提交复查结论"')
    code.append('    return True, ""')
    code.append('')
    
    # Pydantic models
    code.append('class HazardBase(BaseModel):')
    code.append('    tree_number: str')
    code.append('    road_location: str')
    code.append('    photo_path: Optional[str] = None')
    code.append('    hazard_level: HazardLevel')
    code.append('    disposal_team: Optional[str] = None')
    code.append('    batch_id: Optional[str] = None')
    code.append('    description: Optional[str] = None')
    code.append('')
    code.append('class HazardCreate(HazardBase):')
    code.append('    pass')
    code.append('')
    code.append('class HazardUpdate(BaseModel):')
    code.append('    hazard_level: Optional[HazardLevel] = None')
    code.append('    disposal_team: Optional[str] = None')
    code.append('    description: Optional[str] = None')
    code.append('    recheck_conclusion: Optional[str] = None')
    code.append('')
    code.append('class HazardResponse(HazardBase):')
    code.append('    id: int')
    code.append('    status: HazardStatus')
    code.append('    recheck_conclusion: Optional[str] = None')
    code.append('    location_hash: Optional[str] = None')
    code.append('    created_at: datetime')
    code.append('    updated_at: Optional[datetime] = None')
    code.append('    is_duplicate: int')
    code.append('    original_hazard_id: Optional[int] = None')
    code.append('    level_modified_count: int')
    code.append('    class Config:')
    code.append('        from_attributes = True')
    code.append('')
    code.append('class OperationLogResponse(BaseModel):')
    code.append('    id: int')
    code.append('    hazard_id: int')
    code.append('    operation_type: OperationType')
    code.append('    operator: Optional[str] = None')
    code.append('    remark: Optional[str] = None')
    code.append('    old_status: Optional[HazardStatus] = None')
    code.append('    new_status: Optional[HazardStatus] = None')
    code.append('    old_level: Optional[HazardLevel] = None')
    code.append('    new_level: Optional[HazardLevel] = None')
    code.append('    created_at: datetime')
    code.append('    class Config:')
    code.append('        from_attributes = True')
    code.append('')
    code.append('class StatusChangeRequest(BaseModel):')
    code.append('    operator: Optional[str] = None')
    code.append('    remark: Optional[str] = None')
    code.append('')
    code.append('class RecheckRequest(BaseModel):')
    code.append('    conclusion: str')
    code.append('    operator: Optional[str] = None')
    code.append('    passed: bool = True')
    code.append('')
    
    # App init
    code.append('app = FastAPI(title="城市树木隐患 API", version="1.0.0")')
    code.append('app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])')
    code.append('')
    
    # Basic APIs
    code.append('@app.get("/")')
    code.append('def root():')
    code.append('    return {"message": "城市树木隐患 API 服务运行中"}')
    code.append('')
    code.append('@app.get("/api/health")')
    code.append('def health_check():')
    code.append('    return {"status": "healthy"}')
    code.append('')
    
    with open(path, 'w') as f:
        f.write('\n'.join(code))
    print(f"Written {len(code)} lines to main.py")

if __name__ == '__main__':
    make_main()

print("Created database.py")

# ==================== schemas.py ====================
schemas_py = '''from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List
from enum import Enum

class HazardLevel(str, Enum):
    LOW = "低危"
    MEDIUM = "中危"
    HIGH = "高危"
    EXTREME = "极危"

class DisposalStatus(str, Enum):
    PENDING = "待处置"
    BLOCKED = "已拦截"
    APPROVED = "已放行"
    IN_PROGRESS = "处置中"
    CLOSED = "已关闭"
    REJECTED = "已驳回"
    WITHDRAWN = "已撤回"

class DisposalType(str, Enum):
    PRUNE = "修剪"
    SUPPORT = "支撑"
    ROAD_CLOSE = "封路"
    REMOVE = "移除"
    OTHER = "其他"

class TreePointBase(BaseModel):
    tree_number: str
    road_location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    tree_type: Optional[str] = None

class TreePointCreate(TreePointBase):
    pass

class TreePointResponse(TreePointBase):
    id: int
    created_at: datetime
    updated_at: datetime
    class Config:
        from_attributes = True

class HazardRecordBase(BaseModel):
    batch_id: Optional[str] = None
    hazard_level: HazardLevel
    disposal_type: DisposalType
    disposal_team: Optional[str] = None
    description: Optional[str] = None
    reporter: Optional[str] = None

class HazardRecordCreate(HazardRecordBase):
    tree_number: str
    road_location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    tree_type: Optional[str] = None

class HazardRecordResponse(HazardRecordBase):
    id: int
    tree_point_id: int
    status: DisposalStatus
    photo_path: Optional[str] = None
    report_time: datetime
    is_duplicate: int
    duplicate_of: Optional[int] = None
    manual_override: int
    created_at: datetime
    updated_at: datetime
    tree_point: TreePointResponse
    class Config:
        from_attributes = True

class ReviewRecordBase(BaseModel):
    reviewer: str
    review_conclusion: str
    is_passed: int = 0

class ReviewRecordCreate(ReviewRecordBase):
    hazard_id: int

class ReviewRecordResponse(ReviewRecordBase):
    id: int
    hazard_id: int
    review_time: datetime
    photos: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

class StatusHistoryResponse(BaseModel):
    id: int
    hazard_id: int
    from_status: str
    to_status: str
    operator: Optional[str] = None
    reason: Optional[str] = None
    change_time: datetime
    class Config:
        from_attributes = True

class HazardDetailResponse(HazardRecordResponse):
    reviews: List[ReviewRecordResponse] = []
    history: List[StatusHistoryResponse] = []

class BatchUploadResponse(BaseModel):
    total: int
    success: int
    duplicates: int
    failed: int
    message: str
    hazard_ids: List[int] = []

class StatusChangeRequest(BaseModel):
    operator: Optional[str] = None
    reason: Optional[str] = None

class QueryParams(BaseModel):
    hazard_level: Optional[HazardLevel] = None
    status: Optional[DisposalStatus] = None
    disposal_type: Optional[DisposalType] = None
    disposal_team: Optional[str] = None
    road_location: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    batch_id: Optional[str] = None

class StatisticsResponse(BaseModel):
    total_records: int
    by_level: dict
    by_status: dict
    by_disposal_type: dict
    pending_review: int
    duplicates_found: int
'''

with open(os.path.join(APP_DIR, "schemas.py"), "w") as f:
    f.write(schemas_py)

print("Created schemas.py")

# ==================== services.py ====================
services_py = '''from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from datetime import datetime
from . import database, schemas
import uuid
import os

UPLOAD_DIR = "app/uploads"

def find_duplicate_hazard(db: Session, tree_number: str, road_location: str, hazard_level: str):
    tree = db.query(database.TreePoint).filter(
        database.TreePoint.tree_number == tree_number
    ).first()
    if not tree:
        tree = db.query(database.TreePoint).filter(
            database.TreePoint.road_location == road_location
        ).first()
    
    if tree:
        existing = db.query(database.HazardRecord).filter(
            and_(
                database.HazardRecord.tree_point_id == tree.id,
                database.HazardRecord.status.notin_([
                    database.DisposalStatus.CLOSED,
                    database.DisposalStatus.REJECTED
                ]),
                database.HazardRecord.is_duplicate == 0
            )
        ).order_by(database.HazardRecord.created_at.desc()).first()
        return existing
    return None

def get_or_create_tree_point(db: Session, tree_data: schemas.HazardRecordCreate):
    tree = db.query(database.TreePoint).filter(
        database.TreePoint.tree_number == tree_data.tree_number
    ).first()
    
    if not tree:
        tree = database.TreePoint(
            tree_number=tree_data.tree_number,
            road_location=tree_data.road_location,
            latitude=tree_data.latitude,
            longitude=tree_data.longitude,
            tree_type=tree_data.tree_type
        )
        db.add(tree)
        db.commit()
        db.refresh(tree)
    else:
        if tree_data.road_location and tree.road_location != tree_data.road_location:
            tree.road_location = tree_data.road_location
        if tree_data.tree_type:
            tree.tree_type = tree_data.tree_type
        db.commit()
        db.refresh(tree)
    return tree

def create_status_history(db: Session, hazard_id: int, from_status: str, to_status: str, operator: str = None, reason: str = None):
    history = database.StatusHistory(
        hazard_id=hazard_id,
        from_status=from_status,
        to_status=to_status,
        operator=operator,
        reason=reason
    )
    db.add(history)
    db.commit()

def create_hazard_record(db: Session, hazard_data: schemas.HazardRecordCreate, photo_path: str = None):
    duplicate = find_duplicate_hazard(db, hazard_data.tree_number, hazard_data.road_location, hazard_data.hazard_level)
    
    tree = get_or_create_tree_point(db, hazard_data)
    
    batch_id = hazard_data.batch_id or str(uuid.uuid4())[:8]
    
    hazard = database.HazardRecord(
        batch_id=batch_id,
        tree_point_id=tree.id,
        hazard_level=hazard_data.hazard_level,
        disposal_type=hazard_data.disposal_type,
        disposal_team=hazard_data.disposal_team,
        description=hazard_data.description,
        photo_path=photo_path,
        reporter=hazard_data.reporter,
        is_duplicate=1 if duplicate else 0,
        duplicate_of=duplicate.id if duplicate else None
    )
    
    db.add(hazard)
    db.commit()
    db.refresh(hazard)
    
    create_status_history(db, hazard.id, None, hazard.status.value, hazard_data.reporter, "初始登记")
    
    return hazard, duplicate is not None

def change_hazard_status(db: Session, hazard_id: int, new_status: database.DisposalStatus, operator: str = None, reason: str = None):
    hazard = db.query(database.HazardRecord).filter(database.HazardRecord.id == hazard_id).first()
    if not hazard:
        return None
    
    old_status = hazard.status.value
    hazard.status = new_status
    db.commit()
    db.refresh(hazard)
    
    create_status_history(db, hazard_id, old_status, new_status.value, operator, reason)
    
    return hazard

def add_review_record(db: Session, review_data: schemas.ReviewRecordCreate, photo_paths: str = None):
    review = database.ReviewRecord(
        hazard_id=review_data.hazard_id,
        reviewer=review_data.reviewer,
        review_conclusion=review_data.review_conclusion,
        is_passed=review_data.is_passed,
        photos=photo_paths
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    
    hazard = db.query(database.HazardRecord).filter(database.HazardRecord.id == review_data.hazard_id).first()
    if hazard and review_data.is_passed and hazard.status == database.DisposalStatus.IN_PROGRESS:
        change_hazard_status(db, hazard.id, database.DisposalStatus.CLOSED, review_data.reviewer, "复查通过，隐患已消除")
    
    return review

def query_hazards(db: Session, params: schemas.QueryParams):
    query = db.query(database.HazardRecord)
    
    if params.hazard_level:
        query = query.filter(database.HazardRecord.hazard_level == params.hazard_level)
    if params.status:
        query = query.filter(database.HazardRecord.status == params.status)
    if params.disposal_type:
        query = query.filter(database.HazardRecord.disposal_type == params.disposal_type)
    if params.disposal_team:
        query = query.filter(database.HazardRecord.disposal_team == params.disposal_team)
    if params.road_location:
        query = query.join(database.TreePoint).filter(database.TreePoint.road_location.contains(params.road_location))
    if params.batch_id:
        query = query.filter(database.HazardRecord.batch_id == params.batch_id)
    if params.start_date:
        query = query.filter(database.HazardRecord.report_time >= params.start_date)
    if params.end_date:
        query = query.filter(database.HazardRecord.report_time <= params.end_date)
    
    return query.order_by(database.HazardRecord.created_at.desc()).all()

def get_statistics(db: Session):
    total = db.query(database.HazardRecord).count()
    
    by_level = {}
    for level in database.HazardLevel:
        count = db.query(database.HazardRecord).filter(database.HazardRecord.hazard_level == level).count()
        by_level[level.value] = count
    
    by_status = {}
    for status in database.DisposalStatus:
        count = db.query(database.HazardRecord).filter(database.HazardRecord.status == status).count()
        by_status[status.value] = count
    
    by_disposal = {}
    for dtype in database.DisposalType:
        count = db.query(database.HazardRecord).filter(database.HazardRecord.disposal_type == dtype).count()
        by_disposal[dtype.value] = count
    
    pending_review = db.query(database.HazardRecord).filter(
        and_(
            database.HazardRecord.disposal_type == database.DisposalType.ROAD_CLOSE,
            database.HazardRecord.status == database.DisposalStatus.IN_PROGRESS
        )
    ).count()
    
    duplicates = db.query(database.HazardRecord).filter(database.HazardRecord.is_duplicate == 1).count()
    
    return {
        "total_records": total,
        "by_level": by_level,
        "by_status": by_status,
        "by_disposal_type": by_disposal,
        "pending_review": pending_review,
        "duplicates_found": duplicates
    }
'''

with open(os.path.join(APP_DIR, "services.py"), "w") as f:
    f.write(services_py)

print("Created services.py")

print("\nAll files created successfully!")
