from __future__ import annotations
import json
from collections import Counter
from datetime import datetime
from typing import Optional, Dict, List
from sqlalchemy.orm import Session
from models import (
    Score, ScoreVersion, FingeringAnnotation, Measure,
    StudentAnnotation, ProofreadReport, Anomaly,
    AnomalySeverity, VersionStatus,
)
from audit import log_audit


KNOWN_FINGERING_TYPES = {
    "抹", "挑", "勾", "剔", "擘", "托",
    "打", "摘", "历", "撮", "反撮", "泼剌",
    "轮", "锁", "叠", "吟", "猱", "绰", "注",
    "上", "下", "进复", "退复", "撞", "逗",
    "分开", "推出", "罨", "虚罨", "抓起", "带起",
    "跪", "泛音", "按音", "散音",
}

EXPECTED_STRING_RANGE = (1, 7)

COMMON_TIME_SIGNATURES = {"4/4", "3/4", "2/4", "6/8", "2/2"}


def _make_anomaly(
    report_id: int,
    anomaly_type: str,
    severity: str,
    description: str,
    measure_number: Optional[int] = None,
    cause_analysis: Optional[str] = None,
    affected_data: Optional[Dict] = None,
) -> Anomaly:
    return Anomaly(
        report_id=report_id,
        anomaly_type=anomaly_type,
        severity=severity,
        measure_number=measure_number,
        description=description,
        cause_analysis=cause_analysis,
        affected_data_json=json.dumps(affected_data, ensure_ascii=False) if affected_data else None,
        created_at=datetime.utcnow(),
    )


def check_missing_fingering(
    db: Session,
    score_id: int,
    version_id: int,
    report_id: int,
) -> List[Anomaly]:
    anomalies = []
    measures = db.query(Measure).filter(
        Measure.score_id == score_id,
        Measure.version_id == version_id,
    ).order_by(Measure.measure_number).all()

    fingering_measures = set(
        row[0] for row in db.query(FingeringAnnotation.measure_number).filter(
            FingeringAnnotation.score_id == score_id,
            FingeringAnnotation.version_id == version_id,
        ).distinct().all()
    )

    for m in measures:
        if m.measure_number not in fingering_measures:
            anomalies.append(_make_anomaly(
                report_id=report_id,
                anomaly_type="指法漏标",
                severity=AnomalySeverity.error,
                measure_number=m.measure_number,
                description=f"第{m.measure_number}小节无任何指法标注",
                cause_analysis="可能是减字谱转写时遗漏，或谱稿本身该小节只有节奏无指法。需要对照原始谱稿确认是否确实为空小节。",
                affected_data={"measure_id": m.id, "measure_number": m.measure_number},
            ))

    return anomalies


def check_duplicate_fingering(
    db: Session,
    score_id: int,
    version_id: int,
    report_id: int,
) -> List[Anomaly]:
    anomalies = []
    rows = db.query(FingeringAnnotation).filter(
        FingeringAnnotation.score_id == score_id,
        FingeringAnnotation.version_id == version_id,
    ).all()

    key_counter: Dict[tuple, List[FingeringAnnotation]] = {}
    for f in rows:
        key = (f.measure_number, f.position_in_measure, f.jianzi_char, f.fingering_type)
        key_counter.setdefault(key, []).append(f)

    for key, items in key_counter.items():
        if len(items) > 1:
            anomalies.append(_make_anomaly(
                report_id=report_id,
                anomaly_type="指法重复",
                severity=AnomalySeverity.warning,
                measure_number=key[0],
                description=f"第{key[0]}小节位置{key[1]}处减字'{key[2]}'指法'{key[3]}'出现{len(items)}次",
                cause_analysis="可能是多人标注同一位置时未合并，或版本拷贝时产生重复。手工更正的条目(is_manual_correction=True)应视为覆盖而非重复。",
                affected_data={
                    "jianzi_char": key[2],
                    "fingering_type": key[3],
                    "duplicate_ids": [f.id for f in items],
                    "manual_correction_flags": [f.is_manual_correction for f in items],
                },
            ))

    return anomalies


def check_measure_misalignment(
    db: Session,
    score_id: int,
    version_id: int,
    report_id: int,
) -> List[Anomaly]:
    anomalies = []
    measures = db.query(Measure).filter(
        Measure.score_id == score_id,
        Measure.version_id == version_id,
    ).order_by(Measure.measure_number).all()

    for i in range(1, len(measures)):
        prev = measures[i - 1]
        curr = measures[i]
        if curr.measure_number != prev.measure_number + 1:
            anomalies.append(_make_anomaly(
                report_id=report_id,
                anomaly_type="小节编号不连续",
                severity=AnomalySeverity.error,
                measure_number=prev.measure_number,
                description=f"第{prev.measure_number}小节之后跳到第{curr.measure_number}小节，缺少第{prev.measure_number + 1}到第{curr.measure_number - 1}小节",
                cause_analysis="可能是谱稿分段导致编号跳跃，也可能是录入时遗漏中间小节。需对照原谱确认。",
                affected_data={
                    "prev_measure_id": prev.id,
                    "prev_measure_number": prev.measure_number,
                    "curr_measure_id": curr.id,
                    "curr_measure_number": curr.measure_number,
                },
            ))

        if prev.end_position is not None and curr.start_position is not None:
            if curr.start_position < prev.end_position:
                anomalies.append(_make_anomaly(
                    report_id=report_id,
                    anomaly_type="小节位置重叠",
                    severity=AnomalySeverity.warning,
                    measure_number=curr.measure_number,
                    description=f"第{curr.measure_number}小节起始位置({curr.start_position})早于第{prev.measure_number}小节结束位置({prev.end_position})",
                    cause_analysis="可能是手工调整小节边界时未同步更新相邻小节。标记is_manually_adjusted=True的小节应重点检查。",
                    affected_data={
                        "prev_measure_id": prev.id,
                        "curr_measure_id": curr.id,
                        "prev_end": prev.end_position,
                        "curr_start": curr.start_position,
                        "prev_manually_adjusted": prev.is_manually_adjusted,
                        "curr_manually_adjusted": curr.is_manually_adjusted,
                    },
                ))

    for m in measures:
        if m.beat_count is not None and m.time_signature:
            try:
                numerator, denominator = m.time_signature.split("/")
                expected_beats = float(numerator) / float(denominator) * 4
                if abs(m.beat_count - expected_beats) > 0.01:
                    anomalies.append(_make_anomaly(
                        report_id=report_id,
                        anomaly_type="小节拍数异常",
                        severity=AnomalySeverity.warning,
                        measure_number=m.measure_number,
                        description=f"第{m.measure_number}小节拍数({m.beat_count})与拍号({m.time_signature})期望拍数({expected_beats})不符",
                        cause_analysis=f"古琴节奏不严格按西乐拍号，但偏差过大可能为录入错误。该小节{'已手工调整' if m.is_manually_adjusted else '未手工调整'}。",
                        affected_data={
                            "measure_id": m.id,
                            "beat_count": m.beat_count,
                            "time_signature": m.time_signature,
                            "expected_beats": expected_beats,
                            "is_manually_adjusted": m.is_manually_adjusted,
                        },
                    ))
            except (ValueError, ZeroDivisionError):
                pass

    return anomalies


def check_version_override(
    db: Session,
    score_id: int,
    version_id: int,
    report_id: int,
) -> List[Anomaly]:
    anomalies = []
    version = db.query(ScoreVersion).filter(ScoreVersion.id == version_id).first()
    if not version:
        return anomalies

    if version.superseded_by is not None:
        newer = db.query(ScoreVersion).filter(ScoreVersion.id == version.superseded_by).first()
        anomalies.append(_make_anomaly(
            report_id=report_id,
            anomaly_type="版本已被覆盖",
            severity=AnomalySeverity.info,
            description=f"版本v{version.version_number}(id={version.id})已被版本v{newer.version_number if newer else '?'}(id={version.superseded_by})取代",
            cause_analysis="此版本状态为superseded，其上标注的指法和批注可能不再反映最新状态。校对结果仅供参考，应以最新版本为准。",
            affected_data={
                "old_version_id": version.id,
                "old_version_number": version.version_number,
                "new_version_id": version.superseded_by,
                "new_version_number": newer.version_number if newer else None,
            },
        ))

    same_number_versions = db.query(ScoreVersion).filter(
        ScoreVersion.score_id == score_id,
        ScoreVersion.version_number == version.version_number,
        ScoreVersion.id != version.id,
    ).all()

    for dup in same_number_versions:
        anomalies.append(_make_anomaly(
            report_id=report_id,
            anomaly_type="版本号重复",
            severity=AnomalySeverity.warning,
            description=f"存在两个版本号为{version.version_number}的版本(id={version.id}和id={dup.id})",
            cause_analysis="可能是修订时新建了相同版本号而非递增。应确认哪个是有效版本，并将另一个标记为superseded。",
            affected_data={
                "version_id_1": version.id,
                "version_id_2": dup.id,
                "version_number": version.version_number,
            },
        ))

    return anomalies


def check_unknown_fingering_types(
    db: Session,
    score_id: int,
    version_id: int,
    report_id: int,
) -> List[Anomaly]:
    anomalies = []
    rows = db.query(FingeringAnnotation).filter(
        FingeringAnnotation.score_id == score_id,
        FingeringAnnotation.version_id == version_id,
    ).all()

    for f in rows:
        if f.fingering_type not in KNOWN_FINGERING_TYPES:
            anomalies.append(_make_anomaly(
                report_id=report_id,
                anomaly_type="未知指法类型",
                severity=AnomalySeverity.warning,
                measure_number=f.measure_number,
                description=f"第{f.measure_number}小节减字'{f.jianzi_char}'的指法类型'{f.fingering_type}'不在已知指法表中",
                cause_analysis="可能是自定义指法或录入错误。如确为有效指法，应将其加入指法表。",
                affected_data={
                    "fingering_id": f.id,
                    "jianzi_char": f.jianzi_char,
                    "fingering_type": f.fingering_type,
                },
            ))

        if f.string_number is not None and not (EXPECTED_STRING_RANGE[0] <= f.string_number <= EXPECTED_STRING_RANGE[1]):
            anomalies.append(_make_anomaly(
                report_id=report_id,
                anomaly_type="弦号越界",
                severity=AnomalySeverity.error,
                measure_number=f.measure_number,
                description=f"第{f.measure_number}小节减字'{f.jianzi_char}'弦号为{f.string_number}，超出古琴1-7弦范围",
                cause_analysis="古琴只有七根弦，弦号应为1-7。超出范围一定是录入错误。",
                affected_data={
                    "fingering_id": f.id,
                    "string_number": f.string_number,
                },
            ))

    return anomalies


def run_proofread(
    db: Session,
    score_id: int,
    version_id: int,
    operator: Optional[str] = None,
) -> ProofreadReport:
    log_audit(db, "verify", "proofread", entity_id=score_id, version_id=version_id, operator=operator, note="开始校对")

    report = ProofreadReport(
        score_id=score_id,
        version_id=version_id,
        report_type="full",
        summary="",
        anomaly_count=0,
        detail_json="{}",
        created_at=datetime.utcnow(),
    )
    db.add(report)
    db.flush()

    all_anomalies = []
    all_anomalies.extend(check_missing_fingering(db, score_id, version_id, report.id))
    all_anomalies.extend(check_duplicate_fingering(db, score_id, version_id, report.id))
    all_anomalies.extend(check_measure_misalignment(db, score_id, version_id, report.id))
    all_anomalies.extend(check_version_override(db, score_id, version_id, report.id))
    all_anomalies.extend(check_unknown_fingering_types(db, score_id, version_id, report.id))

    for a in all_anomalies:
        db.add(a)

    severity_counts = Counter(a.severity for a in all_anomalies)
    summary_parts = []
    if severity_counts.get("error", 0):
        summary_parts.append(f"错误{severity_counts['error']}项")
    if severity_counts.get("warning", 0):
        summary_parts.append(f"警告{severity_counts['warning']}项")
    if severity_counts.get("info", 0):
        summary_parts.append(f"提示{severity_counts['info']}项")

    type_counts = Counter(a.anomaly_type for a in all_anomalies)
    detail_lines = []
    for atype, count in type_counts.most_common():
        detail_lines.append(f"{atype}: {count}处")

    report.anomaly_count = len(all_anomalies)
    report.summary = "；".join(summary_parts) if summary_parts else "未发现异常"
    report.detail_json = json.dumps({
        "severity_counts": dict(severity_counts),
        "type_counts": dict(type_counts),
        "type_details": detail_lines,
    }, ensure_ascii=False)

    db.flush()

    log_audit(db, "verify", "proofread_report", entity_id=report.id, version_id=version_id, operator=operator,
              note=f"校对完成，发现{len(all_anomalies)}项异常",
              after={"report_id": report.id, "anomaly_count": len(all_anomalies), "summary": report.summary})

    return report


def compare_versions(
    db: Session,
    old_version_id: int,
    new_version_id: int,
) -> Dict:
    old = db.query(ScoreVersion).filter(ScoreVersion.id == old_version_id).first()
    new = db.query(ScoreVersion).filter(ScoreVersion.id == new_version_id).first()

    if not old or not new:
        return {"error": "版本不存在"}

    diffs = []

    try:
        old_content = json.loads(old.content_json)
        new_content = json.loads(new.content_json)
    except json.JSONDecodeError:
        diffs.append({
            "field": "content_json",
            "old_value": old.content_json[:200],
            "new_value": new.content_json[:200],
            "description": "版本内容不同（JSON解析失败，仅展示前200字符）",
        })
        return {"old_version_id": old.id, "new_version_id": new.id, "diffs": diffs}

    if old_content != new_content:
        old_keys = set(old_content.keys()) if isinstance(old_content, dict) else set()
        new_keys = set(new_content.keys()) if isinstance(new_content, dict) else set()

        for key in sorted(old_keys | new_keys):
            old_val = old_content.get(key)
            new_val = new_content.get(key)
            if old_val != new_val:
                diffs.append({
                    "field": key,
                    "old_value": str(old_val) if old_val is not None else "(无)",
                    "new_value": str(new_val) if new_val is not None else "(无)",
                    "description": f"字段'{key}'从'{old_val}'变为'{new_val}'",
                })

    old_fingerings = db.query(FingeringAnnotation).filter(
        FingeringAnnotation.version_id == old_version_id
    ).order_by(FingeringAnnotation.measure_number, FingeringAnnotation.position_in_measure).all()

    new_fingerings = db.query(FingeringAnnotation).filter(
        FingeringAnnotation.version_id == new_version_id
    ).order_by(FingeringAnnotation.measure_number, FingeringAnnotation.position_in_measure).all()

    old_fingerings_by_measure: Dict[int, List[FingeringAnnotation]] = {}
    for f in old_fingerings:
        old_fingerings_by_measure.setdefault(f.measure_number, []).append(f)

    new_fingerings_by_measure: Dict[int, List[FingeringAnnotation]] = {}
    for f in new_fingerings:
        new_fingerings_by_measure.setdefault(f.measure_number, []).append(f)

    all_measures = sorted(set(old_fingerings_by_measure.keys()) | set(new_fingerings_by_measure.keys()))

    for m_num in all_measures:
        old_f = old_fingerings_by_measure.get(m_num, [])
        new_f = new_fingerings_by_measure.get(m_num, [])
        if not old_f and new_f:
            diffs.append({
                "field": f"fingering_measure_{m_num}",
                "old_value": "(无)",
                "new_value": f"{len(new_f)}条指法",
                "description": f"第{m_num}小节新增指法标注（旧版本无标注，可能为漏标补录）",
            })
        elif old_f and not new_f:
            diffs.append({
                "field": f"fingering_measure_{m_num}",
                "old_value": f"{len(old_f)}条指法",
                "new_value": "(无)",
                "description": f"第{m_num}小节指法标注消失（新版本无标注，可能为删除或版本回退）",
            })
        elif len(old_f) != len(new_f):
            diffs.append({
                "field": f"fingering_measure_{m_num}",
                "old_value": f"{len(old_f)}条",
                "new_value": f"{len(new_f)}条",
                "description": f"第{m_num}小节指法数量从{len(old_f)}变为{len(new_f)}",
            })

    log_audit(db, "compare", "score_version", entity_id=old_version_id,
              note=f"比对版本v{old.version_number}(id={old.id})与v{new.version_number}(id={new.id})，发现{len(diffs)}处差异",
              after={"old_version_id": old.id, "new_version_id": new.id, "diff_count": len(diffs)})

    return {
        "old_version_id": old.id,
        "old_version_number": old.version_number,
        "new_version_id": new.id,
        "new_version_number": new.version_number,
        "diff_count": len(diffs),
        "diffs": diffs,
    }
