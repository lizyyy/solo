import unittest

from bend_checker.models.part import Part, Bend, Hole, BendDirection, HoleType
from bend_checker.models.material import Material, MaterialLibrary
from bend_checker.geometry.unfold import UnfoldCalculator
from bend_checker.geometry.sequence import BendSequencePlanner


class TestUnfoldCalculator(unittest.TestCase):
    
    def setUp(self):
        self.material_lib = MaterialLibrary.create_default_library()
        self.spcc_1p5 = self.material_lib.get_material("SPCC", 1.5)
        
        self.part = Part(
            part_number="TEST-001",
            part_name="测试零件",
            material_grade="SPCC",
            material_thickness=1.5,
            quantity=10,
            overall_length=150.0,
            overall_width=80.0
        )
        
        bend1 = Bend(
            id="B1",
            bend_angle=90.0,
            bend_radius=1.5,
            flange_length=25.0,
            inside_length=100.0,
            direction=BendDirection.UP
        )
        self.part.add_bend(bend1)
        
        bend2 = Bend(
            id="B2",
            bend_angle=90.0,
            bend_radius=1.5,
            flange_length=25.0,
            inside_length=100.0,
            direction=BendDirection.UP
        )
        self.part.add_bend(bend2)
    
    def test_calculate_single_bend(self):
        bend = self.part.bends[0]
        detail = UnfoldCalculator.calculate_single_bend(bend, self.spcc_1p5, 100.0)
        
        self.assertEqual(detail['bend_id'], 'B1')
        self.assertEqual(detail['bend_angle'], 90.0)
        self.assertIn('k_factor', detail)
        self.assertIn('bend_deduction', detail)
        self.assertGreater(detail['bend_deduction'], 0)
    
    def test_calculate_part_unfold(self):
        result = UnfoldCalculator.calculate_part_unfold(self.part, self.material_lib, 100.0)
        
        self.assertEqual(result.part_number, 'TEST-001')
        self.assertGreater(result.unfolded_length, 0)
        self.assertEqual(len(result.bend_details), 2)
        self.assertGreater(result.total_bend_deduction, 0)
    
    def test_calculate_part_unfold_with_holes(self):
        hole = Hole(
            id="H1",
            hole_type=HoleType.CIRCULAR,
            diameter=8.0,
            distance_to_nearest_bend=15.0
        )
        self.part.add_hole(hole)
        
        result = UnfoldCalculator.calculate_part_unfold(self.part, self.material_lib, 100.0)
        
        self.assertEqual(result.part_number, 'TEST-001')
        self.assertEqual(len(self.part.holes), 1)
    
    def test_calculate_blank_size(self):
        bends_info = [
            {'angle': 90.0, 'radius': 1.5},
            {'angle': 90.0, 'radius': 1.5}
        ]
        
        blank_size = UnfoldCalculator.calculate_blank_size(
            material_thickness=1.5,
            bends=bends_info,
            overall_dimension=150.0,
            k_factor=0.35
        )
        
        self.assertLess(blank_size, 150.0)
        self.assertGreater(blank_size, 0)


class TestBendSequencePlanner(unittest.TestCase):
    
    def setUp(self):
        self.part = Part(
            part_number="SEQ-001",
            part_name="顺序测试零件",
            material_grade="SPCC",
            material_thickness=1.5,
            quantity=5
        )
        
        bend1 = Bend(
            id="B1",
            bend_angle=90.0,
            bend_radius=1.5,
            flange_length=30.0,
            inside_length=100.0,
            direction=BendDirection.UP
        )
        self.part.add_bend(bend1)
        
        bend2 = Bend(
            id="B2",
            bend_angle=90.0,
            bend_radius=1.5,
            flange_length=20.0,
            inside_length=80.0,
            direction=BendDirection.DOWN
        )
        self.part.add_bend(bend2)
    
    def test_plan_sequence(self):
        result = BendSequencePlanner.plan_sequence(self.part)
        
        self.assertEqual(result.part_number, 'SEQ-001')
        self.assertEqual(len(result.bend_ids), 2)
        self.assertEqual(result.total_steps, 2)
        self.assertEqual(len(result.recommended_sequence), 2)
    
    def test_plan_sequence_with_risk(self):
        short_flange_bend = Bend(
            id="B3",
            bend_angle=90.0,
            bend_radius=1.5,
            flange_length=3.0,
            inside_length=50.0,
            direction=BendDirection.UP
        )
        self.part.add_bend(short_flange_bend)
        
        result = BendSequencePlanner.plan_sequence(self.part)
        
        self.assertEqual(result.total_steps, 3)
        self.assertGreaterEqual(len(result.risks), 1)
    
    def test_validate_sequence_valid(self):
        sequence = ["B1", "B2"]
        is_valid, issues = BendSequencePlanner.validate_sequence(sequence, self.part)
        
        self.assertTrue(is_valid)
        self.assertEqual(len(issues), 0)
    
    def test_validate_sequence_invalid(self):
        sequence = ["B1", "B3"]
        is_valid, issues = BendSequencePlanner.validate_sequence(sequence, self.part)
        
        self.assertFalse(is_valid)
        self.assertGreater(len(issues), 0)
    
    def test_get_flange_order_heuristic(self):
        order = BendSequencePlanner.get_flange_order_heuristic(self.part)
        
        self.assertEqual(len(order), 2)
        self.assertEqual(order[0][1].split(':')[1].strip(), '30.0mm')


if __name__ == '__main__':
    unittest.main()
