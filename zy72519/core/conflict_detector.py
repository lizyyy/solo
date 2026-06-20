from datetime import datetime
from typing import List, Dict
import logging

from models import (
    WorkOrder,
    DesensitizationRemark,
    ConflictSample,
    ConflictType,
    ConflictStatus,
    ConflictEvidence,
    HistoryRecord,
    OperationType,
)
from utils import LinkChecker, generate_id

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ConflictDetector:
    def __init__(self, link_checker: LinkChecker = None):
        self.link_checker = link_checker or LinkChecker()
        self.conflicts: Dict[str, ConflictSample] = {}
        self.history: List[HistoryRecord] = []

    def detect_all(self, work_orders: Dict[str, WorkOrder], remarks: Dict[str, DesensitizationRemark]) -> List[ConflictSample]:
        logger.info("Starting conflict detection...")
        detected = []

        for work_order in work_orders.values():
            order_remarks = [r for r in remarks.values() if r.work_order_id == work_order.id]

            conflicts = self._detect_for_order(work_order, order_remarks)
            for conflict in conflicts:
                if conflict.id not in self.conflicts:
                    self.conflicts[conflict.id] = conflict
                    self.history.append(HistoryRecord(
                        id=generate_id("HIS"),
                        operation_type=OperationType.DETECT_CONFLICT,
                        operator="system",
                        operate_time=datetime.now(),
                        target_id=conflict.id,
                        target_type="conflict_sample",
                        after_state=conflict.to_dict(),
                        notes=f"检测到冲突: {conflict.conflict_type.value}",
                    ))
                    detected.append(conflict)

        logger.info(f"Detected {len(detected)} new conflicts")
        return detected

    def _detect_for_order(self, work_order: WorkOrder, remarks: List[DesensitizationRemark]) -> List[ConflictSample]:
        conflicts = []

        category_conflict = self._detect_category_mismatch(work_order, remarks)
        if category_conflict:
            conflicts.append(category_conflict)

        desensitization_conflict = self._detect_desensitization_conflict(work_order, remarks)
        if desensitization_conflict:
            conflicts.append(desensitization_conflict)

        link_conflict = self._detect_link_404_passed(work_order)
        if link_conflict:
            conflicts.append(link_conflict)

        return conflicts

    def _detect_category_mismatch(self, work_order: WorkOrder, remarks: List[DesensitizationRemark]) -> ConflictSample:
        for remark in remarks:
            if "分类不符" in remark.remark_content or "分类错误" in remark.remark_content:
                evidence = ConflictEvidence(
                    type="category_mismatch",
                    description=f"工单分类 '{work_order.category}' 与脱敏规则备注冲突",
                    source="desensitization_remark",
                    details={
                        "work_order_category": work_order.category,
                        "remark_id": remark.id,
                        "remark_content": remark.remark_content,
                        "remark_owner": remark.owner,
                    },
                )
                return ConflictSample(
                    id=generate_id("CONF"),
                    work_order_id=work_order.id,
                    conflict_type=ConflictType.CATEGORY_MISMATCH,
                    status=ConflictStatus.PENDING_CONFIRM,
                    evidence=[evidence],
                )
        return None

    def _detect_desensitization_conflict(self, work_order: WorkOrder, remarks: List[DesensitizationRemark]) -> ConflictSample:
        for remark in remarks:
            if remark.is_important:
                if "不公开" in remark.remark_content or "敏感" in remark.remark_content or "需注意" in remark.remark_content:
                    if work_order.status.value in ("classified", "resolved"):
                        evidence = ConflictEvidence(
                            type="desensitization_conflict",
                            description="重要脱敏规则备注与工单状态冲突：备注要求谨慎处理，但工单已被标记为完成",
                            source="desensitization_remark",
                            details={
                                "work_order_status": work_order.status.value,
                                "remark_id": remark.id,
                                "remark_content": remark.remark_content,
                                "remark_is_important": remark.is_important,
                                "remark_owner": remark.owner,
                            },
                        )
                        return ConflictSample(
                            id=generate_id("CONF"),
                            work_order_id=work_order.id,
                            conflict_type=ConflictType.DESENSITIZATION_CONFLICT,
                            status=ConflictStatus.PENDING_CONFIRM,
                            evidence=[evidence],
                        )
        return None

    def _detect_link_404_passed(self, work_order: WorkOrder) -> ConflictSample:
        if not work_order.reference_links:
            return None

        broken_links = []
        for link in work_order.reference_links:
            is_valid, status_code, reason = self.link_checker.check_link(link)
            if not is_valid:
                broken_links.append({
                    "url": link,
                    "status_code": status_code,
                    "reason": reason,
                })

        if broken_links and work_order.status.value in ("classified", "resolved"):
            evidence = ConflictEvidence(
                type="link_404_passed",
                description=f"工单引用了 {len(broken_links)} 个无效链接，但工单已被标记为完成",
                source="link_check",
                details={
                    "broken_links": broken_links,
                    "work_order_status": work_order.status.value,
                },
            )
            conflict = ConflictSample(
                id=generate_id("CONF"),
                work_order_id=work_order.id,
                conflict_type=ConflictType.LINK_404_PASSED,
                status=ConflictStatus.NEED_PRODUCT_REVIEW,
                evidence=[evidence],
                handler="产品经理复核",
                handle_notes=f"引用链接404但工单状态为{work_order.status.value}，转产品经理复核",
            )
            return conflict
        return None

    def get_conflicts_by_work_order(self, work_order_id: str) -> List[ConflictSample]:
        return [c for c in self.conflicts.values() if c.work_order_id == work_order_id]

    def get_conflicts_by_status(self, status: ConflictStatus) -> List[ConflictSample]:
        return [c for c in self.conflicts.values() if c.status == status]
