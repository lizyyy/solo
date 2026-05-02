import unittest
import os
import tempfile

from bend_checker.models.part import Part, Bend, Hole, BendDirection, HoleType
from bend_checker.models.material import MaterialLibrary
from bend_checker.models.machine import MachineLibrary
from bend_checker.models.die import DieSet
from bend_checker.rules.interference import InterferenceChecker
from bend_checker.rules.tonnage import TonnageCalculator
from bend_checker.rules.hole_distance import HoleDistanceChecker
from bend_checker.rules.duplicate import DuplicateChecker


class TestInterferenceChecker(unittest.TestCase):
    
    def setUp(self):
        self.part = Part(
            part_number="INT-001",
            part_name="干涉测试零件",
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
            flange_length=25.0,
            inside_length=80.0,
            direction=BendDirection.DOWN
        )
        self.part.add_bend(bend2)
        
        self.die_set = DieSet.create_default_die_set()
    
    def test_check_all_no_interference(self):
        result = InterferenceChecker.check_all(self.part, die_set=self.die_set)
        
        self.assertEqual(result.part_number, 'INT-001')
        self.assertFalse(result.has_issues)
        self.assertEqual(result.safe_operations, 2)
        self.assertEqual(result.risky_operations, 0)
    
    def test_check_all_with_short_flange(self):
        short_flange_part = Part(
            part_number="INT-002",
            part_name="短法兰零件",
            material_grade="SPCC",
            material_thickness=1.5
        )
        
        bend1 = Bend(
            id="B1",
            bend_angle=90.0,
            bend_radius=1.5,
            flange_length=2.0,
            inside_length=50.0,
            direction=BendDirection.UP
        )
        short_flange_part.add_bend(bend1)
        
        bend2 = Bend(
            id="B2",
            bend_angle=90.0,
            bend_radius=1.5,
            flange_length=3.0,
            inside_length=50.0,
            direction=BendDirection.DOWN
        )
        short_flange_part.add_bend(bend2)
        
        result = InterferenceChecker.check_all(short_flange_part, die_set=self.die_set)
        
        self.assertTrue(result.has_issues)
        self.assertGreater(len(result.issues), 0)
    
    def test_check_single_bend_interference(self):
        bend1 = self.part.bends[0]
        bend2 = self.part.bends[1]
        
        risk = InterferenceChecker.check_single_bend_interference(
            bend1, [bend2], 1.5
        )
        
        self.assertIn('collision_risk', risk)
        self.assertIn('severity', risk)


class TestTonnageCalculator(unittest.TestCase):
    
    def setUp(self):
        self.material_lib = MaterialLibrary.create_default_library()
        self.machine_lib = MachineLibrary.create_default_library()
        self.die_set = DieSet.create_default_die_set()
        
        self.part = Part(
            part_number="TON-001",
            part_name="吨位测试零件",
            material_grade="SPCC",
            material_thickness=1.5,
            quantity=10
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
    
    def test_calculate_tonnage(self):
        result = TonnageCalculator.calculate(
            self.part, self.material_lib, self.machine_lib, self.die_set, 100.0
        )
        
        self.assertEqual(result.part_number, 'TON-001')
        self.assertGreater(result.total_tonnage, 0)
        self.assertIn('B1', result.per_bend_tonnage)
        self.assertGreater(len(result.suitable_machines), 0)
    
    def test_calculate_for_parameters(self):
        tonnage = TonnageCalculator.calculate_for_parameters(
            material_thickness=1.5,
            bend_length=100.0,
            tensile_strength=270.0,
            bend_angle=90.0
        )
        
        self.assertGreater(tonnage, 0)
    
    def test_check_machine_suitability(self):
        machine = self.machine_lib.get_machine("AMADA_RG35")
        
        suitability = TonnageCalculator.check_machine_suitability(machine, 10.0, 100.0)
        
        self.assertEqual(suitability['machine_id'], 'AMADA_RG35')
        self.assertIn('status', suitability)
    
    def test_get_tonnage_breakdown(self):
        breakdown = TonnageCalculator.get_tonnage_breakdown(
            self.part, self.material_lib
        )
        
        self.assertEqual(len(breakdown), 1)
        self.assertEqual(breakdown[0]['bend_id'], 'B1')
        self.assertIn('base_tonnage', breakdown[0])


class TestHoleDistanceChecker(unittest.TestCase):
    
    def setUp(self):
        self.part = Part(
            part_number="HOL-001",
            part_name="孔边距测试零件",
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
    
    def test_check_all_safe_hole(self):
        safe_hole = Hole(
            id="H1",
            hole_type=HoleType.CIRCULAR,
            diameter=8.0,
            distance_to_nearest_bend=15.0
        )
        self.part.add_hole(safe_hole)
        
        result = HoleDistanceChecker.check_all(self.part)
        
        self.assertEqual(result.part_number, 'HOL-001')
        self.assertFalse(result.has_risks)
        self.assertEqual(result.safe_holes, 1)
        self.assertEqual(result.at_risk_holes, 0)
    
    def test_check_all_risky_hole(self):
        risky_hole = Hole(
            id="H2",
            hole_type=HoleType.CIRCULAR,
            diameter=8.0,
            distance_to_nearest_bend=2.0
        )
        self.part.add_hole(risky_hole)
        
        result = HoleDistanceChecker.check_all(self.part)
        
        self.assertTrue(result.has_risks)
        self.assertGreater(len(result.issues), 0)
        self.assertEqual(result.at_risk_holes, 1)
    
    def test_check_single_hole(self):
        hole = Hole(
            id="H3",
            hole_type=HoleType.CIRCULAR,
            diameter=10.0,
            distance_to_nearest_bend=10.0
        )
        
        result = HoleDistanceChecker.check_single_hole(hole, self.part.bends, 1.5)
        
        self.assertEqual(result['hole_id'], 'H3')
        self.assertIn('risk_level', result)
        self.assertIn('distance', result)
    
    def test_get_hole_summary(self):
        hole1 = Hole(id="H1", hole_type=HoleType.CIRCULAR, diameter=8.0)
        hole2 = Hole(id="H2", hole_type=HoleType.SLOTTED, width=20.0, height=8.0)
        
        self.part.add_hole(hole1)
        self.part.add_hole(hole2)
        
        summary = HoleDistanceChecker.get_hole_summary(self.part)
        
        self.assertEqual(summary['total_holes'], 2)
        self.assertIn('circular', summary['by_type'])
        self.assertIn('slotted', summary['by_type'])


class TestDuplicateChecker(unittest.TestCase):
    
    def setUp(self):
        self.part1 = Part(
            part_number="DUP-001",
            part_name="原始零件",
            material_grade="SPCC",
            material_thickness=1.5,
            quantity=10
        )
        
        bend1 = Bend(
            id="B1",
            bend_angle=90.0,
            bend_radius=1.5,
            flange_length=30.0,
            inside_length=100.0,
            direction=BendDirection.UP
        )
        self.part1.add_bend(bend1)
        
        self.part2 = Part(
            part_number="DUP-002",
            part_name="重复零件",
            material_grade="SPCC",
            material_thickness=1.5,
            quantity=15
        )
        
        bend2 = Bend(
            id="B1",
            bend_angle=90.0,
            bend_radius=1.5,
            flange_length=30.0,
            inside_length=100.0,
            direction=BendDirection.UP
        )
        self.part2.add_bend(bend2)
        
        self.part3 = Part(
            part_number="DUP-003",
            part_name="不同零件",
            material_grade="SUS304",
            material_thickness=1.0,
            quantity=5
        )
        
        bend3 = Bend(
            id="B1",
            bend_angle=90.0,
            bend_radius=1.0,
            flange_length=20.0,
            inside_length=80.0,
            direction=BendDirection.UP
        )
        self.part3.add_bend(bend3)
    
    def test_check_all_with_duplicates(self):
        parts = [self.part1, self.part2, self.part3]
        
        result = DuplicateChecker.check_all(parts)
        
        self.assertEqual(result.total_parts, 3)
        self.assertEqual(result.unique_groups, 2)
        self.assertEqual(result.duplicates_found, 1)
        self.assertEqual(len(result.duplicate_groups), 1)
    
    def test_check_all_no_duplicates(self):
        parts = [self.part1, self.part3]
        
        result = DuplicateChecker.check_all(parts)
        
        self.assertEqual(result.total_parts, 2)
        self.assertEqual(result.unique_groups, 2)
        self.assertEqual(result.duplicates_found, 0)
        self.assertEqual(len(result.duplicate_groups), 0)
    
    def test_check_pair_duplicate(self):
        result = DuplicateChecker.check_pair(self.part1, self.part2)
        
        self.assertEqual(result['part1'], 'DUP-001')
        self.assertEqual(result['part2'], 'DUP-002')
        self.assertTrue(result['is_duplicate'])
        self.assertGreaterEqual(result['similarity_score'], 1.0)
    
    def test_check_pair_different(self):
        result = DuplicateChecker.check_pair(self.part1, self.part3)
        
        self.assertFalse(result['is_duplicate'])
        self.assertGreater(len(result['differences']), 0)
    
    def test_find_duplicates_of(self):
        parts = [self.part1, self.part2, self.part3]
        
        duplicates = DuplicateChecker.find_duplicates_of(self.part1, parts)
        
        self.assertEqual(len(duplicates), 1)
        self.assertEqual(duplicates[0]['part_number'], 'DUP-002')


if __name__ == '__main__':
    unittest.main()
