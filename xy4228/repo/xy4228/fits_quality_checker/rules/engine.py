"""规则引擎。

负责执行规则、计算综合评分、生成质量状态和建议。
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from collections import defaultdict

from fits_quality_checker.models.models import (
    FITSMetadata,
    ImageQualityMetrics,
    QualityResult,
    FileStatus,
    RuleResult,
    ObservationConfig,
    FileType,
)
from fits_quality_checker.rules.rules import (
    BaseRule,
    CloudRule,
    StarTrailRule,
    ExposureMatchRule,
    FilterMatchRule,
    TemperatureMatchRule,
)


@dataclass
class RuleScore:
    """规则评分。"""
    rule_name: str
    rule_type: str
    passed: bool
    score: float
    weight: float


class RulesEngine:
    """规则引擎。

    功能：
    1. 管理和执行规则集合
    2. 计算综合评分
    3. 确定文件状态（保留/隔离/重拍）
    4. 生成建议
    """

    def __init__(
        self,
        config: Optional[ObservationConfig] = None,
        rules: Optional[List[BaseRule]] = None,
    ):
        """初始化规则引擎。

        Args:
            config: 观测配置
            rules: 可选的规则列表
        """
        self.config = config
        self.rules = rules or []
        self._rule_weights: Dict[str, float] = {}

        # 如果没有提供规则，创建默认规则集合
        if not self.rules and config:
            self._create_default_rules(config)

        # 设置默认权重
        self._set_default_weights()

    def _create_default_rules(self, config: ObservationConfig):
        """创建默认规则集合。

        Args:
            config: 观测配置
        """
        self.rules = [
            CloudRule(config),
            StarTrailRule(config),
            ExposureMatchRule(config),
            FilterMatchRule(config),
            TemperatureMatchRule(config),
        ]

    def _set_default_weights(self):
        """设置默认规则权重。"""
        self._rule_weights = {
            "cloud": 1.5,
            "star_trail": 1.5,
            "exposure_match": 1.2,
            "filter_match": 1.2,
            "temperature_match": 1.3,
        }

    def set_rule_weight(self, rule_type: str, weight: float):
        """设置规则权重。

        Args:
            rule_type: 规则类型
            weight: 权重值
        """
        self._rule_weights[rule_type] = weight

    def add_rule(self, rule: BaseRule, weight: Optional[float] = None):
        """添加规则。

        Args:
            rule: 规则对象
            weight: 可选的权重
        """
        self.rules.append(rule)
        if weight is not None:
            self._rule_weights[rule.rule_type] = weight

    def evaluate(
        self,
        metadata: FITSMetadata,
        metrics: Optional[ImageQualityMetrics] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> Tuple[List[RuleResult], List[RuleScore], float]:
        """评估单个文件。

        Args:
            metadata: FITS元数据
            metrics: 质量指标
            context: 上下文信息

        Returns:
            (规则结果列表, 规则评分列表, 综合评分)
        """
        rule_results = []
        rule_scores = []

        for rule in self.rules:
            result = rule.evaluate(metadata, metrics, context)
            rule_results.append(result)

            # 计算该规则的分数
            weight = self._rule_weights.get(rule.rule_type, 1.0)
            score = 100.0 if result.passed else 0.0

            # 调整严重程度对分数的影响
            if result.severity == "error":
                score = 0.0 if not result.passed else score
            elif result.severity == "warning":
                score = 50.0 if not result.passed else score

            rule_scores.append(RuleScore(
                rule_name=rule.rule_name,
                rule_type=rule.rule_type,
                passed=result.passed,
                score=score,
                weight=weight,
            ))

        # 计算综合评分
        overall_score = self._calculate_overall_score(rule_scores)

        return rule_results, rule_scores, overall_score

    def _calculate_overall_score(self, rule_scores: List[RuleScore]) -> float:
        """计算综合评分。

        使用加权平均，但对失败的规则有惩罚。

        Args:
            rule_scores: 规则评分列表

        Returns:
            综合评分(0-100)
        """
        if not rule_scores:
            return 50.0  # 默认中性评分

        # 检查是否有严重失败的规则
        has_critical_fail = any(
            not rs.passed and rs.weight >= 1.3
            for rs in rule_scores
        )

        if has_critical_fail:
            # 有关键规则失败，直接给低分
            failed_scores = [rs.score for rs in rule_scores if not rs.passed]
            if failed_scores:
                return min(failed_scores)
            return 30.0

        # 计算加权平均
        total_weight = sum(rs.weight for rs in rule_scores)
        if total_weight == 0:
            return 50.0

        weighted_sum = sum(
            rs.score * rs.weight
            for rs in rule_scores
        )

        return round(weighted_sum / total_weight, 2)

    def determine_status(self, overall_score: float, rule_results: List[RuleResult]) -> FileStatus:
        """确定文件状态。

        状态决策逻辑：
        - KEEP: 综合评分 >= 70，且没有关键错误
        - ISOLATE: 综合评分 40-69，或有警告但不是关键错误
        - RETRY: 综合评分 < 40，或有关键错误

        Args:
            overall_score: 综合评分
            rule_results: 规则结果列表

        Returns:
            文件状态
        """
        # 检查是否有关键错误
        critical_errors = [
            r for r in rule_results
            if not r.passed and r.severity == "error"
        ]

        # 检查是否有特定类型的关键错误
        critical_types = ["cloud", "star_trail", "temperature_match"]
        has_critical_type_error = any(
            r.rule_type in critical_types and not r.passed and r.severity == "error"
            for r in rule_results
        )

        if has_critical_type_error:
            # 有关键类型错误，建议重拍或隔离
            if overall_score < 50:
                return FileStatus.RETRY
            else:
                return FileStatus.ISOLATE

        if critical_errors:
            # 有其他错误
            if overall_score < 40:
                return FileStatus.RETRY
            elif overall_score < 70:
                return FileStatus.ISOLATE

        # 基于评分
        if overall_score >= 70:
            return FileStatus.KEEP
        elif overall_score >= 40:
            return FileStatus.ISOLATE
        else:
            return FileStatus.RETRY

    def generate_issues(self, rule_results: List[RuleResult]) -> List[str]:
        """生成问题列表。

        Args:
            rule_results: 规则结果列表

        Returns:
            问题字符串列表
        """
        issues = []
        for result in rule_results:
            if not result.passed:
                issues.append(result.message)
        return issues

    def generate_recommendations(
        self,
        status: FileStatus,
        rule_results: List[RuleResult],
        metadata: FITSMetadata,
    ) -> List[str]:
        """生成建议列表。

        Args:
            status: 文件状态
            rule_results: 规则结果列表
            metadata: FITS元数据

        Returns:
            建议字符串列表
        """
        recommendations = []

        if status == FileStatus.KEEP:
            recommendations.append("此文件质量良好，可以用于后续处理")
            recommendations.append("建议保留并加入叠加队列")

        elif status == FileStatus.ISOLATE:
            recommendations.append("此文件存在质量问题，建议隔离")
            recommendations.append("可以人工检查后决定是否使用")

            # 添加具体建议
            for result in rule_results:
                if not result.passed:
                    if result.rule_type == "cloud":
                        recommendations.append("检测到云/透明度问题，建议检查该帧前后的图像")
                    elif result.rule_type == "star_trail":
                        recommendations.append("检测到星点拖线，可能是导星问题或赤道仪跟踪误差")
                    elif result.rule_type == "temperature_match":
                        recommendations.append("温度偏差较大，建议检查是否使用了正确的暗场")

        elif status == FileStatus.RETRY:
            recommendations.append("此文件质量较差，建议重拍")

            # 添加具体重拍建议
            for result in rule_results:
                if not result.passed and result.severity == "error":
                    if result.rule_type == "cloud":
                        recommendations.append("云/透明度问题严重，建议等待更好的观测条件")
                    elif result.rule_type == "star_trail":
                        recommendations.append("星点拖线严重，建议检查导星系统和赤道仪平衡")
                    elif result.rule_type == "exposure_match":
                        recommendations.append("曝光时间不匹配，建议检查拍摄计划")
                    elif result.rule_type == "filter_match":
                        recommendations.append("滤镜不匹配，建议检查滤镜轮设置")
                    elif result.rule_type == "temperature_match":
                        recommendations.append("温度偏差过大，建议检查相机制冷设置")

        elif status == FileStatus.UNKNOWN:
            recommendations.append("无法评估文件质量，需要更多信息")

        # 添加文件类型特定建议
        if metadata.file_type == FileType.DARK:
            recommendations.append("暗场文件：确保温度与光场匹配")
        elif metadata.file_type == FileType.FLAT:
            recommendations.append("平场文件：确保光照均匀")
        elif metadata.file_type == FileType.LIGHT:
            recommendations.append("光场文件：检查导星和对焦质量")

        return recommendations

    def create_quality_result(
        self,
        metadata: FITSMetadata,
        metrics: Optional[ImageQualityMetrics] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> QualityResult:
        """创建完整的质量评估结果。

        Args:
            metadata: FITS元数据
            metrics: 质量指标
            context: 上下文信息

        Returns:
            QualityResult对象
        """
        # 执行规则评估
        rule_results, rule_scores, overall_score = self.evaluate(
            metadata, metrics, context
        )

        # 确定状态
        status = self.determine_status(overall_score, rule_results)

        # 生成问题和建议
        issues = self.generate_issues(rule_results)
        recommendations = self.generate_recommendations(status, rule_results, metadata)

        return QualityResult(
            file_path=metadata.file_path,
            file_name=metadata.file_name,
            file_type=metadata.file_type,
            status=status,
            overall_score=overall_score,
            metrics=metrics,
            rule_results=rule_results,
            issues=issues,
            recommendations=recommendations,
            metadata=metadata,
        )

    def batch_evaluate(
        self,
        metadatas: List[FITSMetadata],
        metrics_dict: Optional[Dict[str, ImageQualityMetrics]] = None,
    ) -> List[QualityResult]:
        """批量评估文件。

        Args:
            metadatas: FITS元数据列表
            metrics_dict: 可选的质量指标字典 {file_path: metrics}

        Returns:
            QualityResult对象列表
        """
        results = []
        metrics_dict = metrics_dict or {}

        # 先计算基线值（用于云检测等）
        self._calculate_baselines(metadatas, metrics_dict)

        for metadata in metadatas:
            metrics = metrics_dict.get(metadata.file_path)
            result = self.create_quality_result(metadata, metrics)
            results.append(result)

        return results

    def _calculate_baselines(
        self,
        metadatas: List[FITSMetadata],
        metrics_dict: Dict[str, ImageQualityMetrics],
    ):
        """计算基线值。

        用于设置云检测等规则的基线。

        Args:
            metadatas: FITS元数据列表
            metrics_dict: 质量指标字典
        """
        def _is_light(ft):
            """判断是否为光场文件（处理枚举或字符串）。"""
            if isinstance(ft, str):
                return ft.lower() == 'light'
            return ft == FileType.LIGHT
        
        # 收集光场文件的指标
        light_metrics = []
        for metadata in metadatas:
            if _is_light(metadata.file_type):
                metrics = metrics_dict.get(metadata.file_path)
                if metrics:
                    light_metrics.append(metrics)

        if not light_metrics:
            return

        # 计算基线值（使用中位数）
        noises = [m.background_noise for m in light_metrics if m.background_noise is not None]
        star_counts = [m.star_count for m in light_metrics if m.star_count is not None]

        baseline_noise = None
        baseline_stars = None

        if noises:
            baseline_noise = float(sum(noises) / len(noises))

        if star_counts:
            baseline_stars = int(sum(star_counts) / len(star_counts))

        # 更新CloudRule的基线
        for rule in self.rules:
            if isinstance(rule, CloudRule):
                rule.set_baseline(baseline_noise, baseline_stars)

    def get_statistics(self, results: List[QualityResult]) -> Dict[str, Any]:
        """获取评估统计信息。

        Args:
            results: 质量结果列表

        Returns:
            统计信息字典
        """
        stats = {
            "total": len(results),
            "by_status": defaultdict(int),
            "by_type": defaultdict(lambda: defaultdict(int)),
            "score_distribution": {
                "excellent": 0,
                "good": 0,
                "fair": 0,
                "poor": 0,
            },
            "avg_score": 0.0,
        }

        total_score = 0.0
        score_count = 0

        for result in results:
            # 按状态统计 (处理枚举或字符串)
            if hasattr(result.status, 'value'):
                status_val = result.status.value
            else:
                status_val = result.status
            stats["by_status"][status_val] += 1

            # 按类型和状态统计 (处理枚举或字符串)
            if hasattr(result.file_type, 'value'):
                file_type_val = result.file_type.value
            else:
                file_type_val = result.file_type
            stats["by_type"][file_type_val][status_val] += 1

            # 按分数分布统计
            if result.overall_score is not None:
                total_score += result.overall_score
                score_count += 1

                if result.overall_score >= 80:
                    stats["score_distribution"]["excellent"] += 1
                elif result.overall_score >= 60:
                    stats["score_distribution"]["good"] += 1
                elif result.overall_score >= 40:
                    stats["score_distribution"]["fair"] += 1
                else:
                    stats["score_distribution"]["poor"] += 1

        # 计算平均分
        if score_count > 0:
            stats["avg_score"] = round(total_score / score_count, 2)

        # 转换为普通字典
        stats["by_status"] = dict(stats["by_status"])
        stats["by_type"] = {k: dict(v) for k, v in stats["by_type"].items()}

        return stats
