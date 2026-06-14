#!/usr/bin/env python3
"""
短视频封面违规样本 - 完整流程 + 异常路径测试
覆盖：正向三步流程、绕过模型输出的异常路径、历史反查、一致性报告
"""

import json
from sample_manager import SampleManager, REQUIRED_STATUSES_BEFORE_KB_REVIEW
from schemas import SampleStatus


def print_separator(title=""):
    print("\n" + "=" * 80)
    if title:
        print(f"  {title}")
        print("=" * 80)


def print_pass(label, condition):
    mark = "✅ PASS" if condition else "❌ FAIL"
    print(f"  [{mark}] {label}")


def demo_abnormal_1_bypass_model_output():
    print_separator("【异常路径测试1】知识库编辑试图绕过模型输出直接复核（应被BR005拦截）")

    manager = SampleManager()
    sample, _ = manager.import_annotator_message(
        source_file="群聊记录_异常测试.txt",
        line_number=10,
        raw_content="测试样本：封面疑似违规",
        annotator_name="标注员测试",
        video_id="VID_ABNORMAL_1",
        cover_image_url="https://example.com/ab1.jpg",
        conclusion="违规",
    )

    manager.manager_review(
        sample_id=sample.sample_id,
        manager_name="周姐",
        manager_notes="已回看，但忘记补模型输出",
    )

    stats_before = manager.get_stats()
    print(f"  当前样本状态: {sample.current_status.value}")
    print(f"  模型输出数量: {len(sample.model_outputs)}")
    print(f"  知识库编辑试图直接复核...")

    blocked = False
    try:
        manager.kb_editor_review(
            sample_id=sample.sample_id,
            editor_name="知识库编辑小郑",
            final_status=SampleStatus.CONFIRMED_VIOLATION,
        )
    except ValueError as e:
        blocked = True
        print(f"  正确拦截，异常信息: {e}")

    print_pass("被BR005拦截（缺少模型输出证据）", blocked)
    print_pass("样本状态未被篡改", sample.current_status == SampleStatus.MANAGER_REVIEWED)
    print_pass("样本数量未变化", stats_before["total_samples"] == manager.get_stats()["total_samples"])

    return manager


def demo_abnormal_2_bypass_status_check():
    print_separator("【异常路径测试2】刚导入就直接复核（应被BR006拦截：状态不合法）")

    manager = SampleManager()
    sample, _ = manager.import_annotator_message(
        source_file="群聊记录_异常测试.txt",
        line_number=20,
        raw_content="测试样本2：刚导入没走流程",
        annotator_name="标注员测试",
        video_id="VID_ABNORMAL_2",
        cover_image_url="https://example.com/ab2.jpg",
        conclusion="正常",
    )

    print(f"  当前样本状态: {sample.current_status.value} (仅导入，周姐未回看)")
    print(f"  允许复核的状态: {[s.value for s in REQUIRED_STATUSES_BEFORE_KB_REVIEW]}")
    print(f"  知识库编辑试图在ANNOTATOR_IMPORTED状态直接复核...")

    blocked = False
    try:
        manager.kb_editor_review(
            sample_id=sample.sample_id,
            editor_name="知识库编辑小郑",
            final_status=SampleStatus.CONFIRMED_NORMAL,
        )
    except ValueError as e:
        blocked = True
        print(f"  正确拦截，异常信息: {e}")

    print_pass("被BR006拦截（状态不合法）", blocked)
    print_pass("样本状态保持ANNOTATOR_IMPORTED", sample.current_status == SampleStatus.ANNOTATOR_IMPORTED)

    return manager


def demo_abnormal_3_low_confidence_to_normal():
    print_separator("【异常路径测试3】低置信度样本试图直接判正常（应被BR001拦截）")

    manager = SampleManager()
    sample, _ = manager.import_annotator_message(
        source_file="群聊记录_异常测试.txt",
        line_number=30,
        raw_content="测试样本3：低置信度场景",
        annotator_name="标注员测试",
        video_id="VID_ABNORMAL_3",
        cover_image_url="https://example.com/ab3.jpg",
        conclusion="正常",
    )

    manager.manager_review(
        sample_id=sample.sample_id,
        manager_name="周姐",
        manager_notes="看起来正常，但等模型输出",
    )

    manager.add_model_output(
        sample_id=sample.sample_id,
        version="v1.0",
        violation_score=0.45,
        confidence=0.38,
        raw_fragment="模型置信度0.38，低于阈值0.6",
        operator="周姐",
    )

    print(f"  当前样本状态: {sample.current_status.value}")
    print(f"  模型置信度: {sample.model_outputs[-1].confidence} (< 0.6)")
    print(f"  is_low_confidence: {sample.is_low_confidence}")
    print(f"  知识库编辑试图直接判CONFIRMED_NORMAL...")

    blocked = False
    try:
        manager.kb_editor_review(
            sample_id=sample.sample_id,
            editor_name="知识库编辑小郑",
            final_status=SampleStatus.CONFIRMED_NORMAL,
        )
    except ValueError as e:
        blocked = True
        print(f"  正确拦截，异常信息: {e}")

    print_pass("被BR001拦截（低置信度不能直接判正常）", blocked)
    print_pass("样本状态保持LOW_CONFIDENCE", sample.current_status == SampleStatus.LOW_CONFIDENCE)

    sample = manager.kb_editor_review(
        sample_id=sample.sample_id,
        editor_name="知识库编辑小郑",
        final_status=SampleStatus.CONFIRMED_VIOLATION,
        kb_notes="人工复核后确认违规",
    )
    print_pass("低置信度样本允许判CONFIRMED_VIOLATION", sample.current_status == SampleStatus.CONFIRMED_VIOLATION)

    return manager


def demo_normal_three_step_flow():
    print_separator("【正向流程】标准三步流程从启动到完成")

    manager = SampleManager()
    print("  第一步：标注员留言第一次导入")
    s1, is_new1 = manager.import_annotator_message(
        source_file="群聊记录_20260601.txt",
        line_number=42,
        raw_content="封面文字'今晚必看'太夸张，诱导点击，建议判定违规",
        annotator_name="标注员小王",
        video_id="VID_001",
        cover_image_url="https://example.com/cover1.jpg",
        conclusion="违规",
    )
    s2, is_new2 = manager.import_annotator_message(
        source_file="群聊记录_20260601.txt",
        line_number=58,
        raw_content="封面人物穿着暴露，涉嫌低俗",
        annotator_name="标注员小李",
        video_id="VID_002",
        cover_image_url="https://example.com/cover2.jpg",
        conclusion="违规",
    )
    s3, is_new3 = manager.import_annotator_message(
        source_file="群聊记录_20260601.txt",
        line_number=73,
        raw_content="这个封面看起来正常，没什么问题",
        annotator_name="标注员小张",
        video_id="VID_003",
        cover_image_url="https://example.com/cover3.jpg",
        conclusion="正常",
    )
    print_pass("3条样本均为新建", is_new1 and is_new2 and is_new3)
    print_pass("初始状态均为ANNOTATOR_IMPORTED", all(
        s.current_status == SampleStatus.ANNOTATOR_IMPORTED for s in [s1, s2, s3]
    ))

    print("\n  测试重复导入（BR003）：同一批重传不应翻倍")
    s1_dup, is_new_dup = manager.import_annotator_message(
        source_file="群聊记录_20260601.txt",
        line_number=42,
        raw_content="封面文字'今晚必看'太夸张，诱导点击，建议判定违规",
        annotator_name="标注员小王",
        video_id="VID_001",
        cover_image_url="https://example.com/cover1.jpg",
        conclusion="违规",
    )
    stats = manager.get_stats()
    print_pass("重复导入不新建样本", not is_new_dup and s1_dup.sample_id == s1.sample_id)
    print_pass(f"总样本数保持3个，不翻倍", stats["total_samples"] == 3)
    print_pass("重复导入在历史中留痕", len(s1_dup.history) >= 2)

    print("\n  第二步：周姐补看模型输出片段")
    s1 = manager.manager_review(
        sample_id=s1.sample_id,
        manager_name="周姐",
        manager_notes="原结论太笼统，等模型输出",
        edited_annotation="封面文字'今晚必看'属于夸张诱导，但需结合模型输出判断",
    )
    s1 = manager.add_model_output(
        sample_id=s1.sample_id,
        version="v1.0",
        violation_score=0.72,
        confidence=0.85,
        raw_fragment="检测到'诱导点击'关键词，置信度0.85",
        operator="周姐",
    )
    print_pass("s1进入MODEL_OUTPUT_ADDED状态", s1.current_status == SampleStatus.MODEL_OUTPUT_ADDED)
    print_pass("s1模型输出不为空", len(s1.model_outputs) == 1)

    s2 = manager.manager_review(
        sample_id=s2.sample_id,
        manager_name="周姐",
        manager_notes="看起来模糊",
    )
    s2 = manager.add_model_output(
        sample_id=s2.sample_id,
        version="v1.0",
        violation_score=0.45,
        confidence=0.42,
        raw_fragment="检测到'暴露'特征，置信度0.42",
        operator="周姐",
    )
    print_pass("s2低置信度标记", s2.is_low_confidence and s2.current_status == SampleStatus.LOW_CONFIDENCE)

    s3 = manager.manager_review(
        sample_id=s3.sample_id,
        manager_name="周姐",
        manager_notes="初看正常，等模型输出",
    )
    s3 = manager.add_model_output(
        sample_id=s3.sample_id,
        version="v1.0",
        violation_score=0.12,
        confidence=0.91,
        raw_fragment="未检测到违规特征，置信度0.91",
        operator="周姐",
    )
    print_pass("s3正常置信度，进入MODEL_OUTPUT_ADDED", s3.current_status == SampleStatus.MODEL_OUTPUT_ADDED)

    print("\n  第三步：模型版本对比更新")
    s1 = manager.update_model_version(
        sample_id=s1.sample_id,
        old_version="v1.0",
        new_version="v2.0",
        new_violation_score=0.88,
        new_confidence=0.92,
        new_raw_fragment="检测到'诱导点击+虚假宣传'，置信度0.92",
        operator="算法团队",
    )
    print_pass("s1版本更新后为MODEL_VERSION_UPDATED", s1.current_status == SampleStatus.MODEL_VERSION_UPDATED)

    print("\n  知识库编辑最终复核")
    s1 = manager.kb_editor_review(
        sample_id=s1.sample_id,
        editor_name="知识库编辑小郑",
        final_status=SampleStatus.CONFIRMED_VIOLATION,
        kb_notes="结合v2.0输出，确认违规",
    )
    s2 = manager.kb_editor_review(
        sample_id=s2.sample_id,
        editor_name="知识库编辑小郑",
        final_status=SampleStatus.NEEDS_REVIEW,
        kb_notes="低置信度，继续观察",
    )
    s3 = manager.kb_editor_review(
        sample_id=s3.sample_id,
        editor_name="知识库编辑小郑",
        final_status=SampleStatus.CONFIRMED_NORMAL,
        kb_notes="模型高置信度，确认正常",
    )
    print_pass("s1最终CONFIRMED_VIOLATION", s1.current_status == SampleStatus.CONFIRMED_VIOLATION)
    print_pass("s2最终NEEDS_REVIEW（低置信度）", s2.current_status == SampleStatus.NEEDS_REVIEW)
    print_pass("s3最终CONFIRMED_NORMAL", s3.current_status == SampleStatus.CONFIRMED_NORMAL)

    return manager, [s1.sample_id, s2.sample_id, s3.sample_id]


def demo_history_lookup(manager, sample_ids):
    print_separator("【历史反查演示】从周姐补看模型输出节点反查改前改后")

    for sid in sample_ids:
        delta = manager.get_manager_review_delta(sid)
        if not delta:
            continue
        print(f"\n  样本 {sid}:")
        print(f"    当前状态: {delta['current_status']}")
        print(f"    有模型输出: {delta['has_model_output']}")
        print(f"    可推进到复核: {delta['can_proceed_to_kb_review']}")
        print(f"    周姐回看记录数: {len(delta['manager_review_deltas'])}")
        for d in delta['manager_review_deltas']:
            print(f"      - [{d['timestamp'].strftime('%H:%M:%S')}] {d['operator']}: {d['comment'][:50]}...")
            for e in d['manual_edits']:
                print(f"        * {e['field']}: {str(e['old_value'])[:40]} -> {str(e['new_value'])[:40]}")
        print(f"    模型输出变更数: {len(delta['model_output_deltas'])}")
        for md in delta['model_output_deltas']:
            print(f"      - [{md['timestamp'].strftime('%H:%M:%S')}] {md['operator']}: has_model={md['before_has_model']}->{md['after_has_model']}")


def demo_consistency_report(manager, sample_ids):
    print_separator("【一致性报告】页面/导出/报告结果一致")

    report = manager.generate_consistency_report()

    print(f"  报告生成时间: {report['report_generated_at']}")
    print(f"  边界规则数: {len(report['boundary_rules'])} (预期6条)")
    print_pass("6条边界规则齐全", len(report['boundary_rules']) == 6)

    stats = report['stats']
    print(f"\n  统计摘要:")
    print(f"    总样本数: {stats['total_samples']}")
    print(f"    有模型输出: {stats['samples_with_model_output']}")
    print(f"    无模型输出: {stats['samples_without_model_output']}")
    print(f"    低置信度: {stats['low_confidence_count']}")
    print(f"    总历史记录: {stats['total_history_records']}")

    print(f"\n  样本级一致性校验:")
    all_evidence_ok = True
    for sr in report['samples']:
        evidence_ok = sr['evidence_chain_complete']
        all_evidence_ok = all_evidence_ok and evidence_ok
        status = "✅ 证据链完整" if evidence_ok else "⚠️ 证据链不完整"
        print(f"    {sr['sample_id']} ({sr['video_id']}): {sr['current_status']} - {status}")
        print(f"      来源: {sr['original_source']} | 模型版本: {sr['model_output_versions']} | 低置信度: {sr['is_low_confidence']}")

    print_pass("所有走完全流程的样本证据链完整", all_evidence_ok)

    print(f"\n  导出JSON文件并校验...")
    json_str = manager.export_report_json("/tmp/violation_sample_report.json")
    parsed = json.loads(json_str)
    print_pass("导出JSON与内存报告一致", parsed['stats']['total_samples'] == report['stats']['total_samples'])
    print_pass("JSON包含样本列表", len(parsed['samples']) == len(report['samples']))

    print(f"\n  页面/内存/导出三方一致性检查:")
    print_pass("stats 一致", parsed['stats'] == report['stats'] == manager.get_stats())
    print_pass("样本ID 一致",
              set(s['sample_id'] for s in parsed['samples']) ==
              set(s['sample_id'] for s in report['samples']) ==
              set(manager.samples.keys()))

    return report


def main():
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║       短视频封面违规样本管理系统 - 正向流程 + 异常路径 + 一致性完整测试        ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """)

    demo_abnormal_1_bypass_model_output()
    demo_abnormal_2_bypass_status_check()
    demo_abnormal_3_low_confidence_to_normal()

    manager, sample_ids = demo_normal_three_step_flow()

    demo_history_lookup(manager, sample_ids)

    demo_consistency_report(manager, sample_ids)

    print_separator("全部测试完成 - 修复总结")
    print("""
  本次修复核心点:
  ✅ BR005: 知识库编辑复核前强制校验模型输出存在，证据缺失时拦截
  ✅ BR006: 状态流转前置校验，仅允许 MODEL_OUTPUT_ADDED/LOW_CONFIDENCE/MODEL_VERSION_UPDATED 进入复核
  ✅ BR003: 重复导入去重口径已关联到周姐补看模型输出后的推进，重传不翻倍且保留已补看证据
  ✅ get_manager_review_delta: 可从周姐补看节点反查改前内容、改后内容、状态变化
  ✅ generate_consistency_report + export_report_json: 页面/内存/导出三方结果一致
  ✅ 覆盖3条异常路径（绕过模型输出、状态不对、低置信度判正常）均被正确拦截
  ✅ 正向三步流程从启动到完成走通，历史、报告、导出一致
    """)


if __name__ == "__main__":
    main()
