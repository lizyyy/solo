"""风险识别与停测决策 - 核心风险检测与停测提示"""

from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass

from .data_models import (
    ExperimentInput,
    BayesianResult,
    RiskAssessment,
    RiskFlag,
    RiskLevel,
    StoppingReason,
)
from .reproducibility import ReproducibilityManager


class RiskDetector:
    """风险检测器
    
    核心检测能力：
    1. 提前停测检测 - 样本量小、观察窗口未结束
    2. 先验过强检测 - 先验强度主导后验结果
    3. 多指标方向冲突检测 - 不同指标结论相反
    """

    PRIOR_STRENGTH_RATIO_THRESHOLD = 0.3
    PRIOR_STRENGTH_CRITICAL_THRESHOLD = 0.5
    EARLY_STOP_SAMPLE_RATIO_THRESHOLD = 0.5
    EARLY_STOP_DAY_RATIO_THRESHOLD = 0.5
    METRIC_CONFLICT_THRESHOLD = 0.8

    def __init__(self, reproducibility_manager: ReproducibilityManager):
        self.reproducibility = reproducibility_manager

    def assess(
        self,
        experiment_input: ExperimentInput,
        bayesian_result: BayesianResult,
    ) -> RiskAssessment:
        """执行风险评估
        
        Args:
            experiment_input: 试验输入
            bayesian_result: 贝叶斯计算结果
            
        Returns:
            风险评估结果
        """
        self.reproducibility.trace_step(
            "风险评估开始",
            {
                "experiment_id": experiment_input.experiment_id,
                "prior_strength": bayesian_result.prior_strength,
                "effective_sample_size": bayesian_result.effective_sample_size,
            },
            {},
        )

        flags: List[RiskFlag] = []

        self.reproducibility.trace_step("检测提前停测风险", {}, {})
        early_stop_flag = self._detect_early_stopping(experiment_input, bayesian_result)
        if early_stop_flag:
            flags.append(early_stop_flag)

        self.reproducibility.trace_step("检测先验过强风险", {}, {})
        prior_flag = self._detect_strong_prior(experiment_input, bayesian_result)
        if prior_flag:
            flags.append(prior_flag)

        self.reproducibility.trace_step("检测多指标方向冲突", {}, {})
        conflict_flag = self._detect_metric_conflict(experiment_input, bayesian_result)
        if conflict_flag:
            flags.append(conflict_flag)

        self.reproducibility.trace_step("检测样本量不足风险", {}, {})
        sample_size_flag = self._detect_small_sample(experiment_input, bayesian_result)
        if sample_size_flag:
            flags.append(sample_size_flag)

        self.reproducibility.trace_step("检测可信区间过宽风险", {}, {})
        ci_flag = self._detect_wide_ci(bayesian_result)
        if ci_flag:
            flags.append(ci_flag)

        has_early_stop = any(f.risk_type == "early_stopping" for f in flags)
        has_strong_prior = any(f.risk_type == "strong_prior" for f in flags)
        has_metric_conflict = any(f.risk_type == "metric_conflict" for f in flags)

        overall_risk = self._calculate_overall_risk(flags)

        self.reproducibility.trace_step("生成停测建议", {}, {})
        stopping_recommendation, stopping_message = self._generate_stopping_recommendation(
            experiment_input,
            bayesian_result,
            flags,
            overall_risk,
        )

        self.reproducibility.trace_step(
            "风险评估完成",
            {},
            {
                "overall_risk": overall_risk.value,
                "has_early_stop": has_early_stop,
                "has_strong_prior": has_strong_prior,
                "has_metric_conflict": has_metric_conflict,
                "stopping_recommendation": stopping_recommendation.value,
            },
        )

        return RiskAssessment(
            has_early_stop=has_early_stop,
            has_strong_prior=has_strong_prior,
            has_metric_conflict=has_metric_conflict,
            overall_risk_level=overall_risk,
            flags=flags,
            stopping_recommendation=stopping_recommendation,
            stopping_message=stopping_message,
        )

    def _detect_early_stopping(
        self,
        experiment_input: ExperimentInput,
        bayesian_result: BayesianResult,
    ) -> Optional[RiskFlag]:
        """检测提前停测风险
        
        判定条件：
        1. 当前样本量 < 计划样本量 * 50%，且 P(实验组>对照组) 已很高
        2. 当前试验天数 < 观察窗口 * 50%，且有停测倾向
        """
        evidence: Dict[str, Any] = {}
        is_early_stop = False
        risk_level = RiskLevel.NONE
        message_parts: List[str] = []

        if (
            experiment_input.planned_sample_size is not None
            and experiment_input.control is not None
            and experiment_input.control.sample_size is not None
            and experiment_input.treatment is not None
            and experiment_input.treatment.sample_size is not None
        ):
            current_total = (
                experiment_input.control.sample_size
                + experiment_input.treatment.sample_size
            )
            planned = experiment_input.planned_sample_size
            sample_ratio = current_total / planned if planned > 0 else 1.0

            evidence["current_sample_size"] = current_total
            evidence["planned_sample_size"] = planned
            evidence["sample_ratio"] = sample_ratio

            if sample_ratio < self.EARLY_STOP_SAMPLE_RATIO_THRESHOLD:
                is_early_stop = True
                if sample_ratio < 0.2:
                    risk_level = RiskLevel.CRITICAL
                elif sample_ratio < 0.3:
                    risk_level = RiskLevel.HIGH
                else:
                    risk_level = RiskLevel.MEDIUM
                message_parts.append(
                    f"当前仅收集了计划样本量的 {sample_ratio:.1%}"
                    f"（{current_total}/{planned}）"
                )

                prob_better = bayesian_result.probability_treatment_better
                if prob_better > 0.95 or prob_better < 0.05:
                    evidence["probability_treatment_better"] = prob_better
                    message_parts.append(
                        f"但P(实验组>对照组)已达 {prob_better:.1%}，"
                        f"存在过早得出结论的风险"
                    )

        if (
            experiment_input.current_day is not None
            and experiment_input.observation_window_days is not None
        ):
            day_ratio = (
                experiment_input.current_day / experiment_input.observation_window_days
                if experiment_input.observation_window_days > 0
                else 1.0
            )

            evidence["current_day"] = experiment_input.current_day
            evidence["observation_window_days"] = experiment_input.observation_window_days
            evidence["day_ratio"] = day_ratio

            if day_ratio < self.EARLY_STOP_DAY_RATIO_THRESHOLD:
                is_early_stop = True
                day_risk = RiskLevel.MEDIUM
                if day_ratio < 0.2:
                    day_risk = RiskLevel.HIGH
                risk_level = max(risk_level, day_risk)
                message_parts.append(
                    f"当前仅进行了观察窗口的 {day_ratio:.1%}"
                    f"（{experiment_input.current_day}/{experiment_input.observation_window_days}天）"
                )

        if is_early_stop:
            return RiskFlag(
                risk_type="early_stopping",
                level=risk_level,
                message=" | ".join(message_parts),
                evidence=evidence,
                recommendation=(
                    "建议继续收集数据直至达到计划样本量或观察窗口结束。"
                    "提前停测可能高估效应量并增加假阳性风险。"
                    "如需提前决策，请参考预期损失（EL）和贝叶斯因子（BF）。"
                ),
            )

        return None

    def _detect_strong_prior(
        self,
        experiment_input: ExperimentInput,
        bayesian_result: BayesianResult,
    ) -> Optional[RiskFlag]:
        """检测先验过强风险
        
        判定条件：
        先验强度 / (先验强度 + 实际样本量) > 阈值
        即先验对后验的贡献超过实际数据
        """
        if (
            experiment_input.control is None
            or experiment_input.control.sample_size is None
            or experiment_input.treatment is None
            or experiment_input.treatment.sample_size is None
        ):
            return None

        prior_strength = bayesian_result.prior_strength
        total_obs = (
            experiment_input.control.sample_size + experiment_input.treatment.sample_size
        )

        if total_obs == 0:
            return None

        prior_ratio = prior_strength / (prior_strength + total_obs)

        evidence = {
            "prior_strength": prior_strength,
            "total_observations": total_obs,
            "prior_contribution_ratio": prior_ratio,
        }

        if experiment_input.prior and experiment_input.prior.description:
            evidence["prior_description"] = experiment_input.prior.description

        if prior_ratio >= self.PRIOR_STRENGTH_CRITICAL_THRESHOLD:
            return RiskFlag(
                risk_type="strong_prior",
                level=RiskLevel.CRITICAL,
                message=(
                    f"先验强度 ({prior_strength:.1f}) 相对于实际样本量 ({total_obs}) 过强，"
                    f"先验对后验的贡献占比达 {prior_ratio:.1%}，"
                    f"后验结果可能主要由先验主导而非实际数据"
                ),
                evidence=evidence,
                recommendation=(
                    "强烈建议弱化先验（减小alpha+beta）或收集更多实际数据。"
                    "当前先验可能掩盖了数据中的真实效应。"
                    "可考虑使用无信息先验（如Beta(1,1)）进行敏感性分析。"
                ),
            )
        elif prior_ratio >= self.PRIOR_STRENGTH_RATIO_THRESHOLD:
            return RiskFlag(
                risk_type="strong_prior",
                level=RiskLevel.MEDIUM,
                message=(
                    f"先验强度 ({prior_strength:.1f}) 较强，"
                    f"对后验的贡献占比达 {prior_ratio:.1%}，"
                    f"请确认先验设置是否合理"
                ),
                evidence=evidence,
                recommendation=(
                    "建议检查先验设置是否合理，可进行敏感性分析："
                    "同时使用强先验和弱先验计算，对比结果差异。"
                ),
            )

        return None

    def _detect_metric_conflict(
        self,
        experiment_input: ExperimentInput,
        bayesian_result: BayesianResult,
    ) -> Optional[RiskFlag]:
        """检测多指标方向冲突
        
        判定条件：
        存在两个或更多指标，其中一些指标显著正向，另一些显著负向
        """
        if not bayesian_result.metric_results or len(bayesian_result.metric_results) < 2:
            return None

        metric_directions: Dict[str, Dict[str, Any]] = {}
        positive_metrics: List[str] = []
        negative_metrics: List[str] = []
        inconclusive_metrics: List[str] = []

        for metric_name, metric_result in bayesian_result.metric_results.items():
            prob_better = metric_result.probability_treatment_better
            lift = metric_result.expected_lift
            ci_includes_zero = metric_result.lift_ci_lower < 0 < metric_result.lift_ci_upper

            metric_directions[metric_name] = {
                "probability_treatment_better": prob_better,
                "expected_lift": lift,
                "ci_lower": metric_result.lift_ci_lower,
                "ci_upper": metric_result.lift_ci_upper,
                "ci_includes_zero": ci_includes_zero,
            }

            if prob_better >= self.METRIC_CONFLICT_THRESHOLD:
                positive_metrics.append(metric_name)
            elif prob_better <= (1 - self.METRIC_CONFLICT_THRESHOLD):
                negative_metrics.append(metric_name)
            else:
                inconclusive_metrics.append(metric_name)

        evidence = {
            "metric_directions": metric_directions,
            "positive_metrics": positive_metrics,
            "negative_metrics": negative_metrics,
            "inconclusive_metrics": inconclusive_metrics,
            "conflict_threshold": self.METRIC_CONFLICT_THRESHOLD,
        }

        if positive_metrics and negative_metrics:
            return RiskFlag(
                risk_type="metric_conflict",
                level=RiskLevel.HIGH,
                message=(
                    f"多指标方向冲突：正向指标 [{', '.join(positive_metrics)}] "
                    f"与负向指标 [{', '.join(negative_metrics)}] 同时存在。"
                    f"正向指标P(实验组>对照组)≥{self.METRIC_CONFLICT_THRESHOLD:.0%}，"
                    f"负向指标P(实验组>对照组)≤{1-self.METRIC_CONFLICT_THRESHOLD:.0%}"
                ),
                evidence=evidence,
                recommendation=(
                    "存在指标冲突，需谨慎解读试验结果。"
                    "建议：1) 检查各指标的业务相关性和权重；"
                    "2) 进行多重比较校正（如使用贝叶斯多重检验）；"
                    "3) 综合考虑预期损失进行决策；"
                    "4) 如有可能，结合定性研究理解冲突原因。"
                ),
            )

        return None

    def _detect_small_sample(
        self,
        experiment_input: ExperimentInput,
        bayesian_result: BayesianResult,
    ) -> Optional[RiskFlag]:
        """检测样本量不足风险"""
        if (
            experiment_input.control is None
            or experiment_input.control.sample_size is None
            or experiment_input.treatment is None
            or experiment_input.treatment.sample_size is None
        ):
            return None

        control_size = experiment_input.control.sample_size
        treatment_size = experiment_input.treatment.sample_size
        total_size = control_size + treatment_size
        ess = bayesian_result.effective_sample_size

        evidence = {
            "control_sample_size": control_size,
            "treatment_sample_size": treatment_size,
            "total_sample_size": total_size,
            "effective_sample_size": ess,
        }

        if control_size < 30 or treatment_size < 30:
            return RiskFlag(
                risk_type="small_sample",
                level=RiskLevel.HIGH,
                message=(
                    f"样本量过小：对照组 {control_size}，实验组 {treatment_size}。"
                    f"小样本可能导致后验分布不稳定，结论不可靠"
                ),
                evidence=evidence,
                recommendation=(
                    "样本量不足，建议继续收集更多数据。"
                    "对于小样本数据，贝叶斯方法虽比频率统计更稳定，"
                    "但仍建议每组至少30个样本以获得可靠结果。"
                ),
            )
        elif control_size < 100 or treatment_size < 100 or total_size < 200 or ess < 200:
            return RiskFlag(
                risk_type="small_sample",
                level=RiskLevel.MEDIUM,
                message=(
                    f"样本量偏小：对照组 {control_size}，实验组 {treatment_size}，"
                    f"总样本量 {total_size}，有效样本量 {ess:.0f}。"
                    f"结论可能不够稳健"
                ),
                evidence=evidence,
                recommendation=(
                    "建议继续收集数据以提高结论稳健性。"
                    "如需基于当前数据决策，请谨慎解读并报告不确定性。"
                ),
            )

        return None

    def _detect_wide_ci(
        self,
        bayesian_result: BayesianResult,
    ) -> Optional[RiskFlag]:
        """检测可信区间过宽风险"""
        ci_width = bayesian_result.lift_ci_upper - bayesian_result.lift_ci_lower
        lift = abs(bayesian_result.expected_lift)

        evidence = {
            "lift_ci_lower": bayesian_result.lift_ci_lower,
            "lift_ci_upper": bayesian_result.lift_ci_upper,
            "ci_width": ci_width,
            "expected_lift": bayesian_result.expected_lift,
            "ci_includes_zero": bayesian_result.lift_ci_lower < 0 < bayesian_result.lift_ci_upper,
        }

        if bayesian_result.lift_ci_lower < 0 < bayesian_result.lift_ci_upper:
            return RiskFlag(
                risk_type="wide_ci",
                level=RiskLevel.MEDIUM,
                message=(
                    f"提升量的95%可信区间包含零 [{bayesian_result.lift_ci_lower:.4f}, "
                    f"{bayesian_result.lift_ci_upper:.4f}]，"
                    f"无法确定实验组是否真的优于对照组"
                ),
                evidence=evidence,
                recommendation=(
                    "可信区间包含零，说明效应方向尚不明确。"
                    "建议继续收集数据以缩小可信区间，"
                    "或使用区间假设检验（如ROPE）进行决策。"
                ),
            )
        elif ci_width > 0.1:  # CI宽度超过10%
            return RiskFlag(
                risk_type="wide_ci",
                level=RiskLevel.LOW,
                message=(
                    f"提升量的可信区间较宽（{ci_width:.1%}），"
                    f"效应量估计不够精确"
                ),
                evidence=evidence,
                recommendation=(
                    "建议收集更多数据以提高效应量估计精度。"
                ),
            )

        return None

    def _calculate_overall_risk(self, flags: List[RiskFlag]) -> RiskLevel:
        """计算整体风险等级"""
        if not flags:
            return RiskLevel.NONE

        level_order = [
            RiskLevel.NONE,
            RiskLevel.LOW,
            RiskLevel.MEDIUM,
            RiskLevel.HIGH,
            RiskLevel.CRITICAL,
        ]

        max_level = RiskLevel.NONE
        for flag in flags:
            if level_order.index(flag.level) > level_order.index(max_level):
                max_level = flag.level

        return max_level

    def _generate_stopping_recommendation(
        self,
        experiment_input: ExperimentInput,
        bayesian_result: BayesianResult,
        flags: List[RiskFlag],
        overall_risk: RiskLevel,
    ) -> Tuple[StoppingReason, str]:
        """生成停测建议"""
        prob_better = bayesian_result.probability_treatment_better
        has_early_stop = any(f.risk_type == "early_stopping" for f in flags)
        has_strong_prior = any(f.risk_type == "strong_prior" for f in flags)
        has_metric_conflict = any(f.risk_type == "metric_conflict" for f in flags)
        ci_includes_zero = (
            bayesian_result.lift_ci_lower < 0 < bayesian_result.lift_ci_upper
        )

        threshold = experiment_input.stopping_threshold or 0.95

        sample_size_reached = False
        if (
            experiment_input.planned_sample_size is not None
            and experiment_input.control is not None
            and experiment_input.control.sample_size is not None
            and experiment_input.treatment is not None
            and experiment_input.treatment.sample_size is not None
        ):
            total = (
                experiment_input.control.sample_size
                + experiment_input.treatment.sample_size
            )
            sample_size_reached = total >= experiment_input.planned_sample_size

        window_reached = False
        if (
            experiment_input.current_day is not None
            and experiment_input.observation_window_days is not None
        ):
            window_reached = (
                experiment_input.current_day
                >= experiment_input.observation_window_days
            )

        if has_early_stop and (prob_better >= threshold or prob_better <= (1 - threshold)):
            return (
                StoppingReason.EARLY_STOP,
                (
                    f"⚠️ 检测到提前停测风险！虽然P(实验组>对照组)={prob_better:.1%} "
                    f"已达到阈值{threshold:.0%}，但当前仅完成了计划的一部分。"
                    f"建议：继续试验直至样本量或观察窗口达标，"
                    f"或使用贝叶斯因子/预期损失进行更保守的决策。"
                ),
            )

        if has_metric_conflict:
            return (
                StoppingReason.NOT_STOPPED,
                (
                    f"⚠️ 多指标方向冲突，不建议停测。"
                    f"需要进一步分析指标冲突原因，综合评估业务影响。"
                ),
            )

        if has_strong_prior:
            return (
                StoppingReason.NOT_STOPPED,
                (
                    f"⚠️ 先验过强，建议先弱化先验或收集更多数据，"
                    f"再进行停测决策。"
                ),
            )

        if ci_includes_zero:
            return (
                StoppingReason.NOT_STOPPED,
                (
                    f"提升量可信区间包含零，效应方向不明确，"
                    f"建议继续收集数据以获得更明确的结论。"
                ),
            )

        if sample_size_reached or window_reached:
            if prob_better >= threshold:
                return (
                    StoppingReason.SAMPLE_SIZE_REACHED
                    if sample_size_reached
                    else StoppingReason.OBSERVATION_WINDOW_END,
                    (
                        f"✅ 建议停测。"
                        f"P(实验组>对照组)={prob_better:.1%} ≥ {threshold:.0%}，"
                        f"预期提升{bayesian_result.expected_lift:.2%}，"
                        f"95%CI [{bayesian_result.lift_ci_lower:.2%}, {bayesian_result.lift_ci_upper:.2%}]。"
                        f"{'已达到计划样本量' if sample_size_reached else '已完成观察窗口'}。"
                    ),
                )
            elif prob_better <= (1 - threshold):
                return (
                    StoppingReason.SAMPLE_SIZE_REACHED
                    if sample_size_reached
                    else StoppingReason.OBSERVATION_WINDOW_END,
                    (
                        f"✅ 建议停测。"
                        f"P(实验组≤对照组)={1-prob_better:.1%} ≥ {threshold:.0%}，"
                        f"实验组表现不佳，建议停止试验。"
                    ),
                )
            else:
                return (
                    StoppingReason.NOT_STOPPED,
                    (
                        f"⚖️ 证据尚不充分。P(实验组>对照组)={prob_better:.1%}，"
                        f"未达到{threshold:.0%}的停测阈值。"
                        f"建议继续收集数据。"
                    ),
                )

        return (
            StoppingReason.NOT_STOPPED,
            (
                f"⏳ 试验进行中。P(实验组>对照组)={prob_better:.1%}，"
                f"尚未达到计划样本量或观察窗口。"
            ),
        )
