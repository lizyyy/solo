import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from models import (
    SeagrassRecord,
    CleaningResult,
    RecordStatus,
    QualityFlag,
    SCENE_LABELS,
    SIDE_NOTES
)

BOTTLE_ID_PATTERN = r'^HC-\d{4}-\d{4}$'
SURVEY_BOUNDARY = {"min_lat": 21.8, "max_lat": 22.5, "min_lon": 113.5, "max_lon": 114.2}


def validate_bottle_id(bottle_id: str) -> bool:
    if not bottle_id:
        return False
    return bool(re.match(BOTTLE_ID_PATTERN, bottle_id))


def check_time_alignment(record: SeagrassRecord, threshold_hours: int = 2) -> Tuple[bool, float]:
    if not record.sampling_time or not record.lab_time:
        return False, -1.0
    diff = abs((record.lab_time - record.sampling_time).total_seconds() / 3600)
    return diff <= threshold_hours, diff


def check_cloud_cover(raw_data: Dict[str, Any]) -> bool:
    cloud_cover = raw_data.get("remote_sensing", {}).get("cloud_cover", 0)
    return cloud_cover > 30


def check_boundary(record: SeagrassRecord) -> Tuple[bool, float]:
    is_boundary = False
    influence_score = 0.0

    if record.seagrass_coverage < 5 or record.seagrass_coverage > 95:
        is_boundary = True
        influence_score += 0.4

    lat, lon = record.location["lat"], record.location["lon"]
    edge_distance = min(
        lat - SURVEY_BOUNDARY["min_lat"],
        SURVEY_BOUNDARY["max_lat"] - lat,
        lon - SURVEY_BOUNDARY["min_lon"],
        SURVEY_BOUNDARY["max_lon"] - lon
    )
    if edge_distance < 0.01:
        is_boundary = True
        influence_score += 0.3
        influence_score += max(0, (0.01 - edge_distance) * 30)

    if abs(record.biomass - 500) > 450:
        is_boundary = True
        influence_score += 0.3

    return is_boundary, min(influence_score, 1.0)


def calculate_boundary_influence(boundary_records: List[SeagrassRecord],
                                 all_records: List[SeagrassRecord]) -> Dict[str, Any]:
    if not all_records:
        return {"impact": "无数据", "details": {}}

    normal_records = [r for r in all_records if QualityFlag.BOUNDARY not in r.quality_flags]
    boundary_only = [r for r in boundary_records if QualityFlag.BOUNDARY in r.quality_flags]

    all_mean_coverage = sum(r.seagrass_coverage for r in all_records) / len(all_records)
    normal_mean_coverage = sum(r.seagrass_coverage for r in normal_records) / len(normal_records) if normal_records else 0

    impact = abs(all_mean_coverage - normal_mean_coverage)

    details = {}
    for br in boundary_only:
        without_br = [r for r in all_records if r.record_id != br.record_id]
        if without_br:
            mean_without = sum(r.seagrass_coverage for r in without_br) / len(without_br)
            diff = abs(all_mean_coverage - mean_without)
            details[br.record_id] = {
                "coverage": br.seagrass_coverage,
                "influence": round(diff, 2),
                "reason": SCENE_LABELS["BOUNDARY"]
            }

    return {
        "overall_impact_percent": round(impact, 2),
        "all_mean_coverage": round(all_mean_coverage, 2),
        "normal_mean_coverage": round(normal_mean_coverage, 2),
        "per_record_details": details,
        "note": SIDE_NOTES["BOUNDARY"]
    }


def clean_record(record: SeagrassRecord, time_threshold: int = 2) -> SeagrassRecord:
    record.quality_flags = []

    if check_cloud_cover(record.raw_data):
        record.quality_flags.append(QualityFlag.CLOUD_COVER)
        record.notes = SCENE_LABELS["CLOUD_COVER"]

    if not validate_bottle_id(record.bottle_id):
        record.quality_flags.append(QualityFlag.MISSING_BOTTLE)
        if not record.notes:
            record.notes = SCENE_LABELS["MISSING_BOTTLE"]

    time_ok, time_diff = check_time_alignment(record, time_threshold)
    if not time_ok and time_diff >= 0:
        record.quality_flags.append(QualityFlag.TIME_MISMATCH)
        if not record.notes:
            record.notes = SCENE_LABELS["TIME_MISMATCH"]

    is_boundary, influence = check_boundary(record)
    if is_boundary:
        record.quality_flags.append(QualityFlag.BOUNDARY)
        record.boundary_influence = influence

    if not record.quality_flags:
        record.quality_flags.append(QualityFlag.NORMAL)
        record.status = RecordStatus.CONFIRMED
        record.notes = SCENE_LABELS["NORMAL"]
    elif QualityFlag.CLOUD_COVER in record.quality_flags:
        record.status = RecordStatus.REJECTED
    elif QualityFlag.MISSING_BOTTLE in record.quality_flags or QualityFlag.TIME_MISMATCH in record.quality_flags:
        record.status = RecordStatus.PENDING
    else:
        record.status = RecordStatus.PENDING

    return record


def clean_seagrass_data(records: List[SeagrassRecord],
                        time_threshold: int = 2,
                        include_cloud_cover: bool = False) -> CleaningResult:
    cleaned_records = [clean_record(r, time_threshold) for r in records]

    cloud_cover_ids = [r.record_id for r in cleaned_records
                       if QualityFlag.CLOUD_COVER in r.quality_flags]

    boundary_records = []
    for r in cleaned_records:
        if QualityFlag.BOUNDARY in r.quality_flags:
            boundary_records.append({
                "record_id": r.record_id,
                "bottle_id": r.bottle_id,
                "coverage": r.seagrass_coverage,
                "boundary_influence": r.boundary_influence,
                "location": r.location,
                "note": SCENE_LABELS["BOUNDARY"]
            })

    boundary_analysis = calculate_boundary_influence(cleaned_records, cleaned_records)

    confirmed = sum(1 for r in cleaned_records if r.status == RecordStatus.CONFIRMED)
    pending = sum(1 for r in cleaned_records if r.status == RecordStatus.PENDING)
    rejected = sum(1 for r in cleaned_records if r.status == RecordStatus.REJECTED)

    time_mismatch_count = sum(1 for r in cleaned_records
                              if QualityFlag.TIME_MISMATCH in r.quality_flags)
    missing_bottle_count = sum(1 for r in cleaned_records
                                if QualityFlag.MISSING_BOTTLE in r.quality_flags)

    if not include_cloud_cover:
        cleaned_records = [r for r in cleaned_records
                           if QualityFlag.CLOUD_COVER not in r.quality_flags]

    return CleaningResult(
        total_records=len(records),
        confirmed=confirmed,
        pending=pending,
        rejected=rejected,
        cloud_cover_records=cloud_cover_ids,
        boundary_records=boundary_records,
        time_mismatch_count=time_mismatch_count,
        missing_bottle_count=missing_bottle_count,
        boundary_analysis=boundary_analysis,
        cleaned_data=cleaned_records
    )


def build_api_response(result: CleaningResult) -> Dict[str, Any]:
    return {
        "code": 0,
        "message": "海草床调查数据清洗完成",
        "scene_label": "海草床调查数据清洗 - 质量控制与复核管理",
        "side_note": SIDE_NOTES["CLOUD_COVER"] + " " + SIDE_NOTES["PENDING_FLOW"],
        "data": {
            "summary": {
                "总记录数": result.total_records,
                "已确认": result.confirmed,
                "待补件": result.pending,
                "退回": result.rejected,
                "遥感云遮挡数": len(result.cloud_cover_records),
                "边界样本数": len(result.boundary_records),
                "时间不匹配数": result.time_mismatch_count,
                "采样瓶缺失数": result.missing_bottle_count
            },
            "cloud_cover_records": result.cloud_cover_records,
            "boundary_records": result.boundary_records,
            "boundary_analysis": result.boundary_analysis,
            "cleaned_data": [
                {
                    "record_id": r.record_id,
                    "bottle_id": r.bottle_id,
                    "status": r.status.value,
                    "quality_flags": [f.value for f in r.quality_flags],
                    "notes": r.notes,
                    "boundary_influence": r.boundary_influence
                }
                for r in result.cleaned_data
            ]
        }
    }
