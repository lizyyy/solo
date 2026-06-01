from typing import List, Dict, Any
from datetime import datetime

SAMPLE_INPUTS: List[Dict[str, Any]] = [
    {
        "case": "case_001",
        "description": "顺利记录 - 经典科赫雪花参数",
        "source": "课堂讲义_第5章_案例A",
        "raw_input": {
            "fractal_dimension": 1.26,
            "iterations": 6,
            "scale_factor": 0.5,
            "rotation_angle": 60.0,
            "base_shape": "triangle",
            "unit": "px",
            "color_palette": "monochrome"
        }
    },
    {
        "case": "case_002",
        "description": "需要人工确认 - 边界值加单位混用",
        "source": "用户提交_2024批次",
        "raw_input": {
            "fractal_dimension": 2.95,
            "iterations": 18,
            "scale_factor": "0.33mm",
            "rotation_angle": "450px",
            "base_shape": "square",
            "unit": "mm",
            "color_palette": "rainbow"
        }
    },
    {
        "case": "case_003",
        "description": "旧口径记录 - 从课堂讲义补录",
        "source": "课堂讲义_2019版_附录B",
        "raw_input": {
            "fractal_dimension": 1.5,
            "iterations": 4,
            "scale_factor": 0.707,
            "rotation_angle": 45.0,
            "base_shape": "square",
            "unit": "px",
            "color_palette": "gradient"
        },
        "is_legacy": True,
        "legacy_notes": "2019版讲义标准示例，当时允许更大缩放因子范围"
    },
    {
        "case": "case_004",
        "description": "含空值数据",
        "source": "批量导入_缺失字段",
        "raw_input": {
            "fractal_dimension": None,
            "iterations": 8,
            "scale_factor": 0.6,
            "rotation_angle": "",
            "base_shape": "pentagon",
            "unit": "cm",
            "color_palette": None
        }
    },
    {
        "case": "case_005",
        "description": "重复点检测 - 与case_001参数重复",
        "source": "用户提交_重复数据",
        "raw_input": {
            "fractal_dimension": 1.26,
            "iterations": 6,
            "scale_factor": 0.5,
            "rotation_angle": 60.0,
            "base_shape": "triangle",
            "unit": "px",
            "color_palette": "monochrome"
        }
    },
    {
        "case": "case_006",
        "description": "看起来正常但结果很怪 - 高复杂度",
        "source": "异常样本库",
        "raw_input": {
            "fractal_dimension": 2.8,
            "iterations": 15,
            "scale_factor": 0.4,
            "rotation_angle": 137.5,
            "base_shape": "hexagon",
            "unit": "px",
            "color_palette": "fire",
            "complexity_score": 95.0
        }
    },
    {
        "case": "case_007",
        "description": "单位混用严重",
        "source": "混合数据导入",
        "raw_input": {
            "fractal_dimension": 1.89,
            "iterations": "10次",
            "scale_factor": "0.5in",
            "rotation_angle": "90deg",
            "base_shape": "circle",
            "unit": "mm",
            "color_palette": "ocean"
        }
    }
]

MANUAL_OVERRIDES: Dict[str, Dict[str, Any]] = {
    "case_002": {
        "manual_override": True,
        "override_reason": "用户确认使用边界值，特殊用途需要高维度",
        "override_by": "小岑",
        "override_at": datetime(2024, 3, 15, 14, 30, 0),
        "params": {
            "fractal_dimension": 2.95,
            "iterations": 18
        }
    }
}
