import pytest
from services.rule_engine import (
    RuleEngine,
    TrenchLayerConsistencyRule,
    EdgeSizeRule,
    TagConflictRule,
    PhotoMissingRule,
    GroupClosureRule,
    DuplicateReferenceRule,
    GroupSizeRule
)
from models import Pottery, SpliceGroup, PotteryGroupAssociation


class TestTrenchLayerConsistencyRule:
    def test_consistent_trench_and_layer(self, app, sample_group):
        with app.app_context():
            group = SpliceGroup.query.filter_by(group_id='SG-TEST-001').first()
            
            rule = TrenchLayerConsistencyRule()
            result = rule.check(group)
            
            assert result.passed is True
            assert len(result.violations) == 0

    def test_inconsistent_layer(self, app):
        with app.app_context():
            pottery1 = Pottery(
                pottery_id='TP-LAYER-001',
                trench='T01',
                layer='L03',
                decoration='绳纹',
                paste_type='夹砂红陶',
                status='pending',
                created_by='test'
            )
            pottery2 = Pottery(
                pottery_id='TP-LAYER-002',
                trench='T01',
                layer='L04',
                decoration='绳纹',
                paste_type='夹砂红陶',
                status='pending',
                created_by='test'
            )
            db.session.add_all([pottery1, pottery2])
            db.session.commit()
            
            group = SpliceGroup(
                group_id='SG-LAYER-TEST',
                name='层位测试组',
                status='draft',
                created_by='test'
            )
            db.session.add(group)
            db.session.flush()
            
            assoc1 = PotteryGroupAssociation(pottery_id=pottery1.id, group_id=group.id)
            assoc2 = PotteryGroupAssociation(pottery_id=pottery2.id, group_id=group.id)
            db.session.add_all([assoc1, assoc2])
            db.session.commit()
            
            rule = TrenchLayerConsistencyRule()
            result = rule.check(group)
            
            assert result.passed is False
            assert len(result.violations) > 0
            assert '层位不一致' in result.violations[0].description

    def test_inconsistent_trench(self, app):
        with app.app_context():
            pottery1 = Pottery(
                pottery_id='TP-TRENCH-001',
                trench='T01',
                layer='L03',
                decoration='绳纹',
                paste_type='夹砂红陶',
                status='pending',
                created_by='test'
            )
            pottery2 = Pottery(
                pottery_id='TP-TRENCH-002',
                trench='T02',
                layer='L03',
                decoration='绳纹',
                paste_type='夹砂红陶',
                status='pending',
                created_by='test'
            )
            db.session.add_all([pottery1, pottery2])
            db.session.commit()
            
            group = SpliceGroup(
                group_id='SG-TRENCH-TEST',
                name='探方测试组',
                status='draft',
                created_by='test'
            )
            db.session.add(group)
            db.session.flush()
            
            assoc1 = PotteryGroupAssociation(pottery_id=pottery1.id, group_id=group.id)
            assoc2 = PotteryGroupAssociation(pottery_id=pottery2.id, group_id=group.id)
            db.session.add_all([assoc1, assoc2])
            db.session.commit()
            
            rule = TrenchLayerConsistencyRule()
            result = rule.check(group)
            
            assert result.passed is False
            assert len(result.violations) > 0


class TestTagConflictRule:
    def test_consistent_tags(self, app, sample_group):
        with app.app_context():
            group = SpliceGroup.query.filter_by(group_id='SG-TEST-001').first()
            
            rule = TagConflictRule()
            result = rule.check(group)
            
            assert result.passed is True

    def test_decoration_conflict(self, app):
        with app.app_context():
            pottery1 = Pottery(
                pottery_id='TP-DEC-001',
                trench='T01',
                layer='L03',
                decoration='绳纹',
                paste_type='夹砂红陶',
                status='pending',
                created_by='test'
            )
            pottery2 = Pottery(
                pottery_id='TP-DEC-002',
                trench='T01',
                layer='L03',
                decoration='篮纹',
                paste_type='夹砂红陶',
                status='pending',
                created_by='test'
            )
            db.session.add_all([pottery1, pottery2])
            db.session.commit()
            
            group = SpliceGroup(
                group_id='SG-DEC-TEST',
                name='纹饰测试组',
                status='draft',
                created_by='test'
            )
            db.session.add(group)
            db.session.flush()
            
            assoc1 = PotteryGroupAssociation(pottery_id=pottery1.id, group_id=group.id)
            assoc2 = PotteryGroupAssociation(pottery_id=pottery2.id, group_id=group.id)
            db.session.add_all([assoc1, assoc2])
            db.session.commit()
            
            rule = TagConflictRule()
            result = rule.check(group)
            
            assert result.passed is False
            assert '纹饰不一致' in result.violations[0].description


class TestPhotoMissingRule:
    def test_photo_exists(self, app, sample_pottery):
        with app.app_context():
            pottery = Pottery.query.filter_by(pottery_id='TP-TEST-001').first()
            
            rule = PhotoMissingRule()
            result = rule.check_pottery(pottery)
            
            assert result.passed is True

    def test_photo_missing(self, app):
        with app.app_context():
            pottery = Pottery(
                pottery_id='TP-NO-PHOTO',
                trench='T01',
                layer='L03',
                decoration='绳纹',
                paste_type='夹砂红陶',
                photo_path=None,
                photo_hash=None,
                status='pending',
                created_by='test'
            )
            db.session.add(pottery)
            db.session.commit()
            
            rule = PhotoMissingRule()
            result = rule.check_pottery(pottery)
            
            assert result.passed is False
            assert '照片缺失' in result.violations[0].description


class TestGroupSizeRule:
    def test_valid_group_size(self, app, sample_group):
        with app.app_context():
            group = SpliceGroup.query.filter_by(group_id='SG-TEST-001').first()
            
            rule = GroupSizeRule()
            result = rule.check(group)
            
            assert result.passed is True

    def test_empty_group(self, app):
        with app.app_context():
            group = SpliceGroup(
                group_id='SG-EMPTY-TEST',
                name='空组测试',
                status='draft',
                created_by='test'
            )
            db.session.add(group)
            db.session.commit()
            
            rule = GroupSizeRule()
            result = rule.check(group)
            
            assert result.passed is False
            assert '拼接组不能为空' in result.violations[0].description


class TestRuleEngine:
    def test_run_all_rules(self, app, sample_group):
        with app.app_context():
            group = SpliceGroup.query.filter_by(group_id='SG-TEST-001').first()
            
            engine = RuleEngine()
            results = engine.run_all_rules(group)
            
            assert 'results' in results
            assert 'summary' in results
            assert results['summary']['total'] > 0

    def test_get_available_rules(self):
        engine = RuleEngine()
        rules = engine.get_available_rules()
        
        assert len(rules) >= 5
        rule_names = [r['name'] for r in rules]
        assert 'TrenchLayerConsistencyRule' in rule_names
        assert 'TagConflictRule' in rule_names
        assert 'PhotoMissingRule' in rule_names


import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import db
