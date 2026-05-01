import pytest

from src.customs_inspector.rule_engine import RuleEngine
from src.customs_inspector.models import (
    ManifestItem, PackingItem, DeclarationRule,
    ValidationErrorType, RiskLevel
)


class TestRuleEngine:
    
    def test_validate_missing_hs_code(self):
        rules = [
            DeclarationRule(
                rule_id='DUMMY',
                rule_name='Dummy',
                rule_type='validation'
            )
        ]
        
        engine = RuleEngine(rules)
        
        item = ManifestItem(
            ticket_no='TKT001',
            container_no='MSKU1234567',
            description='测试商品',
            hs_code=None,
            weight=1000.0,
            volume=10.0
        )
        
        errors = engine.validate_manifest_item(item)
        
        missing_hs_errors = [e for e in errors if e.error_type == ValidationErrorType.MISSING_HS_CODE]
        assert len(missing_hs_errors) == 1
        assert missing_hs_errors[0].risk_level == RiskLevel.HIGH
    
    def test_validate_missing_weight(self):
        rules = [
            DeclarationRule(
                rule_id='DUMMY',
                rule_name='Dummy',
                rule_type='validation'
            )
        ]
        
        engine = RuleEngine(rules)
        
        item = ManifestItem(
            ticket_no='TKT001',
            container_no='MSKU1234567',
            description='测试商品',
            hs_code='3926.9090',
            weight=None,
            volume=10.0
        )
        
        errors = engine.validate_manifest_item(item)
        
        missing_weight_errors = [e for e in errors if e.error_type == ValidationErrorType.MISSING_WEIGHT]
        assert len(missing_weight_errors) == 1
    
    def test_validate_missing_container(self):
        rules = [
            DeclarationRule(
                rule_id='DUMMY',
                rule_name='Dummy',
                rule_type='validation'
            )
        ]
        
        engine = RuleEngine(rules)
        
        item = ManifestItem(
            ticket_no='TKT001',
            container_no='',
            description='测试商品',
            hs_code='3926.9090',
            weight=1000.0,
            volume=10.0
        )
        
        errors = engine.validate_manifest_item(item)
        
        missing_container_errors = [e for e in errors if e.error_type == ValidationErrorType.MISSING_CONTAINER_NO]
        assert len(missing_container_errors) == 1
    
    def test_validate_prohibited_item(self):
        rules = [
            DeclarationRule(
                rule_id='PROHIBIT_001',
                rule_name='禁止象牙',
                rule_type='prohibited',
                conditions={
                    'hs_codes': ['9601*'],
                    'keywords': ['象牙']
                },
                risk_level=RiskLevel.CRITICAL
            )
        ]
        
        engine = RuleEngine(rules)
        
        item = ManifestItem(
            ticket_no='TKT001',
            container_no='MSKU1234567',
            description='象牙雕刻品',
            hs_code='9601.1000',
            weight=100.0,
            volume=1.0
        )
        
        errors = engine.validate_manifest_item(item)
        
        prohibited_errors = [e for e in errors if e.error_type == ValidationErrorType.PROHIBITED_ITEM]
        assert len(prohibited_errors) == 1
        assert prohibited_errors[0].risk_level == RiskLevel.CRITICAL
    
    def test_validate_restricted_item(self):
        rules = [
            DeclarationRule(
                rule_id='RESTRICT_001',
                rule_name='限制化工品',
                rule_type='restricted',
                conditions={
                    'hs_codes': ['3808*'],
                    'keywords': ['化工']
                },
                required_certificates=['危险化学品许可证', 'MSDS报告'],
                risk_level=RiskLevel.HIGH
            )
        ]
        
        engine = RuleEngine(rules)
        
        item = ManifestItem(
            ticket_no='TKT001',
            container_no='MSKU1234567',
            description='化工原料',
            hs_code='3808.91',
            weight=500.0,
            volume=3.0
        )
        
        errors = engine.validate_manifest_item(item)
        
        restricted_errors = [e for e in errors if e.error_type == ValidationErrorType.RESTRICTED_ITEM]
        assert len(restricted_errors) == 1
        assert restricted_errors[0].risk_level == RiskLevel.HIGH
        assert '危险化学品许可证' in restricted_errors[0].metadata.get('required_certificates', [])
    
    def test_generate_correction_task(self):
        rules = [
            DeclarationRule(
                rule_id='DUMMY',
                rule_name='Dummy',
                rule_type='validation'
            )
        ]
        
        engine = RuleEngine(rules)
        
        from src.customs_inspector.models import ValidationError
        
        error = ValidationError(
            error_type=ValidationErrorType.MISSING_HS_CODE,
            message='HS编码缺失',
            ticket_no='TKT001',
            container_no='MSKU1234567',
            risk_level=RiskLevel.HIGH
        )
        
        task = engine.generate_correction_task(error, 1)
        
        assert task.task_id == 'TASK-0001'
        assert task.task_type == '补全HS编码'
        assert task.ticket_no == 'TKT001'
        assert task.container_no == 'MSKU1234567'
        assert task.risk_level == RiskLevel.HIGH
        assert task.priority == 2
