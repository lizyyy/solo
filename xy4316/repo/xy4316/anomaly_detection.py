import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from scipy import stats
import warnings


@dataclass
class AnomalyDiagnosis:
    index: int
    pump_speed: float
    flow_rate: float
    anomaly_type: str
    severity: str
    description: str
    suggested_action: str
    metrics: Dict[str, float] = field(default_factory=dict)


@dataclass
class AnomalyReport:
    total_points: int
    anomaly_count: int
    normal_count: int
    anomalies: List[AnomalyDiagnosis]
    normal_indices: List[int]
    summary: Dict[str, Any]
    
    def get_anomaly_indices(self) -> List[int]:
        return [a.index for a in self.anomalies]
    
    def get_severity_counts(self) -> Dict[str, int]:
        counts = {'high': 0, 'medium': 0, 'low': 0}
        for a in self.anomalies:
            counts[a.severity] = counts.get(a.severity, 0) + 1
        return counts


class AnomalyDetector:
    def __init__(self):
        self.default_methods = [
            'residual_zscore',
            'cooks_distance',
            'leverage',
            'iqr',
            'grubbs',
        ]
        self.thresholds = {
            'residual_zscore': 2.5,
            'cooks_distance': 4.0,
            'leverage': 0.5,
            'iqr': 1.5,
            'grubbs': 0.05,
        }
    
    def detect(
        self,
        pump_speed: np.ndarray,
        flow_rate: np.ndarray,
        residuals: np.ndarray,
        method: str = 'ensemble',
        confidence_level: float = 0.95
    ) -> AnomalyReport:
        x = np.asarray(pump_speed, dtype=np.float64)
        y = np.asarray(flow_rate, dtype=np.float64)
        r = np.asarray(residuals, dtype=np.float64)
        
        n = len(x)
        if n != len(y) or n != len(r):
            raise ValueError("数据长度不一致")
        
        if n < 3:
            return AnomalyReport(
                total_points=n,
                anomaly_count=0,
                normal_count=n,
                anomalies=[],
                normal_indices=list(range(n)),
                summary={'warning': '数据点不足，无法进行异常检测'}
            )
        
        anomaly_flags = np.zeros(n, dtype=bool)
        anomaly_details = {}
        
        if method == 'ensemble':
            results = {}
            for m in self.default_methods:
                try:
                    flags, details = self._detect_with_method(x, y, r, m, confidence_level)
                    results[m] = (flags, details)
                    anomaly_flags = anomaly_flags | flags
                except Exception as e:
                    warnings.warn(f"方法 {m} 执行失败: {e}")
            
            for i in range(n):
                if anomaly_flags[i]:
                    methods_triggered = [m for m, (flags, _) in results.items() if flags[i]]
                    details_list = [results[m][1].get(i, {}) for m in methods_triggered if i in results[m][1]]
                    combined_details = {}
                    for d in details_list:
                        combined_details.update(d)
                    anomaly_details[i] = {
                        'methods': methods_triggered,
                        'details': combined_details
                    }
        else:
            anomaly_flags, anomaly_details = self._detect_with_method(x, y, r, method, confidence_level)
        
        anomalies = []
        normal_indices = []
        
        for i in range(n):
            if anomaly_flags[i]:
                diagnosis = self._create_diagnosis(
                    i, x[i], y[i], r[i],
                    anomaly_details.get(i, {})
                )
                anomalies.append(diagnosis)
            else:
                normal_indices.append(i)
        
        summary = self._generate_summary(anomalies, n, method)
        
        return AnomalyReport(
            total_points=n,
            anomaly_count=len(anomalies),
            normal_count=len(normal_indices),
            anomalies=anomalies,
            normal_indices=normal_indices,
            summary=summary
        )
    
    def _detect_with_method(
        self,
        x: np.ndarray,
        y: np.ndarray,
        residuals: np.ndarray,
        method: str,
        confidence_level: float
    ) -> Tuple[np.ndarray, Dict[int, Dict]]:
        n = len(x)
        flags = np.zeros(n, dtype=bool)
        details = {}
        
        if method == 'residual_zscore':
            residual_std = np.std(residuals, ddof=1)
            if residual_std > 0:
                z_scores = residuals / residual_std
                threshold = self.thresholds['residual_zscore']
                flags = np.abs(z_scores) > threshold
                
                for i in np.where(flags)[0]:
                    details[i] = {
                        'z_score': float(z_scores[i]),
                        'threshold': threshold,
                        'residual': float(residuals[i]),
                        'residual_std': float(residual_std)
                    }
        
        elif method == 'cooks_distance':
            cooks = self._calculate_cooks_distance(x, residuals)
            threshold = self.thresholds['cooks_distance'] / n
            flags = cooks > threshold
            
            for i in np.where(flags)[0]:
                details[i] = {
                    'cooks_distance': float(cooks[i]),
                    'threshold': float(threshold),
                    'recommendation': '该点对拟合结果影响较大'
                }
        
        elif method == 'leverage':
            leverage = self._calculate_leverage(x)
            threshold = self.thresholds['leverage']
            flags = leverage > threshold
            
            for i in np.where(flags)[0]:
                details[i] = {
                    'leverage': float(leverage[i]),
                    'threshold': threshold,
                    'note': '该点在x方向上为高杠杆点'
                }
        
        elif method == 'iqr':
            q1, q3 = np.percentile(residuals, [25, 75])
            iqr = q3 - q1
            if iqr > 0:
                threshold = self.thresholds['iqr']
                lower_bound = q1 - threshold * iqr
                upper_bound = q3 + threshold * iqr
                flags = (residuals < lower_bound) | (residuals > upper_bound)
                
                for i in np.where(flags)[0]:
                    details[i] = {
                        'residual': float(residuals[i]),
                        'lower_bound': float(lower_bound),
                        'upper_bound': float(upper_bound),
                        'iqr': float(iqr)
                    }
        
        elif method == 'grubbs':
            if n > 2:
                alpha = self.thresholds['grubbs']
                flags, outlier_indices = self._grubbs_test(residuals, alpha)
                
                for i in outlier_indices:
                    details[i] = {
                        'test': 'Grubbs',
                        'alpha': alpha,
                        'residual': float(residuals[i])
                    }
        
        return flags, details
    
    def _calculate_cooks_distance(
        self,
        x: np.ndarray,
        residuals: np.ndarray
    ) -> np.ndarray:
        n = len(x)
        X = np.column_stack([np.ones(n), x])
        
        try:
            XtX_inv = np.linalg.inv(X.T @ X)
            H = X @ XtX_inv @ X.T
            h_ii = np.diag(H)
            
            mse = np.sum(residuals**2) / (n - 2)
            if mse <= 0:
                return np.zeros(n)
            
            cooks = (residuals**2 * h_ii) / (2 * mse * (1 - h_ii)**2)
            return cooks
        except:
            return np.zeros(n)
    
    def _calculate_leverage(self, x: np.ndarray) -> np.ndarray:
        n = len(x)
        X = np.column_stack([np.ones(n), x])
        
        try:
            XtX_inv = np.linalg.inv(X.T @ X)
            H = X @ XtX_inv @ X.T
            return np.diag(H)
        except:
            return np.ones(n) * (2 / n)
    
    def _grubbs_test(
        self,
        data: np.ndarray,
        alpha: float = 0.05
    ) -> Tuple[np.ndarray, List[int]]:
        n = len(data)
        if n < 3:
            return np.zeros(n, dtype=bool), []
        
        flags = np.zeros(n, dtype=bool)
        outlier_indices = []
        
        mean = np.mean(data)
        std = np.std(data, ddof=1)
        
        if std <= 0:
            return flags, outlier_indices
        
        abs_deviations = np.abs(data - mean)
        max_dev_idx = np.argmax(abs_deviations)
        G = abs_deviations[max_dev_idx] / std
        
        df = n - 2
        t_critical = stats.t.ppf(1 - alpha / (2 * n), df)
        G_critical = ((n - 1) / np.sqrt(n)) * np.sqrt(t_critical**2 / (df + t_critical**2))
        
        if G > G_critical:
            flags[max_dev_idx] = True
            outlier_indices.append(max_dev_idx)
        
        return flags, outlier_indices
    
    def _create_diagnosis(
        self,
        index: int,
        pump_speed: float,
        flow_rate: float,
        residual: float,
        details: Dict
    ) -> AnomalyDiagnosis:
        methods = details.get('methods', ['unknown'])
        method_str = ', '.join(methods)
        
        abs_residual = abs(residual)
        
        if 'cooks_distance' in details.get('details', {}) or 'cooks_distance' in method_str:
            anomaly_type = '高影响力点'
            if abs_residual > 2:
                severity = 'high'
            else:
                severity = 'medium'
            description = f"该数据点({pump_speed}, {flow_rate})对拟合结果有显著影响，可能改变整体趋势"
            suggested_action = "建议核实该点数据是否正确，或考虑排除后重新拟合"
        
        elif abs_residual > 3:
            anomaly_type = '极端异常值'
            severity = 'high'
            description = f"残差({residual:.4f})远大于预期范围，可能存在测量错误或操作异常"
            suggested_action = "强烈建议复查该数据点，核实流量计读数和泵速记录"
        
        elif abs_residual > 2:
            anomaly_type = '异常值'
            severity = 'medium'
            description = f"残差({residual:.4f})超出正常范围，可能存在随机误差或未被识别的因素"
            suggested_action = "建议检查该点数据，考虑是否需要重新测量"
        
        else:
            anomaly_type = '可疑点'
            severity = 'low'
            description = f"该点被标记为可疑，但残差({residual:.4f})在可接受范围内"
            suggested_action = "可在报告中关注该点，一般无需特殊处理"
        
        metrics = {
            'residual': float(residual),
            'abs_residual': float(abs_residual),
        }
        metrics.update(details.get('details', {}))
        
        return AnomalyDiagnosis(
            index=index,
            pump_speed=float(pump_speed),
            flow_rate=float(flow_rate),
            anomaly_type=anomaly_type,
            severity=severity,
            description=description,
            suggested_action=suggested_action,
            metrics=metrics
        )
    
    def _generate_summary(
        self,
        anomalies: List[AnomalyDiagnosis],
        total_points: int,
        method: str
    ) -> Dict[str, Any]:
        severity_counts = {'high': 0, 'medium': 0, 'low': 0}
        type_counts = {}
        
        for a in anomalies:
            severity_counts[a.severity] = severity_counts.get(a.severity, 0) + 1
            type_counts[a.anomaly_type] = type_counts.get(a.anomaly_type, 0) + 1
        
        anomaly_ratio = len(anomalies) / total_points if total_points > 0 else 0
        
        status = '正常'
        if severity_counts['high'] > 0:
            status = '需要关注'
        elif severity_counts['medium'] > 0 or anomaly_ratio > 0.2:
            status = '建议检查'
        
        return {
            'detection_method': method,
            'status': status,
            'severity_counts': severity_counts,
            'type_counts': type_counts,
            'anomaly_ratio': float(anomaly_ratio),
            'recommendation': self._get_recommendation(severity_counts, anomaly_ratio)
        }
    
    def _get_recommendation(
        self,
        severity_counts: Dict[str, int],
        anomaly_ratio: float
    ) -> str:
        if severity_counts['high'] > 0:
            return f"发现{severity_counts['high']}个高优先级异常点，强烈建议复查数据质量，考虑排除后重新校准"
        
        if severity_counts['medium'] > 0:
            return f"发现{severity_counts['medium']}个中等优先级异常点，建议检查相关数据记录"
        
        if anomaly_ratio > 0.15:
            return f"异常点比例较高({anomaly_ratio*100:.1f}%)，建议评估整体数据质量"
        
        return "未发现显著异常，数据质量良好"
    
    def filter_outliers(
        self,
        x: np.ndarray,
        y: np.ndarray,
        residuals: np.ndarray,
        anomaly_report: AnomalyReport,
        remove_high_severity_only: bool = True
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, List[int]]:
        x = np.asarray(x)
        y = np.asarray(y)
        residuals = np.asarray(residuals)
        
        indices_to_remove = []
        
        for anomaly in anomaly_report.anomalies:
            if remove_high_severity_only:
                if anomaly.severity == 'high':
                    indices_to_remove.append(anomaly.index)
            else:
                if anomaly.severity in ['high', 'medium']:
                    indices_to_remove.append(anomaly.index)
        
        if not indices_to_remove:
            return x, y, residuals, []
        
        mask = np.ones(len(x), dtype=bool)
        mask[indices_to_remove] = False
        
        return x[mask], y[mask], residuals[mask], indices_to_remove


anomaly_detector = AnomalyDetector()
