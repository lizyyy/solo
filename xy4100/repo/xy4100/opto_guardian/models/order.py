"""订单数据模型"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from .prescription import Prescription
from .frame import Frame
from .lens import LensType


class OrderStatus(str, Enum):
    """订单状态"""
    PENDING = "待处理"
    CHECKING = "校验中"
    APPROVED = "已通过"
    REJECTED = "已拒绝"
    PROCESSING = "加工中"
    COMPLETED = "已完成"


class OrderItem(BaseModel):
    """订单条目"""
    
    eye: str = Field(description="眼别: 右眼/左眼")
    prescription: Prescription = Field(description="处方数据")
    
    frame: Optional[Frame] = Field(default=None, description="镜架信息")
    lens_type: Optional[LensType] = Field(default=None, description="镜片类型")
    
    recommended_lens: Optional[dict] = Field(default=None, description="推荐镜片")
    alternative_lenses: list[dict] = Field(default_factory=list, description="替代镜片")
    
    processing_notes: Optional[str] = Field(default=None, description="加工注意事项")


class ProcessingPlan(BaseModel):
    """加工计划"""
    
    plan_id: str = Field(description="计划ID")
    
    right_eye: dict = Field(description="右眼加工方案")
    left_eye: dict = Field(description="左眼加工方案")
    
    pd_adjustment: Optional[dict] = Field(default=None, description="瞳距调整建议")
    ph_adjustment: Optional[dict] = Field(default=None, description="瞳高调整建议")
    
    estimated_lens_diameter: Optional[dict] = Field(default=None, description="估算镜片直径")
    
    warnings: list[str] = Field(default_factory=list, description="警告信息")
    suggestions: list[str] = Field(default_factory=list, description="建议")
    
    total_estimated_cost: Optional[float] = Field(default=None, description="估算总成本")
    estimated_processing_days: Optional[int] = Field(default=None, description="预估加工天数")


class Order(BaseModel):
    """完整订单"""
    
    order_id: str = Field(description="订单唯一标识")
    
    prescription: Prescription = Field(description="处方数据")
    frame: Optional[Frame] = Field(default=None, description="镜架信息")
    
    lens_type: Optional[LensType] = Field(default=None, description="镜片类型")
    
    status: OrderStatus = Field(default=OrderStatus.PENDING, description="订单状态")
    
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")
    
    patient_name: Optional[str] = Field(default=None, description="患者姓名")
    patient_phone: Optional[str] = Field(default=None, description="患者电话")
    
    optometrist: Optional[str] = Field(default=None, description="验光师")
    optician: Optional[str] = Field(default=None, description="配镜师")
    
    priority: str = Field(default="普通", description="优先级: 普通/加急/特急")
    delivery_date: Optional[datetime] = Field(default=None, description="预计取镜日期")
    
    processing_plan: Optional[ProcessingPlan] = Field(default=None, description="加工计划")
    validation_result: Optional[dict] = Field(default=None, description="校验结果")
    
    notes: Optional[str] = Field(default=None, description="备注")
    
    def to_dict(self) -> dict:
        """转换为字典（包含嵌套对象）"""
        return {
            "order_id": self.order_id,
            "patient_name": self.patient_name,
            "patient_phone": self.patient_phone,
            "status": self.status.value,
            "priority": self.priority,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "delivery_date": self.delivery_date.isoformat() if self.delivery_date else None,
            "optometrist": self.optometrist,
            "optician": self.optician,
            "prescription": {
                "prescription_id": self.prescription.prescription_id,
                "right_eye": {
                    "sphere": self.prescription.right_eye.sphere,
                    "cylinder": self.prescription.right_eye.cylinder,
                    "axis": self.prescription.right_eye.axis,
                    "add": self.prescription.right_eye.add,
                },
                "left_eye": {
                    "sphere": self.prescription.left_eye.sphere,
                    "cylinder": self.prescription.left_eye.cylinder,
                    "axis": self.prescription.left_eye.axis,
                    "add": self.prescription.left_eye.add,
                },
                "pd_total": self.prescription.get_pd_total(),
                "pd_right": self.prescription.get_pd_right(),
                "pd_left": self.prescription.get_pd_left(),
                "ph_right": self.prescription.ph_right,
                "ph_left": self.prescription.ph_left,
            },
            "frame": {
                "frame_id": self.frame.frame_id,
                "model": self.frame.model,
                "brand": self.frame.brand,
                "style": self.frame.style.value if self.frame else None,
                "eye_size": self.frame.eye_size if self.frame else None,
                "bridge_size": self.frame.bridge_size if self.frame else None,
                "box_center_distance": self.frame.get_box_center_distance() if self.frame else None,
            } if self.frame else None,
            "lens_type": self.lens_type.value if self.lens_type else None,
            "processing_plan": self.processing_plan.model_dump() if self.processing_plan else None,
            "validation_result": self.validation_result,
            "notes": self.notes,
        }
