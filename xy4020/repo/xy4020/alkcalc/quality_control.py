# -*- coding: utf-8 -*-
"""
质控规则模块
负责执行各种质量控制检查，生成质控标记
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Set, Tuple
from collections import defaultdict

from .csv_parser import SampleInfo, SampleTitrationData, TitrationReading
from .calculator import AlkalinityResult


class QCStatus(Enum):
    """质控状态"""
    PASS = "PASS"
    WARNING = "WARNING"
    FAIL = "FAIL"
    ERROR = "ERROR"


@dataclass
class QCIssue:
    """质控问题"""
    sample_id: str
    status: QCStatus
    rule_code: str
    message: str
    details: dict = field(default_factory=dict)


@dataclass
class SampleQCResult:
    """单个样品的质控结果"""
    sample_id: str
    status: QCStatus
    issues: List[QCIssue] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)


@dataclass
class DuplicateQCResult:
    """平行样对的质控结果"""
    sample_ids: Tuple[str, str]
    parent_sample_id: Optional[str]
    status: QCStatus
    rpd_percent: float
    rpd_limit: float
    value1: float
    value2: float
    issues: List[QCIssue] = field(default_factory=list)


@dataclass
class BatchQCResult:
    """批次质控结果"""
    overall_status: QCStatus
    sample_results: Dict[str, SampleQCResult] = field(default_factory=dict)
    duplicate_results: List[DuplicateQCResult] = field(default_factory=list)
    all_issues: List[QCIssue] = field(default_factory=list)
    summary: dict = field(default_factory=dict)


class QCRules:
    """质控规则定义"""
    
    # 规则代码
    MIN_READINGS = "MIN_READINGS"
    PH_MONOTONIC = "PH_MONOTONIC"
    PH_RANGE = "PH_RANGE"
    STANDARD_CONCENTRATION = "STANDARD_CONCENTRATION"
    SAMPLE_MISMATCH = "SAMPLE_MISMATCH"
    DUPLICATE_RPD = "DUPLICATE_RPD"
    GRAN_FIT_QUALITY = "GRAN_FIT_QUALITY"
    NEGATIVE_ALKALINITY = "NEGATIVE_ALKALINITY"
    
    # 规则描述
    RULE_DESCRIPTIONS = {
        MIN_READINGS: "最小读数点数检查",
        PH_MONOTONIC: "pH单调性检查",
        PH_RANGE: "pH范围合理性检查",
        STANDARD_CONCENTRATION: "标准液浓度检查",
        SAMPLE_MISMATCH: "样品编号匹配检查",
        DUPLICATE_RPD: "平行样相对偏差检查",
        GRAN_FIT_QUALITY: "Gran拟合质量检查",
        NEGATIVE_ALKALINITY: "负碱度检查",
    }


class QualityControlChecker:
    """质量控制检查器"""

    def __init__(self, min_readings: int = 5, 
                 ph_monotonic_tolerance: float = 0.05,
                 duplicate_rpd_limit: float = 10.0,
                 gran_r2_threshold: float = 0.95):
        """
        初始化质控检查器
        
        Args:
            min_readings: 最小读数点数
            ph_monotonic_tolerance: pH单调性容差（允许的pH升高值）
            duplicate_rpd_limit: 平行样相对偏差限值（%）
            gran_r2_threshold: Gran拟合R²阈值
        """
        self.min_readings = min_readings
        self.ph_monotonic_tolerance = ph_monotonic_tolerance
        self.duplicate_rpd_limit = duplicate_rpd_limit
        self.gran_r2_threshold = gran_r2_threshold

    def check_min_readings(self, sample_id: str, num_readings: int) -> List[QCIssue]:
        """
        检查最小读数点数
        
        Args:
            sample_id: 样品ID
            num_readings: 读数数量
            
        Returns:
            质控问题列表
        """
        issues = []
        
        if num_readings < self.min_readings:
            issues.append(QCIssue(
                sample_id=sample_id,
                status=QCStatus.FAIL,
                rule_code=QCRules.MIN_READINGS,
                message=f"读数点数不足: {num_readings} < {self.min_readings}",
                details={"actual": num_readings, "required": self.min_readings}
            ))
        elif num_readings < self.min_readings + 2:
            issues.append(QCIssue(
                sample_id=sample_id,
                status=QCStatus.WARNING,
                rule_code=QCRules.MIN_READINGS,
                message=f"读数点数偏少: {num_readings}",
                details={"actual": num_readings, "recommended": self.min_readings + 2}
            ))
        
        return issues

    def check_ph_monotonicity(self, sample_id: str, 
                               readings: List[TitrationReading]) -> List[QCIssue]:
        """
        检查pH是否随着滴定剂体积增加而单调下降
        
        酸滴定碱时，pH应该随着体积增加而下降
        
        Args:
            sample_id: 样品ID
            readings: 滴定读数列表
            
        Returns:
            质控问题列表
        """
        issues = []
        
        if len(readings) < 2:
            return issues
        
        # 按体积排序
        sorted_readings = sorted(readings, key=lambda r: r.volume_ml)
        
        # 检查每对相邻读数
        violations = []
        for i in range(len(sorted_readings) - 1):
            v1, ph1 = sorted_readings[i].volume_ml, sorted_readings[i].ph
            v2, ph2 = sorted_readings[i + 1].volume_ml, sorted_readings[i + 1].ph
            
            if v2 <= v1:
                continue  # 体积相同或减小，跳过（应该由其他规则检查）
            
            # 正常情况下pH应该下降（酸滴定碱）
            # 允许小幅升高（容差范围内）
            ph_increase = ph2 - ph1
            if ph_increase > self.ph_monotonic_tolerance:
                violations.append({
                    "index": i,
                    "volume1": v1,
                    "ph1": ph1,
                    "volume2": v2,
                    "ph2": ph2,
                    "increase": ph_increase
                })
        
        if violations:
            issues.append(QCIssue(
                sample_id=sample_id,
                status=QCStatus.FAIL,
                rule_code=QCRules.PH_MONOTONIC,
                message=f"pH不单调下降，发现 {len(violations)} 处异常",
                details={
                    "violations": violations,
                    "tolerance": self.ph_monotonic_tolerance
                }
            ))
        
        return issues

    def check_ph_range(self, sample_id: str, readings: List[TitrationReading]) -> List[QCIssue]:
        """
        检查pH范围是否合理
        
        Args:
            sample_id: 样品ID
            readings: 滴定读数列表
            
        Returns:
            质控问题列表
        """
        issues = []
        
        if not readings:
            return issues
        
        ph_values = [r.ph for r in readings]
        min_ph = min(ph_values)
        max_ph = max(ph_values)
        
        # 检查pH是否在合理范围内
        if min_ph < 0 or max_ph > 14:
            issues.append(QCIssue(
                sample_id=sample_id,
                status=QCStatus.ERROR,
                rule_code=QCRules.PH_RANGE,
                message=f"pH值超出合理范围: 范围 [{min_ph:.2f}, {max_ph:.2f}]",
                details={"min_ph": min_ph, "max_ph": max_ph}
            ))
        
        # 检查最低pH是否足够低（用于Gran拟合）
        if min_ph > 5.0:
            issues.append(QCIssue(
                sample_id=sample_id,
                status=QCStatus.WARNING,
                rule_code=QCRules.PH_RANGE,
                message=f"最低pH ({min_ph:.2f}) 可能过高，影响Gran拟合精度",
                details={"min_ph": min_ph, "recommended_max": 5.0}
            ))
        
        return issues

    def check_gran_fit_quality(self, sample_id: str, 
                                r_squared: float,
                                used_points: int) -> List[QCIssue]:
        """
        检查Gran拟合质量
        
        Args:
            sample_id: 样品ID
            r_squared: 决定系数R²
            used_points: 用于拟合的点数
            
        Returns:
            质控问题列表
        """
        issues = []
        
        if r_squared < self.gran_r2_threshold:
            issues.append(QCIssue(
                sample_id=sample_id,
                status=QCStatus.WARNING,
                rule_code=QCRules.GRAN_FIT_QUALITY,
                message=f"Gran拟合R²较低: {r_squared:.4f}",
                details={"r_squared": r_squared, "threshold": self.gran_r2_threshold}
            ))
        
        if used_points < 3:
            issues.append(QCIssue(
                sample_id=sample_id,
                status=QCStatus.FAIL,
                rule_code=QCRules.GRAN_FIT_QUALITY,
                message=f"用于Gran拟合的点数太少: {used_points}",
                details={"used_points": used_points, "minimum": 3}
            ))
        
        return issues

    def check_alkalinity_result(self, result: AlkalinityResult) -> List[QCIssue]:
        """
        检查碱度计算结果
        
        Args:
            result: 碱度计算结果
            
        Returns:
            质控问题列表
        """
        issues = []
        
        # 检查负碱度
        if result.total_alkalinity_mg_l_caco3 < 0:
            issues.append(QCIssue(
                sample_id=result.sample_id,
                status=QCStatus.FAIL,
                rule_code=QCRules.NEGATIVE_ALKALINITY,
                message=f"计算得到负碱度: {result.total_alkalinity_mg_l_caco3:.2f} mg/L",
                details={"alkalinity": result.total_alkalinity_mg_l_caco3}
            ))
        
        # 检查校正后体积
        if result.blank_corrected_volume_ml < 0:
            issues.append(QCIssue(
                sample_id=result.sample_id,
                status=QCStatus.WARNING,
                rule_code=QCRules.NEGATIVE_ALKALINITY,
                message=f"空白校正后体积为负: {result.blank_corrected_volume_ml:.4f} ml",
                details={
                    "sample_volume": result.endpoint_volume_ml,
                    "blank_volume": result.endpoint_volume_ml - result.blank_corrected_volume_ml
                }
            ))
        
        return issues

    def check_sample_qc(self, sample_info: SampleInfo, 
                         titration_data: Optional[SampleTitrationData] = None,
                         alkalinity_result: Optional[AlkalinityResult] = None) -> SampleQCResult:
        """
        执行单个样品的完整质控检查
        
        Args:
            sample_info: 样品信息
            titration_data: 滴定数据（可选）
            alkalinity_result: 碱度计算结果（可选）
            
        Returns:
            样品质控结果
        """
        issues: List[QCIssue] = []
        
        # 检查滴定数据
        if titration_data:
            num_readings = len(titration_data.readings)
            issues.extend(self.check_min_readings(sample_info.sample_id, num_readings))
            
            if num_readings >= 2:
                issues.extend(self.check_ph_monotonicity(sample_info.sample_id, titration_data.readings))
                issues.extend(self.check_ph_range(sample_info.sample_id, titration_data.readings))
        
        # 检查Gran拟合质量
        if alkalinity_result and alkalinity_result.gran_fit:
            issues.extend(self.check_gran_fit_quality(
                sample_info.sample_id,
                alkalinity_result.gran_fit.r_squared,
                alkalinity_result.gran_fit.used_points
            ))
        
        # 检查碱度结果
        if alkalinity_result:
            issues.extend(self.check_alkalinity_result(alkalinity_result))
        
        # 确定整体状态
        status = QCStatus.PASS
        if issues:
            statuses = [i.status for i in issues]
            if QCStatus.ERROR in statuses:
                status = QCStatus.ERROR
            elif QCStatus.FAIL in statuses:
                status = QCStatus.FAIL
            elif QCStatus.WARNING in statuses:
                status = QCStatus.WARNING
        
        return SampleQCResult(
            sample_id=sample_info.sample_id,
            status=status,
            issues=issues
        )

    def check_duplicates(self, sample_results: Dict[str, SampleQCResult],
                         alkalinity_results: Dict[str, AlkalinityResult],
                         sample_infos: Dict[str, SampleInfo]) -> List[DuplicateQCResult]:
        """
        检查平行样的相对偏差
        
        相对偏差(RPD) = |value1 - value2| / ((value1 + value2)/2) × 100%
        
        Args:
            sample_results: 样品质控结果字典
            alkalinity_results: 碱度计算结果字典
            sample_infos: 样品信息字典
            
        Returns:
            平行样质控结果列表
        """
        duplicate_results: List[DuplicateQCResult] = []
        
        # 按parent_sample_id或采样点分组找平行样
        # 策略1: 有parent_sample_id的平行样
        parent_to_duplicates = defaultdict(list)
        for sample_id, info in sample_infos.items():
            if info.is_duplicate and info.parent_sample_id:
                parent_to_duplicates[info.parent_sample_id].append(sample_id)
        
        # 处理显式平行样
        for parent_id, duplicate_ids in parent_to_duplicates.items():
            # 检查parent是否有结果
            if parent_id in alkalinity_results:
                for dup_id in duplicate_ids:
                    if dup_id in alkalinity_results:
                        result = self._calculate_duplicate_rpd(
                            parent_id, dup_id,
                            alkalinity_results[parent_id],
                            alkalinity_results[dup_id],
                            parent_id
                        )
                        duplicate_results.append(result)
        
        # 策略2: 按采样点和瓶号推断平行样（如果没有显式标记）
        # 这里可以扩展为更复杂的逻辑
        
        return duplicate_results

    def _calculate_duplicate_rpd(self, id1: str, id2: str,
                                  result1: AlkalinityResult,
                                  result2: AlkalinityResult,
                                  parent_id: Optional[str] = None) -> DuplicateQCResult:
        """
        计算一对平行样的相对偏差
        
        Args:
            id1: 样品1 ID
            id2: 样品2 ID
            result1: 样品1结果
            result2: 样品2结果
            parent_id: 父样品ID（可选）
            
        Returns:
            平行样质控结果
        """
        issues: List[QCIssue] = []
        
        val1 = result1.total_alkalinity_mg_l_caco3
        val2 = result2.total_alkalinity_mg_l_caco3
        
        # 计算相对偏差
        if val1 == 0 and val2 == 0:
            rpd = 0.0
        elif val1 + val2 == 0:
            rpd = float('inf')
        else:
            rpd = abs(val1 - val2) / ((val1 + val2) / 2) * 100
        
        # 检查是否超过限值
        status = QCStatus.PASS
        if rpd > self.duplicate_rpd_limit:
            status = QCStatus.FAIL
            issues.append(QCIssue(
                sample_id=f"{id1}/{id2}",
                status=QCStatus.FAIL,
                rule_code=QCRules.DUPLICATE_RPD,
                message=f"平行样相对偏差超标: {rpd:.2f}% > {self.duplicate_rpd_limit}%",
                details={
                    "sample1": id1,
                    "sample2": id2,
                    "value1": val1,
                    "value2": val2,
                    "rpd": rpd,
                    "limit": self.duplicate_rpd_limit
                }
            ))
        
        return DuplicateQCResult(
            sample_ids=(id1, id2),
            parent_sample_id=parent_id,
            status=status,
            rpd_percent=rpd,
            rpd_limit=self.duplicate_rpd_limit,
            value1=val1,
            value2=val2,
            issues=issues
        )

    def check_batch_qc(self,
                        sample_infos: Dict[str, SampleInfo],
                        titration_data: Dict[str, SampleTitrationData],
                        alkalinity_results: Dict[str, AlkalinityResult],
                        standard_concentration: Optional[float] = None) -> BatchQCResult:
        """
        执行批次级别的质控检查
        
        Args:
            sample_infos: 样品信息字典
            titration_data: 滴定数据字典
            alkalinity_results: 碱度计算结果字典
            standard_concentration: 标准液浓度（用于检查）
            
        Returns:
            批次质控结果
        """
        sample_results: Dict[str, SampleQCResult] = {}
        all_issues: List[QCIssue] = []
        
        # 检查标准液浓度
        if standard_concentration is None or standard_concentration <= 0:
            all_issues.append(QCIssue(
                sample_id="BATCH",
                status=QCStatus.ERROR,
                rule_code=QCRules.STANDARD_CONCENTRATION,
                message="标准液浓度缺失或无效",
                details={"concentration": standard_concentration}
            ))
        
        # 检查样品编号匹配
        all_sample_ids = set(sample_infos.keys())
        titration_sample_ids = set(titration_data.keys())
        
        missing_titration = all_sample_ids - titration_sample_ids
        extra_titration = titration_sample_ids - all_sample_ids
        
        for sample_id in missing_titration:
            issue = QCIssue(
                sample_id=sample_id,
                status=QCStatus.FAIL,
                rule_code=QCRules.SAMPLE_MISMATCH,
                message="样品在清单中存在但缺少滴定数据",
                details={}
            )
            all_issues.append(issue)
        
        for sample_id in extra_titration:
            issue = QCIssue(
                sample_id=sample_id,
                status=QCStatus.WARNING,
                rule_code=QCRules.SAMPLE_MISMATCH,
                message="滴定数据存在但样品不在清单中",
                details={}
            )
            all_issues.append(issue)
        
        # 检查每个样品
        for sample_id, sample_info in sample_infos.items():
            titration = titration_data.get(sample_id)
            result = alkalinity_results.get(sample_id)
            
            qc_result = self.check_sample_qc(sample_info, titration, result)
            sample_results[sample_id] = qc_result
            all_issues.extend(qc_result.issues)
        
        # 检查平行样
        duplicate_results = self.check_duplicates(
            sample_results, alkalinity_results, sample_infos
        )
        
        # 汇总平行样问题
        for dup_result in duplicate_results:
            all_issues.extend(dup_result.issues)
        
        # 确定整体状态
        overall_status = QCStatus.PASS
        statuses = [i.status for i in all_issues]
        if QCStatus.ERROR in statuses:
            overall_status = QCStatus.ERROR
        elif QCStatus.FAIL in statuses:
            overall_status = QCStatus.FAIL
        elif QCStatus.WARNING in statuses:
            overall_status = QCStatus.WARNING
        
        # 生成摘要
        summary = {
            "total_samples": len(sample_infos),
            "samples_with_titration": len(titration_data),
            "samples_calculated": len(alkalinity_results),
            "pass_count": sum(1 for r in sample_results.values() if r.status == QCStatus.PASS),
            "warning_count": sum(1 for r in sample_results.values() if r.status == QCStatus.WARNING),
            "fail_count": sum(1 for r in sample_results.values() if r.status == QCStatus.FAIL),
            "error_count": sum(1 for r in sample_results.values() if r.status == QCStatus.ERROR),
            "duplicate_pairs": len(duplicate_results),
            "issues_by_rule": defaultdict(int)
        }
        
        for issue in all_issues:
            summary["issues_by_rule"][issue.rule_code] += 1
        
        return BatchQCResult(
            overall_status=overall_status,
            sample_results=sample_results,
            duplicate_results=duplicate_results,
            all_issues=all_issues,
            summary=dict(summary)
        )


def get_qc_status_color(status: QCStatus) -> str:
    """获取质控状态的颜色代码（用于终端输出）"""
    colors = {
        QCStatus.PASS: "green",
        QCStatus.WARNING: "yellow",
        QCStatus.FAIL: "red",
        QCStatus.ERROR: "bright_red",
    }
    return colors.get(status, "white")


def get_qc_status_icon(status: QCStatus) -> str:
    """获取质控状态的图标"""
    icons = {
        QCStatus.PASS: "✓",
        QCStatus.WARNING: "⚠",
        QCStatus.FAIL: "✗",
        QCStatus.ERROR: "✕",
    }
    return icons.get(status, "?")
