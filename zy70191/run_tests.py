#!/usr/bin/env python3
import sys
from datetime import datetime, timedelta

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.database import Base, get_db
from app.models import (
    Supplier, SupplierType, SupplierStatus,
    Qualification, QualificationStatus,
    PriceSnapshot
)
from main import app

TEST_DATABASE_URL = "sqlite:///./test_validation.db"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


def setup_test_data():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    now = datetime.utcnow()
    
    primary = Supplier(
        name="测试主供应商",
        code="TEST-PRI-001",
        type=SupplierType.PRIMARY,
        status=SupplierStatus.EXCEPTION,
        contact_person="张三",
        phone="138-0000-0001",
        address="测试地址1"
    )
    db.add(primary)
    db.flush()
    primary_id = primary.id
    
    good_alt = Supplier(
        name="合格备选供应商",
        code="TEST-ALT-GOOD",
        type=SupplierType.ALTERNATIVE,
        status=SupplierStatus.ACTIVE,
        contact_person="李四",
        phone="138-0000-0002",
        address="测试地址2"
    )
    db.add(good_alt)
    db.flush()
    good_alt_id = good_alt.id
    
    expired_alt = Supplier(
        name="资质过期供应商",
        code="TEST-ALT-EXPIRED",
        type=SupplierType.ALTERNATIVE,
        status=SupplierStatus.ACTIVE,
        contact_person="王五",
        phone="138-0000-0003",
        address="测试地址3"
    )
    db.add(expired_alt)
    db.flush()
    expired_alt_id = expired_alt.id
    
    db.add(Qualification(
        supplier_id=primary_id,
        name="ISO9001",
        certificate_number="TEST-ISO-001",
        issue_date=now - timedelta(days=365),
        expiry_date=now + timedelta(days=365),
        status=QualificationStatus.VALID
    ))
    
    db.add(Qualification(
        supplier_id=good_alt_id,
        name="ISO9001",
        certificate_number="TEST-ISO-002",
        issue_date=now - timedelta(days=100),
        expiry_date=now + timedelta(days=630),
        status=QualificationStatus.VALID
    ))
    db.add(Qualification(
        supplier_id=good_alt_id,
        name="RoHS",
        certificate_number="TEST-ROHS-001",
        issue_date=now - timedelta(days=60),
        expiry_date=now + timedelta(days=720),
        status=QualificationStatus.VALID
    ))
    
    db.add(Qualification(
        supplier_id=expired_alt_id,
        name="ISO9001",
        certificate_number="TEST-ISO-003",
        issue_date=now - timedelta(days=730),
        expiry_date=now - timedelta(days=30),
        status=QualificationStatus.EXPIRED
    ))
    
    db.add(PriceSnapshot(
        supplier_id=primary_id,
        product_code="TEST-PROD-001",
        product_name="测试产品A",
        unit_price=100.00,
        is_current=True
    ))
    db.add(PriceSnapshot(
        supplier_id=good_alt_id,
        product_code="TEST-PROD-001",
        product_name="测试产品A",
        unit_price=105.00,
        is_current=True
    ))
    db.add(PriceSnapshot(
        supplier_id=expired_alt_id,
        product_code="TEST-PROD-001",
        product_name="测试产品A",
        unit_price=95.00,
        is_current=True
    ))
    
    db.commit()
    db.close()
    
    return {
        "primary_id": primary_id,
        "good_alt_id": good_alt_id,
        "expired_alt_id": expired_alt_id
    }


def run_tests():
    print("=" * 70)
    print("备选供应商切换服务 - 功能验证测试")
    print("=" * 70)
    
    client = TestClient(app)
    suppliers = setup_test_data()
    
    passed = 0
    failed = 0
    failures = []
    
    try:
        print("\n【场景一：正常处理流程】")
        print("-" * 70)
        
        print("\n1. 测试创建切换申请...")
        response = client.post("/api/switches", json={
            "primary_supplier_id": suppliers["primary_id"],
            "alternative_supplier_id": suppliers["good_alt_id"],
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 1000,
            "reason": "主供应商生产线故障，需要紧急切换",
            "requester": "测试员-张三",
            "requester_department": "采购部"
        })
        if response.status_code == 201 and response.json()["success"]:
            print("   ✓ 切换申请创建成功")
            passed += 1
            switch_request_id = response.json()["switch_request_id"]
        else:
            print("   ✗ 切换申请创建失败")
            failed += 1
            failures.append("创建切换申请失败")
        
        print("\n2. 测试资质校验...")
        response = client.get(f"/api/switches/{switch_request_id}/qualification-check")
        if response.status_code == 200 and response.json()["passed"]:
            print("   ✓ 资质校验通过")
            passed += 1
        else:
            print("   ✗ 资质校验失败")
            failed += 1
            failures.append("资质校验失败")
        
        print("\n3. 测试价格对比...")
        response = client.get(f"/api/switches/{switch_request_id}/price-comparison")
        if response.status_code == 200:
            comparison = response.json()
            if comparison["primary_price"] == 100.00 and comparison["alternative_price"] == 105.00:
                print("   ✓ 价格对比正确（主供100元 vs 备选105元）")
                passed += 1
            else:
                print("   ✗ 价格数据不正确")
                failed += 1
                failures.append("价格数据不正确")
        else:
            print("   ✗ 价格对比失败")
            failed += 1
            failures.append("价格对比失败")
        
        print("\n4. 测试审批流程...")
        response = client.post("/api/approvals", json={
            "switch_request_id": switch_request_id,
            "approver": "审批人-李总",
            "approver_department": "供应链管理部",
            "approval_level": 1,
            "comment": "资质齐全，价格合理"
        })
        if response.status_code == 201:
            approval_id = response.json()["id"]
            response = client.post(
                f"/api/approvals/{approval_id}/approve",
                params={"approver": "审批人-李总", "comment": "同意切换"}
            )
            if response.status_code == 200 and response.json()["status"] == "approved":
                print("   ✓ 审批通过")
                passed += 1
            else:
                print("   ✗ 审批失败")
                failed += 1
                failures.append("审批失败")
        else:
            print("   ✗ 创建审批记录失败")
            failed += 1
            failures.append("创建审批记录失败")
        
        print("\n5. 测试执行切换...")
        response = client.post(f"/api/switches/{switch_request_id}/execute")
        if response.status_code == 200 and response.json()["success"]:
            print("   ✓ 切换执行成功")
            passed += 1
        else:
            print("   ✗ 切换执行失败")
            failed += 1
            failures.append("切换执行失败")
        
        print("\n6. 测试生成切换报告...")
        response = client.post(
            f"/api/reports/switch-request/{switch_request_id}",
            params={"generated_by": "系统自动生成"}
        )
        if response.status_code == 201:
            report_id = response.json()["id"]
            response = client.get(f"/api/reports/{report_id}")
            if response.status_code == 200 and "recommendation" in response.json()["content"]:
                print("   ✓ 切换报告生成成功")
                passed += 1
            else:
                print("   ✗ 报告内容不完整")
                failed += 1
                failures.append("报告内容不完整")
        else:
            print("   ✗ 报告生成失败")
            failed += 1
            failures.append("报告生成失败")
        
        print("\n【场景二：异常拦截测试】")
        print("-" * 70)
        
        print("\n7. 测试资质过期拦截...")
        response = client.post("/api/switches", json={
            "primary_supplier_id": suppliers["primary_id"],
            "alternative_supplier_id": suppliers["expired_alt_id"],
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 500,
            "reason": "测试资质过期拦截",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        expired_switch_id = response.json()["switch_request_id"]
        
        response = client.post("/api/approvals", json={
            "switch_request_id": expired_switch_id,
            "approver": "审批人",
            "approver_department": "测试部",
            "approval_level": 1
        })
        approval_id = response.json()["id"]
        client.post(
            f"/api/approvals/{approval_id}/approve",
            params={"approver": "审批人"}
        )
        
        response = client.post(f"/api/switches/{expired_switch_id}/execute")
        if response.status_code == 400 and "资质校验不通过" in response.json()["detail"]:
            print("   ✓ 资质过期成功拦截")
            passed += 1
        else:
            print("   ✗ 资质过期未被拦截")
            failed += 1
            failures.append("资质过期未被拦截")
        
        print("\n8. 测试异常记录生成...")
        response = client.get(f"/api/exceptions/switch-request/{expired_switch_id}")
        if response.status_code == 200:
            exceptions = response.json()
            qual_exceptions = [e for e in exceptions if e["exception_type"] == "qualification_failed"]
            if len(qual_exceptions) > 0:
                print("   ✓ 资质失败异常已记录")
                passed += 1
            else:
                print("   ✗ 异常记录未生成")
                failed += 1
                failures.append("异常记录未生成")
        else:
            print("   ✗ 无法查询异常记录")
            failed += 1
            failures.append("无法查询异常记录")
        
        print("\n9. 测试未审批执行拦截...")
        response = client.post("/api/switches", json={
            "primary_supplier_id": suppliers["primary_id"],
            "alternative_supplier_id": suppliers["good_alt_id"],
            "product_code": "TEST-PROD-001",
            "product_name": "测试产品A",
            "quantity": 100,
            "reason": "测试未审批拦截",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        pending_switch_id = response.json()["switch_request_id"]
        
        response = client.post(f"/api/switches/{pending_switch_id}/execute")
        if response.status_code == 400 and "尚未获得审批" in response.json()["detail"]:
            print("   ✓ 未审批执行成功拦截")
            passed += 1
        else:
            print("   ✗ 未审批执行未被拦截")
            failed += 1
            failures.append("未审批执行未被拦截")
        
        print("\n10. 测试异常处理流程...")
        response = client.post("/api/exceptions", json={
            "exception_type": "system_error",
            "description": "测试系统异常",
            "detail": "这是一个测试异常记录"
        })
        if response.status_code == 201:
            exception_id = response.json()["id"]
            response = client.post(
                f"/api/exceptions/{exception_id}/resolve",
                params={"resolved_by": "测试处理人", "resolution_detail": "已修复"}
            )
            if response.status_code == 200 and response.json()["is_resolved"]:
                print("   ✓ 异常处理流程正常")
                passed += 1
            else:
                print("   ✗ 异常处理失败")
                failed += 1
                failures.append("异常处理失败")
        else:
            print("   ✗ 无法创建异常记录")
            failed += 1
            failures.append("无法创建异常记录")
        
        print("\n【场景三：重复操作检测】")
        print("-" * 70)
        
        print("\n11. 测试重复切换申请检测...")
        response = client.post("/api/switches", json={
            "primary_supplier_id": suppliers["primary_id"],
            "alternative_supplier_id": suppliers["good_alt_id"],
            "product_code": "TEST-PROD-002",
            "product_name": "测试产品B（新申请）",
            "quantity": 1000,
            "reason": "第一次申请",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        
        response = client.post("/api/switches", json={
            "primary_supplier_id": suppliers["primary_id"],
            "alternative_supplier_id": suppliers["good_alt_id"],
            "product_code": "TEST-PROD-002",
            "product_name": "测试产品B（重复申请）",
            "quantity": 500,
            "reason": "第二次重复申请",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        if response.status_code == 400 and "重复切换申请" in response.json()["detail"]:
            print("   ✓ 重复申请成功拦截")
            passed += 1
        else:
            print("   ✗ 重复申请未被拦截")
            failed += 1
            failures.append("重复申请未被拦截")
        
        print("\n12. 测试重复审批检测...")
        response = client.post("/api/switches", json={
            "primary_supplier_id": suppliers["primary_id"],
            "alternative_supplier_id": suppliers["good_alt_id"],
            "product_code": "TEST-PROD-003",
            "product_name": "测试产品C",
            "quantity": 100,
            "reason": "测试重复审批",
            "requester": "测试员",
            "requester_department": "测试部"
        })
        approval_test_id = response.json()["switch_request_id"]
        
        response = client.post("/api/approvals", json={
            "switch_request_id": approval_test_id,
            "approver": "审批人1",
            "approver_department": "测试部",
            "approval_level": 1
        })
        
        response = client.post("/api/approvals", json={
            "switch_request_id": approval_test_id,
            "approver": "审批人2",
            "approver_department": "测试部",
            "approval_level": 1
        })
        if response.status_code == 400:
            print("   ✓ 重复审批成功拦截")
            passed += 1
        else:
            print("   ✗ 重复审批未被拦截")
            failed += 1
            failures.append("重复审批未被拦截")
        
        print("\n" + "=" * 70)
        print("测试结果汇总")
        print("=" * 70)
        print(f"通过: {passed} 项")
        print(f"失败: {failed} 项")
        if failures:
            print("\n失败详情:")
            for i, f in enumerate(failures, 1):
                print(f"  {i}. {f}")
        print("=" * 70)
        
        return failed == 0
        
    finally:
        Base.metadata.drop_all(bind=engine)


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
