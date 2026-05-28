"""输入验证模块 - 字段检查、脏数据识别、处理顺序标记"""

from typing import List, Optional, Any, Tuple
from .data_models import (
    ExperimentInput,
    ValidationResult,
    FieldValidation,
    FieldStatus,
    DataQuality,
    VariantType,
)


class InputValidator:
    """输入验证器
    
    核心原则：字段不齐时先标出来，别直接假设默认值
    """

    REQUIRED_FIELDS = [
        ("experiment_id", "试验ID"),
        ("control", "对照组数据"),
        ("treatment", "实验组数据"),
    ]

    REQUIRED_VARIANT_FIELDS = [
        ("name", "变体名称"),
        ("sample_size", "样本量"),
        ("conversions", "转化数"),
    ]

    RECOMMENDED_FIELDS = [
        ("prior", "先验参数"),
        ("observation_window_days", "观察窗口(天)"),
        ("planned_sample_size", "计划样本量"),
        ("current_day", "当前试验天数"),
        ("stopping_threshold", "停测阈值"),
    ]

    def __init__(self):
        self._processing_order: List[str] = []

    def validate(self, experiment_input: ExperimentInput) -> ValidationResult:
        """验证试验输入
        
        返回详细的验证结果，包含：
        - 每个字段的状态（存在/缺失/无效）
        - 数据质量等级
        - 处理顺序（用于追踪验证流程）
        - 缺失和无效字段列表
        - 警告和错误信息
        """
        self._processing_order = []
        field_validations: List[FieldValidation] = []
        warnings: List[str] = []
        errors: List[str] = []

        self._record_step("开始验证试验ID和基本信息")
        field_validations.extend(self._validate_top_level_fields(experiment_input, warnings, errors))

        self._record_step("验证对照组数据")
        control_validations, control_errors = self._validate_variant(
            experiment_input.control, "control", "对照组"
        )
        field_validations.extend(control_validations)
        errors.extend(control_errors)

        self._record_step("验证实验组数据")
        treatment_validations, treatment_errors = self._validate_variant(
            experiment_input.treatment, "treatment", "实验组"
        )
        field_validations.extend(treatment_validations)
        errors.extend(treatment_errors)

        self._record_step("验证先验参数")
        field_validations.extend(self._validate_prior(experiment_input.prior, warnings, errors))

        self._record_step("验证试验参数")
        field_validations.extend(
            self._validate_experiment_params(experiment_input, warnings, errors)
        )

        self._record_step("验证多指标数据")
        if experiment_input.metrics:
            metric_validations, metric_errors = self._validate_metrics(experiment_input.metrics)
            field_validations.extend(metric_validations)
            errors.extend(metric_errors)

        self._record_step("检查数据质量和一致性")
        data_quality = self._assess_data_quality(
            experiment_input, field_validations, warnings, errors
        )
        self._check_data_consistency(experiment_input, warnings, errors)

        required_field_names = (
            [name for name, _ in self.REQUIRED_FIELDS]
            + [f"control.{name}" for name, _ in self.REQUIRED_VARIANT_FIELDS]
            + [f"treatment.{name}" for name, _ in self.REQUIRED_VARIANT_FIELDS]
            + ["control.variant_type", "treatment.variant_type"]
        )

        all_missing_fields = [
            f.field_name for f in field_validations if f.status == FieldStatus.MISSING
        ]
        missing_required_fields = [
            f for f in all_missing_fields if f in required_field_names
        ]
        missing_recommended_fields = [
            f for f in all_missing_fields if f not in required_field_names
        ]

        invalid_fields = [
            f.field_name for f in field_validations if f.status == FieldStatus.INVALID
        ]

        is_valid = (
            len(errors) == 0
            and not missing_required_fields
            and not invalid_fields
        )

        self._record_step(f"验证完成 - 有效: {is_valid}, 数据质量: {data_quality.value}")

        return ValidationResult(
            is_valid=is_valid,
            fields=field_validations,
            data_quality=data_quality,
            processing_order=list(self._processing_order),
            missing_fields=all_missing_fields,
            invalid_fields=invalid_fields,
            warnings=warnings,
            errors=errors,
        )

    def _record_step(self, step: str) -> None:
        """记录处理步骤"""
        self._processing_order.append(step)

    def _validate_top_level_fields(
        self,
        experiment_input: ExperimentInput,
        warnings: List[str],
        errors: List[str],
    ) -> List[FieldValidation]:
        """验证顶层字段"""
        validations = []

        for field_name, display_name in self.REQUIRED_FIELDS:
            value = getattr(experiment_input, field_name)
            if value is None:
                validations.append(
                    FieldValidation(
                        field_name=field_name,
                        status=FieldStatus.MISSING,
                        message=f"缺少必需字段: {display_name}",
                        provided_value=None,
                    )
                )
                errors.append(f"缺少必需字段: {display_name} ({field_name})")
            else:
                validations.append(
                    FieldValidation(
                        field_name=field_name,
                        status=FieldStatus.PRESENT,
                        message=f"{display_name}已提供",
                        provided_value=str(value)[:100],
                    )
                )

        for field_name, display_name in self.RECOMMENDED_FIELDS:
            value = getattr(experiment_input, field_name)
            if value is None:
                validations.append(
                    FieldValidation(
                        field_name=field_name,
                        status=FieldStatus.MISSING,
                        message=f"缺少推荐字段: {display_name}（不假设默认值，可能影响分析）",
                        provided_value=None,
                    )
                )
                warnings.append(
                    f"缺少推荐字段: {display_name} ({field_name}) - 不假设默认值，可能影响分析准确性"
                )
            else:
                validations.append(
                    FieldValidation(
                        field_name=field_name,
                        status=FieldStatus.PRESENT,
                        message=f"{display_name}已提供",
                        provided_value=str(value)[:100],
                    )
                )

        return validations

    def _validate_variant(
        self,
        variant,
        field_prefix: str,
        display_prefix: str,
    ) -> Tuple[List[FieldValidation], List[str]]:
        """验证变体数据（实验组/对照组）"""
        validations = []
        errors = []

        if variant is None:
            return validations, errors

        for field_name, display_name in self.REQUIRED_VARIANT_FIELDS:
            value = getattr(variant, field_name)
            full_field_name = f"{field_prefix}.{field_name}"
            full_display_name = f"{display_prefix}{display_name}"

            if value is None:
                validations.append(
                    FieldValidation(
                        field_name=full_field_name,
                        status=FieldStatus.MISSING,
                        message=f"缺少必需字段: {full_display_name}",
                        provided_value=None,
                    )
                )
                errors.append(f"缺少必需字段: {full_display_name} ({full_field_name})")
            else:
                if field_name in ["sample_size", "conversions"]:
                    if not isinstance(value, int) or value < 0:
                        validations.append(
                            FieldValidation(
                                field_name=full_field_name,
                                status=FieldStatus.INVALID,
                                message=f"{full_display_name}必须是非负整数",
                                provided_value=value,
                            )
                        )
                        errors.append(
                            f"字段无效: {full_display_name} ({full_field_name}) 必须是非负整数，当前值: {value}"
                        )
                    elif field_name == "conversions" and variant.sample_size is not None and value > variant.sample_size:
                        validations.append(
                            FieldValidation(
                                field_name=full_field_name,
                                status=FieldStatus.INVALID,
                                message=f"{full_display_name}不能大于样本量",
                                provided_value=value,
                            )
                        )
                        errors.append(
                            f"字段无效: {full_display_name} ({full_field_name}) = {value} 大于样本量 {variant.sample_size}"
                        )
                    else:
                        validations.append(
                            FieldValidation(
                                field_name=full_field_name,
                                status=FieldStatus.PRESENT,
                                message=f"{full_display_name}有效",
                                provided_value=value,
                            )
                        )
                else:
                    validations.append(
                        FieldValidation(
                            field_name=full_field_name,
                            status=FieldStatus.PRESENT,
                            message=f"{full_display_name}已提供",
                            provided_value=str(value)[:100],
                        )
                    )

        if variant.variant_type is None:
            validations.append(
                FieldValidation(
                    field_name=f"{field_prefix}.variant_type",
                    status=FieldStatus.MISSING,
                    message=f"缺少{display_prefix}变体类型",
                    provided_value=None,
                )
            )
        elif variant.variant_type not in [VariantType.CONTROL, VariantType.TREATMENT]:
            validations.append(
                FieldValidation(
                    field_name=f"{field_prefix}.variant_type",
                    status=FieldStatus.INVALID,
                    message=f"{display_prefix}变体类型无效",
                    provided_value=variant.variant_type,
                )
            )
        else:
            expected_type = VariantType.CONTROL if field_prefix == "control" else VariantType.TREATMENT
            if variant.variant_type != expected_type:
                validations.append(
                    FieldValidation(
                        field_name=f"{field_prefix}.variant_type",
                        status=FieldStatus.INVALID,
                        message=f"{display_prefix}变体类型应为 {expected_type.value}",
                        provided_value=variant.variant_type,
                    )
                )
                errors.append(
                    f"字段无效: {display_prefix}变体类型应为 {expected_type.value}，当前为 {variant.variant_type}"
                )

        return validations, errors

    def _validate_prior(
        self,
        prior,
        warnings: List[str],
        errors: List[str],
    ) -> List[FieldValidation]:
        """验证先验参数"""
        validations = []

        if prior is None:
            return validations

        for param in ["alpha", "beta"]:
            value = getattr(prior, param)
            field_name = f"prior.{param}"

            if value is None:
                validations.append(
                    FieldValidation(
                        field_name=field_name,
                        status=FieldStatus.MISSING,
                        message=f"缺少先验参数: {param}（不假设默认值）",
                        provided_value=None,
                    )
                )
                warnings.append(
                    f"缺少先验参数: prior.{param} - 不假设默认值，将无法进行贝叶斯更新"
                )
            elif not isinstance(value, (int, float)) or value <= 0:
                validations.append(
                    FieldValidation(
                        field_name=field_name,
                        status=FieldStatus.INVALID,
                        message=f"先验参数 {param} 必须是正数",
                        provided_value=value,
                    )
                )
                errors.append(
                    f"字段无效: prior.{param} = {value} 必须是正数"
                )
            else:
                validations.append(
                    FieldValidation(
                        field_name=field_name,
                        status=FieldStatus.PRESENT,
                        message=f"先验参数 {param} 有效",
                        provided_value=value,
                    )
                )

        return validations

    def _validate_experiment_params(
        self,
        experiment_input: ExperimentInput,
        warnings: List[str],
        errors: List[str],
    ) -> List[FieldValidation]:
        """验证试验参数"""
        validations = []

        if experiment_input.observation_window_days is not None:
            if (
                not isinstance(experiment_input.observation_window_days, int)
                or experiment_input.observation_window_days <= 0
            ):
                validations.append(
                    FieldValidation(
                        field_name="observation_window_days",
                        status=FieldStatus.INVALID,
                        message="观察窗口必须是正整数",
                        provided_value=experiment_input.observation_window_days,
                    )
                )
                errors.append(
                    f"字段无效: observation_window_days = {experiment_input.observation_window_days} 必须是正整数"
                )

        if experiment_input.planned_sample_size is not None:
            if (
                not isinstance(experiment_input.planned_sample_size, int)
                or experiment_input.planned_sample_size <= 0
            ):
                validations.append(
                    FieldValidation(
                        field_name="planned_sample_size",
                        status=FieldStatus.INVALID,
                        message="计划样本量必须是正整数",
                        provided_value=experiment_input.planned_sample_size,
                    )
                )
                errors.append(
                    f"字段无效: planned_sample_size = {experiment_input.planned_sample_size} 必须是正整数"
                )

        if experiment_input.current_day is not None:
            if (
                not isinstance(experiment_input.current_day, int)
                or experiment_input.current_day < 0
            ):
                validations.append(
                    FieldValidation(
                        field_name="current_day",
                        status=FieldStatus.INVALID,
                        message="当前试验天数必须是非负整数",
                        provided_value=experiment_input.current_day,
                    )
                )
                errors.append(
                    f"字段无效: current_day = {experiment_input.current_day} 必须是非负整数"
                )

        if experiment_input.stopping_threshold is not None:
            if (
                not isinstance(experiment_input.stopping_threshold, (int, float))
                or experiment_input.stopping_threshold <= 0
                or experiment_input.stopping_threshold >= 1
            ):
                validations.append(
                    FieldValidation(
                        field_name="stopping_threshold",
                        status=FieldStatus.INVALID,
                        message="停测阈值必须在(0, 1)之间",
                        provided_value=experiment_input.stopping_threshold,
                    )
                )
                errors.append(
                    f"字段无效: stopping_threshold = {experiment_input.stopping_threshold} 必须在(0, 1)之间"
                )

        return validations

    def _validate_metrics(
        self,
        metrics,
    ) -> Tuple[List[FieldValidation], List[str]]:
        """验证多指标数据"""
        validations = []
        errors = []

        for i, metric in enumerate(metrics):
            prefix = f"metrics[{i}]"
            display_prefix = f"指标[{i}]"

            if metric.metric_name is None:
                validations.append(
                    FieldValidation(
                        field_name=f"{prefix}.metric_name",
                        status=FieldStatus.MISSING,
                        message=f"缺少{display_prefix}名称",
                        provided_value=None,
                    )
                )
                errors.append(f"缺少{display_prefix}名称")

            if metric.sample_size is not None and metric.conversions is not None:
                if metric.conversions > metric.sample_size:
                    validations.append(
                        FieldValidation(
                            field_name=f"{prefix}.conversions",
                            status=FieldStatus.INVALID,
                            message=f"{display_prefix}转化数不能大于样本量",
                            provided_value=metric.conversions,
                        )
                    )
                    errors.append(
                        f"{display_prefix}转化数 {metric.conversions} 大于样本量 {metric.sample_size}"
                    )

        return validations, errors

    def _assess_data_quality(
        self,
        experiment_input: ExperimentInput,
        field_validations: List[FieldValidation],
        warnings: List[str],
        errors: List[str],
    ) -> DataQuality:
        """评估数据质量等级"""
        if errors:
            return DataQuality.DIRTY

        invalid_count = sum(
            1 for f in field_validations if f.status == FieldStatus.INVALID
        )
        missing_required_count = sum(
            1 for f in field_validations
            if f.status == FieldStatus.MISSING
            and (
                f.field_name in [name for name, _ in self.REQUIRED_FIELDS]
                or f.field_name.startswith("control.")
                or f.field_name.startswith("treatment.")
            )
        )

        if invalid_count > 0 or missing_required_count > 0:
            return DataQuality.DIRTY

        missing_recommended_count = sum(
            1 for f in field_validations
            if f.status == FieldStatus.MISSING
            and f.field_name in [name for name, _ in self.RECOMMENDED_FIELDS]
        )

        small_sample = False
        if experiment_input.control and experiment_input.control.sample_size is not None:
            if experiment_input.control.sample_size < 100:
                small_sample = True
        if experiment_input.treatment and experiment_input.treatment.sample_size is not None:
            if experiment_input.treatment.sample_size < 100:
                small_sample = True

        if missing_recommended_count > 0 or small_sample:
            return DataQuality.BORDERLINE

        return DataQuality.CLEAN

    def _check_data_consistency(
        self,
        experiment_input: ExperimentInput,
        warnings: List[str],
        errors: List[str],
    ) -> None:
        """检查数据一致性"""
        if experiment_input.current_day is not None and experiment_input.observation_window_days is not None:
            if experiment_input.current_day > experiment_input.observation_window_days:
                warnings.append(
                    f"当前试验天数 ({experiment_input.current_day}) 超过观察窗口 ({experiment_input.observation_window_days}天)"
                )

        if (
            experiment_input.planned_sample_size is not None
            and isinstance(experiment_input.planned_sample_size, int)
            and experiment_input.control is not None
            and experiment_input.control.sample_size is not None
            and experiment_input.treatment is not None
            and experiment_input.treatment.sample_size is not None
        ):
            total_samples = (
                experiment_input.control.sample_size + experiment_input.treatment.sample_size
            )
            if total_samples > experiment_input.planned_sample_size:
                warnings.append(
                    f"当前总样本量 ({total_samples}) 超过计划样本量 ({experiment_input.planned_sample_size})"
                )

        if (
            experiment_input.control is not None
            and experiment_input.control.sample_size is not None
            and experiment_input.control.conversions is not None
        ):
            if experiment_input.control.conversions == 0:
                warnings.append("对照组转化数为0，可能导致后验分布不稳定")
            elif experiment_input.control.conversions == experiment_input.control.sample_size:
                warnings.append("对照组转化率为100%，请检查数据是否正确")

        if (
            experiment_input.treatment is not None
            and experiment_input.treatment.sample_size is not None
            and experiment_input.treatment.conversions is not None
        ):
            if experiment_input.treatment.conversions == 0:
                warnings.append("实验组转化数为0，可能导致后验分布不稳定")
            elif experiment_input.treatment.conversions == experiment_input.treatment.sample_size:
                warnings.append("实验组转化率为100%，请检查数据是否正确")
