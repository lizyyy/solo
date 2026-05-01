import sys
import os
import tempfile
import csv

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database.connection import DatabaseConnection
from database.schema import DatabaseSchema
from dao.package_template_dao import PackageTemplateDAO
from dao.package_dao import PackageDAO
from dao.cycle_dao import CycleDAO
from utils.csv_import_export import CSVImporter, CSVExporter
from utils.report_generator import ReportGenerator
from business.state_machine import PackageStatus, CycleStatus, IndicatorResult


class TestImportExport:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.errors = []
        self.temp_dir = None
    
    def setup(self):
        self.temp_dir = tempfile.mkdtemp()
        db_path = os.path.join(self.temp_dir, 'test.db')
        
        DatabaseConnection.reset_instance()
        DatabaseConnection(db_path)
        
        DatabaseSchema.initialize()
        
        PackageTemplateDAO.create('拔牙包', '拔牙手术用')
        PackageTemplateDAO.create('种植包', '种植手术用')
    
    def teardown(self):
        if self.temp_dir and os.path.exists(self.temp_dir):
            import shutil
            shutil.rmtree(self.temp_dir)
        DatabaseConnection.reset_instance()
    
    def run(self):
        print('=' * 60)
        print('测试: 导入导出和报告')
        print('=' * 60)
        
        try:
            self.setup()
            
            self._test_csv_import()
            self._test_csv_export()
            self._test_report_generation()
            
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
    
    def _test_csv_import(self):
        csv_content = '''package_number,template_name,notes
IMP-001,拔牙包,测试导入1
IMP-002,种植包,测试导入2
IMP-003,拔牙包,
'''
        csv_path = os.path.join(self.temp_dir, 'import_test.csv')
        with open(csv_path, 'w', encoding='utf-8') as f:
            f.write(csv_content)
        
        imported, skipped, errors = CSVImporter.import_packages(csv_path)
        
        self._assert(imported == 3, f'CSV导入: 成功导入 {imported}/3 个')
        self._assert(skipped == 0, f'CSV导入: 跳过 {skipped} 个')
        self._assert(len(errors) == 0, f'CSV导入: 错误数 {len(errors)}')
        
        pkg = PackageDAO.get_by_number('IMP-001')
        self._assert(pkg is not None, 'CSV导入: 验证IMP-001存在')
        self._assert(pkg['template_name'] == '拔牙包', 'CSV导入: 验证模板类型')
        
        csv_content_missing = '''package_number,notes
BAD-001,缺少模板
'''
        bad_path = os.path.join(self.temp_dir, 'bad_import.csv')
        with open(bad_path, 'w', encoding='utf-8') as f:
            f.write(csv_content_missing)
        
        try:
            CSVImporter.import_packages(bad_path)
            self._assert(False, 'CSV导入: 缺少字段应该抛出异常')
        except ValueError:
            self._assert(True, 'CSV导入: 缺少字段时正确抛出异常')
    
    def _test_csv_export(self):
        PackageDAO.create(PackageTemplateDAO.get_by_name('拔牙包')['id'], 'EXP-001')
        PackageDAO.create(PackageTemplateDAO.get_by_name('种植包')['id'], 'EXP-002')
        
        export_path = os.path.join(self.temp_dir, 'export_inventory.csv')
        count = CSVExporter.export_inventory(export_path)
        
        self._assert(count >= 2, f'CSV导出库存: 导出 {count} 条')
        self._assert(os.path.exists(export_path), 'CSV导出库存: 文件已创建')
        
        with open(export_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            rows = list(reader)
            self._assert(len(rows) >= 2, 'CSV导出库存: 验证行数')
            self._assert('package_number' in rows[0], 'CSV导出库存: 验证列名')
        
        cycle_id = CycleDAO.create('EXP-CYCLE-001', 'A1', '测试护士')
        template = PackageTemplateDAO.get_by_name('拔牙包')
        pkg_id = PackageDAO.create(template['id'], 'CYCLE-EXP-001')
        PackageDAO.add_to_cycle(pkg_id, cycle_id)
        CycleDAO.complete_cycle(cycle_id, IndicatorResult.PASS.value, IndicatorResult.PASS.value)
        
        trace_path = os.path.join(self.temp_dir, 'export_trace.csv')
        count = CSVExporter.export_cycle_traceability(trace_path)
        self._assert(count >= 1, f'CSV导出追溯: 导出 {count} 条')
        self._assert(os.path.exists(trace_path), 'CSV导出追溯: 文件已创建')
    
    def _test_report_generation(self):
        template = PackageTemplateDAO.get_by_name('拔牙包')
        PackageDAO.create(template['id'], 'RPT-001')
        PackageDAO.create(template['id'], 'RPT-002')
        
        report = ReportGenerator.generate_inventory_report()
        self._assert(report is not None, '报告生成: 库存报告')
        self._assert('total_packages' in report, '报告生成: 库存报告包含总数')
        self._assert('status_distribution' in report, '报告生成: 库存报告包含状态分布')
        
        text = ReportGenerator.format_report_text(report, '库存报告')
        self._assert(len(text) > 0, '报告生成: 格式化文本')
        self._assert('库存报告' in text, '报告生成: 文本包含标题')
        
        cycle_id = CycleDAO.create('RPT-CYCLE-001', 'A1', '测试护士')
        pkg_id = PackageDAO.create(template['id'], 'RPT-TRACE-001')
        PackageDAO.add_to_cycle(pkg_id, cycle_id)
        CycleDAO.complete_cycle(cycle_id, IndicatorResult.PASS.value, IndicatorResult.PASS.value)
        CycleDAO.release_packages(cycle_id)
        
        trace_report = ReportGenerator.generate_traceability_report(package_number='RPT-TRACE-001')
        self._assert(trace_report is not None, '报告生成: 追溯报告')
        self._assert('package' in trace_report, '报告生成: 追溯报告包含器械包信息')
        self._assert('status_history' in trace_report, '报告生成: 追溯报告包含历史')
        
        failed_cycle_id = CycleDAO.create('RPT-FAILED-001', 'B1', '测试护士')
        fail_pkg_id = PackageDAO.create(template['id'], 'RPT-FAILED-PKG')
        PackageDAO.add_to_cycle(fail_pkg_id, failed_cycle_id)
        CycleDAO.fail_cycle(failed_cycle_id, '测试失败原因')
        
        failed_report = ReportGenerator.generate_failed_cycles_report()
        self._assert(failed_report is not None, '报告生成: 失败锅次报告')
        self._assert('total_failed_cycles' in failed_report, '报告生成: 失败锅次报告包含数量')
        self._assert(failed_report['total_failed_cycles'] >= 1, '报告生成: 验证失败锅次数量')
        
        daily_report = ReportGenerator.generate_daily_summary_report()
        self._assert(daily_report is not None, '报告生成: 每日汇总报告')
        self._assert('report_date' in daily_report, '报告生成: 每日汇总包含日期')
