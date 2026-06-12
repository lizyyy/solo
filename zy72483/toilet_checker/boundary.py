from typing import List, Tuple, Optional
from .models import Point, Street, PointType


class BoundaryChecker:
    BOUNDARY_THRESHOLD = 0.0003

    def __init__(self, streets: List[Street]):
        self.streets = streets

    def point_to_segment_distance(self, point: Tuple[float, float],
                                   seg_start: Tuple[float, float],
                                   seg_end: Tuple[float, float]) -> float:
        px, py = point
        x1, y1 = seg_start
        x2, y2 = seg_end

        dx = x2 - x1
        dy = y2 - y1

        if dx == 0 and dy == 0:
            return ((px - x1) ** 2 + (py - y1) ** 2) ** 0.5

        t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)
        t = max(0, min(1, t))

        nearest_x = x1 + t * dx
        nearest_y = y1 + t * dy

        return ((px - nearest_x) ** 2 + (py - nearest_y) ** 2) ** 0.5

    def point_to_street_boundary_distance(self, point: Tuple[float, float],
                                           street: Street) -> float:
        min_dist = float('inf')
        boundary = street.boundary
        for i in range(len(boundary)):
            seg_start = boundary[i]
            seg_end = boundary[(i + 1) % len(boundary)]
            dist = self.point_to_segment_distance(point, seg_start, seg_end)
            min_dist = min(min_dist, dist)
        return min_dist

    def point_in_polygon(self, point: Tuple[float, float],
                          polygon: List[Tuple[float, float]]) -> bool:
        px, py = point
        n = len(polygon)
        inside = False
        j = n - 1
        for i in range(n):
            xi, yi = polygon[i]
            xj, yj = polygon[j]
            if ((yi > py) != (yj > py)) and (px < (xj - xi) * (py - yi) / (yj - yi) + xi):
                inside = not inside
            j = i
        return inside

    def get_streets_for_point(self, point: Point) -> List[Street]:
        result = []
        point_coord = (point.lng, point.lat)
        for street in self.streets:
            if self.point_in_polygon(point_coord, street.boundary):
                result.append(street)
            else:
                dist = self.point_to_street_boundary_distance(point_coord, street)
                if dist < self.BOUNDARY_THRESHOLD:
                    result.append(street)
        return result

    def check_boundary(self, point: Point) -> Tuple[bool, List[Street]]:
        streets = self.get_streets_for_point(point)
        if len(streets) >= 2:
            return True, streets
        return False, streets

    def process_point(self, point: Point) -> Point:
        is_boundary, streets = self.check_boundary(point)
        point.street_ids = [s.id for s in streets]
        if point.point_type == PointType.NIGHT_SAMPLING:
            point.is_night_sampling = True
        if is_boundary and not point.is_on_boundary:
            street_names = [s.name for s in streets]
            point.mark_boundary(street_names)
        elif not is_boundary:
            point.is_on_boundary = False
        return point

    def process_all_points(self, points: List[Point]) -> List[Point]:
        return [self.process_point(p) for p in points]
