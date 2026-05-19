#!/usr/bin/env python3
"""
高校实验室试剂管理系统 - 使用示例
"""

import os
import shutil
from datetime import datetime

from models import (
    Reagent,
    ReagentInventory,
    DangerLevel,
    ApprovalResult,
    QueryFilter,
)
from repository import UnitOfWork
from service import (
    ApplicationService,
    ApprovalService,
    OutboundService,
    ReturnService,
    InventoryService,
    QueryService,
    ExportService,
)


def init_test_data(uow: UnitOfWork):
    """初始化测试数据"""
    print("=== 初始化测试数据 ===")

    reagent1 = Reagent(
        name="乙醇",
        cas_no="64-17-5",
        specification="分析纯 500ml",
        manufacturer="国药集团",
        danger_level=DangerLevel.LOW,
        unit="瓶",
        warning_threshold=10.0,
        category="有机溶剂",
    )
    uow.reagents.create(reagent1)

    reagent2 = Reagent(
        name="浓硫酸",
        cas_no="7664-93-9",
        specification="分析纯 500ml",
        manufacturer="国药集团",
        danger_level=DangerLevel.HIGH,
        unit="瓶",
        warning_threshold=5.0,
        category="无机酸",
    )
    uow.reagents.create(reagent2)

    reagent3 = Reagent(
        name="氰化钾",
        cas_no="151-50-8",
        specification="分析纯 100g",
        manufacturer="国药集团",
        danger_level=DangerLevel.EXTREME,
        unit="瓶",
        warning_threshold=2.0,
        category="剧毒化学品",
    )
    uow.reagents.create(reagent3)

    inv1 = ReagentInventory(
        reagent_id=reagent1.id,
        batch_no="B202401001",
        quantity=50.0,
        available_quantity=50.0,
        unit="瓶",
        location="A1-01",
    )
    uow.inventory.create(inv1)

    inv2 = ReagentInventory(
        reagent_id=reagent2.id,
        batch_no="B202401002",
        quantity=20.0,
        available_quantity=20.0,
        unit="瓶",
        location="B2-03",
    )
    uow.inventory.create(inv2)

    inv3 = ReagentInventory(
        reagent_id=reagent3.id,
        batch_no="B202401003",
        quantity=5.0,
        available_quantity=5.0,
        unit="瓶",
        location="C3-01",
    )
    uow.inventory.create(inv3)

    print(f"已创建 {len(uow.reagents.list_all())} 种试剂")
    print(f"已创建 {len(uow.inventory.list_all())} 条库存记录")
    print()

    return reagent1, reagent2, reagent3


def test_application_workflow(uow: UnitOfWork, reagents):
    """测试申请审批流程"""
    print("=== 测试申请审批流程 ===")

    app_service = ApplicationService(uow)
    approval_service = ApprovalService(uow)

    reagent1, reagent2, reagent3 = reagents

    items = [
        {
            "reagent_id": reagent1.id,
            "reagent_name": reagent1.name,
            "specification": reagent1.specification,
            "quantity": 5,
            "unit": reagent1.unit,
            "danger_level": reagent1.danger_level.value,
        },
        {
            "reagent_id": reagent2.id,
            "reagent_name": reagent2.name,
            "specification": reagent2.specification,
            "quantity": 2,
            "unit": reagent2.unit,
            "danger_level": reagent2.danger_level.value,
        },
    ]

    application, _, _ = app_service.create_application(
        applicant_id="stu001",
        applicant_name="张三",
        purpose="有机合成实验",
        items_data=items,
        department="化学系",
    )
    print(f"创建申请单: {application.id}")

    application, results, success = app_service.submit_application(
        application.id, "stu001", "张三"
    )
    print(f"提交申请: {'成功' if success else '失败'}, 状态: {application.status.value}")

    approval, results, success = approval_service.create_approval(
        application_id=application.id,
        approver_id="tea001",
        approver_name="李教授",
        result=ApprovalResult.APPROVED,
        comment="同意使用",
    )
    print(f"审批结果: {'成功' if success else '失败'}, 审批状态: {approval.result.value}")

    app = app_service.get_application(application.id)
    print(f"申请单状态: {app.status.value}")
    print()


def test_dangerous_goods_approval(uow: UnitOfWork, reagents):
    """测试危险品双人审批"""
    print("=== 测试危险品双人审批 ===")

    app_service = ApplicationService(uow)
    approval_service = ApprovalService(uow)

    reagent3 = reagents[2]

    items = [
        {
            "reagent_id": reagent3.id,
            "reagent_name": reagent3.name,
            "specification": reagent3.specification,
            "quantity": 1,
            "unit": reagent3.unit,
            "danger_level": reagent3.danger_level.value,
        },
    ]

    application, _, _ = app_service.create_application(
        applicant_id="stu002",
        applicant_name="李四",
        purpose="特殊试剂实验",
        items_data=items,
        department="化学系",
    )
    print(f"创建剧毒试剂申请: {application.id}")

    application, results, success = app_service.submit_application(
        application.id, "stu002", "李四"
    )
    print(f"提交申请: {'成功' if success else '失败'}")

    approval1, results, success = approval_service.create_approval(
        application_id=application.id,
        approver_id="tea001",
        approver_name="李教授",
        result=ApprovalResult.APPROVED,
        comment="同意，需要第二人审批",
    )
    print(f"第一人审批: {'成功' if success else '失败'}")

    app = app_service.get_application(application.id)
    print(f"申请单状态: {app.status.value}")

    approval2, results, success = approval_service.create_approval(
        application_id=application.id,
        approver_id="tea002",
        approver_name="王主任",
        result=ApprovalResult.APPROVED,
        comment="已复核，同意使用",
    )
    print(f"第二人审批: {'成功' if success else '失败'}")

    app = app_service.get_application(application.id)
    print(f"申请单状态: {app.status.value}")
    print()


def test_outbound_workflow(uow: UnitOfWork, reagents):
    """测试出库流程"""
    print("=== 测试出库流程 ===")

    outbound_service = OutboundService(uow)
    reagent1 = reagents[0]

    before_inv = uow.inventory.find_by_reagent_id(reagent1.id)[0]
    print(f"出库前库存: {before_inv.available_quantity}")

    items = [
        {
            "reagent_id": reagent1.id,
            "reagent_name": reagent1.name,
            "specification": reagent1.specification,
            "batch_no": "B202401001",
            "quantity": 3,
            "unit": reagent1.unit,
            "location": "A1-01",
        },
    ]

    outbound, results, success = outbound_service.create_outbound(
        operator_id="adm001",
        operator_name="管理员",
        receiver_id="stu001",
        receiver_name="张三",
        items_data=items,
        department="化学系",
        purpose="有机合成实验",
    )
    print(f"出库: {'成功' if success else '失败'}, 单号: {outbound.id}")

    after_inv = uow.inventory.find_by_reagent_id(reagent1.id)[0]
    print(f"出库后库存: {after_inv.available_quantity}")
    print()


def test_return_workflow(uow: UnitOfWork, reagents):
    """测试归还流程"""
    print("=== 测试归还流程 ===")

    return_service = ReturnService(uow)
    reagent1 = reagents[0]

    before_inv = uow.inventory.find_by_reagent_id(reagent1.id)[0]
    print(f"归还前库存: {before_inv.available_quantity}")

    items = [
        {
            "reagent_id": reagent1.id,
            "reagent_name": reagent1.name,
            "specification": reagent1.specification,
            "batch_no": "B202401001",
            "quantity": 1,
            "unit": reagent1.unit,
            "remaining_quantity": 1,
            "condition": "完好",
            "location": "A1-01",
        },
    ]

    return_record, results, success = return_service.create_return(
        operator_id="adm001",
        operator_name="管理员",
        returner_id="stu001",
        returner_name="张三",
        items_data=items,
    )
    print(f"归还: {'成功' if success else '失败'}, 单号: {return_record.id}")

    after_inv = uow.inventory.find_by_reagent_id(reagent1.id)[0]
    print(f"归还后库存: {after_inv.available_quantity}")
    print()


def test_inventory_workflow(uow: UnitOfWork, reagents):
    """测试盘点流程"""
    print("=== 测试盘点流程 ===")

    inventory_service = InventoryService(uow)
    reagent1 = reagents[0]

    inv = uow.inventory.find_by_reagent_id(reagent1.id)[0]
    print(f"盘点前库存: {inv.quantity}")

    items = [
        {
            "reagent_id": reagent1.id,
            "reagent_name": reagent1.name,
            "specification": reagent1.specification,
            "batch_no": "B202401001",
            "system_quantity": 48.0,
            "actual_quantity": 47.0,
            "unit": reagent1.unit,
            "difference_reason": "正常损耗",
            "location": "A1-01",
        },
    ]

    inventory_record, results, success = inventory_service.create_inventory(
        operator_id="adm001",
        operator_name="管理员",
        items_data=items,
        remark="月度盘点",
    )
    print(f"盘点: {'成功' if success else '失败'}, 单号: {inventory_record.id}")
    print(f"盘点差异: {inventory_record.total_difference}")

    inv = uow.inventory.find_by_reagent_id(reagent1.id)[0]
    print(f"盘点后库存: {inv.quantity}")
    print()


def test_query_and_export(uow: UnitOfWork):
    """测试查询和导出功能"""
    print("=== 测试查询和导出 ===")

    query_service = QueryService(uow)
    export_service = ExportService(uow)

    summary = query_service.get_summary()
    print(f"统计汇总:")
    print(f"  总申请数: {summary.total_applications}")
    print(f"  待审批数: {summary.pending_approvals}")
    print(f"  已通过数: {summary.approved_applications}")
    print(f"  总出库数: {summary.total_outbounds}")
    print(f"  异常记录数: {summary.exception_count}")

    filter = QueryFilter(applicant_name="张")
    result = query_service.query_applications(filter)
    print(f"\n查询含'张'的申请人: 找到 {result.total} 条记录")

    os.makedirs("exports", exist_ok=True)
    excel_data = export_service.export_applications_to_excel(QueryFilter())
    export_service.save_to_file(excel_data, "exports/applications.xlsx")
    print(f"导出申请数据到 exports/applications.xlsx")

    excel_data = export_service.export_inventory_to_excel()
    export_service.save_to_file(excel_data, "exports/inventory.xlsx")
    print(f"导出库存数据到 exports/inventory.xlsx")

    excel_data = export_service.export_operation_logs_to_excel()
    export_service.save_to_file(excel_data, "exports/logs.xlsx")
    print(f"导出操作日志到 exports/logs.xlsx")
    print()


def test_stock_validation(uow: UnitOfWork, reagents):
    """测试库存不足拦截"""
    print("=== 测试库存不足拦截 ===")

    app_service = ApplicationService(uow)
    reagent1 = reagents[0]

    items = [
        {
            "reagent_id": reagent1.id,
            "reagent_name": reagent1.name,
            "specification": reagent1.specification,
            "quantity": 100,
            "unit": reagent1.unit,
            "danger_level": reagent1.danger_level.value,
        },
    ]

    application, _, _ = app_service.create_application(
        applicant_id="stu003",
        applicant_name="王五",
        purpose="测试库存不足",
        items_data=items,
    )

    application, results, success = app_service.submit_application(
        application.id, "stu003", "王五"
    )
    print(f"申请100瓶乙醇（库存47）: {'成功' if success else '被拦截'}")
    if not success:
        print(f"拦截原因: {application.exception_message}")
    print()


def test_rejection_and_resubmit(uow: UnitOfWork, reagents):
    """测试驳回后重新提交"""
    print("=== 测试驳回后重新提交 ===")

    app_service = ApplicationService(uow)
    approval_service = ApprovalService(uow)
    reagent1 = reagents[0]

    items = [
        {
            "reagent_id": reagent1.id,
            "reagent_name": reagent1.name,
            "specification": reagent1.specification,
            "quantity": 10,
            "unit": reagent1.unit,
            "danger_level": reagent1.danger_level.value,
        },
    ]

    application, _, _ = app_service.create_application(
        applicant_id="stu004",
        applicant_name="赵六",
        purpose="用途不明确",
        items_data=items,
    )

    application, results, success = app_service.submit_application(
        application.id, "stu004", "赵六"
    )

    approval, results, success = approval_service.create_approval(
        application_id=application.id,
        approver_id="tea001",
        approver_name="李教授",
        result=ApprovalResult.REJECTED,
        comment="用途不明确，请补充详细说明",
    )
    print(f"驳回申请: 原因 - {approval.comment}")

    app = app_service.get_application(application.id)
    print(f"申请单状态: {app.status.value}")

    new_items = [
        {
            "reagent_id": reagent1.id,
            "reagent_name": reagent1.name,
            "specification": reagent1.specification,
            "quantity": 5,
            "unit": reagent1.unit,
            "danger_level": reagent1.danger_level.value,
        },
    ]
    application, results, success = app_service.resubmit_application(
        application.id, "stu004", "赵六", new_items
    )
    print(f"重新提交: {'成功' if success else '失败'}, 状态: {application.status.value}")
    print(f"异常类型: {application.exception_type.value}")
    print()


def test_idempotency(uow: UnitOfWork):
    """测试幂等性"""
    print("=== 测试幂等性 ===")

    app_service = ApplicationService(uow)

    reagent = uow.reagents.list_all()[0]
    items = [
        {
            "reagent_id": reagent.id,
            "reagent_name": reagent.name,
            "specification": reagent.specification,
            "quantity": 2,
            "unit": reagent.unit,
            "danger_level": reagent.danger_level.value,
        },
    ]

    idempotent_key = "test_key_001"

    app1, _, _ = app_service.create_application(
        applicant_id="stu005",
        applicant_name="钱七",
        purpose="幂等性测试1",
        items_data=items,
        idempotent_key=idempotent_key,
    )
    print(f"第一次创建申请: {app1.id}")

    app2, _, _ = app_service.create_application(
        applicant_id="stu005",
        applicant_name="钱七",
        purpose="幂等性测试2",
        items_data=items,
        idempotent_key=idempotent_key,
    )
    print(f"第二次创建申请（相同key）: {app2.id}")
    print(f"是否为同一申请: {app1.id == app2.id}")
    print()


def main():
    print("=" * 50)
    print("高校实验室试剂管理系统 - 功能演示")
    print("=" * 50)
    print()

    if os.path.exists("data"):
        shutil.rmtree("data")

    uow = UnitOfWork("data")

    reagents = init_test_data(uow)
    test_application_workflow(uow, reagents)
    test_dangerous_goods_approval(uow, reagents)
    test_outbound_workflow(uow, reagents)
    test_return_workflow(uow, reagents)
    test_inventory_workflow(uow, reagents)
    test_stock_validation(uow, reagents)
    test_rejection_and_resubmit(uow, reagents)
    test_idempotency(uow)
    test_query_and_export(uow)

    print("=" * 50)
    print("演示完成！")
    print("=" * 50)


if __name__ == "__main__":
    main()
