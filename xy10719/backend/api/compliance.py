from fastapi import APIRouter, HTTPException
from typing import List
from models import ComplianceRecord
from store import store
from fastapi.responses import StreamingResponse
import io
import pandas as pd

router = APIRouter()

@router.get("/", response_model=List[ComplianceRecord])
async def get_compliance_records(search: str = None):
    records = list(store.compliance_records.values())
    if search:
        search_lower = search.lower()
        records = [r for r in records if search_lower in r.field_name.lower()]
    return sorted(records, key=lambda x: x.created_at, reverse=True)

@router.get("/{record_id}", response_model=ComplianceRecord)
async def get_compliance_record(record_id: str):
    if record_id not in store.compliance_records:
        raise HTTPException(status_code=404, detail="合规记录不存在")
    return store.compliance_records[record_id]

@router.get("/sample/{sample_id}", response_model=List[ComplianceRecord])
async def get_sample_compliance(sample_id: str):
    return [r for r in store.compliance_records.values() if r.sample_id == sample_id]

@router.get("/export/excel")
async def export_excel():
    records = list(store.compliance_records.values())
    data = []
    for r in records:
        data.append({
            "字段名称": r.field_name,
            "原始值": "***敏感数据已隐藏***" if r.has_watermark else r.original_value,
            "脱敏值": r.masked_value,
            "脱敏策略": r.strategy,
            "状态": r.status,
            "审批人": r.approved_by or "",
            "审批时间": r.approved_at.strftime("%Y-%m-%d %H:%M:%S") if r.approved_at else "",
            "包含水印": "是" if r.has_watermark else "否",
            "创建时间": r.created_at.strftime("%Y-%m-%d %H:%M:%S")
        })
    
    df = pd.DataFrame(data)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='合规记录')
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=compliance_records.xlsx"}
    )
