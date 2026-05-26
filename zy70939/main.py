import io
import uuid
from datetime import datetime
from typing import Optional
from urllib.parse import quote

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse

from models import (
    MaterialSubmitRequest, MaterialResponse, MaterialDetailResponse,
    MaterialRecord, MaterialStatus, MaterialCategory, FollowUpType,
    ModificationLog, ModifyCategoryRequest, QueryRequest, QueryResponse,
    CategoryResult
)
from storage import storage
from classifier import classify_material

app = FastAPI(
    title="药店慢病随访提醒 API",
    description="处理药店慢病患者随访材料，分类并生成随访提醒",
    version="1.0.0"
)


def mask_phone(phone: str) -> str:
    return f"{phone[:3]}****{phone[-4:]}"


def build_field_trail(request: MaterialSubmitRequest) -> dict:
    return {
        "batch_no": request.batch_no,
        "patient_name": request.patient_name,
        "phone": mask_phone(request.phone),
        "diagnosis": request.diagnosis,
        "drugs": request.drugs,
        "follow_up_type": request.follow_up_type.value,
        "pharmacy_name": request.pharmacy_name,
        "clerk_id": request.clerk_id,
        "clerk_name": request.clerk_name,
    }


def record_to_response(record: MaterialRecord, is_duplicate: bool = False) -> MaterialResponse:
    return MaterialResponse(
        material_id=record.material_id,
        batch_no=record.batch_no,
        patient_name=record.patient_name,
        phone_masked=mask_phone(record.phone),
        category=record.category_result.category if record.category_result else None,
        follow_up_type=record.follow_up_type,
        status=record.status,
        submit_time=record.submit_time,
        is_duplicate=is_duplicate,
        category_result=record.category_result
    )


def record_to_detail_response(record: MaterialRecord, is_duplicate: bool = False) -> MaterialDetailResponse:
    return MaterialDetailResponse(
        material_id=record.material_id,
        batch_no=record.batch_no,
        patient_name=record.patient_name,
        phone_masked=mask_phone(record.phone),
        category=record.category_result.category if record.category_result else None,
        follow_up_type=record.follow_up_type,
        status=record.status,
        submit_time=record.submit_time,
        is_duplicate=is_duplicate,
        category_result=record.category_result,
        diagnosis=record.diagnosis,
        drugs=record.drugs,
        pharmacy_name=record.pharmacy_name,
        clerk_name=record.clerk_name,
        remark=record.remark,
        modification_history=record.modification_history,
        field_trail=record.field_trail
    )


@app.post("/api/materials/submit", response_model=MaterialResponse, tags=["材料提交"])
async def submit_material(request: MaterialSubmitRequest):
    existing = storage.get_by_batch_no(request.batch_no)
    if existing:
        return record_to_response(existing, is_duplicate=True)

    material_id = storage.generate_id()
    category_result = classify_material(request, processed_by="system")

    record = MaterialRecord(
        **request.model_dump(),
        material_id=material_id,
        status=MaterialStatus.PROCESSED,
        submit_time=datetime.now(),
        category_result=category_result,
        field_trail=build_field_trail(request)
    )
    storage.save_material(record)
    return record_to_response(record)


@app.get("/api/materials/{material_id}", response_model=MaterialDetailResponse, tags=["材料查询"])
async def get_material_detail(material_id: str):
    record = storage.get_by_id(material_id)
    if not record:
        raise HTTPException(status_code=404, detail="材料记录不存在")
    return record_to_detail_response(record)


@app.put("/api/materials/{material_id}/category", tags=["结论修改"])
async def modify_category(material_id: str, request: ModifyCategoryRequest):
    record = storage.get_by_id(material_id)
    if not record:
        raise HTTPException(status_code=404, detail="材料记录不存在")

    old_result = record.category_result
    old_category = old_result.category if old_result else None
    old_reason = old_result.reason if old_result else None
    old_follow_up_type = old_result.follow_up_type if old_result else None

    new_follow_up = request.new_follow_up_type or (old_follow_up_type or record.follow_up_type)

    new_result = CategoryResult(
        category=request.new_category,
        reason=request.new_reason,
        follow_up_type=new_follow_up,
        suggested_action=request.suggested_action,
        processed_at=datetime.now(),
        processed_by=f"{request.operator_name}(ID:{request.operator_id})"
    )

    log = ModificationLog(
        log_id=str(uuid.uuid4()),
        material_id=material_id,
        old_category=old_category,
        new_category=request.new_category,
        old_reason=old_reason,
        new_reason=request.new_reason,
        modified_by=f"{request.operator_name}(ID:{request.operator_id})",
        modified_at=datetime.now(),
        modification_reason=request.modification_reason,
        old_follow_up_type=old_follow_up_type,
        new_follow_up_type=new_follow_up
    )

    record.category_result = new_result
    record.follow_up_type = new_follow_up
    storage.save_material(record)
    storage.add_modification_log(log)

    return {"message": "修改成功", "log_id": log.log_id}


@app.get("/api/materials/{material_id}/modifications", tags=["修改审计"])
async def get_modification_history(material_id: str):
    record = storage.get_by_id(material_id)
    if not record:
        raise HTTPException(status_code=404, detail="材料记录不存在")
    return {
        "material_id": material_id,
        "modification_count": len(record.modification_history),
        "modifications": record.modification_history
    }


@app.post("/api/materials/query", response_model=QueryResponse, tags=["材料查询"])
async def query_materials(request: QueryRequest):
    total, items = storage.list_materials(
        start_date=request.start_date,
        end_date=request.end_date,
        category=request.category,
        follow_up_type=request.follow_up_type,
        pharmacy_name=request.pharmacy_name,
        clerk_id=request.clerk_id,
        patient_name=request.patient_name,
        page=request.page,
        page_size=request.page_size
    )
    return QueryResponse(
        total=total,
        page=request.page,
        page_size=request.page_size,
        items=[record_to_response(r) for r in items]
    )


@app.get("/api/materials/export/excel", tags=["数据导出"])
async def export_excel(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    category: Optional[MaterialCategory] = Query(None),
    follow_up_type: Optional[FollowUpType] = Query(None),
    pharmacy_name: Optional[str] = Query(None),
    clerk_id: Optional[str] = Query(None),
):
    total, items = storage.list_materials(
        start_date=start_date,
        end_date=end_date,
        category=category,
        follow_up_type=follow_up_type,
        pharmacy_name=pharmacy_name,
        clerk_id=clerk_id,
        page=1,
        page_size=10000
    )

    rows = []
    for r in items:
        cat = r.category_result.category.value if r.category_result else "-"
        cat_reason = r.category_result.reason if r.category_result else "-"
        action = r.category_result.suggested_action if r.category_result else "-"

        rows.append({
            "材料ID": r.material_id,
            "批次号": r.batch_no,
            "患者姓名": r.patient_name,
            "手机号": mask_phone(r.phone),
            "年龄": r.age or "-",
            "性别": r.gender or "-",
            "诊断": r.diagnosis,
            "购药清单": "、".join(r.drugs),
            "随访类型": r.follow_up_type.value,
            "分类结果": cat,
            "分类原因": cat_reason,
            "建议动作": action,
            "状态": r.status.value,
            "药店": r.pharmacy_name,
            "提交店员": r.clerk_name,
            "提交时间": r.submit_time.strftime("%Y-%m-%d %H:%M:%S"),
            "修改次数": len(r.modification_history),
        })

    df = pd.DataFrame(rows)
    buffer = io.BytesIO()
    df.to_excel(buffer, index=False, engine="openpyxl")
    buffer.seek(0)

    filename = f"慢病随访记录_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    encoded_filename = quote(filename)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )


@app.get("/api/stats/summary", tags=["统计"])
async def get_summary():
    all_materials = list(storage._materials.values())
    summary = {
        "total": len(all_materials),
        "by_category": {},
        "by_follow_up_type": {},
        "by_status": {},
    }
    for m in all_materials:
        if m.category_result:
            cat = m.category_result.category.value
            summary["by_category"][cat] = summary["by_category"].get(cat, 0) + 1
        fut = m.follow_up_type.value
        summary["by_follow_up_type"][fut] = summary["by_follow_up_type"].get(fut, 0) + 1
        st = m.status.value
        summary["by_status"][st] = summary["by_status"].get(st, 0) + 1
    return summary


@app.get("/api/health", tags=["系统"])
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}
