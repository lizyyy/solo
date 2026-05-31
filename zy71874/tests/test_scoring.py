from datetime import datetime, timedelta

from bus_transfer_scoring.engine.scoring_engine import ScoringEngine
from bus_transfer_scoring.models.constraint import ConstraintSpec, OverrideSource
from bus_transfer_scoring.models.evidence import ExperimentalData, ResultGraph
from bus_transfer_scoring.models.change_record import ChangeType, ChangeSource


def test_traceability_from_conclusion_to_evidence():
    engine = ScoringEngine()

    graph = ResultGraph(team_id="T01", route_id="R01", description="换乘等待时间结果图")
    graph_ref = engine.register_result_graph(graph)

    exp_data = ExperimentalData(
        team_id="T01", route_id="R01", description="换乘步行距离实验数据", metrics={"avg_walk_m": 320}
    )
    data_ref = engine.register_experimental_data(exp_data)

    result = engine.create_score(
        team_id="T01",
        route_id="R01",
        dimensions=[
            {
                "dimension": "换乘等待时间",
                "score": 85.0,
                "max_score": 100.0,
                "description": "等待时间在可接受范围",
                "evidence_ids": [graph.id],
            },
            {
                "dimension": "换乘步行距离",
                "score": 70.0,
                "max_score": 100.0,
                "description": "步行距离偏长",
                "evidence_ids": [exp_data.id],
            },
        ],
    )

    trace = result.trace_all_evidence()
    assert "换乘等待时间" in trace
    assert len(trace["换乘等待时间"]) == 1
    assert "结果图" in trace["换乘等待时间"][0]
    assert "换乘步行距离" in trace
    assert "实验数据" in trace["换乘步行距离"][0]

    report = result.report()
    assert "T01" in report
    assert "R01" in report
    assert "依据" in report
    print("✅ test_traceability_from_conclusion_to_evidence PASSED")


def test_supplement_vs_conclusion_change():
    engine = ScoringEngine()

    graph = ResultGraph(team_id="T02", route_id="R02", description="换乘成功率结果图")
    graph_ref = engine.register_result_graph(graph)

    result = engine.create_score(
        team_id="T02",
        route_id="R02",
        dimensions=[
            {
                "dimension": "换乘成功率",
                "score": 90.0,
                "max_score": 100.0,
                "description": "成功率优秀",
                "evidence_ids": [graph.id],
            },
        ],
    )

    late_data = ExperimentalData(
        team_id="T02", route_id="R02", description="迟到半天的实验数据补充", metrics={"success_rate": 0.92}
    )
    data_ref = engine.register_experimental_data(late_data)

    supplement_record = engine.supplement_evidence_to_score(
        result.id, "换乘成功率", data_ref, affects_conclusion=False
    )
    assert supplement_record.change_type == ChangeType.SUPPLEMENT
    assert "补材料" in supplement_record.summary()

    conclusion_record = engine.supplement_evidence_to_score(
        result.id, "换乘成功率", data_ref, affects_conclusion=True
    )
    assert conclusion_record.change_type == ChangeType.CONCLUSION_CHANGE
    assert "结论变更" in conclusion_record.summary()

    supplements = engine.get_supplements_only()
    conclusion_changes = engine.get_conclusion_changes_only()
    assert len(supplements) >= 1
    assert len(conclusion_changes) >= 1
    print("✅ test_supplement_vs_conclusion_change PASSED")


def test_constraint_override_with_source():
    engine = ScoringEngine()

    constraint = ConstraintSpec(name="最大换乘时间", description="换乘时间上限", value=30, unit="分钟")
    engine.add_constraint(constraint)

    graph = ResultGraph(team_id="T03", route_id="R03", description="换乘时间超出结果图")
    graph_ref = engine.register_result_graph(graph)

    override = engine.override_constraint(
        constraint_id=constraint.id,
        new_value=45,
        source=OverrideSource.RESULT_GRAPH,
        reason="结果图显示高峰期换乘时间普遍超过30分钟",
        evidence_id=graph.id,
        evidence_kind=graph_ref.kind,
        next_action="补充高峰期实验数据以确认新阈值",
        next_responsible="参赛队T03",
    )

    assert override.old_value == 30
    assert override.new_value == 45
    assert override.source == OverrideSource.RESULT_GRAPH
    assert override.next_action != ""
    assert override.next_responsible == "参赛队T03"

    explanation = override.explain()
    assert "结果图" in explanation
    assert "30" in explanation
    assert "45" in explanation
    assert "下一步" in explanation
    assert "参赛队T03" in explanation
    print("✅ test_constraint_override_with_source PASSED")


def test_manual_edit_constraint_preserves_history():
    engine = ScoringEngine()

    constraint = ConstraintSpec(name="换乘步行距离上限", description="换乘步行距离上限", value=500, unit="米")
    engine.add_constraint(constraint)

    record1 = engine.manual_edit_constraint(
        constraint_id=constraint.id,
        new_value=600,
        reason="竞赛教练根据实地考察调高上限",
        changed_by="教练张三",
    )
    assert record1.change_type == ChangeType.MANUAL_EDIT
    assert record1.before["value"] == 500
    assert record1.after["value"] == 600

    record2 = engine.manual_edit_constraint(
        constraint_id=constraint.id,
        new_description="换乘步行距离上限(含楼梯段)",
        reason="补充说明：含楼梯段距离",
        changed_by="教练张三",
    )
    assert "楼梯段" in record2.after["description"]

    history = engine.get_constraint_history(constraint.id)
    assert len(history) == 3  # initial + 2 edits

    versions = [h["version"] for h in history]
    assert versions == [1, 2, 3]

    audit_report = engine.constraint_audit_report(constraint.id)
    assert "教练张三" in audit_report
    assert "500" in audit_report
    assert "600" in audit_report
    assert "楼梯段" in audit_report
    print("✅ test_manual_edit_constraint_preserves_history PASSED")


def test_change_log_report():
    engine = ScoringEngine()

    graph = ResultGraph(team_id="T04", route_id="R04", description="测试结果图")
    engine.register_result_graph(graph)

    constraint = ConstraintSpec(name="测试约束", description="用于测试", value=10)
    engine.add_constraint(constraint)

    engine.override_constraint(
        constraint_id=constraint.id,
        new_value=20,
        source=OverrideSource.MANUAL,
        reason="测试覆盖",
    )

    report = engine.change_log_report()
    assert "补材料" in report
    assert "约束覆盖" in report
    assert "统计" in report
    print("✅ test_change_log_report PASSED")


def test_late_experimental_data_scenario():
    engine = ScoringEngine()

    now = datetime.now()
    graph = ResultGraph(
        team_id="T05",
        route_id="R05",
        description="换乘效率结果图",
        uploaded_at=now,
    )
    graph_ref = engine.register_result_graph(graph)

    result = engine.create_score(
        team_id="T05",
        route_id="R05",
        dimensions=[
            {
                "dimension": "换乘效率",
                "score": 80.0,
                "max_score": 100.0,
                "description": "初始评分(仅有结果图)",
                "evidence_ids": [graph.id],
            },
        ],
    )

    late_data = ExperimentalData(
        team_id="T05",
        route_id="R05",
        description="半天后补的实验数据",
        uploaded_at=now + timedelta(hours=12),
        metrics={"efficiency": 0.78},
    )
    data_ref = engine.register_experimental_data(late_data)

    engine.supplement_evidence_to_score(result.id, "换乘效率", data_ref, affects_conclusion=False)

    report = result.report()
    assert "实验数据" in report
    assert "结果图" in report

    supplements = engine.get_supplements_only()
    has_exp_data_supplement = any(
        r.evidence_ref is not None and r.evidence_ref.kind.value == "experimental_data"
        for r in supplements
    )
    assert has_exp_data_supplement
    print("✅ test_late_experimental_data_scenario PASSED")


def test_constraint_override_from_experimental_data():
    engine = ScoringEngine()

    constraint = ConstraintSpec(name="换乘舒适度阈值", description="舒适度下限", value=0.7)
    engine.add_constraint(constraint)

    exp_data = ExperimentalData(
        team_id="T06",
        route_id="R06",
        description="换乘舒适度实验数据",
        metrics={"comfort": 0.55},
    )
    data_ref = engine.register_experimental_data(exp_data)

    override = engine.override_constraint(
        constraint_id=constraint.id,
        new_value=0.5,
        source=OverrideSource.EXPERIMENTAL_DATA,
        reason="实验数据显示实际舒适度低于原阈值",
        evidence_id=exp_data.id,
        evidence_kind=data_ref.kind,
        next_action="参赛队提交新的舒适度提升方案",
        next_responsible="参赛队T06",
    )

    explanation = override.explain()
    assert "实验数据" in explanation
    assert "参赛队T06" in explanation
    print("✅ test_constraint_override_from_experimental_data PASSED")


if __name__ == "__main__":
    test_traceability_from_conclusion_to_evidence()
    test_supplement_vs_conclusion_change()
    test_constraint_override_with_source()
    test_manual_edit_constraint_preserves_history()
    test_change_log_report()
    test_late_experimental_data_scenario()
    test_constraint_override_from_experimental_data()
    print("\n🎉 所有测试通过！")
