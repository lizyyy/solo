from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum
import uuid

from .vital_signs import VitalSigns
from .medication import Medication
from .risk import Risk
from .review import Review


class CaseStatus(Enum):
    """
    病例状态
    """
    CREATED = "已创建"
    DATA_IMPORTED = "数据已导入"
    RISKS_DETECTED = "风险已检测"
    UNDER_REVIEW = "复核中"
    REVIEW_COMPLETED = "复核完成"
    EXPORTED = "已导出"
    ARCHIVED = "已归档"


@dataclass
class Case:
    """
    完整的麻醉监护病例
    整合生命体征、给药记录、风险检测和复核记录
    """
    case_id: str = None
    patient_name: Optional[str] = None
    patient_id: Optional[str] = None
    species: Optional[str] = None  # 物种 (犬/猫/其他)
    breed: Optional[str] = None  # 品种
    age: Optional[str] = None  # 年龄
    weight: Optional[float] = None  # 体重 (kg)
    procedure: Optional[str] = None  # 手术/操作名称
    anesthesiologist: Optional[str] = None  # 麻醉医师
    surgery_date: Optional[datetime] = None  # 手术日期
    created_at: datetime = None
    updated_at: datetime = None
    status: CaseStatus = CaseStatus.CREATED
    notes: Optional[str] = None  # 人工备注
    
    # 关联数据
    vital_signs: Optional[VitalSigns] = None
    medication: Optional[Medication] = None
    risks: List[Risk] = field(default_factory=list)
    review: Optional[Review] = None
    
    def __post_init__(self):
        if self.case_id is None:
            self.case_id = f"CASE_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}"
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.updated_at is None:
            self.updated_at = self.created_at
    
    def update_timestamp(self):
        """
        更新修改时间
        """
        self.updated_at = datetime.now()
    
    def add_vital_signs(self, vital_signs: VitalSigns):
        """
        添加生命体征数据
        """
        self.vital_signs = vital_signs
        self.status = CaseStatus.DATA_IMPORTED
        self.update_timestamp()
        
        # 同步患者信息
        if vital_signs.patient_name:
            self.patient_name = vital_signs.patient_name
        if vital_signs.patient_id:
            self.patient_id = vital_signs.patient_id
        if vital_signs.species:
            self.species = vital_signs.species
        if vital_signs.breed:
            self.breed = vital_signs.breed
        if vital_signs.age:
            self.age = vital_signs.age
        if vital_signs.weight:
            self.weight = vital_signs.weight
        if vital_signs.procedure:
            self.procedure = vital_signs.procedure
        if vital_signs.anesthesiologist:
            self.anesthesiologist = vital_signs.anesthesiologist
    
    def add_medication(self, medication: Medication):
        """
        添加给药记录
        """
        self.medication = medication
        self.update_timestamp()
    
    def add_risk(self, risk: Risk):
        """
        添加风险
        """
        # 检查是否已存在相同ID的风险
        existing = [r for r in self.risks if r.risk_id == risk.risk_id]
        if existing:
            # 替换已存在的风险
            index = self.risks.index(existing[0])
            self.risks[index] = risk
        else:
            self.risks.append(risk)
        
        self.status = CaseStatus.RISKS_DETECTED
        self.update_timestamp()
    
    def add_risks(self, risks: List[Risk]):
        """
        批量添加风险
        """
        for risk in risks:
            self.add_risk(risk)
    
    def get_risk_by_id(self, risk_id: str) -> Optional[Risk]:
        """
        根据ID获取风险
        """
        for risk in self.risks:
            if risk.risk_id == risk_id:
                return risk
        return None
    
    def get_risks_by_status(self, status) -> List[Risk]:
        """
        按状态获取风险
        """
        return [risk for risk in self.risks if risk.status == status]
    
    def get_time_range(self) -> tuple:
        """
        获取病例的时间范围
        返回 (最早时间, 最晚时间)
        """
        times = []
        
        if self.vital_signs and self.vital_signs.start_time:
            times.append(self.vital_signs.start_time)
        if self.vital_signs and self.vital_signs.end_time:
            times.append(self.vital_signs.end_time)
        
        if self.medication and self.medication.records:
            for record in self.medication.records:
                if record.timestamp:
                    times.append(record.timestamp)
        
        if not times:
            return (None, None)
        
        return (min(times), max(times))
    
    def to_dict(self) -> Dict:
        """
        转换为字典
        """
        start_time, end_time = self.get_time_range()
        
        return {
            "case_id": self.case_id,
            "patient_name": self.patient_name,
            "patient_id": self.patient_id,
            "species": self.species,
            "breed": self.breed,
            "age": self.age,
            "weight": self.weight,
            "procedure": self.procedure,
            "anesthesiologist": self.anesthesiologist,
            "surgery_date": self.surgery_date.isoformat() if self.surgery_date else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "status": self.status.value,
            "status_code": self.status.name,
            "notes": self.notes,
            "start_time": start_time.isoformat() if start_time else None,
            "end_time": end_time.isoformat() if end_time else None,
            "vital_signs": self.vital_signs.to_dict() if self.vital_signs else None,
            "medication": self.medication.to_dict() if self.medication else None,
            "risks": [risk.to_dict() for risk in self.risks],
            "review": self.review.to_dict() if self.review else None,
            "risk_summary": {
                "total": len(self.risks),
                "pending": len(self.get_risks_by_status(__import__('src.models.risk', fromlist=['RiskStatus']).RiskStatus.PENDING)),
                "confirmed": len(self.get_risks_by_status(__import__('src.models.risk', fromlist=['RiskStatus']).RiskStatus.CONFIRMED)),
                "dismissed": len(self.get_risks_by_status(__import__('src.models.risk', fromlist=['RiskStatus']).RiskStatus.DISMISSED))
            }
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Case':
        """
        从字典创建对象
        """
        # 解析状态
        status_code = data.get("status_code", data.get("status", "CREATED"))
        try:
            status = CaseStatus[status_code]
        except KeyError:
            status = CaseStatus.CREATED
        
        # 解析时间
        created_at = datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None
        updated_at = datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
        surgery_date = datetime.fromisoformat(data["surgery_date"]) if data.get("surgery_date") else None
        
        # 解析关联数据
        vital_signs = None
        if data.get("vital_signs"):
            vital_signs = VitalSigns.from_dict(data["vital_signs"])
        
        medication = None
        if data.get("medication"):
            medication = Medication.from_dict(data["medication"])
        
        risks = []
        for risk_data in data.get("risks", []):
            risks.append(Risk.from_dict(risk_data))
        
        review = None
        if data.get("review"):
            review = Review.from_dict(data["review"])
        
        return cls(
            case_id=data["case_id"],
            patient_name=data.get("patient_name"),
            patient_id=data.get("patient_id"),
            species=data.get("species"),
            breed=data.get("breed"),
            age=data.get("age"),
            weight=data.get("weight"),
            procedure=data.get("procedure"),
            anesthesiologist=data.get("anesthesiologist"),
            surgery_date=surgery_date,
            created_at=created_at,
            updated_at=updated_at,
            status=status,
            notes=data.get("notes"),
            vital_signs=vital_signs,
            medication=medication,
            risks=risks,
            review=review
        )
