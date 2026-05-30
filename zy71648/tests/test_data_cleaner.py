"""测试数据清洗模块"""

import pytest
import pandas as pd
import numpy as np
from error_propagation.data_cleaner import DataCleaner
from error_propagation.types import IssueType, Severity


class TestDataCleaner:
    """测试数据清洗器"""

    def setup_method(self):
        self.cleaner = DataCleaner()

    def test_remove_empty_columns(self):
        """测试移除空列"""
        df = pd.DataFrame({
            'a': [1, 2, 3],
            'b': [None, None, None],
            'c': [4, 5, 6]
        })
        cleaned, issues = self.cleaner.clean_dataframe(df)

        assert 'b' not in cleaned.columns
        assert len(issues) >= 1
        assert any(i.issue_type == IssueType.EMPTY_COLUMN for i in issues)

    def test_remove_empty_rows(self):
        """测试移除空行"""
        df = pd.DataFrame({
            'a': [1, None, 3],
            'b': [2, None, 4]
        })
        cleaned, issues = self.cleaner.clean_dataframe(df)

        assert len(cleaned) == 2
        assert any(i.issue_type == IssueType.EMPTY_ROW for i in issues)

    def test_remove_duplicate_rows(self):
        """测试移除重复行"""
        df = pd.DataFrame({
            'name': ['L', 'L', 'T'],
            'value': [1.0, 1.0, 2.0]
        })
        cleaned, issues = self.cleaner.clean_dataframe(df)

        assert len(cleaned) == 2
        assert any(i.issue_type == IssueType.DUPLICATE_ROW for i in issues)

    def test_fix_typos(self):
        """测试修复错别字"""
        df = pd.DataFrame({
            'name': ['质良', '长渡', '温度'],
            'value': [1.0, 2.0, 3.0]
        })
        cleaned, issues = self.cleaner.clean_dataframe(df)

        assert '质量' in cleaned['name'].values or '质良' not in cleaned['name'].values
        assert any(i.issue_type == IssueType.TYPO for i in issues)

    def test_standardize_column_names(self):
        """测试标准化列名"""
        df = pd.DataFrame({
            ' Value ': [1, 2, 3],
            'Uncertainty  Value': [0.1, 0.2, 0.3]
        })
        cleaned, _ = self.cleaner.clean_dataframe(df)

        assert 'value' in cleaned.columns
        assert 'uncertainty_value' in cleaned.columns

    def test_parse_numeric_values(self):
        """测试解析数值"""
        df = pd.DataFrame({
            'value': ['1.23', '4,567.89', '1.2e3', 'invalid'],
            'name': ['a', 'b', 'c', 'd']
        })
        cleaned, issues = self.cleaner.clean_dataframe(df)

        assert pd.api.types.is_numeric_dtype(cleaned['value'])
        assert cleaned['value'].iloc[0] == 1.23
        assert cleaned['value'].iloc[1] == 4567.89
        assert cleaned['value'].iloc[2] == 1200.0

    def test_parse_measurements(self):
        """测试解析测量数据"""
        df = pd.DataFrame({
            'name': ['L', 'T', 'm'],
            'value': [0.984, 1.992, 0.050],
            'uncertainty': [0.001, 0.001, 0.001],
            'unit': ['m', 's', 'kg'],
            'group': ['group1', 'group1', 'group2']
        })

        groups = self.cleaner.parse_measurements_from_dataframe(df)

        assert 'group1' in groups
        assert 'group2' in groups
        assert 'L' in groups['group1'].measurements
        assert groups['group1'].measurements['L'].value == 0.984
        assert groups['group1'].measurements['L'].unit == 'm'

    def test_count_significant_figures(self):
        """测试计算有效数字"""
        assert self.cleaner._count_significant_figures('1.23') == 3
        assert self.cleaner._count_significant_figures('0.00123') == 3
        assert self.cleaner._count_significant_figures('1.230') == 4
        assert self.cleaner._count_significant_figures('1230') == 3
        assert self.cleaner._count_significant_figures('1.23e-4') == 3

    def test_missing_uncertainty(self):
        """测试检测缺失不确定度"""
        df = pd.DataFrame({
            'name': ['L', 'T'],
            'value': [0.984, 1.992],
            'uncertainty': [0.0, 0.001],
            'unit': ['m', 's']
        })
        cleaned, _ = self.cleaner.clean_dataframe(df)
        groups = self.cleaner.parse_measurements_from_dataframe(cleaned)

        assert any(
            i.issue_type == IssueType.MISSING_UNCERTAINTY
            for i in self.cleaner.issues
        )

    def test_missing_unit(self):
        """测试检测缺失单位"""
        df = pd.DataFrame({
            'name': ['L', 'T'],
            'value': [0.984, 1.992],
            'uncertainty': [0.001, 0.001],
            'unit': ['m', '']
        })
        cleaned, _ = self.cleaner.clean_dataframe(df)
        groups = self.cleaner.parse_measurements_from_dataframe(cleaned)

        assert any(
            i.issue_type == IssueType.INVALID_UNIT
            for i in self.cleaner.issues
        )

    def test_fuzzy_correction(self):
        """测试模糊纠错"""
        assert self.cleaner._fuzzy_correct('质良') == '质量'
        assert self.cleaner._fuzzy_correct('温du') == '温度'
        assert self.cleaner._fuzzy_correct('正常文本') == '正常文本'

    def test_empty_dataframe(self):
        """测试空DataFrame"""
        df = pd.DataFrame()
        cleaned, issues = self.cleaner.clean_dataframe(df)

        assert cleaned.empty
        assert any(i.severity == Severity.CRITICAL for i in issues)
