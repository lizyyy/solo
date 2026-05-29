from __future__ import annotations
from sqlalchemy.orm import Session
from app.models.models import KilnRecord, Anomaly
from app.exceptions import KilnGapError


def _detect_gaps(temp_curve: list[dict]) -> list[dict] | None:
    if len(temp_curve) < 2:
        return None

    sorted_curve = sorted(temp_curve, key=lambda p: p.get("time_min", 0))
    gaps = []
    for i in range(1, len(sorted_curve)):
        dt = sorted_curve[i]["time_min"] - sorted_curve[i - 1]["time_min"]
        if dt > 30:
            gaps.append({
                "after_time": sorted_curve[i - 1]["time_min"],
                "before_time": sorted_curve[i]["time_min"],
                "gap_minutes": dt,
            })
    return gaps if gaps else None


def create_kiln_record(
    db: Session,
    experiment_id: int,
    formula_id: int | None = None,
    target_temp: float | None = None,
    temp_curve: list[dict] | None = None,
    soak_duration_min: float | None = None,
):
    gaps = None
    if temp_curve:
        gaps = _detect_gaps(temp_curve)

    record = KilnRecord(
        experiment_id=experiment_id,
        formula_id=formula_id,
        target_temp=target_temp,
        temp_curve=temp_curve,
        soak_duration_min=soak_duration_min,
        source="kiln",
    )
    db.add(record)

    if gaps:
        for g in gaps:
            anomaly = Anomaly(
                experiment_id=experiment_id,
                category="kiln_gap",
                severity="error",
                message=f"窑温曲线在 {g['after_time']}~{g['before_time']} 分钟之间存在 {g['gap_minutes']} 分钟缺段",
                detail=g,
                suggestion="补全缺段温度数据，或在备注中说明原因（如自然冷却段未记录）",
            )
            db.add(anomaly)

    if target_temp and temp_curve:
        max_temp = max(p.get("temperature", 0) for p in temp_curve)
        if max_temp < target_temp * 0.9:
            anomaly = Anomaly(
                experiment_id=experiment_id,
                category="kiln_gap",
                severity="warning",
                message=f"窑温最高 {max_temp}°C 远低于目标温度 {target_temp}°C",
                detail={"max_temp": max_temp, "target_temp": target_temp},
                suggestion="检查是否窑温数据不完整，或实际烧制未达目标温度",
            )
            db.add(anomaly)

    db.commit()
    db.refresh(record)
    return record


def list_kiln_records(db: Session, experiment_id: int):
    return db.query(KilnRecord).filter(KilnRecord.experiment_id == experiment_id).order_by(KilnRecord.recorded_at).all()


def get_kiln_record(db: Session, record_id: int):
    return db.query(KilnRecord).filter(KilnRecord.id == record_id).first()
