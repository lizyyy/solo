import pytest
import os
import tempfile
import pandas as pd
from sequence_error_attribution.data_loader import DataLoader
from sequence_error_attribution.config import DEFAULT_CONFIG, STABLE_MESSAGES


class TestDataLoader:
    """测试数据加载器"""

    @pytest.fixture
    def temp_csv_file(self):
        """创建临时CSV文件"""
        content = """题目ID,来源,题目内容,数列类型,已知项,递推公式,学生答案,正确答案,错误类型
Q001,2023高考,测试题目1,线性递推,a1=2,a(n+1)=2*a(n)+1,"2, 5, 11","2, 5, 11",无
Q002,2024模考,测试题目2,分式递推,a1=1,a(n+1)=a(n)/(a(n)-1),"1, 不存在","1, 无穷大",除零边界
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(content)
            temp_path = f.name
        yield temp_path
        os.unlink(temp_path)

    @pytest.fixture
    def temp_csv_alt_fields(self):
        """创建使用不同字段名的临时CSV文件"""
        content = """id,出处,题干,递推类型,首项,递推关系,作答,标准答案,错因
ALT001,2023高考,测试题目1,线性递推,a1=2,a(n+1)=2*a(n)+1,"2, 5, 11","2, 5, 11",无
ALT002,2024模考,测试题目2,分式递推,a1=1,a(n+1)=a(n)/(a(n)-1),"1, 不存在","1, 无穷大",除零边界
"""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False, encoding='utf-8') as f:
            f.write(content)
            temp_path = f.name
        yield temp_path
        os.unlink(temp_path)

    def test_load_file_not_found(self):
        """测试加载不存在的文件"""
        loader = DataLoader()
        with pytest.raises(FileNotFoundError, match="输入文件不存在"):
            loader.load_file("/nonexistent/file.csv")

    def test_load_invalid_format(self):
        """测试加载不支持的文件格式"""
        loader = DataLoader()
        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write("test")
            temp_path = f.name
        try:
            with pytest.raises(ValueError, match="文件格式无效"):
                loader.load_file(temp_path)
        finally:
            os.unlink(temp_path)

    def test_load_csv_success(self, temp_csv_file):
        """测试成功加载CSV文件"""
        loader = DataLoader()
        records = loader.load_file(temp_csv_file)

        assert len(records) == 2
        assert records[0].question_id == "Q001"
        assert records[0].question_source == "2023高考"
        assert records[0].original_terms == [2.0]
        assert records[0].recurrence_formula == "a(n+1)=2*a(n)+1"
        assert records[0].source_row == 2
        assert records[0].source_file == os.path.basename(temp_csv_file)

    def test_load_csv_alt_fields(self, temp_csv_alt_fields):
        """测试加载使用不同字段名的CSV文件"""
        loader = DataLoader()
        records = loader.load_file(temp_csv_alt_fields)

        assert len(records) == 2
        assert records[0].question_id == "ALT001"
        assert records[0].question_source == "2023高考"
        assert records[0].original_terms == [2.0]
        assert records[0].recurrence_formula == "a(n+1)=2*a(n)+1"

    def test_parse_terms_simple(self):
        """测试解析简单数列项"""
        loader = DataLoader()
        terms = loader._parse_terms("a1=2, a2=5, a3=11")
        assert terms == [2.0, 5.0, 11.0]

    def test_parse_terms_single(self):
        """测试解析单个项"""
        loader = DataLoader()
        terms = loader._parse_terms("a1=3")
        assert terms == [3.0]

    def test_parse_terms_negative(self):
        """测试解析负数项"""
        loader = DataLoader()
        terms = loader._parse_terms("a1=-2, a2=-1")
        assert terms == [-2.0, -1.0]

    def test_parse_terms_decimal(self):
        """测试解析小数项"""
        loader = DataLoader()
        terms = loader._parse_terms("a1=0.5, a2=0.25")
        assert terms == [0.5, 0.25]

    def test_parse_terms_fraction(self):
        """测试解析分数项，1/3 不能拆成 1 和 3 两个数"""
        loader = DataLoader()
        terms = loader._parse_terms("a1=1, a2=-1, a3=1/3")
        assert len(terms) == 3
        assert abs(terms[0] - 1.0) < 1e-9
        assert abs(terms[1] - (-1.0)) < 1e-9
        assert abs(terms[2] - (1.0 / 3.0)) < 1e-9

    def test_parse_terms_negative_fraction(self):
        """测试解析负分数"""
        loader = DataLoader()
        terms = loader._parse_terms("a1=-2/5, a2=3/7")
        assert len(terms) == 2
        assert abs(terms[0] - (-2.0 / 5.0)) < 1e-9
        assert abs(terms[1] - (3.0 / 7.0)) < 1e-9

    def test_parse_terms_no_duplicate(self):
        """解析分数时不能产生重复项或漏掉后续项"""
        loader = DataLoader()
        terms = loader._parse_terms("a1=1/3, a2=2/5, a3=3")
        assert len(terms) == 3
        assert abs(terms[0] - 1.0 / 3.0) < 1e-9
        assert abs(terms[1] - 2.0 / 5.0) < 1e-9
        assert abs(terms[2] - 3.0) < 1e-9

    def test_parse_terms_empty(self):
        """测试解析空字符串"""
        loader = DataLoader()
        terms = loader._parse_terms("")
        assert terms == []

        terms = loader._parse_terms(None)
        assert terms == []

    def test_parse_formula_with_denominator(self):
        """测试解析带分母的公式"""
        loader = DataLoader()
        formula, denominator = loader._parse_formula("a(n+1)=a(n)/(a(n)-1)")
        assert formula == "a(n+1)=a(n)/(a(n)-1)"
        assert denominator == "a(n)-1"

    def test_parse_formula_with_parentheses(self):
        """测试解析带括号分母的公式"""
        loader = DataLoader()
        formula, denominator = loader._parse_formula("a(n+1)=(a(n)+1)/(a(n)-1)")
        assert formula == "a(n+1)=(a(n)+1)/(a(n)-1)"
        assert denominator == "a(n)-1"

    def test_parse_formula_simple(self):
        """测试解析简单公式"""
        loader = DataLoader()
        formula, denominator = loader._parse_formula("a(n+1)=2*a(n)+1")
        assert formula == "a(n+1)=2*a(n)+1"
        assert denominator is None

    def test_parse_formula_empty(self):
        """测试解析空公式"""
        loader = DataLoader()
        formula, denominator = loader._parse_formula("")
        assert formula == ""
        assert denominator is None

    def test_validate_records(self, temp_csv_file):
        """测试验证记录"""
        loader = DataLoader()
        records = loader.load_file(temp_csv_file)
        valid_records, warnings = loader.validate_records(records)

        assert len(valid_records) == 2
        assert len(warnings) == 0

    def test_validate_records_missing_id(self):
        """测试验证缺少ID的记录"""
        loader = DataLoader()
        from sequence_error_attribution.models import QuestionRecord
        record = QuestionRecord(source_row=2, source_file="test.csv")
        record.given_terms = "a1=2"
        record.recurrence_formula = "a(n+1)=2*a(n)+1"

        valid_records, warnings = loader.validate_records([record])

        assert len(valid_records) == 1
        assert valid_records[0].question_id.startswith("AUTO_")
        assert any("题目ID自动生成" in w for w in warnings)

    def test_validate_records_missing_data(self):
        """测试验证缺少关键数据的记录"""
        loader = DataLoader()
        from sequence_error_attribution.models import QuestionRecord
        record = QuestionRecord(question_id="Q001", source_row=2, source_file="test.csv")

        valid_records, warnings = loader.validate_records([record])

        assert len(valid_records) == 1
        assert valid_records[0].needs_review is True
        assert "样本不足" in valid_records[0].review_reason

    def test_find_column_exact_match(self):
        """测试精确匹配列名"""
        loader = DataLoader()
        columns = ["题目ID", "来源", "已知项"]
        result = loader._find_column(columns, ["题目ID", "id"])
        assert result == "题目ID"

    def test_find_column_case_insensitive(self):
        """测试大小写不敏感匹配列名"""
        loader = DataLoader()
        columns = ["Question_ID", "Source", "Terms"]
        result = loader._find_column(columns, ["question_id", "题目ID"])
        assert result == "Question_ID"

    def test_find_column_alternative_name(self):
        """测试使用备用名称匹配列名"""
        loader = DataLoader()
        columns = ["id", "出处", "首项"]
        result = loader._find_column(columns, ["题目ID", "id"])
        assert result == "id"

    def test_find_column_not_found(self):
        """测试找不到列名"""
        loader = DataLoader()
        columns = ["col1", "col2", "col3"]
        result = loader._find_column(columns, ["题目ID", "id"])
        assert result is None

    def test_source_tracking(self, temp_csv_file):
        """测试来源追踪功能"""
        loader = DataLoader()
        records = loader.load_file(temp_csv_file)

        assert records[0].source_location == f"{os.path.basename(temp_csv_file)}:2"
        assert records[1].source_location == f"{os.path.basename(temp_csv_file)}:3"
