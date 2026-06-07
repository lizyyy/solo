import uuid
from typing import List, Tuple
from .models import (
    NegativeSample,
    DriftRecord,
    BucketConfig,
    BucketDiff,
    Status,
    NextOwner,
)


class BucketDriftDetector:
    def __init__(self, bucket_config: BucketConfig):
        self.bucket_config = bucket_config

    def calculate_bucket_diff(self, offline_bucket: int, online_bucket: int) -> BucketDiff:
        diff = abs(offline_bucket - online_bucket)
        if diff == 0:
            return BucketDiff.SAME
        elif diff == 1:
            return BucketDiff.ONE_BUCKET
        else:
            return BucketDiff.MULTI_BUCKET

    def detect_from_scores(
        self,
        sample_id: str,
        offline_score: float,
        online_score: float,
        features: dict = None,
        source: str = "",
    ) -> Tuple[NegativeSample, DriftRecord]:
        offline_bucket = self.bucket_config.get_bucket(offline_score)
        online_bucket = self.bucket_config.get_bucket(online_score)
        bucket_diff = self.calculate_bucket_diff(offline_bucket, online_bucket)

        sample = NegativeSample(
            sample_id=sample_id,
            offline_score=offline_score,
            online_score=online_score,
            offline_bucket=offline_bucket,
            online_bucket=online_bucket,
            bucket_diff=bucket_diff,
            features=features or {},
            source=source,
        )

        why_kept = ""
        missing_materials = []
        next_owner = NextOwner.OPERATION

        if bucket_diff == BucketDiff.ONE_BUCKET:
            why_kept = "离线和线上分数差了一个桶，需要评测运营复核，暂不归为正常"
            missing_materials = ["召回候选表待算法工程师小乔补录", "复核意见待评测运营填写"]
            next_owner = NextOwner.OPERATION
        elif bucket_diff == BucketDiff.MULTI_BUCKET:
            why_kept = "离线和线上分数差多个桶，需要重点排查"
            missing_materials = ["召回候选表", "特征日志", "线上请求上下文"]
            next_owner = NextOwner.BOTH

        record = DriftRecord(
            record_id=str(uuid.uuid4()),
            sample_id=sample_id,
            offline_bucket=offline_bucket,
            online_bucket=online_bucket,
            bucket_diff=bucket_diff,
            offline_score=offline_score,
            online_score=online_score,
            status=Status.PENDING_REVIEW,
            why_kept=why_kept,
            missing_materials=missing_materials,
            next_owner=next_owner,
        )

        return sample, record

    def batch_detect(self, samples_data: List[dict]) -> Tuple[List[NegativeSample], List[DriftRecord]]:
        samples = []
        records = []
        for data in samples_data:
            sample, record = self.detect_from_scores(
                sample_id=data["sample_id"],
                offline_score=data["offline_score"],
                online_score=data["online_score"],
                features=data.get("features", {}),
                source=data.get("source", ""),
            )
            samples.append(sample)
            records.append(record)
        return samples, records
