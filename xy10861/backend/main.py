from fastapi import FastAPI, Depends, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from typing import List, Optional
from datetime import datetime
import os
import json

from models import init_db, get_db, Environment, EnvVariable, ChangeRequest, SyncRecord, DiffSnapshot
from services import EnvDiffService
from demo_data import generate_demo_data
from security import encrypt_value


class CreateEnvironmentRequest(BaseModel):
    name: str
    description: Optional[str] = None
    is_protected: bool = False


class CreateVariableRequest(BaseModel):
    key: str
    value: str
    is_sensitive: bool = False
    description: Optional[str] = None


class UpdateVariableRequest(BaseModel):
    value: Optional[str] = None
    is_sensitive: Optional[bool] = None
    description: Optional[str] = None


class CreateChangeRequestRequest(BaseModel):
    title: str
    source_env_id: int
    target_env_id: int
    variable_key: str
    proposed_value: str
    description: Optional[str] = None
    requested_by: str = "anonymous"


class ApproveChangeRequestRequest(BaseModel):
    approved_by: str = "admin"


class RejectChangeRequestRequest(BaseModel):
    reason: str
    rejected_by: str = "admin"


class SyncVariableRequest(BaseModel):
    source_env_id: int
    target_env_id: int
    variable_key: str
    new_value: str
    change_request_id: Optional[int] = None
    synced_by: str = "admin"

app = FastAPI(title="环境变量差异台 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
EXPORTS_DIR = os.path.join(BASE_DIR, "exports")

os.makedirs(EXPORTS_DIR, exist_ok=True)

@app.on_event("startup")
async def startup_event():
    init_db()
    generate_demo_data()

@app.get("/")
async def root():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/environments")
async def get_environments(db: Session = Depends(get_db)):
    environments = db.query(Environment).all()
    return {
        "success": True,
        "data": [
            {
                "id": env.id,
                "name": env.name,
                "description": env.description,
                "is_protected": env.is_protected,
                "variable_count": len(env.variables),
                "created_at": env.created_at.isoformat() if env.created_at else None
            }
            for env in environments
        ]
    }

@app.post("/api/environments")
async def create_environment(
    request: CreateEnvironmentRequest,
    db: Session = Depends(get_db)
):
    existing = db.query(Environment).filter(Environment.name == request.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Environment already exists")
    
    env = Environment(name=request.name, description=request.description, is_protected=request.is_protected)
    db.add(env)
    db.commit()
    db.refresh(env)
    
    return {"success": True, "data": {"id": env.id, "name": env.name}}

@app.get("/api/environments/{env_id}/variables")
async def get_environment_variables(
    env_id: int,
    search: Optional[str] = None,
    only_sensitive: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    env = db.query(Environment).filter(Environment.id == env_id).first()
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    query = db.query(EnvVariable).filter(EnvVariable.environment_id == env_id)
    
    if search:
        query = query.filter(EnvVariable.key.ilike(f"%{search}%"))
    
    if only_sensitive is not None:
        query = query.filter(EnvVariable.is_sensitive == only_sensitive)
    
    variables = query.order_by(EnvVariable.key).all()
    
    service = EnvDiffService(db)
    
    return {
        "success": True,
        "data": service.mask_variables(variables)
    }

@app.post("/api/environments/{env_id}/variables")
async def create_variable(
    env_id: int,
    request: CreateVariableRequest,
    db: Session = Depends(get_db)
):
    env = db.query(Environment).filter(Environment.id == env_id).first()
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    existing = db.query(EnvVariable).filter(
        EnvVariable.environment_id == env_id,
        EnvVariable.key == request.key
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Variable already exists")
    
    value_to_store = encrypt_value(request.value) if request.is_sensitive else request.value
    
    var = EnvVariable(
        environment_id=env_id,
        key=request.key,
        value=value_to_store,
        is_sensitive=request.is_sensitive,
        description=request.description
    )
    db.add(var)
    db.commit()
    db.refresh(var)
    
    service = EnvDiffService(db)
    return {"success": True, "data": service.mask_variables([var])[0]}

@app.put("/api/variables/{var_id}")
async def update_variable(
    var_id: int,
    request: UpdateVariableRequest,
    db: Session = Depends(get_db)
):
    var = db.query(EnvVariable).filter(EnvVariable.id == var_id).first()
    if not var:
        raise HTTPException(status_code=404, detail="Variable not found")
    
    if request.value is not None:
        if request.is_sensitive if request.is_sensitive is not None else var.is_sensitive:
            var.value = encrypt_value(request.value)
        else:
            var.value = request.value
    if request.is_sensitive is not None:
        var.is_sensitive = request.is_sensitive
        if request.is_sensitive and request.value is None:
            var.value = encrypt_value(var.value)
    if request.description is not None:
        var.description = request.description
    
    var.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(var)
    
    service = EnvDiffService(db)
    return {"success": True, "data": service.mask_variables([var])[0]}

@app.get("/api/diff/compare")
async def compare_environments(
    env1_id: int,
    env2_id: int,
    db: Session = Depends(get_db)
):
    service = EnvDiffService(db)
    try:
        result = service.compare_environments(env1_id, env2_id)
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/diff/exports")
async def export_differences(
    env1_id: int,
    env2_id: int,
    format: str = Query("json", enum=["json", "csv"]),
    db: Session = Depends(get_db)
):
    service = EnvDiffService(db)
    try:
        content, filename, content_type = service.export_differences(env1_id, env2_id, format)
        
        filepath = os.path.join(EXPORTS_DIR, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        
        return {
            "success": True,
            "data": {
                "filename": filename,
                "download_url": f"/exports/{filename}",
                "content_type": content_type
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/diff/snapshots")
async def get_diff_snapshots(db: Session = Depends(get_db)):
    snapshots = db.query(DiffSnapshot).order_by(DiffSnapshot.created_at.desc()).limit(20).all()
    
    return {
        "success": True,
        "data": [
            {
                "id": s.id,
                "env1_id": s.env1_id,
                "env2_id": s.env2_id,
                "env1_name": s.env1.name if s.env1 else None,
                "env2_name": s.env2.name if s.env2 else None,
                "created_by": s.created_by,
                "created_at": s.created_at.isoformat() if s.created_at else None
            }
            for s in snapshots
        ]
    }

@app.get("/api/change-requests")
async def get_change_requests(
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ChangeRequest).order_by(ChangeRequest.created_at.desc())
    
    if status:
        query = query.filter(ChangeRequest.status == status)
    
    crs = query.all()
    
    return {
        "success": True,
        "data": [
            {
                "id": cr.id,
                "title": cr.title,
                "description": cr.description,
                "source_env_id": cr.source_env_id,
                "target_env_id": cr.target_env_id,
                "source_env_name": cr.source_env.name if cr.source_env else None,
                "target_env_name": cr.target_env.name if cr.target_env else None,
                "variable_key": cr.variable_key,
                "source_value": cr.source_value,
                "target_value": cr.target_value,
                "proposed_value": cr.proposed_value,
                "status": cr.status,
                "requested_by": cr.requested_by,
                "approved_by": cr.approved_by,
                "approved_at": cr.approved_at.isoformat() if cr.approved_at else None,
                "created_at": cr.created_at.isoformat() if cr.created_at else None
            }
            for cr in crs
        ]
    }

@app.post("/api/change-requests")
async def create_change_request(
    request: CreateChangeRequestRequest,
    db: Session = Depends(get_db)
):
    service = EnvDiffService(db)
    try:
        cr = service.create_change_request(
            title=request.title,
            description=request.description,
            source_env_id=request.source_env_id,
            target_env_id=request.target_env_id,
            variable_key=request.variable_key,
            proposed_value=request.proposed_value,
            requested_by=request.requested_by
        )
        
        return {
            "success": True,
            "data": {
                "id": cr.id,
                "title": cr.title,
                "status": cr.status
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/change-requests/{cr_id}/approve")
async def approve_change_request(
    cr_id: int,
    request: ApproveChangeRequestRequest,
    db: Session = Depends(get_db)
):
    service = EnvDiffService(db)
    try:
        cr = service.approve_change_request(cr_id, request.approved_by)
        return {
            "success": True,
            "data": {
                "id": cr.id,
                "status": cr.status,
                "approved_by": cr.approved_by
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/change-requests/{cr_id}/reject")
async def reject_change_request(
    cr_id: int,
    request: RejectChangeRequestRequest,
    db: Session = Depends(get_db)
):
    service = EnvDiffService(db)
    try:
        cr = service.reject_change_request(cr_id, request.rejected_by, request.reason)
        return {
            "success": True,
            "data": {
                "id": cr.id,
                "status": cr.status
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/sync")
async def sync_variable(
    request: SyncVariableRequest,
    db: Session = Depends(get_db)
):
    service = EnvDiffService(db)
    try:
        record = service.sync_variable(
            cr_id=request.change_request_id,
            source_env_id=request.source_env_id,
            target_env_id=request.target_env_id,
            variable_key=request.variable_key,
            new_value=request.new_value,
            synced_by=request.synced_by
        )
        
        return {
            "success": True,
            "data": {
                "id": record.id,
                "status": record.status,
                "variable_key": record.variable_key
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/sync/records")
async def get_sync_records(
    limit: int = 50,
    db: Session = Depends(get_db)
):
    records = db.query(SyncRecord).order_by(SyncRecord.created_at.desc()).limit(limit).all()
    
    return {
        "success": True,
        "data": [
            {
                "id": r.id,
                "change_request_id": r.change_request_id,
                "source_env_id": r.source_env_id,
                "target_env_id": r.target_env_id,
                "source_env_name": r.source_env.name if r.source_env else None,
                "target_env_name": r.target_env.name if r.target_env else None,
                "variable_key": r.variable_key,
                "old_value": r.old_value,
                "new_value": r.new_value,
                "synced_by": r.synced_by,
                "status": r.status,
                "error_message": r.error_message,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in records
        ]
    }

@app.get("/exports/{filename}")
async def download_export(filename: str):
    filepath = os.path.join(EXPORTS_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        filepath,
        media_type="application/octet-stream",
        filename=filename
    )

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
