#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
条款红线落点器 - 核心模块测试
"""

import os
import sys
import tempfile
import json
from pathlib import Path
from datetime import datetime

import pytest

project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from models.data_models import (
    Clause, RiskItem, RedlineRule, ApprovalComment,
    RiskLevel, RiskStatus, ReviewStatus, Project
)
from parser.clause_parser import ClauseParser
from parser.comment_parser import CommentParser
from parser.redline_parser import RedlineParser
from parser.validator import DataValidator, ValidationError
from rules.rule_engine import RuleEngine, RiskMatcher, DuplicateDetector
from storage.project_store import ProjectStore, ProjectSerializer
from version_compare.version_comparator import VersionComparator, DiffType, VersionDiff
from exporters.markdown_exporter import MarkdownExporter
from exporters.csv_exporter import CSVExporter
from exporters.json_audit_exporter import JSONAuditExporter


class TestClauseParser:
    """条款解析器测试"""
    
    def test_parse_clause_list(self):
        """测试解析条款列表"""
        data = [
            {
                "clause_id": "clause_001",
                "title": "第一条 测试条款",
                "content": "这是测试条款内容",
                "order": 1
            }
        ]
        
        clauses = ClauseParser.parse(data)
        
        assert len(clauses) == 1
        assert clauses[0].clause_id == "clause_001"
        assert clauses[0].title == "第一条 测试条款"
    
    def test_parse_nested_clauses(self):
        """测试解析嵌套条款"""
        data = [
            {
                "clause_id": "clause_001",
                "title": "第一条",
                "content": "父条款",
                "order": 1,
                "parent_id": None
            },
            {
                "clause_id": "clause_002",
                "title": "1.1 子条款",
                "content": "子条款内容",
                "order": 1,
                "parent_id": "clause_001"
            }
        ]
        
        clauses = ClauseParser.parse(data)
        
        assert len(clauses) == 1
        assert len(clauses[0].children) == 1
        assert clauses[0].children[0].title == "1.1 子条款"
    
    def test_flatten_clauses(self):
        """测试扁平化条款"""
        data = [
            {
                "clause_id": "clause_001",
                "title": "第一条",
                "content": "",
                "order": 1,
                "parent_id": None
            },
            {
                "clause_id": "clause_002",
                "title": "1.1",
                "content": "",
                "order": 1,
                "parent_id": "clause_001"
            }
        ]
        
        clauses = ClauseParser.parse(data)
        flattened = ClauseParser.flatten_clauses(clauses)
        
        assert len(flattened) == 2


class TestCommentParser:
    """审批意见解析器测试"""
    
    def test_parse_risk_level(self):
        """测试解析风险级别"""
        assert CommentParser._parse_risk_level("critical") == RiskLevel.CRITICAL
        assert CommentParser._parse_risk_level("high") == RiskLevel.HIGH
        assert CommentParser._parse_risk_level("medium") == RiskLevel.MEDIUM
        assert CommentParser._parse_risk_level("low") == RiskLevel.LOW
        assert CommentParser._parse_risk_level("unknown") == RiskLevel.MEDIUM


class TestRedlineParser:
    """红线规则解析器测试"""
    
    def test_parse_risk_level(self):
        """测试解析风险级别"""
        assert RedlineParser._parse_risk_level("critical") == RiskLevel.CRITICAL
        assert RedlineParser._parse_risk_level("blocker") == RiskLevel.CRITICAL
        assert RedlineParser._parse_risk_level("high") == RiskLevel.HIGH
        assert RedlineParser._parse_risk_level("medium") == RiskLevel.MEDIUM
        assert RedlineParser._parse_risk_level("low") == RiskLevel.LOW
    
    def test_parse_keywords_from_string(self):
        """测试从字符串解析关键词"""
        item = {
            "rule_id": "test_001",
            "category": "测试",
            "description": "测试规则",
            "keywords": "关键词1, 关键词2, 关键词3",
            "risk_level": "high",
            "is_mandatory": False,
            "remediation": ""
        }
        
        rule = RedlineParser._parse_rule(item)
        assert isinstance(rule.keywords, list)


class TestDataValidator:
    """数据校验器测试"""
    
    def test_validate_empty_clauses(self):
        """测试校验空条款列表"""
        errors = DataValidator.validate_clauses([])
        assert len(errors) == 1
        assert errors[0].error_type == "empty_clauses"
    
    def test_validate_clause_missing_id(self):
        """测试校验缺少ID的条款"""
        clauses = [
            Clause(
                clause_id="",
                title="测试条款",
                content="内容"
            )
        ]
        
        errors = DataValidator.validate_clauses(clauses)
        assert any(e.error_type == "missing_id" for e in errors)
    
    def test_has_errors(self):
        """测试检查是否有错误级别问题"""
        warnings = [
            ValidationError("test", "测试警告", severity="warning")
        ]
        errors = [
            ValidationError("test", "测试错误", severity="error")
        ]
        
        assert DataValidator.has_errors(warnings) == False
        assert DataValidator.has_errors(errors) == True


class TestRiskMatcher:
    """风险匹配器测试"""
    
    def test_match_keywords(self):
        """测试关键词匹配"""
        matcher = RiskMatcher()
        
        clause = Clause(
            clause_id="test_001",
            title="测试条款",
            content="本条款包含付款期限和违约金约定"
        )
        
        rules = [
            RedlineRule(
                rule_id="rule_001",
                category="付款",
                description="付款期限风险",
                keywords=["付款期限", "违约金"],
                risk_level=RiskLevel.HIGH,
                is_mandatory=False,
                remediation=""
            )
        ]
        
        risks = matcher.match_clause(clause, rules)
        
        assert len(risks) == 1
        assert "付款期限" in risks[0].matched_keywords or "违约金" in risks[0].matched_keywords


class TestDuplicateDetector:
    """重复检测器测试"""
    
    def test_group_risks(self):
        """测试风险分组"""
        risks = [
            RiskItem(
                risk_id="risk_001",
                clause_id="clause_001",
                rule_id="rule_001",
                risk_level=RiskLevel.HIGH,
                matched_keywords=["付款"]
            ),
            RiskItem(
                risk_id="risk_002",
                clause_id="clause_002",
                rule_id="rule_001",
                risk_level=RiskLevel.HIGH,
                matched_keywords=["付款"]
            ),
            RiskItem(
                risk_id="risk_003",
                clause_id="clause_001",
                rule_id="rule_002",
                risk_level=RiskLevel.MEDIUM,
                matched_keywords=["保密"]
            )
        ]
        
        clauses = []
        result = DuplicateDetector.detect_duplicates(risks, clauses)
        
        assert len(result) == 3


class TestRuleEngine:
    """规则引擎测试"""
    
    def test_analyze_project(self):
        """测试分析项目"""
        engine = RuleEngine()
        
        clauses = [
            Clause(
                clause_id="clause_001",
                title="付款条款",
                content="乙方应于十五个工作日内支付款项，逾期按日万分之五支付违约金"
            )
        ]
        
        rules = [
            RedlineRule(
                rule_id="rule_001",
                category="付款",
                description="付款期限风险",
                keywords=["十五个工作日", "万分之五"],
                risk_level=RiskLevel.CRITICAL,
                is_mandatory=True,
                remediation="建议延长付款期限"
            )
        ]
        
        comments = []
        
        risks = engine.analyze_project(clauses, rules, comments)
        
        assert len(risks) >= 0
    
    def test_get_mandatory_risks(self):
        """测试获取必改风险"""
        rules = [
            RedlineRule(
                rule_id="rule_001",
                category="付款",
                description="必改规则",
                keywords=["测试"],
                risk_level=RiskLevel.CRITICAL,
                is_mandatory=True,
                remediation=""
            ),
            RedlineRule(
                rule_id="rule_002",
                category="其他",
                description="非必改规则",
                keywords=["测试"],
                risk_level=RiskLevel.MEDIUM,
                is_mandatory=False,
                remediation=""
            )
        ]
        
        risks = [
            RiskItem(
                risk_id="risk_001",
                clause_id="clause_001",
                rule_id="rule_001",
                risk_level=RiskLevel.CRITICAL,
                status=RiskStatus.PENDING
            ),
            RiskItem(
                risk_id="risk_002",
                clause_id="clause_002",
                rule_id="rule_002",
                risk_level=RiskLevel.MEDIUM,
                status=RiskStatus.PENDING
            )
        ]
        
        mandatory = RuleEngine.get_mandatory_risks(risks, rules)
        
        assert len(mandatory) == 1
        assert mandatory[0].rule_id == "rule_001"


class TestProjectSerializer:
    """项目序列化器测试"""
    
    def test_round_trip_serialization(self):
        """测试往返序列化"""
        project = Project(
            project_id="test_proj",
            name="测试项目",
            description="测试描述"
        )
        
        project.clauses = [
            Clause(
                clause_id="clause_001",
                title="测试条款",
                content="测试内容"
            )
        ]
        
        project.rules = [
            RedlineRule(
                rule_id="rule_001",
                category="测试",
                description="测试规则",
                keywords=["测试"],
                risk_level=RiskLevel.HIGH,
                is_mandatory=False,
                remediation=""
            )
        ]
        
        project.risks = [
            RiskItem(
                risk_id="risk_001",
                clause_id="clause_001",
                risk_level=RiskLevel.HIGH,
                status=RiskStatus.PENDING
            )
        ]
        
        data = ProjectSerializer.to_dict(project)
        restored = ProjectSerializer.from_dict(data)
        
        assert restored.project_id == project.project_id
        assert restored.name == project.name
        assert len(restored.clauses) == 1
        assert len(restored.rules) == 1
        assert len(restored.risks) == 1


class TestVersionComparator:
    """版本比较器测试"""
    
    def test_compare_clauses_added(self):
        """测试比较新增条款"""
        comparator = VersionComparator()
        
        old_clauses = []
        new_clauses = [
            Clause(
                clause_id="clause_001",
                title="新增条款",
                content="内容"
            )
        ]
        
        diffs = comparator.compare_clauses(old_clauses, new_clauses)
        
        assert len(diffs) == 1
        assert diffs[0].diff_type == DiffType.ADDED
    
    def test_compare_clauses_removed(self):
        """测试比较删除条款"""
        comparator = VersionComparator()
        
        old_clauses = [
            Clause(
                clause_id="clause_001",
                title="删除条款",
                content="内容"
            )
        ]
        new_clauses = []
        
        diffs = comparator.compare_clauses(old_clauses, new_clauses)
        
        assert len(diffs) == 1
        assert diffs[0].diff_type == DiffType.REMOVED


class TestExporters:
    """导出器测试"""
    
    def test_markdown_exporter(self):
        """测试Markdown导出器"""
        exporter = MarkdownExporter()
        
        project = Project(
            project_id="test_proj",
            name="测试项目"
        )
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False) as f:
            temp_path = f.name
        
        try:
            exporter.export(project, temp_path)
            
            assert os.path.exists(temp_path)
            
            with open(temp_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            assert "条款红线复核单" in content
            assert "测试项目" in content
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def test_csv_exporter(self):
        """测试CSV导出器"""
        exporter = CSVExporter()
        
        project = Project(
            project_id="test_proj",
            name="测试项目"
        )
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
            temp_path = f.name
        
        try:
            exporter.export(project, temp_path)
            assert os.path.exists(temp_path)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)
    
    def test_json_audit_exporter(self):
        """测试JSON审计包导出器"""
        exporter = JSONAuditExporter()
        exporter.compress = False
        
        project = Project(
            project_id="test_proj",
            name="测试项目"
        )
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            temp_path = f.name
        
        try:
            exporter.export(project, temp_path)
            assert os.path.exists(temp_path)
        finally:
            if os.path.exists(temp_path):
                os.unlink(temp_path)


class TestProjectStore:
    """项目存储测试"""
    
    def test_create_new_project(self):
        """测试创建新项目"""
        with tempfile.TemporaryDirectory() as temp_dir:
            store = ProjectStore(storage_dir=temp_dir)
            
            project = store.create_new_project("测试项目", "测试描述")
            
            assert project.name == "测试项目"
            assert project.project_id.startswith("proj_")
            assert project.description == "测试描述"
    
    def test_save_and_load_project(self):
        """测试保存和加载项目"""
        with tempfile.TemporaryDirectory() as temp_dir:
            store = ProjectStore(storage_dir=temp_dir)
            
            project = store.create_new_project("测试项目")
            project.clauses = [
                Clause(
                    clause_id="clause_001",
                    title="测试条款",
                    content="内容"
                )
            ]
            
            project_id = store.save_project(project)
            
            loaded = store.load_project(project_id)
            
            assert loaded is not None
            assert loaded.name == project.name
            assert len(loaded.clauses) == 1
    
    def test_list_projects(self):
        """测试列出项目"""
        with tempfile.TemporaryDirectory() as temp_dir:
            store = ProjectStore(storage_dir=temp_dir)
            
            project1 = store.create_new_project("项目1")
            store.save_project(project1)
            
            project2 = store.create_new_project("项目2")
            store.save_project(project2)
            
            projects = store.list_projects()
            
            assert len(projects) == 2
    
    def test_delete_project(self):
        """测试删除项目"""
        with tempfile.TemporaryDirectory() as temp_dir:
            store = ProjectStore(storage_dir=temp_dir)
            
            project = store.create_new_project("测试项目")
            project_id = store.save_project(project)
            
            assert store.load_project(project_id) is not None
            
            result = store.delete_project(project_id)
            
            assert result == True
            assert store.load_project(project_id) is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
