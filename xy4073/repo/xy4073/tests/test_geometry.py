import unittest
import math

from geometry.point import Point
from geometry.rectangle import Rectangle
from geometry.polygon import Polygon
from geometry.transform import Transform


class TestPoint(unittest.TestCase):
    def test_point_creation(self):
        p = Point(3, 4)
        self.assertEqual(p.x, 3)
        self.assertEqual(p.y, 4)

    def test_point_add(self):
        p1 = Point(1, 2)
        p2 = Point(3, 4)
        result = p1 + p2
        self.assertEqual(result.x, 4)
        self.assertEqual(result.y, 6)

    def test_point_sub(self):
        p1 = Point(5, 5)
        p2 = Point(3, 2)
        result = p1 - p2
        self.assertEqual(result.x, 2)
        self.assertEqual(result.y, 3)

    def test_point_mul(self):
        p = Point(2, 3)
        result = p * 2
        self.assertEqual(result.x, 4)
        self.assertEqual(result.y, 6)

    def test_point_length(self):
        p = Point(3, 4)
        self.assertEqual(p.length(), 5.0)

    def test_point_distance_to(self):
        p1 = Point(0, 0)
        p2 = Point(3, 4)
        self.assertEqual(p1.distance_to(p2), 5.0)

    def test_point_rotate(self):
        p = Point(1, 0)
        origin = Point(0, 0)
        rotated = p.rotate(90, origin)
        self.assertAlmostEqual(rotated.x, 0.0, places=6)
        self.assertAlmostEqual(rotated.y, 1.0, places=6)

    def test_point_mirror(self):
        p = Point(1, 1)
        origin = Point(0, 0)
        mirrored = p.mirror(axis_y=True, origin=origin)
        self.assertEqual(mirrored.x, 1)
        self.assertEqual(mirrored.y, -1)


class TestRectangle(unittest.TestCase):
    def test_rectangle_creation(self):
        r = Rectangle(0, 0, 10, 20)
        self.assertEqual(r.x, 0)
        self.assertEqual(r.y, 0)
        self.assertEqual(r.width, 10)
        self.assertEqual(r.height, 20)

    def test_rectangle_properties(self):
        r = Rectangle(5, 10, 20, 30)
        self.assertEqual(r.left, 5)
        self.assertEqual(r.right, 25)
        self.assertEqual(r.top, 10)
        self.assertEqual(r.bottom, 40)

    def test_rectangle_center(self):
        r = Rectangle(0, 0, 10, 20)
        center = r.center
        self.assertEqual(center.x, 5)
        self.assertEqual(center.y, 10)

    def test_rectangle_area(self):
        r = Rectangle(0, 0, 10, 20)
        self.assertEqual(r.area(), 200)

    def test_rectangle_contains_point(self):
        r = Rectangle(0, 0, 10, 10)
        self.assertTrue(r.contains_point(Point(5, 5)))
        self.assertTrue(r.contains_point(Point(0, 0)))
        self.assertTrue(r.contains_point(Point(10, 10)))
        self.assertFalse(r.contains_point(Point(11, 5)))
        self.assertFalse(r.contains_point(Point(5, 11)))

    def test_rectangle_intersects(self):
        r1 = Rectangle(0, 0, 10, 10)
        r2 = Rectangle(5, 5, 10, 10)
        r3 = Rectangle(15, 15, 5, 5)
        
        self.assertTrue(r1.intersects(r2))
        self.assertFalse(r1.intersects(r3))

    def test_rectangle_get_intersection(self):
        r1 = Rectangle(0, 0, 10, 10)
        r2 = Rectangle(5, 5, 10, 10)
        intersection = r1.get_intersection(r2)
        
        self.assertEqual(intersection.x, 5)
        self.assertEqual(intersection.y, 5)
        self.assertEqual(intersection.width, 5)
        self.assertEqual(intersection.height, 5)

    def test_rectangle_expand(self):
        r = Rectangle(0, 0, 10, 10)
        expanded = r.expand(2)
        
        self.assertEqual(expanded.x, -2)
        self.assertEqual(expanded.y, -2)
        self.assertEqual(expanded.width, 14)
        self.assertEqual(expanded.height, 14)

    def test_rectangle_from_points(self):
        points = [
            Point(1, 2),
            Point(5, 1),
            Point(3, 6)
        ]
        r = Rectangle.from_points(points)
        
        self.assertEqual(r.x, 1)
        self.assertEqual(r.y, 1)
        self.assertEqual(r.width, 4)
        self.assertEqual(r.height, 5)


class TestPolygon(unittest.TestCase):
    def test_polygon_creation(self):
        points = [
            Point(0, 0),
            Point(10, 0),
            Point(10, 10),
            Point(0, 10)
        ]
        p = Polygon(points)
        self.assertEqual(len(p.points), 5)

    def test_polygon_is_closed(self):
        points = [
            Point(0, 0),
            Point(10, 0),
            Point(10, 10),
            Point(0, 10)
        ]
        p = Polygon(points)
        self.assertTrue(p.is_closed())

    def test_polygon_area(self):
        points = [
            Point(0, 0),
            Point(10, 0),
            Point(10, 10),
            Point(0, 10)
        ]
        p = Polygon(points)
        self.assertEqual(p.area(), 100.0)

    def test_polygon_area_triangle(self):
        points = [
            Point(0, 0),
            Point(10, 0),
            Point(10, 10)
        ]
        p = Polygon(points)
        self.assertEqual(p.area(), 50.0)

    def test_polygon_get_bounds(self):
        points = [
            Point(1, 2),
            Point(5, 1),
            Point(3, 6)
        ]
        p = Polygon(points)
        bounds = p.get_bounds()
        
        self.assertEqual(bounds.x, 1)
        self.assertEqual(bounds.y, 1)
        self.assertEqual(bounds.width, 4)
        self.assertEqual(bounds.height, 5)

    def test_polygon_contains_point(self):
        points = [
            Point(0, 0),
            Point(10, 0),
            Point(10, 10),
            Point(0, 10)
        ]
        p = Polygon(points)
        
        self.assertTrue(p.contains_point(Point(5, 5)))
        self.assertFalse(p.contains_point(Point(15, 5)))

    def test_polygon_rotate(self):
        points = [
            Point(0, 0),
            Point(2, 0),
            Point(2, 1),
            Point(0, 1)
        ]
        p = Polygon(points)
        origin = Point(1, 0.5)
        rotated = p.rotate(90, origin)
        
        rotated_bounds = rotated.get_bounds()
        original_bounds = p.get_bounds()
        
        self.assertAlmostEqual(rotated_bounds.width, original_bounds.height, places=6)
        self.assertAlmostEqual(rotated_bounds.height, original_bounds.width, places=6)

    def test_polygon_translate(self):
        points = [
            Point(0, 0),
            Point(10, 0),
            Point(10, 10),
            Point(0, 10)
        ]
        p = Polygon(points)
        translated = p.translate(5, 10)
        
        bounds = translated.get_bounds()
        self.assertEqual(bounds.x, 5)
        self.assertEqual(bounds.y, 10)

    def test_polygon_intersects(self):
        square1 = Polygon([
            Point(0, 0),
            Point(10, 0),
            Point(10, 10),
            Point(0, 10)
        ])
        
        square2 = Polygon([
            Point(5, 5),
            Point(15, 5),
            Point(15, 15),
            Point(5, 15)
        ])
        
        square3 = Polygon([
            Point(15, 15),
            Point(20, 15),
            Point(20, 20),
            Point(15, 20)
        ])
        
        self.assertTrue(square1.intersects(square2))
        self.assertFalse(square1.intersects(square3))


class TestTransform(unittest.TestCase):
    def test_get_relative_angle(self):
        self.assertEqual(Transform.get_relative_angle(0, 0), 0)
        self.assertEqual(Transform.get_relative_angle(90, 0), 90)
        self.assertEqual(Transform.get_relative_angle(0, 90), -90)
        self.assertEqual(Transform.get_relative_angle(350, 10), -20)

    def test_is_angle_aligned(self):
        self.assertTrue(Transform.is_angle_aligned(0, 0))
        self.assertTrue(Transform.is_angle_aligned(0, 180))
        self.assertTrue(Transform.is_angle_aligned(90, 270))
        self.assertFalse(Transform.is_angle_aligned(0, 45))

    def test_snap_to_grid(self):
        self.assertEqual(Transform.snap_to_grid(1.2, 1.0), 1.0)
        self.assertEqual(Transform.snap_to_grid(1.6, 1.0), 2.0)
        self.assertEqual(Transform.snap_to_grid(1.25, 0.5), 1.0)

    def test_snap_angle(self):
        self.assertEqual(Transform.snap_angle(10, 45), 0)
        self.assertEqual(Transform.snap_angle(25, 45), 45)
        self.assertEqual(Transform.snap_angle(50, 45), 45)

    def test_get_transformed_polygon(self):
        points = [
            Point(0, 0),
            Point(10, 0),
            Point(10, 10),
            Point(0, 10)
        ]
        position = Point(5, 10)
        
        transformed = Transform.get_transformed_polygon(
            points, position, 0, False
        )
        
        bounds = transformed.get_bounds()
        self.assertEqual(bounds.x, 5)
        self.assertEqual(bounds.y, 10)

    def test_get_bounds_after_transform(self):
        points = [
            Point(0, 0),
            Point(10, 0),
            Point(10, 20),
            Point(0, 20)
        ]
        position = Point(5, 10)
        
        bounds = Transform.get_bounds_after_transform(
            points, position, 90, False
        )
        
        self.assertAlmostEqual(bounds.width, 20.0, places=6)
        self.assertAlmostEqual(bounds.height, 10.0, places=6)


if __name__ == '__main__':
    unittest.main()
