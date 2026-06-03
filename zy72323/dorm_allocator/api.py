from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .core import DormAllocator
from .models import (
    ReviewRole,
    RecordStatus,
    AllocationRecord,
    RunLog,
    ClassroomDemoResult,
)

app = FastAPI(title="约束满足宿舍分配 API")
allocator = DormAllocator()


class ImportRequest(BaseModel):
    screenshot_data: List[Dict[str, Any]]
    operator: str
    operator_role: ReviewRole
    is_old_formula: bool = True


class AnnotationRequest(BaseModel):
    content: str
    author_name: str
    author_role: ReviewRole


class ReviewRequest(BaseModel):
    reviewer_name: str
    reviewer_role: ReviewRole
    review_note: str
    new_status: Optional[RecordStatus] = None


class CorrectionRequest(BaseModel):
    new_denominator: float
    corrected_by: str
    correction_note: str


class RerunRequest(BaseModel):
    previous_run_id: str
    operator: str
    operator_role: ReviewRole


@app.post("/api/import", response_model=str)
def import_data(request: ImportRequest):
    run_id = allocator.import_from_screenshot_data(
        screenshot_data=request.screenshot_data,
        operator=request.operator,
        operator_role=request.operator_role,
        is_old_formula=request.is_old_formula,
    )
    return run_id


@app.post("/api/records/{record_id}/annotations", response_model=str)
def add_annotation(record_id: str, request: AnnotationRequest):
    ann_id = allocator.add_annotation(
        record_id=record_id,
        content=request.content,
        author_name=request.author_name,
        author_role=request.author_role,
    )
    if not ann_id:
        raise HTTPException(status_code=404, detail="Record not found")
    return ann_id


@app.post("/api/records/{record_id}/review")
def review_record(record_id: str, request: ReviewRequest):
    success = allocator.review_record(
        record_id=record_id,
        reviewer_name=request.reviewer_name,
        reviewer_role=request.reviewer_role,
        review_note=request.review_note,
        new_status=request.new_status,
    )
    if not success:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"status": "success"}


@app.post("/api/records/{record_id}/correct")
def correct_denominator(record_id: str, request: CorrectionRequest):
    result = allocator.correct_denominator(
        record_id=record_id,
        new_denominator=request.new_denominator,
        corrected_by=request.corrected_by,
        correction_note=request.correction_note,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"new_result": result}


@app.post("/api/rerun", response_model=str)
def rerun(request: RerunRequest):
    new_run_id = allocator.rerun_with_annotations(
        previous_run_id=request.previous_run_id,
        operator=request.operator,
        operator_role=request.operator_role,
    )
    return new_run_id


@app.get("/api/demo", response_model=List[ClassroomDemoResult])
def get_demo_results(run_id: Optional[str] = None):
    return allocator.get_classroom_demo_results(run_id=run_id)


@app.get("/api/report/{run_id}")
def get_report(run_id: str):
    return allocator.generate_review_report(run_id)


@app.get("/api/runs", response_model=List[str])
def list_runs():
    return allocator.list_run_ids()


@app.get("/api/runs/{run_id}", response_model=Optional[RunLog])
def get_run_log(run_id: str):
    log = allocator.get_run_log(run_id)
    if not log:
        raise HTTPException(status_code=404, detail="Run not found")
    return log


@app.get("/api/records/{record_id}", response_model=Optional[AllocationRecord])
def get_record(record_id: str):
    record = allocator.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@app.get("/api/records", response_model=List[AllocationRecord])
def list_records(run_id: Optional[str] = None):
    if run_id:
        return [r for r in allocator.records.values() if r.run_id == run_id]
    return list(allocator.records.values())


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
