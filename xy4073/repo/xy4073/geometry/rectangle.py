from dataclasses import dataclass
from typing import List, Tuple
from geometry.point import Point


@dataclass
class Rectangle:
    x: float = 0.0
    y: float = 0.0
    width: float = 0.0
    height: float = 0.0

    @property
    def left(self) -> float:
        return self.x

    @property
    def right(self) -> float:
        return self.x + self.width

    @property
    def top(self) -> float:
        return self.y

    @property
    def bottom(self) -> float:
        return self.y + self.height

    @property
    def center(self) -> Point:
        return Point(self.x + self.width / 2, self.y + self.height / 2)

    def area(self) -> float:
        return self.width * self.height

    def get_corners(self) -> List[Point]:
        return [
            Point(self.left, self.top),
            Point(self.right, self.top),
            Point(self.right, self.bottom),
            Point(self.left, self.bottom),
        ]

    def contains_point(self, point: Point) -> bool:
        return (self.left <= point.x <= self.right and 
                self.top <= point.y <= self.bottom)

    def intersects(self, other: "Rectangle") -> bool:
        return not (self.right < other.left or 
                    self.left > other.right or 
                    self.bottom < other.top or 
                    self.top > other.bottom)

    def get_intersection(self, other: "Rectangle") -> "Rectangle":
        if not self.intersects(other):
            return Rectangle(0, 0, 0, 0)
        
        x = max(self.left, other.left)
        y = max(self.top, other.top)
        width = min(self.right, other.right) - x
        height = min(self.bottom, other.bottom) - y
        
        return Rectangle(x, y, width, height)

    def union(self, other: "Rectangle") -> "Rectangle":
        x = min(self.left, other.left)
        y = min(self.top, other.top)
        width = max(self.right, other.right) - x
        height = max(self.bottom, other.bottom) - y
        
        return Rectangle(x, y, width, height)

    def expand(self, margin: float) -> "Rectangle":
        return Rectangle(
            self.x - margin,
            self.y - margin,
            self.width + 2 * margin,
            self.height + 2 * margin
        )

    def to_dict(self) -> dict:
        return {
            "x": self.x,
            "y": self.y,
            "width": self.width,
            "height": self.height
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Rectangle":
        return cls(
            data.get("x", 0.0),
            data.get("y", 0.0),
            data.get("width", 0.0),
            data.get("height", 0.0)
        )

    @classmethod
    def from_points(cls, points: List[Point]) -> "Rectangle":
        if not points:
            return cls()
        
        min_x = min(p.x for p in points)
        max_x = max(p.x for p in points)
        min_y = min(p.y for p in points)
        max_y = max(p.y for p in points)
        
        return cls(min_x, min_y, max_x - min_x, max_y - min_y)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Rectangle):
            return False
        return (abs(self.x - other.x) < 1e-6 and 
                abs(self.y - other.y) < 1e-6 and 
                abs(self.width - other.width) < 1e-6 and 
                abs(self.height - other.height) < 1e-6)
