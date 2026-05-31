from datetime import datetime, timedelta

from param_tracker import (
    ChangeType,
    ParamTracker,
    SourceType,
    VersionConflictError,
)


def main():
    tracker = ParamTracker(project_name="舆情扩散参数")

    print("=" * 60)
    print("  场景演示：三人建模小队交稿前补材料")
    print("=" * 60)

    print("\n【场景1】结果图先到，录入扩散系数")
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

    print("  OK 扩散系数=0.35 1/h, 传播阈值=0.12 (来源:结果图)")

    print("\n【场景2】实验数据晚补——补材料，不改结论")
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
    print("  OK 补传实验数据，扩散系数值未变(0.35)，标记为'补材料'")

    print("\n【场景3】约束说明手工改动——真的改了结论")
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
    print("  [!] 约束说明修正：时间单位h->min，扩散系数从0.35->0.00583，结论已变更")

    print("\n【场景4】补传旧版实验数据——触发版本冲突告警")
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
    if conflict:
        print(f"  [!] 版本冲突告警:")
        print(f"      数据源: {conflict['source_id']}")
        print(f"      新数据时间: {conflict['new_timestamp']}")
        print(f"      当前最新时间: {conflict['latest_timestamp']}")
        print(f"      差异: {conflict['diff']}")
    else:
        print("  (未检测到版本冲突)")

    print("\n【场景5】新增衰减因子，仅补材料")
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
    print("  OK 衰减因子=0.08 1/h，实验数据补传，标记为'仅补材料'")

    print("\n" + "=" * 60)
    print("  结论追溯：扩散系数 -> 查到依据在哪")
    print("=" * 60)
    trace = tracker.trace_conclusion("扩散系数")
    print(f"\n  参数: {trace['参数名']}")
    print(f"  当前值: {trace['当前值']}")
    print(f"  当前结论: {trace['当前结论']}")
    print("  追溯链:")
    for step in trace["追溯链"]:
        flag = " [!]影响结论" if step["是否影响结论"] and step["变更类型"] != "初始录入" else ""
        print(
            f"    [{step['变更类型']}] {step['旧值']} -> {step['新值']} "
            f"| 来源: {step['来源类型']}/{step['来源ID']}{flag}"
        )
        if step["备注"]:
            print(f"      备注: {step['备注']}")

    print("\n" + "=" * 60)
    print("  导出模型说明")
    print("=" * 60)
    doc = tracker.export_documentation()
    print(doc)

    output_path = "/Users/lzy/pro/solo/workspaces/zy71879/舆情扩散参数_模型说明.txt"
    tracker.export_documentation(output_path=output_path)
    print(f"\n  已保存到: {output_path}")


if __name__ == "__main__":
    main()
