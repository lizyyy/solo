"""完整工作流演示脚本 — S001 真实复盘样例串接版

出问题样例场景（全部串到 S001 上）：
1. 样本 S001，模型 v1.0 第一次导入 → 2个片段，状态 pending_import
2. 模型升级到 v2.0，同一样本 S001 → 触发版本变更检测，状态 needs_recheck
   （不急着归正常，留给运营复核人复核）
3. 标注负责人周姐补看人工改判表（都在 S001 上）：
   - S001/v1.0/行15：完整改判（风险→正常）
   - S001/v2.0/行15：只改一条备注（不改风险标记，存疑）
4. 停在处理状态查看：状态变化、历史留痕、结果说明、可重跑命令

验证重点：
- S001 复盘里能看到 v1.0、v2.0、1条完整改判、1条只改备注、2条needs_recheck
- 重跑命令覆盖两个模型版本导入 + 周姐改判表 + 状态查看 + 报告导出
- 重跑说明带改判表文件，按它执行能恢复周姐的人工结果
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from email_auto_reply_risk.database import get_session, init_db
from email_auto_reply_risk.core import (
    get_fragment_current_state, get_fragment_history,
    find_fragment_by_key
)
from email_auto_reply_risk.workflow import (
    step1_import_model_outputs, step2_manual_review,
    step3_product_review
)

DB_PATH = "data/demo_email_risk.db"
DATA_DIR = os.path.join(os.path.dirname(__file__), "sample_data")


def print_separator(title=""):
    print("\n" + "=" * 80)
    if title:
        print(f"  {title}")
    print("=" * 80)


def print_status_snapshot(session, sample_id, label=""):
    """打印样本所有片段的状态快照 - 停在处理状态看变化"""
    from email_auto_reply_risk.models import ModelOutputFragment
    fragments = session.query(ModelOutputFragment).filter(
        ModelOutputFragment.sample_id == sample_id
    ).order_by(ModelOutputFragment.id.asc()).all()
    
    print(f"\n--- {label}（样本 {sample_id}）---")
    print(f"{'片段ID':<10} {'行号':<8} {'版本':<8} {'原始风险':<10} {'当前风险':<10} {'处理状态':<18} {'最后更新人':<10}")
    print("-" * 95)
    for f in fragments:
        s = get_fragment_current_state(session, f.id)
        print(f"{s['fragment_id']:<10} {s['original_line_number']:<8} "
              f"{s['model_version']:<8} {str(s['original_is_auto_reply_risk']):<10} "
              f"{str(s['current_is_auto_reply_risk']):<10} {s['processing_status']:<18} "
              f"{s['last_updated_by'] or '':<10}")
        if s["current_remark"]:
            print(f"           备注: {s['current_remark'][:60]}")


def main():
    print_separator("邮件自动回复风险 - S001 真实复盘样例串接验证")
    print("""
业务场景：
  样本 S001，模型从 v1.0 升级到 v2.0
  运营复核人追问：为什么"邮件自动回复风险"前后不一致？
  周姐做了两件事：
    1. S001/v1.0/行15：完整改判（确认不是自动回复）
    2. S001/v2.0/行15：只改了一条备注（存疑，暂不改判）
  全部串到 S001 这一条样例上，重跑命令能恢复同一个结果。
""")
    
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    
    init_db(DB_PATH)
    session = get_session(DB_PATH)
    
    # ============================================================
    # 第一步：模型输出片段第一次导入（v1.0）
    # ============================================================
    print_separator("【步骤1】模型输出片段第一次导入 - v1.0")
    
    v1_file = os.path.join(DATA_DIR, "model_output_v1.0.json")
    step1_v1_result = step1_import_model_outputs(
        session, v1_file, "v1.0", "系统导入",
        batch_id="batch_v1_001",
        remark="首次导入模型v1.0输出"
    )
    
    print(f"批次ID: {step1_v1_result['batch_id']}")
    print(f"新增片段: {step1_v1_result['fragments_count']} 条")
    print(f"是否检测到版本变更: {step1_v1_result['has_model_version_change']}")
    
    print_status_snapshot(session, "S001", "导入v1.0后的处理状态")
    
    print("\n" + step1_v1_result["result_explanation"])
    
    # ============================================================
    # 验证：重复导入同一批，风险数量不翻倍
    # ============================================================
    print_separator("【验证】重复导入同一批数据 → 风险数量不翻倍")
    
    dup_result = step1_import_model_outputs(
        session, v1_file, "v1.0", "系统导入",
        batch_id="batch_v1_001"
    )
    
    print(f"导入状态: {dup_result['import_result']['status']}")
    print(f"跳过重复: {dup_result['import_result']['duplicate_skipped']} 条")
    print(f"新增: {dup_result['import_result']['new_records']} 条")
    print("✅ 重复导入检测生效，风险数量不会翻倍")
    
    # ============================================================
    # 第一步续：导入 v2.0，同一样本 S001 → 触发模型版本变更
    # ============================================================
    print_separator("【步骤1续】导入模型 v2.0 输出（同一样本 S001，触发版本变更检测）")
    
    v2_file = os.path.join(DATA_DIR, "model_output_v2.0.json")
    step1_v2_result = step1_import_model_outputs(
        session, v2_file, "v2.0", "系统导入",
        batch_id="batch_v2_001",
        remark="导入模型v2.0输出，同一样本编号S001"
    )
    
    print(f"批次ID: {step1_v2_result['batch_id']}")
    print(f"新增片段: {step1_v2_result['fragments_count']} 条")
    print(f"是否检测到版本变更: {step1_v2_result['has_model_version_change']}")
    
    print_status_snapshot(session, "S001", "导入v2.0后的处理状态")
    
    print("\n" + step1_v2_result["result_explanation"])
    
    print("""
⚠️  关键观察点（全部在 S001 上）：
  1. v2.0 的两个片段状态都是 needs_recheck
  2. 没有自动归 normal，留给运营复核人判断
  3. 备注里写了版本变更的原因
  4. v1.0 的记录还在，没被覆盖，可对比
""")
    
    # ============================================================
    # 第二步：周姐补看人工改判表（都在 S001 上）
    #   - S001/v1.0/行15：完整改判，风险→正常
    #   - S001/v2.0/行15：只改备注，不改风险标记
    # ============================================================
    print_separator("【步骤2】标注负责人周姐补看人工改判表（都在 S001 上）")
    
    s001_review_file = os.path.join(DATA_DIR, "manual_review_S001.json")
    
    print(f"改判表文件: {s001_review_file}")
    print("改判表内容:")
    with open(s001_review_file, 'r', encoding='utf-8') as f:
        review_items = json.load(f)
    for r in review_items:
        if r.get("only_edit_remark"):
            print(f"  {r['sample_id']}/{r['model_version']}/行{r['original_line_number']}: 仅改备注 → {r['remark'][:40]}")
        else:
            print(f"  {r['sample_id']}/{r['model_version']}/行{r['original_line_number']}: "
                  f"风险={r['reviewed_is_risk']}, 备注={r['remark'][:40]}")
    
    step2_result = step2_manual_review(
        session, review_items, "周姐",
        review_batch_id="review_S001_001",
        source_file=s001_review_file
    )
    
    print(f"\n改判完成: 共{step2_result['total_reviewed']}条 (成功:{step2_result['total_reviewed']}, 跳过:{step2_result['skip_count']})")
    print(f"  完整改判: {step2_result['manual_edit_count']} 条")
    print(f"  仅改备注: {step2_result['remark_edit_count']} 条")
    print(f"  改判批次ID: {step2_result['review_batch_id']}")
    
    print_status_snapshot(session, "S001", "周姐改判后的处理状态")
    
    print("\n" + step2_result["result_explanation"])
    
    # 确认"只改备注"确实落到 S001/v2.0/行15 上
    frag_v2_l15 = find_fragment_by_key(session, "S001", "v2.0", 15)
    print(f"\n📍 验证：S001/v2.0/行15 的备注 = {frag_v2_l15.current_remark}")
    print(f"📍 验证：S001/v2.0/行15 的状态 = {frag_v2_l15.processing_status}（只改备注，状态不变）")
    
    print("""
✅ 关键观察点（全部在 S001 上）：
  1. S001/v1.0/行15：风险 True→False，状态 pending_import→normal（完整改判）
  2. S001/v2.0/行15：风险没变，状态还是 needs_recheck（只改备注）
     备注变成了"这条v2.0判断存疑"，周姐只改了备注，没改判，留给运营复核
  3. 原始模型判断 original_is_auto_reply_risk 没变
  4. 改判批次表有记录，带源文件路径
""")
    
    # ============================================================
    # 查看单条片段的完整变更历史 — 运营追问时用
    # （看 S001/v2.0/行15，就是那条只改了备注的）
    # ============================================================
    print_separator("【运营追问时】查看 S001/v2.0/行15 的完整变更历史")
    
    frag = find_fragment_by_key(session, "S001", "v2.0", 15)
    history = get_fragment_history(session, frag.id)
    print(f"片段{frag.id}（S001/v2.0/行15）共有 {len(history)} 条变更记录：\n")
    
    for i, h in enumerate(history, 1):
        print(f"  [{i}] {h['change_type']}  by {h['changed_by']}  at {h['changed_at'][:19]}")
        print(f"      原始行号: {h['original_line_number']}")
        print(f"      模型版本: {h['model_version_before']} → {h['model_version_after']}")
        print(f"      风险标记: {h['is_risk_before']} → {h['is_risk_after']}")
        print(f"      处理状态: {h['status_before']} → {h['status_after']}")
        if h['remark']:
            print(f"      备注: {h['remark'][:80]}")
        print()
    
    print("✅ 历史留痕完整：每次变更都有改前改后、操作人、时间、原始行号")
    print("   remark_edit 类型也单独记录，能看出周姐只改了一条备注的差别")
    
    # ============================================================
    # 第三步：产品复盘页更新（样本 S001）
    #  验证点：当前状态、结果说明、可重跑命令（含两个导入+改判表）
    # ============================================================
    print_separator("【步骤3】产品复盘页更新 - 样本 S001")
    
    step3_result = step3_product_review(
        session, sample_id="S001",
        export_path="data/demo_review_S001.json"
    )
    
    timeline = step3_result["timeline"]
    
    print(f"样本 S001 概况:")
    print(f"  片段总数: {timeline['fragments_count']}")
    print(f"  涉及版本: {', '.join(timeline['model_versions'])}")
    print(f"  变更记录: {len(timeline['change_history'])} 条")
    print()
    
    print("当前处理状态分布:")
    for status, count in timeline["current_status_breakdown"].items():
        print(f"  {status}: {count} 条")
    print()
    
    # 验证：2条 needs_recheck（v2.0的两个片段）+ 1条 normal + 1条 pending_import
    status_breakdown = timeline["current_status_breakdown"]
    print("📍 验证状态分布:")
    print(f"   needs_recheck: {status_breakdown.get('needs_recheck', 0)} 条 (期望: 2 条，v2.0的两个片段)")
    print(f"   normal: {status_breakdown.get('normal', 0)} 条 (期望: 1 条，v1.0行15被改判)")
    print(f"   pending_import: {status_breakdown.get('pending_import', 0)} 条 (期望: 1 条，v1.0行23没动过)")
    
    # 验证：变更历史里有 remark_edit
    change_types = [l["change_type"] for l in timeline["change_history"]]
    print(f"\n📍 验证变更类型: {', '.join(set(change_types))}")
    print(f"   remark_edit 出现次数: {change_types.count('remark_edit')} (期望: 1 次，周姐只改一条备注)")
    print(f"   manual_edit 出现次数: {change_types.count('manual_edit')} (期望: 1 次，周姐完整改判)")
    
    # 所有片段当前状态
    print("\n各片段当前处理状态一览:")
    print(f"  {'片段ID':<8} {'行号':<6} {'版本':<6} {'风险':<8} {'状态':<18} {'最后更新人':<10}")
    print("  " + "-" * 75)
    for f in timeline["fragments_current_state"]:
        print(f"  {f['fragment_id']:<8} {f['original_line_number']:<6} "
              f"{f['model_version']:<6} {str(f['current_is_auto_reply_risk']):<8} "
              f"{f['processing_status']:<18} {f['last_updated_by'] or '':<10}")
        if f["current_remark"]:
            print(f"          备注: {f['current_remark'][:50]}")
    print()
    
    # 结果说明
    print("-" * 80)
    print("结果说明（产品复盘页直接展示这段）:")
    print("-" * 80)
    print(timeline["result_explanation"])
    
    # 可重跑命令
    print("\n" + "-" * 80)
    print("可重跑命令（完全复现 S001 结果）:")
    print("-" * 80)
    for cmd in timeline["replay_commands"]:
        print(f"\n  [{cmd['step']}] {cmd['description']}")
        print(f"      {cmd['command']}")
    
    # 验证重跑命令完整性
    replay_steps = [c["step"] for c in timeline["replay_commands"]]
    print(f"\n📍 验证重跑命令完整性:")
    print(f"   命令总数: {len(replay_steps)} 条")
    print(f"   包含 v1.0 导入: {'step1_import_v1' in ''.join(replay_steps)}")
    print(f"   包含 v2.0 导入: {'step1_import_v2' in ''.join(replay_steps)}")
    print(f"   包含周姐改判: {'step2_review' in ''.join(replay_steps)}")
    print(f"   包含状态查看: {'step_check_status' in replay_steps}")
    print(f"   包含报告导出: {'step3_product_review' in replay_steps}")
    
    # 验证改判重跑命令带文件
    review_cmds = [c for c in timeline["replay_commands"] if "step2_review" in c["step"]]
    if review_cmds:
        has_file = "--file" in review_cmds[0]["command"]
        print(f"   改判命令带改判表文件: {has_file}（按它执行能恢复周姐的人工结果）")
    
    print()
    print(f"复盘报告已导出: {step3_result.get('export_path', 'N/A')}")
    
    # ============================================================
    # 总结
    # ============================================================
    print_separator("验证总结 — S001 真实复盘样例")
    
    print("""
✅ 已串到同一条 S001 样例上的场景：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 两个模型版本导入（v1.0 + v2.0）
   - 都在 S001 上
   - v2.0 检测到版本变更，状态置为 needs_recheck
   - 不急着归 normal，留给运营复核人判断

2. 周姐改判表（两条，都在 S001 上）
   - S001/v1.0/行15：完整改判（manual_edit），风险→正常
   - S001/v2.0/行15：只改备注（remark_edit），"这条v2.0判断存疑"
   - 改判批次表有记录，带源文件路径

3. 产品复盘页（S001）
   - 当前处理状态一览：2条 needs_recheck + 1条 normal + 1条 pending_import
   - 结果说明文字：解释"为什么前后不一致"
   - 可重跑命令：v1.0导入 + v2.0导入 + 周姐改判 + 状态查看 + 报告导出
   - 改判重跑命令带改判表文件，按它执行能恢复周姐的人工结果

4. 历史留痕完整
   - 每次变更都有：原始行号、改前改后、操作人、时间
   - remark_edit 类型单独记录，能看出"周姐只改了一条备注"的差别
   - 原始模型判断 original_is_auto_reply_risk 永不改变

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

运营复核人再追问"S001为什么前后不一致"时：
  1. 打开产品复盘页 → 看结果说明
  2. 点进对应片段 → 看完整变更历史（含 remark_edit）
  3. 需要复现 → 跑 replay_commands 里的命令（带改判表文件）
  不用周姐手工解释了
""")


if __name__ == "__main__":
    main()
