from typing import Dict, List, Optional

from .base import BaseRule, RuleContext
from ..models import (
    RuleResult,
    RuleType,
    Severity,
    Objection,
    ObjectionStatus,
)


class UnhandledObjectionRule(BaseRule):
    rule_name: str = "unhandled_objection"
    rule_type: RuleType = RuleType.UNHANDLED_OBJECTION
    default_severity: Severity = Severity.HIGH

    def __init__(
        self,
        severity: Severity = Severity.HIGH,
        check_pending: bool = True,
        check_raised_without_ruling: bool = True,
    ):
        super().__init__(severity)
        self.check_pending = check_pending
        self.check_raised_without_ruling = check_raised_without_ruling

    def check(self, context: RuleContext) -> List[RuleResult]:
        self.results = []

        if not context.objections:
            return self.results

        for objection in context.objections:
            self._check_single_objection(objection)

        self._check_cross_reference_consistency(context)

        return self.results

    def _check_single_objection(self, objection: Objection) -> None:
        if self.check_pending and objection.status == ObjectionStatus.PENDING:
            message = (
                f"异议 [{objection.objection_id}] (证据 [{objection.evidence_number}]) "
                f"状态为待处理 (pending)，需要裁决"
            )
            suggestion = (
                f"请及时处理异议 [{objection.objection_id}]，"
                f"类型: {objection.objection_type.value}，"
                f"由 {objection.raised_by} 提出"
            )

            self.add_result(
                message=message,
                evidence_number=objection.evidence_number,
                source_files=[objection.source_file] if objection.source_file else None,
                context={
                    "objection_id": objection.objection_id,
                    "objection_type": objection.objection_type.value,
                    "status": objection.status.value,
                    "raised_by": objection.raised_by,
                    "raised_at": objection.raised_at.isoformat() if objection.raised_at else None,
                    "description": objection.description,
                },
                suggestion=suggestion,
                severity=Severity.CRITICAL,
            )

        if self.check_raised_without_ruling:
            if objection.status == ObjectionStatus.RAISED and not objection.ruling:
                message = (
                    f"异议 [{objection.objection_id}] (证据 [{objection.evidence_number}]) "
                    f"已提出但没有裁决记录"
                )
                suggestion = (
                    f"请补充异议 [{objection.objection_id}] 的裁决结果，"
                    f"类型: {objection.objection_type.value}"
                )

                self.add_result(
                    message=message,
                    evidence_number=objection.evidence_number,
                    source_files=[objection.source_file] if objection.source_file else None,
                    context={
                        "objection_id": objection.objection_id,
                        "objection_type": objection.objection_type.value,
                        "status": objection.status.value,
                        "raised_by": objection.raised_by,
                        "raised_at": objection.raised_at.isoformat() if objection.raised_at else None,
                        "description": objection.description,
                        "has_ruling": bool(objection.ruling),
                    },
                    suggestion=suggestion,
                )

        if objection.requires_attention:
            message = (
                f"异议 [{objection.objection_id}] (证据 [{objection.evidence_number}]) "
                f"需要关注，尚未完全处理"
            )
            suggestion = (
                f"请检查异议 [{objection.objection_id}] 的处理状态，"
                f"当前状态: {objection.status.value}"
            )

            self.add_result(
                message=message,
                evidence_number=objection.evidence_number,
                source_files=[objection.source_file] if objection.source_file else None,
                context={
                    "objection_id": objection.objection_id,
                    "status": objection.status.value,
                    "is_resolved": objection.is_resolved,
                    "requires_attention": objection.requires_attention,
                },
                suggestion=suggestion,
            )

    def _check_cross_reference_consistency(self, context: RuleContext) -> None:
        for objection in context.objections:
            if objection.cross_references:
                referenced_objections = [
                    o for o in context.objections
                    if o.objection_id in objection.cross_references
                ]

                for ref_id in objection.cross_references:
                    if not any(o.objection_id == ref_id for o in context.objections):
                        message = (
                            f"异议 [{objection.objection_id}] 引用了不存在的异议 [{ref_id}]"
                        )
                        suggestion = (
                            f"请检查异议 [{objection.objection_id}] 的交叉引用是否正确"
                        )

                        self.add_result(
                            message=message,
                            evidence_number=objection.evidence_number,
                            source_files=[objection.source_file] if objection.source_file else None,
                            context={
                                "objection_id": objection.objection_id,
                                "missing_reference": ref_id,
                                "cross_references": objection.cross_references,
                            },
                            suggestion=suggestion,
                            severity=Severity.MEDIUM,
                        )

    def get_unhandled_summary(self, context: RuleContext) -> Dict:
        if not context.objections:
            return {
                "total": 0,
                "pending": 0,
                "raised_without_ruling": 0,
                "requires_attention": 0,
                "by_type": {},
            }

        summary = {
            "total": len(context.objections),
            "pending": 0,
            "raised_without_ruling": 0,
            "requires_attention": 0,
            "by_type": {},
        }

        for objection in context.objections:
            obj_type = objection.objection_type.value
            summary["by_type"][obj_type] = summary["by_type"].get(obj_type, 0) + 1

            if objection.status == ObjectionStatus.PENDING:
                summary["pending"] += 1

            if objection.status == ObjectionStatus.RAISED and not objection.ruling:
                summary["raised_without_ruling"] += 1

            if objection.requires_attention:
                summary["requires_attention"] += 1

        return summary
