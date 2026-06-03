#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
资金池内部借款计息系统 - 演示脚本
"""

from workflow import LoanInterestWorkflow
from models import NextHandler


def print_separator(title=""):
    print("\n" + "=" * 70)
    if title:
        print(f"  {title}")
        print("=" * 70)


def main():
    print("""
╔═══════════════════════════════════════════════════════════════════╗
║            资金池内部借款计息管理系统 - 完整演示                   ║
╚═══════════════════════════════════════════════════════════════════╝

业务场景：
  - 客户经理提交借款邮件
  - 基金会计林姐匹配清算批次号
  - 机构简称不一致时，留给财务复核人处理
  - 所有修改可追溯，报告友好可读
""")

    workflow = LoanInterestWorkflow()

    print_separator("第一步：客户经理导入补充邮件")
    print("""
场景说明：
  客户经理提交了3笔借款的补充邮件。
  注意：第4条是重复导入（与第1条相同），系统会自动去重。
""")

    email_data_list = [
        {
            "batch_no": "JS20240601001",
            "institution_name": "华夏基金管理有限公司",
            "institution_short_name": "华夏基金",
            "loan_amount": 10000000.00,
            "interest_rate": 0.0435,
            "start_date": "2024-06-01",
            "end_date": "2024-06-30",
            "source_file": "email_20240601_01.eml",
            "raw_content": "..."
        },
        {
            "batch_no": "JS20240601002",
            "institution_name": "易方达基金管理有限公司",
            "institution_short_name": "易方达",
            "loan_amount": 25000000.00,
            "interest_rate": 0.042,
            "start_date": "2024-06-05",
            "end_date": "2024-07-05",
            "source_file": "email_20240601_02.eml",
            "raw_content": "..."
        },
        {
            "batch_no": "JS20240601003",
            "institution_name": "南方基金管理股份有限公司",
            "institution_short_name": "南方基金",
            "loan_amount": 15000000.00,
            "interest_rate": 0.045,
            "start_date": "2024-06-10",
            "end_date": "2024-07-10",
            "source_file": "email_20240601_03.eml",
            "raw_content": "..."
        },
        {
            "batch_no": "JS20240601001",
            "institution_name": "华夏基金管理有限公司",
            "institution_short_name": "华夏基金",
            "loan_amount": 10000000.00,
            "interest_rate": 0.0435,
            "start_date": "2024-06-01",
            "end_date": "2024-06-30",
            "source_file": "email_20240601_01_duplicate.eml",
            "raw_content": "..."
        },
    ]

    emails, records = workflow.step1_import_account_manager_email(email_data_list)
    print(f"✓ 导入邮件数量: {len(emails)}")
    print(f"✓ 创建计息记录数量: {len(records)} (已自动去重)")
    print(f"  - 注意：第4条重复邮件被识别，没有重复创建记录")

    for i, record in enumerate(records, 1):
        print(f"  {i}. {record.institution_name} - 本金: {record.loan_amount:,.2f}元 - 状态: {record.status}")

    print_separator("第二步：基金会计林姐补看清算批次号")
    print("""
场景说明：
  林姐收到清算批次号后，与借款记录进行匹配。
  注意：第1条的机构简称不一致（华夏基金 vs 华夏基），
        系统会自动标记为"机构简称不一致"，等待财务复核。
""")

    batch_data_list = [
        {
            "batch_no": "JS20240601001",
            "institution_name": "华夏基金管理有限公司",
            "institution_short_name": "华夏基",
            "settlement_amount": 10000000.00,
            "settlement_date": "2024-06-30",
            "source_file": "settlement_20240601001.csv"
        },
        {
            "batch_no": "JS20240601002",
            "institution_name": "易方达基金管理有限公司",
            "institution_short_name": "易方达",
            "settlement_amount": 25000000.00,
            "settlement_date": "2024-07-05",
            "source_file": "settlement_20240601002.csv"
        },
        {
            "batch_no": "JS20240601003",
            "institution_name": "南方基金管理股份有限公司",
            "institution_short_name": "南方",
            "settlement_amount": 15000000.00,
            "settlement_date": "2024-07-10",
            "source_file": "settlement_20240601003.csv"
        },
    ]

    record_batch_mapping = {
        records[0].record_id: "JS20240601001",
        records[1].record_id: "JS20240601002",
        records[2].record_id: "JS20240601003",
    }

    updated_records = workflow.step2_link_settlement_batches(batch_data_list, record_batch_mapping)

    print(f"✓ 关联清算批次号完成")
    for record in updated_records:
        conflict_flag = "⚠️" if record.has_short_name_conflict() else "✓"
        print(f"  {conflict_flag} {record.institution_name}")
        print(f"     邮件简称: {record.email_short_name}")
        print(f"     清算简称: {record.batch_short_name}")
        print(f"     当前状态: {record.status}")

    conflict_records = workflow.get_conflict_records()
    print(f"\n✓ 发现 {len(conflict_records)} 条机构简称不一致的记录，已标记为待复核")

    print_separator("林姐修改备注 - 历史记录追踪演示")
    print("""
场景说明：
  林姐发现第1条记录需要补充说明，修改了备注。
  系统会自动记录修改前后的差异。
""")

    target_record_id = records[0].record_id
    workflow.update_remark(
        record_id=target_record_id,
        new_remark="与清算岗确认过，该批次确实为华夏基金的借款",
        operator="基金会计林姐"
    )

    print("✓ 备注已更新")
    print("\n查看变更历史:")
    history = workflow.get_record_history(target_record_id)
    for item in history:
        print(f"  - [{item['修改时间']}] {item['修改人']} 修改了【{item['字段']}】")
        print(f"    从「{item['修改前']}」→「{item['修改后']}」")
        print(f"    原因: {item['修改原因']}")

    print_separator("第三步：更新补录记录")
    print("""
场景说明：
  林姐为每笔记录补充说明：
  - 为什么保留这条记录
  - 还缺少什么材料
  - 下一步该找谁
""")

    supplementary_data = {
        records[0].record_id: {
            "reason_kept": "虽然机构简称不一致，但借款本金、日期、批次号完全匹配，且已与清算岗口头确认",
            "missing_materials": ["华夏基金的正式借款合同扫描件", "机构名称变更说明函"],
            "next_handler": NextHandler.FINANCIAL_REVIEWER.value,
            "notes": "请财务复核后，联系客户经理补交合同"
        },
        records[1].record_id: {
            "reason_kept": "信息完整，机构简称一致，可正常计息",
            "missing_materials": [],
            "next_handler": NextHandler.FINANCIAL_REVIEWER.value,
            "notes": "无异常，可正常复核"
        },
        records[2].record_id: {
            "reason_kept": "机构简称不一致（南方基金 vs 南方），需财务确认以哪个为准",
            "missing_materials": ["机构简称规范对照表"],
            "next_handler": NextHandler.FINANCIAL_REVIEWER.value,
            "notes": "建议查看系统内历史记录的简称使用习惯"
        },
    }

    workflow.step3_update_supplementary_records(supplementary_data)
    print("✓ 补录记录已更新")

    print_separator("查看单条记录的友好报告")
    print("\n" + workflow.generate_friendly_report(target_record_id))

    print_separator("点击查看来源数据（图表展示时的回溯功能）")
    source_data = workflow.get_source_data(target_record_id)
    print(f"\n来源数据追溯 - 记录ID: {target_record_id}")
    print("\n【客户经理补充邮件】:")
    for email_src in source_data["客户经理补充邮件"]:
        print(f"  批次号: {email_src['批次号']}")
        print(f"  机构简称: {email_src['机构简称']}")
        print(f"  源文件: {email_src['源文件']}")

    print("\n【清算批次号】:")
    for batch_src in source_data["清算批次号"]:
        print(f"  批次号: {batch_src['批次号']}")
        print(f"  机构简称: {batch_src['机构简称']}")
        print(f"  源文件: {batch_src['源文件']}")

    print_separator("第四步：财务复核人处理机构简称不一致")
    print("""
场景说明：
  财务复核人对机构简称不一致的记录做出判断：
  - 第1条（华夏基金/华夏基）：以邮件为准，修正为"华夏基金"
  - 第3条（南方基金/南方）：手动指定为"南方基金"
""")

    review_decisions = {
        records[0].record_id: {
            "decision": "approve_email",
            "correct_short_name": None
        },
        records[2].record_id: {
            "decision": "custom",
            "correct_short_name": "南方基金"
        },
    }

    reviewed_records = workflow.step4_financial_reviewer_review(review_decisions)
    print(f"✓ 财务复核完成，共处理 {len(reviewed_records)} 条记录")

    for record in reviewed_records:
        print(f"  - {record.institution_name}: 状态 = {record.status}")
        print(f"    最终简称: 邮件={record.email_short_name}, 清算={record.batch_short_name}")

    print_separator("林姐再次修改备注 - 查看完整历史记录")

    workflow.update_remark(
        record_id=target_record_id,
        new_remark="财务复核完成，机构简称已统一为华夏基金，可以正常计息",
        operator="基金会计林姐"
    )

    print("\n完整变更历史:")
    full_history = workflow.get_record_history(target_record_id)
    for i, item in enumerate(full_history, 1):
        print(f"\n  {i}. [{item['修改时间']}] {item['修改人']}")
        print(f"     字段: {item['字段']}")
        print(f"     变更: {item['修改前']} → {item['修改后']}")
        print(f"     原因: {item['修改原因']}")

    print_separator("最终汇总报告")
    summary = workflow.generate_summary()
    print(f"\n【汇总概览】")
    for k, v in summary["汇总概览"].items():
        print(f"  {k}: {v}")

    print(f"\n【金额汇总】")
    for k, v in summary["金额汇总"].items():
        print(f"  {k}: {v}")

    print(f"\n【工作流程进度】")
    progress = workflow.get_workflow_progress()
    for step in progress:
        print(f"  ✓ {step['步骤']} - {step['状态']} ({step['操作人']})")

    print_separator("演示完成")
    print("""
系统实现的核心功能总结：

  1. ✓ 去重导入：重复导入同一批邮件不会创建重复记录
  2. ✓ 历史追踪：修改备注等操作会记录改前改后差异
  3. ✓ 来源追溯：点击可回到原始邮件和清算批次号
  4. ✓ 友好报告：不是冷冰冰的日志，包含业务说明
  5. ✓ 补录记录：说明保留原因、缺失材料、下一步找谁
  6. ✓ 参数说明：计算参数版本和取舍理由可追溯
  7. ✓ 冲突处理：机构简称不一致不急着归正常，留待财务复核
  8. ✓ 完整流程：邮件导入→清算匹配→补录更新→财务复核
""")


if __name__ == "__main__":
    main()
