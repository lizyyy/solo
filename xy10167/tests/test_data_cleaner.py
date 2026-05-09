from datetime import datetime
from qc_audit.data_cleaner import DataCleaner


class TestDataCleaner:
    def setup_method(self):
        self.cleaner = DataCleaner()

    def test_parse_bool_various_formats(self):
        assert self.cleaner.parse_bool("合格", "测试") is False
        assert self.cleaner.parse_bool("不合格", "测试") is True
        assert self.cleaner.parse_bool("PASS", "测试") is False
        assert self.cleaner.parse_bool("fail", "测试") is True
        assert self.cleaner.parse_bool("1", "测试") is False
        assert self.cleaner.parse_bool("0", "测试") is True
        assert self.cleaner.parse_bool(True, "测试") is False
        assert self.cleaner.parse_bool(False, "测试") is True

    def test_parse_bool_invalid(self):
        result = self.cleaner.parse_bool("invalid", "测试")
        assert result is None
        assert any(w["code"] == "invalid_bool" for w in self.cleaner.warnings)

    def test_parse_int_various_formats(self):
        assert self.cleaner.parse_int("100", "测试") == 100
        assert self.cleaner.parse_int(200, "测试") == 200
        assert self.cleaner.parse_int("50.5", "测试") == 50

    def test_parse_int_invalid(self):
        result = self.cleaner.parse_int("abc", "测试")
        assert result is None
        assert any(w["code"] == "invalid_int" for w in self.cleaner.warnings)

    def test_parse_float_with_percent(self):
        assert self.cleaner.parse_float("95%", "测试") == 0.95
        assert self.cleaner.parse_float(0.95, "测试") == 0.95
        assert self.cleaner.parse_float("0.85", "测试") == 0.85

    def test_parse_datetime_various_formats(self):
        dt1 = self.cleaner.parse_datetime("2026-05-01", "测试")
        assert dt1 is not None
        assert dt1.year == 2026
        assert dt1.month == 5
        assert dt1.day == 1

        dt2 = self.cleaner.parse_datetime("2026/05/01 14:30:00", "测试")
        assert dt2 is not None
        assert dt2.hour == 14
        assert dt2.minute == 30

    def test_parse_datetime_invalid(self):
        result = self.cleaner.parse_datetime("not a date", "测试")
        assert result is None
        assert any(w["code"] == "invalid_datetime" for w in self.cleaner.warnings)

    def test_clean_sample_minimal(self):
        raw = {
            "sample_id": "S001",
            "是否不合格": "合格",
        }
        sample = self.cleaner.clean_sample(raw, "B001", 0)
        
        assert sample is not None
        assert sample.sample_id == "S001"
        assert sample.is_defective is False

    def test_clean_sample_auto_id(self):
        raw = {"是否不合格": "合格"}
        sample = self.cleaner.clean_sample(raw, "B001", 5)
        
        assert sample is not None
        assert sample.sample_id == "B001_S006"

    def test_clean_sample_invalid_result(self):
        raw = {
            "sample_id": "S001",
            "是否不合格": "unknown",
        }
        sample = self.cleaner.clean_sample(raw, "B001", 0)
        assert sample is None

    def test_clean_batch(self):
        raw_batch = {
            "batch_id": "B001",
            "product": "测试产品",
            "total_quantity": "1000",
            "抽样数量": 5,
            "生产日期": "2026-05-01",
        }
        raw_samples = [
            {"样本编号": "S001", "结果": "合格"},
            {"样本编号": "S002", "结果": "不合格"},
            {"样本编号": "S003", "结果": "合格"},
        ]

        batch = self.cleaner.clean_batch(raw_batch, raw_samples)
        
        assert batch is not None
        assert batch.batch_id == "B001"
        assert batch.total_quantity == 1000
        assert len(batch.samples) == 3
        assert batch.defective_count == 1

    def test_clean_batch_no_valid_samples(self):
        raw_batch = {"batch_id": "B001", "product": "测试"}
        raw_samples = [
            {"结果": "invalid"},
        ]
        
        batch = self.cleaner.clean_batch(raw_batch, raw_samples)
        assert batch is None
        assert any(w["code"] == "no_valid_samples" for w in self.cleaner.warnings)

    def test_clean_recheck(self):
        raw = {
            "样本编号": "S001",
            "原始结果": "不合格",
            "复检结果": "合格",
            "复检时间": "2026-05-01 10:00:00",
        }
        
        recheck = self.cleaner.clean_recheck(raw, 0)
        
        assert recheck is not None
        assert recheck.sample_id == "S001"
        assert recheck.original_result is True
        assert recheck.recheck_result is False

    def test_clean_sampling_rule(self):
        raw = {
            "rule_id": "R001",
            "name": "测试规则",
            "description": "测试用",
            "sample_size": "13",
            "pass_threshold": "95%",
            "min_batch_size": 501,
            "max_batch_size": 2000,
        }
        
        rule = self.cleaner.clean_sampling_rule(raw, 0)
        
        assert rule is not None
        assert rule.rule_id == "R001"
        assert rule.sample_size == 13
        assert rule.pass_threshold == 0.95
        assert rule.batch_size_range == (501, 2000)
