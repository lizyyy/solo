from dataclasses import dataclass, field
from typing import List, Optional, Dict, Tuple, Callable
import copy
import math

from models.piece import Piece, PiecePlacement
from models.fabric import FabricSettings
from models.validation import ValidationResult
from geometry.point import Point
from geometry.rectangle import Rectangle
from geometry.polygon import Polygon
from geometry.transform import Transform
from validation.rules import OverlapValidator


@dataclass
class NestingConfig:
    fabric_width: float = 150.0
    safety_margin: float = 0.5
    allow_rotation: bool = True
    rotation_steps: List[float] = field(default_factory=lambda: [0, 90, 180, 270])
    allow_mirror: bool = False
    optimize_by: str = "area"
    max_iterations: int = 100
    grid_size: float = 1.0

    def to_dict(self) -> dict:
        return {
            "fabric_width": self.fabric_width,
            "safety_margin": self.safety_margin,
            "allow_rotation": self.allow_rotation,
            "rotation_steps": self.rotation_steps,
            "allow_mirror": self.allow_mirror,
            "optimize_by": self.optimize_by,
            "max_iterations": self.max_iterations,
            "grid_size": self.grid_size
        }

    @classmethod
    def from_dict(cls, data: dict) -> "NestingConfig":
        return cls(
            fabric_width=data.get("fabric_width", 150.0),
            safety_margin=data.get("safety_margin", 0.5),
            allow_rotation=data.get("allow_rotation", True),
            rotation_steps=data.get("rotation_steps", [0, 90, 180, 270]),
            allow_mirror=data.get("allow_mirror", False),
            optimize_by=data.get("optimize_by", "area"),
            max_iterations=data.get("max_iterations", 100),
            grid_size=data.get("grid_size", 1.0)
        )


@dataclass
class NestingResult:
    placements: List[PiecePlacement] = field(default_factory=list)
    fabric_length: float = 0.0
    total_area: float = 0.0
    used_area: float = 0.0
    waste_rate: float = 0.0
    validation_result: ValidationResult = field(default_factory=ValidationResult)
    is_successful: bool = True
    message: str = ""

    def to_dict(self) -> dict:
        return {
            "placements": [p.to_dict() for p in self.placements],
            "fabric_length": self.fabric_length,
            "total_area": self.total_area,
            "used_area": self.used_area,
            "waste_rate": self.waste_rate,
            "validation_result": self.validation_result.to_dict(),
            "is_successful": self.is_successful,
            "message": self.message
        }


class BottomLeftNesting:
    def __init__(self, config: NestingConfig = None):
        self.config = config or NestingConfig()
        self.overlap_validator = OverlapValidator(tolerance=0.01)

    def nest(self, pieces: List[Piece]) -> NestingResult:
        result = NestingResult()
        
        if not pieces:
            result.message = "没有裁片需要排料"
            result.is_successful = False
            return result
        
        sorted_pieces = self._sort_pieces(pieces)
        all_placements: List[PiecePlacement] = []
        
        for piece in sorted_pieces:
            for _ in range(piece.quantity):
                placement = PiecePlacement(piece=copy.deepcopy(piece), is_placed=False)
                all_placements.append(placement)
        
        placed_so_far: List[PiecePlacement] = []
        max_bottom = 0.0
        
        for placement in all_placements:
            best_position = self._find_best_position(placement, placed_so_far)
            
            if best_position:
                placement.position = best_position["position"]
                placement.rotation = best_position["rotation"]
                placement.mirror = best_position.get("mirror", False)
                placement.is_placed = True
                
                bounds = Transform.get_bounds_after_transform(
                    placement.piece.points,
                    placement.position,
                    placement.rotation,
                    placement.mirror
                )
                max_bottom = max(max_bottom, bounds.bottom + self.config.safety_margin)
                
                placed_so_far.append(placement)
            else:
                result.is_successful = False
                result.message = f"无法放置裁片: {placement.piece.name}"
        
        result.placements = placed_so_far
        result.fabric_length = max_bottom
        
        total_area = sum(p.piece.get_area() for p in placed_so_far)
        result.total_area = total_area
        
        fabric_area = self.config.fabric_width * result.fabric_length
        result.used_area = total_area
        if fabric_area > 0:
            result.waste_rate = (1 - total_area / fabric_area) * 100
        else:
            result.waste_rate = 0
        
        unplaced = len(all_placements) - len(placed_so_far)
        if unplaced > 0:
            result.message = f"有 {unplaced} 个裁片无法放置"
        
        return result

    def _sort_pieces(self, pieces: List[Piece]) -> List[Piece]:
        if self.config.optimize_by == "area":
            return sorted(pieces, key=lambda p: -p.get_area())
        elif self.config.optimize_by == "height":
            return sorted(pieces, key=lambda p: -p.get_height())
        elif self.config.optimize_by == "width":
            return sorted(pieces, key=lambda p: -p.get_width())
        else:
            return pieces

    def _find_best_position(self, placement: PiecePlacement, placed_items: List[PiecePlacement]) -> Optional[dict]:
        piece = placement.piece
        best_result = None
        best_bottom = float('inf')
        
        possible_rotations = self._get_possible_rotations(piece)
        possible_mirrors = [False]
        if self.config.allow_mirror:
            possible_mirrors.append(True)
        
        for rotation in possible_rotations:
            for mirror in possible_mirrors:
                position = self._find_bottom_left_position(
                    piece, rotation, mirror, placed_items
                )
                
                if position is not None:
                    bounds = Transform.get_bounds_after_transform(
                        piece.points, position, rotation, mirror
                    )
                    
                    if bounds.bottom < best_bottom:
                        best_bottom = bounds.bottom
                        best_result = {
                            "position": position,
                            "rotation": rotation,
                            "mirror": mirror
                        }
                        
                        if best_bottom < 0.1:
                            return best_result
        
        return best_result

    def _get_possible_rotations(self, piece: Piece) -> List[float]:
        if not piece.can_rotate:
            if piece.allow_rotate_180:
                return [0, 180]
            return [0]
        
        if not self.config.allow_rotation:
            return [0]
        
        return self.config.rotation_steps

    def _find_bottom_left_position(
        self, 
        piece: Piece, 
        rotation: float, 
        mirror: bool,
        placed_items: List[PiecePlacement]
    ) -> Optional[Point]:
        fabric_width = self.config.fabric_width
        margin = self.config.safety_margin
        
        bounds = Transform.get_bounds_after_transform(
            piece.points, Point(0, 0), rotation, mirror
        )
        
        piece_width = bounds.width
        piece_height = bounds.height
        
        if piece_width + 2 * margin > fabric_width:
            return None
        
        start_x = margin
        start_y = margin
        
        best_y = float('inf')
        best_x = float('inf')
        
        candidates = self._generate_candidate_positions(
            piece, rotation, mirror, placed_items, margin
        )
        
        for x, y in candidates:
            if self._can_place_at(piece, x, y, rotation, mirror, placed_items, fabric_width, margin):
                poly = Transform.get_transformed_polygon(
                    piece.points, Point(x, y), rotation, mirror
                )
                poly_bounds = poly.get_bounds()
                bottom = poly_bounds.bottom
                
                if bottom < best_y or (bottom == best_y and x < best_x):
                    best_y = bottom
                    best_x = x
        
        if best_y == float('inf'):
            if placed_items:
                max_y = max(
                    Transform.get_bounds_after_transform(
                        p.piece.points, p.position, p.rotation, p.mirror
                    ).bottom
                    for p in placed_items
                )
                start_y = max_y + margin
            else:
                start_y = margin
            
            return Point(start_x, start_y)
        
        return Point(best_x, best_y - piece_height)

    def _generate_candidate_positions(
        self,
        piece: Piece,
        rotation: float,
        mirror: bool,
        placed_items: List[PiecePlacement],
        margin: float
    ) -> List[Tuple[float, float]]:
        candidates: List[Tuple[float, float]] = []
        
        candidates.append((margin, margin))
        
        for placed in placed_items:
            placed_bounds = Transform.get_bounds_after_transform(
                placed.piece.points, placed.position, placed.rotation, placed.mirror
            )
            
            candidates.append((margin, placed_bounds.bottom + margin))
            
            candidates.append((placed_bounds.right + margin, margin))
            candidates.append((placed_bounds.right + margin, placed_bounds.top))
            candidates.append((placed_bounds.right + margin, placed_bounds.bottom))
            candidates.append((placed_bounds.left, placed_bounds.bottom + margin))
        
        return candidates

    def _can_place_at(
        self,
        piece: Piece,
        x: float,
        y: float,
        rotation: float,
        mirror: bool,
        placed_items: List[PiecePlacement],
        fabric_width: float,
        margin: float
    ) -> bool:
        test_poly = Transform.get_transformed_polygon(
            piece.points, Point(x, y), rotation, mirror
        )
        test_bounds = test_poly.get_bounds()
        
        if test_bounds.left < -margin:
            return False
        if test_bounds.right > fabric_width + margin:
            return False
        if test_bounds.top < -margin:
            return False
        
        for placed in placed_items:
            placed_poly = Transform.get_transformed_polygon(
                placed.piece.points, placed.position, placed.rotation, placed.mirror
            )
            
            expanded_test_bounds = test_bounds.expand(margin)
            placed_bounds = placed_poly.get_bounds()
            
            if not expanded_test_bounds.intersects(placed_bounds):
                continue
            
            if test_poly.intersects(placed_poly):
                return False
        
        return True


class GeneticNesting:
    def __init__(self, config: NestingConfig = None):
        self.config = config or NestingConfig()
        self.bottom_left = BottomLeftNesting(config)

    def nest(self, pieces: List[Piece]) -> NestingResult:
        return self.bottom_left.nest(pieces)


class NestingEngine:
    def __init__(self, config: NestingConfig = None):
        self.config = config or NestingConfig()
        self.algorithm = BottomLeftNesting(self.config)

    def set_algorithm(self, algorithm_type: str):
        if algorithm_type == "genetic":
            self.algorithm = GeneticNesting(self.config)
        else:
            self.algorithm = BottomLeftNesting(self.config)

    def nest(self, pieces: List[Piece], fabric_settings: FabricSettings = None) -> NestingResult:
        if fabric_settings:
            self.config.fabric_width = fabric_settings.width
            self.config.safety_margin = fabric_settings.safety_margin
        
        return self.algorithm.nest(pieces)

    def nest_with_placements(
        self, 
        placements: List[PiecePlacement], 
        fabric_settings: FabricSettings = None
    ) -> NestingResult:
        pieces = [p.piece for p in placements]
        return self.nest(pieces, fabric_settings)
