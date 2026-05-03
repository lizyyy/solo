"""状态向量模拟器模块 - 用于小规模量子电路模拟"""

import numpy as np
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from .parser import ParsedQasm, QasmGate, QasmGateType


@dataclass
class SimulationResult:
    statevector: np.ndarray
    probabilities: Dict[str, float]
    counts: Dict[str, int]
    num_shots: int = 1024
    num_qubits: int = 0
    measurements: Dict[int, int] = field(default_factory=dict)
    final_state_labels: List[str] = field(default_factory=list)
    circuit_depth: int = 0


class StateVectorSimulator:
    def __init__(self, epsilon: float = 1e-10):
        self.epsilon = epsilon
        self._gate_matrices = self._initialize_gate_matrices()

    def _initialize_gate_matrices(self) -> Dict[str, np.ndarray]:
        sqrt2 = np.sqrt(2)
        return {
            "h": np.array([[1, 1], [1, -1]], dtype=complex) / sqrt2,
            "x": np.array([[0, 1], [1, 0]], dtype=complex),
            "y": np.array([[0, -1j], [1j, 0]], dtype=complex),
            "z": np.array([[1, 0], [0, -1]], dtype=complex),
            "s": np.array([[1, 0], [0, 1j]], dtype=complex),
            "sdg": np.array([[1, 0], [0, -1j]], dtype=complex),
            "t": np.array([[1, 0], [0, np.exp(1j * np.pi / 4)]], dtype=complex),
            "tdg": np.array([[1, 0], [0, np.exp(-1j * np.pi / 4)]], dtype=complex),
            "id": np.eye(2, dtype=complex),
        }

    def simulate(self, parsed_qasm: ParsedQasm, shots: int = 1024) -> SimulationResult:
        num_qubits = parsed_qasm.num_qubits
        
        if num_qubits == 0:
            num_qubits = max(parsed_qasm.used_qubits) + 1 if parsed_qasm.used_qubits else 1
        
        if num_qubits > 20:
            raise ValueError(f"量子比特数 {num_qubits} 过多，状态向量模拟仅支持最多 20 个量子比特")
        
        state = np.zeros(2 ** num_qubits, dtype=complex)
        state[0] = 1.0
        
        for gate in parsed_qasm.gates:
            if gate.gate_type == QasmGateType.MEASURE:
                continue
            if gate.gate_type == QasmGateType.BARRIER:
                continue
            if gate.gate_type == QasmGateType.RESET:
                continue
            
            state = self._apply_gate(state, gate, num_qubits)
        
        probabilities = self._calculate_probabilities(state, num_qubits)
        counts = self._sample_counts(probabilities, num_qubits, shots)
        
        final_state_labels = self._get_final_state_labels(probabilities)
        
        return SimulationResult(
            statevector=state,
            probabilities=probabilities,
            counts=counts,
            num_shots=shots,
            num_qubits=num_qubits,
            measurements=parsed_qasm.measurements,
            final_state_labels=final_state_labels,
            circuit_depth=parsed_qasm.gate_depth
        )

    def _apply_gate(self, state: np.ndarray, gate: QasmGate, num_qubits: int) -> np.ndarray:
        gate_name = gate.name.lower()
        
        if gate_name in self._gate_matrices:
            return self._apply_single_qubit_gate(state, gate, num_qubits)
        elif gate_name in ["cx", "cnot", "control"]:
            return self._apply_cnot(state, gate, num_qubits)
        elif gate_name == "cz":
            return self._apply_cz(state, gate, num_qubits)
        elif gate_name == "swap":
            return self._apply_swap(state, gate, num_qubits)
        elif gate_name == "ccx":
            return self._apply_toffoli(state, gate, num_qubits)
        elif gate_name in ["u", "u3"]:
            return self._apply_u3(state, gate, num_qubits)
        elif gate_name == "u2":
            return self._apply_u2(state, gate, num_qubits)
        elif gate_name == "u1":
            return self._apply_u1(state, gate, num_qubits)
        elif gate_name in ["rx", "ry", "rz", "p"]:
            return self._apply_rotation(state, gate, num_qubits)
        elif gate_name in ["crx", "cry", "crz", "cp"]:
            return self._apply_controlled_rotation(state, gate, num_qubits)
        else:
            return state

    def _qubit_bit_position(self, qubit_idx: int, num_qubits: int) -> int:
        return num_qubits - 1 - qubit_idx

    def _apply_single_qubit_gate(self, state: np.ndarray, gate: QasmGate, num_qubits: int) -> np.ndarray:
        target = gate.qubits[0]
        gate_matrix = self._gate_matrices[gate.name.lower()]
        
        return self._apply_matrix_to_qubit(state, gate_matrix, target, num_qubits)

    def _apply_matrix_to_qubit(self, state: np.ndarray, matrix: np.ndarray, 
                                target: int, num_qubits: int) -> np.ndarray:
        new_state = np.zeros_like(state)
        
        for i in range(2 ** num_qubits):
            mask = 1 << self._qubit_bit_position(target, num_qubits)
            
            i0 = i & ~mask
            i1 = i | mask
            
            if i == i0:
                new_state[i] += matrix[0, 0] * state[i0] + matrix[0, 1] * state[i1]
            elif i == i1:
                new_state[i] += matrix[1, 0] * state[i0] + matrix[1, 1] * state[i1]
        
        return new_state

    def _apply_cnot(self, state: np.ndarray, gate: QasmGate, num_qubits: int) -> np.ndarray:
        control = gate.qubits[0]
        target = gate.qubits[1]
        
        control_bit = 1 << self._qubit_bit_position(control, num_qubits)
        target_bit = 1 << self._qubit_bit_position(target, num_qubits)
        
        new_state = np.zeros_like(state)
        
        for i in range(2 ** num_qubits):
            if i & control_bit:
                new_i = i ^ target_bit
                new_state[new_i] += state[i]
            else:
                new_state[i] += state[i]
        
        return new_state

    def _apply_cz(self, state: np.ndarray, gate: QasmGate, num_qubits: int) -> np.ndarray:
        control = gate.qubits[0]
        target = gate.qubits[1]
        
        control_bit = 1 << self._qubit_bit_position(control, num_qubits)
        target_bit = 1 << self._qubit_bit_position(target, num_qubits)
        
        new_state = state.copy()
        
        for i in range(2 ** num_qubits):
            if (i & control_bit) and (i & target_bit):
                new_state[i] *= -1
        
        return new_state

    def _apply_swap(self, state: np.ndarray, gate: QasmGate, num_qubits: int) -> np.ndarray:
        q1 = gate.qubits[0]
        q2 = gate.qubits[1]
        
        bit1 = 1 << self._qubit_bit_position(q1, num_qubits)
        bit2 = 1 << self._qubit_bit_position(q2, num_qubits)
        
        new_state = np.zeros_like(state)
        
        for i in range(2 ** num_qubits):
            b1 = (i & bit1) != 0
            b2 = (i & bit2) != 0
            
            new_i = i
            if b1:
                new_i = (new_i & ~bit1) | bit2
            else:
                new_i = new_i & ~bit2
            
            if b2:
                new_i = (new_i & ~bit2) | bit1
            else:
                new_i = new_i & ~bit1
            
            new_state[new_i] += state[i]
        
        return new_state

    def _apply_toffoli(self, state: np.ndarray, gate: QasmGate, num_qubits: int) -> np.ndarray:
        c1 = gate.qubits[0]
        c2 = gate.qubits[1]
        target = gate.qubits[2]
        
        c1_bit = 1 << self._qubit_bit_position(c1, num_qubits)
        c2_bit = 1 << self._qubit_bit_position(c2, num_qubits)
        target_bit = 1 << self._qubit_bit_position(target, num_qubits)
        
        new_state = np.zeros_like(state)
        
        for i in range(2 ** num_qubits):
            if (i & c1_bit) and (i & c2_bit):
                new_i = i ^ target_bit
                new_state[new_i] += state[i]
            else:
                new_state[i] += state[i]
        
        return new_state

    def _apply_u3(self, state: np.ndarray, gate: QasmGate, num_qubits: int) -> np.ndarray:
        target = gate.qubits[0]
        if len(gate.params) >= 3:
            theta, phi, lam = gate.params[0], gate.params[1], gate.params[2]
        elif len(gate.params) >= 2:
            theta, phi, lam = gate.params[0], gate.params[1], 0
        else:
            theta, phi, lam = gate.params[0] if gate.params else 0, 0, 0
        
        u3_matrix = np.array([
            [np.cos(theta/2), -np.exp(1j * lam) * np.sin(theta/2)],
            [np.exp(1j * phi) * np.sin(theta/2), 
             np.exp(1j * (phi + lam)) * np.cos(theta/2)]
        ], dtype=complex)
        
        return self._apply_matrix_to_qubit(state, u3_matrix, target, num_qubits)

    def _apply_u2(self, state: np.ndarray, gate: QasmGate, num_qubits: int) -> np.ndarray:
        target = gate.qubits[0]
        phi = gate.params[0] if len(gate.params) > 0 else 0
        lam = gate.params[1] if len(gate.params) > 1 else 0
        
        gate.params = [np.pi/2, phi, lam]
        return self._apply_u3(state, gate, num_qubits)

    def _apply_u1(self, state: np.ndarray, gate: QasmGate, num_qubits: int) -> np.ndarray:
        target = gate.qubits[0]
        lam = gate.params[0] if gate.params else 0
        
        u1_matrix = np.array([
            [1, 0],
            [0, np.exp(1j * lam)]
        ], dtype=complex)
        
        return self._apply_matrix_to_qubit(state, u1_matrix, target, num_qubits)

    def _apply_rotation(self, state: np.ndarray, gate: QasmGate, num_qubits: int) -> np.ndarray:
        target = gate.qubits[0]
        angle = gate.params[0] if gate.params else 0
        gate_name = gate.name.lower()
        
        if gate_name == "rx":
            matrix = np.array([
                [np.cos(angle/2), -1j * np.sin(angle/2)],
                [-1j * np.sin(angle/2), np.cos(angle/2)]
            ], dtype=complex)
        elif gate_name == "ry":
            matrix = np.array([
                [np.cos(angle/2), -np.sin(angle/2)],
                [np.sin(angle/2), np.cos(angle/2)]
            ], dtype=complex)
        elif gate_name == "rz" or gate_name == "p":
            matrix = np.array([
                [1, 0],
                [0, np.exp(1j * angle)]
            ], dtype=complex)
        else:
            matrix = np.eye(2, dtype=complex)
        
        return self._apply_matrix_to_qubit(state, matrix, target, num_qubits)

    def _apply_controlled_rotation(self, state: np.ndarray, gate: QasmGate, num_qubits: int) -> np.ndarray:
        control = gate.qubits[0]
        target = gate.qubits[1]
        angle = gate.params[0] if gate.params else 0
        gate_name = gate.name.lower()
        
        if gate_name == "crx":
            matrix = np.array([
                [np.cos(angle/2), -1j * np.sin(angle/2)],
                [-1j * np.sin(angle/2), np.cos(angle/2)]
            ], dtype=complex)
        elif gate_name == "cry":
            matrix = np.array([
                [np.cos(angle/2), -np.sin(angle/2)],
                [np.sin(angle/2), np.cos(angle/2)]
            ], dtype=complex)
        elif gate_name == "crz":
            matrix = np.array([
                [np.exp(-1j * angle/2), 0],
                [0, np.exp(1j * angle/2)]
            ], dtype=complex)
        elif gate_name == "cp":
            matrix = np.array([
                [1, 0],
                [0, np.exp(1j * angle)]
            ], dtype=complex)
        else:
            matrix = np.eye(2, dtype=complex)
        
        control_bit = 1 << self._qubit_bit_position(control, num_qubits)
        
        new_state = state.copy()
        
        for i in range(2 ** num_qubits):
            if i & control_bit:
                mask = 1 << self._qubit_bit_position(target, num_qubits)
                i0 = i & ~mask
                i1 = i | mask
                
                if i == i0:
                    new_state[i] = matrix[0, 0] * state[i0] + matrix[0, 1] * state[i1]
                elif i == i1:
                    new_state[i] = matrix[1, 0] * state[i0] + matrix[1, 1] * state[i1]
        
        return new_state

    def _calculate_probabilities(self, state: np.ndarray, num_qubits: int) -> Dict[str, float]:
        probs = np.abs(state) ** 2
        
        result = {}
        for i, prob in enumerate(probs):
            if prob > self.epsilon:
                binary = format(i, f'0{num_qubits}b')
                result[binary] = float(prob)
        
        return result

    def _sample_counts(self, probabilities: Dict[str, float], num_qubits: int, shots: int) -> Dict[str, int]:
        if not probabilities:
            return {}
        
        states = []
        probs_list = []
        
        for i in range(2 ** num_qubits):
            binary = format(i, f'0{num_qubits}b')
            states.append(binary)
            probs_list.append(probabilities.get(binary, 0.0))
        
        if sum(probs_list) < 1.0 - self.epsilon:
            missing = 1.0 - sum(probs_list)
            for i in range(len(probs_list)):
                probs_list[i] += missing / len(probs_list)
        
        probs_list = [p / sum(probs_list) for p in probs_list]
        
        samples = np.random.choice(states, size=shots, p=probs_list)
        
        counts = {}
        for sample in samples:
            counts[sample] = counts.get(sample, 0) + 1
        
        return counts

    def _get_final_state_labels(self, probabilities: Dict[str, float]) -> List[str]:
        sorted_states = sorted(probabilities.items(), key=lambda x: x[1], reverse=True)
        return [f"|{state}⟩: {prob:.6f}" for state, prob in sorted_states if prob > self.epsilon]


class ProbabilityComparator:
    def __init__(self, tolerance: float = 0.05):
        self.tolerance = tolerance

    def compare(self, simulated: Dict[str, float], expected: Dict[str, float], 
                num_qubits: Optional[int] = None) -> Tuple[bool, Dict[str, Dict], List[str]]:
        if num_qubits is None:
            all_states = set(simulated.keys()) | set(expected.keys())
            if all_states:
                num_qubits = len(next(iter(all_states)))
            else:
                num_qubits = 1
        
        normalized_simulated = self._normalize_and_fill(simulated, num_qubits)
        normalized_expected = self._normalize_and_fill(expected, num_qubits)
        
        differences = {}
        warnings = []
        
        all_states = set(normalized_simulated.keys()) | set(normalized_expected.keys())
        
        for state in all_states:
            sim_prob = normalized_simulated.get(state, 0.0)
            exp_prob = normalized_expected.get(state, 0.0)
            
            abs_diff = abs(sim_prob - exp_prob)
            rel_diff = 0.0
            if exp_prob > 1e-10:
                rel_diff = abs_diff / exp_prob
            
            differences[state] = {
                "simulated": sim_prob,
                "expected": exp_prob,
                "absolute_difference": abs_diff,
                "relative_difference": rel_diff,
                "within_tolerance": abs_diff <= self.tolerance
            }
            
            if abs_diff > self.tolerance:
                warnings.append(
                    f"状态 |{state}⟩ 概率偏差过大: 模拟 {sim_prob:.6f}, 期望 {exp_prob:.6f}, "
                    f"绝对偏差 {abs_diff:.6f} > 容差 {self.tolerance}"
                )
        
        passed = len(warnings) == 0
        
        return passed, differences, warnings

    def _normalize_and_fill(self, probs: Dict[str, float], num_qubits: int) -> Dict[str, float]:
        if not probs:
            num_states = 2 ** num_qubits
            return {format(i, f'0{num_qubits}b'): 1.0/num_states for i in range(num_states)}
        
        total = sum(probs.values())
        if abs(total - 1.0) > 1e-6:
            normalized = {k: v / total for k, v in probs.items()}
        else:
            normalized = probs.copy()
        
        result = {}
        for i in range(2 ** num_qubits):
            binary = format(i, f'0{num_qubits}b')
            result[binary] = normalized.get(binary, 0.0)
        
        return result
