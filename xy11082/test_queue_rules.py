#!/usr/bin/env python3
import pytest
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Base, QueueEntry, User, Prescription, DecoctionPot, StatusHistory, SamePotGroup
from state_machine import StateMachine, StateTransitionError
from datetime import datetime


class TestQueueRules:
    def setup_method(self):
        self.db = SessionLocal()
        
        self.db.query(StatusHistory).delete()
        self.db.query(SamePotGroup).delete()
        self.db.query(QueueEntry).delete()
        self.db.query(Prescription).delete()
        self.db.query(DecoctionPot).delete()
        self.db.query(User).delete()
        
        self.site_leader = User(username="test_leader", real_name="测试负责人", role="现场负责人")
        self.backend_reviewer = User(username="test_reviewer", real_name="测试复核人", role="后台复核人")
        self.operator = User(username="test_operator", real_name="测试操作员", role="操作员")
        
        self.db.add_all([self.site_leader, self.backend_reviewer, self.operator])
        self.db.flush()
        
        self.prescription = Prescription(
            prescription_no="TEST001",
            patient_name="测试病人",
            patient_age=30,
            patient_gender="男",
            herbal_items='[{"name": "测试药", "dose": "10g"}]',
            total_doses=7,
            decoction_type="常规煎煮",
            submit_source="门诊",
            submitted_by="test_operator",
        )
        self.db.add(self.prescription)
        self.db.flush()
        
        self.pot = DecoctionPot(pot_no="TEST-POT", capacity_liters=20.0, status="空闲")
        self.db.add(self.pot)
        self.db.flush()

    def teardown_method(self):
        self.db.rollback()
        self.db.close()

    def create_queue_entry(self, status="待排队"):
        import uuid
        qe = QueueEntry(
            queue_no=f"DJTEST{uuid.uuid4().hex[:8]}",
            prescription_id=self.prescription.id,
            status=status,
            updated_by="test_operator",
        )
        self.db.add(qe)
        self.db.flush()
        return qe

    def test_rule_R001_status_transition_validation(self):
        print("\n[测试规则 R001] 状态流转验证")
        
        qe = self.create_queue_entry("待排队")
        sm = StateMachine(self.db)
        
        result = sm.transition(qe, "排队登记", "test_leader")
        assert result.status == "已排队", "待排队 → 排队登记 → 已排队 失败"
        print("  ✓ 待排队 → 已排队: 成功")
        
        qe2 = self.create_queue_entry("已完成")
        with pytest.raises(StateTransitionError) as excinfo:
            sm.transition(qe2, "排队登记", "test_leader")
        assert "R003" in str(excinfo.value) or "不可进行任何操作" in str(excinfo.value)
        print("  ✓ 已完成状态无法变更: 成功")
        
        print("  ✓ R001 测试通过")

    def test_rule_R002_role_permission(self):
        print("\n[测试规则 R002] 角色权限验证")
        
        qe = self.create_queue_entry("已排队")
        sm = StateMachine(self.db)
        
        with pytest.raises(StateTransitionError) as excinfo:
            sm.transition(qe, "确认取消", "test_operator")
        assert "R002" in str(excinfo.value)
        print("  ✓ 操作员无法执行确认取消: 成功")
        
        with pytest.raises(StateTransitionError) as excinfo:
            sm.transition(qe, "分配锅次", "test_reviewer")
        assert "R002" in str(excinfo.value)
        print("  ✓ 后台复核人无法执行分配锅次: 成功")
        
        print("  ✓ R002 测试通过")

    def test_rule_R003_R004_terminal_states(self):
        print("\n[测试规则 R003/R004] 终态不可逆转")
        
        qe_completed = self.create_queue_entry("已完成")
        sm = StateMachine(self.db)
        
        with pytest.raises(StateTransitionError) as excinfo:
            sm.transition(qe_completed, "开始煎煮", "test_leader")
        assert "已完成状态不可进行任何操作" in str(excinfo.value)
        print("  ✓ 已完成状态锁定: 成功")
        
        qe_cancelled = self.create_queue_entry("已取消")
        with pytest.raises(StateTransitionError) as excinfo:
            sm.transition(qe_cancelled, "排队登记", "test_leader")
        assert "已取消状态不可进行任何操作" in str(excinfo.value)
        print("  ✓ 已取消状态锁定: 成功")
        
        print("  ✓ R003/R004 测试通过")

    def test_rule_R005_same_pot_cancellation_propagation(self):
        print("\n[测试规则 R005] 同锅合煎取消传播")
        
        group_id = "TEST-GROUP-001"
        
        qe1 = self.create_queue_entry("已排队")
        qe1.is_same_pot = True
        qe1.same_pot_group_id = group_id
        
        qe2 = self.create_queue_entry("已排队")
        qe2.is_same_pot = True
        qe2.same_pot_group_id = group_id
        
        self.db.flush()
        sm = StateMachine(self.db)
        
        sm.transition(qe1, "申请取消", "test_leader", reason="病人放弃治疗")
        
        self.db.refresh(qe2)
        assert qe2.cancellation_requested == True, "同锅处方未标记取消申请"
        assert "同锅合煎组有处方申请取消" in qe2.cancellation_reason
        print("  ✓ 同锅合煎组取消标记同步: 成功")
        
        print("  ✓ R005 测试通过")

    def test_rule_R006_confirm_cancellation_permission(self):
        print("\n[测试规则 R006] 确认取消权限")
        
        qe1 = self.create_queue_entry("已排队")
        qe1.cancellation_requested = True
        qe1.cancellation_requested_by = "test_leader"
        self.db.flush()
        
        sm = StateMachine(self.db)
        
        with pytest.raises(StateTransitionError) as excinfo:
            sm.transition(qe1, "确认取消", "test_leader")
        assert "R002" in str(excinfo.value) or "R006" in str(excinfo.value)
        print("  ✓ 现场负责人无法执行确认取消: 成功")
        
        qe2 = self.create_queue_entry("已排队")
        qe2.cancellation_requested = True
        qe2.cancellation_requested_by = "test_leader"
        self.db.flush()
        
        result = sm.transition(qe2, "确认取消", "test_reviewer")
        assert result.status == "已取消"
        print("  ✓ 后台复核人可以执行确认取消: 成功")
        
        print("  ✓ R006 测试通过")

    def test_rule_R007_exception_handling_permission(self):
        print("\n[测试规则 R007] 异常处理权限")
        
        qe1 = self.create_queue_entry("已排队")
        sm = StateMachine(self.db)
        
        sm.transition(qe1, "标记异常", "test_leader", exception_notes="设备故障")
        self.db.refresh(qe1)
        assert qe1.status == "异常"
        print("  ✓ 现场负责人可以标记异常: 成功")
        
        qe2 = self.create_queue_entry("异常")
        qe2.exception_flag = True
        self.db.flush()
        
        with pytest.raises(StateTransitionError) as excinfo:
            sm.transition(qe2, "处理异常", "test_leader", target_status="已排队")
        assert "R002" in str(excinfo.value) or "R007" in str(excinfo.value)
        print("  ✓ 现场负责人无法处理异常: 成功")
        
        qe3 = self.create_queue_entry("异常")
        qe3.exception_flag = True
        self.db.flush()
        
        result = sm.transition(qe3, "处理异常", "test_reviewer", target_status="已排队")
        assert result.status == "已排队"
        print("  ✓ 后台复核人可以处理异常: 成功")
        
        print("  ✓ R007 测试通过")

    def test_rule_R008_no_cancellation_after_boiling_starts(self):
        print("\n[测试规则 R008] 煎煮开始后不可取消")
        
        qe_boiling = self.create_queue_entry("煎煮中")
        sm = StateMachine(self.db)
        
        with pytest.raises(StateTransitionError) as excinfo:
            sm.transition(qe_boiling, "申请取消", "test_leader", reason="测试")
        assert "R001" in str(excinfo.value) or "R008" in str(excinfo.value)
        print("  ✓ 煎煮中无法直接申请取消: 成功")
        
        qe_completed = self.create_queue_entry("煎煮完成")
        with pytest.raises(StateTransitionError) as excinfo:
            sm.transition(qe_completed, "申请取消", "test_leader", reason="测试")
        assert "R001" in str(excinfo.value) or "R008" in str(excinfo.value)
        print("  ✓ 煎煮完成后无法直接申请取消: 成功")
        
        print("  ✓ R008 测试通过")

    def test_rule_R009_same_pot_status_consistency(self):
        print("\n[测试规则 R009] 同锅状态一致性")
        
        group_id = "TEST-GROUP-002"
        
        qe1 = self.create_queue_entry("已分配锅次")
        qe1.is_same_pot = True
        qe1.same_pot_group_id = group_id
        
        qe2 = self.create_queue_entry("已排队")
        qe2.is_same_pot = True
        qe2.same_pot_group_id = group_id
        
        self.db.flush()
        sm = StateMachine(self.db)
        
        with pytest.raises(StateTransitionError) as excinfo:
            sm.transition(qe1, "开始煎煮", "test_leader")
        assert "R009" in str(excinfo.value) or "同锅合煎组状态不一致" in str(excinfo.value)
        print("  ✓ 同锅组状态不一致时无法流转: 成功")
        
        print("  ✓ R009 测试通过")

    def test_rule_R010_audit_trail_recording(self):
        print("\n[测试规则 R010] 审计追踪记录")
        
        qe = self.create_queue_entry("待排队")
        sm = StateMachine(self.db)
        
        sm.transition(qe, "排队登记", "test_leader", notes="测试备注")
        
        from models import StatusHistory
        history = self.db.query(StatusHistory).filter(
            StatusHistory.queue_entry_id == qe.id
        ).first()
        
        assert history is not None, "未创建状态历史记录"
        assert history.from_status == "待排队"
        assert history.to_status == "已排队"
        assert history.action == "排队登记"
        assert history.performed_by == "test_leader"
        assert history.performed_by_role == "现场负责人"
        assert history.notes == "测试备注"
        assert history.created_at is not None
        print("  ✓ 完整记录操作者、角色、时间、备注: 成功")
        
        print("  ✓ R010 测试通过")

    def test_full_workflow_with_role_separation(self):
        print("\n[完整流程测试] 角色分离协作")
        
        qe = self.create_queue_entry("待排队")
        sm = StateMachine(self.db)
        
        qe.pot_id = self.pot.id
        qe.is_same_pot = False
        
        sm.transition(qe, "排队登记", "test_operator")
        print("  ✓ 操作员: 排队登记")
        
        sm.transition(qe, "分配锅次", "test_leader")
        print("  ✓ 现场负责人: 分配锅次")
        
        sm.transition(qe, "开始煎煮", "test_operator")
        print("  ✓ 操作员: 开始煎煮")
        
        sm.transition(qe, "完成煎煮", "test_operator")
        print("  ✓ 操作员: 完成煎煮")
        
        sm.transition(qe, "开始包装", "test_operator")
        print("  ✓ 操作员: 开始包装")
        
        sm.transition(qe, "完成包装", "test_operator")
        print("  ✓ 操作员: 完成包装")
        
        assert qe.status == "已完成"
        print("  ✓ 完整流程执行成功!")
        
        from models import StatusHistory
        history_count = self.db.query(StatusHistory).filter(
            StatusHistory.queue_entry_id == qe.id
        ).count()
        assert history_count == 6
        print(f"  ✓ 共记录 {history_count} 条状态历史")
        
        print("  ✓ 完整流程测试通过")


def run_tests():
    print("\n" + "=" * 70)
    print("中药代煎房代煎处方排队系统 - 规则验证测试")
    print("=" * 70 + "\n")
    
    tester = TestQueueRules()
    
    test_methods = [
        ("R001 状态流转验证", tester.test_rule_R001_status_transition_validation),
        ("R002 角色权限验证", tester.test_rule_R002_role_permission),
        ("R003/R004 终态锁定", tester.test_rule_R003_R004_terminal_states),
        ("R005 同锅取消传播", tester.test_rule_R005_same_pot_cancellation_propagation),
        ("R006 确认取消权限", tester.test_rule_R006_confirm_cancellation_permission),
        ("R007 异常处理权限", tester.test_rule_R007_exception_handling_permission),
        ("R008 煎煮后不可取消", tester.test_rule_R008_no_cancellation_after_boiling_starts),
        ("R009 同锅状态一致性", tester.test_rule_R009_same_pot_status_consistency),
        ("R010 审计追踪", tester.test_rule_R010_audit_trail_recording),
        ("完整流程测试", tester.test_full_workflow_with_role_separation),
    ]
    
    passed = 0
    failed = 0
    failures = []
    
    for test_name, test_func in test_methods:
        try:
            tester.setup_method()
            test_func()
            passed += 1
        except Exception as e:
            failed += 1
            failures.append((test_name, str(e)))
            print(f"  ✗ {test_name}: 失败 - {e}")
        finally:
            tester.teardown_method()
    
    print("\n" + "=" * 70)
    print(f"测试结果: {passed} 通过, {failed} 失败")
    print("=" * 70)
    
    if failures:
        print("\n失败的测试:")
        for name, error in failures:
            print(f"  - {name}: {error}")
        return False
    else:
        print("\n所有测试通过! ✓")
        return True


if __name__ == "__main__":
    import sample_data
    sample_data.init_sample_data()
    success = run_tests()
    exit(0 if success else 1)
