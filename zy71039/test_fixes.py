import unittest
import hashlib
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services import (
    calculate_cluster_key, 
    is_valid_status_transition,
    VALID_STATUS_TRANSITIONS
)
from database import WorkOrderStatusEnum


class TestClusterKeyStability(unittest.TestCase):
    """测试位置描述归并键的稳定性"""
    
    def test_md5_hash_stability(self):
        """验证 MD5 哈希在多次调用中结果一致"""
        desc = "西屋顶通风管旁"
        hash1 = hashlib.md5(desc.strip().upper().encode('utf-8')).hexdigest()[:8]
        hash2 = hashlib.md5(desc.strip().upper().encode('utf-8')).hexdigest()[:8]
        hash3 = hashlib.md5(desc.strip().upper().encode('utf-8')).hexdigest()[:8]
        
        self.assertEqual(hash1, hash2)
        self.assertEqual(hash2, hash3)
        print(f"✅ MD5 哈希稳定: {hash1}")
    
    def test_cluster_key_stability_same_desc(self):
        """相同位置描述应生成相同的归并键"""
        key1 = calculate_cluster_key(None, None, "西屋顶通风管旁", 1)
        key2 = calculate_cluster_key(None, None, "西屋顶通风管旁", 1)
        key3 = calculate_cluster_key(None, None, "  西屋顶通风管旁  ", 1)
        
        self.assertEqual(key1, key2)
        self.assertEqual(key1, key3)
        print(f"✅ 归并键稳定: {key1}")
    
    def test_cluster_key_stability_case_insensitive(self):
        """大小写不影响归并键"""
        key1 = calculate_cluster_key(None, None, "West Roof Pipe", 1)
        key2 = calculate_cluster_key(None, None, "west roof pipe", 1)
        
        self.assertEqual(key1, key2)
        print(f"✅ 大小写不敏感: {key1}")
    
    def test_cluster_key_different_desc(self):
        """不同描述应生成不同归并键"""
        key1 = calculate_cluster_key(None, None, "位置A", 1)
        key2 = calculate_cluster_key(None, None, "位置B", 1)
        
        self.assertNotEqual(key1, key2)
        print(f"✅ 不同描述生成不同键: {key1} vs {key2}")
    
    def test_geo_cluster_key_stability(self):
        """经纬度归并键稳定性测试"""
        key1 = calculate_cluster_key(31.2304, 121.4737, None, 1)
        key2 = calculate_cluster_key(31.23041, 121.47371, None, 1)
        key3 = calculate_cluster_key(31.2304, 121.4737, None, 1)
        
        self.assertEqual(key1, key3)
        print(f"✅ 经纬度归并键稳定: {key1}")


class TestStatusMachineValidation(unittest.TestCase):
    """测试状态机流转校验"""
    
    def test_valid_transitions(self):
        """测试所有合法的状态流转"""
        valid_transitions = [
            (None, WorkOrderStatusEnum.PENDING),
            (WorkOrderStatusEnum.PENDING, WorkOrderStatusEnum.CONFIRMED),
            (WorkOrderStatusEnum.PENDING, WorkOrderStatusEnum.REJECTED),
            (WorkOrderStatusEnum.PENDING, WorkOrderStatusEnum.CLOSED),
            (WorkOrderStatusEnum.CONFIRMED, WorkOrderStatusEnum.IN_PROGRESS),
            (WorkOrderStatusEnum.CONFIRMED, WorkOrderStatusEnum.REJECTED),
            (WorkOrderStatusEnum.CONFIRMED, WorkOrderStatusEnum.CLOSED),
            (WorkOrderStatusEnum.IN_PROGRESS, WorkOrderStatusEnum.PENDING_RETEST),
            (WorkOrderStatusEnum.IN_PROGRESS, WorkOrderStatusEnum.REJECTED),
            (WorkOrderStatusEnum.IN_PROGRESS, WorkOrderStatusEnum.CLOSED),
            (WorkOrderStatusEnum.PENDING_RETEST, WorkOrderStatusEnum.PASSED),
            (WorkOrderStatusEnum.PENDING_RETEST, WorkOrderStatusEnum.IN_PROGRESS),
            (WorkOrderStatusEnum.PENDING_RETEST, WorkOrderStatusEnum.REJECTED),
            (WorkOrderStatusEnum.PENDING_RETEST, WorkOrderStatusEnum.CLOSED),
            (WorkOrderStatusEnum.PASSED, WorkOrderStatusEnum.CLOSED),
            (WorkOrderStatusEnum.PASSED, WorkOrderStatusEnum.IN_PROGRESS),
            (WorkOrderStatusEnum.REJECTED, WorkOrderStatusEnum.PENDING),
            (WorkOrderStatusEnum.REJECTED, WorkOrderStatusEnum.CONFIRMED),
            (WorkOrderStatusEnum.REJECTED, WorkOrderStatusEnum.CLOSED),
        ]
        
        for from_status, to_status in valid_transitions:
            self.assertTrue(
                is_valid_status_transition(from_status, to_status),
                f"流转应该合法: {from_status} -> {to_status}"
            )
        print(f"✅ 所有 {len(valid_transitions)} 个合法流转验证通过")
    
    def test_invalid_transitions(self):
        """测试非法的状态流转应被拒绝"""
        invalid_transitions = [
            (None, WorkOrderStatusEnum.CONFIRMED),
            (WorkOrderStatusEnum.PENDING, WorkOrderStatusEnum.IN_PROGRESS),
            (WorkOrderStatusEnum.PENDING, WorkOrderStatusEnum.PASSED),
            (WorkOrderStatusEnum.CONFIRMED, WorkOrderStatusEnum.PASSED),
            (WorkOrderStatusEnum.IN_PROGRESS, WorkOrderStatusEnum.PASSED),
            (WorkOrderStatusEnum.PENDING_RETEST, WorkOrderStatusEnum.CONFIRMED),
            (WorkOrderStatusEnum.PASSED, WorkOrderStatusEnum.PENDING),
            (WorkOrderStatusEnum.REJECTED, WorkOrderStatusEnum.IN_PROGRESS),
            (WorkOrderStatusEnum.CLOSED, WorkOrderStatusEnum.PENDING),
            (WorkOrderStatusEnum.CLOSED, WorkOrderStatusEnum.CONFIRMED),
        ]
        
        for from_status, to_status in invalid_transitions:
            self.assertFalse(
                is_valid_status_transition(from_status, to_status),
                f"流转应该非法: {from_status} -> {to_status}"
            )
        print(f"✅ 所有 {len(invalid_transitions)} 个非法流转验证通过")
    
    def test_closed_state_terminal(self):
        """已结案状态不能再流转到任何状态"""
        for status in WorkOrderStatusEnum:
            self.assertFalse(
                is_valid_status_transition(WorkOrderStatusEnum.CLOSED, status),
                f"已结案状态不应允许流转到: {status}"
            )
        print("✅ 已结案状态为终态验证通过")
    
    def test_print_status_diagram(self):
        """打印状态机图供参考"""
        print("\n📋 状态机流转图:")
        for from_state, to_states in VALID_STATUS_TRANSITIONS.items():
            from_name = from_state.value if from_state else "初始"
            to_names = [s.value for s in to_states] if to_states else ["(无)"]
            print(f"  {from_name} -> {', '.join(to_names)}")


def run_all_tests():
    print("=" * 60)
    print("修复验证测试")
    print("=" * 60)
    
    print("\n🔍 测试 1: 位置描述归并键稳定性")
    print("-" * 60)
    suite1 = unittest.TestLoader().loadTestsFromTestCase(TestClusterKeyStability)
    runner = unittest.TextTestRunner(verbosity=2)
    result1 = runner.run(suite1)
    
    print("\n🔍 测试 2: 状态机流转校验")
    print("-" * 60)
    suite2 = unittest.TestLoader().loadTestsFromTestCase(TestStatusMachineValidation)
    result2 = runner.run(suite2)
    
    print("\n" + "=" * 60)
    print("测试总结")
    print("=" * 60)
    
    total_tests = result1.testsRun + result2.testsRun
    total_failures = len(result1.failures) + len(result2.failures)
    total_errors = len(result1.errors) + len(result2.errors)
    
    print(f"总测试数: {total_tests}")
    print(f"失败: {total_failures}")
    print(f"错误: {total_errors}")
    
    if total_failures == 0 and total_errors == 0:
        print("\n✅ 所有测试通过！")
        return True
    else:
        print("\n❌ 部分测试失败！")
        return False


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
