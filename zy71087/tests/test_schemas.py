from __future__ import annotations

import pytest
from datetime import datetime
from pathlib import Path

from parquet_schema_evolution.models import (
    CompatibilityLevel,
    DecimalInfo,
    FieldSchema,
    SchemaChange,
    SchemaChangeType,
    SchemaSnapshot,
)
from parquet_schema_evolution.schema_reader import SchemaReader
from parquet_schema_evolution.comparator import SchemaComparator
from parquet_schema_evolution.reporter import ReportGenerator


def test_field_schema_to_dict():
    field = FieldSchema(
        name="test_field",
        path="test_field",
        data_type="int64",
        nullable=True,
    )
    result = field.to_dict()
    assert result["name"] == "test_field"
    assert result["data_type"] == "int64"
    assert result["nullable"] is True


def test_decimal_info():
    decimal = DecimalInfo(precision=18, scale=4)
    assert decimal.precision == 18
    assert decimal.scale == 4


def test_schema_snapshot_to_dict():
    field = FieldSchema(
        name="id",
        path="id",
        data_type="int64",
        nullable=False,
    )
    snapshot = SchemaSnapshot(
        source="test.parquet",
        created_at=datetime.now(),
        fields=[field],
        row_count=100,
    )
    result = snapshot.to_dict()
    assert result["source"] == "test.parquet"
    assert len(result["fields"]) == 1


def test_schema_change_type_enum():
    assert SchemaChangeType.FIELD_ADDED == "field_added"
    assert SchemaChangeType.TYPE_CHANGED == "type_changed"
    assert SchemaChangeType.NULLABLE_CHANGED == "nullable_changed"


def test_compatibility_level_enum():
    assert CompatibilityLevel.FULLY_COMPATIBLE == "fully_compatible"
    assert CompatibilityLevel.INCOMPATIBLE == "incompatible"


def test_schema_comparator_safe_type_promotion():
    comparator = SchemaComparator()

    old_field = FieldSchema(
        name="value",
        path="value",
        data_type="int32",
        nullable=True,
    )
    new_field = FieldSchema(
        name="value",
        path="value",
        data_type="int64",
        nullable=True,
    )

    changes = comparator._compare_field(old_field, new_field)
    assert len(changes) == 1
    assert changes[0].change_type == SchemaChangeType.TYPE_CHANGED
    assert changes[0].compatibility_impact == "none"


def test_schema_comparator_unsafe_type_change():
    comparator = SchemaComparator()

    old_field = FieldSchema(
        name="value",
        path="value",
        data_type="int64",
        nullable=True,
    )
    new_field = FieldSchema(
        name="value",
        path="value",
        data_type="int32",
        nullable=True,
    )

    changes = comparator._compare_field(old_field, new_field)
    assert len(changes) == 1
    assert changes[0].change_type == SchemaChangeType.TYPE_CHANGED
    assert changes[0].compatibility_impact == "breaking"


def test_schema_comparator_nullable_change_breaking():
    comparator = SchemaComparator(strict_nullable=True)

    old_field = FieldSchema(
        name="value",
        path="value",
        data_type="int64",
        nullable=True,
    )
    new_field = FieldSchema(
        name="value",
        path="value",
        data_type="int64",
        nullable=False,
    )

    changes = comparator._compare_field(old_field, new_field)
    assert len(changes) == 1
    assert changes[0].change_type == SchemaChangeType.NULLABLE_CHANGED
    assert changes[0].compatibility_impact == "breaking"


def test_schema_comparator_decimal_precision_safe():
    comparator = SchemaComparator()

    old_field = FieldSchema(
        name="amount",
        path="amount",
        data_type="decimal(10,2)",
        nullable=True,
        decimal_info=DecimalInfo(precision=10, scale=2),
    )
    new_field = FieldSchema(
        name="amount",
        path="amount",
        data_type="decimal(18,4)",
        nullable=True,
        decimal_info=DecimalInfo(precision=18, scale=4),
    )

    changes = comparator._compare_decimal(old_field, new_field)
    assert len(changes) == 1
    assert changes[0].change_type == SchemaChangeType.DECIMAL_PRECISION_CHANGED
    assert changes[0].compatibility_impact == "none"


def test_schema_comparator_decimal_precision_unsafe():
    comparator = SchemaComparator()

    old_field = FieldSchema(
        name="amount",
        path="amount",
        data_type="decimal(18,4)",
        nullable=True,
        decimal_info=DecimalInfo(precision=18, scale=4),
    )
    new_field = FieldSchema(
        name="amount",
        path="amount",
        data_type="decimal(10,2)",
        nullable=True,
        decimal_info=DecimalInfo(precision=10, scale=2),
    )

    changes = comparator._compare_decimal(old_field, new_field)
    assert len(changes) == 1
    assert changes[0].compatibility_impact == "potential_issue"


def test_schema_comparator_flatten_fields():
    comparator = SchemaComparator()

    child = FieldSchema(
        name="nested",
        path="parent.nested",
        data_type="string",
        nullable=True,
    )
    parent = FieldSchema(
        name="parent",
        path="parent",
        data_type="struct",
        nullable=True,
        is_struct=True,
        children=[child],
    )

    flattened = comparator._flatten_fields([parent])
    assert "parent" in flattened
    assert "parent.nested" in flattened
    assert len(flattened) == 2


def test_levenshtein_distance():
    comparator = SchemaComparator()
    assert comparator._levenshtein_distance("kitten", "sitting") == 3
    assert comparator._levenshtein_distance("name", "full_name") > 0
    assert comparator._levenshtein_distance("same", "same") == 0


def test_determine_compatibility_no_changes():
    comparator = SchemaComparator()
    compatibility = comparator._determine_compatibility([])
    assert compatibility == CompatibilityLevel.FULLY_COMPATIBLE


def test_determine_compatibility_breaking_changes():
    comparator = SchemaComparator()
    changes = [
        SchemaChange(
            change_type=SchemaChangeType.FIELD_REMOVED,
            field_path="test",
            description="",
            compatibility_impact="breaking",
        )
    ]
    compatibility = comparator._determine_compatibility(changes)
    assert compatibility == CompatibilityLevel.INCOMPATIBLE


def test_report_generator_sanitize_filename():
    reporter = ReportGenerator()
    assert reporter._sanitize_filename("Test Task 123!") == "test_task_123"
    assert reporter._sanitize_filename("schema/evolution") == "schema_evolution"


def test_compat_emoji():
    reporter = ReportGenerator()
    assert reporter._compat_emoji(CompatibilityLevel.FULLY_COMPATIBLE) == "✅"
    assert reporter._compat_emoji(CompatibilityLevel.INCOMPATIBLE) == "❌"


def test_detect_renames_basic():
    comparator = SchemaComparator()

    old_fields = {
        "user_name": FieldSchema(
            name="user_name",
            path="user_name",
            data_type="string",
            nullable=True,
        )
    }
    new_fields = {
        "username": FieldSchema(
            name="username",
            path="username",
            data_type="string",
            nullable=True,
        )
    }

    changes = comparator._detect_renames(old_fields, new_fields)
    assert len(changes) == 1
    assert changes[0].change_type == SchemaChangeType.FIELD_RENAMED
    assert changes[0].old_value == "user_name"
    assert changes[0].new_value == "username"


def test_detect_renames_nested():
    comparator = SchemaComparator()

    old_fields = {
        "user": FieldSchema(
            name="user", path="user", data_type="struct", nullable=True, is_struct=True,
        ),
        "user.first_name": FieldSchema(
            name="first_name", path="user.first_name", data_type="string", nullable=True,
        ),
    }
    new_fields = {
        "user": FieldSchema(
            name="user", path="user", data_type="struct", nullable=True, is_struct=True,
        ),
        "user.firstname": FieldSchema(
            name="firstname", path="user.firstname", data_type="string", nullable=True,
        ),
    }

    changes = comparator._detect_renames(old_fields, new_fields)
    rename_changes = [c for c in changes if c.change_type == SchemaChangeType.FIELD_RENAMED]
    assert len(rename_changes) == 1
    assert rename_changes[0].field_path == "user.firstname"


def test_determine_compatibility_field_removal_allowed():
    comparator = SchemaComparator(allow_field_removal=True)

    changes = [
        SchemaChange(
            change_type=SchemaChangeType.FIELD_REMOVED,
            field_path="old_field",
            description="",
            compatibility_impact="breaking",
        )
    ]
    compatibility = comparator._determine_compatibility(changes)
    assert compatibility == CompatibilityLevel.FULLY_COMPATIBLE


def test_determine_compatibility_field_removal_not_allowed():
    comparator = SchemaComparator(allow_field_removal=False)

    changes = [
        SchemaChange(
            change_type=SchemaChangeType.FIELD_REMOVED,
            field_path="old_field",
            description="",
            compatibility_impact="breaking",
        )
    ]
    compatibility = comparator._determine_compatibility(changes)
    assert compatibility == CompatibilityLevel.INCOMPATIBLE


def test_determine_compatibility_other_breaking_still_incompatible():
    comparator = SchemaComparator(allow_field_removal=True)

    changes = [
        SchemaChange(
            change_type=SchemaChangeType.TYPE_CHANGED,
            field_path="value",
            description="",
            compatibility_impact="breaking",
        )
    ]
    compatibility = comparator._determine_compatibility(changes)
    assert compatibility == CompatibilityLevel.INCOMPATIBLE


def test_determine_compatibility_mixed_breaking_with_removal_allowed():
    comparator = SchemaComparator(allow_field_removal=True)

    changes = [
        SchemaChange(
            change_type=SchemaChangeType.FIELD_REMOVED,
            field_path="old_field",
            description="",
            compatibility_impact="breaking",
        ),
        SchemaChange(
            change_type=SchemaChangeType.NULLABLE_CHANGED,
            field_path="value",
            description="",
            compatibility_impact="breaking",
        ),
    ]
    compatibility = comparator._determine_compatibility(changes)
    assert compatibility == CompatibilityLevel.INCOMPATIBLE
