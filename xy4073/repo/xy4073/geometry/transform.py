from typing import List
import math

from geometry.point import Point
from geometry.rectangle import Rectangle
from geometry.polygon import Polygon


class Transform:
    @staticmethod
    def rotate_polygon(polygon: Polygon, angle: float, origin: Point = None) -> Polygon:
        return polygon.rotate(angle, origin)

    @staticmethod
    def translate_polygon(polygon: Polygon, dx: float, dy: float) -> Polygon:
        return polygon.translate(dx, dy)

    @staticmethod
    def mirror_polygon(polygon: Polygon, axis_x: bool = False, axis_y: bool = True, origin: Point = None) -> Polygon:
        return polygon.mirror(axis_x, axis_y, origin)

    @staticmethod
    def get_transformed_polygon(
        points: List[Point],
        position: Point,
        rotation: float,
        mirror: bool = False,
        origin: Point = None
    ) -> Polygon:
        polygon = Polygon(points.copy())
        
        if mirror:
            polygon = polygon.mirror(origin=origin)
        
        if rotation != 0:
            polygon = polygon.rotate(rotation, origin)
        
        polygon = polygon.translate(position.x, position.y)
        
        return polygon

    @staticmethod
    def get_bounds_after_transform(
        points: List[Point],
        position: Point,
        rotation: float,
        mirror: bool = False
    ) -> Rectangle:
        if not points:
            return Rectangle()
        
        origin = Rectangle.from_points(points).center
        
        polygon = Polygon(points.copy())
        if mirror:
            polygon = polygon.mirror(origin=origin)
        if rotation != 0:
            polygon = polygon.rotate(rotation, origin)
        polygon = polygon.translate(position.x, position.y)
        
        return polygon.get_bounds()

    @staticmethod
    def rotate_points(points: List[Point], angle: float, origin: Point = None) -> List[Point]:
        if origin is None and points:
            bounds = Rectangle.from_points(points)
            origin = bounds.center
        
        return [p.rotate(angle, origin) for p in points]

    @staticmethod
    def translate_points(points: List[Point], dx: float, dy: float) -> List[Point]:
        return [Point(p.x + dx, p.y + dy) for p in points]

    @staticmethod
    def mirror_points(points: List[Point], axis_x: bool = False, axis_y: bool = True, origin: Point = None) -> List[Point]:
        if origin is None and points:
            bounds = Rectangle.from_points(points)
            origin = bounds.center
        
        return [p.mirror(axis_x, axis_y, origin) for p in points]

    @staticmethod
    def get_relative_angle(angle1: float, angle2: float) -> float:
        diff = (angle1 - angle2) % 360
        if diff > 180:
            diff -= 360
        return diff

    @staticmethod
    def is_angle_aligned(angle1: float, angle2: float, tolerance: float = 1.0) -> bool:
        diff = abs(Transform.get_relative_angle(angle1, angle2))
        return diff <= tolerance or abs(diff - 180) <= tolerance

    @staticmethod
    def snap_to_grid(value: float, grid_size: float) -> float:
        if grid_size <= 0:
            return value
        return round(value / grid_size) * grid_size

    @staticmethod
    def snap_point_to_grid(point: Point, grid_size: float) -> Point:
        return Point(
            Transform.snap_to_grid(point.x, grid_size),
            Transform.snap_to_grid(point.y, grid_size)
        )

    @staticmethod
    def snap_angle(angle: float, snap_increment: float = 45.0) -> float:
        if snap_increment <= 0:
            return angle
        return round(angle / snap_increment) * snap_increment
