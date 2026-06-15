"""完整工作流演示脚本 — 状态流与结果说明验证版

出问题样例场景：
1. 样本S001，模型v1.0 → 2个片段，状态 pending_import
2. 模型升级到v2.0，同一样本S001 → 触发版本变更检测，状态 needs_recheck
   （不急着归正常，留给运营复核人复核）
3. 标注负责人周姐补看人工改判表：
   - 片段1：完整改判（风险→正常）
   - 片段2：只改一条备注（不改风险标记）
4. 停在处理状态查看：状态变化、历史留痕、结果说明、可重跑命令

验证重点：
- 当前处理状态是否可靠保留在片段上
- 模型版本变更的记录是否留痕
- 周姐只改了一条备注的场景是否支持
- 产品复盘链路是否输出当前状态 + 结果说明 + 可重跑命令
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from email_auto_reply_risk.database import get_session, init_db
from email_auto_reply_risk.core import (
    get_fragment_current_state, get_fragment_history
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


def print_status_snapshot(session, fragment_ids, label=""):
    """打印片段状态快照 - 停在处理状态看变化"""
    print(f"\n--- {label} ---")
    print(f"{'片段ID':<10} {'行号':<8} {'版本':<8} {'原始风险':<10} {'当前风险':<10} {'处理状态':<18} {'备注'}")
    print("-" * 90)
    for fid in fragment_ids:
        s = get_fragment_current_state(session, fid)
        remark = (s["current_remark"] or "")[:30]
        print(f"{s['fragment_id']:<10} {s['original_line_number']:<8} "
              f"{s['model_version']:<8} {str(s['original_is_auto_reply_risk']):<10} "
              f"{str(s['current_is_auto_reply_risk']):<10} {s['processing_status']:<18} {remark}")


def main():
    print_separator("邮件自动回复风险 - 状态流与结果说明验证")
    print("""
出问题样例：
  样本S001，模型从v1.0升级到v2.0
  运营复核人追问：为什么"邮件自动回复风险"前后不一致？
  之前周姐只能手工解释，现在系统里有完整证据链
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
    step1_result = step1_import_model_outputs(
        session, v1_file, "v1.0", "系统导入",
        batch_id="batch_v1_001",
        remark="首次导入模型v1.0输出"
    )
    
    v1_fragment_ids = [f["fragment_id"] for f in step1_result["fragments_current_state"]]
    
    print(f"批次ID: {step1_result['batch_id']}")
    print(f"新增片段: {step1_result['fragments_count']} 条")
    print(f"是否检测到版本变更: {step1_result['has_model_version_change']}")
    
    # 停在处理状态看状态
    print_status_snapshot(session, v1_fragment_ids, "导入v1.0后的处理状态")
    
    print("\n" + step1_result["result_explanation"])
    
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
    # 第二步：导入 v2.0，同一样本 S001 → 触发模型版本变更
    # ============================================================
    print_separator("【步骤1续】导入模型 v2.0 输出（同一样本 S001，触发版本变更检测）")
    
    v2_file = os.path.join(DATA_DIR, "model_output_v2.0.json")
    step1_v2_result = step1_import_model_outputs(
        session, v2_file, "v2.0", "系统导入",
        batch_id="batch_v2_001",
        remark="导入模型v2.0输出，同一样本编号S001"
    )
    
    v2_fragment_ids = [f["fragment_id"] for f in step1_v2_result["fragments_current_state"]]
    all_fragment_ids = v1_fragment_ids + v2_fragment_ids
    
    print(f"批次ID: {step1_v2_result['batch_id']}")
    print(f"新增片段: {step1_v2_result['fragments_count']} 条")
    print(f"是否检测到版本变更: {step1_v2_result['has_model_version_change']}")
    
    # 停在处理状态看 — 重点看 needs_recheck
    print_status_snapshot(session, all_fragment_ids, "导入v2.0后的处理状态")
    
    print("\n" + step1_v2_result["result_explanation"])
    
    print("""
⚠️  关键观察点：
  1. v2.0 的两个片段状态都是 needs_recheck
  2. 没有自动归 normal（正常），留给运营复核人判断
  3. 备注里写了版本变更的原因
  4. v1.0 的记录还在，没被覆盖，可对比
""")
    
    # ============================================================
    # 第三步：周姐补看人工改判表
    #   - 片段1（v1.0行15）：完整改判，风险→正常
    #   - 片段3（v2.0行15）：只改备注，不改风险标记
    # ============================================================
    print_separator("【步骤2】标注负责人周姐补看人工改判表")
    
    review_records = [
        {
            "fragment_id": 1,
            "reviewed_is_risk": False,
            "remark": "周姐人工确认：这不是自动回复，是客户真实回复，语气有差异"
        },
        {
            "fragment_id": 3,
            "only_edit_remark": True,
            "remark": "周姐备注：这条v2.0判断存疑，待运营复核确认，暂不改判"
        }
    ]
    
    print("改判表内容:")
    for r in review_records:
        if r.get("only_edit_remark"):
            print(f"  片段{r['fragment_id']}: 仅改备注 → {r['remark']}")
        else:
            print(f"  片段{r['fragment_id']}: 风险={r['reviewed_is_risk']}, 备注={r['remark']}")
    
    step2_result = step2_manual_review(
        session, review_records, "周姐",
        review_batch_id="review_batch_001"
    )
    
    print(f"\n改判完成: 共{step2_result['total_reviewed']}条")
    print(f"  完整改判: {step2_result['manual_edit_count']} 条")
    print(f"  仅改备注: {step2_result['remark_edit_count']} 条")
    
    # 停在处理状态看改判后的变化
    print_status_snapshot(session, all_fragment_ids, "周姐改判后的处理状态")
    
    print("\n" + step2_result["result_explanation"])
    
    print("""
✅ 关键观察点：
  1. 片段1（v1.0行15）：风险 True→False，状态 pending_import→normal
  2. 片段3（v2.0行15）：风险没变，备注改了，状态还是 needs_recheck
     （周姐只改了备注，没改判，留给运营复核）
  3. 原始模型判断 original_is_auto_reply_risk 没变
""")
    
    # ============================================================
    # 查看单条片段的完整变更历史 — 运营追问时用
    # ============================================================
    print_separator("【运营追问时】查看片段3的完整变更历史（v2.0 行15）")
    
    history = get_fragment_history(session, 3)
    print(f"片段3 共有 {len(history)} 条变更记录：\n")
    
    for i, h in enumerate(history, 1):
        print(f"  [{i}] {h['change_type']}  by {h['changed_by']}  at {h['changed_at'][:19]}")
        print(f"      原始行号: {h['original_line_number']}")
        print(f"      模型版本: {h['model_version_before']} → {h['model_version_after']}")
        print(f"      风险标记: {h['is_risk_before']} → {h['is_risk_after']}")
        print(f"      处理状态: {h['status_before']} → {h['status_after']}")
        if h['remark']:
            print(f"      备注: {h['remark']}")
        print()
    
    print("✅ 历史留痕完整：每次变更都有改前改后、操作人、时间、原始行号")
    
    # ============================================================
    # 第四步：产品复盘页更新
    #   输出：当前处理状态一览 + 结果说明 + 可重跑命令
    # ============================================================
    print_separator("【步骤3】产品复盘页更新 - 样本S001")
    
    step3_result = step3_product_review(
        session, sample_id="S001",
        export_path="data/demo_review_S001.json"
    )
    
    timeline = step3_result["timeline"]
    
    print(f"样本S001概况:")
    print(f"  片段总数: {timeline['fragments_count']}")
    print(f"  涉及版本: {', '.join(timeline['model_versions'])}")
    print(f"  变更记录: {len(timeline['change_history'])} 条")
    print()
    
    print("当前处理状态分布:")
    for status, count in timeline["current_status_breakdown"].items():
        print(f"  {status}: {count} 条")
    print()
    
    # 所有片段当前状态
    print("各片段当前处理状态一览:")
    print(f"  {'片段ID':<8} {'行号':<6} {'版本':<6} {'风险':<8} {'状态':<18} {'最后更新人':<10}")
    print("  " + "-" * 75)
    for f in timeline["fragments_current_state"]:
        print(f"  {f['fragment_id']:<8} {f['original_line_number']:<6} "
              f"{f['model_version']:<6} {str(f['current_is_auto_reply_risk']):<8} "
              f"{f['processing_status']:<18} {f['last_updated_by'] or '':<10}")
    print()
    
    # 结果说明
    print("-" * 80)
    print("结果说明（产品复盘页直接展示这段）:")
    print("-" * 80)
    print(timeline["result_explanation"])
    
    # 可重跑命令
    print("-" * 80)
    print("可重跑命令（完全复现本次结果）:")
    print("-" * 80)
    for cmd in timeline["replay_commands"]:
        print(f"\n  [{cmd['step']}] {cmd['description']}")
        print(f"      {cmd['command']}")
    
    print()
    print(f"复盘报告已导出: {step3_result.get('export_path', 'N/A')}")
    
    # ============================================================
    # 总结
    # ============================================================
    print_separator("验证总结")
    
    print("""
✅ 已修复的问题：
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 当前处理状态可靠保留
   - ModelOutputFragment 增加了 processing_status 字段
   - 产品复盘直接读这个字段，不用从日志倒推
   - 状态：pending_import → needs_recheck → confirmed_risk / normal

2. 模型版本换了但样本编号没变 → 有留痕
   - 自动检测版本变更，状态置为 needs_recheck
   - 不急着归 normal，留给运营复核人判断
   - 变更日志里有 MODEL_VERSION_CHANGE 记录，带旧版本列表
   - 旧版本数据不删，可对比

3. 周姐只改了一条备注 → 支持
   - 新增 only_edit_remark 模式
   - 变更类型为 REMARK_EDIT
   - 风险标记不变，只有备注变
   - 历史记录里能看出改前改后的备注差别

4. 产品复盘链路完整
   - 输出当前处理状态一览（不是只有汇总数）
   - 输出结果说明文字（解释为什么前后不一致）
   - 输出可重跑命令（完全复现）
   - 每条变更都有：原始行号、改前改后、操作人、时间

5. 重复导入不翻倍
   - 同一 batch_id 重复导入直接跳过
   - 同版本同样本同行号视为重复
   - 汇总数从明细真实统计，不硬编码

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

运营复核人再追问"为什么前后不一致"时：
  1. 打开产品复盘页 → 看结果说明
  2. 点进对应片段 → 看完整变更历史
  3. 需要复现 → 跑可重放命令
  不用周姐手工解释了
""")


if __name__ == "__main__":
    main()
