import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import models
import schemas
import crud

DB_PATH = "test_reagent_management.db"

if os.path.exists(DB_PATH):
    os.remove(DB_PATH)

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

models.Base.metadata.create_all(bind=engine)


def test_full_flow():
    print("=" * 60)
    print("实验室试剂管理系统 - 完整流程测试")
    print("=" * 60)
    
    db = TestingSessionLocal()
    
    print("\n【1/10】创建试剂（普通 + 剧毒）")
    reagent1 = crud.create_reagent(db, schemas.ReagentCreate(
        name="乙醇",
        cas_no="64-17-5",
        danger_level="普通",
        unit="mL",
        operator="李老师",
        operator_role="实验室管理员"
    ))
    print(f"  ✓ 创建普通试剂: {reagent1.name} (ID: {reagent1.id})")
    
    reagent2 = crud.create_reagent(db, schemas.ReagentCreate(
        name="氰化钾",
        cas_no="151-50-8",
        danger_level="剧毒",
        unit="g",
        operator="李老师",
        operator_role="实验室管理员"
    ))
    print(f"  ✓ 创建剧毒试剂: {reagent2.name} (危险等级: {reagent2.danger_level})")
    
    print("\n【2/10】入库操作")
    inv1, msg = crud.add_inventory(db, schemas.InventoryCreate(
        reagent_id=reagent1.id,
        quantity=500,
        location="A-01",
        batch_no="2024001",
        operator="王管理员",
        operator_role="仓库管理员"
    ))
    print(f"  ✓ 乙醇入库: 500mL")
    
    inv2, msg = crud.add_inventory(db, schemas.InventoryCreate(
        reagent_id=reagent2.id,
        quantity=100,
        location="B-01(保险柜)",
        batch_no="2024002",
        operator="王管理员",
        operator_role="仓库管理员"
    ))
    print(f"  ✓ 氰化钾入库: 100g")
    
    print("\n【3/10】创建普通试剂申请（单人审批）")
    app1, msg, is_new = crud.create_application(db, schemas.ApplicationCreate(
        reagent_id=reagent1.id,
        quantity=100,
        purpose="有机合成实验",
        applicant="张学生",
        applicant_role="研究生"
    ))
    print(f"  ✓ 申请创建: {app1.application_no}, 需要审批人数: {app1.required_approvals}")
    
    print("\n【4/10】普通试剂审批")
    approved1, msg = crud.process_approval(db, schemas.ApprovalCreate(
        application_id=app1.id,
        approver="李老师",
        approver_role="实验室管理员",
        decision="approved",
        comment="同意，注意安全使用"
    ))
    print(f"  ✓ {msg}")
    
    print("\n【5/10】出库操作")
    out_result, msg = crud.stock_out(db, schemas.StockOut(
        application_id=app1.id,
        operator="王管理员",
        operator_role="仓库管理员"
    ))
    print(f"  ✓ {msg}")
    
    remaining = crud.get_total_inventory(db, reagent1.id)
    print(f"  ✓ 乙醇剩余库存: {remaining}mL")
    
    print("\n【6/10】创建剧毒试剂申请（双人审批）")
    app2, msg, is_new = crud.create_application(db, schemas.ApplicationCreate(
        reagent_id=reagent2.id,
        quantity=10,
        purpose="特定分析",
        applicant="张学生",
        applicant_role="研究生"
    ))
    print(f"  ✓ 申请创建: {app2.application_no}, 需要审批人数: {app2.required_approvals}")
    
    print("\n【7/10】剧毒试剂双人审批 - 第一人审批")
    partial, msg = crud.process_approval(db, schemas.ApprovalCreate(
        application_id=app2.id,
        approver="李老师",
        approver_role="实验室管理员",
        decision="approved",
        comment="同意第一审批"
    ))
    print(f"  ✓ {msg}")
    
    print("\n【8/10】剧毒试剂双人审批 - 第二人审批")
    approved2, msg = crud.process_approval(db, schemas.ApprovalCreate(
        application_id=app2.id,
        approver="王主任",
        approver_role="实验室主任",
        decision="approved",
        comment="最终同意"
    ))
    print(f"  ✓ {msg}")
    
    print("\n【9/10】测试驳回再提交")
    app3, msg, is_new = crud.create_application(db, schemas.ApplicationCreate(
        reagent_id=reagent1.id,
        quantity=1000,
        purpose="批量使用",
        applicant="张学生",
        applicant_role="研究生"
    ))
    
    rejected, msg = crud.process_approval(db, schemas.ApprovalCreate(
        application_id=app3.id,
        approver="李老师",
        approver_role="实验室管理员",
        decision="rejected",
        comment="数量太大，请分批申请"
    ))
    print(f"  ✓ 申请已驳回，状态: {rejected.status}")
    
    resubmitted, msg = crud.resubmit_application(db, app3.id, schemas.ApplicationResubmit(
        applicant="张学生",
        applicant_role="研究生",
        purpose="调整数量后重新申请"
    ))
    print(f"  ✓ {msg}，新状态: {resubmitted.status}")
    
    print("\n【10/10】测试幂等性（重复提交）")
    same_app1, msg, is_new1 = crud.create_application(
        db,
        schemas.ApplicationCreate(
            reagent_id=reagent1.id,
            quantity=50,
            purpose="测试幂等",
            applicant="张学生",
            applicant_role="研究生"
        ),
        idempotency_key="test-idempotent-001"
    )
    
    same_app2, msg, is_new2 = crud.create_application(
        db,
        schemas.ApplicationCreate(
            reagent_id=reagent1.id,
            quantity=50,
            purpose="测试幂等",
            applicant="张学生",
            applicant_role="研究生"
        ),
        idempotency_key="test-idempotent-001"
    )
    
    print(f"  ✓ 第一次新建: is_new={is_new1}, ID={same_app1.id}")
    print(f"  ✓ 第二次重复: is_new={is_new2}, ID={same_app2.id}")
    assert same_app1.id == same_app2.id, "幂等性失败！"
    print(f"  ✓ 幂等性验证通过: 两次返回相同申请ID")
    
    print("\n" + "=" * 60)
    print("库存盘点测试")
    print("=" * 60)
    
    check_result, msg = crud.inventory_check(db, schemas.InventoryCheck(
        reagent_id=reagent1.id,
        actual_quantity=500,
        operator="王管理员",
        operator_role="仓库管理员"
    ))
    print(f"  ✓ {msg}")
    print(f"    系统原数量: {check_result['system_quantity']}")
    print(f"    实盘数量: {check_result['actual_quantity']}")
    print(f"    差异: {check_result['difference']}")
    print(f"    调整后: {check_result['new_quantity']}")
    
    print("\n" + "=" * 60)
    print("操作审计日志")
    print("=" * 60)
    
    logs = crud.get_operation_logs(db, limit=20)
    for log in logs:
        print(f"  [{log.created_at.strftime('%H:%M:%S')}] {log.operation_type:15s} - {log.operator} - {log.result} - {log.reason[:50]}")
    
    print("\n" + "=" * 60)
    print("数据导出测试")
    print("=" * 60)
    
    export_data = crud.export_all_data(db)
    print(f"  ✓ 导出试剂数量: {len(export_data['reagents'])}")
    print(f"  ✓ 导出申请数量: {len(export_data['applications'])}")
    print(f"  ✓ 导出日志数量: {len(export_data['operation_logs'])}")
    
    with open("export_sample.json", "w", encoding="utf-8") as f:
        json.dump(export_data, f, ensure_ascii=False, indent=2)
    print(f"  ✓ 导出样本已保存到 export_sample.json")
    
    db.close()
    
    print("\n" + "=" * 60)
    print("✓ 所有测试通过！数据库文件已保存到", DB_PATH)
    print("=" * 60)
    
    print("\n重启后数据验证...")
    db2 = TestingSessionLocal()
    reagents = crud.get_reagents(db2)
    apps = crud.get_applications(db2)
    logs = crud.get_operation_logs(db2)
    print(f"  ✓ 重启后仍能查到: {len(reagents)}个试剂, {len(apps)}个申请, {len(logs)}条日志")
    db2.close()


if __name__ == "__main__":
    test_full_flow()
