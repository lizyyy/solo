import pandas as pd
import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Callable, Tuple
from enum import Enum
from .data_loader import SampleType, LoadedData


class QCStatus(Enum):
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"
    UNKNOWN = "unknown"


@dataclass
class QCFailure:
    sample_id: str
    rule_name: str
    reason: str
    details: Dict[str, Any] = field(default_factory=dict)
    severity: str = "error"


@dataclass
class ControlCheckResult:
    control_type: str
    expected_status: str
    actual_status: str
    passed: bool
    message: str
    ct_value: Optional[float] = None
    threshold: Optional[float] = None


@dataclass
class QCResult:
    overall_status: QCStatus
    sample_results: pd.DataFrame
    control_checks: List[ControlCheckResult]
    failures: List[QCFailure]
    statistics: Dict[str, Any]
    validation_log: List[str]
    plate_heatmap_data: Optional[pd.DataFrame] = None


@dataclass
class QCRule:
    name: str
    description: str
    check_function: Callable
    enabled: bool = True
    severity: str = "error"


class QCValidator:
    DEFAULT_CONFIG = {
        "ct_range": {"min": 10, "max": 40},
        "positive_control_ct": {"min": 15, "max": 30},
        "negative_control_ct_max": 38,
        "duplicate_cv_max": 2.0,
        "outlier_method": "iqr",
        "outlier_iqr_multiplier": 1.5,
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = {**self.DEFAULT_CONFIG, **(config or {})}
        self._rules = self._define_rules()
        self._log: List[str] = []

    def _define_rules(self) -> List[QCRule]:
        return [
            QCRule(
                name="ct_range",
                description="检查Ct值是否在合理范围内",
                check_function=self._check_ct_range,
                severity="error"
            ),
            QCRule(
                name="positive_control_valid",
                description="验证阳性对照Ct值",
                check_function=self._check_positive_controls,
                severity="error"
            ),
            QCRule(
                name="negative_control_clean",
                description="验证阴性对照无扩增",
                check_function=self._check_negative_controls,
                severity="error"
            ),
            QCRule(
                name="blank_control_clean",
                description="验证空白对照无扩增",
                check_function=self._check_blank_controls,
                severity="error"
            ),
            QCRule(
                name="replicate_consistency",
                description="检查技术重复一致性",
                check_function=self._check_replicate_consistency,
                severity="warn"
            ),
            QCRule(
                name="outlier_detection",
                description="检测异常值样本",
                check_function=self._check_outliers,
                severity="warn"
            ),
            QCRule(
                name="plate_integrity",
                description="检查板位完整性",
                check_function=self._check_plate_integrity,
                severity="warn"
            ),
        ]

    def validate(self, loaded_data: LoadedData) -> QCResult:
        df = loaded_data.cleaned_data.copy()
        self._log.append("开始QC验证流程")
        self._log.append(f"待验证样本数: {len(df)}")

        df = self._initialize_qc_columns(df)
        failures: List[QCFailure] = []
        control_checks: List[ControlCheckResult] = []

        for rule in self._rules:
            if not rule.enabled:
                continue
            
            self._log.append(f"执行规则: {rule.name} - {rule.description}")
            rule_failures, rule_control_checks = rule.check_function(df, self.config)
            failures.extend(rule_failures)
            control_checks.extend(rule_control_checks)

        df = self._apply_failures_to_df(df, failures)
        statistics = self._calculate_statistics(df, failures, control_checks)
        overall_status = self._determine_overall_status(statistics)
        plate_heatmap_data = self._generate_plate_heatmap(df)

        self._log.append(f"QC完成 - 总体状态: {overall_status.value}")
        self._log.append(f"失败样本数: {len(failures)}")
        self._log.append(f"对照检查通过: {sum(1 for c in control_checks if c.passed)}/{len(control_checks)}")

        return QCResult(
            overall_status=overall_status,
            sample_results=df,
            control_checks=control_checks,
            failures=failures,
            statistics=statistics,
            validation_log=self._log.copy(),
            plate_heatmap_data=plate_heatmap_data,
        )

    def _initialize_qc_columns(self, df: pd.DataFrame) -> pd.DataFrame:
        df['qc_status'] = QCStatus.PASS.value
        df['qc_fail_reasons'] = ''
        df['qc_details'] = ''
        return df

    def _check_ct_range(self, df: pd.DataFrame, config: Dict) -> Tuple[List[QCFailure], List]:
        failures = []
        ct_min, ct_max = config['ct_range']['min'], config['ct_range']['max']
        
        samples = df[df['sample_type'] == SampleType.SAMPLE]
        
        for idx, row in samples.iterrows():
            ct = row['ct_value']
            if pd.isna(ct):
                continue
            
            if ct < ct_min:
                failures.append(QCFailure(
                    sample_id=row['sample_id'],
                    rule_name="ct_range",
                    reason=f"Ct值过低 ({ct})，低于最小值 {ct_min}",
                    details={"ct_value": ct, "min_threshold": ct_min},
                    severity="error"
                ))
            elif ct > ct_max:
                failures.append(QCFailure(
                    sample_id=row['sample_id'],
                    rule_name="ct_range",
                    reason=f"Ct值过高 ({ct})，高于最大值 {ct_max}",
                    details={"ct_value": ct, "max_threshold": ct_max},
                    severity="error"
                ))

        return failures, []

    def _check_positive_controls(self, df: pd.DataFrame, config: Dict) -> Tuple[List[QCFailure], List[ControlCheckResult]]:
        checks = []
        failures = []
        pc_ct_min, pc_ct_max = config['positive_control_ct']['min'], config['positive_control_ct']['max']
        
        pcs = df[df['sample_type'] == SampleType.POSITIVE_CONTROL]
        
        for idx, row in pcs.iterrows():
            ct = row['ct_value']
            passed = False
            message = ""
            
            if pd.isna(ct):
                message = "阳性对照未检测到扩增"
                failures.append(QCFailure(
                    sample_id=row['sample_id'],
                    rule_name="positive_control_valid",
                    reason=f"阳性对照 {row['sample_id']} 未检测到扩增",
                    details={
                        "expected": f"Ct值在[{pc_ct_min}, {pc_ct_max}]范围内",
                        "actual": "未检出"
                    },
                    severity="error"
                ))
            elif pc_ct_min <= ct <= pc_ct_max:
                passed = True
                message = "阳性对照正常"
            elif ct < pc_ct_min:
                message = f"阳性对照Ct值过低 ({ct})，可能存在过度扩增"
                failures.append(QCFailure(
                    sample_id=row['sample_id'],
                    rule_name="positive_control_valid",
                    reason=f"阳性对照 {row['sample_id']} Ct值过低 ({ct})，低于最小值 {pc_ct_min}",
                    details={
                        "ct_value": ct,
                        "min_threshold": pc_ct_min,
                        "max_threshold": pc_ct_max
                    },
                    severity="error"
                ))
            else:
                message = f"阳性对照Ct值过高 ({ct})，可能存在扩增效率问题"
                failures.append(QCFailure(
                    sample_id=row['sample_id'],
                    rule_name="positive_control_valid",
                    reason=f"阳性对照 {row['sample_id']} Ct值过高 ({ct})，高于最大值 {pc_ct_max}",
                    details={
                        "ct_value": ct,
                        "min_threshold": pc_ct_min,
                        "max_threshold": pc_ct_max
                    },
                    severity="error"
                ))
            
            checks.append(ControlCheckResult(
                control_type="positive_control",
                expected_status=f"Ct值在[{pc_ct_min}, {pc_ct_max}]范围内",
                actual_status=f"Ct值: {ct if not pd.isna(ct) else '未检出'}",
                passed=passed,
                message=message,
                ct_value=ct,
                threshold=f"{pc_ct_min}-{pc_ct_max}"
            ))

        return failures, checks

    def _check_negative_controls(self, df: pd.DataFrame, config: Dict) -> Tuple[List[QCFailure], List[ControlCheckResult]]:
        checks = []
        failures = []
        nc_max = config['negative_control_ct_max']
        
        ncs = df[df['sample_type'] == SampleType.NEGATIVE_CONTROL]
        
        for idx, row in ncs.iterrows():
            ct = row['ct_value']
            passed = False
            message = ""
            
            if pd.isna(ct):
                passed = True
                message = "阴性对照无扩增，正常"
            elif ct >= nc_max:
                passed = True
                message = f"阴性对照Ct值 ({ct}) 大于阈值 {nc_max}，可接受"
            else:
                message = f"阴性对照Ct值 ({ct}) 低于阈值 {nc_max}，存在污染风险"
                failures.append(QCFailure(
                    sample_id=row['sample_id'],
                    rule_name="negative_control_clean",
                    reason=f"阴性对照 {row['sample_id']} Ct值 ({ct}) 低于阈值 {nc_max}，存在污染风险",
                    details={
                        "ct_value": ct,
                        "threshold": nc_max
                    },
                    severity="error"
                ))
            
            checks.append(ControlCheckResult(
                control_type="negative_control",
                expected_status=f"无扩增或Ct值 >= {nc_max}",
                actual_status=f"Ct值: {ct if not pd.isna(ct) else '未检出'}",
                passed=passed,
                message=message,
                ct_value=ct,
                threshold=f">={nc_max}"
            ))

        return failures, checks

    def _check_blank_controls(self, df: pd.DataFrame, config: Dict) -> Tuple[List[QCFailure], List[ControlCheckResult]]:
        checks = []
        failures = []
        
        blanks = df[df['sample_type'] == SampleType.BLANK]
        
        for idx, row in blanks.iterrows():
            ct = row['ct_value']
            passed = pd.isna(ct)
            message = "空白对照无扩增，正常" if passed else f"空白对照检测到扩增 (Ct={ct})，存在严重污染"
            
            if not passed:
                failures.append(QCFailure(
                    sample_id=row['sample_id'],
                    rule_name="blank_control_clean",
                    reason=f"空白对照 {row['sample_id']} 检测到扩增 (Ct={ct})，存在严重污染",
                    details={
                        "ct_value": ct,
                        "expected": "无扩增"
                    },
                    severity="error"
                ))
            
            checks.append(ControlCheckResult(
                control_type="blank",
                expected_status="无扩增",
                actual_status=f"Ct值: {ct if not pd.isna(ct) else '未检出'}",
                passed=passed,
                message=message,
                ct_value=ct,
                threshold="无"
            ))

        return failures, checks

    def _check_replicate_consistency(self, df: pd.DataFrame, config: Dict) -> Tuple[List[QCFailure], List]:
        failures = []
        cv_max = config['duplicate_cv_max']
        
        samples = df[df['sample_type'] == SampleType.SAMPLE]
        
        if 'sample_id' not in samples.columns:
            return failures, []
        
        replicate_groups = samples.groupby('sample_id')
        
        for sample_id, group in replicate_groups:
            if len(group) < 2:
                continue
            
            cts = group['ct_value'].dropna()
            
            if len(cts) < 2:
                continue
            
            mean_ct = cts.mean()
            std_ct = cts.std()
            
            if mean_ct == 0:
                continue
            
            cv = (std_ct / mean_ct) * 100
            
            if cv > cv_max:
                failures.append(QCFailure(
                    sample_id=sample_id,
                    rule_name="replicate_consistency",
                    reason=f"技术重复CV值 ({cv:.2f}%) 超过阈值 {cv_max}%",
                    details={
                        "replicate_count": len(cts),
                        "mean_ct": mean_ct,
                        "std_ct": std_ct,
                        "cv": cv,
                        "cv_threshold": cv_max
                    },
                    severity="warn"
                ))

        return failures, []

    def _check_outliers(self, df: pd.DataFrame, config: Dict) -> Tuple[List[QCFailure], List]:
        failures = []
        
        samples = df[df['sample_type'] == SampleType.SAMPLE]
        cts = samples['ct_value'].dropna()
        
        if len(cts) < 5:
            return failures, []
        
        q1 = cts.quantile(0.25)
        q3 = cts.quantile(0.75)
        iqr = q3 - q1
        multiplier = config['outlier_iqr_multiplier']
        lower_bound = q1 - multiplier * iqr
        upper_bound = q3 + multiplier * iqr
        
        outliers = samples[
            (samples['ct_value'] < lower_bound) | 
            (samples['ct_value'] > upper_bound)
        ]
        
        for idx, row in outliers.iterrows():
            ct = row['ct_value']
            is_high = ct > upper_bound
            
            failures.append(QCFailure(
                sample_id=row['sample_id'],
                rule_name="outlier_detection",
                reason=f"{'高' if is_high else '低'}异常值Ct值: {ct}",
                details={
                    "ct_value": ct,
                    "lower_bound": lower_bound,
                    "upper_bound": upper_bound,
                    "method": "IQR"
                },
                severity="warn"
            ))

        return failures, []

    def _check_plate_integrity(self, df: pd.DataFrame, config: Dict) -> Tuple[List[QCFailure], List]:
        failures = []
        
        if 'well' not in df.columns:
            return failures, []
        
        rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        cols = list(range(1, 13))
        expected_wells = set(f"{r}{c}" for r in rows for c in cols)
        
        actual_wells = set(df['well'].astype(str).str.strip())
        
        total_expected = len(expected_wells)
        total_actual = len(actual_wells)
        missing_wells = expected_wells - actual_wells
        
        if total_actual >= total_expected * 0.5 and missing_wells:
            failures.append(QCFailure(
                sample_id="PLATE",
                rule_name="plate_integrity",
                reason=f"板位不完整，缺少 {len(missing_wells)} 个孔位",
                details={"missing_wells": sorted(list(missing_wells))},
                severity="warn"
            ))

        return failures, []

    def _apply_failures_to_df(self, df: pd.DataFrame, failures: List[QCFailure]) -> pd.DataFrame:
        for failure in failures:
            if failure.sample_id == "PLATE":
                continue
            
            mask = df['sample_id'] == failure.sample_id
            
            current_status = df.loc[mask, 'qc_status'].iloc[0] if mask.any() else QCStatus.PASS.value
            
            new_status = (
                QCStatus.FAIL.value if failure.severity == 'error' else QCStatus.WARN.value
            )
            
            status_priority = {
                QCStatus.FAIL.value: 3,
                QCStatus.WARN.value: 2,
                QCStatus.PASS.value: 1,
                QCStatus.UNKNOWN.value: 0
            }
            
            if status_priority.get(new_status, 0) > status_priority.get(current_status, 0):
                df.loc[mask, 'qc_status'] = new_status
            
            existing_reasons = df.loc[mask, 'qc_fail_reasons'].iloc[0] if mask.any() else ''
            if failure.reason not in existing_reasons:
                df.loc[mask, 'qc_fail_reasons'] = df.loc[mask, 'qc_fail_reasons'].apply(
                    lambda x: x + '; ' + failure.reason if x else failure.reason
                )
            
            existing_details = df.loc[mask, 'qc_details'].iloc[0] if mask.any() else ''
            details_str = str(failure.details)
            if details_str not in existing_details:
                df.loc[mask, 'qc_details'] = df.loc[mask, 'qc_details'].apply(
                    lambda x: x + '; ' + details_str if x else details_str
                )

        return df

    def _calculate_statistics(self, df: pd.DataFrame, failures: List[QCFailure], 
                            control_checks: List[ControlCheckResult]) -> Dict[str, Any]:
        samples = df[df['sample_type'] == SampleType.SAMPLE]
        cts = samples['ct_value'].dropna()
        
        return {
            "total_samples": len(df),
            "valid_samples": len(samples),
            "pass_samples": len(samples[samples['qc_status'] == QCStatus.PASS.value]),
            "warn_samples": len(samples[samples['qc_status'] == QCStatus.WARN.value]),
            "fail_samples": len(samples[samples['qc_status'] == QCStatus.FAIL.value]),
            "positive_controls": {
                "count": len(df[df['sample_type'] == SampleType.POSITIVE_CONTROL]),
                "passed": sum(1 for c in control_checks if c.control_type == 'positive_control' and c.passed),
            },
            "negative_controls": {
                "count": len(df[df['sample_type'] == SampleType.NEGATIVE_CONTROL]),
                "passed": sum(1 for c in control_checks if c.control_type == 'negative_control' and c.passed),
            },
            "blank_controls": {
                "count": len(df[df['sample_type'] == SampleType.BLANK]),
                "passed": sum(1 for c in control_checks if c.control_type == 'blank' and c.passed),
            },
            "ct_statistics": {
                "mean": float(cts.mean()) if len(cts) > 0 else None,
                "median": float(cts.median()) if len(cts) > 0 else None,
                "std": float(cts.std()) if len(cts) > 0 else None,
                "min": float(cts.min()) if len(cts) > 0 else None,
                "max": float(cts.max()) if len(cts) > 0 else None,
                "count": len(cts),
            },
            "total_failures": len(failures),
            "error_failures": sum(1 for f in failures if f.severity == 'error'),
            "warning_failures": sum(1 for f in failures if f.severity == 'warn'),
        }

    def _determine_overall_status(self, stats: Dict[str, Any]) -> QCStatus:
        pc = stats['positive_controls']
        nc = stats['negative_controls']
        blank = stats['blank_controls']
        
        if pc['count'] > 0 and pc['passed'] < pc['count']:
            return QCStatus.FAIL
        
        if nc['count'] > 0 and nc['passed'] < nc['count']:
            return QCStatus.FAIL
        
        if blank['count'] > 0 and blank['passed'] < blank['count']:
            return QCStatus.FAIL
        
        if stats['error_failures'] > 0:
            return QCStatus.FAIL
        
        if stats['warning_failures'] > 0:
            return QCStatus.WARN
        
        return QCStatus.PASS

    def _generate_plate_heatmap(self, df: pd.DataFrame) -> Optional[pd.DataFrame]:
        if 'well' not in df.columns or 'ct_value' not in df.columns:
            return None
        
        rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
        cols = list(range(1, 13))
        
        heatmap = pd.DataFrame(
            index=rows,
            columns=[str(c) for c in cols],
            data=np.nan
        )
        
        for idx, row in df.iterrows():
            well = str(row['well']).strip()
            if len(well) < 2:
                continue
            
            r = well[0].upper()
            c = well[1:]
            
            if r in heatmap.index and c in heatmap.columns:
                heatmap.loc[r, c] = row['ct_value']

        return heatmap
