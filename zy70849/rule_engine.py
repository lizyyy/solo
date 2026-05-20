from typing import List, Dict, Any
from schemas import MaterialItem, ResultStatus
from models import AuditRule

class RuleEngine:
    def __init__(self):
        self.rules = []
    
    def load_rules(self, rules: List[AuditRule]):
        self.rules = [r for r in rules if r.is_active]
    
    def execute(self, materials: List[MaterialItem], policy: Dict, submission: Dict) -> List[Dict]:
        results = []
        
        for material in materials:
            material_results = self._check_material_against_rules(material, policy, submission, materials)
            results.extend(material_results)
        
        batch_results = self._check_batch_level_rules(materials, policy, submission)
        results.extend(batch_results)
        
        return results
    
    def _check_material_against_rules(self, material: MaterialItem, policy: Dict, submission: Dict, all_materials: List[MaterialItem]) -> List[Dict]:
        results = []
        
        for rule in self.rules:
            if rule.rule_type != "material":
                continue
                
            is_violated = self._evaluate_condition(rule.condition, material, policy, submission, all_materials)
            
            if is_violated:
                results.append({
                    "material_type": material.material_type,
                    "file_name": material.file_name,
                    "rule_code": rule.rule_code,
                    "rule_name": rule.rule_name,
                    "result_status": ResultStatus.FAILED if rule.severity == "high" else ResultStatus.PENDING,
                    "suggestion": rule.suggestion,
                    "source_rule": f"{rule.rule_code}-{rule.rule_name}",
                    "original_fields": {
                        "material_type": material.material_type,
                        "file_name": material.file_name,
                        "amount": material.amount
                    }
                })
        
        if not any(r["material_type"] == material.material_type for r in results):
            results.append({
                "material_type": material.material_type,
                "file_name": material.file_name,
                "rule_code": "PASS_001",
                "rule_name": "材料校验通过",
                "result_status": ResultStatus.NORMAL,
                "suggestion": "材料齐全且符合要求",
                "source_rule": "系统默认规则",
                "original_fields": {
                    "material_type": material.material_type,
                    "file_name": material.file_name,
                    "amount": material.amount
                }
            })
        
        return results
    
    def _check_batch_level_rules(self, materials: List[MaterialItem], policy: Dict, submission: Dict) -> List[Dict]:
        results = []
        
        for rule in self.rules:
            if rule.rule_type != "batch":
                continue
                
            is_violated = self._evaluate_batch_condition(rule.condition, materials, policy, submission)
            
            if is_violated:
                results.append({
                    "material_type": None,
                    "file_name": None,
                    "rule_code": rule.rule_code,
                    "rule_name": rule.rule_name,
                    "result_status": ResultStatus.FAILED if rule.severity == "high" else ResultStatus.PENDING,
                    "suggestion": rule.suggestion,
                    "source_rule": f"{rule.rule_code}-{rule.rule_name}",
                    "original_fields": {
                        "batch_no": submission.get("batch_no", ""),
                        "total_amount": submission.get("total_amount", 0)
                    }
                })
        
        return results
    
    def _evaluate_condition(self, condition: str, material: MaterialItem, policy: Dict, submission: Dict, all_materials: List[MaterialItem]) -> bool:
        context = {
            "material": material,
            "policy": policy,
            "submission": submission,
            "material_type": material.material_type,
            "amount": material.amount,
            "file_name": material.file_name,
            "materials": all_materials,
            "any": any,
            "m": material
        }
        try:
            return bool(eval(condition, {"__builtins__": {}}, context))
        except Exception as e:
            return False
    
    def _evaluate_batch_condition(self, condition: str, materials: List[MaterialItem], policy: Dict, submission: Dict) -> bool:
        context = {
            "materials": materials,
            "policy": policy,
            "submission": submission,
            "total_amount": submission.get("total_amount", 0),
            "coverage_amount": policy.get("coverage_amount", 0)
        }
        try:
            return eval(condition, {"__builtins__": {}}, context)
        except:
            return False

rule_engine = RuleEngine()
