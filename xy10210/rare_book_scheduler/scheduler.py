"""排程算法模块"""
from datetime import date, timedelta
from typing import Dict, List, Optional, Set, Tuple

from .models import (
    ConflictInfo,
    DamageLevel,
    RareBook,
    RepairSkill,
    Restorer,
    ScheduleEntry,
    ScheduleResult,
    Exhibition,
)
from .validator import DAMAGE_LEVEL_ORDER


def is_skill_match(book_skills: List[RepairSkill], restorer_skills: List[RepairSkill]) -> bool:
    """检查修复师是否具备所需技能"""
    if not book_skills:
        return True
    return all(skill in restorer_skills for skill in book_skills)


def can_handle_damage_level(book_level: DamageLevel, restorer_max_level: DamageLevel) -> bool:
    """检查修复师是否能处理该破损等级"""
    return DAMAGE_LEVEL_ORDER[book_level] <= DAMAGE_LEVEL_ORDER[restorer_max_level]


def date_range_overlap(
    range1_start: date,
    range1_end: date,
    range2_start: date,
    range2_end: date,
) -> bool:
    """检查两个日期范围是否有重叠"""
    return not (range1_end < range2_start or range2_end < range1_start)


def check_exhibition_conflicts(
    book: RareBook,
    start_date: date,
    end_date: date,
    exhibitions: List[Exhibition],
) -> List[ConflictInfo]:
    """检查与展览借调的冲突"""
    conflicts = []
    book_exhibitions = [e for e in exhibitions if e.book_id == book.book_id]
    
    for exhibition in book_exhibitions:
        if date_range_overlap(start_date, end_date, exhibition.start_date, exhibition.end_date):
            conflicts.append(ConflictInfo(
                conflict_type="exhibition_conflict",
                book_id=book.book_id,
                conflicting_item_id=exhibition.exhibition_id,
                description=f"修复时间与展览 '{exhibition.exhibition_id}' 冲突",
                affected_date_range=(exhibition.start_date, exhibition.end_date),
            ))
    
    return conflicts


def check_restorer_availability(
    restorer: Restorer,
    start_date: date,
    end_date: date,
    existing_assignments: Dict[str, List[Tuple[date, date, str]]],
) -> Tuple[bool, Optional[ConflictInfo]]:
    """检查修复师在指定日期是否可用"""
    restorer_assignments = existing_assignments.get(restorer.restorer_id, [])
    
    for assign_start, assign_end, book_id in restorer_assignments:
        if date_range_overlap(start_date, end_date, assign_start, assign_end):
            return False, ConflictInfo(
                conflict_type="restorer_overlap",
                book_id="N/A",
                conflicting_item_id=book_id,
                description=f"修复师 '{restorer.name}' 在 {start_date} 至 {end_date} 期间已有任务",
                affected_date_range=(assign_start, assign_end),
            )
    
    current_date = start_date
    while current_date <= end_date:
        if current_date in restorer.vacation_days:
            return False, ConflictInfo(
                conflict_type="restorer_vacation",
                book_id="N/A",
                conflicting_item_id="N/A",
                description=f"修复师 '{restorer.name}' 在 {current_date} 处于休假中",
                affected_date_range=(current_date, current_date),
            )
        current_date += timedelta(days=1)
    
    return True, None


def find_next_available_slot(
    restorer: Restorer,
    duration: int,
    earliest_start: date,
    exhibitions: List[Exhibition],
    book: RareBook,
    existing_assignments: Dict[str, List[Tuple[date, date, str]]],
    max_search_days: int = 180,
) -> Optional[Tuple[date, date]]:
    """为修复师寻找下一个可用时间段"""
    current_start = earliest_start
    days_searched = 0
    
    while days_searched < max_search_days:
        current_end = current_start + timedelta(days=duration - 1)
        
        exhibition_conflicts = check_exhibition_conflicts(book, current_start, current_end, exhibitions)
        if exhibition_conflicts:
            current_start = max(e.affected_date_range[1] for e in exhibition_conflicts) + timedelta(days=1)
            days_searched += 1
            continue
        
        available, _ = check_restorer_availability(restorer, current_start, current_end, existing_assignments)
        if available:
            return (current_start, current_end)
        
        restorer_assignments = existing_assignments.get(restorer.restorer_id, [])
        if restorer_assignments:
            latest_end = max(a[1] for a in restorer_assignments)
            if latest_end >= current_start:
                current_start = latest_end + timedelta(days=1)
        
        if current_start in restorer.vacation_days:
            while current_start in restorer.vacation_days:
                current_start += timedelta(days=1)
        else:
            current_start += timedelta(days=1)
        
        days_searched += 1
    
    return None


def schedule_books(
    books: List[RareBook],
    restorers: List[Restorer],
    exhibitions: List[Exhibition],
    start_date: Optional[date] = None,
) -> ScheduleResult:
    """
    核心排程算法
    
    排程规则：
    1. 按破损等级降序排列（CRITICAL > HIGH > MEDIUM > LOW）
    2. 先匹配技能，再匹配破损等级能力
    3. 避开展览借调时间
    4. 避开修复师休假
    5. 避免修复师任务重叠
    """
    if start_date is None:
        start_date = date.today()
    
    sorted_books = sorted(
        books,
        key=lambda b: DAMAGE_LEVEL_ORDER[b.damage_level],
        reverse=True,
    )
    
    result = ScheduleResult()
    existing_assignments: Dict[str, List[Tuple[date, date, str]]] = {}
    
    for book in sorted_books:
        eligible_restorers = [
            r for r in restorers
            if is_skill_match(book.required_skills, r.skills)
            and can_handle_damage_level(book.damage_level, r.max_damage_level)
        ]
        
        if not eligible_restorers:
            result.unscheduled_count += 1
            result.manual_review_count += 1
            result.manual_review_items.append({
                "book_id": book.book_id,
                "title": book.title,
                "reason": "没有找到具备所需技能或能力的修复师",
                "required_skills": [s.value for s in book.required_skills],
                "damage_level": book.damage_level.value,
            })
            result.conflicts.append(ConflictInfo(
                conflict_type="no_eligible_restorer",
                book_id=book.book_id,
                conflicting_item_id="N/A",
                description=f"善本 '{book.title}' 需要技能 {[s.value for s in book.required_skills]} 和 {book.damage_level.value} 级能力，但没有匹配的修复师",
            ))
            continue
        
        best_assignment = None
        best_restorer = None
        earliest_end = None
        
        for restorer in eligible_restorers:
            slot = find_next_available_slot(
                restorer,
                book.estimated_repair_days,
                start_date,
                exhibitions,
                book,
                existing_assignments,
            )
            
            if slot:
                if earliest_end is None or slot[1] < earliest_end:
                    earliest_end = slot[1]
                    best_assignment = slot
                    best_restorer = restorer
        
        if best_assignment and best_restorer:
            assign_start, assign_end = best_assignment
            
            entry = ScheduleEntry(
                book_id=book.book_id,
                title=book.title,
                restorer_id=best_restorer.restorer_id,
                restorer_name=best_restorer.name,
                start_date=assign_start,
                end_date=assign_end,
                damage_level=book.damage_level,
                notes=book.notes,
            )
            result.schedule.append(entry)
            result.scheduled_count += 1
            
            if best_restorer.restorer_id not in existing_assignments:
                existing_assignments[best_restorer.restorer_id] = []
            existing_assignments[best_restorer.restorer_id].append(
                (assign_start, assign_end, book.book_id)
            )
        else:
            result.unscheduled_count += 1
            result.manual_review_count += 1
            result.manual_review_items.append({
                "book_id": book.book_id,
                "title": book.title,
                "reason": "无法在搜索范围内找到可用的排程时间",
            })
    
    return result
