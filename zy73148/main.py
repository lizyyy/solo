from __future__ import annotations

from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from harbor_sediment import (
    BottleSample,
    SedimentRecord,
    RecordStatus,
    CommunicationResult,
    create_record,
    add_bottles_batch,
    manually_modify_record,
    get_version_history,
    compare_versions,
    format_for_communication,
    format_records_brief,
    parse_bottle_id,
    validate_time_consistency,
    extract_bottle_ids_from_text,
)


app = FastAPI(
    title="港湾淤积空间标注接口",
    description="面向海洋站值班交接的淤积空间标注轻量服务，返回可直接沟通的结构化结果。",
    version="0.1.0",
)


RECORD_STORE: Dict[str, SedimentRecord] = {}


class CreateRecordRequest(BaseModel):
    station_code: str = Field(..., description="站位编码，如 A03")
    target_harbor: str = Field(..., description="目标港湾名称")
    bottles: List[BottleSample] = Field(default_factory=list, description="初始提交的采样瓶列表")
    operator: Optional[str] = Field(None, description="操作人姓名，如 小宋")


class AddBottlesRequest(BaseModel):
    bottles: List[BottleSample] = Field(..., description="新一批次采样瓶列表")
    operator: Optional[str] = Field(None, description="操作人")
    batch_note: Optional[str] = Field(None, description="本批次备注，如 交接晚到附件")
    change_reason: str = Field("补充采样瓶批次数据", description="变更原因说明")


class ManualModifyRequest(BaseModel):
    new_conclusion: Optional[str] = Field(None, description="新的淤积结论")
    new_value: Optional[float] = Field(None, description="新的淤积量数值")
    new_unit: Optional[str] = Field(None, description="新的淤积量单位")
    change_reason: str = Field(..., description="改判原因，必填")
    operator: Optional[str] = Field(None, description="操作人")
    remark: Optional[str] = Field(None, description="新备注")


class ParseBottleIdRequest(BaseModel):
    bottle_id: str = Field(..., description="采样瓶编号")


class ValidateBottleRequest(BaseModel):
    bottle: BottleSample = Field(..., description="采样瓶完整信息")


class ExtractBottlesRequest(BaseModel):
    text: str = Field(..., description="包含采样瓶编号的文本")


@app.get("/", tags=["健康检查"])
def root() -> Dict[str, Any]:
    return {
        "service": "港湾淤积空间标注接口",
        "status": "running",
        "time": datetime.now().isoformat(),
        "records_count": len(RECORD_STORE),
    }


@app.post("/records", response_model=CommunicationResult, tags=["淤积记录"], summary="创建标注记录")
def api_create_record(req: CreateRecordRequest) -> CommunicationResult:
    record, _ = create_record(
        station_code=req.station_code,
        target_harbor=req.target_harbor,
        bottles=req.bottles,
        created_by=req.operator,
    )
    RECORD_STORE[record.record_id] = record
    return format_for_communication(record)


@app.get("/records", tags=["淤积记录"], summary="查询所有标注记录（简要列表）")
def api_list_records(
    status: Optional[RecordStatus] = Query(None, description="按状态筛选"),
    final_report_only: bool = Query(False, description="仅列出可进入最终报告的记录"),
) -> List[Dict[str, Any]]:
    records = list(RECORD_STORE.values())
    if status:
        records = [r for r in records if r.status == status]
    if final_report_only:
        records = [r for r in records if r.final_report_ready]
    return format_records_brief(records)


@app.get("/records/{record_id}", response_model=CommunicationResult, tags=["淤积记录"], summary="查询单条记录（可沟通格式）")
def api_get_record(record_id: str) -> CommunicationResult:
    if record_id not in RECORD_STORE:
        raise HTTPException(status_code=404, detail=f"记录 {record_id} 不存在")
    record = RECORD_STORE[record_id]
    return format_for_communication(record)


@app.get("/records/{record_id}/raw", tags=["淤积记录"], summary="查询单条记录原始数据")
def api_get_record_raw(record_id: str) -> Dict[str, Any]:
    if record_id not in RECORD_STORE:
        raise HTTPException(status_code=404, detail=f"记录 {record_id} 不存在")
    return RECORD_STORE[record_id].model_dump(mode="json")


@app.post("/records/{record_id}/bottles", response_model=CommunicationResult, tags=["淤积记录"], summary="追加采样瓶批次（不覆盖旧判断）")
def api_add_bottles(record_id: str, req: AddBottlesRequest) -> CommunicationResult:
    if record_id not in RECORD_STORE:
        raise HTTPException(status_code=404, detail=f"记录 {record_id} 不存在")
    record = RECORD_STORE[record_id]
    record, _ = add_bottles_batch(
        record,
        req.bottles,
        operator=req.operator,
        batch_note=req.batch_note,
        change_reason=req.change_reason,
    )
    RECORD_STORE[record_id] = record
    return format_for_communication(record)


@app.post("/records/{record_id}/manual", response_model=CommunicationResult, tags=["淤积记录"], summary="人工改判结论（需填写改判原因）")
def api_manual_modify(record_id: str, req: ManualModifyRequest) -> CommunicationResult:
    if record_id not in RECORD_STORE:
        raise HTTPException(status_code=404, detail=f"记录 {record_id} 不存在")
    if not req.change_reason:
        raise HTTPException(status_code=400, detail="人工改判必须填写改判原因")
    record = RECORD_STORE[record_id]
    record = manually_modify_record(
        record,
        new_conclusion=req.new_conclusion,
        new_value=req.new_value,
        new_unit=req.new_unit,
        change_reason=req.change_reason,
        operator=req.operator,
        remark=req.remark,
    )
    RECORD_STORE[record_id] = record
    return format_for_communication(record)


@app.get("/records/{record_id}/history", tags=["变更历史"], summary="查询变更历史列表")
def api_get_history(record_id: str) -> List[Dict[str, Any]]:
    if record_id not in RECORD_STORE:
        raise HTTPException(status_code=404, detail=f"记录 {record_id} 不存在")
    record = RECORD_STORE[record_id]
    return [ch.model_dump(mode="json") for ch in reversed(record.change_history)]


@app.get("/records/{record_id}/history/compare", tags=["变更历史"], summary="对比两个版本的结论变化")
def api_compare_versions(
    record_id: str,
    v1: int = Query(..., ge=1, description="起始版本号"),
    v2: int = Query(..., ge=1, description="结束版本号"),
) -> Dict[str, Any]:
    if record_id not in RECORD_STORE:
        raise HTTPException(status_code=404, detail=f"记录 {record_id} 不存在")
    record = RECORD_STORE[record_id]
    result = compare_versions(record, v1, v2)
    if result is None:
        raise HTTPException(status_code=404, detail=f"版本 {v1} 或 {v2} 不存在")
    return result


@app.post("/tools/parse-bottle-id", tags=["工具"], summary="解析采样瓶编号（提取日期与站位）")
def api_parse_bottle_id(req: ParseBottleIdRequest) -> Dict[str, Any]:
    result = parse_bottle_id(req.bottle_id)
    return {
        "bottle_id": result.bottle_id,
        "parse_success": result.parse_success,
        "prefix": result.prefix,
        "sampling_date": result.sampling_date.isoformat() if result.sampling_date else None,
        "station_code": result.station_code,
        "sequence": result.sequence,
        "errors": result.errors,
    }


@app.post("/tools/validate-bottle", tags=["工具"], summary="校验单个采样瓶的时间与实验结果一致性")
def api_validate_bottle(req: ValidateBottleRequest) -> Dict[str, Any]:
    is_valid, errors = validate_time_consistency(req.bottle)
    return {
        "valid": is_valid,
        "bottle_id": req.bottle.bottle_id,
        "errors": [e.model_dump(mode="json") for e in errors],
    }


@app.post("/tools/extract-bottles", tags=["工具"], summary="从文本中提取所有采样瓶编号")
def api_extract_bottles(req: ExtractBottlesRequest) -> Dict[str, Any]:
    ids = extract_bottle_ids_from_text(req.text)
    return {"count": len(ids), "bottle_ids": sorted(ids)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
