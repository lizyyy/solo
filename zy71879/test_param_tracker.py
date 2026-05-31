from datetime import datetime, timedelta
import sys

from param_tracker import (
    ChangeType,
    ParamTracker,
    SourceType,
)


def run_tests():
    print("=" * 60)
    print("  测试: 舆情扩散参数追溯系统")
    print("=" * 60)

    tracker = ParamTracker(project_name="舆情扩散参数")
    errors = []

    # 测试1: 初始录入参数
    print("\n[1/5] 初始录入参数(来源:结果图)")
    tracker.register_data_source("fig1", SourceType.RESULT_FIGURE, "扩散系数结果图", {"值": 0.35, "样本量": 120})
    tracker.add_param("扩散系数", 0.35, unit="1/h", source_type=SourceType.RESULT_FIGURE, source_id="fig1",
                      source_description="扩散系数结果图v1", conclusion="3小时覆盖30%")
    assert tracker.params["扩散系数"].value == 0.35
    assert tracker.params["扩散系数"].conclusion == "3小时覆盖30%"
    assert tracker.params["扩散系数"].has_conclusion_changes is False  # 初始录入不算变更
    print("  PASS")

    # 测试2: 补材料 - 不影响结论
    print("\n[2/5] 补传实验数据(补材料，不改结论)")
    tracker.register_data_source("exp1", SourceType.EXPERIMENTAL_DATA, "扩散系数实验数据", {"值": 0.35, "置信区间": "0.32-0.38"})
    tracker.update_param("扩散系数", 0.35, SourceType.EXPERIMENTAL_DATA, "exp1",
                         change_type=ChangeType.SUPPLEMENT, note="补传实验数据", affects_conclusion=False)
    assert tracker.params["扩散系数"].value == 0.35
    assert tracker.params["扩散系数"].has_conclusion_changes is False
    assert len(tracker.params["扩散系数"].supplement_changes) == 1
    print("  PASS")

    # 测试3: 改结论 - 约束说明手工改动(单位混用修正)
    print("\n[3/5] 约束说明改动(真的改结论)")
    tracker.register_data_source("cs1", SourceType.CONSTRAINT_SPEC, "单位约束说明修正版", {"时间单位": "分钟", "扩散系数单位": "1/min"})
    tracker.update_param("扩散系数", 0.00583, SourceType.CONSTRAINT_SPEC, "cs1",
                         change_type=ChangeType.CONCLUSION_CHANGE,
                         note="单位混用修正! h->min, 0.35 1/h -> 0.00583 1/min",
                         affects_conclusion=True)
    assert tracker.params["扩散系数"].value == 0.00583
    assert tracker.params["扩散系数"].has_conclusion_changes is True
    assert len(tracker.params["扩散系数"].conclusion_changes) == 1
    assert "结论因参数变更而更新" in tracker.params["扩散系数"].conclusion
    print("  PASS")

    # 测试4: 版本冲突检测 - 补传旧版实验数据
    print("\n[4/5] 版本冲突检测(补传旧版实验数据)")
    old_time = datetime.now() - timedelta(days=3)
    tracker.register_data_source("exp1", SourceType.EXPERIMENTAL_DATA, "实验数据最新版", {"值": 0.35, "样本量": 150, "p值": 0.001})
    result, conflict = tracker.register_data_source_safe("exp1", SourceType.EXPERIMENTAL_DATA, "实验数据旧版",
                                                         {"值": 0.28, "样本量": 80}, timestamp=old_time)
    assert result is None
    assert conflict is not None
    assert conflict["source_id"] == "exp1"
    assert "扩散系数" in conflict["diff"] or "值" in conflict["diff"] or "样本量" in conflict["diff"]
    print(f"  PASS - 冲突检测成功，差异: {conflict['diff']}")

    # 测试5: 结论追溯
    print("\n[5/5] 结论追溯(从结论点回数据源)")
    trace = tracker.trace_conclusion("扩散系数")
    assert trace["参数名"] == "扩散系数"
    assert trace["当前值"] == 0.00583
    assert len(trace["追溯链"]) == 3  # 初始+补材料+改结论
    assert trace["追溯链"][0]["变更类型"] == "改结论"  # 最新的在最前面
    assert trace["追溯链"][0]["是否影响结论"] is True
    assert trace["追溯链"][1]["变更类型"] == "补材料"
    assert trace["追溯链"][2]["变更类型"] == "初始录入"
    print(f"  PASS - 追溯链长度={len(trace['追溯链'])}")

    # 测试6: 导出文档
    print("\n[6/5] 导出模型说明文档")
    doc = tracker.export_documentation()
    assert "舆情扩散参数" in doc
    assert "改了结论的参数" in doc
    assert "仅补材料" in doc
    assert "时间线异常" in doc
    assert "扩散系数" in doc
    assert "0.35 -> 0.00583" in doc
    print("  PASS")

    # 测试7: 汇总信息
    print("\n[7/5] 汇总信息")
    tracker.add_param("传播阈值", 0.12, unit="无量纲", source_type=SourceType.RESULT_FIGURE, source_id="fig2",
                      source_description="传播阈值结果图", conclusion="低于0.12不会大规模传播")
    tracker.register_data_source("fig2", SourceType.RESULT_FIGURE, "传播阈值结果图", {"值": 0.12})
    summary = tracker.get_conclusion_summary()
    assert summary["参数总数"] == 2
    assert len(summary["有结论变更的参数"]) == 1
    assert len(summary["版本冲突数据源"]) == 1
    assert len(summary["有结论的参数"]) == 2
    print(f"  PASS - 参数总数={summary['参数总数']}, 结论变更={len(summary['有结论变更的参数'])}, 版本冲突={len(summary['版本冲突数据源'])}")

    print("\n" + "=" * 60)
    print("  所有测试通过!")
    print("=" * 60)

    # 打印最终文档
    print("\n")
    print(doc)
    return 0


if __name__ == "__main__":
    sys.exit(run_tests())
