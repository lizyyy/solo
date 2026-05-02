from typing import List, Optional, Callable
from abc import ABC, abstractmethod

from models.piece import Piece, PiecePlacement
from models.fabric import FabricSettings, NoPlaceZone
from models.validation import (
    ValidationResult, ValidationError, 
    ValidationSeverity, ValidationType
)
from geometry.point import Point
from geometry.rectangle import Rectangle
from geometry.polygon import Polygon
from geometry.transform import Transform


class BaseValidator(ABC):
    @abstractmethod
    def validate(self, placements: List[PiecePlacement], fabric: FabricSettings) -> List[ValidationError]:
        pass

    def create_error(
        self,
        error_type: ValidationType,
        severity: ValidationSeverity,
        message: str,
        piece_ids: List[str] = None,
        details: dict = None
    ) -> ValidationError:
        return ValidationError(
            type=error_type,
            severity=severity,
            message=message,
            piece_ids=piece_ids or [],
            details=details or {}
        )


class OverlapValidator(BaseValidator):
    def __init__(self, tolerance: float = 0.1):
        self.tolerance = tolerance

    def validate(self, placements: List[PiecePlacement], fabric: FabricSettings) -> List[ValidationError]:
        errors = []
        placed_items = [p for p in placements if p.is_placed]
        
        for i in range(len(placed_items)):
            for j in range(i + 1, len(placed_items)):
                p1 = placed_items[i]
                p2 = placed_items[j]
                
                if self._check_overlap(p1, p2):
                    error = self.create_error(
                        error_type=ValidationType.OVERLAP,
                        severity=ValidationSeverity.ERROR,
                        message=f"裁片 '{p1.piece.name}' 与 '{p2.piece.name}' 发生重叠",
                        piece_ids=[p1.piece.id, p2.piece.id],
                        details={
                            "piece1_name": p1.piece.name,
                            "piece2_name": p2.piece.name
                        }
                    )
                    errors.append(error)
        
        return errors

    def _check_overlap(self, p1: PiecePlacement, p2: PiecePlacement) -> bool:
        poly1 = self._get_polygon(p1)
        poly2 = self._get_polygon(p2)
        
        return poly1.intersects(poly2)

    def _get_polygon(self, placement: PiecePlacement) -> Polygon:
        return Transform.get_transformed_polygon(
            placement.piece.points,
            placement.position,
            placement.rotation,
            placement.mirror
        )


class OutOfBoundsValidator(BaseValidator):
    def __init__(self, tolerance: float = 0.1):
        self.tolerance = tolerance

    def validate(self, placements: List[PiecePlacement], fabric: FabricSettings) -> List[ValidationError]:
        errors = []
        placed_items = [p for p in placements if p.is_placed]
        
        fabric_width = fabric.width
        safety_margin = fabric.safety_margin
        
        for placement in placed_items:
            bounds = self._get_bounds(placement)
            
            min_x = bounds.left - safety_margin
            max_x = bounds.right + safety_margin
            min_y = bounds.top - safety_margin
            max_y = bounds.bottom + safety_margin
            
            issues = []
            
            if min_x < -self.tolerance:
                issues.append("左边界越界")
            if max_x > fabric_width + self.tolerance:
                issues.append("右边界越界")
            if min_y < -self.tolerance:
                issues.append("上边界越界")
            
            if issues:
                error = self.create_error(
                    error_type=ValidationType.OUT_OF_BOUNDS,
                    severity=ValidationSeverity.ERROR,
                    message=f"裁片 '{placement.piece.name}' {'、'.join(issues)}",
                    piece_ids=[placement.piece.id],
                    details={
                        "piece_name": placement.piece.name,
                        "issues": issues,
                        "bounds": {
                            "left": bounds.left,
                            "right": bounds.right,
                            "top": bounds.top,
                            "bottom": bounds.bottom
                        },
                        "fabric_width": fabric_width
                    }
                )
                errors.append(error)
        
        return errors

    def _get_bounds(self, placement: PiecePlacement) -> Rectangle:
        return Transform.get_bounds_after_transform(
            placement.piece.points,
            placement.position,
            placement.rotation,
            placement.mirror
        )


class GrainDirectionValidator(BaseValidator):
    def __init__(self, tolerance: float = 1.0):
        self.tolerance = tolerance

    def validate(self, placements: List[PiecePlacement], fabric: FabricSettings) -> List[ValidationError]:
        errors = []
        placed_items = [p for p in placements if p.is_placed]
        
        fabric_grain = fabric.grain_direction
        
        for placement in placed_items:
            piece = placement.piece
            
            if not piece.can_rotate:
                expected_angle = piece.grain_direction
                actual_angle = placement.rotation
                
                if not Transform.is_angle_aligned(expected_angle, actual_angle, self.tolerance):
                    diff = Transform.get_relative_angle(expected_angle, actual_angle)
                    error = self.create_error(
                        error_type=ValidationType.GRAIN_DIRECTION,
                        severity=ValidationSeverity.WARNING,
                        message=f"裁片 '{piece.name}' 纹向不一致。期望: {expected_angle}°, 实际: {actual_angle}°, 偏差: {diff:.1f}°",
                        piece_ids=[piece.id],
                        details={
                            "piece_name": piece.name,
                            "expected_angle": expected_angle,
                            "actual_angle": actual_angle,
                            "deviation": diff
                        }
                    )
                    errors.append(error)
        
        return errors


class PlaidMatchValidator(BaseValidator):
    def __init__(self, tolerance: float = 0.5):
        self.tolerance = tolerance

    def validate(self, placements: List[PiecePlacement], fabric: FabricSettings) -> List[ValidationError]:
        errors = []
        
        if not fabric.has_plaid:
            return errors
        
        plaid_width_x = fabric.plaid_width_x
        plaid_width_y = fabric.plaid_width_y
        plaid_offset_x = fabric.plaid_offset_x
        plaid_offset_y = fabric.plaid_offset_y
        
        placed_items = [p for p in placements if p.is_placed and p.piece.has_plaid_match]
        
        for placement in placed_items:
            piece = placement.piece
            
            piece_offset_x = piece.plaid_offset_x
            piece_offset_y = piece.plaid_offset_y
            
            actual_x = placement.position.x + piece_offset_x
            actual_y = placement.position.y + piece_offset_y
            
            aligned_x = self._is_aligned(actual_x - plaid_offset_x, plaid_width_x)
            aligned_y = self._is_aligned(actual_y - plaid_offset_y, plaid_width_y)
            
            if not aligned_x or not aligned_y:
                issues = []
                if not aligned_x:
                    issues.append("水平方向")
                if not aligned_y:
                    issues.append("垂直方向")
                
                error = self.create_error(
                    error_type=ValidationType.PLAID_MISMATCH,
                    severity=ValidationSeverity.WARNING,
                    message=f"裁片 '{piece.name}' 格纹对齐失败: {'、'.join(issues)}",
                    piece_ids=[piece.id],
                    details={
                        "piece_name": piece.name,
                        "plaid_width_x": plaid_width_x,
                        "plaid_width_y": plaid_width_y,
                        "actual_x": actual_x,
                        "actual_y": actual_y,
                        "issues": issues
                    }
                )
                errors.append(error)
        
        return errors

    def _is_aligned(self, position: float, grid_size: float) -> bool:
        if grid_size <= 0:
            return True
        
        remainder = position % grid_size
        return remainder <= self.tolerance or (grid_size - remainder) <= self.tolerance


class DuplicatePieceValidator(BaseValidator):
    def validate(self, placements: List[PiecePlacement], fabric: FabricSettings) -> List[ValidationError]:
        errors = []
        piece_count: dict = {}
        
        for placement in placements:
            piece = placement.piece
            if piece.id not in piece_count:
                piece_count[piece.id] = {
                    "name": piece.name,
                    "expected": piece.quantity,
                    "actual": 0,
                    "placed": 0
                }
            piece_count[piece.id]["actual"] += 1
            if placement.is_placed:
                piece_count[piece.id]["placed"] += 1
        
        for piece_id, count_info in piece_count.items():
            expected = count_info["expected"]
            placed = count_info["placed"]
            
            if placed > expected:
                error = self.create_error(
                    error_type=ValidationType.DUPLICATE_PIECE,
                    severity=ValidationSeverity.ERROR,
                    message=f"裁片 '{count_info['name']}' 放置数量过多。期望: {expected}, 实际放置: {placed}",
                    piece_ids=[piece_id],
                    details={
                        "piece_name": count_info["name"],
                        "expected": expected,
                        "placed": placed
                    }
                )
                errors.append(error)
            elif placed < expected:
                error = self.create_error(
                    error_type=ValidationType.DUPLICATE_PIECE,
                    severity=ValidationSeverity.WARNING,
                    message=f"裁片 '{count_info['name']}' 放置数量不足。期望: {expected}, 实际放置: {placed}",
                    piece_ids=[piece_id],
                    details={
                        "piece_name": count_info["name"],
                        "expected": expected,
                        "placed": placed
                    }
                )
                errors.append(error)
        
        return errors


class NoPlaceZoneValidator(BaseValidator):
    def validate(self, placements: List[PiecePlacement], fabric: FabricSettings) -> List[ValidationError]:
        errors = []
        placed_items = [p for p in placements if p.is_placed]
        
        for zone in fabric.no_place_zones:
            zone_rect = zone.zone
            
            for placement in placed_items:
                bounds = Transform.get_bounds_after_transform(
                    placement.piece.points,
                    placement.position,
                    placement.rotation,
                    placement.mirror
                )
                
                if bounds.intersects(zone_rect):
                    error = self.create_error(
                        error_type=ValidationType.NO_PLACE_ZONE,
                        severity=ValidationSeverity.ERROR,
                        message=f"裁片 '{placement.piece.name}' 位于禁放区域 '{zone.name}' 内: {zone.reason}",
                        piece_ids=[placement.piece.id],
                        details={
                            "piece_name": placement.piece.name,
                            "zone_name": zone.name,
                            "zone_reason": zone.reason
                        }
                    )
                    errors.append(error)
        
        return errors


class ValidationEngine:
    def __init__(self):
        self.validators: List[BaseValidator] = [
            OverlapValidator(),
            OutOfBoundsValidator(),
            GrainDirectionValidator(),
            PlaidMatchValidator(),
            DuplicatePieceValidator(),
            NoPlaceZoneValidator()
        ]

    def validate(self, placements: List[PiecePlacement], fabric: FabricSettings) -> ValidationResult:
        result = ValidationResult()
        
        for validator in self.validators:
            errors = validator.validate(placements, fabric)
            for error in errors:
                result.add_error(error)
        
        return result

    def add_validator(self, validator: BaseValidator):
        self.validators.append(validator)

    def remove_validator(self, validator_type: type):
        self.validators = [v for v in self.validators if not isinstance(v, validator_type)]
