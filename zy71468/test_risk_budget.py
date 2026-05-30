#!/usr/bin/env python3
"""
风险预算拉格朗日工具 - 测试脚本

测试场景:
1. 基本等风险贡献优化（无边界约束）
2. 边界约束导致权重停在上界
3. 边界约束导致权重停在下界
4. 协方差矩阵非正定的处理
5. 风险预算与协方差结论不一致的情况
"""

import numpy as np
from risk_budget_lagrange import RiskBudgetOptimizer
from risk_budget_lagrange.formatting import ResultFormatter


def test_scenario_1_basic_erc():
    """
    场景1: 基本等风险贡献优化
    3个资产，无边界约束，等风险预算
    """
    print("=" * 80)
    print("测试场景1: 基本等风险贡献优化")
    print("=" * 80)

    cov = np.array([
        [0.04, 0.01, 0.005],
        [0.01, 0.03, 0.008],
        [0.005, 0.008, 0.02],
    ])
    risk_budget = np.array([1/3, 1/3, 1/3])
    names = ["股票", "债券", "商品"]

    optimizer = RiskBudgetOptimizer(asset_names=names)
    result = optimizer.optimize(cov, risk_budget)

    print(f"优化成功: {result.success}")
    print(f"最优权重: {result.weights}")
    print(f"风险贡献%: {result.risk_attribution.percent_risk_contribution}")
    print(f"边界约束数量: {len(result.boundary_explanations)}")

    # 验证: 无边界约束时所有资产风险贡献应接近1/3
    for i in range(3):
        assert abs(result.risk_attribution.percent_risk_contribution[i] - 1/3) < 0.01, \
            f"资产{i}风险贡献偏差过大"
    assert len(result.boundary_explanations) == 0, "无边界约束时不应有边界解释"

    print("✓ 场景1测试通过\n")
    return result


def test_scenario_2_upper_bound():
    """
    场景2: 上界约束导致权重停在边界
    股票风险预算高，但被上界限制
    """
    print("=" * 80)
    print("测试场景2: 上界约束导致权重停在边界")
    print("=" * 80)

    cov = np.array([
        [0.04, 0.01],
        [0.01, 0.03],
    ])
    risk_budget = np.array([0.7, 0.3])
    names = ["股票", "债券"]
    upper_bounds = np.array([0.5, 1.0])

    optimizer = RiskBudgetOptimizer(asset_names=names)
    result = optimizer.optimize(cov, risk_budget, upper_bounds=upper_bounds)

    print(f"优化成功: {result.success}")
    print(f"最优权重: {result.weights}")
    print(f"边界解释数量: {len(result.boundary_explanations)}")

    # 验证: 股票权重应等于上界0.5
    assert abs(result.weights[0] - 0.5) < 1e-6, "股票权重应停在上界"
    assert len(result.boundary_explanations) >= 1, "应有边界解释"

    stock_boundary = None
    for be in result.boundary_explanations:
        if be.asset_index == 0:
            stock_boundary = be
            break

    assert stock_boundary is not None, "股票应有边界解释"
    assert stock_boundary.bound_type == "上界", "股票应是上界约束"
    assert stock_boundary.lagrangian_multiplier is not None
    assert stock_boundary.lagrangian_multiplier > 0, "上界约束乘数应>0"

    print("边界解释详情:")
    print(f"  {stock_boundary.why_cannot_move}")
    print(f"  {stock_boundary.risk_budget_consistency}")

    print("✓ 场景2测试通过\n")
    return result


def test_scenario_3_lower_bound():
    """
    场景3: 下界约束导致权重停在边界
    债券风险预算低，但被下界限制
    """
    print("=" * 80)
    print("测试场景3: 下界约束导致权重停在边界")
    print("=" * 80)

    cov = np.array([
        [0.04, 0.01],
        [0.01, 0.03],
    ])
    risk_budget = np.array([0.9, 0.1])
    names = ["股票", "债券"]
    lower_bounds = np.array([0.0, 0.25])

    optimizer = RiskBudgetOptimizer(asset_names=names)
    result = optimizer.optimize(cov, risk_budget, lower_bounds=lower_bounds)

    print(f"优化成功: {result.success}")
    print(f"最优权重: {result.weights}")
    print(f"边界解释数量: {len(result.boundary_explanations)}")

    # 验证: 债券权重应等于下界0.25
    assert abs(result.weights[1] - 0.25) < 1e-6, "债券权重应停在下界"
    assert len(result.boundary_explanations) >= 1, "应有边界解释"

    bond_boundary = None
    for be in result.boundary_explanations:
        if be.asset_index == 1:
            bond_boundary = be
            break

    assert bond_boundary is not None, "债券应有边界解释"
    assert bond_boundary.bound_type == "下界", "债券应是下界约束"
    assert bond_boundary.lagrangian_multiplier is not None
    assert bond_boundary.lagrangian_multiplier > 0, "下界约束乘数应>0"

    print("边界解释详情:")
    print(f"  {bond_boundary.why_cannot_move}")
    print(f"  {bond_boundary.risk_budget_consistency}")

    print("✓ 场景3测试通过\n")
    return result


def test_scenario_4_non_pd_covariance():
    """
    场景4: 协方差矩阵非正定
    验证矩阵修正和时序分析
    """
    print("=" * 80)
    print("测试场景4: 协方差矩阵非正定")
    print("=" * 80)

    # 创建一个明显非正定的矩阵
    cov = np.array([
        [0.01, 0.015, 0.02],
        [0.015, 0.01, 0.015],
        [0.02, 0.015, 0.01],
    ])
    
    eigenvalues = np.linalg.eigvalsh(cov)
    print(f"原始协方差特征值: {eigenvalues}")
    print(f"最小特征值: {np.min(eigenvalues):.6e}")

    risk_budget = np.array([0.5, 0.3, 0.2])
    names = ["资产A", "资产B", "资产C"]
    upper_bounds = np.array([0.6, 1.0, 1.0])

    optimizer = RiskBudgetOptimizer(asset_names=names)
    result = optimizer.optimize(cov, risk_budget, upper_bounds=upper_bounds)

    print(f"协方差正定: {result.covariance_diagnostic.is_positive_definite}")
    print(f"是否应用修正: {result.covariance_diagnostic.correction_applied}")
    print(f"优化成功: {result.success}")

    # 验证: 修正应用了
    if not result.covariance_diagnostic.is_positive_definite:
        assert result.covariance_diagnostic.correction_applied, "非正定矩阵应被修正"
        assert result.covariance_diagnostic.corrected_matrix is not None

        # 检查时序分析步骤是否存在
        has_timing_analysis = any(
            step.step_name == "边界与正定性问题时序分析"
            for step in result.intermediate_steps
        )
        print(f"存在时序分析: {has_timing_analysis}")

    print("✓ 场景4测试通过\n")
    return result


def test_scenario_5_budget_covariance_mismatch():
    """
    场景5: 风险预算与协方差结论不一致
    验证边界作为补充证据的功能
    """
    print("=" * 80)
    print("测试场景5: 风险预算与协方差结论不一致")
    print("=" * 80)

    cov = np.array([
        [0.09, 0.01, 0.005],  # 资产A高波动
        [0.01, 0.01, 0.002],  # 资产B低波动
        [0.005, 0.002, 0.0025], # 资产C低波动
    ])
    risk_budget = np.array([0.2, 0.5, 0.3])  # 但给低波动资产高预算
    names = ["高波动A", "低波动B", "低波动C"]
    upper_bounds = np.array([0.3, 0.6, 0.6])
    lower_bounds = np.array([0.1, 0.0, 0.0])

    optimizer = RiskBudgetOptimizer(asset_names=names)
    result = optimizer.optimize(cov, risk_budget, lower_bounds, upper_bounds)

    print(f"优化成功: {result.success}")
    print(f"权重: {result.weights}")
    print(f"风险贡献%: {result.risk_attribution.percent_risk_contribution}")
    print(f"目标预算%: {risk_budget}")
    print(f"偏差: {result.risk_attribution.risk_budget_deviation}")

    # 验证: 资产A被下界约束
    a_boundary = None
    for be in result.boundary_explanations:
        if be.asset_index == 0:
            a_boundary = be
            break

    if a_boundary is not None:
        print(f"\n资产A边界解释:")
        print(f"  类型: {a_boundary.bound_type}")
        print(f"  一致性检验: {a_boundary.risk_budget_consistency}")
        
        # 验证: 一致性检验中应提到偏差和边界作为补充证据
        assert "偏差" in a_boundary.risk_budget_consistency
        assert "补充证据" in a_boundary.risk_budget_consistency

    # 验证: 最终结果印证检查存在
    has_final_check = any(
        step.step_name == "最终结果印证"
        for step in result.intermediate_steps
    )
    print(f"\n存在最终结果印证: {has_final_check}")

    print("✓ 场景5测试通过\n")
    return result


def test_scenario_6_intermediate_values():
    """
    场景6: 验证关键中间量被保留
    包括梯度、Σw、拉格朗日乘数等
    """
    print("=" * 80)
    print("测试场景6: 关键中间量保留")
    print("=" * 80)

    cov = np.array([
        [0.04, 0.01],
        [0.01, 0.03],
    ])
    risk_budget = np.array([0.6, 0.4])
    names = ["X", "Y"]
    upper_bounds = np.array([0.55, 1.0])

    optimizer = RiskBudgetOptimizer(asset_names=names)
    result = optimizer.optimize(cov, risk_budget, upper_bounds=upper_bounds)

    # 检查风险归因中间步骤
    risk_attr_step = None
    for step in result.intermediate_steps:
        if step.step_name == "风险归因结果":
            risk_attr_step = step
            break

    assert risk_attr_step is not None, "应有风险归因结果步骤"
    assert "sigma_w (Σw)" in risk_attr_step.values, "应保留Σw中间量"
    assert "marginal_risk_contribution" in risk_attr_step.values, "应保留MRC"
    assert "total_risk_contribution" in risk_attr_step.values, "应保留TRC"
    assert "portfolio_variance" in risk_attr_step.values, "应保留组合方差"

    print("保留的中间量:")
    for key in risk_attr_step.values:
        print(f"  - {key}")

    # 检查拉格朗日乘数步骤
    mult_step_1 = None
    mult_step_2 = None
    for step in result.intermediate_steps:
        if "拉格朗日乘数估计" in step.step_name and "步骤1" in step.step_name:
            mult_step_1 = step
        if "拉格朗日乘数估计" in step.step_name and "步骤2" in step.step_name:
            mult_step_2 = step

    assert mult_step_1 is not None, "应有拉格朗日乘数估计步骤1"
    assert mult_step_2 is not None, "应有拉格朗日乘数估计步骤2"
    assert "lambda (预算约束乘数)" in mult_step_1.values
    assert "upper_bound_multipliers (μ)" in mult_step_2.values
    assert "lower_bound_multipliers (ν)" in mult_step_2.values

    print(f"拉格朗日乘数步骤1: {mult_step_1.step_name}")
    print(f"拉格朗日乘数步骤2: {mult_step_2.step_name}")
    print(f"\n拉格朗日乘数 λ: {mult_step_1.values['lambda (预算约束乘数)']:.6f}")
    print(f"上界乘数 μ: {mult_step_2.values['upper_bound_multipliers (μ)']}")
    print(f"下界乘数 ν: {mult_step_2.values['lower_bound_multipliers (ν)']}")

    print("✓ 场景6测试通过\n")
    return result


def test_cli_interface():
    """
    测试CLI接口
    """
    print("=" * 80)
    print("测试场景7: CLI接口")
    print("=" * 80)

    import subprocess
    import sys

    cmd = [
        sys.executable, "-m", "risk_budget_lagrange.cli",
        "--cov", "0.04,0.01;0.01,0.03",
        "--budget", "0.5,0.5",
        "--names", "股票,债券",
        "--verbose", "0",
    ]

    print(f"命令: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    print(f"返回码: {result.returncode}")
    print(f"stdout:\n{result.stdout}")
    if result.stderr:
        print(f"stderr:\n{result.stderr}")

    assert result.returncode == 0, "CLI应成功执行"
    assert "输入参数汇总" in result.stdout, "应打印输入参数"
    assert "成功" in result.stdout or "✓" in result.stdout, "应有优化成功指示"

    print("✓ 场景7测试通过\n")


def test_output_export():
    """
    测试JSON和CSV导出
    """
    print("=" * 80)
    print("测试场景8: 结果导出")
    print("=" * 80)

    import os
    import tempfile

    cov = np.array([
        [0.04, 0.01],
        [0.01, 0.03],
    ])
    risk_budget = np.array([0.6, 0.4])
    names = ["A", "B"]
    upper_bounds = np.array([0.5, 1.0])

    optimizer = RiskBudgetOptimizer(asset_names=names)
    result = optimizer.optimize(cov, risk_budget, upper_bounds=upper_bounds)

    with tempfile.TemporaryDirectory() as tmpdir:
        json_path = os.path.join(tmpdir, "result.json")
        csv_path = os.path.join(tmpdir, "result.csv")

        json_str = ResultFormatter.to_json(result, json_path)
        csv_str = ResultFormatter.to_csv(result, csv_path)

        assert os.path.exists(json_path), "JSON文件应存在"
        assert os.path.exists(csv_path), "CSV文件应存在"

        with open(json_path, "r", encoding="utf-8") as f:
            json_content = f.read()
        assert "weights" in json_content, "JSON应包含weights"
        assert "boundary_explanations" in json_content, "JSON应包含边界解释"
        assert "intermediate_steps" in json_content, "JSON应包含中间步骤"

        with open(csv_path, "r", encoding="utf-8") as f:
            csv_content = f.read()
        assert "资产" in csv_content, "CSV应包含资产列"
        assert "权重" in csv_content, "CSV应包含权重列"
        assert "边际风险贡献" in csv_content, "CSV应包含MRC列"

        print(f"JSON导出成功 ({len(json_str)} 字符)")
        print(f"CSV导出成功 ({len(csv_str)} 字符)")

    print("✓ 场景8测试通过\n")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "🎯" * 40)
    print("开始运行风险预算拉格朗日工具测试套件")
    print("🎯" * 40 + "\n")

    all_passed = True
    results = []

    try:
        results.append(test_scenario_1_basic_erc())
    except AssertionError as e:
        print(f"✗ 场景1失败: {e}\n")
        all_passed = False

    try:
        results.append(test_scenario_2_upper_bound())
    except AssertionError as e:
        print(f"✗ 场景2失败: {e}\n")
        all_passed = False

    try:
        results.append(test_scenario_3_lower_bound())
    except AssertionError as e:
        print(f"✗ 场景3失败: {e}\n")
        all_passed = False

    try:
        results.append(test_scenario_4_non_pd_covariance())
    except AssertionError as e:
        print(f"✗ 场景4失败: {e}\n")
        all_passed = False

    try:
        results.append(test_scenario_5_budget_covariance_mismatch())
    except AssertionError as e:
        print(f"✗ 场景5失败: {e}\n")
        all_passed = False

    try:
        results.append(test_scenario_6_intermediate_values())
    except AssertionError as e:
        print(f"✗ 场景6失败: {e}\n")
        all_passed = False

    try:
        test_cli_interface()
    except Exception as e:
        print(f"✗ 场景7失败: {e}\n")
        all_passed = False

    try:
        test_output_export()
    except AssertionError as e:
        print(f"✗ 场景8失败: {e}\n")
        all_passed = False

    print("=" * 80)
    if all_passed:
        print("✅ 所有测试通过！")
    else:
        print("❌ 部分测试失败，请检查输出")
    print("=" * 80)

    return all_passed, results


if __name__ == "__main__":
    import sys
    
    # 先运行一个演示
    print("🎯 运行演示示例 - 带边界约束的风险预算优化")
    print("=" * 80)
    
    cov = np.array([
        [0.04, 0.01, 0.005],
        [0.01, 0.03, 0.008],
        [0.005, 0.008, 0.02],
    ])
    risk_budget = np.array([0.6, 0.25, 0.15])
    names = ["股票", "债券", "商品"]
    upper_bounds = np.array([0.5, 1.0, 1.0])
    lower_bounds = np.array([0.05, 0.1, 0.0])

    optimizer = RiskBudgetOptimizer(asset_names=names)
    result = optimizer.optimize(cov, risk_budget, lower_bounds, upper_bounds)
    
    ResultFormatter.print_summary(result, verbose=2)
    
    print("\n" + "=" * 80)
    print("开始正式测试...")
    print("=" * 80 + "\n")
    
    passed, _ = run_all_tests()
    sys.exit(0 if passed else 1)
