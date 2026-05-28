"""贝叶斯核心计算 - 共轭先验更新、后验分布、可信区间"""

import numpy as np
from scipy import stats
from typing import Dict, Any, Optional, List, Tuple

from .data_models import (
    ExperimentInput,
    VariantData,
    PriorParams,
    BayesianResult,
    PosteriorStats,
)
from .reproducibility import ReproducibilityManager


class BayesianCalculator:
    """贝叶斯计算器
    
    使用Beta-Binomial共轭模型进行A/B测试分析：
    - 先验: Beta(alpha, beta)
    - 似然: Binomial(n, p)
    - 后验: Beta(alpha + conversions, beta + (sample_size - conversions))
    """

    DEFAULT_CREDIBLE_LEVEL = 0.95
    DEFAULT_SAMPLE_COUNT = 100000

    def __init__(self, reproducibility_manager: ReproducibilityManager):
        self.reproducibility = reproducibility_manager

    def calculate(
        self,
        experiment_input: ExperimentInput,
        credible_level: float = DEFAULT_CREDIBLE_LEVEL,
        sample_count: int = DEFAULT_SAMPLE_COUNT,
    ) -> BayesianResult:
        """执行贝叶斯计算
        
        Args:
            experiment_input: 试验输入数据
            credible_level: 可信区间水平，默认0.95
            sample_count: MCMC采样数量，默认100000
            
        Returns:
            贝叶斯计算结果
        """
        self.reproducibility.reset_random_state()

        self.reproducibility.trace_step(
            "贝叶斯计算开始",
            {
                "experiment_id": experiment_input.experiment_id,
                "credible_level": credible_level,
                "sample_count": sample_count,
            },
            {},
        )

        if experiment_input.prior is None or experiment_input.prior.alpha is None or experiment_input.prior.beta is None:
            raise ValueError(
                "先验参数不完整，无法进行贝叶斯更新。"
                "请提供 prior.alpha 和 prior.beta。"
            )

        if experiment_input.control is None or experiment_input.treatment is None:
            raise ValueError("缺少对照组或实验组数据")

        if (
            experiment_input.control.sample_size is None
            or experiment_input.control.conversions is None
            or experiment_input.treatment.sample_size is None
            or experiment_input.treatment.conversions is None
        ):
            raise ValueError("缺少样本量或转化数数据")

        self.reproducibility.trace_step(
            "计算先验强度",
            {
                "prior_alpha": experiment_input.prior.alpha,
                "prior_beta": experiment_input.prior.beta,
            },
            {},
        )

        prior_strength = experiment_input.prior.alpha + experiment_input.prior.beta
        effective_sample_size = self._calculate_effective_sample_size(
            experiment_input.control.sample_size,
            experiment_input.treatment.sample_size,
            prior_strength,
        )

        self.reproducibility.trace_step(
            "更新后验分布 - 对照组",
            {
                "prior_alpha": experiment_input.prior.alpha,
                "prior_beta": experiment_input.prior.beta,
                "sample_size": experiment_input.control.sample_size,
                "conversions": experiment_input.control.conversions,
            },
            {},
        )

        control_posterior = self._update_posterior(
            experiment_input.prior.alpha,
            experiment_input.prior.beta,
            experiment_input.control.sample_size,
            experiment_input.control.conversions,
            credible_level,
            sample_count,
            "control",
        )

        self.reproducibility.trace_step(
            "更新后验分布 - 实验组",
            {
                "prior_alpha": experiment_input.prior.alpha,
                "prior_beta": experiment_input.prior.beta,
                "sample_size": experiment_input.treatment.sample_size,
                "conversions": experiment_input.treatment.conversions,
            },
            {},
        )

        treatment_posterior = self._update_posterior(
            experiment_input.prior.alpha,
            experiment_input.prior.beta,
            experiment_input.treatment.sample_size,
            experiment_input.treatment.conversions,
            credible_level,
            sample_count,
            "treatment",
        )

        self.reproducibility.trace_step(
            "计算实验组优于对照组的概率",
            {
                "control_samples": len(control_posterior.samples) if control_posterior.samples else 0,
                "treatment_samples": len(treatment_posterior.samples) if treatment_posterior.samples else 0,
            },
            {},
        )

        prob_better, lift_samples = self._calculate_probability_better(
            control_posterior,
            treatment_posterior,
            sample_count,
        )

        self.reproducibility.trace_step(
            "计算提升量和可信区间",
            {"probability_treatment_better": prob_better},
            {},
        )

        expected_lift = float(np.mean(lift_samples))
        lift_ci_lower = float(np.percentile(lift_samples, (1 - credible_level) / 2 * 100))
        lift_ci_upper = float(np.percentile(lift_samples, (1 + credible_level) / 2 * 100))

        computation_trace = {
            "prior_strength": prior_strength,
            "effective_sample_size": effective_sample_size,
            "control_posterior_alpha": experiment_input.prior.alpha + experiment_input.control.conversions,
            "control_posterior_beta": experiment_input.prior.beta + (experiment_input.control.sample_size - experiment_input.control.conversions),
            "treatment_posterior_alpha": experiment_input.prior.alpha + experiment_input.treatment.conversions,
            "treatment_posterior_beta": experiment_input.prior.beta + (experiment_input.treatment.sample_size - experiment_input.treatment.conversions),
            "sample_count": sample_count,
            "credible_level": credible_level,
            "seed": self.reproducibility.get_seed(),
        }

        result = BayesianResult(
            control_posterior=control_posterior,
            treatment_posterior=treatment_posterior,
            prior_strength=prior_strength,
            effective_sample_size=effective_sample_size,
            probability_treatment_better=prob_better,
            expected_lift=expected_lift,
            lift_ci_lower=lift_ci_lower,
            lift_ci_upper=lift_ci_upper,
            computation_trace=computation_trace,
        )

        self.reproducibility.trace_step(
            "贝叶斯计算完成",
            {},
            {
                "probability_treatment_better": prob_better,
                "expected_lift": expected_lift,
                "lift_ci": [lift_ci_lower, lift_ci_upper],
            },
        )

        if experiment_input.metrics:
            result.metric_results = self._calculate_metrics(
                experiment_input,
                experiment_input.metrics,
                credible_level,
                sample_count,
            )

        return result

    def _update_posterior(
        self,
        prior_alpha: float,
        prior_beta: float,
        sample_size: int,
        conversions: int,
        credible_level: float,
        sample_count: int,
        variant_name: str,
    ) -> PosteriorStats:
        """更新后验分布
        
        Beta-Binomial共轭更新：
        posterior_alpha = prior_alpha + conversions
        posterior_beta = prior_beta + (sample_size - conversions)
        """
        post_alpha = prior_alpha + conversions
        post_beta = prior_beta + (sample_size - conversions)

        self.reproducibility.trace_step(
            f"后验更新 - {variant_name}",
            {
                "prior_alpha": prior_alpha,
                "prior_beta": prior_beta,
                "sample_size": sample_size,
                "conversions": conversions,
            },
            {
                "post_alpha": post_alpha,
                "post_beta": post_beta,
            },
        )

        posterior = stats.beta(post_alpha, post_beta)

        mean = float(posterior.mean())
        median = float(posterior.median())
        std = float(posterior.std())

        ci_lower = float(posterior.ppf((1 - credible_level) / 2))
        ci_upper = float(posterior.ppf((1 + credible_level) / 2))

        samples = posterior.rvs(size=sample_count, random_state=self.reproducibility.get_seed())

        return PosteriorStats(
            mean=mean,
            median=median,
            std=std,
            ci_lower=ci_lower,
            ci_upper=ci_upper,
            credible_level=credible_level,
            samples=samples.tolist(),
        )

    def _calculate_probability_better(
        self,
        control_posterior: PosteriorStats,
        treatment_posterior: PosteriorStats,
        sample_count: int,
    ) -> Tuple[float, np.ndarray]:
        """计算实验组优于对照组的概率
        
        P(p_treatment > p_control) = E[I(p_treatment > p_control)]
        通过后验采样估计
        """
        if control_posterior.samples is None or treatment_posterior.samples is None:
            raise ValueError("后验样本不可用")

        control_samples = np.array(control_posterior.samples)[:sample_count]
        treatment_samples = np.array(treatment_posterior.samples)[:sample_count]

        prob_better = float(np.mean(treatment_samples > control_samples))

        lift_samples = (treatment_samples - control_samples) / control_samples

        self.reproducibility.trace_step(
            "计算P(实验组>对照组)",
            {
                "control_sample_mean": float(np.mean(control_samples)),
                "treatment_sample_mean": float(np.mean(treatment_samples)),
            },
            {
                "probability_better": prob_better,
                "expected_lift": float(np.mean(lift_samples)),
            },
        )

        return prob_better, lift_samples

    def _calculate_effective_sample_size(
        self,
        control_size: int,
        treatment_size: int,
        prior_strength: float,
    ) -> float:
        """计算有效样本量
        
        考虑先验强度的影响：
        ESS = (control_size + treatment_size) * (1 + prior_strength / (control_size + treatment_size))^(-1)
        """
        total_obs = control_size + treatment_size
        if total_obs == 0:
            return 0.0
        ess = total_obs * (1 + prior_strength / total_obs) ** (-1)

        self.reproducibility.trace_step(
            "计算有效样本量",
            {
                "control_size": control_size,
                "treatment_size": treatment_size,
                "prior_strength": prior_strength,
            },
            {"effective_sample_size": ess},
        )

        return float(ess)

    def _calculate_metrics(
        self,
        experiment_input: ExperimentInput,
        metrics: List[VariantData],
        credible_level: float,
        sample_count: int,
    ) -> Dict[str, BayesianResult]:
        """计算多指标的贝叶斯结果"""
        metric_results: Dict[str, BayesianResult] = {}

        control_metrics = [m for m in metrics if m.variant_type == "control"]
        treatment_metrics = [m for m in metrics if m.variant_type == "treatment"]

        for control_metric in control_metrics:
            for treatment_metric in treatment_metrics:
                if (
                    control_metric.metric_name is not None
                    and control_metric.metric_name == treatment_metric.metric_name
                    and control_metric.sample_size is not None
                    and control_metric.conversions is not None
                    and treatment_metric.sample_size is not None
                    and treatment_metric.conversions is not None
                    and experiment_input.prior is not None
                    and experiment_input.prior.alpha is not None
                    and experiment_input.prior.beta is not None
                ):
                    metric_input = ExperimentInput(
                        experiment_id=f"{experiment_input.experiment_id}_{control_metric.metric_name}",
                        control=control_metric,
                        treatment=treatment_metric,
                        prior=experiment_input.prior,
                    )

                    self.reproducibility.trace_step(
                        f"计算指标: {control_metric.metric_name}",
                        {
                            "metric_name": control_metric.metric_name,
                            "control": control_metric.to_dict(),
                            "treatment": treatment_metric.to_dict(),
                        },
                        {},
                    )

                    metric_result = self.calculate(
                        metric_input,
                        credible_level=credible_level,
                        sample_count=sample_count,
                    )
                    metric_results[control_metric.metric_name] = metric_result

        return metric_results
