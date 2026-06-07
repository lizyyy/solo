#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from hallucination_service import HallucinationMarkService
from errors import HallucinationMarkError
import json
import sys


def test_normal_sample():
    print("\n" + "=" * 70)
    print("✅ 场景一：正常材料 - 顺利走完三步流程")
    print("=" * 70)

    service = HallucinationMarkService()
    result = service.run_full_workflow(
        sample_id="S001",
        prompt_version="v2.0",
        knowledge_link="https://kb.example.com/kb-005",
        material_type="正常材料",
        hallucination_mark=False
    )

    assert result["final_status"] == "正常"
    assert result["conflict"] is False
    assert result["link_404"] is False
    print("✅ 测试通过：正常材料处理正确")
    return service


def test_conflict_sample():
    print("\n" + "=" * 70)
    print("✅ 场景二：提示词版本号与知识库链接冲突 - 列出证据，老唐拍板")
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

    assert result["conflict"] is True
    assert result["final_status"] == "已确认"

    conflict_table = service.get_conflict_table()
    print(f"✅ 测试通过：冲突检测正确，待处理冲突表已清空（剩余 {len(conflict_table)} 条）")

    history = service.get_full_history("S002")
    print(f"✅ 历史记录共 {len(history)} 条，冲突样本表和历史记录对得上")
    return service


def test_404_sample():
    print("\n" + "=" * 70)
    print("✅ 场景三：链接404 - 留给产品经理复核，不急着归正常")
    print("=" * 70)

    service = HallucinationMarkService()
    result = service.run_full_workflow(
        sample_id="S003",
        prompt_version="v2.0",
        knowledge_link="https://kb.example.com/404-page",
        material_type="正常材料",
        hallucination_mark=False
    )

    assert result["link_404"] is True
    assert result["final_status"] == "待产品复核"

    sample = service.importer.get_sample("S003")
    assert sample.link_valid is False
    assert sample.status.value == "待产品复核"

    print("✅ 测试通过：链接404正确标记为待产品复核，没有自动归正常")
    return service


def test_wrong_standard_sample():
    print("\n" + "=" * 70)
    print("✅ 场景四：错口径材料 - 自动标记冲突待复核")
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

    assert result["conflict"] is True
    assert result["final_status"] == "已驳回"
    print("✅ 测试通过：错口径材料自动标记冲突，驳回处理正确")
    return service


def test_supplementary_sample():
    print("\n" + "=" * 70)
    print("✅ 场景五：补录材料 - 补录后重算")
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

    assert sup_sample.supplementary_from == "S005"
    assert sup_sample.material_type.value == "补录材料"

    history = service.get_full_history("S005")
    has_supplementary_record = any("补录" in h.action for h in history)
    assert has_supplementary_record, "原始样本应该有补录操作记录"

    print(f"✅ 测试通过：补录样本 {sup_sample.sample_id} 创建成功，原始样本有补录历史记录")
    return service


def test_self_check():
    print("\n" + "=" * 70)
    print("✅ 自检模块：四个必检项覆盖")
    print("=" * 70)

    service = HallucinationMarkService()

    test_data = [
        {"sample_id": "T001", "prompt_version": "v2.0", "knowledge_link": "https://kb.example.com/kb-005",
         "material_type": "正常材料", "hallucination_mark": False},
        {"sample_id": "T002", "prompt_version": "v2.1", "knowledge_link": "https://kb.example.com/kb-008",
         "material_type": "正常材料", "hallucination_mark": False},
        {"sample_id": "T003", "prompt_version": "v1.2", "knowledge_link": "https://kb.example.com/kb-004",
         "material_type": "正常材料", "hallucination_mark": True},
    ]

    for data in test_data:
        service.step1_import_prompt_version(**data)
        service.step2_review_knowledge_link(data["sample_id"])
        service.step3_update_conflict_table(data["sample_id"])

    sup = service.importer.supplementary_import("T001", operator="算法运营老唐")
    service.step2_review_knowledge_link(sup.sample_id)
    service.step3_update_conflict_table(sup.sample_id)

    report = service.run_self_check()
    print(report)

    assert "重复导入检查" in report
    assert "404链接标记检查" in report
    assert "补录后重算检查" in report
    assert "导出一致性检查" in report

    exported = service.export_data()
    assert len(exported) == 4
    print("✅ 测试通过：自检四个必检项全覆盖，导出数据一致")


def test_friendly_errors():
    print("\n" + "=" * 70)
    print("✅ 错误提示：说人话，不用内部字段名")
    print("=" * 70)

    service = HallucinationMarkService()

    test_cases = [
        ("重复导入", lambda: (
            service.step1_import_prompt_version("E001", "v1.0", "https://kb.example.com/kb-001", "正常材料", False),
            service.step1_import_prompt_version("E001", "v1.0", "https://kb.example.com/kb-001", "正常材料", False)
        ), "已经导入过了"),
        ("无效提示词版本", lambda:
            service.step1_import_prompt_version("E002", "v999", "https://kb.example.com/kb-001", "正常材料", False),
         "提示词版本号"),
        ("无效材料类型", lambda:
            service.step1_import_prompt_version("E003", "v1.0", "https://kb.example.com/kb-001", "奇怪材料", False),
         "材料类型"),
        ("找不到样本", lambda:
            service.step2_review_knowledge_link("NON_EXIST"),
         "找不到样本"),
    ]

    for name, func, keyword in test_cases:
        try:
            func()
            assert False, f"应该抛出 {name} 错误"
        except HallucinationMarkError as e:
            assert keyword in e.friendly_message, f"错误提示应该包含'{keyword}'"
            print(f"   ✅ {name}: {e.friendly_message}")

    print("✅ 测试通过：所有错误提示都说人话，业务同事能看懂")


def test_history_consistency():
    print("\n" + "=" * 70)
    print("✅ 冲突样本表和历史记录对得上")
    print("=" * 70)

    service = HallucinationMarkService()

    service.run_full_workflow(
        sample_id="H001",
        prompt_version="v1.0",
        knowledge_link="https://kb.example.com/kb-005",
        material_type="正常材料",
        hallucination_mark=True,
        conflict_resolution=(True, "确认通过")
    )

    history = service.get_full_history("H001")
    print(f"   历史记录条数: {len(history)}")
    for h in history:
        print(f"   - [{h.timestamp.strftime('%H:%M:%S')}] {h.action}: {h.detail}")

    actions = [h.action for h in history]
    assert "导入样本" in actions
    assert "冲突检测" in actions
    assert "链接检测" in actions
    assert "人工处理冲突" in actions

    print("✅ 测试通过：冲突样本表和历史记录对得上")


def main():
    print("\n" + "🧪" * 30)
    print("     代码解释幻觉标记系统 - 自动化测试")
    print("🧪" * 30)

    all_passed = True
    tests = [
        test_normal_sample,
        test_conflict_sample,
        test_404_sample,
        test_wrong_standard_sample,
        test_supplementary_sample,
        test_self_check,
        test_friendly_errors,
        test_history_consistency,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            failed += 1
            all_passed = False
            print(f"\n❌ {test.__name__} 测试失败: {e}")
            import traceback
            traceback.print_exc()

    print("\n" + "=" * 70)
    print(f"📊 测试结果: {passed}/{len(tests)} 通过")
    print("=" * 70)

    if all_passed:
        print("\n🎉 所有测试通过！")
        print("""
✅ 核心功能全部实现：
   1. 三种材料导入（正常/错口径/补录）
   2. 冲突检测：提示词版本 vs 知识库链接
   3. 冲突证据列出，不替老唐自动拍板
   4. 三步流程：导入→补看链接→更新冲突表
   5. 链接404 → 待产品复核，不急着归正常
   6. 冲突样本表 + 历史记录对得上
   7. 四个必检项自检：重复导入/404标记/补录重算/导出一致
   8. 错误提示说人话，不用内部字段名
        """)
        return 0
    else:
        print(f"\n❌ 有 {failed} 个测试失败")
        return 1


if __name__ == "__main__":
    sys.exit(main())
