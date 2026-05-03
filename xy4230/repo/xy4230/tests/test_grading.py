"""评分引擎测试"""

import pytest
from qc_grader.grading import GradingEngine, GradingConfig, ScoreStatus
from qc_grader.parser import QasmParser, GateRuleValidator, GateRule
from qc_grader.simulator import StateVectorSimulator
from qc_grader import examples


class TestGradingEngine:
    def test_perfect_submission(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_BELL_STATE
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        simulator = StateVectorSimulator()
        sim_result = simulator.simulate(parsed, shots=1024)
        
        expected_dist = {"00": 0.5, "11": 0.5}
        
        rules = GateRule()
        validator = GateRuleValidator()
        violations = validator.validate(parsed, rules)
        
        config = GradingConfig(
            max_score=100.0,
            probability_tolerance=0.05
        )
        
        grader = GradingEngine(config)
        result = grader.grade_submission(
            parsed_qasm=parsed,
            parse_errors=errors,
            rule_violations=violations,
            simulation_result=sim_result,
            expected_distribution=expected_dist
        )
        
        assert result.total_score == 100.0
        assert result.percentage == 100.0
        assert result.status == ScoreStatus.PASSED
        assert len(result.deductions) == 0
        assert len(result.passed_checks) > 0

    def test_syntax_error_deduction(self):
        parser = QasmParser()
        invalid_qasm = """
        OPENQASM 2.0;
        qreg q[1];
        invalid_gate q[0];
        """
        parsed, errors = parser.parse(invalid_qasm)
        
        assert len(errors) > 0
        
        config = GradingConfig(
            max_score=100.0,
            syntax_error_penalty=50.0
        )
        
        grader = GradingEngine(config)
        result = grader.grade_submission(
            parsed_qasm=parsed,
            parse_errors=errors,
            rule_violations=[],
            simulation_result=None,
            expected_distribution={"0": 0.5}
        )
        
        assert result.total_score == 50.0
        assert len(result.deductions) > 0
        assert any(d.deduction_type == "syntax_error" for d in result.deductions)

    def test_forbidden_gate_deduction(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_WITH_FORBIDDEN_GATE
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        rules = GateRule()
        rules.forbidden_gates = {"ccx"}
        
        validator = GateRuleValidator()
        violations = validator.validate(parsed, rules)
        
        assert len(violations) > 0
        
        config = GradingConfig(
            max_score=100.0,
            forbidden_gate_penalty=20.0
        )
        
        grader = GradingEngine(config)
        result = grader.grade_submission(
            parsed_qasm=parsed,
            parse_errors=errors,
            rule_violations=violations,
            simulation_result=None,
            expected_distribution={}
        )
        
        assert result.total_score == 80.0
        assert len(result.deductions) > 0
        assert any(d.deduction_type == "forbidden_gate" for d in result.deductions)

    def test_depth_exceed_deduction(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_BELL_STATE
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        rules = GateRule()
        rules.max_depth = 1
        
        validator = GateRuleValidator()
        violations = validator.validate(parsed, rules)
        
        assert len(violations) > 0
        
        config = GradingConfig(
            max_score=100.0,
            depth_exceed_penalty=15.0
        )
        
        grader = GradingEngine(config)
        result = grader.grade_submission(
            parsed_qasm=parsed,
            parse_errors=errors,
            rule_violations=violations,
            simulation_result=None,
            expected_distribution={}
        )
        
        assert result.total_score == 85.0
        assert len(result.deductions) > 0
        assert any(d.deduction_type == "depth_exceeded" for d in result.deductions)

    def test_partial_credit(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_HADAMARD
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        simulator = StateVectorSimulator()
        sim_result = simulator.simulate(parsed, shots=1024)
        
        expected_dist = {"0": 1.0, "1": 0.0}
        
        rules = GateRule()
        validator = GateRuleValidator()
        violations = validator.validate(parsed, rules)
        
        config = GradingConfig(
            max_score=100.0,
            probability_deviation_penalty=25.0,
            partial_credit_for_proximity=True,
            probability_tolerance=0.05
        )
        
        grader = GradingEngine(config)
        result = grader.grade_submission(
            parsed_qasm=parsed,
            parse_errors=errors,
            rule_violations=violations,
            simulation_result=sim_result,
            expected_distribution=expected_dist
        )
        
        assert result.total_score < 100.0
        assert result.total_score > 0
        assert len(result.deductions) > 0
        assert any(d.deduction_type == "probability_deviation" for d in result.deductions)

    def test_failed_status(self):
        config = GradingConfig(max_score=100.0)
        grader = GradingEngine(config)
        
        result = grader.grade_submission(
            parsed_qasm=None,
            parse_errors=["语法错误1", "语法错误2", "语法错误3"],
            rule_violations=[],
            simulation_result=None,
            expected_distribution={}
        )
        
        assert result.status == ScoreStatus.FAILED
        assert result.percentage < 60.0

    def test_passed_status(self):
        config = GradingConfig(max_score=100.0)
        grader = GradingEngine(config)
        
        result = grader.grade_submission(
            parsed_qasm=None,
            parse_errors=[],
            rule_violations=[],
            simulation_result=None,
            expected_distribution=None
        )
        
        assert result.total_score == 100.0
        assert result.status == ScoreStatus.PASSED
