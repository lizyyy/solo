"""质量控制和异常检测模块。"""

import pandas as pd
import numpy as np
from scipy import stats
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, asdict
from .config import AnalysisConfig
from .logger import AnalysisLogger, ErrorType


@dataclass
class QCIssue:
    """质控问题记录。"""
    battery_id: str
    issue_type: str
    description: str
    cycle_number: Optional[int] = None
    value: Optional[float] = None
    severity: str = "warning"


@dataclass
class QCReport:
    """质控报告。"""
    total_samples: int
    passed_samples: int
    failed_samples: int
    warning_samples: int
    issues: List[QCIssue]
    by_type: Dict[str, int]


class QualityControl:
    """质量控制器。"""
    
    def __init__(self, config: AnalysisConfig, logger: Optional[AnalysisLogger] = None):
        self.config = config
        self.logger = logger or AnalysisLogger(
            log_to_file=config.log_to_file,
            log_file=config.log_file,
            log_level=config.log_level
        )
        self.qc_rules = config.qc_rules
    
    def run_qc(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, QCReport]:
        """
        执行完整的质量控制流程。
        """
        if df is None or len(df) == 0:
            self.logger.error("质控", "输入数据为空")
            return pd.DataFrame(), QCReport(0, 0, 0, 0, [], {})
        
        df = df.copy()
        issues: List[QCIssue] = []
        
        self.logger.info("质控", "开始质量控制检查")
        
        if self.qc_rules.get('duplicate_detection', True):
            df, dup_issues = self._detect_duplicates(df)
            issues.extend(dup_issues)
        
        min_cycles = self.qc_rules.get('min_cycles_required', 10)
        df, cycle_issues = self._check_min_cycles(df, min_cycles)
        issues.extend(cycle_issues)
        
        df, cap_issues = self._validate_capacity_range(df)
        issues.extend(cap_issues)
        
        df, outlier_issues = self._detect_outliers(df)
        issues.extend(outlier_issues)
        
        df, drop_issues = self._check_capacity_drop(df)
        issues.extend(drop_issues)
        
        qc_report = self._generate_qc_report(df, issues)
        
        self.logger.info(
            "质控",
            f"质控完成: 通过 {qc_report.passed_samples}, "
            f"警告 {qc_report.warning_samples}, 失败 {qc_report.failed_samples}"
        )
        
        return df, qc_report
    
    def _detect_duplicates(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[QCIssue]]:
        """检测重复数据。"""
        issues = []
        removed_indices = []
        
        if 'battery_id' in df.columns and 'cycle' in df.columns:
            duplicates = df.duplicated(subset=['battery_id', 'cycle'], keep='first')
            duplicate_count = duplicates.sum()
            
            if duplicate_count > 0:
                for idx, row in df[duplicates].iterrows():
                    battery_id = str(row.get('battery_id', 'Unknown'))
                    cycle = row.get('cycle')
                    
                    issue = QCIssue(
                        battery_id=battery_id,
                        issue_type=ErrorType.DUPLICATE.value,
                        description=f"发现重复的循环记录",
                        cycle_number=int(cycle) if pd.notna(cycle) else None,
                        value=float(row.get('capacity', np.nan)) if pd.notna(row.get('capacity')) else None,
                        severity="error"
                    )
                    issues.append(issue)
                    removed_indices.append(idx)
                    
                    self.logger.log_sample_failure(
                        battery_id,
                        ErrorType.DUPLICATE,
                        "发现重复的循环记录",
                        cycle_number=int(cycle) if pd.notna(cycle) else None
                    )
                
                df = df.drop(index=removed_indices).reset_index(drop=True)
                self.logger.warning(
                    "质控",
                    f"检测到并移除 {duplicate_count} 条重复记录"
                )
        
        return df, issues
    
    def _check_min_cycles(self, df: pd.DataFrame, min_cycles: int) -> Tuple[pd.DataFrame, List[QCIssue]]:
        """检查最小循环次数要求。"""
        issues = []
        valid_batteries = []
        
        for battery_id, group in df.groupby('battery_id'):
            cycle_count = len(group)
            
            if cycle_count < min_cycles:
                issue = QCIssue(
                    battery_id=str(battery_id),
                    issue_type=ErrorType.INSUFFICIENT_CYCLES.value,
                    description=f"循环次数不足: {cycle_count} < {min_cycles}",
                    severity="error"
                )
                issues.append(issue)
                
                self.logger.log_sample_failure(
                    str(battery_id),
                    ErrorType.INSUFFICIENT_CYCLES,
                    f"循环次数不足: {cycle_count} < {min_cycles}"
                )
            else:
                valid_batteries.append(battery_id)
        
        df_valid = df[df['battery_id'].isin(valid_batteries)].copy()
        removed = len(df) - len(df_valid)
        
        if removed > 0:
            self.logger.warning(
                "质控",
                f"移除 {removed} 行数据（循环次数不足）"
            )
        
        return df_valid, issues
    
    def _validate_capacity_range(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[QCIssue]]:
        """验证容量值范围。"""
        issues = []
        
        if 'capacity' not in df.columns:
            return df, issues
        
        min_cap = self.qc_rules.get('capacity_min', 0.0)
        max_cap = self.qc_rules.get('capacity_max')
        
        for idx, row in df.iterrows():
            capacity = row.get('capacity')
            battery_id = str(row.get('battery_id', 'Unknown'))
            cycle = row.get('cycle')
            
            if pd.isna(capacity):
                continue
            
            is_invalid = False
            if capacity < min_cap:
                is_invalid = True
                desc = f"容量值小于最小值: {capacity} < {min_cap}"
            elif max_cap is not None and capacity > max_cap:
                is_invalid = True
                desc = f"容量值大于最大值: {capacity} > {max_cap}"
            
            if is_invalid:
                issue = QCIssue(
                    battery_id=battery_id,
                    issue_type=ErrorType.INVALID_CAPACITY.value,
                    description=desc,
                    cycle_number=int(cycle) if pd.notna(cycle) else None,
                    value=float(capacity),
                    severity="error"
                )
                issues.append(issue)
                
                self.logger.log_sample_failure(
                    battery_id,
                    ErrorType.INVALID_CAPACITY,
                    desc,
                    cycle_number=int(cycle) if pd.notna(cycle) else None,
                    value=float(capacity)
                )
                
                df.loc[idx, 'capacity'] = np.nan
        
        if 'capacity' in df.columns:
            df['capacity'] = df.groupby('battery_id')['capacity'].transform(
                lambda x: x.interpolate(method='linear').ffill().bfill()
            )
        
        return df, issues
    
    def _detect_outliers(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[QCIssue]]:
        """检测异常值。"""
        issues = []
        method = self.qc_rules.get('outlier_method', 'iqr')
        threshold = self.qc_rules.get('outlier_threshold', 1.5)
        
        if 'capacity' not in df.columns:
            return df, issues
        
        for battery_id, group in df.groupby('battery_id'):
            capacities = group['capacity'].dropna()
            if len(capacities) < 5:
                continue
            
            if method.lower() == 'iqr':
                outliers = self._iqr_outliers(capacities, threshold)
            elif method.lower() == 'zscore':
                outliers = self._zscore_outliers(capacities, threshold)
            else:
                outliers = self._iqr_outliers(capacities, threshold)
            
            for idx in outliers.index:
                capacity = outliers[idx]
                cycle = df.loc[idx, 'cycle']
                
                issue = QCIssue(
                    battery_id=str(battery_id),
                    issue_type=ErrorType.OUTLIER.value,
                    description=f"检测到异常值 (方法: {method})",
                    cycle_number=int(cycle) if pd.notna(cycle) else None,
                    value=float(capacity),
                    severity="warning"
                )
                issues.append(issue)
                
                self.logger.warning(
                    "质控",
                    f"异常值: {battery_id} 循环 {cycle}, 容量 {capacity}",
                    {"method": method}
                )
                
                df.loc[idx, 'capacity'] = np.nan
        
        if 'capacity' in df.columns:
            df['capacity'] = df.groupby('battery_id')['capacity'].transform(
                lambda x: x.interpolate(method='linear').ffill().bfill()
            )
        
        return df, issues
    
    def _iqr_outliers(self, series: pd.Series, threshold: float) -> pd.Series:
        """使用 IQR 方法检测异常值。"""
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        
        lower_bound = q1 - threshold * iqr
        upper_bound = q3 + threshold * iqr
        
        return series[(series < lower_bound) | (series > upper_bound)]
    
    def _zscore_outliers(self, series: pd.Series, threshold: float) -> pd.Series:
        """使用 Z-score 方法检测异常值。"""
        z_scores = np.abs(stats.zscore(series))
        return series[z_scores > threshold]
    
    def _check_capacity_drop(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, List[QCIssue]]:
        """检查容量骤降异常。"""
        issues = []
        drop_threshold = self.qc_rules.get('capacity_drop_threshold', 0.2)
        
        if 'capacity' not in df.columns:
            return df, issues
        
        for battery_id, group in df.groupby('battery_id'):
            group_sorted = group.sort_values('cycle')
            capacities = group_sorted['capacity'].values
            cycles = group_sorted['cycle'].values
            
            if len(capacities) < 3:
                continue
            
            for i in range(1, len(capacities)):
                if np.isnan(capacities[i]) or np.isnan(capacities[i-1]):
                    continue
                
                if capacities[i-1] == 0:
                    continue
                
                drop_ratio = (capacities[i-1] - capacities[i]) / capacities[i-1]
                
                if drop_ratio > drop_threshold:
                    issue = QCIssue(
                        battery_id=str(battery_id),
                        issue_type=ErrorType.CAPACITY_DROP_ABNORMAL.value,
                        description=f"容量骤降: {drop_ratio:.1%} (>{drop_threshold:.1%})",
                        cycle_number=int(cycles[i]),
                        value=float(capacities[i]),
                        severity="error"
                    )
                    issues.append(issue)
                    
                    self.logger.log_sample_failure(
                        str(battery_id),
                        ErrorType.CAPACITY_DROP_ABNORMAL,
                        f"容量骤降: {drop_ratio:.1%}",
                        cycle_number=int(cycles[i]),
                        value=float(capacities[i]),
                        details={"previous": capacities[i-1], "current": capacities[i]}
                    )
        
        return df, issues
    
    def _generate_qc_report(self, df: pd.DataFrame, issues: List[QCIssue]) -> QCReport:
        """生成质控报告。"""
        total_samples = df['battery_id'].nunique() if 'battery_id' in df.columns else 0
        
        batteries_with_errors = set()
        batteries_with_warnings = set()
        by_type = {}
        
        for issue in issues:
            if issue.issue_type not in by_type:
                by_type[issue.issue_type] = 0
            by_type[issue.issue_type] += 1
            
            if issue.severity == "error":
                batteries_with_errors.add(issue.battery_id)
            else:
                batteries_with_warnings.add(issue.battery_id)
        
        failed_samples = len(batteries_with_errors)
        warning_samples = len(batteries_with_warnings - batteries_with_errors)
        passed_samples = total_samples - failed_samples - warning_samples
        
        return QCReport(
            total_samples=total_samples,
            passed_samples=passed_samples,
            failed_samples=failed_samples,
            warning_samples=warning_samples,
            issues=issues,
            by_type=by_type
        )
    
    def get_qc_summary(self, qc_report: QCReport) -> Dict[str, Any]:
        """获取质控摘要。"""
        return {
            "total_samples": qc_report.total_samples,
            "passed_samples": qc_report.passed_samples,
            "failed_samples": qc_report.failed_samples,
            "warning_samples": qc_report.warning_samples,
            "pass_rate": f"{qc_report.passed_samples / qc_report.total_samples * 100:.1f}%" if qc_report.total_samples > 0 else "N/A",
            "issues_by_type": qc_report.by_type,
            "issues": [asdict(i) for i in qc_report.issues]
        }
