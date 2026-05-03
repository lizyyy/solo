from typing import List, Type, Dict
from collections import defaultdict

from freq_coordinator.models import (
    RiskItem,
    CommunicationPlan,
)
from freq_coordinator.scheduler.rules import SchedulerRules
from freq_coordinator.risk_engine.detectors import (
    RiskDetector,
    CoverageGapDetector,
    FrequencyConflictDetector,
    HandoverGapDetector,
    BatteryRiskDetector,
)


DEFAULT_DETECTORS = [
    CoverageGapDetector,
    FrequencyConflictDetector,
    HandoverGapDetector,
    BatteryRiskDetector,
]


class RiskEngine:
    def __init__(
        self,
        rules: SchedulerRules,
        plan: CommunicationPlan = None,
        detectors: List[Type[RiskDetector]] = None,
        min_handover_minutes: int = 10,
        safety_margin_hours: float = 1.0,
    ):
        self.rules = rules
        self.plan = plan
        self.detector_classes = detectors or DEFAULT_DETECTORS
        self.min_handover_minutes = min_handover_minutes
        self.safety_margin_hours = safety_margin_hours
        
        self.all_risks: List[RiskItem] = []
        self.risks_by_type: Dict[str, List[RiskItem]] = defaultdict(list)
        self.risks_by_severity: Dict[str, List[RiskItem]] = defaultdict(list)
    
    def run_all_detectors(self, plan: CommunicationPlan = None) -> List[RiskItem]:
        if plan:
            self.plan = plan
        
        self.all_risks = []
        self.risks_by_type = defaultdict(list)
        self.risks_by_severity = defaultdict(list)
        
        for detector_class in self.detector_classes:
            if detector_class == HandoverGapDetector:
                detector = detector_class(
                    self.rules,
                    self.plan,
                    min_handover_minutes=self.min_handover_minutes,
                )
            elif detector_class == BatteryRiskDetector:
                detector = detector_class(
                    self.rules,
                    self.plan,
                    safety_margin_hours=self.safety_margin_hours,
                )
            else:
                detector = detector_class(self.rules, self.plan)
            
            risks = detector.detect()
            self.all_risks.extend(risks)
            
            for risk in risks:
                self.risks_by_type[risk.type].append(risk)
                self.risks_by_severity[risk.severity].append(risk)
        
        self._sort_risks()
        return self.all_risks
    
    def _sort_risks(self):
        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        self.all_risks.sort(
            key=lambda r: (severity_order.get(r.severity, 999), r.type)
        )
    
    def get_risks_by_type(self, risk_type: str) -> List[RiskItem]:
        return self.risks_by_type.get(risk_type, [])
    
    def get_risks_by_severity(self, severity: str) -> List[RiskItem]:
        return self.risks_by_severity.get(severity, [])
    
    def get_critical_risks(self) -> List[RiskItem]:
        return self.get_risks_by_severity("critical")
    
    def get_high_risks(self) -> List[RiskItem]:
        return self.get_risks_by_severity("high")
    
    def get_summary(self) -> Dict[str, Dict[str, int]]:
        summary = {}
        for risk_type in self.risks_by_type:
            type_summary = defaultdict(int)
            for risk in self.risks_by_type[risk_type]:
                type_summary[risk.severity] += 1
                type_summary["total"] += 1
            summary[risk_type] = dict(type_summary)
        
        severity_summary = {
            "critical": len(self.get_critical_risks()),
            "high": len(self.get_high_risks()),
            "medium": len(self.get_risks_by_severity("medium")),
            "low": len(self.get_risks_by_severity("low")),
            "total": len(self.all_risks),
        }
        summary["by_severity"] = severity_summary
        
        return summary
    
    def has_critical_or_high_risks(self) -> bool:
        return len(self.get_critical_risks()) > 0 or len(self.get_high_risks()) > 0
