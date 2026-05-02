import pytest
from services.state_machine import (
    PotteryStateMachine,
    GroupStateMachine,
    PotteryStatus,
    GroupStatus
)
from models import Pottery, SpliceGroup


class TestPotteryStateMachine:
    def test_initial_state(self, app):
        with app.app_context():
            pottery = Pottery(
                pottery_id='TP-SM-001',
                trench='T01',
                layer='L03',
                decoration='绳纹',
                paste_type='夹砂红陶',
                status='pending',
                created_by='test'
            )
            db.session.add(pottery)
            db.session.commit()
            
            sm = PotteryStateMachine()
            assert sm.get_current_state(pottery) == PotteryStatus.PENDING

    def test_valid_transition_pending_to_under_review(self, app):
        with app.app_context():
            pottery = Pottery(
                pottery_id='TP-SM-002',
                trench='T01',
                layer='L03',
                decoration='绳纹',
                paste_type='夹砂红陶',
                status='pending',
                created_by='test'
            )
            db.session.add(pottery)
            db.session.commit()
            
            sm = PotteryStateMachine()
            
            result = sm.transition(pottery, 'start_review', user='test_user')
            
            assert result['success'] is True
            assert pottery.status == PotteryStatus.UNDER_REVIEW

    def test_valid_transition_under_review_to_approved(self, app):
        with app.app_context():
            pottery = Pottery(
                pottery_id='TP-SM-003',
                trench='T01',
                layer='L03',
                decoration='绳纹',
                paste_type='夹砂红陶',
                status='under_review',
                created_by='test'
            )
            db.session.add(pottery)
            db.session.commit()
            
            sm = PotteryStateMachine()
            
            result = sm.transition(pottery, 'approve', user='test_user', notes='复核通过')
            
            assert result['success'] is True
            assert pottery.status == PotteryStatus.APPROVED

    def test_valid_transition_under_review_to_rejected(self, app):
        with app.app_context():
            pottery = Pottery(
                pottery_id='TP-SM-004',
                trench='T01',
                layer='L03',
                decoration='绳纹',
                paste_type='夹砂红陶',
                status='under_review',
                created_by='test'
            )
            db.session.add(pottery)
            db.session.commit()
            
            sm = PotteryStateMachine()
            
            result = sm.transition(pottery, 'reject', user='test_user', notes='层位存疑')
            
            assert result['success'] is True
            assert pottery.status == PotteryStatus.REJECTED

    def test_invalid_transition_pending_to_approved(self, app):
        with app.app_context():
            pottery = Pottery(
                pottery_id='TP-SM-005',
                trench='T01',
                layer='L03',
                decoration='绳纹',
                paste_type='夹砂红陶',
                status='pending',
                created_by='test'
            )
            db.session.add(pottery)
            db.session.commit()
            
            sm = PotteryStateMachine()
            
            result = sm.transition(pottery, 'approve', user='test_user')
            
            assert result['success'] is False
            assert '不允许的状态转换' in result['message']
            assert pottery.status == PotteryStatus.PENDING

    def test_available_actions(self, app):
        with app.app_context():
            pottery = Pottery(
                pottery_id='TP-SM-006',
                trench='T01',
                layer='L03',
                decoration='绳纹',
                paste_type='夹砂红陶',
                status='pending',
                created_by='test'
            )
            db.session.add(pottery)
            db.session.commit()
            
            sm = PotteryStateMachine()
            actions = sm.get_available_actions(pottery)
            
            assert 'start_review' in actions
            assert 'archive' in actions
            assert 'approve' not in actions

    def test_get_state_flow(self):
        sm = PotteryStateMachine()
        flow = sm.get_state_flow()
        
        assert 'initial' in flow
        assert 'transitions' in flow
        assert len(flow['transitions']) > 0


class TestGroupStateMachine:
    def test_initial_state(self, app):
        with app.app_context():
            group = SpliceGroup(
                group_id='SG-SM-001',
                name='状态机测试组',
                status='draft',
                created_by='test'
            )
            db.session.add(group)
            db.session.commit()
            
            sm = GroupStateMachine()
            assert sm.get_current_state(group) == GroupStatus.DRAFT

    def test_valid_transition_draft_to_submitted(self, app):
        with app.app_context():
            group = SpliceGroup(
                group_id='SG-SM-002',
                name='状态机测试组',
                status='draft',
                created_by='test'
            )
            db.session.add(group)
            db.session.commit()
            
            sm = GroupStateMachine()
            
            result = sm.transition(group, 'submit', user='test_user')
            
            assert result['success'] is True
            assert group.status == GroupStatus.SUBMITTED

    def test_valid_transition_submitted_to_under_review(self, app):
        with app.app_context():
            group = SpliceGroup(
                group_id='SG-SM-003',
                name='状态机测试组',
                status='submitted',
                created_by='test'
            )
            db.session.add(group)
            db.session.commit()
            
            sm = GroupStateMachine()
            
            result = sm.transition(group, 'start_review', user='test_user')
            
            assert result['success'] is True
            assert group.status == GroupStatus.UNDER_REVIEW

    def test_valid_transition_submitted_to_withdrawn(self, app):
        with app.app_context():
            group = SpliceGroup(
                group_id='SG-SM-004',
                name='状态机测试组',
                status='submitted',
                created_by='test'
            )
            db.session.add(group)
            db.session.commit()
            
            sm = GroupStateMachine()
            
            result = sm.transition(group, 'withdraw', user='test_user', notes='需要补充数据')
            
            assert result['success'] is True
            assert group.status == GroupStatus.WITHDRAWN

    def test_valid_transition_under_review_to_approved(self, app):
        with app.app_context():
            group = SpliceGroup(
                group_id='SG-SM-005',
                name='状态机测试组',
                status='under_review',
                created_by='test'
            )
            db.session.add(group)
            db.session.commit()
            
            sm = GroupStateMachine()
            
            result = sm.transition(group, 'approve', user='reviewer', notes='复核通过')
            
            assert result['success'] is True
            assert group.status == GroupStatus.APPROVED
            assert group.reviewed_by == 'reviewer'
            assert group.review_result == 'approved'

    def test_invalid_transition_draft_to_approved(self, app):
        with app.app_context():
            group = SpliceGroup(
                group_id='SG-SM-006',
                name='状态机测试组',
                status='draft',
                created_by='test'
            )
            db.session.add(group)
            db.session.commit()
            
            sm = GroupStateMachine()
            
            result = sm.transition(group, 'approve', user='test_user')
            
            assert result['success'] is False
            assert group.status == GroupStatus.DRAFT

    def test_available_actions(self, app):
        with app.app_context():
            group = SpliceGroup(
                group_id='SG-SM-007',
                name='状态机测试组',
                status='draft',
                created_by='test'
            )
            db.session.add(group)
            db.session.commit()
            
            sm = GroupStateMachine()
            actions = sm.get_available_actions(group)
            
            assert 'submit' in actions
            assert 'archive' in actions
            assert 'approve' not in actions

    def test_get_state_flow(self):
        sm = GroupStateMachine()
        flow = sm.get_state_flow()
        
        assert 'initial' in flow
        assert 'transitions' in flow
        assert 'states' in flow
        assert len(flow['transitions']) > 0


class TestStatusEnums:
    def test_pottery_status_values(self):
        assert PotteryStatus.PENDING == 'pending'
        assert PotteryStatus.UNDER_REVIEW == 'under_review'
        assert PotteryStatus.APPROVED == 'approved'
        assert PotteryStatus.REJECTED == 'rejected'
        assert PotteryStatus.ARCHIVED == 'archived'

    def test_group_status_values(self):
        assert GroupStatus.DRAFT == 'draft'
        assert GroupStatus.SUBMITTED == 'submitted'
        assert GroupStatus.UNDER_REVIEW == 'under_review'
        assert GroupStatus.APPROVED == 'approved'
        assert GroupStatus.REJECTED == 'rejected'
        assert GroupStatus.WITHDRAWN == 'withdrawn'
        assert GroupStatus.ARCHIVED == 'archived'


import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import db
