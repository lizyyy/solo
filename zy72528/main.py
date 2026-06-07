#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from hallucination_service import HallucinationMarkService
from errors import HallucinationMarkError
import json


def demo_normal_sample():
    print("\n" + "=" * 70)
    print("📌 场景一：正常材料 - 应该顺利走完三步流程")
    print("=" * 70)

    service = HallucinationMarkService()
    result = service.run_full_workflow(
        sample_id="S001",
        prompt_version="v2.0",
        knowledge_link="https://kb.example.com/kb-005",
        material_type="正常材料",
        hallucination_mark=False
    )
    print(f"\n处理结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    return service


def demo_conflict_sample():
    print("\n" + "=" * 70)
    print("📌 场景二：提示词版本号与知识库链接冲突 - 需要老唐拍板")
    print("=" * 70)

    service = HallucinationMarkService()
    result = service.run_full_workflow(
        sample_id="S002",
        prompt_version="v1.0",
        knowledge_link="https://kb.example.com/kb-005",
        material_type="正常材料",
        hallucination_mark=True,
        conflict_resolution=(True, "经查知识库已更新，确认该链接适用v1.0版本")
    )
    print(f"\n处理结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    return service


def demo_404_sample():
    print("\n" + "=" * 70)
    print("📌 场景三：链接404 - 留给产品经理复核，别急着归正常")
    print("=" * 70)

    service = HallucinationMarkService()
    result = service.run_full_workflow(
        sample_id="S003",
        prompt_version="v2.0",
        knowledge_link="https://kb.example.com/404-page",
        material_type="正常材料",
        hallucination_mark=False
    )
    print(f"\n处理结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    return service


def demo_wrong_standard_sample():
    print("\n" + "=" * 70)
    print("📌 场景四：错口径材料 - 自动标记冲突待复核")
    print("=" * 70)

    service = HallucinationMarkService()
    result = service.run_full_workflow(
        sample_id="S004",
        prompt_version="v1.2",
        knowledge_link="https://kb.example.com/kb-003",
        material_type="错口径材料",
        hallucination_mark=False,
        conflict_resolution=(False, "口径错误，驳回重录")
    )
    print(f"\n处理结果: {json.dumps(result, ensure_ascii=False, indent=2)}")
    return service


def demo_supplementary_sample():
    print("\n" + "=" * 70)
    print("📌 场景五：补录材料 - 补录后重算")
    print("=" * 70)

    service = HallucinationMarkService()

    service.step1_import_prompt_version(
        sample_id="S005",
        prompt_version="v1.0",
        knowledge_link="https://kb.example.com/kb-001",
        material_type="正常材料",
        hallucination_mark=False
    )
    service.step2_review_knowledge_link("S005")
    service.step3_update_conflict_table("S005")

    print("\n🔄 发现需要补录，开始补录流程...")
    sup_sample = service.importer.supplementary_import(
        original_sample_id="S005",
        new_prompt_version="v2.0",
        new_knowledge_link="https://kb.example.com/kb-006",
        operator="算法运营老唐"
    )

    service.step2_review_knowledge_link(sup_sample.sample_id)
    conflict = service.step3_update_conflict_table(sup_sample.sample_id)
    if conflict:
        service.resolve_conflict_manually(
            sup_sample.sample_id,
            confirm=True,
            remark="补录后数据正确，确认通过"
        )

    print(f"\n补录样本ID: {sup_sample.sample_id}")
    print(f"原始样本ID: {sup_sample.supplementary_from}")
    return service


def show_conflict_table_and_history(service, sample_id=None):
    print("\n" + "=" * 70)
    print("📊 冲突样本表")
    print("=" * 70)
    conflict_table = service.get_conflict_table()
    if conflict_table:
        for row in conflict_table:
            print(json.dumps(row, ensure_ascii=False, indent=2))
    else:
        print("(暂无待处理冲突)")

    if sample_id:
        print(f"\n" + "=" * 70)
        print(f"📜 历史记录 - 样本 {sample_id}")
        print("=" * 70)
        history = service.get_full_history(sample_id)
        for h in history:
            print(f"[{h.timestamp.strftime('%H:%M:%S')}] {h.action} | "
                  f"{h.before_status} → {h.after_status} | "
                  f"{h.operator} | {h.detail}")


def show_self_check_report(service):
    print("\n" + "=" * 70)
    print("🔍 运行自检报告")
    print("=" * 70)
    report = service.run_self_check()
    print(report)


def show_error_examples():
    print("\n" + "=" * 70)
    print("💡 错误提示演示（说人话，不用内部字段名）")
    print("=" * 70)

    service = HallucinationMarkService()

    test_cases = [
        ("重复导入", lambda: (
            service.step1_import_prompt_version("E001", "v1.0", "https://kb.example.com/kb-001", "正常材料", False),
            service.step1_import_prompt_version("E001", "v1.0", "https://kb.example.com/kb-001", "正常材料", False)
        )),
        ("无效提示词版本", lambda:
            service.step1_import_prompt_version("E002", "v999", "https://kb.example.com/kb-001", "正常材料", False)
        ),
        ("无效材料类型", lambda:
            service.step1_import_prompt_version("E003", "v1.0", "https://kb.example.com/kb-001", "奇怪材料", False)
        ),
        ("找不到样本", lambda:
            service.step2_review_knowledge_link("NON_EXIST")
        ),
    ]

    for name, func in test_cases:
        print(f"\n❌ {name}:")
        try:
            func()
        except HallucinationMarkError as e:
            print(f"   人话提示: {e.friendly_message}")


def main():
    print("\n" + "🚀" * 30)
    print("     代码解释幻觉标记系统 - 完整演示")
    print("🚀" * 30)

    print("\n📋 演示说明：")
    print("   1. 正常材料 → 顺利通过")
    print("   2. 冲突材料 → 列出证据，老唐拍板")
    print("   3. 链接404 → 待产品复核，不自动判正常")
    print("   4. 错口径材料 → 自动标记冲突")
    print("   5. 补录材料 → 补录后重算")
    print("   6. 冲突表 + 历史记录对得上")
    print("   7. 自检报告覆盖四个必检项")
    print("   8. 错误提示说人话")

    input("\n按 Enter 开始演示...")

    s1 = demo_normal_sample()
    input("\n按 Enter 继续下一场景...")

    s2 = demo_conflict_sample()
    show_conflict_table_and_history(s2, "S002")
    input("\n按 Enter 继续下一场景...")

    s3 = demo_404_sample()
    show_conflict_table_and_history(s3, "S003")
    input("\n按 Enter 继续下一场景...")

    s4 = demo_wrong_standard_sample()
    show_conflict_table_and_history(s4, "S004")
    input("\n按 Enter 继续下一场景...")

    s5 = demo_supplementary_sample()
    show_conflict_table_and_history(s5, "S005")
    input("\n按 Enter 查看自检报告...")

    s_all = HallucinationMarkService()
    for i in range(5):
        try:
            s_all.step1_import_prompt_version(
                f"TEST{i:03d}",
                "v2.0",
                f"https://kb.example.com/kb-00{i+5}",
                "正常材料",
                False
            )
        except:
            pass
    show_self_check_report(s_all)

    input("\n按 Enter 查看错误提示演示...")
    show_error_examples()

    print("\n" + "🎉" * 30)
    print("     演示完成！所有核心功能都已覆盖")
    print("🎉" * 30)
    print("""
✅ 已实现功能清单：
   1. 三种材料导入（正常/错口径/补录）
   2. 冲突检测：提示词版本 vs 知识库链接
   3. 冲突证据列出，不替老唐自动拍板
   4. 三步流程：导入→补看链接→更新冲突表
   5. 链接404 → 待产品复核，不急着归正常
   6. 冲突样本表 + 历史记录对得上
   7. 四个必检项自检：重复导入/404标记/补录重算/导出一致
   8. 错误提示说人话，不用内部字段名
""")


if __name__ == "__main__":
    main()
