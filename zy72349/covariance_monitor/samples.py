from typing import Dict, Any

SAMPLE_NORMAL = {
    "batch_id": "BATCH-2026-001",
    "subject": "高等数学",
    "exam_date": "2026-01-15",
    "raw_values": {
        "x1": "0.75",
        "x2": "0.82",
        "x3": "0.68",
        "x4": "0.90",
        "y1": "0.70",
        "y2": "0.85",
        "y3": "0.72",
        "y4": "0.88",
    },
    "screenshot_formula": "Σ[(x-E[X])(y-E[Y])] / n",
    "screenshot_description": "总体协方差公式（除以n）",
    "screenshot_id": "IMG-2026-0001",
    "comment_formula": "Σ[(x-E[X])(y-E[Y])] / n",
    "comment_description": "老师批注确认使用总体协方差",
    "comment_id": "COMMENT-0001",
}

SAMPLE_MIXED_FORMAT = {
    "batch_id": "BATCH-2026-002",
    "subject": "线性代数",
    "exam_date": "2026-01-20",
    "raw_values": {
        "x1": "75%",
        "x2": "0.82",
        "x3": "68%",
        "x4": "0.90",
        "y1": "0.70",
        "y2": "85%",
        "y3": "0.72",
        "y4": "88%",
    },
    "screenshot_formula": "Σ[(x-E[X])(y-E[Y])] / (n-1)",
    "screenshot_description": "样本协方差公式（除以n-1）",
    "screenshot_id": "IMG-2026-0002",
    "comment_formula": "Σ[(x-E[X])(y-E[Y])] / (n-1)",
    "comment_description": "老师批注确认使用样本协方差",
    "comment_id": "COMMENT-0002",
    "conversion_rules": {
        "x1": 0.75,
        "x2": 0.82,
        "x3": 0.68,
        "x4": 0.90,
        "y1": 0.70,
        "y2": 0.85,
        "y3": 0.72,
        "y4": 0.88,
    },
}

SAMPLE_SUPPLEMENTARY = {
    "batch_id": "BATCH-2026-003",
    "subject": "概率论",
    "exam_date": "2026-01-25",
    "raw_values": {
        "x1": "0.65",
        "x2": "0.78",
        "x3": "0.71",
        "x4": "0.83",
        "y1": "0.68",
        "y2": "0.75",
        "y3": "0.70",
        "y4": "0.80",
    },
    "screenshot_formula": "Σ[(x-E[X])(y-E[Y])] / n",
    "screenshot_description": "旧公式截图显示总体协方差",
    "screenshot_id": "IMG-2026-0003",
    "comment_formula": "Σ[(x-E[X])(y-E[Y])] / (n-1)",
    "comment_description": "老师批注更正为样本协方差",
    "comment_id": "COMMENT-0003",
    "supplementary_formula": "Σ[(x-E[X])(y-E[Y])] / (n-1)",
    "supplementary_description": "补录：吴老师确认采用样本协方差公式",
    "supplementary_note": "原截图公式为总体协方差(除以n)，老师批注更正为样本协方差(除以n-1)。经吴老师确认，采用批注版本。",
}


def get_sample(sample_type: str) -> Dict[str, Any]:
    samples = {
        "normal": SAMPLE_NORMAL,
        "mixed": SAMPLE_MIXED_FORMAT,
        "supplementary": SAMPLE_SUPPLEMENTARY,
    }
    if sample_type not in samples:
        raise ValueError(f"未知的样例类型: {sample_type}，可用类型: {list(samples.keys())}")
    return samples[sample_type]


def describe_samples() -> str:
    return """
三种测试样例说明：

1. 【正常样例】normal - 顺利记录
   - 所有数据格式统一（均为小数）
   - 旧公式截图与老师批注完全一致
   - 计算过程无冲突，直接得出结果

2. 【混排样例】mixed - 百分数和小数混着出现
   - 数据中同时存在"75%"和"0.82"两种格式
   - 检测到格式不一致后，不自动归一化
   - 需等待活动负责人复核确认转换规则

3. 【补录样例】supplementary - 从老师批注补来的旧口径
   - 旧公式截图显示为"除以n"（总体协方差）
   - 老师批注更正为"除以n-1"（样本协方差）
   - 检测到冲突后，列出证据，由吴老师确认或驳回
   - 确认后按批注口径补录，重新计算
"""
