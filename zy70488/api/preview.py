from fastapi import APIRouter
from typing import List, Dict, Any
from collections import defaultdict

from models import BatchPreviewRequest, BatchPreviewResult, ApprovalNode
from services import DeduplicationService
from data import generate_all_samples

router = APIRouter(prefix="/preview", tags=["批量预览"])

deduplication_service = DeduplicationService()


@router.post("/batch", response_model=BatchPreviewResult)
async def batch_preview(request: BatchPreviewRequest):
    samples = generate_all_samples()
    deduplication_service.add_receipts_batch(samples)
    
    potential_duplicates = 0
    caliber_changed_count = 0
    affected_stores = set()
    affected_nodes = defaultdict(int)
    
    fingerprint_groups = defaultdict(list)
    for receipt in samples:
        fingerprint = deduplication_service.generate_fingerprint(
            receipt, request.deduplication_fields
        )
        fingerprint_groups[fingerprint].append(receipt)
    
    for group in fingerprint_groups.values():
        if len(group) > 1:
            potential_duplicates += len(group) - 1
            for receipt in group:
                affected_stores.add(receipt.store_name)
                affected_nodes[receipt.approval_node] += 1
    
    if request.enable_caliber_check:
        store_calibers = defaultdict(set)
        for receipt in samples:
            store_calibers[receipt.store_code].add(receipt.report_caliber)
        
        for store_code, calibers in store_calibers.items():
            if len(calibers) > 1:
                store_receipts = [
                    r for r in samples if r.store_code == store_code
                ]
                caliber_changed_count += len(store_receipts)
                for receipt in store_receipts:
                    affected_stores.add(receipt.store_name)
                    affected_nodes[receipt.approval_node] += 1
    
    sample_preview = []
    for receipt in samples[:5]:
        sample_preview.append(
            {
                "store_name": receipt.store_name,
                "device_name": receipt.device_name,
                "receipt_number": receipt.receipt_number,
                "approval_node": receipt.approval_node,
                "report_caliber": receipt.report_caliber,
            }
        )
    
    return BatchPreviewResult(
        total_records=len(samples),
        potential_duplicates=potential_duplicates,
        potential_abnormal=caliber_changed_count,
        caliber_changed_count=caliber_changed_count,
        affected_stores=list(affected_stores),
        affected_approval_nodes=dict(affected_nodes),
        sample_preview=sample_preview,
    )


@router.get("/impact-analysis")
async def impact_analysis():
    samples = generate_all_samples()
    
    analysis = {
        "total_affected": 0,
        "by_store": defaultdict(lambda: {"duplicate": 0, "caliber": 0, "total": 0}),
        "by_approval_node": defaultdict(lambda: {"duplicate": 0, "caliber": 0, "total": 0}),
        "estimated_work_hours": 0,
    }
    
    for receipt in samples:
        store = receipt.store_name
        node = receipt.approval_node
        
        if "DEV000099" in receipt.device_code:
            analysis["by_store"][store]["duplicate"] += 1
            analysis["by_store"][store]["total"] += 1
            analysis["by_approval_node"][node]["duplicate"] += 1
            analysis["by_approval_node"][node]["total"] += 1
            analysis["total_affected"] += 1
        
        if receipt.store_code == "GF001" and "变更设备" in receipt.device_name:
            analysis["by_store"][store]["caliber"] += 1
            analysis["by_store"][store]["total"] += 1
            analysis["by_approval_node"][node]["caliber"] += 1
            analysis["by_approval_node"][node]["total"] += 1
            analysis["total_affected"] += 1
    
    analysis["estimated_work_hours"] = analysis["total_affected"] * 0.5
    
    return analysis


@router.get("/comparison")
async def compare_records():
    samples = generate_all_samples()
    
    normal_records = [s for s in samples if "变更" not in s.device_name and "DEV000099" not in s.device_code]
    caliber_records = [s for s in samples if s.device_name.startswith("变更设备")]
    duplicate_records = [s for s in samples if "DEV000099" in s.device_code]
    
    return {
        "normal": {
            "count": len(normal_records),
            "caliber_distribution": {
                "新口径": len([r for r in normal_records if r.report_caliber == "新口径"]),
                "旧口径": len([r for r in normal_records if r.report_caliber == "旧口径"]),
            },
        },
        "caliber_changed": {
            "count": len(caliber_records),
            "caliber_distribution": {
                "新口径": len([r for r in caliber_records if r.report_caliber == "新口径"]),
                "旧口径": len([r for r in caliber_records if r.report_caliber == "旧口径"]),
            },
            "affected_store": "高峰中心店",
        },
        "duplicates": {
            "count": len(duplicate_records),
            "affected_store": "高峰广场店",
            "duplicate_fields": ["device_code", "receipt_number", "serial_number"],
        },
    }
