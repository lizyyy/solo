from datetime import datetime, timedelta
from models import (
    OnlineExperimentBucket,
    NegativeSampleList,
    FeatureRecord,
    RecordStatus,
    RecordSource,
    ParameterVersion,
)


def create_normal_material() -> tuple[OnlineExperimentBucket, NegativeSampleList]:
    bucket = OnlineExperimentBucket(
        bucket_id="exp-bucket-2026-001",
        version="v1.0",
        feature_ids=["feat-001", "feat-002", "feat-003"],
        caliber_notes={
            "feat-001": "新口径-交易金额阈值≥5000",
            "feat-002": "新口径-交易频率≥10次/天",
            "feat-003": "新口径-异地交易IP数≥3",
        },
    )

    neg_list = NegativeSampleList(
        version="v1.0",
        feature_ids=["feat-001", "feat-002", "feat-003"],
        caliber_notes={
            "feat-001": "新口径-交易金额阈值≥5000",
            "feat-002": "新口径-交易频率≥10次/天",
            "feat-003": "新口径-异地交易IP数≥3",
        },
    )

    return bucket, neg_list


def create_wrong_caliber_material() -> tuple[OnlineExperimentBucket, NegativeSampleList]:
    bucket = OnlineExperimentBucket(
        bucket_id="exp-bucket-2026-002",
        version="v1.0",
        feature_ids=["feat-004", "feat-005", "feat-006"],
        caliber_notes={
            "feat-004": "新口径-交易金额阈值≥8000",
            "feat-005": "新口径-交易频率≥15次/天",
            "feat-006": "新口径-夜间交易占比≥60%",
        },
    )

    neg_list = NegativeSampleList(
        version="v1.0",
        feature_ids=["feat-004", "feat-005", "feat-006"],
        caliber_notes={
            "feat-004": "旧口径-交易金额阈值≥10000",
            "feat-005": "旧口径-交易频率≥20次/天",
            "feat-006": "旧口径-夜间交易占比≥70%",
        },
    )

    return bucket, neg_list


def create_supplementary_material() -> tuple[OnlineExperimentBucket, NegativeSampleList, list[str]]:
    bucket = OnlineExperimentBucket(
        bucket_id="exp-bucket-2026-003",
        version="v1.0",
        feature_ids=["feat-007", "feat-008"],
        caliber_notes={
            "feat-007": "新口径-跨币种交易笔数≥5",
            "feat-008": "新口径-设备指纹异常匹配",
        },
    )

    neg_list = NegativeSampleList(
        version="v1.0",
        feature_ids=["feat-007", "feat-008"],
        caliber_notes={
            "feat-007": "新口径-跨币种交易笔数≥5",
            "feat-008": "新口径-设备指纹异常匹配",
        },
    )

    supplementary_feature_ids = ["feat-009", "feat-010"]

    return bucket, neg_list, supplementary_feature_ids


def create_sample_feature_records() -> list[FeatureRecord]:
    base_time = datetime.now() - timedelta(hours=2)

    record_smooth = FeatureRecord(
        feature_id="feat-001",
        feature_name="大额交易金额",
        feature_version="v2.1",
        caliber="新口径-交易金额阈值≥5000",
        source=RecordSource.ONLINE_EXPERIMENT_BUCKET,
        import_timestamp=base_time,
        status=RecordStatus.NORMAL,
        training_batch_id="batch-2026-06-a",
        parameter_versions=[
            ParameterVersion(
                param_name="amount_threshold",
                version="v2.1",
                value=5000,
                reason="根据Q2风控策略调整，阈值从3000提升至5000",
            ),
            ParameterVersion(
                param_name="window_size",
                version="v1.0",
                value="24h",
                reason="保持原窗口大小，统计稳定性验证通过",
            ),
        ],
    )

    record_duplicate = FeatureRecord(
        feature_id="feat-002",
        feature_name="高频交易频率",
        feature_version="v1.5",
        caliber="新口径-交易频率≥10次/天",
        source=RecordSource.ONLINE_EXPERIMENT_BUCKET,
        import_timestamp=base_time + timedelta(minutes=30),
        status=RecordStatus.DUPLICATE_TRAINING,
        training_batch_id="batch-2026-06-a",
        duplicate_of="feat-002-v1.0",
        parameter_versions=[
            ParameterVersion(
                param_name="freq_threshold",
                version="v1.5",
                value=10,
                reason="与batch-2026-05批次使用相同参数配置",
            ),
        ],
    )

    record_supplementary = FeatureRecord(
        feature_id="feat-009",
        feature_name="异常收款账户",
        feature_version="v3.2",
        caliber="旧口径-收款账户历史欺诈标记≥2次",
        source=RecordSource.SUPPLEMENTARY,
        import_timestamp=base_time + timedelta(hours=1),
        status=RecordStatus.SUPPLEMENTARY_OLD_CALIBER,
        training_batch_id="batch-2026-06-a",
        supplementary_from="negative_sample_list_v2.5_20260515",
        parameter_versions=[
            ParameterVersion(
                param_name="fraud_mark_threshold",
                version="v3.2",
                value=2,
                reason="补录历史负样本，沿用v2.5旧口径参数",
            ),
        ],
    )

    return [record_smooth, record_duplicate, record_supplementary]
