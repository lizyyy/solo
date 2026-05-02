"""
集成测试文件
测试所有模块的功能
"""

import os
import sys
import tempfile
import shutil
from pathlib import Path

import numpy as np
import pandas as pd
import pytest


sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def generate_test_vibration_data(sampling_rate: int = 25600,
                                   duration: float = 2.0,
                                   anomaly: bool = False) -> pd.DataFrame:
    """生成测试振动数据"""
    n_samples = int(sampling_rate * duration)
    t = np.linspace(0, duration, n_samples, endpoint=False)
    
    rot_freq = 10.0
    
    signal_data = np.zeros(n_samples)
    for n in range(1, 5):
        signal_data += 0.1 * np.sin(2 * np.pi * n * rot_freq * t)
    
    signal_data += 0.05 * np.random.randn(n_samples)
    
    if anomaly:
        impulse_times = [0.5, 1.0, 1.5]
        impulse_width = int(0.002 * sampling_rate)
        
        for imp_time in impulse_times:
            imp_idx = int(imp_time * sampling_rate)
            if 0 <= imp_idx < n_samples - impulse_width:
                decay = np.exp(-np.linspace(0, 0.01, impulse_width) * 500)
                impulse = 0.5 * decay * np.sin(2 * np.pi * 3000 * np.linspace(0, 0.01, impulse_width))
                signal_data[imp_idx:imp_idx + impulse_width] += impulse
    
    df = pd.DataFrame({
        "timestamp": t,
        "vibration": signal_data
    })
    
    return df


class TestDataParser:
    """测试数据解析模块"""
    
    def test_import_and_parse(self):
        """测试导入和解析数据"""
        from bearing_vibration_detector.data_parser import DataParser, TripData
        
        parser = DataParser(
            expected_sampling_rate=25600.0,
            min_sampling_rate=1000.0,
            max_missing_ratio=0.05
        )
        
        with tempfile.TemporaryDirectory() as tmpdir:
            vib_df = generate_test_vibration_data()
            vib_file = os.path.join(tmpdir, "test_vibration.csv")
            vib_df.to_csv(vib_file, index=False)
            
            speed_df = pd.DataFrame({
                "time": np.linspace(0, 2, 200),
                "speed": np.full(200, 600.0)
            })
            speed_file = os.path.join(tmpdir, "test_speed.csv")
            speed_df.to_csv(speed_file, index=False)
            
            trips = parser.parse_directory(tmpdir)
            
            assert len(trips) > 0, "应该解析到至少一趟数据"
            
            summary = parser.get_trip_summary()
            assert isinstance(summary, pd.DataFrame), "摘要应该是DataFrame"
            
            valid_trips = parser.get_valid_trips()
            assert len(valid_trips) > 0, "应该有有效数据"
    
    def test_sampling_rate_estimation(self):
        """测试采样率估计"""
        from bearing_vibration_detector.data_parser import DataParser
        
        parser = DataParser()
        
        n_samples = 1000
        df = pd.DataFrame({
            "timestamp": np.arange(n_samples) / 25600.0,
            "vibration": np.random.randn(n_samples)
        })
        
        sampling_rate = parser._estimate_sampling_rate(df)
        
        assert sampling_rate > 25000 and sampling_rate < 26000, f"采样率估计应该接近25600，实际为 {sampling_rate}"


class TestFeatureEngineer:
    """测试特征工程模块"""
    
    def test_feature_extraction(self):
        """测试特征提取"""
        from bearing_vibration_detector.feature_engineering import FeatureEngineer, TripFeatures
        
        engineer = FeatureEngineer(
            frame_size=2560,
            frame_overlap=0.5,
            sampling_rate=25600.0
        )
        
        vib_df = generate_test_vibration_data(duration=1.0, anomaly=True)
        
        features = engineer.extract_features(vib_df)
        
        assert isinstance(features, TripFeatures), "应该返回TripFeatures对象"
        assert len(features.frame_features) > 0, "应该提取到帧特征"
        
        features_df = engineer.features_to_dataframe(features)
        assert isinstance(features_df, pd.DataFrame), "特征应该可以转换为DataFrame"
        assert len(features_df) == len(features.frame_features), "帧数应该匹配"
    
    def test_time_domain_features(self):
        """测试时域特征"""
        from bearing_vibration_detector.feature_engineering import FeatureEngineer
        
        engineer = FeatureEngineer(frame_size=2560, sampling_rate=25600.0)
        
        normal_signal = np.random.randn(2560) * 0.1
        
        features = engineer._extract_time_domain_features(normal_signal)
        
        assert "mean" in features, "应该包含均值特征"
        assert "rms" in features, "应该包含RMS特征"
        assert "kurtosis" in features, "应该包含峭度特征"
        assert "crest_factor" in features, "应该包含峰值因子"
        
        impulse_signal = np.zeros(2560)
        impulse_signal[1000:1020] = 10.0
        impulse_signal += np.random.randn(2560) * 0.1
        
        impulse_features = engineer._extract_time_domain_features(impulse_signal)
        
        assert impulse_features["kurtosis"] > features["kurtosis"], "冲击信号峭度应该更高"
        assert impulse_features["crest_factor"] > features["crest_factor"], "冲击信号峰值因子应该更高"
    
    def test_frame_splitting(self):
        """测试分帧处理"""
        from bearing_vibration_detector.feature_engineering import FeatureEngineer
        
        engineer = FeatureEngineer(
            frame_size=1000,
            frame_overlap=0.5,
            sampling_rate=25600.0
        )
        
        signal = np.random.randn(5000)
        
        frames = engineer._split_into_frames(signal)
        
        assert len(frames) > 0, "应该分割成帧"
        assert len(frames[0]) == 1000, "每帧长度应该正确"


class TestAnomalyDetector:
    """测试异常检测模块"""
    
    def test_detection_basic(self):
        """测试基础检测功能"""
        from bearing_vibration_detector.model_inference import AnomalyDetector, TripAnomalyResult
        
        detector = AnomalyDetector(
            use_ensemble=False,
            anomaly_threshold=0.7
        )
        
        n_frames = 10
        features_data = {
            "frame_idx": np.arange(n_frames),
            "start_time": np.arange(n_frames) * 0.5,
            "end_time": (np.arange(n_frames) + 1) * 0.5,
            "time_kurtosis": np.concatenate([np.ones(5) * 3.0, np.ones(5) * 15.0]),
            "time_crest_factor": np.concatenate([np.ones(5) * 3.0, np.ones(5) * 8.0]),
            "time_rms": np.ones(n_frames) * 0.1,
            "time_peak": np.ones(n_frames) * 0.5,
            "freq_harmonic_ratio_1x": np.zeros(n_frames),
            "freq_harmonic_ratio_2x": np.zeros(n_frames),
            "freq_harmonic_ratio_3x": np.zeros(n_frames),
            "freq_band_energy_high": np.zeros(n_frames)
        }
        
        features_df = pd.DataFrame(features_data)
        
        result = detector.detect(features_df)
        
        assert isinstance(result, TripAnomalyResult), "应该返回TripAnomalyResult对象"
        assert len(result.frame_results) == n_frames, "帧结果数量应该匹配"
        
        summary = detector.get_anomaly_summary(result)
        assert isinstance(summary, dict), "摘要应该是字典"
    
    def test_statistical_scoring(self):
        """测试统计评分"""
        from bearing_vibration_detector.model_inference import AnomalyDetector
        
        detector = AnomalyDetector()
        
        all_frames = pd.DataFrame({
            "time_kurtosis": [3.0, 3.1, 2.9, 12.0, 3.2],
            "time_crest_factor": [3.0, 3.1, 2.9, 7.0, 3.2]
        })
        
        normal_row = pd.Series({
            "time_kurtosis": 3.0,
            "time_crest_factor": 3.0
        })
        
        anomaly_row = pd.Series({
            "time_kurtosis": 15.0,
            "time_crest_factor": 8.0
        })
        
        normal_score = detector._calculate_statistical_score(normal_row, all_frames)
        anomaly_score = detector._calculate_statistical_score(anomaly_row, all_frames)
        
        assert anomaly_score > normal_score, "异常帧应该有更高的分数"
    
    def test_rule_scoring(self):
        """测试规则评分"""
        from bearing_vibration_detector.model_inference import AnomalyDetector
        import pandas as pd
        
        detector = AnomalyDetector()
        
        normal_features = pd.Series({"time_kurtosis": 3.0, "time_crest_factor": 3.0})
        score1 = detector._calculate_rule_score(normal_features)
        
        anomaly_features = pd.Series({"time_kurtosis": 15.0, "time_crest_factor": 8.0})
        score2 = detector._calculate_rule_score(anomaly_features)
        
        assert score2 >= score1, "异常特征应该有更高的规则分数"


class TestRuleFusion:
    """测试规则融合模块"""
    
    def test_fusion_basic(self):
        """测试基础融合功能"""
        from bearing_vibration_detector.rule_fusion import RuleFusion, TripRiskResult, RiskLevel
        from bearing_vibration_detector.model_inference import TripAnomalyResult, FrameAnomalyResult, AnomalyType
        
        rule_fusion = RuleFusion()
        
        frame_results = [
            FrameAnomalyResult(
                frame_idx=0,
                start_time=0.0,
                end_time=0.5,
                anomaly_score=0.9,
                anomaly_type=AnomalyType.SPALLING
            ),
            FrameAnomalyResult(
                frame_idx=1,
                start_time=0.5,
                end_time=1.0,
                anomaly_score=0.2,
                anomaly_type=AnomalyType.NORMAL
            )
        ]
        
        anomaly_result = TripAnomalyResult(
            trip_id="test",
            frame_results=frame_results,
            has_anomaly=True,
            primary_anomaly_type=AnomalyType.SPALLING
        )
        
        risk_result = rule_fusion.fuse(anomaly_result)
        
        assert isinstance(risk_result, TripRiskResult), "应该返回TripRiskResult对象"
        assert len(risk_result.frame_results) == len(frame_results), "帧结果数量应该匹配"
        
        summary = rule_fusion.get_risk_summary(risk_result)
        assert isinstance(summary, dict), "摘要应该是字典"
    
    def test_risk_level_calculation(self):
        """测试风险等级计算"""
        from bearing_vibration_detector.rule_fusion import RuleFusion, RiskLevel
        
        rule_fusion = RuleFusion()
        
        assert rule_fusion._score_to_risk_level(0.9) == RiskLevel.RED, "高分应该是红色"
        assert rule_fusion._score_to_risk_level(0.7) == RiskLevel.ORANGE, "中高分应该是橙色"
        assert rule_fusion._score_to_risk_level(0.5) == RiskLevel.YELLOW, "中分应该是黄色"
        assert rule_fusion._score_to_risk_level(0.2) == RiskLevel.GREEN, "低分应该是绿色"


class TestReviewStorage:
    """测试复核存储模块"""
    
    def test_storage_creation(self):
        """测试存储创建"""
        from bearing_vibration_detector.review_storage import ReviewStorage
        
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = ReviewStorage(storage_dir=tmpdir, auto_save=True)
            
            assert storage is not None, "存储应该创建成功"
            
            stats = storage.get_statistics()
            assert isinstance(stats, dict), "统计信息应该是字典"
    
    def test_review_creation(self):
        """测试复核记录创建"""
        from bearing_vibration_detector.review_storage import ReviewStorage
        from bearing_vibration_detector.rule_fusion import TripRiskResult, RiskLevel
        
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = ReviewStorage(storage_dir=tmpdir, auto_save=False)
            
            risk_result = TripRiskResult(
                trip_id="test_trip",
                analysis_time="2024-01-01T00:00:00",
                overall_risk=RiskLevel.YELLOW,
                overall_score=0.5
            )
            
            review = storage.create_review_from_risk(risk_result, "test_trip")
            
            assert review is not None, "复核记录应该创建成功"
            assert review.trip_id == "test_trip", "趟次ID应该匹配"
    
    def test_query_reviews(self):
        """测试查询复核记录"""
        from bearing_vibration_detector.review_storage import ReviewStorage
        
        with tempfile.TemporaryDirectory() as tmpdir:
            storage = ReviewStorage(storage_dir=tmpdir, auto_save=False)
            
            pending = storage.get_pending_reviews()
            assert isinstance(pending, list), "待复核列表应该是列表"
            
            stats = storage.get_statistics()
            assert "total_reviews" in stats, "统计应该包含总记录数"


class TestExporter:
    """测试导出模块"""
    
    def test_exporter_creation(self):
        """测试导出器创建"""
        from bearing_vibration_detector.exporter import Exporter
        
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = Exporter(output_dir=tmpdir)
            
            assert exporter is not None, "导出器应该创建成功"
            
            summary = exporter.get_export_summary()
            assert isinstance(summary, dict), "导出摘要应该是字典"


class TestIntegration:
    """集成测试"""
    
    def test_full_pipeline(self):
        """测试完整流水线"""
        from bearing_vibration_detector.data_parser import DataParser
        from bearing_vibration_detector.feature_engineering import FeatureEngineer
        from bearing_vibration_detector.model_inference import AnomalyDetector
        from bearing_vibration_detector.rule_fusion import RuleFusion
        
        with tempfile.TemporaryDirectory() as tmpdir:
            vib_df = generate_test_vibration_data(duration=2.0, anomaly=True)
            vib_file = os.path.join(tmpdir, "test_vibration.csv")
            vib_df.to_csv(vib_file, index=False)
            
            parser = DataParser()
            trips = parser.parse_directory(tmpdir)
            
            assert len(trips) > 0, "应该解析到数据"
            
            for trip_id, trip_data in trips.items():
                engineer = FeatureEngineer(
                    frame_size=2560,
                    sampling_rate=25600.0
                )
                
                features = engineer.extract_features(trip_data.vibration_data)
                
                assert len(features.frame_features) > 0, "应该提取到特征"
                
                features_df = engineer.features_to_dataframe(features)
                
                detector = AnomalyDetector(use_ensemble=False)
                anomaly_result = detector.detect(features_df, features.global_features)
                
                assert len(anomaly_result.frame_results) == len(features.frame_features), "检测结果帧数应该匹配"
                
                rule_fusion = RuleFusion()
                risk_result = rule_fusion.fuse(anomaly_result, features_df)
                
                assert risk_result is not None, "风险评估应该成功"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
