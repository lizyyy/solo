"""状态向量模拟器测试"""

import pytest
import numpy as np
from qc_grader.simulator import StateVectorSimulator, ProbabilityComparator
from qc_grader.parser import QasmParser
from qc_grader import examples


class TestStateVectorSimulator:
    def test_simulate_hadamard(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_HADAMARD
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        simulator = StateVectorSimulator()
        result = simulator.simulate(parsed, shots=1024)
        
        assert result.num_qubits == 1
        assert "0" in result.probabilities
        assert "1" in result.probabilities
        
        assert abs(result.probabilities["0"] - 0.5) < 0.01
        assert abs(result.probabilities["1"] - 0.5) < 0.01

    def test_simulate_bell_state(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_BELL_STATE
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        simulator = StateVectorSimulator()
        result = simulator.simulate(parsed, shots=1024)
        
        assert result.num_qubits == 2
        
        assert "00" in result.probabilities
        assert "11" in result.probabilities
        
        assert abs(result.probabilities["00"] - 0.5) < 0.01
        assert abs(result.probabilities["11"] - 0.5) < 0.01
        
        assert result.probabilities.get("01", 0) < 0.01
        assert result.probabilities.get("10", 0) < 0.01

    def test_simulate_ghz_state(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_3QUBIT_GHZ
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        simulator = StateVectorSimulator()
        result = simulator.simulate(parsed, shots=1024)
        
        assert result.num_qubits == 3
        
        assert "000" in result.probabilities
        assert "111" in result.probabilities
        
        assert abs(result.probabilities["000"] - 0.5) < 0.01
        assert abs(result.probabilities["111"] - 0.5) < 0.01

    def test_sampling_consistency(self):
        parser = QasmParser()
        qasm = examples.EXAMPLE_QASM_HADAMARD
        parsed, errors = parser.parse(qasm)
        
        assert len(errors) == 0
        assert parsed is not None
        
        simulator = StateVectorSimulator()
        result = simulator.simulate(parsed, shots=10000)
        
        total_count = sum(result.counts.values())
        assert total_count == 10000
        
        freq_0 = result.counts.get("0", 0) / 10000
        freq_1 = result.counts.get("1", 0) / 10000
        
        assert abs(freq_0 - 0.5) < 0.05
        assert abs(freq_1 - 0.5) < 0.05


class TestProbabilityComparator:
    def test_exact_match(self):
        comparator = ProbabilityComparator(tolerance=0.01)
        
        simulated = {"0": 0.5, "1": 0.5}
        expected = {"0": 0.5, "1": 0.5}
        
        passed, differences, warnings = comparator.compare(simulated, expected, num_qubits=1)
        
        assert passed is True
        assert len(warnings) == 0

    def test_within_tolerance(self):
        comparator = ProbabilityComparator(tolerance=0.1)
        
        simulated = {"0": 0.55, "1": 0.45}
        expected = {"0": 0.5, "1": 0.5}
        
        passed, differences, warnings = comparator.compare(simulated, expected, num_qubits=1)
        
        assert passed is True
        assert len(warnings) == 0

    def test_exceeds_tolerance(self):
        comparator = ProbabilityComparator(tolerance=0.05)
        
        simulated = {"0": 0.8, "1": 0.2}
        expected = {"0": 0.5, "1": 0.5}
        
        passed, differences, warnings = comparator.compare(simulated, expected, num_qubits=1)
        
        assert passed is False
        assert len(warnings) > 0

    def test_normalization(self):
        comparator = ProbabilityComparator(tolerance=0.01)
        
        simulated = {"0": 50, "1": 50}
        expected = {"0": 0.5, "1": 0.5}
        
        passed, differences, warnings = comparator.compare(simulated, expected, num_qubits=1)
        
        assert passed is True

    def test_missing_states(self):
        comparator = ProbabilityComparator(tolerance=0.01)
        
        simulated = {"00": 0.5}
        expected = {"00": 0.5, "11": 0.5}
        
        passed, differences, warnings = comparator.compare(simulated, expected, num_qubits=2)
        
        assert passed is False
