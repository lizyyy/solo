from dataclasses import dataclass
import math


@dataclass
class Point:
    x: float = 0.0
    y: float = 0.0

    def __add__(self, other: "Point") -> "Point":
        return Point(self.x + other.x, self.y + other.y)

    def __sub__(self, other: "Point") -> "Point":
        return Point(self.x - other.x, self.y - other.y)

    def __mul__(self, scalar: float) -> "Point":
        return Point(self.x * scalar, self.y * scalar)

    def __truediv__(self, scalar: float) -> "Point":
        return Point(self.x / scalar, self.y / scalar)

    def length(self) -> float:
        return math.sqrt(self.x * self.x + self.y * self.y)

    def distance_to(self, other: "Point") -> float:
        return (self - other).length()

    def rotate(self, angle: float, origin: "Point" = None) -> "Point":
        if origin is None:
            origin = Point(0, 0)
        
        dx = self.x - origin.x
        dy = self.y - origin.y
        
        rad = math.radians(angle)
        cos = math.cos(rad)
        sin = math.sin(rad)
        
        new_x = dx * cos - dy * sin + origin.x
        new_y = dx * sin + dy * cos + origin.y
        
        return Point(new_x, new_y)

    def mirror(self, axis_x: bool = False, axis_y: bool = True, origin: "Point" = None) -> "Point":
        if origin is None:
            origin = Point(0, 0)
        
        dx = self.x - origin.x
        dy = self.y - origin.y
        
        new_x = -dx + origin.x if axis_x else self.x
        new_y = -dy + origin.y if axis_y else self.y
        
        return Point(new_x, new_y)

    def to_tuple(self) -> tuple:
        return (self.x, self.y)

    def to_dict(self) -> dict:
        return {"x": self.x, "y": self.y}

    @classmethod
    def from_dict(cls, data: dict) -> "Point":
        return cls(data.get("x", 0.0), data.get("y", 0.0))

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Point):
            return False
        return abs(self.x - other.x) < 1e-6 and abs(self.y - other.y) < 1e-6

    def __hash__(self) -> int:
        return hash((round(self.x, 6), round(self.y, 6)))
