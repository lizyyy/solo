from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Any
from collections import defaultdict

from ..models.base import (
    InspectionSession,
    InspectionItem,
    RectificationTask,
    Recheck,
    Deduction,
    RectificationStatus,
    RecheckResult
)
from ..utils.helpers import generate_id


@dataclass
class StoreScore:
    store_id: str
    store_name: str
    total_score: float = 0.0
    max_score: float = 0.0
    percentage: float = 0.0
    deduction_points: float = 0.0
    final_score: float = 0.0
    pass_count: int = 0
    fail_count: int = 0
    item_scores: Dict[str, float] = field(default_factory=dict)


@dataclass
class TaskStatus:
    task_id: str
    current_status: RectificationStatus
    recheck_count: int
    last_recheck_result: Optional[RecheckResult]
    has_photo_evidence: bool
    is_overdue: bool


@dataclass
class RuleResult:
    store_scores: Dict[str, StoreScore]
    task_statuses: Dict[str, TaskStatus]
    warnings: List[str]
    summary: Dict[str, Any]


class RuleEngine:
    def __init__(self):
        self.pass_threshold = 60.0
        self.max_recheck_count = 3

    def apply_rules(self, session: InspectionSession) -> RuleResult:
        store_scores = self._calculate_store_scores(session)
        task_statuses = self._evaluate_task_statuses(session)
        warnings = self._generate_warnings(session, store_scores, task_statuses)
        summary = self._generate_summary(store_scores, task_statuses, session)

        return RuleResult(
            store_scores=store_scores,
            task_statuses=task_statuses,
            warnings=warnings,
            summary=summary
        )

    def _calculate_store_scores(self, session: InspectionSession) -> Dict[str, StoreScore]:
        store_scores: Dict[str, StoreScore] = {}

        for store_id in session.stores:
            store = session.stores[store_id]
            store_scores[store_id] = StoreScore(
                store_id=store_id,
                store_name=store.store_name
            )

        for item in session.items.values():
            store_id = item.store_id
            if store_id not in store_scores:
                store_scores[store_id] = StoreScore(
                    store_id=store_id,
                    store_name=store_id
                )

            score = store_scores[store_id]
            score.total_score += item.score
            score.max_score += item.max_score
            score.item_scores[item.item_id] = item.score

            if item.is_pass:
                score.pass_count += 1
            else:
                score.fail_count += 1

        for ded in session.deductions.values():
            store_id = ded.store_id
            if store_id in store_scores:
                store_scores[store_id].deduction_points += ded.points

        for store_id in store_scores:
            score = store_scores[store_id]
            if score.max_score > 0:
                score.percentage = (score.total_score / score.max_score) * 100
            score.final_score = score.percentage - score.deduction_points

        return dict(sorted(store_scores.items()))

    def _evaluate_task_statuses(self, session: InspectionSession) -> Dict[str, TaskStatus]:
        task_statuses: Dict[str, TaskStatus] = {}

        for task_id in session.tasks:
            task = session.tasks[task_id]
            rechecks = session.get_task_rechecks(task_id)

            current_status = task.status
            last_recheck_result = None
            has_photo_evidence = len(task.photos) > 0

            if rechecks:
                sorted_rechecks = sorted(rechecks, key=lambda r: r.rechecked_at)
                last_recheck = sorted_rechecks[-1]
                last_recheck_result = last_recheck.result

                if last_recheck.result == RecheckResult.PASSED:
                    current_status = RectificationStatus.PASSED
                elif last_recheck.result == RecheckResult.REJECTED:
                    current_status = RectificationStatus.REJECTED
                elif last_recheck.result == RecheckResult.NEEDS_RECTIFICATION:
                    current_status = RectificationStatus.IN_PROGRESS

            is_overdue = datetime.now() > task.deadline and current_status not in [
                RectificationStatus.PASSED,
                RectificationStatus.REJECTED
            ]

            task_statuses[task_id] = TaskStatus(
                task_id=task_id,
                current_status=current_status,
                recheck_count=len(rechecks),
                last_recheck_result=last_recheck_result,
                has_photo_evidence=has_photo_evidence,
                is_overdue=is_overdue
            )

        return dict(sorted(task_statuses.items()))

    def _generate_warnings(
        self,
        session: InspectionSession,
        store_scores: Dict[str, StoreScore],
        task_statuses: Dict[str, TaskStatus]
    ) -> List[str]:
        warnings: List[str] = []

        for store_id, score in store_scores.items():
            if score.final_score < self.pass_threshold:
                warnings.append(
                    f"[{store_id}] {score.store_name} 最终得分 {score.final_score:.1f} 低于及格线 {self.pass_threshold}%"
                )

        for task_id, status in task_statuses.items():
            task = session.tasks.get(task_id)
            if not task:
                continue

            store = session.stores.get(task.store_id)
            store_name = store.store_name if store else task.store_id

            if status.is_overdue:
                warnings.append(
                    f"[{task_id}] {store_name} 整改任务已逾期: {task.description[:30]}..."
                )

            if not status.has_photo_evidence:
                warnings.append(
                    f"[{task_id}] {store_name} 整改任务缺少照片证据"
                )

            if status.recheck_count >= self.max_recheck_count and status.current_status != RectificationStatus.PASSED:
                warnings.append(
                    f"[{task_id}] {store_name} 复查次数已达上限({self.max_recheck_count}次)，整改仍未通过"
                )

        for item_id, item in session.items.items():
            if not item.is_pass:
                tasks = session.get_item_tasks(item_id)
                if not tasks:
                    store = session.stores.get(item.store_id)
                    store_name = store.store_name if store else item.store_id
                    warnings.append(
                        f"[{item_id}] {store_name} 不合格项未创建整改任务: {item.item_name}"
                    )

        for ded in session.deductions.values():
            if ded.points <= 0:
                warnings.append(
                    f"[{ded.deduction_id}] 扣分值异常: {ded.points}分"
                )

        return sorted(warnings)

    def _generate_summary(
        self,
        store_scores: Dict[str, StoreScore],
        task_statuses: Dict[str, TaskStatus],
        session: InspectionSession
    ) -> Dict[str, Any]:
        status_counts = defaultdict(int)
        for status in task_statuses.values():
            status_counts[status.current_status.value] += 1

        recheck_result_counts = defaultdict(int)
        for status in task_statuses.values():
            if status.last_recheck_result:
                recheck_result_counts[status.last_recheck_result.value] += 1

        total_items = len(session.items)
        total_passed = sum(1 for item in session.items.values() if item.is_pass)
        total_failed = total_items - total_passed

        overdue_count = sum(1 for s in task_statuses.values() if s.is_overdue)
        no_photo_count = sum(1 for s in task_statuses.values() if not s.has_photo_evidence)

        avg_score = 0.0
        if store_scores:
            avg_score = sum(s.final_score for s in store_scores.values()) / len(store_scores)

        return {
            "total_stores": len(store_scores),
            "average_score": round(avg_score, 2),
            "total_inspection_items": total_items,
            "passed_items": total_passed,
            "failed_items": total_failed,
            "total_tasks": len(task_statuses),
            "task_status_distribution": dict(status_counts),
            "total_rechecks": len(session.rechecks),
            "recheck_result_distribution": dict(recheck_result_counts),
            "total_deductions": len(session.deductions),
            "total_deduction_points": sum(d.points for d in session.deductions.values()),
            "overdue_tasks": overdue_count,
            "tasks_without_photo": no_photo_count,
            "parsing_errors": len(session.parsing_errors)
        }

    def get_item_traceability(self, session: InspectionSession, item_id: str) -> Dict[str, Any]:
        item = session.items.get(item_id)
        if not item:
            return {}

        tasks = session.get_item_tasks(item_id)
        rechecks: List[Recheck] = []
        for task in tasks:
            rechecks.extend(session.get_task_rechecks(task.task_id))

        deductions = session.get_item_deductions(item_id)

        return {
            "item": item,
            "tasks": tasks,
            "rechecks": sorted(rechecks, key=lambda r: r.rechecked_at),
            "deductions": deductions,
            "photos": item.photos.copy()
        }

    def get_store_summary(self, session: InspectionSession, store_id: str) -> Dict[str, Any]:
        store = session.stores.get(store_id)
        if not store:
            return {}

        items = session.get_store_items(store_id)
        deductions = session.get_store_deductions(store_id)

        tasks: List[RectificationTask] = []
        for item in items:
            tasks.extend(session.get_item_tasks(item.item_id))

        task_ids = [t.task_id for t in tasks]
        rechecks = [r for r in session.rechecks.values() if r.task_id in task_ids]

        return {
            "store": store,
            "items": items,
            "tasks": tasks,
            "rechecks": rechecks,
            "deductions": deductions,
            "item_count": len(items),
            "passed_count": sum(1 for i in items if i.is_pass),
            "task_count": len(tasks),
            "recheck_count": len(rechecks),
            "total_deduction_points": sum(d.points for d in deductions)
        }
