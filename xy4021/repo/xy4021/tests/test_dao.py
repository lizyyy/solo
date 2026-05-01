import sys
import os
import tempfile
import shutil
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import DatabaseConnection
from database.schema import DatabaseSchema
from dao.package_template_dao import PackageTemplateDAO
from dao.package_dao import PackageDAO
from dao.cycle_dao import CycleDAO
from business.state_machine import (
    PackageStatus, CycleStatus, IndicatorResult, BusinessRuleError
)


class TestDAO:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        self.temp_dir = None
        self.db_path = None
    
    def setup(self):
        self.temp_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.temp_dir, 'test.db')
        
        DatabaseConnection.reset_instance()
        db = DatabaseConnection(self.db_path)
        
        DatabaseSchema.initialize()
        
        PackageTemplateDAO.create('测试拔牙包', '测试用拔牙包')
        PackageTemplateDAO.create('测试种植包', '测试用种植包')
    
    def teardown(self):
        if self.temp_dir and os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
        DatabaseConnection.reset_instance()
    
    def run(self):
        print('=' * 60)
        print('测试: 数据访问层 (DAO)')
        print('=' * 60)
        
        try:
            self.setup()
            
            self._test_package_template_dao()
            self._test_package_crud()
            self._test_cycle_management()
            self._test_package_cycle_flow()
            self._test_failure_isolation()
            
        except Exception as e:
            self.errors.append(f'测试框架错误: {str(e)}')
            self.failed += 1
        finally:
            self.teardown()
        
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
    
    def _test_package_template_dao(self):
        templates = PackageTemplateDAO.get_all()
        self._assert(len(templates) >= 2, '获取所有模板')
        
        template = PackageTemplateDAO.get_by_name('测试拔牙包')
        self._assert(template is not None, '按名称获取模板')
        
        template_id = template['id']
        template2 = PackageTemplateDAO.get_by_id(template_id)
        self._assert(template2 is not None and template2['name'] == '测试拔牙包', '按ID获取模板')
        
        PackageTemplateDAO.update(template_id, description='更新后的描述')
        updated = PackageTemplateDAO.get_by_id(template_id)
        self._assert(updated['description'] == '更新后的描述', '更新模板')
    
    def _test_package_crud(self):
        template = PackageTemplateDAO.get_by_name('测试拔牙包')
        template_id = template['id']
        
        pkg_id = PackageDAO.create(template_id, 'TEST-001', '测试备注')
        self._assert(pkg_id > 0, '创建器械包')
        
        pkg = PackageDAO.get_by_id(pkg_id)
        self._assert(pkg is not None, '按ID获取器械包')
        self._assert(pkg['package_number'] == 'TEST-001', '验证器械包编号')
        self._assert(pkg['status'] == PackageStatus.PENDING_STERILIZATION.value, '验证初始状态')
        
        pkg2 = PackageDAO.get_by_number('TEST-001')
        self._assert(pkg2 is not None and pkg2['id'] == pkg_id, '按编号获取器械包')
        
        all_pkgs = PackageDAO.get_all()
        self._assert(len(all_pkgs) >= 1, '获取所有器械包')
        
        pending = PackageDAO.get_by_status(PackageStatus.PENDING_STERILIZATION.value)
        self._assert(len(pending) >= 1, '按状态获取器械包')
    
    def _test_cycle_management(self):
        cycle_number = CycleDAO.generate_cycle_number()
        self._assert(len(cycle_number) > 0, '生成锅次编号')
        
        cycle_id = CycleDAO.create(
            cycle_number='CYCLE-TEST-001',
            autoclave_id='A1',
            operator='测试护士',
            temperature=121.0,
            pressure=103.0
        )
        self._assert(cycle_id > 0, '创建锅次')
        
        cycle = CycleDAO.get_by_id(cycle_id)
        self._assert(cycle is not None, '按ID获取锅次')
        self._assert(cycle['status'] == CycleStatus.IN_PROGRESS.value, '验证锅次初始状态')
        
        cycle2 = CycleDAO.get_by_number('CYCLE-TEST-001')
        self._assert(cycle2 is not None, '按编号获取锅次')
        
        active = CycleDAO.get_active_cycles()
        self._assert(len(active) >= 1, '获取进行中的锅次')
        
        all_cycles = CycleDAO.get_all()
        self._assert(len(all_cycles) >= 1, '获取所有锅次')
    
    def _test_package_cycle_flow(self):
        template = PackageTemplateDAO.get_by_name('测试拔牙包')
        template_id = template['id']
        
        pkg_id = PackageDAO.create(template_id, 'FLOW-TEST-001')
        pkg = PackageDAO.get_by_id(pkg_id)
        self._assert(pkg['status'] == PackageStatus.PENDING_STERILIZATION.value, '流程测试: 初始状态')
        
        cycle_id = CycleDAO.create(
            cycle_number='FLOW-CYCLE-001',
            autoclave_id='A1',
            operator='测试护士'
        )
        
        result = PackageDAO.add_to_cycle(pkg_id, cycle_id)
        self._assert(result, '流程测试: 加入锅次')
        
        pkg = PackageDAO.get_by_id(pkg_id)
        self._assert(pkg['status'] == PackageStatus.IN_STERILIZATION.value, '流程测试: 灭菌中状态')
        self._assert(pkg['current_cycle_id'] == cycle_id, '流程测试: 关联锅次')
        
        cycle_packages = PackageDAO.get_by_cycle(cycle_id)
        self._assert(len(cycle_packages) == 1, '流程测试: 获取锅次内器械包')
        
        CycleDAO.complete_cycle(
            cycle_id=cycle_id,
            biological_indicator=IndicatorResult.PASS.value,
            chemical_indicator=IndicatorResult.PASS.value,
            operator='测试护士'
        )
        
        pkg = PackageDAO.get_by_id(pkg_id)
        self._assert(pkg['status'] == PackageStatus.PENDING_RELEASE.value, '流程测试: 待放行状态')
        
        cycle = CycleDAO.get_by_id(cycle_id)
        self._assert(cycle['status'] == CycleStatus.COMPLETED.value, '流程测试: 锅次已完成')
        
        released = CycleDAO.release_packages(cycle_id, '测试护士')
        self._assert(released == 1, '流程测试: 放行器械包')
        
        pkg = PackageDAO.get_by_id(pkg_id)
        self._assert(pkg['status'] == PackageStatus.RELEASED.value, '流程测试: 已放行状态')
        
        result = PackageDAO.mark_as_used(pkg_id, '测试护士')
        self._assert(result, '流程测试: 领用器械包')
        
        pkg = PackageDAO.get_by_id(pkg_id)
        self._assert(pkg['status'] == PackageStatus.USED.value, '流程测试: 已领用状态')
        
        history = PackageDAO.get_status_history(pkg_id)
        self._assert(len(history) >= 5, '流程测试: 状态历史记录')
    
    def _test_failure_isolation(self):
        template = PackageTemplateDAO.get_by_name('测试种植包')
        template_id = template['id']
        
        pkg1_id = PackageDAO.create(template_id, 'ISO-TEST-001')
        pkg2_id = PackageDAO.create(template_id, 'ISO-TEST-002')
        
        cycle_id = CycleDAO.create(
            cycle_number='ISO-CYCLE-001',
            autoclave_id='B1',
            operator='测试护士'
        )
        
        PackageDAO.add_to_cycle(pkg1_id, cycle_id)
        PackageDAO.add_to_cycle(pkg2_id, cycle_id)
        
        CycleDAO.fail_cycle(
            cycle_id=cycle_id,
            failure_reason='温度不达标',
            operator='测试护士'
        )
        
        cycle = CycleDAO.get_by_id(cycle_id)
        self._assert(cycle['status'] == CycleStatus.FAILED.value, '失败隔离测试: 锅次标记失败')
        self._assert(cycle['failure_reason'] == '温度不达标', '失败隔离测试: 记录失败原因')
        
        pkg1 = PackageDAO.get_by_id(pkg1_id)
        pkg2 = PackageDAO.get_by_id(pkg2_id)
        
        self._assert(pkg1['status'] == PackageStatus.ISOLATED.value, '失败隔离测试: 器械包1已隔离')
        self._assert(pkg2['status'] == PackageStatus.ISOLATED.value, '失败隔离测试: 器械包2已隔离')
        
        history1 = PackageDAO.get_status_history(pkg1_id)
        has_isolation = any('隔离' in (h['reason'] or '') for h in history1)
        self._assert(has_isolation, '失败隔离测试: 记录隔离原因')
