"""规则引擎 - 分析 qPCR 结果"""
import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from enum import Enum

from .parser import Well, ControlConfig


class CallStatus(Enum):
    """检测结果状态"""
    POSITIVE = "positive"
    NEGATIVE = "negative"
    INDETERMINATE = "indeterminate"
    MISSING = "missing"


class RiskLevel(Enum):
    """风险等级"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


@dataclass
class ReplicateGroup:
    """重复孔组（同一样本同一靶标）"""
    sample_id: str
    target: str
    wells: List[Well] = field(default_factory=list)
    ct_values: List[float] = field(default_factory=list)
    ct_mean: Optional[float] = None
    ct_std: Optional[float] = None
    outlier_wells: List[Well] = field(default_factory=list)
    valid_wells: List[Well] = field(default_factory=list)
    call_status: CallStatus = CallStatus.INDETERMINATE
    issues: List[str] = field(default_factory=list)


@dataclass
class ControlResult:
    """对照结果"""
    control_type: str
    sample_id: str
    target: str
    wells: List[Well] = field(default_factory=list)
    ct_mean: Optional[float] = None
    passed: bool = False
    issues: List[str] = field(default_factory=list)


@dataclass
class RiskAssessment:
    """风险评估"""
    contamination_risk: RiskLevel = RiskLevel.LOW
    inhibition_risk: RiskLevel = RiskLevel.LOW
    contamination_details: List[str] = field(default_factory=list)
    inhibition_details: List[str] = field(default_factory=list)


@dataclass
class ReviewResult:
    """复核结果"""
    replicate_groups: Dict[str, ReplicateGroup] = field(default_factory=dict)
    positive_controls: List[ControlResult] = field(default_factory=list)
    negative_controls: List[ControlResult] = field(default_factory=list)
    ntc_controls: List[ControlResult] = field(default_factory=list)
    risk_assessment: RiskAssessment = field(default_factory=RiskAssessment)
    all_issues: List[Dict] = field(default_factory=list)
    wells: Dict[str, Well] = field(default_factory=dict)


def group_replicates(wells: Dict[str, Well]) -> Dict[str, ReplicateGroup]:
    """
    按样本和靶标分组重复孔
    """
    groups = {}
    
    for well in wells.values():
        key = f"{well.sample_id}|{well.target}"
        
        if key not in groups:
            groups[key] = ReplicateGroup(
                sample_id=well.sample_id,
                target=well.target
            )
        
        groups[key].wells.append(well)
    
    return groups


def identify_outliers(values: List[float], tolerance: float) -> Tuple[List[int], List[int]]:
    """
    识别离群值
    使用 IQR 方法或相对偏差方法
    返回 (离群值索引列表, 有效值索引列表)
    """
    if len(values) < 2:
        return [], [0]
    
    values_array = np.array(values)
    
    median = np.median(values_array)
    
    abs_deviations = np.abs(values_array - median)
    
    outlier_indices = []
    valid_indices = []
    
    for i, dev in enumerate(abs_deviations):
        if dev > tolerance:
            outlier_indices.append(i)
        else:
            valid_indices.append(i)
    
    if len(valid_indices) == 0:
        outlier_indices = [np.argmax(abs_deviations)]
        valid_indices = [i for i in range(len(values)) if i not in outlier_indices]
    
    return outlier_indices, valid_indices


def analyze_replicate_group(group: ReplicateGroup, config: ControlConfig) -> None:
    """
    分析单个重复孔组
    """
    ct_values = []
    missing_count = 0
    
    for well in group.wells:
        if well.ct_missing or well.ct_value is None:
            missing_count += 1
        else:
            ct_values.append(well.ct_value)
    
    group.ct_values = ct_values
    
    total_wells = len(group.wells)
    
    if missing_count == total_wells:
        group.call_status = CallStatus.MISSING
        group.issues.append(f"所有 {total_wells} 个重复孔的 Ct 值均缺失")
        group.valid_wells = []
        group.outlier_wells = group.wells.copy()
        return
    
    if len(ct_values) >= 2:
        outlier_indices, valid_indices = identify_outliers(
            ct_values, config.replicate_tolerance
        )
        
        valid_ct_values = [ct_values[i] for i in valid_indices]
        
        group.valid_wells = [
            w for i, w in enumerate([well for well in group.wells if not well.ct_missing])
            if i in valid_indices
        ]
        group.outlier_wells = [
            w for i, w in enumerate([well for well in group.wells if not well.ct_missing])
            if i in outlier_indices
        ]
        
        for well in group.wells:
            if well.ct_missing:
                group.outlier_wells.append(well)
        
        if outlier_indices:
            outlier_well_ids = [group.outlier_wells[i].well_id for i in range(len(outlier_indices))]
            group.issues.append(
                f"检测到离群孔: {', '.join(outlier_well_ids)}。"
                f"有效孔 Ct 值范围: {min(valid_ct_values):.2f} - {max(valid_ct_values):.2f}"
            )
        
        if valid_ct_values:
            group.ct_mean = np.mean(valid_ct_values)
            group.ct_std = np.std(valid_ct_values) if len(valid_ct_values) > 1 else 0.0
        else:
            group.ct_mean = None
            group.ct_std = None
    elif len(ct_values) == 1:
        group.ct_mean = ct_values[0]
        group.ct_std = 0.0
        group.valid_wells = [w for w in group.wells if not w.ct_missing]
        group.outlier_wells = [w for w in group.wells if w.ct_missing]
        
        if missing_count > 0:
            group.issues.append(f"仅1个有效孔，其余 {missing_count} 个孔 Ct 值缺失")
    else:
        group.valid_wells = []
        group.outlier_wells = group.wells.copy()
    
    if group.ct_mean is not None:
        if group.ct_mean <= config.ct_cutoff:
            group.call_status = CallStatus.POSITIVE
        else:
            group.call_status = CallStatus.NEGATIVE
    else:
        if missing_count == total_wells:
            group.call_status = CallStatus.MISSING
        else:
            group.call_status = CallStatus.INDETERMINATE
            group.issues.append("由于 Ct 值缺失或离群，无法确定结果")


def analyze_controls(
    wells: Dict[str, Well],
    config: ControlConfig
) -> Tuple[List[ControlResult], List[ControlResult], List[ControlResult]]:
    """
    分析对照（阳性、阴性、NTC）
    """
    positive_controls = []
    negative_controls = []
    ntc_controls = []
    
    def analyze_control_type(sample_ids: List[str], control_type: str) -> List[ControlResult]:
        results = []
        
        for sample_id in sample_ids:
            target_groups = {}
            
            for well in wells.values():
                if well.sample_id == sample_id:
                    target = well.target
                    if target not in target_groups:
                        target_groups[target] = []
                    target_groups[target].append(well)
            
            for target, target_wells in target_groups.items():
                result = ControlResult(
                    control_type=control_type,
                    sample_id=sample_id,
                    target=target,
                    wells=target_wells
                )
                
                ct_values = []
                for w in target_wells:
                    if not w.ct_missing and w.ct_value is not None:
                        ct_values.append(w.ct_value)
                
                if ct_values:
                    result.ct_mean = np.mean(ct_values)
                
                if control_type == "positive":
                    if result.ct_mean is not None and result.ct_mean <= config.ct_cutoff:
                        result.passed = True
                    else:
                        result.passed = False
                        result.issues.append("阳性对照未检出或 Ct 值过高")
                
                elif control_type == "negative":
                    if result.ct_mean is None or result.ct_mean > config.ct_cutoff:
                        result.passed = True
                    else:
                        result.passed = False
                        result.issues.append(f"阴性对照检出阳性 (Ct={result.ct_mean:.2f})，可能存在污染")
                
                elif control_type == "ntc":
                    if result.ct_mean is None or result.ct_mean > config.ct_cutoff:
                        result.passed = True
                    else:
                        result.passed = False
                        result.issues.append(f"NTC 检出阳性 (Ct={result.ct_mean:.2f})，存在严重污染风险")
                
                results.append(result)
        
        return results
    
    positive_controls = analyze_control_type(config.positive_controls, "positive")
    negative_controls = analyze_control_type(config.negative_controls, "negative")
    ntc_controls = analyze_control_type(config.ntc_controls, "ntc")
    
    return positive_controls, negative_controls, ntc_controls


def assess_risk(
    replicate_groups: Dict[str, ReplicateGroup],
    positive_controls: List[ControlResult],
    negative_controls: List[ControlResult],
    ntc_controls: List[ControlResult],
    config: ControlConfig
) -> RiskAssessment:
    """
    评估污染和抑制风险
    """
    risk = RiskAssessment()
    
    for ntc in ntc_controls:
        if not ntc.passed:
            risk.contamination_risk = RiskLevel.HIGH
            risk.contamination_details.extend(ntc.issues)
    
    for neg in negative_controls:
        if not neg.passed:
            if risk.contamination_risk != RiskLevel.HIGH:
                risk.contamination_risk = RiskLevel.MEDIUM
            risk.contamination_details.extend(neg.issues)
    
    pos_count = 0
    pos_passed = 0
    for pos in positive_controls:
        pos_count += 1
        if pos.passed:
            pos_passed += 1
    
    if pos_count > 0 and pos_passed < pos_count:
        risk.inhibition_risk = RiskLevel.MEDIUM
        risk.inhibition_details.append(
            f"阳性对照通过率: {pos_passed}/{pos_count}。部分阳性对照未检出，可能存在抑制"
        )
    
    for key, group in replicate_groups.items():
        is_control = False
        for ctrl_list in [positive_controls, negative_controls, ntc_controls]:
            for ctrl in ctrl_list:
                if ctrl.sample_id == group.sample_id and ctrl.target == group.target:
                    is_control = True
                    break
            if is_control:
                break
        
        if is_control:
            continue
        
        if group.call_status == CallStatus.MISSING:
            if group.sample_id not in [c.sample_id for c in positive_controls]:
                if risk.inhibition_risk == RiskLevel.LOW:
                    risk.inhibition_risk = RiskLevel.MEDIUM
                risk.inhibition_details.append(
                    f"样本 {group.sample_id} (靶标: {group.target}) 所有重复孔 Ct 值缺失"
                )
    
    return risk


def collect_all_issues(
    replicate_groups: Dict[str, ReplicateGroup],
    positive_controls: List[ControlResult],
    negative_controls: List[ControlResult],
    ntc_controls: List[ControlResult],
    risk_assessment: RiskAssessment
) -> List[Dict]:
    """
    收集所有问题，用于生成 issues.csv
    """
    issues = []
    
    for key, group in replicate_groups.items():
        for issue in group.issues:
            issues.append({
                "category": "sample",
                "sample_id": group.sample_id,
                "target": group.target,
                "wells": ",".join([w.well_id for w in group.wells]),
                "severity": "warning" if "离群" in issue else "error",
                "message": issue
            })
    
    for ctrl_list, ctrl_type in [
        (positive_controls, "positive_control"),
        (negative_controls, "negative_control"),
        (ntc_controls, "ntc_control")
    ]:
        for ctrl in ctrl_list:
            for issue in ctrl.issues:
                issues.append({
                    "category": ctrl_type,
                    "sample_id": ctrl.sample_id,
                    "target": ctrl.target,
                    "wells": ",".join([w.well_id for w in ctrl.wells]),
                    "severity": "error" if not ctrl.passed else "warning",
                    "message": issue
                })
    
    for detail in risk_assessment.contamination_details:
        issues.append({
            "category": "contamination_risk",
            "sample_id": "",
            "target": "",
            "wells": "",
            "severity": "error" if risk_assessment.contamination_risk == RiskLevel.HIGH else "warning",
            "message": detail
        })
    
    for detail in risk_assessment.inhibition_details:
        issues.append({
            "category": "inhibition_risk",
            "sample_id": "",
            "target": "",
            "wells": "",
            "severity": "error" if risk_assessment.inhibition_risk == RiskLevel.HIGH else "warning",
            "message": detail
        })
    
    return issues


def run_analysis(
    wells: Dict[str, Well],
    config: ControlConfig
) -> ReviewResult:
    """
    执行完整的分析流程
    """
    result = ReviewResult()
    result.wells = wells
    
    replicate_groups = group_replicates(wells)
    for key, group in replicate_groups.items():
        analyze_replicate_group(group, config)
    result.replicate_groups = replicate_groups
    
    pos_controls, neg_controls, ntc_controls = analyze_controls(wells, config)
    result.positive_controls = pos_controls
    result.negative_controls = neg_controls
    result.ntc_controls = ntc_controls
    
    risk = assess_risk(
        replicate_groups, pos_controls, neg_controls, ntc_controls, config
    )
    result.risk_assessment = risk
    
    all_issues = collect_all_issues(
        replicate_groups, pos_controls, neg_controls, ntc_controls, risk
    )
    result.all_issues = all_issues
    
    return result
