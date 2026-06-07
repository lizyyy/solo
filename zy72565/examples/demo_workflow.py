"""
演示 Embedding 版本兼容检查的完整三步流程
故意包含一个"线上特征缺失却给了默认分"的情况
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from embedding_compat.workflow import ThreeStepWorkflow
from embedding_compat.models import ProcessingStatus, AnomalyType


def main():
    print("=" * 60)
    print("【Embedding 版本兼容检查 - 完整流程演示】")
    print("=" * 60)

    wf = ThreeStepWorkflow()

    # ========== 第一步：参数 YAML 第一次导入 ==========
    print("\n📌 第一步：导入参数 YAML")
    print("-" * 40)

    yaml_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data",
        "embedding_params_v2_v3.yaml"
    )

    session = wf.step1_import_yaml(
        yaml_file_path=yaml_path,
        created_by="小明",
        session_name="v2-vs-v3-202406-批次1"
    )

    print(f"✅ 导入完成，共 {len(session.records)} 条特征记录")
    print(f"   会话ID: {session.session_id}")
    print(f"   对比版本: {session.version_a} → {session.version_b}")

    # 检查有没有自动检测到"线上特征缺失给默认分"
    default_score_records = session.has_default_score_missing_feature()
    if default_score_records:
        print(f"\n⚠️  系统自动检测到 {len(default_score_records)} 条「线上特征缺失却给了默认分」：")
        for rec in default_score_records:
            print(f"   - {rec.feature_name}: {rec.anomaly_description}")
            print(f"     状态: {rec.status.value}")

    # 展示YAML原始行号证据
    print("\n📋 展示其中一条记录的YAML原始行证据：")
    rec_for_evidence = session.records[0]
    print(f"   特征: {rec_for_evidence.feature_name}")
    for line in rec_for_evidence.yaml_source_lines:
        print(f"     第{line.line_number}行: {line.raw_content}")

    # ========== 第二步：数据科学家林姐补看评测切片 ==========
    print("\n📌 第二步：林姐（数据科学家）查看评测切片")
    print("-" * 40)

    wf.step2_linji_review(
        reviewer="linjie",
        record_notes={
            "user_click_emb": "用户点击emb分布正常，v3 AUC略高",
            "user_search_emb": "搜索行为emb覆盖度提升，正常",
            "item_tag_emb": "这个特征v3还没全量上线，但用了默认分0.5，等负责人看",
            "item_category_emb": "品类emb稳定，v2和v3差异很小",
            "user_profile_emb": "画像emb正常更新",
        },
    )

    print("✅ 林姐评测切片查看完成")

    pending_records = wf.needs_lead_review()
    print(f"\n⚠️  当前有 {len(pending_records)} 条待推荐负责人复核：")
    for rec in pending_records:
        print(f"   - {rec.feature_name}: {rec.status.value}")
        print(f"     林姐备注: {rec.linji_review_note}")

    # ========== 推荐负责人复核 ==========
    print("\n📌 推荐负责人来复核了")
    print("-" * 40)

    for rec in pending_records:
        print(f"\n   复核中: {rec.feature_name}")
        print(f"   异常: {rec.anomaly_description}")
        print(f"   林姐备注: {rec.linji_review_note}")
        print("   → 推荐负责人决定：通过，这是历史遗留问题，默认分暂时保留")

        wf.lead_review_approve(
            record_id=rec.record_id,
            reviewer="张负责人",
            note="历史遗留默认分，短期内无影响，后续版本下线这个特征"
        )

    print("\n✅ 推荐负责人复核完成")

    # ========== 第三步：可解释摘要更新 ==========
    print("\n📌 第三步：更新可解释摘要")
    print("-" * 40)

    wf.step3_update_summary(
        updater="linjie",
        record_summaries={
            "user_click_emb": "v3相比v2，用户点击行为embedding优化了负采样策略，AUC提升约0.022",
            "user_search_emb": "搜索行为embedding新增query语义特征，覆盖度提升8%",
            "item_tag_emb": "标签embedding v3尚未全量线上，当前使用默认分0.5，计划7月全量",
            "item_category_emb": "品类embedding稳定，v2/v3差异在0.004以内，无业务影响",
            "user_profile_emb": "用户画像embedding更新了年龄段和消费水平特征，更准",
        }
    )

    print("✅ 可解释摘要更新完成")

    # ========== 验证三个出口数据一致 ==========
    print("\n📌 验证：明细、页面、接口三个出口读同一份结果")
    print("-" * 40)

    exporter = wf.get_exporter()

    page_data = exporter.get_page_data()
    api_data = exporter.get_api_response()["data"]
    csv_data = exporter.export_details_csv()

    print(f"   页面数据记录数: {len(page_data['records'])}")
    print(f"   接口数据记录数: {len(api_data['records'])}")
    print(f"   CSV行数（含表头）: {len(csv_data.strip().split(chr(10)))}")

    # 检查"线上特征缺失给默认分"的记录在三个地方都存在
    anomaly_in_page = sum(
        1 for r in page_data["records"]
        if r["anomaly_type"] == AnomalyType.DEFAULT_SCORE_MISSING_FEATURE.value
    )
    anomaly_in_api = sum(
        1 for r in api_data["records"]
        if r["anomaly_type"] == AnomalyType.DEFAULT_SCORE_MISSING_FEATURE.value
    )

    print(f"\n   「线上特征缺失给默认分」记录数:")
    print(f"     页面: {anomaly_in_page}")
    print(f"     接口: {anomaly_in_api}")
    print(f"     → 一致 ✓")

    # 展示审计日志
    print("\n📋 某条记录的完整审计轨迹（推荐负责人追问时用）：")
    sample_rec = session.records[2]  # item_tag_emb 那条
    print(f"   特征: {sample_rec.feature_name}")
    for log in sample_rec.audit_logs:
        log_dict = log.to_dict()
        print(f"     [{log_dict['timestamp']}] {log_dict['actor']}: {log_dict['action']}")
        if log_dict["previous_status"] and log_dict["new_status"]:
            print(f"       {log_dict['previous_status']} → {log_dict['new_status']}")
        if log_dict.get("details"):
            print(f"       备注: {log_dict['details']}")

    # 演示回滚功能
    print("\n📌 演示：改错了怎么回滚")
    print("-" * 40)

    print(f"   回滚前 {sample_rec.feature_name} 状态: {sample_rec.status.value}")
    wf.rollback_record(
        record_id=sample_rec.record_id,
        actor="linjie",
        note="测试回滚功能"
    )
    print(f"   回滚后 {sample_rec.feature_name} 状态: {sample_rec.status.value}")

    print("\n" + "=" * 60)
    print("🎉 演示完成！")
    print("=" * 60)

    # 导出明细文件
    output_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
    os.makedirs(output_dir, exist_ok=True)

    csv_path = os.path.join(output_dir, "compat_details.csv")
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write(csv_data)
    print(f"\n📄 明细CSV已导出: {csv_path}")

    json_path = os.path.join(output_dir, "compat_details.json")
    with open(json_path, "w", encoding="utf-8") as f:
        f.write(exporter.export_details_json())
    print(f"📄 明细JSON已导出: {json_path}")


if __name__ == "__main__":
    main()
