#!/usr/bin/env python3
"""测试会展设备租赁管理系统功能"""

import sys
sys.path.insert(0, '.')

from src.database import SessionLocal, init_db
from src.models import Equipment, OperationRecord, AuditLog
from src.services import EquipmentService, OperationService
from src.schemas import (
    ImportOperation,
    OccupyOperation,
    TransferOperation,
    ReturnOperation,
    LossOperation,
    QueryFilter,
    RoleType
)

def test_system():
    print("=" * 60)
    print("开始测试会展设备租赁管理系统")
    print("=" * 60)

    # 初始化数据库
    init_db()
    db = SessionLocal()

    try:
        # 1. 测试创建设备
        print("\n1. 测试创建设备")
        print("-" * 40)
        try:
            equipment = EquipmentService.create(
                db, "TRUSS001", "400mm铝合金桁架", "TRUSS", 100, "根"
            )
            print(f"✓ 创建设备成功: {equipment.code} - {equipment.name}")
            print(f"  总数量: {equipment.total_quantity}, 可用数量: {equipment.available_quantity}")
        except Exception as e:
            print(f"设备已存在，跳过创建: {e}")

        # 创建第二个设备
        try:
            equipment2 = EquipmentService.create(
                db, "LIGHT001", "LED帕灯", "LIGHT", 50, "台"
            )
            print(f"✓ 创建设备成功: {equipment2.code} - {equipment2.name}")
        except Exception as e:
            print(f"设备已存在，跳过创建")

        # 2. 测试导入设备
        print("\n2. 测试导入设备")
        print("-" * 40)
        import_data = ImportOperation(
            request_id="IMP_TEST_001",
            equipment_code="TRUSS001",
            quantity=50,
            operator="张三",
            role=RoleType.MANAGER,
            remark="测试导入"
        )
        result = OperationService.handle_import(db, import_data)
        if result.get("success"):
            print(f"✓ 导入成功: {result}")
        else:
            print(f"导入结果: {result}")

        # 3. 测试幂等性 - 重复导入
        print("\n3. 测试幂等性 - 重复导入")
        print("-" * 40)
        result_dup = OperationService.handle_import(db, import_data)
        if result_dup.get("duplicate"):
            print("✓ 幂等性验证通过: 重复请求返回原有记录")
        else:
            print(f"幂等性测试结果: {result_dup}")

        # 4. 测试占用设备
        print("\n4. 测试占用设备")
        print("-" * 40)
        occupy_data = OccupyOperation(
            request_id="OCC_TEST_001",
            equipment_code="TRUSS001",
            quantity=20,
            operator="张三",
            role=RoleType.MANAGER,
            booth="A1",
            remark="A1展位占用"
        )
        result_occ = OperationService.handle_occupy(db, occupy_data)
        if result_occ.get("success"):
            print(f"✓ 占用成功: 剩余可用数量 = {result_occ.get('remaining_available')}")
        else:
            print(f"占用结果: {result_occ}")

        # 5. 测试库存不足
        print("\n5. 测试库存不足场景")
        print("-" * 40)
        occupy_data2 = OccupyOperation(
            request_id="OCC_TEST_002",
            equipment_code="TRUSS001",
            quantity=200,  # 超过可用数量
            operator="李四",
            role=RoleType.OPERATOR,
            booth="A2"
        )
        result_occ2 = OperationService.handle_occupy(db, occupy_data2)
        if not result_occ2.get("success") and result_occ2.get("exception_type") == "insufficient_stock":
            print("✓ 库存不足校验通过: 正确返回异常类型")
        else:
            print(f"库存不足测试结果: {result_occ2}")

        # 6. 测试调拨设备
        print("\n6. 测试调拨设备")
        print("-" * 40)
        transfer_data = TransferOperation(
            request_id="TRA_TEST_001",
            equipment_code="TRUSS001",
            quantity=5,
            operator="张三",
            role=RoleType.MANAGER,
            from_booth="A1",
            to_booth="A2",
            remark="A1调拨到A2"
        )
        result_tra = OperationService.handle_transfer(db, transfer_data)
        if result_tra.get("success"):
            print(f"✓ 调拨成功: 从 {result_tra.get('from_booth')} 到 {result_tra.get('to_booth')}")
        else:
            print(f"调拨结果: {result_tra}")

        # 7. 测试归还设备
        print("\n7. 测试归还设备")
        print("-" * 40)
        return_data = ReturnOperation(
            request_id="RET_TEST_001",
            equipment_code="TRUSS001",
            quantity=3,
            operator="李四",
            role=RoleType.OPERATOR,
            booth="A1",
            remark="A1展位部分归还"
        )
        result_ret = OperationService.handle_return(db, return_data)
        if result_ret.get("success"):
            print(f"✓ 归还成功: 新可用数量 = {result_ret.get('new_available')}")
        else:
            print(f"归还结果: {result_ret}")

        # 8. 测试损耗记录
        print("\n8. 测试损耗记录")
        print("-" * 40)
        loss_data = LossOperation(
            request_id="LOS_TEST_001",
            equipment_code="TRUSS001",
            quantity=1,
            operator="张三",
            role=RoleType.MANAGER,
            booth="A1",
            loss_reason="桁架损坏，无法修复"
        )
        result_loss = OperationService.handle_loss(db, loss_data)
        if result_loss.get("success"):
            print(f"✓ 损耗记录成功: 剩余可用 = {result_loss.get('remaining_available')}")
        else:
            print(f"损耗记录结果: {result_loss}")

        # 9. 测试查询功能
        print("\n9. 测试查询功能")
        print("-" * 40)
        filter_params = QueryFilter(operator="张三")
        records = OperationService.query_records(db, filter_params)
        print(f"✓ 查询结果: 找到 {len(records)} 条 '张三' 的操作记录")

        filter_params2 = QueryFilter(booth="A1")
        records2 = OperationService.query_records(db, filter_params2)
        print(f"✓ 查询结果: 找到 {len(records2)} 条 A1 展位的操作记录")

        # 10. 测试统计摘要
        print("\n10. 测试统计摘要")
        print("-" * 40)
        summary = OperationService.get_record_summary(db)
        print(f"✓ 统计摘要:")
        print(f"  总记录数: {summary.get('total_records')}")
        print(f"  成功记录: {summary.get('success_count')}")
        print(f"  失败记录: {summary.get('failed_count')}")
        print(f"  异常记录: {summary.get('exception_count')}")

        # 11. 查看审计日志
        print("\n11. 查看审计日志")
        print("-" * 40)
        audit_logs = db.query(AuditLog).all()
        print(f"✓ 审计日志数量: {len(audit_logs)}")
        if audit_logs:
            log = audit_logs[-1]
            print(f"  最新日志: {log.action} - {log.operator}")
            print(f"  旧值: {log.old_value}")
            print(f"  新值: {log.new_value}")

        # 12. 查看当前库存
        print("\n12. 当前库存状态")
        print("-" * 40)
        equipments = db.query(Equipment).all()
        print(f"{'编号':<15} {'名称':<25} {'类型':<10} {'总数量':<10} {'可用数量':<10} {'单位':<10}")
        print("-" * 80)
        for eq in equipments:
            print(f"{eq.code:<15} {eq.name:<25} {eq.type.value:<10} {eq.total_quantity:<10} {eq.available_quantity:<10} {eq.unit:<10}")

        print("\n" + "=" * 60)
        print("✓ 所有测试完成!")
        print("=" * 60)

    finally:
        db.close()


if __name__ == "__main__":
    test_system()
