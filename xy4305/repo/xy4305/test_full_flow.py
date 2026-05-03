"""完整流程测试脚本"""

import os
import sys
import tempfile
import shutil
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from centrifuge_balance.models import (
    Rotor, TubeType, Sample, BalanceConfig
)
from centrifuge_balance.calculator import BalanceCalculator
from centrifuge_balance.csv_handler import CSVHandler
from centrifuge_balance.storage import StorageManager
from centrifuge_balance.report_exporter import MarkdownExporter


def test_full_flow():
    """测试完整工作流程"""
    
    print("=" * 60)
    print("离心机转子配平助手 - 完整功能测试")
    print("=" * 60)
    print("")
    
    test_dir = Path(tempfile.mkdtemp(prefix="centrifuge_test_"))
    print(f"测试数据目录: {test_dir}")
    print("")
    
    try:
        print("1. 测试数据存储...")
        storage = StorageManager(data_dir=str(test_dir))
        
        print("   - 创建测试转子...")
        rotor = Rotor(
            id="test_rotor_12",
            name="测试12孔转子",
            hole_count=12,
            radius_cm=10.0,
            max_rpm=12000,
            description="测试用12孔转子"
        )
        storage.save_rotor(rotor)
        
        print("   - 创建测试管型...")
        tube1 = TubeType(
            id="tube_15ml",
            name="15ml离心管",
            empty_weight_g=1.5,
            max_volume_ml=15.0
        )
        storage.save_tube_type(tube1)
        
        tube2 = TubeType(
            id="tube_50ml",
            name="50ml离心管",
            empty_weight_g=4.0,
            max_volume_ml=50.0
        )
        storage.save_tube_type(tube2)
        
        print("   - 验证数据保存...")
        loaded_rotor = storage.load_rotor("test_rotor_12")
        assert loaded_rotor is not None
        assert loaded_rotor.name == "测试12孔转子"
        
        tubes = storage.list_tube_types()
        assert len(tubes) == 2
        print("   ✅ 数据存储测试通过")
        print("")
        
        print("2. 测试配平计算...")
        
        config = BalanceConfig()
        calculator = BalanceCalculator(config=config)
        
        tube_types = storage.get_tube_types_dict()
        
        print("   - 测试已配平情况...")
        samples_balanced = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=10.0, label="样1"),
            Sample(hole_position=7, tube_type_id="tube_15ml", sample_volume_ml=10.0, label="样2"),
            Sample(hole_position=2, tube_type_id="tube_15ml", sample_volume_ml=5.0, label="样3"),
            Sample(hole_position=8, tube_type_id="tube_15ml", sample_volume_ml=5.0, label="样4"),
        ]
        
        result = calculator.calculate(
            rotor=loaded_rotor,
            samples=samples_balanced,
            tube_types=tube_types,
            run_rpm=10000
        )
        
        assert len(result.validation_errors) == 0
        assert result.is_balanced == True
        assert result.max_mass_imbalance_g == 0.0
        print("   ✅ 已配平计算测试通过")
        
        print("   - 测试未配平情况...")
        samples_imbalanced = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=12.0),
            Sample(hole_position=7, tube_type_id="tube_15ml", sample_volume_ml=8.0),
        ]
        
        result = calculator.calculate(
            rotor=loaded_rotor,
            samples=samples_imbalanced,
            tube_types=tube_types,
            run_rpm=8000
        )
        
        assert len(result.validation_errors) == 0
        assert result.is_balanced == False
        assert result.max_mass_imbalance_g > 0
        assert len(result.adjustment_suggestions) > 0
        print("   ✅ 未配平计算测试通过")
        
        print("   - 测试错误校验...")
        
        print("     * 测试转速超限...")
        result = calculator.calculate(
            rotor=loaded_rotor,
            samples=samples_balanced,
            tube_types=tube_types,
            run_rpm=15000
        )
        rpm_errors = [e for e in result.validation_errors if e.error_type == "转速超限"]
        assert len(rpm_errors) == 1
        print("       ✅ 转速超限校验通过")
        
        print("     * 测试缺孔...")
        samples_missing = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=10.0),
        ]
        result = calculator.calculate(
            rotor=loaded_rotor,
            samples=samples_missing,
            tube_types=tube_types,
            run_rpm=10000
        )
        missing_errors = [e for e in result.validation_errors if e.error_type == "缺孔"]
        assert len(missing_errors) == 1
        print("       ✅ 缺孔校验通过")
        
        print("     * 测试管型不存在...")
        samples_unknown = [
            Sample(hole_position=1, tube_type_id="unknown_tube", sample_volume_ml=10.0),
            Sample(hole_position=7, tube_type_id="tube_15ml", sample_volume_ml=10.0),
        ]
        result = calculator.calculate(
            rotor=loaded_rotor,
            samples=samples_unknown,
            tube_types=tube_types,
            run_rpm=10000
        )
        tube_errors = [e for e in result.validation_errors if e.error_type == "管型不存在"]
        assert len(tube_errors) == 1
        print("       ✅ 管型不存在校验通过")
        
        print("     * 测试体积超限...")
        samples_over = [
            Sample(hole_position=1, tube_type_id="tube_15ml", sample_volume_ml=20.0),
            Sample(hole_position=7, tube_type_id="tube_15ml", sample_volume_ml=10.0),
        ]
        result = calculator.calculate(
            rotor=loaded_rotor,
            samples=samples_over,
            tube_types=tube_types,
            run_rpm=10000
        )
        volume_errors = [e for e in result.validation_errors if e.error_type == "体积超限"]
        assert len(volume_errors) == 1
        print("       ✅ 体积超限校验通过")
        
        print("   ✅ 错误校验测试全部通过")
        print("")
        
        print("3. 测试CSV处理...")
        
        csv_handler = CSVHandler()
        
        print("   - 测试CSV导入...")
        examples_dir = Path(__file__).parent / "examples"
        balanced_csv = examples_dir / "samples_balanced.csv"
        
        if balanced_csv.exists():
            samples, errors = csv_handler.import_samples(str(balanced_csv))
            assert len(errors) == 0
            assert len(samples) > 0
            print("   ✅ CSV导入测试通过")
        else:
            print("   ⚠️  示例CSV文件不存在，跳过导入测试")
        
        print("   - 测试CSV导出...")
        result = calculator.calculate(
            rotor=loaded_rotor,
            samples=samples_balanced,
            tube_types=tube_types,
            run_rpm=10000
        )
        
        output_csv = test_dir / "output_solution.csv"
        errors = csv_handler.export_balance_solution(result, loaded_rotor, tube_types, str(output_csv))
        
        assert len(errors) == 0
        assert output_csv.exists()
        print("   ✅ CSV导出测试通过")
        print("")
        
        print("4. 测试报告导出...")
        
        exporter = MarkdownExporter(config=config)
        
        output_md = test_dir / "output_report.md"
        errors = exporter.export_report(result, loaded_rotor, tube_types, str(output_md))
        
        assert len(errors) == 0
        assert output_md.exists()
        
        with open(output_md, 'r', encoding='utf-8') as f:
            content = f.read()
            assert "配平状态" in content
            assert "已配平" in content
        
        print("   ✅ Markdown报告导出测试通过")
        print("")
        
        print("5. 测试历史记录...")
        
        samples_dict = [s.to_dict() for s in samples_balanced]
        history_id = storage.save_history(result, samples_dict)
        
        assert history_id is not None
        
        history_list = storage.list_history(limit=10)
        assert len(history_list) == 1
        
        loaded_history = storage.load_history(history_id)
        assert loaded_history is not None
        assert loaded_history["id"] == history_id
        
        print("   ✅ 历史记录测试通过")
        print("")
        
        print("=" * 60)
        print("✅ 所有测试通过！")
        print("=" * 60)
        print("")
        print(f"测试输出文件:")
        print(f"  - CSV配平方案: {output_csv}")
        print(f"  - Markdown报告: {output_md}")
        
        print("")
        print("报告内容预览:")
        print("-" * 60)
        with open(output_md, 'r', encoding='utf-8') as f:
            print(f.read()[:1000])
        
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        try:
            shutil.rmtree(test_dir)
        except:
            pass


if __name__ == "__main__":
    test_full_flow()
