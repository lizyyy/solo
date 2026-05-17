from datetime import datetime, date
from typing import List, Dict, Set, Tuple
from collections import defaultdict

from .models import ScheduleRow, Issue, IssueType, TimeSlot, SourceLocation


class RuleEngine:
    def __init__(self):
        pass

    def expand_time_slots(self, rows: List[ScheduleRow]) -> Dict[date, List[Tuple[ScheduleRow, TimeSlot]]]:
        slots_by_date = defaultdict(list)
        for row in rows:
            if not row.is_valid or not row.date:
                continue
            try:
                slot = self._row_to_time_slot(row)
                if slot:
                    slots_by_date[row.date].append((row, slot))
            except Exception:
                continue
        return dict(slots_by_date)

    def _row_to_time_slot(self, row: ScheduleRow):
        if not row.start_time or not row.end_time:
            return None
        start_dt = self._combine_date_time(row.date, row.start_time)
        end_dt = self._combine_date_time(row.date, row.end_time)
        if not start_dt or not end_dt:
            return None
        if end_dt <= start_dt:
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        return TimeSlot(
            date=row.date,
            start_time=row.start_time,
            end_time=row.end_time,
            start_dt=start_dt,
            end_dt=end_dt
        )

    @staticmethod
    def _combine_date_time(d: date, time_str: str):
        time_str = time_str.strip().replace("：", ":")
        for fmt in ["%H:%M", "%H:%M:%S", "%H%M", "%H:%M %p", "%I:%M %p"]:
            try:
                t = datetime.strptime(time_str, fmt).time()
                return datetime.combine(d, t)
            except ValueError:
                continue
        return None

    def check_person_conflicts(
        self,
        slots_by_date: Dict[date, List[Tuple[ScheduleRow, TimeSlot]]]
    ) -> List[Issue]:
        issues = []
        for d, slots in slots_by_date.items():
            anchor_slots: Dict[str, List[Tuple[ScheduleRow, TimeSlot]]] = defaultdict(list)
            for row, slot in slots:
                if row.anchor:
                    anchor_slots[row.anchor].append((row, slot))
            for anchor, anchor_slot_list in anchor_slots.items():
                conflicts = self._find_time_overlaps(anchor_slot_list)
                for conflict in conflicts:
                    issue = Issue(
                        issue_type=IssueType.PERSON_CONFLICT,
                        severity="high",
                        message=f"主播 [{anchor}] 在 {d} 存在时间冲突",
                        sources=[r.source for r, _ in conflict],
                        details={
                            "person": anchor,
                            "date": str(d),
                            "conflict_rows": [
                                {
                                    "account": r.account,
                                    "time": f"{r.start_time}-{r.end_time}",
                                    "row": r.source.row_number
                                }
                                for r, _ in conflict
                            ]
                        }
                    )
                    issues.append(issue)
        return issues

    def _find_time_overlaps(self, slots: List[Tuple[ScheduleRow, TimeSlot]]):
        if len(slots) < 2:
            return []
        sorted_slots = sorted(slots, key=lambda x: x[1].start_dt)
        conflicts = []
        for i in range(len(sorted_slots)):
            row1, slot1 = sorted_slots[i]
            for j in range(i + 1, len(sorted_slots)):
                row2, slot2 = sorted_slots[j]
                if slot2.start_dt < slot1.end_dt:
                    conflicts.append([(row1, slot1), (row2, slot2)])
                else:
                    break
        return conflicts

    def check_script_missing(self, rows: List[ScheduleRow]) -> List[Issue]:
        issues = []
        for row in rows:
            if not row.is_valid:
                continue
            missing = []
            if not row.field_control:
                missing.append("场控")
            if not row.product_script:
                missing.append("商品脚本")
            if missing:
                issue = Issue(
                    issue_type=IssueType.SCRIPT_MISSING,
                    severity="medium",
                    message=f"账号 [{row.account}] 缺少: {', '.join(missing)}",
                    sources=[row.source],
                    details={
                        "anchor": row.anchor,
                        "account": row.account,
                        "date": str(row.date) if row.date else "",
                        "time": f"{row.start_time}-{row.end_time}",
                        "missing": missing
                    }
                )
                issues.append(issue)
        return issues

    def check_bad_rows(self, rows: List[ScheduleRow]) -> List[Issue]:
        issues = []
        for row in rows:
            if not row.is_valid:
                issue = Issue(
                    issue_type=IssueType.BAD_ROW,
                    severity="low",
                    message=f"数据行错误: {', '.join(row.parse_errors)}",
                    sources=[row.source],
                    details={
                        "errors": row.parse_errors,
                        "original": row.source.original_content
                    }
                )
                issues.append(issue)
        return issues

    def calculate_stats(self, rows: List[ScheduleRow]):
        account_stats = defaultdict(lambda: {
            "total": 0,
            "anchors": set(),
            "dates": set(),
            "missing_field_control": 0,
            "missing_product_script": 0
        })
        person_stats = defaultdict(lambda: {
            "total": 0,
            "accounts": set(),
            "dates": set(),
            "conflicts": 0
        })
        for row in rows:
            if not row.is_valid:
                continue
            account_stats[row.account]["total"] += 1
            account_stats[row.account]["anchors"].add(row.anchor)
            if row.date:
                account_stats[row.account]["dates"].add(str(row.date))
            if not row.field_control:
                account_stats[row.account]["missing_field_control"] += 1
            if not row.product_script:
                account_stats[row.account]["missing_product_script"] += 1
            if row.anchor:
                person_stats[row.anchor]["total"] += 1
                person_stats[row.anchor]["accounts"].add(row.account)
                if row.date:
                    person_stats[row.anchor]["dates"].add(str(row.date))
        for stats in account_stats.values():
            stats["anchors"] = sorted(stats["anchors"])
            stats["dates"] = sorted(stats["dates"])
        for stats in person_stats.values():
            stats["accounts"] = sorted(stats["accounts"])
            stats["dates"] = sorted(stats["dates"])
        return dict(account_stats), dict(person_stats)
