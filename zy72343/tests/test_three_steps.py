"""三步流程集成测试：导入 → 补录 → 报告"""
import os
import tempfile
import pytest
from segment_conflict.processor import (
    import_segments_from_csv,
    supplement_questionnaire_row,
    review_gap,
    generate_report,
)
from segment_conflict.algorithms import detect_gaps, detect_all_conflicts


SAMPLE_CSV = os.path.join(
    os.path.dirname(os.path.dirname(__file__)),
    "samples",
    "hand_calculated.csv",
)


class TestStep1Import:
    """第一步：手算反例第一次导入"""

    def test_import_detects_gaps(self):
        """验证导入后正确检测到编号断档"""
        project = import_segments_from_csv(SAMPLE_CSV, "测试项目")

        assert project.name == "测试项目"
        assert len(project.segments) == 12

        gaps = project.gaps
        assert len(gaps) == 3, f"应检测到3处断档，实际{len(gaps)}处"

        assert gaps[0].gap_start == 3
        assert gaps[0].gap_end == 3
        assert gaps[0].missing_count == 1
        assert gaps[0].status == "pending_supplement"

        assert gaps[1].gap_start == 7
        assert gaps[1].gap_end == 7
        assert gaps[1].missing_count == 1

        assert gaps[2].gap_start == 12
        assert gaps[2].gap_end == 12
        assert gaps[2].missing_count == 1

    def test_import_detects_conflicts(self):
        """验证导入后正确检测到线段相交冲突"""
        project = import_segments_from_csv(SAMPLE_CSV, "测试项目")

        conflicts = project.conflicts
        assert len(conflicts) > 0, "应检测到至少一处冲突"

        conflict_types = set(c.conflict_type for c in conflicts)
        assert "exact_intersection" in conflict_types, "应包含精确相交"

    def test_import_creates_parameter_versions(self):
        """验证导入后自动创建参数版本记录"""
        project = import_segments_from_csv(SAMPLE_CSV, "测试项目")

        versions = project.parameter_versions
        assert len(versions) == len(project.segments)

        for v in versions:
            assert v.version == 1
            assert v.created_by == "系统自动生成"
            assert len(v.change_log) >= 1

        needs_qi = [
            v for v in versions
            if v.next_owner == "数据分析师小祁" and v.status == "needs_supplement"
        ]
        assert len(needs_qi) > 0, "应有数据需要小祁补录"

        needs_review = [
            v for v in versions
            if v.next_owner == "教研组"
        ]
        assert len(needs_review) > 0, "应有数据需要教研组复核"

    def test_gaps_not_auto_resolved(self):
        """验证断档不自动归正常，留给教研组复核"""
        project = import_segments_from_csv(SAMPLE_CSV, "测试项目")

        pending_gaps = [g for g in project.gaps if g.status == "pending_supplement"]
        assert len(pending_gaps) == 3, "断档应保持待补录状态，不自动归位"


class TestStep2Supplement:
    """第二步：数据分析师小祁补看问卷原始行"""

    def test_supplement_updates_segment(self):
        """验证补录后线段关联问卷行号"""
        project = import_segments_from_csv(SAMPLE_CSV, "测试项目")
        old_version = project.version

        segment_id = 3
        questionnaire_row = 3

        project = supplement_questionnaire_row(
            project, segment_id, questionnaire_row
        )

        seg = next(s for s in project.segments if s.id == segment_id)
        assert seg.questionnaire_row == questionnaire_row
        assert seg.source_type == "questionnaire_verified"
        assert project.version == old_version + 1

    def test_supplement_updates_gap_status(self):
        """验证补录后断档状态更新（但仍需教研组复核）"""
        project = import_segments_from_csv(SAMPLE_CSV, "测试项目")

        segment_id = 3
        questionnaire_row = 3

        project = supplement_questionnaire_row(
            project, segment_id, questionnaire_row
        )

        gap = project.gaps[0]
        assert questionnaire_row in gap.supplemented_rows
        assert gap.status == "supplemented", "补录后应标记为已补录待复核，而非直接解决"
        assert gap.note is not None

    def test_supplement_creates_new_parameter_version(self):
        """验证补录后创建新版本记录，版本号递增"""
        project = import_segments_from_csv(SAMPLE_CSV, "测试项目")

        segment_id = 3

        old_versions = [
            v for v in project.parameter_versions if v.segment_id == segment_id
        ]
        old_max_version = max(v.version for v in old_versions)

        project = supplement_questionnaire_row(project, segment_id, 3)

        new_versions = [
            v for v in project.parameter_versions if v.segment_id == segment_id
        ]
        new_max_version = max(v.version for v in new_versions)

        assert new_max_version == old_max_version + 1
        assert len(new_versions) == len(old_versions) + 1

        latest = next(v for v in new_versions if v.version == new_max_version)
        assert latest.next_owner == "教研组"
        assert latest.status == "ready_for_review"
        assert "数据分析师小祁" in latest.created_by
        assert len(latest.change_log) >= 1

    def test_supplement_updates_kept_reason(self):
        """验证补录后保留原因更新"""
        project = import_segments_from_csv(SAMPLE_CSV, "测试项目")

        segment_id = 3
        old_v = next(
            v for v in project.parameter_versions
            if v.segment_id == segment_id and v.version == 1
        )
        assert "手算反例" in old_v.kept_reason
        assert len(old_v.missing_materials) > 0

        project = supplement_questionnaire_row(project, segment_id, 3)

        new_v = next(
            v for v in project.parameter_versions
            if v.segment_id == segment_id and v.version == 2
        )
        assert "已关联问卷" in new_v.kept_reason
        assert len(new_v.missing_materials) == 0


class TestStep3Report:
    """第三步：生成报告"""

    def test_report_contains_gap_tracking(self):
        """验证报告包含断档追踪信息"""
        project = import_segments_from_csv(SAMPLE_CSV, "测试项目")

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            report_path = f.name

        try:
            generate_report(project, report_path)

            with open(report_path, "r", encoding="utf-8") as f:
                content = f.read()

            assert "编号断档追踪" in content
            assert "第3-3行" in content
            assert "第7-7行" in content
            assert "第12-12行" in content
            assert "待补录" in content
            assert "找数据分析师小祁" in content
        finally:
            os.unlink(report_path)

    def test_report_contains_parameter_versions(self):
        """验证报告包含参数版本信息"""
        project = import_segments_from_csv(SAMPLE_CSV, "测试项目")
        project = supplement_questionnaire_row(project, 3, 3)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            report_path = f.name

        try:
            generate_report(project, report_path)

            with open(report_path, "r", encoding="utf-8") as f:
                content = f.read()

            assert "参数版本页" in content
            assert "保留原因" in content
            assert "缺失材料" in content
            assert "下一步" in content
            assert "数据分析师小祁" in content
            assert "教研组" in content
        finally:
            os.unlink(report_path)

    def test_report_contains_action_items(self):
        """验证报告包含行动指引"""
        project = import_segments_from_csv(SAMPLE_CSV, "测试项目")

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            report_path = f.name

        try:
            generate_report(project, report_path)

            with open(report_path, "r", encoding="utf-8") as f:
                content = f.read()

            assert "下一步行动指引" in content
            assert "□" in content
        finally:
            os.unlink(report_path)

    def test_report_not_cold_system_log(self):
        """验证报告不是冷冰冰的系统日志"""
        project = import_segments_from_csv(SAMPLE_CSV, "测试项目")

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            report_path = f.name

        try:
            generate_report(project, report_path)

            with open(report_path, "r", encoding="utf-8") as f:
                content = f.read()

            assert "线段相交施工冲突检测报告" in content
            assert "项目名称" in content
            assert "报告结束" in content
            assert "如有疑问请联系" in content
        finally:
            os.unlink(report_path)


class TestFullFlow:
    """完整三步流程测试"""

    def test_full_three_step_flow(self):
        """端到端测试：导入 → 补录 → 报告"""
        project = import_segments_from_csv(SAMPLE_CSV, "完整流程测试")
        assert project.version == 1

        initial_gaps_pending = len(
            [g for g in project.gaps if g.status == "pending_supplement"]
        )
        assert initial_gaps_pending == 3

        for seg_id, q_row in [(3, 3), (6, 7), (10, 12)]:
            project = supplement_questionnaire_row(project, seg_id, q_row)

        assert project.version == 4

        supplemented_gaps = len(
            [g for g in project.gaps if g.status == "supplemented"]
        )
        assert supplemented_gaps == 3

        project = review_gap(
            project, gap_index=0, approved=True, review_note="复核通过，数据完整"
        )
        assert project.version == 5
        assert project.gaps[0].status == "resolved"

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            report_path = f.name

        try:
            generate_report(project, report_path)

            with open(report_path, "r", encoding="utf-8") as f:
                content = f.read()

            assert "完整流程测试" in content
            assert "v5" in content
            assert "已解决" in content
            assert "已补录待复核" in content
        finally:
            os.unlink(report_path)

    def test_trace_original_row(self):
        """验证能追溯到手算反例原始行"""
        project = import_segments_from_csv(SAMPLE_CSV, "追溯测试")

        for seg in project.segments:
            assert seg.original_row_num > 0

        seg3 = next(s for s in project.segments if s.id == 3)
        assert seg3.original_row_num == 4

        adjacent_to_gap = any(
            g.gap_end + 1 == seg3.original_row_num or
            g.gap_start - 1 == seg3.original_row_num
            for g in project.gaps
        )
        assert adjacent_to_gap, "原始行4应紧邻断档区间（断档在第3行）"

        has_gap_before = any(
            g.gap_end == seg3.original_row_num - 1 for g in project.gaps
        )
        assert has_gap_before, "原始行4之前应有断档（第3行被删除）"

    def test_deleted_segments_kept_in_history(self):
        """验证已删除线段保留在历史中，不被物理删除"""
        project = import_segments_from_csv(SAMPLE_CSV, "删除测试")

        deleted_segs = [s for s in project.segments if s.is_deleted]
        assert len(deleted_segs) > 0

        for seg in deleted_segs:
            versions = [
                v for v in project.parameter_versions
                if v.segment_id == seg.id
            ]
            assert len(versions) > 0
            latest = max(versions, key=lambda v: v.version)
            assert latest.next_owner == "教研组"
            assert "已标记删除" in latest.kept_reason


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
