"""QASM解析器测试"""

import pytest
from qc_grader.parser import QasmParser, GateRuleValidator, GateRule, QasmGateType
from qc_grader import examples


class TestQasmParser:
    def test_parse_bell_state(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_BELL_STATE
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        assert parsed.num_qubits == 2
        assert parsed.num_clbits == 2
        assert len(parsed.gates) >= 4
        
        gate_names = [g.name for g in parsed.gates]
        assert "h" in gate_names
        assert "cx" in gate_names
        assert "measure" in gate_names

    def test_parse_hadamard(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_HADAMARD
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        assert parsed.num_qubits == 1
        assert len(parsed.used_qubits) == 1
        assert 0 in parsed.used_qubits

    def test_gate_count(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_BELL_STATE
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        assert "h" in parsed.gate_count
        assert parsed.gate_count["h"] == 1
        assert "cx" in parsed.gate_count
        assert parsed.gate_count["cx"] == 1

    def test_gate_depth(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_3QUBIT_GHZ
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        assert parsed.gate_depth >= 3

    def test_syntax_error(self):
        parser = QasmParser()
        invalid_qasm = """
        OPENQASM 2.0;
        qreg q[1];
        invalid_gate q[0];
        """
        parsed, errors = parser.parse(invalid_qasm)
        
        assert len(errors) > 0


class TestGateRuleValidator:
    def test_forbidden_gate(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_WITH_FORBIDDEN_GATE
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        rules = GateRule()
        rules.forbidden_gates = {"ccx", "toffoli"}
        
        validator = GateRuleValidator()
        violations = validator.validate(parsed, rules)
        
        assert len(violations) > 0
        assert any(v.violation_type == "forbidden_gate" for v in violations)

    def test_max_depth(self):
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
        assert any(v.violation_type == "depth_exceeded" for v in violations)

    def test_max_qubits(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_BELL_STATE
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        rules = GateRule()
        rules.max_qubits = 1
        
        validator = GateRuleValidator()
        violations = validator.validate(parsed, rules)
        
        assert len(violations) > 0
        assert any(v.violation_type == "too_many_qubits" for v in violations)

    def test_required_qubits(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_HADAMARD
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        rules = GateRule()
        rules.required_qubits = [0, 1]
        
        validator = GateRuleValidator()
        violations = validator.validate(parsed, rules)
        
        assert len(violations) > 0

    def test_allowed_gates(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_BELL_STATE
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        rules = GateRule()
        rules.allowed_gates = {"h", "measure"}
        
        validator = GateRuleValidator()
        violations = validator.validate(parsed, rules)
        
        assert len(violations) > 0
        assert any(v.violation_type == "disallowed_gate" for v in violations)

    def test_no_violations(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_BELL_STATE
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        rules = GateRule()
        rules.max_depth = 10
        rules.max_qubits = 5
        
        validator = GateRuleValidator()
        violations = validator.validate(parsed, rules)
        
        assert len(violations) == 0
