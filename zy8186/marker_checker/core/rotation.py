from dataclasses import dataclass
from enum import Enum
from typing import List, Dict, Optional


class GrainDirection(Enum):
    STRAIGHT = "straight"
    CROSS = "cross"
    BIAS = "bias"
    NONE = "none"


class RotationConstraint(Enum):
    FREE = 0
    NINETY = 1
    EIGHTEEN = 2
    NONE = 3


@dataclass
class FabricRule:
    name: str
    width_mm: float
    grain_direction: GrainDirection
    rotation_constraint: RotationConstraint
    allowed_pieces: List[str]
    shrinkage_warp: float = 0.0
    shrinkage_weft: float = 0.0


@dataclass
class Piece:
    id: str
    name: str
    width_mm: float
    height_mm: float
    grain_direction: GrainDirection
    fabric_name: str
    is_mirror: bool = False
    quantity: int = 1
    
    def get_rotated_dimensions(self, rotation: int):
        if rotation % 180 == 0:
            return self.width_mm, self.height_mm
        else:
            return self.height_mm, self.width_mm
    
    def can_rotate(self, constraint: RotationConstraint, target_rotation: int) -> bool:
        if constraint == RotationConstraint.FREE:
            return True
        elif constraint == RotationConstraint.NINETY:
            return target_rotation % 90 == 0
        elif constraint == RotationConstraint.EIGHTEEN:
            return target_rotation % 180 == 0
        elif constraint == RotationConstraint.NONE:
            return target_rotation == 0
        return False
    
    def check_grain_conflict(self, fabric_rule: FabricRule, rotation: int) -> Optional[str]:
        if self.grain_direction == GrainDirection.NONE or fabric_rule.grain_direction == GrainDirection.NONE:
            return None
        
        if fabric_rule.grain_direction == GrainDirection.BIAS or self.grain_direction == GrainDirection.BIAS:
            return None
        
        effective_grain = self.grain_direction
        if rotation % 180 == 90:
            if self.grain_direction == GrainDirection.STRAIGHT:
                effective_grain = GrainDirection.CROSS
            elif self.grain_direction == GrainDirection.CROSS:
                effective_grain = GrainDirection.STRAIGHT
        
        if effective_grain != fabric_rule.grain_direction:
            return f"纹向冲突: 裁片{self.name}({self.grain_direction.value})旋转{rotation}°后与面料{fabric_rule.name}({fabric_rule.grain_direction.value})不匹配"
        
        return None


class RotationManager:
    def __init__(self):
        pass
    
    def get_valid_rotations(self, piece: Piece, fabric_rule: FabricRule) -> List[int]:
        valid_rotations = []
        for rotation in [0, 90, 180, 270]:
            if piece.can_rotate(fabric_rule.rotation_constraint, rotation):
                if not piece.check_grain_conflict(fabric_rule, rotation):
                    valid_rotations.append(rotation)
        return valid_rotations
    
    def get_rotation_grain_change(self, grain_direction: GrainDirection, rotation: int) -> GrainDirection:
        if rotation % 180 == 0:
            return grain_direction
        
        if grain_direction == GrainDirection.STRAIGHT:
            return GrainDirection.CROSS
        elif grain_direction == GrainDirection.CROSS:
            return GrainDirection.STRAIGHT
        else:
            return grain_direction
