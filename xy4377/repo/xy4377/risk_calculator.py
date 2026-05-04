from sqlalchemy.orm import Session
from typing import List, Dict, Any
from datetime import datetime
import json

from models import (
    Stall, Circuit, Generator, DrillRecord, RiskResult,
    RiskType, RiskSeverity, RiskStatus
)


class RiskCalculator:
    def __init__(self, db: Session):
        self.db = db
        self.load_threshold = 0.9
        self.phase_imbalance_threshold = 0.15

    def calculate_circuit_load(self, circuit: Circuit) -> float:
        total_load = self.db.query(Stall).filter(
            Stall.circuit_id == circuit.id
        ).with_entities(Stall.power_required_kw).all()
        return sum(load[0] for load in total_load)

    def check_circuit_overload(self) -> List[Dict[str, Any]]:
        risks = []
        circuits = self.db.query(Circuit).all()
        
        for circuit in circuits:
            current_load = self.calculate_circuit_load(circuit)
            max_capacity = circuit.max_capacity_kw
            load_ratio = current_load / max_capacity if max_capacity > 0 else 1.0
            
            if load_ratio > self.load_threshold:
                risks.append({
                    "risk_type": RiskType.CIRCUIT_OVERLOAD,
                    "description": f"回路 '{circuit.name}' (配电箱: {circuit.panel_name}) 超载: 当前负载 {current_load:.2f}kW / 额定容量 {max_capacity}kW ({load_ratio*100:.1f}%)",
                    "severity": RiskSeverity.CRITICAL if load_ratio > 1.0 else RiskSeverity.HIGH,
                    "circuit_id": circuit.id,
                    "calculated_value": current_load,
                    "threshold_value": max_capacity * self.load_threshold,
                })
        
        return risks

    def check_phase_imbalance(self) -> List[Dict[str, Any]]:
        risks = []
        generators = self.db.query(Generator).all()
        
        for generator in generators:
            phase_loads = {"L1": 0.0, "L2": 0.0, "L3": 0.0}
            generator_circuits = self.db.query(Circuit).filter(
                Circuit.generator_id == generator.id
            ).all()
            
            for circuit in generator_circuits:
                load = self.calculate_circuit_load(circuit)
                phase = circuit.phase
                if phase in phase_loads:
                    phase_loads[phase] += load
            
            total_load = sum(phase_loads.values())
            if total_load > 0:
                avg_load = total_load / 3
                max_deviation = max(
                    abs(phase_loads["L1"] - avg_load),
                    abs(phase_loads["L2"] - avg_load),
                    abs(phase_loads["L3"] - avg_load)
                )
                imbalance_ratio = max_deviation / avg_load if avg_load > 0 else 0
                
                if imbalance_ratio > self.phase_imbalance_threshold:
                    risks.append({
                        "risk_type": RiskType.PHASE_IMBALANCE,
                        "description": f"发电机 '{generator.name}' 三相不平衡: L1={phase_loads['L1']:.2f}kW, L2={phase_loads['L2']:.2f}kW, L3={phase_loads['L3']:.2f}kW, 不平衡度 {imbalance_ratio*100:.1f}%",
                        "severity": RiskSeverity.HIGH,
                        "generator_id": generator.id,
                        "calculated_value": imbalance_ratio,
                        "threshold_value": self.phase_imbalance_threshold,
                    })
        
        return risks

    def check_generator_redundancy(self) -> List[Dict[str, Any]]:
        risks = []
        generators = self.db.query(Generator).all()
        
        for generator in generators:
            total_load = 0.0
            generator_circuits = self.db.query(Circuit).filter(
                Circuit.generator_id == generator.id
            ).all()
            
            for circuit in generator_circuits:
                total_load += self.calculate_circuit_load(circuit)
            
            capacity = generator.capacity_kw
            redundancy_threshold = generator.redundancy_threshold
            required_capacity = total_load * (1 + redundancy_threshold)
            
            if capacity < required_capacity:
                risks.append({
                    "risk_type": RiskType.GENERATOR_INSUFFICIENT,
                    "description": f"发电机 '{generator.name}' 冗余不足: 总负载 {total_load:.2f}kW, 需要 {required_capacity:.2f}kW ({(redundancy_threshold*100):.0f}%冗余), 当前容量 {capacity}kW",
                    "severity": RiskSeverity.CRITICAL,
                    "generator_id": generator.id,
                    "calculated_value": capacity,
                    "threshold_value": required_capacity,
                })
        
        return risks

    def check_rcd_missing(self) -> List[Dict[str, Any]]:
        risks = []
        rain_protected_stalls = self.db.query(Stall).filter(
            Stall.is_rain_protected == True,
            Stall.has_rcd_protection == False
        ).all()
        
        for stall in rain_protected_stalls:
            circuit = self.db.query(Circuit).filter(Circuit.id == stall.circuit_id).first()
            circuit_name = circuit.name if circuit else "未知回路"
            
            risks.append({
                "risk_type": RiskType.RCD_MISSING,
                "description": f"雨棚摊位 '{stall.name}' (位置: {stall.location}) 未接漏电保护器(RCD), 所属回路: {circuit_name}",
                "severity": RiskSeverity.HIGH,
                "stall_id": stall.id,
                "circuit_id": stall.circuit_id,
            })
        
        return risks

    def check_drill_coverage(self) -> List[Dict[str, Any]]:
        risks = []
        
        latest_drill = self.db.query(DrillRecord).order_by(
            DrillRecord.drill_date.desc()
        ).first()
        
        if latest_drill:
            critical_stages_str = latest_drill.critical_stages or ""
            tested_stages_str = latest_drill.stages_tested or ""
            
            critical_stages = [s.strip() for s in critical_stages_str.split(",") if s.strip()]
            tested_stages = [s.strip() for s in tested_stages_str.split(",") if s.strip()]
            
            uncovered_stages = []
            for stage in critical_stages:
                if stage not in tested_stages:
                    uncovered_stages.append(stage)
            
            if uncovered_stages:
                risks.append({
                    "risk_type": RiskType.DRILL_INCOMPLETE,
                    "description": f"临时停电演练未覆盖关键舞台: 未覆盖 {', '.join(uncovered_stages)}。演练日期: {latest_drill.drill_date.strftime('%Y-%m-%d')}",
                    "severity": RiskSeverity.MEDIUM,
                    "calculated_value": len(uncovered_stages),
                    "threshold_value": 0,
                })
        
        return risks

    def calculate_all_risks(self) -> List[Dict[str, Any]]:
        all_risks = []
        all_risks.extend(self.check_circuit_overload())
        all_risks.extend(self.check_phase_imbalance())
        all_risks.extend(self.check_generator_redundancy())
        all_risks.extend(self.check_rcd_missing())
        all_risks.extend(self.check_drill_coverage())
        
        return all_risks

    def save_risks_to_db(self, risks: List[Dict[str, Any]], clear_existing: bool = True) -> int:
        if clear_existing:
            self.db.query(RiskResult).delete()
        
        for risk_data in risks:
            risk = RiskResult(
                risk_type=risk_data["risk_type"],
                description=risk_data["description"],
                severity=risk_data["severity"],
                status=RiskStatus.OPEN,
                circuit_id=risk_data.get("circuit_id"),
                stall_id=risk_data.get("stall_id"),
                generator_id=risk_data.get("generator_id"),
                calculated_value=risk_data.get("calculated_value"),
                threshold_value=risk_data.get("threshold_value"),
            )
            self.db.add(risk)
        
        self.db.commit()
        return len(risks)

    def recalculate_risks(self) -> Dict[str, Any]:
        self.db.query(RiskResult).filter(
            RiskResult.manual_override == False
        ).delete()
        
        risks = self.calculate_all_risks()
        
        for risk_data in risks:
            existing = self.db.query(RiskResult).filter(
                RiskResult.risk_type == risk_data["risk_type"],
                RiskResult.circuit_id == risk_data.get("circuit_id"),
                RiskResult.stall_id == risk_data.get("stall_id"),
                RiskResult.generator_id == risk_data.get("generator_id"),
                RiskResult.manual_override == True
            ).first()
            
            if not existing:
                risk = RiskResult(
                    risk_type=risk_data["risk_type"],
                    description=risk_data["description"],
                    severity=risk_data["severity"],
                    status=RiskStatus.OPEN,
                    circuit_id=risk_data.get("circuit_id"),
                    stall_id=risk_data.get("stall_id"),
                    generator_id=risk_data.get("generator_id"),
                    calculated_value=risk_data.get("calculated_value"),
                    threshold_value=risk_data.get("threshold_value"),
                )
                self.db.add(risk)
        
        self.db.commit()
        
        total_risks = self.db.query(RiskResult).count()
        open_risks = self.db.query(RiskResult).filter(
            RiskResult.status == RiskStatus.OPEN
        ).count()
        
        return {
            "message": "Risk recalculation completed",
            "total_risks": total_risks,
            "open_risks": open_risks,
            "new_risks_found": len(risks),
        }
