#!/usr/bin/env python3
import json
import shutil
from pathlib import Path
from contract_tool.processor import ContractProcessor
from contract_tool.storage import Storage
from contract_tool.demo_data import DemoDataGenerator


def cleanup_data():
    for dir_name in ['data/submissions', 'data/results', 'data/failures', 'data/receipts']:
        dir_path = Path(dir_name)
        if dir_path.exists():
            shutil.rmtree(dir_path)
        dir_path.mkdir(parents=True, exist_ok=True)
    print("已清理测试数据目录")


def test_scenario_1_first_submission():
    print("\n=== 场景1: 首次提交 ===")
    cleanup_data()
    
    generator = DemoDataGenerator()
    batch = generator.get_demo_batch(include_error=False)
    contract = batch[0]  # CTR2024000
    
    processor = ContractProcessor()
    result = processor.process_submission(contract)
    
    print(f"合同ID: {contract['contract_id']}")
    print(f"处理状态: {result.status}")
    print(f"是否复用: {result.is_reused}")
    
    assert result.status == 'verified', f"预期verified，实际{result.status}"
    assert result.is_reused == False, "首次提交不应复用"
    print("✓ 场景1通过: 首次提交正常通过")


def test_scenario_2_exact_duplicate():
    print("\n=== 场景2: 完全相同内容再次提交 ===")
    cleanup_data()
    
    generator = DemoDataGenerator()
    batch = generator.get_demo_batch(include_error=False)
    contract = batch[0]
    
    processor = ContractProcessor()
    result1 = processor.process_submission(contract)
    result2 = processor.process_submission(contract)
    
    print(f"合同ID: {contract['contract_id']}")
    print(f"首次提交状态: {result1.status}")
    print(f"再次提交状态: {result2.status}")
    print(f"是否复用: {result2.is_reused}")
    
    assert result1.status == 'verified'
    assert result2.status == 'verified'
    assert result2.is_reused == True, "完全相同内容应该复用旧结论"
    print("✓ 场景2通过: 完全相同内容再次提交成功复用")


def test_scenario_3_modified_contract():
    print("\n=== 场景3: 同一合同ID但内容有变更（修改乙方） ===")
    cleanup_data()
    
    generator = DemoDataGenerator()
    batch = generator.get_demo_batch(include_error=False)
    contract_original = batch[0].copy()
    
    processor = ContractProcessor()
    result1 = processor.process_submission(contract_original)
    
    contract_modified = contract_original.copy()
    contract_modified['party_b'] = "新的乙方公司"
    contract_modified['batch_id'] = "BATCH_NEW_001"
    
    result2 = processor.process_submission(contract_modified)
    
    print(f"合同ID: {contract_original['contract_id']}")
    print(f"首次提交状态: {result1.status}")
    print(f"变更后提交状态: {result2.status}")
    print(f"是否复用: {result2.is_reused}")
    print(f"错误信息: {result2.error_message}")
    if result2.details:
        print(f"内容差异: {json.dumps(result2.details.get('content_differences', {}), ensure_ascii=False, indent=2)}")
    
    assert result1.status == 'verified'
    assert result2.status == 'conflict', f"内容变更应该返回冲突，实际{result2.status}"
    assert result2.is_reused == False, "内容变更不应复用"
    assert 'content_differences' in result2.details, "应该返回内容差异详情"
    print("✓ 场景3通过: 同一合同ID但内容变更时正确返回冲突，不误判为复用")


def test_scenario_4_modified_supplements():
    print("\n=== 场景4: 同一合同ID但补充页有变更 ===")
    cleanup_data()
    
    generator = DemoDataGenerator()
    batch = generator.get_demo_batch(include_error=False)
    contract_original = batch[1].copy()
    
    processor = ContractProcessor()
    result1 = processor.process_submission(contract_original)
    
    contract_modified = contract_original.copy()
    supplements = contract_modified['supplements'].copy()
    supplements[0]['content'] = "修改后的补充协议内容"
    contract_modified['supplements'] = supplements
    
    result2 = processor.process_submission(contract_modified)
    
    print(f"合同ID: {contract_original['contract_id']}")
    print(f"首次提交状态: {result1.status}")
    print(f"补充页变更后提交状态: {result2.status}")
    print(f"是否复用: {result2.is_reused}")
    if result2.details:
        print(f"内容差异: {json.dumps(result2.details.get('content_differences', {}), ensure_ascii=False, indent=2)}")
    
    assert result1.status == 'verified'
    assert result2.status == 'conflict', f"补充页变更应该返回冲突，实际{result2.status}"
    assert result2.is_reused == False, "补充页变更不应复用"
    print("✓ 场景4通过: 补充页变更时正确返回冲突")


def test_scenario_5_batch_id_change():
    print("\n=== 场景5: 同一合同ID同一内容但批次ID不同 ===")
    cleanup_data()
    
    generator = DemoDataGenerator()
    batch = generator.get_demo_batch(include_error=False)
    contract_original = batch[2].copy()
    
    processor = ContractProcessor()
    result1 = processor.process_submission(contract_original)
    
    contract_new_batch = contract_original.copy()
    contract_new_batch['batch_id'] = "BATCH_DIFFERENT_ID"
    
    result2 = processor.process_submission(contract_new_batch)
    
    print(f"合同ID: {contract_original['contract_id']}")
    print(f"原始批次ID: {contract_original['batch_id']}")
    print(f"新批次ID: {contract_new_batch['batch_id']}")
    print(f"首次提交状态: {result1.status}")
    print(f"新批次提交状态: {result2.status}")
    print(f"是否复用: {result2.is_reused}")
    
    assert result1.status == 'verified'
    assert result2.status == 'conflict', f"批次ID变更应视为冲突"
    assert result2.is_reused == False
    print("✓ 场景5通过: 批次ID变更时正确返回冲突")


if __name__ == '__main__':
    print("=" * 60)
    print("重复提交处理逻辑测试")
    print("=" * 60)
    
    try:
        test_scenario_1_first_submission()
        test_scenario_2_exact_duplicate()
        test_scenario_3_modified_contract()
        test_scenario_4_modified_supplements()
        test_scenario_5_batch_id_change()
        
        print("\n" + "=" * 60)
        print("✓ 所有测试场景通过！")
        print("=" * 60)
    except AssertionError as e:
        print(f"\n✗ 测试失败: {e}")
        exit(1)
    except Exception as e:
        print(f"\n✗ 发生异常: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
