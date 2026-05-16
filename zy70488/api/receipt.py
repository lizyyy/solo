from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from collections import defaultdict

from models import (
    DeviceLedger,
    DuplicateRecord,
    AbnormalRecord,
    DeduplicationResult,
    ApprovalNode,
)
from services import DeduplicationService, ExportService
from data import generate_all_samples

router = APIRouter(tags=["收据管理"])

deduplication_service = DeduplicationService()
export_service = ExportService()


@router.post("/load-samples", response_model=Dict[str, Any])
async def load_sample_data():
    samples = generate_all_samples()
    deduplication_service.add_receipts_batch(samples)
    
    return {
        "message": "样本数据加载成功",
        "total_records": len(samples),
        "normal_count": len([s for s in samples if "变更" not in s.device_name]),
        "caliber_changed_count": len([s for s in samples if s.device_name.startswith("变更设备")]),
    }


@router.post("/deduplicate", response_model=DeduplicationResult)
async def run_deduplication(fields: List[str] = None):
    if not deduplication_service.receipts:
        await load_sample_data()
    
    result = deduplication_service.run_full_deduplication(fields)
    return result


@router.get("/original/{original_id}", response_model=DeviceLedger)
async def get_receipt_by_original_id(original_id: str):
    receipt = deduplication_service.get_receipt_by_original_id(original_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="收据不存在")
    return receipt


@router.get("/by-approval-node/{approval_node}", response_model=List[DeviceLedger])
async def get_receipts_by_approval_node(approval_node: ApprovalNode):
    receipts = deduplication_service.get_receipts_by_approval_node(approval_node)
    return receipts


@router.get("/by-store/{store_code}", response_model=List[DeviceLedger])
async def get_receipts_by_store(store_code: str):
    receipts = deduplication_service.get_receipts_by_store(store_code)
    return receipts


@router.get("/duplicates", response_model=List[DuplicateRecord])
async def get_duplicate_records():
    return deduplication_service.duplicates


@router.get("/abnormal", response_model=List[AbnormalRecord])
async def get_abnormal_records():
    return deduplication_service.abnormal_records


@router.post("/review-duplicate/{duplicate_id}")
async def review_duplicate(
    duplicate_id: str, reviewer: str, review_comment: str, approved: bool
):
    for record in deduplication_service.duplicates:
        if record.id == duplicate_id:
            record.reviewed = True
            record.reviewer = reviewer
            record.review_comment = review_comment
            return {
                "message": "复核完成",
                "duplicate_id": duplicate_id,
                "reviewer": reviewer,
                "approved": approved,
            }
    
    raise HTTPException(status_code=404, detail="重复记录不存在")


@router.get("/statistics")
async def get_statistics():
    receipts = list(deduplication_service.receipts.values())
    
    store_stats = defaultdict(int)
    node_stats = defaultdict(int)
    caliber_stats = defaultdict(int)
    
    for receipt in receipts:
        store_stats[receipt.store_name] += 1
        node_stats[receipt.approval_node] += 1
        caliber_stats[receipt.report_caliber] += 1
    
    return {
        "total_records": len(receipts),
        "by_store": dict(store_stats),
        "by_approval_node": dict(node_stats),
        "by_report_caliber": dict(caliber_stats),
        "duplicate_count": len(deduplication_service.duplicates),
        "abnormal_count": len(deduplication_service.abnormal_records),
    }


@router.get("/{receipt_id}", response_model=DeviceLedger)
async def get_receipt(receipt_id: str):
    receipt = deduplication_service.get_original_receipt(receipt_id)
    if not receipt:
        raise HTTPException(status_code=404, detail="收据不存在")
    return receipt
