import pytest
from pathlib import Path
from litigation_precheck.rules import RuleEngine, Issue, CheckResult, QuarantineManager, Severity, IssueType


class TestRuleEngine:
    def test_check_required_materials(self):
        material_types_config = [
            {"code": "COMPLAINT", "name": "起诉状", "required": True},
            {"code": "POA", "name": "授权委托书", "required": True},
            {"code": "EVIDENCE", "name": "证据材料", "required": True},
        ]
        
        rule_engine = RuleEngine({
            "check_rules": {},
            "material_types": material_types_config,
            "naming_rules": []
        })
        
        scanned_files = [
            {"material_type": "COMPLAINT", "file_name": "起诉状.pdf"},
        ]
        
        issues = rule_engine.check_required_materials(scanned_files, material_types_config)
        
        assert len(issues) == 2
        
        missing_types = {i.details.get("material_type") for i in issues}
        assert "POA" in missing_types
        assert "EVIDENCE" in missing_types
    
    def test_check_required_materials_passed(self):
        material_types_config = [
            {"code": "COMPLAINT", "name": "起诉状", "required": True},
            {"code": "POA", "name": "授权委托书", "required": True},
        ]
        
        rule_engine = RuleEngine({
            "check_rules": {},
            "material_types": material_types_config,
            "naming_rules": []
        })
        
        scanned_files = [
            {"material_type": "COMPLAINT", "file_name": "起诉状.pdf"},
            {"material_type": "POA", "file_name": "授权委托书.pdf"},
        ]
        
        issues = rule_engine.check_required_materials(scanned_files, material_types_config)
        
        assert len(issues) == 0
    
    def test_check_signature_pages(self):
        material_types_config = [
            {
                "code": "COMPLAINT", 
                "name": "起诉状", 
                "requires_signature": True,
                "signature_pages": [-1]
            },
        ]
        
        rule_engine = RuleEngine({
            "check_rules": {},
            "material_types": material_types_config,
            "naming_rules": []
        })
        
        scanned_files = [
            {"material_type": "COMPLAINT", "file_name": "起诉状.pdf", "file_path": "起诉状.pdf"},
        ]
        
        issues = rule_engine.check_signature_pages(scanned_files)
        
        assert len(issues) == 1
        assert issues[0].issue_type == IssueType.MISSING_SIGNATURE_MARK.value
    
    def test_check_signature_pages_with_mark(self):
        material_types_config = [
            {
                "code": "COMPLAINT", 
                "name": "起诉状", 
                "requires_signature": True,
                "signature_pages": [-1]
            },
        ]
        
        rule_engine = RuleEngine({
            "check_rules": {},
            "material_types": material_types_config,
            "naming_rules": []
        })
        
        scanned_files = [
            {"material_type": "COMPLAINT", "file_name": "起诉状_签名.pdf", "file_path": "起诉状_签名.pdf"},
        ]
        
        issues = rule_engine.check_signature_pages(scanned_files)
        
        assert len(issues) == 0
    
    def test_check_duplicate_hash(self):
        rule_engine = RuleEngine({
            "check_rules": {},
            "material_types": [],
            "naming_rules": []
        })
        
        scanned_files = [
            {"file_hash": "abc123", "file_name": "file1.pdf", "file_path": "file1.pdf"},
            {"file_hash": "abc123", "file_name": "file2.pdf", "file_path": "file2.pdf"},
            {"file_hash": "def456", "file_name": "file3.pdf", "file_path": "file3.pdf"},
        ]
        
        issues = rule_engine.check_duplicate_hash(scanned_files)
        
        assert len(issues) == 1
        assert issues[0].issue_type == IssueType.DUPLICATE_HASH.value
    
    def test_check_page_range(self):
        rule_engine = RuleEngine({
            "check_rules": {"max_pages_per_file": 100},
            "material_types": [],
            "naming_rules": []
        })
        
        scanned_files = [
            {"file_name": "file1.pdf", "file_path": "file1.pdf", "page_count": 150},
            {"file_name": "file2.pdf", "file_path": "file2.pdf", "page_count": 50},
        ]
        
        issues = rule_engine.check_page_range(scanned_files)
        
        assert len(issues) == 1
        assert "150 页" in issues[0].message
    
    def test_check_naming_convention(self):
        material_types_config = [
            {
                "code": "COMPLAINT", 
                "name": "起诉状",
                "naming_pattern": r"起诉状.*\.(pdf|PDF)$"
            },
        ]
        
        rule_engine = RuleEngine({
            "check_rules": {},
            "material_types": material_types_config,
            "naming_rules": []
        })
        
        scanned_files = [
            {"material_type": "COMPLAINT", "file_name": "wrong_name.txt", "file_path": "wrong_name.txt"},
        ]
        
        issues = rule_engine.check_naming_convention(scanned_files)
        
        assert len(issues) == 1
        assert issues[0].issue_type == IssueType.INVALID_NAMING.value
    
    def test_run_all_checks_valid(self):
        material_types_config = [
            {"code": "COMPLAINT", "name": "起诉状", "required": True},
            {"code": "POA", "name": "授权委托书", "required": True},
        ]
        
        rule_engine = RuleEngine({
            "check_rules": {
                "check_required_materials": True,
                "check_signature_pages": False,
                "check_duplicate_hash": True,
                "check_page_range": True,
                "check_naming_convention": False,
            },
            "material_types": material_types_config,
            "naming_rules": []
        })
        
        scanned_files = [
            {"material_type": "COMPLAINT", "file_name": "起诉状.pdf", "file_path": "起诉状.pdf", "file_hash": "abc123", "page_count": 2},
            {"material_type": "POA", "file_name": "授权委托书.pdf", "file_path": "授权委托书.pdf", "file_hash": "def456", "page_count": 1},
        ]
        
        result = rule_engine.run_all_checks(scanned_files, material_types_config, None)
        
        assert result.is_valid
        assert result.error_count == 0
        assert len(result.passed_files) == 2


class TestQuarantineManager:
    def test_save_load_quarantine(self, tmp_path):
        check_result = CheckResult(
            is_valid=True,
            total_issues=0,
            error_count=0,
            warning_count=0,
            info_count=0,
            issues=[],
            passed_files=["file1.pdf", "file2.pdf"],
            failed_files=[],
            check_time="2024-01-01T00:00:00"
        )
        
        quarantine_path = tmp_path / "quarantine.json"
        
        QuarantineManager.save_quarantine(
            check_result,
            quarantine_path,
            {"total_files": 2, "total_size": 100},
            None
        )
        
        loaded = QuarantineManager.load_quarantine(quarantine_path)
        
        assert "check_result" in loaded
        assert loaded["check_result"]["is_valid"] == True
        assert len(loaded["check_result"]["passed_files"]) == 2
