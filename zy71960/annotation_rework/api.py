"""FastAPI 服务"""

from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
import tempfile
import os

from .storage import AnnotationStore
from .importer import AnnotationImporter, LabelMapper
from .version_diff import VersionDiffer
from .anomaly_detector import AnomalyDetector
from .workflow import AnnotationWorkflow, ReviewAction
from .exporter import AnnotationExporter
from .models import (
    AnnotationSample, SampleStatus, AnomalyType,
    ExportConfig, ExportResult, VersionDiff, LabelMapping
)

app = FastAPI(title="样本标注返工系统 API")

store = AnnotationStore()
importer = AnnotationImporter(store)
mapper = LabelMapper(store)
differ = VersionDiffer(store)
detector = AnomalyDetector(store)
workflow = AnnotationWorkflow(store)
exporter = AnnotationExporter(store)


@app.get("/")
async def root():
    return {"message": "样本标注返工系统 API - Annotation Rework System", "version": "0.1.0"}


@app.get("/versions")
async def list_versions():
    """列出所有版本"""
    versions = store.list_versions()
    return {"versions": [v.model_dump() for v in versions]}


@app.post("/versions")
async def create_version(name: str, description: Optional[str] = None):
    """创建新版本"""
    version_id = importer.create_version(name, description)
    return {"version_id": version_id, "name": name}


@app.get("/versions/{version_id}")
async def get_version(version_id: str):
    """获取版本信息"""
    version = store.get_version(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    return version.model_dump()


@app.post("/versions/{version_id}/import/json")
async def import_json(version_id: str, file: UploadFile = File(...)):
    """从JSON文件导入样本"""
    version = store.get_version(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    with tempfile.NamedTemporaryFile(mode="wb", suffix=".json", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    
    try:
        count, warnings = importer.import_from_json(tmp_path, version_id, label_field="labels")
    finally:
        os.unlink(tmp_path)
    
    return {"imported": count, "warnings": warnings}


@app.post("/versions/{version_id}/import/csv")
async def import_csv(version_id: str, file: UploadFile = File(...)):
    """从CSV文件导入样本"""
    version = store.get_version(version_id)
    if not version:
        raise HTTPException(status_code=404, detail="版本不存在")
    
    with tempfile.NamedTemporaryFile(mode="wb", suffix=".csv", delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    
    try:
        count, warnings = importer.import_from_csv(tmp_path, version_id, label_field="labels")
    finally:
        os.unlink(tmp_path)
    
    return {"imported": count, "warnings": warnings}


@app.get("/versions/{version_id}/samples")
async def list_samples(
    version_id: str,
    status: Optional[SampleStatus] = None,
    anomaly: Optional[AnomalyType] = None,
    limit: int = Query(100, ge=1, le=1000)
):
    """列出版本中的样本"""
    samples = workflow.get_samples_for_review(version_id, status, anomaly, limit)
    return {"count": len(samples), "samples": [s.model_dump() for s in samples]}


@app.get("/versions/{version_id}/samples/{sample_id}")
async def get_sample(version_id: str, sample_id: str):
    """获取单个样本"""
    sample = store.get_sample(sample_id, version_id)
    if not sample:
        raise HTTPException(status_code=404, detail="样本不存在")
    return sample.model_dump()


@app.get("/versions/{version_id}/samples/{sample_id}/history")
async def get_sample_history(sample_id: str):
    """获取样本复核历史"""
    history = workflow.get_sample_review_history(sample_id)
    return {"sample_id": sample_id, "history": history}


@app.post("/versions/{version_id}/samples/{sample_id}/review")
async def review_sample(
    version_id: str,
    sample_id: str,
    action: ReviewAction,
    new_labels: Optional[List[str]] = None,
    reviewer: Optional[str] = None,
    comment: Optional[str] = None
):
    """复核样本"""
    result = workflow.review_sample(
        version_id=version_id,
        sample_id=sample_id,
        action=action,
        new_labels=new_labels,
        reviewer=reviewer,
        comment=comment
    )
    if not result:
        raise HTTPException(status_code=404, detail="样本不存在")
    return result.model_dump()


@app.post("/versions/{version_id}/label-mappings")
async def set_label_mappings(version_id: str, mappings: List[LabelMapping]):
    """设置标签映射"""
    mapper.set_label_mappings(version_id, mappings)
    return {"message": "标签映射已设置", "count": len(mappings)}


@app.post("/versions/{version_id}/label-mappings/apply")
async def apply_label_mappings(version_id: str):
    """应用标签映射"""
    updated, warnings = mapper.apply_mappings(version_id)
    return {"updated": updated, "warnings": warnings}


@app.get("/versions/{base_version}/diff/{target_version}")
async def compare_versions(base_version: str, target_version: str):
    """对比两个版本"""
    diff = differ.compare_versions(base_version, target_version)
    return diff.model_dump()


@app.post("/versions/{version_id}/detect-anomalies")
async def detect_anomalies(version_id: str):
    """运行异常检测"""
    results = detector.run_all_checks(version_id)
    summary = detector.get_anomaly_summary(version_id)
    return {"detection_results": results, "summary": summary}


@app.get("/versions/{version_id}/anomaly-summary")
async def get_anomaly_summary(version_id: str):
    """获取异常检测摘要"""
    summary = detector.get_anomaly_summary(version_id)
    return summary


@app.get("/versions/{version_id}/workflow-summary")
async def get_workflow_summary(version_id: str):
    """获取工作流摘要"""
    summary = workflow.get_workflow_summary(version_id)
    return summary


@app.post("/versions/{version_id}/export")
async def export_samples(version_id: str, config: ExportConfig):
    """导出版本样本"""
    output_path = f"./exports/{version_id}_export.{config.format}"
    result = exporter.export_samples(version_id, output_path, config)
    return result.model_dump()


@app.get("/versions/{version_id}/download")
async def download_export(version_id: str, format: str = "json"):
    """下载导出文件"""
    output_path = f"./exports/{version_id}_export.{format}"
    if not os.path.exists(output_path):
        config = ExportConfig(format=format)
        exporter.export_samples(version_id, output_path, config)
    
    return FileResponse(
        output_path,
        media_type="application/json" if format == "json" else "text/csv",
        filename=f"{version_id}_export.{format}"
    )


@app.post("/verify-export")
async def verify_export(file_path: str):
    """验证导出文件一致性"""
    result = exporter.verify_export_consistency(file_path)
    return result
