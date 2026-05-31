#!/usr/bin/env python3
import sys
sys.path.insert(0, '/Users/lzy/pro/solo/workspaces/zy71879')

from datetime import datetime, timedelta
from param_tracker import ChangeType, ParamTracker, SourceType, VersionConflictError

OUTPUT_FILE = "/Users/lzy/pro/solo/workspaces/zy71879/test_output_final.txt"


def log(msg):
    with open(OUTPUT_FILE, "a", encoding="utf-8") as f:
        f.write(msg + "\n")
    print(msg)


def main():
    # 清空文件
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("")

    log("=" * 60)
    log("  舆情扩散参数追溯系统 - 完整验证")
    log("  验证时间: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    log("=" * 60)

    tracker = ParamTracker(project_name="舆情扩散参数")
    passed = 0
    failed = 0

    # 场景1: 结果图先到，录入初始参数
    log("\n【场景1】结果图先到，录入扩散系数和传播阈值")
    try:
        tracker.register_data_source(
            source_id="fig_diffusion_v1",
            source_type=SourceType.RESULT_FIGURE,
            description="扩散系数结果图（第一批）",
            content={"扩散系数": 0.35, "样本量": 120},
        )
        tracker.add_param(
            name="扩散系数",
            value=0.35,
            unit="1/h",
            source_type=SourceType.RESULT_FIGURE,
            source_id="fig_diffusion_v1",
            source_description="结果图第一批，120样本",
            conclusion="舆情在3小时内可覆盖30%目标人群",
        )

        tracker.register_data_source(
            source_id="fig_threshold_v1",
            source_type=SourceType.RESULT_FIGURE,
            description="传播阈值结果图",
            content={"传播阈值": 0.12},
        )
        tracker.add_param(
            name="传播阈值",
            value=0.12,
            unit="无量纲",
            source_type=SourceType.RESULT_FIGURE,
            source_id="fig_threshold_v1",
            source_description="传播阈值结果图",
            conclusion="低于0.12不会形成大规模传播",
        )

        assert tracker.params["扩散系数"].value == 0.35
        assert tracker.params["扩散系数"].conclusion == "舆情在3小时内可覆盖30%目标人群"
        assert tracker.params["扩散系数"].has_conclusion_changes is False, "初始录入不应算结论变更"
        assert tracker.params["传播阈值"].has_conclusion_changes is False, "传播阈值只有初始录入"

        log("  [PASS] 扩散系数=0.35 1/h, 传播阈值=0.12")
        passed += 1
    except AssertionError as e:
        log(f"  [FAIL] {e}")
        failed += 1

    # 场景2: 实验数据晚补——仅补材料，不改结论
    log("\n【场景2】实验数据晚补——补材料，不改结论")
    try:
        tracker.register_data_source(
            source_id="exp_diffusion_v1",
            source_type=SourceType.EXPERIMENTAL_DATA,
            description="扩散系数实验数据（补充）",
            content={
                "扩散系数": 0.35,
                "样本量": 120,
                "置信区间": "0.32-0.38",
                "p值": 0.003,
            },
        )
        tracker.update_param(
            name="扩散系数",
            new_value=0.35,
            source_type=SourceType.EXPERIMENTAL_DATA,
            source_id="exp_diffusion_v1",
            source_description="实验数据补传，含置信区间",
            change_type=ChangeType.SUPPLEMENT,
            note="补传实验数据，数值与结果图一致，仅增补置信区间",
            affects_conclusion=False,
        )

        assert tracker.params["扩散系数"].value == 0.35
        assert tracker.params["扩散系数"].has_conclusion_changes is False
        assert len(tracker.params["扩散系数"].supplement_changes) == 1
        assert len(tracker.params["扩散系数"].conclusion_changes) == 0

        log("  [PASS] 补传实验数据，标记为补材料，结论未变")
        passed += 1
    except AssertionError as e:
        log(f"  [FAIL] {e}")
        failed += 1

    # 场景3: 约束说明手工改动——改了结论（单位混用修正）
    log("\n【场景3】约束说明手工改动——真的改了结论(单位混用)")
    try:
        tracker.register_data_source(
            source_id="constraint_v1",
            source_type=SourceType.CONSTRAINT_SPEC,
            description="单位约束说明（初版）",
            content={"时间单位": "小时", "扩散系数单位": "1/h"},
        )
        tracker.register_data_source(
            source_id="constraint_v2",
            source_type=SourceType.CONSTRAINT_SPEC,
            description="单位约束说明（修正版）",
            content={"时间单位": "分钟", "扩散系数单位": "1/min"},
        )
        tracker.update_param(
            name="扩散系数",
            new_value=0.00583,
            source_type=SourceType.CONSTRAINT_SPEC,
            source_id="constraint_v2",
            source_description="约束说明修正：时间单位从小时改为分钟",
            change_type=ChangeType.CONCLUSION_CHANGE,
            note="单位混用修正! 原0.35 1/h -> 0.00583 1/min，结论中时间覆盖范围需重算",
            affects_conclusion=True,
        )

        assert tracker.params["扩散系数"].value == 0.00583
        assert tracker.params["扩散系数"].has_conclusion_changes is True
        assert len(tracker.params["扩散系数"].conclusion_changes) == 1
        assert "结论因参数变更而更新" in tracker.params["扩散系数"].conclusion
        assert tracker.params["扩散系数"].unit == "1/h"  # 单位保留原值，可根据需要另外改

        log("  [PASS] 约束说明修正，扩散系数0.35->0.00583，结论已变更")
        passed += 1
    except AssertionError as e:
        log(f"  [FAIL] {e}")
        failed += 1

    # 场景4: 补传旧版实验数据——版本冲突检测
    log("\n【场景4】补传旧版实验数据——触发版本冲突告警")
    try:
        old_time = datetime.now() - timedelta(days=3)
        result, conflict = tracker.register_data_source_safe(
            source_id="exp_diffusion_v1",
            source_type=SourceType.EXPERIMENTAL_DATA,
            description="扩散系数实验数据（旧版误传）",
            content={
                "扩散系数": 0.28,
                "样本量": 80,
                "置信区间": "0.24-0.32",
                "p值": 0.012,
            },
            timestamp=old_time,
        )

        assert result is None, "应返回 None 表示冲突"
        assert conflict is not None, "应返回冲突详情"
        assert conflict["source_id"] == "exp_diffusion_v1"
        assert "diff" in conflict
        assert len(conflict["diff"]) > 0

        log("  [PASS] 版本冲突检测成功!")
        log(f"       数据源: {conflict['source_id']}")
        log(f"       差异: {conflict['diff']}")
        passed += 1
    except AssertionError as e:
        log(f"  [FAIL] {e}")
        failed += 1

    # 场景5: 新增参数，仅补材料
    log("\n【场景5】新增衰减因子，仅补材料")
    try:
        tracker.register_data_source(
            source_id="fig_decay_v1",
            source_type=SourceType.RESULT_FIGURE,
            description="衰减因子结果图",
            content={"衰减因子": 0.08},
        )
        tracker.add_param(
            name="衰减因子",
            value=0.08,
            unit="1/h",
            source_type=SourceType.RESULT_FIGURE,
            source_id="fig_decay_v1",
            source_description="衰减因子结果图",
            conclusion="舆情热度24小时后衰减至约15%",
        )

        tracker.register_data_source(
            source_id="exp_decay_v1",
            source_type=SourceType.EXPERIMENTAL_DATA,
            description="衰减因子实验数据（补传）",
            content={"衰减因子": 0.08, "样本量": 95, "置信区间": "0.06-0.10"},
        )
        tracker.update_param(
            name="衰减因子",
            new_value=0.08,
            source_type=SourceType.EXPERIMENTAL_DATA,
            source_id="exp_decay_v1",
            source_description="衰减因子实验数据补传",
            change_type=ChangeType.SUPPLEMENT,
            note="补传实验数据，数值一致，仅增补置信区间和样本量",
            affects_conclusion=False,
        )

        assert tracker.params["衰减因子"].value == 0.08
        assert tracker.params["衰减因子"].has_conclusion_changes is False
        assert len(tracker.params["衰减因子"].supplement_changes) == 1
        assert len(tracker.params["衰减因子"].conclusion_changes) == 0

        log("  [PASS] 衰减因子=0.08 1/h，实验数据补传，标记为仅补材料")
        passed += 1
    except AssertionError as e:
        log(f"  [FAIL] {e}")
        failed += 1

    # 场景6: 结论追溯
    log("\n【场景6】结论追溯：扩散系数 -> 查到依据在哪")
    try:
        trace = tracker.trace_conclusion("扩散系数")

        assert trace["参数名"] == "扩散系数"
        assert trace["当前值"] == 0.00583
        assert len(trace["追溯链"]) == 3  # 初始+补材料+改结论

        # 追溯链从最新到最早
        assert trace["追溯链"][0]["变更类型"] == "改结论"
        assert trace["追溯链"][0]["旧值"] == 0.35
        assert trace["追溯链"][0]["新值"] == 0.00583
        assert trace["追溯链"][0]["是否影响结论"] is True
        assert "单位混用修正" in trace["追溯链"][0]["备注"]

        assert trace["追溯链"][1]["变更类型"] == "补材料"
        assert trace["追溯链"][1]["是否影响结论"] is False

        assert trace["追溯链"][2]["变更类型"] == "初始录入"
        assert trace["追溯链"][2]["是否影响结论"] is True

        # 检查数据源快照
        assert "数据源快照" in trace["追溯链"][0]
        assert trace["追溯链"][0]["数据源快照"]["时间单位"] == "分钟"

        log("  [PASS] 追溯链完整：")
        for step in trace["追溯链"]:
            flag = " [!]影响结论" if step["是否影响结论"] and step["变更类型"] != "初始录入" else ""
            log(f"       [{step['变更类型']}] {step['旧值']} -> {step['新值']} | 来源: {step['来源类型']}/{step['来源ID']}{flag}")
            if step["备注"]:
                log(f"          备注: {step['备注']}")
        passed += 1
    except AssertionError as e:
        log(f"  [FAIL] {e}")
        failed += 1

    # 场景7: 汇总信息
    log("\n【场景7】汇总信息")
    try:
        summary = tracker.get_conclusion_summary()

        assert summary["项目"] == "舆情扩散参数"
        assert summary["参数总数"] == 3
        assert len(summary["有结论的参数"]) == 3
        assert len(summary["有结论变更的参数"]) == 1
        assert len(summary["仅为补材料的变更"]) == 1  # 衰减因子
        assert len(summary["版本冲突数据源"]) == 1
        assert summary["有结论变更的参数"][0]["参数名"] == "扩散系数"
        assert summary["仅为补材料的变更"][0]["参数名"] == "衰减因子"

        log(f"  [PASS] 汇总正确: 参数总数={summary['参数总数']}, 结论变更={len(summary['有结论变更的参数'])}, 仅补材料={len(summary['仅为补材料的变更'])}, 版本冲突={len(summary['版本冲突数据源'])}")
        passed += 1
    except AssertionError as e:
        log(f"  [FAIL] {e}")
        failed += 1

    # 场景8: 导出文档
    log("\n【场景8】导出模型说明")
    try:
        doc = tracker.export_documentation()

        # 验证关键内容
        assert "舆情扩散参数 -- 模型说明" in doc
        assert "【一、参数总览】" in doc
        assert "【二、变更分类 -- 哪些是补材料，哪些改了结论】" in doc
        assert "【三、结论追溯 -- 从结论查到依据】" in doc
        assert "【四、数据源版本 -- 注意时间线异常】" in doc
        assert "【五、下一班注意事项】" in doc
        assert "扩散系数: 0.00583 1/h [[结论已变更]]" in doc
        assert "传播阈值: 0.12 无量纲" in doc
        assert "[[仅补材料]]" in doc
        assert "时间线异常" in doc
        assert "0.35 -> 0.00583" in doc
        assert "不必翻聊天记录" in doc

        # 确保传播阈值没有被误标为结论已变更
        assert "传播阈值: 0.12 无量纲 [[结论已变更]]" not in doc

        # 检查衰减因子是否标记为仅补材料
        assert "衰减因子: 0.08 1/h [[仅补材料]]" in doc

        log("  [PASS] 文档导出成功，包含所有关键内容")

        # 导出到文件
        output_path = "/Users/lzy/pro/solo/workspaces/zy71879/舆情扩散参数_模型说明.txt"
        tracker.export_documentation(output_path=output_path)

        log(f"  [PASS] 文档已保存到: {output_path}")

        # 在日志中打印文档
        log("\n" + "=" * 60)
        log("  导出的模型说明文档")
        log("=" * 60)
        log(doc)
        passed += 1
    except AssertionError as e:
        log(f"  [FAIL] {e}")
        failed += 1

    # 结果汇总
    log("\n" + "=" * 60)
    log(f"  验证结果: {passed} 通过, {failed} 失败")
    log("=" * 60)

    if failed > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
