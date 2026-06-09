import unittest
from datetime import datetime, timedelta
from typing import List

from models import (
    SafetyThreshold,
    ManualInspectionNote,
    ErrorStatus,
)
from boundary_rules import (
    BoundaryRuleEngine,
    MIN_SAMPLING_DURATION_MINUTES,
)
from import_service import ImportService
from visualization_review import (
    VisualizationReviewService,
    ViewMode,
)
from workflow import (
    QualityInspectionWorkflow,
)


def create_test_notes() -> List[ManualInspectionNote]:
    base_date = datetime(2026, 6, 1)
    notes: List[ManualInspectionNote] = []

    notes.append(ManualInspectionNote(
        note_id="TEST_001",
        inspection_date="2026-06-01",
        inspector="巡检员老王",
        bracket_id="BRACKET_A01",
        azimuth_error=1.2,
        elevation_error=0.8,
        sampling_start_time=base_date.replace(hour=8, minute=0),
        sampling_end_time=base_date.replace(hour=8, minute=10),
        tracking_accuracy=96.5,
        raw_content="测试备注1：只采了10分钟，缺20分钟",
    ))

    notes.append(ManualInspectionNote(
        note_id="TEST_002",
        inspection_date="2026-06-01",
        inspector="巡检员老王",
        bracket_id="BRACKET_A02",
        azimuth_error=2.5,
        elevation_error=1.8,
        sampling_start_time=base_date.replace(hour=9, minute=0),
        sampling_end_time=base_date.replace(hour=9, minute=35),
        tracking_accuracy=93.0,
        raw_content="测试备注2：采样35分钟正常，但数值超限",
    ))

    notes.append(ManualInspectionNote(
        note_id="TEST_003",
        inspection_date="2026-06-01",
        inspector="巡检员小李",
        bracket_id="BRACKET_B01",
        azimuth_error=0.5,
        elevation_error=0.3,
        sampling_start_time=base_date.replace(hour=10, minute=0),
        sampling_end_time=base_date.replace(hour=10, minute=45),
        tracking_accuracy=97.2,
        raw_content="测试备注3：完全正常的记录",
    ))

    return notes


class TestSolarTrackingBracketErrorSystem(unittest.TestCase):
    def setUp(self):
        self.threshold = SafetyThreshold(
            azimuth_max=2.0,
            elevation_max=1.5,
            tracking_accuracy_min=95.0,
        )
        self.rule_engine = BoundaryRuleEngine(self.threshold)
        self.import_service = ImportService(self.rule_engine)
        self.viz_service = VisualizationReviewService(self.import_service, self.threshold)
        self.workflow = QualityInspectionWorkflow(
            self.rule_engine, self.import_service, self.viz_service
        )

    def test_01_sampling_duration_too_short_detection(self):
        """测试：采样时间缺半小时的判定"""
        print("\n" + "=" * 50)
        print("TEST 1: 采样时间缺半小时的判定")
        print("=" * 50)

        notes = create_test_notes()
        result = self.workflow.step_1_import_notes(notes)

        pending_errors = self.import_service.get_pending_review_errors()
        duration_issues = [
            e for e in pending_errors
            if any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in e.boundary_violations)
        ]

        self.assertEqual(len(duration_issues), 1, "应该检测到1条采样时间不足的记录")

        issue = duration_issues[0]
        self.assertEqual(issue.bracket_id, "BRACKET_A01")
        self.assertEqual(issue.status, ErrorStatus.PENDING_REVIEW)
        self.assertAlmostEqual(issue.sampling_duration_minutes, 10.0, places=1)

        has_human_message = any(
            "采样时间缺了20分钟" in msg
            for msg in issue.human_readable_issues
        )
        self.assertTrue(has_human_message, "错误提示应该说人话，包含'采样时间缺了20分钟'")

        has_no_internal_field = not any(
            "sampling_duration_minutes" in msg
            for msg in issue.human_readable_issues
        )
        self.assertTrue(has_no_internal_field, "错误提示不应该包含内部字段名")

        print(f"✅ 检测到 {len(duration_issues)} 条采样时间缺半小时的记录")
        print(f"✅ 状态正确设为: {issue.status.value}")
        print(f"✅ 人话提示: {issue.human_readable_issues[0]}")

    def test_02_duplicate_import_no_double_count(self):
        """测试：重复导入同一批备注，误差数量不翻倍"""
        print("\n" + "=" * 50)
        print("TEST 2: 重复导入不翻倍")
        print("=" * 50)

        notes = create_test_notes()
        result1 = self.workflow.step_1_import_notes(notes)
        count_after_first = len(self.import_service.get_all_errors())

        result2 = self.workflow.step_1_import_notes(notes)
        count_after_second = len(self.import_service.get_all_errors())

        self.assertEqual(
            count_after_first, count_after_second,
            "重复导入后误差数量应该不变"
        )

        import_result_2 = result2.data.get("import_result", {})
        duplicate_skipped = import_result_2.get("duplicate", 0)
        self.assertGreater(
            duplicate_skipped, 0,
            "应该提示跳过了重复的误差记录"
        )

        has_duplicate_hint = any(
            "太阳跟踪支架误差" in msg and "数量不会翻倍" in msg
            for msg in result2.human_messages
        )
        self.assertTrue(has_duplicate_hint, "应该有'数量不会翻倍'的提示")

        print(f"✅ 第一次导入后误差数: {count_after_first}")
        print(f"✅ 第二次导入后误差数: {count_after_second} (未翻倍)")
        print(f"✅ 跳过重复记录数: {duplicate_skipped}")

    def test_03_single_note_modification_history(self):
        """测试：只改一条备注，历史能看出改前改后差别"""
        print("\n" + "=" * 50)
        print("TEST 3: 单条修改历史追踪")
        print("=" * 50)

        notes = create_test_notes()
        self.workflow.step_1_import_notes(notes)

        pending_errors = self.import_service.get_pending_review_errors()
        target_error = next(
            e for e in pending_errors
            if e.bracket_id == "BRACKET_A01"
        )
        error_id = target_error.error_id
        old_duration = target_error.sampling_duration_minutes

        base_date = datetime(2026, 6, 1)
        fix_result = self.workflow.reviewer_fix_duration_issue(
            error_id=error_id,
            new_sampling_start=base_date.replace(hour=8, minute=0),
            new_sampling_end=base_date.replace(hour=8, minute=35),
            reviewer="质检员小白",
            review_comment="经核对，实际采样到8:35",
        )

        self.assertTrue(fix_result.success, "修改应该成功")

        diff_messages = self.import_service.get_version_diff_for_humans(
            error_id, 1, 2
        )

        has_duration_change = any(
            "采样时长" in msg for msg in diff_messages
        )
        self.assertTrue(has_duration_change, "历史对比应该包含采样时长变化")

        has_human_field_name = any(
            "采样开始时间" in msg or "采样结束时间" in msg
            for msg in diff_messages
        )
        self.assertTrue(has_human_field_name, "应该用中文显示字段名")

        updated_error = self.import_service.get_error(error_id)
        self.assertAlmostEqual(
            updated_error.sampling_duration_minutes, 35.0, places=1,
            msg="修改后采样时长应该是35分钟"
        )

        print(f"✅ 改前采样时长: {old_duration:.0f}分钟")
        print(f"✅ 改后采样时长: {updated_error.sampling_duration_minutes:.0f}分钟")
        print("✅ 改前改后对比:")
        for msg in diff_messages:
            print(f"   {msg}")

    def test_04_3d_chart_click_navigation(self):
        """测试：3D图表点击能追溯回原始备注或阈值表"""
        print("\n" + "=" * 50)
        print("TEST 4: 3D图表点击追溯")
        print("=" * 50)

        notes = create_test_notes()
        self.workflow.step_1_import_notes(notes)

        chart_data = self.viz_service.prepare_chart_data(ViewMode.CHART_3D)
        self.assertEqual(
            chart_data["view_mode"], "3D展示",
            "应该是3D展示模式"
        )
        self.assertGreater(
            chart_data["has_duration_issues_count"], 0,
            "应该有采样时间缺半小时的点"
        )

        all_errors = self.import_service.get_all_errors()
        target_error = next(
            e for e in all_errors
            if any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in e.boundary_violations)
        )

        click_result = self.viz_service.click_data_point(
            target_error.error_id, ViewMode.CHART_3D
        )

        self.assertTrue(click_result.success, "点击应该成功")
        self.assertGreater(len(click_result.review_links), 0, "应该有复核链接")

        has_note_link = any(
            link.target_type == "manual_note"
            for link in click_result.review_links
        )
        self.assertTrue(has_note_link, "应该有跳到手写巡检备注的链接")

        has_threshold_link = any(
            link.target_type == "safety_threshold"
            for link in click_result.review_links
        )
        self.assertTrue(has_threshold_link, "应该有跳安全阈值表的链接")

        nav_result = self.viz_service.navigate_to_source(
            target_error.error_id, "manual_note"
        )
        self.assertTrue(nav_result.success, "跳转备注应该成功")
        self.assertIsNotNone(nav_result.target_data, "应该拿到备注数据")

        nav_threshold = self.viz_service.navigate_to_source(
            target_error.error_id, "safety_threshold"
        )
        self.assertTrue(nav_threshold.success, "跳转阈值表应该成功")

        print(f"✅ 3D图表数据点: {len(chart_data['data_points'])} 个")
        print(f"✅ 点击数据点得到 {len(click_result.review_links)} 个复核链接")
        print("✅ 可跳转类型:")
        for link in click_result.review_links:
            print(f"   → [{link.target_type}] {link.context[:50]}...")
        print("✅ 跳转到原始备注: 成功")
        print("✅ 跳转到安全阈值表: 成功")

    def test_05_modify_and_rollback(self):
        """测试：修改和回滚流程"""
        print("\n" + "=" * 50)
        print("TEST 5: 修改和回滚")
        print("=" * 50)

        notes = create_test_notes()
        self.workflow.step_1_import_notes(notes)

        pending_errors = self.import_service.get_pending_review_errors()
        target_error = next(
            e for e in pending_errors
            if e.bracket_id == "BRACKET_A01"
        )
        error_id = target_error.error_id

        base_date = datetime(2026, 6, 1)
        fix_result = self.workflow.reviewer_fix_duration_issue(
            error_id=error_id,
            new_sampling_start=base_date.replace(hour=8, minute=0),
            new_sampling_end=base_date.replace(hour=8, minute=40),
            reviewer="质检员小白",
            review_comment="测试修改",
        )
        self.assertTrue(fix_result.success)

        error_after_fix = self.import_service.get_error(error_id)
        self.assertEqual(error_after_fix.status, ErrorStatus.NORMAL)

        rollback_result = self.workflow.rollback_modification(
            error_id=error_id,
            reviewer="质检员小白",
        )
        self.assertTrue(rollback_result.success)

        error_after_rollback = self.import_service.get_error(error_id)
        self.assertEqual(
            error_after_rollback.status, ErrorStatus.ROLLED_BACK,
            "回滚后状态应该是'已回滚'"
        )

        self.assertAlmostEqual(
            error_after_rollback.sampling_duration_minutes, 10.0, places=1,
            msg="回滚后采样时长应该恢复到10分钟"
        )

        history = self.import_service.get_error_history(error_id)
        self.assertGreaterEqual(len(history), 2, "应该至少有2条历史记录")

        print(f"✅ 修改后状态: {error_after_fix.status.value}")
        print(f"✅ 回滚后状态: {error_after_rollback.status.value}")
        print(f"✅ 回滚后采样时长: {error_after_rollback.sampling_duration_minutes:.0f}分钟")
        print(f"✅ 历史记录数: {len(history)} 条")

    def test_06_cannot_mark_duration_issue_as_normal_directly(self):
        """测试：采样时间缺半小时不能直接标记为正常"""
        print("\n" + "=" * 50)
        print("TEST 6: 采样缺时不能直接归正常")
        print("=" * 50)

        notes = create_test_notes()
        self.workflow.step_1_import_notes(notes)

        pending_errors = self.import_service.get_pending_review_errors()
        target_error = next(
            e for e in pending_errors
            if any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in e.boundary_violations)
        )

        confirm_result = self.workflow.reviewer_confirm_status(
            error_id=target_error.error_id,
            reviewer="质检员小白",
            comment="",
            mark_as_normal=True,
        )

        self.assertFalse(
            confirm_result.success,
            "没有复核说明时，不应该允许直接标记为正常"
        )

        has_hint_message = any(
            "采样时间缺半小时的记录不能直接标记为正常" in msg
            for msg in confirm_result.human_messages
        )
        self.assertTrue(has_hint_message, "应该提示不能直接标记为正常")

        confirm_with_comment = self.workflow.reviewer_confirm_status(
            error_id=target_error.error_id,
            reviewer="质检员小白",
            comment="经核实，虽采样时间不足但数据仍有效，特殊情况放行",
            mark_as_normal=True,
        )
        self.assertTrue(
            confirm_with_comment.success,
            "有复核说明时，应该允许标记为正常"
        )

        print("✅ 无说明直接标记为正常: 被拒绝 (正确)")
        print("✅ 有复核说明后标记为正常: 允许 (正确)")
        print(f"✅ 拒绝提示: {confirm_result.human_messages[0]}")

    def test_07_full_three_step_workflow(self):
        """测试：完整三步工作流 - 导入→补看阈值→复盘图更新"""
        print("\n" + "=" * 50)
        print("TEST 7: 完整三步工作流")
        print("=" * 50)

        notes = create_test_notes()

        print("--- 第一步：导入手写巡检备注 ---")
        result1 = self.workflow.step_1_import_notes(notes)
        self.assertTrue(result1.success)
        self.assertGreater(result1.pending_review_count, 0)

        pending_after_step1 = self.import_service.get_pending_review_errors()
        duration_issues = [
            e for e in pending_after_step1
            if any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in e.boundary_violations)
        ]
        self.assertGreater(
            len(duration_issues), 0,
            "第一步后应该有采样缺时的记录待复核"
        )

        quick_summary = self.workflow.get_quick_pending_summary()
        self.assertIn("开会前只剩10分钟", quick_summary)
        self.assertIn("采样时间缺半小时", quick_summary)

        print("--- 第二步：质检员补看安全阈值表 ---")
        target_error = duration_issues[0]
        result2 = self.workflow.step_2_review_threshold(target_error.error_id)
        self.assertTrue(result2.success)

        has_comparison = any(
            "当前记录对比" in msg for msg in result2.human_messages
        )
        self.assertTrue(has_comparison, "第二步应该有当前记录和阈值的对比")

        print("--- 第三步：实验复盘图更新 ---")
        result3 = self.workflow.step_3_update_chart(ViewMode.CHART_3D)
        self.assertTrue(result3.success)

        has_chart_update_msg = any(
            "复盘图已更新" in msg for msg in result3.human_messages
        )
        self.assertTrue(has_chart_update_msg)

        has_red_dot_hint = any(
            "红点" in msg and "采样时间缺半小时" in msg
            for msg in result3.human_messages
        )
        self.assertTrue(has_red_dot_hint, "应该提示红点表示采样缺时")

        progress = self.workflow.get_workflow_progress()
        self.assertEqual(progress["completed_count"], 3, "三步应该都完成了")

        print(f"✅ 第一步完成: 导入 {result1.data['import_result']['total']} 条备注")
        print(f"✅ 第二步完成: 查看阈值表并对比")
        print(f"✅ 第三步完成: 3D复盘图已更新")
        print(f"✅ 工作流进度: {progress['human_progress']}")
        print(f"✅ 待复核总数: {result3.pending_review_count} 条 (不急着归正常，留给质检员)")

        quick_summary = self.workflow.get_quick_pending_summary()
        print("\n⏰ 开会前10分钟快速看:")
        print(quick_summary)

    def test_08_human_readable_error_messages(self):
        """测试：所有错误提示说人话，不吐内部字段名"""
        print("\n" + "=" * 50)
        print("TEST 8: 错误提示说人话")
        print("=" * 50)

        notes = create_test_notes()
        self.workflow.step_1_import_notes(notes)

        all_errors = self.import_service.get_all_errors()

        internal_fields = [
            "sampling_duration_minutes",
            "azimuth_error",
            "elevation_error",
            "tracking_accuracy",
            "sampling_start_time",
            "sampling_end_time",
        ]

        human_phrases_expected = [
            "采样时间缺了",
            "超过安全阈值",
            "低于要求",
            "没填采样",
        ]

        for error in all_errors:
            for msg in error.human_readable_issues:
                for field in internal_fields:
                    self.assertNotIn(
                        field, msg,
                        f"错误提示不该包含内部字段名 '{field}': {msg}"
                    )

        found_human_phrases = 0
        for error in all_errors:
            for msg in error.human_readable_issues:
                if any(phrase in msg for phrase in human_phrases_expected):
                    found_human_phrases += 1

        self.assertGreater(
            found_human_phrases, 0,
            "应该有说人话的错误提示"
        )

        print("✅ 所有错误提示不包含内部字段名")
        print("✅ 发现人话提示:")
        for error in all_errors:
            for msg in error.human_readable_issues:
                print(f"   • {msg}")

    def test_09_full_chain_consistency_after_modify_and_rollback(self):
        """测试：修改和回滚后，列表/详情/摘要/历史 保持同一份数据一致"""
        print("\n" + "=" * 50)
        print("TEST 9: 修改→回滚 全链路一致性")
        print("=" * 50)
        from datetime import timedelta

        notes = create_test_notes()
        self.workflow.step_1_import_notes(notes)

        pending = self.import_service.get_pending_review_errors()
        target = next(
            e for e in pending
            if any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in e.boundary_violations)
        )
        eid = target.error_id
        bracket = target.bracket_id

        duration_before = target.sampling_duration_minutes
        status_before = target.status

        print(f"聚焦：支架{bracket}（{eid}）")
        print(f"   修改前：采样{duration_before}分钟，状态{status_before.value}")

        base_date = datetime(2026, 6, 1)
        fix_result = self.workflow.reviewer_fix_duration_issue(
            error_id=eid,
            new_sampling_start=base_date.replace(hour=8, minute=0),
            new_sampling_end=base_date.replace(hour=8, minute=35),
            reviewer="质检员小白",
            review_comment="测试：补全到35分钟",
        )
        self.assertTrue(fix_result.success)
        after_modify = self.import_service.get_error(eid)
        detail_after_modify = self.workflow.get_full_error_detail(eid)
        self.assertTrue(detail_after_modify["success"])

        print(f"   修改后：采样{after_modify.sampling_duration_minutes}分钟，"
              f"状态{after_modify.status.value}，"
              f"版本v{after_modify.version}，"
              f"历史条数{detail_after_modify['history_count']}")

        self.assertAlmostEqual(after_modify.sampling_duration_minutes, 35.0, places=1)
        self.assertGreaterEqual(detail_after_modify["history_count"], 1)

        pending_after_modify = self.import_service.get_pending_review_errors()
        pending_ids = {e.error_id for e in pending_after_modify}
        if after_modify.status == ErrorStatus.NORMAL:
            self.assertNotIn(eid, pending_ids, "修改达标后不应再在待复核列表中")

        summary_after_modify = self.viz_service.get_visualization_summary()
        self.assertEqual(
            summary_after_modify["by_status"]["normal"], 1 + 1,
            "摘要中正常数应增加一条"
        )

        chart_after_modify = self.viz_service.prepare_chart_data(ViewMode.CHART_3D)
        dp = next(d for d in chart_after_modify["data_points"] if d["error_id"] == eid)
        self.assertEqual(dp["status"], "正常", "3D图表点状态应同步为正常")

        packet = detail_after_modify["manual_review_packet"]
        self.assertIn("原始问题说法", packet)
        self.assertIn("改后的值", packet)
        self.assertIn("处理原因", packet)
        self.assertIn("下一步找谁", packet)
        self.assertTrue(packet["原始问题说法"], "原始问题说法不应为空")
        self.assertTrue(packet["改后的值"], "改后的值不应为空")
        self.assertTrue(
            "质检员" in packet["下一步找谁"] or "主管" in packet["下一步找谁"] or "归档" in packet["下一步找谁"],
            f"下一步找谁应明确，当前值：{packet['下一步找谁']}"
        )
        print(f"   人工复核信息包完整：原始说法/改后值/处理原因/下一步找谁 ✅")
        print(f"     → 下一步找谁：{packet['下一步找谁']}")

        report = self.workflow.export_report(error_ids=[eid])
        self.assertEqual(report["record_count"], 1, "报告应包含1条记录")
        self.assertIn(bracket, report["text"], "报告文本中应包含支架号")
        self.assertIn("原始问题说法", report["text"], "报告应包含人工复核信息")
        print(f"   导出报告：{report['record_count']}条，包含人工复核信息 ✅")

        rollback_result = self.workflow.rollback_modification(eid, "质检员小白")
        self.assertTrue(rollback_result.success)

        after_rollback = self.import_service.get_error(eid)
        detail_rollback = self.workflow.get_full_error_detail(eid)
        print(f"   回滚后：采样{after_rollback.sampling_duration_minutes}分钟，"
              f"状态{after_rollback.status.value}，"
              f"版本v{after_rollback.version}，"
              f"历史条数{detail_rollback['history_count']}")

        self.assertAlmostEqual(
            after_rollback.sampling_duration_minutes, duration_before, places=1)
        self.assertEqual(after_rollback.status, ErrorStatus.ROLLED_BACK)
        self.assertGreaterEqual(detail_rollback["history_count"], 2, "回滚后历史条数应至少2条")

        pending_ids_rollback = self.import_service.get_pending_review_errors()
        bracket_in_pending_after_rollback = any(
            e.bracket_id == bracket for e in pending_ids_rollback
        )
        has_duration_issue = any(
            v.startswith("SAMPLING_DURATION_TOO_SHORT")
            for v in after_rollback.boundary_violations
        )
        self.assertTrue(
            bracket_in_pending_after_rollback or has_duration_issue,
            "回滚后应恢复待复核/问题字段保持待处理"
        )

        summary_after_rollback = self.viz_service.get_visualization_summary()
        self.assertEqual(
            summary_after_rollback["by_status"]["rolled_back"], 1)
        print(f"   回滚后摘要同步：已回滚1条 ✅")

        print("✅ 修改→列表→详情→摘要→3D图→报告→回滚→再同步 全链路一致")

    def test_10_update_import_preserves_history_and_error_id(self):
        """测试：重新导入更新同note_id时，error_id和历史记录保留不丢"""
        print("\n" + "=" * 50)
        print("TEST 10: 更新导入保留error_id不变+历史不丢")
        print("=" * 50)
        base_date = datetime(2026, 6, 1)

        notes_v1 = [ManualInspectionNote(
            note_id="NOTE_UPDATE_01",
            inspection_date="2026-06-01",
            inspector="更新测试",
            bracket_id="BRACKET_UP_01",
            azimuth_error=1.0,
            elevation_error=0.5,
            sampling_start_time=base_date.replace(hour=8, minute=0),
            sampling_end_time=base_date.replace(hour=8, minute=15),
            tracking_accuracy=96.0,
            raw_content="更新测试v1：15分钟，更新测试",
        )]
        r1 = self.workflow.step_1_import_notes(notes_v1)
        self.assertTrue(r1.success)
        note_v1_hash = notes_v1[0].content_hash()
        eid_1 = self.import_service._error_by_note_hash.get(note_v1_hash)
        self.assertIsNotNone(eid_1, "v1导入后应能找到error_id")
        hc1 = len(self.import_service.get_error_history(eid_1))
        print(f"   v1导入：error_id={eid_1}，历史条数={hc1}")

        notes_v2 = [ManualInspectionNote(
            note_id="NOTE_UPDATE_01",
            inspection_date="2026-06-01",
            inspector="更新测试",
            bracket_id="BRACKET_UP_01",
            azimuth_error=1.0,
            elevation_error=0.5,
            sampling_start_time=base_date.replace(hour=8, minute=0),
            sampling_end_time=base_date.replace(hour=8, minute=45),
            tracking_accuracy=96.0,
            raw_content="更新测试v2：45分钟，达标",
        )]
        r2 = self.workflow.step_1_import_notes(notes_v2)
        self.assertTrue(r2.success)
        note_v2_hash = notes_v2[0].content_hash()
        eid_2 = self.import_service._error_by_note_hash.get(note_v2_hash)
        self.assertIsNotNone(eid_2, "v2更新导入后应能找到error_id")
        hc2 = len(self.import_service.get_error_history(eid_2))
        print(f"   v2更新导入：error_id={eid_2}，历史条数={hc2}")

        self.assertEqual(eid_1, eid_2, "更新导入前后error_id必须相同")
        self.assertGreaterEqual(hc2, 1, "更新导入必须保留历史")

        err_after = self.import_service.get_error(eid_2)
        self.assertAlmostEqual(err_after.sampling_duration_minutes, 45.0, places=1)
        print("✅ 更新导入：error_id复用+历史保留+数据正确")

        r3 = self.workflow.step_1_import_notes(notes_v2)
        hc3 = len(self.import_service.get_error_history(eid_1))
        print(f"   v3完全重复导入：历史条数={hc3}，重复跳过")
        import_info = r3.data.get("import_result", {})
        dup_count = import_info.get("duplicate", 0)
        dup_skipped = getattr(r3, "duplicate_errors_skipped", 0)
        total_dup = dup_count + dup_skipped
        self.assertGreaterEqual(total_dup, 1, "完全重复导入应有重复跳过计数")
        self.assertEqual(hc2, hc3, "完全重复导入不新增历史")
        print("✅ 完全重复导入：不新增历史+数量不翻倍")


if __name__ == "__main__":
    unittest.main(verbosity=2)
