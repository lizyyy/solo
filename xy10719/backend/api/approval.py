from fastapi import APIRouter, HTTPException
from typing import List
from models import ApprovalRecord, ApprovalAction, SampleStatus, ComplianceRecord
from store import store
import uuid
from datetime import datetime

router = APIRouter()

@router.get("/", response_model=List[ApprovalRecord])
async def get_approvals():
    return sorted(store.approvals.values(), key=lambda x: x.approved_at, reverse=True)

@router.post("/{sample_id}", response_model=ApprovalRecord)
async def process_approval(sample_id: str, action: ApprovalAction, reason: str, approver: str = "admin", comments: str = ""):
    if sample_id not in store.samples:
        raise HTTPException(status_code=404, detail="样例数据不存在")
    
    sample = store.samples[sample_id]
    
    approval = ApprovalRecord(
        id=str(uuid.uuid4()),
        sample_id=sample_id,
        action=action,
        reason=reason,
        approver=approver,
        comments=comments
    )
    store.approvals[approval.id] = approval
    
    if action == ApprovalAction.APPROVE:
        sample.status = SampleStatus.APPROVED
    else:
        sample.status = SampleStatus.REJECTED
    
    sample.processed_at = datetime.now()
    sample.processed_by = approver
    
    compliance = ComplianceRecord(
        id=str(uuid.uuid4()),
        sample_id=sample_id,
        field_name=sample.field_name,
        original_value=sample.original_value,
        masked_value=sample.masked_value or "",
        strategy=sample.strategy,
        status=sample.status,
        has_watermark=action == ApprovalAction.APPROVE,
        approved_by=approver,
        approved_at=datetime.now()
    )
    store.compliance_records[compliance.id] = compliance
    
    return approval

@router.get("/sample/{sample_id}", response_model=List[ApprovalRecord])
async def get_sample_approvals(sample_id: str):
    return [a for a in store.approvals.values() if a.sample_id == sample_id]
