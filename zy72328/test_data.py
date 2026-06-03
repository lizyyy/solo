from typing import List, Dict, Any


NORMAL_SAMPLE_LIST: List[Dict[str, Any]] = [
    {"sample_id": "S001", "equation_param": 4.0, "threshold": 10.0},
    {"sample_id": "S002", "equation_param": 9.0, "threshold": 10.0},
    {"sample_id": "S003", "equation_param": 16.0, "threshold": 20.0},
    {"sample_id": "S004", "equation_param": 25.0, "threshold": 30.0},
    {"sample_id": "S005", "equation_param": 36.0, "threshold": 40.0},
]

NORMAL_PARAMETER_TABLE: List[Dict[str, Any]] = [
    {"sample_id": "S001", "equation_param": 4.0, "threshold": 10.0, "notes": "正常样本，参数无误"},
    {"sample_id": "S002", "equation_param": 9.0, "threshold": 10.0, "notes": "正常样本，参数无误"},
    {"sample_id": "S003", "equation_param": 16.0, "threshold": 20.0, "notes": "正常样本，参数无误"},
    {"sample_id": "S004", "equation_param": 25.0, "threshold": 30.0, "notes": "正常样本，参数无误"},
    {"sample_id": "S005", "equation_param": 36.0, "threshold": 40.0, "notes": "正常样本，参数无误"},
]


WRONG_CALIBRATION_SAMPLE_LIST: List[Dict[str, Any]] = [
    {"sample_id": "W001", "equation_param": 10.0, "threshold": 10.0},
    {"sample_id": "W002", "equation_param": 15.0, "threshold": 15.0},
    {"sample_id": "W003", "equation_param": 20.0, "threshold": 25.0},
    {"sample_id": "W004", "equation_param": 30.0, "threshold": 30.0},
    {"sample_id": "W005", "equation_param": 40.0, "threshold": 45.0},
]

WRONG_CALIBRATION_PARAMETER_TABLE: List[Dict[str, Any]] = [
    {"sample_id": "W001", "equation_param": 10.0, "threshold": 10.0, "notes": "边界值，需要复核"},
    {"sample_id": "W002", "equation_param": 15.0, "threshold": 16.0, "notes": "与抽样名单阈值不一致"},
    {"sample_id": "W003", "equation_param": 22.0, "threshold": 25.0, "notes": "与抽样名单参数不一致"},
    {"sample_id": "W004", "equation_param": 30.0, "threshold": 30.0, "notes": "边界值，需要复核"},
    {"sample_id": "W005", "equation_param": 40.0, "threshold": 45.0, "notes": "正常样本"},
]


SUPPLEMENT_SAMPLE_LIST: List[Dict[str, Any]] = [
    {"sample_id": "P001", "equation_param": 100.0, "threshold": 100.0},
    {"sample_id": "P002", "equation_param": 121.0, "threshold": 130.0},
    {"sample_id": "P003", "equation_param": 144.0, "threshold": 150.0},
]

SUPPLEMENT_PARAMETER_TABLE: List[Dict[str, Any]] = [
    {"sample_id": "P001", "equation_param": 100.0, "threshold": 100.0, "notes": "边界值，初始导入"},
    {"sample_id": "P002", "equation_param": 121.0, "threshold": 130.0, "notes": "正常样本"},
    {"sample_id": "P003", "equation_param": 144.0, "threshold": 150.0, "notes": "正常样本"},
]

SUPPLEMENT_DATA: List[Dict[str, Any]] = [
    {"sample_id": "P001", "equation_param": 100.0, "threshold": 105.0, "notes": "补录修正阈值，不再是边界值"},
    {"sample_id": "P002", "equation_param": 125.0, "threshold": 130.0, "notes": "补录修正参数"},
]


TEST_SCENARIOS = {
    "normal": {
        "description": "正常材料测试 - 抽样名单和参数调试表完全一致，无边界值冲突",
        "sample_list": NORMAL_SAMPLE_LIST,
        "parameter_table": NORMAL_PARAMETER_TABLE,
        "expected_anti_examples": 0,
        "expected_conflicts": 0,
        "expected_pending_review": 0,
    },
    "wrong_calibration": {
        "description": "错口径材料测试 - 存在边界值和数据冲突",
        "sample_list": WRONG_CALIBRATION_SAMPLE_LIST,
        "parameter_table": WRONG_CALIBRATION_PARAMETER_TABLE,
        "expected_anti_examples": 6,
        "expected_conflicts": 3,
        "expected_pending_review": 3,
    },
    "supplement": {
        "description": "补录材料测试 - 先导入再补录后重算",
        "sample_list": SUPPLEMENT_SAMPLE_LIST,
        "parameter_table": SUPPLEMENT_PARAMETER_TABLE,
        "supplement_data": SUPPLEMENT_DATA,
        "expected_anti_examples": 1,
        "expected_conflicts": 0,
        "expected_pending_review": 1,
    }
}
