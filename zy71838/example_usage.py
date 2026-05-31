from mine_repair_manager import MineRepairManager
from models import RecordSource, RecordStatus


def demo_basic_workflow():
    print("=" * 60)
    print("示例1: 基础工作流程 - 从创建到完成")
    print("=" * 60)
    
    manager = MineRepairManager()
    
    balance_data = {
        "unit": "miner",
        "attack": 100,
        "defense": 50,
        "speed": 10
    }
    
    record, is_new = manager.create_record(
        material_data=balance_data,
        source=RecordSource.BALANCE_TABLE,
        created_by="策划A",
        pending_reason="需要验证攻击力数值是否合理"
    )
    
    print(f"创建记录: {record.record_id}")
    print(f"来源: {record.source.value}")
    print(f"状态: {record.status.value}")
    print(f"待处理原因: {record.pending_reason}")
    print(f"创建人: {record.created_by}")
    
    print("\n--- 更新状态为处理中 ---")
    manager.update_status(
        record_id=record.record_id,
        new_status=RecordStatus.PROCESSING,
        operator="策划B",
        reason="开始进行平衡性测试"
    )
    print(f"新状态: {manager.get_record(record.record_id).status.value}")
    
    print("\n--- 记录单位表变更 ---")
    manager.record_unit_table_change(
        record_id=record.record_id,
        unit_id="miner_001",
        field_name="attack",
        old_value=100,
        new_value=120,
        operator="策划B",
        reason="测试发现攻击力不足，提升20%"
    )
    
    changes = manager.get_unit_table_change_history(record.record_id)
    for unit_id, change_list in changes.items():
        print(f"单位 {unit_id} 变更历史:")
        for c in change_list:
            print(f"  {c.timestamp.strftime('%H:%M:%S')} - {c.operator} 修改 {c.field_name}: "
                  f"{c.old_value} -> {c.new_value} ({c.reason})")
    
    print("\n--- 标记为成功 ---")
    manager.update_status(
        record_id=record.record_id,
        new_status=RecordStatus.SUCCESS,
        operator="主策划",
        reason="平衡性测试通过，数值已确认"
    )
    print(f"最终状态: {manager.get_record(record.record_id).status.value}")


def demo_idempotent_handling():
    print("\n" + "=" * 60)
    print("示例2: 幂等处理 - 同一批材料第二次进来")
    print("=" * 60)
    
    manager = MineRepairManager()
    
    test_data = {
        "scenario": "矿洞轨道1-3",
        "wave": 5,
        "units": ["miner", "guardian"]
    }
    
    print("第一次提交材料...")
    record1, is_new1 = manager.create_record(
        material_data=test_data,
        source=RecordSource.TEST_RECORD,
        created_by="测试员A"
    )
    print(f"记录1: {record1.record_id} (新建: {is_new1})")
    
    manager.update_status(
        record_id=record1.record_id,
        new_status=RecordStatus.SUCCESS,
        operator="测试员A",
        reason="测试完成"
    )
    
    print("\n第二次提交相同材料...")
    record2, is_new2 = manager.create_record(
        material_data=test_data,
        source=RecordSource.TEST_RECORD,
        created_by="测试员B"
    )
    print(f"记录2: {record2.record_id} (新建: {is_new2})")
    print(f"是否为同一条记录: {record1.record_id == record2.record_id}")
    print("(不会创建新的成功记录，直接返回已有成功记录)")


def demo_discrepancy_handling():
    print("\n" + "=" * 60)
    print("示例3: 战报和结算不一致处理")
    print("=" * 60)
    
    manager = MineRepairManager()
    
    battle_data = {
        "battle_id": "BT-2024-0531-001",
        "players": ["玩家1", "玩家2"]
    }
    
    record, _ = manager.create_record(
        material_data=battle_data,
        source=RecordSource.BATTLE_REPORT,
        created_by="数据分析师"
    )
    
    print("发现战报和结算不一致...")
    manager.handle_discrepancy(
        record_id=record.record_id,
        source_type=RecordSource.BALANCE_TABLE,
        battle_report_value=1500,
        settlement_value=1200,
        next_owner="数值策划",
        description="战报显示伤害1500，但结算只有1200，差值300",
        operator="数据分析师"
    )
    
    discrepancy = manager.get_record(record.record_id).discrepancy
    print(f"\n不一致信息:")
    print(f"  来源: {discrepancy.source_type.value}")
    print(f"  战报数值: {discrepancy.battle_report_value}")
    print(f"  结算数值: {discrepancy.settlement_value}")
    print(f"  下一步找谁: {discrepancy.next_owner}")
    print(f"  问题描述: {discrepancy.description}")
    print(f"  记录状态: {manager.get_record(record.record_id).status.value}")
    
    print("\n查询所有待澄清的不一致记录:")
    for r in manager.get_discrepancy_records():
        print(f"  - {r.record_id}: 找 {r.discrepancy.next_owner}")


def demo_query_functions():
    print("\n" + "=" * 60)
    print("示例4: 各类查询功能 - 快速定位谁改过")
    print("=" * 60)
    
    manager = MineRepairManager()
    
    data1 = {"unit": "tank", "hp": 500}
    data2 = {"unit": "healer", "heal": 100}
    
    r1, _ = manager.create_record(data1, RecordSource.BALANCE_TABLE, "策划A")
    r2, _ = manager.create_record(data2, RecordSource.TEST_RECORD, "测试员B")
    
    manager.update_status(r1.record_id, RecordStatus.PROCESSING, "策划C", "接手处理")
    manager.update_status(r2.record_id, RecordStatus.SUCCESS, "测试员B", "测试通过")
    
    print(f"按来源查询(BALANCE_TABLE): {len(manager.get_records_by_source(RecordSource.BALANCE_TABLE))} 条")
    print(f"按状态查询(SUCCESS): {len(manager.get_records_by_status(RecordStatus.SUCCESS))} 条")
    print(f"按操作人查询(策划C): {len(manager.get_records_by_operator('策划C'))} 条")
    
    print("\n查看完整历史记录:")
    history = manager.get_full_history(r1.record_id)
    print(f"记录ID: {history['record_id']}")
    print(f"变更次数: {len(history['change_history'])}")
    for c in history['change_history']:
        print(f"  {c['operator']} 修改 {c['field']}: {c['old_value']} -> {c['new_value']} ({c['reason']})")


if __name__ == "__main__":
    demo_basic_workflow()
    demo_idempotent_handling()
    demo_discrepancy_handling()
    demo_query_functions()
    
    print("\n" + "=" * 60)
    print("所有示例运行完成！")
    print("=" * 60)
