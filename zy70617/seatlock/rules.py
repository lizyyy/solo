from datetime import datetime, timedelta
from typing import List, Dict, Set, Tuple, Optional
from collections import defaultdict
import uuid

from .models import (
    Show, Seat, GroupOrder, HoldWindow, SeatLock, SeatChangeRequest,
    Issue, IssueType, LockStatus, SeatStatus, ChangeStatus, SourceTrace
)


class SeatLockRuleEngine:
    def __init__(self):
        self.shows: Dict[str, Show] = {}
        self.seats: Dict[str, Seat] = {}
        self.orders: Dict[str, GroupOrder] = {}
        self.windows: Dict[str, HoldWindow] = {}
        self.locks: Dict[str, SeatLock] = {}
        self.changes: Dict[str, SeatChangeRequest] = {}
        self.issues: List[Issue] = []
        
        self._seat_locks_by_seat: Dict[str, List[SeatLock]] = defaultdict(list)
        self._locks_by_order: Dict[str, List[SeatLock]] = defaultdict(list)
        self._windows_by_order: Dict[str, List[HoldWindow]] = defaultdict(list)
        self._seats_by_show: Dict[str, List[Seat]] = defaultdict(list)
    
    def add_show(self, show: Show):
        self.shows[show.show_id] = show
    
    def add_seat(self, seat: Seat):
        self.seats[seat.seat_id] = seat
        self._seats_by_show[seat.show_id].append(seat)
    
    def add_order(self, order: GroupOrder):
        self.orders[order.order_id] = order
    
    def add_window(self, window: HoldWindow):
        self.windows[window.window_id] = window
        self._windows_by_order[window.order_id].append(window)
    
    def add_lock(self, lock: SeatLock):
        self.locks[lock.lock_id] = lock
        self._seat_locks_by_seat[lock.seat_id].append(lock)
        self._locks_by_order[lock.order_id].append(lock)
    
    def add_change(self, change: SeatChangeRequest):
        self.changes[change.change_id] = change
    
    def _create_issue(self, issue_type: IssueType, show_id: str, severity: str,
                      description: str, related_ids: Dict[str, List[str]] = None,
                      source_trace: SourceTrace = None) -> Issue:
        issue = Issue(
            issue_id=str(uuid.uuid4()),
            issue_type=issue_type,
            show_id=show_id,
            severity=severity,
            description=description,
            related_ids=related_ids or {},
            discovered_at=datetime.now(),
            source_trace=source_trace
        )
        self.issues.append(issue)
        return issue
    
    def check_timeout_unreleased(self) -> List[Issue]:
        issues = []
        now = datetime.now()
        
        for lock in self.locks.values():
            if lock.status == LockStatus.ACTIVE and now > lock.lock_timeout:
                issue = self._create_issue(
                    issue_type=IssueType.TIMEOUT_UNRELEASED,
                    show_id=lock.show_id,
                    severity="CRITICAL",
                    description=f"锁座超时未释放: 座位{lock.seat_id}已超时{(now - lock.lock_timeout).total_seconds() / 60:.1f}分钟",
                    related_ids={
                        "lock_ids": [lock.lock_id],
                        "seat_ids": [lock.seat_id],
                        "order_ids": [lock.order_id]
                    },
                    source_trace=lock.source_trace
                )
                issues.append(issue)
        return issues
    
    def check_seat_conflicts(self) -> List[Issue]:
        issues = []
        
        for seat_id, locks in self._seat_locks_by_seat.items():
            active_locks = [l for l in locks if l.status == LockStatus.ACTIVE]
            if len(active_locks) > 1:
                seat = self.seats.get(seat_id)
                show_id = seat.show_id if seat else "UNKNOWN"
                
                issue = self._create_issue(
                    issue_type=IssueType.SEAT_CONFLICT,
                    show_id=show_id,
                    severity="HIGH",
                    description=f"座位冲突: 座位{seat_id}被{len(active_locks)}个订单同时锁定",
                    related_ids={
                        "lock_ids": [l.lock_id for l in active_locks],
                        "seat_ids": [seat_id],
                        "order_ids": [l.order_id for l in active_locks]
                    },
                    source_trace=active_locks[0].source_trace
                )
                issues.append(issue)
        return issues
    
    def check_overlapping_windows(self) -> List[Issue]:
        issues = []
        
        windows_by_show_seat = defaultdict(list)
        for window in self.windows.values():
            for seat_id in window.seat_ids:
                key = f"{window.show_id}_{seat_id}"
                windows_by_show_seat[key].append(window)
        
        for key, windows in windows_by_show_seat.items():
            if len(windows) < 2:
                continue
            
            windows_sorted = sorted(windows, key=lambda w: w.hold_start)
            for i in range(len(windows_sorted) - 1):
                w1, w2 = windows_sorted[i], windows_sorted[i + 1]
                if w1.hold_end > w2.hold_start:
                    overlap_minutes = (w1.hold_end - w2.hold_start).total_seconds() / 60
                    issue = self._create_issue(
                        issue_type=IssueType.OVERLAPPING_WINDOW,
                        show_id=w1.show_id,
                        severity="MEDIUM",
                        description=f"保留窗口重叠: 座位{w1.seat_ids}重叠{overlap_minutes:.1f}分钟",
                        related_ids={
                            "window_ids": [w1.window_id, w2.window_id],
                            "order_ids": [w1.order_id, w2.order_id]
                        },
                        source_trace=w1.source_trace
                    )
                    issues.append(issue)
        return issues
    
    def check_invalid_change_requests(self) -> List[Issue]:
        issues = []
        
        for change in self.changes.values():
            if change.status not in [ChangeStatus.PENDING, ChangeStatus.APPROVED]:
                continue
            
            reasons = []
            
            if not change.seat_count_match:
                reasons.append(f"换座数量不匹配: 原{len(change.from_seat_ids)}个座位，新{len(change.to_seat_ids)}个座位")
            
            for seat_id in change.from_seat_ids:
                locks = self._seat_locks_by_seat.get(seat_id, [])
                order_locks = [l for l in locks if l.order_id == change.order_id and l.status == LockStatus.ACTIVE]
                if not order_locks:
                    reasons.append(f"原座位{seat_id}无有效锁")
            
            for seat_id in change.to_seat_ids:
                seat = self.seats.get(seat_id)
                if not seat:
                    reasons.append(f"目标座位{seat_id}不存在")
                elif seat.status not in [SeatStatus.AVAILABLE, SeatStatus.LOCKED]:
                    reasons.append(f"目标座位{seat_id}状态为{seat.status.value}，不可换座")
                else:
                    locks = self._seat_locks_by_seat.get(seat_id, [])
                    active_locks = [l for l in locks if l.status == LockStatus.ACTIVE and l.order_id != change.order_id]
                    if active_locks:
                        reasons.append(f"目标座位{seat_id}已被其他订单锁定")
            
            if reasons:
                issue = self._create_issue(
                    issue_type=IssueType.INVALID_CHANGE,
                    show_id=change.show_id,
                    severity="HIGH",
                    description=f"无效换座申请{change.change_id}: " + "; ".join(reasons),
                    related_ids={
                        "change_ids": [change.change_id],
                        "order_ids": [change.order_id],
                        "seat_ids": change.from_seat_ids + change.to_seat_ids
                    },
                    source_trace=change.source_trace
                )
                issues.append(issue)
        return issues
    
    def check_group_mismatch(self) -> List[Issue]:
        issues = []
        
        for order_id, locks in self._locks_by_order.items():
            order = self.orders.get(order_id)
            if not order:
                continue
            
            active_locks = [l for l in locks if l.status == LockStatus.ACTIVE]
            if len(active_locks) != order.total_tickets:
                issue = self._create_issue(
                    issue_type=IssueType.GROUP_MISMATCH,
                    show_id=order.show_id,
                    severity="MEDIUM",
                    description=f"团体票数量不匹配: 订单{order_id}应有{order.total_tickets}张票，实际锁定{len(active_locks)}个座位",
                    related_ids={
                        "order_ids": [order_id],
                        "lock_ids": [l.lock_id for l in active_locks]
                    },
                    source_trace=order.source_trace
                )
                issues.append(issue)
        return issues
    
    def run_all_checks(self) -> List[Issue]:
        self.issues = []
        
        self.check_timeout_unreleased()
        self.check_seat_conflicts()
        self.check_overlapping_windows()
        self.check_invalid_change_requests()
        self.check_group_mismatch()
        
        return self.issues
    
    def get_lock_statistics(self) -> Dict[str, any]:
        now = datetime.now()
        total_active = sum(1 for l in self.locks.values() if l.status == LockStatus.ACTIVE)
        total_expired = sum(1 for l in self.locks.values() if l.is_timeout)
        total_released = sum(1 for l in self.locks.values() if l.status == LockStatus.RELEASED)
        
        stats = {
            "total_shows": len(self.shows),
            "total_seats": len(self.seats),
            "total_orders": len(self.orders),
            "total_windows": len(self.windows),
            "total_locks": len(self.locks),
            "active_locks": total_active,
            "expired_locks": total_expired,
            "released_locks": total_released,
            "pending_changes": sum(1 for c in self.changes.values() if c.status == ChangeStatus.PENDING),
            "total_issues": len(self.issues),
            "issues_by_type": defaultdict(int),
            "issues_by_severity": defaultdict(int)
        }
        
        for issue in self.issues:
            stats["issues_by_type"][issue.issue_type.value] += 1
            stats["issues_by_severity"][issue.severity] += 1
        
        stats["issues_by_type"] = dict(stats["issues_by_type"])
        stats["issues_by_severity"] = dict(stats["issues_by_severity"])
        
        return stats
    
    def get_expired_locks_detail(self) -> List[Dict[str, any]]:
        now = datetime.now()
        expired = []
        for lock in self.locks.values():
            if lock.status == LockStatus.ACTIVE and now > lock.lock_timeout:
                expired.append({
                    "lock_id": lock.lock_id,
                    "seat_id": lock.seat_id,
                    "order_id": lock.order_id,
                    "timeout_minutes": int((now - lock.lock_timeout).total_seconds() / 60),
                    "locked_at": lock.locked_at.isoformat(),
                    "lock_timeout": lock.lock_timeout.isoformat()
                })
        return sorted(expired, key=lambda x: x["timeout_minutes"], reverse=True)
    
    def get_conflict_seats_detail(self) -> List[Dict[str, any]]:
        conflicts = []
        for seat_id, locks in self._seat_locks_by_seat.items():
            active_locks = [l for l in locks if l.status == LockStatus.ACTIVE]
            if len(active_locks) > 1:
                conflicts.append({
                    "seat_id": seat_id,
                    "active_lock_count": len(active_locks),
                    "lock_ids": [l.lock_id for l in active_locks],
                    "order_ids": [l.order_id for l in active_locks]
                })
        return conflicts
