from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models import DeliveryImpact, SwitchRequest, ExceptionType
from app.schemas import DeliveryImpactCreate, DeliveryImpactAnalysis
from app.services.exception_service import ExceptionService


class DeliveryService:
    def __init__(self, db: Session):
        self.db = db
        self.exception_service = ExceptionService(db)

    def analyze_delivery_impact(
        self,
        switch_request_id: int,
        original_delivery_date: datetime,
        standard_delivery_days: int = 7
    ) -> DeliveryImpactAnalysis:
        switch_request = self.db.query(SwitchRequest).filter(
            SwitchRequest.id == switch_request_id
        ).first()

        if not switch_request:
            return DeliveryImpactAnalysis(
                switch_request_id=switch_request_id,
                original_delivery_date=original_delivery_date,
                new_delivery_date=original_delivery_date,
                delay_days=0,
                impact_level="未知",
                impact_description="切换申请不存在",
                mitigation_measures=[]
            )

        new_delivery_date = original_delivery_date + timedelta(days=standard_delivery_days)
        delay_days = (new_delivery_date.date() - original_delivery_date.date()).days

        if delay_days <= 0:
            impact_level = "无影响"
            impact_description = "供应商切换不会影响原交期"
            mitigation_measures = ["按原计划执行"]
        elif delay_days <= 3:
            impact_level = "轻微影响"
            impact_description = f"预计延误{delay_days}天，对生产影响较小"
            mitigation_measures = [
                "提前通知生产部门",
                "协调备选供应商加急处理"
            ]
        elif delay_days <= 7:
            impact_level = "中等影响"
            impact_description = f"预计延误{delay_days}天，需调整生产计划"
            mitigation_measures = [
                "调整生产排程",
                "考虑部分空运",
                "与客户沟通调整交付日期"
            ]
        else:
            impact_level = "严重影响"
            impact_description = f"预计延误{delay_days}天，可能影响合同履约"
            mitigation_measures = [
                "立即启动应急预案",
                "寻找更多备选供应商",
                "与客户紧急协商",
                "考虑库存调货"
            ]
            self.exception_service.record_exception(
                exception_type=ExceptionType.DELIVERY_DELAY,
                description=f"供应商切换导致交期严重延误{delay_days}天",
                detail=f"原交期: {original_delivery_date}, 新交期: {new_delivery_date}",
                switch_request_id=switch_request_id
            )

        return DeliveryImpactAnalysis(
            switch_request_id=switch_request_id,
            original_delivery_date=original_delivery_date,
            new_delivery_date=new_delivery_date,
            delay_days=delay_days,
            impact_level=impact_level,
            impact_description=impact_description,
            mitigation_measures=mitigation_measures
        )

    def record_delivery_impact(self, impact_data: DeliveryImpactCreate) -> Optional[DeliveryImpact]:
        switch_request = self.db.query(SwitchRequest).filter(
            SwitchRequest.id == impact_data.switch_request_id
        ).first()

        if not switch_request:
            return None

        delivery_impact = DeliveryImpact(
            switch_request_id=impact_data.switch_request_id,
            original_delivery_date=impact_data.original_delivery_date,
            new_delivery_date=impact_data.new_delivery_date,
            delay_days=impact_data.delay_days,
            impact_description=impact_data.impact_description,
            mitigation_measures=impact_data.mitigation_measures
        )
        self.db.add(delivery_impact)
        self.db.commit()
        self.db.refresh(delivery_impact)
        return delivery_impact

    def get_delivery_impacts(self, switch_request_id: int) -> List[DeliveryImpact]:
        return self.db.query(DeliveryImpact).filter(
            DeliveryImpact.switch_request_id == switch_request_id
        ).order_by(DeliveryImpact.created_at.desc()).all()

    def calculate_standard_delivery_days(self, distance_km: float, product_type: str) -> int:
        base_days = 3
        if distance_km > 1000:
            base_days += 2
        elif distance_km > 500:
            base_days += 1

        if product_type == "电子产品":
            base_days += 0
        elif product_type == "大型设备":
            base_days += 3
        elif product_type == "易腐品":
            base_days -= 1
            if base_days < 1:
                base_days = 1

        return base_days
