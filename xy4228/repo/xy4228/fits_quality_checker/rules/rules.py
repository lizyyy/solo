"""质量评估规则定义。"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

from fits_quality_checker.models.models import (
    ImageQualityMetrics,
    FITSMetadata,
    ObservationConfig,
    RuleResult,
    FileType,
)


class BaseRule(ABC):
    """规则基类。"""

    rule_type: str = "base"
    rule_name: str = "Base Rule"

    def __init__(self, config: Optional[ObservationConfig] = None):
        """初始化规则。

        Args:
            config: 观测配置
        """
        self.config = config

    @abstractmethod
    def evaluate(
        self,
        metadata: FITSMetadata,
        metrics: Optional[ImageQualityMetrics] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> RuleResult:
        """评估规则。

        Args:
            metadata: FITS元数据
            metrics: 质量指标
            context: 上下文信息

        Returns:
            RuleResult对象
        """
        pass

    def _get_threshold(self, threshold_name: str, default: Any) -> Any:
        """从配置获取阈值。

        Args:
            threshold_name: 阈值名称
            default: 默认值

        Returns:
            阈值
        """
        if self.config and hasattr(self.config, threshold_name):
            return getattr(self.config, threshold_name)
        return default


class CloudRule(BaseRule):
    """云检测规则。

    检测云划过的迹象：
    - 背景噪声异常高
    - 星点数量异常少
    - 中位流量异常低
    """

    rule_type: str = "cloud"
    rule_name: str = "Cloud Detection"

    def __init__(
        self,
        config: Optional[ObservationConfig] = None,
        noise_multiplier: float = 1.5,
        star_ratio_threshold: float = 0.5,
    ):
        """初始化云检测规则。

        Args:
            config: 观测配置
            noise_multiplier: 噪声倍数阈值
            star_ratio_threshold: 星点数量比例阈值
        """
        super().__init__(config)
        self.noise_multiplier = noise_multiplier
        self.star_ratio_threshold = star_ratio_threshold
        self._baseline_noise: Optional[float] = None
        self._baseline_stars: Optional[int] = None

    def set_baseline(
        self,
        baseline_noise: Optional[float] = None,
        baseline_stars: Optional[int] = None,
    ):
        """设置基线值。

        Args:
            baseline_noise: 基线噪声
            baseline_stars: 基线星点数量
        """
        self._baseline_noise = baseline_noise
        self._baseline_stars = baseline_stars

    def evaluate(
        self,
        metadata: FITSMetadata,
        metrics: Optional[ImageQualityMetrics] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> RuleResult:
        """评估云检测规则。

        Args:
            metadata: FITS元数据
            metrics: 质量指标
            context: 上下文信息

        Returns:
            RuleResult对象
        """
        # 只对光场文件应用此规则
        if metadata.file_type != FileType.LIGHT:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=True,
                message="非光场文件，跳过云检测",
                severity="info",
                details={"file_type": metadata.file_type.value},
            )

        if metrics is None:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=True,
                message="缺少质量指标，无法评估",
                severity="warning",
                details={},
            )

        issues = []
        details = {
            "background_noise": metrics.background_noise,
            "star_count": metrics.star_count,
            "median_flux": metrics.median_flux,
        }

        # 检查噪声
        noise_threshold = self._get_threshold("noise_threshold", 10.0)
        if metrics.background_noise > noise_threshold * self.noise_multiplier:
            issues.append(f"背景噪声异常高: {metrics.background_noise:.2f} ADU")

        # 检查星点数量（如果有基线）
        if self._baseline_stars and metrics.star_count is not None:
            star_ratio = metrics.star_count / self._baseline_stars
            details["star_ratio"] = star_ratio
            details["baseline_stars"] = self._baseline_stars
            if star_ratio < self.star_ratio_threshold:
                issues.append(
                    f"星点数量过少: {metrics.star_count} "
                    f"(基线: {self._baseline_stars}, 比例: {star_ratio:.2f})"
                )

        # 检查中位流量
        if metrics.median_flux is not None and metrics.median_flux < 50:
            issues.append(f"中位流量异常低: {metrics.median_flux:.1f}")

        if issues:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=False,
                message="检测到云或透明度问题: " + "; ".join(issues),
                severity="error",
                details=details,
            )

        return RuleResult(
            rule_name=self.rule_name,
            rule_type=self.rule_type,
            passed=True,
            message="云检测通过",
            severity="info",
            details=details,
        )


class StarTrailRule(BaseRule):
    """星点拖线检测规则。

    检测星点拖线的迹象：
    - 圆度过低
    - FWHM过大
    """

    rule_type: str = "star_trail"
    rule_name: str = "Star Trail Detection"

    def __init__(
        self,
        config: Optional[ObservationConfig] = None,
        roundness_min: Optional[float] = None,
        fwhm_max_multiplier: float = 1.5,
    ):
        """初始化星点拖线检测规则。

        Args:
            config: 观测配置
            roundness_min: 最小圆度阈值
            fwhm_max_multiplier: FWHM最大倍数
        """
        super().__init__(config)
        self.roundness_min = roundness_min
        self.fwhm_max_multiplier = fwhm_max_multiplier

    def evaluate(
        self,
        metadata: FITSMetadata,
        metrics: Optional[ImageQualityMetrics] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> RuleResult:
        """评估星点拖线检测规则。

        Args:
            metadata: FITS元数据
            metrics: 质量指标
            context: 上下文信息

        Returns:
            RuleResult对象
        """
        # 只对光场文件应用此规则
        if metadata.file_type != FileType.LIGHT:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=True,
                message="非光场文件，跳过拖线检测",
                severity="info",
                details={"file_type": metadata.file_type.value},
            )

        if metrics is None:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=True,
                message="缺少质量指标，无法评估",
                severity="warning",
                details={},
            )

        issues = []
        details = {
            "fwhm": metrics.fwhm,
            "fwhm_arcsec": metrics.fwhm_arcsec,
            "roundness": metrics.roundness,
        }

        # 获取阈值
        roundness_threshold = self.roundness_min or self._get_threshold(
            "roundness_threshold", 0.8
        )
        fwhm_threshold = self._get_threshold("fwhm_threshold", 3.0)
        max_fwhm = fwhm_threshold * self.fwhm_max_multiplier

        details["roundness_threshold"] = roundness_threshold
        details["fwhm_threshold"] = fwhm_threshold
        details["max_fwhm"] = max_fwhm

        # 检查圆度
        if metrics.roundness is not None and metrics.roundness < roundness_threshold:
            issues.append(
                f"圆度过低: {metrics.roundness:.3f} (阈值: {roundness_threshold})"
            )

        # 检查FWHM
        if metrics.fwhm is not None and metrics.fwhm > max_fwhm:
            issues.append(
                f"FWHM过大: {metrics.fwhm:.2f} 像素 (阈值: {max_fwhm:.2f})"
            )

        if issues:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=False,
                message="检测到星点拖线或导星问题: " + "; ".join(issues),
                severity="error",
                details=details,
            )

        return RuleResult(
            rule_name=self.rule_name,
            rule_type=self.rule_type,
            passed=True,
            message="拖线检测通过",
            severity="info",
            details=details,
        )


class ExposureMatchRule(BaseRule):
    """曝光时间匹配规则。

    检查曝光时间是否与预期一致，
    同滤镜组内曝光时间是否一致。
    """

    rule_type: str = "exposure_match"
    rule_name: str = "Exposure Time Match"

    def __init__(
        self,
        config: Optional[ObservationConfig] = None,
        expected_exposure: Optional[float] = None,
        tolerance: float = 0.1,
    ):
        """初始化曝光时间匹配规则。

        Args:
            config: 观测配置
            expected_exposure: 期望曝光时间
            tolerance: 容差比例（0.1 = 10%）
        """
        super().__init__(config)
        self.expected_exposure = expected_exposure
        self.tolerance = tolerance
        self._group_exposures: Dict[str, float] = {}

    def set_group_exposures(self, group_exposures: Dict[str, float]):
        """设置各滤镜组的期望曝光时间。

        Args:
            group_exposures: {滤镜名: 期望曝光时间}
        """
        self._group_exposures = group_exposures

    def evaluate(
        self,
        metadata: FITSMetadata,
        metrics: Optional[ImageQualityMetrics] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> RuleResult:
        """评估曝光时间匹配规则。

        Args:
            metadata: FITS元数据
            metrics: 质量指标
            context: 上下文信息

        Returns:
            RuleResult对象
        """
        if metadata.exposure_time is None:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=False,
                message="缺少曝光时间信息",
                severity="warning",
                details={},
            )

        details = {
            "actual_exposure": metadata.exposure_time,
            "file_type": metadata.file_type.value,
            "filter": metadata.filter_name,
        }

        # 确定期望的曝光时间
        expected = None

        # 1. 尝试从滤镜组获取
        if metadata.filter_name and metadata.filter_name in self._group_exposures:
            expected = self._group_exposures[metadata.filter_name]
            details["source"] = "group"

        # 2. 尝试从配置的expected_exposures获取
        elif (
            self.config
            and self.config.expected_exposures
            and metadata.filter_name
        ):
            # 注意：expected_exposures存储的是次数，不是时间
            # 这里我们需要知道每个滤镜的期望曝光时间
            # 如果没有，跳过这个检查
            pass

        # 3. 使用传入的expected_exposure
        elif self.expected_exposure is not None:
            expected = self.expected_exposure
            details["source"] = "parameter"

        if expected is None:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=True,
                message="没有设置期望曝光时间，跳过匹配检查",
                severity="info",
                details=details,
            )

        details["expected_exposure"] = expected
        details["tolerance"] = self.tolerance

        # 检查是否在容差范围内
        diff = abs(metadata.exposure_time - expected)
        diff_ratio = diff / expected if expected > 0 else 1.0
        details["difference"] = diff
        details["difference_ratio"] = diff_ratio

        if diff_ratio > self.tolerance:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=False,
                message=(
                    f"曝光时间不匹配: 实际 {metadata.exposure_time:.1f}s, "
                    f"期望 {expected:.1f}s (差异: {diff_ratio*100:.1f}%)"
                ),
                severity="error",
                details=details,
            )

        return RuleResult(
            rule_name=self.rule_name,
            rule_type=self.rule_type,
            passed=True,
            message=f"曝光时间匹配: {metadata.exposure_time:.1f}s",
            severity="info",
            details=details,
        )


class FilterMatchRule(BaseRule):
    """滤镜匹配规则。

    检查滤镜是否在预期的滤镜列表中。
    """

    rule_type: str = "filter_match"
    rule_name: str = "Filter Match"

    def __init__(
        self,
        config: Optional[ObservationConfig] = None,
        expected_filters: Optional[List[str]] = None,
    ):
        """初始化滤镜匹配规则。

        Args:
            config: 观测配置
            expected_filters: 期望的滤镜列表
        """
        super().__init__(config)
        self.expected_filters = expected_filters or []

    def evaluate(
        self,
        metadata: FITSMetadata,
        metrics: Optional[ImageQualityMetrics] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> RuleResult:
        """评估滤镜匹配规则。

        Args:
            metadata: FITS元数据
            metrics: 质量指标
            context: 上下文信息

        Returns:
            RuleResult对象
        """
        # 只对光场和平场文件应用此规则
        if metadata.file_type not in [FileType.LIGHT, FileType.FLAT]:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=True,
                message="非光场/平场文件，跳过滤镜检查",
                severity="info",
                details={"file_type": metadata.file_type.value},
            )

        if metadata.filter_name is None:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=False,
                message="缺少滤镜信息",
                severity="warning",
                details={},
            )

        # 确定期望的滤镜列表
        expected = self.expected_filters.copy()
        if self.config and self.config.expected_exposures:
            expected.extend(self.config.expected_exposures.keys())

        # 去重
        expected = list(set(expected))

        details = {
            "actual_filter": metadata.filter_name,
            "expected_filters": expected,
            "file_type": metadata.file_type.value,
        }

        if not expected:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=True,
                message="没有设置期望滤镜，跳过匹配检查",
                severity="info",
                details=details,
            )

        # 检查是否匹配（大小写不敏感）
        actual_lower = metadata.filter_name.lower()
        expected_lower = [f.lower() for f in expected]

        if actual_lower not in expected_lower:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=False,
                message=(
                    f"滤镜不匹配: 实际 '{metadata.filter_name}', "
                    f"期望: {', '.join(expected)}"
                ),
                severity="error",
                details=details,
            )

        return RuleResult(
            rule_name=self.rule_name,
            rule_type=self.rule_type,
            passed=True,
            message=f"滤镜匹配: {metadata.filter_name}",
            severity="info",
            details=details,
        )


class TemperatureMatchRule(BaseRule):
    """温度匹配规则。

    检查温度是否与预期一致，
    暗场与光场的温度是否匹配。
    """

    rule_type: str = "temperature_match"
    rule_name: str = "Temperature Match"

    def __init__(
        self,
        config: Optional[ObservationConfig] = None,
        expected_temperature: Optional[float] = None,
        tolerance: Optional[float] = None,
    ):
        """初始化温度匹配规则。

        Args:
            config: 观测配置
            expected_temperature: 期望温度
            tolerance: 温度容差
        """
        super().__init__(config)
        self.expected_temperature = expected_temperature
        self.tolerance = tolerance

    def evaluate(
        self,
        metadata: FITSMetadata,
        metrics: Optional[ImageQualityMetrics] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> RuleResult:
        """评估温度匹配规则。

        Args:
            metadata: FITS元数据
            metrics: 质量指标
            context: 上下文信息

        Returns:
            RuleResult对象
        """
        if metadata.temperature is None:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=False,
                message="缺少温度信息",
                severity="warning",
                details={},
            )

        details = {
            "actual_temperature": metadata.temperature,
            "file_type": metadata.file_type.value,
        }

        # 确定期望温度和容差
        expected = self.expected_temperature
        tolerance = self.tolerance

        if expected is None and self.config:
            expected = self.config.expected_temperature

        if tolerance is None and self.config:
            tolerance = self.config.temperature_tolerance

        if tolerance is None:
            tolerance = 0.5  # 默认容差

        details["expected_temperature"] = expected
        details["tolerance"] = tolerance

        if expected is None:
            return RuleResult(
                rule_name=self.rule_name,
                rule_type=self.rule_type,
                passed=True,
                message="没有设置期望温度，跳过匹配检查",
                severity="info",
                details=details,
            )

        # 检查是否在容差范围内
        diff = abs(metadata.temperature - expected)
        details["difference"] = diff

        # 暗场文件需要更严格的温度控制
        if metadata.file_type == FileType.DARK:
            if diff > tolerance:
                return RuleResult(
                    rule_name=self.rule_name,
                    rule_type=self.rule_type,
                    passed=False,
                    message=(
                        f"暗场温度偏差过大: 实际 {metadata.temperature:.1f}°C, "
                        f"期望 {expected:.1f}°C (差异: {diff:.2f}°C)"
                    ),
                    severity="error",
                    details=details,
                )
        else:
            # 光场文件可以有稍大的容差（2倍）
            if diff > tolerance * 2:
                return RuleResult(
                    rule_name=self.rule_name,
                    rule_type=self.rule_type,
                    passed=False,
                    message=(
                        f"温度偏差过大: 实际 {metadata.temperature:.1f}°C, "
                        f"期望 {expected:.1f}°C (差异: {diff:.2f}°C)"
                    ),
                    severity="warning",
                    details=details,
                )

        return RuleResult(
            rule_name=self.rule_name,
            rule_type=self.rule_type,
            passed=True,
            message=f"温度匹配: {metadata.temperature:.1f}°C",
            severity="info",
            details=details,
        )
