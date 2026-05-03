"""OpenQASM 解析器和门规则验证模块"""

import re
from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional, Tuple
from enum import Enum


class QasmGateType(Enum):
    SINGLE_QUBIT = "single_qubit"
    TWO_QUBIT = "two_qubit"
    MEASURE = "measure"
    BARRIER = "barrier"
    RESET = "reset"


@dataclass
class QasmGate:
    name: str
    qubits: List[int]
    params: List[float] = field(default_factory=list)
    gate_type: QasmGateType = QasmGateType.SINGLE_QUBIT
    line_number: int = 0


@dataclass
class ParsedQasm:
    version: str = "2.0"
    num_qubits: int = 0
    num_clbits: int = 0
    gates: List[QasmGate] = field(default_factory=list)
    measurements: Dict[int, int] = field(default_factory=dict)
    used_qubits: Set[int] = field(default_factory=set)
    used_clbits: Set[int] = field(default_factory=set)
    gate_depth: int = 0
    gate_count: Dict[str, int] = field(default_factory=dict)


@dataclass
class GateRule:
    forbidden_gates: Set[str] = field(default_factory=set)
    allowed_gates: Optional[Set[str]] = None
    max_depth: Optional[int] = None
    max_qubits: Optional[int] = None
    min_qubits: Optional[int] = None
    required_qubits: Optional[List[int]] = None


@dataclass
class RuleViolation:
    rule_name: str
    violation_type: str
    message: str
    details: Dict = field(default_factory=dict)
    severity: str = "error"


class QasmParser:
    SINGLE_QUBIT_GATES = {
        "h", "x", "y", "z", "s", "sdg", "t", "tdg",
        "id", "u", "u1", "u2", "u3", "rx", "ry", "rz", "p"
    }
    
    TWO_QUBIT_GATES = {
        "cx", "cz", "swap", "cnot", "control", "controlled",
        "crx", "cry", "crz", "cp", "cs", "ct", "ch"
    }
    
    THREE_QUBIT_GATES = {"ccx", "cswap", "toffoli", "fredkin"}

    def __init__(self):
        self.parsed: Optional[ParsedQasm] = None
        self.errors: List[str] = []

    def parse(self, qasm_content: str) -> Tuple[Optional[ParsedQasm], List[str]]:
        self.parsed = ParsedQasm()
        self.errors = []
        lines = qasm_content.strip().split("\n")
        
        qubit_declarations: Dict[str, int] = {}
        clbit_declarations: Dict[str, int] = {}
        
        for line_num, line in enumerate(lines, 1):
            line = self._strip_comments(line).strip()
            if not line:
                continue
            
            if line.startswith("OPENQASM"):
                self._parse_version(line)
            elif line.startswith("include"):
                continue
            elif line.startswith("qreg"):
                self._parse_qreg(line, qubit_declarations)
            elif line.startswith("creg"):
                self._parse_creg(line, clbit_declarations)
            elif line.startswith("measure"):
                self._parse_measure(line, qubit_declarations, clbit_declarations, line_num)
            elif line.startswith("barrier"):
                self._parse_barrier(line, qubit_declarations, line_num)
            elif line.startswith("reset"):
                self._parse_reset(line, qubit_declarations, line_num)
            else:
                self._parse_gate(line, qubit_declarations, line_num)
        
        if self.parsed:
            self._calculate_gate_depth()
            self._update_used_qubits()
        
        return self.parsed, self.errors

    def _strip_comments(self, line: str) -> str:
        if "//" in line:
            line = line[:line.index("//")]
        return line

    def _parse_version(self, line: str):
        match = re.match(r"OPENQASM\s+(\d+\.\d+)\s*;", line)
        if match:
            self.parsed.version = match.group(1)

    def _parse_qreg(self, line: str, declarations: Dict[str, int]):
        match = re.match(r"qreg\s+(\w+)\[(\d+)\]\s*;", line)
        if match:
            name = match.group(1)
            size = int(match.group(2))
            declarations[name] = size
            self.parsed.num_qubits += size

    def _parse_creg(self, line: str, declarations: Dict[str, int]):
        match = re.match(r"creg\s+(\w+)\[(\d+)\]\s*;", line)
        if match:
            name = match.group(1)
            size = int(match.group(2))
            declarations[name] = size
            self.parsed.num_clbits += size

    def _parse_measure(self, line: str, q_regs: Dict[str, int], c_regs: Dict[str, int], line_num: int):
        match = re.match(r"measure\s+(\w+)\[(\d+)\]\s*->\s*(\w+)\[(\d+)\]\s*;", line)
        if match:
            q_reg, q_idx = match.group(1), int(match.group(2))
            c_reg, c_idx = match.group(3), int(match.group(4))
            
            if q_reg not in q_regs:
                self.errors.append(f"第{line_num}行: 未定义的量子寄存器 {q_reg}")
                return
            if q_idx >= q_regs[q_reg]:
                self.errors.append(f"第{line_num}行: 量子比特索引超出范围 {q_reg}[{q_idx}]")
                return
            
            qubit = self._get_absolute_qubit_index(q_reg, q_idx, q_regs)
            clbit = self._get_absolute_clbit_index(c_reg, c_idx, c_regs)
            
            self.parsed.measurements[qubit] = clbit
            self.parsed.used_qubits.add(qubit)
            self.parsed.used_clbits.add(clbit)
            
            gate = QasmGate(
                name="measure",
                qubits=[qubit],
                gate_type=QasmGateType.MEASURE,
                line_number=line_num
            )
            self.parsed.gates.append(gate)

    def _parse_barrier(self, line: str, q_regs: Dict[str, int], line_num: int):
        match = re.match(r"barrier\s+(.+?)\s*;", line)
        if match:
            targets = self._parse_qubit_targets(match.group(1), q_regs)
            if targets:
                gate = QasmGate(
                    name="barrier",
                    qubits=targets,
                    gate_type=QasmGateType.BARRIER,
                    line_number=line_num
                )
                self.parsed.gates.append(gate)

    def _parse_reset(self, line: str, q_regs: Dict[str, int], line_num: int):
        match = re.match(r"reset\s+(\w+)\[(\d+)\]\s*;", line)
        if match:
            q_reg, q_idx = match.group(1), int(match.group(2))
            qubit = self._get_absolute_qubit_index(q_reg, q_idx, q_regs)
            
            gate = QasmGate(
                name="reset",
                qubits=[qubit],
                gate_type=QasmGateType.RESET,
                line_number=line_num
            )
            self.parsed.gates.append(gate)
            self.parsed.used_qubits.add(qubit)

    def _parse_gate(self, line: str, q_regs: Dict[str, int], line_num: int):
        gate_match = re.match(r"([\w\d]+)\s*(\(([^)]+)\))?\s+(.+?)\s*;", line)
        if gate_match:
            gate_name = gate_match.group(1)
            params_str = gate_match.group(3)
            targets_str = gate_match.group(4)
            
            params = []
            if params_str:
                try:
                    params = [float(p.strip()) for p in params_str.split(",")]
                except ValueError:
                    self.errors.append(f"第{line_num}行: 无效的门参数: {params_str}")
                    return
            
            targets = self._parse_qubit_targets(targets_str, q_regs)
            if not targets:
                self.errors.append(f"第{line_num}行: 无法解析量子比特操作数")
                return
            
            gate_type = self._get_gate_type(gate_name, len(targets))
            
            gate = QasmGate(
                name=gate_name,
                qubits=targets,
                params=params,
                gate_type=gate_type,
                line_number=line_num
            )
            self.parsed.gates.append(gate)
            
            if gate_name not in self.parsed.gate_count:
                self.parsed.gate_count[gate_name] = 0
            self.parsed.gate_count[gate_name] += 1
            
            for qubit in targets:
                self.parsed.used_qubits.add(qubit)
        elif line:
            self.errors.append(f"第{line_num}行: 无法解析的语句: {line}")

    def _parse_qubit_targets(self, targets_str: str, q_regs: Dict[str, int]) -> List[int]:
        targets = []
        for target in targets_str.split(","):
            target = target.strip()
            match = re.match(r"(\w+)\[(\d+)\]", target)
            if match:
                reg_name = match.group(1)
                idx = int(match.group(2))
                if reg_name in q_regs:
                    abs_idx = self._get_absolute_qubit_index(reg_name, idx, q_regs)
                    targets.append(abs_idx)
        return targets

    def _get_absolute_qubit_index(self, reg_name: str, idx: int, q_regs: Dict[str, int]) -> int:
        offset = 0
        for name, size in q_regs.items():
            if name == reg_name:
                return offset + idx
            offset += size
        return idx

    def _get_absolute_clbit_index(self, reg_name: str, idx: int, c_regs: Dict[str, int]) -> int:
        offset = 0
        for name, size in c_regs.items():
            if name == reg_name:
                return offset + idx
            offset += size
        return idx

    def _get_gate_type(self, gate_name: str, num_qubits: int) -> QasmGateType:
        if gate_name in self.SINGLE_QUBIT_GATES or num_qubits == 1:
            return QasmGateType.SINGLE_QUBIT
        elif gate_name in self.TWO_QUBIT_GATES or num_qubits == 2:
            return QasmGateType.TWO_QUBIT
        return QasmGateType.TWO_QUBIT

    def _calculate_gate_depth(self):
        if not self.parsed.gates:
            self.parsed.gate_depth = 0
            return
        
        last_op_on_qubit: Dict[int, int] = {}
        max_depth = 0
        
        for gate in self.parsed.gates:
            if gate.gate_type in [QasmGateType.BARRIER, QasmGateType.MEASURE, QasmGateType.RESET]:
                continue
            
            current_depth = 1
            for qubit in gate.qubits:
                if qubit in last_op_on_qubit:
                    current_depth = max(current_depth, last_op_on_qubit[qubit] + 1)
            
            for qubit in gate.qubits:
                last_op_on_qubit[qubit] = current_depth
            
            max_depth = max(max_depth, current_depth)
        
        self.parsed.gate_depth = max_depth

    def _update_used_qubits(self):
        for gate in self.parsed.gates:
            for qubit in gate.qubits:
                self.parsed.used_qubits.add(qubit)


class GateRuleValidator:
    def __init__(self):
        pass

    def validate(self, parsed_qasm: ParsedQasm, rules: GateRule) -> List[RuleViolation]:
        violations = []
        
        if rules.forbidden_gates:
            violations.extend(self._check_forbidden_gates(parsed_qasm, rules))
        
        if rules.allowed_gates is not None:
            violations.extend(self._check_allowed_gates(parsed_qasm, rules))
        
        if rules.max_depth is not None:
            violations.extend(self._check_max_depth(parsed_qasm, rules))
        
        if rules.max_qubits is not None:
            violations.extend(self._check_max_qubits(parsed_qasm, rules))
        
        if rules.min_qubits is not None:
            violations.extend(self._check_min_qubits(parsed_qasm, rules))
        
        if rules.required_qubits is not None:
            violations.extend(self._check_required_qubits(parsed_qasm, rules))
        
        return violations

    def _check_forbidden_gates(self, parsed_qasm: ParsedQasm, rules: GateRule) -> List[RuleViolation]:
        violations = []
        for gate_name in parsed_qasm.gate_count:
            if gate_name in rules.forbidden_gates:
                violations.append(RuleViolation(
                    rule_name="禁用门检查",
                    violation_type="forbidden_gate",
                    message=f"使用了禁用门: {gate_name} (共 {parsed_qasm.gate_count[gate_name]} 次)",
                    details={"gate": gate_name, "count": parsed_qasm.gate_count[gate_name]},
                    severity="error"
                ))
        return violations

    def _check_allowed_gates(self, parsed_qasm: ParsedQasm, rules: GateRule) -> List[RuleViolation]:
        violations = []
        allowed = rules.allowed_gates
        for gate_name in parsed_qasm.gate_count:
            if gate_name not in allowed:
                violations.append(RuleViolation(
                    rule_name="允许门检查",
                    violation_type="disallowed_gate",
                    message=f"使用了不允许的门: {gate_name} (共 {parsed_qasm.gate_count[gate_name]} 次)",
                    details={"gate": gate_name, "count": parsed_qasm.gate_count[gate_name], "allowed": list(allowed)},
                    severity="error"
                ))
        return violations

    def _check_max_depth(self, parsed_qasm: ParsedQasm, rules: GateRule) -> List[RuleViolation]:
        violations = []
        if parsed_qasm.gate_depth > rules.max_depth:
            violations.append(RuleViolation(
                rule_name="门深度限制",
                violation_type="depth_exceeded",
                message=f"门深度 {parsed_qasm.gate_depth} 超过限制 {rules.max_depth}",
                details={"actual": parsed_qasm.gate_depth, "limit": rules.max_depth},
                severity="error"
            ))
        return violations

    def _check_max_qubits(self, parsed_qasm: ParsedQasm, rules: GateRule) -> List[RuleViolation]:
        violations = []
        used = len(parsed_qasm.used_qubits)
        if used > rules.max_qubits:
            violations.append(RuleViolation(
                rule_name="量子比特上限",
                violation_type="too_many_qubits",
                message=f"使用了 {used} 个量子比特，超过上限 {rules.max_qubits}",
                details={"actual": used, "limit": rules.max_qubits},
                severity="error"
            ))
        return violations

    def _check_min_qubits(self, parsed_qasm: ParsedQasm, rules: GateRule) -> List[RuleViolation]:
        violations = []
        used = len(parsed_qasm.used_qubits)
        if used < rules.min_qubits:
            violations.append(RuleViolation(
                rule_name="量子比特下限",
                violation_type="too_few_qubits",
                message=f"使用了 {used} 个量子比特，低于下限 {rules.min_qubits}",
                details={"actual": used, "minimum": rules.min_qubits},
                severity="error"
            ))
        return violations

    def _check_required_qubits(self, parsed_qasm: ParsedQasm, rules: GateRule) -> List[RuleViolation]:
        violations = []
        required = set(rules.required_qubits)
        used = parsed_qasm.used_qubits
        missing = required - used
        
        if missing:
            violations.append(RuleViolation(
                rule_name="必需量子比特",
                violation_type="missing_qubits",
                message=f"未使用必需的量子比特: {sorted(missing)}",
                details={"missing": sorted(missing), "required": sorted(required)},
                severity="error"
            ))
        
        extra = used - required
        if extra:
            violations.append(RuleViolation(
                rule_name="仅限指定量子比特",
                violation_type="extra_qubits",
                message=f"使用了未指定的量子比特: {sorted(extra)}",
                details={"extra": sorted(extra), "allowed": sorted(required)},
                severity="error"
            ))
        
        return violations
