import sys
import os
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.test_state_machine import TestStateMachine
from tests.test_dao import TestDAO
from tests.test_import_export import TestImportExport


def run_all_tests():
    print('=' * 60)
    print('器械包追踪系统 - 完整测试套件')
    print('=' * 60)
    print(f'运行时间: {os.popen("date").read().strip()}')
    print()
    
    total_passed = 0
    total_failed = 0
    all_errors = []
    
    tests = [
        ('状态机测试', TestStateMachine),
        ('数据访问层测试', TestDAO),
        ('导入导出测试', TestImportExport),
    ]
    
    for test_name, test_class in tests:
        print(f'\n{test_name}')
        print('-' * 60)
        
        test_instance = test_class()
        success = test_instance.run()
        
        total_passed += test_instance.passed
        total_failed += test_instance.failed
        all_errors.extend([f'{test_name}: {e}' for e in test_instance.errors])
    
    print('\n' + '=' * 60)
    print('测试汇总')
    print('=' * 60)
    print(f'总计: {total_passed + total_failed} 个测试')
    print(f'通过: {total_passed} 个')
    print(f'失败: {total_failed} 个')
    
    if all_errors:
        print(f'\n失败详情 ({len(all_errors)} 个):')
        for i, error in enumerate(all_errors, 1):
            print(f'  {i}. {error}')
    
    print()
    
    return total_failed == 0


def run_self_check():
    print('=' * 60)
    print('器械包追踪系统 - 自检程序')
    print('=' * 60)
    
    import sys
    import os
    
    checks = []
    passed = 0
    failed = 0
    
    print('\n[1] 检查Python版本...')
    version = sys.version_info
    if version.major >= 3 and version.minor >= 6:
        print(f'    ✓ Python {version.major}.{version.minor}.{version.micro}')
        passed += 1
    else:
        print(f'    ✗ Python版本过低，需要3.6+')
        failed += 1
    checks.append(('Python版本', version.major >= 3 and version.minor >= 6))
    
    print('\n[2] 检查必需模块...')
    required_modules = ['sqlite3', 'tkinter', 'csv', 'datetime', 'tempfile', 'shutil']
    for mod in required_modules:
        try:
            __import__(mod)
            print(f'    ✓ {mod}')
            passed += 1
        except ImportError:
            print(f'    ✗ {mod} - 缺失')
            failed += 1
            checks.append((mod, False))
        else:
            checks.append((mod, True))
    
    print('\n[3] 检查项目结构...')
    project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    expected_dirs = ['database', 'business', 'dao', 'gui', 'utils', 'tests']
    expected_files = ['main.py', 'config.py']
    
    for d in expected_dirs:
        dir_path = os.path.join(project_dir, d)
        if os.path.isdir(dir_path):
            print(f'    ✓ 目录: {d}/')
            passed += 1
            checks.append((f'目录 {d}', True))
        else:
            print(f'    ✗ 目录缺失: {d}/')
            failed += 1
            checks.append((f'目录 {d}', False))
    
    for f in expected_files:
        file_path = os.path.join(project_dir, f)
        if os.path.isfile(file_path):
            print(f'    ✓ 文件: {f}')
            passed += 1
            checks.append((f'文件 {f}', True))
        else:
            print(f'    ✗ 文件缺失: {f}')
            failed += 1
            checks.append((f'文件 {f}', False))
    
    print('\n[4] 测试数据库初始化...')
    try:
        from database.connection import DatabaseConnection
        from database.schema import DatabaseSchema
        
        temp_dir = tempfile.mkdtemp()
        db_path = os.path.join(temp_dir, 'self_check.db')
        
        DatabaseConnection.reset_instance()
        DatabaseConnection(db_path)
        DatabaseSchema.initialize()
        
        print(f'    ✓ 数据库初始化成功')
        print(f'    ✓ 表结构创建成功')
        
        from dao.package_template_dao import PackageTemplateDAO
        templates = PackageTemplateDAO.get_all()
        print(f'    ✓ 默认模板数: {len(templates)}')
        
        import shutil
        shutil.rmtree(temp_dir)
        DatabaseConnection.reset_instance()
        
        passed += 4
        checks.append(('数据库初始化', True))
    except Exception as e:
        print(f'    ✗ 数据库初始化失败: {str(e)}')
        failed += 1
        checks.append(('数据库初始化', False))
    
    print('\n' + '=' * 60)
    print('自检结果')
    print('=' * 60)
    print(f'检查项: {len(checks)} 项')
    print(f'通过: {passed} 项')
    print(f'失败: {failed} 项')
    
    if failed == 0:
        print('\n✓ 所有检查通过！系统可以正常运行。')
        print(f'\n运行命令: python {os.path.join(project_dir, "main.py")}')
        return True
    else:
        print('\n✗ 部分检查失败，请检查上述问题。')
        return False


if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='器械包追踪系统 - 测试工具')
    parser.add_argument('--self-check', action='store_true', help='运行自检程序')
    parser.add_argument('--tests', action='store_true', help='运行完整测试套件')
    parser.add_argument('--all', action='store_true', help='运行自检和测试')
    
    args = parser.parse_args()
    
    if not any(vars(args).values()):
        args.all = True
    
    success = True
    
    if args.self_check or args.all:
        if not run_self_check():
            success = False
    
    if args.tests or args.all:
        print('\n\n')
        if not run_all_tests():
            success = False
    
    sys.exit(0 if success else 1)
