from abc import ABC, abstractmethod
from datetime import datetime
from typing import Dict, List, Any, Optional, Callable
from uuid import uuid4

from src.models import Sample, Fridge, Rack, HandoverRecord, Alert, AlertType


class BaseRule(ABC):
    
    def __init__(self, name: str, enabled: bool = True):
        self.name = name
        self.enabled = enabled
    
    @abstractmethod
    def check(self, context: Dict[str, Any]) -> List[Alert]:
        pass


class TimeoutRule(BaseRule):
    
    def __init__(self, timeout_minutes: float = 30.0):
        super().__init__("超时离柜检测")
        self.timeout_minutes = timeout_minutes
    
    def check(self, context: Dict[str, Any]) -> List[Alert]:
        alerts = []
        samples: List[Sample] = context.get("samples", [])
        
        for sample in samples:
            if sample.out_fridge_time and sample.in_fridge_time:
                duration = (sample.in_fridge_time - sample.out_fridge_time).total_seconds() / 60
                if duration > self.timeout_minutes:
                    alert = Alert(
                        alert_id=str(uuid4()),
                        alert_type=AlertType.TIMEOUT,
                        related_id=sample.sample_id,
                        related_type="Sample",
                        message=f"样本[{sample.sample_id}]离柜时间{duration:.1f}分钟，超过阈值{self.timeout_minutes}分钟",
                        timestamp=datetime.now()
                    )
                    alerts.append(alert)
            elif sample.out_fridge_time and not sample.in_fridge_time:
                current_time = context.get("current_time", datetime.now())
                duration = (current_time - sample.out_fridge_time).total_seconds() / 60
                if duration > self.timeout_minutes:
                    alert = Alert(
                        alert_id=str(uuid4()),
                        alert_type=AlertType.TIMEOUT,
                        related_id=sample.sample_id,
                        related_type="Sample",
                        message=f"样本[{sample.sample_id}]当前已离柜{duration:.1f}分钟，超过阈值{self.timeout_minutes}分钟",
                        timestamp=datetime.now()
                    )
                    alerts.append(alert)
        
        return alerts


class TemperatureRule(BaseRule):
    
    def __init__(self):
        super().__init__("温度越界检测")
    
    def check(self, context: Dict[str, Any]) -> List[Alert]:
        alerts = []
        fridges: List[Fridge] = context.get("fridges", [])
        temp_records: List[Dict] = context.get("temperature_records", [])
        
        for fridge in fridges:
            if fridge.current_temp is not None:
                if not fridge.is_temp_normal(fridge.current_temp):
                    alert = Alert(
                        alert_id=str(uuid4()),
                        alert_type=AlertType.TEMP_EXCEED,
                        related_id=fridge.fridge_id,
                        related_type="Fridge",
                        message=f"冰箱[{fridge.name}]当前温度{fridge.current_temp}℃，超出正常范围[{fridge.min_temp}-{fridge.max_temp}]℃",
                        timestamp=datetime.now()
                    )
                    alerts.append(alert)
        
        for record in temp_records:
            fridge_id = record.get("fridge_id", "")
            temp = record.get("temperature")
            record_time = record.get("timestamp", datetime.now())
            
            if temp is None:
                continue
            
            fridge = next((f for f in fridges if f.fridge_id == fridge_id), None)
            if not fridge:
                continue
            
            if not fridge.is_temp_normal(temp):
                alert = Alert(
                    alert_id=str(uuid4()),
                    alert_type=AlertType.TEMP_EXCEED,
                    related_id=fridge_id,
                    related_type="Fridge",
                    message=f"冰箱[{fridge.name}]在{record_time}记录温度{temp}℃，超出正常范围[{fridge.min_temp}-{fridge.max_temp}]℃",
                    timestamp=datetime.now()
                )
                alerts.append(alert)
        
        return alerts


class RackConflictRule(BaseRule):
    
    def __init__(self):
        super().__init__("架位冲突检测")
    
    def check(self, context: Dict[str, Any]) -> List[Alert]:
        alerts = []
        samples: List[Sample] = context.get("samples", [])
        racks: List[Rack] = context.get("racks", [])
        
        position_map: Dict[str, List[Sample]] = {}
        for sample in samples:
            if sample.status == "在柜" and sample.rack_id and sample.position:
                key = f"{sample.rack_id}:{sample.position}"
                if key not in position_map:
                    position_map[key] = []
                position_map[key].append(sample)
        
        for key, sample_list in position_map.items():
            if len(sample_list) > 1:
                sample_ids = [s.sample_id for s in sample_list]
                rack_id, position = key.split(":")
                
                rack = next((r for r in racks if r.rack_id == rack_id), None)
                rack_name = rack.rack_id if rack else rack_id
                
                alert = Alert(
                    alert_id=str(uuid4()),
                    alert_type=AlertType.RACK_CONFLICT,
                    related_id=rack_id,
                    related_type="Rack",
                    message=f"架位[{rack_name}-{position}]被多个样本占用: {', '.join(sample_ids)}",
                    timestamp=datetime.now()
                )
                alerts.append(alert)
        
        return alerts


class MissingSignatureRule(BaseRule):
    
    def __init__(self):
        super().__init__("缺签检测")
    
    def check(self, context: Dict[str, Any]) -> List[Alert]:
        alerts = []
        handover_records: List[HandoverRecord] = context.get("handover_records", [])
        
        for record in handover_records:
            if record.status.value in ["待交接", "交接中"]:
                current_time = context.get("current_time", datetime.now())
                hours_passed = (current_time - record.handover_time).total_seconds() / 3600
                
                if hours_passed > 24:
                    alert = Alert(
                        alert_id=str(uuid4()),
                        alert_type=AlertType.MISSING_SIGNATURE,
                        related_id=record.record_id,
                        related_type="Handover",
                        message=f"交接记录[{record.record_id}]超过{hours_passed:.1f}小时未确认签字",
                        timestamp=datetime.now()
                    )
                    alerts.append(alert)
        
        return alerts


class RuleEngine:
    
    def __init__(self):
        self.rules: Dict[str, BaseRule] = {}
    
    def register_rule(self, rule: BaseRule):
        self.rules[rule.name] = rule
    
    def unregister_rule(self, rule_name: str):
        if rule_name in self.rules:
            del self.rules[rule_name]
    
    def run_all(self, context: Dict[str, Any]) -> Dict[str, List[Alert]]:
        results = {}
        for rule_name, rule in self.rules.items():
            if rule.enabled:
                results[rule_name] = rule.check(context)
        return results
    
    def run_single(self, rule_name: str, context: Dict[str, Any]) -> List[Alert]:
        if rule_name in self.rules and self.rules[rule_name].enabled:
            return self.rules[rule_name].check(context)
        return []
    
    def get_all_alerts(self, context: Dict[str, Any]) -> List[Alert]:
        all_alerts = []
        results = self.run_all(context)
        for alerts in results.values():
            all_alerts.extend(alerts)
        return all_alerts


def create_default_engine() -> RuleEngine:
    engine = RuleEngine()
    engine.register_rule(TimeoutRule())
    engine.register_rule(TemperatureRule())
    engine.register_rule(RackConflictRule())
    engine.register_rule(MissingSignatureRule())
    return engine
