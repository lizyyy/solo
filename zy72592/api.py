#!/usr/bin/env python3
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.responses import JSONResponse
from typing import List, Optional
import tempfile
import os

from semantic_dedup.models import (
    RecallCandidate,
    ThresholdParams,
    SampleStatus,
    NextAction,
    PlaybackReport,
    AuditLog,
)
from semantic_dedup.core import (
    load_candidates_from_csv,
    run_threshold_trial,
    apply_manual_correction,
    rerun_with_new_params,
    generate_playback_report,
)

app = FastAPI(
    title="语义去重阈值试算 API",
    description="帮助评测运营小孟解释阈值试算结果，支持少数类样本检测和人工修正",
    version="1.0.0",
)

current_trial_runs = {}


@app.get("/")
async def root():
    return {
        "message": "语义去重阈值试算 API",
        "version": "1.0.0",
        "endpoints": {
            "POST /trial/run": "运行阈值试算（上传CSV和参数）",
            "POST /trial/correct/{run_id}/{sample_id}": "人工修正单条样本",
            "POST /trial/rerun/{run_id}": "使用新参数重跑",
            "GET /trial/{run_id}/report": "获取回放报告",
            "GET /trial/{run_id}/audit": "获取审计日志",
            "POST /demo": "运行完整演示",
        },
    }


@app.post("/trial/run", response_model=PlaybackReport)
async def run_trial_api(
    candidates_csv: UploadFile = File(..., description="召回候选表CSV文件"),
    dedup_threshold: float = 0.85,
    minority_weight: float = 1.2,
    overall_metric_weight: float = 1.0,
    minority_boost_enabled: bool = True,
    min_minority_ratio: float = 0.05,
    operator: str = "评测运营小孟",
    reason: str = "API调用-初始阈值试算",
):
    """第一步：上传召回候选表，运行阈值试算"""
    if not candidates_csv.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="请上传CSV格式的召回候选表")
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        content = await candidates_csv.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        candidates = load_candidates_from_csv(tmp_path)
    finally:
        os.unlink(tmp_path)
    
    params = ThresholdParams(
        dedup_threshold=dedup_threshold,
        minority_weight=minority_weight,
        overall_metric_weight=overall_metric_weight,
        minority_boost_enabled=minority_boost_enabled,
        min_minority_ratio=min_minority_ratio,
    )
    
    trial_run = run_threshold_trial(candidates, params, operator=operator, reason=reason)
    report = generate_playback_report(trial_run)
    
    current_trial_runs[trial_run.run_id] = trial_run
    
    return report


@app.post("/trial/correct/{run_id}/{sample_id}", response_model=PlaybackReport)
async def correct_sample_api(
    run_id: str,
    sample_id: str,
    operator: str = Body("评测运营小孟", embed=True),
    reason: str = Body(..., embed=True),
    new_status: Optional[SampleStatus] = Body(None, embed=True),
    new_next_action: Optional[NextAction] = Body(None, embed=True),
    custom_why_kept: Optional[str] = Body(None, embed=True),
):
    """第二步：人工修正单条样本的状态"""
    if run_id not in current_trial_runs:
        raise HTTPException(status_code=404, detail=f"运行ID {run_id} 不存在")
    
    trial_run = current_trial_runs[run_id]
    
    sample_exists = any(r.sample_id == sample_id for r in trial_run.results)
    if not sample_exists:
        raise HTTPException(status_code=404, detail=f"样本ID {sample_id} 不存在")
    
    corrected_run = apply_manual_correction(
        trial_run=trial_run,
        sample_id=sample_id,
        operator=operator,
        reason=reason,
        new_status=new_status,
        new_next_action=new_next_action,
        custom_why_kept=custom_why_kept,
    )
    
    report = generate_playback_report(corrected_run)
    current_trial_runs[corrected_run.run_id] = corrected_run
    
    return report


@app.post("/trial/rerun/{run_id}", response_model=PlaybackReport)
async def rerun_trial_api(
    run_id: str,
    dedup_threshold: Optional[float] = Body(None, embed=True),
    minority_weight: Optional[float] = Body(None, embed=True),
    overall_metric_weight: Optional[float] = Body(None, embed=True),
    minority_boost_enabled: Optional[bool] = Body(None, embed=True),
    min_minority_ratio: Optional[float] = Body(None, embed=True),
    operator: str = Body("评测运营小孟", embed=True),
    reason: str = Body("参数调整后重跑", embed=True),
):
    """第三步：调整参数后重新运行阈值试算"""
    if run_id not in current_trial_runs:
        raise HTTPException(status_code=404, detail=f"运行ID {run_id} 不存在")
    
    trial_run = current_trial_runs[run_id]
    old_params = trial_run.params
    
    new_params = ThresholdParams(
        dedup_threshold=dedup_threshold if dedup_threshold is not None else old_params.dedup_threshold,
        minority_weight=minority_weight if minority_weight is not None else old_params.minority_weight,
        overall_metric_weight=overall_metric_weight if overall_metric_weight is not None else old_params.overall_metric_weight,
        minority_boost_enabled=minority_boost_enabled if minority_boost_enabled is not None else old_params.minority_boost_enabled,
        min_minority_ratio=min_minority_ratio if min_minority_ratio is not None else old_params.min_minority_ratio,
    )
    
    new_run = rerun_with_new_params(trial_run, new_params, operator=operator, reason=reason)
    report = generate_playback_report(new_run)
    current_trial_runs[new_run.run_id] = new_run
    
    return report


@app.get("/trial/{run_id}/report", response_model=PlaybackReport)
async def get_report_api(run_id: str):
    """获取阈值回放报告"""
    if run_id not in current_trial_runs:
        raise HTTPException(status_code=404, detail=f"运行ID {run_id} 不存在")
    
    trial_run = current_trial_runs[run_id]
    return generate_playback_report(trial_run)


@app.get("/trial/{run_id}/audit", response_model=List[AuditLog])
async def get_audit_logs_api(run_id: str):
    """获取审计日志 - 谁改了什么、为什么改、影响哪些结果"""
    if run_id not in current_trial_runs:
        raise HTTPException(status_code=404, detail=f"运行ID {run_id} 不存在")
    
    trial_run = current_trial_runs[run_id]
    return trial_run.audit_logs


@app.post("/demo")
async def run_demo_api():
    """运行完整演示流程"""
    from demo_data import DEMO_CANDIDATES, INITIAL_PARAMS, UPDATED_PARAMS
    import tempfile
    
    candidates = [RecallCandidate(**c) for c in DEMO_CANDIDATES]
    initial_params = ThresholdParams(**INITIAL_PARAMS)
    
    step1 = run_threshold_trial(candidates, initial_params, operator="system", reason="演示第一步：首次导入")
    current_trial_runs[step1.run_id] = step1
    
    step2 = apply_manual_correction(
        step1, "S003",
        operator="评测运营小孟",
        reason="S003是量子计算稀有领域样本，业务价值高",
        new_status=SampleStatus.NEED_ALGO_REVIEW,
        new_next_action=NextAction.ALGO_ENGINEER,
        custom_why_kept="评测运营小孟人工复核：量子计算领域内容稀缺，虽得分低但建议保留",
    )
    current_trial_runs[step2.run_id] = step2
    
    updated_params = ThresholdParams(**UPDATED_PARAMS)
    step3 = rerun_with_new_params(step2, updated_params, operator="算法工程师", reason="参数优化调整")
    current_trial_runs[step3.run_id] = step3
    
    report = generate_playback_report(step3)
    
    return {
        "step1_run_id": step1.run_id,
        "step2_run_id": step2.run_id,
        "step3_run_id": step3.run_id,
        "final_report": report,
        "audit_logs": step3.audit_logs,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
