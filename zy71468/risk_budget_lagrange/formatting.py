import numpy as np
from typing import Optional
import json

from .types import OptimizationResult, BoundaryExplanation, IntermediateStep


class ResultFormatter:
    """
    结果格式化器，用于将优化结果以人类可读的方式输出
    """

    @staticmethod
    def format_number(x: float, precision: int = 6) -> str:
        if abs(x) < 1e-6 and x != 0:
            return f"{x:.6e}"
        return f"{x:.{precision}f}"

    @staticmethod
    def format_percent(x: float, precision: int = 2) -> str:
        return f"{x * 100:.{precision}f}%"

    @classmethod
    def print_summary(cls, result: OptimizationResult, verbose: int = 1):
        """
        打印优化结果摘要
        verbose: 0 - 极简, 1 - 标准, 2 - 详细, 3 - 完整中间过程
        """
        print("=" * 80)
        print("风险预算拉格朗日优化 - 结果报告")
        print("=" * 80)

        if result.warnings:
            print("\n⚠️  警告信息:")
            for i, warning in enumerate(result.warnings, 1):
                print(f"  {i}. {warning}")

        print("\n📊 优化状态:")
        print(f"  成功: {'✓' if result.success else '✗'}")
        print(f"  方法: {result.optimization_method}")
        print(f"  迭代次数: {result.iterations}")
        print(f"  目标函数值: {cls.format_number(result.final_objective)}")

        print("\n📈 组合风险指标:")
        ra = result.risk_attribution
        print(f"  组合波动率: {cls.format_percent(ra.portfolio_volatility)}")

        print("\n⚖️  权重结果:")
        print(f"  {'资产':<15} {'权重':<12} {'MRC':<12} {'TRC':<12} {'风险贡献%':<12} {'目标预算%':<12} {'偏差':<12} {'状态':<10}")
        print("-" * 100)
        
        for i, name in enumerate(result.asset_names):
            w = ra.weights[i]
            mrc = ra.marginal_risk_contribution[i]
            trc = ra.total_risk_contribution[i]
            rc_pct = ra.percent_risk_contribution[i]
            target = ra.target_risk_budget[i]
            dev = ra.risk_budget_deviation[i]
            
            at_bound = any(be.asset_index == i for be in result.boundary_explanations)
            status = "边界" if at_bound else "内部"
            
            print(
                f"  {name:<15} {cls.format_number(w):<12} {cls.format_number(mrc):<12} "
                f"{cls.format_number(trc):<12} {cls.format_percent(rc_pct):<12} "
                f"{cls.format_percent(target):<12} {cls.format_percent(dev):<12} {status:<10}"
            )

        if verbose >= 1 and result.boundary_explanations:
            print("\n" + "=" * 80)
            print("🔍 边界约束详细解释")
            print("=" * 80)
            
            for be in result.boundary_explanations:
                cls._print_boundary_explanation(be, verbose)

        if verbose >= 2:
            print("\n" + "=" * 80)
            print("📐 拉格朗日乘数分析")
            print("=" * 80)
            
            print(f"\n预算约束乘数 λ: {cls.format_number(result.lagrangian_multipliers[0])}")
            print("\n边界约束乘数:")
            print(f"  {'资产':<15} {'上界乘数 μ':<15} {'下界乘数 ν':<15}")
            print("-" * 50)
            for i, name in enumerate(result.asset_names):
                print(
                    f"  {name:<15} {cls.format_number(result.upper_bound_multipliers[i]):<15} "
                    f"{cls.format_number(result.lower_bound_multipliers[i]):<15}"
                )

        if verbose >= 2:
            print("\n" + "=" * 80)
            print("🧮 协方差矩阵诊断")
            print("=" * 80)
            
            cd = result.covariance_diagnostic
            print(f"\n  正定: {'✓' if cd.is_positive_definite else '✗'}")
            print(f"  最小特征值: {cls.format_number(cd.min_eigenvalue)}")
            print(f"  条件数: {cls.format_number(cd.condition_number)}")
            if cd.correction_applied:
                print(f"  修正方法: {cd.correction_method}")
                print(f"  修正ε: {cls.format_number(cd.correction_epsilon)}")

        if verbose >= 3:
            print("\n" + "=" * 80)
            print("📋 执行步骤时序")
            print("=" * 80)
            
            for i, step in enumerate(result.execution_sequence, 1):
                print(f"  步骤{i}: {step}")

            print("\n" + "=" * 80)
            print("📝 完整中间过程")
            print("=" * 80)
            
            for step in result.intermediate_steps:
                cls._print_intermediate_step(step)

        print("\n" + "=" * 80)
        print("✅ 结果印证检查")
        print("=" * 80)
        
        final_step = None
        for step in result.intermediate_steps:
            if step.step_name == "最终结果印证":
                final_step = step
                break
        
        if final_step:
            for key, value in final_step.values.items():
                status = "✓" if value else "✗"
                print(f"  {status} {key}: {value}")

        print("\n" + "=" * 80)

    @classmethod
    def _print_boundary_explanation(cls, be: BoundaryExplanation, verbose: int = 1):
        print(f"\n📍 {be.asset_name} (索引{be.asset_index}) - {be.bound_type}约束")
        print("-" * 60)
        print(f"  权重: {cls.format_number(be.weight_at_bound)} = {be.bound_type}: {cls.format_number(be.bound_value)}")
        if be.lagrangian_multiplier is not None:
            print(f"  拉格朗日乘数: {cls.format_number(be.lagrangian_multiplier)}")
        if be.shadow_price is not None:
            print(f"  影子价格: {cls.format_number(be.shadow_price)}")
        print(f"  KKT条件: {be.kkt_condition}")

        if verbose >= 2:
            print(f"\n  📝 证据链:")
            for i, ev in enumerate(be.evidence, 1):
                print(f"    {i}. {ev}")

        print(f"\n  💡 为什么不能离开边界:")
        for line in be.why_cannot_move.split("\n"):
            print(f"    {line}")

        print(f"\n  🎯 风险预算一致性:")
        for line in be.risk_budget_consistency.split("\n"):
            print(f"    {line}")

    @classmethod
    def _print_intermediate_step(cls, step: IntermediateStep):
        print(f"\n📍 步骤{step.step_order}: {step.step_name}")
        print(f"  描述: {step.description}")
        if step.values:
            print(f"  数值:")
            for key, value in step.values.items():
                if isinstance(value, list):
                    if len(value) > 10:
                        print(f"    {key}: [列表长度={len(value)}，前5个: {value[:5]}...]")
                    else:
                        print(f"    {key}: {value}")
                elif isinstance(value, float):
                    print(f"    {key}: {cls.format_number(value)}")
                else:
                    print(f"    {key}: {value}")

    @staticmethod
    def to_json(result: OptimizationResult, file_path: Optional[str] = None) -> str:
        """
        将结果导出为JSON格式
        """
        
        def convert(obj):
            if isinstance(obj, np.ndarray):
                return obj.tolist()
            if isinstance(obj, np.floating):
                return float(obj)
            if isinstance(obj, np.integer):
                return int(obj)
            if hasattr(obj, "__dict__"):
                return {k: convert(v) for k, v in obj.__dict__.items() if not k.startswith("_")}
            if isinstance(obj, list):
                return [convert(item) for item in obj]
            if isinstance(obj, dict):
                return {k: convert(v) for k, v in obj.items()}
            return obj

        data = convert(result)
        json_str = json.dumps(data, ensure_ascii=False, indent=2, default=str)
        
        if file_path:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(json_str)
        
        return json_str

    @staticmethod
    def to_csv(result: OptimizationResult, file_path: Optional[str] = None) -> str:
        """
        将权重和风险归因导出为CSV格式
        """
        import csv
        import io

        output = io.StringIO()
        writer = csv.writer(output)
        
        ra = result.risk_attribution
        
        writer.writerow([
            "资产", "权重", "边际风险贡献", "总风险贡献",
            "风险贡献百分比", "目标风险预算", "偏差",
            "上界乘数", "下界乘数", "是否在边界"
        ])
        
        for i, name in enumerate(result.asset_names):
            at_bound = any(be.asset_index == i for be in result.boundary_explanations)
            writer.writerow([
                name,
                ra.weights[i],
                ra.marginal_risk_contribution[i],
                ra.total_risk_contribution[i],
                ra.percent_risk_contribution[i],
                ra.target_risk_budget[i],
                ra.risk_budget_deviation[i],
                result.upper_bound_multipliers[i],
                result.lower_bound_multipliers[i],
                at_bound,
            ])
        
        csv_str = output.getvalue()
        
        if file_path:
            with open(file_path, "w", encoding="utf-8", newline="") as f:
                f.write(csv_str)
        
        return csv_str
