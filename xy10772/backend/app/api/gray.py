from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models import GrayRule, GrayStatus, DeviceChannel, AppVersion, GrayDevice
from app.schemas import GrayRuleCreate, GrayRuleUpdate, GrayRuleResponse, DeviceChannelResponse, AppVersionResponse
from datetime import datetime
import uuid

router = APIRouter()

@router.get("/rules", response_model=List[GrayRuleResponse])
def get_gray_rules(status: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(GrayRule)
    if status:
        query = query.filter(GrayRule.status == status)
    return query.order_by(GrayRule.created_at.desc()).offset(skip).limit(limit).all()

@router.get("/rules/{rule_id}", response_model=GrayRuleResponse)
def get_gray_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(GrayRule).filter(GrayRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="灰度规则不存在")
    return rule

@router.post("/rules", response_model=GrayRuleResponse)
def create_gray_rule(rule: GrayRuleCreate, db: Session = Depends(get_db)):
    existing = db.query(GrayRule).filter(GrayRule.request_id == rule.request_id).first()
    if existing:
        return existing
    
    db_rule = GrayRule(**rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@router.put("/rules/{rule_id}", response_model=GrayRuleResponse)
def update_gray_rule(rule_id: int, rule_update: GrayRuleUpdate, db: Session = Depends(get_db)):
    db_rule = db.query(GrayRule).filter(GrayRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="灰度规则不存在")
    
    for key, value in rule_update.dict(exclude_unset=True).items():
        setattr(db_rule, key, value)
    
    db.commit()
    db.refresh(db_rule)
    
    if rule_update.device_channels:
        recalculate_gray_devices(db_rule.id, db)
    
    return db_rule

@router.post("/rules/{rule_id}/submit")
def submit_for_approval(rule_id: int, db: Session = Depends(get_db)):
    db_rule = db.query(GrayRule).filter(GrayRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="灰度规则不存在")
    
    db_rule.status = GrayStatus.PENDING_APPROVAL
    db.commit()
    return {"message": "已提交审批", "rule_id": rule_id}

@router.post("/rules/{rule_id}/start")
def start_gray_release(rule_id: int, db: Session = Depends(get_db)):
    db_rule = db.query(GrayRule).filter(GrayRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="灰度规则不存在")
    
    if db_rule.status != GrayStatus.APPROVED:
        raise HTTPException(status_code=400, detail="只有已审批的规则可以启动")
    
    db_rule.status = GrayStatus.RUNNING
    db_rule.started_at = datetime.utcnow()
    db.commit()
    
    allocate_gray_devices(db_rule, db)
    
    return {"message": "灰度已启动", "rule_id": rule_id}

@router.post("/rules/{rule_id}/pause")
def pause_gray_release(rule_id: int, db: Session = Depends(get_db)):
    db_rule = db.query(GrayRule).filter(GrayRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="灰度规则不存在")
    
    db_rule.status = GrayStatus.PAUSED
    db.commit()
    return {"message": "灰度已暂停", "rule_id": rule_id}

@router.post("/rules/{rule_id}/success")
def mark_success(rule_id: int, db: Session = Depends(get_db)):
    db_rule = db.query(GrayRule).filter(GrayRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="灰度规则不存在")
    
    db_rule.status = GrayStatus.SUCCESS
    db_rule.completed_at = datetime.utcnow()
    db.commit()
    
    create_release_record(db_rule, "full_release", "success", db)
    
    return {"message": "灰度成功完成", "rule_id": rule_id}

@router.post("/rules/{rule_id}/block")
def block_gray_release(rule_id: int, reason: str, db: Session = Depends(get_db)):
    db_rule = db.query(GrayRule).filter(GrayRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="灰度规则不存在")
    
    db_rule.status = GrayStatus.BLOCKED
    db_rule.completed_at = datetime.utcnow()
    db.commit()
    
    create_release_record(db_rule, "blocked", "failed", db, reason)
    
    return {"message": "灰度已拦截", "rule_id": rule_id}

@router.post("/rules/{rule_id}/compensate")
def compensate_gray_release(rule_id: int, db: Session = Depends(get_db)):
    db_rule = db.query(GrayRule).filter(GrayRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="灰度规则不存在")
    
    db_rule.status = GrayStatus.COMPENSATED
    db.commit()
    
    create_release_record(db_rule, "compensation", "success", db)
    
    return {"message": "补偿流程已执行", "rule_id": rule_id}

@router.post("/rules/{rule_id}/cancel")
def cancel_gray_release(rule_id: int, db: Session = Depends(get_db)):
    db_rule = db.query(GrayRule).filter(GrayRule.id == rule_id).first()
    if not db_rule:
        raise HTTPException(status_code=404, detail="灰度规则不存在")
    
    db_rule.status = GrayStatus.CANCELLED
    db.commit()
    return {"message": "灰度已取消", "rule_id": rule_id}

def allocate_gray_devices(rule: GrayRule, db: Session):
    channels = rule.device_channels.split(",") if rule.device_channels else []
    for channel in channels:
        channel = channel.strip()
        total_devices = 1000
        gray_count = int(total_devices * rule.gray_ratio / 100)
        
        for i in range(total_devices):
            device_id = f"{channel}_{uuid.uuid4().hex[:8]}"
            is_gray = i < gray_count
            db_device = GrayDevice(
                gray_rule_id=rule.id,
                device_id=device_id,
                device_channel=channel,
                is_gray=is_gray
            )
            db.add(db_device)
    db.commit()

def recalculate_gray_devices(rule_id: int, db: Session):
    rule = db.query(GrayRule).filter(GrayRule.id == rule_id).first()
    if not rule:
        return
    
    db.query(GrayDevice).filter(GrayDevice.gray_rule_id == rule_id).delete()
    
    if rule.status in [GrayStatus.RUNNING, GrayStatus.PAUSED]:
        allocate_gray_devices(rule, db)

def create_release_record(rule: GrayRule, release_type: str, status: str, db: Session, details: str = None):
    from app.models import ReleaseRecord
    record = ReleaseRecord(
        gray_rule_id=rule.id,
        release_type=release_type,
        status=status,
        details=details or f"灰度规则 {rule.name} {status}",
        released_by="system"
    )
    db.add(record)
    db.commit()

@router.get("/channels", response_model=List[DeviceChannelResponse])
def get_channels(db: Session = Depends(get_db)):
    return db.query(DeviceChannel).all()

@router.post("/channels", response_model=DeviceChannelResponse)
def create_channel(channel: dict, db: Session = Depends(get_db)):
    db_channel = DeviceChannel(**channel)
    db.add(db_channel)
    db.commit()
    db.refresh(db_channel)
    return db_channel

@router.get("/versions", response_model=List[AppVersionResponse])
def get_versions(db: Session = Depends(get_db)):
    return db.query(AppVersion).order_by(AppVersion.created_at.desc()).all()

@router.post("/versions", response_model=AppVersionResponse)
def create_version(version: dict, db: Session = Depends(get_db)):
    db_version = AppVersion(**version)
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    return db_version

@router.get("/rules/{rule_id}/diff")
def get_version_diff(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(GrayRule).filter(GrayRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="灰度规则不存在")
    
    return {
        "rule_id": rule.id,
        "from_version": rule.version.version if rule.version else None,
        "to_version": rule.target_version.version if rule.target_version else None,
        "device_channels": rule.device_channels.split(",") if rule.device_channels else [],
        "gray_ratio": rule.gray_ratio,
        "changes": [
            {"type": "version", "old": rule.version.version if rule.version else None, "new": rule.target_version.version if rule.target_version else None},
            {"type": "ratio", "old": 0, "new": rule.gray_ratio}
        ]
    }
