from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from config import settings


class GateConflictDetector:
    @staticmethod
    def detect_conflict(
        current_flight: Dict,
        other_flights: List[Dict],
        conflict_window_minutes: int = None
    ) -> Dict[str, Any]:
        if conflict_window_minutes is None:
            conflict_window_minutes = settings.MAX_GATE_CONFLICT_MINUTES
        
        conflicts = []
        risk_level = "low"
        
        current_gate = current_flight.get("gate_number")
        current_stand = current_flight.get("stand_number")
        current_arrival = current_flight.get("arrival_time")
        current_departure = current_flight.get("departure_time")
        current_deice_start = current_flight.get("deice_start_time")
        current_deice_end = current_flight.get("deice_end_time")
        
        for other in other_flights:
            other_gate = other.get("gate_number")
            other_stand = other.get("stand_number")
            
            gate_match = (current_gate and other_gate and current_gate == other_gate)
            stand_match = (current_stand and other_stand and current_stand == other_stand)
            
            if not (gate_match or stand_match):
                continue
            
            conflict = GateConflictDetector._check_time_overlap(
                current_arrival, current_departure,
                other.get("arrival_time"), other.get("departure_time"),
                conflict_window_minutes
            )
            
            if conflict:
                conflicts.append({
                    "flight_number": other.get("flight_number"),
                    "conflict_type": "gate_schedule",
                    "gate_number": other_gate,
                    "stand_number": other_stand,
                    "overlap_minutes": conflict.get("overlap_minutes"),
                    "conflict_window": conflict_window_minutes,
                    "details": conflict.get("details")
                })
            
            deice_conflict = GateConflictDetector._check_deice_overlap(
                current_deice_start, current_deice_end,
                other.get("deice_start_time"), other.get("deice_end_time"),
                current_gate, other_gate,
                current_stand, other_stand
            )
            
            if deice_conflict:
                conflicts.append({
                    "flight_number": other.get("flight_number"),
                    "conflict_type": "deice_operation",
                    "gate_number": other_gate,
                    "stand_number": other_stand,
                    "overlap_minutes": deice_conflict.get("overlap_minutes"),
                    "details": deice_conflict.get("details")
                })
        
        risk_level = GateConflictDetector._determine_risk_level(conflicts)
        
        overlapping_flights = [c.get("flight_number") for c in conflicts]
        
        conflict_details = {
            "total_conflicts": len(conflicts),
            "gate_schedule_conflicts": len([c for c in conflicts if c["conflict_type"] == "gate_schedule"]),
            "deice_operation_conflicts": len([c for c in conflicts if c["conflict_type"] == "deice_operation"]),
            "conflicts": conflicts
        }
        
        return {
            "gate_conflict_risk": risk_level,
            "gate_conflict_details": str(conflict_details),
            "overlapping_flights": ", ".join(overlapping_flights) if overlapping_flights else None,
            "conflict_list": conflicts
        }
    
    @staticmethod
    def _check_time_overlap(
        start1: Optional[datetime], end1: Optional[datetime],
        start2: Optional[datetime], end2: Optional[datetime],
        window_minutes: int
    ) -> Optional[Dict]:
        if not all([start1, end1, start2, end2]):
            return None
        
        window = timedelta(minutes=window_minutes)
        
        effective_start1 = start1 - window
        effective_end1 = end1 + window
        
        overlap_start = max(effective_start1, start2)
        overlap_end = min(effective_end1, end2)
        
        if overlap_start < overlap_end:
            overlap_minutes = (overlap_end - overlap_start).total_seconds() / 60
            return {
                "overlap_minutes": round(overlap_minutes, 1),
                "details": f"时间重叠约 {round(overlap_minutes, 1)} 分钟（含 {window_minutes} 分钟缓冲期）"
            }
        
        return None
    
    @staticmethod
    def _check_deice_overlap(
        deice_start1: Optional[datetime], deice_end1: Optional[datetime],
        deice_start2: Optional[datetime], deice_end2: Optional[datetime],
        gate1: Optional[str], gate2: Optional[str],
        stand1: Optional[str], stand2: Optional[str]
    ) -> Optional[Dict]:
        if not all([deice_start1, deice_end1, deice_start2, deice_end2]):
            return None
        
        overlap_start = max(deice_start1, deice_start2)
        overlap_end = min(deice_end1, deice_end2)
        
        if overlap_start < overlap_end:
            overlap_minutes = (overlap_end - overlap_start).total_seconds() / 60
            location = ""
            if gate1 and gate1 == gate2:
                location = f"机位 {gate1}"
            elif stand1 and stand1 == stand2:
                location = f"停机位 {stand1}"
            else:
                location = "相邻区域"
            
            return {
                "overlap_minutes": round(overlap_minutes, 1),
                "details": f"{location}除冰作业时间重叠约 {round(overlap_minutes, 1)} 分钟"
            }
        
        return None
    
    @staticmethod
    def _determine_risk_level(conflicts: List[Dict]) -> str:
        if not conflicts:
            return "low"
        
        critical_count = 0
        for c in conflicts:
            overlap = c.get("overlap_minutes", 0)
            if overlap > 10:
                critical_count += 1
        
        if critical_count >= 2 or len(conflicts) >= 3:
            return "high"
        elif critical_count >= 1 or len(conflicts) >= 2:
            return "medium"
        else:
            return "low"
    
    @staticmethod
    def get_conflict_recommendations(risk_level: str, conflicts: List[Dict]) -> List[Dict]:
        recommendations = []
        
        if risk_level == "high":
            recommendations.append({
                "level": "critical",
                "message": "存在严重机位冲突风险",
                "action": "立即协调调度，调整机位或作业时间"
            })
        elif risk_level == "medium":
            recommendations.append({
                "level": "warning",
                "message": "存在机位冲突风险",
                "action": "密切监控，准备应急预案"
            })
        
        for conflict in conflicts:
            if conflict.get("conflict_type") == "gate_schedule":
                recommendations.append({
                    "level": "warning",
                    "message": f"与航班 {conflict['flight_number']} 机位调度冲突",
                    "action": conflict.get("details", "")
                })
            elif conflict.get("conflict_type") == "deice_operation":
                recommendations.append({
                    "level": "warning",
                    "message": f"与航班 {conflict['flight_number']} 除冰作业冲突",
                    "action": conflict.get("details", "")
                })
        
        return recommendations
