from __future__ import annotations
import uuid
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .database import init_db, get_db
from . import models, schemas, service
from . import export as export_module
from .export import (
    draft_to_out,
    param_to_out,
    run_to_out,
    anomaly_to_out,
)


app = FastAPI(title="误差传播批量验算 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup():
    init_db()


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "误差传播批量验算"}


@app.get("/api/param-versions", response_model=List[schemas.ParamVersionOut])
def list_param_versions(db: Session = Depends(get_db)):
    rows = (
        db.query(models.ParamVersion)
        .order_by(models.ParamVersion.is_active.desc(), models.ParamVersion.created_at.desc())
        .all()
    )
    return [param_to_out(r) for r in rows]


@app.post("/api/param-versions", response_model=schemas.ParamVersionOut)
def create_param_version(body: schemas.ParamVersionIn, db: Session = Depends(get_db)):
    if body.isActive:
        db.query(models.ParamVersion).update({models.ParamVersion.is_active: False})
    pv = models.ParamVersion(
        name=body.name,
        tolerance=body.tolerance,
        rounding_rule=body.roundingRule,
        sig_figs=body.sigFigs,
        is_active=body.isActive,
    )
    db.add(pv)
    db.commit()
    db.refresh(pv)
    return param_to_out(pv)


@app.patch("/api/param-versions/{pv_id}/activate")
def activate_param_version(pv_id: str, db: Session = Depends(get_db)):
    pv = db.query(models.ParamVersion).filter(models.ParamVersion.id == pv_id).first()
    if pv is None:
        raise HTTPException(404, "参数版本不存在")
    db.query(models.ParamVersion).update({models.ParamVersion.is_active: False})
    pv.is_active = True
    db.commit()
    return {"ok": True}


@app.post("/api/batches/submit", response_model=schemas.FullRunResponse)
def submit_batch(body: schemas.BatchSubmitRequest, db: Session = Depends(get_db)):
    if not body.drafts:
        raise HTTPException(400, "草稿列表不能为空")

    batch_id = body.batchId or f"batch-{uuid.uuid4().hex[:10]}"

    drafts, _new_count = service.upsert_drafts(db, body.drafts, batch_id=batch_id)

    pv = service.get_or_create_param_version(
        db, body.paramVersionId, body.paramVersion
    )

    run = service.run_calculation_for_drafts(
        db, drafts, pv, batch_id=batch_id, editor_note=body.editorNote
    )
    db.commit()

    db.refresh(run)
    all_pv = (
        db.query(models.ParamVersion)
        .order_by(models.ParamVersion.is_active.desc(), models.ParamVersion.created_at.desc())
        .all()
    )
    all_drafts_for_run = (
        db.query(models.DraftEntry)
        .filter(models.DraftEntry.id.in_(run.all_draft_ids))
        .all()
    )
    return schemas.FullRunResponse(
        run=run_to_out(run),
        drafts=[draft_to_out(d) for d in all_drafts_for_run],
        paramVersions=[param_to_out(p) for p in all_pv],
        globalSummary=run.summary,
    )


@app.get("/api/runs", response_model=List[schemas.CalculationRunOut])
def list_runs(
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.CalculationRun)
    if batch_id:
        q = q.filter(models.CalculationRun.batch_id == batch_id)
    rows = q.order_by(models.CalculationRun.started_at.desc()).all()
    return [run_to_out(r) for r in rows]


@app.get("/api/runs/{run_id}", response_model=schemas.FullRunResponse)
def get_run(run_id: str, db: Session = Depends(get_db)):
    run = (
        db.query(models.CalculationRun)
        .filter(models.CalculationRun.id == run_id)
        .first()
    )
    if run is None:
        raise HTTPException(404, "运行记录不存在")
    all_pv = (
        db.query(models.ParamVersion)
        .order_by(models.ParamVersion.is_active.desc(), models.ParamVersion.created_at.desc())
        .all()
    )
    all_drafts_for_run = (
        db.query(models.DraftEntry)
        .filter(models.DraftEntry.id.in_(run.all_draft_ids))
        .all()
    )
    return schemas.FullRunResponse(
        run=run_to_out(run),
        drafts=[draft_to_out(d) for d in all_drafts_for_run],
        paramVersions=[param_to_out(p) for p in all_pv],
        globalSummary=run.summary,
    )


@app.post("/api/runs/{run_id}/rerun", response_model=schemas.FullRunResponse)
def rerun(run_id: str, db: Session = Depends(get_db)):
    run = (
        db.query(models.CalculationRun)
        .filter(models.CalculationRun.id == run_id)
        .first()
    )
    if run is None:
        raise HTTPException(404, "运行记录不存在")
    drafts = (
        db.query(models.DraftEntry)
        .filter(models.DraftEntry.id.in_(run.all_draft_ids))
        .all()
    )
    pv = run.param_version
    if pv is None:
        raise HTTPException(400, "参数版本已丢失，无法重跑")
    new_run = service.run_calculation_for_drafts(
        db,
        drafts,
        pv,
        batch_id=run.batch_id,
        editor_note=None,
    )
    db.commit()
    db.refresh(new_run)
    all_pv = (
        db.query(models.ParamVersion)
        .order_by(models.ParamVersion.is_active.desc(), models.ParamVersion.created_at.desc())
        .all()
    )
    return schemas.FullRunResponse(
        run=run_to_out(new_run),
        drafts=[draft_to_out(d) for d in drafts],
        paramVersions=[param_to_out(p) for p in all_pv],
        globalSummary=new_run.summary,
    )


@app.patch("/api/runs/{run_id}/editor-note")
def update_editor_note(
    run_id: str, body: schemas.EditorNoteRequest, db: Session = Depends(get_db)
):
    run = (
        db.query(models.CalculationRun)
        .filter(models.CalculationRun.id == run_id)
        .first()
    )
    if run is None:
        raise HTTPException(404, "运行记录不存在")
    run.editor_note = body.editorNote
    db.commit()
    return {"ok": True, "editorNote": run.editor_note}


@app.patch("/api/anomalies/{anomaly_id}/resolve")
def resolve_anomaly(
    anomaly_id: str,
    body: schemas.AnomalyResolveRequest,
    db: Session = Depends(get_db),
):
    a = (
        db.query(models.Anomaly)
        .filter(models.Anomaly.id == anomaly_id)
        .first()
    )
    if a is None:
        raise HTTPException(404, "异常记录不存在")
    a.resolved = body.resolved
    if body.resolverNote is not None:
        a.resolver_note = body.resolverNote
    db.commit()
    return anomaly_to_out(a)


@app.patch("/api/drafts/{draft_id}/note")
def update_draft_note(
    draft_id: str, body: schemas.NoteUpdateRequest, db: Session = Depends(get_db)
):
    d = (
        db.query(models.DraftEntry)
        .filter(models.DraftEntry.id == draft_id)
        .first()
    )
    if d is None:
        raise HTTPException(404, "草稿不存在")
    from .engine.fingerprint import make_submission_fingerprint

    d.supplementary_note = body.note
    d.submission_fingerprint = make_submission_fingerprint(
        d.question_no, d.answer_content, body.note
    )
    db.commit()
    return draft_to_out(d)


@app.get("/api/runs/{run_id}/export", response_model=schemas.ExportMarkdownResponse)
def export_run(run_id: str, db: Session = Depends(get_db)):
    md = export_module.build_markdown_export(db, run_id)
    return {"markdown": md}
