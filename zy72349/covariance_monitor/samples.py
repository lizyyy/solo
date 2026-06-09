from typing import Dict, Any

SAMPLE_NORMAL = {
    "scenario_name": "场景一：正常材料（顺利记录，公式一致+格式统一）",
    "batch_id": "BATCH-2026-001",
    "subject": "高等数学",
    "exam_date": "2026-01-15",
    "operator": "张老师",
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
    "expected_snapshots": 1,
    "expected_diff": False,
}

SAMPLE_MIXED_FORMAT = {
    "scenario_name": "场景二：错口径材料（百分数和小数混排）",
    "batch_id": "BATCH-2026-002",
    "subject": "线性代数",
    "exam_date": "2026-01-20",
    "operator": "李老师",
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
    "activity_comment": (
        "经核对，所有百分数/小数写法都指向同一个取值，统一按规则转换为小数："
        "75%→0.75, 85%→0.85, 68%→0.68, 88%→0.88"
    ),
    "expected_snapshots": 1,
    "expected_diff": False,
}

SAMPLE_SUPPLEMENTARY = {
    "scenario_name": "场景三：补录材料（旧公式截图÷n vs 批注÷(n-1) 冲突）",
    "batch_id": "BATCH-2026-003",
    "subject": "概率论",
    "exam_date": "2026-01-25",
    "operator": "王老师",
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
    "screenshot_description": "旧公式截图：总体协方差（除以n=4）",
    "screenshot_id": "IMG-2026-0003",
    "comment_formula": "Σ[(x-E[X])(y-E[Y])] / (n-1)",
    "comment_description": "老师批注：样本协方差（除以n-1=3）",
    "comment_id": "COMMENT-0003",
    "wu_teacher_comment": (
        "经核查教材，本章考试考纲采用「样本协方差」。原截图为"
        "旧版资料沿用总体协方差公式，与老师批注不一致。本次以批注为准。"
    ),
    "supplementary_formula": "Σ[(x-E[X])(y-E[Y])] / (n-1)",
    "supplementary_description": (
        "补录：吴老师确认后，统一按样本协方差（除以n-1）执行"
    ),
    "supplementary_note": (
        "同一条记录 BATCH-2026-003 先后存在两种公式口径："
        "第一步按旧公式截图（总体协方差÷4）完成初算；"
        "老师批注更正后，经吴老师确认，在同一条记录上补录新公式"
        "并执行复算。旧口径保存在快照1，批注口径保存在快照2，"
        "二者差异通过 get_old_vs_new_diff() 可复盘。"
    ),
    "expected_snapshots": 2,
    "expected_diff": True,
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
三种测试样例说明（所有步骤都串在同一条 record 上执行）：

1. 【正常样例】normal - 顺利记录
   - 所有数据格式统一（均为小数）
   - 旧公式截图与老师批注完全一致（都 ÷n）
   - 同一条记录走完：导入截图→导入批注→格式检查→计算→生成报告

2. 【混排样例】mixed - 百分数和小数混着出现
   - 同一条记录中同时存在"75%"和"0.82"两种写法
   - 格式检查检测到混排，不自动归一化，不提前归正常
   - 活动负责人复核时：保留原始说法、记录改后值、写明处理原因、标注下一步找谁
   - 复核后再计算，全程所有字段（列表/详情/摘要/历史/报告）同步更新

3. 【补录样例】supplementary - 旧公式截图 vs 批注冲突（重点）
   - 第一步：同一条记录先按旧公式截图（总体协方差÷n）执行初算，存入快照1
   - 第二步：导入老师批注（样本协方差÷n-1），检测到冲突，明文列出证据
   - 第三步：不自动拍板，由教研负责人吴老师确认/驳回（这里演示确认）
   - 第四步：在同一条记录上补录批注口径，执行复算，存入快照2
   - 差异复盘：在报告/脚本中对比快照1 vs 快照2（公式、结果差值都有）
   - 所有复核点都保留：原始说法 / 改后值 / 处理原因 / 下一步找谁
"""
