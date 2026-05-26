from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.responses import StreamingResponse
from typing import List, Optional
import io

from .models import (
    ReviewStatus, ViolationType, ReviewRecord,
    ReconciliationReport, ReconciliationSummary
)
from .store import store
from .importer import DataImporter
from .validator import ValidationEngine
from .review import ReviewManager
from .report import ReportGenerator

app = FastAPI(
    title="园林喷洒对账服务",
    description="园林作业喷洒对账后端服务，支持数据导入、自动比对、人工复核、重新计算和报告下载",
    version="1.0.0"
)


@app.on_event("startup")
async def startup_event():
    store.clear_all()
    load_sample_data()


def load_sample_data():
    import os
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sample_dir = os.path.join(base_dir, "sample_data")

    pesticides_path = os.path.join(sample_dir, "pesticides.json")
    weather_path = os.path.join(sample_dir, "weather.csv")
    jobs_path = os.path.join(sample_dir, "spray_jobs.csv")

    if os.path.exists(pesticides_path):
        with open(pesticides_path, 'r', encoding='utf-8') as f:
            DataImporter.import_pesticides_from_json(f.read())

    if os.path.exists(weather_path):
        with open(weather_path, 'r', encoding='utf-8') as f:
            DataImporter.import_weather_from_csv(f.read())

    if os.path.exists(jobs_path):
        with open(jobs_path, 'r', encoding='utf-8') as f:
            DataImporter.import_jobs_from_csv(f.read())

    ValidationEngine.validate_all_jobs()


@app.get("/")
def root():
    return {
        "message": "园林喷洒对账服务 API",
        "version": "1.0.0",
        "endpoints": {
            "数据导入": "/import",
            "数据查询": "/data",
            "校验结果": "/validation",
            "复核管理": "/review",
            "报告生成": "/report"
        }
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.post("/import/pesticides")
def import_pesticides(file: UploadFile = File(...)):
    content = file.file.read().decode("utf-8")
    pesticides = DataImporter.import_pesticides_from_json(content)
    ValidationEngine.validate_all_jobs()
    return {
        "message": f"成功导入 {len(pesticides)} 条药剂记录",
        "count": len(pesticides),
        "pesticides": [p.model_dump() for p in pesticides]
    }


@app.post("/import/weather")
def import_weather(file: UploadFile = File(...)):
    content = file.file.read().decode("utf-8")
    records = DataImporter.import_weather_from_csv(content)
    ValidationEngine.validate_all_jobs()
    return {
        "message": f"成功导入 {len(records)} 条天气记录",
        "count": len(records)
    }


@app.post("/import/jobs")
def import_jobs(file: UploadFile = File(...)):
    content = file.file.read().decode("utf-8")
    jobs = DataImporter.import_jobs_from_csv(content)
    ValidationEngine.validate_all_jobs()
    return {
        "message": f"成功导入 {len(jobs)} 条作业记录",
        "count": len(jobs)
    }


@app.get("/data/pesticides")
def get_pesticides():
    return {"pesticides": [p.model_dump() for p in store.get_all_pesticides()]}


@app.get("/data/weather")
def get_weather():
    return {"weather_records": [w.model_dump() for w in store.get_all_weather_records()]}


@app.get("/data/jobs")
def get_jobs():
    return {"jobs": [j.model_dump() for j in store.get_all_spray_jobs()]}


@app.get("/validation/results")
def get_validation_results():
    return {
        "results": [r.model_dump() for r in store.get_all_validation_results()],
        "statistics": ValidationEngine.get_violation_statistics()
    }


@app.get("/validation/{job_id}")
def get_job_validation(job_id: str):
    result = store.get_validation_result(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="校验结果不存在")
    return result.model_dump()


@app.post("/validation/recalculate")
def recalculate_all():
    results = ReviewManager.recalculate_all()
    return {
        "message": f"重新计算完成，共校验 {len(results)} 条记录",
        "count": len(results)
    }


@app.post("/review")
def create_review(
    job_id: str,
    reviewer: str,
    status: ReviewStatus,
    review_notes: str,
    adjusted_dosage: Optional[float] = None,
    adjusted_area: Optional[float] = None,
    override_violations: Optional[List[ViolationType]] = None
):
    if not store.get_spray_job(job_id):
        raise HTTPException(status_code=404, detail="作业记录不存在")

    record = ReviewManager.create_review(
        job_id=job_id,
        reviewer=reviewer,
        status=status,
        review_notes=review_notes,
        adjusted_dosage=adjusted_dosage,
        adjusted_area=adjusted_area,
        override_violations=override_violations
    )
    return record.model_dump()


@app.get("/review/{job_id}")
def get_review(job_id: str):
    review = store.get_review_by_job_id(job_id)
    if not review:
        raise HTTPException(status_code=404, detail="复核记录不存在")
    return review.model_dump()


@app.get("/review")
def get_all_reviews():
    return {"reviews": [r.model_dump() for r in store.get_all_review_records()]}


@app.get("/jobs/with-reviews")
def get_jobs_with_reviews():
    return {"jobs": ReviewManager.get_all_jobs_with_reviews()}


@app.get("/jobs/{job_id}/detail")
def get_job_detail(job_id: str):
    detail = ReviewManager.get_job_with_review(job_id)
    if not detail:
        raise HTTPException(status_code=404, detail="作业记录不存在")
    return detail


@app.get("/report/summary")
def get_report_summary() -> ReconciliationSummary:
    return ReportGenerator.generate_summary()


@app.get("/report/full")
def get_full_report() -> ReconciliationReport:
    return ReportGenerator.generate_report()


@app.get("/report/export/csv")
def export_report_csv():
    csv_content = ReportGenerator.export_report_csv()
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=reconciliation_report.csv"
        }
    )


@app.get("/report/export/json")
def export_report_json():
    json_content = ReportGenerator.export_report_json()
    return Response(
        content=json_content,
        media_type="application/json; charset=utf-8",
        headers={
            "Content-Disposition": "attachment; filename=reconciliation_report.json"
        }
    )


@app.get("/jobs/{job_id}/explanation")
def get_job_explanation(job_id: str):
    explanation = ReportGenerator.get_explanation_for_job(job_id)
    if "error" in explanation:
        raise HTTPException(status_code=404, detail=explanation["error"])
    return explanation


@app.post("/data/reset")
def reset_data():
    store.clear_all()
    load_sample_data()
    return {"message": "数据已重置为样例数据"}
