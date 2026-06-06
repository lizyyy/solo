import pandas as pd
import numpy as np
from typing import List, Tuple
from datetime import datetime
import uuid

from .models import (
    EquipmentRecord,
    ThresholdRecord,
    RecordStatus,
    LiftCurveData,
)


def _generate_id() -> str:
    return uuid.uuid4().hex[:12]


def import_equipment_data(file_path: str) -> List[EquipmentRecord]:
    if file_path.endswith(".csv"):
        df = pd.read_csv(file_path)
    elif file_path.endswith((".xlsx", ".xls")):
        df = pd.read_excel(file_path)
    else:
        raise ValueError(f"不支持的文件格式: {file_path}")

    records = []
    for _, row in df.iterrows():
        nameplate_params = {}
        for col in df.columns:
            if col.startswith("铭牌_") or col.startswith("nameplate_"):
                key = col.replace("铭牌_", "").replace("nameplate_", "")
                nameplate_params[key] = row[col]

        measurement_time = row.get("测量时间", row.get("measurement_time", datetime.now()))
        if isinstance(measurement_time, str):
            try:
                measurement_time = pd.to_datetime(measurement_time).to_pydatetime()
            except Exception:
                measurement_time = datetime.now()

        raw_value = float(row.get("原始值", row.get("raw_value", row.get("升力系数", row.get("lift_coefficient", 0)))))
        
        record = EquipmentRecord(
            record_id=_generate_id(),
            equipment_id=str(row.get("设备ID", row.get("equipment_id", "UNKNOWN"))),
            equipment_name=str(row.get("设备名称", row.get("equipment_name", "未知设备"))),
            nameplate_params=nameplate_params,
            lift_coefficient=float(row.get("升力系数", row.get("lift_coefficient", raw_value))),
            angle_of_attack=float(row.get("攻角", row.get("angle_of_attack", 0))),
            wind_speed=float(row.get("风速", row.get("wind_speed", 0))),
            measurement_time=measurement_time,
            raw_value=raw_value,
            averaged_value=row.get("平均值", row.get("averaged_value", None)),
            threshold_upper=row.get("阈值上限", row.get("threshold_upper", None)),
            threshold_lower=row.get("阈值下限", row.get("threshold_lower", None)),
            status=RecordStatus.NORMAL,
            notes=str(row.get("备注", row.get("notes", ""))),
            maintenance_screenshot_ref=row.get("维修截图", row.get("maintenance_screenshot", None)),
        )
        records.append(record)

    return records


def detect_hidden_outliers(
    records: List[EquipmentRecord],
    window_size: int = 5,
    deviation_threshold: float = 8.0,
    iqr_factor: float = 1.5,
) -> Tuple[List[EquipmentRecord], List[ThresholdRecord]]:
    threshold_records = []
    updated_records = []

    values = np.array([r.raw_value for r in records])
    n = len(values)
    
    avg_values = np.zeros(n)
    upper_bounds = np.zeros(n)
    lower_bounds = np.zeros(n)
    
    for i in range(n):
        if records[i].averaged_value is not None:
            avg_values[i] = records[i].averaged_value
        else:
            left = max(0, i - window_size)
            right = min(n, i + window_size + 1)
            window_vals = values[left:right]
            avg_values[i] = np.median(window_vals)
    
    for i in range(n):
        if records[i].threshold_upper is not None and records[i].threshold_lower is not None:
            upper_bounds[i] = records[i].threshold_upper
            lower_bounds[i] = records[i].threshold_lower
        else:
            left = max(0, i - window_size)
            right = min(n, i + window_size + 1)
            window_vals = values[left:right]
            q1 = np.percentile(window_vals, 25)
            q3 = np.percentile(window_vals, 75)
            iqr = q3 - q1
            median = np.median(window_vals)
            upper_bounds[i] = median + iqr_factor * iqr
            lower_bounds[i] = median - iqr_factor * iqr

    for i, record in enumerate(records):
        raw = record.raw_value
        avg = avg_values[i]
        upper = upper_bounds[i]
        lower = lower_bounds[i]
        
        is_outlier = raw > upper or raw < lower
        avg_in_range = (lower <= avg <= upper)
        is_hidden_by_avg = is_outlier and avg_in_range
        
        deviation_pct = abs((raw - avg) / avg * 100) if abs(avg) > 1e-8 else abs(raw - avg) * 100

        if is_hidden_by_avg and deviation_pct >= deviation_threshold:
            threshold_record = ThresholdRecord(
                record_id=_generate_id(),
                equipment_record_id=record.record_id,
                raw_value=raw,
                averaged_value=avg,
                threshold_upper=upper,
                threshold_lower=lower,
                deviation_percent=deviation_pct,
                hidden_by_averaging=True,
                discovered=True,
                status=RecordStatus.HIDDEN_BY_AVG,
                discovered_time=datetime.now(),
            )
            threshold_records.append(threshold_record)
            
            updated_record = EquipmentRecord(
                **{k: v for k, v in record.__dict__.items()}
            )
            updated_record.status = RecordStatus.HIDDEN_BY_AVG
            updated_record.averaged_value = avg
            updated_record.threshold_upper = upper
            updated_record.threshold_lower = lower
            updated_records.append(updated_record)
        else:
            updated_record = EquipmentRecord(
                **{k: v for k, v in record.__dict__.items()}
            )
            updated_record.averaged_value = avg
            updated_record.threshold_upper = upper
            updated_record.threshold_lower = lower
            if is_outlier:
                updated_record.status = RecordStatus.OUTLIER
            updated_records.append(updated_record)

    return updated_records, threshold_records


def build_lift_curve_data(
    records: List[EquipmentRecord],
    threshold_records: List[ThresholdRecord],
) -> LiftCurveData:
    hidden_ids = {t.equipment_record_id for t in threshold_records if t.hidden_by_averaging}
    outlier_ids = {r.record_id for r in records if r.status == RecordStatus.OUTLIER}
    
    angles = []
    lift_coeffs = []
    wind_speeds = []
    hidden_indices = []
    outlier_indices = []
    equipment_ids = []
    record_ids = []
    
    for i, r in enumerate(records):
        angles.append(r.angle_of_attack)
        lift_coeffs.append(r.lift_coefficient)
        wind_speeds.append(r.wind_speed)
        equipment_ids.append(r.equipment_id)
        record_ids.append(r.record_id)
        
        if r.record_id in hidden_ids:
            hidden_indices.append(i)
        if r.record_id in outlier_ids:
            outlier_indices.append(i)
    
    return LiftCurveData(
        angles=angles,
        lift_coefficients=lift_coeffs,
        wind_speeds=wind_speeds,
        outlier_indices=outlier_indices,
        hidden_outlier_indices=hidden_indices,
        equipment_ids=equipment_ids,
        record_ids=record_ids,
    )
