import numpy as np
from typing import List, Optional, Tuple, Dict, Any
from scipy.optimize import minimize
import time

from .types import (
    OptimizationResult,
    RiskAttribution,
    BoundaryExplanation,
    CovarianceDiagnostic,
    IntermediateStep,
)


class RiskBudgetOptimizer:
    """
    风险预算拉格朗日优化器
    
    核心公式:
    - 组合波动率: σ_p = sqrt(w' Σ w)
    - 边际风险贡献(MRC): MRC_i = (Σ w)_i / σ_p
    - 总风险贡献(TRC): TRC_i = w_i * MRC_i
    - 风险预算约束: TRC_i / σ_p = b_i (相对风险预算)
    
    算法说明:
    阶段1: 求解无约束绝对风险预算问题
        min_w 0.5 * w'Σw - Σ b_i * log(w_i)
        一阶条件: w_i * (Σw)_i = b_i (绝对风险预算)
    
    阶段2: 归一化权重
        w = w_abs / Σw_abs_i
        由于齐次性，自动满足: TRC_i / σ_p = b_i
    
    阶段3: 如违反边界约束，使用带约束优化
        min_w 0.5 * w'Σw - Σ b_i * log(w_i)
        s.t. Σ w_i = 1, lb ≤ w ≤ ub
    
    拉格朗日函数:
    L = 0.5 * w'Σw - Σb_i*log(w_i) - λ(Σw_i-1) - Σμ_i(w_i-ub_i) - Σν_i(lb_i-w_i)
    
    KKT条件:
    1. Σw - b/w - λ1 - μ + ν = 0 (一阶条件)
    2. μ_i ≥ 0, ν_i ≥ 0 (对偶可行性)
    3. μ_i(w_i-ub_i)=0, ν_i(lb_i-w_i)=0 (互补松弛)
    """

    def __init__(
        self,
        asset_names: Optional[List[str]] = None,
        tolerance: float = 1e-8,
        max_iterations: int = 10000,
    ):
        self.asset_names = asset_names
        self.tolerance = tolerance
        self.max_iterations = max_iterations
        self._step_counter = 0
        self._intermediate_steps: List[IntermediateStep] = []
        self._execution_sequence: List[str] = []
        self._warnings: List[str] = []

    def _add_step(self, name: str, description: str, values: Dict[str, Any] = None):
        self._step_counter += 1
        step = IntermediateStep(
            step_name=name,
            step_order=self._step_counter,
            description=description,
            values=values or {},
        )
        self._intermediate_steps.append(step)
        self._execution_sequence.append(name)
        return step

    def _check_covariance(self, cov: np.ndarray) -> CovarianceDiagnostic:
        """
        检查协方差矩阵的正定性并进行修复
        记录完整的中间过程
        """
        self._add_step(
            "协方差正定性检查",
            "检查协方差矩阵是否对称正定，这是风险预算优化的前提条件",
            {"matrix_shape": cov.shape, "matrix": cov.tolist()},
        )

        if not np.allclose(cov, cov.T):
            self._warnings.append("协方差矩阵不对称，已强制对称化")
            cov = (cov + cov.T) / 2

        eigenvalues, eigenvectors = np.linalg.eigh(cov)
        min_eig = np.min(eigenvalues)
        max_eig = np.max(eigenvalues)
        condition_number = max_eig / min_eig if min_eig > 0 else np.inf

        is_pd = min_eig > self.tolerance

        self._add_step(
            "特征值分解结果",
            "协方差矩阵的特征值分析，判断正定性",
            {
                "eigenvalues": eigenvalues.tolist(),
                "min_eigenvalue": float(min_eig),
                "max_eigenvalue": float(max_eig),
                "condition_number": float(condition_number),
                "is_positive_definite": is_pd,
            },
        )

        original_matrix = cov.copy()
        corrected_matrix = None
        correction_applied = False
        correction_method = None
        correction_epsilon = None

        if not is_pd:
            self._warnings.append(
                f"协方差矩阵不正定，最小特征值={min_eig:.6e}，将应用特征值修正"
            )
            correction_method = "特征值截断法"
            correction_epsilon = max(1e-6, abs(min_eig) + 1e-6)
            
            corrected_eigenvalues = np.maximum(eigenvalues, correction_epsilon)
            corrected_matrix = eigenvectors @ np.diag(corrected_eigenvalues) @ eigenvectors.T
            corrected_matrix = (corrected_matrix + corrected_matrix.T) / 2
            correction_applied = True

            self._add_step(
                "协方差矩阵修正",
                "应用特征值截断法修正非正定矩阵",
                {
                    "correction_epsilon": correction_epsilon,
                    "original_eigenvalues": eigenvalues.tolist(),
                    "corrected_eigenvalues": corrected_eigenvalues.tolist(),
                    "corrected_matrix": corrected_matrix.tolist(),
                },
            )
        else:
            corrected_matrix = cov.copy()

        return CovarianceDiagnostic(
            is_positive_definite=is_pd,
            eigenvalues=eigenvalues,
            min_eigenvalue=float(min_eig),
            condition_number=float(condition_number),
            correction_applied=correction_applied,
            correction_method=correction_method,
            correction_epsilon=correction_epsilon,
            original_matrix=original_matrix,
            corrected_matrix=corrected_matrix,
        )

    def _compute_risk_attribution(
        self,
        weights: np.ndarray,
        cov: np.ndarray,
        risk_budget: np.ndarray,
    ) -> RiskAttribution:
        """
        计算风险归因分析，保留所有中间量
        """
        self._add_step(
            "风险归因计算",
            "计算边际风险贡献、总风险贡献和风险预算偏差",
            {"weights": weights.tolist(), "cov_matrix": cov.tolist(), "risk_budget": risk_budget.tolist()},
        )

        portfolio_variance = weights @ cov @ weights
        portfolio_volatility = np.sqrt(portfolio_variance)
        
        sigma_w = cov @ weights
        marginal_risk_contribution = sigma_w / portfolio_volatility if portfolio_volatility > 0 else np.zeros_like(weights)
        
        total_risk_contribution = weights * marginal_risk_contribution
        
        total_rc_sum = np.sum(total_risk_contribution)
        percent_risk_contribution = (
            total_risk_contribution / total_rc_sum if total_rc_sum > 0 else np.zeros_like(weights)
        )
        
        risk_budget_deviation = percent_risk_contribution - risk_budget

        self._add_step(
            "风险归因结果",
            "风险归因的详细计算结果",
            {
                "portfolio_variance": float(portfolio_variance),
                "portfolio_volatility": float(portfolio_volatility),
                "sigma_w (Σw)": sigma_w.tolist(),
                "marginal_risk_contribution": marginal_risk_contribution.tolist(),
                "total_risk_contribution": total_risk_contribution.tolist(),
                "percent_risk_contribution": percent_risk_contribution.tolist(),
                "risk_budget_deviation": risk_budget_deviation.tolist(),
            },
        )

        return RiskAttribution(
            weights=weights.copy(),
            portfolio_volatility=float(portfolio_volatility),
            marginal_risk_contribution=marginal_risk_contribution,
            total_risk_contribution=total_risk_contribution,
            percent_risk_contribution=percent_risk_contribution,
            target_risk_budget=risk_budget.copy(),
            risk_budget_deviation=risk_budget_deviation,
        )

    def _objective_absolute(self, w: np.ndarray, cov: np.ndarray, risk_budget: np.ndarray) -> float:
        """
        绝对风险预算优化目标函数（阶段1使用）
        min_w 0.5 * w' Σ w - Σ b_i * log(w_i)
        
        一阶条件: w_i * (Σw)_i = b_i (绝对风险预算)
        """
        if np.any(w <= self.tolerance):
            return np.inf
        
        portfolio_variance = w @ cov @ w
        log_penalty = np.sum(risk_budget * np.log(w))
        
        objective = 0.5 * portfolio_variance - log_penalty
        return objective

    def _gradient_absolute(self, w: np.ndarray, cov: np.ndarray, risk_budget: np.ndarray) -> np.ndarray:
        """
        绝对风险预算目标函数的梯度（阶段1使用）
        ∇L = Σ w - b / w
        """
        if np.any(w <= self.tolerance):
            return np.full_like(w, np.inf)
        
        grad = cov @ w - risk_budget / w
        return grad

    def _objective_relative(self, w: np.ndarray, cov: np.ndarray, risk_budget: np.ndarray) -> float:
        """
        相对风险预算优化目标函数（阶段3使用）
        min_w 0.5 * log(w' Σ w) - Σ b_i * log(w_i)
        
        推导: 通过变量替换 w = t * x, Σx_i=1，消去t后得到
        一阶条件: (Σw)_i / σ_p² - b_i / w_i = λ (相对风险预算)
        即: w_i * (Σw)_i / σ_p² = b_i + λ * w_i
        对于内部点(λ一致): w_i * (Σw)_i / σ_p² = b_i
        """
        if np.any(w <= self.tolerance):
            return np.inf
        
        portfolio_variance = w @ cov @ w
        if portfolio_variance <= 0:
            return np.inf
        
        log_variance = np.log(portfolio_variance)
        log_penalty = np.sum(risk_budget * np.log(w))
        
        objective = 0.5 * log_variance - log_penalty
        return objective

    def _gradient_relative(self, w: np.ndarray, cov: np.ndarray, risk_budget: np.ndarray) -> np.ndarray:
        """
        相对风险预算目标函数的梯度（阶段3使用）
        ∇f = Σw / σ_p² - b / w
        """
        if np.any(w <= self.tolerance):
            return np.full_like(w, np.inf)
        
        portfolio_variance = w @ cov @ w
        if portfolio_variance <= 0:
            return np.full_like(w, np.inf)
        
        sigma_w = cov @ w
        grad = sigma_w / portfolio_variance - risk_budget / w
        return grad

    def _explain_boundary(
        self,
        idx: int,
        weights: np.ndarray,
        lb: np.ndarray,
        ub: np.ndarray,
        cov: np.ndarray,
        risk_budget: np.ndarray,
        upper_mult: np.ndarray,
        lower_mult: np.ndarray,
        risk_attr: RiskAttribution,
        lambda_est: float,
        grad: np.ndarray,
        uses_relative_objective: bool = False,
    ) -> Optional[BoundaryExplanation]:
        """
        解释为什么某个资产的权重停在边界上
        
        关键是分析拉格朗日乘数和KKT条件
        """
        asset_name = self.asset_names[idx] if self.asset_names else f"资产_{idx}"
        w_i = weights[idx]
        
        at_upper = abs(w_i - ub[idx]) < self.tolerance * max(1.0, abs(ub[idx]))
        at_lower = abs(w_i - lb[idx]) < self.tolerance * max(1.0, abs(lb[idx]))
        
        if not at_upper and not at_lower:
            return None

        bound_type = "上界" if at_upper else "下界"
        bound_value = ub[idx] if at_upper else lb[idx]
        multiplier = upper_mult[idx] if at_upper else lower_mult[idx]
        
        sigma_w = cov @ weights
        portfolio_vol = risk_attr.portfolio_volatility
        
        mrc_i = sigma_w[idx] / portfolio_vol if portfolio_vol > 0 else 0
        desired_trc_i = risk_budget[idx] * portfolio_vol
        actual_trc_i = w_i * mrc_i
        
        shadow_price = multiplier if multiplier is not None else 0.0

        evidence = []
        evidence.append(f"权重 w_{idx} = {w_i:.6f} 等于{bound_type} {bound_value:.6f}")
        evidence.append(f"|w_i - bound| = {abs(w_i - bound_value):.6e} < 容差 {self.tolerance * max(1.0, abs(bound_value)):.6e}")
        evidence.append(f"优化在归一化空间进行（Σw_i=1），边界约束直接作用于最终权重")
        
        if at_upper:
            if upper_mult[idx] is not None:
                evidence.append(f"上界拉格朗日乘数 μ_{idx} = {upper_mult[idx]:.6f} ≥ 0 (对偶可行)")
                evidence.append(f"互补松弛: μ_{idx} * (w_i - ub_i) = {upper_mult[idx] * (w_i - ub[idx]):.6e} = 0 ✓")
        else:
            if lower_mult[idx] is not None:
                evidence.append(f"下界拉格朗日乘数 ν_{idx} = {lower_mult[idx]:.6f} ≥ 0 (对偶可行)")
                evidence.append(f"互补松弛: ν_{idx} * (lb_i - w_i) = {lower_mult[idx] * (lb[idx] - w_i):.6e} = 0 ✓")

        evidence.append(f"边际风险贡献 MRC_{idx} = {mrc_i:.6f}")
        evidence.append(f"实际总风险贡献 TRC_{idx} = {actual_trc_i:.6f}")
        evidence.append(f"目标总风险贡献 (b_i * σ_p) = {desired_trc_i:.6f}")

        gradient_i = grad[idx]
        kkt_condition = "∇f + λ + μ - ν = 0"
        
        kkt_deviation = gradient_i + lambda_est + (upper_mult[idx] if upper_mult[idx] is not None else 0) - (lower_mult[idx] if lower_mult[idx] is not None else 0)
        kkt_condition += f"，偏差 = {kkt_deviation:.6e}"

        why_cannot_move = self._explain_why_cannot_move(
            idx, w_i, at_upper, at_lower, sigma_w, risk_budget, lambda_est, multiplier, gradient_i, uses_relative_objective
        )

        risk_budget_consistency = self._check_risk_budget_consistency(
            idx, w_i, risk_budget, risk_attr, at_upper, at_lower
        )

        return BoundaryExplanation(
            asset_index=idx,
            asset_name=asset_name,
            bound_type=bound_type,
            bound_value=float(bound_value),
            weight_at_bound=float(w_i),
            lagrangian_multiplier=float(multiplier) if multiplier is not None else None,
            shadow_price=float(shadow_price) if shadow_price is not None else None,
            kkt_condition=kkt_condition,
            evidence=evidence,
            why_cannot_move=why_cannot_move,
            risk_budget_consistency=risk_budget_consistency,
        )

    def _explain_why_cannot_move(
        self,
        idx: int,
        w_i: float,
        at_upper: bool,
        at_lower: bool,
        sigma_w: np.ndarray,
        risk_budget: np.ndarray,
        lambda_estimate: float,
        multiplier: float,
        gradient_i: float,
        uses_relative_objective: bool = False,
    ) -> str:
        """
        详细解释为什么权重不能离开边界
        """
        b_i = risk_budget[idx]
        sigma_w_i = sigma_w[idx]
        
        if uses_relative_objective:
            formula_note = "相对风险预算空间（Σw_i=1）"
            unconstrained_optimal = None
        else:
            formula_note = "绝对风险预算空间"
            unconstrained_optimal = np.sqrt(b_i / sigma_w_i * lambda_estimate) if sigma_w_i > 0 and lambda_estimate > 0 else None
        
        if at_upper:
            explanation_parts = [
                f"资产{idx}停在上界 w_i = {w_i:.6f} 的原因分析:",
                f"  - 优化空间: {formula_note}",
            ]
            
            if unconstrained_optimal is not None:
                explanation_parts.append(f"  - 无约束最优解 w_i* = sqrt(b_i * λ / (Σw)_i) = sqrt({b_i:.6f} * {lambda_estimate:.6f} / {sigma_w_i:.6f}) = {unconstrained_optimal:.6f}")
                explanation_parts.append(f"  - 由于 w_i* = {unconstrained_optimal:.6f} > 上界 ub_i = {w_i:.6f}")
                explanation_parts.append(f"  - 因此必须截断在上界")
            
            if multiplier is not None and multiplier > 0:
                explanation_parts.append(f"  - 拉格朗日乘数 μ = {multiplier:.6f} > 0，表明约束是紧的（active）")
                explanation_parts.append(f"  - 影子价格 = {multiplier:.6f}：每放松1单位上界约束，目标函数可降低{multiplier:.6f}")
            else:
                explanation_parts.append(f"  - 拉格朗日乘数 μ = {multiplier:.6f} ≈ 0，表明约束在数值边界上")
            
            explanation_parts.append(f"  - 梯度分析: 目标函数梯度分量 ∇f_i = {gradient_i:.6f}")
            explanation_parts.append(f"  - 预算约束乘数 λ = {lambda_estimate:.6f}")
            
            mu_estimate = -gradient_i - lambda_estimate
            if mu_estimate > 0:
                explanation_parts.append(f"  - 由于 -∇f_i - λ = {-gradient_i:.6f} - {lambda_estimate:.6f} = {mu_estimate:.6f} > 0")
                explanation_parts.append(f"  - 需要 μ = {mu_estimate:.6f} > 0 来满足KKT条件")
                explanation_parts.append(f"  - 若尝试降低权重（w_i < ub_i），目标函数将上升，因为约束是有效的")
            
        else:
            explanation_parts = [
                f"资产{idx}停在下界 w_i = {w_i:.6f} 的原因分析:",
                f"  - 优化空间: {formula_note}",
            ]
            
            if unconstrained_optimal is not None:
                explanation_parts.append(f"  - 无约束最优解 w_i* = sqrt(b_i * λ / (Σw)_i) = sqrt({b_i:.6f} * {lambda_estimate:.6f} / {sigma_w_i:.6f}) = {unconstrained_optimal:.6f}")
                explanation_parts.append(f"  - 由于 w_i* = {unconstrained_optimal:.6f} < 下界 lb_i = {w_i:.6f}")
                explanation_parts.append(f"  - 因此必须截断在下界")
            
            if multiplier is not None and multiplier > 0:
                explanation_parts.append(f"  - 拉格朗日乘数 ν = {multiplier:.6f} > 0，表明约束是紧的（active）")
                explanation_parts.append(f"  - 影子价格 = {multiplier:.6f}：每放松1单位下界约束，目标函数可降低{multiplier:.6f}")
            else:
                explanation_parts.append(f"  - 拉格朗日乘数 ν = {multiplier:.6f} ≈ 0，表明约束在数值边界上")
            
            explanation_parts.append(f"  - 梯度分析: 目标函数梯度分量 ∇f_i = {gradient_i:.6f}")
            explanation_parts.append(f"  - 预算约束乘数 λ = {lambda_estimate:.6f}")
            
            nu_estimate = gradient_i + lambda_estimate
            if nu_estimate > 0:
                explanation_parts.append(f"  - 由于 ∇f_i + λ = {gradient_i:.6f} + {lambda_estimate:.6f} = {nu_estimate:.6f} > 0")
                explanation_parts.append(f"  - 需要 ν = {nu_estimate:.6f} > 0 来满足KKT条件")
                explanation_parts.append(f"  - 若尝试提高权重（w_i > lb_i），目标函数将上升，因为约束是有效的")
        
        return "\n".join(explanation_parts)

    def _check_risk_budget_consistency(
        self,
        idx: int,
        w_i: float,
        risk_budget: np.ndarray,
        risk_attr: RiskAttribution,
        at_upper: bool,
        at_lower: bool,
    ) -> str:
        """
        检查风险预算和协方差给出的结论是否一致
        """
        b_i = risk_budget[idx]
        actual_rc_pct = risk_attr.percent_risk_contribution[idx]
        deviation = actual_rc_pct - b_i
        
        consistency_parts = [
            f"风险预算一致性检验 (资产{idx}):",
            f"  - 目标风险预算 b_i = {b_i:.4%}",
            f"  - 实际风险贡献占比 = {actual_rc_pct:.4%}",
            f"  - 偏差 = {deviation:.4%}",
        ]
        
        if abs(deviation) < 0.01:
            consistency_parts.append("  - ✓ 协方差与风险预算结论一致")
        else:
            consistency_parts.append(f"  - ⚠ 协方差与风险预算存在偏差（偏差={deviation:.4%}）")
            consistency_parts.append(f"  - 边界约束作为补充证据: {'上界' if at_upper else '下界'} = {w_i:.6f} 阻止了进一步调整")
            consistency_parts.append(f"  - 若无此约束，权重应向 {'>' if deviation < 0 else '<'} {w_i:.6f} 方向移动")
        
        return "\n".join(consistency_parts)

    def optimize(
        self,
        cov: np.ndarray,
        risk_budget: np.ndarray,
        lower_bounds: Optional[np.ndarray] = None,
        upper_bounds: Optional[np.ndarray] = None,
        initial_weights: Optional[np.ndarray] = None,
    ) -> OptimizationResult:
        """
        执行风险预算优化
        
        参数:
            cov: 协方差矩阵 (n x n)
            risk_budget: 风险预算向量，和为1 (n,)
            lower_bounds: 权重下界 (n,)，默认为0
            upper_bounds: 权重上界 (n,)，默认为1
            initial_weights: 初始权重猜测 (n,)
        
        返回:
            OptimizationResult 包含完整的中间过程和边界解释
        
        拉格朗日函数（标准形式）:
            min f(w)
            s.t. h(w) = Σw_i - 1 = 0
                 g_upper_i(w) = w_i - ub_i ≤ 0
                 g_lower_i(w) = lb_i - w_i ≤ 0
            
            L = f + λ*h + Σμ_i*g_upper_i + Σν_i*g_lower_i
            
            其中 μ_i ≥ 0, ν_i ≥ 0
            
        KKT一阶条件:
            ∇L = ∇f + λ*1 + μ - ν = 0
            
            对于内部点（μ=ν=0）: ∇f + λ = 0 → λ = -∇f
            对于上界点（ν=0）: μ = -∇f - λ ≥ 0
            对于下界点（μ=0）: ν = ∇f + λ ≥ 0
        """
        self._step_counter = 0
        self._intermediate_steps = []
        self._execution_sequence = []
        self._warnings = []

        n = cov.shape[0]
        
        if self.asset_names is None:
            self.asset_names = [f"资产_{i}" for i in range(n)]

        if lower_bounds is None:
            lower_bounds = np.zeros(n)
        if upper_bounds is None:
            upper_bounds = np.ones(n)

        input_params = {
            "covariance_matrix": cov.tolist(),
            "risk_budget": risk_budget.tolist(),
            "lower_bounds": lower_bounds.tolist(),
            "upper_bounds": upper_bounds.tolist(),
            "tolerance": self.tolerance,
            "max_iterations": self.max_iterations,
        }

        self._add_step(
            "输入参数验证",
            "验证输入参数的合法性和维度一致性",
            input_params,
        )

        if abs(np.sum(risk_budget) - 1.0) > 1e-6:
            self._warnings.append(
                f"风险预算之和={np.sum(risk_budget):.6f}≠1，已自动归一化"
            )
            risk_budget = risk_budget / np.sum(risk_budget)
            self._add_step(
                "风险预算归一化",
                "风险预算必须和为1，已自动归一化",
                {"normalized_risk_budget": risk_budget.tolist()},
            )

        cov_diag = self._check_covariance(cov)
        cov_used = cov_diag.corrected_matrix

        self._add_step(
            "优化方法说明",
            "两阶段混合策略: 1)无约束绝对风险预算求解 2)归一化 3)必要时带约束优化",
            {
                "stage1_objective": "min 0.5*w'Σw - Σb_i*log(w_i)",
                "stage1_kkt": "w_i*(Σw)_i = b_i (绝对风险预算)",
                "stage2_normalization": "w = w_abs / Σw_abs_i",
                "stage2_property": "TRC_i/σ_p = b_i (相对风险预算)",
                "stage3_objective": "min 0.5*log(w'Σw) - Σb_i*log(w_i)",
                "stage3_kkt": "w_i*(Σw)_i / σ_p² = b_i + λ*w_i (相对风险预算带约束)",
                "lagrangian_standard_form": "L = f + λ(Σw_i-1) + Σμ_i(w_i-ub_i) + Σν_i(lb_i-w_i)",
                "kkt_first_order": "∇f + λ + μ - ν = 0",
                "kkt_dual_feasibility": "μ_i ≥ 0, ν_i ≥ 0",
                "kkt_complementary_slackness": "μ_i(w_i-ub_i)=0, ν_i(lb_i-w_i)=0",
            },
        )

        self._add_step(
            "阶段1: 无约束绝对风险预算求解",
            "求解 min 0.5*w'Σw - Σb_i*log(w_i)，无边界约束，无预算和约束",
            {
                "theory": "一阶条件 w_i*(Σw)_i = b_i 保证解的齐次性",
                "homogeneity_note": "若w是解，则kw也是解（k>0）",
            },
        )

        if initial_weights is None:
            initial_weights_abs = np.sqrt(risk_budget)
        else:
            initial_weights_abs = initial_weights.copy()
        
        initial_weights_abs = np.maximum(initial_weights_abs, 1e-8)

        self._add_step(
            "阶段1: 初始权重设置",
            "使用 sqrt(b_i) 作为无约束问题的初始猜测",
            {"initial_weights_absolute": initial_weights_abs.tolist()},
        )

        bounds_abs = [(1e-8, None) for _ in range(n)]

        start_time = time.time()
        
        try:
            result_abs = minimize(
                self._objective_absolute,
                initial_weights_abs,
                args=(cov_used, risk_budget),
                jac=self._gradient_absolute,
                method="SLSQP",
                bounds=bounds_abs,
                options={
                    "maxiter": self.max_iterations,
                    "ftol": self.tolerance,
                    "disp": False,
                },
            )
            
            opt_time_abs = time.time() - start_time
            iterations_abs = result_abs.nit
            success_abs = result_abs.success
            
            abs_trc = [
                float(result_abs.x[i] * (cov_used @ result_abs.x)[i])
                for i in range(n)
            ]
            
            self._add_step(
                "阶段1: 无约束优化完成",
                f"绝对风险预算问题求解完成，耗时{opt_time_abs:.4f}秒",
                {
                    "success": success_abs,
                    "iterations": iterations_abs,
                    "objective_value": float(result_abs.fun),
                    "absolute_weights": result_abs.x.tolist(),
                    "absolute_sum": float(np.sum(result_abs.x)),
                    "w_i*(Σw)_i (绝对TRC)": abs_trc,
                    "target_b_i": risk_budget.tolist(),
                    "deviation_abs": [abs(abs_trc[i] - risk_budget[i]) for i in range(n)],
                },
            )

        except Exception as e:
            self._warnings.append(f"阶段1优化失败: {str(e)}")
            success_abs = False
            iterations_abs = 0
            result_abs = None

        weights_abs = result_abs.x if result_abs is not None and result_abs.success else initial_weights_abs
        weights_abs = np.maximum(weights_abs, 1e-8)
        
        weights_stage2 = weights_abs / np.sum(weights_abs)
        
        self._add_step(
            "阶段2: 权重归一化",
            "将绝对风险预算解归一化得到相对风险预算解",
            {
                "absolute_weights": weights_abs.tolist(),
                "absolute_sum": float(np.sum(weights_abs)),
                "normalized_weights": weights_stage2.tolist(),
                "normalized_sum": float(np.sum(weights_stage2)),
                "math_note": "齐次性保证: 若w是绝对解，则kw也是解。归一化后相对风险贡献不变。",
            },
        )

        violates_bounds = np.any(weights_stage2 < lower_bounds - self.tolerance) or \
                          np.any(weights_stage2 > upper_bounds + self.tolerance)
        
        if violates_bounds:
            violations = [
                (i, float(weights_stage2[i]), float(lower_bounds[i]), float(upper_bounds[i]))
                for i in range(n)
                if weights_stage2[i] < lower_bounds[i] - self.tolerance or 
                   weights_stage2[i] > upper_bounds[i] + self.tolerance
            ]
            
            self._add_step(
                "阶段3: 边界约束检查 - 违反检测",
                "归一化后的权重违反边界约束，需要带约束优化",
                {
                    "normalized_weights": weights_stage2.tolist(),
                    "lower_bounds": lower_bounds.tolist(),
                    "upper_bounds": upper_bounds.tolist(),
                    "violations": violations,
                },
            )
            
            initial_weights_constrained = np.clip(weights_stage2, lower_bounds, upper_bounds)
            initial_weights_constrained = initial_weights_constrained / np.sum(initial_weights_constrained)
            initial_weights_constrained = np.maximum(initial_weights_constrained, 1e-8)
            
            bounds_constrained = list(zip(lower_bounds, upper_bounds))
            
            def eq_constraint(w):
                return np.sum(w) - 1.0
            
            def eq_jacobian(w):
                return np.ones_like(w)
            
            constraints = [{"type": "eq", "fun": eq_constraint, "jac": eq_jacobian}]
            
            self._add_step(
                "阶段3: 带约束优化问题定义",
                "直接在归一化空间求解带边界约束的风险预算问题",
                {
                    "objective": "0.5 * w'Σw - Σ b_i * log(w_i)",
                    "constraints": ["Σ w_i = 1"],
                    "bounds": list(zip(self.asset_names, lower_bounds.tolist(), upper_bounds.tolist())),
                    "initial_weights": initial_weights_constrained.tolist(),
                    "lagrangian": "L = 0.5*w'Σw - Σb_i*log(w_i) - λ(Σw_i-1) - Σμ_i(w_i-ub_i) - Σν_i(lb_i-w_i)",
                },
            )
            
            start_time = time.time()
            
            try:
                result_constrained = minimize(
                    self._objective_relative,
                    initial_weights_constrained,
                    args=(cov_used, risk_budget),
                    jac=self._gradient_relative,
                    method="SLSQP",
                    bounds=bounds_constrained,
                    constraints=constraints,
                    options={
                        "maxiter": self.max_iterations,
                        "ftol": self.tolerance,
                        "disp": False,
                    },
                )
                
                opt_time_constrained = time.time() - start_time
                iterations_constrained = result_constrained.nit
                success = result_constrained.success
                final_objective = result_constrained.fun
                iterations = iterations_abs + iterations_constrained
                
                self._add_step(
                    "阶段3: 带约束优化求解完成",
                    f"带约束优化求解完成，耗时{opt_time_constrained:.4f}秒",
                    {
                        "success": success,
                        "iterations": iterations_constrained,
                        "total_iterations": iterations,
                        "final_objective": float(final_objective),
                        "optimization_time": opt_time_constrained,
                        "message": result_constrained.message,
                        "constrained_weights": result_constrained.x.tolist(),
                        "constrained_sum": float(np.sum(result_constrained.x)),
                    },
                )
                
                weights = result_constrained.x if success else initial_weights_constrained
                
            except Exception as e:
                self._warnings.append(f"阶段3优化失败: {str(e)}")
                success = False
                iterations = iterations_abs
                final_objective = np.inf
                weights = initial_weights_constrained
            
        else:
            self._add_step(
                "阶段2: 边界约束检查 - 通过",
                "归一化后的权重满足所有边界约束，无需带约束优化",
                {
                    "all_weights_within_bounds": True,
                    "normalized_weights": weights_stage2.tolist(),
                },
            )
            
            success = success_abs
            iterations = iterations_abs
            final_objective = float(result_abs.fun) if result_abs is not None else np.inf
            weights = weights_stage2

        weights = np.clip(weights, lower_bounds, upper_bounds)
        weights = weights / np.sum(weights)
        weights = np.maximum(weights, 1e-8)
        
        self._add_step(
            "最优权重结果",
            "优化后的最终权重，已确保满足边界约束和预算约束",
            {
                "optimal_weights": weights.tolist(),
                "weights_sum": float(np.sum(weights)),
                "optimization_method": "两阶段无约束+归一化" if not violates_bounds else "三阶段带约束优化",
            },
        )

        risk_attr = self._compute_risk_attribution(weights, cov_used, risk_budget)

        upper_mult = np.zeros(n)
        lower_mult = np.zeros(n)
        
        sigma_w = cov_used @ weights
        portfolio_variance = weights @ cov_used @ weights
        
        if violates_bounds:
            grad = sigma_w / portfolio_variance - risk_budget / np.maximum(weights, self.tolerance)
            grad_formula = "∇f = Σw/σ_p² - b/w"
            kkt_formula = "∇f + λ + μ - ν = 0"
            kkt_meaning = "对于内部点: μ=ν=0 ⇒ λ = -∇f"
        else:
            grad = sigma_w - risk_budget / np.maximum(weights, self.tolerance)
            grad_formula = "∇f = Σw - b/w"
            kkt_formula = "∇f + λ + μ - ν = 0"
            kkt_meaning = "对于内部点: μ=ν=0 ⇒ λ = -∇f"
        
        internal_indices = []
        for i in range(n):
            at_upper = abs(weights[i] - upper_bounds[i]) < self.tolerance * max(1.0, abs(upper_bounds[i]))
            at_lower = abs(weights[i] - lower_bounds[i]) < self.tolerance * max(1.0, abs(lower_bounds[i]))
            if not at_upper and not at_lower:
                internal_indices.append(i)
        
        if internal_indices:
            lambda_est_normalized = -np.mean([grad[i] for i in internal_indices])
        else:
            lambda_est_normalized = -np.mean(grad)

        self._add_step(
            "拉格朗日乘数估计 - 步骤1: 估计λ",
            "从内部点（非边界）估计预算约束乘数λ",
            {
                f"gradient ({grad_formula})": grad.tolist(),
                "sigma_w (Σw)": sigma_w.tolist(),
                "portfolio_variance (σ_p²)": float(portfolio_variance),
                "internal_points_indices": internal_indices,
                "internal_gradients": [float(grad[i]) for i in internal_indices],
                "negative_internal_gradients": [float(-grad[i]) for i in internal_indices],
                "lambda (预算约束乘数)": float(lambda_est_normalized),
                "kkt_first_order": kkt_formula,
                "kkt_meaning": kkt_meaning,
                "space_used": "相对风险预算空间（阶段3）" if violates_bounds else "绝对风险预算空间（阶段1+2）",
            },
        )
        
        for i in range(n):
            at_upper = abs(weights[i] - upper_bounds[i]) < self.tolerance * max(1.0, abs(upper_bounds[i]))
            at_lower = abs(weights[i] - lower_bounds[i]) < self.tolerance * max(1.0, abs(lower_bounds[i]))
            
            if at_upper and not at_lower:
                upper_mult[i] = max(0, -grad[i] - lambda_est_normalized)
                lower_mult[i] = 0
            elif at_lower and not at_upper:
                lower_mult[i] = max(0, grad[i] + lambda_est_normalized)
                upper_mult[i] = 0
            else:
                upper_mult[i] = 0
                lower_mult[i] = 0

        self._add_step(
            "拉格朗日乘数估计 - 步骤2: 计算μ和ν",
            "基于KKT互补松弛条件计算边界约束的拉格朗日乘数",
            {
                "upper_bound_multipliers (μ)": upper_mult.tolist(),
                "lower_bound_multipliers (ν)": lower_mult.tolist(),
                "kkt_note": [
                    "对于上界点: μ = max(0, -∇f - λ) ≥ 0",
                    "对于下界点: ν = max(0, ∇f + λ) ≥ 0",
                    "对于内部点: μ = ν = 0",
                ],
                "complementary_slackness": [
                    "μ_i(w_i-ub_i)=0",
                    "ν_i(lb_i-w_i)=0",
                ],
                "verification": [
                    f"μ_i*(w_i-ub_i) = {float(upper_mult[i] * (weights[i] - upper_bounds[i])):.6e}" 
                    for i in range(n)
                ] + [
                    f"ν_i*(lb_i-w_i) = {float(lower_mult[i] * (lower_bounds[i] - weights[i])):.6e}" 
                    for i in range(n)
                ],
            },
        )

        boundary_explanations = []
        for i in range(n):
            explanation = self._explain_boundary(
                i, weights, lower_bounds, upper_bounds, cov_used, risk_budget,
                upper_mult, lower_mult, risk_attr, lambda_est_normalized, grad,
                uses_relative_objective=violates_bounds
            )
            if explanation is not None:
                boundary_explanations.append(explanation)

        if not cov_diag.is_positive_definite:
            weight_violations = []
            for i in range(n):
                at_upper = abs(weights[i] - upper_bounds[i]) < self.tolerance * max(1.0, abs(upper_bounds[i]))
                at_lower = abs(weights[i] - lower_bounds[i]) < self.tolerance * max(1.0, abs(lower_bounds[i]))
                if at_upper or at_lower:
                    weight_violations.append(i)
            
            if weight_violations:
                self._add_step(
                    "边界与正定性问题时序分析",
                    "分析权重越界和协方差不正定的出现顺序",
                    {
                        "covariance_non_pd_detected_at_step": 2,
                        "boundary_violations_detected_at_step": len(self._execution_sequence) - 2,
                        "execution_sequence": self._execution_sequence,
                        "sequence": [
                            "步骤2: 检测到协方差不正定，执行修正",
                            f"步骤{len(self._execution_sequence) - 2}: 检测到权重边界约束生效",
                            f"边界资产: {[self.asset_names[i] for i in weight_violations]}",
                            "⚠ 注意：边界解释在协方差修正之后才完整可用",
                            "⚠ 时序: 先检测到非正定，后检测到边界约束生效",
                        ],
                    },
                )

        kkt_tolerance = 1e-4
        kkt_residuals = [
            abs(grad[i] + lambda_est_normalized + upper_mult[i] - lower_mult[i])
            for i in range(n)
        ]
        
        self._add_step(
            "最终结果印证",
            "验证风险归因和边界提示是否与优化结论一致",
            {
                "all_weights_sum_to_one": abs(np.sum(weights) - 1.0) < 1e-6,
                "all_weights_within_bounds": bool(np.all(weights >= lower_bounds - self.tolerance) and np.all(weights <= upper_bounds + self.tolerance)),
                "risk_contribution_matches_budget_for_unconstrained": bool(all(
                    abs(risk_attr.risk_budget_deviation[i]) < 0.01 
                    for i in range(n) 
                    if abs(upper_mult[i]) < self.tolerance and abs(lower_mult[i]) < self.tolerance
                )),
                "boundary_multipliers_non_negative": bool(np.all(upper_mult >= -self.tolerance) and np.all(lower_mult >= -self.tolerance)),
                "kkt_conditions_satisfied": bool(all(
                    res < kkt_tolerance for res in kkt_residuals
                )),
                "kkt_first_order_condition": "∇f + λ + μ - ν = 0",
                "kkt_residuals": kkt_residuals,
                "kkt_tolerance": kkt_tolerance,
                "max_kkt_residual": float(max(kkt_residuals)),
            },
        )

        return OptimizationResult(
            success=success,
            weights=weights,
            asset_names=self.asset_names,
            optimization_method="SLSQP with Lagrangian KKT analysis (two-stage)",
            iterations=iterations,
            final_objective=float(final_objective),
            lagrangian_multipliers=np.array([lambda_est_normalized] * n),
            upper_bound_multipliers=upper_mult,
            lower_bound_multipliers=lower_mult,
            risk_attribution=risk_attr,
            covariance_diagnostic=cov_diag,
            boundary_explanations=boundary_explanations,
            intermediate_steps=self._intermediate_steps,
            warnings=self._warnings,
            execution_sequence=self._execution_sequence,
            input_parameters=input_params,
        )
