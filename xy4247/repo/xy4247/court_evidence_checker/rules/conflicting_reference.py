from collections import defaultdict
from typing import Dict, List, Set, Tuple

from .base import BaseRule, RuleContext
from ..models import (
    RuleResult,
    RuleType,
    Severity,
    Reference,
    ReferenceType,
)


class DuplicateReferenceRule(BaseRule):
    rule_name: str = "duplicate_reference"
    rule_type: RuleType = RuleType.DUPLICATE_REFERENCE
    default_severity: Severity = Severity.MEDIUM

    def __init__(
        self,
        severity: Severity = Severity.MEDIUM,
        min_duplicates: int = 2,
    ):
        super().__init__(severity)
        self.min_duplicates = min_duplicates

    def check(self, context: RuleContext) -> List[RuleResult]:
        self.results = []

        if not context.references:
            return self.results

        by_evidence: Dict[str, List[Reference]] = defaultdict(list)
        for ref in context.references:
            by_evidence[ref.evidence_number].append(ref)

        for ev_num, refs in by_evidence.items():
            if len(refs) >= self.min_duplicates:
                by_source_type: Dict[ReferenceType, List[Reference]] = defaultdict(list)
                for ref in refs:
                    by_source_type[ref.reference_type].append(ref)

                for ref_type, type_refs in by_source_type.items():
                    if len(type_refs) > 1:
                        source_files = list({r.source_file for r in type_refs})
                        line_numbers = [r.line_number for r in type_refs if r.line_number]

                        message = (
                            f"证据 [{ev_num}] 在同一来源类型 [{ref_type.value}] 中被多次引用 "
                            f"(共 {len(type_refs)} 次)"
                        )
                        suggestion = (
                            f"请检查证据 [{ev_num}] 的引用是否有重复或冗余，"
                            f"涉及文件: {', '.join(source_files)}"
                        )

                        self.add_result(
                            message=message,
                            evidence_number=ev_num,
                            source_files=source_files,
                            line_numbers=line_numbers if line_numbers else None,
                            context={
                                "reference_type": ref_type.value,
                                "reference_count": len(type_refs),
                                "references": [
                                    {
                                        "source_file": r.source_file,
                                        "line_number": r.line_number,
                                        "context": r.source_context[:100] if r.source_context else "",
                                    }
                                    for r in type_refs
                                ],
                            },
                            suggestion=suggestion,
                        )

        return self.results


class ConflictingReferenceRule(BaseRule):
    rule_name: str = "conflicting_reference"
    rule_type: RuleType = RuleType.CONFLICTING_REFERENCE
    default_severity: Severity = Severity.HIGH

    def __init__(
        self,
        severity: Severity = Severity.HIGH,
        alias_mapping: Dict[str, Set[str]] = None,
    ):
        super().__init__(severity)
        self.alias_mapping = alias_mapping or {}

    def check(self, context: RuleContext) -> List[RuleResult]:
        self.results = []

        if not context.references:
            return self.results

        self._build_alias_mapping(context)
        self._check_inconsistent_aliases(context)
        self._check_conflicting_descriptions(context)
        self._check_unknown_references(context)

        return self.results

    def _build_alias_mapping(self, context: RuleContext) -> None:
        if context.evidence_catalog:
            for ev_num in context.evidence_catalog.get_all_evidence_numbers():
                evidence = context.evidence_catalog.get_evidence(ev_num)
                if evidence:
                    if ev_num not in self.alias_mapping:
                        self.alias_mapping[ev_num] = set()
                    for alias in evidence.aliases:
                        self.alias_mapping[ev_num].add(alias)
                        if alias not in self.alias_mapping:
                            self.alias_mapping[alias] = set()
                        self.alias_mapping[alias].add(ev_num)

    def _check_inconsistent_aliases(self, context: RuleContext) -> None:
        referenced_numbers = {r.evidence_number for r in context.references}

        for alias, canonical_nums in self.alias_mapping.items():
            if len(canonical_nums) > 1:
                message = (
                    f"别名 [{alias}] 对应多个证据编号: {', '.join(canonical_nums)}"
                )
                suggestion = (
                    f"请统一别名 [{alias}] 的使用，确认它应该指向哪个证据编号"
                )

                self.add_result(
                    message=message,
                    evidence_number=alias,
                    context={
                        "conflicting_evidence_numbers": list(canonical_nums),
                    },
                    suggestion=suggestion,
                    severity=Severity.CRITICAL,
                )

    def _check_conflicting_descriptions(self, context: RuleContext) -> None:
        by_evidence: Dict[str, List[Reference]] = defaultdict(list)
        for ref in context.references:
            if ref.description:
                by_evidence[ref.evidence_number].append(ref)

        for ev_num, refs in by_evidence.items():
            if len(refs) < 2:
                continue

            descriptions = [r.description.strip() for r in refs if r.description]
            unique_descriptions = set(descriptions)

            if len(unique_descriptions) > 1:
                source_files = list({r.source_file for r in refs})

                message = (
                    f"证据 [{ev_num}] 在不同文件中有不同的描述: {len(unique_descriptions)} 种不同描述"
                )
                suggestion = (
                    f"请统一证据 [{ev_num}] 的描述，涉及文件: {', '.join(source_files)}"
                )

                self.add_result(
                    message=message,
                    evidence_number=ev_num,
                    source_files=source_files,
                    context={
                        "descriptions": [
                            {
                                "description": d[:200] + "..." if len(d) > 200 else d,
                                "source": refs[i].source_file if i < len(refs) else "unknown",
                            }
                            for i, d in enumerate(unique_descriptions)
                        ],
                    },
                    suggestion=suggestion,
                )

    def _check_unknown_references(self, context: RuleContext) -> None:
        if not context.evidence_catalog:
            return

        known_evidences = set(context.evidence_catalog.get_all_evidence_numbers())
        known_aliases = set()
        for ev_num in known_evidences:
            evidence = context.evidence_catalog.get_evidence(ev_num)
            if evidence:
                known_aliases.update(evidence.aliases)

        all_known = known_evidences | known_aliases

        referenced_numbers = {r.evidence_number for r in context.references}

        for ref_num in referenced_numbers:
            if ref_num not in all_known:
                refs = [r for r in context.references if r.evidence_number == ref_num]
                source_files = list({r.source_file for r in refs})

                message = f"引用的证据编号 [{ref_num}] 未在证据目录中找到"
                suggestion = (
                    f"请检查证据编号 [{ref_num}] 是否正确，或者是否需要添加到证据目录中"
                )

                self.add_result(
                    message=message,
                    evidence_number=ref_num,
                    source_files=source_files,
                    context={
                        "references": [
                            {
                                "source_file": r.source_file,
                                "line_number": r.line_number,
                                "context": r.source_context[:100] if r.source_context else "",
                            }
                            for r in refs
                        ],
                    },
                    suggestion=suggestion,
                    severity=Severity.CRITICAL,
                )
