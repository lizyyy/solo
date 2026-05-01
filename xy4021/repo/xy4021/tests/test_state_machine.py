import sys
import os
import tempfile
import sqlite3
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from business.state_machine import (
    PackageStatus, CycleStatus, IndicatorResult,
    StateMachine, StateTransitionError, BusinessRuleError, BusinessRules
)


class TestStateMachine:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
    
    def run(self):
        print('=' * 60)
        print('测试: 状态机和业务规则')
        print('=' * 60)
        
        self._test_valid_transitions()
        self._test_invalid_transitions()
        self._test_validate_release()
        self._test_validate_package_in_cycle()
        self._test_can_add_to_cycle()
        
        print(f'\n结果: {self.passed} 通过, {self.failed} 失败')
        if self.errors:
            print('\n错误详情:')
            for e in self.errors:
                print(f'  - {e}')
        
        return self.failed == 0
    
    def _assert(self, condition, test_name):
        if condition:
            self.passed += 1
            print(f'  [PASS] {test_name}')
        else:
            self.failed += 1
            print(f'  [FAIL] {test_name}')
            self.errors.append(test_name)
    
    def _test_valid_transitions(self):
        valid_transitions = [
            (PackageStatus.PENDING_STERILIZATION.value, PackageStatus.IN_STERILIZATION.value),
            (PackageStatus.PENDING_STERILIZATION.value, PackageStatus.DISCARDED.value),
            (PackageStatus.IN_STERILIZATION.value, PackageStatus.PENDING_RELEASE.value),
            (PackageStatus.IN_STERILIZATION.value, PackageStatus.ISOLATED.value),
            (PackageStatus.PENDING_RELEASE.value, PackageStatus.RELEASED.value),
            (PackageStatus.PENDING_RELEASE.value, PackageStatus.ISOLATED.value),
            (PackageStatus.RELEASED.value, PackageStatus.USED.value),
            (PackageStatus.RELEASED.value, PackageStatus.ISOLATED.value),
            (PackageStatus.ISOLATED.value, PackageStatus.DISCARDED.value),
            (PackageStatus.ISOLATED.value, PackageStatus.PENDING_STERILIZATION.value),
        ]
        
        for from_status, to_status in valid_transitions:
            self._assert(
                StateMachine.can_transition(from_status, to_status),
                f'有效转换: {from_status} -> {to_status}'
            )
    
    def _test_invalid_transitions(self):
        invalid_transitions = [
            (PackageStatus.USED.value, PackageStatus.PENDING_RELEASE.value),
            (PackageStatus.USED.value, PackageStatus.RELEASED.value),
            (PackageStatus.DISCARDED.value, PackageStatus.PENDING_STERILIZATION.value),
            (PackageStatus.RELEASED.value, PackageStatus.IN_STERILIZATION.value),
        ]
        
        for from_status, to_status in invalid_transitions:
            self._assert(
                not StateMachine.can_transition(from_status, to_status),
                f'无效转换: {from_status} -> {to_status} (应该被拒绝)'
            )
        
        try:
            StateMachine.validate_transition(
                PackageStatus.USED.value,
                PackageStatus.PENDING_RELEASE.value
            )
            self._assert(False, '已领用->待放行 应该抛出异常')
        except StateTransitionError:
            self._assert(True, '已领用->待放行 正确抛出异常')
    
    def _test_validate_release(self):
        try:
            BusinessRules.validate_release(
                IndicatorResult.PASS.value,
                IndicatorResult.PASS.value
            )
            self._assert(True, '指示结果都通过时允许放行')
        except BusinessRuleError:
            self._assert(False, '指示结果都通过时应该允许放行')
        
        try:
            BusinessRules.validate_release(
                IndicatorResult.FAIL.value,
                IndicatorResult.PASS.value
            )
            self._assert(False, '生物指示失败时应该拒绝放行')
        except BusinessRuleError:
            self._assert(True, '生物指示失败时正确拒绝放行')
        
        try:
            BusinessRules.validate_release(
                IndicatorResult.PASS.value,
                IndicatorResult.PENDING.value
            )
            self._assert(False, '化学指示缺失时应该拒绝放行')
        except BusinessRuleError:
            self._assert(True, '化学指示缺失时正确拒绝放行')
    
    def _test_validate_package_in_cycle(self):
        try:
            BusinessRules.validate_package_in_active_cycle(
                PackageStatus.PENDING_STERILIZATION.value,
                None
            )
            self._assert(True, '待灭菌状态且无当前锅次时可加入')
        except BusinessRuleError:
            self._assert(False, '待灭菌状态应该允许加入')
        
        try:
            BusinessRules.validate_package_in_active_cycle(
                PackageStatus.IN_STERILIZATION.value,
                1
            )
            self._assert(False, '已在锅次中时应该拒绝')
        except BusinessRuleError:
            self._assert(True, '已在锅次中时正确拒绝')
    
    def _test_can_add_to_cycle(self):
        self._assert(
            BusinessRules.can_add_to_cycle(PackageStatus.PENDING_STERILIZATION.value),
            '待灭菌状态可加入锅次'
        )
        self._assert(
            BusinessRules.can_add_to_cycle(PackageStatus.ISOLATED.value),
            '已隔离状态可加入锅次'
        )
        self._assert(
            not BusinessRules.can_add_to_cycle(PackageStatus.USED.value),
            '已领用状态不可加入锅次'
        )
        self._assert(
            not BusinessRules.can_add_to_cycle(PackageStatus.DISCARDED.value),
            '已报废状态不可加入锅次'
        )
