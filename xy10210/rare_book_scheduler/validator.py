"""数据验证模块"""
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from .models import (
    DamageLevel,
    ImportResult,
    RareBook,
    RepairSkill,
    Restorer,
    ValidationIssue,
    Exhibition,
)


DAMAGE_LEVEL_ORDER = {
    DamageLevel.LOW: 1,
    DamageLevel.MEDIUM: 2,
    DamageLevel.HIGH: 3,
    DamageLevel.CRITICAL: 4,
}


def parse_date(date_str: str) -> Optional[datetime]:
    """解析日期字符串，支持多种格式"""
    if not date_str or not date_str.strip():
        return None
    date_str = date_str.strip()
    formats = ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).date()
        except ValueError:
            continue
    return None


def parse_damage_level(value: str, source: str, line_num: int) -> Tuple[Optional[DamageLevel], Optional[ValidationIssue]]:
    """解析破损等级"""
    if not value:
        return None, ValidationIssue(
            issue_type="missing_field",
            source=source,
            line_number=line_num,
            field_name="damage_level",
            raw_value=value,
            message="破损等级不能为空",
        )
    
    value_lower = value.strip().lower()
    level_map = {
        "low": DamageLevel.LOW,
        "轻度": DamageLevel.LOW,
        "medium": DamageLevel.MEDIUM,
        "中度": DamageLevel.MEDIUM,
        "high": DamageLevel.HIGH,
        "重度": DamageLevel.HIGH,
        "critical": DamageLevel.CRITICAL,
        "危急": DamageLevel.CRITICAL,
    }
    
    if value_lower in level_map:
        return level_map[value_lower], None
    
    return None, ValidationIssue(
        issue_type="invalid_value",
        source=source,
        line_number=line_num,
        field_name="damage_level",
        raw_value=value,
        message=f"无效的破损等级: '{value}'。有效值: low/轻度, medium/中度, high/重度, critical/危急",
    )


def parse_skills(value: str) -> Tuple[List[RepairSkill], List[str]]:
    """解析技能列表"""
    if not value:
        return [], []
    
    skill_map = {
        "paper_repair": RepairSkill.PAPER_REPAIR,
        "纸张修复": RepairSkill.PAPER_REPAIR,
        "binding": RepairSkill.BINDING,
        "装订修复": RepairSkill.BINDING,
        "color_restoration": RepairSkill.COLOR_RESTORATION,
        "色彩还原": RepairSkill.COLOR_RESTORATION,
        "digitalization": RepairSkill.DIGITALIZATION,
        "数字化": RepairSkill.DIGITALIZATION,
        "deacidification": RepairSkill.DEACIDIFICATION,
        "脱酸处理": RepairSkill.DEACIDIFICATION,
    }
    
    invalid_skills = []
    valid_skills = []
    
    for skill_str in value.split(","):
        skill_str = skill_str.strip().lower()
        if skill_str in skill_map:
            valid_skills.append(skill_map[skill_str])
        elif skill_str:
            invalid_skills.append(skill_str)
    
    return valid_skills, invalid_skills


def _to_str(value: Any) -> str:
    """将任意类型转换为字符串"""
    if value is None:
        return ""
    if isinstance(value, list):
        return ",".join(str(v) for v in value)
    return str(value)


def validate_book_data(row: Dict[str, Any], source: str, line_num: int) -> Tuple[Optional[RareBook], List[ValidationIssue]]:
    """验证善本数据"""
    issues = []
    book_id = _to_str(row.get("book_id", "")).strip()
    title = _to_str(row.get("title", "")).strip()
    damage_level_str = _to_str(row.get("damage_level", "")).strip()
    skills_str = _to_str(row.get("required_skills", "")).strip()
    repair_days_str = _to_str(row.get("estimated_repair_days", "")).strip()
    notes = _to_str(row.get("notes", "")).strip() or None
    
    if not book_id:
        issues.append(ValidationIssue(
            issue_type="missing_field",
            source=source,
            line_number=line_num,
            field_name="book_id",
            raw_value=book_id,
            message="善本ID不能为空",
        ))
    
    if not title:
        issues.append(ValidationIssue(
            issue_type="missing_field",
            source=source,
            line_number=line_num,
            field_name="title",
            raw_value=title,
            message="善本名称不能为空",
        ))
    
    damage_level, dl_issue = parse_damage_level(damage_level_str, source, line_num)
    if dl_issue:
        issues.append(dl_issue)
    
    required_skills, invalid_skills = parse_skills(skills_str)
    for inv_skill in invalid_skills:
        issues.append(ValidationIssue(
            issue_type="invalid_value",
            source=source,
            line_number=line_num,
            field_name="required_skills",
            raw_value=inv_skill,
            message=f"无效的技能类型: '{inv_skill}'",
        ))
    
    repair_days = None
    if repair_days_str:
        try:
            repair_days = int(repair_days_str)
            if repair_days <= 0:
                issues.append(ValidationIssue(
                    issue_type="invalid_value",
                    source=source,
                    line_number=line_num,
                    field_name="estimated_repair_days",
                    raw_value=repair_days_str,
                    message=f"预计修复天数必须为正整数: {repair_days_str}",
                ))
                repair_days = None
        except ValueError:
            issues.append(ValidationIssue(
                issue_type="invalid_value",
                source=source,
                line_number=line_num,
                field_name="estimated_repair_days",
                raw_value=repair_days_str,
                message=f"预计修复天数格式无效: {repair_days_str}",
            ))
    
    if repair_days is None:
        if damage_level:
            default_days = {
                DamageLevel.LOW: 3,
                DamageLevel.MEDIUM: 7,
                DamageLevel.HIGH: 14,
                DamageLevel.CRITICAL: 21,
            }
            repair_days = default_days[damage_level]
            issues.append(ValidationIssue(
                issue_type="warning",
                source=source,
                line_number=line_num,
                field_name="estimated_repair_days",
                raw_value=repair_days_str,
                message=f"未提供预计修复天数，根据破损等级默认设置为 {repair_days} 天",
                requires_manual_review=True,
            ))
        else:
            repair_days = 7
    
    critical_issues = [i for i in issues if i.issue_type in ["missing_field", "invalid_value"] and not i.requires_manual_review]
    
    if critical_issues or not book_id or not title or not damage_level:
        return None, issues
    
    book = RareBook(
        book_id=book_id,
        title=title,
        damage_level=damage_level,
        required_skills=required_skills,
        estimated_repair_days=repair_days,
        import_source=source,
        line_number=line_num,
        notes=notes,
    )
    
    return book, issues


def validate_restorer_data(row: Dict[str, Any], source: str, line_num: int) -> Tuple[Optional[Restorer], List[ValidationIssue]]:
    """验证修复师数据"""
    issues = []
    restorer_id = _to_str(row.get("restorer_id", "")).strip()
    name = _to_str(row.get("name", "")).strip()
    skills_str = _to_str(row.get("skills", "")).strip()
    max_level_str = _to_str(row.get("max_damage_level", "")).strip()
    vacation_str = _to_str(row.get("vacation_days", "")).strip()
    
    if not restorer_id:
        issues.append(ValidationIssue(
            issue_type="missing_field",
            source=source,
            line_number=line_num,
            field_name="restorer_id",
            raw_value=restorer_id,
            message="修复师ID不能为空",
        ))
    
    if not name:
        issues.append(ValidationIssue(
            issue_type="missing_field",
            source=source,
            line_number=line_num,
            field_name="name",
            raw_value=name,
            message="修复师姓名不能为空",
        ))
    
    skills, invalid_skills = parse_skills(skills_str)
    for inv_skill in invalid_skills:
        issues.append(ValidationIssue(
            issue_type="invalid_value",
            source=source,
            line_number=line_num,
            field_name="skills",
            raw_value=inv_skill,
            message=f"无效的技能类型: '{inv_skill}'",
        ))
    
    if not skills:
        issues.append(ValidationIssue(
            issue_type="warning",
            source=source,
            line_number=line_num,
            field_name="skills",
            raw_value=skills_str,
            message="修复师未配置任何技能，将无法被分配修复任务",
            requires_manual_review=True,
        ))
    
    max_level, ml_issue = parse_damage_level(max_level_str, source, line_num)
    if ml_issue:
        issues.append(ml_issue)
    if not max_level:
        max_level = DamageLevel.MEDIUM
        issues.append(ValidationIssue(
            issue_type="warning",
            source=source,
            line_number=line_num,
            field_name="max_damage_level",
            raw_value=max_level_str,
            message="未提供最高可处理破损等级，默认设置为 MEDIUM",
            requires_manual_review=True,
        ))
    
    vacation_days = []
    if vacation_str:
        for day_str in vacation_str.split(","):
            day = parse_date(day_str)
            if day:
                vacation_days.append(day)
            else:
                issues.append(ValidationIssue(
                    issue_type="invalid_value",
                    source=source,
                    line_number=line_num,
                    field_name="vacation_days",
                    raw_value=day_str,
                    message=f"日期格式无效: {day_str}，请使用 YYYY-MM-DD 格式",
                ))
    
    critical_issues = [i for i in issues if i.issue_type in ["missing_field", "invalid_value"] and not i.requires_manual_review]
    
    if critical_issues or not restorer_id or not name:
        return None, issues
    
    restorer = Restorer(
        restorer_id=restorer_id,
        name=name,
        skills=skills,
        max_damage_level=max_level,
        vacation_days=vacation_days,
        import_source=source,
        line_number=line_num,
    )
    
    return restorer, issues


def validate_exhibition_data(row: Dict[str, Any], source: str, line_num: int) -> Tuple[Optional[Exhibition], List[ValidationIssue]]:
    """验证展览借调数据"""
    issues = []
    exhibition_id = _to_str(row.get("exhibition_id", "")).strip()
    book_id = _to_str(row.get("book_id", "")).strip()
    start_str = _to_str(row.get("start_date", "")).strip()
    end_str = _to_str(row.get("end_date", "")).strip()
    
    if not exhibition_id:
        issues.append(ValidationIssue(
            issue_type="missing_field",
            source=source,
            line_number=line_num,
            field_name="exhibition_id",
            raw_value=exhibition_id,
            message="展览ID不能为空",
        ))
    
    if not book_id:
        issues.append(ValidationIssue(
            issue_type="missing_field",
            source=source,
            line_number=line_num,
            field_name="book_id",
            raw_value=book_id,
            message="善本ID不能为空",
        ))
    
    start_date = parse_date(start_str) if start_str else None
    end_date = parse_date(end_str) if end_str else None
    
    if not start_date:
        issues.append(ValidationIssue(
            issue_type="missing_field",
            source=source,
            line_number=line_num,
            field_name="start_date",
            raw_value=start_str,
            message="开始日期不能为空，格式: YYYY-MM-DD",
        ))
    
    if not end_date:
        issues.append(ValidationIssue(
            issue_type="missing_field",
            source=source,
            line_number=line_num,
            field_name="end_date",
            raw_value=end_str,
            message="结束日期不能为空，格式: YYYY-MM-DD",
        ))
    
    if start_date and end_date and end_date < start_date:
        issues.append(ValidationIssue(
            issue_type="invalid_value",
            source=source,
            line_number=line_num,
            field_name="end_date",
            raw_value=end_str,
            message=f"结束日期 {end_str} 早于开始日期 {start_str}",
        ))
    
    critical_issues = [i for i in issues if i.issue_type in ["missing_field", "invalid_value"]]
    
    if critical_issues:
        return None, issues
    
    exhibition = Exhibition(
        exhibition_id=exhibition_id,
        book_id=book_id,
        start_date=start_date,
        end_date=end_date,
        import_source=source,
        line_number=line_num,
    )
    
    return exhibition, issues
