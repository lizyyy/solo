import json
import pytest
from pathlib import Path
from src.config import Config
from src.deduplicator import LiveAlertDeduplicator


@pytest.fixture
def default_config():
    return Config()


@pytest.fixture
def sample_alerts():
    sample_path = Path(__file__).parent.parent / "samples" / "live_alerts_sample.json"
    with open(sample_path, 'r', encoding='utf-8') as f:
        return json.load(f)


class TestConfig:
    def test_config_loading(self, default_config):
        assert default_config.overlap_enabled is True
        assert default_config.time_overlap_threshold == 5
        assert default_config.content_similarity_threshold == 0.85
        assert default_config.merge_strategy == "merge_evidence"

    def test_model_duplicate_config(self, default_config):
        assert default_config.model_duplicate_enabled is True
        assert default_config.model_time_window == 300
        assert default_config.confidence_diff_threshold == 0.1

    def test_fp_recovery_config(self, default_config):
        assert default_config.fp_recovery_enabled is True
        assert default_config.fp_marker_field == "is_false_positive"
        assert default_config.keep_fp_with_marker is True


class TestTimeOverlapDetection:
    def test_detect_overlapping_alerts(self, default_config, sample_alerts):
        deduplicator = LiveAlertDeduplicator(default_config)
        alert1 = sample_alerts[0]
        alert2 = sample_alerts[1]

        is_overlap, duration = deduplicator._check_time_overlap(alert1, alert2)
        assert is_overlap is True
        assert duration == 5

    def test_no_overlap_alerts(self, default_config, sample_alerts):
        deduplicator = LiveAlertDeduplicator(default_config)
        alert1 = sample_alerts[0]
        alert3 = sample_alerts[2]

        is_overlap, duration = deduplicator._check_time_overlap(alert1, alert3)
        assert is_overlap is False
        assert duration == 0


class TestContentSimilarity:
    def test_high_similarity_content(self, default_config, sample_alerts):
        deduplicator = LiveAlertDeduplicator(default_config)
        alert1 = sample_alerts[0]
        alert2 = sample_alerts[1]

        is_similar, similarity = deduplicator._check_content_similarity(alert1, alert2)
        assert is_similar is True
        assert similarity >= 0.9

    def test_low_similarity_content(self, default_config, sample_alerts):
        deduplicator = LiveAlertDeduplicator(default_config)
        alert1 = sample_alerts[0]
        alert4 = sample_alerts[3]

        is_similar, similarity = deduplicator._check_content_similarity(alert1, alert4)
        assert is_similar is False
        assert similarity < 0.5


class TestModelDuplicateDetection:
    def test_same_model_duplicate(self, default_config, sample_alerts):
        deduplicator = LiveAlertDeduplicator(default_config)
        alert1 = sample_alerts[0]
        alert2 = sample_alerts[1]

        is_dup, info = deduplicator._check_model_duplicate(alert1, alert2)
        assert is_dup is True

    def test_different_model_not_duplicate(self, default_config, sample_alerts):
        deduplicator = LiveAlertDeduplicator(default_config)
        alert1 = sample_alerts[0]
        alert4 = sample_alerts[3]

        is_dup, info = deduplicator._check_model_duplicate(alert1, alert4)
        assert is_dup is False

    def test_different_stream_not_duplicate(self, default_config, sample_alerts):
        deduplicator = LiveAlertDeduplicator(default_config)
        alert1 = sample_alerts[0]
        alert6 = sample_alerts[5]

        is_dup, info = deduplicator._check_model_duplicate(alert1, alert6)
        assert is_dup is False


class TestFalsePositiveRecovery:
    def test_fp_recovery_enabled(self, default_config, sample_alerts):
        deduplicator = LiveAlertDeduplicator(default_config)
        result = deduplicator.deduplicate(sample_alerts)
        assert result['statistics']['false_positives_recovered'] == 1

        fp_alerts = [a for a in result['alerts']
                     if a.get('deduplication_info', {}).get('status') == 'false_positive_recovered']
        assert len(fp_alerts) == 1

    def test_fp_recovery_disabled(self, sample_alerts):
        config_path = Path(__file__).parent.parent / "config" / "strict.yaml"
        cfg = Config(str(config_path))
        deduplicator = LiveAlertDeduplicator(cfg)
        result = deduplicator.deduplicate(sample_alerts)
        assert result['statistics']['false_positives_recovered'] == 0


class TestDeduplicationEndToEnd:
    def test_full_deduplication(self, default_config, sample_alerts):
        deduplicator = LiveAlertDeduplicator(default_config)
        result = deduplicator.deduplicate(sample_alerts)

        assert result['statistics']['total_input'] == 10
        assert result['statistics']['total_output'] < 10
        assert result['statistics']['model_duplicates_removed'] > 0

        assert 'alerts' in result
        assert 'statistics' in result
        assert 'deduplication_version' in result
        assert 'config_used' in result

    def test_evidence_chain_preserved(self, default_config, sample_alerts):
        deduplicator = LiveAlertDeduplicator(default_config)
        result = deduplicator.deduplicate(sample_alerts)

        merged_alerts = [a for a in result['alerts'] if 'evidence_chain' in a]
        for alert in merged_alerts:
            assert len(alert['evidence_chain']) >= 2
            for evidence in alert['evidence_chain']:
                assert 'alert_id' in evidence
                assert 'evidence_url' in evidence

    def test_deduplication_info_present(self, default_config, sample_alerts):
        deduplicator = LiveAlertDeduplicator(default_config)
        result = deduplicator.deduplicate(sample_alerts)

        for alert in result['alerts']:
            if 'evidence_chain' in alert:
                assert 'deduplication_info' in alert
                dedup_info = alert['deduplication_info']
                assert 'merge_type' in dedup_info
                assert 'merged_count' in dedup_info
                assert 'merged_alert_ids' in dedup_info


class TestDifferentConfigs:
    def test_strict_vs_default_config(self, sample_alerts):
        default_cfg = Config()
        strict_cfg_path = Path(__file__).parent.parent / "config" / "strict.yaml"
        strict_cfg = Config(str(strict_cfg_path))

        dedup_default = LiveAlertDeduplicator(default_cfg)
        dedup_strict = LiveAlertDeduplicator(strict_cfg)

        result_default = dedup_default.deduplicate(sample_alerts)
        result_strict = dedup_strict.deduplicate(sample_alerts)

        assert result_default['statistics']['total_output'] != result_strict['statistics']['total_output']


class TestEmptyAndEdgeCases:
    def test_empty_alerts(self, default_config):
        deduplicator = LiveAlertDeduplicator(default_config)
        result = deduplicator.deduplicate([])

        assert result['statistics']['total_input'] == 0
        assert result['statistics']['total_output'] == 0
        assert len(result['alerts']) == 0

    def test_single_alert(self, default_config, sample_alerts):
        deduplicator = LiveAlertDeduplicator(default_config)
        single_alert = sample_alerts[:1]
        result = deduplicator.deduplicate(single_alert)

        assert result['statistics']['total_input'] == 1
        assert result['statistics']['total_output'] == 1
        assert result['statistics']['overlap_merged'] == 0

    def test_missing_fields(self, default_config):
        deduplicator = LiveAlertDeduplicator(default_config)
        incomplete_alerts = [
            {
                "alert_id": "TEST-001",
                "stream_id": "STREAM-001",
                "violation_type": "测试违规"
            }
        ]
        result = deduplicator.deduplicate(incomplete_alerts)
        assert result['statistics']['total_input'] == 1
        assert result['statistics']['total_output'] == 1
