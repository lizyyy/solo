from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any

from models.order import Order


@dataclass
class TransitionResult:
    success: bool
    message: str
    from_status: Optional[str] = None
    to_status: Optional[str] = None
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


class StateMachine:
    STATUS_ORDER = ["待取模", "待设计", "制作中", "待试穿", "需返修", "已交付"]
    
    VALID_TRANSITIONS: Dict[str, List[str]] = {
        "待取模": ["待设计"],
        "待设计": ["待取模", "制作中"],
        "制作中": ["待设计", "待试穿"],
        "待试穿": ["制作中", "需返修", "已交付"],
        "需返修": ["待试穿", "已交付"],
        "已交付": []
    }
    
    def can_transition(self, from_status: str, to_status: str) -> bool:
        if from_status == to_status:
            return False
        return to_status in self.VALID_TRANSITIONS.get(from_status, [])
    
    def validate_transition(
        self,
        order: Order,
        new_status: str,
        context: Optional[Dict[str, Any]] = None
    ) -> TransitionResult:
        context = context or {}
        
        if not self.can_transition(order.status, new_status):
            return TransitionResult(
                success=False,
                message=f"无法从 '{order.status}' 转换到 '{new_status}'",
                from_status=order.status,
                to_status=new_status,
                errors=[f"状态转换不允许: {order.status} -> {new_status}"]
            )
        
        warnings = []
        errors = []
        
        if new_status == "待设计":
            if not context.get("has_measurements", False):
                errors.append("进入设计阶段前必须有尺寸版本")
        
        if new_status == "制作中":
            has_visuals = context.get("has_images", False) or context.get("has_scans", False)
            if not has_visuals:
                errors.append("进入制作阶段前必须有扫描文件或取模照片")
        
        if new_status == "需返修":
            if not context.get("has_fitting_record", False):
                errors.append("返修必须关联一次试穿记录")
        
        if new_status == "已交付":
            if not context.get("has_final_list", False):
                warnings.append("交付前建议生成最终清单")
        
        success = len(errors) == 0
        
        return TransitionResult(
            success=success,
            message="状态转换验证通过" if success else "状态转换验证失败",
            from_status=order.status,
            to_status=new_status,
            warnings=warnings,
            errors=errors
        )
    
    def get_available_transitions(self, current_status: str) -> List[str]:
        return self.VALID_TRANSITIONS.get(current_status, [])
    
    def get_previous_status(self, current_status: str) -> Optional[str]:
        try:
            idx = self.STATUS_ORDER.index(current_status)
            if idx > 0:
                return self.STATUS_ORDER[idx - 1]
        except ValueError:
            pass
        return None
    
    def get_next_status(self, current_status: str) -> Optional[str]:
        try:
            idx = self.STATUS_ORDER.index(current_status)
            if idx < len(self.STATUS_ORDER) - 1:
                return self.STATUS_ORDER[idx + 1]
        except ValueError:
            pass
        return None
