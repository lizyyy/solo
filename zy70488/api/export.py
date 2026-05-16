from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from models import ExportRequest, ExportResult, ApprovalNode
from services import DeduplicationService, ExportService
from data import generate_all_samples

router = APIRouter(tags=["导出管理"])

deduplication_service = DeduplicationService()
export_service = ExportService()


@router.post("/abnormal", response_model=ExportResult)
async def export_abnormal_records(include_original_data: bool = True):
    samples = generate_all_samples()
    deduplication_service.add_receipts_batch(samples)
    deduplication_service.run_full_deduplication()
    
    result = export_service.export_abnormal_records(
        deduplication_service.abnormal_records,
        deduplication_service.receipts,
        include_original_data,
    )
    
    return result


@router.post("/duplicates", response_model=ExportResult)
async def export_duplicate_records(include_original_data: bool = True):
    samples = generate_all_samples()
    deduplication_service.add_receipts_batch(samples)
    deduplication_service.run_full_deduplication()
    
    result = export_service.export_duplicate_records(
        deduplication_service.duplicates,
        deduplication_service.receipts,
        include_original_data,
    )
    
    return result


@router.post("/by-approval-node/{approval_node}", response_model=ExportResult)
async def export_by_approval_node(approval_node: ApprovalNode, include_attachments: bool = True):
    samples = generate_all_samples()
    deduplication_service.add_receipts_batch(samples)
    
    receipts = deduplication_service.get_receipts_by_approval_node(approval_node)
    
    if not receipts:
        raise HTTPException(status_code=404, detail="该审批节点下无记录")
    
    result = export_service.export_by_approval_node(
        receipts, approval_node, include_attachments
    )
    
    return result


@router.post("/caliber-changed", response_model=ExportResult)
async def export_caliber_changed_records():
    samples = generate_all_samples()
    deduplication_service.add_receipts_batch(samples)
    deduplication_service.run_full_deduplication()
    
    caliber_abnormal = [
        r for r in deduplication_service.abnormal_records 
        if r.abnormal_type == "报告口径不一致"
    ]
    
    result = export_service.export_abnormal_records(
        caliber_abnormal,
        deduplication_service.receipts,
        include_original_data=True,
    )
    
    return result


@router.post("/full-export")
async def full_export():
    samples = generate_all_samples()
    deduplication_service.add_receipts_batch(samples)
    deduplication_service.run_full_deduplication()
    
    abnormal_result = export_service.export_abnormal_records(
        deduplication_service.abnormal_records,
        deduplication_service.receipts,
    )
    
    duplicate_result = export_service.export_duplicate_records(
        deduplication_service.duplicates,
        deduplication_service.receipts,
    )
    
    return {
        "message": "完整导出完成",
        "abnormal_export": abnormal_result,
        "duplicate_export": duplicate_result,
        "abnormal_count": len(deduplication_service.abnormal_records),
        "duplicate_count": len(deduplication_service.duplicates),
    }


@router.get("/export-history")
async def get_export_history():
    export_dir = export_service.export_dir
    
    if not export_dir.exists():
        return {"exports": []}
    
    files = list(export_dir.glob("*.xlsx"))
    history = []
    
    for file in sorted(files, key=lambda x: x.stat().st_mtime, reverse=True):
        stat = file.stat()
        history.append(
            {
                "file_name": file.name,
                "file_path": str(file),
                "size_kb": round(stat.st_size / 1024, 2),
                "created_time": stat.st_ctime,
            }
        )
    
    return {"exports": history[:10]}
