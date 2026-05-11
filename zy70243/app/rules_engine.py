from typing import List, Optional, Dict, Any
from enum import Enum

from app.models import (
    Cage, Pet, MedicalOrder, InfectionRisk, 
    AnimalType, CageStatus, HospitalizationStatus
)


class RuleViolationType(str, Enum):
    SPECIES_MISMATCH = "species_mismatch"
    INFECTION_RISK_TOO_HIGH = "infection_risk_too_high"
    CAGE_NOT_AVAILABLE = "cage_not_available"
    CAGE_OCCUPIED = "cage_occupied"
    ISOLATION_REQUIRED = "isolation_required"
    HIGH_RISK_NEEDS_ISOLATION = "high_risk_needs_isolation"


class RuleResult:
    def __init__(self, valid: bool, violations: List[Dict[str, Any]] = None, warnings: List[str] = None):
        self.valid = valid
        self.violations = violations or []
        self.warnings = warnings or []
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid": self.valid,
            "violations": self.violations,
            "warnings": self.warnings
        }


class CageRulesEngine:
    INFECTION_RISK_ORDER = [
        InfectionRisk.NONE,
        InfectionRisk.LOW,
        InfectionRisk.MEDIUM,
        InfectionRisk.HIGH
    ]
    
    @staticmethod
    def _risk_level(risk: InfectionRisk) -> int:
        return CageRulesEngine.INFECTION_RISK_ORDER.index(risk)
    
    @staticmethod
    def check_cage_compatibility(
        cage: Cage,
        pet: Pet,
        medical_order: MedicalOrder,
        current_occupant: Optional[Pet] = None
    ) -> RuleResult:
        violations = []
        warnings = []
        
        if cage.status != CageStatus.AVAILABLE:
            violations.append({
                "type": RuleViolationType.CAGE_NOT_AVAILABLE,
                "message": f"笼位 {cage.cage_number} 当前状态为 {cage.status}，不可用",
                "details": {"current_status": cage.status}
            })
        
        if cage.current_pet_id is not None:
            violations.append({
                "type": RuleViolationType.CAGE_OCCUPIED,
                "message": f"笼位 {cage.cage_number} 已被占用",
                "details": {"current_pet_id": cage.current_pet_id}
            })
        
        if cage.suitable_species:
            suitable_list = [s.strip() for s in cage.suitable_species.split(",")]
            if pet.species.value not in suitable_list:
                violations.append({
                    "type": RuleViolationType.SPECIES_MISMATCH,
                    "message": f"笼位 {cage.cage_number} 不适合 {pet.species.value} 种类的动物",
                    "details": {
                        "cage_suitable": suitable_list,
                        "pet_species": pet.species.value
                    }
                })
        
        pet_risk = medical_order.infection_risk
        cage_max_risk = cage.max_infection_risk
        
        if CageRulesEngine._risk_level(pet_risk) > CageRulesEngine._risk_level(cage_max_risk):
            violations.append({
                "type": RuleViolationType.INFECTION_RISK_TOO_HIGH,
                "message": f"宠物传染风险等级 {pet_risk} 超过笼位最大允许等级 {cage_max_risk}",
                "details": {
                    "pet_risk": pet_risk,
                    "cage_max_risk": cage_max_risk
                }
            })
        
        if pet_risk in [InfectionRisk.HIGH, InfectionRisk.MEDIUM]:
            if not cage.is_isolation:
                violations.append({
                    "type": RuleViolationType.HIGH_RISK_NEEDS_ISOLATION,
                    "message": f"传染风险等级为 {pet_risk} 的宠物需要隔离笼位",
                    "details": {
                        "pet_risk": pet_risk,
                        "is_isolation": cage.is_isolation
                    }
                })
        
        if medical_order.required_special_care:
            warnings.append(f"该宠物需要特殊护理: {medical_order.required_special_care}")
        
        if medical_order.estimated_stay_days and medical_order.estimated_stay_days > 14:
            warnings.append(f"预计住院时间较长 ({medical_order.estimated_stay_days}天)，建议考虑长期笼位安排")
        
        return RuleResult(valid=len(violations) == 0, violations=violations, warnings=warnings)
    
    @staticmethod
    def check_transfer_compatibility(
        source_cage: Cage,
        target_cage: Cage,
        pet: Pet,
        medical_order: MedicalOrder
    ) -> RuleResult:
        violations = []
        warnings = []
        
        target_check = CageRulesEngine.check_cage_compatibility(
            target_cage, pet, medical_order
        )
        
        violations.extend(target_check.violations)
        warnings.extend(target_check.warnings)
        
        if source_cage.id == target_cage.id:
            warnings.append("源笼位和目标笼位相同，无需转笼")
        
        if target_cage.is_isolation and not source_cage.is_isolation:
            warnings.append("从普通笼位转至隔离笼位，请确保已完成消毒流程")
        
        return RuleResult(valid=len(violations) == 0, violations=violations, warnings=warnings)
    
    @staticmethod
    def find_suitable_cages(
        cages: List[Cage],
        pet: Pet,
        medical_order: MedicalOrder
    ) -> List[Dict[str, Any]]:
        suitable_cages = []
        
        for cage in cages:
            result = CageRulesEngine.check_cage_compatibility(cage, pet, medical_order)
            if result.valid:
                suitable_cages.append({
                    "cage": cage,
                    "compatibility_score": CageRulesEngine._calculate_score(cage, medical_order),
                    "warnings": result.warnings
                })
        
        suitable_cages.sort(key=lambda x: x["compatibility_score"], reverse=True)
        return suitable_cages
    
    @staticmethod
    def _calculate_score(cage: Cage, medical_order: MedicalOrder) -> int:
        score = 0
        
        if cage.is_isolation and medical_order.infection_risk in [InfectionRisk.HIGH, InfectionRisk.MEDIUM]:
            score += 50
        elif not cage.is_isolation and medical_order.infection_risk in [InfectionRisk.LOW, InfectionRisk.NONE]:
            score += 30
        
        risk_match = CageRulesEngine._risk_level(cage.max_infection_risk) - CageRulesEngine._risk_level(medical_order.infection_risk)
        score += max(0, 10 - risk_match * 2)
        
        return score
