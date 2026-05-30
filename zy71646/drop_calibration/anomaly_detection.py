"""
异常检测模块
- 标注异常原因，让同事能看懂
- 定位数据源（来源文件、原始行、对象ID）
- 检测常见问题：样本重复、活动加成漏算、概率不归一、统计显著偏离
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict
from datetime import datetime
import numpy as np

from .exceptions import create_error_location
from .models import (
    PlayerLog,
    DropConfig,
    ActivityPeriod,
    ComplaintRecord,
    CalibrationParams,
    DataSource,
)
from .probability_test import TestResult, ItemStats
from .data_cleaning import CleaningResult


class AnomalyLevel(str):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class AnomalyItem:
    """单个异常项"""
    anomaly_id: str
    level: str
    anomaly_type: str
    title: str
    description: str
    reason_analysis: str
    suggestion: str
    pool_id: Optional[str] = None
    item_id: Optional[str] = None
    player_id: Optional[str] = None
    source_file: Optional[str] = None
    source_row: Optional[int] = None
    object_id: Optional[str] = None
    raw_data: Optional[Dict[str, Any]] = None
    related_data: Dict[str, Any] = field(default_factory=dict)
    detected_time: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "anomaly_id": self.anomaly_id,
            "level": self.level,
            "anomaly_type": self.anomaly_type,
            "title": self.title,
            "description": self.description,
            "reason_analysis": self.reason_analysis,
            "suggestion": self.suggestion,
            "pool_id": self.pool_id,
            "item_id": self.item_id,
            "player_id": self.player_id,
            "source_file": self.source_file,
            "source_row": self.source_row,
            "object_id": self.object_id,
            "related_data": self.related_data,
            "detected_time": self.detected_time.isoformat(),
        }


@dataclass
class AnomalyReport:
    """异常检测报告"""
    total_anomalies: int = 0
    critical_count: int = 0
    warning_count: int = 0
    info_count: int = 0
    anomalies: List[AnomalyItem] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)

    def add(self, anomaly: AnomalyItem) -> None:
        self.anomalies.append(anomaly)
        self.total_anomalies += 1
        if anomaly.level == AnomalyLevel.CRITICAL:
            self.critical_count += 1
        elif anomaly.level == AnomalyLevel.WARNING:
            self.warning_count += 1
        else:
            self.info_count += 1


class AnomalyDetector:
    """
    异常检测器
    检测并解释掉落概率相关的异常
    """

    def __init__(self, fail_fast: bool = False):
        self.fail_fast = fail_fast
        self._anomaly_counter = 0

    def _next_anomaly_id(self) -> str:
        self._anomaly_counter += 1
        return f"ANOM_{datetime.now().strftime('%Y%m%d')}_{self._anomaly_counter:04d}"

    def detect_all(
        self,
        player_logs: List[PlayerLog],
        drop_configs: List[DropConfig],
        activity_periods: List[ActivityPeriod],
        complaint_records: List[ComplaintRecord],
        cleaning_result: CleaningResult,
        test_result: TestResult,
        params: CalibrationParams,
        data_sources: List[DataSource],
    ) -> AnomalyReport:
        """
        执行完整的异常检测
        """
        report = AnomalyReport()

        try:
            self._detect_duplicate_samples(player_logs, cleaning_result, report, data_sources)
            self._detect_activity_bonus_issues(
                player_logs, activity_periods, cleaning_result, report, data_sources
            )
            self._detect_probability_normalization_issues(
                drop_configs, cleaning_result, report, data_sources
            )
            self._detect_significant_deviations(
                test_result, drop_configs, params, report, data_sources
            )
            self._detect_extreme_deviations(
                test_result, params, report, data_sources
            )
            self._detect_complaint_anomalies(
                complaint_records, test_result, report, data_sources
            )
            self._detect_data_quality_issues(
                cleaning_result, test_result, report, data_sources
            )
            self._generate_summary(report, params)

        except Exception as e:
            report.anomalies.append(AnomalyItem(
                anomaly_id=self._next_anomaly_id(),
                level=AnomalyLevel.CRITICAL,
                anomaly_type="detection_error",
                title="异常检测失败",
                description=f"检测过程中发生错误: {str(e)}",
                reason_analysis="程序运行出错，可能是数据格式异常导致",
                suggestion="请检查输入数据是否完整，或联系技术支持",
            ))

        return report

    def _detect_duplicate_samples(
        self,
        logs: List[PlayerLog],
        cleaning_result: CleaningResult,
        report: AnomalyReport,
        data_sources: List[DataSource],
    ) -> None:
        """检测样本重复问题"""
        dup_result = cleaning_result.deduplicate

        if dup_result.duplicate_count == 0:
            return

        source_map = {s.source_id: s for s in data_sources}

        report.add(AnomalyItem(
            anomaly_id=self._next_anomaly_id(),
            level=AnomalyLevel.WARNING,
            anomaly_type="duplicate_samples",
            title=f"发现 {dup_result.duplicate_count} 条重复记录",
            description=(
                f"总记录数 {dup_result.total_records} 条，"
                f"检测到重复记录 {dup_result.duplicate_count} 条，"
                f"唯一记录 {dup_result.unique_count} 条。"
                f"去重键：{', '.join(dup_result.duplicate_keys)}"
            ),
            reason_analysis=(
                "样本重复可能的原因：\n"
                "1. 日志重复上报（玩家网络重连导致）\n"
                "2. 数据导入时重复导入了相同文件\n"
                "3. 日志文件本身包含重复条目\n"
                "4. 去重键可能不够精确（例如时间精度问题）"
            ),
            suggestion=(
                "已自动标记重复记录并在后续统计中排除。"
                "建议：\n"
                "1. 检查数据源是否存在重复导入\n"
                "2. 如果是日志系统问题，联系开发排查上报逻辑\n"
                "3. 确认去重键是否合理，必要时调整"
            ),
            related_data={
                "total_records": dup_result.total_records,
                "duplicate_count": dup_result.duplicate_count,
                "unique_count": dup_result.unique_count,
                "duplicate_keys": dup_result.duplicate_keys,
                "duplicate_groups_count": len(dup_result.duplicate_groups),
            },
        ))

        for primary_id, duplicate_ids in list(dup_result.duplicate_groups.items())[:10]:
            primary_log = next((l for l in logs if l.log_id == primary_id), None)
            if not primary_log:
                continue

            source = source_map.get(primary_log.source_id)
            report.add(AnomalyItem(
                anomaly_id=self._next_anomaly_id(),
                level=AnomalyLevel.INFO,
                anomaly_type="duplicate_sample_detail",
                title=f"重复记录示例: 玩家 {primary_log.player_id}",
                description=(
                    f"玩家 {primary_log.player_id} 在 {primary_log.drop_time} "
                    f"从池子 {primary_log.pool_id} 获得道具 {primary_log.item_id} "
                    f"的记录重复了 {len(duplicate_ids)} 次"
                ),
                reason_analysis="单条重复记录，属于上述重复样本问题的具体案例",
                suggestion="已自动排除重复记录，如无其他问题可忽略",
                pool_id=primary_log.pool_id,
                item_id=primary_log.item_id,
                player_id=primary_log.player_id,
                source_file=source.file_path if source else None,
                source_row=primary_log.source_row,
                object_id=primary_log.log_id,
                raw_data=primary_log.raw_data,
                related_data={
                    "duplicate_count": len(duplicate_ids),
                    "duplicate_log_ids": duplicate_ids,
                },
            ))

    def _detect_activity_bonus_issues(
        self,
        logs: List[PlayerLog],
        activities: List[ActivityPeriod],
        cleaning_result: CleaningResult,
        report: AnomalyReport,
        data_sources: List[DataSource],
    ) -> None:
        """检测活动加成漏算问题"""
        bonus_result = cleaning_result.activity_bonus
        source_map = {s.source_id: s for s in data_sources}

        if bonus_result.total_records == 0:
            return

        activity_coverage = bonus_result.records_with_activity / bonus_result.total_records

        if activities and activity_coverage < 0.01 and bonus_result.total_records > 100:
            report.add(AnomalyItem(
                anomaly_id=self._next_anomaly_id(),
                level=AnomalyLevel.CRITICAL,
                anomaly_type="activity_bonus_missing",
                title="活动加成可能漏算",
                description=(
                    f"系统配置了 {len(activities)} 个活动时段，"
                    f"但在 {bonus_result.total_records} 条掉落记录中，"
                    f"仅有 {bonus_result.records_with_activity} 条匹配到活动，"
                    f"覆盖率仅为 {activity_coverage*100:.2f}%。"
                ),
                reason_analysis=(
                    "活动加成漏算的可能原因：\n"
                    "1. 活动时间配置错误（时区问题、格式问题）\n"
                    "2. 活动关联的池子或道具ID不匹配\n"
                    "3. 活动已过期或尚未开始\n"
                    "4. 活动配置未正确导入\n"
                    "5. 掉落地时间格式与活动时间格式不匹配"
                ),
                suggestion=(
                    "请检查：\n"
                    "1. 活动时段的起止时间是否正确\n"
                    "2. 活动关联的pool_id和item_id是否与配置一致\n"
                    "3. 时间时区是否统一\n"
                    "4. 活动配置是否为激活状态"
                ),
                related_data={
                    "total_activities": len(activities),
                    "total_records": bonus_result.total_records,
                    "records_with_activity": bonus_result.records_with_activity,
                    "coverage_rate": activity_coverage,
                    "average_multiplier": bonus_result.average_multiplier,
                    "applied_activities": bonus_result.applied_activities,
                },
            ))

        if bonus_result.average_multiplier > 1.5:
            report.add(AnomalyItem(
                anomaly_id=self._next_anomaly_id(),
                level=AnomalyLevel.WARNING,
                anomaly_type="high_activity_multiplier",
                title="活动加成倍率偏高",
                description=(
                    f"平均掉率倍率为 {bonus_result.average_multiplier:.2f} 倍，"
                    f"超过正常水平。已应用活动的记录数：{bonus_result.records_with_activity}"
                ),
                reason_analysis=(
                    "高倍率可能意味着：\n"
                    "1. 确实在进行高加成活动\n"
                    "2. 活动倍率配置错误（多打了一个零）\n"
                    "3. 多个活动叠加导致倍率过高"
                ),
                suggestion=(
                    "请核实活动倍率配置是否正确，"
                    "如配置正确且确实在进行高加成活动，此警告可忽略。"
                ),
                related_data={
                    "average_multiplier": bonus_result.average_multiplier,
                    "applied_activities": bonus_result.applied_activities,
                },
            ))

        for activity_id, count in bonus_result.applied_activities.items():
            activity = next((a for a in activities if a.activity_id == activity_id), None)
            if activity and activity.drop_rate_multiplier != 1.0:
                source = source_map.get(activity.source_id)
                report.add(AnomalyItem(
                    anomaly_id=self._next_anomaly_id(),
                    level=AnomalyLevel.INFO,
                    anomaly_type="activity_applied",
                    title=f"活动 {activity.activity_name} 已应用",
                    description=(
                        f"活动 {activity.activity_name} ({activity_id}) "
                        f"倍率 {activity.drop_rate_multiplier}x，"
                        f"影响了 {count} 条掉落记录。"
                        f"活动时间：{activity.start_time} ~ {activity.end_time}"
                    ),
                    reason_analysis="正常的活动加成应用",
                    suggestion="在计算期望概率时已考虑此活动加成",
                    object_id=activity_id,
                    source_file=source.file_path if source else None,
                    source_row=activity.source_row,
                    related_data={
                        "multiplier": activity.drop_rate_multiplier,
                        "affected_records": count,
                        "start_time": activity.start_time.isoformat() if activity.start_time else None,
                        "end_time": activity.end_time.isoformat() if activity.end_time else None,
                    },
                ))

    def _detect_probability_normalization_issues(
        self,
        configs: List[DropConfig],
        cleaning_result: CleaningResult,
        report: AnomalyReport,
        data_sources: List[DataSource],
    ) -> None:
        """检测概率不归一问题"""
        source_map = {s.source_id: s for s in data_sources}

        for pool_id, norm_result in cleaning_result.normalization.items():
            if norm_result.is_normalized:
                continue

            pool_configs = [c for c in configs if c.pool_id == pool_id and c.is_enabled]

            level = AnomalyLevel.CRITICAL if abs(norm_result.diff_from_one) > 0.1 else AnomalyLevel.WARNING

            report.add(AnomalyItem(
                anomaly_id=self._next_anomaly_id(),
                level=level,
                anomaly_type="probability_not_normalized",
                title=f"道具池 {pool_id} 概率未归一化",
                description=(
                    f"道具池 {pool_id} 包含 {norm_result.item_count} 个道具，"
                    f"原始概率总和为 {norm_result.original_total:.6f}，"
                    f"与1的偏差为 {norm_result.diff_from_one:.6f}，"
                    f"{'已自动归一化' if cleaning_result.normalization[pool_id].normalized_probabilities else '未自动修正'}。"
                ),
                reason_analysis=(
                    "概率不归一的可能原因：\n"
                    "1. 配置时计算错误，各道具概率相加不等于1\n"
                    "2. 使用权重配置但未正确转换为概率\n"
                    "3. 新增或删除道具后未重新计算概率\n"
                    "4. 使用百分比配置时忘记除以100\n"
                    "5. 四舍五入累积误差"
                ),
                suggestion=(
                    f"{'已自动归一化，后续计算将使用归一化后的概率。' if norm_result.normalized_probabilities else '未自动修正，请手动检查。'}"
                    f"建议：\n"
                    f"1. 检查配置表中各道具概率之和\n"
                    f"2. 确认是否使用权重而非直接概率配置\n"
                    f"3. 如有新增道具，确认是否更新了所有相关概率\n"
                    f"4. 检查是否存在百分比与小数混用的情况"
                ),
                pool_id=pool_id,
                related_data={
                    "item_count": norm_result.item_count,
                    "original_total": norm_result.original_total,
                    "diff_from_one": norm_result.diff_from_one,
                    "original_probabilities": norm_result.original_probabilities,
                    "normalized_probabilities": norm_result.normalized_probabilities,
                },
            ))

            if pool_configs:
                cfg = pool_configs[0]
                source = source_map.get(cfg.source_id)
                report.anomalies[-1].source_file = source.file_path if source else None

    def _detect_significant_deviations(
        self,
        test_result: TestResult,
        configs: List[DropConfig],
        params: CalibrationParams,
        report: AnomalyReport,
        data_sources: List[DataSource],
    ) -> None:
        """检测统计显著的概率偏离"""
        source_map = {s.source_id: s for s in data_sources}

        significant_items = [
            item for item in test_result.item_stats.values()
            if item.is_significant
        ]

        if not significant_items:
            return

        report.add(AnomalyItem(
            anomaly_id=self._next_anomaly_id(),
            level=AnomalyLevel.CRITICAL,
            anomaly_type="significant_deviation_overall",
            title=f"发现 {len(significant_items)} 个道具存在统计显著偏离",
            description=(
                f"在显著性水平 {params.significance_level} 下，"
                f"共有 {len(significant_items)} 个道具的实际掉落概率与配置概率存在统计显著差异。"
            ),
            reason_analysis=(
                "统计显著偏离意味着观察到的差异不太可能是随机波动造成的，"
                "可能的原因：\n"
                "1. 实际掉落配置与文档配置不一致\n"
                "2. 存在未记录的热更新或临时调整\n"
                "3. 活动加成计算有误\n"
                "4. 样本存在偏差（如只统计了特定玩家群体）\n"
                "5. 随机数生成器存在问题"
            ),
            suggestion=(
                "请重点关注这些道具，检查：\n"
                "1. 实际配置的概率值\n"
                "2. 是否有临时调整未同步到配置文件\n"
                "3. 活动加成是否正确应用\n"
                "4. 抽样方法是否存在偏差"
            ),
            related_data={
                "significant_count": len(significant_items),
                "significance_level": params.significance_level,
                "total_items": test_result.total_items,
                "significant_items": [
                    {
                        "pool_id": item.pool_id,
                        "item_id": item.item_id,
                        "item_name": item.item_name,
                        "p_value": item.p_value,
                        "deviation_percent": item.deviation_percent,
                    }
                    for item in significant_items
                ],
            },
        ))

        for item in significant_items:
            config = next(
                (c for c in configs if c.pool_id == item.pool_id and c.item_id == item.item_id),
                None
            )
            source = source_map.get(config.source_id) if config else None

            direction = "偏高" if item.deviation > 0 else "偏低"
            magnitude = abs(item.deviation_percent)

            if magnitude >= 100:
                detail_level = AnomalyLevel.CRITICAL
            elif magnitude >= 50:
                detail_level = AnomalyLevel.WARNING
            else:
                detail_level = AnomalyLevel.INFO

            report.add(AnomalyItem(
                anomaly_id=self._next_anomaly_id(),
                level=detail_level,
                anomaly_type="significant_deviation_item",
                title=f"道具 {item.item_name} 掉落显著{direction}",
                description=(
                    f"道具 {item.item_name} ({item.item_id}) "
                    f"在池子 {item.pool_id} 中：\n"
                    f"  配置概率: {item.expected_probability*100:.4f}%\n"
                    f"  实际概率: {item.observed_probability*100:.4f}%\n"
                    f"  偏离值: {item.deviation*100:+.4f}pp ({item.deviation_percent:+.2f}%)\n"
                    f"  P值: {item.p_value:.6f} (小于 {params.significance_level}，统计显著)\n"
                    f"  样本量: {item.total_attempts} 次抽取，掉落 {item.drop_count} 次\n"
                    f"  置信区间: [{item.confidence_lower*100:.4f}%, {item.confidence_upper*100:.4f}%]"
                ),
                reason_analysis=self._generate_deviation_reason(item),
                suggestion=self._generate_deviation_suggestion(item),
                pool_id=item.pool_id,
                item_id=item.item_id,
                source_file=source.file_path if source else None,
                source_row=config.source_row if config else None,
                object_id=item.item_id,
                related_data={
                    "expected_probability": item.expected_probability,
                    "observed_probability": item.observed_probability,
                    "deviation": item.deviation,
                    "deviation_percent": item.deviation_percent,
                    "p_value": item.p_value,
                    "total_attempts": item.total_attempts,
                    "drop_count": item.drop_count,
                    "confidence_lower": item.confidence_lower,
                    "confidence_upper": item.confidence_upper,
                },
            ))

    def _detect_extreme_deviations(
        self,
        test_result: TestResult,
        params: CalibrationParams,
        report: AnomalyReport,
        data_sources: List[DataSource],
    ) -> None:
        """检测极端偏差（即使统计不显著但偏差很大）"""
        critical_threshold = params.deviation_critical_threshold
        warning_threshold = params.deviation_warning_threshold

        for key, item in test_result.item_stats.items():
            abs_deviation = abs(item.deviation)
            abs_deviation_percent = abs(item.deviation_percent)

            if abs_deviation_percent >= critical_threshold * 100 and not item.is_significant:
                direction = "偏高" if item.deviation > 0 else "偏低"
                report.add(AnomalyItem(
                    anomaly_id=self._next_anomaly_id(),
                    level=AnomalyLevel.WARNING,
                    anomaly_type="extreme_deviation_not_significant",
                    title=f"道具 {item.item_name} 偏差较大但统计不显著",
                    description=(
                        f"道具 {item.item_name} ({item.item_id}) "
                        f"偏差达 {item.deviation_percent:+.2f}%，{direction}，"
                        f"但P值 {item.p_value:.4f} >= {params.significance_level}，"
                        f"统计不显著。这可能是因为样本量不足（{item.total_attempts} 次）。"
                    ),
                    reason_analysis=(
                        "偏差大但统计不显著，通常是样本量不足导致的。"
                        "即使真实概率没有偏离，小样本也可能出现大偏差。"
                        "需要更多数据来确认是否真的存在问题。"
                    ),
                    suggestion=(
                        f"建议增加样本量后重新检验。"
                        f"当前样本量 {item.total_attempts}，"
                        f"建议至少收集 {max(params.min_sample_size, int(100 / item.expected_probability))} 条数据"
                    ),
                    pool_id=item.pool_id,
                    item_id=item.item_id,
                    related_data={
                        "deviation_percent": item.deviation_percent,
                        "p_value": item.p_value,
                        "total_attempts": item.total_attempts,
                        "critical_threshold": critical_threshold,
                    },
                ))

            elif abs_deviation_percent >= warning_threshold * 100 and abs_deviation_percent < critical_threshold * 100:
                direction = "偏高" if item.deviation > 0 else "偏低"
                report.add(AnomalyItem(
                    anomaly_id=self._next_anomaly_id(),
                    level=AnomalyLevel.INFO,
                    anomaly_type="moderate_deviation",
                    title=f"道具 {item.item_name} 轻微{direction}",
                    description=(
                        f"道具 {item.item_name} ({item.item_id}) "
                        f"偏差 {item.deviation_percent:+.2f}%，{direction}，"
                        f"在警戒阈值内（{warning_threshold*100:.0f}%），"
                        f"{'统计显著' if item.is_significant else '统计不显著'}。"
                    ),
                    reason_analysis="轻微波动可能是正常随机现象，建议持续观察。",
                    suggestion="持续观察，如果偏差持续扩大需要介入检查。",
                    pool_id=item.pool_id,
                    item_id=item.item_id,
                ))

    def _detect_complaint_anomalies(
        self,
        complaints: List[ComplaintRecord],
        test_result: TestResult,
        report: AnomalyReport,
        data_sources: List[DataSource],
    ) -> None:
        """检测投诉记录中的异常"""
        if not complaints:
            return

        source_map = {s.source_id: s for s in data_sources}
        verified_complaints = [c for c in complaints if c.is_verified]
        unverified_complaints = [c for c in complaints if not c.is_verified]

        report.add(AnomalyItem(
            anomaly_id=self._next_anomaly_id(),
            level=AnomalyLevel.INFO,
            anomaly_type="complaint_summary",
            title=f"投诉记录汇总",
            description=(
                f"共有 {len(complaints)} 条投诉记录，"
                f"其中已核实 {len(verified_complaints)} 条，"
                f"未核实 {len(unverified_complaints)} 条。"
            ),
            reason_analysis="投诉记录反映了玩家的主观感受，需要结合客观数据验证。",
            suggestion="重点关注已核实且数据支持的投诉案例。",
            related_data={
                "total_complaints": len(complaints),
                "verified_count": len(verified_complaints),
                "unverified_count": len(unverified_complaints),
            },
        ))

        for complaint in verified_complaints:
            key = f"{complaint.pool_id}:{complaint.item_id}"
            item_stat = test_result.item_stats.get(key)

            if item_stat and item_stat.deviation < 0:
                source = source_map.get(complaint.source_id)
                report.add(AnomalyItem(
                    anomaly_id=self._next_anomaly_id(),
                    level=AnomalyLevel.WARNING,
                    anomaly_type="verified_complaint_supported",
                    title=f"玩家投诉被数据支持: 玩家 {complaint.player_id}",
                    description=(
                        f"玩家 {complaint.player_id} 投诉道具 {complaint.item_id} 掉率低，"
                        f"数据显示该道具实际掉率 {item_stat.observed_probability*100:.4f}%，"
                        f"低于配置 {item_stat.expected_probability*100:.4f}%，"
                        f"偏差 {item_stat.deviation_percent:+.2f}%。"
                        f"玩家声称 {complaint.total_attempts} 次抽取仅获得 {complaint.actual_drop_count} 次。"
                    ),
                    reason_analysis=(
                        "投诉与数据一致，说明确实可能存在掉率问题。"
                        "需要进一步确认是配置问题、活动问题还是随机波动。"
                    ),
                    suggestion=(
                        "建议：\n"
                        "1. 检查该道具的实际配置\n"
                        "2. 确认活动加成是否正确\n"
                        "3. 考虑对受影响玩家进行补偿\n"
                        "4. 向玩家反馈调查结果"
                    ),
                    pool_id=complaint.pool_id,
                    item_id=complaint.item_id,
                    player_id=complaint.player_id,
                    source_file=source.file_path if source else None,
                    source_row=complaint.source_row,
                    object_id=complaint.complaint_id,
                    related_data={
                        "complaint_content": complaint.complaint_content,
                        "total_attempts": complaint.total_attempts,
                        "actual_drop_count": complaint.actual_drop_count,
                        "deviation_percent": item_stat.deviation_percent,
                        "is_significant": item_stat.is_significant,
                    },
                ))

    def _detect_data_quality_issues(
        self,
        cleaning_result: CleaningResult,
        test_result: TestResult,
        report: AnomalyReport,
        data_sources: List[DataSource],
    ) -> None:
        """检测数据质量问题"""
        for warning in cleaning_result.warnings:
            report.add(AnomalyItem(
                anomaly_id=self._next_anomaly_id(),
                level=AnomalyLevel.WARNING,
                anomaly_type="data_quality_warning",
                title="数据质量警告",
                description=warning,
                reason_analysis="数据清洗过程中发现的潜在问题",
                suggestion="请根据具体警告内容检查相应数据",
            ))

        for warning in test_result.warnings:
            report.add(AnomalyItem(
                anomaly_id=self._next_anomaly_id(),
                level=AnomalyLevel.WARNING,
                anomaly_type="test_warning",
                title="统计检验警告",
                description=warning,
                reason_analysis="统计检验过程中发现的潜在问题",
                suggestion="统计结果可能存在偏差，请谨慎解读",
            ))

        for pool_id, pool_result in test_result.pool_chi_square.items():
            if "warning" in pool_result:
                report.add(AnomalyItem(
                    anomaly_id=self._next_anomaly_id(),
                    level=AnomalyLevel.WARNING,
                    anomaly_type="chi_square_warning",
                    title=f"池子 {pool_id} 卡方检验警告",
                    description=pool_result["warning"],
                    reason_analysis="卡方检验的前提条件未完全满足，结果可能不可靠",
                    suggestion="建议合并类别或收集更多数据后重新检验",
                    pool_id=pool_id,
                ))

    def _generate_deviation_reason(self, item: ItemStats) -> str:
        """生成偏差原因分析"""
        reasons = []
        direction = "偏高" if item.deviation > 0 else "偏低"

        if item.deviation > 0:
            if item.deviation_percent > 50:
                reasons.append(f"实际掉率严重偏高（+{item.deviation_percent:.1f}%），可能配置错误或存在未记录的活动")
            elif item.deviation_percent > 20:
                reasons.append(f"实际掉率明显偏高（+{item.deviation_percent:.1f}%），可能存在活动加成或配置偏高")
            else:
                reasons.append(f"实际掉率轻微偏高（+{item.deviation_percent:.1f}%），可能是正常波动")
        else:
            if item.deviation_percent < -50:
                reasons.append(f"实际掉率严重偏低（{item.deviation_percent:.1f}%），可能配置错误或活动未生效")
            elif item.deviation_percent < -20:
                reasons.append(f"实际掉率明显偏低（{item.deviation_percent:.1f}%），可能配置偏低或活动结束未更新")
            else:
                reasons.append(f"实际掉率轻微偏低（{item.deviation_percent:.1f}%），可能是正常波动")

        if item.p_value < 0.01:
            reasons.append(f"统计检验P值={item.p_value:.6f} < 0.01，高度显著，差异真实存在的可能性极大")
        elif item.p_value < 0.05:
            reasons.append(f"统计检验P值={item.p_value:.4f} < 0.05，统计显著，差异真实存在的可能性大")

        if item.total_attempts < 100:
            reasons.append(f"样本量较小（{item.total_attempts} 次），建议收集更多数据确认")
        elif item.total_attempts > 10000:
            reasons.append(f"样本量充足（{item.total_attempts} 次），检验结果可靠")

        if item.expected_count < 5:
            reasons.append(f"期望掉落次数 {item.expected_count:.1f} < 5，卡方检验前提条件不完全满足")

        reasons.append("\n可能的具体原因：")
        if item.deviation < 0:
            reasons.append("  - 配置概率填错（少写了一个零）")
            reasons.append("  - 活动已结束但配置未恢复")
            reasons.append("  - 该道具被临时屏蔽或调整")
            reasons.append("  - 权重计算错误")
        else:
            reasons.append("  - 配置概率填错（多写了一个零）")
            reasons.append("  - 存在未记录的活动加成")
            reasons.append("  - 该道具被临时调高概率")
            reasons.append("  - 权重计算错误")
        reasons.append("  - 随机数生成器存在偏向性")
        reasons.append("  - 样本存在选择性偏差")

        return "\n".join(reasons)

    def _generate_deviation_suggestion(self, item: ItemStats) -> str:
        """生成偏差处理建议"""
        suggestions = []

        suggestions.append(f"即时检查：")
        suggestions.append(f"  1. 查看实际配置文件中 {item.item_name} 的概率值")
        suggestions.append(f"  2. 检查该道具池是否有未记录的热更新")
        suggestions.append(f"  3. 确认相关活动配置是否正确")
        suggestions.append(f"  4. 核对配置的单位（百分比 vs 小数）")

        if abs(item.deviation_percent) > 50 and item.is_significant:
            suggestions.append(f"\n紧急处理：")
            suggestions.append(f"  - 如果确认配置错误，立即修正")
            suggestions.append(f"  - 评估对经济系统和玩家体验的影响")
            suggestions.append(f"  - 考虑对受影响玩家进行补偿或回收")
            suggestions.append(f"  - 发布公告说明情况")

        suggestions.append(f"\n后续预防：")
        suggestions.append(f"  - 建立配置发布前的自动校验机制")
        suggestions.append(f"  - 定期运行此校准脚本监控掉率")
        suggestions.append(f"  - 设置告警阈值，偏差过大时自动通知")
        suggestions.append(f"  - 保留所有配置变更历史，便于回溯")

        return "\n".join(suggestions)

    def _generate_summary(self, report: AnomalyReport, params: CalibrationParams) -> None:
        """生成异常摘要"""
        report.summary = {
            "total_anomalies": report.total_anomalies,
            "critical_count": report.critical_count,
            "warning_count": report.warning_count,
            "info_count": report.info_count,
            "anomaly_types": defaultdict(int),
            "params_used": params.to_dict(),
            "generated_at": datetime.now().isoformat(),
        }

        for anomaly in report.anomalies:
            report.summary["anomaly_types"][anomaly.anomaly_type] += 1

        report.summary["anomaly_types"] = dict(report.summary["anomaly_types"])
