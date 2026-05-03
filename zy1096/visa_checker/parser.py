import csv
import json
import os
from datetime import date
from pathlib import Path
from typing import List, Dict, Tuple, Optional

from .models import Applicant, Itinerary, ItineraryDay, Rules, Issue, IssueType, RiskLevel
from .utils import parse_date


class ParserError(Exception):
    pass


def parse_applicants(csv_path: str) -> Tuple[List[Applicant], List[Issue]]:
    applicants = []
    issues = []
    
    if not os.path.exists(csv_path):
        raise ParserError(f"申请人文件不存在: {csv_path}")
    
    try:
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                required_fields = ['applicant_id', 'name', 'passport_number', 'passport_expiry_date']
                missing_fields = [f for f in required_fields if not row.get(f)]
                
                if missing_fields:
                    issues.append(Issue(
                        issue_type=IssueType.RULES_MISSING_FIELD,
                        severity=RiskLevel.HIGH,
                        message=f"第 {row_num} 行缺少必填字段: {', '.join(missing_fields)}",
                        evidence=f"CSV 文件: {csv_path}, 行号: {row_num}"
                    ))
                    continue
                
                applicant_id = row['applicant_id'].strip()
                
                expiry_date, expiry_error = parse_date(row['passport_expiry_date'])
                if expiry_error:
                    issues.append(Issue(
                        issue_type=IssueType.DATE_FORMAT_ERROR,
                        severity=RiskLevel.HIGH,
                        message=f"申请人 {applicant_id} 的护照有效期格式错误",
                        evidence=f"原始值: '{row['passport_expiry_date']}', 错误: {expiry_error}",
                        document_type="passport"
                    ))
                
                birth_date = None
                if row.get('birth_date'):
                    birth_date, _ = parse_date(row['birth_date'])
                
                applicant = Applicant(
                    applicant_id=applicant_id,
                    name=row['name'].strip(),
                    passport_number=row['passport_number'].strip(),
                    passport_expiry_date=expiry_date if expiry_date else date(2000, 1, 1),
                    birth_date=birth_date,
                    nationality=row.get('nationality', '').strip() or None,
                    email=row.get('email', '').strip() or None,
                    phone=row.get('phone', '').strip() or None,
                )
                applicants.append(applicant)
    
    except csv.Error as e:
        raise ParserError(f"CSV 解析错误: {e}")
    except UnicodeDecodeError:
        raise ParserError(f"文件编码错误，请确保使用 UTF-8 编码: {csv_path}")
    
    if not applicants:
        raise ParserError(f"没有找到有效的申请人数据: {csv_path}")
    
    return applicants, issues


def parse_itinerary(csv_path: str) -> Tuple[Dict[str, Itinerary], List[Issue]]:
    itineraries: Dict[str, Itinerary] = {}
    issues = []
    
    if not os.path.exists(csv_path):
        return {}, [Issue(
            issue_type=IssueType.RULES_MISSING_FIELD,
            severity=RiskLevel.MEDIUM,
            message=f"行程文件不存在: {csv_path}",
            evidence="行程校验将被跳过"
        )]
    
    try:
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            all_days: Dict[str, List[ItineraryDay]] = {}
            
            for row_num, row in enumerate(reader, start=2):
                applicant_id = row.get('applicant_id', '').strip()
                if not applicant_id:
                    issues.append(Issue(
                        issue_type=IssueType.APPLICANT_NOT_FOUND,
                        severity=RiskLevel.MEDIUM,
                        message=f"第 {row_num} 行缺少申请人编号",
                        evidence=f"CSV 文件: {csv_path}, 行号: {row_num}"
                    ))
                    continue
                
                date_str = row.get('date', '').strip()
                if not date_str:
                    issues.append(Issue(
                        issue_type=IssueType.DATE_FORMAT_ERROR,
                        severity=RiskLevel.MEDIUM,
                        message=f"第 {row_num} 行缺少日期",
                        evidence=f"申请人: {applicant_id}"
                    ))
                    continue
                
                day_date, date_error = parse_date(date_str)
                if date_error:
                    issues.append(Issue(
                        issue_type=IssueType.DATE_FORMAT_ERROR,
                        severity=RiskLevel.HIGH,
                        message=f"申请人 {applicant_id} 的行程日期格式错误",
                        evidence=f"原始值: '{date_str}', 错误: {date_error}"
                    ))
                    continue
                
                if applicant_id not in all_days:
                    all_days[applicant_id] = []
                
                day = ItineraryDay(
                    date=day_date,
                    city=row.get('city', '').strip() or "未知",
                    country=row.get('country', '').strip() or "未知",
                    hotel_name=row.get('hotel_name', '').strip() or None,
                    notes=row.get('notes', '').strip() or None,
                )
                all_days[applicant_id].append(day)
            
            for applicant_id, days in all_days.items():
                if not days:
                    continue
                
                days.sort(key=lambda d: d.date)
                start_date = days[0].date
                end_date = days[-1].date
                
                expected_days = (end_date - start_date).days + 1
                if len(days) != expected_days:
                    issues.append(Issue(
                        issue_type=IssueType.ITINERARY_CONFLICT,
                        severity=RiskLevel.MEDIUM,
                        message=f"申请人 {applicant_id} 的行程日期不连续",
                        evidence=f"开始日期: {start_date}, 结束日期: {end_date}, 预期 {expected_days} 天, 实际 {len(days)} 天"
                    ))
                
                itineraries[applicant_id] = Itinerary(
                    applicant_id=applicant_id,
                    start_date=start_date,
                    end_date=end_date,
                    days=days,
                )
    
    except csv.Error as e:
        raise ParserError(f"CSV 解析错误: {e}")
    except UnicodeDecodeError:
        raise ParserError(f"文件编码错误，请确保使用 UTF-8 编码: {csv_path}")
    
    return itineraries, issues


def parse_rules(json_path: str) -> Tuple[Rules, List[Issue]]:
    issues = []
    
    if not os.path.exists(json_path):
        return Rules.default(), [Issue(
            issue_type=IssueType.RULES_MISSING_FIELD,
            severity=RiskLevel.LOW,
            message=f"规则文件不存在: {json_path}",
            evidence="将使用默认规则"
        )]
    
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        return Rules.default(), [Issue(
            issue_type=IssueType.RULES_MISSING_FIELD,
            severity=RiskLevel.HIGH,
            message=f"规则文件 JSON 格式错误",
            evidence=f"错误: {e}, 将使用默认规则"
        )]
    
    required_fields = ['required_documents']
    missing_fields = [f for f in required_fields if f not in data]
    
    if missing_fields:
        issues.append(Issue(
            issue_type=IssueType.RULES_MISSING_FIELD,
            severity=RiskLevel.MEDIUM,
            message=f"规则文件缺少字段: {', '.join(missing_fields)}",
            evidence="部分校验将使用默认值"
        ))
    
    rules = Rules(
        passport_min_validity_months=data.get('passport_min_validity_months', 6),
        employment_cert_max_age_days=data.get('employment_cert_max_age_days', 30),
        insurance_buffer_days=data.get('insurance_buffer_days', 2),
        required_documents=data.get('required_documents', [
            "passport", "photo", "employment_cert", "bank_statement",
            "flight_itinerary", "hotel_booking", "insurance"
        ]),
        photo_requirements=data.get('photo_requirements', {
            "size": "35x45mm",
            "background": "white",
            "max_age_months": 6,
        }),
        document_naming_pattern=data.get('document_naming_pattern', "{applicant_id}_{document_type}.{ext}"),
    )
    
    return rules, issues
