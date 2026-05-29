from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session

from . import models, schemas
from .database import engine, get_db
from .config import MATERIAL_TYPES, ANOMALY_TYPES
from .services.material_service import (
    create_batch,
    get_batch,
    get_batch_detail,
    list_batches,
    import_material,
    get_material,
    get_material_detail,
    list_materials,
    get_material_content,
)
from .services.log_parser import (
    parse_pipeline_logs,
    list_parsed_logs,
)
from .services.fingerprint_analyzer import (
    analyze_cache_fingerprints,
    list_cache_fingerprints,
)
from .services.failure_cluster import (
    cluster_failures,
    list_failure_clusters,
    list_anomalies,
)
from .services.reproduction_script import (
    generate_reproduction_scripts,
    list_reproduction_scripts,
)
from .services.report_service import (
    generate_analysis_report,
    review_report,
    export_report,
    list_reports,
    get_report,
)
from .sample_data import get_preset, list_presets

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CI缓存污染定位系统",
    description="用于定位CI流水线中因缓存污染、测试产物未清、环境变量漂移等问题导致的偶发失败",
    version="1.0.0",
)


@app.get("/api/meta/material-types")
def get_material_types():
    return {"code": 0, "message": "success", "data": MATERIAL_TYPES}


@app.get("/api/meta/anomaly-types")
def get_anomaly_types():
    return {"code": 0, "message": "success", "data": ANOMALY_TYPES}


@app.get("/api/samples/presets")
def list_sample_presets():
    return {"code": 0, "message": "success", "data": list_presets()}


@app.post("/api/samples/import")
def import_sample_preset(request: schemas.SampleImportRequest, db: Session = Depends(get_db)):
    preset = get_preset(request.preset)
    batch_in = schemas.BatchCreate(
        name=request.batch_name,
        description=f"导入样例预设: {request.preset} - {preset['description']}",
    )
    batch = create_batch(db, batch_in)

    imported_materials = []
    for mat_data in preset["materials"]:
        mat_in = schemas.MaterialCreate(
            batch_id=batch.id,
            material_type=mat_data["material_type"],
            name=mat_data["name"],
            source=mat_data["source"],
            content=mat_data["content"],
            meta=mat_data.get("meta", {}),
        )
        material = import_material(db, mat_in)
        imported_materials.append(material)

    return {
        "code": 0,
        "message": "success",
        "data": {
            "batch_id": batch.id,
            "batch_no": batch.batch_no,
            "materials_imported": len(imported_materials),
            "materials": [
                {"id": m.id, "type": m.material_type, "name": m.name}
                for m in imported_materials
            ],
        },
    }


@app.post("/api/batches", response_model=schemas.ApiResponse)
def create_new_batch(batch_in: schemas.BatchCreate, db: Session = Depends(get_db)):
    batch = create_batch(db, batch_in)
    return {"code": 0, "message": "success", "data": schemas.Batch.model_validate(batch)}


@app.get("/api/batches", response_model=schemas.ApiResponse)
def get_all_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    batches = list_batches(db, skip=skip, limit=limit)
    return {"code": 0, "message": "success", "data": [schemas.Batch.model_validate(b) for b in batches]}


@app.get("/api/batches/{batch_id}", response_model=schemas.ApiResponse)
def get_single_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = get_batch_detail(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"code": 0, "message": "success", "data": batch}


@app.post("/api/materials", response_model=schemas.ApiResponse)
def create_material(material_in: schemas.MaterialCreate, db: Session = Depends(get_db)):
    try:
        material = import_material(db, material_in)
        return {"code": 0, "message": "success", "data": schemas.Material.model_validate(material)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/materials", response_model=schemas.ApiResponse)
def get_all_materials(
    batch_id: Optional[int] = None,
    material_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    materials = list_materials(db, batch_id=batch_id, material_type=material_type, skip=skip, limit=limit)
    return {"code": 0, "message": "success", "data": [schemas.Material.model_validate(m) for m in materials]}


@app.get("/api/materials/{material_id}", response_model=schemas.ApiResponse)
def get_single_material(material_id: int, db: Session = Depends(get_db)):
    material = get_material_detail(db, material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    return {"code": 0, "message": "success", "data": material}


@app.get("/api/materials/{material_id}/content")
def get_material_raw_content(material_id: int, db: Session = Depends(get_db)):
    content = get_material_content(material_id, db)
    if content is None:
        raise HTTPException(status_code=404, detail="Material content not found")
    return {"code": 0, "message": "success", "data": {"content": content}}


@app.post("/api/analysis/parse-logs", response_model=schemas.ApiResponse)
def api_parse_logs(request: schemas.LogParseRequest, db: Session = Depends(get_db)):
    try:
        result = parse_pipeline_logs(db, request.batch_id, request.material_id)
        return {"code": 0, "message": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/analysis/logs", response_model=schemas.ApiResponse)
def get_parsed_logs(
    batch_id: Optional[int] = None,
    category: Optional[str] = None,
    is_anomaly: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    logs = list_parsed_logs(db, batch_id=batch_id, category=category, is_anomaly=is_anomaly, skip=skip, limit=limit)
    return {"code": 0, "message": "success", "data": [schemas.ParsedLogEntry.model_validate(l) for l in logs]}


@app.post("/api/analysis/fingerprints", response_model=schemas.ApiResponse)
def api_analyze_fingerprints(request: schemas.FingerprintAnalyzeRequest, db: Session = Depends(get_db)):
    try:
        result = analyze_cache_fingerprints(db, request.batch_id, request.material_id)
        return {"code": 0, "message": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/analysis/fingerprints", response_model=schemas.ApiResponse)
def get_cache_fingerprints(
    batch_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    fingerprints = list_cache_fingerprints(db, batch_id=batch_id, status=status, skip=skip, limit=limit)
    return {"code": 0, "message": "success", "data": [schemas.CacheFingerprint.model_validate(f) for f in fingerprints]}


@app.post("/api/analysis/cluster", response_model=schemas.ApiResponse)
def api_cluster_failures(request: schemas.ClusterRequest, db: Session = Depends(get_db)):
    try:
        result = cluster_failures(db, request.batch_id)
        return {"code": 0, "message": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/analysis/clusters", response_model=schemas.ApiResponse)
def get_failure_clusters(
    batch_id: Optional[int] = None,
    include_normal: bool = False,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    clusters = list_failure_clusters(db, batch_id=batch_id, include_normal=include_normal, skip=skip, limit=limit)
    return {"code": 0, "message": "success", "data": [schemas.FailureCluster.model_validate(c) for c in clusters]}


@app.get("/api/analysis/anomalies", response_model=schemas.ApiResponse)
def get_anomalies_list(
    batch_id: Optional[int] = None,
    anomaly_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    anomalies = list_anomalies(db, batch_id=batch_id, anomaly_type=anomaly_type, skip=skip, limit=limit)
    return {"code": 0, "message": "success", "data": [schemas.Anomaly.model_validate(a) for a in anomalies]}


@app.post("/api/analysis/scripts", response_model=schemas.ApiResponse)
def api_generate_scripts(request: schemas.ScriptGenerateRequest, db: Session = Depends(get_db)):
    try:
        result = generate_reproduction_scripts(db, request.batch_id, request.cluster_id)
        return {"code": 0, "message": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/analysis/scripts", response_model=schemas.ApiResponse)
def get_scripts_list(
    batch_id: Optional[int] = None,
    cluster_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    scripts = list_reproduction_scripts(db, batch_id=batch_id, cluster_id=cluster_id, skip=skip, limit=limit)
    return {"code": 0, "message": "success", "data": [schemas.ReproductionScript.model_validate(s) for s in scripts]}


@app.post("/api/reports/generate", response_model=schemas.ApiResponse)
def api_generate_report(request: schemas.ReportGenerateRequest, db: Session = Depends(get_db)):
    try:
        result = generate_analysis_report(db, request.batch_id)
        return {"code": 0, "message": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/reports", response_model=schemas.ApiResponse)
def get_reports_list(
    batch_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    reports = list_reports(db, batch_id=batch_id, status=status, skip=skip, limit=limit)
    return {"code": 0, "message": "success", "data": [schemas.AnalysisReport.model_validate(r) for r in reports]}


@app.get("/api/reports/{report_id}", response_model=schemas.ApiResponse)
def get_single_report(report_id: int, db: Session = Depends(get_db)):
    report = get_report(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"code": 0, "message": "success", "data": schemas.AnalysisReport.model_validate(report)}


@app.get("/api/reports/{report_id}/content")
def get_report_content(report_id: int, db: Session = Depends(get_db)):
    report = get_report(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {"code": 0, "message": "success", "data": {"content": report.content, "report_no": report.report_no}}


@app.post("/api/reports/{report_id}/review", response_model=schemas.ApiResponse)
def api_review_report(report_id: int, review_in: schemas.AnalysisReportReview, db: Session = Depends(get_db)):
    try:
        report = review_report(db, report_id, review_in)
        return {"code": 0, "message": "success", "data": schemas.AnalysisReport.model_validate(report)}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/reports/{report_id}/export", response_model=schemas.ApiResponse)
def api_export_report(report_id: int, format: str = "md", db: Session = Depends(get_db)):
    if format not in ["md", "json"]:
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'md' or 'json'.")
    try:
        result = export_report(db, report_id, format)
        return {"code": 0, "message": "success", "data": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/analysis/full-pipeline/{batch_id}", response_model=schemas.ApiResponse)
def run_full_analysis_pipeline(batch_id: int, db: Session = Depends(get_db)):
    batch = get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")

    try:
        parse_result = parse_pipeline_logs(db, batch_id)
    except ValueError:
        parse_result = {"message": "No pipeline logs to parse"}

    try:
        fp_result = analyze_cache_fingerprints(db, batch_id)
    except ValueError:
        fp_result = {"message": "No dependency cache materials to analyze"}

    cluster_result = cluster_failures(db, batch_id)

    try:
        script_result = generate_reproduction_scripts(db, batch_id)
    except ValueError:
        script_result = {"message": "No failure clusters found for script generation"}

    report_result = generate_analysis_report(db, batch_id)

    return {
        "code": 0,
        "message": "success",
        "data": {
            "batch_id": batch_id,
            "batch_no": batch.batch_no,
            "log_parsing": parse_result,
            "fingerprint_analysis": fp_result,
            "failure_clustering": cluster_result,
            "script_generation": script_result,
            "report_generation": report_result,
        },
    }


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "CI缓存污染定位系统", "version": "1.0.0"}
