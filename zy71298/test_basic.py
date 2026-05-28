#!/usr/bin/env python3
"""基本功能测试
测试数据模型和核心类的基本功能，不依赖实际音频文件。
"""

import os
import sys
import tempfile
import shutil
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from audio_spectrum_cluster.models import (
    AudioSegment,
    SpectralFeatures,
    ClusteringResult,
    ClusteringReport,
    AnomalyReport,
    AnomalyType,
    OperationType,
    HistoryManager
)

try:
    from audio_spectrum_cluster.feature_extractor import FeatureExtractor
    HAS_LIBROSA = True
except ImportError:
    HAS_LIBROSA = False

try:
    from audio_spectrum_cluster.spectral_clustering import AudioSpectralClustering
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False

try:
    from audio_spectrum_cluster.controller import AudioClusteringController
    HAS_CONTROLLER = True
except ImportError:
    HAS_CONTROLLER = False


def test_models():
    """测试数据模型"""
    print("🧪 测试数据模型...")

    # 测试AudioSegment
    seg = AudioSegment(
        segment_id="test_seg_001",
        file_path="/test/audio.wav",
        file_name="audio.wav",
        sample_rate=44100,
        duration=10.5,
        channels=1,
        instrument_tags=["piano", "solo"],
        performance_version="v1",
        composer="Bach"
    )

    seg_dict = seg.to_dict()
    seg2 = AudioSegment.from_dict(seg_dict)
    assert seg.segment_id == seg2.segment_id
    assert seg.duration == seg2.duration
    assert seg.instrument_tags == seg2.instrument_tags
    print("  ✅ AudioSegment 序列化/反序列化正常")

    # 测试SpectralFeatures
    feat = SpectralFeatures(
        segment_id="test_seg_001",
        mfcc=list(range(20)),
        mfcc_std=list(range(20)),
        spectral_centroid=2000.0,
        spectral_bandwidth=1500.0,
        spectral_rolloff=3000.0,
        spectral_contrast=list(range(7)),
        zero_crossing_rate=0.1,
        tempo=120.0,
        beat_frames=[100, 200, 300],
        chroma_stft=list(range(12)),
        rms_energy=0.1,
        rms_energy_std=0.05,
        feature_vector=[0.1, 0.2, 0.3, 0.4, 0.5]
    )

    feat_dict = feat.to_dict()
    feat2 = SpectralFeatures.from_dict(feat_dict)
    assert feat.segment_id == feat2.segment_id
    assert feat.tempo == feat2.tempo
    assert feat.feature_vector == feat2.feature_vector
    print("  ✅ SpectralFeatures 序列化/反序列化正常")

    # 测试AnomalyReport
    anomaly = AnomalyReport(
        segment_id="test_seg_001",
        anomaly_type=AnomalyType.SAMPLE_RATE_MISMATCH,
        severity="low",
        description="采样率不一致",
        affected_values={"original_sr": 48000, "target_sr": 44100}
    )

    anom_dict = anomaly.to_dict()
    anom2 = AnomalyReport.from_dict(anom_dict)
    assert anom2.anomaly_type == AnomalyType.SAMPLE_RATE_MISMATCH
    print("  ✅ AnomalyReport 序列化/反序列化正常")

    # 测试ClusteringResult
    result = ClusteringResult(
        segment_id="test_seg_001",
        cluster_label=0,
        cluster_name="钢琴-中速-明亮",
        confidence=0.95,
        distance_to_centroid=0.123,
        nearest_neighbors=[("seg_002", 0.2), ("seg_003", 0.3)],
        umap_2d=(0.5, 0.8)
    )

    res_dict = result.to_dict()
    res2 = ClusteringResult.from_dict(res_dict)
    assert res2.cluster_label == 0
    assert res2.umap_2d == (0.5, 0.8)
    assert len(res2.nearest_neighbors) == 2
    print("  ✅ ClusteringResult 序列化/反序列化正常")

    print("✅ 数据模型测试通过!")


def test_history_manager():
    """测试历史记录管理器"""
    print("\n🧪 测试历史记录管理器...")

    with tempfile.TemporaryDirectory() as tmpdir:
        hm = HistoryManager(data_dir=tmpdir)

        # 创建测试数据
        segments = {
            "seg_001": AudioSegment(
                segment_id="seg_001",
                file_path="/test/1.wav",
                file_name="1.wav",
                sample_rate=44100,
                duration=5.0,
                channels=1
            ),
            "seg_002": AudioSegment(
                segment_id="seg_002",
                file_path="/test/2.wav",
                file_name="2.wav",
                sample_rate=44100,
                duration=6.0,
                channels=1
            )
        }

        features = {
            "seg_001": SpectralFeatures(
                segment_id="seg_001",
                mfcc=list(range(20)),
                mfcc_std=list(range(20)),
                spectral_centroid=2000.0,
                spectral_bandwidth=1500.0,
                spectral_rolloff=3000.0,
                spectral_contrast=list(range(7)),
                zero_crossing_rate=0.1,
                tempo=120.0,
                beat_frames=[],
                chroma_stft=list(range(12)),
                rms_energy=0.1,
                rms_energy_std=0.05,
                feature_vector=[0.1] * 10
            ),
            "seg_002": SpectralFeatures(
                segment_id="seg_002",
                mfcc=list(range(20)),
                mfcc_std=list(range(20)),
                spectral_centroid=1500.0,
                spectral_bandwidth=1000.0,
                spectral_rolloff=2500.0,
                spectral_contrast=list(range(7)),
                zero_crossing_rate=0.05,
                tempo=80.0,
                beat_frames=[],
                chroma_stft=list(range(12)),
                rms_energy=0.08,
                rms_energy_std=0.03,
                feature_vector=[0.2] * 10
            )
        }

        # 记录操作
        record1 = hm.record_operation(
            operation_type=OperationType.NORMAL,
            segment_ids=["seg_001"],
            segments=segments,
            features=features,
            report=None,
            operator="test_user",
            description="测试添加第一个片段"
        )

        assert record1.operation_type == OperationType.NORMAL
        assert "seg_001" in record1.segment_ids

        record2 = hm.record_operation(
            operation_type=OperationType.NORMAL,
            segment_ids=["seg_002"],
            segments=segments,
            features=features,
            report=None,
            operator="test_user",
            description="测试添加第二个片段"
        )

        # 检查历史记录
        history = hm.get_history()
        assert len(history) == 2
        assert history[0].operation_type == OperationType.NORMAL

        # 检查片段历史
        seg_history = hm.get_segment_history("seg_001")
        assert len(seg_history) >= 1

        # 测试快照加载
        latest_snapshot = hm.get_latest_snapshot_id()
        assert latest_snapshot is not None

        loaded = hm.load_snapshot(latest_snapshot)
        assert "seg_001" in loaded["segments"]
        assert "seg_002" in loaded["segments"]

        print("✅ 历史记录管理器测试通过!")


def test_feature_extractor():
    """测试特征提取器（不依赖音频文件）"""
    print("\n🧪 测试特征提取器...")

    if not HAS_LIBROSA:
        print("  ⚠️  跳过：未安装 librosa 依赖")
        print("✅ 特征提取器测试跳过!")
        return

    extractor = FeatureExtractor(target_sample_rate=44100)

    # 创建模拟音频数据
    sr = 44100
    duration = 3.0
    t = np.linspace(0, duration, int(sr * duration))
    y = 0.5 * np.sin(2 * np.pi * 440 * t)  # 440Hz 正弦波

    # 测试特征提取
    features, anomalies = extractor.extract_segment(y, sr, "test_seg")

    assert features.segment_id == "test_seg"
    assert isinstance(features.tempo, float)
    assert len(features.mfcc) == 20
    assert len(features.feature_vector) > 0
    assert features.rms_energy >= 0

    # 测试特征解释
    explanation = extractor.explain_features(features)
    assert "tempo" in explanation
    assert "spectral_centroid" in explanation
    assert "interpretation" in explanation["tempo"]
    print("  ✅ 特征解释功能正常")

    print("✅ 特征提取器测试通过!")


def test_spectral_clustering():
    """测试谱聚类算法"""
    print("\n🧪 测试谱聚类算法...")

    if not HAS_SKLEARN:
        print("  ⚠️  跳过：未安装 scikit-learn/umap-learn 依赖")
        print("✅ 谱聚类算法测试跳过!")
        return

    clusterer = AudioSpectralClustering(random_state=42)

    # 创建模拟数据
    n_samples = 10
    segments = []
    features_list = []

    for i in range(n_samples):
        segment = AudioSegment(
            segment_id=f"seg_{i:03d}",
            file_path=f"/test/{i}.wav",
            file_name=f"{i}.wav",
            sample_rate=44100,
            duration=5.0,
            channels=1,
            instrument_tags=["piano"] if i < 5 else ["violin"]
        )
        segments.append(segment)

        # 为前5个和后5个创建不同的特征向量
        base = 0.0 if i < 5 else 1.0
        feature_vector = [base + np.random.randn() * 0.1 for _ in range(30)]

        features = SpectralFeatures(
            segment_id=f"seg_{i:03d}",
            mfcc=list(range(20)),
            mfcc_std=list(range(20)),
            spectral_centroid=2000.0 + base * 1000,
            spectral_bandwidth=1500.0,
            spectral_rolloff=3000.0,
            spectral_contrast=list(range(7)),
            zero_crossing_rate=0.1,
            tempo=120.0 if i < 5 else 80.0,
            beat_frames=[],
            chroma_stft=list(range(12)),
            rms_energy=0.1,
            rms_energy_std=0.05,
            feature_vector=feature_vector
        )
        features_list.append(features)

    # 执行聚类
    report = clusterer.fit_predict(segments, features_list)

    assert report.n_clusters >= 2
    assert report.total_segments == 10
    assert len(report.clustering_results) == 10
    assert len(report.feature_importance) > 0

    print(f"  ✅ 自动确定聚类数: {report.n_clusters}")
    print(f"  ✅ 轮廓系数: {report.silhouette_score:.4f}")

    # 测试聚类解释
    for cluster_id in range(report.n_clusters):
        explanation = clusterer.explain_cluster(
            cluster_id, report, segments, features_list)
        assert "musical_interpretation" in explanation
        assert len(explanation["segments"]) > 0

    print("  ✅ 聚类解释功能正常")

    # 测试片段比较
    comparison = clusterer.compare_segments(
        "seg_000", "seg_001", features_list, report)
    assert "similarity_score" in comparison
    assert "interpretation" in comparison
    print("  ✅ 片段比较功能正常")

    print("✅ 谱聚类算法测试通过!")


def test_controller_basic():
    """测试控制器基本功能"""
    print("\n🧪 测试控制器基本功能...")

    if not HAS_CONTROLLER:
        print("  ⚠️  跳过：缺少依赖（librosa/scikit-learn等）")
        print("✅ 控制器基本功能测试跳过!")
        return

    with tempfile.TemporaryDirectory() as tmpdir:
        data_dir = os.path.join(tmpdir, "data")
        output_dir = os.path.join(tmpdir, "output")

        controller = AudioClusteringController(
            data_dir=data_dir,
            output_dir=output_dir
        )

        # 检查初始状态
        summary = controller.get_summary()
        assert summary["total_segments"] == 0
        assert summary["n_clusters"] == 0
        print("  ✅ 初始状态正确")

        # 检查历史记录
        history = controller.get_history()
        assert isinstance(history, list)
        print("  ✅ 历史记录功能正常")

        # 测试刷新（应该失败，因为没有片段）
        result = controller.refresh_all()
        assert result["success"] == False
        print("  ✅ 数据不足时刷新正确返回失败")

        print("✅ 控制器基本功能测试通过!")


def test_operation_types():
    """测试四种操作类型"""
    print("\n🧪 测试四种操作类型...")

    op_types = [
        (OperationType.NORMAL, "正常提交"),
        (OperationType.SUPPLEMENT, "补录"),
        (OperationType.WITHDRAW, "撤回"),
        (OperationType.DUPLICATE, "重复提交")
    ]

    for op_type, desc in op_types:
        assert op_type.value in ["normal", "supplement", "withdraw", "duplicate"]
        print(f"  ✅ {desc}: {op_type.value}")

    print("✅ 操作类型测试通过!")


def main():
    print("🎵 音乐音频片段谱聚类系统 - 基本功能测试")
    print("=" * 60)

    try:
        test_models()
        test_history_manager()
        test_feature_extractor()
        test_spectral_clustering()
        test_controller_basic()
        test_operation_types()

        print("\n" + "=" * 60)
        print("🎉 所有测试通过!")
        print("")
        print("下一步:")
        print("  1. 安装依赖: pip install -r requirements.txt")
        print("  2. 准备音频文件到 ./demo_audio 目录")
        print("  3. 运行快速入门: python quick_start.py")
        print("  4. 或启动Web界面: ./run_web.sh")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
