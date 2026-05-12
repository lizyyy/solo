from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from .models import (
    Model, SparePart, Knowledge, WorkOrder, Recommendation, Feedback
)


def seed_sample_data(db: Session):
    if db.query(Model).count() > 0:
        return False

    models = [
        Model(model_code="PRD-A100", model_name="Product-A 100系列",
              product_line="Product-A"),
        Model(model_code="PRD-A200", model_name="Product-A 200系列",
              product_line="Product-A"),
        Model(model_code="PRD-B100", model_name="Product-B 100系列",
              product_line="Product-B"),
        Model(model_code="PRD-B200", model_name="Product-B 200系列",
              product_line="Product-B"),
    ]
    db.add_all(models)

    parts = [
        SparePart(part_code="PART-MB-001", part_name="主控板",
                  model_compatible=["PRD-A100", "PRD-A200"],
                  stock_quantity=15, safety_stock=5),
        SparePart(part_code="PART-MB-002", part_name="主控板(B型)",
                  model_compatible=["PRD-B100", "PRD-B200"],
                  stock_quantity=3, safety_stock=5),
        SparePart(part_code="PART-PS-001", part_name="电源模块",
                  model_compatible=["PRD-A100", "PRD-A200", "PRD-B100", "PRD-B200"],
                  stock_quantity=0, safety_stock=3),
        SparePart(part_code="PART-SENSOR-001", part_name="温度传感器",
                  model_compatible=[],
                  stock_quantity=50, safety_stock=10),
        SparePart(part_code="PART-FAN-001", part_name="散热风扇",
                  model_compatible=["PRD-A100", "PRD-B100"],
                  stock_quantity=8, safety_stock=2),
    ]
    db.add_all(parts)

    now = datetime.utcnow()
    knowledges = [
        Knowledge(
            knowledge_code="KL-ERR-001-01",
            error_code="ERR-001",
            model_codes=["PRD-A100", "PRD-A200"],
            title="ERR-001 通信故障处理（A系列专用）",
            content="1. 检查通信线缆连接；2. 重启主控板；3. 如仍失败，更换主控板 PART-MB-001",
            suggested_parts=["PART-MB-001"],
            effective_date=now - timedelta(days=30),
            expiration_date=now + timedelta(days=365),
            is_active=True,
            success_count=18,
            total_usage=20,
        ),
        Knowledge(
            knowledge_code="KL-ERR-001-02",
            error_code="ERR-001",
            model_codes=["PRD-B100", "PRD-B200"],
            title="ERR-001 通信故障处理（B系列专用）",
            content="1. 检查无线模块；2. 固件升级；3. 更换主控板 PART-MB-002",
            suggested_parts=["PART-MB-002"],
            effective_date=now - timedelta(days=30),
            expiration_date=now + timedelta(days=365),
            is_active=True,
            success_count=8,
            total_usage=10,
        ),
        Knowledge(
            knowledge_code="KL-ERR-001-03",
            error_code="ERR-001",
            model_codes=[],
            title="ERR-001 通信故障通用检查",
            content="检查网络环境和防火墙设置",
            suggested_parts=[],
            effective_date=now - timedelta(days=30),
            expiration_date=now + timedelta(days=365),
            is_active=True,
            success_count=3,
            total_usage=10,
        ),
        Knowledge(
            knowledge_code="KL-ERR-002-01",
            error_code="ERR-002",
            model_codes=["PRD-A100", "PRD-A200", "PRD-B100", "PRD-B200"],
            title="ERR-002 过热警告处理",
            content="1. 清理防尘网；2. 检查散热风扇；3. 必要时更换 PART-FAN-001",
            suggested_parts=["PART-FAN-001"],
            effective_date=now - timedelta(days=30),
            expiration_date=now + timedelta(days=365),
            is_active=True,
            success_count=15,
            total_usage=18,
        ),
        Knowledge(
            knowledge_code="KL-ERR-003-01",
            error_code="ERR-003",
            model_codes=["PRD-A100", "PRD-B100"],
            title="ERR-003 电压异常（已过期）",
            content="旧版电压检测处理方案 - 已过期，仅供参考",
            suggested_parts=["PART-PS-001"],
            effective_date=now - timedelta(days=180),
            expiration_date=now - timedelta(days=30),
            is_active=True,
            success_count=5,
            total_usage=10,
        ),
        Knowledge(
            knowledge_code="KL-ERR-003-02",
            error_code="ERR-003",
            model_codes=["PRD-A100", "PRD-A200", "PRD-B100", "PRD-B200"],
            title="ERR-003 电压异常（新版）",
            content="1. 检查输入电压范围；2. 检测内部电路；3. 如必要更换电源",
            suggested_parts=["PART-PS-001"],
            effective_date=now - timedelta(days=15),
            expiration_date=now + timedelta(days=365),
            is_active=True,
            success_count=0,
            total_usage=0,
        ),
        Knowledge(
            knowledge_code="KL-ERR-004-01",
            error_code="ERR-004",
            model_codes=["PRD-A100", "PRD-A200"],
            title="ERR-004 传感器异常",
            content="检查温度传感器连接，必要时更换 PART-SENSOR-001",
            suggested_parts=["PART-SENSOR-001"],
            effective_date=now - timedelta(days=30),
            expiration_date=now + timedelta(days=365),
            is_active=True,
            success_count=6,
            total_usage=6,
        ),
    ]
    db.add_all(knowledges)

    historical_orders = [
        {
            "order_no": "HIST-2026-001",
            "model_code": "PRD-A100",
            "error_code": "ERR-001",
            "description": "设备无法连接网络，通信中断",
            "engineer_id": "ENG-001",
            "knowledge_used": "KL-ERR-001-01",
            "effectiveness": 90,
            "resolved": True
        },
        {
            "order_no": "HIST-2026-002",
            "model_code": "PRD-A100",
            "error_code": "ERR-001",
            "description": "间歇性断网，无法正常通信",
            "engineer_id": "ENG-002",
            "knowledge_used": "KL-ERR-001-01",
            "effectiveness": 85,
            "resolved": True
        },
        {
            "order_no": "HIST-2026-003",
            "model_code": "PRD-B200",
            "error_code": "ERR-001",
            "description": "无线连接失败，指示灯红色",
            "engineer_id": "ENG-001",
            "knowledge_used": "KL-ERR-001-02",
            "effectiveness": 75,
            "resolved": True
        },
        {
            "order_no": "HIST-2026-004",
            "model_code": "PRD-A200",
            "error_code": "ERR-002",
            "description": "持续高温警告，风扇异响",
            "engineer_id": "ENG-003",
            "knowledge_used": "KL-ERR-002-01",
            "effectiveness": 95,
            "resolved": True
        },
        {
            "order_no": "HIST-2026-005",
            "model_code": "PRD-B100",
            "error_code": "ERR-002",
            "description": "设备运行半小时后自动停机",
            "engineer_id": "ENG-002",
            "knowledge_used": "KL-ERR-002-01",
            "effectiveness": 80,
            "resolved": True
        },
    ]

    for data in historical_orders:
        order = WorkOrder(
            order_no=data["order_no"],
            model_code=data["model_code"],
            error_code=data["error_code"],
            description=data["description"],
            status="COMPLETED",
            engineer_id=data["engineer_id"],
            created_at=now - timedelta(days=15),
            updated_at=now - timedelta(days=14)
        )
        db.add(order)
        db.flush()

        rec = Recommendation(
            order_no=data["order_no"],
            round_no=1,
            is_idempotent=False,
            status="FEEDBACK",
            recommended_knowledge=[],
            similar_histories=[],
            part_availability=[],
            feedback={
                "knowledge_code": data["knowledge_used"],
                "effectiveness": data["effectiveness"],
                "resolved": data["resolved"]
            },
            created_at=now - timedelta(days=15)
        )
        db.add(rec)
        db.flush()

        feedback = Feedback(
            recommendation_id=rec.id,
            knowledge_code=data["knowledge_used"],
            effectiveness=data["effectiveness"],
            comment="历史工单反馈",
            operator=data["engineer_id"],
            is_manual_correction=False,
            created_at=now - timedelta(days=14)
        )
        db.add(feedback)

    db.commit()
    return True
