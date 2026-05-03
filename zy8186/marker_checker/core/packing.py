from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple
from enum import Enum
from .rotation import Piece, FabricRule, RotationManager, GrainDirection, RotationConstraint
from .defects import DefectAvoider, DefectZone


class LayoutAlgorithm(Enum):
    BOTTOM_LEFT = "bottom_left"
    NEXT_FIT = "next_fit"
    BEST_FIT = "best_fit"


@dataclass
class PlacedPiece:
    piece: Piece
    x: float
    y: float
    rotation: int
    width: float
    height: float
    fabric_name: str


@dataclass
class LayoutResult:
    fabric_name: str
    fabric_width: float
    fabric_length: float
    placed_pieces: List[PlacedPiece]
    unplaced_pieces: List[Piece]
    total_area_used: float
    total_area_pieces: float
    defects_avoided: int
    warnings: List[str] = field(default_factory=list)


class PackingAlgorithm:
    def __init__(self, defect_avoider: DefectAvoider = None):
        self.defect_avoider = defect_avoider
        self.rotation_manager = RotationManager()
    
    def bottom_left_pack(self, pieces: List[Piece], fabric_rule: FabricRule, 
                          max_length: float = None) -> LayoutResult:
        placed = []
        unplaced = []
        warnings = []
        defects_avoided = 0
        
        fabric_width = fabric_rule.width_mm
        fabric_length = max_length if max_length else float('inf')
        
        sorted_pieces = sorted(pieces, key=lambda p: (p.height_mm, p.width_mm), reverse=True)
        
        current_y = 0
        row_height = 0
        
        for piece in sorted_pieces:
            valid_rotations = self.rotation_manager.get_valid_rotations(piece, fabric_rule)
            
            if not valid_rotations:
                warnings.append(f"裁片 {piece.name} 没有有效的旋转角度，尝试默认角度")
                valid_rotations = [0]
            
            placed_flag = False
            best_placement = None
            
            for rotation in valid_rotations:
                w, h = piece.get_rotated_dimensions(rotation)
                
                candidate_x = 0
                candidate_y = current_y
                
                if candidate_x + w > fabric_width:
                    candidate_y += row_height
                    candidate_x = 0
                    row_height = 0
                
                if fabric_length != float('inf') and candidate_y + h > fabric_length:
                    continue
                
                if self.defect_avoider:
                    no_defect, overlapping = self.defect_avoider.check_placement(
                        candidate_x, candidate_y, w, h
                    )
                    
                    if not no_defect:
                        defect_desc = ", ".join([d[0].description for d in overlapping[:3]])
                        warnings.append(f"裁片 {piece.name} 尝试避开瑕疵区: {defect_desc}")
                        defects_avoided += 1
                        
                        valid_positions = self.defect_avoider.find_valid_positions(
                            w, h, fabric_width, fabric_length, placed
                        )
                        if valid_positions:
                            pos = valid_positions[0]
                            candidate_x = pos['x']
                            candidate_y = pos['y']
                        else:
                            continue
                
                overlaps = self._check_overlaps(candidate_x, candidate_y, w, h, placed)
                if not overlaps:
                    if candidate_x + w <= fabric_width:
                        best_placement = {
                            'x': candidate_x,
                            'y': candidate_y,
                            'rotation': rotation,
                            'width': w,
                            'height': h
                        }
                        placed_flag = True
                        break
                
                if not placed_flag:
                    if w <= fabric_width:
                        candidate_x = 0
                        candidate_y = current_y + row_height
                        
                        if fabric_length != float('inf') and candidate_y + h > fabric_length:
                            continue
                        
                        if self.defect_avoider:
                            no_defect, _ = self.defect_avoider.check_placement(
                                candidate_x, candidate_y, w, h
                            )
                            if not no_defect:
                                valid_positions = self.defect_avoider.find_valid_positions(
                                    w, h, fabric_width, fabric_length, placed
                                )
                                if valid_positions:
                                    pos = valid_positions[0]
                                    candidate_x = pos['x']
                                    candidate_y = pos['y']
                                else:
                                    continue
                        
                        overlaps = self._check_overlaps(candidate_x, candidate_y, w, h, placed)
                        if not overlaps:
                            best_placement = {
                                'x': candidate_x,
                                'y': candidate_y,
                                'rotation': rotation,
                                'width': w,
                                'height': h
                            }
                            placed_flag = True
                            break
            
            if placed_flag and best_placement:
                placed_piece = PlacedPiece(
                    piece=piece,
                    x=best_placement['x'],
                    y=best_placement['y'],
                    rotation=best_placement['rotation'],
                    width=best_placement['width'],
                    height=best_placement['height'],
                    fabric_name=fabric_rule.name
                )
                placed.append(placed_piece)
                
                if best_placement['y'] == current_y:
                    row_height = max(row_height, best_placement['height'])
                else:
                    current_y = best_placement['y']
                    row_height = best_placement['height']
            else:
                unplaced.append(piece)
                warnings.append(f"裁片 {piece.name} 无法在当前面料 {fabric_rule.name} 上排布")
        
        total_area_pieces = sum(p.width_mm * p.height_mm for p in pieces)
        total_area_used = fabric_width * (current_y + row_height) if placed else 0
        
        actual_length = max(p.y + p.height for p in placed) if placed else 0
        
        return LayoutResult(
            fabric_name=fabric_rule.name,
            fabric_width=fabric_width,
            fabric_length=actual_length,
            placed_pieces=placed,
            unplaced_pieces=unplaced,
            total_area_used=total_area_used,
            total_area_pieces=total_area_pieces,
            defects_avoided=defects_avoided,
            warnings=warnings
        )
    
    def _check_overlaps(self, x: float, y: float, width: float, height: float, 
                         placed: List[PlacedPiece]) -> bool:
        for p in placed:
            if not (
                x + width <= p.x or
                x >= p.x + p.width or
                y + height <= p.y or
                y >= p.y + p.height
            ):
                return True
        return False


class WasteCalculator:
    @staticmethod
    def calculate_waste(layout: LayoutResult) -> Dict:
        if layout.total_area_used == 0:
            return {
                'total_area': 0,
                'used_area': 0,
                'waste_area': 0,
                'waste_percentage': 0.0,
                'efficiency': 0.0
            }
        
        used_area = sum(p.width * p.height for p in layout.placed_pieces)
        total_area = layout.total_area_used
        waste_area = total_area - used_area
        waste_percentage = (waste_area / total_area * 100) if total_area > 0 else 0
        efficiency = (used_area / total_area * 100) if total_area > 0 else 0
        
        return {
            'total_area': total_area,
            'used_area': used_area,
            'waste_area': waste_area,
            'waste_percentage': round(waste_percentage, 2),
            'efficiency': round(efficiency, 2)
        }
    
    @staticmethod
    def calculate_batch_waste(layouts: List[LayoutResult]) -> Dict:
        total_area = sum(l.total_area_used for l in layouts)
        used_area = sum(sum(p.width * p.height for p in l.placed_pieces) for l in layouts)
        unplaced_area = sum(sum(p.width_mm * p.height_mm for p in l.unplaced_pieces) for l in layouts)
        
        if total_area == 0:
            return {
                'total_area': 0,
                'used_area': 0,
                'unplaced_area': unplaced_area,
                'waste_area': 0,
                'waste_percentage': 0.0,
                'efficiency': 0.0
            }
        
        waste_area = total_area - used_area
        waste_percentage = (waste_area / total_area * 100) if total_area > 0 else 0
        efficiency = (used_area / total_area * 100) if total_area > 0 else 0
        
        return {
            'total_area': total_area,
            'used_area': used_area,
            'unplaced_area': unplaced_area,
            'waste_area': waste_area,
            'waste_percentage': round(waste_percentage, 2),
            'efficiency': round(efficiency, 2)
        }
