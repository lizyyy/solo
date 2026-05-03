import re
from datetime import date, datetime
from typing import List, Dict, Tuple, Optional

from .models import (
    Applicant, MaterialFile, Itinerary, Rules, Issue, IssueType, 
    RiskLevel, ValidationResult
)
from .utils import parse_date, format_date, days_between, add_months
from .matcher import match_materials, scan_materials


def check_passport_validity(
    applicant: Applicant,
    rules: Rules,
    today: date,
    itinerary: Optional[Itinerary] = None
) -> List[Issue]:
    issues = []
    
    if not applicant.passport_expiry_date:
        issues.append(Issue(
            issue_type=IssueType.DATE_FORMAT_ERROR,
            severity=RiskLevel.CRITICAL,
            message="护照有效期缺失",
            evidence=f"申请人 {applicant.applicant_id} 未提供护照有效期",
            document_type="passport"
        ))
        return issues
    
    expiry_date = applicant.passport_expiry_date
    
    if expiry_date < today:
        issues.append(Issue(
            issue_type=IssueType.PASSPORT_EXPIRED,
            severity=RiskLevel.CRITICAL,
            message="护照已过期",
            evidence=f"护照有效期至 {format_date(expiry_date)}，今天是 {format_date(today)}",
            document_type="passport"
        ))
        return issues
    
    min_validity_months = rules.passport_min_validity_months
    required_expiry = add_months(today, min_validity_months)
    
    if itinerary:
        required_expiry = add_months(itinerary.end_date, min_validity_months)
    
    if expiry_date < required_expiry:
        issues.append(Issue(
            issue_type=IssueType.PASSPORT_EXPIRY_INSUFFICIENT,
            severity=RiskLevel.HIGH,
            message=f"护照有效期不足",
            evidence=f"护照有效期至 {format_date(expiry_date)}，需要至少覆盖到 {format_date(required_expiry)}（行程结束后 {min_validity_months} 个月）",
            document_type="passport"
        ))
    
    return issues


def check_photo_requirements(
    applicant: Applicant,
    materials: List[MaterialFile],
    rules: Rules
) -> List[Issue]:
    issues = []
    
    photo_materials = [m for m in materials if m.document_type == 'photo']
    
    if not photo_materials:
        return issues
    
    photo_reqs = rules.photo_requirements
    
    for photo in photo_materials:
        filename = photo.filename.lower()
        
        spec_issues = []
        
        if 'size' in photo_reqs:
            req_size = photo_reqs['size']
            if req_size not in filename:
                spec_issues.append(f"文件名未标注尺寸要求({req_size})")
        
        if 'background' in photo_reqs:
            req_bg = photo_reqs['background']
            if req_bg not in filename and '白底' not in filename and 'white' not in filename:
                spec_issues.append(f"请确认背景为{req_bg}")
        
        if spec_issues:
            issues.append(Issue(
                issue_type=IssueType.PHOTO_SPEC_ISSUE,
                severity=RiskLevel.LOW,
                message="照片规格备注不完整",
                evidence=f"文件: {photo.filename}，问题: {'; '.join(spec_issues)}",
                document_type="photo",
                file_path=photo.original_path
            ))
    
    return issues


def check_insurance_coverage(
    applicant: Applicant,
    materials: List[MaterialFile],
    rules: Rules,
    itinerary: Optional[Itinerary] = None
) -> List[Issue]:
    issues = []
    
    insurance_materials = [m for m in materials if m.document_type == 'insurance']
    
    if not insurance_materials or not itinerary:
        return issues
    
    buffer_days = rules.insurance_buffer_days
    required_start = itinerary.start_date
    required_end = add_months(itinerary.end_date, 0)
    
    for insurance in insurance_materials:
        filename = insurance.filename
        
        date_patterns = [
            r'(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)',
            r'(\d{8})',
        ]
        
        dates_found = []
        for pattern in date_patterns:
            matches = re.findall(pattern, filename)
            for match in matches:
                if len(match) == 8 and match.isdigit():
                    try:
                        parsed = date(int(match[:4]), int(match[4:6]), int(match[6:8]))
                        dates_found.append(parsed)
                    except ValueError:
                        pass
                else:
                    parsed, error = parse_date(match)
                    if parsed:
                        dates_found.append(parsed)
        
        if len(dates_found) >= 2:
            dates_found.sort()
            ins_start = dates_found[0]
            ins_end = dates_found[-1]
            
            effective_start = ins_start
            effective_end = ins_end
            
            if effective_start > required_start:
                issues.append(Issue(
                    issue_type=IssueType.INSURANCE_COVERAGE_GAP,
                    severity=RiskLevel.HIGH,
                    message="保险覆盖开始日期晚于行程开始",
                    evidence=f"保险起始: {format_date(effective_start)}，行程开始: {format_date(required_start)}，存在 {days_between(required_start, effective_start)} 天空白",
                    document_type="insurance",
                    file_path=insurance.original_path
                ))
            
            if effective_end < required_end:
                issues.append(Issue(
                    issue_type=IssueType.INSURANCE_EXPIRES_EARLY,
                    severity=RiskLevel.HIGH,
                    message="保险覆盖结束日期早于行程结束",
                    evidence=f"保险结束: {format_date(effective_end)}，行程结束: {format_date(required_end)}，缺少 {days_between(effective_end, required_end)} 天覆盖",
                    document_type="insurance",
                    file_path=insurance.original_path
                ))
        else:
            issues.append(Issue(
                issue_type=IssueType.DATE_FORMAT_ERROR,
                severity=RiskLevel.MEDIUM,
                message="保险文件名未包含日期范围",
                evidence=f"文件: {filename}，建议在文件名中标注保险起止日期，如 20260101-20260115",
                document_type="insurance",
                file_path=insurance.original_path
            ))
    
    return issues


def check_hotel_booking(
    applicant: Applicant,
    materials: List[MaterialFile],
    itinerary: Optional[Itinerary] = None
) -> List[Issue]:
    issues = []
    
    hotel_materials = [m for m in materials if m.document_type == 'hotel_booking']
    
    if not hotel_materials or not itinerary:
        return issues
    
    required_nights = itinerary.duration_days
    
    for hotel in hotel_materials:
        filename = hotel.filename
        
        date_patterns = [
            r'(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)',
            r'(\d{8})',
        ]
        
        dates_found = []
        for pattern in date_patterns:
            matches = re.findall(pattern, filename)
            for match in matches:
                if len(match) == 8 and match.isdigit():
                    try:
                        parsed = date(int(match[:4]), int(match[4:6]), int(match[6:8]))
                        dates_found.append(parsed)
                    except ValueError:
                        pass
                else:
                    parsed, error = parse_date(match)
                    if parsed:
                        dates_found.append(parsed)
        
        if len(dates_found) >= 2:
            dates_found.sort()
            hotel_start = dates_found[0]
            hotel_end = dates_found[-1]
            hotel_nights = days_between(hotel_start, hotel_end)
            
            if hotel_start > itinerary.start_date:
                issues.append(Issue(
                    issue_type=IssueType.HOTEL_DAYS_MISMATCH,
                    severity=RiskLevel.HIGH,
                    message="酒店入住开始日期晚于行程开始",
                    evidence=f"酒店入住: {format_date(hotel_start)}，行程开始: {format_date(itinerary.start_date)}",
                    document_type="hotel_booking",
                    file_path=hotel.original_path
                ))
            
            if hotel_end < itinerary.end_date:
                issues.append(Issue(
                    issue_type=IssueType.HOTEL_DAYS_MISMATCH,
                    severity=RiskLevel.HIGH,
                    message="酒店退房日期早于行程结束",
                    evidence=f"酒店退房: {format_date(hotel_end)}，行程结束: {format_date(itinerary.end_date)}",
                    document_type="hotel_booking",
                    file_path=hotel.original_path
                ))
        else:
            issues.append(Issue(
                issue_type=IssueType.DATE_FORMAT_ERROR,
                severity=RiskLevel.LOW,
                message="酒店订单文件名未包含日期",
                evidence=f"文件: {filename}，建议在文件名中标注入住日期",
                document_type="hotel_booking",
                file_path=hotel.original_path
            ))
    
    return issues


def check_employment_cert(
    applicant: Applicant,
    materials: List[MaterialFile],
    rules: Rules,
    today: date
) -> List[Issue]:
    issues = []
    
    emp_materials = [m for m in materials if m.document_type == 'employment_cert']
    
    if not emp_materials:
        return issues
    
    max_age_days = rules.employment_cert_max_age_days
    
    for emp in emp_materials:
        filename = emp.filename
        
        date_patterns = [
            r'(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)',
            r'(\d{8})',
            r'(?:开具|开|issue|issued)[_\s-]?(\d{4}[-/]\d{1,2}[-/]\d{1,2})',
        ]
        
        dates_found = []
        for pattern in date_patterns:
            matches = re.findall(pattern, filename)
            for match in matches:
                if len(match) == 8 and match.isdigit():
                    try:
                        parsed = date(int(match[:4]), int(match[4:6]), int(match[6:8]))
                        dates_found.append(parsed)
                    except ValueError:
                        pass
                else:
                    parsed, error = parse_date(match)
                    if parsed:
                        dates_found.append(parsed)
        
        if dates_found:
            issue_date = max(dates_found)
            age_days = days_between(issue_date, today)
            
            if age_days > max_age_days:
                issues.append(Issue(
                    issue_type=IssueType.EMPLOYMENT_CERT_DATE_ISSUE,
                    severity=RiskLevel.HIGH,
                    message=f"在职证明开具时间超过 {max_age_days} 天",
                    evidence=f"开具日期: {format_date(issue_date)}，距今 {age_days} 天，超过有效期 {max_age_days} 天",
                    document_type="employment_cert",
                    file_path=emp.original_path
                ))
        else:
            issues.append(Issue(
                issue_type=IssueType.DATE_FORMAT_ERROR,
                severity=RiskLevel.MEDIUM,
                message="在职证明文件名未标注开具日期",
                evidence=f"文件: {filename}，建议标注开具日期，如 20260101",
                document_type="employment_cert",
                file_path=emp.original_path
            ))
    
    return issues


def check_itinerary_consistency(
    applicant: Applicant,
    itineraries: Dict[str, Itinerary]
) -> List[Issue]:
    issues = []
    
    if applicant.applicant_id not in itineraries:
        return issues
    
    itinerary = itineraries[applicant.applicant_id]
    
    if not itinerary.days:
        return issues
    
    sorted_days = sorted(itinerary.days, key=lambda d: d.date)
    
    expected_date = sorted_days[0].date
    for i, day in enumerate(sorted_days):
        if day.date != expected_date:
            issues.append(Issue(
                issue_type=IssueType.ITINERARY_CONFLICT,
                severity=RiskLevel.HIGH,
                message="行程日期不连续",
                evidence=f"第 {i+1} 天应为 {format_date(expected_date)}，但实际是 {format_date(day.date)}，中间缺少 {days_between(expected_date, day.date) - 1} 天",
                document_type="itinerary"
            ))
        expected_date = add_months(day.date, 0).replace(day=day.date.day + 1) if day.date.day < 28 else None
        if expected_date is None:
            if day.date.month == 12:
                expected_date = date(day.date.year + 1, 1, 1)
            else:
                expected_date = date(day.date.year, day.date.month + 1, 1)
    
    return issues


def check_missing_documents(
    applicant: Applicant,
    materials: List[MaterialFile],
    rules: Rules
) -> List[Issue]:
    issues = []
    
    required_docs = rules.required_documents
    found_docs = {m.document_type for m in materials if m.document_type}
    
    missing = [doc for doc in required_docs if doc not in found_docs]
    
    if missing:
        doc_names = {
            'passport': '护照扫描件',
            'photo': '证件照',
            'employment_cert': '在职证明',
            'bank_statement': '银行流水',
            'flight_itinerary': '机票行程单',
            'hotel_booking': '酒店预订单',
            'insurance': '保险单',
            'itinerary': '行程表',
        }
        
        missing_names = [doc_names.get(doc, doc) for doc in missing]
        
        issues.append(Issue(
            issue_type=IssueType.MISSING_DOCUMENT,
            severity=RiskLevel.CRITICAL,
            message=f"缺少必需材料: {', '.join(missing_names)}",
            evidence=f"需要: {', '.join(required_docs)}，已提供: {', '.join(sorted(found_docs)) if found_docs else '无'}",
            document_type=", ".join(missing)
        ))
        
        applicant.missing_docs = missing
    
    return issues


def validate_all(
    applicants: List[Applicant],
    itineraries: Dict[str, Itinerary],
    materials: List[MaterialFile],
    rules: Rules,
    today: Optional[date] = None
) -> ValidationResult:
    if today is None:
        today = date.today()
    
    global_issues: List[Issue] = []
    all_unmatched: List[MaterialFile] = []
    
    matched, unmatched, match_issues = match_materials(
        materials, applicants, rules.document_naming_pattern
    )
    
    global_issues.extend(match_issues)
    all_unmatched.extend(unmatched)
    
    for applicant in applicants:
        applicant_materials = matched.get(applicant.applicant_id, [])
        applicant.materials = applicant_materials
        
        itinerary = itineraries.get(applicant.applicant_id)
        
        applicant.issues.extend(check_missing_documents(applicant, applicant_materials, rules))
        applicant.issues.extend(check_passport_validity(applicant, rules, today, itinerary))
        applicant.issues.extend(check_photo_requirements(applicant, applicant_materials, rules))
        applicant.issues.extend(check_insurance_coverage(applicant, applicant_materials, rules, itinerary))
        applicant.issues.extend(check_hotel_booking(applicant, applicant_materials, itinerary))
        applicant.issues.extend(check_employment_cert(applicant, applicant_materials, rules, today))
        
        if itinerary:
            applicant.issues.extend(check_itinerary_consistency(applicant, itineraries))
    
    return ValidationResult(
        applicants=applicants,
        itineraries=itineraries,
        rules=rules,
        materials=materials,
        unmatched_materials=all_unmatched,
        global_issues=global_issues,
    )
