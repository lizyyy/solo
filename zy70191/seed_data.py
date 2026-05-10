#!/usr/bin/env python3
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import (
    Supplier, SupplierType, SupplierStatus,
    Qualification, QualificationStatus,
    PriceSnapshot,
    SwitchRequest, SwitchStatus,
    Approval, ApprovalStatus,
    DeliveryImpact,
    ExceptionRecord, ExceptionType
)
from app.config import settings


engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def seed_database():
    print("开始初始化数据库...")
    
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    
    try:
        print("创建供应商数据...")
        
        primary_supplier = Supplier(
            name="深圳华星电子科技有限公司",
            code="SUP-PRI-001",
            type=SupplierType.PRIMARY,
            status=SupplierStatus.EXCEPTION,
            contact_person="张经理",
            phone="138-0000-0001",
            address="广东省深圳市南山区科技园1号"
        )
        db.add(primary_supplier)
        db.flush()
        
        alt_supplier_good = Supplier(
            name="东莞瑞丰电子有限公司",
            code="SUP-ALT-001",
            type=SupplierType.ALTERNATIVE,
            status=SupplierStatus.ACTIVE,
            contact_person="李总",
            phone="138-0000-0002",
            address="广东省东莞市松山湖工业区A栋"
        )
        db.add(alt_supplier_good)
        db.flush()
        
        alt_supplier_expired = Supplier(
            name="惠州创新科技有限公司",
            code="SUP-ALT-002",
            type=SupplierType.ALTERNATIVE,
            status=SupplierStatus.ACTIVE,
            contact_person="王工",
            phone="138-0000-0003",
            address="广东省惠州市仲恺高新区B栋"
        )
        db.add(alt_supplier_expired)
        db.flush()
        
        print("创建资质数据...")
        
        now = datetime.utcnow()
        
        db.add(Qualification(
            supplier_id=primary_supplier.id,
            name="ISO9001质量管理体系认证",
            certificate_number="ISO-2024-00123",
            issue_date=now - timedelta(days=365),
            expiry_date=now + timedelta(days=365),
            status=QualificationStatus.VALID,
            description="质量管理体系认证，覆盖电子产品生产全流程"
        ))
        db.add(Qualification(
            supplier_id=primary_supplier.id,
            name="ISO14001环境管理体系认证",
            certificate_number="ISO-ENV-2024-00456",
            issue_date=now - timedelta(days=180),
            expiry_date=now + timedelta(days=540),
            status=QualificationStatus.VALID,
            description="环境管理体系认证"
        ))
        
        db.add(Qualification(
            supplier_id=alt_supplier_good.id,
            name="ISO9001质量管理体系认证",
            certificate_number="ISO-2024-00789",
            issue_date=now - timedelta(days=100),
            expiry_date=now + timedelta(days=630),
            status=QualificationStatus.VALID,
            description="质量管理体系认证"
        ))
        db.add(Qualification(
            supplier_id=alt_supplier_good.id,
            name="RoHS认证",
            certificate_number="ROHS-2024-00111",
            issue_date=now - timedelta(days=60),
            expiry_date=now + timedelta(days=720),
            status=QualificationStatus.VALID,
            description="有害物质限制认证"
        ))
        
        db.add(Qualification(
            supplier_id=alt_supplier_expired.id,
            name="ISO9001质量管理体系认证",
            certificate_number="ISO-2023-00999",
            issue_date=now - timedelta(days=730),
            expiry_date=now - timedelta(days=30),
            status=QualificationStatus.EXPIRED,
            description="质量管理体系认证（已过期）"
        ))
        db.add(Qualification(
            supplier_id=alt_supplier_expired.id,
            name="ISO14001环境管理体系认证",
            certificate_number="ISO-ENV-2022-00888",
            issue_date=now - timedelta(days=900),
            expiry_date=now - timedelta(days=90),
            status=QualificationStatus.EXPIRED,
            description="环境管理体系认证（已过期）"
        ))
        
        print("创建价格快照数据...")
        
        db.add(PriceSnapshot(
            supplier_id=primary_supplier.id,
            product_code="PROD-001",
            product_name="5G通信模块-MT8976",
            unit_price=125.50,
            is_current=True
        ))
        db.add(PriceSnapshot(
            supplier_id=primary_supplier.id,
            product_code="PROD-002",
            product_name="电源管理芯片-PM1024",
            unit_price=45.80,
            is_current=True
        ))
        
        db.add(PriceSnapshot(
            supplier_id=alt_supplier_good.id,
            product_code="PROD-001",
            product_name="5G通信模块-MT8976",
            unit_price=130.00,
            is_current=True
        ))
        db.add(PriceSnapshot(
            supplier_id=alt_supplier_good.id,
            product_code="PROD-002",
            product_name="电源管理芯片-PM1024",
            unit_price=48.00,
            is_current=True
        ))
        
        db.add(PriceSnapshot(
            supplier_id=alt_supplier_expired.id,
            product_code="PROD-001",
            product_name="5G通信模块-MT8976",
            unit_price=118.00,
            is_current=True
        ))
        
        db.commit()
        db.refresh(primary_supplier)
        db.refresh(alt_supplier_good)
        db.refresh(alt_supplier_expired)
        
        print("创建切换申请数据...")
        
        normal_switch_request = SwitchRequest(
            request_no=f"SW-{now.strftime('%Y%m%d')}-NORMAL",
            primary_supplier_id=primary_supplier.id,
            alternative_supplier_id=alt_supplier_good.id,
            product_code="PROD-001",
            product_name="5G通信模块-MT8976",
            quantity=5000,
            reason="主供应商生产线故障，预计停产2周，需紧急切换备选供应商保障交付",
            requester="采购部-陈小明",
            requester_department="采购管理部",
            status=SwitchStatus.APPROVED
        )
        db.add(normal_switch_request)
        db.flush()
        
        pending_switch_request = SwitchRequest(
            request_no=f"SW-{now.strftime('%Y%m%d')}-PENDING",
            primary_supplier_id=primary_supplier.id,
            alternative_supplier_id=alt_supplier_good.id,
            product_code="PROD-002",
            product_name="电源管理芯片-PM1024",
            quantity=10000,
            reason="主供应商原材料供应中断，影响生产排程",
            requester="采购部-林小红",
            requester_department="采购管理部",
            status=SwitchStatus.PENDING
        )
        db.add(pending_switch_request)
        db.flush()
        
        failed_switch_request = SwitchRequest(
            request_no=f"SW-{now.strftime('%Y%m%d')}-FAILED",
            primary_supplier_id=primary_supplier.id,
            alternative_supplier_id=alt_supplier_expired.id,
            product_code="PROD-001",
            product_name="5G通信模块-MT8976",
            quantity=3000,
            reason="尝试切换到资质过期的供应商（测试异常拦截场景）",
            requester="测试员",
            requester_department="测试部",
            status=SwitchStatus.FAILED
        )
        db.add(failed_switch_request)
        db.flush()
        
        print("创建审批数据...")
        
        db.add(Approval(
            switch_request_id=normal_switch_request.id,
            approver="供应链总监-赵总",
            approver_department="供应链管理中心",
            approval_level=1,
            status=ApprovalStatus.APPROVED,
            comment="同意切换，备选供应商资质齐全，价格涨幅在可接受范围内",
            approved_at=now - timedelta(hours=2),
            created_at=now - timedelta(hours=4)
        ))
        
        db.add(Approval(
            switch_request_id=pending_switch_request.id,
            approver="供应链总监-赵总",
            approver_department="供应链管理中心",
            approval_level=1,
            status=ApprovalStatus.PENDING,
            comment=None,
            created_at=now - timedelta(hours=1)
        ))
        
        print("创建交期影响数据...")
        
        original_delivery = now + timedelta(days=7)
        new_delivery = now + timedelta(days=12)
        
        db.add(DeliveryImpact(
            switch_request_id=normal_switch_request.id,
            original_delivery_date=original_delivery,
            new_delivery_date=new_delivery,
            delay_days=5,
            impact_description="切换供应商导致交期延误5天，需调整生产计划",
            mitigation_measures="1. 协调备选供应商加急生产\n2. 安排部分空运\n3. 与客户协商调整交付日期"
        ))
        
        print("创建异常记录数据...")
        
        db.add(ExceptionRecord(
            switch_request_id=failed_switch_request.id,
            exception_type=ExceptionType.QUALIFICATION_FAILED,
            description="备选供应商资质校验失败",
            detail="供应商「惠州创新科技有限公司」的ISO9001和ISO14001认证均已过期，不符合资质要求",
            is_resolved=False,
            created_at=now - timedelta(days=1)
        ))
        
        db.add(ExceptionRecord(
            switch_request_id=normal_switch_request.id,
            exception_type=ExceptionType.PRICE_ABNORMAL,
            description="价格涨幅超过20%阈值",
            detail="主供应商价格125.50元，备选供应商价格130.00元，涨幅3.59%。虽然未超过业务阈值20%，但已记录在案供复核。",
            is_resolved=True,
            resolved_by="财务审核-钱会计",
            resolved_at=now - timedelta(hours=1),
            created_at=now - timedelta(days=1)
        ))
        
        db.add(ExceptionRecord(
            exception_type=ExceptionType.SYSTEM_ERROR,
            description="系统定时任务执行异常",
            detail="每日资质过期检查任务执行超时，影响部分供应商状态更新",
            is_resolved=False,
            created_at=now - timedelta(hours=3)
        ))
        
        db.commit()
        
        print("\n" + "=" * 60)
        print("数据库初始化完成！")
        print("=" * 60)
        print("\n【数据概览】")
        print(f"  供应商数量: 3 (1主供 + 2备选)")
        print(f"  资质记录: 6条")
        print(f"  价格快照: 5条")
        print(f"  切换申请: 3条 (正常/待审批/失败)")
        print(f"  审批记录: 2条")
        print(f"  交期影响: 1条")
        print(f"  异常记录: 3条")
        print("\n【场景覆盖】")
        print("  1. 正常处理场景:")
        print("     - 主供应商异常（状态：exception）")
        print("     - 备选供应商资质齐全有效")
        print("     - 审批通过，可执行切换")
        print("\n  2. 异常拦截场景:")
        print("     - 尝试切换到资质过期的供应商")
        print("     - 系统自动拦截并记录异常")
        print("\n  3. 重复操作检测:")
        print("     - 同一主供+备选+产品组合如有未完成申请")
        print("     - 新申请会被拒绝并记录重复请求异常")
        print("\n【启动服务】")
        print("  命令: uvicorn main:app --reload --port 8000")
        print("  Swagger: http://localhost:8000/docs")
        print("=" * 60)
        
    except Exception as e:
        db.rollback()
        print(f"初始化失败: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
