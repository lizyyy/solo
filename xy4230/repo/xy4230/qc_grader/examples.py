"""示例数据模块 - 包含示例QASM代码、题目配置和测试用例"""

from typing import Dict, Any, List


EXAMPLE_QASM_BELL_STATE = """OPENQASM 2.0;
include "qelib1.inc";

qreg q[2];
creg c[2];

h q[0];
cx q[0], q[1];
measure q[0] -> c[0];
measure q[1] -> c[1];
"""

EXAMPLE_QASM_HADAMARD = """OPENQASM 2.0;
include "qelib1.inc";

qreg q[1];
creg c[1];

h q[0];
measure q[0] -> c[0];
"""

EXAMPLE_QASM_3QUBIT_GHZ = """OPENQASM 2.0;
include "qelib1.inc";

qreg q[3];
creg c[3];

h q[0];
cx q[0], q[1];
cx q[0], q[2];
measure q[0] -> c[0];
measure q[1] -> c[1];
measure q[2] -> c[2];
"""

EXAMPLE_QASM_WITH_FORBIDDEN_GATE = """OPENQASM 2.0;
include "qelib1.inc";

qreg q[2];
creg c[2];

h q[0];
ccx q[0], q[1], q[1];
measure q[0] -> c[0];
measure q[1] -> c[1];
"""

EXPECTED_DISTRIBUTION_BELL = {
    "00": 0.5,
    "11": 0.5
}

EXPECTED_DISTRIBUTION_HADAMARD = {
    "0": 0.5,
    "1": 0.5
}

EXPECTED_DISTRIBUTION_GHZ = {
    "000": 0.5,
    "111": 0.5
}

EXAMPLE_PROBLEM_SET = {
    "problem_1": {
        "description": "基础门练习：使用H门创建叠加态",
        "expected_distribution": EXPECTED_DISTRIBUTION_HADAMARD,
        "gate_rules": {
            "forbidden_gates": ["cx", "ccx", "swap"],
            "max_depth": 5,
            "max_qubits": 2
        },
        "grading_config": {
            "max_score": 20.0,
            "probability_tolerance": 0.05
        }
    },
    "problem_2": {
        "description": "纠缠态练习：创建Bell态 |Φ+⟩",
        "expected_distribution": EXPECTED_DISTRIBUTION_BELL,
        "gate_rules": {
            "forbidden_gates": ["ccx", "toffoli"],
            "max_depth": 10,
            "max_qubits": 3,
            "required_qubits": [0, 1]
        },
        "grading_config": {
            "max_score": 30.0,
            "probability_tolerance": 0.05
        }
    },
    "problem_3": {
        "description": "多量子比特练习：创建3量子比特GHZ态",
        "expected_distribution": EXPECTED_DISTRIBUTION_GHZ,
        "gate_rules": {
            "forbidden_gates": [],
            "allowed_gates": ["h", "cx", "measure"],
            "max_depth": 15,
            "min_qubits": 3,
            "max_qubits": 3
        },
        "grading_config": {
            "max_score": 50.0,
            "probability_tolerance": 0.08
        }
    }
}

EXAMPLE_GATE_RULES = {
    "basic": {
        "forbidden_gates": ["ccx", "toffoli", "fredkin"],
        "max_depth": 20,
        "max_qubits": 5
    },
    "strict": {
        "forbidden_gates": [],
        "allowed_gates": ["h", "x", "y", "z", "cx", "measure"],
        "max_depth": 10,
        "max_qubits": 2
    }
}


def get_example_qasm(example_type: str = "bell") -> str:
    examples = {
        "bell": EXAMPLE_QASM_BELL_STATE,
        "hadamard": EXAMPLE_QASM_HADAMARD,
        "ghz": EXAMPLE_QASM_3QUBIT_GHZ,
        "forbidden": EXAMPLE_QASM_WITH_FORBIDDEN_GATE
    }
    return examples.get(example_type, EXAMPLE_QASM_BELL_STATE)


def get_expected_distribution(problem_id: str) -> Dict[str, float]:
    if problem_id in EXAMPLE_PROBLEM_SET:
        return EXAMPLE_PROBLEM_SET[problem_id]["expected_distribution"]
    return {}


def get_gate_rules(problem_id: str) -> Dict[str, Any]:
    if problem_id in EXAMPLE_PROBLEM_SET:
        return EXAMPLE_PROBLEM_SET[problem_id].get("gate_rules", {})
    return {}


def get_grading_config(problem_id: str) -> Dict[str, Any]:
    if problem_id in EXAMPLE_PROBLEM_SET:
        return EXAMPLE_PROBLEM_SET[problem_id].get("grading_config", {})
    return {}


def list_example_problems() -> List[str]:
    return list(EXAMPLE_PROBLEM_SET.keys())


def get_problem_description(problem_id: str) -> str:
    if problem_id in EXAMPLE_PROBLEM_SET:
        return EXAMPLE_PROBLEM_SET[problem_id].get("description", "")
    return ""


SAMPLE_ASSIGNMENT_YAML = """# 量子计算作业配置示例
assignment:
  name: "量子电路基础作业"
  due_date: "2026-05-10"
  problems:
    - id: "problem_1"
      title: "H门叠加态"
      description: "使用H门将单个量子比特制备到均匀叠加态"
      max_score: 20
      expected_distribution:
        "0": 0.5
        "1": 0.5
      rules:
        forbidden_gates: ["cx", "ccx"]
        max_depth: 5
        max_qubits: 2
    
    - id: "problem_2"
      title: "Bell态制备"
      description: "制备Bell态 |Φ+⟩ = (|00⟩ + |11⟩)/√2"
      max_score: 30
      expected_distribution:
        "00": 0.5
        "11": 0.5
      rules:
        forbidden_gates: ["ccx"]
        max_depth: 10
        required_qubits: [0, 1]
"""

SAMPLE_EXPECTED_JSON = """{
  "problem_1": {
    "description": "H门叠加态",
    "expected_distribution": {
      "0": 0.5,
      "1": 0.5
    },
    "rules": {
      "forbidden_gates": ["cx", "ccx"],
      "max_depth": 5
    }
  },
  "problem_2": {
    "description": "Bell态制备",
    "expected_distribution": {
      "00": 0.5,
      "11": 0.5
    },
    "rules": {
      "forbidden_gates": ["ccx"],
      "max_depth": 10
    }
  }
}
"""
