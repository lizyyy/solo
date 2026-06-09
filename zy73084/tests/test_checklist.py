from __future__ import annotations
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.engine import CurtainWallChecklist, export_all
from src.models import (
    HumanOverride, JudgmentStatus, HandleStatus, ExceptionType
)
from src.sample_data import (
    build_sample_nodes,
    build_sample_meeting_minutes_round5,
    build_sample_overrides,
)


def assert_true(cond: bool, msg: str) -> None:
    if not cond:
        raise AssertionError(f"✗ 失败: {msg}")
    print(f"✓ 通过: {msg}")


def main() -> int:
    print("========== 开始自检验证 ==========\n")

    # 1. 构造 Checklist
    checklist = CurtainWallChecklist()
    for n in build_sample_nodes():
        checklist.add_node(n)

    # 2. 会议纪要追踪
    warnings = checklist.import_meeting_minutes(build_sample_meeting_minutes_round5())
    print(f"[导入] 会议纪要产生 {len(warnings)} 条警告")
    for w in warnings:
        print(f"  ⚠ {w}")
    print()

    # 3. 人工改判
    for rov in build_sample_overrides():
        node = checklist.nodes.get(rov["node_code"])
        assert_true(node is not None, f"节点 {rov['node_code']} 存在")
        orig = next(s for s in JudgmentStatus if s.value == rov["original_status"])
        over = next(s for s in JudgmentStatus if s.value == rov["overridden_status"])
        node.register_override(HumanOverride(
            original_status=orig,
            overridden_status=over,
            reason=rov.get("reason", ""),
            operator=rov.get("operator", ""),
        ))

    # 4. 跑完整管线
    result = checklist.run_pipeline()

    # === 开始断言 ===
    print("\n--- 断言检查 ---")

    # 4.1 MQ-01 材料缺失 → 应被挂起
    mq01 = checklist.nodes["MQ-01"]
    assert_true(mq01.material_missing(), "MQ-01 检测到材料批次缺失")
    assert_true(
        mq01.final_judgment == JudgmentStatus.PENDING,
        f"MQ-01 最终判定应为挂起(PENDING)，实际: {mq01.final_judgment.value}",
    )
    material_excs = [e for e in mq01.exceptions if e.exc_type == ExceptionType.MATERIAL_MISSING]
    assert_true(len(material_excs) >= 1, "MQ-01 生成材料缺失异常")
    assert_true(
        material_excs[0].handle_status == HandleStatus.HUNG,
        "材料缺失异常处理状态应为已挂起",
    )

    # 4.2 MQ-01 焊缝新旧冲突（加大 vs 维持）→ 应有意见冲突异常
    conflict_excs = [e for e in mq01.exceptions if e.exc_type == ExceptionType.OPINION_CONFLICT]
    assert_true(len(conflict_excs) >= 1, "MQ-01 检测到焊缝加大 vs 维持的意见冲突")

    # 4.3 MQ-02 玻璃 单片→夹胶 冲突
    mq02 = checklist.nodes["MQ-02"]
    c2 = [e for e in mq02.exceptions if e.exc_type == ExceptionType.OPINION_CONFLICT]
    assert_true(len(c2) >= 1, "MQ-02 检测到玻璃 单片 vs 夹胶 意见冲突")

    # 4.4 MQ-03 胶缝 15→20 冲突
    mq03 = checklist.nodes["MQ-03"]
    c3 = [e for e in mq03.exceptions if e.exc_type == ExceptionType.OPINION_CONFLICT]
    assert_true(len(c3) >= 1, "MQ-03 检测到胶缝宽度冲突")

    # 4.5 MQ-04 人工改判
    mq04 = checklist.nodes["MQ-04"]
    assert_true(len(mq04.overrides) == 1, "MQ-04 有 1 条人工改判")
    assert_true(
        mq04.final_judgment == JudgmentStatus.OVERRIDDEN_UNSTABLE,
        f"MQ-04 最终应为人工改判-不稳定，实际: {mq04.final_judgment.value}",
    )
    trace_chain = result["trace_chains"]["MQ-04"]
    assert_true(len(trace_chain) >= 3, f"MQ-04 追溯链应有 自动判定→改判→最终 至少3步，实际{len(trace_chain)}步")
    assert_true(
        "人工改判" in trace_chain[-2]["步骤"],
        "追溯链中间步骤明确标出人工改判",
    )

    # 4.6 三统一：场景标注/侧边说明/队列说明 一致
    for code, node in checklist.nodes.items():
        for exc in node.exceptions:
            assert_true(
                exc.unified_scene_label == node.scene.value,
                f"{code} 异常{exc.exc_id} 场景标注与节点统一",
            )
    cons_errs = [w for w in result["warnings"] if "三统一检查" in w]
    assert_true(len(cons_errs) == 0, f"三统一自检无错误 (实际有 {len(cons_errs)} 条)")

    # 4.7 汇总拉动异常：MQ-01/02/03/04 都应有拉动
    for code in ["MQ-01", "MQ-02", "MQ-03", "MQ-04"]:
        row = next(r for r in result["summary_rows"] if r["节点编号"] == code)
        assert_true(
            row["拉动汇总的异常数"] != "0" and row["拉动汇总的异常数"] != "-",
            f"{code} 汇总表『拉动汇总的异常数』不为0 (实际={row['拉动汇总的异常数']})",
        )
        assert_true(
            row["拉动异常编号"] != "-",
            f"{code} 汇总表给出了拉动异常编号",
        )

    # 4.8 异常队列：处理状态与改判详情存在
    q_override = [q for q in result["queue_rows"] if q["异常类型"] == "人工改判"]
    assert_true(len(q_override) >= 1, "异常队列里有人工改判类型条目")
    assert_true(
        all(q["人工改判详情"] != "-" for q in q_override),
        "人工改判类异常带改判详情",
    )
    assert_true(
        all(q["处理状态"] != "" for q in result["queue_rows"]),
        "所有异常条目都标明处理状态",
    )
    assert_true(
        all(q["下一步动作"] != "" for q in result["queue_rows"]),
        "所有异常条目都给出下一步动作",
    )

    # 4.9 材料挂起清单非空
    assert_true(len(result["material_missing"]) >= 1, "材料批次缺失挂起清单非空")

    # 4.10 改判影响报告非空
    assert_true(len(result["override_impact"]) >= 1, "人工改判影响报告非空")

    # 5. 导出到临时目录验证不落盘错误
    with tempfile.TemporaryDirectory() as td:
        files = export_all(result, Path(td))
        for name, fname in files.items():
            fp = Path(td) / fname
            if fp.is_dir():
                continue
            assert_true(fp.exists(), f"导出文件 {name} -> {fname} 成功生成")

    # === 指标打印 ===
    print("\n--- 整体指标 ---")
    for k, v in result["metrics"].items():
        print(f"  {k}: {v}")
    print("\n--- 异常状态分布 ---")
    for k, v in result["queue_status"].items():
        print(f"  {k}: {v}")

    print("\n========== 全部断言通过，系统可用 ✅ ==========")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
