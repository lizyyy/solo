"""测试冲突检测模块"""

import pytest

from qa_tool.modules.conflict_detector import (
    ConflictDetector, ConflictReport, QaConflict, ParamConflict
)
from qa_tool.modules.data_import import QAEntry, ProductParam


class TestConflictDetector:
    """测试冲突检测器"""
    
    def setup_method(self):
        self.detector = ConflictDetector(similarity_threshold=0.5)
    
    def test_check_numeric_conflict(self):
        """测试数值冲突检测"""
        answers = [
            "系统支持1000个并发用户。",
            "系统最多支持500个并发连接。"
        ]
        
        conflict = self.detector._check_numeric_conflict(answers)
        
        assert conflict is not None
        assert "1000" in conflict or "500" in conflict
    
    def test_check_numeric_no_conflict(self):
        """测试无数值冲突"""
        answers = [
            "系统支持1000个并发用户。",
            "系统最多支持1000个并发连接。"
        ]
        
        conflict = self.detector._check_numeric_conflict(answers)
        
        assert conflict is None
    
    def test_check_boolean_conflict(self):
        """测试是/否冲突检测"""
        answers = [
            "系统支持数据备份功能。",
            "系统不支持数据备份。"
        ]
        
        conflict = self.detector._check_boolean_conflict(answers)
        
        assert conflict is True
    
    def test_check_boolean_no_conflict(self):
        """测试无是/否冲突"""
        answers = [
            "系统支持数据备份功能。",
            "是的，系统支持自动备份。"
        ]
        
        conflict = self.detector._check_boolean_conflict(answers)
        
        assert conflict is False
    
    def test_detect_qa_conflicts_numeric(self):
        """测试检测Q&A数值冲突"""
        entries = [
            QAEntry(
                question="系统支持多少并发用户？",
                answer="系统支持最多1000个并发用户。",
                source="来源A"
            ),
            QAEntry(
                question="系统能够支持多少并发？",
                answer="系统支持最大500个并发连接。",
                source="来源B"
            ),
        ]
        
        conflicts = self.detector.detect_qa_conflicts(entries)
        
        assert len(conflicts) > 0
        assert conflicts[0].conflict_type == 'numeric_mismatch'
        assert conflicts[0].severity == 'high'
    
    def test_detect_param_conflicts(self):
        """测试检测参数冲突"""
        params = [
            ProductParam(
                product_name="企业版",
                param_name="最大并发用户数",
                param_value="1000",
                version="V3.0",
                source="来源A"
            ),
            ProductParam(
                product_name="企业版",
                param_name="最大并发用户数",
                param_value="500",
                version="V2.0",
                source="来源B"
            ),
        ]
        
        conflicts = self.detector.detect_param_conflicts(params)
        
        assert len(conflicts) > 0
    
    def test_generate_conflict_report(self):
        """测试生成冲突报告"""
        qa_entries = [
            QAEntry(
                question="系统支持多少并发？",
                answer="1000个并发。",
                source="A"
            ),
            QAEntry(
                question="系统支持多少并发？",
                answer="500个并发。",
                source="B"
            ),
        ]
        
        product_params = [
            ProductParam(
                product_name="企业版",
                param_name="最大并发用户数",
                param_value="1000",
                version="V1",
                source="A"
            ),
            ProductParam(
                product_name="企业版",
                param_name="最大并发用户数",
                param_value="500",
                version="V1",
                source="B"
            ),
        ]
        
        report = self.detector.generate_conflict_report(qa_entries, product_params)
        
        assert report.total_qa_conflicts > 0
        assert report.total_param_conflicts > 0
        assert report.high_severity_count > 0
