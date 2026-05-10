"""核心业务逻辑"""

from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .models import (
    DevicePoint,
    InspectionResult,
    InspectionStatus,
    ScanRecord,
    SourceType,
    SupplementaryRecord,
    ValidationError,
)


def get_point_info(
    points: List[DevicePoint],
    point_id: str,
) -> Optional[DevicePoint]:
    point = None
    for p in points:
        if p.point_id == point_id:
            point = p
            break
    return point


def merge_duplicate_records(scan_records: List[ScanRecord]) -> List[ScanRecord]:
    grouped: Dict[str, List[ScanRecord]] = defaultdict(list)
    for record in scan_records:
        grouped[record.point_id].append(record)

    merged: List[ScanRecord] = []
    for point_id, records in grouped.items():
        if len(records) == 1:
            merged.append(records[0])
        else:
            sorted_records = sorted(records, key=lambda r: r.scan_time or datetime.min)
            latest = sorted_records[-1]
            merged_record = ScanRecord(
                record_id=f"MERGED_{point_id}",
                point_id=point_id,
                scan_time=latest.scan_time,
                status=latest.status,
                remark=latest.remark,
                inspector=latest.inspector,
                source=SourceType.SCAN,
                is_merged=True,
                original_records=[r.record_id for r in records],
            )
            merged.append(merged_record)
    return merged


def validate_supplementary_records(
    points: List[DevicePoint],
    supplementary_records: List[SupplementaryRecord],
) -> List[ValidationError]:
    errors: List[ValidationError] = []

    for record in supplementary_records:
        point = get_point_info(points, record.point_id)

        if not point:
            continue

        if point.shift_start and record.supplementary_time:
            if record.supplementary_time < point.shift_start:
                point_name = point.point_name
                errors.append(
                    ValidationError(
                        error_type="补录时间错误",
                        point_id=record.point_id,
                        point_name=point_name,
                        route_id=point.route_id,
                        message=f"补录时间早于班次开始时间",
                        record_id=record.record_id,
                        scan_time=record.supplementary_time,
                    )
                )

        if record.status == InspectionStatus.ABNORMAL and (not record.remark or not record.remark.strip()):
            point_name = point.point_name
            errors.append(
                ValidationError(
                    error_type="异常无备注",
                    point_id=record.point_id,
                    point_name=point_name,
                    route_id=point.route_id,
                    message="异常记录缺少备注说明",
                    record_id=record.record_id,
                    scan_time=record.supplementary_time,
                )
            )

    return errors


def merge_supplementary_with_scan(
    scan_records: List[ScanRecord],
    supplementary_records: List[SupplementaryRecord],
) -> List[ScanRecord]:
    scan_by_point: Dict[str, ScanRecord] = {r.point_id: r for r in scan_records}

    for supp in supplementary_records:
        if supp.point_id in scan_by_point:
            continue
        converted = ScanRecord(
            record_id=f"SUPP_{supp.record_id}",
            point_id=supp.point_id,
            scan_time=supp.supplementary_time,
            status=supp.status,
            remark=supp.remark,
            inspector=supp.inspector,
            source=SourceType.SUPPLEMENTARY,
        )
        scan_records.append(converted)

    return scan_records


def check_route_completion(
    points: List[DevicePoint],
    scan_records: List[ScanRecord],
):
    errors: List[ValidationError] = []

    routes: Dict[str, List[DevicePoint]] = defaultdict(list)
    for point in points:
        routes[point.route_id].append(point)

    records_by_point: Dict[str, List[ScanRecord]] = defaultdict(list)
    for record in scan_records:
        records_by_point[record.point_id].append(record)

    results: List[InspectionResult] = []

    for route_id, route_points in routes.items():
        route_points = sorted(route_points, key=lambda p: p.point_order)
        route_name = route_points[0].route_name if route_points else ""
        shift_start = route_points[0].shift_start if route_points else None
        shift_end = route_points[0].shift_end if route_points else None
        inspector = route_points[0].inspector if route_points else None

        total_points = len(route_points)
        completed_points = 0
        missing_points: List[str] = []
        abnormal_points: List[str] = []
        need_review: List[str] = []

        for point in route_points:
            point_records = records_by_point.get(point.point_id)

            if not point_records:
                if point.required:
                    missing_points.append(f"{point.point_id}:{point.point_name}")
                continue

            latest_record = sorted(point_records, key=lambda r: r.scan_time or datetime.min)[-1]

            if latest_record.status == InspectionStatus.MISSING:
                missing_points.append(f"{point.point_id}:{point.point_name}")
            elif latest_record.status == InspectionStatus.ABNORMAL:
                abnormal_points.append(f"{point.point_id}:{point.point_name}")
                need_review.append(f"{point.point_id}:{point.point_name}")
                completed_points += 1
            else:
                completed_points += 1

            if latest_record.status == InspectionStatus.COMPLETED:
                missing_points.append(f"{point.point_id}:{point.point_name}")
                errors.append(
                    ValidationError(
                        error_type="漏检标记完成",
                        point_id=point.point_id,
                        point_name=point.point_name,
                        route_id=route_id,
                        message="点位漏检后被直接标记为已完成",
                        record_id=latest_record.record_id,
                        scan_time=latest_record.scan_time,
                    )
                )

        if total_points == 0:
            status = "空路线"
        elif completed_points == total_points:
            status = "全部完成" if not abnormal_points else "完成但有异常"
        elif completed_points > 0:
            status = "部分完成"
        else:
            status = "未开始"

        result = InspectionResult(
            route_id=route_id,
            route_name=route_name,
            total_points=total_points,
            completed_points=completed_points,
            missing_points=missing_points,
            abnormal_points=abnormal_points,
            need_review=need_review,
            status=status,
            shift_start=shift_start,
            shift_end=shift_end,
            inspector=inspector,
        )
        results.append(result)

    return results, errors


def find_abnormal_records(
    points: List[DevicePoint],
    scan_records: List[ScanRecord],
    supplementary_records: List[SupplementaryRecord],
):
    errors: List[ValidationError] = []
    abnormal_records: List[ScanRecord] = []
    point_map = {p.point_id: p for p in points}

    all_records = scan_records[:]
    for supp in supplementary_records:
        all_records.append(
            ScanRecord(
                record_id=f"SUPP_{supp.record_id}",
                point_id=supp.point_id,
                scan_time=supp.supplementary_time,
                status=supp.status,
                remark=supp.remark,
                inspector=supp.inspector,
                source=SourceType.SUPPLEMENTARY,
            )
        )

    for record in all_records:
        if record.status == InspectionStatus.ABNORMAL:
            abnormal_records.append(record)
            if not record.remark or not record.remark.strip():
                point = point_map.get(record.point_id)
                errors.append(
                    ValidationError(
                        error_type="异常无备注",
                        point_id=record.point_id,
                        point_name=point.point_name if point else "",
                        route_id=point.route_id if point else "",
                        message="异常记录缺少备注说明",
                        record_id=record.record_id,
                        scan_time=record.scan_time,
                    )
                )

    return abnormal_records, errors
