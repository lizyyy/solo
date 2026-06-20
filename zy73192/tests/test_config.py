import pytest
from sequence_error_attribution.config import (
    DEFAULT_CONFIG,
    STABLE_MESSAGES,
    StableMessages,
    AttributionConfig,
    FieldMapping,
)


class TestStableMessages:
    """测试稳定的错误提示和状态消息"""

    def test_error_messages_stability(self):
        """测试错误提示消息保持稳定"""
        assert STABLE_MESSAGES.ERROR_FILE_NOT_FOUND == "输入文件不存在: {file_path}"
        assert STABLE_MESSAGES.ERROR_INVALID_FILE_FORMAT == "文件格式无效，仅支持CSV和Excel格式: {file_path}"
        assert STABLE_MESSAGES.ERROR_EMPTY_DATA == "题目清单为空，无法进行归因分析"
        assert STABLE_MESSAGES.ERROR_DIVISION_BY_ZERO == "除零边界检测: 递推公式分母为零，需人工复核"

    def test_status_messages_stability(self):
        """测试状态消息保持稳定"""
        assert STABLE_MESSAGES.STATUS_PENDING == "待处理"
        assert STABLE_MESSAGES.STATUS_PROCESSING == "处理中"
        assert STABLE_MESSAGES.STATUS_SUCCESS == "处理完成"
        assert STABLE_MESSAGES.STATUS_NEEDS_REVIEW == "待复核"
        assert STABLE_MESSAGES.STATUS_FAILED == "处理失败"

    def test_jump_reasons_stability(self):
        """测试跳变原因消息保持稳定"""
        assert STABLE_MESSAGES.JUMP_REASON_THRESHOLD == "阈值触发: 结果超出预设阈值范围"
        assert STABLE_MESSAGES.JUMP_REASON_UNIT == "单位异常: 数值单位或数量级突变"
        assert STABLE_MESSAGES.JUMP_REASON_NORMAL == "正常记录: 数据本身特征导致的合理波动"

    def test_review_reasons_stability(self):
        """测试复核原因消息保持稳定"""
        assert STABLE_MESSAGES.REVIEW_REASON_DIVISION_BY_ZERO == "除零边界: 递推公式a(n+1)=f(a(n))/g(a(n))中g(a(n))=0"
        assert STABLE_MESSAGES.REVIEW_REASON_NEGATIVE_INDEX == "索引异常: 出现负项数或零项数"
        assert STABLE_MESSAGES.REVIEW_REASON_SMALL_SAMPLE == "样本不足: 边界样本量<3，统计结论可靠性低"


class TestFieldMapping:
    """测试字段映射配置"""

    def test_default_field_mapping(self):
        """测试默认字段映射包含预期字段"""
        mapping = FieldMapping()
        assert "题目ID" in mapping.question_id
        assert "id" in mapping.question_id
        assert "题号" in mapping.question_id

        assert "来源" in mapping.question_source
        assert "source" in mapping.question_source
        assert "题目来源" in mapping.question_source

        assert "已知项" in mapping.given_terms
        assert "首项" in mapping.given_terms
        assert "初始项" in mapping.given_terms

        assert "递推公式" in mapping.recurrence_formula
        assert "formula" in mapping.recurrence_formula

    def test_field_mapping_case_insensitive(self):
        """测试字段映射支持大小写不敏感匹配"""
        mapping = FieldMapping()
        assert any(name.lower() == "question_id" for name in mapping.question_id)
        assert any(name.lower() == "source" for name in mapping.question_source)


class TestAttributionConfig:
    """测试归因分析配置"""

    def test_default_config_values(self):
        """测试默认配置值"""
        config = AttributionConfig()
        assert config.min_sample_size == 3
        assert config.jump_threshold_ratio == 2.0
        assert config.unit_magnitude_threshold == 3
        assert config.zero_tolerance == 1e-10

    def test_config_validation(self):
        """测试配置参数验证"""
        with pytest.raises(ValueError):
            AttributionConfig(min_sample_size=0)

        with pytest.raises(ValueError):
            AttributionConfig(jump_threshold_ratio=-1.0)

        with pytest.raises(ValueError):
            AttributionConfig(unit_magnitude_threshold=0)

    def test_output_columns_stability(self):
        """测试输出列名保持稳定"""
        expected_columns = [
            "question_id",
            "question_source",
            "source_location",
            "processing_status",
            "attribution_result",
            "error_category",
            "needs_review",
            "review_reason",
            "jump_detected",
            "jump_reason",
            "original_terms",
            "calculated_terms",
            "processing_log",
        ]
        assert DEFAULT_CONFIG.output_columns == expected_columns

    def test_default_config_singleton(self):
        """测试默认配置单例"""
        assert DEFAULT_CONFIG.min_sample_size == 3
        assert isinstance(DEFAULT_CONFIG, AttributionConfig)
