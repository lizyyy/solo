#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
C001 跨会话暂停续局全链路验证脚本
=====================================
覆盖：
  ① 打开入口 → 第一次导入抽样名单(C001 参数=10 阈值=10 边界值)
  ② 补录/导入参数调试表(C001 参数=12 阈值=15 冲突) → 提案暂存 proposed_*
  ③ 保存暂停（save_state） → 模拟退出
  ④ 重新打开（新建 tracker） → load_state 继续处理
  ⑤ 吴老师确认「以参数调试表为准」→ 同步参数值 / 重算根 / 重判边界
  ⑥ 刷新重算、查看反例列表、查看历史记录
  ⑦ 生成报告 + 导出，核对所有字段来自同一条 C001 记录
  ⑧ 再保存 → 再加载 → 确认 C001 全部状态一致
"""
import os
import json
import warnings
import tempfile
import shutil

from root_tracker import NonlinearRootTracker
from models import (
    SampleStatus, ImportSource, ConflictType, AntiExampleStatus
)
from errors import ConflictDetectedError, BoundaryValueWarning

SAMPLE_ID = "C001"

SAMPLE_LIST = [
    {"sample_id": SAMPLE_ID, "equation_param": 10.0, "threshold": 10.0}
]

PARAMETER_TABLE = [
    {"sample_id": SAMPLE_ID, "equation_param": 12.0, "threshold": 15.0,
     "notes": "调试表修正,有教研主任签字"}
]


def print_step(n, title):
    print("\n" + "=" * 72)
    print(f"  STEP {n}: {title}")
    print("=" * 72)


def assert_eq(actual, expected, msg):
    if actual != expected:
        raise AssertionError(f"{msg}: expected={expected}, actual={actual}")
    print(f"  ✅ {msg}: {actual}")


def assert_in(sub, text, msg):
    if sub not in str(text):
        raise AssertionError(f"{msg}: '{sub}' not found in '{text}'")
    print(f"  ✅ {msg}")


def main():
    tmpdir = tempfile.mkdtemp(prefix="tracker_e2e_")
    SAVE_FILE = os.path.join(tmpdir, "tracker_state.json")
    EXPORT_SAMPLE = os.path.join(tmpdir, "c001_sample.json")
    EXPORT_REPORT = os.path.join(tmpdir, "c001_report.json")

    try:
        # ================================================================
        print_step(1, "打开入口 → 第一次导入抽样名单（C001 参数=10 阈值=10 边界值）")
        # ================================================================
        tracker = NonlinearRootTracker()
        assert not tracker.has_saved_state(SAVE_FILE), "初始无保存文件"

        with warnings.catch_warnings(record=True) as w:
            warnings.simplefilter("always")
            imported = tracker.import_sample_list(SAMPLE_LIST, "张老师")
            boundary_warnings = [x for x in w if issubclass(x.category, BoundaryValueWarning)]
            assert_eq(len(boundary_warnings), 1, "导入后边界值警告数")

        assert_eq(len(imported), 1, "导入样本数")
        s = tracker.get_sample(SAMPLE_ID)
        assert_eq(s.sample_id, SAMPLE_ID, "sample_id")
        assert_eq(s.equation_param, 10.0, "当前 equation_param")
        assert_eq(s.threshold, 10.0, "当前 threshold")
        assert_eq(s.original_equation_param, 10.0, "原始快照 original_equation_param")
        assert_eq(s.original_threshold, 10.0, "原始快照 original_threshold")
        assert_eq(s.status, SampleStatus.PENDING_REVIEW, "初始状态")
        assert_eq(s.is_boundary_case, True, "is_boundary_case=True")
        assert_eq(s.next_handler, "任课老师", "初始下一步：任课老师")
        assert_eq(len(tracker.get_pending_review()), 1, "待任课复核列表长度")
        assert_eq(len(tracker.get_anti_examples()), 1, "反例列表(边界值)")
        assert_eq(tracker.get_anti_examples()[0].status, AntiExampleStatus.OPEN, "反例=OPEN")

        # ================================================================
        print_step(2, "补录参数调试表（C001 参数=12 阈值=15） → 冲突暂存 proposed_*")
        # ================================================================
        with warnings.catch_warnings(record=True):
            warnings.simplefilter("always")
            try:
                tracker.import_parameter_table(PARAMETER_TABLE, "吴老师")
                print("  ⚠️  未抛出 ConflictDetectedError（异常）")
            except ConflictDetectedError as e:
                print(f"  ✅ 抛出 ConflictDetectedError：{e.message}")

        s = tracker.get_sample(SAMPLE_ID)
        assert_eq(s.proposed_equation_param, 12.0, "proposed_equation_param 暂存")
        assert_eq(s.proposed_threshold, 15.0, "proposed_threshold 暂存")
        assert_in("调试表修正", s.proposed_notes, "proposed_notes 有备注")
        # 当前值仍是抽样名单值
        assert_eq(s.equation_param, 10.0, "确认未转正，当前 equation_param 还是 10.0")
        assert_eq(len(tracker.get_conflicts(resolved=False)), 3,
                  "冲突证据数=3 (参数/阈值/边界状态)")
        assert_eq(s.next_handler, "吴老师（处理冲突）", "下一步=吴老师")
        assert_eq(SAMPLE_ID in tracker.get_unresolved_samples(), True,
                  "C001 在未处理冲突集合中")
        assert_eq(len(tracker.get_anti_examples()), 4,
                  "反例数=4：1边界值+3冲突")
        open_antis = tracker.get_anti_examples(status=AntiExampleStatus.OPEN)
        assert_eq(len(open_antis), 4, "4 个反例都是 OPEN")

        # ================================================================
        print_step(3, "保存暂停 → 写盘 tracker_state.json，模拟退出会话")
        # ================================================================
        save_path = tracker.save_state(SAVE_FILE)
        print(f"  💾 已保存到 {save_path}")
        assert os.path.exists(save_path), "保存文件应存在"

        with open(save_path, encoding="utf-8") as f:
            raw = json.load(f)
        assert_eq(raw.get("version"), 1, "持久化版本号")
        assert_eq(len(raw["samples"]), 1, "持久化样本数=1")
        assert_eq(raw["samples"][SAMPLE_ID]["proposed_equation_param"], 12.0,
                  "持久化 proposed_equation_param")
        assert_eq(len(raw["unresolved_samples"]), 1, "持久化 unresolved_samples")
        assert_eq(len(raw["anti_examples"]), 4, "持久化 anti_examples=4")
        assert_eq(len(raw["history"]), 2, "持久化历史=2 条（导入抽样名单 + 导入参数调试表）")
        assert os.path.getsize(save_path) > 0, "保存文件非空"

        # 清空内存中 tracker（模拟退出进程）
        del tracker

        # ================================================================
        print_step(4, "重新进入（新建 tracker）→ load_state 从断点接着走")
        # ================================================================
        tracker2 = NonlinearRootTracker()
        assert tracker2.has_saved_state(SAVE_FILE), "重新进入时 has_saved_state=True"
        loaded = tracker2.load_state(SAVE_FILE)
        assert loaded, "load_state 成功"

        s2 = tracker2.get_sample(SAMPLE_ID)
        assert s2 is not None, "C001 在重新进入后仍然存在"
        assert_eq(s2.equation_param, 10.0, "重新加载后 equation_param=10.0")
        assert_eq(s2.proposed_equation_param, 12.0, "重新加载后 proposed_equation_param=12.0")
        assert_eq(s2.proposed_threshold, 15.0, "重新加载后 proposed_threshold=15.0")
        assert_eq(s2.original_equation_param, 10.0, "重新加载后 original_* 仍在")
        assert_eq(s2.status, SampleStatus.PENDING_REVIEW, "重新加载后 status=待任课老师复核")
        assert_eq(SAMPLE_ID in tracker2.get_unresolved_samples(), True,
                  "重新加载后 unresolved_samples 仍包含 C001")
        assert_eq(len(tracker2.get_conflicts(resolved=False)), 3,
                  "重新加载后未解决冲突仍=3")
        assert_eq(len(tracker2.get_anti_examples()), 4,
                  "重新加载后反例仍=4")
        assert_eq(len(tracker2.get_history()), 2,
                  "重新加载后历史记录仍=2")
        print("  ✅ 重新进入后所有待处理状态、提案值、C001 记录完整恢复")

        # ================================================================
        print_step(5, "吴老师确认「以参数调试表为准」→ 全链路同步更新")
        # ================================================================
        resolved = tracker2.resolve_conflict(
            SAMPLE_ID, confirm=True, operator="吴老师",
            reason="参数调试表有教研主任签字,以参数调试表为准"
        )
        assert_eq(len(resolved), 3, "本次解决冲突数=3")
        for c in resolved:
            assert_eq(c.resolved, True, f"冲突{c.conflict_type.value} resolved=True")
            assert_in("确认", c.resolution, "resolution 包含'确认'")
            assert_in("参数调试表为准", c.resolution, "resolution 包含'参数调试表为准'")

        s2 = tracker2.get_sample(SAMPLE_ID)
        # 核心断言：确认后当前值转正
        assert_eq(s2.equation_param, 12.0, "确认后 equation_param → 12.0")
        assert_eq(s2.threshold, 15.0, "确认后 threshold → 15.0")
        # 原始快照不变
        assert_eq(s2.original_equation_param, 10.0, "确认后 original_* 仍=10.0")
        assert_eq(s2.original_threshold, 10.0, "确认后 original_threshold 仍=10.0")
        # 提案值清空
        assert_eq(s2.proposed_equation_param, None, "proposed_equation_param 转正后清空")
        assert_eq(s2.proposed_threshold, None, "proposed_threshold 转正后清空")
        # 根值重算
        import math
        expected_root = round(math.sqrt(12.0), 6)
        assert abs(s2.root_value - expected_root) < 1e-6, \
            f"根值重算应={expected_root}, 实际={s2.root_value}"
        # 边界值重新判断：12.0 vs 15.0 → 不是边界
        assert_eq(s2.is_boundary_case, False, "确认后 is_boundary_case=False")
        assert_eq(s2.status, SampleStatus.CONFIRMED, "确认后 status=吴老师确认")
        assert_eq(s2.next_handler, None, "确认后 next_handler 清空")
        assert_in("教研主任签字", s2.resolution_reason,
                  "resolution_reason 保留处理原因")
        assert_in("原始:参数=10.0", s2.notes,
                  "notes 保留原始说法")
        assert_in("改为:参数=12.0", s2.notes,
                  "notes 保留改后值")
        assert s2.reviewer == "吴老师", f"reviewer=吴老师 actual={s2.reviewer}"
        assert s2.review_time is not None, "review_time 已写"
        # 待处理集合清空
        assert SAMPLE_ID not in tracker2.get_unresolved_samples(), \
            "C001 从 unresolved_samples 移除"
        assert_eq(len(tracker2.get_conflicts(resolved=False)), 0,
                  "未解决冲突=0")

        # ================================================================
        print_step(6, "刷新重算、查看反例列表、查看历史记录")
        # ================================================================
        recalc = tracker2.recalculate_after_supplement("吴老师")
        print(f"  🔄 补录后重算队列（本场景没有补录重算，样本数={len(recalc)}）")

        # 反例列表：边界值反例+3个冲突反例都应 RESOLVED
        all_antis = tracker2.get_anti_examples()
        assert_eq(len(all_antis), 4, "反例总数仍是 4")
        resolved_antis = tracker2.get_anti_examples(status=AntiExampleStatus.RESOLVED)
        assert_eq(len(resolved_antis), 4, "4 个反例全部 RESOLVED")
        for ae in resolved_antis:
            assert ae.resolved_by == "吴老师", f"解决人=吴老师 actual={ae.resolved_by}"
            assert ae.resolution_note is not None, "resolution_note 已写"
            assert ae.resolved_time is not None, "resolved_time 已写"
        print("  ✅ 反例列表：全部已解决，解决人/解决说明/解决时间齐全")

        # 历史记录：应=3 条（导入抽样名单 / 导入参数调试表暂存 / 吴老师确认）
        history = tracker2.get_history()
        assert_eq(len(history), 3, "历史记录数=3")
        last = history[-1]
        assert_in("处理冲突", last.operation, "最后一条是'吴老师处理冲突'")
        assert_eq(last.details.get("old_equation_param"), 10.0, "history old_param=10.0")
        assert_eq(last.details.get("new_equation_param"), 12.0, "history new_param=12.0")
        assert_in("old_status", last.details, "history 包含 old_status")
        assert_in("new_status", last.details, "history 包含 new_status")
        assert_eq(last.details.get("conflicts_resolved_count"), 3, "本次解决冲突数=3")
        print("  ✅ 历史记录：old→new 完整快照、操作人、冲突数齐全")

        # ================================================================
        print_step(7, "生成报告 + 导出 → 所有字段来自同一条 C001 记录")
        # ================================================================
        report = tracker2.export_report(include_self_check_in_summary=True)
        summary = report["summary"]
        assert_eq(summary["total_samples"], 1, "报告摘要：样本=1")
        assert_eq(summary["unresolved_conflicts"], 0, "报告摘要：未解决冲突=0")
        assert_eq(summary["anti_examples_open"], 0, "报告摘要：未解决反例=0")
        assert_eq(summary["anti_examples_resolved"], 4, "报告摘要：已解决反例=4")
        assert_eq(summary["self_check_passed"], True, "报告摘要：自检=True")

        sample_in_report = report["samples"][0]
        assert_eq(sample_in_report["sample_id"], SAMPLE_ID, "报告样本 sample_id=C001")
        assert_eq(sample_in_report["equation_param"], 12.0, "报告样本 equation_param=12.0")
        assert_eq(sample_in_report["original_equation_param"], 10.0, "报告 original_equation_param=10.0")
        assert_in("resolution_reason", sample_in_report, "报告包含 resolution_reason")
        assert_in("next_handler", sample_in_report, "报告包含 next_handler")
        assert len(report["conflicts"]) == 3, "报告 conflicts=3"
        for c in report["conflicts"]:
            assert c["resolved"] is True, f"报告冲突{c['conflict_type']}已解决"
        assert len(report["anti_examples"]) == 4, "报告 anti_examples=4"
        for ae in report["anti_examples"]:
            assert ae["status"] == AntiExampleStatus.RESOLVED.value, "反例=已解决"
        assert len(report["history"]) == 3, "报告 history=3"
        assert len(report["self_check_results"]) == 4, "报告自检=4项"

        with open(EXPORT_REPORT, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(f"  📑 完整报告 → {EXPORT_REPORT}")

        # export_data 也要对齐
        exported = tracker2.export_data()
        assert_eq(len(exported), 1, "export_data 样本=1")
        first = exported[0]
        assert_eq(first["sample_id"], SAMPLE_ID, "导出 sample_id=C001")
        assert_eq(first["equation_param"], 12.0, "导出 equation_param=12.0")
        assert_eq(first["original_equation_param"], 10.0, "导出 original=10.0")
        assert_in("resolution_reason", first, "导出含 resolution_reason")
        with open(EXPORT_SAMPLE, "w", encoding="utf-8") as f:
            json.dump(exported, f, ensure_ascii=False, indent=2)
        print(f"  📤 样本导出 → {EXPORT_SAMPLE}")

        # ================================================================
        print_step(8, "再保存 → 再加载 → 最终核对 C001 跨会话一致性")
        # ================================================================
        tracker2.save_state(SAVE_FILE)
        del tracker2

        tracker3 = NonlinearRootTracker()
        assert tracker3.load_state(SAVE_FILE), "二次加载成功"
        s3 = tracker3.get_sample(SAMPLE_ID)
        checks = [
            ("sample_id", s3.sample_id, SAMPLE_ID),
            ("equation_param", s3.equation_param, 12.0),
            ("threshold", s3.threshold, 15.0),
            ("original_equation_param", s3.original_equation_param, 10.0),
            ("original_threshold", s3.original_threshold, 10.0),
            ("status", s3.status, SampleStatus.CONFIRMED),
            ("proposed_equation_param", s3.proposed_equation_param, None),
            ("is_boundary_case", s3.is_boundary_case, False),
            ("reviewer", s3.reviewer, "吴老师"),
            ("next_handler", s3.next_handler, None),
        ]
        for name, actual, expected in checks:
            assert_eq(actual, expected, f"二次加载后 {name}")

        assert_eq(len(tracker3.get_conflicts(resolved=False)), 0, "二次加载未解决冲突=0")
        assert_eq(len(tracker3.get_anti_examples(status=AntiExampleStatus.RESOLVED)), 4,
                  "二次加载已解决反例=4")
        assert_eq(len(tracker3.get_history()), 3, "二次加载历史=3")

        # 最后跑一次自检
        self_results = tracker3.run_self_check()
        for r in self_results:
            assert r.passed, f"自检【{r.check_name}】未通过：{r.message}"
        print("  ✅ 4 项自检全部通过")

        # ================================================================
        print("\n" + "=" * 72)
        print("  ✅ C001 跨会话暂停续局全链路验证全部通过 ✅")
        print("=" * 72)
        print(f"  持久化文件: {SAVE_FILE}")
        print(f"  样本导出:   {EXPORT_SAMPLE}")
        print(f"  完整报告:   {EXPORT_REPORT}")
        print()
        print("  覆盖节点：")
        print("    ① 打开入口 + 抽样名单第一次导入（原始快照自动保存）")
        print("    ② 补录/导入参数调试表（冲突暂存 proposed_* + 待处理标记）")
        print("    ③ 保存暂停退出（写 tracker_state.json）")
        print("    ④ 重新进入自动加载（待处理项、提案值、C001 原始/当前值完整恢复）")
        print("    ⑤ 吴老师确认-以参数调试表为准 → 同步参数/根/边界/状态/反例/历史")
        print("    ⑥ 刷新重算、反例列表、历史记录核对")
        print("    ⑦ 报告与导出：原始说法/改后值/处理原因/处理人/下一步同一条记录")
        print("    ⑧ 再次保存加载 → 状态完全一致 + 四项自检全过")
        print()
    finally:
        # 清理临时目录（若要保留文件可注释下面两行）
        # shutil.rmtree(tmpdir, ignore_errors=True)
        print(f"  📁 验证 artifacts 保留在: {tmpdir}")


if __name__ == "__main__":
    warnings.filterwarnings("always", category=BoundaryValueWarning)
    main()
