import csv
import io
import json
from datetime import datetime
from typing import List, Optional
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from models import (
    RhythmScore, RhythmNote, StudentTap, Level, LevelStatus,
    ScoreReport, CorrectionAudit, Session, SingleBeatResult,
    BeatJudgment, PlaybackHint, TupletGroup, TempoChange, ErrorResponse,
)
from engine import judge_level, compute_score, generate_playback_hints
from store import store

app = FastAPI(title="音乐课节奏闯关 API", version="1.0.0")


class CreateSessionRequest(BaseModel):
    student_name: str


class CreateScoreRequest(BaseModel):
    name: str
    bpm: float
    time_signature_num: int = 4
    time_signature_den: int = 4
    notes: List[RhythmNote]
    tuplet_groups: List[TupletGroup] = []
    tempo_changes: List[TempoChange] = []


class CreateLevelRequest(BaseModel):
    session_id: str
    score_id: str
    level_number: int
    pass_threshold: float = 60.0


class SubmitTapsRequest(BaseModel):
    taps: List[StudentTap]


class CorrectBeatRequest(BaseModel):
    beat_index: int
    new_judgment: BeatJudgment
    new_offset_ms: Optional[float] = None
    reason: str
    corrected_by: str


class CorrectScoreRequest(BaseModel):
    new_total_score: float
    reason: str
    corrected_by: str


class ExportFormat(BaseModel):
    format: str = "json"


_scores: dict[str, RhythmScore] = {}


@app.post("/sessions", response_model=Session, summary="创建学生会话")
def create_session(req: CreateSessionRequest):
    sid = str(uuid4())
    session = Session(session_id=sid, student_name=req.student_name)
    store.add_session(session)
    return session


@app.get("/sessions/{session_id}", response_model=Session, summary="查询会话")
def get_session(session_id: str):
    s = store.get_session(session_id)
    if not s:
        raise HTTPException(404, "会话不存在")
    return s


@app.post("/scores", response_model=RhythmScore, summary="创建节奏谱")
def create_score(req: CreateScoreRequest):
    sid = str(uuid4())
    score = RhythmScore(score_id=sid, **req.model_dump())
    _scores[sid] = score
    return score


@app.get("/scores/{score_id}", response_model=RhythmScore, summary="查询节奏谱")
def get_score(score_id: str):
    s = _scores.get(score_id)
    if not s:
        raise HTTPException(404, "节奏谱不存在")
    return s


@app.post("/levels", response_model=Level, summary="创建关卡")
def create_level(req: CreateLevelRequest):
    session = store.get_session(req.session_id)
    if not session:
        raise HTTPException(404, "会话不存在")
    if req.score_id not in _scores:
        raise HTTPException(404, "节奏谱不存在")
    lid = str(uuid4())
    level = Level(
        level_id=lid,
        session_id=req.session_id,
        score_id=req.score_id,
        level_number=req.level_number,
        pass_threshold=req.pass_threshold,
    )
    store.add_level(level)
    session.current_level = req.level_number
    return level


@app.get("/levels/{level_id}", response_model=Level, summary="查询关卡")
def get_level(level_id: str):
    lv = store.get_level(level_id)
    if not lv:
        raise HTTPException(404, "关卡不存在")
    return lv


@app.post("/levels/{level_id}/submit", response_model=ScoreReport, summary="提交敲击并推进关卡状态")
def submit_taps(level_id: str, req: SubmitTapsRequest):
    lv = store.get_level(level_id)
    if not lv:
        raise HTTPException(404, "关卡不存在")
    if lv.status not in (LevelStatus.CREATED, LevelStatus.IN_PROGRESS):
        raise HTTPException(400, f"关卡状态为 {lv.status}，无法提交")

    score = _scores.get(lv.score_id)
    if not score:
        raise HTTPException(404, "关联节奏谱不存在")

    lv.taps = req.taps
    lv.status = LevelStatus.IN_PROGRESS

    results, extra_taps, tuplet_errors, tempo_score = judge_level(lv, score)
    lv.beat_results = results
    total_score = compute_score(results, tuplet_errors, tempo_score)
    lv.total_score = total_score
    lv.status = LevelStatus.COMPLETED if total_score >= lv.pass_threshold else LevelStatus.FAILED
    lv.completed_at = datetime.now()

    hints = generate_playback_hints(results, tuplet_errors)

    counts = {j.value: 0 for j in BeatJudgment}
    for r in results:
        counts[r.judgment.value] += 1

    report = ScoreReport(
        session_id=lv.session_id,
        level_id=lv.level_id,
        score_id=lv.score_id,
        level_number=lv.level_number,
        total_score=total_score,
        max_score=lv.max_score,
        passed=total_score >= lv.pass_threshold,
        perfect_count=counts[BeatJudgment.PERFECT.value],
        good_count=counts[BeatJudgment.GOOD.value],
        rushed_count=counts[BeatJudgment.RUSHED.value],
        dragged_count=counts[BeatJudgment.DRAGGED.value],
        missing_count=counts[BeatJudgment.MISSING.value],
        extra_count=counts[BeatJudgment.EXTRA.value],
        tuplet_errors=tuplet_errors,
        tempo_adaptation_score=tempo_score,
        beat_results=results,
        playback_hints=hints,
    )
    store.add_report(report)
    return report


@app.get("/levels/{level_id}/report", response_model=ScoreReport, summary="查询成绩报告")
def get_report(level_id: str):
    r = store.get_report(level_id)
    if not r:
        raise HTTPException(404, "报告不存在，请先提交敲击")
    return r


@app.post("/levels/{level_id}/correct/beat", response_model=CorrectionAudit, summary="修正单拍判定")
def correct_beat(level_id: str, req: CorrectBeatRequest):
    lv = store.get_level(level_id)
    if not lv:
        raise HTTPException(404, "关卡不存在")

    target: Optional[SingleBeatResult] = None
    for br in lv.beat_results:
        if br.beat_index == req.beat_index:
            target = br
            break
    if target is None:
        raise HTTPException(404, f"未找到第{req.beat_index}拍的判定结果")

    old_val = json.dumps(
        {"judgment": target.judgment.value, "offset_ms": target.offset_ms},
        ensure_ascii=False,
    )
    new_val = json.dumps(
        {"judgment": req.new_judgment.value, "offset_ms": req.new_offset_ms},
        ensure_ascii=False,
    )

    audit = store.correct_field(
        session_id=lv.session_id,
        level_id=level_id,
        field_path=f"beat_results[{req.beat_index}]",
        old_value=old_val,
        new_value=new_val,
        reason=req.reason,
        corrected_by=req.corrected_by,
    )

    target.judgment = req.new_judgment
    if req.new_offset_ms is not None:
        target.offset_ms = req.new_offset_ms

    return audit


@app.post("/levels/{level_id}/correct/score", response_model=CorrectionAudit, summary="修正总分")
def correct_score(level_id: str, req: CorrectScoreRequest):
    lv = store.get_level(level_id)
    if not lv:
        raise HTTPException(404, "关卡不存在")

    old_score = lv.total_score
    audit = store.correct_field(
        session_id=lv.session_id,
        level_id=level_id,
        field_path="total_score",
        old_value=str(old_score),
        new_value=str(req.new_total_score),
        reason=req.reason,
        corrected_by=req.corrected_by,
    )
    lv.total_score = req.new_total_score
    lv.status = LevelStatus.COMPLETED if req.new_total_score >= lv.pass_threshold else LevelStatus.FAILED

    report = store.get_report(level_id)
    if report:
        report.total_score = req.new_total_score
        report.passed = req.new_total_score >= lv.pass_threshold

    return audit


@app.get("/audits/session/{session_id}", response_model=List[CorrectionAudit], summary="查询会话审计记录")
def get_session_audits(session_id: str):
    return store.get_audits_for_session(session_id)


@app.get("/audits/level/{level_id}", response_model=List[CorrectionAudit], summary="查询关卡审计记录")
def get_level_audits(level_id: str):
    return store.get_audits_for_level(level_id)


@app.get("/export/{level_id}/json", summary="导出 JSON 成绩")
def export_json(level_id: str):
    report = store.get_report(level_id)
    if not report:
        raise HTTPException(404, "报告不存在")
    return report.model_dump(mode="json")


@app.get("/export/{level_id}/csv", summary="导出 CSV 成绩")
def export_csv(level_id: str):
    report = store.get_report(level_id)
    if not report:
        raise HTTPException(404, "报告不存在")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["beat_index", "expected_time_ms", "actual_time_ms", "judgment", "offset_ms", "is_tuplet", "tuplet_group_id"])
    for br in report.beat_results:
        writer.writerow([
            br.beat_index,
            br.expected_time_ms,
            br.actual_time_ms or "",
            br.judgment.value,
            br.offset_ms if br.offset_ms is not None else "",
            br.is_tuplet,
            br.tuplet_group_id or "",
        ])
    output.seek(0)
    return {"csv": output.getvalue(), "summary": {
        "total_score": report.total_score,
        "passed": report.passed,
        "perfect_count": report.perfect_count,
        "rushed_count": report.rushed_count,
        "dragged_count": report.dragged_count,
        "missing_count": report.missing_count,
        "tuplet_errors": report.tuplet_errors,
    }}
