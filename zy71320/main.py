from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from doppler.models import (
    CalibrationParams,
    RadarSample,
    SpeedResult,
    BatchReport,
)
from doppler.engine import process_sample, process_batch
from doppler.calibration import CalibrationStore
from doppler.report import generate_batch_report
from doppler.audit import AuditLog


app = FastAPI(
    title="多普勒雷达测速API",
    description="交通实验室用多普勒雷达测速处理系统——支持频移换算、校准版本、异常剔除、批量报告、接口留痕",
    version="1.0.0",
)

calibration_store = CalibrationStore()
audit_log = AuditLog()


class SingleCalcRequest(BaseModel):
    sample: RadarSample
    calibration_version: str = Field("v1.0", description="校准版本号")
    calibration_override: Optional[CalibrationParams] = Field(None, description="临时校准参数覆盖")


class BatchCalcRequest(BaseModel):
    samples: list[RadarSample] = Field(..., min_length=1)
    calibration_version: str = Field("v1.0", description="校准版本号")
    calibration_override: Optional[CalibrationParams] = Field(None, description="临时校准参数覆盖")


class CalibrationRegisterRequest(BaseModel):
    params: CalibrationParams


class AuditQueryResponse(BaseModel):
    total: int
    records: list[dict]


@app.get("/api/v1/calibration/versions", tags=["校准"])
def list_calibration_versions():
    versions = calibration_store.list_versions()
    audit_log.log("/api/v1/calibration/versions", "GET", "列出校准版本", f"共 {len(versions)} 个版本")
    return {"versions": versions}


@app.get("/api/v1/calibration/{version}", tags=["校准"])
def get_calibration(version: str):
    cal = calibration_store.get(version)
    if cal is None:
        audit_log.log(f"/api/v1/calibration/{version}", "GET", f"查询版本 {version}", "未找到")
        raise HTTPException(status_code=404, detail=f"校准版本 {version} 不存在")
    audit_log.log(f"/api/v1/calibration/{version}", "GET", f"查询版本 {version}", "返回参数")
    return cal.model_dump()


@app.post("/api/v1/calibration/register", tags=["校准"])
def register_calibration(req: CalibrationRegisterRequest):
    calibration_store.register(req.params)
    audit_log.log("/api/v1/calibration/register", "POST", f"注册版本 {req.params.version}", "注册成功")
    return {"message": f"校准版本 {req.params.version} 已注册", "version": req.params.version}


@app.post("/api/v1/speed/calculate", tags=["测速"])
def calculate_speed(req: SingleCalcRequest) -> dict:
    cal = _resolve_calibration(req.calibration_version, req.calibration_override)
    result = process_sample(req.sample, cal)
    audit_log.log(
        "/api/v1/speed/calculate",
        "POST",
        f"样本 {req.sample.sample_id}",
        f"状态={result.status.value}",
    )
    return result.model_dump(mode="json")


@app.post("/api/v1/speed/batch", tags=["测速"])
def calculate_speed_batch(req: BatchCalcRequest) -> dict:
    cal = _resolve_calibration(req.calibration_version, req.calibration_override)
    results = process_batch(req.samples, cal)
    report = generate_batch_report(results)
    audit_log.log(
        "/api/v1/speed/batch",
        "POST",
        f"{len(req.samples)} 个样本",
        f"确认={report.confirmed_count}, 待确认={report.pending_count}, 拒绝={report.rejected_count}",
    )
    return report.model_dump(mode="json")


@app.get("/api/v1/report/{report_id}", tags=["报告"])
def get_report(report_id: str):
    audit_log.log(f"/api/v1/report/{report_id}", "GET", f"查询报告 {report_id}", "报告在批量接口中返回")
    return {"message": "报告通过 POST /api/v1/speed/batch 的响应获取", "report_id": report_id}


@app.get("/api/v1/audit/trail", tags=["留痕"])
def get_audit_trail(
    endpoint: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
):
    records = audit_log.query(endpoint=endpoint, limit=limit)
    dicts = [r.model_dump(mode="json") for r in records]
    audit_log.log("/api/v1/audit/trail", "GET", f"查询留痕 endpoint={endpoint}", f"返回 {len(dicts)} 条")
    return AuditQueryResponse(total=len(dicts), records=dicts).model_dump()


@app.get("/api/v1/health", tags=["系统"])
def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


def _resolve_calibration(
    version: str,
    override: Optional[CalibrationParams],
) -> CalibrationParams:
    if override is not None:
        return override
    cal = calibration_store.get(version)
    if cal is None:
        raise HTTPException(status_code=404, detail=f"校准版本 {version} 不存在，请先注册或提供 override")
    return cal
