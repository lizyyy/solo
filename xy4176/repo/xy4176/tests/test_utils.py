"""工具函数测试"""

from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
import tempfile
import pytest

from receipt_verifier.utils import (
    calculate_file_hash,
    parse_decimal,
    parse_date,
    parse_datetime,
    normalize_text,
    extract_account_tail,
    compare_fuzzy,
    ensure_directory,
    generate_id,
    amount_to_cn,
)


class TestCalculateFileHash:
    """文件哈希计算测试"""

    def test_calculate_sha256(self):
        """测试 SHA256 哈希计算"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            f.write("test content")
            temp_path = f.name

        try:
            file_hash = calculate_file_hash(temp_path, "sha256")
            assert len(file_hash) == 64
            assert all(c in '0123456789abcdef' for c in file_hash)
        finally:
            Path(temp_path).unlink()

    def test_calculate_md5(self):
        """测试 MD5 哈希计算"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            f.write("test content")
            temp_path = f.name

        try:
            file_hash = calculate_file_hash(temp_path, "md5")
            assert len(file_hash) == 32
        finally:
            Path(temp_path).unlink()

    def test_invalid_algorithm(self):
        """测试无效算法"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.txt') as f:
            f.write("test")
            temp_path = f.name

        try:
            with pytest.raises(ValueError):
                calculate_file_hash(temp_path, "invalid_algo")
        finally:
            Path(temp_path).unlink()


class TestParseDecimal:
    """金额解析测试"""

    def test_parse_string(self):
        """测试字符串解析"""
        assert parse_decimal("123.45") == Decimal("123.45")
        assert parse_decimal("1,234.56") == Decimal("1234.56")
        assert parse_decimal("￥100.00") == Decimal("100.00")
        assert parse_decimal("$200.50") == Decimal("200.50")

    def test_parse_numeric(self):
        """测试数值解析"""
        assert parse_decimal(123) == Decimal("123")
        assert parse_decimal(123.45) == Decimal("123.45")

    def test_parse_invalid(self):
        """测试无效值解析"""
        assert parse_decimal(None) == Decimal("0")
        assert parse_decimal("") == Decimal("0")
        assert parse_decimal("abc") == Decimal("0")


class TestParseDate:
    """日期解析测试"""

    def test_parse_iso_format(self):
        """测试 ISO 格式"""
        result = parse_date("2024-01-15")
        assert result == date(2024, 1, 15)

    def test_parse_chinese_format(self):
        """测试中文格式"""
        result = parse_date("2024年1月15日")
        assert result == date(2024, 1, 15)

    def test_parse_slash_format(self):
        """测试斜杠格式"""
        result = parse_date("2024/01/15")
        assert result == date(2024, 1, 15)

    def test_parse_invalid(self):
        """测试无效日期"""
        assert parse_date("") is None
        assert parse_date(None) is None
        assert parse_date("invalid_date") is None


class TestParseDatetime:
    """日期时间解析测试"""

    def test_parse_datetime(self):
        """测试日期时间解析"""
        result = parse_datetime("2024-01-15 10:30:00")
        assert result is not None
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15

    def test_parse_date_only(self):
        """测试仅日期"""
        result = parse_datetime("2024-01-15")
        assert result is not None
        assert result.hour == 0

    def test_parse_invalid(self):
        """测试无效值"""
        assert parse_datetime("") is None
        assert parse_datetime(None) is None


class TestNormalizeText:
    """文本规范化测试"""

    def test_remove_whitespace(self):
        """测试去除多余空白"""
        assert normalize_text("  hello   world  ") == "hello world"
        assert normalize_text("hello\nworld") == "hello world"

    def test_fullwidth_to_halfwidth(self):
        """测试全角转半角"""
        assert normalize_text("１２３") == "123"
        assert normalize_text("ＡＢＣ") == "ABC"


class TestExtractAccountTail:
    """账号尾号提取测试"""

    def test_extract_tail(self):
        """测试提取尾号"""
        assert extract_account_tail("6222021234567890123") == "0123"
        assert extract_account_tail("622202 1234 5678 90123") == "0123"

    def test_custom_length(self):
        """测试自定义长度"""
        assert extract_account_tail("6222021234567890123", length=6) == "890123"

    def test_short_account(self):
        """测试短账号"""
        assert extract_account_tail("1234") == "1234"
        assert extract_account_tail("") == ""


class TestCompareFuzzy:
    """模糊比较测试"""

    def test_exact_match(self):
        """测试完全匹配"""
        assert compare_fuzzy("hello", "hello") == 1.0

    def test_partial_match(self):
        """测试部分匹配"""
        assert compare_fuzzy("北京科技有限公司", "北京科技") >= 0.5

    def test_case_insensitive(self):
        """测试大小写不敏感"""
        assert compare_fuzzy("HELLO", "hello") == 1.0

    def test_empty_strings(self):
        """测试空字符串"""
        assert compare_fuzzy("", "hello") == 0.0
        assert compare_fuzzy("hello", "") == 0.0


class TestEnsureDirectory:
    """目录确保测试"""

    def test_create_directory(self):
        """测试创建目录"""
        with tempfile.TemporaryDirectory() as tmpdir:
            test_dir = Path(tmpdir) / "test_subdir"
            assert not test_dir.exists()

            result = ensure_directory(str(test_dir))
            assert result.exists()
            assert test_dir.exists()

    def test_existing_directory(self):
        """测试已存在目录"""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = ensure_directory(tmpdir)
            assert result.exists()


class TestGenerateId:
    """ID 生成测试"""

    def test_generate_with_timestamp(self):
        """测试带时间戳的 ID"""
        id1 = generate_id()
        id2 = generate_id()
        assert id1 != id2
        assert len(id1) > 0

    def test_generate_with_prefix(self):
        """测试带前缀的 ID"""
        test_id = generate_id("TEST_")
        assert test_id.startswith("TEST_")

    def test_generate_without_timestamp(self):
        """测试不带时间戳"""
        test_id = generate_id(timestamp=False)
        assert "_" not in test_id or test_id.count("_") == 0


class TestAmountToCn:
    """金额转中文大写测试"""

    def test_zero(self):
        """测试零"""
        assert amount_to_cn(Decimal("0")) == "零元整"

    def test_integer(self):
        """测试整数"""
        assert amount_to_cn(Decimal("100")) == "壹佰元整"
        assert amount_to_cn(Decimal("1234")) == "壹仟贰佰叁拾肆元整"

    def test_decimal(self):
        """测试小数"""
        assert amount_to_cn(Decimal("100.50")) == "壹佰元伍角整"
        assert amount_to_cn(Decimal("100.05")) == "壹佰元零伍分"

    def test_large_amount(self):
        """测试大额"""
        assert amount_to_cn(Decimal("10000")) == "壹万元整"
        assert amount_to_cn(Decimal("123456789.00")) == "壹亿贰仟叁佰肆拾伍万陆仟柒佰捌拾玖元整"
