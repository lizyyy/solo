"""主流程管道 - 串联所有模块的完整试验流程"""

from typing import List, Optional

from .data_models import (
    ExperimentInput,
    ExperimentReport,
    ValidationResult,
    BayesianResult,
    RiskAssessment,
    RiskLevel,
)
from .input_validator import InputValidator
from .bayesian_core import BayesianCalculator
from .risk_detector import RiskDetector
from .report_generator import ReportGenerator
from .reproducibility import ReproducibilityManager


def run_experiment(
    experiment_input: ExperimentInput,
    credible_level: float = 0.95,
    sample_count: int = 100000,
) -> ExperimentReport:
    """运行完整的贝叶斯A/B试验分析流程
    
    流程：
    1. 计算输入哈希，设置随机种子（保障可复算性）
    2. 输入验证（字段检查、脏数据识别、处理顺序标记）
    3. 贝叶斯计算（先验更新、后验分布、可信区间）
    4. 风险评估（提前停测、先验过强、多指标冲突）
    5. 生成结论和建议
    6. 输出完整报告
    
    Args:
        experiment_input: 试验输入数据
        credible_level: 可信区间水平，默认0.95
        sample_count: MCMC采样数量，默认100000
        
    Returns:
        完整的试验报告
        
    注意：
        - 字段不齐时会在验证结果中标注，不会自动填充默认值
        - 相同输入再次运行将得到完全一致的结果（输入哈希+固定种子保障）
        - 处理顺序会被完整记录，便于追踪和审计
    """
    reproducibility = ReproducibilityManager()
    validator = InputValidator()
    calculator = BayesianCalculator(reproducibility)
    detector = RiskDetector(reproducibility)
    report_gen = ReportGenerator()

    input_hash = reproducibility.compute_input_hash(experiment_input)
    seed = reproducibility.generate_seed(input_hash)
    reproducibility.set_random_state(seed)

    reproducibility.trace_step(
        "试验开始",
        {
            "experiment_id": experiment_input.experiment_id,
            "input_hash": input_hash,
            "seed": seed,
        },
        {},
    )

    validation = validator.validate(experiment_input)
    reproducibility.trace_step(
        "输入验证完成",
        {
            "is_valid": validation.is_valid,
            "data_quality": validation.data_quality.value,
            "missing_fields": validation.missing_fields,
            "invalid_fields": validation.invalid_fields,
        },
        {},
    )

    if not validation.is_valid:
        return _generate_invalid_report(
            experiment_input,
            input_hash,
            seed,
            validation,
            reproducibility,
        )

    bayesian_result = calculator.calculate(
        experiment_input,
        credible_level=credible_level,
        sample_count=sample_count,
    )

    risk_assessment = detector.assess(experiment_input, bayesian_result)

    conclusions = _generate_conclusions(
        experiment_input,
        validation,
        bayesian_result,
        risk_assessment,
    )

    recommendations = _generate_recommendations(
        experiment_input,
        validation,
        bayesian_result,
        risk_assessment,
    )

    report = ExperimentReport(
        experiment_id=experiment_input.experiment_id or "unknown",
        input_hash=input_hash,
        reproducibility_seed=seed,
        validation=validation,
        bayesian_result=bayesian_result,
        risk_assessment=risk_assessment,
        conclusions=conclusions,
        recommendations=recommendations,
    )

    reproducibility.trace_step(
        "试验完成",
        {},
        {
            "overall_risk": risk_assessment.overall_risk_level.value,
            "stopping_recommendation": risk_assessment.stopping_recommendation.value,
        },
    )

    return report


def _generate_invalid_report(
    experiment_input: ExperimentInput,
    input_hash: str,
    seed: int,
    validation: ValidationResult,
    reproducibility: ReproducibilityManager,
) -> ExperimentReport:
    """生成输入无效时的报告"""
    from .data_models import (
        BayesianResult,
        PosteriorStats,
        RiskAssessment,
        RiskFlag,
        RiskLevel,
        StoppingReason,
    )

    dummy_posterior = PosteriorStats(
        mean=0.0,
        median=0.0,
        std=0.0,
        ci_lower=0.0,
        ci_upper=0.0,
        credible_level=0.95,
    )

    dummy_bayesian = BayesianResult(
        control_posterior=dummy_posterior,
        treatment_posterior=dummy_posterior,
        prior_strength=0.0,
        effective_sample_size=0.0,
        probability_treatment_better=0.5,
        expected_lift=0.0,
        lift_ci_lower=0.0,
        lift_ci_upper=0.0,
        computation_trace={"note": "输入无效，未执行贝叶斯计算"},
    )

    dummy_risk = RiskAssessment(
        has_early_stop=False,
        has_strong_prior=False,
        has_metric_conflict=False,
        overall_risk_level=RiskLevel.CRITICAL,
        flags=[
            RiskFlag(
                risk_type="invalid_input",
                level=RiskLevel.CRITICAL,
                message="输入数据无效，请修正缺失或错误的字段后重新运行",
                evidence={
                    "missing_fields": validation.missing_fields,
                    "invalid_fields": validation.invalid_fields,
                    "errors": validation.errors,
                },
                recommendation="请参考验证结果修正输入数据，特别注意必填字段和数据类型要求",
            )
        ],
        stopping_recommendation=StoppingReason.NOT_STOPPED,
        stopping_message="输入数据无效，无法给出停测建议。请先修正数据问题。",
    )

    conclusions = [
        "❌ 输入数据验证未通过",
        f"缺失字段: {', '.join(validation.missing_fields) if validation.missing_fields else '无'}",
        f"无效字段: {', '.join(validation.invalid_fields) if validation.invalid_fields else '无'}",
    ]

    recommendations = [
        "请修正上述缺失或无效的字段后重新运行分析",
        "注意：本工具不会自动填充默认值，所有必需字段必须明确提供",
    ]

    return ExperimentReport(
        experiment_id=experiment_input.experiment_id or "unknown",
        input_hash=input_hash,
        reproducibility_seed=seed,
        validation=validation,
        bayesian_result=dummy_bayesian,
        risk_assessment=dummy_risk,
        conclusions=conclusions,
        recommendations=recommendations,
    )


def _generate_conclusions(
    experiment_input: ExperimentInput,
    validation: ValidationResult,
    bayesian_result: BayesianResult,
    risk_assessment: RiskAssessment,
) -> List[str]:
    """生成结论"""
    conclusions: List[str] = []

    prob_better = bayesian_result.probability_treatment_better
    expected_lift = bayesian_result.expected_lift

    if validation.data_quality.value == "clean":
        conclusions.append("✅ 数据质量良好，所有必需字段完整有效")
    elif validation.data_quality.value == "borderline":
        conclusions.append("⚠️ 数据质量临界，部分推荐字段缺失或样本量偏小")
    else:
        conclusions.append("❌ 数据质量存在问题，建议检查原始数据")

    if prob_better >= 0.95:
        conclusions.append(
            f"✅ 统计结论：实验组以 {prob_better:.1%} 的概率优于对照组，"
            f"预期提升 {expected_lift:.2%}"
        )
    elif prob_better <= 0.05:
        conclusions.append(
            f"✅ 统计结论：对照组以 {1-prob_better:.1%} 的概率优于实验组，"
            f"实验组表现不佳"
        )
    else:
        conclusions.append(
            f"⚖️ 统计结论：当前证据不足以判断优劣，"
            f"P(实验组>对照组) = {prob_better:.1%}"
        )

    if risk_assessment.has_early_stop:
        conclusions.append("⚠️ 检测到提前停测风险，结论需谨慎解读")
    if risk_assessment.has_strong_prior:
        conclusions.append("⚠️ 先验设置较强，可能影响结论客观性")
    if risk_assessment.has_metric_conflict:
        conclusions.append("⚠️ 多指标方向存在冲突，需综合业务判断")

    return conclusions


def _generate_recommendations(
    experiment_input: ExperimentInput,
    validation: ValidationResult,
    bayesian_result: BayesianResult,
    risk_assessment: RiskAssessment,
) -> List[str]:
    """生成行动建议
    
    核心决策优先级（高→低）：
    1. 多指标冲突 → 谨慎决策，不轻易上线
    2. 先验过强 → 先进行敏感性分析
    3. 提前停测 → 继续收集数据
    4. 可信区间包含零 → 效应方向不明确
    5. 基于概率的常规决策
    """
    recommendations: List[str] = []

    prob_better = bayesian_result.probability_treatment_better
    ci_includes_zero = (
        bayesian_result.lift_ci_lower < 0 < bayesian_result.lift_ci_upper
    )

    has_major_risk = (
        risk_assessment.has_metric_conflict
        or risk_assessment.has_strong_prior
        or risk_assessment.has_early_stop
    )

    if risk_assessment.has_metric_conflict:
        recommendations.append(
            "⚠️ 存在多指标方向冲突，禁止直接上线或停测"
        )
        recommendations.append(
            "建议组织跨部门评审，综合考虑各指标的业务权重和影响"
        )
        recommendations.append(
            "建议进行多重比较校正（如使用贝叶斯多重检验）"
        )
    elif risk_assessment.has_strong_prior:
        recommendations.append(
            "建议使用无信息先验（如Beta(1,1)）进行敏感性分析，验证结论稳健性"
        )
    elif risk_assessment.has_early_stop:
        recommendations.append(
            "建议继续收集数据直至达到计划样本量或观察窗口结束"
        )

    if ci_includes_zero:
        recommendations.append(
            "建议继续收集数据以缩小可信区间，获得更明确的效应方向判断"
        )

    if not has_major_risk:
        if prob_better >= 0.95:
            recommendations.append(
                "建议上线实验组方案，并持续监控核心指标表现"
            )
        elif prob_better <= 0.05:
            recommendations.append(
                "建议停止实验组，保留对照组或设计新的试验方案"
            )
        else:
            recommendations.append(
                "建议继续运行试验或进行迭代优化，当前证据不足以支持决策"
            )
    else:
        if risk_assessment.has_metric_conflict:
            recommendations.append(
                "在指标冲突问题解决前，暂不做上线或停测决策"
            )
        elif risk_assessment.has_strong_prior:
            recommendations.append(
                "在先验敏感性分析完成前，暂不做上线或停测决策"
            )
        elif risk_assessment.has_early_stop:
            recommendations.append(
                "在达到计划样本量或观察窗口前，暂不做最终决策"
            )

    if validation.missing_fields:
        recommendations.append(
            f"建议补全缺失字段：{', '.join(validation.missing_fields)}，"
            f"以获得更完整的分析结果"
        )

    return recommendations
