#!/usr/bin/env python3
# 集成测试：模拟完整工作流

import tempfile
import os
from pathlib import Path

def main():
    # 1. 创建临时目录
    tmp_dir = tempfile.mkdtemp()
    print(f'临时目录: {tmp_dir}')
    original_dir = os.getcwd()
    os.chdir(tmp_dir)

    try:
        # 2. 测试 ConfigManager
        from dmx_patch_validator.config import ConfigManager
        cm = ConfigManager(tmp_dir)
        assert not cm.is_initialized()
        project = cm.init_project('测试巡演项目', universe_count=2)
        assert cm.is_initialized()
        print(f'✓ 项目初始化成功: {project.config.project_name}')

        # 3. 测试 Fixture 和 Validator
        from dmx_patch_validator.models import Fixture, PatchEntry, Severity
        from dmx_patch_validator.validator import Validator

        # 创建有冲突的灯具
        f1 = Fixture(
            id='PAR001', manufacturer='Martin', model='MAC Aura', mode='8通道',
            universe=1, start_address=1, custom_channel_count=8, position='吊杆1'
        )
        f2 = Fixture(
            id='PAR002', manufacturer='Martin', model='MAC Aura', mode='8通道',
            universe=1, start_address=5, custom_channel_count=8, position='吊杆1'
        )
        f3 = Fixture(
            id='PAR003', manufacturer='ClayPaky', model='Sharpy', mode='16通道',
            universe=1, start_address=20, custom_channel_count=16, position='吊杆2'
        )

        # 测试重叠检测
        assert f1.overlaps_with(f2) == True
        assert f1.overlaps_with(f3) == False
        print('✓ 灯具重叠检测正常')

        # 测试 Validator
        validator = Validator()
        result = validator.validate([f1, f2, f3], [], max_universe=2)
        print(f'✓ 校验完成: {result.critical_count} 个严重错误, {result.warning_count} 个警告')
        assert result.critical_count >= 1

        # 4. 测试 AddressPlanner
        from dmx_patch_validator.planner import AddressPlanner
        planner = AddressPlanner()
        plan_result = planner.plan_rearrangement([f1, f2, f3], [], max_universe=2)
        print(f'✓ 规划完成: {plan_result.summary}')
        assert len(plan_result.actions) > 0

        # 5. 测试 Exporter
        from dmx_patch_validator.exporter import Exporter
        export_path = Path(tmp_dir) / 'test_export.csv'
        Exporter.export_fixtures_to_csv([f1, f2, f3], str(export_path))
        assert export_path.exists()
        print(f'✓ CSV导出成功: {export_path}')

        # 6. 测试 HistoryManager
        from dmx_patch_validator.history import HistoryManager
        hm = HistoryManager(cm)
        record = hm.record_import('测试导入', 'test.csv', 3, '集成测试')
        print(f'✓ 历史记录创建成功: {record.id}')

        history_list = hm.list_history(limit=5)
        assert len(history_list) >= 1
        print(f'✓ 历史记录查询成功: {len(history_list)} 条记录')

        # 7. 测试 Parser (用刚才导出的CSV)
        from dmx_patch_validator.parser import CSVParser
        parser = CSVParser(cm)
        parsed_fixtures = parser.parse_fixtures(str(export_path))
        assert len(parsed_fixtures) == 3
        print(f'✓ CSV解析成功: {len(parsed_fixtures)} 个灯具')

        print()
        print('='*50)
        print('所有集成测试通过！')
        print(f'临时目录: {tmp_dir}')
        print('='*50)
        
        return 0
        
    except Exception as e:
        print(f'✗ 测试失败: {e}')
        import traceback
        traceback.print_exc()
        return 1
    finally:
        os.chdir(original_dir)


if __name__ == '__main__':
    exit(main())
