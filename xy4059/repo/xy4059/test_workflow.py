#!/usr/bin/env python3
"""完整工作流测试脚本"""

import sys
import os
import tempfile
from pathlib import Path

sys.path.insert(0, '.')


def main():
    """运行完整工作流测试"""
    with tempfile.TemporaryDirectory() as tmpdir:
        os.chdir(tmpdir)
        print('=' * 60)
        print('完整工作流测试')
        print(f'工作目录: {tmpdir}')
        print('=' * 60)
        
        # 1. 初始化
        print('\n1. 初始化...')
        from beekeeper.config import ConfigManager
        from beekeeper.store import DataStore
        
        cm = ConfigManager(Path(tmpdir) / 'beekeeper.json')
        config = cm.init_config()
        data_store = DataStore(Path(tmpdir) / '.beekeeper_data')
        data_store.initialize()
        print('   ✅ 初始化成功')
        
        # 2. 添加蜂场
        print('\n2. 添加蜂场...')
        config.add_apiary('东山蜂场', '广州从化', '洋槐蜜源')
        config.add_apiary('西山蜂场', '清远', '龙眼蜜源')
        cm.save_config()
        print(f'   ✅ 添加了 {len(config.apiaries)} 个蜂场')
        
        # 3. 添加蜂箱
        print('\n3. 添加蜂箱...')
        config.add_hive('A001', '东山蜂场', 2025, '新王群')
        config.add_hive('A002', '东山蜂场', 2024, '老王群')
        config.add_hive('A003', '东山蜂场', 2023, '老蜂王')
        config.add_hive('B001', '西山蜂场', 2025)
        cm.save_config()
        print(f'   ✅ 添加了 {len(config.hives)} 个蜂箱')
        
        # 4. 添加药物
        print('\n4. 添加药物...')
        config.add_drug('氟胺氰菊酯', 21, '治螨')
        config.add_drug('甲酸', 14, '熏蒸治螨')
        config.add_drug('草酸', 7, '冬季治螨')
        cm.save_config()
        print(f'   ✅ 添加了 {len(config.drugs)} 种药物')
        
        # 5. 导入巡检记录
        print('\n5. 导入巡检记录...')
        from beekeeper.csv_parser import InspectionCSVParser
        from beekeeper.validator import BatchValidator
        
        csv_content = '''date,hive_number,colony_strength,queen_status,pests_diseases,feeding,notes
2026-04-15,A001,强,正常,无,喂糖,春季繁殖良好
2026-04-15,A002,中,正常,少量蜂螨,无,需要关注蜂螨
2026-04-15,A003,弱,停产,无,喂粉,蜂王停产
2026-04-20,A001,强,正常,无,无,群势稳定
2026-04-20,A002,中,正常,蜂螨加重,无,建议用药
'''
        
        csv_path = Path(tmpdir) / 'inspections.csv'
        csv_path.write_text(csv_content)
        
        parser = InspectionCSVParser()
        result = parser.parse(csv_path)
        print(f'   解析: {result.total_rows} 行, 有效 {len(result.valid_records)} 条')
        
        validator = BatchValidator(config, data_store)
        valid_records, errors = validator.validate_inspections(result.valid_records)
        
        imported = 0
        for record in valid_records:
            try:
                data_store.add_inspection(record)
                imported += 1
            except Exception as e:
                print(f'   ⚠️  跳过: {e}')
        
        print(f'   ✅ 成功导入 {imported} 条巡检记录')
        
        # 6. 导入用药记录
        print('\n6. 导入用药记录...')
        from beekeeper.csv_parser import TreatmentCSVParser
        
        csv_content = '''date,hive_number,treatment_type,product_name,dosage,notes
2026-04-10,A001,饲喂,白糖浆,2kg/箱,奖励饲喂
2026-04-18,A002,用药,氟胺氰菊酯,1条/箱,治螨
2026-04-20,A003,饲喂,花粉饼,1块/箱,补充蛋白
2026-04-25,A002,用药,甲酸,5ml/箱,续治螨
'''
        
        csv_path = Path(tmpdir) / 'treatments.csv'
        csv_path.write_text(csv_content)
        
        parser = TreatmentCSVParser()
        result = parser.parse(csv_path)
        print(f'   解析: {result.total_rows} 行, 有效 {len(result.valid_records)} 条')
        
        valid_records, errors = validator.validate_treatments(result.valid_records)
        
        imported = 0
        for record in valid_records:
            try:
                data_store.add_treatment(record)
                imported += 1
            except Exception as e:
                print(f'   ⚠️  跳过: {e}')
        
        print(f'   ✅ 成功导入 {imported} 条用药记录')
        
        # 7. 导入摇蜜记录
        print('\n7. 导入摇蜜记录...')
        from beekeeper.csv_parser import HarvestCSVParser
        from beekeeper.validator import create_quarantine_record
        
        csv_content = '''date,hive_number,batch_number,quantity_kg,moisture_content,notes
2026-05-01,A001,B20260501,12.5,17.8,洋槐蜜
2026-05-01,A003,B20260501,8.2,18.1,洋槐蜜
2026-05-05,A002,B20260505,10.0,18.5,安全间隔内采蜜测试
'''
        
        csv_path = Path(tmpdir) / 'harvests.csv'
        csv_path.write_text(csv_content)
        
        parser = HarvestCSVParser()
        result = parser.parse(csv_path)
        print(f'   解析: {result.total_rows} 行, 有效 {len(result.valid_records)} 条')
        
        valid_records, errors = validator.validate_harvests(result.valid_records)
        
        imported = 0
        for record in valid_records:
            try:
                data_store.add_harvest(record)
                imported += 1
            except Exception as e:
                q_record = create_quarantine_record(
                    record.to_dict(), str(e), 'harvest'
                )
                data_store.add_quarantine(q_record)
                print(f'   ⚠️  隔离: {e}')
        
        print(f'   ✅ 成功导入 {imported} 条摇蜜记录')
        if data_store.count_quarantine() > 0:
            print(f'   ⚠️  隔离区: {data_store.count_quarantine()} 条记录')
        
        # 8. 生成计划
        print('\n8. 生成巡检和采蜜计划...')
        from beekeeper.planner import PlanGenerator
        
        generator = PlanGenerator(config, data_store)
        plan = generator.generate_plan()
        
        print(f'   巡检提醒: {len(plan.inspection_reminders)} 个')
        print(f'   禁采提醒: {len(plan.harvest_restrictions)} 个')
        print(f'   风险蜂箱: {len(plan.risk_hives)} 个')
        
        # 9. 导出报告
        print('\n9. 导出报告...')
        from beekeeper.reporter import Reporter
        
        output_dir = Path(tmpdir) / 'output'
        reporter = Reporter(config, data_store, output_dir)
        report_result = reporter.generate_all_reports()
        
        print(f'   📝 Markdown 报告: {report_result.markdown_path}')
        print(f'   📋 风险箱 CSV: {report_result.csv_risk_path}')
        print(f'   📦 JSON 审计包: {report_result.json_audit_path}')
        
        # 10. 历史查询
        print('\n10. 历史查询测试...')
        history_result = reporter.generate_history_report(hive_number='A001')
        print(f'   箱 A001 巡检记录: {history_result["summary"]["inspection_count"]} 条')
        print(f'   箱 A001 用药记录: {history_result["summary"]["treatment_count"]} 条')
        print(f'   箱 A001 摇蜜记录: {history_result["summary"]["harvest_count"]} 条')
        
        # 最终统计
        print('\n' + '=' * 60)
        print('最终统计')
        print('=' * 60)
        print(f'蜂场: {len(config.apiaries)} 个')
        print(f'蜂箱: {len(config.hives)} 个')
        print(f'药物: {len(config.drugs)} 种')
        print(f'巡检记录: {data_store.count_inspections()} 条')
        print(f'用药记录: {data_store.count_treatments()} 条')
        print(f'摇蜜记录: {data_store.count_harvests()} 条')
        print(f'隔离记录: {data_store.count_quarantine()} 条')
        
        # 验证报告文件存在
        assert Path(report_result.markdown_path).exists(), "Markdown 报告未生成"
        assert Path(report_result.csv_risk_path).exists(), "CSV 报告未生成"
        assert Path(report_result.json_audit_path).exists(), "JSON 审计包未生成"
        
        print('\n✅ 完整工作流测试通过!')
        return 0


if __name__ == '__main__':
    sys.exit(main())
