import pandas as pd
from typing import List, Dict, Any
from dataclasses import dataclass
from enum import Enum
from .models import AnomalyType


class AnomalySeverity(Enum):
    CRITICAL = "严重"
    HIGH = "高"
    MEDIUM = "中"
    LOW = "低"


@dataclass
class DetectedAnomaly:
    record_id: str
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    description: str
    evidence: Dict[str, Any]
    suggestion: str
    vehicle_id: str = ""
    plate_number: str = ""
    driver_name: str = ""


class AnomalyDetector:
    """异常检测器"""
    
    def __init__(self):
        self.anomaly_rules = {
            'duplicate': self._detect_duplicates,
            'missing_fields': self._detect_missing_fields,
            'manual_edit': self._detect_manual_edits,
            'fuel_mismatch': self._detect_fuel_mismatch,
            'extreme_values': self._detect_extreme_values,
        }
    
    def detect_all(
        self, 
        df: pd.DataFrame, 
        validation_result,
        fuel_analyses: List
    ) -> List[DetectedAnomaly]:
        anomalies = []
        
        anomalies.extend(self._detect_duplicates(df, validation_result))
        anomalies.extend(self._detect_missing_fields(df, validation_result))
        anomalies.extend(self._detect_manual_edits(df))
        anomalies.extend(self._detect_fuel_mismatch(df, fuel_analyses))
        anomalies.extend(self._detect_extreme_values(df))
        
        return anomalies
    
    def _detect_duplicates(
        self, df: pd.DataFrame, validation_result
    ) -> List[DetectedAnomaly]:
        anomalies = []
        
        for dup_issue in validation_result.duplicate_records:
            row_idx = dup_issue['row_index']
            row = df.iloc[row_idx] if row_idx < len(df) else None
            
            if row is None:
                continue
            
            anomalies.append(DetectedAnomaly(
                record_id=dup_issue['record_id'],
                anomaly_type=AnomalyType.DUPLICATE_RECORD,
                severity=AnomalySeverity.HIGH,
                description=dup_issue['description'],
                evidence={
                    'original_record_id': dup_issue['original_record_id'],
                    'duplicate_keys': dup_issue['duplicate_keys'],
                },
                suggestion="建议删除重复记录，保留最早的一条",
                vehicle_id=str(row.get('vehicle_id', '')),
                plate_number=str(row.get('plate_number', '')),
                driver_name=str(row.get('driver_name', ''))
            ))
        
        return anomalies
    
    def _detect_missing_fields(
        self, df: pd.DataFrame, validation_result
    ) -> List[DetectedAnomaly]:
        anomalies = []
        
        for miss_issue in validation_result.missing_column_records:
            row_idx = miss_issue['row_index']
            row = df.iloc[row_idx] if row_idx < len(df) else None
            
            critical_fields = ['fuel_consumption', 'route_mileage', 'date', 'vehicle_id']
            is_critical = miss_issue['missing_field'] in critical_fields
            
            severity = AnomalySeverity.CRITICAL if is_critical else AnomalySeverity.MEDIUM
            
            if row is None:
                continue
            
            anomalies.append(DetectedAnomaly(
                record_id=miss_issue.get('record_id', f"Row-{row_idx}"),
                anomaly_type=AnomalyType.MISSING_FIELD,
                severity=severity,
                description=miss_issue['description'],
                evidence={
                    'missing_field': miss_issue['missing_field'],
                    'is_critical': is_critical,
                },
                suggestion=f"请补充缺失的字段: {miss_issue['missing_field']}",
                vehicle_id=str(row.get('vehicle_id', '')),
                plate_number=str(row.get('plate_number', '')),
                driver_name=str(row.get('driver_name', ''))
            ))
        
        return anomalies
    
    def _detect_manual_edits(self, df: pd.DataFrame) -> List[DetectedAnomaly]:
        anomalies = []
        
        if 'is_manual_edit' not in df.columns:
            return anomalies
        
        manual_rows = df[df['is_manual_edit'] == True]
        
        for idx, row in manual_rows.iterrows():
            notes = str(row.get('notes', ''))
            
            suspicious_keywords = [
                '异常', '错误', '放大', '缩小', '清零', '修改', '调整',
                '异常放大', '异常缩小', '错误清零', '人工修改'
            ]
            
            is_suspicious = any(kw in notes for kw in suspicious_keywords)
            
            if is_suspicious or len(notes) > 0:
                anomalies.append(DetectedAnomaly(
                    record_id=str(row.get('record_id', '')),
                    anomaly_type=AnomalyType.MANUAL_ERROR,
                    severity=AnomalySeverity.HIGH if is_suspicious else AnomalySeverity.MEDIUM,
                    description=f"检测到人工编辑记录: {notes}",
                    evidence={
                        'notes': notes,
                        'original_values': {
                            'fuel_consumption': row.get('fuel_consumption'),
                            'route_mileage': row.get('route_mileage'),
                            'load_weight': row.get('load_weight'),
                            'idle_time': row.get('idle_time'),
                        },
                        'is_suspicious': is_suspicious,
                    },
                    suggestion="请核实人工修改的原因和合理性，必要时联系数据录入人员确认",
                    vehicle_id=str(row.get('vehicle_id', '')),
                    plate_number=str(row.get('plate_number', '')),
                    driver_name=str(row.get('driver_name', ''))
                ))
        
        return anomalies
    
    def _detect_fuel_mismatch(
        self, df: pd.DataFrame, fuel_analyses: List
    ) -> List[DetectedAnomaly]:
        anomalies = []
        
        for analysis in fuel_analyses:
            if not analysis.is_anomaly:
                continue
            
            row_mask = df['record_id'] == analysis.record_id
            if row_mask.any():
                row = df[row_mask].iloc[0]
            else:
                continue
            
            causes = analysis.anomaly_cause.split("; ")
            
            for cause in causes:
                if not cause:
                    continue
                
                if "偏高" in cause or "超出" in cause:
                    anomaly_type = AnomalyType.ABNORMAL_FUEL_CONSUMPTION
                    severity = AnomalySeverity.HIGH
                elif "偏低" in cause:
                    anomaly_type = AnomalyType.FUEL_MISMATCH_MILEAGE
                    severity = AnomalySeverity.MEDIUM
                else:
                    anomaly_type = AnomalyType.FUEL_MISMATCH_MILEAGE
                    severity = AnomalySeverity.MEDIUM
                
                evidence = {
                    'expected_fuel': analysis.expected_fuel,
                    'actual_fuel': analysis.actual_fuel,
                    'fuel_deviation': analysis.fuel_deviation,
                    'fuel_deviation_percent': analysis.fuel_deviation_percent,
                    'fuel_per_km': analysis.fuel_per_km,
                    'mileage_factor': analysis.mileage_factor,
                    'load_factor': analysis.load_factor,
                    'idle_factor': analysis.idle_factor,
                    'route_mileage': row.get('route_mileage'),
                    'load_weight': row.get('load_weight'),
                    'idle_time': row.get('idle_time'),
                }
                
                suggestion = self._generate_suggestion(cause, analysis)
                
                anomalies.append(DetectedAnomaly(
                    record_id=analysis.record_id,
                    anomaly_type=anomaly_type,
                    severity=severity,
                    description=f"{cause} (偏差: {analysis.fuel_deviation_percent:.1f}%)",
                    evidence=evidence,
                    suggestion=suggestion,
                    vehicle_id=analysis.vehicle_id,
                    plate_number=str(row.get('plate_number', '')),
                    driver_name=str(row.get('driver_name', ''))
                ))
        
        return anomalies
    
    def _detect_extreme_values(self, df: pd.DataFrame) -> List[DetectedAnomaly]:
        anomalies = []
        
        numeric_checks = [
            ('fuel_consumption', 0.5, 200.0, '油耗', '升'),
            ('route_mileage', 0.5, 300.0, '路线里程', '公里'),
            ('load_weight', 0.0, 20000.0, '载重', '公斤'),
            ('idle_time', 0.0, 240.0, '怠速时间', '分钟'),
        ]
        
        for col, min_val, max_val, desc, unit in numeric_checks:
            if col not in df.columns:
                continue
            
            for idx, row in df.iterrows():
                val = row.get(col)
                
                if val is None or pd.isna(val):
                    continue
                
                try:
                    num_val = float(val)
                except (ValueError, TypeError):
                    continue
                
                if num_val < min_val and num_val > 0:
                    anomalies.append(DetectedAnomaly(
                        record_id=str(row.get('record_id', '')),
                        anomaly_type=AnomalyType.FUEL_MISMATCH_LOAD,
                        severity=AnomalySeverity.MEDIUM,
                        description=f"{desc}异常偏低: {num_val} {unit}",
                        evidence={
                            'field': col,
                            'value': num_val,
                            'normal_range': f"{min_val}-{max_val}",
                        },
                        suggestion=f"请核实{desc}数据是否正确",
                        vehicle_id=str(row.get('vehicle_id', '')),
                        plate_number=str(row.get('plate_number', '')),
                        driver_name=str(row.get('driver_name', ''))
                    ))
                elif num_val > max_val:
                    anomalies.append(DetectedAnomaly(
                        record_id=str(row.get('record_id', '')),
                        anomaly_type=AnomalyType.FUEL_MISMATCH_IDLE,
                        severity=AnomalySeverity.HIGH,
                        description=f"{desc}异常偏高: {num_val} {unit}",
                        evidence={
                            'field': col,
                            'value': num_val,
                            'normal_range': f"{min_val}-{max_val}",
                        },
                        suggestion=f"请核实{desc}数据是否正确，是否存在数据录入错误或设备故障",
                        vehicle_id=str(row.get('vehicle_id', '')),
                        plate_number=str(row.get('plate_number', '')),
                        driver_name=str(row.get('driver_name', ''))
                    ))
        
        return anomalies
    
    def _generate_suggestion(self, cause: str, analysis) -> str:
        if "油耗异常偏高" in cause:
            if analysis.load_factor > 1.5:
                return "载重偏高，建议检查是否存在超负荷运输或载重记录错误"
            elif analysis.idle_factor > 2.0:
                return "怠速时间过长，建议检查是否存在不必要的怠速或怠速记录错误"
            elif analysis.mileage_factor < 0.5:
                return "路线里程偏低但油耗偏高，建议检查路线数据或油耗数据"
            else:
                return "建议检查油耗传感器是否正常，或核实是否存在私用油情况"
        
        if "油耗异常偏低" in cause:
            return "油耗异常偏低，建议检查油耗传感器或核实是否存在漏报"
        
        if "路线里程" in cause:
            if "偏低" in cause:
                return "路线里程异常偏低，建议核实GPS数据或路线记录"
            else:
                return "路线里程异常偏高，建议核实路线规划或GPS数据"
        
        if "载重" in cause:
            return "载重记录异常，建议核实地磅数据或称重记录"
        
        if "怠速" in cause:
            if "偏低" in cause:
                return "怠速时间异常偏低，建议核实怠速传感器数据"
            else:
                return "怠速时间异常偏高，建议检查是否存在长时间怠速浪费"
        
        return "建议进一步核实数据准确性，联系相关人员确认"
    
    def group_anomalies_by_type(
        self, anomalies: List[DetectedAnomaly]
    ) -> Dict[str, List[DetectedAnomaly]]:
        grouped = {}
        for anomaly in anomalies:
            type_name = anomaly.anomaly_type.value
            if type_name not in grouped:
                grouped[type_name] = []
            grouped[type_name].append(anomaly)
        return grouped
    
    def get_severity_summary(
        self, anomalies: List[DetectedAnomaly]
    ) -> Dict[str, int]:
        summary = {
            '严重': 0,
            '高': 0,
            '中': 0,
            '低': 0,
        }
        
        for anomaly in anomalies:
            summary[anomaly.severity.value] += 1
        
        return summary