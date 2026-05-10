import sys
from pathlib import Path

import pytest

src_path = Path(__file__).parent.parent / "src"
if str(src_path) not in sys.path:
    sys.path.insert(0, str(src_path))


@pytest.fixture
def fresh_db(tmp_path):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker, declarative_base
    from data_retraction_service.models import (
        Base,
        User,
        TrainingDataset,
        DataRecord,
        Feature,
        MLModel,
        ModelFeatureLink,
        RuleDefinition
    )
    from datetime import datetime
    
    test_db = tmp_path / "test_retraction_service.db"
    test_url = f"sqlite:///{test_db}"
    
    engine = create_engine(
        test_url,
        echo=False,
        connect_args={"check_same_thread": False}
    )
    
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine
    )
    
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    try:
        standard_rules = [
            {
                "id": "rule_001",
                "ruleset": "standard_v1",
                "version": "1.0",
                "rule_name": "reason_is_provided",
                "rule_type": "approval_gate",
                "condition_expression": "retraction_reason is not None and len(str(retraction_reason).strip()) >= 10",
                "action": "approve",
                "description": "撤回申请必须包含原因说明（至少10个字符）"
            },
            {
                "id": "rule_002",
                "ruleset": "standard_v1",
                "version": "1.0",
                "rule_name": "user_data_exists",
                "rule_type": "approval_gate",
                "condition_expression": "user_exists == True",
                "action": "approve",
                "description": "撤回申请关联的用户必须存在"
            },
            {
                "id": "rule_003",
                "ruleset": "standard_v1",
                "version": "1.0",
                "rule_name": "data_not_already_retracted",
                "rule_type": "blocking",
                "condition_expression": "already_retracted == False",
                "action": "reject",
                "description": "数据记录不能已被撤回（防止重复操作）"
            },
            {
                "id": "rule_004",
                "ruleset": "standard_v1",
                "version": "1.0",
                "rule_name": "at_least_one_record_found",
                "rule_type": "approval_gate",
                "condition_expression": "record_count >= 1",
                "action": "approve",
                "description": "至少找到一条要撤回的数据记录"
            },
            {
                "id": "rule_005",
                "ruleset": "standard_v1",
                "version": "1.0",
                "rule_name": "no_pending_request_for_same_user",
                "rule_type": "informational",
                "condition_expression": "has_pending_same_user == False",
                "action": "warn",
                "description": "同一用户是否有待处理的撤回申请"
            },
            {
                "id": "rule_006",
                "ruleset": "standard_v1",
                "version": "1.0",
                "rule_name": "valid_retraction_scope",
                "rule_type": "approval_gate",
                "condition_expression": "scope in ['user_all', 'specific_records', 'by_external_id']",
                "action": "approve",
                "description": "撤回范围必须是有效值"
            },
            {
                "id": "rule_007",
                "ruleset": "standard_v1",
                "version": "1.0",
                "rule_name": "retraction_within_time_window",
                "rule_type": "informational",
                "condition_expression": "within_retention_window == True",
                "action": "warn",
                "description": "数据是否还在可撤回的时间窗口内"
            }
        ]
        
        for rule_data in standard_rules:
            existing = db.query(RuleDefinition).filter(
                RuleDefinition.id == rule_data["id"]
            ).first()
            if not existing:
                db.add(RuleDefinition(**rule_data))
        
        users = [
            User(id="user-001", name="张三", email="zhangsan@example.com"),
            User(id="user-002", name="李四", email="lisi@example.com"),
            User(id="user-003", name="王五", email="wangwu@example.com")
        ]
        for u in users:
            if not db.query(User).filter(User.id == u.id).first():
                db.add(u)
        
        datasets = [
            TrainingDataset(
                id="ds-user-profile",
                name="用户画像数据集",
                description="包含用户行为偏好",
                version="1.2",
                data_store_path="/data/datasets/user_profile",
                record_count=100
            ),
            TrainingDataset(
                id="ds-transaction",
                name="交易行为数据集",
                description="历史交易记录",
                version="2.0",
                data_store_path="/data/datasets/transactions",
                record_count=250
            )
        ]
        for ds in datasets:
            if not db.query(TrainingDataset).filter(TrainingDataset.id == ds.id).first():
                db.add(ds)
        
        features = [
            Feature(id="feat-age", dataset_id="ds-user-profile", name="用户年龄", feature_type="numerical"),
            Feature(id="feat-gender", dataset_id="ds-user-profile", name="用户性别", feature_type="categorical"),
            Feature(id="feat-preference-score", dataset_id="ds-user-profile", name="偏好评分", feature_type="numerical"),
            Feature(id="feat-tx-amount", dataset_id="ds-transaction", name="交易金额", feature_type="numerical"),
            Feature(id="feat-tx-frequency", dataset_id="ds-transaction", name="交易频率", feature_type="numerical")
        ]
        for f in features:
            if not db.query(Feature).filter(Feature.id == f.id).first():
                db.add(f)
        
        records = [
            DataRecord(id="rec-001", dataset_id="ds-user-profile", user_id="user-001", 
                       external_id="ext-zhangsan-a", record_hash="a1b2c3d4e5f6",
                       content_summary="张三的记录A", is_retracted=False),
            DataRecord(id="rec-002", dataset_id="ds-user-profile", user_id="user-001",
                       external_id="ext-zhangsan-b", record_hash="b2c3d4e5f6a1",
                       content_summary="张三的记录B", is_retracted=False),
            DataRecord(id="rec-003", dataset_id="ds-transaction", user_id="user-001",
                       external_id="tx-2024-001", record_hash="c3d4e5f6a1b2",
                       content_summary="张三交易记录", is_retracted=False),
            DataRecord(id="rec-004", dataset_id="ds-user-profile", user_id="user-002",
                       external_id="ext-lisi-a", record_hash="d4e5f6a1b2c3",
                       content_summary="李四的记录A", is_retracted=False),
            DataRecord(id="rec-005", dataset_id="ds-transaction", user_id="user-003",
                       external_id="tx-2024-005", record_hash="e5f6a1b2c3d4",
                       content_summary="王五交易记录", is_retracted=False),
            DataRecord(id="rec-006", dataset_id="ds-user-profile", user_id="user-003",
                       external_id="ext-wangwu-a", record_hash="f6a1b2c3d4e5",
                       content_summary="王五已撤回记录", is_retracted=True,
                       retracted_at=datetime.utcnow())
        ]
        for r in records:
            if not db.query(DataRecord).filter(DataRecord.id == r.id).first():
                db.add(r)
        
        models = [
            MLModel(id="model-recommendation", name="推荐模型", version="v3.1.0",
                    model_type="collaborative_filtering", status="active",
                    model_store_path="/models/recommendation", trained_at=datetime.utcnow()),
            MLModel(id="model-fraud-detection", name="欺诈检测模型", version="v2.0.0",
                    model_type="classification", status="active",
                    model_store_path="/models/fraud", trained_at=datetime.utcnow()),
            MLModel(id="model-user-segmentation", name="用户分群模型", version="v1.5.0",
                    model_type="clustering", status="active",
                    model_store_path="/models/segmentation", trained_at=datetime.utcnow())
        ]
        for m in models:
            if not db.query(MLModel).filter(MLModel.id == m.id).first():
                db.add(m)
        
        links = [
            ModelFeatureLink(model_id="model-recommendation", feature_id="feat-age", importance_score=3),
            ModelFeatureLink(model_id="model-recommendation", feature_id="feat-gender", importance_score=2),
            ModelFeatureLink(model_id="model-recommendation", feature_id="feat-preference-score", importance_score=5),
            ModelFeatureLink(model_id="model-fraud-detection", feature_id="feat-tx-amount", importance_score=5),
            ModelFeatureLink(model_id="model-fraud-detection", feature_id="feat-tx-frequency", importance_score=4),
            ModelFeatureLink(model_id="model-user-segmentation", feature_id="feat-age", importance_score=4),
            ModelFeatureLink(model_id="model-user-segmentation", feature_id="feat-gender", importance_score=3),
            ModelFeatureLink(model_id="model-user-segmentation", feature_id="feat-tx-frequency", importance_score=2)
        ]
        for link in links:
            existing = db.query(ModelFeatureLink).filter(
                ModelFeatureLink.model_id == link.model_id,
                ModelFeatureLink.feature_id == link.feature_id
            ).first()
            if not existing:
                db.add(link)
        
        db.commit()
    finally:
        db.close()
    
    yield TestingSessionLocal
    
    from sqlalchemy.orm import session
    session.close_all_sessions()
    engine.dispose()
