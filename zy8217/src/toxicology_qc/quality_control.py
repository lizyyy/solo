"""
质量控制分析模块
"""

from typing import Dict, List, Any, Tuple
from collections import defaultdict
from datetime import datetime, timedelta
import numpy as np

from .models import (
    InjectionRecord,
    SampleType,
    QCIssue,
    QCIssueType,
    BatchData,
    CalibrationCurve,
)
from .calibration import calculate_concentration, is_above_lod, is_above_loq


def analyze_internal_standard_drift(
    batch_data: BatchData,
    calibration_config: Dict[str, Any],
    max_drift_percent: float = 20.0,
) -> Tuple[Dict[str, Dict[str, float]], List[QCIssue]]:
    drift_data = defaultdict(dict)
    issues = []
    
    compounds_config = calibration_config.get("compounds", {})
    is_names = set()
    for compound_config in compounds_config.values():
        is_name = compound_config.get("internal_standard")
        if is_name:
            is_names.add(is_name)
    
    all_injections = batch_data.run_sequence
    if not all_injections:
        return {}, []
    
    reference_injections = []
    for inj in all_injections:
        if inj.sample_type == SampleType.CALIBRATOR or inj.sample_type == SampleType.QC:
            reference_injections.append(inj)
    
    if not reference_injections:
        reference_injections = all_injections
    
    for is_name in is_names:
        is_areas = []
        for inj in reference_injections:
            area = inj.internal_standard_area.get(
                is_name,
                inj.peak_data.get(is_name, 0.0)
            )
            if area > 0:
                is_areas.append(area)
        
        if not is_areas:
            continue
        
        baseline_area = np.mean(is_areas)
        
        for idx, injection in enumerate(all_injections):
            current_area = injection.internal_standard_area.get(
                is_name,
                injection.peak_data.get(is_name, 0.0)
            )
            
            if current_area <= 0:
                drift_percent = 100.0
            else:
                drift_percent = abs((current_area - baseline_area) / baseline_area) * 100
            
            drift_data[injection.sample_id][is_name] = drift_percent
            
            if current_area <= 0:
                issues.append(QCIssue(
                    issue_type=QCIssueType.INTERNAL_STANDARD_MISSING,
                    severity="high",
                    sample_ids=[injection.sample_id],
                    description=f"样本 {injection.sample_id} 内标 {is_name} 峰面积为0或缺失",
                    details={
                        "sample_id": injection.sample_id,
                        "internal_standard": is_name,
                        "injection_index": idx,
                    },
                ))
            elif drift_percent > max_drift_percent:
                issues.append(QCIssue(
                    issue_type=QCIssueType.INTERNAL_STANDARD_DRIFT,
                    severity="medium",
                    sample_ids=[injection.sample_id],
                    description=f"样本 {injection.sample_id} 内标 {is_name} 漂移 {drift_percent:.1f}% > {max_drift_percent}%",
                    details={
                        "sample_id": injection.sample_id,
                        "internal_standard": is_name,
                        "drift_percent": drift_percent,
                        "max_allowed": max_drift_percent,
                        "baseline_area": baseline_area,
                        "current_area": current_area,
                        "injection_index": idx,
                    },
                ))
    
    return dict(drift_data), issues


def analyze_qc_samples(
    batch_data: BatchData,
    calibration_curves: Dict[str, CalibrationCurve],
    calibration_config: Dict[str, Any],
    max_deviation_percent: float = 15.0,
) -> Tuple[Dict[str, Dict[str, float]], List[QCIssue]]:
    qc_deviations = defaultdict(dict)
    issues = []
    
    qc_samples = batch_data.get_samples_by_type(SampleType.QC)
    qc_configs = calibration_config.get("qc_samples", {})
    
    for qc_sample in qc_samples:
        for compound_name, curve in calibration_curves.items():
            qc_expected = None
            
            for qc_config_name, qc_config in qc_configs.items():
                if qc_config_name.lower() in qc_sample.sample_id.lower():
                    qc_expected = qc_config.get("expected_concentration", {}).get(compound_name)
                    break
            
            if qc_expected is None:
                continue
            
            peak_area = qc_sample.peak_data.get(compound_name, 0.0)
            is_area = qc_sample.internal_standard_area.get(
                curve.internal_standard,
                qc_sample.peak_data.get(curve.internal_standard, 0.0)
            )
            
            calculated_conc = calculate_concentration(peak_area, is_area, curve)
            
            if qc_expected > 0:
                deviation_percent = abs((calculated_conc - qc_expected) / qc_expected) * 100
            else:
                deviation_percent = 100.0 if calculated_conc > 0 else 0.0
            
            qc_deviations[qc_sample.sample_id][compound_name] = deviation_percent
            
            if deviation_percent > max_deviation_percent:
                issues.append(QCIssue(
                    issue_type=QCIssueType.QC_OUT_OF_RANGE,
                    severity="medium",
                    sample_ids=[qc_sample.sample_id],
                    description=f"质控样 {qc_sample.sample_id} 化合物 {compound_name} 偏差 {deviation_percent:.1f}% > {max_deviation_percent}%",
                    details={
                        "sample_id": qc_sample.sample_id,
                        "compound": compound_name,
                        "expected": qc_expected,
                        "calculated": calculated_conc,
                        "deviation_percent": deviation_percent,
                        "max_allowed": max_deviation_percent,
                    },
                ))
    
    return dict(qc_deviations), issues


def analyze_lod_loq_hits(
    batch_data: BatchData,
    calibration_curves: Dict[str, CalibrationCurve],
) -> List[QCIssue]:
    issues = []
    
    unknown_samples = [
        inj for inj in batch_data.run_sequence
        if inj.sample_type == SampleType.UNKNOWN
    ]
    
    for sample in unknown_samples:
        for compound_name, curve in calibration_curves.items():
            peak_area = sample.peak_data.get(compound_name, 0.0)
            is_area = sample.internal_standard_area.get(
                curve.internal_standard,
                sample.peak_data.get(curve.internal_standard, 0.0)
            )
            
            if peak_area <= 0 or is_area <= 0:
                continue
            
            concentration = calculate_concentration(peak_area, is_area, curve)
            
            if is_above_loq(concentration, curve):
                issues.append(QCIssue(
                    issue_type=QCIssueType.LOQ_HIT,
                    severity="low",
                    sample_ids=[sample.sample_id],
                    description=f"样本 {sample.sample_id} 化合物 {compound_name} 定量检出: {concentration:.4f} ng/mL",
                    details={
                        "sample_id": sample.sample_id,
                        "compound": compound_name,
                        "concentration": concentration,
                        "loq": curve.loq,
                        "lod": curve.lod,
                        "peak_area": peak_area,
                        "internal_standard_area": is_area,
                    },
                ))
            elif is_above_lod(concentration, curve):
                issues.append(QCIssue(
                    issue_type=QCIssueType.LOD_HIT,
                    severity="low",
                    sample_ids=[sample.sample_id],
                    description=f"样本 {sample.sample_id} 化合物 {compound_name} 定性检出: {concentration:.4f} ng/mL (低于LOQ)",
                    details={
                        "sample_id": sample.sample_id,
                        "compound": compound_name,
                        "concentration": concentration,
                        "loq": curve.loq,
                        "lod": curve.lod,
                        "peak_area": peak_area,
                        "internal_standard_area": is_area,
                    },
                ))
    
    return issues


def run_quality_control_analysis(
    batch_data: BatchData,
    calibration_curves: Dict[str, CalibrationCurve],
    calibration_config: Dict[str, Any],
) -> BatchData:
    max_is_drift = calibration_config.get("qc_parameters", {}).get("max_internal_standard_drift_percent", 20.0)
    max_qc_deviation = calibration_config.get("qc_parameters", {}).get("max_qc_deviation_percent", 15.0)
    
    is_drift, is_issues = analyze_internal_standard_drift(
        batch_data, calibration_config, max_is_drift
    )
    batch_data.internal_standard_drift = is_drift
    batch_data.qc_issues.extend(is_issues)
    
    qc_dev, qc_issues = analyze_qc_samples(
        batch_data, calibration_curves, calibration_config, max_qc_deviation
    )
    batch_data.qc_deviations = qc_dev
    batch_data.qc_issues.extend(qc_issues)
    
    lod_loq_issues = analyze_lod_loq_hits(batch_data, calibration_curves)
    batch_data.qc_issues.extend(lod_loq_issues)
    
    return batch_data
