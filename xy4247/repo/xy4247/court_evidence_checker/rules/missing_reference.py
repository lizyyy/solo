from typing import Dict, List, Set

from .base import BaseRule, RuleContext
from ..models import (
    RuleResult,
    RuleType,
    Severity,
    ReferenceType,
)


class MissingReferenceRule(BaseRule):
    rule_name: str = "missing_reference"
    rule_type: RuleType = RuleType.MISSING_REFERENCE
    default_severity: Severity = Severity.HIGH

    def __init__(
        self,
        severity: Severity = Severity.HIGH,
        required_reference_types: List[ReferenceType] = None,
    ):
        super().__init__(severity)
        self.required_reference_types = required_reference_types or [
            ReferenceType.TRANSCRIPT,
            ReferenceType.CROSS_EXAMINATION,
            ReferenceType.JUDGMENT_DRAFT,
        ]

    def check(self, context: RuleContext) -> List[RuleResult]:
        self.results = []

        if not context.evidence_catalog:
            return self.results

        evidence_numbers = set(context.evidence_catalog.get_all_evidence_numbers())

        referenced_in_transcript: Set[str] = set()
        referenced_in_cross_exam: Set[str] = set()
        referenced_in_judgment: Set[str] = set()

        for ref in context.references:
            if ref.reference_type == ReferenceType.TRANSCRIPT:
                referenced_in_transcript.add(ref.evidence_number)
            elif ref.reference_type == ReferenceType.CROSS_EXAMINATION:
                referenced_in_cross_exam.add(ref.evidence_number)
            elif ref.reference_type == ReferenceType.JUDGMENT_DRAFT:
                referenced_in_judgment.add(ref.evidence_number)

        for ev_num in evidence_numbers:
            evidence = context.evidence_catalog.get_evidence(ev_num)
            display_name = evidence.display_name if evidence else ev_num

            issues = []
            source_files = []

            if ReferenceType.TRANSCRIPT in self.required_reference_types:
                if ev_num not in referenced_in_transcript:
                    issues.append("庭审笔录中未引用")
                    transcript_refs = [
                        r for r in context.references
                        if r.reference_type == ReferenceType.TRANSCRIPT
                    ]
                    if transcript_refs:
                        source_files.append(transcript_refs[0].source_file)

            if ReferenceType.CROSS_EXAMINATION in self.required_reference_types:
                if ev_num not in referenced_in_cross_exam:
                    issues.append("举证质证记录中未引用")
                    cross_refs = [
                        r for r in context.references
                        if r.reference_type == ReferenceType.CROSS_EXAMINATION
                    ]
                    if cross_refs:
                        source_files.append(cross_refs[0].source_file)

            if ReferenceType.JUDGMENT_DRAFT in self.required_reference_types:
                if ev_num not in referenced_in_judgment:
                    issues.append("裁判要点草稿中未引用")
                    judgment_refs = [
                        r for r in context.references
                        if r.reference_type == ReferenceType.JUDGMENT_DRAFT
                    ]
                    if judgment_refs:
                        source_files.append(judgment_refs[0].source_file)

            if issues:
                message = f"证据 [{ev_num}] {display_name} 存在漏引问题: {'; '.join(issues)}"
                suggestion = f"请检查证据 [{ev_num}] 是否已在相关文档中正确引用"

                self.add_result(
                    message=message,
                    evidence_number=ev_num,
                    source_files=source_files if source_files else None,
                    context={
                        "missing_types": issues,
                        "display_name": display_name,
                    },
                    suggestion=suggestion,
                )

        return self.results
