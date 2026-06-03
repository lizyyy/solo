"""
演示数据 —— 给新人讲流程用的「小而真」样例

背景：小祁（数据分析师）跟教研组交接时，用这套数据走一遍完整流程：
  1. 第一次导入：边界值说明先到，分段函数和权重表也导入
  2. 小祁补看评分权重表：权重表晚到后补录，版本号 +1
  3. 参数版本页更新：每版参数留快照

三条典型记录：
  - R-001 顺利记录：编号连续、权重表齐 → 直接算出结果
  - R-002 断档记录：有人工删行（编号3被删），编号断档 → 标「断档待复核」
  - R-003 旧口径补录：先用旧权重表算了一次，后来补录新权重表重跑 → 标「补录旧口径」
"""

from __future__ import annotations

from .models import (
    Segment,
    PiecewiseFunction,
    ScoringWeightTable,
    WeightEntry,
    BoundaryNote,
)
from .engine import CalculationEngine


FUNC_NAME = "课程优惠分段函数"
TABLE_NAME = "课程评分权重表"

COMPLETE_SEGMENTS = [
    Segment(seg_no=1, lower=float("-inf"), upper=60, discount_rate=1.00),
    Segment(seg_no=2, lower=60, upper=75, discount_rate=0.95),
    Segment(seg_no=3, lower=75, upper=90, discount_rate=0.85),
    Segment(seg_no=4, lower=90, upper=float("inf"), discount_rate=0.70),
]

SEGMENTS_WITH_GAP = [
    Segment(seg_no=1, lower=float("-inf"), upper=60, discount_rate=1.00),
    Segment(seg_no=2, lower=60, upper=75, discount_rate=0.95),
    Segment(seg_no=4, lower=90, upper=float("inf"), discount_rate=0.70),
]

WEIGHT_ENTRIES_V1 = [
    WeightEntry(dimension="出勤率", weight=0.3, score=80),
    WeightEntry(dimension="作业完成度", weight=0.4, score=70),
    WeightEntry(dimension="课堂互动", weight=0.3, score=85),
]

WEIGHT_ENTRIES_V2 = [
    WeightEntry(dimension="出勤率", weight=0.2, score=80),
    WeightEntry(dimension="作业完成度", weight=0.3, score=70),
    WeightEntry(dimension="课堂互动", weight=0.3, score=85),
    WeightEntry(dimension="期末考试", weight=0.2, score=90),
]

BOUNDARY_NOTES = [
    BoundaryNote(
        boundary="< 60 分",
        explanation="低于及格线，不打折（折扣率 1.0）",
        import_batch="第一批",
    ),
    BoundaryNote(
        boundary="60 ≤ 分 < 75",
        explanation="及格但不突出，九五折",
        import_batch="第一批",
    ),
    BoundaryNote(
        boundary="75 ≤ 分 < 90",
        explanation="良好区间，八五折",
        import_batch="第一批",
    ),
    BoundaryNote(
        boundary="≥ 90 分",
        explanation="优秀区间，七折",
        import_batch="第一批",
    ),
]


def load_demo_data() -> CalculationEngine:
    """
    跑一遍完整的演示流程，返回引擎实例。
    跑完之后引擎里会有三条记录，分别对应三种处理结果。
    """
    engine = CalculationEngine()

    # ── 第一步：边界值说明第一次导入 ──────────────────
    engine.import_boundary_notes(BOUNDARY_NOTES)

    # 导入「完整」的分段函数（R-001 顺利记录用）
    func_complete = PiecewiseFunction(name=FUNC_NAME, segments=COMPLETE_SEGMENTS)
    engine.import_function(func_complete)

    # 导入「有断档」的分段函数（R-002 用，模拟人工删了第3段）
    func_gapped = PiecewiseFunction(
        name=f"{FUNC_NAME}_断档版", segments=SEGMENTS_WITH_GAP
    )
    engine.import_function(func_gapped)

    # 先导入旧版权重表（v1，只有3个维度）
    table = ScoringWeightTable(name=TABLE_NAME, entries=WEIGHT_ENTRIES_V1, version=1)
    engine.import_weight_table(table, remark="旧口径：出勤+作业+互动（3维度）")

    # ── R-001 顺利记录 ─────────────────────────────
    # 编号连续、权重表齐 → 直接出结果
    engine.calculate(
        record_id="R-001",
        original_price=1000.0,
        function_name=FUNC_NAME,
        weight_table_name=TABLE_NAME,
        remark="顺利记录：编号连续、参数齐全",
    )

    # ── R-002 断档记录 ─────────────────────────────
    # 用断档版函数算，seg_no=4 的区间跳过了 3，
    # 但综合评分是 78.5，落在编号3的区间（75-90）——而这个区间被删了
    # 引擎找不到对应分段，但检测到断档，标「断档待复核」
    engine.calculate(
        record_id="R-002",
        original_price=1000.0,
        function_name=f"{FUNC_NAME}_断档版",
        weight_table_name=TABLE_NAME,
        remark="断档记录：第3段被人工删除，评分落在缺失区间",
    )

    # ── R-003 旧口径补录 ────────────────────────────
    # 先用旧权重表（v1）算一次
    engine.calculate(
        record_id="R-003",
        original_price=1000.0,
        function_name=FUNC_NAME,
        weight_table_name=TABLE_NAME,
        remark="先用旧权重表（3维度）核算",
    )

    # ── 第二步：小祁补看评分权重表 ──────────────────
    # 评分权重表晚到了，小祁把新维度补进去
    engine.supplement_weight_table(
        table_name=TABLE_NAME,
        new_entries=WEIGHT_ENTRIES_V2,
        remark="补录：新增期末考试维度（4维度）",
    )

    # ── 第三步：参数版本页更新 + 重跑 ──────────────
    # 用新权重表重跑 R-003，旧记录标「补录旧口径」
    engine.recalculate(record_id="R-003", mark_old_caliber=True)

    return engine


def print_demo() -> None:
    engine = load_demo_data()

    print("=" * 60)
    print("分段函数优惠核算 · 演示数据")
    print("=" * 60)

    print()
    print(engine.format_boundary_notes())
    print()

    print(engine.format_gap_report())
    print()

    print(engine.version_manager.format_version_page())
    print()

    print(engine.format_records())
    print()

    print("-" * 60)
    print("三种处理结果对比：")
    print("-" * 60)
    for r in engine.records:
        tag = ""
        if r.status.value == "正常":
            tag = "✓ 顺利出结果"
        elif r.status.value == "断档待复核":
            tag = "⚠ 编号断档，等教研组复核"
        elif r.status.value == "补录旧口径":
            tag = "↻ 旧口径标记，已用新参数重跑"
        print(f"  {r.record_id}: 状态={r.status.value}  {tag}")
        print(f"    → {r.summary_line()}")
    print()


if __name__ == "__main__":
    print_demo()
