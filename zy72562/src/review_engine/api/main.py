#!/usr/bin/env python3
import os
import sys
from datetime import datetime
from typing import List, Optional, Dict, Any
import json

from fastapi import FastAPI, HTTPException, Request, Form, UploadFile, File
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from review_engine import (
    ReviewEngine,
    NegativeSample,
    RecallCandidate,
    ReviewStatus,
    AnomalySample,
)

app = FastAPI(title="模型蒸馏质量复核API")

STORAGE_PATH = os.environ.get("REVIEW_STORAGE", "./review_data")
engine = ReviewEngine(storage_path=STORAGE_PATH)

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "web", "templates")
templates = Jinja2Templates(directory=TEMPLATES_DIR)


def anomaly_to_dict(anomaly: AnomalySample) -> Dict[str, Any]:
    return {
        "anomaly_id": anomaly.anomaly_id,
        "sample_id": anomaly.sample_id,
        "status": anomaly.status.value,
        "main_process_name": anomaly.negative_sample.main_process_name,
        "has_time_window_issue": anomaly.has_time_window_inflation(),
        "time_window_issue_count": len(anomaly.time_window_issues),
        "recall_count": len(anomaly.recall_candidates),
        "why_kept": anomaly.why_kept,
        "missing_materials": anomaly.missing_materials,
        "next_action_owner": anomaly.get_owner_display(),
        "next_action_desc": anomaly.next_action.action_description if anomaly.next_action else "",
        "tags": anomaly.tags,
        "updated_at": anomaly.updated_at.isoformat(),
    }


def anomaly_detail_to_dict(anomaly: AnomalySample) -> Dict[str, Any]:
    result = anomaly_to_dict(anomaly)
    result["negative_sample"] = {
        "sample_id": anomaly.negative_sample.sample_id,
        "main_process_id": anomaly.negative_sample.main_process_id,
        "main_process_name": anomaly.negative_sample.main_process_name,
        "timestamp": anomaly.negative_sample.timestamp.isoformat(),
        "feature_values": anomaly.negative_sample.feature_values,
        "ground_truth_label": anomaly.negative_sample.ground_truth_label,
        "model_prediction_score": anomaly.negative_sample.model_prediction_score,
        "source": anomaly.negative_sample.source,
        "time_window_tag": anomaly.negative_sample.time_window_tag,
        "notes": anomaly.negative_sample.notes,
    }
    result["recall_candidates"] = [
        {
            "candidate_id": c.candidate_id,
            "scene_description": c.scene_description,
            "timestamp": c.timestamp.isoformat(),
            "recall_source": c.recall_source,
            "scene_context": c.scene_context,
            "field_evidence": c.field_evidence,
            "confidence_score": c.confidence_score,
            "added_by": c.added_by,
            "notes": c.notes,
        }
        for c in anomaly.recall_candidates
    ]
    result["time_window_issues"] = [
        {
            "issue_id": i.issue_id,
            "description": i.description,
            "severity": i.severity.value,
            "window_start": i.window_start.isoformat() if i.window_start else None,
            "window_end": i.window_end.isoformat() if i.window_end else None,
            "affected_metrics": i.affected_metrics,
            "inflated_effect_estimate": i.inflated_effect_estimate,
        }
        for i in anomaly.time_window_issues
    ]
    if anomaly.evidence_merge:
        result["evidence_merge"] = {
            "merged_evidence_id": anomaly.evidence_merge.merged_evidence_id,
            "summary": anomaly.evidence_merge.summary,
            "supporting_points": anomaly.evidence_merge.supporting_points,
            "conflicting_points": anomaly.evidence_merge.conflicting_points,
        }
    result["review_comments"] = anomaly.review_comments
    result["detected_at"] = anomaly.detected_at.isoformat()
    return result


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    stats = engine.get_statistics()
    anomalies = engine.get_anomaly_list()
    anomaly_list = [anomaly_to_dict(a) for a in anomalies]
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "stats": stats,
            "anomalies": anomaly_list,
            "status_options": [s.value for s in ReviewStatus],
        },
    )


@app.get("/anomaly/{anomaly_id}", response_class=HTMLResponse)
async def anomaly_detail_page(request: Request, anomaly_id: str):
    anomaly = engine.get_anomaly_detail(anomaly_id)
    if not anomaly:
        raise HTTPException(status_code=404, detail="异常样本不存在")
    detail = anomaly_detail_to_dict(anomaly)
    history = engine.get_review_history(anomaly_id)
    history_list = [
        {
            "record_id": r.record_id,
            "reviewer": r.reviewer,
            "action": r.action,
            "comment": r.comment,
            "old_status": r.old_status.value if r.old_status else None,
            "new_status": r.new_status.value,
            "timestamp": r.timestamp.isoformat(),
        }
        for r in history
    ]
    return templates.TemplateResponse(
        "detail.html",
        {
            "request": request,
            "anomaly": detail,
            "history": history_list,
        },
    )


@app.get("/api/stats")
async def get_stats():
    return engine.get_statistics()


@app.get("/api/anomalies")
async def get_anomalies(
    status: Optional[str] = None,
    has_time_window: Optional[bool] = None,
):
    status_enum = ReviewStatus(status) if status else None
    anomalies = engine.get_anomaly_list(status=status_enum, has_time_window_issue=has_time_window)
    return [anomaly_to_dict(a) for a in anomalies]


@app.get("/api/anomalies/{anomaly_id}")
async def get_anomaly_detail(anomaly_id: str):
    anomaly = engine.get_anomaly_detail(anomaly_id)
    if not anomaly:
        raise HTTPException(status_code=404, detail="异常样本不存在")
    return anomaly_detail_to_dict(anomaly)


@app.post("/api/import/negative")
async def import_negative_samples(file: UploadFile = File(...)):
    content = await file.read()
    data = json.loads(content)
    samples = []
    for item in data:
        item["timestamp"] = datetime.fromisoformat(item["timestamp"])
        if "imported_at" in item:
            item["imported_at"] = datetime.fromisoformat(item["imported_at"])
        samples.append(NegativeSample(**item))
    new_anomalies = engine.import_negative_samples(samples)
    return {
        "imported_count": len(samples),
        "new_anomalies_count": len(new_anomalies),
        "anomalies": [anomaly_to_dict(a) for a in new_anomalies],
    }


@app.post("/api/import/recall")
async def import_recall_candidates(file: UploadFile = File(...)):
    content = await file.read()
    data = json.loads(content)
    candidates = []
    for item in data:
        item["timestamp"] = datetime.fromisoformat(item["timestamp"])
        if "added_at" in item:
            item["added_at"] = datetime.fromisoformat(item["added_at"])
        candidates.append(RecallCandidate(**item))
    updated = engine.add_recall_candidates(candidates)
    return {
        "imported_count": len(candidates),
        "updated_anomalies_count": len(updated),
        "anomalies": [anomaly_to_dict(a) for a in updated],
    }


@app.post("/api/anomalies/{anomaly_id}/review")
async def submit_review(
    anomaly_id: str,
    reviewer: str = Form(...),
    approved: bool = Form(...),
    comment: str = Form(""),
):
    result = engine.submit_expert_review(
        anomaly_id=anomaly_id,
        reviewer=reviewer,
        approved=approved,
        comment=comment,
    )
    if not result:
        raise HTTPException(status_code=404, detail="异常样本不存在")
    return anomaly_detail_to_dict(result)


@app.get("/api/anomalies/{anomaly_id}/history")
async def get_history(anomaly_id: str):
    history = engine.get_review_history(anomaly_id)
    return [
        {
            "record_id": r.record_id,
            "reviewer": r.reviewer,
            "action": r.action,
            "comment": r.comment,
            "old_status": r.old_status.value if r.old_status else None,
            "new_status": r.new_status.value,
            "timestamp": r.timestamp.isoformat(),
        }
        for r in history
    ]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
