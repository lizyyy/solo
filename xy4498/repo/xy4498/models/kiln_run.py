from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from datetime import datetime


@dataclass
class TemperatureLog:
    """温度日志记录"""
    id: str
    time: float  # 时间（分钟或小时）
    temperature: float  # 温度（摄氏度）
    zone: Optional[str] = None  # 测温区域


@dataclass
class BodyThickness:
    """坯体厚度记录"""
    id: str
    position_id: str  # 关联窑位ID
    thickness: float  # 厚度（厘米）
    material: Optional[str] = None  # 坯体材料


@dataclass
class GlazeRecipe:
    """釉料配方"""
    id: str
    name: str
    components: Dict[str, float] = field(default_factory=dict)  # 成分及其百分比
    melting_temperature: Optional[float] = None  # 熔融温度
    notes: Optional[str] = None


@dataclass
class KilnPosition:
    """窑位摆放"""
    id: str
    code: str  # 窑位编码，如A1, B2等
    row: int  # 行
    column: int  # 列
    shelf: Optional[int] = None  # 层架
    glaze_recipe_id: Optional[str] = None  # 釉料配方ID
    body_thickness_id: Optional[str] = None  # 坯体厚度ID
    notes: Optional[str] = None


@dataclass
class DefectRecord:
    """成品缺陷记录"""
    id: str
    kiln_run_id: str
    position_id: str  # 窑位ID
    defect_type: str  # 缺陷类型，如开裂、气泡、针孔等
    severity: str  # 严重程度：轻微、中等、严重
    description: Optional[str] = None
    photos: Optional[List[str]] = None  # 照片路径


@dataclass
class ReviewConclusion:
    """人工复核结论"""
    id: str
    kiln_run_id: str
    position_id: str
    reviewer: str  # 复核人
    review_date: datetime
    conclusion: str  # 结论：合格、轻微缺陷、严重缺陷、报废
    root_cause: Optional[str] = None  # 根本原因分析
    corrective_action: Optional[str] = None  # 纠正措施
    notes: Optional[str] = None


@dataclass
class KilnRun:
    """窑次记录"""
    id: str
    name: str
    start_date: datetime
    end_date: Optional[datetime] = None
    temperature_logs: List[TemperatureLog] = field(default_factory=list)
    body_thicknesses: List[BodyThickness] = field(default_factory=list)
    glaze_recipes: List[GlazeRecipe] = field(default_factory=list)
    kiln_positions: List[KilnPosition] = field(default_factory=list)
    defect_records: List[DefectRecord] = field(default_factory=list)
    review_conclusions: List[ReviewConclusion] = field(default_factory=list)
    target_curve: Optional[List[Dict[str, float]]] = None  # 目标烧成曲线
    notes: Optional[str] = None
    
    def get_position_by_code(self, code: str) -> Optional[KilnPosition]:
        """根据窑位编码获取窑位"""
        for pos in self.kiln_positions:
            if pos.code == code:
                return pos
        return None
    
    def get_defects_by_position(self, position_id: str) -> List[DefectRecord]:
        """获取指定窑位的缺陷记录"""
        return [d for d in self.defect_records if d.position_id == position_id]
    
    def get_review_by_position(self, position_id: str) -> Optional[ReviewConclusion]:
        """获取指定窑位的复核结论"""
        for review in self.review_conclusions:
            if review.position_id == position_id:
                return review
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'id': self.id,
            'name': self.name,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'temperature_logs': [
                {
                    'id': log.id,
                    'time': log.time,
                    'temperature': log.temperature,
                    'zone': log.zone
                } for log in self.temperature_logs
            ],
            'body_thicknesses': [
                {
                    'id': bt.id,
                    'position_id': bt.position_id,
                    'thickness': bt.thickness,
                    'material': bt.material
                } for bt in self.body_thicknesses
            ],
            'glaze_recipes': [
                {
                    'id': gr.id,
                    'name': gr.name,
                    'components': gr.components,
                    'melting_temperature': gr.melting_temperature,
                    'notes': gr.notes
                } for gr in self.glaze_recipes
            ],
            'kiln_positions': [
                {
                    'id': kp.id,
                    'code': kp.code,
                    'row': kp.row,
                    'column': kp.column,
                    'shelf': kp.shelf,
                    'glaze_recipe_id': kp.glaze_recipe_id,
                    'body_thickness_id': kp.body_thickness_id,
                    'notes': kp.notes
                } for kp in self.kiln_positions
            ],
            'defect_records': [
                {
                    'id': dr.id,
                    'kiln_run_id': dr.kiln_run_id,
                    'position_id': dr.position_id,
                    'defect_type': dr.defect_type,
                    'severity': dr.severity,
                    'description': dr.description,
                    'photos': dr.photos
                } for dr in self.defect_records
            ],
            'review_conclusions': [
                {
                    'id': rc.id,
                    'kiln_run_id': rc.kiln_run_id,
                    'position_id': rc.position_id,
                    'reviewer': rc.reviewer,
                    'review_date': rc.review_date.isoformat() if rc.review_date else None,
                    'conclusion': rc.conclusion,
                    'root_cause': rc.root_cause,
                    'corrective_action': rc.corrective_action,
                    'notes': rc.notes
                } for rc in self.review_conclusions
            ],
            'target_curve': self.target_curve,
            'notes': self.notes
        }
