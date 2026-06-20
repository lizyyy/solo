from dataclasses import dataclass, field
from typing import List, Optional


class ValidationIssue:
    EMPTY_COLLECTION = "empty_collection"
    MISSING_UNIT = "missing_unit"
    INVALID_FORMAT = "invalid_format"
    ZERO_VALUE = "zero_value"


@dataclass
class ValidationResult:
    is_valid: bool
    issues: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    details: dict = field(default_factory=dict)

    def has_issue(self, issue_type: str) -> bool:
        return issue_type in self.issues

    def add_issue(self, issue: str, detail: Optional[str] = None) -> None:
        self.issues.append(issue)
        self.is_valid = False
        if detail:
            if "issue_details" not in self.details:
                self.details["issue_details"] = {}
            self.details["issue_details"][issue] = detail

    def add_warning(self, warning: str, detail: Optional[str] = None) -> None:
        self.warnings.append(warning)
        if detail:
            if "warning_details" not in self.details:
                self.details["warning_details"] = {}
            self.details["warning_details"][warning] = detail


class InputValidator:
    REQUIRED_FIELDS = ["source", "target"]
    VALID_UNITS = ["米", "千米", "公里", "m", "km", "米/秒", "km/h", ""]

    @classmethod
    def validate_nodes(cls, nodes: List[str]) -> ValidationResult:
        result = ValidationResult(is_valid=True)
        if not nodes or len(nodes) == 0:
            result.add_issue(
                ValidationIssue.EMPTY_COLLECTION,
                "节点集合为空，无法进行图论路径计算"
            )
            return result
        if len(nodes) == 1:
            result.add_warning(
                "single_node",
                "只有一个节点，无法形成路径"
            )
        return result

    @classmethod
    def validate_edges(cls, edges: List[dict]) -> ValidationResult:
        result = ValidationResult(is_valid=True)

        if not edges or len(edges) == 0:
            result.add_issue(
                ValidationIssue.EMPTY_COLLECTION,
                "边集合为空，图中没有连接关系"
            )
            return result

        missing_unit_count = 0
        invalid_format_count = 0

        for i, edge in enumerate(edges):
            for field_name in cls.REQUIRED_FIELDS:
                if field_name not in edge or edge[field_name] is None or edge[field_name] == "":
                    invalid_format_count += 1
                    break

            if "unit" not in edge or edge.get("unit") is None or edge.get("unit") == "":
                missing_unit_count += 1

        if invalid_format_count > 0:
            result.add_issue(
                ValidationIssue.INVALID_FORMAT,
                f"有 {invalid_format_count} 条边格式不正确，缺少必要字段"
            )

        if missing_unit_count > 0:
            result.add_warning(
                ValidationIssue.MISSING_UNIT,
                f"有 {missing_unit_count} 条边缺少单位，将被单独拎出不参与正常统计"
            )
            result.details["missing_unit_count"] = missing_unit_count

        return result

    @classmethod
    def validate_path_input(cls, source: str, target: str, graph_data: dict) -> ValidationResult:
        result = ValidationResult(is_valid=True)

        if not source:
            result.add_issue(
                ValidationIssue.EMPTY_COLLECTION,
                "起点为空"
            )

        if not target:
            result.add_issue(
                ValidationIssue.EMPTY_COLLECTION,
                "终点为空"
            )

        nodes = graph_data.get("nodes", [])
        if not nodes:
            result.add_issue(
                ValidationIssue.EMPTY_COLLECTION,
                "图数据中没有节点"
            )
        else:
            if source and source not in nodes:
                result.add_issue(
                    "source_not_found",
                    f"起点 '{source}' 不在图节点中"
                )
            if target and target not in nodes:
                result.add_issue(
                    "target_not_found",
                    f"终点 '{target}' 不在图节点中"
                )

        return result
