"""规则引擎 - 冻干工艺规则检查"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import List, Dict, Any, Optional, Callable, Type
import numpy as np

from ..models import (
    BatchData, TemperatureData, VacuumData, MoistureData, RecipeInfo
)


class RuleType(Enum):
    """规则类型"""
    VACUUM_FLUCTUATION = "vacuum_fluctuation"
    TEMPERATURE_EXCEEDANCE = "temperature_exceedance"
    PLATEAU_INSUFFICIENCY = "plateau_insufficiency"
    SENSOR_DRIFT = "sensor_drift"
    PREMATURE_HEATING = "premature_heating"
    MOISTURE_INSUFFICIENT = "moisture_insufficient"


class RuleSeverity(Enum):
    """规则严重程度"""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


@dataclass
class RuleCheckResult:
    """规则检查结果"""
    rule_type: RuleType
    rule_name: str
    passed: bool
    severity: RuleSeverity = RuleSeverity.WARNING
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    occurrences: List[Dict[str, Any]] = field(default_factory=list)
    recommendations: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_type": self.rule_type.value,
            "rule_name": self.rule_name,
            "passed": self.passed,
            "severity": self.severity.value,
            "message": self.message,
            "details": self.details,
            "occurrences": self.occurrences,
            "recommendations": self.recommendations,
        }


class BaseRule:
    """规则基类"""
    
    rule_type: RuleType = RuleType.VACUUM_FLUCTUATION
    rule_name: str = "Base Rule"
    severity: RuleSeverity = RuleSeverity.WARNING
    
    def __init__(self, **kwargs):
        self.parameters = kwargs
    
    def check(self, batch: BatchData) -> RuleCheckResult:
        """执行规则检查"""
        raise NotImplementedError("Subclasses must implement check method")
    
    def _get_collapse_temp(self, batch: BatchData) -> Optional[float]:
        """获取塌陷温度"""
        if batch.recipe and batch.recipe.collapse_temp_c is not None:
            return batch.recipe.collapse_temp_c
        
        if batch.recipe and batch.recipe.eutectic_temp_c is not None:
            return batch.recipe.eutectic_temp_c + 2.0
        
        return None


class VacuumFluctuationRule(BaseRule):
    """真空波动规则
    
    检测：真空度波动过大
    风险：影响升华速率，可能导致产品质量不稳定
    """
    
    rule_type = RuleType.VACUUM_FLUCTUATION
    rule_name = "真空波动检测"
    severity = RuleSeverity.WARNING
    
    DEFAULT_THRESHOLD = 50.0
    DEFAULT_WINDOW_MINUTES = 5.0
    
    def __init__(self, threshold_mtorr: float = None, window_minutes: float = None, **kwargs):
        super().__init__(**kwargs)
        self.threshold_mtorr = threshold_mtorr or self.DEFAULT_THRESHOLD
        self.window_minutes = window_minutes or self.DEFAULT_WINDOW_MINUTES
    
    def check(self, batch: BatchData) -> RuleCheckResult:
        result = RuleCheckResult(
            rule_type=self.rule_type,
            rule_name=self.rule_name,
            passed=True,
            severity=self.severity
        )
        
        if not batch.vacuum or len(batch.vacuum) < 5:
            result.message = "真空数据不足，无法进行波动检测"
            result.passed = True
            result.details = {"data_points": len(batch.vacuum) if batch.vacuum else 0}
            return result
        
        fluctuations = batch.vacuum.get_fluctuations(
            threshold_mtorr=self.threshold_mtorr,
            window_minutes=self.window_minutes
        )
        
        if fluctuations:
            result.passed = False
            result.message = f"检测到{len(fluctuations)}处真空度波动超过阈值"
            result.occurrences = [
                {
                    "time": f["time"].isoformat(),
                    "fluctuation_mtorr": f["fluctuation_mtorr"],
                    "max_vacuum": f.get("max_in_window"),
                    "min_vacuum": f.get("min_in_window"),
                }
                for f in fluctuations
            ]
            result.recommendations = [
                "检查真空系统密封性",
                "确认冷凝器温度是否稳定",
                "检查是否有漏气点",
            ]
        else:
            result.message = "真空度波动在正常范围内"
        
        result.details = {
            "threshold_mtorr": self.threshold_mtorr,
            "window_minutes": self.window_minutes,
            "fluctuation_count": len(fluctuations),
        }
        
        return result


class TemperatureExceedanceRule(BaseRule):
    """温度越界规则
    
    检测：产品温度超过塌陷温度
    风险：产品塌陷，影响质量
    """
    
    rule_type = RuleType.TEMPERATURE_EXCEEDANCE
    rule_name = "温度越界检测"
    severity = RuleSeverity.CRITICAL
    
    DEFAULT_SAFETY_MARGIN = 2.0
    
    def __init__(self, collapse_temp_c: float = None, safety_margin_c: float = None, **kwargs):
        super().__init__(**kwargs)
        self.collapse_temp_c = collapse_temp_c
        self.safety_margin_c = safety_margin_c or self.DEFAULT_SAFETY_MARGIN
    
    def check(self, batch: BatchData) -> RuleCheckResult:
        result = RuleCheckResult(
            rule_type=self.rule_type,
            rule_name=self.rule_name,
            passed=True,
            severity=self.severity
        )
        
        if not batch.product_temp or len(batch.product_temp) < 5:
            result.message = "产品温度数据不足，无法进行温度越界检测"
            result.passed = True
            result.details = {"data_points": len(batch.product_temp) if batch.product_temp else 0}
            return result
        
        collapse_temp = self.collapse_temp_c or self._get_collapse_temp(batch)
        
        if collapse_temp is None:
            result.message = "未设置塌陷温度，使用默认阈值(-10°C)进行检测"
            collapse_temp = -10.0
        
        effective_threshold = collapse_temp - self.safety_margin_c
        
        exceedances = batch.product_temp.get_exceedance_periods(effective_threshold)
        
        if exceedances:
            result.passed = False
            result.message = f"检测到{len(exceedances)}处产品温度超过塌陷温度阈值"
            result.occurrences = [
                {
                    "start_time": e["start_time"].isoformat(),
                    "end_time": e["end_time"].isoformat(),
                    "duration_minutes": e["duration_minutes"],
                    "max_temp_c": e["max_temp"],
                    "avg_temp_c": e["avg_temp"],
                    "excess_temp_c": e["max_temp"] - collapse_temp,
                }
                for e in exceedances
            ]
            result.recommendations = [
                "降低搁板温度",
                "检查是否一次干燥未完成就升温",
                "确认塌陷温度设置是否正确",
                "考虑调整一次干燥时间",
            ]
        else:
            result.message = f"产品温度始终保持在塌陷温度({collapse_temp}°C)以下"
        
        result.details = {
            "collapse_temp_c": collapse_temp,
            "safety_margin_c": self.safety_margin_c,
            "effective_threshold_c": effective_threshold,
            "exceedance_count": len(exceedances),
        }
        
        return result


class PlateauInsufficiencyRule(BaseRule):
    """平台期不足规则
    
    检测：二次干燥时间不足
    风险：残余水分过高，影响产品稳定性
    """
    
    rule_type = RuleType.PLATEAU_INSUFFICIENCY
    rule_name = "平台期不足检测"
    severity = RuleSeverity.WARNING
    
    DEFAULT_MIN_SECONDARY_DURATION = 180.0
    DEFAULT_MIN_PRIMARY_DURATION = 300.0
    
    def __init__(self, 
                 min_secondary_duration_min: float = None,
                 min_primary_duration_min: float = None,
                 target_moisture_pct: float = None,
                 **kwargs):
        super().__init__(**kwargs)
        self.min_secondary_duration_min = min_secondary_duration_min or self.DEFAULT_MIN_SECONDARY_DURATION
        self.min_primary_duration_min = min_primary_duration_min or self.DEFAULT_MIN_PRIMARY_DURATION
        self.target_moisture_pct = target_moisture_pct or 3.0
    
    def check(self, batch: BatchData) -> RuleCheckResult:
        result = RuleCheckResult(
            rule_type=self.rule_type,
            rule_name=self.rule_name,
            passed=True,
            severity=self.severity
        )
        
        issues = []
        warnings = []
        
        secondary_duration = batch.secondary_drying_duration
        primary_duration = batch.primary_drying_duration
        
        if secondary_duration is None and batch.shelf_temp:
            secondary_duration = self._estimate_secondary_duration(batch)
        
        if primary_duration is None and batch.shelf_temp:
            primary_duration = self._estimate_primary_duration(batch)
        
        if secondary_duration is not None:
            if secondary_duration < self.min_secondary_duration_min:
                issues.append({
                    "type": "secondary_drying",
                    "duration_minutes": secondary_duration,
                    "required_minutes": self.min_secondary_duration_min,
                    "deficit_minutes": self.min_secondary_duration_min - secondary_duration,
                })
        
        if primary_duration is not None:
            if primary_duration < self.min_primary_duration_min:
                warnings.append({
                    "type": "primary_drying",
                    "duration_minutes": primary_duration,
                    "recommended_minutes": self.min_primary_duration_min,
                    "deficit_minutes": self.min_primary_duration_min - primary_duration,
                })
        
        if batch.moisture and batch.moisture.values:
            avg_moisture = np.mean(batch.moisture.values)
            if avg_moisture > self.target_moisture_pct:
                issues.append({
                    "type": "residual_moisture",
                    "moisture_pct": float(avg_moisture),
                    "target_pct": self.target_moisture_pct,
                    "excess_pct": float(avg_moisture - self.target_moisture_pct),
                })
        
        if issues:
            result.passed = False
            result.message = f"检测到{len(issues)}个平台期或水分相关问题"
            result.occurrences = issues
            result.recommendations = [
                f"延长二次干燥时间至少{self.min_secondary_duration_min}分钟",
                f"确保一次干燥完成后再升温",
                f"目标残余水分应低于{self.target_moisture_pct}%",
                "检查二次干燥温度设置",
            ]
        elif warnings:
            result.passed = True
            result.message = "平台期基本符合要求，但一次干燥时间偏短"
            result.occurrences = warnings
            result.recommendations = [
                "建议确认一次干燥是否充分完成",
                "检查产品温度曲线是否达到稳态",
            ]
        else:
            result.message = "平台期时长符合要求"
        
        result.details = {
            "min_secondary_duration_min": self.min_secondary_duration_min,
            "min_primary_duration_min": self.min_primary_duration_min,
            "target_moisture_pct": self.target_moisture_pct,
            "actual_secondary_duration_min": secondary_duration,
            "actual_primary_duration_min": primary_duration,
            "issue_count": len(issues),
            "warning_count": len(warnings),
        }
        
        return result
    
    def _estimate_secondary_duration(self, batch: BatchData) -> Optional[float]:
        """估算二次干燥时长"""
        if not batch.shelf_temp:
            return None
        
        temps = np.array(batch.shelf_temp.values)
        timestamps = batch.shelf_temp.timestamps
        
        if len(temps) < 10:
            return None
        
        secondary_start_idx = None
        for i in range(len(temps) - 1):
            if temps[i] > 0 and temps[i+1] >= temps[i]:
                if temps[i] > 15:
                    secondary_start_idx = i
                    break
        
        if secondary_start_idx is None:
            return None
        
        total_duration = (timestamps[-1] - timestamps[secondary_start_idx]).total_seconds() / 60
        
        return total_duration
    
    def _estimate_primary_duration(self, batch: BatchData) -> Optional[float]:
        """估算一次干燥时长"""
        if not batch.shelf_temp:
            return None
        
        temps = np.array(batch.shelf_temp.values)
        timestamps = batch.shelf_temp.timestamps
        
        if len(temps) < 10:
            return None
        
        primary_start_idx = None
        for i in range(1, len(temps)):
            if temps[i] > -30 and temps[i-1] < -30:
                primary_start_idx = i
                break
        
        if primary_start_idx is None:
            return None
        
        secondary_start_idx = None
        for i in range(primary_start_idx, len(temps) - 1):
            if temps[i] > 0 and temps[i+1] >= temps[i]:
                if temps[i] > 15:
                    secondary_start_idx = i
                    break
        
        if secondary_start_idx is None:
            secondary_start_idx = len(temps) - 1
        
        duration = (timestamps[secondary_start_idx] - timestamps[primary_start_idx]).total_seconds() / 60
        
        return duration


class SensorDriftRule(BaseRule):
    """传感器漂移规则
    
    检测：传感器读数异常漂移
    风险：数据不准确，影响工艺判断
    """
    
    rule_type = RuleType.SENSOR_DRIFT
    rule_name = "传感器漂移检测"
    severity = RuleSeverity.WARNING
    
    DEFAULT_DRIFT_THRESHOLD = 5.0
    DEFAULT_RATE_THRESHOLD = 0.5
    
    def __init__(self, 
                 drift_threshold_c: float = None,
                 rate_threshold_c_min: float = None,
                 **kwargs):
        super().__init__(**kwargs)
        self.drift_threshold_c = drift_threshold_c or self.DEFAULT_DRIFT_THRESHOLD
        self.rate_threshold_c_min = rate_threshold_c_min or self.DEFAULT_RATE_THRESHOLD
    
    def check(self, batch: BatchData) -> RuleCheckResult:
        result = RuleCheckResult(
            rule_type=self.rule_type,
            rule_name=self.rule_name,
            passed=True,
            severity=self.severity
        )
        
        drift_issues = []
        
        if batch.shelf_temp and batch.product_temp:
            shelf_stats = batch.shelf_temp.get_stats()
            product_stats = batch.product_temp.get_stats()
            
            if shelf_stats.get("count", 0) > 0 and product_stats.get("count", 0) > 0:
                shelf_range = shelf_stats.get("max", 0) - shelf_stats.get("min", 0)
                product_range = product_stats.get("max", 0) - product_stats.get("min", 0)
                
                if shelf_range > 100 and product_range < 10:
                    drift_issues.append({
                        "sensor": "product_temp",
                        "issue_type": "stagnant_reading",
                        "shelf_range_c": shelf_range,
                        "product_range_c": product_range,
                        "message": "产品温度传感器读数停滞，可能存在漂移",
                    })
        
        if batch.shelf_temp:
            temp_anomalies = self._detect_anomalous_changes(batch.shelf_temp)
            for anomaly in temp_anomalies:
                anomaly["sensor"] = "shelf_temp"
                drift_issues.append(anomaly)
        
        if batch.product_temp:
            temp_anomalies = self._detect_anomalous_changes(batch.product_temp)
            for anomaly in temp_anomalies:
                anomaly["sensor"] = "product_temp"
                drift_issues.append(anomaly)
        
        if batch.vacuum:
            vac_anomalies = self._detect_vacuum_anomalies(batch.vacuum)
            for anomaly in vac_anomalies:
                anomaly["sensor"] = "vacuum"
                drift_issues.append(anomaly)
        
        if drift_issues:
            result.passed = False
            result.message = f"检测到{len(drift_issues)}个潜在传感器漂移问题"
            result.occurrences = drift_issues
            result.recommendations = [
                "校准温度和真空传感器",
                "检查传感器连接是否正常",
                "对比历史批次数据进行验证",
                "考虑更换老化的传感器",
            ]
        else:
            result.message = "未检测到明显的传感器漂移"
        
        result.details = {
            "drift_threshold_c": self.drift_threshold_c,
            "rate_threshold_c_min": self.rate_threshold_c_min,
            "issue_count": len(drift_issues),
        }
        
        return result
    
    def _detect_anomalous_changes(self, temp_data: TemperatureData) -> List[Dict[str, Any]]:
        """检测异常温度变化"""
        anomalies = []
        
        if len(temp_data) < 10:
            return anomalies
        
        values = np.array(temp_data.values)
        timestamps = temp_data.timestamps
        
        for i in range(1, len(values)):
            time_diff = (timestamps[i] - timestamps[i-1]).total_seconds() / 60
            
            if time_diff <= 0:
                continue
            
            value_diff = values[i] - values[i-1]
            rate = abs(value_diff) / time_diff
            
            if rate > self.rate_threshold_c_min * 5:
                anomalies.append({
                    "issue_type": "rapid_change",
                    "time": timestamps[i].isoformat(),
                    "change_c": float(value_diff),
                    "rate_c_min": float(rate),
                    "threshold_c_min": self.rate_threshold_c_min * 5,
                    "message": f"温度变化速率异常: {rate:.2f}°C/min",
                })
        
        if len(values) >= 20:
            window_size = 10
            for i in range(window_size, len(values) - window_size):
                before_mean = np.mean(values[i-window_size:i])
                after_mean = np.mean(values[i:i+window_size])
                mean_diff = abs(after_mean - before_mean)
                
                if mean_diff > self.drift_threshold_c:
                    anomalies.append({
                        "issue_type": "step_change",
                        "time": timestamps[i].isoformat(),
                        "before_mean_c": float(before_mean),
                        "after_mean_c": float(after_mean),
                        "diff_c": float(mean_diff),
                        "threshold_c": self.drift_threshold_c,
                        "message": f"检测到阶跃式温度变化: {mean_diff:.2f}°C",
                    })
                    break
        
        return anomalies
    
    def _detect_vacuum_anomalies(self, vac_data: VacuumData) -> List[Dict[str, Any]]:
        """检测真空异常"""
        anomalies = []
        
        if len(vac_data) < 10:
            return anomalies
        
        values = np.array(vac_data.values)
        
        if np.any(values < 0):
            anomalies.append({
                "issue_type": "negative_reading",
                "message": "检测到负值真空读数，传感器可能存在问题",
            })
        
        if np.max(values) < 1:
            anomalies.append({
                "issue_type": "too_low",
                "max_reading": float(np.max(values)),
                "message": "真空读数异常低，可能存在传感器问题",
            })
        
        if np.std(values) < 0.1:
            anomalies.append({
                "issue_type": "stagnant",
                "std_dev": float(np.std(values)),
                "message": "真空读数过于平稳，可能存在传感器故障",
            })
        
        return anomalies


class PrematureHeatingRule(BaseRule):
    """过早升温规则
    
    检测：一次干燥未完成就升温
    风险：产品塌陷，水分超标
    """
    
    rule_type = RuleType.PREMATURE_HEATING
    rule_name = "过早升温检测"
    severity = RuleSeverity.CRITICAL
    
    DEFAULT_TEMP_RISE_THRESHOLD = 10.0
    DEFAULT_MIN_STABLE_TIME_MIN = 60.0
    
    def __init__(self, 
                 temp_rise_threshold_c: float = None,
                 min_stable_time_min: float = None,
                 **kwargs):
        super().__init__(**kwargs)
        self.temp_rise_threshold_c = temp_rise_threshold_c or self.DEFAULT_TEMP_RISE_THRESHOLD
        self.min_stable_time_min = min_stable_time_min or self.DEFAULT_MIN_STABLE_TIME_MIN
    
    def check(self, batch: BatchData) -> RuleCheckResult:
        result = RuleCheckResult(
            rule_type=self.rule_type,
            rule_name=self.rule_name,
            passed=True,
            severity=self.severity
        )
        
        if not batch.shelf_temp or not batch.product_temp:
            result.message = "温度数据不足，无法进行过早升温检测"
            result.details = {
                "shelf_temp_available": batch.shelf_temp is not None,
                "product_temp_available": batch.product_temp is not None,
            }
            return result
        
        issues = []
        
        shelf_temps = np.array(batch.shelf_temp.values)
        product_temps = np.array(batch.product_temp.values)
        timestamps = batch.shelf_temp.timestamps
        
        if len(shelf_temps) < 20 or len(product_temps) < 20:
            result.message = "数据点不足，无法进行准确的过早升温检测"
            return result
        
        min_len = min(len(shelf_temps), len(product_temps))
        shelf_temps = shelf_temps[:min_len]
        product_temps = product_temps[:min_len]
        
        temp_diff = shelf_temps - product_temps
        
        heating_start_idx = None
        for i in range(10, min_len - 5):
            window_shelf = shelf_temps[i:i+5]
            if np.all(window_shelf > 0) and np.mean(window_shelf) > np.mean(shelf_temps[:i]):
                if np.mean(np.diff(window_shelf)) > 0.1:
                    heating_start_idx = i
                    break
        
        if heating_start_idx is not None and heating_start_idx > 10:
            before_diff = temp_diff[:heating_start_idx]
            before_shelf = shelf_temps[:heating_start_idx]
            before_product = product_temps[:heating_start_idx]
            
            diff_increase = np.max(before_diff) - np.min(before_diff)
            
            if diff_increase < 5.0 and np.max(before_product) < -20:
                product_stable = np.std(before_product[-20:]) < 1.0
                shelf_rising = np.mean(np.diff(before_shelf[-20:])) > 0.05
                
                if product_stable and shelf_rising:
                    issues.append({
                        "heating_start_time": timestamps[heating_start_idx].isoformat(),
                        "issue_type": "premature_heating",
                        "product_temp_before_heating_c": float(np.mean(before_product[-10:])),
                        "shelf_temp_trend": "rising",
                        "message": "检测到一次干燥可能未完成时搁板开始升温",
                    })
        
        shelf_increase = np.max(shelf_temps) - np.min(shelf_temps)
        product_increase = np.max(product_temps) - np.min(product_temps)
        
        if shelf_increase > 50 and product_increase < shelf_increase * 0.3:
            if np.max(product_temps) < -10:
                issues.append({
                    "issue_type": "temperature_divergence",
                    "shelf_increase_c": float(shelf_increase),
                    "product_increase_c": float(product_increase),
                    "max_product_temp_c": float(np.max(product_temps)),
                    "message": "搁板温度显著上升但产品温度仍较低，可能存在过早升温",
                })
        
        if issues:
            result.passed = False
            result.message = f"检测到{len(issues)}个过早升温风险"
            result.occurrences = issues
            result.recommendations = [
                "延长一次干燥时间，确保冰完全升华",
                "通过产品温度平台期判断一次干燥终点",
                "降低升温速率，确保产品温度稳定上升",
                "考虑使用压力升测试确认一次干燥终点",
            ]
        else:
            result.message = "未检测到明显的过早升温迹象"
        
        result.details = {
            "heating_start_idx": heating_start_idx,
            "shelf_temp_range_c": float(np.max(shelf_temps) - np.min(shelf_temps)) if len(shelf_temps) > 0 else 0,
            "product_temp_range_c": float(np.max(product_temps) - np.min(product_temps)) if len(product_temps) > 0 else 0,
        }
        
        return result


class RuleEngine:
    """规则引擎"""
    
    DEFAULT_RULES = [
        VacuumFluctuationRule,
        TemperatureExceedanceRule,
        PlateauInsufficiencyRule,
        SensorDriftRule,
        PrematureHeatingRule,
    ]
    
    def __init__(self, rules: Optional[List[Type[BaseRule]]] = None, **rule_kwargs):
        self.rules: List[BaseRule] = []
        
        rule_classes = rules or self.DEFAULT_RULES
        
        for rule_class in rule_classes:
            rule_instance = rule_class(**rule_kwargs)
            self.rules.append(rule_instance)
    
    def add_rule(self, rule: BaseRule):
        """添加规则"""
        self.rules.append(rule)
    
    def run_all_checks(self, batch: BatchData) -> List[RuleCheckResult]:
        """运行所有规则检查"""
        results = []
        
        for rule in self.rules:
            try:
                result = rule.check(batch)
                results.append(result)
            except Exception as e:
                error_result = RuleCheckResult(
                    rule_type=rule.rule_type,
                    rule_name=rule.rule_name,
                    passed=True,
                    message=f"规则检查出错: {str(e)}",
                    details={"error": str(e)}
                )
                results.append(error_result)
        
        batch.check_results = [r.to_dict() for r in results]
        
        return results
    
    def get_failed_checks(self, results: List[RuleCheckResult]) -> List[RuleCheckResult]:
        """获取未通过的检查"""
        return [r for r in results if not r.passed]
    
    def get_critical_issues(self, results: List[RuleCheckResult]) -> List[RuleCheckResult]:
        """获取严重问题"""
        return [r for r in results if r.severity == RuleSeverity.CRITICAL and not r.passed]
    
    def generate_summary(self, results: List[RuleCheckResult]) -> Dict[str, Any]:
        """生成检查摘要"""
        total = len(results)
        passed = sum(1 for r in results if r.passed)
        failed = total - passed
        
        critical = sum(1 for r in results if r.severity == RuleSeverity.CRITICAL and not r.passed)
        warnings = sum(1 for r in results if r.severity == RuleSeverity.WARNING and not r.passed)
        
        recommendations = []
        for r in results:
            if not r.passed and r.recommendations:
                recommendations.extend(r.recommendations)
        
        unique_recommendations = list(dict.fromkeys(recommendations))
        
        return {
            "total_checks": total,
            "passed": passed,
            "failed": failed,
            "critical_issues": critical,
            "warnings": warnings,
            "overall_status": "PASS" if failed == 0 else ("CRITICAL" if critical > 0 else "WARNING"),
            "recommendations": unique_recommendations,
            "check_results": [r.to_dict() for r in results],
        }
