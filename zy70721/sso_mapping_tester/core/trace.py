from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from pathlib import Path
from ..models.user import IdentitySourceUser, TestUser
from ..models.mapping import MappingRule
from ..models.role import RoleResult
from ..models.correction import CorrectionRecord


@dataclass
class SourceLocation:
    file_path: str
    line_number: int
    column: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "file_name": Path(self.file_path).name,
            "line_number": self.line_number,
            "column": self.column,
        }


@dataclass
class TraceNode:
    node_type: str
    value: Any
    source: SourceLocation
    children: List["TraceNode"]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "node_type": self.node_type,
            "value": self.value,
            "source": self.source.to_dict(),
            "children": [c.to_dict() for c in self.children],
        }


class SourceTracer:
    def trace_user_source(self, user: IdentitySourceUser, field_name: str) -> TraceNode:
        return TraceNode(
            node_type="identity_source",
            value=user.get(field_name),
            source=SourceLocation(
                file_path=user.source_file,
                line_number=user.line_number,
            ),
            children=[],
        )

    def trace_mapping_rule(self, rule: MappingRule, source_user: IdentitySourceUser) -> TraceNode:
        source_node = self.trace_user_source(source_user, rule.source_field)
        mapping_node = TraceNode(
            node_type="mapping_rule",
            value=rule.target_field,
            source=SourceLocation(
                file_path=rule.source_file,
                line_number=rule.line_number,
            ),
            children=[source_node],
        )
        return mapping_node

    def trace_test_user_expected(self, test_user: TestUser, field_name: str) -> TraceNode:
        return TraceNode(
            node_type="test_expected",
            value=test_user.get_expected(field_name),
            source=SourceLocation(
                file_path=test_user.source_file,
                line_number=test_user.line_number,
            ),
            children=[],
        )

    def trace_role_result(self, role_result: RoleResult, role_name: str) -> TraceNode:
        return TraceNode(
            node_type="role_result",
            value=role_name,
            source=SourceLocation(
                file_path=role_result.source_file,
                line_number=role_result.line_number,
            ),
            children=[],
        )

    def trace_correction(self, correction: CorrectionRecord) -> TraceNode:
        return TraceNode(
            node_type="correction",
            value=f"{correction.old_value} -> {correction.new_value}",
            source=SourceLocation(
                file_path=correction.source_file,
                line_number=correction.line_number,
            ),
            children=[],
        )

    def build_full_trace(
        self,
        field_name: str,
        source_user: IdentitySourceUser,
        mapping_rule: Optional[MappingRule] = None,
        test_user: Optional[TestUser] = None,
        role_result: Optional[RoleResult] = None,
        correction: Optional[CorrectionRecord] = None,
    ) -> TraceNode:
        children = []

        if mapping_rule:
            mapping_trace = self.trace_mapping_rule(mapping_rule, source_user)
            children.append(mapping_trace)

        if test_user:
            test_trace = self.trace_test_user_expected(test_user, field_name)
            children.append(test_trace)

        if role_result:
            role_trace = self.trace_role_result(role_result, field_name)
            children.append(role_trace)

        if correction:
            corr_trace = self.trace_correction(correction)
            children.append(corr_trace)

        if not children:
            source_trace = self.trace_user_source(source_user, field_name)
            children.append(source_trace)

        return TraceNode(
            node_type="full_trace",
            value=field_name,
            source=SourceLocation(
                file_path=source_user.source_file,
                line_number=source_user.line_number,
            ),
            children=children,
        )
