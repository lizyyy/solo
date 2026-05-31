from __future__ import annotations

import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from .exporter import LedgerExporter
from .models import RepoStatus, ServiceError, TagAction
from .service import MultiRepoTagService

_DB_PATH = os.environ.get("MULTI_REPO_TAG_DB", "multi_repo_tag.db")

app = FastAPI(title="多仓库版本标记", version="1.0.0")

_service: Optional[MultiRepoTagService] = None


def _get_service() -> MultiRepoTagService:
    global _service
    if _service is None:
        _service = MultiRepoTagService(db_path=_DB_PATH)
    return _service


class ImportRepoRequest(BaseModel):
    path: str
    name: Optional[str] = None
    operator: Optional[str] = None


class ImportReposBatchRequest(BaseModel):
    paths: list[str]
    operator: Optional[str] = None


class ChangeOrderRequest(BaseModel):
    order_id: str
    entries: list[dict]
    operator: Optional[str] = None


class ApplyTagRequest(BaseModel):
    repo_id: str
    tag_name: str
    tag_message: str = ""
    change_order_id: Optional[str] = None
    operator: Optional[str] = None


class CorrectTagRequest(BaseModel):
    repo_id: str
    old_tag_name: str
    new_tag_name: str
    reason: str = ""
    operator: Optional[str] = None


class AckDiffRequest(BaseModel):
    operator: Optional[str] = None


class ExportRequest(BaseModel):
    format: str = "text"
    since: Optional[str] = None
    until: Optional[str] = None


def _handle_service_error(e: ServiceError):
    status_map = {
        "REPO_NOT_FOUND": 404,
        "TAG_NOT_FOUND": 404,
        "DIFF_NOT_FOUND": 404,
        "ORDER_NOT_FOUND": 404,
        "PATH_MISSING": 400,
        "NOT_GIT_REPO": 400,
        "TAG_EXISTS": 409,
        "GIT_TAG_FAILED": 500,
        "UNACKNOWLEDGED_DIFF": 409,
    }
    status = status_map.get(e.code, 500)
    raise HTTPException(status_code=status, detail={"code": e.code, "message": e.message, "detail": e.detail})


@app.on_event("shutdown")
def shutdown():
    global _service
    if _service is not None:
        _service.close()
        _service = None


@app.post("/api/repos/import")
def import_repo(req: ImportRepoRequest):
    svc = _get_service()
    if req.operator:
        svc.operator = req.operator
    try:
        repo = svc.import_repo(req.path, req.name)
        return {"ok": True, "data": repo.model_dump(mode="json")}
    except ServiceError as e:
        _handle_service_error(e)


@app.post("/api/repos/import-batch")
def import_repos_batch(req: ImportReposBatchRequest):
    svc = _get_service()
    if req.operator:
        svc.operator = req.operator
    repos = svc.import_repos_batch(req.paths)
    return {"ok": True, "data": [r.model_dump(mode="json") for r in repos]}


@app.get("/api/repos")
def list_repos(status: Optional[str] = None):
    svc = _get_service()
    repo_status = RepoStatus(status) if status else None
    repos = svc.store.list_repos(status=repo_status)
    return {"ok": True, "data": [r.model_dump(mode="json") for r in repos]}


@app.get("/api/repos/{repo_id}")
def get_repo(repo_id: str):
    svc = _get_service()
    detail = svc.get_repo_detail(repo_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="仓库不存在")
    return {"ok": True, "data": {"repo": detail["repo"].model_dump(mode="json"), "tags": [t.model_dump(mode="json") for t in detail["tags"]]}}


@app.post("/api/repos/{repo_id}/refresh")
def refresh_repo(repo_id: str):
    svc = _get_service()
    try:
        repo = svc.refresh_repo(repo_id)
        return {"ok": True, "data": repo.model_dump(mode="json")}
    except ServiceError as e:
        _handle_service_error(e)


@app.post("/api/change-orders/import")
def import_change_order(req: ChangeOrderRequest):
    svc = _get_service()
    if req.operator:
        svc.operator = req.operator
    try:
        result = svc.import_change_order(req.order_id, req.entries, req.operator)
        resp = {"ok": True, "data": result.change_order.model_dump(mode="json"), "is_reupload": result.is_reupload}
        if result.warning:
            resp["warning"] = result.warning
        if result.diff:
            resp["diff"] = result.diff.model_dump(mode="json")
        return resp
    except ServiceError as e:
        _handle_service_error(e)


@app.get("/api/change-orders/{order_id}/history")
def get_order_history(order_id: str):
    svc = _get_service()
    versions = svc.get_order_history(order_id)
    return {"ok": True, "data": [v.model_dump(mode="json") for v in versions]}


@app.post("/api/tags/apply")
def apply_tag(req: ApplyTagRequest):
    svc = _get_service()
    if req.operator:
        svc.operator = req.operator
    try:
        tag = svc.apply_tag(req.repo_id, req.tag_name, req.tag_message, req.change_order_id)
        return {"ok": True, "data": tag.model_dump(mode="json")}
    except ServiceError as e:
        _handle_service_error(e)


@app.post("/api/tags/apply-order/{order_id}")
def apply_tags_from_order(order_id: str, operator: Optional[str] = None):
    svc = _get_service()
    try:
        tags = svc.apply_tags_from_order(order_id, operator=operator)
        return {"ok": True, "data": [t.model_dump(mode="json") for t in tags]}
    except ServiceError as e:
        _handle_service_error(e)


@app.get("/api/review")
def review_tags(repo_id: Optional[str] = None):
    svc = _get_service()
    data = svc.review_tags(repo_id)
    return {"ok": True, "data": data}


@app.post("/api/tags/{tag_id}/confirm")
def confirm_tag(tag_id: str):
    svc = _get_service()
    try:
        tag = svc.confirm_tag(tag_id)
        return {"ok": True, "data": tag.model_dump(mode="json")}
    except ServiceError as e:
        _handle_service_error(e)


@app.post("/api/repos/{repo_id}/confirm-all")
def confirm_all_tags(repo_id: str):
    svc = _get_service()
    confirmed = svc.confirm_all_tags(repo_id)
    return {"ok": True, "data": [t.model_dump(mode="json") for t in confirmed]}


@app.post("/api/tags/correct")
def correct_tag(req: CorrectTagRequest):
    svc = _get_service()
    if req.operator:
        svc.operator = req.operator
    try:
        tag = svc.correct_tag(req.repo_id, req.old_tag_name, req.new_tag_name, req.reason)
        return {"ok": True, "data": tag.model_dump(mode="json")}
    except ServiceError as e:
        _handle_service_error(e)


@app.get("/api/diffs/unacknowledged")
def get_unacknowledged_diffs():
    svc = _get_service()
    diffs = svc.get_unacknowledged_diffs()
    return {"ok": True, "data": [d.model_dump(mode="json") for d in diffs]}


@app.post("/api/diffs/{diff_id}/acknowledge")
def acknowledge_diff(diff_id: str, req: AckDiffRequest):
    svc = _get_service()
    try:
        diff = svc.acknowledge_diff(diff_id, req.operator)
        return {"ok": True, "data": diff.model_dump(mode="json")}
    except ServiceError as e:
        _handle_service_error(e)


@app.get("/api/ledger")
def get_ledger(
    action: Optional[str] = None,
    repo_id: Optional[str] = None,
    operator: Optional[str] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
    limit: int = 200,
):
    svc = _get_service()
    tag_action = TagAction(action) if action else None
    entries = svc.get_ledger(action=tag_action, repo_id=repo_id, operator=operator, since=since, until=until, limit=limit)
    return {"ok": True, "data": [e.model_dump(mode="json") for e in entries]}


@app.post("/api/export")
def export_ledger(req: ExportRequest):
    svc = _get_service()
    exporter = LedgerExporter(svc.store)
    since_dt = datetime.fromisoformat(req.since) if req.since else None
    until_dt = datetime.fromisoformat(req.until) if req.until else None
    if req.format == "json":
        content = exporter.export_json(since=since_dt, until=until_dt)
        return {"ok": True, "format": "json", "data": content}
    content = exporter.export_text(since=since_dt, until=until_dt)
    return {"ok": True, "format": "text", "data": content}


@app.get("/api/export/handoff", response_class=PlainTextResponse)
def export_handoff():
    svc = _get_service()
    exporter = LedgerExporter(svc.store)
    return exporter.export_handoff_report()
