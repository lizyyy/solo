from datetime import datetime
from sqlalchemy.orm import Session

from .models import (
    User,
    TrainingDataset,
    DataRecord,
    Feature,
    MLModel,
    ModelFeatureLink
)
from .rules import register_standard_rules
from .database import SessionLocal


def create_sample_users(db: Session) -> list[User]:
    users = [
        User(
            id="user-001",
            name="张三",
            email="zhangsan@example.com"
        ),
        User(
            id="user-002",
            name="李四",
            email="lisi@example.com"
        ),
        User(
            id="user-003",
            name="王五",
            email="wangwu@example.com"
        )
    ]
    
    for user in users:
        existing = db.query(User).filter(User.id == user.id).first()
        if not existing:
            db.add(user)
    
    db.commit()
    return users


def create_sample_datasets(db: Session) -> list[TrainingDataset]:
    datasets = [
        TrainingDataset(
            id="ds-user-profile",
            name="用户画像数据集",
            description="包含用户行为偏好和个人信息",
            version="1.2",
            data_store_path="/data/datasets/user_profile",
            record_count=100
        ),
        TrainingDataset(
            id="ds-transaction",
            name="交易行为数据集",
            description="历史交易记录数据",
            version="2.0",
            data_store_path="/data/datasets/transactions",
            record_count=250
        )
    ]
    
    for ds in datasets:
        existing = db.query(TrainingDataset).filter(TrainingDataset.id == ds.id).first()
        if not existing:
            db.add(ds)
    
    db.commit()
    return datasets


def create_sample_features(db: Session) -> list[Feature]:
    features = [
        Feature(
            id="feat-age",
            dataset_id="ds-user-profile",
            name="用户年龄",
            feature_type="numerical",
            description="用户注册时提供的年龄"
        ),
        Feature(
            id="feat-gender",
            dataset_id="ds-user-profile",
            name="用户性别",
            feature_type="categorical",
            description="用户性别标识"
        ),
        Feature(
            id="feat-preference-score",
            dataset_id="ds-user-profile",
            name="偏好评分",
            feature_type="numerical",
            description="基于浏览历史计算的偏好分数"
        ),
        Feature(
            id="feat-tx-amount",
            dataset_id="ds-transaction",
            name="交易金额",
            feature_type="numerical",
            description="单次交易金额"
        ),
        Feature(
            id="feat-tx-frequency",
            dataset_id="ds-transaction",
            name="交易频率",
            feature_type="numerical",
            description="30天内交易次数"
        )
    ]
    
    for feat in features:
        existing = db.query(Feature).filter(Feature.id == feat.id).first()
        if not existing:
            db.add(feat)
    
    db.commit()
    return features


def create_sample_data_records(db: Session) -> list[DataRecord]:
    records = [
        DataRecord(
            id="rec-001",
            dataset_id="ds-user-profile",
            user_id="user-001",
            external_id="ext-zhangsan-a",
            record_hash="a1b2c3d4e5f6",
            content_summary="张三的个人信息记录A",
            is_retracted=False
        ),
        DataRecord(
            id="rec-002",
            dataset_id="ds-user-profile",
            user_id="user-001",
            external_id="ext-zhangsan-b",
            record_hash="b2c3d4e5f6a1",
            content_summary="张三的个人信息记录B",
            is_retracted=False
        ),
        DataRecord(
            id="rec-003",
            dataset_id="ds-transaction",
            user_id="user-001",
            external_id="tx-2024-001",
            record_hash="c3d4e5f6a1b2",
            content_summary="张三2024年交易记录",
            is_retracted=False
        ),
        DataRecord(
            id="rec-004",
            dataset_id="ds-user-profile",
            user_id="user-002",
            external_id="ext-lisi-a",
            record_hash="d4e5f6a1b2c3",
            content_summary="李四的个人信息记录A",
            is_retracted=False
        ),
        DataRecord(
            id="rec-005",
            dataset_id="ds-transaction",
            user_id="user-003",
            external_id="tx-2024-005",
            record_hash="e5f6a1b2c3d4",
            content_summary="王五2024年交易记录",
            is_retracted=False
        ),
        DataRecord(
            id="rec-006",
            dataset_id="ds-user-profile",
            user_id="user-003",
            external_id="ext-wangwu-a",
            record_hash="f6a1b2c3d4e5",
            content_summary="王五的个人信息记录A",
            is_retracted=True,
            retracted_at=datetime.utcnow()
        )
    ]
    
    for rec in records:
        existing = db.query(DataRecord).filter(DataRecord.id == rec.id).first()
        if not existing:
            db.add(rec)
    
    db.commit()
    return records


def create_sample_models(db: Session) -> list[MLModel]:
    models = [
        MLModel(
            id="model-recommendation",
            name="推荐模型",
            version="v3.1.0",
            model_type="collaborative_filtering",
            status="active",
            model_store_path="/models/recommendation/v3.1.0",
            trained_at=datetime.utcnow()
        ),
        MLModel(
            id="model-fraud-detection",
            name="欺诈检测模型",
            version="v2.0.0",
            model_type="classification",
            status="active",
            model_store_path="/models/fraud_detection/v2.0.0",
            trained_at=datetime.utcnow()
        ),
        MLModel(
            id="model-user-segmentation",
            name="用户分群模型",
            version="v1.5.0",
            model_type="clustering",
            status="active",
            model_store_path="/models/segmentation/v1.5.0",
            trained_at=datetime.utcnow()
        )
    ]
    
    for model in models:
        existing = db.query(MLModel).filter(MLModel.id == model.id).first()
        if not existing:
            db.add(model)
    
    db.commit()
    return models


def create_sample_model_feature_links(db: Session) -> list[ModelFeatureLink]:
    links = [
        ModelFeatureLink(
            model_id="model-recommendation",
            feature_id="feat-age",
            importance_score=3
        ),
        ModelFeatureLink(
            model_id="model-recommendation",
            feature_id="feat-gender",
            importance_score=2
        ),
        ModelFeatureLink(
            model_id="model-recommendation",
            feature_id="feat-preference-score",
            importance_score=5
        ),
        ModelFeatureLink(
            model_id="model-fraud-detection",
            feature_id="feat-tx-amount",
            importance_score=5
        ),
        ModelFeatureLink(
            model_id="model-fraud-detection",
            feature_id="feat-tx-frequency",
            importance_score=4
        ),
        ModelFeatureLink(
            model_id="model-user-segmentation",
            feature_id="feat-age",
            importance_score=4
        ),
        ModelFeatureLink(
            model_id="model-user-segmentation",
            feature_id="feat-gender",
            importance_score=3
        ),
        ModelFeatureLink(
            model_id="model-user-segmentation",
            feature_id="feat-tx-frequency",
            importance_score=2
        )
    ]
    
    for link in links:
        existing = (
            db.query(ModelFeatureLink)
            .filter(
                ModelFeatureLink.model_id == link.model_id,
                ModelFeatureLink.feature_id == link.feature_id
            )
            .first()
        )
        if not existing:
            db.add(link)
    
    db.commit()
    return links


def init_sample_data(db: Session = None) -> dict:
    if db is None:
        db = SessionLocal()
    
    register_standard_rules(db)
    
    users = create_sample_users(db)
    datasets = create_sample_datasets(db)
    features = create_sample_features(db)
    records = create_sample_data_records(db)
    models = create_sample_models(db)
    links = create_sample_model_feature_links(db)
    
    return {
        "users": users,
        "datasets": datasets,
        "features": features,
        "records": records,
        "models": models,
        "links": links
    }


def get_test_scenarios() -> list[dict]:
    return [
        {
            "name": "正常撤回 - 按用户ID",
            "description": "撤回用户张三的所有数据",
            "scenario_type": "normal",
            "user_id": "user-001",
            "retraction_reason": "根据个人信息保护法，要求删除我的所有训练数据记录。",
            "location_criteria": {
                "scope": "user_all"
            },
            "expected_status": "approved"
        },
        {
            "name": "异常拦截 - 原因太短",
            "description": "撤回原因只有5个字符，应该被规则引擎拦截",
            "scenario_type": "error_validation",
            "user_id": "user-002",
            "retraction_reason": "删除",
            "location_criteria": {
                "scope": "user_all"
            },
            "expected_status": "rejected",
            "blocking_rule": "reason_is_provided"
        },
        {
            "name": "异常拦截 - 无效撤回范围",
            "description": "使用不在允许列表中的撤回范围",
            "scenario_type": "error_validation",
            "user_id": "user-002",
            "retraction_reason": "要求删除我的个人数据，因为我不再使用该服务。",
            "location_criteria": {
                "scope": "invalid_scope_type"
            },
            "expected_status": "rejected",
            "blocking_rule": "valid_retraction_scope"
        },
        {
            "name": "异常拦截 - 找不到数据",
            "description": "按外部ID查找但不存在该记录",
            "scenario_type": "error_validation",
            "user_id": "user-002",
            "retraction_reason": "撤回不存在的记录用于测试验证逻辑。",
            "location_criteria": {
                "scope": "by_external_id",
                "external_id": "non-existent-id-999"
            },
            "expected_status": "rejected",
            "blocking_rule": "at_least_one_record_found"
        },
        {
            "name": "重复操作拦截 - 已撤回的数据",
            "description": "尝试撤回已经被撤回的数据记录",
            "scenario_type": "duplicate",
            "user_id": "user-003",
            "retraction_reason": "再次请求撤回王五的数据（部分已撤回）。",
            "location_criteria": {
                "scope": "specific_records",
                "record_ids": ["rec-006"]
            },
            "expected_status": "rejected",
            "blocking_rule": "data_not_already_retracted"
        },
        {
            "name": "正常撤回 - 按外部ID",
            "description": "通过外部ID精确撤回某条记录",
            "scenario_type": "normal",
            "user_id": "user-002",
            "retraction_reason": "根据GDPR第17条，要求删除特定的个人数据记录。",
            "location_criteria": {
                "scope": "by_external_id",
                "external_id": "ext-lisi-a"
            },
            "expected_status": "approved"
        }
    ]
