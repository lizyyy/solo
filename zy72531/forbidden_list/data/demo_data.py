DEMO_DATA = {
    "annotator_comments": [
        {
            "content": '禁推："保健品螺旋藻片"，参考官方规则说明',
            "annotator": "小明",
            "reference_url": "https://example.com/good/rules-001",
            "product_id": "SKU-88231",
            "reason": "保健食品不能直接推荐疗效",
        },
        {
            "content": '禁推："美白祛斑霜特效版"，引用旧培训文档中的说明',
            "annotator": "小李",
            "reference_url": "https://example.com/404-old-training-2023",
            "product_id": "SKU-55612",
            "reason": "美白类产品夸大宣传",
        },
        {
            "content": '禁推："七天长高营养液"，根据标注群里昨天讨论的口径',
            "annotator": "小王",
            "reference_url": None,
            "product_id": "SKU-33456",
            "reason": "增高产品虚假宣传",
        },
    ],
    "model_outputs_to_supplement": {
        "third_record": {
            "content": '模型输出片段：经检索历史标注记录，"七天长高营养液"属于旧口径，最新口径应为"强效生长激素口服液"，注意旧口径已在Q2更新中废弃',
            "model_version": "gpt-annotate-v3.2",
            "source_task_id": "TASK-20240601-089",
            "matched_product_id": "SKU-33456",
        }
    },
    "review_decisions": {
        "first_record": {"decision": "pass_normal", "note": "规则引用正确，放行"},
        "second_record": {
            "decision": "flag_404_for_pm",
            "note": "培训文档链接已404，不确定当前口径是否变更，转产品经理确认",
        },
        "third_record": {"decision": "pass_normal", "note": "临时口径先过，等下补看模型输出片段"},
    },
    "expected_outcomes": {
        "record_1": "顺利记录：链接有效，正常通过",
        "record_2": "链接404但判通过，转产品经理复核",
        "record_3": "补录模型输出后发现旧口径，生成冲突样本",
    },
}
