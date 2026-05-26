from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime, timedelta
import json


class RuleResult:
    def __init__(self, passed: bool, violations: List[str], suggestions: List[str]):
        self.passed = passed
        self.violations = violations
        self.suggestions = suggestions


class WindSpeedRule:
    def validate(self, record: Dict[str, Any], weather: Optional[Dict[str, Any]], chemical: Optional[Dict[str, Any]]) -> RuleResult:
        violations = []
        suggestions = []

        if not weather:
            violations.append("缺少对应天气记录")
            suggestions.append("请补充天气记录或手动确认喷洒条件")
            return RuleResult(False, violations, suggestions)

        if not chemical:
            violations.append("缺少药剂信息")
            suggestions.append("请检查药剂编码是否正确")
            return RuleResult(False, violations, suggestions)

        wind_speed = weather.get("wind_speed", 0)
        wind_limit = chemical.get("wind_speed_limit", 5.0)

        if wind_speed > wind_limit:
            violations.append(f"风速超标: 当前{wind_speed}m/s，限制{wind_limit}m/s")
            suggestions.append(f"建议等待风速降至{wind_limit}m/s以下再作业，或更换抗风型药剂")

        return RuleResult(len(violations) == 0, violations, suggestions)


class DosageRule:
    def validate(self, record: Dict[str, Any], chemical: Optional[Dict[str, Any]]) -> RuleResult:
        violations = []
        suggestions = []

        if not chemical:
            violations.append("缺少药剂信息")
            suggestions.append("请检查药剂编码是否正确")
            return RuleResult(False, violations, suggestions)

        dosage = record.get("dosage", 0)
        max_dosage = chemical.get("max_dosage_per_100m2", 0)

        if dosage > max_dosage * 1.2:
            violations.append(f"用量严重超标: 当前{dosage}g/100㎡，上限{max_dosage}g/100㎡")
            suggestions.append(f"用量超过上限20%，请立即核查！建议降至{max_dosage}g/100㎡以内")
        elif dosage > max_dosage:
            violations.append(f"用量超标: 当前{dosage}g/100㎡，上限{max_dosage}g/100㎡")
            suggestions.append(f"用量略超上限，建议调整至{max_dosage}g/100㎡，需主管确认")

        return RuleResult(len(violations) == 0, violations, suggestions)


class SafetyIntervalRule:
    def validate(self, record: Dict[str, Any], chemical: Optional[Dict[str, Any]], history_records: List[Dict[str, Any]]) -> RuleResult:
        violations = []
        suggestions = []

        if not chemical:
            violations.append("缺少药剂信息")
            suggestions.append("请检查药剂编码是否正确")
            return RuleResult(False, violations, suggestions)

        min_interval = chemical.get("min_interval_days", 7)
        current_date_str = record.get("spray_date", "")
        area_code = record.get("area_code", "")
        chemical_code = record.get("chemical_code", "")

        try:
            current_date = datetime.strptime(current_date_str, "%Y-%m-%d")
        except ValueError:
            violations.append("日期格式错误")
            suggestions.append("请使用YYYY-MM-DD格式填写日期")
            return RuleResult(False, violations, suggestions)

        for hist in history_records:
            if hist.get("area_code") != area_code:
                continue
            if hist.get("chemical_code") != chemical_code:
                continue

            hist_date_str = hist.get("spray_date", "")
            try:
                hist_date = datetime.strptime(hist_date_str, "%Y-%m-%d")
                days_diff = (current_date - hist_date).days

                if days_diff < min_interval:
                    violations.append(f"安全间隔不足: 距上次喷洒仅{days_diff}天，要求{min_interval}天")
                    next_allowed = hist_date + timedelta(days=min_interval)
                    suggestions.append(f"建议推迟至{next_allowed.strftime('%Y-%m-%d')}后作业，或更换其他药剂")
                    break
            except ValueError:
                continue

        return RuleResult(len(violations) == 0, violations, suggestions)


class RuleEngine:
    def __init__(self):
        self.wind_rule = WindSpeedRule()
        self.dosage_rule = DosageRule()
        self.interval_rule = SafetyIntervalRule()

    def validate(self, record: Dict[str, Any], weather_map: Dict[str, Any], chemical_map: Dict[str, Any],
                 history_records: List[Dict[str, Any]]) -> Tuple[str, List[str], str]:
        all_violations = []
        all_suggestions = []
        status = "normal"

        weather = weather_map.get(record.get("weather_code", ""))
        chemical = chemical_map.get(record.get("chemical_code", ""))

        wind_result = self.wind_rule.validate(record, weather, chemical)
        if not wind_result.passed:
            all_violations.extend(wind_result.violations)
            all_suggestions.extend(wind_result.suggestions)

        dosage_result = self.dosage_rule.validate(record, chemical)
        if not dosage_result.passed:
            all_violations.extend(dosage_result.violations)
            all_suggestions.extend(dosage_result.suggestions)

        interval_result = self.interval_rule.validate(record, chemical, history_records)
        if not interval_result.passed:
            all_violations.extend(interval_result.violations)
            all_suggestions.extend(interval_result.suggestions)

        if len(all_violations) > 0:
            has_severe = any("严重" in v or "立即" in s for v, s in zip(all_violations, all_suggestions))
            status = "failed" if has_severe else "confirm"

        suggestion_text = "；".join(all_suggestions) if all_suggestions else "无特殊建议"

        return status, all_violations, suggestion_text
