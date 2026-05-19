from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json

from database import init_db, get_db, FeatureFlag, ConflictRecord, ResolutionLog
from schemas import (
    FeatureFlagCreate, FeatureFlagUpdate, FeatureFlag as FeatureFlagSchema,
    ConflictRecord as ConflictRecordSchema,
    ResolutionLog as ResolutionLogSchema,
    ConflictEvaluationRequest, ConflictResolutionRequest
)
from conflict_engine import ConflictResolver

app = FastAPI(title="Featureflag冲突解析后端API", version="1.0.0")


@app.on_event("startup")
def startup_event():
    init_db()


@app.post("/api/feature-flags/", response_model=FeatureFlagSchema, tags=["Feature Flags"])
def create_feature_flag(flag: FeatureFlagCreate, db: Session = Depends(get_db)):
    db_flag = FeatureFlag(**flag.dict())
    db.add(db_flag)
    db.commit()
    db.refresh(db_flag)
    return db_flag


@app.get("/api/feature-flags/", response_model=List[FeatureFlagSchema], tags=["Feature Flags"])
def list_feature_flags(skip: int = 0, limit: int = 100, is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    query = db.query(FeatureFlag)
    if is_active is not None:
        query = query.filter(FeatureFlag.is_active == is_active)
    return query.offset(skip).limit(limit).all()


@app.get("/api/feature-flags/{flag_id}", response_model=FeatureFlagSchema, tags=["Feature Flags"])
def get_feature_flag(flag_id: int, db: Session = Depends(get_db)):
    flag = db.query(FeatureFlag).filter(FeatureFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    return flag


@app.put("/api/feature-flags/{flag_id}", response_model=FeatureFlagSchema, tags=["Feature Flags"])
def update_feature_flag(flag_id: int, flag_update: FeatureFlagUpdate, db: Session = Depends(get_db)):
    flag = db.query(FeatureFlag).filter(FeatureFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")

    update_data = flag_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(flag, key, value)
    flag.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(flag)
    return flag


@app.delete("/api/feature-flags/{flag_id}", tags=["Feature Flags"])
def delete_feature_flag(flag_id: int, db: Session = Depends(get_db)):
    flag = db.query(FeatureFlag).filter(FeatureFlag.id == flag_id).first()
    if not flag:
        raise HTTPException(status_code=404, detail="Feature flag not found")
    flag.is_active = False
    db.commit()
    return {"message": "Feature flag deactivated successfully"}


@app.post("/api/conflicts/evaluate", tags=["Conflicts"])
def evaluate_conflict(request: ConflictEvaluationRequest, db: Session = Depends(get_db)):
    resolver = ConflictResolver(db)
    result = resolver.evaluate_flags_for_user(request.user_id, request.user_context)
    return result


@app.get("/api/conflicts/", response_model=List[ConflictRecordSchema], tags=["Conflicts"])
def list_conflicts(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ConflictRecord)
    if status:
        query = query.filter(ConflictRecord.status == status)
    if user_id:
        query = query.filter(ConflictRecord.user_id == user_id)
    return query.order_by(ConflictRecord.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/api/conflicts/{conflict_id}", response_model=ConflictRecordSchema, tags=["Conflicts"])
def get_conflict(conflict_id: int, db: Session = Depends(get_db)):
    conflict = db.query(ConflictRecord).filter(ConflictRecord.id == conflict_id).first()
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")
    return conflict


@app.post("/api/conflicts/resolve", tags=["Conflicts"])
def resolve_conflict(request: ConflictResolutionRequest, db: Session = Depends(get_db)):
    resolver = ConflictResolver(db)
    try:
        conflict = resolver.resolve_conflict(
            conflict_id=request.conflict_id,
            resolution=request.resolution,
            operator=request.operator,
            final_result=request.final_result,
            selected_flag_id=request.selected_flag_id
        )
        return conflict
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/conflicts/{conflict_id}/withdraw", tags=["Conflicts"])
def withdraw_conflict(conflict_id: int, operator: str, reason: str, db: Session = Depends(get_db)):
    resolver = ConflictResolver(db)
    try:
        conflict = resolver.withdraw_conflict(conflict_id, operator, reason)
        return conflict
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/conflicts/{conflict_id}/close", tags=["Conflicts"])
def close_conflict(conflict_id: int, operator: str, reason: str, db: Session = Depends(get_db)):
    resolver = ConflictResolver(db)
    try:
        conflict = resolver.close_conflict(conflict_id, operator, reason)
        return conflict
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/conflicts/{conflict_id}/report", tags=["Conflicts"])
def get_conflict_report(conflict_id: int, db: Session = Depends(get_db)):
    resolver = ConflictResolver(db)
    try:
        report = resolver.generate_report(conflict_id)
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/conflicts/{conflict_id}/export", tags=["Export"])
def export_conflict_report(conflict_id: int, db: Session = Depends(get_db)):
    resolver = ConflictResolver(db)
    try:
        report = resolver.generate_report(conflict_id)
        content = json.dumps(report, ensure_ascii=False, indent=2)
        return JSONResponse(
            content=report,
            headers={
                "Content-Disposition": f"attachment; filename=conflict_report_{conflict_id}.json"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/conflicts/{conflict_id}/logs", response_model=List[ResolutionLogSchema], tags=["Conflicts"])
def get_conflict_logs(conflict_id: int, db: Session = Depends(get_db)):
    logs = db.query(ResolutionLog).filter(ResolutionLog.conflict_id == conflict_id).order_by(ResolutionLog.created_at).all()
    return logs


@app.get("/api/health", tags=["System"])
def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
