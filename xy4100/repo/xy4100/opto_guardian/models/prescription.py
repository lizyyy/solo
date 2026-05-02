"""处方数据模型"""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class EyeSide(str, Enum):
    """眼别"""
    LEFT = "左眼"
    RIGHT = "右眼"


class AddType(str, Enum):
    """下加光类型"""
    NEAR = "近用"
    INTERMEDIATE = "中距离"


class EyePrescription(BaseModel):
    """单眼处方数据"""
    
    sphere: float = Field(description="球镜度数(D)，近视负，远视正")
    cylinder: float = Field(default=0.0, description="柱镜度数(D)，散光负")
    axis: Optional[int] = Field(default=None, description="轴位(0-180度)，散光时必填")
    
    add: Optional[float] = Field(default=None, description="下加光度数(D)，老花/渐进时使用")
    add_type: Optional[AddType] = Field(default=None, description="下加光类型")
    
    prism: Optional[float] = Field(default=None, description="棱镜度数(△)")
    prism_base: Optional[str] = Field(default=None, description="棱镜基底方向")
    
    @field_validator("axis")
    @classmethod
    def validate_axis(cls, v: Optional[int], info) -> Optional[int]:
        """验证轴位"""
        if v is not None:
            if v < 0 or v > 180:
                raise ValueError(f"轴位必须在0-180之间，当前值: {v}")
        return v
    
    @field_validator("cylinder")
    @classmethod
    def validate_cylinder(cls, v: float, info) -> float:
        """验证柱镜"""
        if abs(v) > 0.001 and "axis" in info.data and info.data.get("axis") is None:
            raise ValueError("有散光度数时必须填写轴位")
        return v
    
    def is_myopia(self) -> bool:
        """是否近视"""
        return self.sphere < -0.25
    
    def is_hyperopia(self) -> bool:
        """是否远视"""
        return self.sphere > 0.25
    
    def has_astigmatism(self) -> bool:
        """是否有散光"""
        return abs(self.cylinder) > 0.001
    
    def needs_prism(self) -> bool:
        """是否需要棱镜"""
        return self.prism is not None and abs(self.prism) > 0.001
    
    def to_minus_cylinder(self) -> "EyePrescription":
        """转换为负柱镜格式"""
        if self.cylinder <= 0:
            return self.model_copy()
        
        new_sphere = self.sphere + self.cylinder
        new_cylinder = -self.cylinder
        new_axis = None
        if self.axis is not None:
            new_axis = (self.axis + 90) % 180
            if new_axis == 0:
                new_axis = 180
        
        return EyePrescription(
            sphere=new_sphere,
            cylinder=new_cylinder,
            axis=new_axis,
            add=self.add,
            add_type=self.add_type,
            prism=self.prism,
            prism_base=self.prism_base,
        )
    
    def to_plus_cylinder(self) -> "EyePrescription":
        """转换为正柱镜格式"""
        if self.cylinder >= 0:
            return self.model_copy()
        
        new_sphere = self.sphere + self.cylinder
        new_cylinder = -self.cylinder
        new_axis = None
        if self.axis is not None:
            new_axis = (self.axis + 90) % 180
            if new_axis == 0:
                new_axis = 180
        
        return EyePrescription(
            sphere=new_sphere,
            cylinder=new_cylinder,
            axis=new_axis,
            add=self.add,
            add_type=self.add_type,
            prism=self.prism,
            prism_base=self.prism_base,
        )
    
    def equivalent_sphere(self) -> float:
        """计算等效球镜"""
        return self.sphere + (self.cylinder / 2)


class Prescription(BaseModel):
    """完整验光处方"""
    
    prescription_id: str = Field(description="处方唯一标识")
    
    right_eye: EyePrescription = Field(description="右眼处方")
    left_eye: EyePrescription = Field(description="左眼处方")
    
    pd_total: Optional[float] = Field(default=None, description="总瞳距(mm)")
    pd_right: Optional[float] = Field(default=None, description="右眼瞳距(mm)")
    pd_left: Optional[float] = Field(default=None, description="左眼瞳距(mm)")
    
    ph_right: Optional[float] = Field(default=None, description="右眼瞳高(mm)")
    ph_left: Optional[float] = Field(default=None, description="左眼瞳高(mm)")
    
    patient_name: Optional[str] = Field(default=None, description="患者姓名")
    patient_age: Optional[int] = Field(default=None, description="患者年龄")
    
    optometrist: Optional[str] = Field(default=None, description="验光师")
    exam_date: Optional[datetime] = Field(default=None, description="验光日期")
    expiry_date: Optional[datetime] = Field(default=None, description="处方有效期")
    
    notes: Optional[str] = Field(default=None, description="备注")
    
    def get_pd_right(self) -> Optional[float]:
        """获取右眼瞳距"""
        if self.pd_right is not None:
            return self.pd_right
        if self.pd_total is not None:
            return self.pd_total / 2
        return None
    
    def get_pd_left(self) -> Optional[float]:
        """获取左眼瞳距"""
        if self.pd_left is not None:
            return self.pd_left
        if self.pd_total is not None:
            return self.pd_total / 2
        return None
    
    def get_pd_total(self) -> Optional[float]:
        """获取总瞳距"""
        if self.pd_total is not None:
            return self.pd_total
        if self.pd_right is not None and self.pd_left is not None:
            return self.pd_right + self.pd_left
        return None
    
    def has_pd_difference(self) -> bool:
        """检查是否存在单眼瞳距差异"""
        if self.pd_right is not None and self.pd_left is not None:
            return abs(self.pd_right - self.pd_left) > 0.5
        return False
    
    def to_minus_cylinder(self) -> "Prescription":
        """转换为负柱镜格式"""
        return Prescription(
            prescription_id=self.prescription_id,
            right_eye=self.right_eye.to_minus_cylinder(),
            left_eye=self.left_eye.to_minus_cylinder(),
            pd_total=self.pd_total,
            pd_right=self.pd_right,
            pd_left=self.pd_left,
            ph_right=self.ph_right,
            ph_left=self.ph_left,
            patient_name=self.patient_name,
            patient_age=self.patient_age,
            optometrist=self.optometrist,
            exam_date=self.exam_date,
            expiry_date=self.expiry_date,
            notes=self.notes,
        )


class PrescriptionEntry(BaseModel):
    """处方导入条目（CSV格式）"""
    
    order_no: str = Field(description="订单号")
    patient_name: Optional[str] = Field(default=None, description="患者姓名")
    
    re_sphere: float = Field(description="右眼球镜")
    re_cylinder: float = Field(default=0.0, description="右眼柱镜")
    re_axis: Optional[int] = Field(default=None, description="右眼轴位")
    re_add: Optional[float] = Field(default=None, description="右眼下加光")
    
    le_sphere: float = Field(description="左眼球镜")
    le_cylinder: float = Field(default=0.0, description="左眼柱镜")
    le_axis: Optional[int] = Field(default=None, description="左眼轴位")
    le_add: Optional[float] = Field(default=None, description="左眼下加光")
    
    pd_total: Optional[float] = Field(default=None, description="总瞳距")
    pd_right: Optional[float] = Field(default=None, description="右眼瞳距")
    pd_left: Optional[float] = Field(default=None, description="左眼瞳距")
    
    ph_right: Optional[float] = Field(default=None, description="右眼瞳高")
    ph_left: Optional[float] = Field(default=None, description="左眼瞳高")
    
    frame_model: Optional[str] = Field(default=None, description="镜架型号")
    lens_type: Optional[str] = Field(default=None, description="镜片类型")
    
    optometrist: Optional[str] = Field(default=None, description="验光师")
    exam_date: Optional[str] = Field(default=None, description="验光日期")
    notes: Optional[str] = Field(default=None, description="备注")
    
    def to_prescription(self) -> Prescription:
        """转换为Prescription对象"""
        return Prescription(
            prescription_id=self.order_no,
            right_eye=EyePrescription(
                sphere=self.re_sphere,
                cylinder=self.re_cylinder,
                axis=self.re_axis,
                add=self.re_add,
            ),
            left_eye=EyePrescription(
                sphere=self.le_sphere,
                cylinder=self.le_cylinder,
                axis=self.le_axis,
                add=self.le_add,
            ),
            pd_total=self.pd_total,
            pd_right=self.pd_right,
            pd_left=self.pd_left,
            ph_right=self.ph_right,
            ph_left=self.ph_left,
            patient_name=self.patient_name,
            optometrist=self.optometrist,
            notes=self.notes,
        )
