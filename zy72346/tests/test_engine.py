from __future__ import annotations

import json
import os
import tempfile
import pytest

from rxtj.rules import (
    AnnotationSource,
    ReviewStatus,
    DenominatorZeroPolicy,
    ConflictResolution,
    BOUNDARY_RULES,
    DENOMINATOR_ZERO_ACTIONS,
)
from rxtj.models import Annotation, ChangeRecord, ImportBatch, EvidenceSummary, CalculationResult
from rxtj.store import Store
from rxtj.engine import detect_edge_case, apply_boundary_rule, calculate_inclusion_exclusion, build_evidence
from rxtj.importer import import_annotations
from rxtj.workflow import step1_import_annotations, step2_review_sampling, step3_update_demo, get_audit_trail


@pytest.fixture
def store():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    s = Store(db_path)
    yield s
    os.unlink(db_path)


class TestEdgeCaseDetection:
    def test_denominator_empty_string(self):
        ann = Annotation(denominator_raw="", original_line_number=5)
        assert detect_edge_case(ann) == "denominator_zero_empty_string"

    def test_denominator_whitespace(self):
        ann = Annotation(denominator_raw="   ", original_line_number=5)
        assert detect_edge_case(ann) == "denominator_zero_empty_string"

    def test_denominator_zero_numeric(self):
        ann = Annotation(denominator_raw="0", original_line_number=5)
        assert detect_edge_case(ann) == "denominator_zero_numeric"

    def test_denominator_zero_float(self):
        ann = Annotation(denominator_raw="0.0", original_line_number=5)
        assert detect_edge_case(ann) == "denominator_zero_numeric"

    def test_denominator_normal(self):
        ann = Annotation(denominator_raw="100", original_line_number=5)
        assert detect_edge_case(ann) is None

    def test_denominator_nonzero(self):
        ann = Annotation(denominator_raw="50", original_line_number=5)
        assert detect_edge_case(ann) is None


class TestBoundaryRuleApplication:
    def test_empty_string_flagged_not_auto_fixed(self):
        ann = Annotation(denominator_raw="", original_line_number=3)
        result = apply_boundary_rule(ann, "denominator_zero_empty_string")
        assert result.is_edge_case is True
        assert result.status == ReviewStatus.FLAGGED
        assert result.edge_case_type == "denominator_zero_empty_string"

    def test_zero_numeric_auto_fix(self):
        ann = Annotation(denominator_raw="0", original_line_number=3)
        result = apply_boundary_rule(ann, "denominator_zero_numeric")
        assert result.is_edge_case is True
        assert result.status == ReviewStatus.PENDING


class TestIdempotentImport:
    def test_import_new(self, store):
        rows = [{"line_number": 1, "item_name": "A", "category": "优惠", "value": "0.8", "denominator": "10", "numerator": "8"}]
        result = import_annotations(store, rows, AnnotationSource.TEACHER_ANNOTATION)
        assert result.batch.new_count == 1
        assert result.batch.unchanged_count == 0

    def test_import_same_rows_no_doubling(self, store):
        rows = [{"line_number": 1, "item_name": "A", "category": "优惠", "value": "0.8", "denominator": "10", "numerator": "8"}]
        result1 = import_annotations(store, rows, AnnotationSource.TEACHER_ANNOTATION)
        assert result1.batch.new_count == 1

        result2 = import_annotations(store, rows, AnnotationSource.TEACHER_ANNOTATION)
        assert result2.batch.unchanged_count == 1
        assert result2.batch.new_count == 0

        annotations = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        assert len(annotations) == 1

    def test_import_with_change_records_diff(self, store):
        rows1 = [{"line_number": 1, "item_name": "A", "category": "优惠", "value": "0.8", "denominator": "10", "numerator": "8"}]
        import_annotations(store, rows1, AnnotationSource.TEACHER_ANNOTATION)

        rows2 = [{"line_number": 1, "item_name": "A", "category": "优惠", "value": "0.9", "denominator": "10", "numerator": "9"}]
        result2 = import_annotations(store, rows2, AnnotationSource.TEACHER_ANNOTATION)
        assert result2.batch.changed_count == 1
        assert len(result2.changes) >= 1

        ann = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)[0]
        assert ann.current_value == "0.9"

        changes = store.get_changes_for_annotation(ann.id)
        assert len(changes) >= 1
        found_value_change = any(c.field_name == "current_value" for c in changes)
        assert found_value_change

    def test_import_only_one_field_changed(self, store):
        rows1 = [{"line_number": 1, "item_name": "A", "category": "优惠", "value": "0.8", "denominator": "10", "numerator": "8"}]
        import_annotations(store, rows1, AnnotationSource.TEACHER_ANNOTATION)

        rows2 = [{"line_number": 1, "item_name": "A", "category": "优惠", "value": "0.8", "denominator": "10", "numerator": "8", "item_name": "B"}]
        result2 = import_annotations(store, rows2, AnnotationSource.TEACHER_ANNOTATION)
        assert result2.batch.changed_count == 1
        field_names = [c.field_name for c in result2.changes]
        assert "item_name" in field_names

    def test_import_edge_case_flagged(self, store):
        rows = [{"line_number": 5, "item_name": "X", "category": "优惠", "value": "", "denominator": "", "numerator": "30"}]
        result = import_annotations(store, rows, AnnotationSource.TEACHER_ANNOTATION)
        assert result.batch.flagged_count == 1
        assert len(result.flagged) == 1
        assert result.flagged[0].edge_case_type == "denominator_zero_empty_string"


class TestThreeStepWorkflow:
    def test_full_workflow_normal(self, store):
        rows = [
            {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
            {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "0.75", "denominator": "40", "numerator": "30"},
        ]

        result1, state1 = step1_import_annotations(store, rows)
        assert state1.current_step == "review_sampling"
        assert state1.annotation_count == 2
        assert state1.flagged_count == 0

        sampling_rows = [
            {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
            {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "0.75", "denominator": "40", "numerator": "30"},
        ]
        conflicts, state2 = step2_review_sampling(store, sampling_rows)
        assert state2.current_step == "update_demo"
        assert len(conflicts) == 0

        results, state3 = step3_update_demo(store)
        assert state3.current_step == "completed"
        assert len(results) == 2
        for r in results:
            assert r.value is not None
            assert r.status == ReviewStatus.PENDING

    def test_workflow_with_denominator_zero_empty_string(self, store):
        rows = [
            {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
            {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "", "denominator": "", "numerator": "30"},
        ]

        result1, state1 = step1_import_annotations(store, rows)
        assert state1.flagged_count == 1
        flagged = result1.flagged
        assert flagged[0].edge_case_type == "denominator_zero_empty_string"

        sampling_rows = [
            {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
            {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "0.5", "denominator": "60", "numerator": "30"},
        ]
        conflicts, state2 = step2_review_sampling(store, sampling_rows)

        results, state3 = step3_update_demo(store)
        flagged_results = [r for r in results if r.status == ReviewStatus.FLAGGED]
        assert len(flagged_results) == 1
        assert flagged_results[0].evidence is not None
        assert flagged_results[0].evidence.edge_case_type == "denominator_zero_empty_string"

        normal_results = [r for r in results if r.status != ReviewStatus.FLAGGED]
        assert len(normal_results) == 1
        assert normal_results[0].value is not None

    def test_workflow_with_conflict(self, store):
        rows = [
            {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
        ]
        step1_import_annotations(store, rows)

        sampling_rows = [
            {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.80", "denominator": "100", "numerator": "80"},
        ]
        conflicts, state2 = step2_review_sampling(store, sampling_rows)
        assert len(conflicts) == 1
        assert state2.flagged_count == 1

        results, state3 = step3_update_demo(store)
        flagged = [r for r in results if r.status == ReviewStatus.FLAGGED]
        assert len(flagged) == 1


class TestAuditTrail:
    def test_audit_trail_has_original_line_and_changes(self, store):
        rows1 = [{"line_number": 7, "item_name": "化学C", "category": "优惠", "value": "0.6", "denominator": "50", "numerator": "30"}]
        import_annotations(store, rows1, AnnotationSource.TEACHER_ANNOTATION)

        rows2 = [{"line_number": 7, "item_name": "化学C", "category": "优惠", "value": "0.7", "denominator": "50", "numerator": "35"}]
        import_annotations(store, rows2, AnnotationSource.TEACHER_ANNOTATION)

        ann = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)[0]
        trail = get_audit_trail(store, ann.id)

        assert trail["annotation"]["original_line_number"] == 7
        assert trail["annotation"]["original_value"] == "0.6"
        assert trail["annotation"]["current_value"] == "0.7"
        assert trail["change_count"] >= 1
        assert len(trail["changes"]) >= 1

        value_changes = [c for c in trail["changes"] if c["field_name"] == "current_value"]
        assert len(value_changes) >= 1
        assert value_changes[0]["old_value"] == "0.6"
        assert value_changes[0]["new_value"] == "0.7"

    def test_audit_trail_evidence_includes_sampling(self, store):
        rows = [{"line_number": 3, "item_name": "D", "category": "优惠", "value": "0.5", "denominator": "20", "numerator": "10"}]
        import_annotations(store, rows, AnnotationSource.TEACHER_ANNOTATION)

        sampling_rows = [{"line_number": 3, "item_name": "D", "category": "优惠", "value": "0.4", "denominator": "20", "numerator": "8"}]
        import_annotations(store, sampling_rows, AnnotationSource.SAMPLING_LIST)

        ann = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)[0]
        trail = get_audit_trail(store, ann.id)
        assert trail["evidence"]["sampling_list_value"] == "0.4"


class TestRollback:
    def test_rollback_restores_old_values(self, store):
        rows1 = [{"line_number": 1, "item_name": "A", "category": "优惠", "value": "0.8", "denominator": "10", "numerator": "8"}]
        result1 = import_annotations(store, rows1, AnnotationSource.TEACHER_ANNOTATION)

        rows2 = [{"line_number": 1, "item_name": "A", "category": "优惠", "value": "0.9", "denominator": "10", "numerator": "9"}]
        result2 = import_annotations(store, rows2, AnnotationSource.TEACHER_ANNOTATION)

        ann = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)[0]
        assert ann.current_value == "0.9"

        rolled = store.rollback_batch(result2.batch.id)
        assert rolled >= 1

        ann = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)[0]
        assert ann.current_value == "0.8"


class TestCalculationEngine:
    def test_normal_calculation(self):
        anns = [
            Annotation(item_name="A", category="优惠", denominator_raw="100", numerator_raw="85", current_value="0.85"),
        ]
        results = calculate_inclusion_exclusion(anns)
        assert len(results) == 1
        assert results[0].value == 0.85

    def test_denominator_zero_empty_gives_none(self):
        anns = [
            Annotation(item_name="B", category="优惠", denominator_raw="", numerator_raw="30", current_value=""),
        ]
        results = calculate_inclusion_exclusion(anns)
        assert results[0].value is None
        assert results[0].was_edge_case is True

    def test_denominator_zero_numeric_gives_zero(self):
        anns = [
            Annotation(item_name="C", category="优惠", denominator_raw="0", numerator_raw="30", current_value="0"),
        ]
        results = calculate_inclusion_exclusion(anns)
        assert results[0].value == 0.0
