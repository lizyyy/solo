"""评分规则引擎 - 用于作业自动评分"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum
from .parser import RuleViolation, ParsedQasm
from .simulator import SimulationResult, ProbabilityComparator


class ScoreStatus(Enum):
    PASSED = "passed"
    PARTIAL = "partial"
    FAILED = "failed"


@dataclass
class ScoreDeduction:
    deduction_type: str
    description: str
    points_deducted: float
    max_possible: float
    severity: str = "error"
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ScoreResult:
    total_score: float
    max_score: float
    percentage: float
    status: ScoreStatus
    deductions: List[ScoreDeduction] = field(default_factory=list)
    passed_checks: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    summary_message: str = ""


@dataclass
class GradingConfig:
    max_score: float = 100.0
    syntax_error_penalty: float = 50.0
    forbidden_gate_penalty: float = 20.0
    depth_exceed_penalty: float = 15.0
    qubit_misuse_penalty: float = 15.0
    probability_deviation_penalty: float = 25.0
    probability_tolerance: float = 0.05
    partial_credit_for_proximity: bool = True
    require_all_probabilities_match: bool = True
    ignore_measure_order: bool = True


class GradingEngine:
    def __init__(self, config: Optional[GradingConfig] = None):
        self.config = config or GradingConfig()
        self.prob_comparator = ProbabilityComparator(self.config.probability_tolerance)

    def grade_submission(self,
                         parsed_qasm: Optional[ParsedQasm],
                         parse_errors: List[str],
                         rule_violations: List[RuleViolation],
                         simulation_result: Optional[SimulationResult],
                         expected_distribution: Optional[Dict[str, float]],
                         ) -> ScoreResult:
        
        score = self.config.max_score
        deductions: List[ScoreDeduction] = []
        passed_checks: List[str] = []
        details: Dict[str, Any] = {}
        
        if parse_errors:
            deduction = ScoreDeduction(
                deduction_type="syntax_error",
                description=f"QASM语法错误: {len(parse_errors)}处错误",
                points_deducted=self.config.syntax_error_penalty,
                max_possible=self.config.syntax_error_penalty,
                severity="error",
                details={"errors": parse_errors}
            )
            deductions.append(deduction)
            score -= deduction.points_deducted
        else:
            passed_checks.append("语法检查通过")
            details["syntax_check"] = "passed"
        
        if rule_violations:
            for violation in rule_violations:
                penalty = self._get_penalty_for_violation(violation)
                if penalty > 0:
                    deduction = ScoreDeduction(
                        deduction_type=violation.violation_type,
                        description=violation.message,
                        points_deducted=penalty,
                        max_possible=penalty,
                        severity=violation.severity,
                        details=violation.details
                    )
                    deductions.append(deduction)
                    score -= penalty
        
        if not rule_violations and parse_errors:
            pass
        elif not rule_violations:
            passed_checks.append("门规则检查通过")
            details["rule_check"] = "passed"
        
        if simulation_result and expected_distribution:
            prob_passed, prob_differences, prob_warnings = self.prob_comparator.compare(
                simulation_result.probabilities,
                expected_distribution,
                simulation_result.num_qubits
            )
            
            details["probability_comparison"] = prob_differences
            
            if prob_passed:
                passed_checks.append("概率分布检查通过")
                details["probability_check"] = "passed"
            else:
                if self.config.partial_credit_for_proximity:
                    avg_deviation = self._calculate_average_deviation(prob_differences)
                    penalty_ratio = min(1.0, avg_deviation / (self.config.probability_tolerance * 2))
                    penalty = self.config.probability_deviation_penalty * penalty_ratio
                else:
                    penalty = self.config.probability_deviation_penalty
                
                deduction = ScoreDeduction(
                    deduction_type="probability_deviation",
                    description=f"概率分布与期望不符: {len(prob_warnings)}个状态偏差",
                    points_deducted=round(penalty, 2),
                    max_possible=self.config.probability_deviation_penalty,
                    severity="error",
                    details={"warnings": prob_warnings, "differences": prob_differences}
                )
                deductions.append(deduction)
                score -= round(penalty, 2)
        elif expected_distribution:
            deduction = ScoreDeduction(
                deduction_type="simulation_failed",
                description="无法执行模拟以验证概率分布",
                points_deducted=self.config.probability_deviation_penalty,
                max_possible=self.config.probability_deviation_penalty,
                severity="error"
            )
            deductions.append(deduction)
            score -= deduction.points_deducted
        
        score = max(0.0, score)
        percentage = (score / self.config.max_score) * 100
        
        if percentage >= 90:
            status = ScoreStatus.PASSED
            summary_message = "作业通过验收"
        elif percentage >= 60:
            status = ScoreStatus.PARTIAL
            summary_message = "作业部分通过，存在可改进项"
        else:
            status = ScoreStatus.FAILED
            summary_message = "作业未通过，请检查错误并重新提交"
        
        if parsed_qasm:
            details["circuit_stats"] = {
                "num_qubits": parsed_qasm.num_qubits,
                "num_used_qubits": len(parsed_qasm.used_qubits),
                "gate_depth": parsed_qasm.gate_depth,
                "gate_count": parsed_qasm.gate_count.copy(),
                "num_gates": len(parsed_qasm.gates)
            }
        
        if simulation_result:
            details["simulation_stats"] = {
                "num_qubits": simulation_result.num_qubits,
                "num_shots": simulation_result.num_shots,
                "top_states": simulation_result.final_state_labels[:5] if simulation_result.final_state_labels else []
            }
        
        return ScoreResult(
            total_score=round(score, 2),
            max_score=self.config.max_score,
            percentage=round(percentage, 2),
            status=status,
            deductions=deductions,
            passed_checks=passed_checks,
            details=details,
            summary_message=summary_message
        )

    def _get_penalty_for_violation(self, violation: RuleViolation) -> float:
        violation_map = {
            "forbidden_gate": self.config.forbidden_gate_penalty,
            "disallowed_gate": self.config.forbidden_gate_penalty,
            "depth_exceeded": self.config.depth_exceed_penalty,
            "too_many_qubits": self.config.qubit_misuse_penalty,
            "too_few_qubits": self.config.qubit_misuse_penalty,
            "missing_qubits": self.config.qubit_misuse_penalty,
            "extra_qubits": self.config.qubit_misuse_penalty,
        }
        
        base_penalty = violation_map.get(violation.violation_type, 10.0)
        
        if violation.violation_type == "forbidden_gate":
            count = violation.details.get("count", 1)
            return min(base_penalty * count, self.config.forbidden_gate_penalty * 2)
        
        return base_penalty

    def _calculate_average_deviation(self, differences: Dict[str, Dict]) -> float:
        if not differences:
            return 0.0
        
        total_deviation = 0.0
        for state_info in differences.values():
            total_deviation += state_info.get("absolute_difference", 0.0)
        
        return total_deviation / len(differences)


class ProblemSet:
    def __init__(self):
        self.problems: Dict[str, Dict] = {}

    def add_problem(self,
                    problem_id: str,
                    expected_distribution: Dict[str, float],
                    gate_rules: Optional[Dict] = None,
                    description: str = "",
                    grading_config: Optional[Dict] = None):
        self.problems[problem_id] = {
            "id": problem_id,
            "description": description,
            "expected_distribution": expected_distribution,
            "gate_rules": gate_rules or {},
            "grading_config": grading_config or {}
        }

    def get_problem(self, problem_id: str) -> Optional[Dict]:
        return self.problems.get(problem_id)

    def list_problems(self) -> List[str]:
        return list(self.problems.keys())

    @classmethod
    def from_dict(cls, data: Dict) -> "ProblemSet":
        problem_set = cls()
        for pid, problem in data.items():
            problem_set.add_problem(
                problem_id=pid,
                expected_distribution=problem.get("expected_distribution", {}),
                gate_rules=problem.get("gate_rules", {}),
                description=problem.get("description", ""),
                grading_config=problem.get("grading_config", {})
            )
        return problem_set
