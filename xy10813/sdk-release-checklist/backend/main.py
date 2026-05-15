from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
import os
from dotenv import load_dotenv

from database import get_db, engine
import models
import schemas
from services import (
    SDKVersionService, ReleaseValidationService,
    CompensationService, ExportService
)
from models import ReleaseStatus

load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SDK发布检查台 API",
    description="SDK发布流程管理和验证系统",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/v1/health")
def health_check():
    return {"status": "healthy", "service": "SDK发布检查台"}


@app.post("/api/v1/sdk-versions", response_model=schemas.SDKVersion)
def create_sdk_version(
    sdk_data: schemas.SDKVersionCreate,
    db: Session = Depends(get_db)
):
    try:
        return SDKVersionService.create_sdk_version(db, sdk_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"创建失败: {str(e)}")


@app.get("/api/v1/sdk-versions", response_model=List[schemas.SDKVersion])
def list_sdk_versions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    status: Optional[ReleaseStatus] = None,
    sdk_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return SDKVersionService.list_sdk_versions(db, skip, limit, status, sdk_name)


@app.get("/api/v1/sdk-versions/{sdk_id}", response_model=schemas.SDKVersion)
def get_sdk_version(sdk_id: int, db: Session = Depends(get_db)):
    sdk = SDKVersionService.get_sdk_version(db, sdk_id)
    if not sdk:
        raise HTTPException(status_code=404, detail="SDK版本不存在")
    return sdk


@app.post("/api/v1/sdk-versions/{sdk_id}/transition", response_model=schemas.SDKVersion)
def transition_status(
    sdk_id: int,
    transition: schemas.StatusTransition,
    db: Session = Depends(get_db)
):
    try:
        return SDKVersionService.transition_status(db, sdk_id, transition)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/v1/sdk-versions/{sdk_id}/validate", response_model=schemas.ReleaseValidationResult)
def validate_release(
    sdk_id: int,
    target_status: ReleaseStatus = Query(...),
    db: Session = Depends(get_db)
):
    sdk = SDKVersionService.get_sdk_version(db, sdk_id)
    if not sdk:
        raise HTTPException(status_code=404, detail="SDK版本不存在")
    return ReleaseValidationService.validate_for_status(db, sdk, target_status)


@app.post("/api/v1/sdk-versions/{sdk_id}/mark-dirty", response_model=schemas.SDKVersion)
def mark_dirty(
    sdk_id: int,
    reason: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        return SDKVersionService.mark_dirty(db, sdk_id, reason)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/v1/sdk-versions/{sdk_id}/clean-dirty", response_model=schemas.SDKVersion)
def clean_dirty(sdk_id: int, db: Session = Depends(get_db)):
    try:
        return SDKVersionService.clean_dirty(db, sdk_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.put("/api/v1/interface-diffs/{diff_id}", response_model=schemas.InterfaceDiff)
def update_interface_diff(
    diff_id: int,
    update_data: schemas.InterfaceDiffUpdate,
    db: Session = Depends(get_db)
):
    diff = db.query(models.InterfaceDiff).filter(models.InterfaceDiff.id == diff_id).first()
    if not diff:
        raise HTTPException(status_code=404, detail="接口差异不存在")
    
    if update_data.verified is not None:
        diff.verified = update_data.verified
        diff.verified_by = update_data.verified_by
        from datetime import datetime
        diff.verified_at = datetime.utcnow()
    
    db.commit()
    db.refresh(diff)
    return diff


@app.put("/api/v1/example-projects/{project_id}", response_model=schemas.ExampleProject)
def update_example_project(
    project_id: int,
    update_data: schemas.ExampleProjectUpdate,
    db: Session = Depends(get_db)
):
    project = db.query(models.ExampleProject).filter(models.ExampleProject.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="示例项目不存在")
    
    if update_data.build_status is not None:
        project.build_status = update_data.build_status
    if update_data.test_status is not None:
        project.test_status = update_data.test_status
    if update_data.verified is not None:
        project.verified = update_data.verified
        project.verified_by = update_data.verified_by
        project.verification_notes = update_data.verification_notes
        from datetime import datetime
        project.verified_at = datetime.utcnow()
    
    db.commit()
    db.refresh(project)
    return project


@app.put("/api/v1/compatibility-matrix/{matrix_id}", response_model=schemas.CompatibilityMatrix)
def update_compatibility_matrix(
    matrix_id: int,
    update_data: schemas.CompatibilityMatrixUpdate,
    db: Session = Depends(get_db)
):
    matrix = db.query(models.CompatibilityMatrix).filter(models.CompatibilityMatrix.id == matrix_id).first()
    if not matrix:
        raise HTTPException(status_code=404, detail="兼容矩阵项不存在")
    
    if update_data.confirmed is not None:
        matrix.confirmed = update_data.confirmed
        matrix.confirmed_by = update_data.confirmed_by
        from datetime import datetime
        matrix.confirmed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(matrix)
    return matrix


@app.put("/api/v1/release-tasks/{task_id}", response_model=schemas.ReleaseTask)
def update_release_task(
    task_id: int,
    update_data: schemas.ReleaseTaskUpdate,
    db: Session = Depends(get_db)
):
    task = db.query(models.ReleaseTask).filter(models.ReleaseTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="发布任务不存在")
    
    if update_data.status is not None:
        task.status = update_data.status
        if update_data.status == "completed":
            from datetime import datetime
            task.completed_at = datetime.utcnow()
            task.completed_by = update_data.completed_by
    if update_data.notes is not None:
        task.notes = update_data.notes
    
    db.commit()
    db.refresh(task)
    return task


@app.post("/api/v1/sdk-versions/{sdk_id}/rollback", response_model=schemas.SDKVersion)
def rollback_release(
    sdk_id: int,
    rollback_data: schemas.RollbackNoteCreate,
    executed_by: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        return CompensationService.rollback_release(db, sdk_id, rollback_data, executed_by)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/v1/sdk-versions/{sdk_id}/compensation-actions", response_model=schemas.CompensationAction)
def create_compensation_action(
    sdk_id: int,
    action_data: schemas.CompensationActionCreate,
    executed_by: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        return CompensationService.create_compensation_action(db, sdk_id, action_data, executed_by)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/v1/compensation-actions/{action_id}/execute", response_model=schemas.CompensationAction)
def execute_compensation_action(action_id: int, db: Session = Depends(get_db)):
    try:
        return CompensationService.execute_compensation(db, action_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/v1/sdk-versions/{sdk_id}/export")
def export_release(sdk_id: int, db: Session = Depends(get_db)):
    try:
        return ExportService.export_release_record(db, sdk_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/v1/status-list")
def get_status_list():
    return {
        "statuses": [
            {"value": s.value, "label": s.value.replace("_", " ").title()}
            for s in ReleaseStatus
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
