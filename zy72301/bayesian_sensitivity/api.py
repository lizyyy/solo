from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .models import (
    BoundaryValueNote,
    ErrorExplanation,
    EvidenceSource,
    QuestionnaireRawRow,
    SensitivityResult,
)
from .workflow import WorkflowSession


_sessions: dict[str, WorkflowSession] = {}

app = FastAPI(
    title="贝叶斯先验敏感性试算",
    description="合并问卷原始行与边界值说明，生成可读误差说明，支持复核审计",
)


class ImportRequest(BaseModel):
    session_id: str | None = None
    rows: list[QuestionnaireRawRow]


class BoundaryRequest(BaseModel):
    session_id: str
    notes: list[BoundaryValueNote]
    operator: str = "教研负责人吴老师"


class CorrectionRequest(BaseModel):
    session_id: str
    result_id: str
    field: str
    new_value: str
    reason: str
    operator: str = "教研负责人吴老师"


class RerunRequest(BaseModel):
    session_id: str
    reason: str = "人工修正后重跑"
    operator: str = "教研负责人吴老师"


class SessionResponse(BaseModel):
    session_id: str
    step: int
    step1_done: bool
    step2_done: bool
    step3_done: bool
    result_count: int
    explanation_count: int
    duplicate_count: int
    audit_count: int


class ResultsResponse(BaseModel):
    session_id: str
    results: list[SensitivityResult]


class ExplanationsResponse(BaseModel):
    session_id: str
    explanations: list[ErrorExplanation]


class SummaryResponse(BaseModel):
    session_id: str
    summary: str


class AuditResponse(BaseModel):
    session_id: str
    audit_text: str


def _get_session(session_id: str) -> WorkflowSession:
    if session_id not in _sessions:
        raise HTTPException(status_code=404, detail=f"会话{session_id}不存在")
    return _sessions[session_id]


@app.post("/sessions", response_model=SessionResponse)
def create_session():
    session = WorkflowSession()
    _sessions[session.state.session_id] = session
    return SessionResponse(
        session_id=session.state.session_id,
        step=session.state.current_step,
        step1_done=session.state.step1_imported,
        step2_done=session.state.step2_boundary_reviewed,
        step3_done=session.state.step3_error_updated,
        result_count=0,
        explanation_count=0,
        duplicate_count=0,
        audit_count=0,
    )


@app.post("/sessions/{session_id}/import", response_model=ResultsResponse)
def step1_import(session_id: str, req: ImportRequest):
    session = _get_session(session_id)
    try:
        results = session.step1_import_questionnaire(req.rows)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResultsResponse(session_id=session_id, results=results)


@app.post("/sessions/{session_id}/boundary", response_model=ResultsResponse)
def step2_boundary(session_id: str, req: BoundaryRequest):
    session = _get_session(session_id)
    try:
        results = session.step2_review_boundary(req.notes, req.operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResultsResponse(session_id=session_id, results=results)


@app.post("/sessions/{session_id}/update-explanations", response_model=ExplanationsResponse)
def step3_update(session_id: str, operator: str = "系统"):
    session = _get_session(session_id)
    try:
        explanations = session.step3_update_error_explanations(operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ExplanationsResponse(session_id=session_id, explanations=explanations)


@app.post("/sessions/{session_id}/correct", response_model=ResultsResponse)
def manual_correct(session_id: str, req: CorrectionRequest):
    session = _get_session(session_id)
    try:
        updated = session.manual_correct(
            req.result_id, req.field, req.new_value, req.reason, req.operator
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ResultsResponse(session_id=session_id, results=session.state.results)


@app.post("/sessions/{session_id}/rerun", response_model=ResultsResponse)
def rerun(session_id: str, req: RerunRequest):
    session = _get_session(session_id)
    results = session.rerun(req.reason, req.operator)
    return ResultsResponse(session_id=session_id, results=results)


@app.get("/sessions/{session_id}/summary", response_model=SummaryResponse)
def get_summary(session_id: str):
    session = _get_session(session_id)
    return SummaryResponse(session_id=session_id, summary=session.summary())


@app.get("/sessions/{session_id}/audit", response_model=AuditResponse)
def get_audit(session_id: str):
    session = _get_session(session_id)
    return AuditResponse(session_id=session_id, audit_text=session.get_audit_text())


@app.get("/sessions/{session_id}", response_model=SessionResponse)
def get_session_info(session_id: str):
    session = _get_session(session_id)
    dup_count = sum(1 for r in session.state.results if r.is_duplicate)
    return SessionResponse(
        session_id=session_id,
        step=session.state.current_step,
        step1_done=session.state.step1_imported,
        step2_done=session.state.step2_boundary_reviewed,
        step3_done=session.state.step3_error_updated,
        result_count=len(session.state.results),
        explanation_count=len(session.state.explanations),
        duplicate_count=dup_count,
        audit_count=len(session.state.audit_trail),
    )
