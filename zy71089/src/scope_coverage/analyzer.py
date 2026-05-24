from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from .models import (
    APIEndpoint,
    AnalysisResult,
    CallLogEntry,
    CoverageGap,
    DocFragment,
    SDKExample,
    Scope,
    ScopeMapping,
    Severity,
    SourceLocation,
)
from .parsers import (
    APIListParser,
    CallLogParser,
    DocFragmentParser,
    SDKExampleParser,
    ScopeTableParser,
)


class ScopeResolver:
    def __init__(self, scopes: List[Scope]):
        self._canonical_map: Dict[str, str] = {}
        self._scope_mappings: Dict[str, ScopeMapping] = {}
        self._resolved_scopes: Dict[str, Scope] = {}
        self._build_mappings(scopes)

    def _build_mappings(self, scopes: List[Scope]) -> None:
        for scope in scopes:
            mapping = ScopeMapping(
                canonical_name=scope.name,
                aliases=set(scope.aliases),
                included_scopes=set(scope.includes),
            )
            self._scope_mappings[scope.name] = mapping
            self._resolved_scopes[scope.name] = scope

            self._canonical_map[scope.name] = scope.name
            for alias in scope.aliases:
                self._canonical_map[alias] = scope.name

        self._expand_includes()

    def _expand_includes(self) -> None:
        for _ in range(len(self._scope_mappings)):
            updated = False
            for name, mapping in self._scope_mappings.items():
                new_includes = set()
                for inc in mapping.included_scopes:
                    canonical = self._canonical_map.get(inc, inc)
                    new_includes.add(canonical)
                    if canonical in self._scope_mappings:
                        new_includes.update(self._scope_mappings[canonical].included_scopes)
                if new_includes != mapping.included_scopes:
                    mapping.included_scopes = new_includes
                    updated = True
            if not updated:
                break

    def resolve(self, scope_name: str) -> Optional[str]:
        return self._canonical_map.get(scope_name)

    def get_all_equivalent(self, scope_name: str) -> Set[str]:
        canonical = self.resolve(scope_name)
        if not canonical:
            return {scope_name}

        result = {canonical}
        mapping = self._scope_mappings.get(canonical)
        if mapping:
            result.update(mapping.aliases)
            result.update(mapping.included_scopes)
        return result

    def covers(self, required: str, actual: str) -> bool:
        req_canonical = self.resolve(required)
        actual_canonical = self.resolve(actual)

        if req_canonical == actual_canonical:
            return True

        if actual_canonical and actual_canonical in self._scope_mappings:
            mapping = self._scope_mappings[actual_canonical]
            return req_canonical in mapping.included_scopes

        return False

    def has_any_coverage(self, required_scopes: List[str], actual_scopes: List[str]) -> bool:
        for required in required_scopes:
            for actual in actual_scopes:
                if self.covers(required, actual):
                    return True
        return False

    def get_missing_scopes(self, required_scopes: List[str], actual_scopes: List[str]) -> List[str]:
        missing = []
        for required in required_scopes:
            covered = False
            for actual in actual_scopes:
                if self.covers(required, actual):
                    covered = True
                    break
            if not covered:
                missing.append(required)
        return missing

    def get_extra_scopes(self, required_scopes: List[str], actual_scopes: List[str]) -> List[str]:
        extra = []
        required_set = {self.resolve(s) for s in required_scopes}
        for actual in actual_scopes:
            actual_canonical = self.resolve(actual)
            is_needed = False
            for req in required_scopes:
                if self.covers(req, actual):
                    is_needed = True
                    break
            if not is_needed and actual_canonical not in required_set:
                extra.append(actual)
        return extra

    @property
    def mappings(self) -> Dict[str, ScopeMapping]:
        return self._scope_mappings

    @property
    def resolved_scopes(self) -> Dict[str, Scope]:
        return self._resolved_scopes


class CoverageAnalyzer:
    def __init__(self):
        self.result = AnalysisResult()

    def load_scope_table(self, file_path: Path) -> "CoverageAnalyzer":
        parser = ScopeTableParser(file_path)
        scopes, issues = parser.parse()
        self.result.parse_issues.extend(issues)

        resolver = ScopeResolver(scopes)
        self.result.resolved_scopes = resolver.resolved_scopes
        self.result.scope_mappings = resolver.mappings
        self._resolver = resolver
        return self

    def load_api_list(self, file_path: Path) -> "CoverageAnalyzer":
        parser = APIListParser(file_path)
        apis, issues = parser.parse()
        self.result.apis.extend(apis)
        self.result.parse_issues.extend(issues)
        return self

    def load_sdk_examples(self, file_path: Path) -> "CoverageAnalyzer":
        parser = SDKExampleParser(file_path)
        examples, issues = parser.parse()
        self.result.sdk_examples.extend(examples)
        self.result.parse_issues.extend(issues)
        return self

    def load_doc_fragments(self, file_path: Path) -> "CoverageAnalyzer":
        parser = DocFragmentParser(file_path)
        fragments, issues = parser.parse()
        self.result.doc_fragments.extend(fragments)
        self.result.parse_issues.extend(issues)
        return self

    def load_call_logs(self, file_path: Path) -> "CoverageAnalyzer":
        parser = CallLogParser(file_path)
        logs, issues = parser.parse()
        self.result.call_logs.extend(logs)
        self.result.parse_issues.extend(issues)
        return self

    def analyze(self) -> AnalysisResult:
        if not hasattr(self, "_resolver"):
            self._resolver = ScopeResolver([])

        self._check_scope_integrity()
        self._check_sdk_coverage()
        self._check_doc_coverage()
        self._check_call_log_coverage()
        self._add_metadata()

        return self.result

    def _check_scope_integrity(self) -> None:
        all_scopes = set(self.result.resolved_scopes.keys())

        for api in self.result.apis:
            for scope in api.required_scopes:
                if not self._resolver.resolve(scope) and scope not in all_scopes:
                    pass

    def _check_sdk_coverage(self) -> None:
        api_map = {api.key(): api for api in self.result.apis}

        for example in self.result.sdk_examples:
            api_key = f"{example.api_method} {example.api_path}"

            if api_key not in api_map:
                continue

            api = api_map[api_key]
            missing = self._resolver.get_missing_scopes(api.required_scopes, example.used_scopes)
            extra = self._resolver.get_extra_scopes(api.required_scopes, example.used_scopes)

            if missing or extra:
                gap = CoverageGap(
                    gap_type="sdk_mismatch",
                    severity=Severity.ERROR if missing else Severity.WARNING,
                    api_key=api_key,
                    expected_scopes=api.required_scopes,
                    actual_scopes=example.used_scopes,
                    missing_scopes=missing,
                    extra_scopes=extra,
                    source=f"SDK Example: {example.name} ({example.language})",
                    source_location=example.location,
                    explanation=self._explain_gap(api, example, missing, extra),
                )
                self.result.sdk_coverage_gaps.append(gap)

    def _check_doc_coverage(self) -> None:
        api_map = {api.key(): api for api in self.result.apis}

        for fragment in self.result.doc_fragments:
            for api_key in fragment.mentioned_apis:
                if api_key not in api_map:
                    continue

                api = api_map[api_key]
                mentioned = fragment.mentioned_scopes
                missing = self._resolver.get_missing_scopes(api.required_scopes, mentioned)

                if missing:
                    gap = CoverageGap(
                        gap_type="doc_missing",
                        severity=Severity.WARNING,
                        api_key=api_key,
                        expected_scopes=api.required_scopes,
                        actual_scopes=mentioned,
                        missing_scopes=missing,
                        source=f"Documentation: {fragment.title}",
                        source_location=fragment.location,
                        explanation=f"文档 '{fragment.title}' 中提到了 API {api_key}，但未提及必需的 scope: {', '.join(missing)}",
                    )
                    self.result.doc_coverage_gaps.append(gap)

    def _check_call_log_coverage(self) -> None:
        api_map = {api.key(): api for api in self.result.apis}

        for log in self.result.call_logs:
            api_key = f"{log.method} {log.path}"

            if api_key not in api_map:
                continue

            api = api_map[api_key]
            missing = self._resolver.get_missing_scopes(api.required_scopes, log.used_scopes)

            if missing and not log.success:
                gap = CoverageGap(
                    gap_type="call_failure",
                    severity=Severity.INFO,
                    api_key=api_key,
                    expected_scopes=api.required_scopes,
                    actual_scopes=log.used_scopes,
                    missing_scopes=missing,
                    source=f"Call Log (client: {log.client_id or 'unknown'})",
                    source_location=log.location,
                    explanation=f"调用失败可能因 scope 不足。需要: {', '.join(api.required_scopes)}, 实际: {', '.join(log.used_scopes) or 'none'}",
                )
                self.result.scope_coverage_gaps.append(gap)

    def _explain_gap(
        self,
        api: APIEndpoint,
        example: SDKExample,
        missing: List[str],
        extra: List[str],
    ) -> str:
        parts = []
        if missing:
            parts.append(
                f"示例缺少必需权限。API '{api.key()}' 需要 scope: {', '.join(api.required_scopes)}; "
                f"示例仅声明了: {', '.join(example.used_scopes) or 'none'}; "
                f"缺少: {', '.join(missing)}"
            )
        if extra:
            parts.append(
                f"示例声明了多余的权限: {', '.join(extra)}。"
                f"这些权限对调用 API '{api.key()}' 不是必需的"
            )
        return " ".join(parts)

    def _add_metadata(self) -> None:
        self.result.metadata.update(
            {
                "total_apis": len(self.result.apis),
                "total_scopes": len(self.result.resolved_scopes),
                "total_sdk_examples": len(self.result.sdk_examples),
                "total_doc_fragments": len(self.result.doc_fragments),
                "total_call_logs": len(self.result.call_logs),
                "sdk_gaps_count": len(self.result.sdk_coverage_gaps),
                "doc_gaps_count": len(self.result.doc_coverage_gaps),
                "scope_gaps_count": len(self.result.scope_coverage_gaps),
                "parse_errors_count": sum(
                    1 for i in self.result.parse_issues if i.severity in (Severity.ERROR, Severity.CRITICAL)
                ),
                "parse_warnings_count": sum(
                    1 for i in self.result.parse_issues if i.severity == Severity.WARNING
                ),
            }
        )
