from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

from .models import (
    CompatibilityLevel,
    EvolutionReport,
    FieldSchema,
    SchemaChange,
    SchemaChangeType,
    SchemaSnapshot,
)


class SchemaComparator:
    def __init__(
        self,
        allow_field_removal: bool = False,
        allow_type_narrowing: bool = False,
        strict_nullable: bool = True,
    ):
        self.allow_field_removal = allow_field_removal
        self.allow_type_narrowing = allow_type_narrowing
        self.strict_nullable = strict_nullable

        self._type_promotions = {
            "int8": ["int16", "int32", "int64", "float32", "float64", "string"],
            "int16": ["int32", "int64", "float32", "float64", "string"],
            "int32": ["int64", "float32", "float64", "string"],
            "int64": ["float64", "string"],
            "uint8": ["uint16", "uint32", "uint64", "float32", "float64", "string"],
            "uint16": ["uint32", "uint64", "float32", "float64", "string"],
            "uint32": ["uint64", "float64", "string"],
            "uint64": ["string"],
            "float32": ["float64", "string"],
            "float64": ["string"],
            "date32": ["date64", "timestamp[s]", "timestamp[ms]", "timestamp[us]", "timestamp[ns]", "string"],
            "date64": ["timestamp[s]", "timestamp[ms]", "timestamp[us]", "timestamp[ns]", "string"],
        }
        self._timestamp_units = ["ns", "us", "ms", "s"]

    def compare(
        self,
        old_schema: SchemaSnapshot,
        new_schema: SchemaSnapshot,
        task_name: str = "schema_evolution",
    ) -> EvolutionReport:
        changes: List[SchemaChange] = []

        old_fields = self._flatten_fields(old_schema.fields)
        new_fields = self._flatten_fields(new_schema.fields)

        old_paths = set(old_fields.keys())
        new_paths = set(new_fields.keys())

        for path in old_paths - new_paths:
            field = old_fields[path]
            changes.append(
                SchemaChange(
                    change_type=SchemaChangeType.FIELD_REMOVED,
                    field_path=path,
                    description=f"字段 '{path}' 已被移除",
                    old_value=self._field_to_string(field),
                    new_value=None,
                    severity="high",
                    compatibility_impact="breaking",
                )
            )

        for path in new_paths - old_paths:
            field = new_fields[path]
            changes.append(
                SchemaChange(
                    change_type=SchemaChangeType.FIELD_ADDED,
                    field_path=path,
                    description=f"新增字段 '{path}'",
                    old_value=None,
                    new_value=self._field_to_string(field),
                    severity="low",
                    compatibility_impact="forward_only",
                )
            )

        for path in old_paths & new_paths:
            old_field = old_fields[path]
            new_field = new_fields[path]

            changes.extend(self._compare_field(old_field, new_field))

        changes.extend(self._detect_renames(old_fields, new_fields))

        compatibility = self._determine_compatibility(changes)

        summary = self._build_summary(changes)

        recommendations = self._build_recommendations(changes, compatibility)

        return EvolutionReport(
            task_name=task_name,
            created_at=datetime.now(),
            old_schema=old_schema,
            new_schema=new_schema,
            changes=changes,
            compatibility_level=compatibility,
            summary=summary,
            recommendations=recommendations,
        )

    def _flatten_fields(
        self, fields: List[FieldSchema], prefix: str = ""
    ) -> Dict[str, FieldSchema]:
        result = {}
        for field in fields:
            path = field.path
            result[path] = field
            if field.children:
                result.update(self._flatten_fields(field.children, path))
        return result

    def _compare_field(
        self, old_field: FieldSchema, new_field: FieldSchema
    ) -> List[SchemaChange]:
        changes: List[SchemaChange] = []

        if old_field.data_type != new_field.data_type:
            if old_field.decimal_info and new_field.decimal_info:
                changes.extend(self._compare_decimal(old_field, new_field))
            else:
                changes.extend(self._compare_type(old_field, new_field))

        if self.strict_nullable and old_field.nullable != new_field.nullable:
            if old_field.nullable and not new_field.nullable:
                changes.append(
                    SchemaChange(
                        change_type=SchemaChangeType.NULLABLE_CHANGED,
                        field_path=old_field.path,
                        description=f"字段 '{old_field.path}' 从 nullable 变为 non-nullable",
                        old_value="nullable",
                        new_value="non-nullable",
                        severity="high",
                        compatibility_impact="breaking",
                    )
                )
            elif not old_field.nullable and new_field.nullable:
                changes.append(
                    SchemaChange(
                        change_type=SchemaChangeType.NULLABLE_CHANGED,
                        field_path=old_field.path,
                        description=f"字段 '{old_field.path}' 从 non-nullable 变为 nullable",
                        old_value="non-nullable",
                        new_value="nullable",
                        severity="low",
                        compatibility_impact="none",
                    )
                )

        if old_field.is_struct != new_field.is_struct:
            changes.append(
                SchemaChange(
                    change_type=SchemaChangeType.NESTED_STRUCTURE_CHANGED,
                    field_path=old_field.path,
                    description=f"字段 '{old_field.path}' 结构类型变化",
                    old_value="struct" if old_field.is_struct else "primitive",
                    new_value="struct" if new_field.is_struct else "primitive",
                    severity="high",
                    compatibility_impact="breaking",
                )
            )

        if old_field.is_list != new_field.is_list:
            changes.append(
                SchemaChange(
                    change_type=SchemaChangeType.NESTED_STRUCTURE_CHANGED,
                    field_path=old_field.path,
                    description=f"字段 '{old_field.path}' 列表类型变化",
                    old_value="list" if old_field.is_list else "non-list",
                    new_value="list" if new_field.is_list else "non-list",
                    severity="high",
                    compatibility_impact="breaking",
                )
            )

        return changes

    def _compare_decimal(
        self, old_field: FieldSchema, new_field: FieldSchema
    ) -> List[SchemaChange]:
        changes: List[SchemaChange] = []
        old_dec = old_field.decimal_info
        new_dec = new_field.decimal_info

        if old_dec is None or new_dec is None:
            return changes

        if old_dec.precision != new_dec.precision or old_dec.scale != new_dec.scale:
            is_safe = new_dec.precision >= old_dec.precision and new_dec.scale >= old_dec.scale

            changes.append(
                SchemaChange(
                    change_type=SchemaChangeType.DECIMAL_PRECISION_CHANGED,
                    field_path=old_field.path,
                    description=f"Decimal 精度从 ({old_dec.precision},{old_dec.scale}) 变为 ({new_dec.precision},{new_dec.scale})",
                    old_value=f"decimal({old_dec.precision},{old_dec.scale})",
                    new_value=f"decimal({new_dec.precision},{new_dec.scale})",
                    severity="medium" if not is_safe else "low",
                    compatibility_impact="potential_issue" if not is_safe else "none",
                )
            )

        return changes

    def _compare_type(
        self, old_field: FieldSchema, new_field: FieldSchema
    ) -> List[SchemaChange]:
        changes: List[SchemaChange] = []

        old_type = old_field.data_type
        new_type = new_field.data_type

        if old_type == new_type:
            return changes

        base_old_type = old_type.split("[")[0] if "[" in old_type else old_type
        base_new_type = new_type.split("[")[0] if "[" in new_type else new_type

        if base_old_type == "timestamp" and base_new_type == "timestamp":
            is_safe_promotion = self._is_timestamp_safe_promotion(old_type, new_type)
        else:
            is_safe_promotion = (
                base_old_type in self._type_promotions
                and new_type in self._type_promotions[base_old_type]
            ) or (
                old_type in self._type_promotions
                and new_type in self._type_promotions[old_type]
            )

        if is_safe_promotion:
            changes.append(
                SchemaChange(
                    change_type=SchemaChangeType.TYPE_CHANGED,
                    field_path=old_field.path,
                    description=f"类型安全升级: {old_type} -> {new_type}",
                    old_value=old_type,
                    new_value=new_type,
                    severity="low",
                    compatibility_impact="none",
                )
            )
        elif self.allow_type_narrowing:
            changes.append(
                SchemaChange(
                    change_type=SchemaChangeType.TYPE_CHANGED,
                    field_path=old_field.path,
                    description=f"类型变更: {old_type} -> {new_type}",
                    old_value=old_type,
                    new_value=new_type,
                    severity="medium",
                    compatibility_impact="potential_issue",
                )
            )
        else:
            changes.append(
                SchemaChange(
                    change_type=SchemaChangeType.TYPE_CHANGED,
                    field_path=old_field.path,
                    description=f"类型不兼容变更: {old_type} -> {new_type}",
                    old_value=old_type,
                    new_value=new_type,
                    severity="high",
                    compatibility_impact="breaking",
                )
            )

        return changes

    def _detect_renames(
        self,
        old_fields: Dict[str, FieldSchema],
        new_fields: Dict[str, FieldSchema],
    ) -> List[SchemaChange]:
        changes: List[SchemaChange] = []

        old_paths = set(old_fields.keys())
        new_paths = set(new_fields.keys())

        removed_paths = old_paths - new_paths
        added_paths = new_paths - old_paths

        removed_fields = {p: old_fields[p] for p in removed_paths}
        added_fields = {p: new_fields[p] for p in added_paths}

        potential_renames: List[Tuple[str, str]] = []

        for old_path, old_field in removed_fields.items():
            for new_path, new_field in added_fields.items():
                if self._is_potential_rename(old_field, new_field, old_path, new_path):
                    potential_renames.append((old_path, new_path))

        for old_path, new_path in potential_renames:
            changes.append(
                SchemaChange(
                    change_type=SchemaChangeType.FIELD_RENAMED,
                    field_path=new_path,
                    description=f"字段可能重命名: '{old_path}' -> '{new_path}'",
                    old_value=old_path,
                    new_value=new_path,
                    severity="medium",
                    compatibility_impact="potential_issue",
                )
            )

        return changes

    def _is_potential_rename(
        self,
        old_field: FieldSchema,
        new_field: FieldSchema,
        old_path: str,
        new_path: str,
    ) -> bool:
        if old_field.data_type != new_field.data_type:
            return False
        if old_field.nullable != new_field.nullable:
            return False

        old_parent = ".".join(old_path.split(".")[:-1])
        new_parent = ".".join(new_path.split(".")[:-1])
        if old_parent != new_parent:
            return False

        old_name = old_path.split(".")[-1].lower()
        new_name = new_path.split(".")[-1].lower()

        if old_name in new_name or new_name in old_name:
            return True

        if self._levenshtein_distance(old_name, new_name) <= 3:
            return True

        return False

    def _levenshtein_distance(self, s1: str, s2: str) -> int:
        if len(s1) < len(s2):
            return self._levenshtein_distance(s2, s1)
        if len(s2) == 0:
            return len(s1)

        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row

        return previous_row[-1]

    def _determine_compatibility(
        self, changes: List[SchemaChange]
    ) -> CompatibilityLevel:
        field_removals = [
            c for c in changes
            if c.change_type == SchemaChangeType.FIELD_REMOVED
        ]
        other_breaking_changes = [
            c for c in changes
            if c.compatibility_impact == "breaking"
            and c.change_type != SchemaChangeType.FIELD_REMOVED
        ]

        if other_breaking_changes:
            return CompatibilityLevel.INCOMPATIBLE

        if field_removals and not self.allow_field_removal:
            return CompatibilityLevel.INCOMPATIBLE

        forward_only = [
            c for c in changes if c.compatibility_impact == "forward_only"
        ]
        potential_issues = [
            c for c in changes if c.compatibility_impact == "potential_issue"
        ]

        if potential_issues:
            return CompatibilityLevel.BACKWARD_COMPATIBLE
        elif forward_only:
            return CompatibilityLevel.FORWARD_COMPATIBLE
        else:
            return CompatibilityLevel.FULLY_COMPATIBLE

    def _build_summary(self, changes: List[SchemaChange]) -> Dict[str, int]:
        summary: Dict[str, int] = {
            "total_changes": len(changes),
            "field_added": 0,
            "field_removed": 0,
            "field_renamed": 0,
            "type_changed": 0,
            "nullable_changed": 0,
            "decimal_precision_changed": 0,
            "nested_structure_changed": 0,
            "breaking_changes": 0,
            "high_severity": 0,
            "medium_severity": 0,
            "low_severity": 0,
        }

        for change in changes:
            summary[change.change_type.value] = (
                summary.get(change.change_type.value, 0) + 1
            )

            if change.compatibility_impact == "breaking":
                summary["breaking_changes"] += 1

            if change.severity == "high":
                summary["high_severity"] += 1
            elif change.severity == "medium":
                summary["medium_severity"] += 1
            elif change.severity == "low":
                summary["low_severity"] += 1

        return summary

    def _build_recommendations(
        self, changes: List[SchemaChange], compatibility: CompatibilityLevel
    ) -> List[str]:
        recommendations: List[str] = []

        breaking_changes = [
            c for c in changes if c.compatibility_impact == "breaking"
        ]
        if breaking_changes:
            recommendations.append(
                "⚠️  存在破坏性变更，建议在发布前进行完整的数据迁移测试"
            )
            for c in breaking_changes[:3]:
                recommendations.append(f"   - {c.description}")

        nullable_issues = [
            c
            for c in changes
            if c.change_type == SchemaChangeType.NULLABLE_CHANGED
            and c.compatibility_impact == "breaking"
        ]
        if nullable_issues:
            recommendations.append(
                "⚠️  nullable 变为 non-nullable 可能导致旧数据读取失败，"
                "建议添加默认值或确保数据中没有 NULL 值"
            )

        decimal_changes = [
            c
            for c in changes
            if c.change_type == SchemaChangeType.DECIMAL_PRECISION_CHANGED
        ]
        if decimal_changes:
            recommendations.append(
                "📊 Decimal 精度变更可能影响数值计算，建议验证数据转换后的值是否正确"
            )

        renamed_fields = [
            c for c in changes if c.change_type == SchemaChangeType.FIELD_RENAMED
        ]
        if renamed_fields:
            recommendations.append(
                "🔄 检测到可能的字段重命名，请确认是否为有意变更，"
                "并更新下游应用的字段引用"
            )

        if compatibility == CompatibilityLevel.FULLY_COMPATIBLE:
            recommendations.append(
                "✅ Schema 变更完全兼容，可以安全部署"
            )
        elif compatibility == CompatibilityLevel.BACKWARD_COMPATIBLE:
            recommendations.append(
                "⚠️  Schema 变更向后兼容，但可能存在潜在问题，建议进行测试验证"
            )
        elif compatibility == CompatibilityLevel.FORWARD_COMPATIBLE:
            recommendations.append(
                "ℹ️  Schema 变更仅向前兼容，旧版本读取器可能无法读取新字段"
            )

        return recommendations

    def _is_timestamp_safe_promotion(self, old_type: str, new_type: str) -> bool:
        def get_unit(t: str) -> str:
            if "[" in t:
                unit = t.split("[")[1].split("]")[0]
                return unit
            return "ns"

        old_unit = get_unit(old_type)
        new_unit = get_unit(new_type)

        try:
            old_idx = self._timestamp_units.index(old_unit)
            new_idx = self._timestamp_units.index(new_unit)
            return new_idx >= old_idx
        except ValueError:
            return False

    def _field_to_string(self, field: FieldSchema) -> str:
        nullable_str = "?" if field.nullable else ""
        return f"{field.path}: {field.data_type}{nullable_str}"
