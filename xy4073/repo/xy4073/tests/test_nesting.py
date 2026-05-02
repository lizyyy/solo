import unittest

from models.piece import Piece, PiecePlacement
from models.fabric import FabricSettings
from models.project import Project
from geometry.point import Point
from nesting.algorithm import (
    NestingConfig,
    NestingResult,
    BottomLeftNesting,
    NestingEngine
)


class TestNestingConfig(unittest.TestCase):
    def test_default_config(self):
        config = NestingConfig()
        
        self.assertEqual(config.fabric_width, 150.0)
        self.assertEqual(config.safety_margin, 0.5)
        self.assertTrue(config.allow_rotation)
        self.assertEqual(config.rotation_steps, [0, 90, 180, 270])

    def test_config_from_dict(self):
        data = {
            "fabric_width": 120.0,
            "safety_margin": 2.0,
            "allow_rotation": False,
            "rotation_steps": [0, 180]
        }
        
        config = NestingConfig.from_dict(data)
        
        self.assertEqual(config.fabric_width, 120.0)
        self.assertEqual(config.safety_margin, 2.0)
        self.assertFalse(config.allow_rotation)
        self.assertEqual(config.rotation_steps, [0, 180])

    def test_config_to_dict(self):
        config = NestingConfig(
            fabric_width=120.0,
            safety_margin=2.0,
            allow_rotation=True
        )
        
        data = config.to_dict()
        
        self.assertEqual(data["fabric_width"], 120.0)
        self.assertEqual(data["safety_margin"], 2.0)
        self.assertTrue(data["allow_rotation"])


class TestBottomLeftNesting(unittest.TestCase):
    def setUp(self):
        self.algorithm = BottomLeftNesting()
        self.config = NestingConfig(
            fabric_width=150.0,
            safety_margin=0.5,
            allow_rotation=True,
            rotation_steps=[0, 90, 180, 270]
        )
        self.algorithm.config = self.config

    def test_nest_single_piece(self):
        p = Piece()
        p.id = "p1"
        p.name = "裁片1"
        p.points = [
            Point(0, 0), Point(10, 0), Point(10, 20), Point(0, 20)
        ]
        p.area = 200.0
        p.quantity = 1
        
        pieces = [p]
        
        result = self.algorithm.nest(pieces)
        
        self.assertTrue(result.is_successful)
        self.assertEqual(len(result.placements), 1)
        self.assertTrue(result.placements[0].is_placed)

    def test_nest_multiple_pieces(self):
        p1 = Piece()
        p1.id = "p1"
        p1.name = "裁片1"
        p1.points = [
            Point(0, 0), Point(20, 0), Point(20, 20), Point(0, 20)
        ]
        p1.area = 400.0
        p1.quantity = 1
        
        p2 = Piece()
        p2.id = "p2"
        p2.name = "裁片2"
        p2.points = [
            Point(0, 0), Point(20, 0), Point(20, 20), Point(0, 20)
        ]
        p2.area = 400.0
        p2.quantity = 1
        
        pieces = [p1, p2]
        
        result = self.algorithm.nest(pieces)
        
        self.assertTrue(result.is_successful)
        self.assertEqual(len(result.placements), 2)
        self.assertTrue(result.placements[0].is_placed)
        self.assertTrue(result.placements[1].is_placed)

    def test_nest_rotate_to_fit(self):
        self.config.fabric_width = 30.0
        
        p = Piece()
        p.id = "p1"
        p.name = "裁片1"
        p.can_rotate = True
        p.points = [
            Point(0, 0), Point(40, 0), Point(40, 20), Point(0, 20)
        ]
        p.area = 800.0
        p.quantity = 1
        
        pieces = [p]
        
        result = self.algorithm.nest(pieces)
        
        self.assertTrue(result.is_successful)
        self.assertEqual(len(result.placements), 1)
        self.assertTrue(result.placements[0].is_placed)

    def test_nest_rotation_disabled(self):
        self.config.fabric_width = 30.0
        self.config.allow_rotation = False
        
        p = Piece()
        p.id = "p1"
        p.name = "裁片1"
        p.can_rotate = False
        p.points = [
            Point(0, 0), Point(40, 0), Point(40, 20), Point(0, 20)
        ]
        p.area = 800.0
        p.quantity = 1
        
        pieces = [p]
        
        result = self.algorithm.nest(pieces)
        
        self.assertFalse(result.is_successful)

    def test_used_length_calculation(self):
        p1 = Piece()
        p1.id = "p1"
        p1.name = "裁片1"
        p1.points = [
            Point(0, 0), Point(20, 0), Point(20, 30), Point(0, 30)
        ]
        p1.area = 600.0
        p1.quantity = 1
        
        p2 = Piece()
        p2.id = "p2"
        p2.name = "裁片2"
        p2.points = [
            Point(0, 0), Point(20, 0), Point(20, 20), Point(0, 20)
        ]
        p2.area = 400.0
        p2.quantity = 1
        
        pieces = [p1, p2]
        
        result = self.algorithm.nest(pieces)
        
        self.assertTrue(result.is_successful)
        self.assertGreater(result.fabric_length, 0)

    def test_efficiency_calculation(self):
        p1 = Piece()
        p1.id = "p1"
        p1.name = "裁片1"
        p1.points = [
            Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)
        ]
        p1.area = 100.0
        p1.quantity = 1
        
        pieces = [p1]
        
        result = self.algorithm.nest(pieces)
        
        self.assertTrue(result.is_successful)
        self.assertGreaterEqual(result.used_area, 0)


class TestNestingEngine(unittest.TestCase):
    def setUp(self):
        self.engine = NestingEngine()

    def test_run_nesting(self):
        project = Project()
        project.fabric_settings.width = 150.0
        
        p1 = Piece()
        p1.id = "p1"
        p1.name = "裁片1"
        p1.points = [
            Point(0, 0), Point(20, 0), Point(20, 20), Point(0, 20)
        ]
        p1.area = 400.0
        p1.quantity = 1
        
        project.pieces = [p1]
        
        result = self.engine.nest(project.pieces, project.fabric_settings)
        
        self.assertIsNotNone(result)
        self.assertTrue(result.is_successful)

    def test_nest_with_placements(self):
        p1 = Piece()
        p1.id = "p1"
        p1.name = "裁片1"
        p1.points = [
            Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)
        ]
        p1.area = 100.0
        p1.quantity = 1
        
        placement = PiecePlacement(piece=p1)
        
        fabric = FabricSettings(width=150.0)
        
        result = self.engine.nest_with_placements([placement], fabric)
        
        self.assertIsNotNone(result)


if __name__ == '__main__':
    unittest.main()
