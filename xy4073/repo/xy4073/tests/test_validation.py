import unittest

from models.piece import Piece, PiecePlacement
from models.fabric import FabricSettings
from models.validation import ValidationType, ValidationSeverity
from geometry.point import Point
from validation.rules import (
    ValidationEngine,
    OverlapValidator,
    OutOfBoundsValidator,
    GrainDirectionValidator,
    PlaidMatchValidator,
    DuplicatePieceValidator,
    NoPlaceZoneValidator
)


class TestOverlapValidator(unittest.TestCase):
    def setUp(self):
        self.validator = OverlapValidator(tolerance=0.01)
        self.fabric = FabricSettings(width=150.0)

    def test_no_overlap(self):
        p1 = Piece()
        p1.name = "裁片1"
        p1.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        p2 = Piece()
        p2.name = "裁片2"
        p2.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        placement1 = PiecePlacement(piece=p1, position=Point(0, 0), is_placed=True)
        placement2 = PiecePlacement(piece=p2, position=Point(20, 0), is_placed=True)
        
        errors = self.validator.validate([placement1, placement2], self.fabric)
        self.assertEqual(len(errors), 0)

    def test_overlap_detected(self):
        p1 = Piece()
        p1.name = "裁片1"
        p1.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        p2 = Piece()
        p2.name = "裁片2"
        p2.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        placement1 = PiecePlacement(piece=p1, position=Point(0, 0), is_placed=True)
        placement2 = PiecePlacement(piece=p2, position=Point(5, 0), is_placed=True)
        
        errors = self.validator.validate([placement1, placement2], self.fabric)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].type, ValidationType.OVERLAP)
        self.assertEqual(errors[0].severity, ValidationSeverity.ERROR)

    def test_ignore_not_placed(self):
        p1 = Piece()
        p1.name = "裁片1"
        p1.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        p2 = Piece()
        p2.name = "裁片2"
        p2.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        placement1 = PiecePlacement(piece=p1, position=Point(0, 0), is_placed=True)
        placement2 = PiecePlacement(piece=p2, position=Point(5, 0), is_placed=False)
        
        errors = self.validator.validate([placement1, placement2], self.fabric)
        self.assertEqual(len(errors), 0)


class TestOutOfBoundsValidator(unittest.TestCase):
    def setUp(self):
        self.validator = OutOfBoundsValidator(tolerance=0.01)
        self.fabric = FabricSettings(width=100.0, safety_margin=0.0)

    def test_within_bounds(self):
        p = Piece()
        p.name = "裁片"
        p.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        placement = PiecePlacement(piece=p, position=Point(50, 0), is_placed=True)
        
        errors = self.validator.validate([placement], self.fabric)
        self.assertEqual(len(errors), 0)

    def test_left_boundary_violation(self):
        p = Piece()
        p.name = "裁片"
        p.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        placement = PiecePlacement(piece=p, position=Point(-5, 0), is_placed=True)
        
        errors = self.validator.validate([placement], self.fabric)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].type, ValidationType.OUT_OF_BOUNDS)

    def test_right_boundary_violation(self):
        p = Piece()
        p.name = "裁片"
        p.points = [Point(0, 0), Point(20, 0), Point(20, 10), Point(0, 10)]
        
        placement = PiecePlacement(piece=p, position=Point(90, 0), is_placed=True)
        
        errors = self.validator.validate([placement], self.fabric)
        self.assertEqual(len(errors), 1)

    def test_with_safety_margin(self):
        self.fabric.safety_margin = 5.0
        
        p = Piece()
        p.name = "裁片"
        p.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        placement = PiecePlacement(piece=p, position=Point(2, 0), is_placed=True)
        
        errors = self.validator.validate([placement], self.fabric)
        self.assertEqual(len(errors), 1)


class TestGrainDirectionValidator(unittest.TestCase):
    def setUp(self):
        self.validator = GrainDirectionValidator(tolerance=1.0)
        self.fabric = FabricSettings(grain_direction=0.0)

    def test_can_rotate_no_warning(self):
        p = Piece()
        p.name = "裁片"
        p.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        p.can_rotate = True
        p.grain_direction = 0.0
        
        placement = PiecePlacement(piece=p, position=Point(0, 0), rotation=90, is_placed=True)
        
        errors = self.validator.validate([placement], self.fabric)
        self.assertEqual(len(errors), 0)

    def test_fixed_grain_warning(self):
        p = Piece()
        p.name = "裁片"
        p.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        p.can_rotate = False
        p.grain_direction = 0.0
        
        placement = PiecePlacement(piece=p, position=Point(0, 0), rotation=45, is_placed=True)
        
        errors = self.validator.validate([placement], self.fabric)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].type, ValidationType.GRAIN_DIRECTION)
        self.assertEqual(errors[0].severity, ValidationSeverity.WARNING)

    def test_180_rotation_allowed(self):
        p = Piece()
        p.name = "裁片"
        p.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        p.can_rotate = False
        p.allow_rotate_180 = True
        p.grain_direction = 0.0
        
        placement = PiecePlacement(piece=p, position=Point(0, 0), rotation=180, is_placed=True)
        
        errors = self.validator.validate([placement], self.fabric)
        self.assertEqual(len(errors), 0)


class TestPlaidMatchValidator(unittest.TestCase):
    def setUp(self):
        self.validator = PlaidMatchValidator(tolerance=0.5)
        self.fabric = FabricSettings(
            has_plaid=True,
            plaid_width_x=10.0,
            plaid_width_y=10.0,
            plaid_offset_x=0.0,
            plaid_offset_y=0.0
        )

    def test_no_plaid_no_warning(self):
        self.fabric.has_plaid = False
        
        p = Piece()
        p.name = "裁片"
        p.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        p.has_plaid_match = True
        p.plaid_offset_x = 0.0
        p.plaid_offset_y = 0.0
        
        placement = PiecePlacement(piece=p, position=Point(3, 3), is_placed=True)
        
        errors = self.validator.validate([placement], self.fabric)
        self.assertEqual(len(errors), 0)

    def test_no_piece_plaid_no_warning(self):
        self.fabric.has_plaid = True
        
        p = Piece()
        p.name = "裁片"
        p.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        p.has_plaid_match = False
        
        placement = PiecePlacement(piece=p, position=Point(3, 3), is_placed=True)
        
        errors = self.validator.validate([placement], self.fabric)
        self.assertEqual(len(errors), 0)

    def test_plaid_aligned(self):
        self.fabric.has_plaid = True
        
        p = Piece()
        p.name = "裁片"
        p.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        p.has_plaid_match = True
        p.plaid_offset_x = 0.0
        p.plaid_offset_y = 0.0
        
        placement = PiecePlacement(piece=p, position=Point(10, 10), is_placed=True)
        
        errors = self.validator.validate([placement], self.fabric)
        self.assertEqual(len(errors), 0)

    def test_plaid_mismatch(self):
        self.fabric.has_plaid = True
        
        p = Piece()
        p.name = "裁片"
        p.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        p.has_plaid_match = True
        p.plaid_offset_x = 0.0
        p.plaid_offset_y = 0.0
        
        placement = PiecePlacement(piece=p, position=Point(3, 3), is_placed=True)
        
        errors = self.validator.validate([placement], self.fabric)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].type, ValidationType.PLAID_MISMATCH)


class TestDuplicatePieceValidator(unittest.TestCase):
    def setUp(self):
        self.validator = DuplicatePieceValidator()
        self.fabric = FabricSettings()

    def test_correct_quantity(self):
        p1 = Piece()
        p1.id = "p1"
        p1.name = "裁片1"
        p1.quantity = 1
        p1.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        placement1 = PiecePlacement(piece=p1, is_placed=True)
        
        errors = self.validator.validate([placement1], self.fabric)
        self.assertEqual(len(errors), 0)

    def test_missing_piece(self):
        p1 = Piece()
        p1.id = "p1"
        p1.name = "裁片1"
        p1.quantity = 2
        p1.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        placement1 = PiecePlacement(piece=p1, is_placed=True)
        
        errors = self.validator.validate([placement1], self.fabric)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].type, ValidationType.DUPLICATE_PIECE)
        self.assertEqual(errors[0].severity, ValidationSeverity.WARNING)

    def test_extra_piece(self):
        p1 = Piece()
        p1.id = "p1"
        p1.name = "裁片1"
        p1.quantity = 1
        p1.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        placement1 = PiecePlacement(piece=p1, is_placed=True)
        placement2 = PiecePlacement(piece=p1, is_placed=True)
        
        errors = self.validator.validate([placement1, placement2], self.fabric)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0].type, ValidationType.DUPLICATE_PIECE)
        self.assertEqual(errors[0].severity, ValidationSeverity.ERROR)


class TestValidationEngine(unittest.TestCase):
    def setUp(self):
        self.engine = ValidationEngine()
        self.fabric = FabricSettings(width=100.0)

    def test_validation_engine_runs_all_validators(self):
        p1 = Piece()
        p1.id = "p1"
        p1.name = "裁片1"
        p1.quantity = 1
        p1.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        p2 = Piece()
        p2.id = "p2"
        p2.name = "裁片2"
        p2.quantity = 1
        p2.points = [Point(0, 0), Point(10, 0), Point(10, 10), Point(0, 10)]
        
        placement1 = PiecePlacement(piece=p1, position=Point(0, 0), is_placed=True)
        placement2 = PiecePlacement(piece=p2, position=Point(5, 0), is_placed=True)
        
        result = self.engine.validate([placement1, placement2], self.fabric)
        
        self.assertFalse(result.is_valid)
        self.assertTrue(result.has_errors())


if __name__ == '__main__':
    unittest.main()
