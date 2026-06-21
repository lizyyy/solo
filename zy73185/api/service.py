from __future__ import annotations
import time
from typing import List, Optional, Tuple, Dict

from sqlalchemy.orm import Session

from . import models, schemas
from .engine.fingerprint import make_submission_fingerprint
from .engine.dedupe import (
    DraftLite,
    AnomalyLite,
    detect_duplicate_submissions,
    detect_duplicate_samples,
    duplicate_sample_ids,
)
from .engine.conflict import (
    detect_answer_version_conflicts,
    detect_missing_notes,
)


def _now_ms() -> int:
    return int(time.time() * 1000)


def _draft_lite(d: models.DraftEntry) -> DraftLite:
    return DraftLite(
        id=d.id,
        question_no=d.question_no,
        answer_content=d.answer_content,
        answer_version=d.answer_version,
        supplementary_note=d.supplementary_note,
        fingerprint=d.submission_fingerprint,
    )


def _build_summary(
    anomalies: List[AnomalyLite],
    total_drafts: int,
    valid_count: int,
    param_name: str,
) -> str:
    conflict = sum(1 for a in anomalies if a.type == "answer_version_conflict")
    dup_sub = sum(1 for a in anomalies if a.type == "duplicate_submission")
    dup_sample = sum(1 for a in anomalies if a.type == "duplicate_sample")
    missing = sum(1 for a in anomalies if a.type == "missing_note")
    return (
        f"参数版本【{param_name}】提交 {total_drafts} 条草稿，"
        f"有效样本 {valid_count} 条；检测到答案版本冲突 {conflict} 处、"
        f"重复提交 {dup_sub} 处、重复样本 {dup_sample} 处、"
        f"不齐整（待补备注）{missing} 条。"
    )


def upsert_drafts(
    db: Session,
    draft_ins: List[schemas.DraftIn],
    batch_id: Optional[str] = None,
) -> Tuple[List[models.DraftEntry], int]:
    """Insert drafts, skipping any whose fingerprint already exists.

    Returns (all_db_drafts_for_batch, newly_inserted_count).
    Existing drafts with matching fingerprint are reused — no duplicate records,
    and the same supplementary note is never double-counted.
    """
    existing_by_fp: Dict[str, models.DraftEntry] = {}
    fingerprints = [
        make_submission_fingerprint(
            d.questionNo, d.answerContent, d.supplementaryNote
        )
        for d in draft_ins
    ]
    rows = (
        db.query(models.DraftEntry)
        .filter(models.DraftEntry.submission_fingerprint.in_(set(fingerprints)))
        .all()
    )
    for r in rows:
        existing_by_fp[r.submission_fingerprint] = r

    inserted: List[models.DraftEntry] = []
    all_in_batch: List[models.DraftEntry] = []
    for d_in, fp in zip(draft_ins, fingerprints):
        existing = existing_by_fp.get(fp)
        if existing is not None:
            if existing.batch_id is None and batch_id is not None:
                existing.batch_id = batch_id
            all_in_batch.append(existing)
            continue
        db_draft = models.DraftEntry(
            question_no=d_in.questionNo,
            answer_content=d_in.answerContent,
            answer_version=d_in.answerVersion,
            supplementary_note=d_in.supplementaryNote,
            raw_source=d_in.rawSource
            or f"{d_in.questionNo} | {d_in.answerContent}",
            submission_fingerprint=fp,
            batch_id=batch_id,
        )
        db.add(db_draft)
        inserted.append(db_draft)
        all_in_batch.append(db_draft)
    if inserted:
        db.flush()
    return all_in_batch, len(inserted)


def get_or_create_param_version(
    db: Session,
    param_version_id: Optional[str],
    param_version_in: Optional[schemas.ParamVersionIn],
) -> models.ParamVersion:
    if param_version_id:
        pv = (
            db.query(models.ParamVersion)
            .filter(models.ParamVersion.id == param_version_id)
            .first()
        )
        if pv is not None:
            return pv
    if param_version_in is not None:
        pv = models.ParamVersion(
            name=param_version_in.name,
            tolerance=param_version_in.tolerance,
            rounding_rule=param_version_in.roundingRule,
            sig_figs=param_version_in.sigFigs,
            is_active=param_version_in.isActive,
        )
        db.add(pv)
        db.flush()
        if pv.is_active:
            (
                db.query(models.ParamVersion)
                .filter(models.ParamVersion.id != pv.id)
                .update({models.ParamVersion.is_active: False})
            )
        return pv
    default = (
        db.query(models.ParamVersion)
        .order_by(models.ParamVersion.is_active.desc(), models.ParamVersion.created_at.desc())
        .first()
    )
    if default is None:
        default = models.ParamVersion(
            name="v1-默认参数",
            tolerance=0.05,
            rounding_rule="round",
            sig_figs=3,
            is_active=True,
        )
        db.add(default)
        db.flush()
    return default


def run_calculation_for_drafts(
    db: Session,
    drafts: List[models.DraftEntry],
    param_version: models.ParamVersion,
    batch_id: Optional[str] = None,
    editor_note: Optional[str] = None,
) -> models.CalculationRun:
    started = _now_ms()
    lite = [_draft_lite(d) for d in drafts]

    dup_sub_result = detect_duplicate_submissions(lite)
    after_dedup = dup_sub_result.kept

    version_conflicts = detect_answer_version_conflicts(after_dedup)
    dup_samples = detect_duplicate_samples(after_dedup)
    missing_notes = detect_missing_notes(after_dedup)

    all_anomalies_lite: List[AnomalyLite] = [
        *dup_sub_result.anomalies,
        *version_conflicts,
        *dup_samples,
        *missing_notes,
    ]

    dup_sample_excluded = duplicate_sample_ids(after_dedup)
    dup_sub_excluded = {
        did
        for a in dup_sub_result.anomalies
        for did in a.related_draft_ids[1:]
    }
    excluded_ids = dup_sample_excluded | dup_sub_excluded
    valid_ids = [d.id for d in after_dedup if d.id not in excluded_ids]

    total_submitted = len(drafts)
    summary = _build_summary(
        all_anomalies_lite, total_submitted, len(valid_ids), param_version.name
    )

    run = models.CalculationRun(
        param_version_id=param_version.id,
        started_at=started,
        finished_at=_now_ms(),
        valid_draft_ids=valid_ids,
        all_draft_ids=[d.id for d in drafts],
        summary=summary,
        editor_note=editor_note,
        batch_id=batch_id,
    )
    db.add(run)
    db.flush()

    for a_lite in all_anomalies_lite:
        anomaly = models.Anomaly(
            run_id=run.id,
            type=a_lite.type,
            source_description=a_lite.source_description,
            impact_scope=a_lite.impact_scope,
            explanation=a_lite.explanation,
            resolved=False,
        )
        db.add(anomaly)
        db.flush()
        for did in a_lite.related_draft_ids:
            db.execute(
                models.AnomalyDraft.__table__.insert().values(
                    anomaly_id=anomaly.id, draft_id=did
                )
            )
    db.flush()
    return run
