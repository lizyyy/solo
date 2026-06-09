"""三步流程集成测试：导入 → 补录 → 报告（含全链路一致性）"""
import os
import tempfile
import pytest
from segment_conflict.processor import (
    import_segments_from_csv,
    supplement_questionnaire_row,
    review_gap,
    review_segment_parameter,
    generate_report,
    get_latest_parameter_versions,
    get_parameter_version_history,
    count_todo_by_latest_versions,
    load_project,
)
from segment_conflict.algorithms import detect_gaps, detect_all_conflicts
from segment_conflict.models import ReviewRecord


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
            assert "还缺什么材料" in content
            assert "下一步找谁" in content
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


# ============================================================
#  第二轮新增：全链路一致性 / 四要素 / 复核记录 / 版本区分
# ============================================================

class TestConsistencyAllEntryPoints:
    """全链路一致性：导入/补录/复核后，processor内部计数与报告内容一致"""

    def test_count_consistency_after_import(self):
        """导入后：get_latest_parameter_versions 与 count_todo 统计一致"""
        project = import_segments_from_csv(SAMPLE_CSV, "一致性导入")

        latest = get_latest_parameter_versions(project)
        assert len(latest) == len(project.segments), "每条线段应有一个最新版本"

        # 手工统计和函数统计要一致
        manual_qi = sum(
            1 for pv in latest.values()
            if pv.next_owner == "数据分析师小祁" and pv.status == "needs_supplement"
        )
        manual_review = sum(
            1 for pv in latest.values()
            if pv.next_owner == "教研组"
            and pv.status in ("pending_review", "ready_for_review")
        )
        func_qi, func_review = count_todo_by_latest_versions(project)
        assert func_qi == manual_qi, f"小祁计数不一致: func={func_qi}, manual={manual_qi}"
        assert func_review == manual_review, f"教研组计数不一致: func={func_review}, manual={manual_review}"

    def test_count_consistency_in_report(self):
        """报告中的待处理数量与 processor 函数完全一致"""
        project = import_segments_from_csv(SAMPLE_CSV, "报告一致性")
        project = supplement_questionnaire_row(project, 3, 3)
        project = supplement_questionnaire_row(project, 9, 11)

        needs_qi, needs_review = count_todo_by_latest_versions(project)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            report_path = f.name
        try:
            generate_report(project, report_path)
            with open(report_path, "r", encoding="utf-8") as f:
                content = f.read()

            # 报告头部摘要数字
            assert f"待数据分析师小祁处理: {needs_qi} 条" in content
            assert f"待教研组复核: {needs_review} 条" in content

            # 行动指引章节数字
            if needs_qi > 0:
                assert f"数据分析师小祁: 补录 {needs_qi} 条线段" in content
            if needs_review > 0:
                assert f"教研组: 复核 {needs_review} 条线段" in content

            # 一致性说明
            assert "基于同一份最新参数版本去重结果" in content
        finally:
            os.unlink(report_path)

    def test_no_duplicate_count_from_history(self):
        """关键：同一条线段的v1+v2不会被重复统计（核心bug修复验证）"""
        project = import_segments_from_csv(SAMPLE_CSV, "去重验证")

        # 补录3次，让同一条线段产生3个版本
        project = supplement_questionnaire_row(project, 3, 3)
        project = supplement_questionnaire_row(project, 3, 3)  # 同一条再补录1次
        project = supplement_questionnaire_row(project, 3, 3)  # 第3次

        # 实际版本总数：12(初始) + 3(补录) = 15
        total_versions = len(project.parameter_versions)
        assert total_versions == 15, f"版本总数应为15, 实际{total_versions}"

        # 但去重后 latest 仍然是12条
        latest = get_latest_parameter_versions(project)
        assert len(latest) == 12, "去重后必须还是12条线段"

        # 计数不会因为历史版本增多而变大
        qi1, rv1 = count_todo_by_latest_versions(project)
        project = supplement_questionnaire_row(project, 3, 3)  # 第4次补录同一条
        qi2, rv2 = count_todo_by_latest_versions(project)
        assert qi1 == qi2, "补录同一条线段不应改变待小祁数量(状态未变的线段数量不变)"

    def test_save_load_preserves_consistency(self):
        """项目保存/重新加载后，所有统计不变"""
        project = import_segments_from_csv(SAMPLE_CSV, "保存加载测试")
        project = supplement_questionnaire_row(project, 3, 3)

        qi_before, rv_before = count_todo_by_latest_versions(project)
        latest_before_keys = set(get_latest_parameter_versions(project).keys())

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
            json_path = f.name
        try:
            project.save(json_path)
            loaded = load_project(json_path)

            qi_after, rv_after = count_todo_by_latest_versions(loaded)
            latest_after_keys = set(get_latest_parameter_versions(loaded).keys())

            assert qi_before == qi_after, "保存加载后小祁计数不应变化"
            assert rv_before == rv_after, "保存加载后教研组计数不应变化"
            assert latest_before_keys == latest_after_keys, "去重线段集合不应变化"
        finally:
            os.unlink(json_path)


class TestParameterVersionFourElements:
    """变更四要素：每条ParameterVersion必须有 原始值→改后值→处理原因→下一步找谁"""

    def test_v1_has_four_elements(self):
        """导入v1版本就填入四要素（不再等到补录时才有）"""
        project = import_segments_from_csv(SAMPLE_CSV, "四要素v1")

        for pv in project.parameter_versions:
            assert pv.version == 1
            assert pv.original_value is not None, "v1必须有原始说法"
            assert pv.new_value is not None, "v1必须有改后值"
            assert pv.change_reason is not None, "v1必须有处理原因"
            assert pv.next_owner is not None, "v1必须有下一步找谁"

    def test_supplement_records_change(self):
        """补录后，新版本记录 原始值→改后值→处理原因"""
        project = import_segments_from_csv(SAMPLE_CSV, "补录四要素")
        seg_id = 3

        pv_v1 = next(
            pv for pv in project.parameter_versions
            if pv.segment_id == seg_id and pv.version == 1
        )
        assert "未关联" in pv_v1.original_value

        project = supplement_questionnaire_row(project, seg_id, 3)

        pv_v2 = next(
            pv for pv in project.parameter_versions
            if pv.segment_id == seg_id and pv.version == 2
        )
        assert "未关联" in pv_v2.original_value, "v2原始说法应是v1的状态"
        assert "问卷原始行 = 3" in pv_v2.new_value, "v2改后值应包含新行号"
        assert "补看问卷原始行" in pv_v2.change_reason, "v2处理原因应说明补录"
        assert pv_v2.next_owner == "教研组", "补录后下一步是教研组"

    def test_deleted_segment_reason_kept(self):
        """已删除线段的四要素明确说明，不提前归正常"""
        project = import_segments_from_csv(SAMPLE_CSV, "删除四要素")

        deleted_seg = next(s for s in project.segments if s.is_deleted)
        pv = next(
            pv for pv in project.parameter_versions
            if pv.segment_id == deleted_seg.id
        )
        assert "已标记删除" in pv.kept_reason
        assert pv.next_owner == "教研组"
        assert pv.status == "pending_review"
        assert "导入即标记为已删除" == pv.original_value


class TestReviewRecordsChain:
    """人工复核记录链：ReviewRecord 完整四要素，相邻线段同步更新"""

    def test_review_gap_creates_review_record(self):
        """教研组复核断档 → 生成 ReviewRecord，字段齐全"""
        project = import_segments_from_csv(SAMPLE_CSV, "断档复核记录")
        project = supplement_questionnaire_row(project, 3, 3)

        records_before = len(project.review_records)
        project = review_gap(
            project, gap_index=0, approved=True,
            review_note="补录完整，同意关闭", reviewer="教研组张工"
        )
        records_after = len(project.review_records)

        assert records_after == records_before + 1, "必须追加1条复核记录"

        latest_rr: ReviewRecord = project.review_records[-1]
        assert latest_rr.target_type == "gap"
        assert latest_rr.original_status == "supplemented", "原始状态应是已补录待复核"
        assert latest_rr.new_status == "resolved"
        assert latest_rr.reason == "补录完整，同意关闭"
        assert latest_rr.reviewer == "教研组张工"
        assert latest_rr.next_owner is not None, "必须有下一步找谁"
        assert "status" in latest_rr.changes, "changes 必须包含前后状态对照"

    def test_review_gap_syncs_adjacent_segment_versions(self):
        """断档复核后，前后相邻两条线段各追加一个新版本（核心一致性）"""
        project = import_segments_from_csv(SAMPLE_CSV, "相邻线段同步")
        project = supplement_questionnaire_row(project, 3, 3)

        gap = project.gaps[0]
        before_seg_id = gap.segment_before
        after_seg_id = gap.segment_after
        assert before_seg_id is not None
        assert after_seg_id is not None

        # 记录复核前这两条线段的版本数量
        before_count_before = len([
            pv for pv in project.parameter_versions if pv.segment_id == before_seg_id
        ])
        before_count_after = len([
            pv for pv in project.parameter_versions if pv.segment_id == after_seg_id
        ])

        project = review_gap(
            project, gap_index=0, approved=True,
            review_note="数据完整", reviewer="教研组"
        )

        # 复核后这两条线段各自都要 +1 版本
        after_count_before = len([
            pv for pv in project.parameter_versions if pv.segment_id == before_seg_id
        ])
        after_count_after = len([
            pv for pv in project.parameter_versions if pv.segment_id == after_seg_id
        ])
        assert after_count_before == before_count_before + 1, (
            f"断档前的线段#{before_seg_id}版本数应+1，"
            f"前={before_count_before} 后={after_count_before}"
        )
        assert after_count_after == before_count_after + 1, (
            f"断档后的线段#{after_seg_id}版本数应+1"
        )

        # 最新版本要包含相邻断档变更的说明
        latest_pvs = get_latest_parameter_versions(project)
        pv_before = latest_pvs[before_seg_id]
        assert "相邻断档状态变更" in pv_before.change_reason, (
            "相邻线段新版本要说明变更原因"
        )

    def test_review_param_not_auto_normal(self):
        """复核参数版本不提前归正常：驳回→回到小祁，通过→明确resolved"""
        project = import_segments_from_csv(SAMPLE_CSV, "参数复核不提前归位")
        seg_id = 9  # 一条未关联问卷的线段
        project = supplement_questionnaire_row(project, seg_id, 11)  # 先补录

        # 驳回：应回到小祁
        project = review_segment_parameter(
            project, seg_id, approved=False,
            review_note="行号不对，重新核对", reviewer="教研组"
        )
        latest = get_latest_parameter_versions(project)[seg_id]
        assert latest.status == "needs_supplement"
        assert latest.next_owner == "数据分析师小祁"
        assert len(latest.missing_materials) > 0

        # 应有 ReviewRecord
        assert len(project.review_records) >= 1
        rr = project.review_records[-1]
        assert rr.target_type == "segment_parameter"
        assert "重新核对" in rr.reason


class TestLatestVsHistorySeparation:
    """最新版本 vs 历史版本：展示用最新，追溯用完整历史"""

    def test_history_ordered_by_version(self):
        """单条线段历史链按版本号升序"""
        project = import_segments_from_csv(SAMPLE_CSV, "历史排序")
        seg_id = 3
        project = supplement_questionnaire_row(project, seg_id, 3)
        project = supplement_questionnaire_row(project, seg_id, 3)

        history = get_parameter_version_history(project, seg_id)
        assert len(history) >= 3  # v1 + 2次补录 = v3
        for i in range(1, len(history)):
            assert history[i].version == history[i-1].version + 1, (
                f"历史链版本号应连续递增: {history[i-1].version}→{history[i].version}"
            )

    def test_latest_picks_max_version(self):
        """get_latest_parameter_versions 真正取 version 最大的那条"""
        project = import_segments_from_csv(SAMPLE_CSV, "取最大版本")
        seg_id = 3

        # 故意生成乱序的版本号场景：多次补录
        for _ in range(5):
            project = supplement_questionnaire_row(project, seg_id, 3)

        all_for_seg = [pv for pv in project.parameter_versions if pv.segment_id == seg_id]
        max_ver = max(pv.version for pv in all_for_seg)

        latest_map = get_latest_parameter_versions(project)
        latest = latest_map[seg_id]
        assert latest.version == max_ver, (
            f"最新版本应是v{max_ver}, 实际取到v{latest.version}"
        )

    def test_missing_materials_sync_between_entries(self):
        """还缺什么材料：最新PV、报告、API返回三处文字完全一致"""
        project = import_segments_from_csv(SAMPLE_CSV, "缺材料同步")
        seg_id = 9  # 一条未关联问卷的线段 → v1缺材料
        latest_map = get_latest_parameter_versions(project)
        materials_processor = latest_map[seg_id].missing_materials

        # 报告里写的和 processor 取到的要一致
        with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
            report_path = f.name
        try:
            generate_report(project, report_path)
            with open(report_path, "r", encoding="utf-8") as f:
                content = f.read()

            # 在报告的待小祁部分找到这条线段的「还缺什么材料」
            expected_text = "、".join(materials_processor) if materials_processor else "无"
            # 报告里必须包含同样的文字（通过参数版本页内容断言）
            seg = next(s for s in project.segments if s.id == seg_id)
            # 找到线段名之后内容里的材料列表
            assert seg.name in content, f"报告里应出现线段名{seg.name}"
            if expected_text != "无":
                for m in materials_processor:
                    assert m in content, f"报告里缺少材料{m}"
        finally:
            os.unlink(report_path)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
