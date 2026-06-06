from datetime import datetime
from typing import List, Tuple
from models import EquipmentRecord, RecordStatus, VerificationResult, HourlyVerification


STANDARD_AUTHORIZED_CITIES = {
    "华东区": ["上海", "杭州", "南京", "苏州", "宁波"],
    "华北区": ["北京", "天津", "石家庄", "济南", "青岛"],
    "华南区": ["广州", "深圳", "佛山", "东莞", "厦门"],
    "华中区": ["武汉", "长沙", "郑州", "合肥", "南昌"],
    "西南区": ["成都", "重庆", "贵阳", "昆明", "西安"],
}


def verify_authorized_cities(record: EquipmentRecord) -> VerificationResult:
    issues = []
    suggestions = []
    needs_manager_review = False

    actual_set = set(record.actual_cities)
    authorized_set = set(record.authorized_cities)

    missing_cities = actual_set - authorized_set
    extra_cities = authorized_set - actual_set

    if missing_cities:
        issues.append(f"授权地区少写了城市: {', '.join(missing_cities)}")
        suggestions.append("请检查授权书原件，补全授权城市后提交店长复核")
        needs_manager_review = True

    if extra_cities:
        issues.append(f"授权地区多写了城市: {', '.join(extra_cities)}")
        suggestions.append("确认是否为笔误，或补充相关授权文件")

    if not issues:
        suggestions.append("授权地区核对无误")

    return VerificationResult(
        record_id=record.id,
        issues=issues,
        suggestions=suggestions,
        needs_manager_review=needs_manager_review,
    )


def verify_authorization_period(record: EquipmentRecord) -> VerificationResult:
    issues = []
    suggestions = []
    needs_manager_review = False

    try:
        use_date = datetime.strptime(record.actual_use_date, "%Y-%m-%d")
        start_date = datetime.strptime(record.authorized_start, "%Y-%m-%d")
        end_date = datetime.strptime(record.authorized_end, "%Y-%m-%d")

        if use_date < start_date:
            issues.append("使用日期早于授权开始日期")
            suggestions.append("请确认是否为提前进场调试，需调音师补充说明")
            needs_manager_review = True
        elif use_date > end_date:
            issues.append("使用日期晚于授权结束日期")
            suggestions.append("请确认是否为延期使用，需补充授权延期文件")
            needs_manager_review = True
        else:
            suggestions.append("授权期限核对无误")
    except ValueError:
        issues.append("日期格式错误，应为 YYYY-MM-DD")
        suggestions.append("请修正日期格式后重新导入")

    return VerificationResult(
        record_id=record.id,
        issues=issues,
        suggestions=suggestions,
        needs_manager_review=needs_manager_review,
    )


def process_tuner_message(record: EquipmentRecord) -> Tuple[EquipmentRecord, List[HourlyVerification]]:
    hourly_verifications = []

    if not record.tuner_message:
        return record, hourly_verifications

    message = record.tuner_message

    if "补录" in message and "旧口径" in message:
        record.is_old_standard = True
        record.status = RecordStatus.FROM_OLD_STANDARD
        record.review_note = "根据调音师留言，按旧口径补录"

        adjusted_hours = record.hours_used * 0.8
        if adjusted_hours != record.hours_used:
            hourly_verifications.append(
                HourlyVerification(
                    id=f"HV-{record.id}-001",
                    record_id=record.id,
                    equipment_name=record.equipment_name,
                    original_hours=record.hours_used,
                    adjusted_hours=adjusted_hours,
                    reason="旧口径折算：非黄金时段按80%计",
                    updated_by="录音师小段",
                )
            )
            record.hours_used = adjusted_hours

    if "加时" in message or "超时" in message:
        import re
        match = re.search(r"(加时|超时)\s*(\d+\.?\d*)\s*小时", message)
        if match:
            extra_hours = float(match.group(2))
            adjusted_hours = record.hours_used + extra_hours
            hourly_verifications.append(
                HourlyVerification(
                    id=f"HV-{record.id}-002",
                    record_id=record.id,
                    equipment_name=record.equipment_name,
                    original_hours=record.hours_used,
                    adjusted_hours=adjusted_hours,
                    reason=f"调音师留言确认{match.group(1)}{extra_hours}小时",
                    updated_by="录音师小段",
                )
            )
            record.hours_used = adjusted_hours

    if "补充" in message or "补" in message or "授权" in message:
        all_standard_cities = set()
        for cities in STANDARD_AUTHORIZED_CITIES.values():
            all_standard_cities.update(cities)
        
        found_cities = set()
        for city in all_standard_cities:
            if city in message:
                found_cities.add(city)
        
        if found_cities:
            for city in found_cities:
                if city not in record.authorized_cities:
                    record.authorized_cities.append(city)
            record.review_note = (record.review_note or "") + f" 从调音师留言补充城市: {', '.join(found_cities)}"

    record.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if record.status == RecordStatus.NORMAL:
        record.status = RecordStatus.UPDATED

    return record, hourly_verifications


def run_full_verification(records: List[EquipmentRecord]) -> List[Tuple[EquipmentRecord, List[VerificationResult]]]:
    results = []

    for record in records:
        verification_results = []

        area_result = verify_authorized_cities(record)
        period_result = verify_authorization_period(record)

        verification_results.append(area_result)
        verification_results.append(period_result)

        has_area_issue = any("授权地区少写" in issue for issue in area_result.issues)
        has_period_issue = period_result.needs_manager_review

        if record.is_old_standard and not has_area_issue and not has_period_issue:
            record.status = RecordStatus.FROM_OLD_STANDARD
        elif record.status == RecordStatus.FROM_OLD_STANDARD:
            if has_area_issue:
                record.status = RecordStatus.AREA_MISSING
            elif has_period_issue:
                record.status = RecordStatus.PENDING_REVIEW
        elif record.status == RecordStatus.UPDATED:
            if has_area_issue:
                record.status = RecordStatus.AREA_MISSING
            elif has_period_issue:
                record.status = RecordStatus.PENDING_REVIEW
            else:
                record.status = RecordStatus.UPDATED
        else:
            if has_area_issue:
                record.status = RecordStatus.AREA_MISSING
            elif has_period_issue:
                record.status = RecordStatus.PENDING_REVIEW
            elif not record.tuner_message:
                record.status = RecordStatus.NEEDS_VERIFICATION
            else:
                record.status = RecordStatus.NORMAL

        results.append((record, verification_results))

    return results


def manager_review(record: EquipmentRecord, approved: bool, review_note: str = "") -> EquipmentRecord:
    if approved:
        record.status = RecordStatus.NORMAL
        record.review_note = f"店长复核通过: {review_note}" if review_note else "店长复核通过"
    else:
        record.status = RecordStatus.PENDING_REVIEW
        record.review_note = f"店长驳回: {review_note}" if review_note else "店长驳回，请补充材料"

    record.updated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    return record
