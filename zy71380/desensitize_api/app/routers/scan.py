from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from app.models import ScanRequest, ScanTaskResponse, ScanResultListResponse
from app.engine import scanner

router = APIRouter(prefix="/api/scan", tags=["scan"])


@router.post("", response_model=ScanTaskResponse)
def create_scan(body: ScanRequest):
    try:
        task = scanner.create_scan_task(
            source_type=body.source_type,
            source_data=body.source_data,
            rule_version=body.rule_version,
        )
        return task
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=list[ScanTaskResponse])
def list_scan_tasks():
    return scanner.list_scan_tasks()


@router.get("/{task_id}", response_model=ScanTaskResponse)
def get_scan_task(task_id: int):
    task = scanner.get_scan_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Scan task {task_id} not found")
    return task


@router.get("/{task_id}/results", response_model=ScanResultListResponse)
def get_scan_results(task_id: int):
    data = scanner.get_scan_results(task_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Scan task {task_id} not found")
    return data


@router.get("/diff/{task_id_1}/{task_id_2}")
def diff_scan_results(task_id_1: int, task_id_2: int):
    try:
        return scanner.diff_scan_results(task_id_1, task_id_2)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
