from __future__ import annotations

import json
import os
import tempfile
import pytest

from rxtj.rules import AnnotationSource, ReviewStatus
from rxtj.store import Store
from rxtj.workflow import (
    step1_import_annotations,
    step2_review_sampling,
    step3_update_demo,
    review_flagged_annotation,
    build_unified_report,
    get_audit_trail,
)
from rxtj.exporter import export_report_json, export_report_csv


ANNOTATIONS_V1 = [
    {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
    {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "", "denominator": "", "numerator": "30"},
    {"line_number": 3, "item_name": "化学C", "category": "叠加", "value": "0.60", "denominator": "50", "numerator": "30"},
]

ANNOTATIONS_WRONG = [
    {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.95", "denominator": "100", "numerator": "95"},
    {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "", "denominator": "", "numerator": "30"},
    {"line_number": 3, "item_name": "化学C", "category": "叠加", "value": "0.70", "denominator": "50", "numerator": "35"},
]

SAMPLING = [
    {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
    {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "0.50", "denominator": "60", "numerator": "30"},
    {"line_number": 3, "item_name": "化学C", "category": "叠加", "value": "0.55", "denominator": "50", "numerator": "27.5"},
]


@pytest.fixture
def store():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    s = Store(db_path)
    yield s
    try:
        os.unlink(db_path)
    except OSError:
        pass


class TestReviewFlagged:
    def test_review_keeps_original_statement_and_records_corrected(self, store):
        step1_import_annotations(store, ANNOTATIONS_V1)
        anns = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        physics = [a for a in anns if a.item_name == "物理B"][0]
        assert physics.status == ReviewStatus.FLAGGED
        assert physics.original_value == ""

        ann, changes = review_flagged_annotation(
            store=store,
            annotation_id=physics.id,
            corrected_value="0.50",
            review_reason="查老师原始稿确认为 30/60=0.5",
            next_contact="唐老师确认",
            reviewed_by="复核员小王",
            corrected_denominator="60",
            corrected_numerator="30",
            mark_as_pending_after=True,
        )
        assert ann.original_value == ""
        assert ann.current_value == "0.50"
        assert ann.status == ReviewStatus.PENDING
        assert ann.review_reason == "查老师原始稿确认为 30/60=0.5"
        assert ann.next_contact == "唐老师确认"
        assert ann.reviewed_by == "复核员小王"
        assert ann.reviewed_at != ""
        assert len(changes) >= 3

        trail = get_audit_trail(store, ann.id)
        ev = trail["evidence"]
        assert ev["original_statement"] == ""
        assert ev["corrected_value"] == "0.50"
        assert ev["review_reason"] == "查老师原始稿确认为 30/60=0.5"
        assert ev["next_contact"] == "唐老师确认"
        assert ev["reviewed_by"] == "复核员小王"

    def test_review_mark_reviewed_status_not_in_calculation(self, store):
        step1_import_annotations(store, ANNOTATIONS_V1)
        step2_review_sampling(store, SAMPLING, changed_by="coach")
        anns = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        chem = [a for a in anns if a.item_name == "化学C"][0]
        assert chem.status == ReviewStatus.FLAGGED

        review_flagged_annotation(
            store=store,
            annotation_id=chem.id,
            corrected_value="0.55",
            review_reason="抽样更正",
            next_contact="已反馈",
            reviewed_by="复核员小王",
            mark_as_pending_after=False,
        )
        chem_after = store.get_annotation(chem.id)
        assert chem_after.status == ReviewStatus.REVIEWED

        results, _ = step3_update_demo(store)
        chem_result = [r for r in results if r.item_name == "化学C"][0]
        assert chem_result.status == ReviewStatus.REVIEWED
        assert chem_result.value is None

    def test_cannot_review_non_flagged(self, store):
        step1_import_annotations(store, ANNOTATIONS_V1)
        anns = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        math_a = [a for a in anns if a.item_name == "数学A"][0]
        with pytest.raises(ValueError):
            review_flagged_annotation(
                store=store,
                annotation_id=math_a.id,
                corrected_value="x",
                review_reason="y",
                next_contact="z",
                reviewed_by="t",
            )


class TestRollbackConsistency:
    def test_rollback_restores_field_values_status_and_changes(self, store):
        r1, _ = step1_import_annotations(store, ANNOTATIONS_V1, changed_by="v1")
        batch1_id = r1.batch.id
        anns_before = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        math_before = [a for a in anns_before if a.item_name == "数学A"][0]

        r_wrong, _ = step1_import_annotations(store, ANNOTATIONS_WRONG, changed_by="wrong")
        batch2_id = r_wrong.batch.id
        anns_wrong = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        math_wrong = [a for a in anns_wrong if a.item_name == "数学A"][0]
        assert math_wrong.current_value == "0.95"

        rolled, changes = store.rollback_batch(batch2_id, changed_by="undo")
        assert rolled >= 2
        assert len(changes) >= rolled

        anns_after = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        math_after = [a for a in anns_after if a.item_name == "数学A"][0]
        assert math_after.current_value == math_before.current_value
        chem_after = [a for a in anns_after if a.item_name == "化学C"][0]
        assert chem_after.current_value == "0.60"

        batch2_after = store.get_batch(batch2_id)
        assert batch2_after.rolled_back is True

        results, _ = step3_update_demo(store)
        math_r = [r for r in results if r.item_name == "数学A"][0]
        assert math_r.value == 0.85

    def test_rollback_change_records_visible_in_audit(self, store):
        step1_import_annotations(store, ANNOTATIONS_V1)
        r2, _ = step1_import_annotations(store, ANNOTATIONS_WRONG)
        anns = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        math_id = [a.id for a in anns if a.item_name == "数学A"][0]

        store.rollback_batch(r2.batch.id)
        trail = get_audit_trail(store, math_id)
        reasons = [c["reason"] for c in trail["changes"]]
        assert any("rollback_batch" in r for r in reasons)


class TestFirstBatchRollbackDeletesNewAnnotations:
    def test_first_batch_with_empty_denominator_rollback_removes_all_new_records(self, store):
        rows = [
            {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
            {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "", "denominator": "", "numerator": "30"},
        ]
        r1, _ = step1_import_annotations(store, rows, changed_by="first_import")

        anns_before = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        assert len(anns_before) == 2
        physics = [a for a in anns_before if a.item_name == "物理B"][0]
        assert physics.status == ReviewStatus.FLAGGED
        assert physics.denominator_raw == ""
        assert physics.edge_case_type == "denominator_zero_empty_string"

        results_before, state_before = step3_update_demo(store)
        assert state_before.annotation_count == 2
        assert state_before.flagged_count == 1
        assert len(results_before) == 2

        report_before = build_unified_report(store)
        assert report_before["annotations_summary"]["total"] == 2
        assert report_before["annotations_summary"]["flagged_count"] == 1

        detail = store.rollback_batch_detailed(r1.batch.id, changed_by="undo_first")
        assert detail["deleted_new_count"] == 2
        assert detail["remaining_teacher_annotations"] == 0
        assert detail["rolled_back"] is True

        anns_after = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        assert len(anns_after) == 0, "首批导入回滚后，新增的两条批注应整条从库里删除"

        math_a_after = store.find_annotation_by_line(1, AnnotationSource.TEACHER_ANNOTATION)
        assert math_a_after is None
        physics_after = store.find_annotation_by_line(2, AnnotationSource.TEACHER_ANNOTATION)
        assert physics_after is None, "空分母的 flagged 记录回滚后也必须整条删除，不能留在库里"

        conn = store._get_conn()
        cr_count = conn.execute(
            "SELECT COUNT(*) as c FROM change_records"
        ).fetchone()["c"]
        assert cr_count == 0, "被删除批注对应的 change_records 也必须一起清掉"

        results_after, state_after = step3_update_demo(store)
        assert state_after.annotation_count == 0
        assert state_after.flagged_count == 0
        assert state_after.reviewed_count == 0
        assert len(results_after) == 0

        report_after = build_unified_report(store)
        assert report_after["annotations_summary"]["total"] == 0
        assert report_after["annotations_summary"]["flagged_count"] == 0
        assert report_after["annotations_summary"]["reviewed_count"] == 0
        assert len(report_after["calculation_results"]) == 0
        assert len(report_after["by_status"]["flagged"]) == 0
        assert len(report_after["by_status"]["normal_pending"]) == 0

    def test_first_batch_rollback_distinct_from_reimport_field_restore(self, store):
        batch1_rows = [
            {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
            {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "", "denominator": "", "numerator": "30"},
        ]
        r1, _ = step1_import_annotations(store, batch1_rows, changed_by="batch1")

        batch2_rows = [
            {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.95", "denominator": "100", "numerator": "95"},
            {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "", "denominator": "", "numerator": "30"},
            {"line_number": 3, "item_name": "化学C", "category": "叠加", "value": "0.70", "denominator": "50", "numerator": "35"},
        ]
        r2, _ = step1_import_annotations(store, batch2_rows, changed_by="batch2")
        anns_batch2 = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        assert len(anns_batch2) == 3
        math_after_b2 = [a for a in anns_batch2 if a.item_name == "数学A"][0]
        assert math_after_b2.current_value == "0.95"

        detail2 = store.rollback_batch_detailed(r2.batch.id, changed_by="undo_batch2")
        assert detail2["deleted_new_count"] == 1
        assert detail2["restored_field_count"] >= 2
        assert detail2["remaining_teacher_annotations"] == 2

        anns_after_b2_rollback = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        assert len(anns_after_b2_rollback) == 2
        math_restored = [a for a in anns_after_b2_rollback if a.item_name == "数学A"][0]
        assert math_restored.current_value == "0.85"
        physics_kept = [a for a in anns_after_b2_rollback if a.item_name == "物理B"][0]
        assert physics_kept is not None
        assert physics_kept.status == ReviewStatus.FLAGGED
        chem_deleted = store.find_annotation_by_line(3, AnnotationSource.TEACHER_ANNOTATION)
        assert chem_deleted is None

        detail1 = store.rollback_batch_detailed(r1.batch.id, changed_by="undo_batch1")
        assert detail1["deleted_new_count"] == 2
        assert detail1["remaining_teacher_annotations"] == 0

        final_anns = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        assert len(final_anns) == 0, "两批次都回滚后库里应该空了"

    def test_rollback_audited_first_batch_annotation_gone_from_trail(self, store):
        rows = [
            {"line_number": 1, "item_name": "数学A", "category": "优惠", "value": "0.85", "denominator": "100", "numerator": "85"},
            {"line_number": 2, "item_name": "物理B", "category": "优惠", "value": "", "denominator": "", "numerator": "30"},
        ]
        r1, _ = step1_import_annotations(store, rows)

        anns = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        physics_id = [a.id for a in anns if a.item_name == "物理B"][0]

        trail_before = get_audit_trail(store, physics_id)
        assert "error" not in trail_before
        assert trail_before["evidence"]["edge_case_type"] == "denominator_zero_empty_string"

        store.rollback_batch(r1.batch.id)

        trail_after = get_audit_trail(store, physics_id)
        assert "error" in trail_after, "首批被删除的记录，audit trail 应该明确返回 not found"


class TestUnifiedReportAndExport:
    def test_build_unified_report_status_consistent(self, store):
        step1_import_annotations(store, ANNOTATIONS_V1)
        step2_review_sampling(store, SAMPLING, changed_by="coach")
        anns = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        physics = [a for a in anns if a.item_name == "物理B"][0]
        chem = [a for a in anns if a.item_name == "化学C"][0]

        review_flagged_annotation(
            store, physics.id, "0.50", "修正分母", "唐老师", "复核A",
            corrected_denominator="60", corrected_numerator="30",
            mark_as_pending_after=True,
        )
        review_flagged_annotation(
            store, chem.id, "0.55", "抽样更正", "已反馈", "复核A",
            mark_as_pending_after=False,
        )

        report = build_unified_report(store)
        sm = report["annotations_summary"]
        assert sm["total"] == 3
        assert sm["flagged_count"] == 0
        assert sm["reviewed_count"] == 1
        assert sm["normal_pending_count"] == 2
        assert len(report["calculation_results"]) == 3

        assert len(report["by_status"]["flagged"]) == 0
        assert len(report["by_status"]["reviewed"]) == 1
        reviewed_item = report["by_status"]["reviewed"][0]
        assert reviewed_item["annotation"]["item_name"] == "化学C"
        ev = reviewed_item["evidence"]
        assert ev["original_statement"] == "0.60"
        assert ev["corrected_value"] == "0.55"

    def test_export_json_csv_consistent_with_calculation(self, store):
        step1_import_annotations(store, ANNOTATIONS_V1)
        step2_review_sampling(store, SAMPLING, changed_by="coach")

        tmpdir = tempfile.mkdtemp()
        jp = os.path.join(tmpdir, "r.json")
        cp = os.path.join(tmpdir, "r.csv")

        export_report_json(store, jp)
        export_report_csv(store, cp)
        assert os.path.exists(jp) and os.path.exists(cp)

        with open(jp, "r", encoding="utf-8") as f:
            report = json.load(f)

        results, _ = step3_update_demo(store)
        assert len(report["calculation_results"]) == len(results)

        r_map_step3 = {r.item_name: r for r in results}
        r_map_json = {r["item_name"]: r for r in report["calculation_results"]}
        for name in r_map_step3:
            assert r_map_step3[name].value == r_map_json[name].get("value")
            if r_map_step3[name].evidence:
                ev = r_map_json[name]["evidence"]
                assert ev["original_line_number"] == r_map_step3[name].evidence.original_line_number


class TestFullWorkflowConsistency:
    def test_step3_uses_latest_reviewed_and_rollback_state(self, store):
        step1_import_annotations(store, ANNOTATIONS_V1, changed_by="t1")
        step2_review_sampling(store, SAMPLING, changed_by="coach")

        results_pre, _ = step3_update_demo(store)
        physics_pre = [r for r in results_pre if r.item_name == "物理B"][0]
        assert physics_pre.value is None
        assert physics_pre.status == ReviewStatus.FLAGGED

        anns = store.list_annotations(source=AnnotationSource.TEACHER_ANNOTATION)
        physics_id = [a.id for a in anns if a.item_name == "物理B"][0]
        review_flagged_annotation(
            store, physics_id, "0.50", "补录分母60", "唐老师", "复核A",
            corrected_denominator="60", corrected_numerator="30",
            mark_as_pending_after=True,
        )

        results_post, _ = step3_update_demo(store)
        physics_post = [r for r in results_post if r.item_name == "物理B"][0]
        assert physics_post.value == 0.5
        assert physics_post.evidence.review_reason == "补录分母60"
        assert physics_post.evidence.next_contact == "唐老师"
