from dataclasses import dataclass, field
from typing import List, Tuple, Optional
import math

from geometry.point import Point
from geometry.rectangle import Rectangle


@dataclass
class Polygon:
    points: List[Point] = field(default_factory=list)

    def __post_init__(self):
        if len(self.points) > 0 and self.points[0] != self.points[-1]:
            self.points = self.points + [self.points[0]]

    def is_closed(self) -> bool:
        if len(self.points) < 2:
            return False
        return self.points[0] == self.points[-1]

    def area(self) -> float:
        if len(self.points) < 3:
            return 0.0
        
        area = 0.0
        n = len(self.points)
        if not self.is_closed():
            n += 1
        
        for i in range(len(self.points) - 1):
            j = (i + 1) % len(self.points)
            area += self.points[i].x * self.points[j].y
            area -= self.points[j].x * self.points[i].y
        
        return abs(area) / 2.0

    def get_bounds(self) -> Rectangle:
        if not self.points:
            return Rectangle()
        return Rectangle.from_points(self.points)

    def get_center(self) -> Point:
        if not self.points:
            return Point(0, 0)
        
        bounds = self.get_bounds()
        return bounds.center

    def contains_point(self, point: Point) -> bool:
        if len(self.points) < 3:
            return False
        
        n = len(self.points)
        inside = False
        
        j = n - 1
        for i in range(n):
            xi, yi = self.points[i].x, self.points[i].y
            xj, yj = self.points[j].x, self.points[j].y
            
            if ((yi > point.y) != (yj > point.y)):
                if point.x < (xj - xi) * (point.y - yi) / (yj - yi + 1e-10) + xi:
                    inside = not inside
            j = i
        
        return inside

    def get_edges(self) -> List[Tuple[Point, Point]]:
        edges = []
        n = len(self.points)
        for i in range(n - 1):
            edges.append((self.points[i], self.points[i + 1]))
        return edges

    def rotate(self, angle: float, origin: Point = None) -> "Polygon":
        if origin is None:
            origin = self.get_center()
        
        rotated_points = [p.rotate(angle, origin) for p in self.points]
        return Polygon(rotated_points)

    def translate(self, dx: float, dy: float) -> "Polygon":
        translated_points = [Point(p.x + dx, p.y + dy) for p in self.points]
        return Polygon(translated_points)

    def mirror(self, axis_x: bool = False, axis_y: bool = True, origin: Point = None) -> "Polygon":
        if origin is None:
            origin = self.get_center()
        
        mirrored_points = [p.mirror(axis_x, axis_y, origin) for p in self.points]
        return Polygon(mirrored_points)

    def scale(self, factor: float) -> "Polygon":
        scaled_points = [Point(p.x * factor, p.y * factor) for p in self.points]
        return Polygon(scaled_points)

    def intersects(self, other: "Polygon") -> bool:
        for i in range(len(self.points) - 1):
            for j in range(len(other.points) - 1):
                if self._segments_intersect(
                    self.points[i], self.points[i + 1],
                    other.points[j], other.points[j + 1]
                ):
                    return True
        
        for point in self.points:
            if other.contains_point(point):
                return True
        
        for point in other.points:
            if self.contains_point(point):
                return True
        
        return False

    def _segments_intersect(self, a1: Point, a2: Point, b1: Point, b2: Point) -> bool:
        def ccw(A: Point, B: Point, C: Point) -> bool:
            return (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x)
        
        if ccw(a1, b1, b2) != ccw(a2, b1, b2) and ccw(a1, a2, b1) != ccw(a1, a2, b2):
            return True
        
        def on_segment(p: Point, q: Point, r: Point) -> bool:
            return (min(p.x, r.x) - 1e-6 <= q.x <= max(p.x, r.x) + 1e-6 and
                    min(p.y, r.y) - 1e-6 <= q.y <= max(p.y, r.y) + 1e-6)
        
        def collinear(p: Point, q: Point, r: Point) -> bool:
            return abs((q.y - p.y) * (r.x - p.x) - (q.x - p.x) * (r.y - p.y)) < 1e-6
        
        if collinear(a1, a2, b1) and on_segment(a1, b1, a2):
            return True
        if collinear(a1, a2, b2) and on_segment(a1, b2, a2):
            return True
        if collinear(b1, b2, a1) and on_segment(b1, a1, b2):
            return True
        if collinear(b1, b2, a2) and on_segment(b1, a2, b2):
            return True
        
        return False

    def to_dict(self) -> dict:
        return {"points": [p.to_dict() for p in self.points]}

    @classmethod
    def from_dict(cls, data: dict) -> "Polygon":
        points_data = data.get("points", [])
        points = [Point.from_dict(p) for p in points_data]
        return cls(points)

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Polygon):
            return False
        if len(self.points) != len(other.points):
            return False
        return all(p1 == p2 for p1, p2 in zip(self.points, other.points))
