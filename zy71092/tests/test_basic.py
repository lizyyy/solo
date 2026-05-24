import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from ci_failure_cluster.parser import LogParser
from ci_failure_cluster.normalizer import SignatureNormalizer
from ci_failure_cluster.clusterer import FailureClusterer
from ci_failure_cluster.config import ClusterConfig
from ci_failure_cluster.types import FailureRecord, MatrixParams


def test_log_parser():
    parser = LogParser()
    example_dir = Path(__file__).parent.parent / "examples" / "failure_logs"
    records = parser.parse_directory(str(example_dir))

    assert len(records) == 6, f"Expected 6 records, got {len(records)}"
    print(f"✓ 解析到 {len(records)} 条失败记录")

    record = records[0]
    assert record.commit_sha != "unknown"
    assert record.job_name is not None
    assert record.error_message is not None
    print(f"✓ 记录字段完整: {record.job_name}")


def test_signature_normalization():
    config = ClusterConfig.default()
    normalizer = SignatureNormalizer(config)

    record1 = FailureRecord(
        id="test1",
        commit_sha="abc123",
        job_name="test",
        matrix_params=MatrixParams(),
        error_message="AssertionError: Expected 42 but got 56 at line 45",
        stack_trace='File "/path/to/file.py", line 45, in test',
    )

    record2 = FailureRecord(
        id="test2",
        commit_sha="def456",
        job_name="test",
        matrix_params=MatrixParams(),
        error_message="AssertionError: Expected 42 but got 99 at line 45",
        stack_trace='File "/different/path.py", line 45, in test',
    )

    sig1 = normalizer.normalize(record1)
    sig2 = normalizer.normalize(record2)

    assert "<N>" in sig1.normalized_error, "行号应被归一化"
    assert "<PATH>" in sig1.normalized_stack, "路径应被归一化"
    assert sig1.error_type == "AssertionError", "错误类型应被识别"

    print(f"✓ 签名归一化工作正常")
    print(f"  原始: {record1.error_message[:50]}...")
    print(f"  归一化: {sig1.normalized_error[:50]}...")


def test_clustering():
    config = ClusterConfig.default()
    clusterer = FailureClusterer(config)

    records = [
        FailureRecord(
            id=f"test{i}",
            commit_sha=f"sha{i}",
            job_name=f"job{i}",
            matrix_params=MatrixParams(),
            error_message=f"AssertionError in test_addition: expected {40 + i} but got {50 + i}",
            stack_trace='File "test.py", line 45, in test_addition',
        )
        for i in range(5)
    ]

    clusters, unclustered = clusterer.cluster(records)

    assert len(clusters) >= 1, "应至少形成一个聚类"
    print(f"✓ 聚类完成: {len(clusters)} 个聚类, {len(unclustered)} 条未聚类")

    if clusters:
        cluster = clusters[0]
        assert cluster.size >= 2, "聚类大小应 >= 2"
        assert 0 <= cluster.jitter_score <= 1, "抖动评分应在 0-1 之间"
        assert "os" in cluster.matrix_coverage or len(cluster.matrix_coverage) == 0
        print(f"  聚类 {cluster.cluster_id}: {cluster.size} 条记录, 抖动: {cluster.jitter_score}")


def test_stability():
    config = ClusterConfig.default()
    clusterer = FailureClusterer(config)

    records = [
        FailureRecord(
            id=f"test{i}",
            commit_sha=f"sha{i}",
            job_name=f"job{i}",
            matrix_params=MatrixParams(),
            error_message=f"ConnectionError to server {i}",
        )
        for i in range(3)
    ]

    clusters1, _ = clusterer.cluster(records)
    clusters2, _ = clusterer.cluster(records)

    assert len(clusters1) == len(clusters2), "重复运行聚类数量应相同"
    print("✓ 聚类结果稳定")


if __name__ == "__main__":
    print("运行基础测试...\n")

    test_log_parser()
    print()
    test_signature_normalization()
    print()
    test_clustering()
    print()
    test_stability()

    print("\n" + "=" * 40)
    print("所有测试通过! ✓")
