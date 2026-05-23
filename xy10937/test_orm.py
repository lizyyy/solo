#!/usr/bin/env python3
"""
验证 SQLAlchemy ORM 映射和核心业务流程
"""

import sys
from datetime import datetime, timedelta

from database import Base, engine, SessionLocal
import models
import schemas
import crud
from models import OrderStatus, MaterialCategory, DamageType

def test_orm_mapping():
    print("🧪 测试 SQLAlchemy ORM 映射...")
    
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ 数据库表创建成功")
    except Exception as e:
        print(f"❌ 数据库表创建失败: {e}")
        return False
    
    db = SessionLocal()
    
    try:
        timestamp = int(datetime.now().timestamp() * 1000)
        
        order_data = schemas.OrderCreate(
            order_no=f"TEST{timestamp}",
            customer_name="测试客户",
            customer_phone="13800000000",
            event_date=datetime.now() + timedelta(days=7),
            event_location="测试地点",
            notes="测试订单",
            materials=[
                schemas.MaterialCreate(
                    name="测试花架",
                    category=MaterialCategory.FLOWER_STAND,
                    quantity=10,
                    unit_price=100.0,
                    description="测试"
                )
            ]
        )
        
        db_order = crud.create_order(db, order_data)
        print(f"✅ 订单创建成功: order_id={db_order.id}, order_no={db_order.order_no}")
        
        materials = crud.get_materials_by_order(db, db_order.id)
        print(f"✅ 物料查询成功: {len(materials)} 条")
        material_id = materials[0].id
        
        outbound_data = schemas.OutboundCreate(
            order_id=db_order.id,
            operator="测试员",
            notes="测试出库",
            items=[schemas.OutboundItemCreate(material_id=material_id, quantity=10)]
        )
        
        db_outbound, error = crud.create_outbound(db, outbound_data)
        if error:
            print(f"❌ 出库失败: {error}")
            return False
        print(f"✅ 出库成功: outbound_no={db_outbound.outbound_no}")
        
        return_data = schemas.ReturnCreate(
            order_id=db_order.id,
            operator="测试员",
            notes="测试归还",
            items=[
                schemas.ReturnItemCreate(
                    material_id=material_id,
                    expected_quantity=10,
                    returned_quantity=8,
                    damage_type=DamageType.LOST,
                    damage_notes="丢失2个"
                )
            ]
        )
        
        db_return, error = crud.create_return(db, return_data)
        if error:
            print(f"❌ 归还失败: {error}")
            return False
        print(f"✅ 归还成功: return_no={db_return.return_no}, status={db_return.status}")
        
        review_data = schemas.ReturnReview(
            reviewed_by="审核员",
            review_notes="同意",
            status=models.ReturnStatus.REVIEWED
        )
        
        db_return, error = crud.review_return(db, db_return.id, review_data)
        if error:
            print(f"❌ 审核失败: {error}")
            return False
        print(f"✅ 审核成功: status={db_return.status}")
        
        compensation_data = schemas.CompensationCreate(
            order_id=db_order.id,
            return_id=db_return.id,
            material_id=material_id,
            damage_type=DamageType.LOST,
            quantity=2,
            unit_amount=100.0,
            notes="测试赔付"
        )
        
        db_compensation, error = crud.create_compensation(db, compensation_data)
        if error:
            print(f"❌ 赔付创建失败: {error}")
            return False
        print(f"✅ 赔付创建成功: compensation_no={db_compensation.compensation_no}, amount={db_compensation.total_amount}")
        
        db_order = crud.get_order(db, db_order.id)
        print(f"✅ 最终订单状态: {db_order.status}, 赔付总额: {db_order.total_compensation}")
        
        print("\n🎉 所有 ORM 映射和业务流程测试通过！")
        return True
        
    except Exception as e:
        print(f"❌ 测试失败: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    success = test_orm_mapping()
    sys.exit(0 if success else 1)