from fastapi import FastAPI, HTTPException, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from pydantic import BaseModel
from datetime import datetime
import json
import enum
import re
from typing import List, Optional, Dict, Any

import os
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./drift_check.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    ANALYZED = "analyzed"
    CONFIRMED = "confirmed"
    RESOLVED = "resolved"
    CLOSED = "closed"
    REJECTED = "rejected"


class ChangeAction(str, enum.Enum):
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    NO_OP = "no-op"
    READ = "read"


class DriftTask(Base):
    __tablename__ = "drift_tasks"

    id = Column(Integer, primary_key=True, index=True)
    plan_file_name = Column(String, index=True)
    plan_content = Column(Text)
    status = Column(String, default=TaskStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by = Column(String, default="system")
    handler = Column(String, nullable=True)
    conclusion = Column(Text, nullable=True)
    raw_input = Column(Text)

    resources = relationship("DriftResource", back_populates="task", cascade="all, delete-orphan")


class DriftResource(Base):
    __tablename__ = "drift_resources"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("drift_tasks.id"))
    resource_address = Column(String, index=True)
    change_action = Column(String)
    sensitive_fields = Column(Text)
    responsible_team = Column(String, index=True)
    summary = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

    task = relationship("DriftTask", back_populates="resources")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


Base.metadata.create_all(bind=engine)

app = FastAPI(title="漂移摘要敏感遮蔽责任团队后端API")


class PlanInput(BaseModel):
    plan_file_name: str
    plan_content: str
    created_by: Optional[str] = "system"


class ResourceUpdate(BaseModel):
    resource_address: str
    change_action: Optional[str] = None
    sensitive_fields: Optional[List[str]] = None
    responsible_team: Optional[str] = None
    summary: Optional[str] = None


class TaskUpdate(BaseModel):
    status: TaskStatus
    handler: Optional[str] = None
    conclusion: Optional[str] = None


class DriftResourceResponse(BaseModel):
    id: int
    task_id: int
    resource_address: str
    change_action: str
    sensitive_fields: List[str]
    responsible_team: str
    summary: str
    created_at: datetime

    @classmethod
    def from_orm(cls, obj):
        data = obj.__dict__.copy()
        if data.get("sensitive_fields"):
            try:
                data["sensitive_fields"] = json.loads(data["sensitive_fields"])
            except:
                data["sensitive_fields"] = []
        else:
            data["sensitive_fields"] = []
        return cls(**data)

    class Config:
        orm_mode = True


class DriftTaskResponse(BaseModel):
    id: int
    plan_file_name: str
    status: str
    created_at: datetime
    updated_at: datetime
    created_by: str
    handler: Optional[str]
    conclusion: Optional[str]
    resources: List[DriftResourceResponse]

    @classmethod
    def from_orm(cls, obj):
        data = obj.__dict__.copy()
        data["resources"] = [DriftResourceResponse.from_orm(r) for r in obj.resources]
        return cls(**data)

    class Config:
        orm_mode = True


SENSITIVE_PATTERNS = [
    r".*password.*",
    r".*secret.*",
    r".*token.*",
    r".*key.*",
    r".*credential.*",
    r".*private.*",
    r".*cert.*",
]


TEAM_MAPPING = {
    r".*aws.*": "cloud-infra",
    r".*kubernetes.*": "k8s-team",
    r".*database.*": "dba-team",
    r".*network.*": "network-team",
    r".*security.*": "security-team",
    r".*application.*": "app-team",
}


def classify_action(action: str) -> str:
    action_lower = action.lower()
    if "create" in action_lower or "add" in action_lower:
        return ChangeAction.CREATE
    elif "update" in action_lower or "modify" in action_lower or "change" in action_lower:
        return ChangeAction.UPDATE
    elif "delete" in action_lower or "remove" in action_lower or "destroy" in action_lower:
        return ChangeAction.DELETE
    elif "read" in action_lower:
        return ChangeAction.READ
    return ChangeAction.NO_OP


def mask_sensitive_fields(fields: List[str]) -> List[str]:
    masked = []
    for field in fields:
        field_lower = field.lower()
        for pattern in SENSITIVE_PATTERNS:
            if re.match(pattern, field_lower, re.IGNORECASE):
                masked.append(field)
                break
    return masked


def assign_team(resource_address: str) -> str:
    for pattern, team in TEAM_MAPPING.items():
        if re.match(pattern, resource_address, re.IGNORECASE):
            return team
    return "default-team"


def parse_plan(plan_content: str) -> List[Dict[str, Any]]:
    resources = []
    try:
        plan_data = json.loads(plan_content)
        if "resource_changes" in plan_data:
            for change in plan_data["resource_changes"]:
                resource_address = change.get("address", "")
                actions = change.get("actions", [])
                action_str = ",".join(actions) if actions else "no-op"
                change_action = classify_action(action_str)
                
                changed_fields = []
                if "change" in change and "after" in change["change"]:
                    changed_fields = list(change["change"]["after"].keys()) if change["change"]["after"] else []
                
                sensitive_fields = mask_sensitive_fields(changed_fields)
                responsible_team = assign_team(resource_address)
                summary = f"Resource {resource_address} will perform {change_action}"
                
                resources.append({
                    "resource_address": resource_address,
                    "change_action": change_action,
                    "sensitive_fields": sensitive_fields,
                    "responsible_team": responsible_team,
                    "summary": summary
                })
    except json.JSONDecodeError:
        lines = plan_content.split("\n")
        current_resource = None
        for line in lines:
            if "resource" in line and '"' in line:
                match = re.search(r'"([^"]+)"\s+"([^"]+)"', line)
                if match:
                    resource_type, resource_name = match.groups()
                    current_resource = f"{resource_type}.{resource_name}"
            elif "->" in line or "~>" in line or "+>" in line or "-" in line:
                if current_resource:
                    action = classify_action(line)
                    resources.append({
                        "resource_address": current_resource,
                        "change_action": action,
                        "sensitive_fields": [],
                        "responsible_team": assign_team(current_resource),
                        "summary": f"Resource {current_resource} detected change"
                    })
    return resources


@app.post("/api/tasks")
def create_task(plan_input: PlanInput, db: Session = Depends(get_db)):
    task = DriftTask(
        plan_file_name=plan_input.plan_file_name,
        plan_content=plan_input.plan_content,
        created_by=plan_input.created_by,
        raw_input=json.dumps(plan_input.dict())
    )
    db.add(task)
    db.flush()
    
    resources = parse_plan(plan_input.plan_content)
    for res in resources:
        db_resource = DriftResource(
            task_id=task.id,
            resource_address=res["resource_address"],
            change_action=res["change_action"],
            sensitive_fields=json.dumps(res["sensitive_fields"]),
            responsible_team=res["responsible_team"],
            summary=res["summary"]
        )
        db.add(db_resource)
    
    task.status = TaskStatus.ANALYZED
    db.commit()
    db.refresh(task)
    return DriftTaskResponse.from_orm(task)


@app.get("/api/tasks")
def list_tasks(status: Optional[str] = None, team: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(DriftTask)
    if status:
        query = query.filter(DriftTask.status == status)
    if team:
        query = query.join(DriftResource).filter(DriftResource.responsible_team == team)
    tasks = query.offset(skip).limit(limit).all()
    return [DriftTaskResponse.from_orm(t) for t in tasks]


@app.get("/api/tasks/{task_id}")
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DriftTask).filter(DriftTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return DriftTaskResponse.from_orm(task)


@app.put("/api/tasks/{task_id}/status")
def update_task_status(task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(DriftTask).filter(DriftTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.status = task_update.status
    if task_update.handler:
        task.handler = task_update.handler
    if task_update.conclusion:
        task.conclusion = task_update.conclusion
    task.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(task)
    return DriftTaskResponse.from_orm(task)


@app.put("/api/tasks/{task_id}/resources")
def update_resource(task_id: int, resource_update: ResourceUpdate, db: Session = Depends(get_db)):
    resource = db.query(DriftResource).filter(
        DriftResource.task_id == task_id,
        DriftResource.resource_address == resource_update.resource_address
    ).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    if resource_update.change_action:
        resource.change_action = resource_update.change_action
    if resource_update.sensitive_fields is not None:
        resource.sensitive_fields = json.dumps(resource_update.sensitive_fields)
    if resource_update.responsible_team:
        resource.responsible_team = resource_update.responsible_team
    if resource_update.summary:
        resource.summary = resource_update.summary
    
    db.commit()
    return {"message": "Resource updated successfully"}


class HandleInput(BaseModel):
    handler: str
    conclusion: str


@app.post("/api/tasks/{task_id}/close")
def close_task(task_id: int, handle_input: HandleInput, db: Session = Depends(get_db)):
    task = db.query(DriftTask).filter(DriftTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.status = TaskStatus.CLOSED
    task.handler = handle_input.handler
    task.conclusion = handle_input.conclusion
    task.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Task closed successfully"}


@app.post("/api/tasks/{task_id}/reject")
def reject_task(task_id: int, handle_input: HandleInput, db: Session = Depends(get_db)):
    task = db.query(DriftTask).filter(DriftTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.status = TaskStatus.REJECTED
    task.handler = handle_input.handler
    task.conclusion = handle_input.conclusion
    task.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Task rejected successfully"}


@app.get("/api/tasks/{task_id}/export")
def export_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(DriftTask).filter(DriftTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    resources = []
    for res in task.resources:
        resources.append({
            "resource_address": res.resource_address,
            "change_action": res.change_action,
            "sensitive_fields": json.loads(res.sensitive_fields) if res.sensitive_fields else [],
            "responsible_team": res.responsible_team,
            "summary": res.summary
        })
    
    report = {
        "task_id": task.id,
        "plan_file_name": task.plan_file_name,
        "status": task.status,
        "created_at": task.created_at.isoformat(),
        "created_by": task.created_by,
        "handler": task.handler,
        "conclusion": task.conclusion,
        "resources": resources,
        "summary": {
            "total_resources": len(resources),
            "by_action": {},
            "by_team": {}
        }
    }
    
    for res in resources:
        action = res["change_action"]
        team = res["responsible_team"]
        report["summary"]["by_action"][action] = report["summary"]["by_action"].get(action, 0) + 1
        report["summary"]["by_team"][team] = report["summary"]["by_team"].get(team, 0) + 1
    
    return JSONResponse(content=report)


@app.get("/api/teams")
def list_teams(db: Session = Depends(get_db)):
    teams = db.query(DriftResource.responsible_team).distinct().all()
    return {"teams": [t[0] for t in teams]}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
