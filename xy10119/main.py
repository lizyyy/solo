import os
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json

from backend.database import init_db, get_db, Project, Sample, Annotation, Conflict, ReviewDecision, Version
from backend.schemas import (
    ProjectCreate, ProjectResponse,
    SampleCreate, SampleResponse,
    AnnotationCreate, AnnotationResponse,
    ReviewDecisionCreate, ReviewDecisionResponse,
    ConflictResponse, VersionResponse,
    ReportSummary, ImportRequest
)
from backend.services import (
    get_consistency_checker,
    DataImporter,
    VersionController,
    ReviewService,
    ReportGenerator
)

init_db()

app = FastAPI(
    title="标注样本一致性审计器",
    description="Annotation Sample Consistency Auditor - 确保多人标注样本的一致性，追踪复核历史",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("frontend", exist_ok=True)


@app.get("/")
async def root():
    return FileResponse("frontend/index.html")


# ==================== 项目管理 ====================

@app.get("/api/projects", response_model=List[ProjectResponse])
async def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.updated_at.desc()).all()
    return projects


@app.post("/api/projects", response_model=ProjectResponse)
async def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    new_project = Project(name=project.name, description=project.description)
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    
    vc = VersionController(db)
    vc.create_version(
        project_id=new_project.id,
        action="create",
        description="Project created",
        affected_samples=0,
        created_by="system"
    )
    
    return new_project


@app.get("/api/projects/{project_id}", response_model=ProjectResponse)
async def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}


# ==================== 数据导入 ====================

@app.post("/api/projects/{project_id}/import")
async def import_data(
    project_id: int,
    format: str = Query(..., description="Import format: json, jsonl, csv, xlsx"),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    try:
        importer = DataImporter(db)
        vc = VersionController(db)
        
        if format == "json":
            content = await file.read()
            data = json.loads(content.decode('utf-8'))
            result = importer.import_from_json(project_id, data)
        elif format == "jsonl":
            content = (await file.read()).decode('utf-8')
            result = importer.import_from_jsonl(project_id, content)
        elif format == "csv":
            file_content = await file.read()
            result = importer.import_from_csv(project_id, file_content)
        elif format == "xlsx":
            file_content = await file.read()
            result = importer.import_from_excel(project_id, file_content)
        else:
            raise HTTPException(status_code=400, detail="Unsupported format")
        
        vc.create_version(
            project_id=project_id,
            action="import",
            description=f"Imported {result['samples_created']} samples, {result['annotations_added']} annotations",
            affected_samples=result['samples_created'],
            created_by="system"
        )
        
        checker = get_consistency_checker(db)
        conflicts = checker.detect_conflicts(project_id)
        result["conflicts_detected"] = len(conflicts)
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 样本管理 ====================

@app.get("/api/projects/{project_id}/samples", response_model=List[SampleResponse])
async def list_samples(
    project_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    samples = (
        db.query(Sample)
        .filter(Sample.project_id == project_id)
        .order_by(Sample.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return samples


@app.get("/api/samples/{sample_id}")
async def get_sample(sample_id: int, db: Session = Depends(get_db)):
    sample = db.query(Sample).filter(Sample.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    
    rs = ReviewService(db)
    return rs.get_sample_history(sample_id)


@app.post("/api/projects/{project_id}/samples", response_model=SampleResponse)
async def add_sample(
    project_id: int,
    sample_data: SampleCreate,
    db: Session = Depends(get_db)
):
    sample = Sample(
        project_id=project_id,
        content=sample_data.content,
        external_id=sample_data.external_id,
        sample_metadata=sample_data.sample_metadata
    )
    db.add(sample)
    db.flush()
    
    for ann in sample_data.annotations:
        annotation = Annotation(
            sample_id=sample.id,
            annotator=ann.annotator,
            label=ann.label,
            confidence=ann.confidence,
            reasoning=ann.reasoning
        )
        db.add(annotation)
    
    db.commit()
    db.refresh(sample)
    
    checker = get_consistency_checker(db)
    is_consistent, info = checker.check_sample_consistency(sample)
    if not is_consistent:
        conflicts = checker.detect_conflicts(project_id)
    
    return sample


# ==================== 冲突检测与复核 ====================

@app.post("/api/projects/{project_id}/detect-conflicts")
async def detect_conflicts(
    project_id: int,
    method: str = "rule_based",
    db: Session = Depends(get_db)
):
    try:
        checker = get_consistency_checker(db, method)
        conflicts = checker.detect_conflicts(project_id)
        return {
            "project_id": project_id,
            "detection_method": method,
            "total_conflicts": len(conflicts),
            "conflicts": conflicts
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/{project_id}/conflicts")
async def list_conflicts(
    project_id: int,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Conflict).join(Sample).filter(Sample.project_id == project_id)
    
    if status:
        query = query.filter(Conflict.status == status)
    if severity:
        query = query.filter(Conflict.severity == severity)
    
    conflicts = query.order_by(Conflict.created_at.desc()).all()
    
    result = []
    for conflict in conflicts:
        annotations = [a for a in conflict.sample.annotations if a.is_active]
        result.append({
            **ConflictResponse.from_orm(conflict).dict(),
            "sample": SampleResponse.from_orm(conflict.sample).dict(),
            "annotations": [AnnotationResponse.from_orm(a).dict() for a in annotations]
        })
    
    return result


@app.get("/api/conflicts/{conflict_id}")
async def get_conflict(conflict_id: int, db: Session = Depends(get_db)):
    conflict = db.query(Conflict).filter(Conflict.id == conflict_id).first()
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")
    
    annotations = [a for a in conflict.sample.annotations]
    
    return {
        "conflict": ConflictResponse.from_orm(conflict).dict(),
        "sample": SampleResponse.from_orm(conflict.sample).dict(),
        "annotations": [AnnotationResponse.from_orm(a).dict() for a in annotations]
    }


@app.post("/api/conflicts/{conflict_id}/decide")
async def make_decision(
    conflict_id: int,
    decision: ReviewDecisionCreate,
    db: Session = Depends(get_db)
):
    try:
        rs = ReviewService(db)
        result = rs.make_decision(conflict_id, decision)
        
        conflict = db.query(Conflict).filter(Conflict.id == conflict_id).first()
        if conflict:
            vc = VersionController(db)
            vc.create_version(
                project_id=conflict.sample.project_id,
                action="review_decision",
                description=f"Decision made on conflict {conflict_id}: {decision.decision}",
                affected_samples=1,
                created_by=decision.reviewer
            )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/conflicts/{conflict_id}/revert")
async def revert_decision(
    conflict_id: int,
    reviewer: str = "system",
    db: Session = Depends(get_db)
):
    try:
        rs = ReviewService(db)
        result = rs.revert_decision(conflict_id, reviewer)
        
        conflict = db.query(Conflict).filter(Conflict.id == conflict_id).first()
        if conflict:
            vc = VersionController(db)
            vc.create_version(
                project_id=conflict.sample.project_id,
                action="revert_decision",
                description=f"Reverted decision on conflict {conflict_id}",
                affected_samples=1,
                created_by=reviewer
            )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/conflicts/{conflict_id}/history")
async def get_decision_history(conflict_id: int, db: Session = Depends(get_db)):
    try:
        rs = ReviewService(db)
        return rs.get_decision_history(conflict_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/projects/{project_id}/batch-decide")
async def batch_decide(
    project_id: int,
    conflict_ids: List[int],
    decision: str,
    reviewer: str,
    reasoning: str,
    db: Session = Depends(get_db)
):
    try:
        rs = ReviewService(db)
        result = rs.batch_decide(conflict_ids, decision, reviewer, reasoning)
        
        if result["successful"]:
            vc = VersionController(db)
            vc.create_version(
                project_id=project_id,
                action="batch_review",
                description=f"Batch decided {len(result['successful'])} conflicts: {decision}",
                affected_samples=len(result['successful']),
                created_by=reviewer
            )
        
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== 版本管理 ====================

@app.get("/api/projects/{project_id}/versions", response_model=List[VersionResponse])
async def list_versions(project_id: int, db: Session = Depends(get_db)):
    vc = VersionController(db)
    return vc.get_versions(project_id)


@app.get("/api/versions/{version_id}")
async def get_version(version_id: int, db: Session = Depends(get_db)):
    vc = VersionController(db)
    version = vc.get_version(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    snapshot = json.loads(version.snapshot_data)
    return {
        "version": VersionResponse.from_orm(version).dict(),
        "snapshot": snapshot
    }


@app.post("/api/versions/{version_id}/rollback")
async def rollback_to_version(
    version_id: int,
    reviewer: str = "system",
    db: Session = Depends(get_db)
):
    try:
        vc = VersionController(db)
        return vc.rollback_to_version(version_id, reviewer)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/versions/diff")
async def version_diff(
    version_id1: int,
    version_id2: int,
    db: Session = Depends(get_db)
):
    try:
        vc = VersionController(db)
        return vc.get_version_diff(version_id1, version_id2)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ==================== 报告导出 ====================

@app.get("/api/projects/{project_id}/report/summary", response_model=ReportSummary)
async def get_report_summary(project_id: int, db: Session = Depends(get_db)):
    try:
        rg = ReportGenerator(db)
        summary = rg.generate_summary(project_id)
        return ReportSummary(
            total_samples=summary["summary"]["total_samples"],
            total_conflicts=summary["summary"]["total_conflicts"],
            resolved_conflicts=summary["summary"]["resolved_conflicts"],
            pending_conflicts=summary["summary"]["pending_conflicts"],
            conflict_rate=summary["summary"]["conflict_rate_percent"],
            reviewer_consistency=None
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/{project_id}/report/full")
async def get_full_report(project_id: int, db: Session = Depends(get_db)):
    try:
        rg = ReportGenerator(db)
        return rg.generate_detailed_report(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/{project_id}/export/json")
async def export_json(project_id: int, db: Session = Depends(get_db)):
    try:
        rg = ReportGenerator(db)
        report = rg.generate_detailed_report(project_id)
        return JSONResponse(content=report)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/{project_id}/export/csv")
async def export_csv(
    project_id: int,
    data_type: str = "conflicts",
    db: Session = Depends(get_db)
):
    try:
        rg = ReportGenerator(db)
        csv_content = rg.export_to_csv(project_id, data_type)
        
        from fastapi.responses import Response
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=export_{data_type}.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/{project_id}/export/training")
async def export_training_data(project_id: int, db: Session = Depends(get_db)):
    try:
        rg = ReportGenerator(db)
        data = rg.export_training_data(project_id)
        return JSONResponse(content=data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/projects/{project_id}/export/excel")
async def export_excel(project_id: int, db: Session = Depends(get_db)):
    try:
        rg = ReportGenerator(db)
        excel_content = rg.export_to_excel(project_id)
        
        from fastapi.responses import Response
        return Response(
            content=excel_content,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=auditor_report.xlsx"}
        )
    except ImportError:
        raise HTTPException(status_code=400, detail="openpyxl is required for Excel export")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== 标注者一致性统计 ====================

@app.get("/api/projects/{project_id}/annotator-consistency")
async def get_annotator_consistency(project_id: int, db: Session = Depends(get_db)):
    try:
        checker = get_consistency_checker(db)
        return checker.calculate_annotator_consistency(project_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
