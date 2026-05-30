import json
from typing import List, Optional

from sqlalchemy.orm import Session

from .models import (
    FullScore,
    IssueType,
    PartScore,
    ProofreadRecord,
    RecordStatus,
)


def _compare_versions(v1: str, v2: str) -> int:
    parts1 = [int(p) for p in v1.split(".")]
    parts2 = [int(p) for p in v2.split(".")]
    for a, b in zip(parts1, parts2):
        if a != b:
            return a - b
    return len(parts1) - len(parts2)


def _check_measure_mismatch(
    full_score: FullScore, part_score: PartScore
) -> Optional[ProofreadRecord]:
    if part_score.measure_start < 1:
        return ProofreadRecord(
            full_score_id=full_score.id,
            part_score_id=part_score.id,
            issue_type=IssueType.MEASURE_MISMATCH,
            status=RecordStatus.PENDING_CONFIRM,
            explanation=(
                f"声部「{part_score.voice_part}」分谱小节起始号 {part_score.measure_start} "
                f"小于 1，不属于合法小节编号范围，需核实该分谱小节编号是否誊写有误。"
            ),
            detail=json.dumps(
                {
                    "voice_part": part_score.voice_part,
                    "measure_start": part_score.measure_start,
                    "measure_end": part_score.measure_end,
                    "expected_min": 1,
                },
                ensure_ascii=False,
            ),
        )

    if part_score.measure_end > full_score.measure_count:
        return ProofreadRecord(
            full_score_id=full_score.id,
            part_score_id=part_score.id,
            issue_type=IssueType.MEASURE_MISMATCH,
            status=RecordStatus.PENDING_CONFIRM,
            explanation=(
                f"声部「{part_score.voice_part}」分谱小节终止号 {part_score.measure_end} "
                f"超出总谱小节总数 {full_score.measure_count}，"
                f"该分谱可能包含了总谱中不存在的小节，需与总谱核对。"
            ),
            detail=json.dumps(
                {
                    "voice_part": part_score.voice_part,
                    "measure_start": part_score.measure_start,
                    "measure_end": part_score.measure_end,
                    "full_score_measure_count": full_score.measure_count,
                    "excess_measures": part_score.measure_end - full_score.measure_count,
                },
                ensure_ascii=False,
            ),
        )

    if part_score.measure_start > part_score.measure_end:
        return ProofreadRecord(
            full_score_id=full_score.id,
            part_score_id=part_score.id,
            issue_type=IssueType.MEASURE_MISMATCH,
            status=RecordStatus.PENDING_CONFIRM,
            explanation=(
                f"声部「{part_score.voice_part}」分谱小节起始号 {part_score.measure_start} "
                f"大于终止号 {part_score.measure_end}，小节范围不合法，需确认编号顺序是否写反。"
            ),
            detail=json.dumps(
                {
                    "voice_part": part_score.voice_part,
                    "measure_start": part_score.measure_start,
                    "measure_end": part_score.measure_end,
                },
                ensure_ascii=False,
            ),
        )

    return None


def _check_missing_pages(
    full_score: FullScore, part_score: PartScore
) -> Optional[ProofreadRecord]:
    if part_score.page_count <= 0:
        return ProofreadRecord(
            full_score_id=full_score.id,
            part_score_id=part_score.id,
            issue_type=IssueType.MISSING_PAGES,
            status=RecordStatus.RETURNED_FOR_MATERIALS,
            explanation=(
                f"声部「{part_score.voice_part}」分谱页数为 0，"
                f"该声部分谱可能缺失或未提交，请退回补齐该声部分谱材料。"
            ),
            detail=json.dumps(
                {
                    "voice_part": part_score.voice_part,
                    "page_count": part_score.page_count,
                    "measure_range": f"{part_score.measure_start}-{part_score.measure_end}",
                },
                ensure_ascii=False,
            ),
        )

    measure_span = part_score.measure_end - part_score.measure_start + 1
    if part_score.page_count < 1 or (measure_span > 10 and part_score.page_count < 2):
        return ProofreadRecord(
            full_score_id=full_score.id,
            part_score_id=part_score.id,
            issue_type=IssueType.MISSING_PAGES,
            status=RecordStatus.RETURNED_FOR_MATERIALS,
            explanation=(
                f"声部「{part_score.voice_part}」分谱覆盖 {measure_span} 个小节 "
                f"但仅有 {part_score.page_count} 页，页数与覆盖小节数明显不匹配，"
                f"可能有缺页，请退回核实并补齐。"
            ),
            detail=json.dumps(
                {
                    "voice_part": part_score.voice_part,
                    "page_count": part_score.page_count,
                    "measure_span": measure_span,
                    "measure_range": f"{part_score.measure_start}-{part_score.measure_end}",
                },
                ensure_ascii=False,
            ),
        )

    return None


def _check_version_conflict(
    full_score: FullScore, part_score: PartScore
) -> Optional[ProofreadRecord]:
    cmp = _compare_versions(part_score.version, full_score.version)

    if cmp < 0:
        return ProofreadRecord(
            full_score_id=full_score.id,
            part_score_id=part_score.id,
            issue_type=IssueType.VERSION_CONFLICT,
            status=RecordStatus.PENDING_CONFIRM,
            explanation=(
                f"声部「{part_score.voice_part}」分谱版本 {part_score.version} "
                f"落后于总谱版本 {full_score.version}，"
                f"该声部分谱可能使用的是旧版乐谱，需确认是否已按最新总谱更新。"
            ),
            detail=json.dumps(
                {
                    "voice_part": part_score.voice_part,
                    "part_version": part_score.version,
                    "full_score_version": full_score.version,
                    "direction": "part_older",
                },
                ensure_ascii=False,
            ),
        )

    if cmp > 0:
        return ProofreadRecord(
            full_score_id=full_score.id,
            part_score_id=part_score.id,
            issue_type=IssueType.VERSION_CONFLICT,
            status=RecordStatus.RETURNED_FOR_MATERIALS,
            explanation=(
                f"声部「{part_score.voice_part}」分谱版本 {part_score.version} "
                f"领先于总谱版本 {full_score.version}，"
                f"分谱可能来自更晚的修订但总谱尚未同步，请退回确认以哪个版本为准。"
            ),
            detail=json.dumps(
                {
                    "voice_part": part_score.voice_part,
                    "part_version": part_score.version,
                    "full_score_version": full_score.version,
                    "direction": "part_newer",
                },
                ensure_ascii=False,
            ),
        )

    return None


def proofread_full_score(db: Session, full_score_id: int) -> List[ProofreadRecord]:
    full_score = db.query(FullScore).filter(FullScore.id == full_score_id).first()
    if full_score is None:
        raise ValueError(f"总谱 id={full_score_id} 不存在")

    part_scores = (
        db.query(PartScore).filter(PartScore.full_score_id == full_score_id).all()
    )

    new_records: List[ProofreadRecord] = []

    for part_score in part_scores:
        measure_issue = _check_measure_mismatch(full_score, part_score)
        if measure_issue:
            new_records.append(measure_issue)

        page_issue = _check_missing_pages(full_score, part_score)
        if page_issue:
            new_records.append(page_issue)

        version_issue = _check_version_conflict(full_score, part_score)
        if version_issue:
            new_records.append(version_issue)

    for record in new_records:
        db.add(record)

    if new_records:
        db.commit()
        for record in new_records:
            db.refresh(record)

    return new_records
