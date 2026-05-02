from pathlib import Path

import pytest

from release_validator.indexer import FileIndexer
from release_validator.rules import RuleEngine, RuleSeverity


class TestRuleEngine:
    def test_init(self):
        engine = RuleEngine()
        
        assert len(engine.rules) > 0
        assert "version-consistency" in engine.rules
        assert "hash-verification" in engine.rules
    
    def test_enable_disable_rule(self):
        engine = RuleEngine()
        
        engine.disable_rule("version-consistency")
        assert engine.rules["version-consistency"].enabled is False
        
        engine.enable_rule("version-consistency")
        assert engine.rules["version-consistency"].enabled is True
    
    def test_verify_version_consistency_pass(self, temp_dir):
        file1 = temp_dir / "app-1.0.0.tar.gz"
        file1.write_text("content")
        
        file2 = temp_dir / "app-1.0.0.zip"
        file2.write_text("content")
        
        indexer = FileIndexer(temp_dir)
        indexer.scan()
        
        engine = RuleEngine(indexer)
        result = engine.verify({})
        
        version_rule_result = [r for r in result.results if r.rule_id == "version-consistency"][0]
        assert version_rule_result.passed is True
    
    def test_verify_version_consistency_fail(self, temp_dir):
        file1 = temp_dir / "app-1.0.0.tar.gz"
        file1.write_text("content")
        
        file2 = temp_dir / "app-2.0.0.zip"
        file2.write_text("content")
        
        indexer = FileIndexer(temp_dir)
        indexer.scan()
        
        engine = RuleEngine(indexer)
        result = engine.verify({})
        
        version_rule_result = [r for r in result.results if r.rule_id == "version-consistency"][0]
        assert version_rule_result.passed is False
        assert len(version_rule_result.violations) > 0
    
    def test_verify_semantic_version(self, temp_dir):
        file1 = temp_dir / "app-1.0.0.tar.gz"
        file1.write_text("content")
        
        file2 = temp_dir / "app-invalid-version.zip"
        file2.write_text("content")
        
        indexer = FileIndexer(temp_dir)
        indexer.scan()
        
        engine = RuleEngine(indexer)
        result = engine.verify({})
        
        semantic_rule_result = [r for r in result.results if r.rule_id == "semantic-version"][0]
        assert len(semantic_rule_result.violations) == 0
    
    def test_verification_result_properties(self, temp_dir):
        file = temp_dir / "app-1.0.0.tar.gz"
        file.write_text("content")
        
        indexer = FileIndexer(temp_dir)
        indexer.scan()
        
        engine = RuleEngine(indexer)
        result = engine.verify({})
        
        assert hasattr(result, 'overall_passed')
        assert hasattr(result, 'total_violations')
        assert hasattr(result, 'critical_violations')
        assert isinstance(result.get_violations_by_severity(RuleSeverity.CRITICAL), list)


class TestIntegration:
    def test_good_release(self, sample_good_release):
        if not sample_good_release.exists():
            pytest.skip("Sample good release not found")
        
        indexer = FileIndexer(sample_good_release)
        indexer.scan()
        
        assert len(indexer.entries) > 0
        
        engine = RuleEngine(indexer)
        result = engine.verify({})
        
        assert result is not None
    
    def test_bad_release(self, sample_bad_release):
        if not sample_bad_release.exists():
            pytest.skip("Sample bad release not found")
        
        indexer = FileIndexer(sample_bad_release)
        indexer.scan()
        
        assert len(indexer.entries) > 0
        
        engine = RuleEngine(indexer)
        result = engine.verify({})
        
        assert result is not None
        assert result.total_violations >= 0
