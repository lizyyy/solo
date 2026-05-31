from models import DriftReport
from errors import humanize

DRIFT_THRESHOLD = 0.05


def detect_drift(records, calibrations):
    cal_map = {}
    for c in calibrations:
        cal_map.setdefault(c.sample_id, []).append(c)

    drifts = []
    for rec in records:
        if rec.source == "calibration":
            continue
        cal_list = cal_map.get(rec.sample_id)
        if not cal_list:
            drifts.append(
                DriftReport(
                    sample_id=rec.sample_id,
                    drift_value=0.0,
                    source="experiment",
                    operator=rec.operator,
                    record_id=rec.id,
                    message=humanize("MISSING_CALIBRATION", sample_id=rec.sample_id),
                )
            )
            continue

        matched = None
        for c in cal_list:
            if abs(c.temperature_ref - rec.temperature) < 1.0:
                matched = c
                break
        if not matched:
            continue

        ref_tc = matched.thermal_conductivity_ref
        if ref_tc == 0:
            continue
        drift_ratio = abs(rec.thermal_conductivity - ref_tc) / abs(ref_tc)

        if drift_ratio > DRIFT_THRESHOLD:
            drift_value = rec.thermal_conductivity - ref_tc
            drift_source = _determine_drift_source(rec, matched, cal_list)
            operator_info = rec.operator if drift_source == "experiment" else matched.operator or "标定组"

            msg = humanize(
                f"ZERO_DRIFT_{drift_source.upper()}",
                drift_value=f"{drift_value:+.4f} W/(m·K)",
                operator=operator_info,
            )
            drifts.append(
                DriftReport(
                    sample_id=rec.sample_id,
                    drift_value=drift_value,
                    source=drift_source,
                    operator=operator_info,
                    record_id=rec.id,
                    calibration_version=matched.version,
                    message=msg,
                )
            )

    return drifts


def _determine_drift_source(record, matched_cal, cal_list):
    neighbor_count = 0
    neighbor_drift = 0
    for c in cal_list:
        if c is matched_cal:
            continue
        if abs(c.temperature_ref - record.temperature) < 10.0:
            neighbor_count += 1
            if c.thermal_conductivity_ref != 0:
                neighbor_drift += abs(record.thermal_conductivity - c.thermal_conductivity_ref) / abs(c.thermal_conductivity_ref)

    if neighbor_count > 0 and (neighbor_drift / neighbor_count) < DRIFT_THRESHOLD:
        return "calibration"

    if matched_cal.version == "" or matched_cal.operator == "":
        return "calibration"

    return "experiment"
