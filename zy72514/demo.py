#!/usr/bin/env python3
"""
短视频封面违规样本 - 完整流程演示
演示：导入标注员留言、标注负责人周姐补看模型输出、模型版本对比更新
"""

import json
from sample_manager import SampleManager
from schemas import SampleStatus


def print_separator(title=""):
    print("\n" + "=" * 80)
    if title:
        print(f"  {title}")
        print("=" * 80)


def demo_step1_import_annotator_messages():
    print_separator("第一步：标注员留言第一次导入")

    manager = SampleManager()

    test_messages = [
        {
            "source_file": "群聊记录_20260601.txt",
            "line_number": 42,
            "raw_content": "封面文字'今晚必看'太夸张，诱导点击，建议判定违规",
            "annotator_name": "标注员小王",
            "video_id": "VID_001",
            "cover_image_url": "https://example.com/cover1.jpg",
            "conclusion": "违规",
        },
        {
            "source_file": "群聊记录_20260601.txt",
            "line_number": 58,
            "raw_content": "封面人物穿着暴露，涉嫌低俗",
            "annotator_name": "标注员小李",
            "video_id": "VID_002",
            "cover_image_url": "https://example.com/cover2.jpg",
            "conclusion": "违规",
        },
        {
            "source_file": "群聊记录_20260601.txt",
            "line_number": 73,
            "raw_content": "这个封面看起来正常，没什么问题",
            "annotator_name": "标注员小张",
            "video_id": "VID_003",
            "cover_image_url": "https://example.com/cover3.jpg",
            "conclusion": "正常",
        },
    ]

    sample_ids = []
    for msg in test_messages:
        sample, is_new = manager.import_annotator_message(
            source_file=msg["source_file"],
            line_number=msg["line_number"],
            raw_content=msg["raw_content"],
            annotator_name=msg["annotator_name"],
            video_id=msg["video_id"],
            cover_image_url=msg["cover_image_url"],
            conclusion=msg["conclusion"],
        )
        sample_ids.append(sample.sample_id)
        print(f"  导入样本 {sample.sample_id}:")
        print(f"    - 来源: {msg['source_file']} 第{msg['line_number']}行")
        print(f"    - 原始标注: {msg['raw_content']}")
        print(f"    - 标注员结论: {msg['conclusion']}")
        print(f"    - 当前状态: {sample.current_status.value}")
        print(f"    - 是否新建: {is_new}")

    print_separator("测试：重复导入同一批标注员留言（应去重）")

    msg = test_messages[0]
    sample, is_new = manager.import_annotator_message(
        source_file=msg["source_file"],
        line_number=msg["line_number"],
        raw_content=msg["raw_content"],
        annotator_name=msg["annotator_name"],
        video_id=msg["video_id"],
        cover_image_url=msg["cover_image_url"],
        conclusion=msg["conclusion"],
    )
    print(f"  重复导入样本 {sample.sample_id}:")
    print(f"    - 是否新建: {is_new} (预期: False)")
    print(f"    - 历史记录数: {len(sample.history)} (应有重复导入记录)")

    stats = manager.get_stats()
    print(f"\n  当前统计:")
    print(f"    - 总样本数: {stats['total_samples']} (预期: 3)")
    print(f"    - 总历史记录数: {stats['total_history_records']}")

    return manager, sample_ids


def demo_step2_manager_review_and_model_output(manager, sample_ids):
    print_separator("第二步：标注负责人周姐补看模型输出片段")

    print("\n  2.1 周姐回看，不能直接照抄标注员结论，需修正")
    sample1_id = sample_ids[0]
    sample = manager.manager_review(
        sample_id=sample1_id,
        manager_name="周姐",
        manager_notes="回看后发现原标注结论太笼统，需要结合模型输出再判断",
        edited_annotation="封面文字'今晚必看'属于夸张诱导，但需结合视频内容确认是否真正违规",
    )
    print(f"  样本 {sample1_id}:")
    print(f"    - 原始标注: {sample.original_annotation.raw_content}")
    print(f"    - 周姐修正后: {sample.current_annotation}")
    print(f"    - 当前状态: {sample.current_status.value}")
    print(f"    - 历史记录中的人工改动:")
    last_record = sample.history[-1]
    for edit in last_record.manual_edits:
        print(f"      * {edit.field_changed}: '{edit.old_value}' -> '{edit.new_value}'")
        print(f"        原因: {edit.reason}")

    print("\n  2.2 补加模型输出片段（模拟后来才补到群里）")
    sample = manager.add_model_output(
        sample_id=sample1_id,
        version="v1.0",
        violation_score=0.72,
        confidence=0.85,
        raw_fragment="模型检测到'诱导点击'关键词，置信度0.85，违规概率0.72",
        operator="周姐",
    )
    print(f"  样本 {sample1_id}:")
    print(f"    - 模型版本: {sample.model_outputs[-1].version}")
    print(f"    - 违规分数: {sample.model_outputs[-1].violation_score}")
    print(f"    - 置信度: {sample.model_outputs[-1].confidence}")
    print(f"    - 当前状态: {sample.current_status.value}")

    print("\n  2.3 测试低置信度样本（置信度<0.6，不能被平均指标盖住）")
    sample2_id = sample_ids[1]
    manager.manager_review(
        sample_id=sample2_id,
        manager_name="周姐",
        manager_notes="这个样本看起来有点模糊",
    )
    sample = manager.add_model_output(
        sample_id=sample2_id,
        version="v1.0",
        violation_score=0.45,
        confidence=0.42,
        raw_fragment="模型检测到'暴露'特征，但置信度较低，仅0.42",
        operator="周姐",
    )
    print(f"  样本 {sample2_id}:")
    print(f"    - 模型置信度: {sample.model_outputs[-1].confidence} (< 0.6)")
    print(f"    - 是否标记低置信度: {sample.is_low_confidence} (预期: True)")
    print(f"    - 当前状态: {sample.current_status.value} (预期: low_confidence)")
    print(f"    - 说明: 留给知识库编辑复核，不急着归正常")

    print("\n  2.4 测试：低置信度样本试图直接判正常（应报错）")
    try:
        manager.kb_editor_review(
            sample_id=sample2_id,
            editor_name="知识库编辑小郑",
            final_status=SampleStatus.CONFIRMED_NORMAL,
        )
        print("    错误：居然允许低置信度样本直接判正常！")
    except ValueError as e:
        print(f"    正确拦截: {e}")

    return manager, sample_ids


def demo_step3_model_version_comparison(manager, sample_ids):
    print_separator("第三步：模型版本对比更新")

    sample1_id = sample_ids[0]

    print("\n  3.1 更新模型版本，对比新旧输出")
    sample = manager.update_model_version(
        sample_id=sample1_id,
        old_version="v1.0",
        new_version="v2.0",
        new_violation_score=0.88,
        new_confidence=0.92,
        new_raw_fragment="模型v2.0优化后，检测到'诱导点击+虚假宣传'，置信度提升到0.92",
        operator="算法团队",
    )
    print(f"  样本 {sample1_id}:")
    print(f"    - 最新模型版本: {sample.model_outputs[-1].version}")
    print(f"    - 新违规分数: {sample.model_outputs[-1].violation_score}")
    print(f"    - 新置信度: {sample.model_outputs[-1].confidence}")
    print(f"    - 当前状态: {sample.current_status.value}")
    print(f"    - 历史记录中的版本变更:")
    last_record = sample.history[-1]
    for edit in last_record.manual_edits:
        print(f"      * {edit.field_changed}: {edit.old_value} -> {edit.new_value}")

    print("\n  3.2 知识库编辑最终复核")
    sample = manager.kb_editor_review(
        sample_id=sample1_id,
        editor_name="知识库编辑小郑",
        final_status=SampleStatus.CONFIRMED_VIOLATION,
        kb_notes="结合模型v2.0输出和人工判断，确认违规",
    )
    print(f"  样本 {sample1_id}:")
    print(f"    - 最终状态: {sample.current_status.value}")
    print(f"    - 知识库备注: {sample.kb_editor_notes}")

    print("\n  3.3 测试：周姐只改了一条备注，历史里能看出差别")
    sample3_id = sample_ids[2]
    manager.manager_review(
        sample_id=sample3_id,
        manager_name="周姐",
        manager_notes="初看正常，等模型输出",
    )

    sample_before = manager.get_sample_by_id(sample3_id)
    manager_notes_before = sample_before.manager_notes

    manager.manager_review(
        sample_id=sample3_id,
        manager_name="周姐",
        manager_notes="模型输出后确认正常，无违规",
    )

    sample_after = manager.get_sample_by_id(sample3_id)
    print(f"  样本 {sample3_id}:")
    print(f"    - 改前备注: {manager_notes_before}")
    print(f"    - 改后备注: {sample_after.manager_notes}")
    print(f"    - 历史记录数: {len(sample_after.history)}")
    print(f"    - 最近两条历史记录（改前改后）:")
    for record in sample_after.history[-2:]:
        print(f"      [{record.timestamp.strftime('%H:%M:%S')}] {record.comment}")

    return manager, sample_ids


def demo_rollback_and_boundary(manager, sample_ids):
    print_separator("边界规则演示：错口径返工与回滚")

    sample1_id = sample_ids[0]

    print("\n  场景：发现VID_001标注口径错了，需要返工")
    sample = manager.rollback_to_status(
        sample_id=sample1_id,
        target_status=SampleStatus.ANNOTATOR_IMPORTED,
        operator="周姐",
        reason="原标注口径错误，'今晚必看'在该品类属于正常宣传，需重新标注",
    )
    print(f"  样本 {sample1_id}:")
    print(f"    - 回滚后状态: {sample.current_status.value}")
    print(f"    - 历史记录中可追溯:")
    for record in sample.history:
        print(f"      [{record.timestamp.strftime('%H:%M:%S')}] {record.change_type.value}: {record.comment}")

    print_separator("完整证据链演示：知识库编辑追问时能回到证据")

    print(f"\n  样本 {sample1_id} 的完整证据链:")
    sample = manager.get_sample_by_id(sample1_id)
    print(f"    1. 原始标注员留言 (保留原始行号):")
    print(f"       - 文件: {sample.original_annotation.source_file}")
    print(f"       - 行号: 第{sample.original_annotation.line_number}行")
    print(f"       - 标注员: {sample.original_annotation.annotator_name}")
    print(f"       - 原始内容: {sample.original_annotation.raw_content}")
    print(f"       - 导入时间: {sample.original_annotation.import_timestamp}")

    print(f"    2. 人工改动记录:")
    for record in sample.history:
        if record.manual_edits:
            for edit in record.manual_edits:
                print(f"       - {record.timestamp.strftime('%Y-%m-%d %H:%M')} {edit.editor} 修改 {edit.field_changed}:")
                print(f"         旧值: {edit.old_value}")
                print(f"         新值: {edit.new_value}")
                print(f"         原因: {edit.reason}")

    print(f"    3. 当前处理状态: {sample.current_status.value}")
    print(f"    4. 所有历史操作:")
    for i, record in enumerate(sample.history, 1):
        print(f"       {i}. [{record.timestamp.strftime('%Y-%m-%d %H:%M')}] {record.operator}: {record.comment}")


def demo_final_stats(manager):
    print_separator("最终统计")

    stats = manager.get_stats()
    print(f"  总样本数: {stats['total_samples']}")
    print(f"  低置信度样本数: {stats['low_confidence_count']}")
    print(f"  总历史记录数: {stats['total_history_records']}")
    print(f"  状态分布:")
    for status, count in stats['status_distribution'].items():
        print(f"    - {status}: {count}")

    print(f"\n  低置信度样本列表（留给知识库编辑）:")
    for sample in manager.get_low_confidence_samples():
        print(f"    - {sample.sample_id} (VID: {sample.video_id}): 置信度={sample.model_outputs[-1].confidence:.2f}")

    print(f"\n  边界规则清单（已写入代码）:")
    for rule in manager.boundary_rules:
        print(f"    [{rule.rule_id}] {rule.name}")
        print(f"        描述: {rule.description}")
        print(f"        条件: {rule.condition}")
        print(f"        处理: {rule.action}")
        print(f"        支持回滚: {rule.rollback_supported}")


def main():
    print("""
╔══════════════════════════════════════════════════════════════════╗
║           短视频封面违规样本管理系统 - 完整流程演示                ║
╚══════════════════════════════════════════════════════════════════╝
    """)

    manager, sample_ids = demo_step1_import_annotator_messages()
    manager, sample_ids = demo_step2_manager_review_and_model_output(manager, sample_ids)
    manager, sample_ids = demo_step3_model_version_comparison(manager, sample_ids)
    demo_rollback_and_boundary(manager, sample_ids)
    demo_final_stats(manager)

    print_separator("演示完成")
    print("""
  核心特性总结:
  ✓ 保留标注员留言原始行号、来源文件
  ✓ 记录每一次人工改动（改前改后的值、操作人、原因）
  ✓ 完整历史记录，知识库编辑追问时可回溯证据
  ✓ 重复导入自动去重，样本数量不会翻倍
  ✓ 低置信度样本（<0.6）不会被平均指标盖住，留给知识库编辑复核
  ✓ 边界规则写入代码，不靠口头约定
  ✓ 支持状态回滚，错口径样本可返工
  ✓ 标注负责人修改备注时，历史记录能看出改前改后差别
    """)


if __name__ == "__main__":
    main()
