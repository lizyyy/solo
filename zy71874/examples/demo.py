from datetime import datetime, timedelta

from bus_transfer_scoring.engine.scoring_engine import ScoringEngine
from bus_transfer_scoring.models.constraint import ConstraintSpec, OverrideSource
from bus_transfer_scoring.models.evidence import ExperimentalData, ResultGraph


def main():
    engine = ScoringEngine()

    print("=" * 70)
    print("  公交换乘评分系统 — 完整示例")
    print("=" * 70)

    # 1. 注册约束
    print("\n【步骤1】设置评分约束")
    c_time = ConstraintSpec(name="最大换乘时间", description="换乘时间上限", value=30, unit="分钟")
    c_walk = ConstraintSpec(name="换乘步行距离上限", description="步行距离上限", value=500, unit="米")
    c_comfort = ConstraintSpec(name="换乘舒适度阈值", description="舒适度下限", value=0.7, unit="")
    engine.add_constraint(c_time)
    engine.add_constraint(c_walk)
    engine.add_constraint(c_comfort)
    print(f"  约束 [{c_time.name}] = {c_time.value}{c_time.unit}")
    print(f"  约束 [{c_walk.name}] = {c_walk.value}{c_walk.unit}")
    print(f"  约束 [{c_comfort.name}] = {c_comfort.value}{c_comfort.unit}")

    # 2. 结果图先到
    print("\n【步骤2】结果图先到（实验数据尚未提交）")
    now = datetime.now()
    graph1 = ResultGraph(
        team_id="T001",
        route_id="R_Bus12_Subway3",
        description="换乘等待时间与步行距离结果图",
        uploaded_at=now,
    )
    graph2 = ResultGraph(
        team_id="T001",
        route_id="R_Bus12_Subway3",
        description="换乘舒适度结果图",
        uploaded_at=now,
    )
    ref_g1 = engine.register_result_graph(graph1)
    ref_g2 = engine.register_result_graph(graph2)
    print(f"  注册结果图: {graph1.id} — {graph1.description}")
    print(f"  注册结果图: {graph2.id} — {graph2.description}")

    # 3. 仅凭结果图给出初始评分
    print("\n【步骤3】仅凭结果图给出初始评分")
    result = engine.create_score(
        team_id="T001",
        route_id="R_Bus12_Subway3",
        dimensions=[
            {
                "dimension": "换乘等待时间",
                "score": 82.0,
                "max_score": 100.0,
                "description": "等待时间基本在约束内",
                "evidence_ids": [graph1.id],
                "constraint_id": c_time.id,
            },
            {
                "dimension": "换乘步行距离",
                "score": 65.0,
                "max_score": 100.0,
                "description": "步行距离偏长(仅凭结果图判断)",
                "evidence_ids": [graph1.id],
                "constraint_id": c_walk.id,
            },
            {
                "dimension": "换乘舒适度",
                "score": 75.0,
                "max_score": 100.0,
                "description": "舒适度一般(仅凭结果图判断)",
                "evidence_ids": [graph2.id],
                "constraint_id": c_comfort.id,
            },
        ],
    )
    print(f"  初始总分: {result.total_score}")

    # 4. 实验数据迟到半天
    print("\n【步骤4】实验数据半天后补到")
    exp1 = ExperimentalData(
        team_id="T001",
        route_id="R_Bus12_Subway3",
        description="换乘步行距离实验数据",
        uploaded_at=now + timedelta(hours=12),
        metrics={"avg_walk_m": 620, "max_walk_m": 780},
    )
    exp2 = ExperimentalData(
        team_id="T001",
        route_id="R_Bus12_Subway3",
        description="换乘舒适度实验数据",
        uploaded_at=now + timedelta(hours=12),
        metrics={"comfort_score": 0.55},
    )
    ref_e1 = engine.register_experimental_data(exp1)
    ref_e2 = engine.register_experimental_data(exp2)
    print(f"  注册实验数据: {exp1.id} — {exp1.description}")
    print(f"  注册实验数据: {exp2.id} — {exp2.description}")

    # 5. 补材料到评分（区分"补材料"和"改结论"）
    print("\n【步骤5】将迟到实验数据关联到评分项")
    r1 = engine.supplement_evidence_to_score(
        result.id, "换乘步行距离", ref_e1, affects_conclusion=False
    )
    print(f"  步行距离数据: {r1.summary()}")
    r2 = engine.supplement_evidence_to_score(
        result.id, "换乘舒适度", ref_e2, affects_conclusion=True
    )
    print(f"  舒适度数据(改结论): {r2.summary()}")

    # 6. 约束覆盖 — 结果图来源
    print("\n【步骤6】约束覆盖：结果图显示高峰期换乘时间超出")
    override1 = engine.override_constraint(
        constraint_id=c_time.id,
        new_value=45,
        source=OverrideSource.RESULT_GRAPH,
        reason="结果图显示高峰期换乘时间普遍超过30分钟",
        evidence_id=graph1.id,
        evidence_kind=ref_g1.kind,
        next_action="参赛队补充高峰期实验数据以确认新阈值",
        next_responsible="参赛队T001",
    )
    print(override1.explain())

    # 7. 约束覆盖 — 实验数据来源
    print("\n【步骤7】约束覆盖：实验数据显示舒适度低于阈值")
    override2 = engine.override_constraint(
        constraint_id=c_comfort.id,
        new_value=0.5,
        source=OverrideSource.EXPERIMENTAL_DATA,
        reason="实验数据实际舒适度0.55低于原阈值0.7",
        evidence_id=exp2.id,
        evidence_kind=ref_e2.kind,
        next_action="参赛队提交舒适度提升方案",
        next_responsible="参赛队T001",
    )
    print(override2.explain())

    # 8. 教练手动修改约束说明
    print("\n【步骤8】教练手动修改步行距离约束说明")
    manual_record = engine.manual_edit_constraint(
        constraint_id=c_walk.id,
        new_value=600,
        new_description="换乘步行距离上限(含楼梯段)",
        reason="教练根据实地考察调高上限并补充说明",
        changed_by="教练张三",
    )
    print(f"  手动修改: {manual_record.description}")

    # 9. 输出完整评分报告
    print("\n" + "=" * 70)
    print("  评分报告（含可追溯依据）")
    print("=" * 70)
    print(result.report())

    # 10. 输出变更日志
    print("\n" + "=" * 70)
    print("  变更日志（区分补材料 / 改结论 / 约束覆盖 / 手动修改）")
    print("=" * 70)
    print(engine.change_log_report())

    # 11. 输出约束审计报告
    print("\n" + "=" * 70)
    print("  约束审计报告（含版本历史）")
    print("=" * 70)
    for cid in [c_time.id, c_walk.id, c_comfort.id]:
        print()
        print(engine.constraint_audit_report(cid))

    # 12. 汇总
    print("\n" + "=" * 70)
    print("  统计")
    print("=" * 70)
    supplements = engine.get_supplements_only()
    conclusion_changes = engine.get_conclusion_changes_only()
    print(f"  补材料操作: {len(supplements)} 条")
    print(f"  改结论操作: {len(conclusion_changes)} 条")
    print(f"  约束覆盖: {len(engine._constraint_overrides)} 条")
    all_history = engine.get_constraint_history(c_walk.id)
    print(f"  步行距离约束版本数: {len(all_history)} (含手动修改历史)")


if __name__ == "__main__":
    main()
