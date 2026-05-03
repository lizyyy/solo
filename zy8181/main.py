import hashlib
import json
import csv
import yaml
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
import os

DATABASE_URL = "sqlite:///./feature_flags.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AuditBatch(Base):
    __tablename__ = "audit_batches"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    flags = Column(Text)
    segments = Column(Text)
    events = Column(Text)
    users = Column(Text)

class FlagHistory(Base):
    __tablename__ = "flag_history"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("audit_batches.id"))
    flag_key = Column(String, index=True)
    timestamp = Column(DateTime)
    version = Column(Integer)
    is_kill_switch = Column(Boolean, default=False)
    kill_switch_value = Column(Boolean, default=False)
    default_value = Column(Boolean)
    rollout_percent = Column(Integer, default=0)
    targeting_rules = Column(Text)
    is_deleted = Column(Boolean, default=False)

class SegmentHistory(Base):
    __tablename__ = "segment_history"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("audit_batches.id"))
    segment_key = Column(String, index=True)
    timestamp = Column(DateTime)
    version = Column(Integer)
    user_keys = Column(Text)
    is_deleted = Column(Boolean, default=False)

class RolloutEvent(Base):
    __tablename__ = "rollout_events"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("audit_batches.id"))
    event_type = Column(String)
    flag_key = Column(String, index=True)
    segment_key = Column(String, index=True)
    timestamp = Column(DateTime)
    version = Column(Integer)
    data = Column(Text)
    is_processed = Column(Boolean, default=False)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("audit_batches.id"))
    user_key = Column(String, index=True)
    attributes = Column(Text)

class ReplayResult(Base):
    __tablename__ = "replay_results"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("audit_batches.id"))
    user_key = Column(String, index=True)
    flag_key = Column(String, index=True)
    timestamp = Column(DateTime)
    version = Column(Integer)
    value = Column(Boolean)
    is_kill_switch_override = Column(Boolean, default=False)
    segment_reference_issue = Column(String)

class Anomaly(Base):
    __tablename__ = "anomalies"
    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("audit_batches.id"))
    anomaly_type = Column(String)
    flag_key = Column(String)
    segment_key = Column(String)
    timestamp = Column(DateTime)
    description = Column(Text)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Feature Flag Replay Service")

class HashBucket:
    @staticmethod
    def compute_bucket(user_key: str, flag_key: str, num_buckets: int = 10000) -> int:
        combined = f"{user_key}:{flag_key}"
        hash_obj = hashlib.sha256(combined.encode())
        hash_int = int(hash_obj.hexdigest()[:16], 16)
        return hash_int % num_buckets
    
    @staticmethod
    def is_in_rollout(user_key: str, flag_key: str, rollout_percent: int) -> bool:
        if rollout_percent <= 0:
            return False
        if rollout_percent >= 100:
            return True
        bucket = HashBucket.compute_bucket(user_key, flag_key)
        threshold = (rollout_percent * 10000) // 100
        return bucket < threshold

class FlagEvaluator:
    def __init__(self, db: Session, batch_id: int):
        self.db = db
        self.batch_id = batch_id
    
    def get_flag_at_time(self, flag_key: str, timestamp: datetime) -> Optional[Dict]:
        flags = self.db.query(FlagHistory).filter(
            FlagHistory.batch_id == self.batch_id,
            FlagHistory.flag_key == flag_key,
            FlagHistory.timestamp <= timestamp
        ).order_by(FlagHistory.timestamp.desc(), FlagHistory.version.desc()).first()
        
        if flags is None:
            return None
        if flags.is_deleted:
            return None
        
        return {
            "flag_key": flags.flag_key,
            "version": flags.version,
            "is_kill_switch": flags.is_kill_switch,
            "kill_switch_value": flags.kill_switch_value,
            "default_value": flags.default_value,
            "rollout_percent": flags.rollout_percent,
            "targeting_rules": json.loads(flags.targeting_rules) if flags.targeting_rules else []
        }
    
    def get_segment_at_time(self, segment_key: str, timestamp: datetime) -> Optional[Dict]:
        segments = self.db.query(SegmentHistory).filter(
            SegmentHistory.batch_id == self.batch_id,
            SegmentHistory.segment_key == segment_key,
            SegmentHistory.timestamp <= timestamp
        ).order_by(SegmentHistory.timestamp.desc(), SegmentHistory.version.desc()).first()
        
        if segments is None:
            return None
        if segments.is_deleted:
            return None
        
        return {
            "segment_key": segments.segment_key,
            "version": segments.version,
            "user_keys": json.loads(segments.user_keys) if segments.user_keys else []
        }
    
    def evaluate_flag(self, flag_key: str, user_key: str, timestamp: datetime) -> Dict:
        result = {
            "flag_key": flag_key,
            "user_key": user_key,
            "timestamp": timestamp,
            "value": False,
            "version": None,
            "is_kill_switch_override": False,
            "segment_reference_issue": None
        }
        
        flag = self.get_flag_at_time(flag_key, timestamp)
        if flag is None:
            result["value"] = False
            return result
        
        result["version"] = flag["version"]
        
        if flag["is_kill_switch"]:
            result["value"] = flag["kill_switch_value"]
            result["is_kill_switch_override"] = True
            return result
        
        for rule in flag["targeting_rules"]:
            if rule.get("type") == "segment":
                segment_key = rule.get("segment_key")
                segment = self.get_segment_at_time(segment_key, timestamp)
                
                if segment is None:
                    result["segment_reference_issue"] = f"Segment '{segment_key}' not found or deleted at evaluation time"
                    continue
                
                if user_key in segment["user_keys"]:
                    result["value"] = rule.get("value", True)
                    return result
            
            elif rule.get("type") == "percentage":
                percent = rule.get("percentage", 0)
                if HashBucket.is_in_rollout(user_key, flag_key, percent):
                    result["value"] = rule.get("value", True)
                    return result
        
        if flag["rollout_percent"] > 0:
            if HashBucket.is_in_rollout(user_key, flag_key, flag["rollout_percent"]):
                result["value"] = not flag["default_value"]
            else:
                result["value"] = flag["default_value"]
        else:
            result["value"] = flag["default_value"]
        
        return result

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class BatchInfo(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True

class ReplayResultResponse(BaseModel):
    user_key: str
    flag_key: str
    timestamp: datetime
    version: Optional[int]
    value: bool
    is_kill_switch_override: bool
    segment_reference_issue: Optional[str]

    class Config:
        from_attributes = True

class AnomalyResponse(BaseModel):
    id: int
    anomaly_type: str
    flag_key: Optional[str]
    segment_key: Optional[str]
    timestamp: Optional[datetime]
    description: str

    class Config:
        from_attributes = True

@app.post("/api/batches", response_model=BatchInfo)
async def create_batch(
    name: str = Query(..., description="Batch name"),
    flags_file: Optional[UploadFile] = File(None, description="flags.yaml"),
    segments_file: Optional[UploadFile] = File(None, description="segments.json"),
    events_file: Optional[UploadFile] = File(None, description="rollout_events.jsonl"),
    users_file: Optional[UploadFile] = File(None, description="users.csv"),
    db: Session = Depends(get_db)
):
    flags_content = None
    segments_content = None
    events_content = None
    users_content = None
    
    if flags_file:
        flags_content = (await flags_file.read()).decode()
    if segments_file:
        segments_content = (await segments_file.read()).decode()
    if events_file:
        events_content = (await events_file.read()).decode()
    if users_file:
        users_content = (await users_file.read()).decode()
    
    batch = AuditBatch(
        name=name,
        flags=flags_content,
        segments=segments_content,
        events=events_content,
        users=users_content
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    
    if flags_content:
        await process_flags_yaml(db, batch.id, flags_content)
    
    if segments_content:
        await process_segments_json(db, batch.id, segments_content)
    
    if events_content:
        await process_events_jsonl(db, batch.id, events_content)
    
    if users_content:
        await process_users_csv(db, batch.id, users_content)
    
    return batch

async def process_flags_yaml(db: Session, batch_id: int, content: str):
    flags_data = yaml.safe_load(content)
    if not flags_data or "flags" not in flags_data:
        return
    
    for flag_data in flags_data["flags"]:
        flag = FlagHistory(
            batch_id=batch_id,
            flag_key=flag_data["key"],
            timestamp=datetime.fromisoformat(flag_data["created_at"].replace("Z", "+00:00")) if "created_at" in flag_data else datetime.utcnow(),
            version=flag_data.get("version", 1),
            is_kill_switch=flag_data.get("is_kill_switch", False),
            kill_switch_value=flag_data.get("kill_switch_value", False),
            default_value=flag_data.get("default_value", False),
            rollout_percent=flag_data.get("rollout_percent", 0),
            targeting_rules=json.dumps(flag_data.get("targeting_rules", [])),
            is_deleted=False
        )
        db.add(flag)
    db.commit()

async def process_segments_json(db: Session, batch_id: int, content: str):
    segments_data = json.loads(content)
    if not isinstance(segments_data, list):
        return
    
    for seg_data in segments_data:
        segment = SegmentHistory(
            batch_id=batch_id,
            segment_key=seg_data["key"],
            timestamp=datetime.fromisoformat(seg_data["created_at"].replace("Z", "+00:00")) if "created_at" in seg_data else datetime.utcnow(),
            version=seg_data.get("version", 1),
            user_keys=json.dumps(seg_data.get("user_keys", [])),
            is_deleted=False
        )
        db.add(segment)
    db.commit()

async def process_events_jsonl(db: Session, batch_id: int, content: str):
    events = []
    for line in content.strip().split("\n"):
        if not line:
            continue
        events.append(json.loads(line))
    
    events.sort(key=lambda x: (x.get("timestamp", ""), x.get("version", 0)))
    
    for event_data in events:
        event = RolloutEvent(
            batch_id=batch_id,
            event_type=event_data["type"],
            flag_key=event_data.get("flag_key"),
            segment_key=event_data.get("segment_key"),
            timestamp=datetime.fromisoformat(event_data["timestamp"].replace("Z", "+00:00")) if "timestamp" in event_data else datetime.utcnow(),
            version=event_data.get("version", 1),
            data=json.dumps(event_data.get("data", {})),
            is_processed=False
        )
        db.add(event)
    db.commit()

async def process_users_csv(db: Session, batch_id: int, content: str):
    lines = content.strip().split("\n")
    if not lines:
        return
    
    reader = csv.DictReader(lines)
    for row in reader:
        user_key = row.get("user_key") or row.get("key")
        if not user_key:
            continue
        
        attributes = {k: v for k, v in row.items() if k not in ["user_key", "key"]}
        user = User(
            batch_id=batch_id,
            user_key=user_key,
            attributes=json.dumps(attributes)
        )
        db.add(user)
    db.commit()

@app.get("/api/batches", response_model=List[BatchInfo])
def list_batches(db: Session = Depends(get_db)):
    batches = db.query(AuditBatch).order_by(AuditBatch.created_at.desc()).all()
    return batches

@app.post("/api/batches/{batch_id}/replay")
async def run_replay(
    batch_id: int,
    start_time: Optional[str] = Query(None, description="ISO format start time"),
    end_time: Optional[str] = Query(None, description="ISO format end time"),
    step_minutes: int = Query(60, description="Replay step in minutes"),
    db: Session = Depends(get_db)
):
    batch = db.query(AuditBatch).filter(AuditBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    db.query(ReplayResult).filter(ReplayResult.batch_id == batch_id).delete()
    db.query(Anomaly).filter(Anomaly.batch_id == batch_id).delete()
    db.commit()
    
    evaluator = FlagEvaluator(db, batch_id)
    
    users = db.query(User).filter(User.batch_id == batch_id).all()
    if not users:
        return {"message": "No users in batch"}
    
    flags = db.query(FlagHistory).filter(FlagHistory.batch_id == batch_id).all()
    flag_keys = list(set(f.flag_key for f in flags))
    if not flag_keys:
        return {"message": "No flags in batch"}
    
    events = db.query(RolloutEvent).filter(RolloutEvent.batch_id == batch_id).order_by(RolloutEvent.timestamp).all()
    
    timestamps = []
    
    if start_time and end_time:
        start_dt = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        end_dt = datetime.fromisoformat(end_time.replace("Z", "+00:00"))
        
        current = start_dt
        while current <= end_dt:
            timestamps.append(current)
            current += timedelta(minutes=step_minutes)
    elif events:
        timestamps = [e.timestamp for e in events]
    else:
        latest_flag = db.query(FlagHistory).filter(FlagHistory.batch_id == batch_id).order_by(FlagHistory.timestamp.desc()).first()
        if latest_flag:
            timestamps = [latest_flag.timestamp]
        else:
            timestamps = [datetime.utcnow()]
    
    anomalies = []
    
    for flag_key in flag_keys:
        for user in users:
            for timestamp in timestamps:
                result = evaluator.evaluate_flag(flag_key, user.user_key, timestamp)
                
                replay_result = ReplayResult(
                    batch_id=batch_id,
                    user_key=result["user_key"],
                    flag_key=result["flag_key"],
                    timestamp=result["timestamp"],
                    version=result["version"],
                    value=result["value"],
                    is_kill_switch_override=result["is_kill_switch_override"],
                    segment_reference_issue=result["segment_reference_issue"]
                )
                db.add(replay_result)
                
                if result["segment_reference_issue"]:
                    anomalies.append({
                        "type": "segment_reference",
                        "flag_key": flag_key,
                        "segment_key": result["segment_reference_issue"].split("'")[1] if "'" in result["segment_reference_issue"] else None,
                        "timestamp": timestamp,
                        "description": result["segment_reference_issue"]
                    })
    
    for event in events:
        if event.event_type == "flag_delete":
            flag_key = event.flag_key
            later_flags = db.query(FlagHistory).filter(
                FlagHistory.batch_id == batch_id,
                FlagHistory.flag_key == flag_key,
                FlagHistory.timestamp > event.timestamp
            ).first()
            
            if later_flags and not later_flags.is_deleted:
                anomalies.append({
                    "type": "out_of_order_event",
                    "flag_key": flag_key,
                    "timestamp": event.timestamp,
                    "description": f"Out-of-order: Delete event at {event.timestamp} but later version exists"
                })
    
    for anomaly_data in anomalies:
        anomaly = Anomaly(
            batch_id=batch_id,
            anomaly_type=anomaly_data["type"],
            flag_key=anomaly_data.get("flag_key"),
            segment_key=anomaly_data.get("segment_key"),
            timestamp=anomaly_data.get("timestamp"),
            description=anomaly_data["description"]
        )
        db.add(anomaly)
    
    db.commit()
    
    return {
        "batch_id": batch_id,
        "replayed_users": len(users),
        "replayed_flags": len(flag_keys),
        "timestamps": len(timestamps),
        "anomalies_found": len(anomalies)
    }

@app.get("/api/batches/{batch_id}/replay/results", response_model=List[ReplayResultResponse])
def get_replay_results(
    batch_id: int,
    user_key: Optional[str] = Query(None),
    flag_key: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(ReplayResult).filter(ReplayResult.batch_id == batch_id)
    
    if user_key:
        query = query.filter(ReplayResult.user_key == user_key)
    if flag_key:
        query = query.filter(ReplayResult.flag_key == flag_key)
    
    results = query.order_by(ReplayResult.timestamp).limit(limit).all()
    return results

@app.get("/api/batches/{batch_id}/anomalies", response_model=List[AnomalyResponse])
def get_anomalies(
    batch_id: int,
    anomaly_type: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Anomaly).filter(Anomaly.batch_id == batch_id)
    
    if anomaly_type:
        query = query.filter(Anomaly.anomaly_type == anomaly_type)
    
    return query.all()

@app.get("/api/batches/{batch_id}/export/issues.csv")
async def export_issues_csv(
    batch_id: int,
    db: Session = Depends(get_db)
):
    batch = db.query(AuditBatch).filter(AuditBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    anomalies = db.query(Anomaly).filter(Anomaly.batch_id == batch_id).all()
    
    file_path = f"/tmp/issues_batch_{batch_id}.csv"
    with open(file_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["id", "anomaly_type", "flag_key", "segment_key", "timestamp", "description"])
        for a in anomalies:
            writer.writerow([
                a.id,
                a.anomaly_type,
                a.flag_key or "",
                a.segment_key or "",
                a.timestamp.isoformat() if a.timestamp else "",
                a.description
            ])
    
    return FileResponse(
        file_path,
        media_type="text/csv",
        filename=f"issues_batch_{batch_id}.csv"
    )

@app.get("/api/batches/{batch_id}/export/replay_report.md")
async def export_replay_report(
    batch_id: int,
    db: Session = Depends(get_db)
):
    batch = db.query(AuditBatch).filter(AuditBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    users = db.query(User).filter(User.batch_id == batch_id).all()
    flags = db.query(FlagHistory).filter(FlagHistory.batch_id == batch_id).all()
    flag_keys = list(set(f.flag_key for f in flags))
    segments = db.query(SegmentHistory).filter(SegmentHistory.batch_id == batch_id).all()
    segment_keys = list(set(s.segment_key for s in segments))
    events = db.query(RolloutEvent).filter(RolloutEvent.batch_id == batch_id).all()
    replay_results = db.query(ReplayResult).filter(ReplayResult.batch_id == batch_id).all()
    anomalies = db.query(Anomaly).filter(Anomaly.batch_id == batch_id).all()
    
    file_path = f"/tmp/replay_report_batch_{batch_id}.md"
    with open(file_path, "w") as f:
        f.write(f"# Feature Flag Replay Report - Batch {batch_id}\n\n")
        f.write(f"**Batch Name**: {batch.name}\n")
        f.write(f"**Created At**: {batch.created_at.isoformat()}\n\n")
        
        f.write("## Summary\n\n")
        f.write(f"- **Total Users**: {len(users)}\n")
        f.write(f"- **Total Flags**: {len(flag_keys)}\n")
        f.write(f"- **Total Segments**: {len(segment_keys)}\n")
        f.write(f"- **Total Rollout Events**: {len(events)}\n")
        f.write(f"- **Total Replay Results**: {len(replay_results)}\n")
        f.write(f"- **Total Anomalies**: {len(anomalies)}\n\n")
        
        if anomalies:
            f.write("## Anomalies\n\n")
            anomaly_types = {}
            for a in anomalies:
                anomaly_types[a.anomaly_type] = anomaly_types.get(a.anomaly_type, 0) + 1
            
            for typ, count in anomaly_types.items():
                f.write(f"- **{typ}**: {count}\n")
            f.write("\n")
            
            f.write("### Details\n\n")
            for a in anomalies:
                f.write(f"#### {a.anomaly_type} (ID: {a.id})\n\n")
                if a.flag_key:
                    f.write(f"- **Flag**: {a.flag_key}\n")
                if a.segment_key:
                    f.write(f"- **Segment**: {a.segment_key}\n")
                if a.timestamp:
                    f.write(f"- **Timestamp**: {a.timestamp.isoformat()}\n")
                f.write(f"- **Description**: {a.description}\n\n")
        
        f.write("## Flags\n\n")
        for flag_key in sorted(flag_keys):
            flag_versions = [f for f in flags if f.flag_key == flag_key]
            f.write(f"### {flag_key}\n\n")
            f.write(f"- **Versions**: {len(flag_versions)}\n")
            for v in sorted(flag_versions, key=lambda x: x.version):
                f.write(f"  - Version {v.version}: {'Kill Switch Active' if v.is_kill_switch else ''} Default={v.default_value}, Rollout={v.rollout_percent}%\n")
            f.write("\n")
        
        f.write("## Sample Replay Results\n\n")
        if replay_results:
            f.write("| User | Flag | Timestamp | Version | Value | Kill Switch | Segment Issue |\n")
            f.write("|------|------|-----------|---------|-------|-------------|---------------|\n")
            for r in replay_results[:20]:
                f.write(f"| {r.user_key} | {r.flag_key} | {r.timestamp.isoformat() if r.timestamp else '-'} | {r.version or '-'} | {r.value} | {'Yes' if r.is_kill_switch_override else 'No'} | {r.segment_reference_issue or '-'} |\n")
        else:
            f.write("No replay results available. Run `/api/batches/{batch_id}/replay` first.\n")
    
    return FileResponse(
        file_path,
        media_type="text/markdown",
        filename=f"replay_report_batch_{batch_id}.md"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
