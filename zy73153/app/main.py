from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse

from .engine import engine
from .models import CalculationTrail, FormulaStep, RecordStatus
from .schemas import (
    ApiInfoOut,
    LabResultOut,
    PendingRecordOut,
    RemarkUpdateIn,
    RunMainFlowOut,
    SamplingRecordOut,
    SensorOut,
    SpatialAnnotationOut,
)
from .store import store


def _serialize_boundary(
    trail: CalculationTrail,
) -> dict[str, list[float]]:
    return {k: list(v) for k, v in trail.boundary_values.items()}


def _serialize_trail(
    trail: CalculationTrail,
) -> dict:
    return {
        "final_result": trail.final_result,
        "final_unit": trail.final_unit,
        "formula_steps": [_serialize_step(s) for s in trail.formula_steps],
        "boundary_values": _serialize_boundary(trail),
        "warning_flags": trail.warning_flags,
    }


def _serialize_step(step: FormulaStep) -> dict:
    return {
        "step_index": step.step_index,
        "description": step.description,
        "formula": step.formula,
        "unit": step.unit,
        "input_value": step.input_value,
        "output_value": step.output_value,
        "boundary_check": step.boundary_check,
        "note": step.note,
    }


app = FastAPI(
    title="海洋牧场空间标注系统",
    description=(
        "给海洋站值班员、排班同事、实验室技术员用的空间标注工具。"
        "所有计算过程（公式、单位、边界值、异常来源）均完整返回，而非仅最终数字。"
    ),
    version="1.0.0",
)


@app.get("/", response_class=HTMLResponse)
async def root() -> str:
    html = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>海洋牧场空间标注 · 首页</title>
<style>
  body { font-family: -apple-system, "PingFang SC", sans-serif; max-width: 860px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
  h1 { color: #0e7490; }
  .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 22px; margin: 14px 0; }
  code { background: #0f172a; color: #e2e8f0; padding: 2px 6px; border-radius: 4px; }
  pre { background: #0f172a; color: #e2e8f0; padding: 12px 16px; border-radius: 8px; overflow-x: auto; }
  .step { background: #ecfeff; border-left: 4px solid #06b6d4; padding: 8px 12px; margin: 6px 0; border-radius: 4px; }
</style>
</head>
<body>
<h1>🌊 海洋牧场空间标注系统</h1>
<p>海洋站值班员小宋、排班同事、实验室技术员共同使用。</p>

<div class="card">
  <b>① 先跑哪条命令？</b>
  <pre><code>python -m uvicorn app.main:app --reload --port 8000</code></pre>
</div>

<div class="card">
  <b>② 再看哪份接口返回？</b>
  <ul>
    <li>主流程（批量标注，含晚到附件等异常）：<code>GET /api/run-main-flow</code></li>
    <li>查看单条标注（带完整公式、单位、边界值）：<code>GET /api/annotations/{annotation_id}</code></li>
    <li>待处理记录面板（给排班同事）：<code>GET /api/pending</code></li>
    <li>测试重复导入：<code>POST /api/annotations/run/SP-20260615-001</code>（执行两次）</li>
  </ul>
</div>

<div class="card">
  <b>③ 预置的异常场景</b>
  <div class="step">📄 <b>LB-20260615-003</b>：实验室附件晚到（走 LATE_ATTACHMENT 分支）</div>
  <div class="step">⏰ <b>LB-20260615-002</b>：实验时间距采样超过 12 小时（走 TIME_MISMATCH 分支）</div>
  <div class="step">📡 <b>SN-B2</b>：溶解氧传感器疑似漂移，关联 SP-20260615-002（走 SENSOR_DRIFT 分支）</div>
  <div class="step">🔁 对任意已标注 sample 再调一次 run 接口验证 DUPLICATE 分支（不翻倍、不覆盖人工备注）</div>
</div>

<p>更多信息见 <code>README.md</code> 和 <code>GET /api/info</code>。</p>
</body>
</html>
    """
    return html


@app.get("/api/info", response_model=ApiInfoOut)
async def api_info() -> ApiInfoOut:
    return ApiInfoOut(
        name="海洋牧场空间标注系统",
        version="1.0.0",
        operator="小宋（海洋站值班员）",
        available_commands=[
            "python -m uvicorn app.main:app --reload --port 8000  # 启动服务",
            "pytest tests/ -v  # 运行所有测试",
            "curl http://localhost:8000/api/run-main-flow  # 跑主流程",
            "curl http://localhost:8000/api/pending  # 看待处理记录",
        ],
        endpoints=[
            {"method": "GET", "path": "/api/info", "desc": "系统说明与命令指引"},
            {"method": "GET", "path": "/api/run-main-flow", "desc": "跑主流程，返回所有标注（含完整计算过程）"},
            {"method": "POST", "path": "/api/annotations/run/{sample_id}", "desc": "对单条 sample 执行标注"},
            {"method": "GET", "path": "/api/annotations", "desc": "列出所有标注记录"},
            {"method": "GET", "path": "/api/annotations/{annotation_id}", "desc": "单条标注详情（公式、单位、边界值全返回）"},
            {"method": "GET", "path": "/api/pending", "desc": "待处理记录（排班同事视图）"},
            {"method": "GET", "path": "/api/lab-results", "desc": "实验室结果列表"},
            {"method": "PATCH", "path": "/api/lab-results/{lab_result_id}/remark", "desc": "更新实验室备注（不覆盖已有非空备注？不，按 editable 控制）"},
            {"method": "PATCH", "path": "/api/sampling/{sample_id}/remark", "desc": "更新采样备注"},
            {"method": "GET", "path": "/api/sensors", "desc": "传感器列表"},
            {"method": "GET", "path": "/api/sensors/{sensor_id}/history", "desc": "传感器历史读数+漂移判断依据+先查来源+联系人（漂移核对入口，不可 404）"},
        ],
    )


@app.get("/api/run-main-flow", response_model=RunMainFlowOut)
async def run_main_flow(
    operator_id: str = Query(default="S001", description="操作人，默认值班员小宋 S001"),
) -> RunMainFlowOut:
    from .store import store as _store

    _store.annotations.clear()
    _store.seen_sample_ids.clear()

    results = engine.run_main_flow(operator_id=operator_id)
    out_anns: list[SpatialAnnotationOut] = []
    normal = time_mismatch = late = drift = dup = 0
    for ann in results:
        if ann.status == RecordStatus.NORMAL:
            normal += 1
        elif ann.status == RecordStatus.TIME_MISMATCH:
            time_mismatch += 1
        elif ann.status == RecordStatus.LATE_ATTACHMENT:
            late += 1
        elif ann.status == RecordStatus.SENSOR_DRIFT:
            sensor_drift = drift + 1
            drift += 1
        elif ann.status == RecordStatus.DUPLICATE:
            dup += 1
        out_anns.append(
            SpatialAnnotationOut(
                annotation_id=ann.annotation_id,
                sample_id=ann.sample_id,
                station_id=ann.station_id,
                location_lng=ann.location_lng,
                location_lat=ann.location_lat,
                zone_level=ann.zone_level,
                zone_name=ann.zone_name,
                calculation_trail=ann.calculation_trail,
                status=ann.status.value,
                alerts=ann.alerts,
                handler_hint=ann.handler_hint,
                data_sources=ann.data_sources,
                created_at=ann.created_at,
                created_by=ann.created_by,
            )
        )
    return RunMainFlowOut(
        total=len(out_anns),
        normal=normal,
        time_mismatch=time_mismatch,
        late_attachment=late,
        sensor_drift=drift,
        duplicate=dup,
        annotations=out_anns,
    )


@app.post("/api/annotations/run/{sample_id}", response_model=SpatialAnnotationOut)
async def run_single_annotation(
    sample_id: str,
    operator_id: str = Query(default="S001"),
) -> SpatialAnnotationOut:
    ann = engine.run_annotation(sample_id, operator_id=operator_id)
    if not ann:
        raise HTTPException(status_code=404, detail=f"未找到 sample_id={sample_id} 或无对应实验室结果")
    return SpatialAnnotationOut(
        annotation_id=ann.annotation_id,
        sample_id=ann.sample_id,
        station_id=ann.station_id,
        location_lng=ann.location_lng,
        location_lat=ann.location_lat,
        zone_level=ann.zone_level,
        zone_name=ann.zone_name,
        calculation_trail=ann.calculation_trail,
        status=ann.status.value,
        alerts=ann.alerts,
        handler_hint=ann.handler_hint,
        data_sources=ann.data_sources,
        created_at=ann.created_at,
        created_by=ann.created_by,
    )


@app.get("/api/annotations", response_model=list[SpatialAnnotationOut])
async def list_annotations() -> list[SpatialAnnotationOut]:
    out: list[SpatialAnnotationOut] = []
    for ann in store.annotations.values():
        out.append(
            SpatialAnnotationOut(
                annotation_id=ann.annotation_id,
                sample_id=ann.sample_id,
                station_id=ann.station_id,
                location_lng=ann.location_lng,
                location_lat=ann.location_lat,
                zone_level=ann.zone_level,
                zone_name=ann.zone_name,
                calculation_trail=ann.calculation_trail,
                status=ann.status.value,
                alerts=ann.alerts,
                handler_hint=ann.handler_hint,
                data_sources=ann.data_sources,
                created_at=ann.created_at,
                created_by=ann.created_by,
            )
        )
    return out


@app.get("/api/annotations/{annotation_id}", response_model=SpatialAnnotationOut)
async def get_annotation(annotation_id: str) -> SpatialAnnotationOut:
    ann = store.annotations.get(annotation_id)
    if not ann:
        raise HTTPException(status_code=404, detail="标注记录不存在")
    return SpatialAnnotationOut(
        annotation_id=ann.annotation_id,
        sample_id=ann.sample_id,
        station_id=ann.station_id,
        location_lng=ann.location_lng,
        location_lat=ann.location_lat,
        zone_level=ann.zone_level,
        zone_name=ann.zone_name,
        calculation_trail=ann.calculation_trail,
        status=ann.status.value,
        alerts=ann.alerts,
        handler_hint=ann.handler_hint,
        data_sources=ann.data_sources,
        created_at=ann.created_at,
        created_by=ann.created_by,
    )


@app.get("/api/pending", response_model=list[PendingRecordOut])
async def list_pending() -> list[PendingRecordOut]:
    pending = engine.list_pending()
    return [
        PendingRecordOut(
            annotation_id=p.annotation_id,
            sample_id=p.sample_id,
            station_name=p.station_name,
            status=p.status.value,
            summary=p.summary,
            created_at=p.created_at,
            action_needed=p.action_needed,
            contact_person=p.contact_person,
            check_first_source=p.check_first_source,
        )
        for p in pending
    ]


@app.get("/api/lab-results", response_model=list[LabResultOut])
async def list_lab_results() -> list[LabResultOut]:
    return [
        LabResultOut(
            lab_result_id=lb.lab_result_id,
            sample_id=lb.sample_id,
            sample_time=lb.sample_time,
            report_time=lb.report_time,
            experiment_time=lb.experiment_time,
            result_value=lb.result_value,
            result_unit=lb.result_unit,
            test_item=lb.test_item,
            attachment_arrived=lb.attachment_arrived,
            attachment_arrival_time=lb.attachment_arrival_time,
            remark=lb.remark,
        )
        for lb in store.lab_results.values()
    ]


@app.get("/api/sampling", response_model=list[SamplingRecordOut])
async def list_sampling() -> list[SamplingRecordOut]:
    return [
        SamplingRecordOut(
            sample_id=sr.sample_id,
            station_id=sr.station_id,
            station_name=sr.station_name,
            sampling_time=sr.sampling_time,
            location_lng=sr.location_lng,
            location_lat=sr.location_lat,
            sensor_id=sr.sensor_id,
            sensor_value=sr.sensor_value,
            operator_id=sr.operator_id,
            remark=sr.remark,
        )
        for sr in store.sampling_records.values()
    ]


@app.get("/api/sensors", response_model=list[SensorOut])
async def list_sensors() -> list[SensorOut]:
    return [
        SensorOut(
            sensor_id=s.sensor_id,
            name=s.name,
            location=s.location,
            status=s.status.value,
            drift_threshold=s.drift_threshold,
            last_calibration=s.last_calibration,
            responsible_person_id=s.responsible_person_id,
            data_source_url=s.data_source_url,
        )
        for s in store.sensors.values()
    ]


@app.get("/api/sensors/{sensor_id}/history")
async def get_sensor_history(sensor_id: str) -> dict:
    payload = engine.get_sensor_history(sensor_id)
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail=f"传感器 {sensor_id} 不存在，无法提供历史读数与漂移判断依据",
        )
    return payload


@app.patch("/api/lab-results/{lab_result_id}/remark")
async def update_lab_remark(lab_result_id: str, body: RemarkUpdateIn) -> dict:
    ok = engine.update_lab_remark(lab_result_id, body.remark, body.operator_id)
    if not ok:
        raise HTTPException(status_code=400, detail="备注不可编辑或记录不存在")
    return {"lab_result_id": lab_result_id, "remark": body.remark, "updated": True}


@app.patch("/api/sampling/{sample_id}/remark")
async def update_sampling_remark(sample_id: str, body: RemarkUpdateIn) -> dict:
    ok = engine.update_sampling_remark(sample_id, body.remark, body.operator_id)
    if not ok:
        raise HTTPException(status_code=400, detail="备注不可编辑或记录不存在")
    return {"sample_id": sample_id, "remark": body.remark, "updated": True}
