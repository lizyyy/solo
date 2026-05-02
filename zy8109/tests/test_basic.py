import sys
import os
import tempfile
import json
import yaml

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.data_parser import DataParser, Conversation, PolicyClause, PolicyKnowledgeBase
from src.text_features import TextFeatures, ClusterManager, ShortTextInfo
from src.risk_detector import RiskDetector, RiskFinding
from src.storage import StorageManager, ReportExporter


SAMPLE_CONVERSATIONS = [
    {
        "session_id": "test_001",
        "messages": [
            {"role": "user", "content": "我想了解一下退款政策是什么样的？"},
            {"role": "assistant", "content": "您好！根据我们的退款政策，您在收到商品后的15天内可以申请无理由退款。"}
        ]
    },
    {
        "session_id": "test_002",
        "messages": [
            {"role": "user", "content": "发货需要多长时间？"},
            {"role": "assistant", "content": "您好！根据公司政策，普通订单一般24小时内发货。"}
        ]
    },
    {
        "session_id": "test_003",
        "messages": [
            {"role": "user", "content": "你好"},
            {"role": "assistant", "content": "您好！"}
        ]
    }
]

SAMPLE_POLICIES = {
    "policies": [
        {
            "clause_id": "REFUND_POLICY",
            "version": "1.0",
            "category": "退款政策",
            "content": "根据公司退款政策，用户在收到商品后的15天内可以申请无理由退款。",
            "keywords": ["退款", "15天", "无理由"],
            "effective_date": "2023-01-01",
            "expiry_date": "2024-05-31",
            "is_active": False
        },
        {
            "clause_id": "REFUND_POLICY",
            "version": "2.0",
            "category": "退款政策",
            "content": "根据最新退款政策，用户在收到商品后的7天内可以申请无理由退款。",
            "keywords": ["退款", "7天", "无理由"],
            "effective_date": "2024-06-01",
            "is_active": True
        },
        {
            "clause_id": "SHIPPING_POLICY",
            "version": "1.0",
            "category": "发货政策",
            "content": "普通订单在下单后24小时内发货。",
            "keywords": ["发货", "24小时"],
            "effective_date": "2024-01-01",
            "is_active": True
        }
    ]
}


def test_data_parser():
    print("=" * 50)
    print("测试1: 数据解析模块")
    print("=" * 50)

    parser = DataParser()

    with tempfile.NamedTemporaryFile(mode='w', suffix='.jsonl', delete=False, encoding='utf-8') as f:
        for conv in SAMPLE_CONVERSATIONS:
            f.write(json.dumps(conv, ensure_ascii=False) + '\n')
        jsonl_path = f.name

    try:
        conversations = parser.parse_conversations_jsonl(jsonl_path)
        assert len(conversations) == 3, f"预期3条对话，实际{len(conversations)}条"
        assert conversations[0].session_id == "test_001"
        assert len(conversations[0].messages) == 2
        print(f"✓ 成功解析 {len(conversations)} 条对话数据")

        text = parser.get_conversation_text(conversations[0])
        assert "退款政策" in text
        print(f"✓ 对话文本提取正常")
    finally:
        os.unlink(jsonl_path)

    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
        yaml.dump(SAMPLE_POLICIES, f, allow_unicode=True)
        yaml_path = f.name

    try:
        kb = parser.parse_policy_yaml(yaml_path)
        assert len(kb.policies) == 3, f"预期3条政策，实际{len(kb.policies)}条"
        print(f"✓ 成功解析 {len(kb.policies)} 条政策条款")

        active_policies = kb.get_active_policies()
        assert len(active_policies) == 2, f"预期2条生效政策，实际{len(active_policies)}条"
        print(f"✓ 生效政策过滤正常: {len(active_policies)} 条生效政策")

        latest = kb.get_latest_version("REFUND_POLICY")
        assert latest is not None
        assert latest.version == "2.0"
        print(f"✓ 最新版本获取正常: {latest.version}")

        if kb.version_conflicts:
            print(f"⚠ 检测到版本冲突 (预期行为)")
    finally:
        os.unlink(yaml_path)

    print("测试1 完成 ✓\n")


def test_text_features():
    print("=" * 50)
    print("测试2: 文本特征模块")
    print("=" * 50)

    text_features = TextFeatures(min_word_count=5)

    short_text = "你好"
    is_short, word_count, char_count = text_features.is_short_text(short_text)
    assert is_short == True
    print(f"✓ 短句检测正常: '{short_text}' (词数: {word_count})")

    long_text = "我想了解一下退款政策是什么样的，请详细说明一下"
    is_short, word_count, char_count = text_features.is_short_text(long_text)
    assert is_short == False
    print(f"✓ 长文本检测正常 (词数: {word_count})")

    processed = text_features.preprocess("退款政策是什么样的？")
    assert "退款" in processed
    print(f"✓ 文本预处理正常: {processed}")

    texts = [
        "我想咨询退款政策",
        "退款需要什么条件",
        "发货时间是多久",
        "订单什么时候发货"
    ]

    tfidf_matrix = text_features.extract_tfidf_features(texts)
    assert tfidf_matrix.shape[0] == 4
    print(f"✓ TF-IDF 特征提取正常，矩阵形状: {tfidf_matrix.shape}")

    cluster_manager = ClusterManager(text_features)

    session_texts = [
        ("s1", "我想咨询退款政策，退款需要什么条件"),
        ("s2", "退款需要满足什么要求，请告诉我"),
        ("s3", "发货时间是多久，订单什么时候能发"),
        ("s4", "你好")
    ]

    clusters, short_texts = cluster_manager.cluster_conversations(session_texts, n_clusters=2)

    print(f"✓ 聚类完成: {len(clusters)} 个聚类, {len(short_texts)} 条短句")

    stats = cluster_manager.get_cluster_statistics()
    assert stats['total_conversations'] == 4
    assert stats['short_texts'] == 1
    print(f"✓ 聚类统计正常: 总计 {stats['total_conversations']} 条会话")

    print("测试2 完成 ✓\n")


def test_risk_detector():
    print("=" * 50)
    print("测试3: 风险检测模块")
    print("=" * 50)

    parser = DataParser()

    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
        yaml.dump(SAMPLE_POLICIES, f, allow_unicode=True)
        yaml_path = f.name

    try:
        kb = parser.parse_policy_yaml(yaml_path)
    finally:
        os.unlink(yaml_path)

    risk_detector = RiskDetector(knowledge_base=kb, similarity_threshold=0.2)

    from src.data_parser import ConversationMessage, Conversation

    old_policy_conv = Conversation(
        session_id="risk_old_001",
        messages=[
            ConversationMessage(role="user", content="退款政策是什么？"),
            ConversationMessage(role="assistant", content="您好！根据退款政策，15天内可以申请无理由退款。")
        ]
    )

    fabricated_conv = Conversation(
        session_id="risk_fabricated_001",
        messages=[
            ConversationMessage(role="user", content="退款需要什么条件？"),
            ConversationMessage(role="assistant", content="根据第9.9条规定，退款需要满足以下条件...")
        ]
    )

    irrelevant_conv = Conversation(
        session_id="risk_irrelevant_001",
        messages=[
            ConversationMessage(role="user", content="退款政策是什么？"),
            ConversationMessage(role="assistant", content="我们的会员优惠非常多，包括95折和双倍积分。")
        ]
    )

    test_conversations = [old_policy_conv, fabricated_conv, irrelevant_conv]

    findings = risk_detector.detect_all_risks(test_conversations, kb)

    print(f"✓ 风险检测完成，共检测到 {len(findings)} 条风险")

    stats = risk_detector.get_statistics()
    print(f"  - 按类型分布: {stats['by_type']}")
    print(f"  - 按等级分布: {stats['by_level']}")

    for finding in findings:
        print(f"  - [{finding.risk_type}] {finding.session_id}: {finding.description[:50]}...")

    if findings:
        risk_detector.confirm_finding(findings[0].risk_id, "测试确认")
        assert findings[0].confirmed == True
        print(f"✓ 风险确认功能正常")

    print("测试3 完成 ✓\n")


def test_storage():
    print("=" * 50)
    print("测试4: 存储/导出模块")
    print("=" * 50)

    storage_manager = StorageManager(output_dir="./test_output")

    test_findings = [
        RiskFinding(
            risk_id="TEST_001",
            session_id="s001",
            risk_type="OLD_POLICY",
            risk_level="high",
            description="使用了旧版本政策",
            evidence="客服回复中提到15天退款，当前政策是7天",
            confidence=0.85,
            confirmed=True,
            inspector_notes="确认是旧政策"
        ),
        RiskFinding(
            risk_id="TEST_002",
            session_id="s002",
            risk_type="IRRELEVANT_ANSWER",
            risk_level="medium",
            description="疑似答非所问",
            evidence="用户问退款，客服回答发货",
            confidence=0.6
        )
    ]

    csv_path = storage_manager.save_findings_to_csv(test_findings, filename="test_risks.csv")
    assert os.path.exists(csv_path)
    print(f"✓ CSV 导出成功: {csv_path}")

    loaded_findings = storage_manager.load_findings_from_csv(csv_path)
    assert len(loaded_findings) == 2
    print(f"✓ CSV 导入成功，加载 {len(loaded_findings)} 条记录")

    exporter = ReportExporter()

    from src.text_features import TextCluster
    test_clusters = [
        TextCluster(
            cluster_id=0,
            intent_label="退款咨询",
            session_ids=["s001", "s003"],
            size=2,
            keywords=["退款", "政策"]
        )
    ]

    from src.text_features import ShortTextInfo
    test_short_texts = [
        ShortTextInfo(
            session_id="s_short",
            text="你好",
            word_count=1,
            char_count=2,
            reason="文本过短"
        )
    ]

    cluster_stats = {
        'total_conversations': 5,
        'valid_clustered': 4,
        'short_texts': 1,
        'number_of_clusters': 2,
        'avg_cluster_size': 2.0,
        'largest_cluster': 2,
        'smallest_cluster': 2
    }

    risk_stats = {
        'total_findings': 2,
        'by_type': {'OLD_POLICY': 1, 'IRRELEVANT_ANSWER': 1},
        'by_level': {'high': 1, 'medium': 1, 'low': 0},
        'confirmed_count': 1,
        'high_confidence_count': 1
    }

    report_path = exporter.generate_report(
        findings=test_findings,
        clusters=test_clusters,
        short_texts=test_short_texts,
        cluster_stats=cluster_stats,
        risk_stats=risk_stats,
        conversations_count=5,
        output_path="./test_output/test_report.md"
    )

    assert os.path.exists(report_path)
    print(f"✓ Markdown 报告导出成功: {report_path}")

    with open(report_path, 'r', encoding='utf-8') as f:
        content = f.read()
        assert "客服话术质检报告" in content
        assert "退款咨询" in content
        assert "OLD_POLICY" in content or "旧政策话术" in content
    print(f"✓ 报告内容验证通过")

    summary = exporter.generate_summary_json(
        findings=test_findings,
        clusters=test_clusters,
        short_texts=test_short_texts,
        cluster_stats=cluster_stats,
        risk_stats=risk_stats
    )

    assert 'total_findings' in summary['summary']
    assert 'clusters' in summary
    print(f"✓ JSON 摘要生成成功")

    import shutil
    if os.path.exists("./test_output"):
        shutil.rmtree("./test_output")
    print("✓ 测试清理完成")

    print("测试4 完成 ✓\n")


def test_boundary_cases():
    print("=" * 50)
    print("测试5: 边界情况处理")
    print("=" * 50)

    print("\n测试边界1: 短句无法聚类")
    text_features = TextFeatures(min_word_count=5)
    cluster_manager = ClusterManager(text_features)

    all_short_texts = [
        ("s1", "你好"),
        ("s2", "您好"),
        ("s3", "在吗"),
    ]

    clusters, short_texts = cluster_manager.cluster_conversations(all_short_texts)
    assert len(clusters) == 0, f"预期0个聚类，实际{len(clusters)}个"
    assert len(short_texts) == 3, f"预期3条短句，实际{len(short_texts)}条"
    print(f"✓ 全短句处理正常: {len(short_texts)} 条标记为短句")

    print("\n测试边界2: 政策版本冲突")
    parser = DataParser()

    conflict_policies = {
        "policies": [
            {
                "clause_id": "TEST_POLICY",
                "version": "1.0",
                "content": "版本1内容",
                "keywords": ["测试"],
                "effective_date": "2024-01-01",
                "expiry_date": "2024-12-31",
                "is_active": True
            },
            {
                "clause_id": "TEST_POLICY",
                "version": "2.0",
                "content": "版本2内容",
                "keywords": ["测试"],
                "effective_date": "2024-06-01",
                "expiry_date": "2025-12-31",
                "is_active": True
            }
        ]
    }

    with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False, encoding='utf-8') as f:
        yaml.dump(conflict_policies, f, allow_unicode=True)
        yaml_path = f.name

    try:
        kb = parser.parse_policy_yaml(yaml_path)
        assert len(kb.version_conflicts) >= 1, f"预期检测到版本冲突"
        print(f"✓ 版本冲突检测正常: {len(kb.version_conflicts)} 个冲突")

        for conflict in kb.version_conflicts:
            print(f"  - 冲突条款: {conflict['base_id']}")
            print(f"    版本 {conflict['existing_version']} vs {conflict['new_version']}")
    finally:
        os.unlink(yaml_path)

    print("\n测试边界3: 空数据处理")
    empty_parser = DataParser()
    assert len(empty_parser.conversations) == 0
    assert len(empty_parser.knowledge_base.policies) == 0
    print(f"✓ 空数据初始化正常")

    risk_detector = RiskDetector()
    empty_findings = risk_detector.detect_all_risks([])
    assert len(empty_findings) == 0
    print(f"✓ 空对话风险检测正常")

    print("\n测试5 完成 ✓\n")


def main():
    print("\n" + "=" * 60)
    print("客服话术质检工作台 - 最小测试套件")
    print("=" * 60 + "\n")

    try:
        test_data_parser()
        test_text_features()
        test_risk_detector()
        test_storage()
        test_boundary_cases()

        print("=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)
        return 0
    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        return 1
    except Exception as e:
        print(f"\n❌ 测试错误: {e}")
        import traceback
        traceback.print_exc()
        return 2


if __name__ == "__main__":
    sys.exit(main())
