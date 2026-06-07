"""完整工作流演示脚本

演示场景：
1. 导入模型 v1.0 输出
2. 导入模型 v2.0 输出（同一样本编号，触发模型版本变更检测）
3. 周姐进行人工改判
4. 查看变更历史（运营复核人追问时用）
5. 生成产品复盘报告
6. 生成可重放命令
"""

import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from email_auto_reply_risk.database import get_session, init_db
from email_auto_reply_risk.core import (
    import_model_outputs, apply_manual_review,
    get_fragment_history, get_sample_risk_timeline
)
from email_auto_reply_risk.workflow import (
    step1_import_model_outputs, step2_manual_review,
    step3_product_review, generate_replay_commands
)

DB_PATH = "data/demo_email_risk.db"
DATA_DIR = os.path.join(os.path.dirname(__file__), "sample_data")


def print_separator(title=""):
    print("\n" + "=" * 80)
    if title:
        print(f"  {title}")
        print("=" * 80)


def main():
    print_separator("邮件自动回复风险 - 完整工作流演示")
    
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    
    init_db(DB_PATH)
    session = get_session(DB_PATH)
    
    print_separator("【步骤1】导入模型 v1.0 输出")
    
    v1_file = os.path.join(DATA_DIR, "model_output_v1.0.json")
    result1 = step1_import_model_outputs(
        session, v1_file, "v1.0", "系统导入",
        batch_id="batch_v1_001",
        remark="首次导入模型v1.0输出"
    )
    
    print(f"批次ID: {result1['result']['batch_id']}")
    print(f"总记录: {result1['result']['total_records']}")
    print(f"新增: {result1['result']['new_records']}")
    print(f"跳过重复: {result1['result']['duplicate_skipped']}")
    
    print_separator("【验证】重复导入同一批数据（应全部跳过）")
    
    result1_dup = step1_import_model_outputs(
        session, v1_file, "v1.0", "系统导入",
        batch_id="batch_v1_001"
    )
    print(f"状态: {result1_dup['result']['status']}")
    print(f"跳过重复: {result1_dup['result']['duplicate_skipped']}")
    print("✅ 重复导入检测生效，数量不会翻倍")
    
    print_separator("【步骤1续】导入模型 v2.0 输出（同一样本 S001，触发版本变更检测）")
    
    v2_file = os.path.join(DATA_DIR, "model_output_v2.0.json")
    result2 = step1_import_model_outputs(
        session, v2_file, "v2.0", "系统导入",
        batch_id="batch_v2_001",
        remark="导入模型v2.0输出，同一样本编号S001"
    )
    
    print(f"批次ID: {result2['result']['batch_id']}")
    print(f"总记录: {result2['result']['total_records']}")
    print(f"新增: {result2['result']['new_records']}")
    print("\n⚠️  关键：检测到S001样本存在v1.0版本，新版本v2.0状态置为 NEEDS_RECHECK")
    print("   （不急着归正常，留给运营复核人复核）")
    
    print_separator("【查看】片段1的变更历史（运营复核人追问时用）")
    
    history = get_fragment_history(session, 1)
    for h in history:
        print(f"\n变更ID: {h['change_id']}")
        print(f"  类型: {h['change_type']}")
        print(f"  操作人: {h['changed_by']}")
        print(f"  时间: {h['changed_at']}")
        print(f"  原始行号: {h['original_line_number']}")
        print(f"  风险标记: {h['is_risk_before']} → {h['is_risk_after']}")
        if h['remark']:
            print(f"  备注: {h['remark']}")
    
    print_separator("【步骤2】标注负责人周姐补看人工改判表")
    
    review_file = os.path.join(DATA_DIR, "manual_review_001.json")
    with open(review_file, 'r', encoding='utf-8') as f:
        review_records = json.load(f)
    
    for r in review_records:
        print(f"  改判片段ID: {r['fragment_id']}")
        print(f"  改判结果: is_risk = {r['reviewed_is_risk']}")
        print(f"  备注: {r['remark']}")
    
    review_result = step2_manual_review(
        session, review_records, "周姐",
        review_batch_id="review_batch_001"
    )
    
    print(f"\n共改判: {review_result['total_reviewed']} 条")
    for r in review_result['results']:
        print(f"  片段{r['fragment_id']}: {r['original_is_risk']} → {r['reviewed_is_risk']}")
    
    print_separator("【查看】改判后片段1的完整变更历史")
    
    history = get_fragment_history(session, 1)
    print(f"片段1共有 {len(history)} 条变更记录：")
    for h in history:
        print(f"\n  [{h['change_type']}] {h['changed_at']}")
        print(f"    操作人: {h['changed_by']}")
        print(f"    风险: {h['is_risk_before']} → {h['is_risk_after']}")
        if h['remark']:
            print(f"    备注: {h['remark']}")
    
    print("\n✅ 改前改后清晰可见，运营追问时能回到证据")
    
    print_separator("【步骤3】产品复盘页更新 - 生成S001样本完整时间线")
    
    review_export = "data/demo_review_S001.json"
    product_result = step3_product_review(
        session, sample_id="S001",
        export_path=review_export
    )
    
    timeline = product_result['timeline']
    print(f"样本S001:")
    print(f"  片段数: {timeline['fragments_count']}")
    print(f"  涉及模型版本: {timeline['model_versions']}")
    print(f"  变更记录数: {len(timeline['change_history'])}")
    print(f"\n  汇总历史:")
    for s in timeline['summary_history']:
        print(f"    {s['model_version']}: 风险{s['risk_count']} / 正常{s['normal_count']} / 总计{s['total_fragments']}")
    
    print(f"\n✅ 复盘报告已导出到: {review_export}")
    
    print_separator("【生成可重放命令】")
    
    commands = generate_replay_commands(session, "batch_v1_001")
    print("如需复现本次操作，可执行以下命令：\n")
    for cmd in commands:
        print(cmd)
        print()
    
    print_separator("演示完成")
    print("""
总结：
✅ 模型输出片段第一次导入 → 记录原始行号、版本信息
✅ 模型版本换了但样本编号没变 → 置为 NEEDS_RECHECK，留给运营复核
✅ 标注负责人周姐改判 → 完整记录改前改后
✅ 重复导入 → 不增加风险数量
✅ 运营追问 → 可查看单条片段变更历史
✅ 产品复盘 → 可生成完整时间线和可重放命令
""")


if __name__ == "__main__":
    main()
