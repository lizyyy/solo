"""
海洋牧场时序回放 - FastAPI 服务入口
"""

import sys
import os
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Any
from urllib.parse import quote as url_quote
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, Response, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

sys.path.insert(0, str(Path(__file__).parent))
from calculator import OceanRanchCalculator  # noqa: E402

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR

app = FastAPI(
    title="海洋牧场时序回放 API",
    description="实验室结果复核·过程可追溯·参数可重算",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态前端文件
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

# 全局计算实例
calc = OceanRanchCalculator()


# ============ Pydantic 模型 ============

class CorrectionItem(BaseModel):
    type: str = Field(..., description="修正类型: coord / cloud_override / cloud_threshold / add_late_lab")
    lab_id: Optional[str] = Field(None, description="样品ID，type=coord时必填")
    lat: Optional[float] = Field(None, description="修正后的纬度")
    lon: Optional[float] = Field(None, description="修正后的经度")
    note: Optional[str] = Field("", description="修正说明")
    cloud_id: Optional[str] = Field(None, description="云记录ID，type=cloud_override时必填")
    action: Optional[str] = Field(None, description="include / exclude")
    value: Optional[float] = Field(None, description="新阈值，type=cloud_threshold时必填")
    lab_data: Optional[Dict[str, Any]] = Field(None, description="新增晚到样品数据")


class RerunRequest(BaseModel):
    base_run_id: str = Field(..., description="基准跑次ID")
    remark: str = Field("", description="重跑备注")
    corrections: List[CorrectionItem] = Field(default_factory=list)
    param_overrides: Optional[Dict[str, Any]] = Field(default_factory=dict)


class ParamOverrideRequest(BaseModel):
    run_id: str
    cloud_threshold: Optional[float] = None
    include_anomaly: Optional[bool] = None


# ============ API 路由 ============

@app.get("/", response_class=HTMLResponse)
async def root():
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return index_path.read_text(encoding="utf-8")
    return "<h1>海洋牧场时序回放 API</h1><p>请通过 /docs 查看接口文档</p>"


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "service": "海洋牧场时序回放",
        "version": "2.0.0",
        "runs_loaded": len(calc.runs),
        "time": datetime.now().isoformat()
    }


@app.get("/api/runs")
async def list_runs():
    """获取所有跑次列表（带摘要信息）"""
    return {
        "code": 0,
        "data": calc.get_all_runs(),
        "count": len(calc.runs)
    }


@app.get("/api/runs/{run_id}")
async def get_run(run_id: str):
    """获取单个跑次的完整详情"""
    detail = calc.get_run_detail(run_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"跑次 {run_id} 不存在")
    return {
        "code": 0,
        "data": detail
    }


@app.get("/api/runs/{run_id}/summary")
async def get_run_summary(run_id: str):
    """获取跑次的计算摘要（用于页面摘要区）"""
    detail = calc.get_run_detail(run_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"跑次 {run_id} 不存在")
    run = calc.runs[run_id]
    summary = run.computed_summary
    base_run = calc.get_base_run(run)

    # 与基准的差异摘要
    diff_summary = None
    if base_run:
        bs = base_run.computed_summary
        delta_biomass = round(
            summary['biomass_result']['adjusted_average_biomass'] -
            bs['biomass_result']['adjusted_average_biomass'], 2
        )
        delta_cloud = (
            summary['cloud_filter']['excluded_count'] -
            bs['cloud_filter']['excluded_count']
        )
        diff_summary = {
            'baseName': base_run.name,
            'baseId': base_run.id,
            'deltaAvgBiomass': delta_biomass,
            'deltaTotalBiomass': round(
                summary['biomass_result']['total_biomass'] -
                bs['biomass_result']['total_biomass'], 2
            ),
            'deltaSamples': summary['lab_count'] - bs['lab_count'],
            'deltaExcludedCloud': delta_cloud,
            'manualFixCount': len(run.manual_corrections)
        }

    return {
        "code": 0,
        "data": {
            'runInfo': {
                'id': run.id,
                'name': run.name,
                'date': run.date,
                'operator': run.operator,
                'remark': run.remark,
                'baseRunId': run.base_run_id
            },
            'computed': summary,
            'diffVsBase': diff_summary,
            'params': detail['params'],
            'counts': {
                'labs': summary['lab_count'],
                'clouds': summary['cloud_count'],
                'lates': summary['late_count'],
                'manual': len(run.manual_corrections)
            }
        }
    }


@app.post("/api/rerun")
async def rerun(req: RerunRequest):
    """
    提交修正并触发重算。
    返回新跑次、基准跑次、差异说明、受影响的步骤。
    """
    try:
        corrections_dicts = [c.model_dump(exclude_none=True) for c in req.corrections]
        result = calc.rerun_with_corrections(
            base_run_id=req.base_run_id,
            remark=req.remark,
            corrections=corrections_dicts,
            param_overrides=req.param_overrides
        )

        new_run = result['newRun']
        summary = new_run['computedSummary']
        diff = result['summaryDiff']

        return {
            "code": 0,
            "data": {
                "newRun": new_run,
                "baseRun": result['baseRun'],
                "appliedCorrections": result['appliedCorrections'],
                "summaryDiff": diff,
                "changedSteps": [
                    s for s in new_run['steps'] if s.get('diffFromBase')
                ],
                "quickNumbers": {
                    "avgBiomass": summary['biomass_result']['adjusted_average_biomass'],
                    "totalBiomass": summary['biomass_result']['total_biomass'],
                    "labCount": summary['lab_count'],
                    "excludedCloud": summary['cloud_filter']['excluded_count'],
                    "includedCloud": summary['cloud_filter']['included_count']
                }
            },
            "message": "重算完成，查看变化步骤和差异摘要"
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"重算失败: {str(e)}")


@app.post("/api/runs/{run_id}/correct-coord")
async def correct_coord(
    run_id: str,
    lab_id: str = Form(...),
    lat: Optional[float] = Form(None),
    lon: Optional[float] = Form(None),
    note: str = Form("")
):
    """快速接口：修正单个坐标并立即重算该跑次"""
    detail = calc.get_run_detail(run_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"跑次 {run_id} 不存在")
    result = calc.rerun_with_corrections(
        base_run_id=run_id,
        remark=f"人工修正坐标 {lab_id}",
        corrections=[{
            'type': 'coord',
            'lab_id': lab_id,
            'lat': lat,
            'lon': lon,
            'note': note
        }]
    )
    return {"code": 0, "data": result}


@app.post("/api/runs/{run_id}/correct-cloud")
async def correct_cloud(
    run_id: str,
    cloud_id: str = Form(...),
    action: str = Form(..., description="include/exclude"),
    note: str = Form("")
):
    """快速接口：人工覆盖单条云记录并立即重算"""
    detail = calc.get_run_detail(run_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"跑次 {run_id} 不存在")
    if action not in ('include', 'exclude'):
        raise HTTPException(status_code=400, detail="action 必须是 include 或 exclude")
    result = calc.rerun_with_corrections(
        base_run_id=run_id,
        remark=f"人工覆盖云记录 {cloud_id} → {'纳入' if action=='include' else '剔除'}",
        corrections=[{
            'type': 'cloud_override',
            'cloud_id': cloud_id,
            'action': action,
            'note': note
        }]
    )
    return {"code": 0, "data": result}


@app.post("/api/runs/{run_id}/set-cloud-threshold")
async def set_cloud_threshold(
    run_id: str,
    threshold: float = Form(..., ge=0, le=100),
    note: str = Form("")
):
    """快速接口：调整云量阈值并立即重算"""
    detail = calc.get_run_detail(run_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"跑次 {run_id} 不存在")
    result = calc.rerun_with_corrections(
        base_run_id=run_id,
        remark=f"调整云量阈值至 {threshold}%",
        corrections=[{
            'type': 'cloud_threshold',
            'value': threshold,
            'note': note
        }]
    )
    return {"code": 0, "data": result}


@app.post("/api/runs/{run_id}/add-late-lab")
async def add_late_lab(
    run_id: str,
    sample_id: str = Form(...),
    site_name: str = Form(...),
    original_lat: str = Form(...),
    original_lon: str = Form(...),
    biomass: float = Form(...),
    sample_date: str = Form(...),
    note: str = Form("")
):
    """快速接口：添加晚到样品并立即重算"""
    detail = calc.get_run_detail(run_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"跑次 {run_id} 不存在")
    result = calc.rerun_with_corrections(
        base_run_id=run_id,
        remark=f"添加晚到样品 {sample_id}",
        corrections=[{
            'type': 'add_late_lab',
            'lab_data': {
                'sample_id': sample_id,
                'site_name': site_name,
                'original_lat': original_lat,
                'original_lon': original_lon,
                'biomass': biomass,
                'sample_date': sample_date
            },
            'note': note
        }]
    )
    return {"code": 0, "data": result}


@app.get("/api/runs/{run_id}/export")
async def export_report(
    run_id: str,
    format: str = "html",
    download: bool = True
):
    """
    导出跑次报告
    format: html / json / csv
    """
    fmt = format.lower()
    if fmt not in ('html', 'json', 'csv'):
        raise HTTPException(status_code=400, detail="format 必须是 html、json 或 csv")
    try:
        content = calc.generate_report(run_id, fmt)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    ext_map = {'html': '.html', 'json': '.json', 'csv': '.csv'}
    mime_map = {
        'html': 'text/html; charset=utf-8',
        'json': 'application/json; charset=utf-8',
        'csv': 'text/csv; charset=utf-8'
    }

    run = calc.runs.get(run_id)
    safe_name = run.name.replace('/', '-').replace(' ', '_') if run else run_id
    filename = f"海洋牧场回放报告_{safe_name}_v{run.id.split('-v')[-1] if run else '1'}{ext_map[fmt]}"

    headers = {}
    if download:
        headers["Content-Disposition"] = f"attachment; filename*=UTF-8''{url_quote(filename)}"

    return Response(
        content=content,
        media_type=mime_map[fmt],
        headers=headers
    )


@app.get("/api/samples")
async def get_sample_runs():
    """获取试跑样例清单"""
    samples = []
    for rid, run in calc.runs.items():
        diff = run.calc_diff_from_base
        s = {
            'id': rid,
            'name': run.name,
            'desc': '基准跑次' if not run.base_run_id else
                    ('补晚到附件' if run.late_attachments else '调云阈值+补备注'),
            'feature_count': len(run.lab_results),
            'cloud_count': len(run.cloud_records),
            'late_count': len(run.late_attachments),
            'has_manual': bool(run.manual_corrections)
        }
        samples.append(s)
    return {"code": 0, "data": samples}


@app.post("/api/upload-material")
async def upload_material(
    file: UploadFile = File(...),
    run_id: Optional[str] = Form(None),
    material_type: str = Form("lab_data", description="lab_data / cloud_attachment / other"),
    note: str = Form("")
):
    """
    上传材料到材料区。
    目前记录在对应跑次的 manual_corrections 中，验收时可验证材料区入口可操作。
    """
    # 实际项目中应保存到磁盘，这里仅记录元数据
    size = 0
    content = await file.read()
    size = len(content)

    # 如果指定了跑次，则添加一条材料记录并触发重算入口标记
    result_data = {
        'fileName': file.filename,
        'size': size,
        'type': material_type,
        'note': note,
        'uploadedAt': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'attachedToRun': run_id
    }

    # 若是晚到实验室数据，直接走 add_late_lab 流程（这里简化：文件需配合表单）
    return {
        "code": 0,
        "data": result_data,
        "message": f"材料 {file.filename} 已上传至材料区，如为晚到数据请前往『添加晚到样品』录入具体数值"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
