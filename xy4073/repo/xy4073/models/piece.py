from dataclasses import dataclass, field
from typing import List, Optional, Tuple
import uuid
from geometry.point import Point
from geometry.polygon import Polygon


@dataclass
class Piece:
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str = ""
    color: str = "#4A90D9"
    points: List[Point] = field(default_factory=list)
    rotation: float = 0.0
    can_rotate: bool = True
    allow_rotate_180: bool = True
    grain_direction: float = 0.0
    has_plaid_match: bool = False
    plaid_offset_x: float = 0.0
    plaid_offset_y: float = 0.0
    notes: str = ""
    quantity: int = 1
    mirror: bool = False

    def get_bounds(self) -> Tuple[float, float, float, float]:
        if not self.points:
            return (0, 0, 0, 0)
        min_x = min(p.x for p in self.points)
        max_x = max(p.x for p in self.points)
        min_y = min(p.y for p in self.points)
        max_y = max(p.y for p in self.points)
        return (min_x, min_y, max_x, max_y)

    def get_width(self) -> float:
        bounds = self.get_bounds()
        return bounds[2] - bounds[0]

    def get_height(self) -> float:
        bounds = self.get_bounds()
        return bounds[3] - bounds[1]

    def get_area(self) -> float:
        from geometry.polygon import Polygon
        poly = Polygon(self.points)
        return poly.area()

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "points": [{"x": p.x, "y": p.y} for p in self.points],
            "rotation": self.rotation,
            "can_rotate": self.can_rotate,
            "allow_rotate_180": self.allow_rotate_180,
            "grain_direction": self.grain_direction,
            "has_plaid_match": self.has_plaid_match,
            "plaid_offset_x": self.plaid_offset_x,
            "plaid_offset_y": self.plaid_offset_y,
            "notes": self.notes,
            "quantity": self.quantity,
            "mirror": self.mirror
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Piece":
        piece = cls(
            id=data.get("id", str(uuid.uuid4())[:8]),
            name=data.get("name", ""),
            color=data.get("color", "#4A90D9"),
            rotation=data.get("rotation", 0.0),
            can_rotate=data.get("can_rotate", True),
            allow_rotate_180=data.get("allow_rotate_180", True),
            grain_direction=data.get("grain_direction", 0.0),
            has_plaid_match=data.get("has_plaid_match", False),
            plaid_offset_x=data.get("plaid_offset_x", 0.0),
            plaid_offset_y=data.get("plaid_offset_y", 0.0),
            notes=data.get("notes", ""),
            quantity=data.get("quantity", 1),
            mirror=data.get("mirror", False)
        )
        points_data = data.get("points", [])
        piece.points = [Point(p.get("x", 0), p.get("y", 0)) for p in points_data]
        return piece


@dataclass
class PiecePlacement:
    piece: Piece
    position: Point = field(default_factory=lambda: Point(0, 0))
    rotation: float = 0.0
    mirror: bool = False
    is_placed: bool = False

    def to_dict(self) -> dict:
        return {
            "piece": self.piece.to_dict(),
            "position": {"x": self.position.x, "y": self.position.y},
            "rotation": self.rotation,
            "mirror": self.mirror,
            "is_placed": self.is_placed
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PiecePlacement":
        piece = Piece.from_dict(data.get("piece", {}))
        position = Point(
            data.get("position", {}).get("x", 0),
            data.get("position", {}).get("y", 0)
        )
        return cls(
            piece=piece,
            position=position,
            rotation=data.get("rotation", 0.0),
            mirror=data.get("mirror", False),
            is_placed=data.get("is_placed", False)
        )
